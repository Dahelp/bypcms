<?php
declare(strict_types=1);
namespace BYPCMS\Core;

use PDO;
use RuntimeException;
use Throwable;

require_once __DIR__.'/Content.php';
require_once __DIR__.'/SmtpTransport.php';

/** Business uses the same transactional content/media contract as Content. */
final class Business {
    public const VERSION = '2.2.0';
    public const STATES = ['new'=>'Новая','processing'=>'В работе','done'=>'Завершена','spam'=>'Спам'];
    public Content $content;

    public function __construct(public Database $db, public array $config, public string $root) {
        $this->content = new Content($db,$config,$root);
        self::schema($db->pdo());
    }

    public static function schema(PDO $pdo): void {
        Content::schema($pdo);
        if ($pdo->query("SELECT 1 FROM byp_migrations WHERE migration='2026_11_08_business_v1'")->fetchColumn()) return;
        $pdo->exec('CREATE TABLE IF NOT EXISTS byp_business_leads (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            request_hash CHAR(64) NOT NULL UNIQUE, payload_hash CHAR(64) NOT NULL,
            reference CHAR(16) NOT NULL UNIQUE, name VARCHAR(150) NOT NULL,
            email VARCHAR(190) NOT NULL, phone VARCHAR(60) NOT NULL, message TEXT NOT NULL,
            service_id INT UNSIGNED NULL, project_id INT UNSIGNED NULL, context_json TEXT NOT NULL,
            consent_at DATETIME NOT NULL, consent_version VARCHAR(40) NOT NULL,
            ip_hash CHAR(64) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT "new",
            assignee_id INT UNSIGNED NULL, notes TEXT NOT NULL, revision INT UNSIGNED NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
            INDEX(status,created_at), INDEX(assignee_id), INDEX(ip_hash,created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $pdo->exec('CREATE TABLE IF NOT EXISTS byp_business_mail (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, lead_id BIGINT UNSIGNED NOT NULL UNIQUE,
            event_key VARCHAR(190) NOT NULL UNIQUE, recipient VARCHAR(190) NOT NULL DEFAULT "",
            state VARCHAR(30) NOT NULL DEFAULT "pending", attempts INT NOT NULL DEFAULT 0,
            last_error TEXT NULL, lease_until DATETIME NULL, accepted_at DATETIME NULL,
            created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
            FOREIGN KEY(lead_id) REFERENCES byp_business_leads(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $pdo->exec('INSERT IGNORE INTO byp_migrations(migration,batch,applied_at) VALUES("2026_11_08_business_v1",3,NOW())');
    }

    public function enabled(string $module): bool {
        return (bool)$this->db->one('SELECT id FROM byp_modules WHERE module_key=? AND status="active"',[$module]);
    }

    public function settings(): array {
        $s=$this->content->settings();
        $saved=$this->db->all('SELECT setting_key FROM byp_settings WHERE setting_group="journal"');
        $keys=array_column($saved,'setting_key');
        foreach(['tagline'=>'Пространства для жизни и работы.','accent'=>'#d9fd75','heading_font'=>'manrope','theme'=>is_file($this->root.'/themes/custom/page.html')?'custom':'atelier'] as $k=>$v) if(!in_array($k,$keys,true)) $s[$k]=$v;
        $s['site_url']=$this->config['app']['url'];
        return $s;
    }

    public static function leadInput(array $v): array {
        $out=[];
        foreach(['name'=>150,'email'=>190,'phone'=>60,'message'=>5000] as $k=>$limit) {
            $out[$k]=trim((string)($v[$k]??''));
            if(mb_strlen($out[$k])>$limit || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/',$out[$k])) throw new RuntimeException('Проверьте длину полей заявки.');
        }
        if($out['name']==='' || $out['message']==='') throw new RuntimeException('Укажите имя и расскажите о задаче.');
        if($out['email']==='' && $out['phone']==='') throw new RuntimeException('Оставьте email или телефон для ответа.');
        if($out['email']!=='' && !filter_var($out['email'],FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Проверьте email.');
        if($out['phone']!=='' && !preg_match('/^[+()0-9 .-]{7,60}$/D',$out['phone'])) throw new RuntimeException('Проверьте телефон.');
        if(($v['consent']??'')!=='1') throw new RuntimeException('Для отправки необходимо согласие на обработку данных.');
        if(!empty($v['website'])) throw new RuntimeException('Заявка отклонена антиспам-проверкой.');
        if(!preg_match('/^[a-f0-9]{32}$/D',(string)($v['request_token']??''))) throw new RuntimeException('Обновите форму и повторите отправку.');
        $out['service_id']=(int)($v['service_id']??0)?:null;
        $out['project_id']=(int)($v['project_id']??0)?:null;
        return $out;
    }

    /** Submission and notification commit together; mail failure never loses the lead. */
    public function submit(array $input,string $session,string $ip): array {
        if(!$this->enabled('forms')) throw new RuntimeException('Форма временно отключена. Свяжитесь с нами по контактам на странице.');
        $policy=$this->db->one('SELECT status,published_at FROM byp_pages WHERE slug="privacy"');
        if(!$policy||!self::published($policy))throw new RuntimeException('Форма недоступна до публикации условий обработки данных.');
        $v=self::leadInput($input);
        $hash=hash_hmac('sha256',$session.':'.$input['request_token'],$this->config['app']['key']);
        $payload=hash('sha256',json_encode($v,JSON_UNESCAPED_UNICODE));
        $lookup=function()use($hash,$payload){$r=$this->db->one('SELECT id,reference,payload_hash FROM byp_business_leads WHERE request_hash=?',[$hash]);if($r&&!hash_equals($r['payload_hash'],$payload))throw new RuntimeException('Эта заявка уже сохранена. Для другой задачи откройте новую форму.');return $r;};
        if($r=$lookup()) return $r;
        $context=[];
        foreach(['service_id'=>'service','project_id'=>'project'] as $field=>$kind) if($v[$field]) {
            $p=$this->content->get($v[$field]);
            if(!$p || $p['kind']!==$kind || !self::published($p)) throw new RuntimeException('Выбранная услуга или проект больше недоступны. Выберите доступное направление.');
            $context[$kind]=['id'=>$p['id'],'title'=>$p['title'],'slug'=>$p['slug']];
        }
        if($v['project_id']&&!$v['service_id']&&!empty($p['parent_id'])) {
            $service=$this->content->get((int)$p['parent_id']);
            if($service&&$service['kind']==='service'&&self::published($service)) {$v['service_id']=$service['id'];$context['service']=['id'=>$service['id'],'title'=>$service['title'],'slug'=>$service['slug']];}
        }
        $ipHash=hash_hmac('sha256',$ip,$this->config['app']['key']);
        if((int)($this->db->one('SELECT COUNT(*) n FROM byp_business_leads WHERE ip_hash=? AND created_at>DATE_SUB(NOW(),INTERVAL 1 HOUR)',[$ipHash])['n']??0)>=10) throw new RuntimeException('Слишком много заявок. Попробуйте позже или свяжитесь с нами напрямую.');
        $pdo=$this->db->pdo();$pdo->beginTransaction();
        try {
            $ref=strtoupper(bin2hex(random_bytes(8)));
            $id=$this->db->insert('INSERT INTO byp_business_leads(request_hash,payload_hash,reference,name,email,phone,message,service_id,project_id,context_json,consent_at,consent_version,ip_hash,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,NOW(),"business-form-v1",?,"",NOW(),NOW())',[$hash,$payload,$ref,$v['name'],$v['email'],$v['phone'],$v['message'],$v['service_id'],$v['project_id'],json_encode($context,JSON_UNESCAPED_UNICODE),$ipHash]);
            $this->db->execute('INSERT INTO byp_business_mail(lead_id,event_key,created_at,updated_at) VALUES(?,?,NOW(),NOW())',[$id,'business-lead:'.$id]);
            $pdo->commit();return ['id'=>$id,'reference'=>$ref];
        } catch(Throwable $e) {if($pdo->inTransaction())$pdo->rollBack();if($r=$lookup())return $r;throw $e;}
    }

    public static function published(array $p): bool {
        return in_array($p['status']??'',['published','scheduled'],true) && (empty($p['published_at'])||strtotime($p['published_at'].' UTC')<=time());
    }

    public function lead(int $id,array $user): array {
        $r=$this->db->one('SELECT l.*,u.name assignee_name FROM byp_business_leads l LEFT JOIN byp_users u ON u.id=l.assignee_id WHERE l.id=?',[$id]);
        if(!$r||!in_array($user['role'],['owner','admin','editor','manager'],true)||($user['role']==='manager'&&$r['assignee_id']&&(int)$r['assignee_id']!==(int)$user['id'])) throw new RuntimeException('Заявка недоступна.');
        return $r;
    }

    public function updateLead(array $v,array $user): void {
        $id=(int)($v['id']??0);$old=$this->lead($id,$user);
        $status=$v['status']??'';$assignee=(int)($v['assignee_id']??0)?:null;$notes=trim((string)($v['notes']??''));
        if(!isset(self::STATES[$status])||mb_strlen($notes)>10000) throw new RuntimeException('Проверьте статус и длину заметки.');
        if($assignee && !$this->db->one('SELECT u.id FROM byp_users u JOIN byp_roles r ON r.id=u.role_id WHERE u.id=? AND u.status="active" AND r.slug IN ("owner","admin","editor","manager")',[$assignee])) throw new RuntimeException('Выберите действующего сотрудника.');
        if($user['role']==='manager'&&$assignee!==(int)$user['id']) throw new RuntimeException('Менеджер может назначить заявку только себе.');
        $pdo=$this->db->pdo();$pdo->beginTransaction();try {
            if(!$this->db->execute('UPDATE byp_business_leads SET status=?,assignee_id=?,notes=?,revision=revision+1,updated_at=NOW() WHERE id=? AND revision=?',[$status,$assignee,$notes,$id,(int)($v['revision']??0)])) throw new RuntimeException('Заявка уже изменена. Обновите её перед сохранением; ваш ввод остаётся в форме.');
            $this->db->execute('INSERT INTO byp_audit_logs(user_id,action,entity_type,entity_id,metadata,created_at) VALUES(?,"business.lead.update","business_lead",?,?,NOW())',[$user['id'],$id,json_encode(['from'=>$old['status'],'to'=>$status,'assignee'=>$assignee],JSON_UNESCAPED_UNICODE)]);
            $pdo->commit();
        }catch(Throwable $e){$pdo->rollBack();throw $e;}
    }

    public function mailSettings(bool $secrets=false): array {
        $s=['smtp_enabled'=>false,'smtp_host'=>'','smtp_port'=>587,'smtp_security'=>'starttls','smtp_user'=>'','smtp_password'=>'','from_email'=>'','from_name'=>'Atelier','owner_email'=>''];
        $r=$this->db->one('SELECT setting_value FROM byp_settings WHERE setting_group="business_private" AND setting_key="smtp"');
        if($r)$s=array_replace($s,json_decode($r['setting_value'],true)??[]);
        $cipher=$s['password_cipher']??'';unset($s['password_cipher']);
        $s['smtp_password_saved']=$cipher!=='';
        if($secrets&&$cipher!=='')$s['smtp_password']=LicenseCrypto::decrypt($cipher,$this->config['app']['key']);
        if(!$secrets)unset($s['smtp_password']);return $s;
    }

    public function configureMail(array $v): void {
        $s=$this->mailSettings(true);$s['smtp_enabled']=!empty($v['smtp_enabled']);
        foreach(['smtp_host','smtp_user','from_email','from_name','owner_email','smtp_security'] as $k) $s[$k]=trim((string)($v[$k]??$s[$k]));
        $s['smtp_port']=(int)($v['smtp_port']??$s['smtp_port']);
        if(!empty($v['clear_password']))$s['smtp_password']='';elseif(!empty($v['smtp_password']))$s['smtp_password']=(string)$v['smtp_password'];
        foreach(['from_email','owner_email']as $k)if($s[$k]!=='')CommerceSettings::email($s[$k]);
        if(!in_array($s['smtp_port'],[465,587],true)||!in_array($s['smtp_security'],['ssl','starttls'],true)||($s['smtp_security']==='ssl')!==($s['smtp_port']===465)) throw new RuntimeException('Используйте SSL:465 или STARTTLS:587.');
        if($s['smtp_host']!==''&&!preg_match('/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/D',$s['smtp_host']))throw new RuntimeException('SMTP host указывается без протокола и пути.');
        foreach(['smtp_user'=>190,'from_name'=>120,'smtp_password'=>2048]as $k=>$limit)if(strlen($s[$k])>$limit||preg_match('/[\r\n\x00]/',$s[$k]))throw new RuntimeException('Проверьте параметры SMTP.');
        if($s['smtp_enabled'])foreach(['smtp_host','smtp_user','smtp_password','from_email','owner_email']as $k)if($s[$k]==='')throw new RuntimeException('Для включения заполните SMTP, отправителя и получателя.');
        $s['password_cipher']=$s['smtp_password']===''?'':LicenseCrypto::encrypt($s['smtp_password'],$this->config['app']['key']);unset($s['smtp_password'],$s['smtp_password_saved']);
        $this->db->execute('INSERT INTO byp_settings(setting_group,setting_key,setting_value,value_type,is_public,updated_at) VALUES("business_private","smtp",?,"json",0,NOW()) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_at=NOW()',[json_encode($s,JSON_UNESCAPED_UNICODE)]);
    }

    /** Explicit employee retry; accepted and ambiguous deliveries are never blindly resent. */
    public function sendMail(int $lead,bool $acknowledge=false): void {
        $s=$this->mailSettings(true);
        if(!$s['smtp_enabled'])throw new RuntimeException('SMTP не настроен. Заявка сохранена; подключите почту в настройках.');
        $pdo=$this->db->pdo();$pdo->beginTransaction();
        try {
            $m=$this->db->one('SELECT * FROM byp_business_mail WHERE lead_id=? FOR UPDATE',[$lead]);
            if(!$m||$m['state']==='accepted')throw new RuntimeException('Уведомление уже принято SMTP или не найдено.');
            if($m['state']==='sending'&&strtotime($m['lease_until'])>time())throw new RuntimeException('Уведомление уже отправляется.');
            if(in_array($m['state'],['sending','uncertain'],true)&&!$acknowledge)throw new RuntimeException('Результат прошлой отправки неизвестен. Проверьте почту и подтвердите осознанный повтор.');
            $this->db->execute('UPDATE byp_business_mail SET state="sending",attempts=attempts+1,recipient=?,lease_until=DATE_ADD(NOW(),INTERVAL 2 MINUTE),updated_at=NOW() WHERE id=?',[$s['owner_email'],$m['id']]);$pdo->commit();
        }catch(Throwable $e){$pdo->rollBack();throw $e;}
        $l=$this->db->one('SELECT * FROM byp_business_leads WHERE id=?',[$lead]);
        try {
            (new SmtpTransport($s,$this->config))->send(['event_key'=>$m['event_key'],'recipient'=>$s['owner_email'],'subject'=>'Новая заявка '.$l['reference'],'message'=>$l['name']."\n".$l['email']."\n".$l['phone']."\n".$l['message']."\n".rtrim($this->config['app']['url'],'/').'/manage/?section=leads&lead='.$lead]);
            $this->db->execute('UPDATE byp_business_mail SET state="accepted",accepted_at=NOW(),lease_until=NULL,last_error=NULL,updated_at=NOW() WHERE id=?',[$m['id']]);
        }catch(Throwable $e){$uncertain=$e instanceof MailTransportException&&$e->uncertain;$message=$e instanceof MailTransportException?$e->getMessage():'Не удалось подготовить отправку.';$this->db->execute('UPDATE byp_business_mail SET state=?,lease_until=NULL,last_error=?,updated_at=NOW() WHERE id=?',[$uncertain?'uncertain':'failed',$message,$m['id']]);throw new RuntimeException($message);}
    }

    public static function seed(PDO $pdo,int $user,string $site): void {
        $seed=require __DIR__.'/AtelierSeed.php';
        foreach($seed as $p){$stmt=$pdo->prepare('INSERT IGNORE INTO byp_pages(author_id,slug,title,excerpt,content,blocks,template,status,published_at,created_at,updated_at) VALUES(?,?,?,?,?, ?,"atelier","published",UTC_TIMESTAMP(),NOW(),NOW())');$stmt->execute([$user,$p['slug'],$p['title'],$p['excerpt'],$p['content'],json_encode($p['blocks']??[],JSON_UNESCAPED_UNICODE)]);$id=$pdo->query('SELECT id FROM byp_pages WHERE slug='.$pdo->quote($p['slug']))->fetchColumn();$meta=$p;unset($meta['content'],$meta['blocks'],$meta['title'],$meta['excerpt'],$meta['slug'],$meta['kind']);$pdo->prepare('INSERT IGNORE INTO byp_content_meta(page_id,kind,data,revision) VALUES(?,?,?,1)')->execute([$id,$p['kind'],json_encode($meta,JSON_UNESCAPED_UNICODE)]);}
        // Relationships are IDs rather than copied titles; renaming a service preserves its cases.
        foreach($seed as $p)if(!empty($p['service_slug']))$pdo->exec('UPDATE byp_pages SET parent_id=(SELECT id FROM (SELECT id FROM byp_pages WHERE slug='.$pdo->quote($p['service_slug']).') s) WHERE slug='.$pdo->quote($p['slug']));
    }
}
