<?php
declare(strict_types=1);
namespace BYPCMS\Core;
require_once (defined('BYPCMS_SITE_ROOT')?BYPCMS_SITE_ROOT.'/_core/UpdateRuntime.php':__DIR__.'/UpdateRuntime.php');

/** Opt-in release mail shares the transactional outbox and its delivery/retry protections. */
final class ReleaseAnnouncements {
    public function __construct(private Database $db,private array $config,private string $root){
        if(($config['app']['installation_type']??'platform')==='client')throw new \RuntimeException('Подписка доступна в кабинете покупателя BYPCMS.');
        if($db->pdo()->inTransaction())return; // Never run DDL inside an outbox delivery transaction.
        $marker=UpdateRuntime::storage($root,true).'/release-announcements-schema.lock';if(is_file($marker))return;
        $db->execute('CREATE TABLE IF NOT EXISTS byp_release_subscriptions(customer_id INT UNSIGNED PRIMARY KEY,enabled TINYINT NOT NULL DEFAULT 0,updated_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $db->execute('CREATE TABLE IF NOT EXISTS byp_release_scan(id TINYINT PRIMARY KEY,cursor_id INT UNSIGNED NOT NULL) ENGINE=InnoDB');
        $db->execute('CREATE TABLE IF NOT EXISTS byp_release_announcements(mail_id BIGINT UNSIGNED PRIMARY KEY,customer_id INT UNSIGNED NOT NULL,release_id CHAR(64) NOT NULL,INDEX(customer_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        if(file_put_contents($marker,date(DATE_ATOM),LOCK_EX)===false)throw new \RuntimeException('Не удалось подготовить подписку на выпуски.');
    }
    public function subscribed(int $customer):bool{return (bool)($this->db->one('SELECT enabled FROM byp_release_subscriptions WHERE customer_id=?',[$customer])['enabled']??false);}
    public function subscribe(int $customer,bool $enabled):void {
        if(!$this->db->one('SELECT id FROM byp_customer_accounts WHERE id=?',[$customer]))throw new \RuntimeException('Войдите в кабинет покупателя.');
        $this->db->execute('INSERT INTO byp_release_subscriptions(customer_id,enabled,updated_at) VALUES(?,?,NOW()) ON DUPLICATE KEY UPDATE enabled=VALUES(enabled),updated_at=NOW()',[$customer,(int)$enabled]);
    }
    private function licenses(int $customer):array {
        if(!$this->db->one("SHOW TABLES LIKE 'byp_license_order_links'"))return [];
        return $this->db->all('SELECT DISTINCT l.* FROM byp_license_registry l JOIN byp_license_order_links k ON k.license_id=l.id JOIN byp_customer_orders o ON o.id=k.order_id JOIN byp_commerce_orders c ON c.order_id=o.id WHERE o.customer_id=? AND l.status="active" AND (l.license_term="lifetime" OR l.valid_until>=UTC_DATE()) AND c.payment_state="paid" AND c.fulfillment_state="ready" AND NOT EXISTS(SELECT 1 FROM byp_commerce_license_blocks b WHERE b.license_id=l.id AND b.state<>"cleared")',[$customer]);
    }
    public static function eligible(array $release,array $license):bool {
        $version=$license['installed_version']?:$license['core_version'];
        return in_array(strtolower($license['edition']),$release['editions'],true)&&in_array($version,$release['from'],true)&&version_compare($release['version'],$version,'>')&&!array_diff($release['modules'],json_decode($license['entitlements'],true)?:[]);
    }
    private function catalog():array {return UpdateRuntime::json(UpdateRuntime::storage($this->root,true).'/feed/catalog.json',['releases'=>[]])['releases'];}
    public static function message(array $release,string $origin):array {
        $p=parse_url($origin);if(!in_array($p['scheme']??'',['https','http'],true)||empty($p['host'])||isset($p['user'])||isset($p['pass'])||isset($p['query'])||isset($p['fragment']))throw new \InvalidArgumentException('Некорректный адрес кабинета.');
        $version=$release['version'];if(!preg_match('/^\d+\.\d+\.\d+$/D',$version))throw new \RuntimeException('Некорректный выпуск.');
        $url=rtrim($origin,'/').'/account/';$notes=array_map(fn($n)=>mb_substr($n,0,500),array_slice($release['notes']??[],0,20));
        $text="Доступен выпуск клиентской CMS BYPCMS ".$version.".\n\n".implode("\n",array_map(fn($n)=>'• '.$n,$notes))."\n\nОткройте свою CMS → Обновления. Перед установкой проверьте совместимость и подтвердите создание резервной копии. Установка запускается только после подтверждения владельца.\n\nКабинет покупателя и настройка писем: ".$url;
        $e=fn($s)=>htmlspecialchars((string)$s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
        return ['subject'=>'Доступен выпуск BYPCMS '.$version,'message'=>$text,'template_key'=>'release_available','template_version'=>'2026-11-19.1','audience'=>'customer','html'=>'<!doctype html><html lang="ru"><meta charset="utf-8"><body style="font:16px/1.6 Arial,sans-serif;color:#26352d"><h1>Выпуск BYPCMS '.$e($version).'</h1><p>'.nl2br($e($text)).'</p><p><a href="'.$e($url).'">Кабинет и настройка уведомлений</a></p></body></html>'];
    }
    public function queue(CommerceNotifications $notifications):int {
        $releases=$this->catalog();usort($releases,fn($a,$b)=>version_compare($b['version'],$a['version']));$count=0;
        $cursor=(int)($this->db->one('SELECT cursor_id FROM byp_release_scan WHERE id=1')['cursor_id']??0);
        $recipients=$this->db->all('SELECT c.id,c.email FROM byp_customer_accounts c JOIN byp_release_subscriptions s ON s.customer_id=c.id AND s.enabled=1 WHERE c.id>? ORDER BY c.id LIMIT 100',[$cursor]);
        $processed=0;
        foreach($recipients as $customer){
            $cursor=(int)$customer['id'];$processed++;$licenses=$this->licenses($cursor);$selected=null;
            foreach($releases as $r){foreach($licenses as $l)if(self::eligible($r,$l)){$selected=$r;break;}if($selected)break;}
            if(!$selected)continue;$release=$selected;$key='release:'.$release['id'].':customer:'.$cursor;
            if($this->db->one('SELECT id FROM byp_notification_outbox WHERE event_key=?',[$key]))continue;
            $mail=self::message($release,$this->config['app']['url']);$pdo=$this->db->pdo();$pdo->beginTransaction();try{
                $s=$this->db->one('SELECT enabled FROM byp_release_subscriptions WHERE customer_id=? FOR UPDATE',[$cursor]);
                if(!$s['enabled']){$pdo->commit();continue;}
                $id=$notifications->enqueue($key,null,$customer['email'],$mail['subject'],$mail['message'],$mail);
                $this->db->execute('INSERT IGNORE INTO byp_release_announcements(mail_id,customer_id,release_id) VALUES(?,?,?)',[$id,$cursor,$release['id']]);$pdo->commit();$count++;
            }catch(\Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
            if($count>=20)break;
        }
        if($processed===count($recipients)&&count($recipients)<100)$cursor=0;
        $this->db->execute('INSERT INTO byp_release_scan(id,cursor_id) VALUES(1,?) ON DUPLICATE KEY UPDATE cursor_id=VALUES(cursor_id)',[$cursor]);return $count;
    }
    public function obsolete(array $mail):?string {
        $record=$this->db->one('SELECT a.*,c.email,s.enabled FROM byp_release_announcements a JOIN byp_customer_accounts c ON c.id=a.customer_id JOIN byp_release_subscriptions s ON s.customer_id=a.customer_id WHERE a.mail_id=?',[$mail['id']]);
        if(!$record||!$record['enabled']||$record['email']!==$mail['recipient'])return 'Покупатель отключил уведомления о выпусках или изменил адрес.';
        foreach($this->catalog()as $r)if($r['id']===$record['release_id']){foreach($this->licenses((int)$record['customer_id'])as $l)if(self::eligible($r,$l))return null;}
        return 'Выпуск больше не доступен для лицензии покупателя или уже установлен.';
    }
}
