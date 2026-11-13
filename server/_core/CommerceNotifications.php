<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use RuntimeException;
use Throwable;
require_once __DIR__.'/SmtpTransport.php';
require_once __DIR__.'/CommerceMailTemplates.php';
require_once __DIR__.'/LicensePolicy.php';

final class CommerceNotifications {
    public function __construct(private Database $db,private CommerceSettings $settings,private array $config){
        foreach([
            'CREATE TABLE IF NOT EXISTS byp_mail_metadata (mail_id BIGINT UNSIGNED PRIMARY KEY,template_key VARCHAR(40) NOT NULL DEFAULT "legacy",template_version VARCHAR(30) NOT NULL DEFAULT "",audience VARCHAR(16) NOT NULL DEFAULT "",invoice_id BIGINT UNSIGNED NULL,html LONGTEXT NULL,parent_id BIGINT UNSIGNED NULL,cycle_attempts INT UNSIGNED NOT NULL DEFAULT 0,lease_token CHAR(32) NULL,INDEX(parent_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
            'CREATE TABLE IF NOT EXISTS byp_mail_attempts (token CHAR(32) PRIMARY KEY,mail_id BIGINT UNSIGNED NOT NULL,attempt_number INT UNSIGNED NOT NULL,state VARCHAR(24) NOT NULL,smtp_code INT NULL,error VARCHAR(255) NULL,started_at DATETIME NOT NULL,finished_at DATETIME NULL,INDEX(mail_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
            'CREATE TABLE IF NOT EXISTS byp_mail_actions (operation_id CHAR(32) PRIMARY KEY,mail_id BIGINT UNSIGNED NOT NULL,action VARCHAR(16) NOT NULL,result_id BIGINT UNSIGNED NOT NULL,owner_id BIGINT UNSIGNED NOT NULL,created_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
        ]as $sql)$db->execute($sql);
    }
    public function enqueue(string $key,?int $order,string $email,string $subject,string $message,array $template=[]):int {
        CommerceSettings::email($email);if(strlen($key)>150||strlen($subject)>190||strlen($message)>20000||preg_match('/[\r\n\x00]/',$subject))throw new RuntimeException('Некорректное уведомление.');
        $pdo=$this->db->pdo();$own=!$pdo->inTransaction();if($own)$pdo->beginTransaction();try{
            $this->db->execute('INSERT IGNORE INTO byp_notification_outbox(event_key,order_id,recipient,subject,message,state,next_attempt_at,created_at) VALUES(?,?,?,?,?,"pending",NOW(),NOW())',[$key,$order,$email,$subject,$message]);
            $id=(int)$this->db->one('SELECT id FROM byp_notification_outbox WHERE event_key=?',[$key])['id'];
            $this->db->execute('INSERT IGNORE INTO byp_mail_metadata(mail_id,template_key,template_version,audience,invoice_id,html,parent_id) VALUES(?,?,?,?,?,?,?)',[$id,$template['template_key']??'legacy',$template['template_version']??'',$template['audience']??'', $template['invoice_id']??null,$template['html']??null,$template['parent_id']??null]);
            if($own)$pdo->commit();return $id;
        }catch(Throwable $e){if($own&&$pdo->inTransaction())$pdo->rollBack();throw $e;}
    }
    /** Called in the same transaction as the business transition. The snapshot never includes secrets. */
    public function event(array $order,string $type):void {
        $order=$this->db->one('SELECT o.*,d.* FROM byp_customer_orders o JOIN byp_commerce_orders d ON d.order_id=o.id WHERE o.id=?',[$order['id']])??$order;
        $key='order:'.$order['id'].':'.$type;$base=explode(':',$type)[0];
        if(!$this->db->execute('INSERT IGNORE INTO byp_commerce_events(event_key,order_id,event_type,created_at) VALUES(?,?,?,NOW())',[$key,$order['id'],$base]))return;
        $order['services']=json_decode($order['items_json']??'{}',true)['services']??[];
        $invoice=null;if(in_array($base,['invoice','invoice_accepted','invoice_canceled','invoice_expired'],true)){
            if(in_array($base,['invoice_accepted','invoice_canceled','invoice_expired'],true))$invoice=$this->db->one('SELECT id,number,amount_minor,expires_on,accepted_at FROM byp_commerce_invoices WHERE id=? AND order_id=?',[(int)(explode(':',$type)[1]??0),$order['id']]);
            else $invoice=$this->db->one('SELECT id,number,amount_minor,expires_on,accepted_at FROM byp_commerce_invoices WHERE order_id=? ORDER BY id DESC LIMIT 1',[$order['id']]);
        }
        if(!$invoice&&in_array($base,['paid','ready','fulfillment_error','receipt','refund_request','refund_approved','refund_succeeded','refund_declined','refund_failed'],true))$invoice=$this->db->one('SELECT id,number,amount_minor,expires_on,accepted_at FROM byp_commerce_invoices WHERE order_id=? AND state="paid" ORDER BY id DESC LIMIT 1',[$order['id']]);
        $origin=$this->config['app']['url'];$ownerMail=CommerceMailTemplates::render($order,$base,'owner',$origin,$invoice);
        $this->db->execute('INSERT INTO byp_owner_notifications(notification_type,title,message,entity_type,entity_id,severity,is_read,created_at) VALUES(?,?,?,"purchase",?,?,0,NOW())',['purchase_'.$base,$ownerMail['subject'],mb_substr($ownerMail['message'],0,2000),$order['id'],$base==='fulfillment_error'?'warning':'info']);
        $owner=$this->settings->get()['owner_email'];if($owner==='')$owner=(string)($this->db->one('SELECT u.email FROM byp_users u JOIN byp_roles r ON r.id=u.role_id WHERE r.slug="owner" AND u.status="active" ORDER BY u.id LIMIT 1')['email']??'');
        if($owner!=='')$this->enqueue($key.':owner',(int)$order['id'],$owner,$ownerMail['subject'],$ownerMail['message'],$ownerMail);
        $customer=$this->db->one('SELECT email FROM byp_customer_accounts WHERE id=?',[$order['customer_id']]);
        if($customer){$mail=CommerceMailTemplates::render($order,$base,'customer',$origin,$invoice);$this->enqueue($key.':customer',(int)$order['id'],$customer['email'],$mail['subject'],$mail['message'],$mail);}
    }
    private function metadata(int $id):array {
        $this->db->execute('INSERT IGNORE INTO byp_mail_metadata(mail_id,cycle_attempts) SELECT id,LEAST(attempts,5) FROM byp_notification_outbox WHERE id=?',[$id]);
        $meta=$this->db->one('SELECT * FROM byp_mail_metadata WHERE mail_id=?',[$id]);
        if($meta['template_key']==='legacy'){
            $mail=$this->db->one('SELECT event_key,order_id FROM byp_notification_outbox WHERE id=?',[$id]);$parts=explode(':',$mail['event_key']);$base=$parts[2]??'';$audience=end($parts);
            if(($parts[0]??'')==='order'&&in_array($base,CommerceMailTemplates::EVENTS,true)&&in_array($audience,['customer','owner'],true)){
                $invoice=null;if($base==='invoice')$invoice=$this->db->one('SELECT id FROM byp_commerce_invoices WHERE order_id=? AND number=?',[$mail['order_id'],$parts[3]??'']);elseif(in_array($base,['invoice_accepted','invoice_canceled','invoice_expired'],true))$invoice=['id'=>(int)($parts[3]??0)];
                $this->db->execute('UPDATE byp_mail_metadata SET template_key=?,template_version="legacy",audience=?,invoice_id=? WHERE mail_id=?',[$base,$audience,$invoice['id']??null,$id]);$meta=$this->db->one('SELECT * FROM byp_mail_metadata WHERE mail_id=?',[$id]);
            }
        }return $meta;
    }
    private function obsolete(array $mail,array $meta):?string {
        if(!$mail['order_id'])return null;
        $o=$this->db->one('SELECT * FROM byp_commerce_orders WHERE order_id=?',[$mail['order_id']]);if(!$o)return 'Заказ больше недоступен.';
        $key=$meta['template_key'];
        if($key==='created'&&$meta['audience']==='customer'&&$this->db->one('SELECT id FROM byp_commerce_invoices WHERE order_id=? LIMIT 1',[$mail['order_id']]))return 'Вместо первоначального сообщения подготовлено уведомление о счёте.';
        if(in_array($key,['invoice','invoice_expired','invoice_accepted'],true)){
            $i=$this->db->one('SELECT * FROM byp_commerce_invoices WHERE order_id=? ORDER BY id DESC LIMIT 1',[$mail['order_id']]);
            if(!$i||(int)$i['id']!==(int)$meta['invoice_id']||$i['state']!=='issued'||$o['payment_state']==='paid')return 'Счёт отменён, заменён или уже оплачен. Старое приглашение к оплате не отправляется.';
            if($key==='invoice'&&$i['expires_on']<gmdate('Y-m-d'))return 'Срок оплаты счёта истёк.';
            if($key==='invoice_expired'&&$i['expires_on']>=gmdate('Y-m-d'))return 'Срок оплаты ещё не истёк.';
        }
        if($key==='canceled'&&$o['payment_state']!=='canceled')return 'Состояние оплаты изменилось после отмены прежней попытки.';
        if($key==='paid'&&$o['fulfillment_state']==='refunded')return 'Оплата полностью возвращена; актуальный результат указан в уведомлении о возврате.';
        if($key==='ready'&&($o['fulfillment_state']!=='ready'||$this->db->one('SELECT order_id FROM byp_commerce_license_blocks WHERE order_id=? AND state<>"cleared"',[$mail['order_id']])))return 'Покупка больше не доступна для выдачи по прежнему уведомлению.';
        if($key==='fulfillment_error'&&$o['fulfillment_state']!=='failed')return 'Ошибка выдачи уже устранена или права по заказу изменились.';
        return null;
    }
    public function detail(int $id):array {
        $mail=$this->db->one('SELECT * FROM byp_notification_outbox WHERE id=?',[$id]);if(!$mail)throw new RuntimeException('Письмо не найдено.');$meta=$this->metadata($id);
        unset($mail['event_key'],$mail['lease_until']);unset($meta['lease_token']);return $mail+$meta+['obsolete_reason'=>$this->obsolete($mail,$meta),'history'=>$this->db->all('SELECT attempt_number,state,smtp_code,error,started_at,finished_at FROM byp_mail_attempts WHERE mail_id=? ORDER BY started_at,attempt_number',[$id])];
    }
    public function summary():array {
        $counts=[];foreach($this->db->all('SELECT state,COUNT(*) n FROM byp_notification_outbox GROUP BY state')as $row)$counts[$row['state']]=(int)$row['n'];return $counts;
    }
    public function process(int $limit=3):array {
        $s=$this->settings->get();$result=['accepted'=>0,'failed'=>0,'uncertain'=>0,'superseded'=>0];if(!$s['smtp_enabled']){$result['disabled']=true;$limit=0;}
        // Recover abandoned leases conservatively: DATA may have reached the recipient already.
        foreach($this->db->all('SELECT id FROM byp_notification_outbox WHERE state="sending" AND lease_until<NOW() LIMIT 100')as $r){$pdo=$this->db->pdo();$pdo->beginTransaction();try{
            $mail=$this->db->one('SELECT *,lease_until<NOW() AS expired FROM byp_notification_outbox WHERE id=? FOR UPDATE',[$r['id']]);
            if($mail['state']==='sending'&&!empty($mail['expired'])){$result['uncertain']++;$meta=$this->metadata((int)$mail['id']);$this->db->execute('UPDATE byp_notification_outbox SET state="uncertain",last_error="Процесс прерван. SMTP мог принять письмо; проверьте получателя.",lease_until=NULL WHERE id=?',[$mail['id']]);$this->db->execute('UPDATE byp_mail_metadata SET lease_token=NULL WHERE mail_id=?',[$mail['id']]);if($meta['lease_token'])$this->db->execute('UPDATE byp_mail_attempts SET state="uncertain",error="Истёк срок процесса отправки",finished_at=NOW() WHERE token=?',[$meta['lease_token']]);}$pdo->commit();
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}}
        $sent=0;for($scan=0;$sent<max(0,min(10,$limit))&&$scan<100;$scan++){
            $candidate=$this->db->one('SELECT id,order_id FROM byp_notification_outbox WHERE state IN ("pending","retry") AND next_attempt_at<=NOW() ORDER BY id LIMIT 1');if(!$candidate)break;
            $pdo=$this->db->pdo();$pdo->beginTransaction();try{
                if($candidate['order_id'])$this->db->one('SELECT order_id FROM byp_commerce_orders WHERE order_id=? FOR UPDATE',[$candidate['order_id']]);
                $mail=$this->db->one('SELECT * FROM byp_notification_outbox WHERE id=? AND state IN ("pending","retry") AND next_attempt_at<=NOW() FOR UPDATE',[$candidate['id']]);if(!$mail){$pdo->commit();continue;}$meta=$this->metadata((int)$mail['id']);
                if($reason=$this->obsolete($mail,$meta)){$this->db->execute('UPDATE byp_notification_outbox SET state="superseded",last_error=? WHERE id=?',[$reason,$mail['id']]);$result['superseded']++;$pdo->commit();continue;}
                $token=bin2hex(random_bytes(16));$number=(int)$mail['attempts']+1;
                $this->db->execute('UPDATE byp_notification_outbox SET state="sending",attempts=attempts+1,lease_until=DATE_ADD(NOW(),INTERVAL 5 MINUTE) WHERE id=?',[$mail['id']]);$this->db->execute('UPDATE byp_mail_metadata SET lease_token=?,cycle_attempts=cycle_attempts+1 WHERE mail_id=?',[$token,$mail['id']]);
                $this->db->execute('INSERT INTO byp_mail_attempts(token,mail_id,attempt_number,state,started_at) VALUES(?,?,?,"sending",NOW())',[$token,$mail['id'],$number]);$pdo->commit();$sent++;
            }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
            $state='accepted';$code=null;$error=null;
            try{$code=(new SmtpTransport($s,$this->config))->send($mail+['html'=>$meta['html']]);}
            catch(MailTransportException $e){$code=$e->smtpCode;$error=$e->getMessage();$state=$e->uncertain?'uncertain':($e->permanent||(int)$meta['cycle_attempts']+1>=5?'failed':'retry');}
            catch(Throwable $e){$state='failed';$error='Не удалось подготовить письмо. Проверьте отправителя и шаблон.';}
            // Storage failure after SMTP acknowledgement must leave the lease uncertain, never retry automatically.
            $pdo->beginTransaction();try{
                $current=$this->db->one('SELECT o.state,m.lease_token FROM byp_notification_outbox o JOIN byp_mail_metadata m ON m.mail_id=o.id WHERE o.id=? FOR UPDATE',[$mail['id']]);
                if($current['state']!=='sending'||$current['lease_token']!==$token){$this->db->execute('UPDATE byp_mail_attempts SET state="late_result",smtp_code=?,error="Поздний ответ старого процесса; состояние очереди не изменено",finished_at=NOW() WHERE token=?',[$code,$token]);$pdo->commit();continue;}
                $this->db->execute('UPDATE byp_notification_outbox SET state=?,lease_until=NULL,last_error=?,accepted_at=IF(?="accepted",NOW(),accepted_at),next_attempt_at=DATE_ADD(NOW(),INTERVAL ? MINUTE) WHERE id=?',[$state,$error,$state,min(1440,2**min(10,(int)$meta['cycle_attempts']+1)),$mail['id']]);$this->db->execute('UPDATE byp_mail_metadata SET lease_token=NULL WHERE mail_id=?',[$mail['id']]);if($state==='accepted')$this->db->execute('UPDATE byp_owner_notifications SET is_read=1 WHERE notification_type="mail_error" AND entity_type="mail" AND entity_id=?',[$mail['id']]);$this->db->execute('UPDATE byp_mail_attempts SET state=?,smtp_code=?,error=?,finished_at=NOW() WHERE token=?',[$state,$code,$error,$token]);$pdo->commit();
                $result[$state==='accepted'?'accepted':($state==='uncertain'?'uncertain':'failed')]++;
            }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
        }
        foreach($this->db->all('SELECT id,order_id FROM byp_notification_outbox WHERE state IN ("failed","uncertain") ORDER BY id DESC LIMIT 100')as $mail){$pdo=$this->db->pdo();$pdo->beginTransaction();try{
            if($this->db->execute('INSERT IGNORE INTO byp_commerce_events(event_key,order_id,event_type,created_at) VALUES(?,?,"mail_error",NOW())',['mail-error:'.$mail['id'],$mail['order_id']??0]))$this->db->execute('INSERT INTO byp_owner_notifications(notification_type,title,message,entity_type,entity_id,severity,is_read,created_at) VALUES("mail_error","Проверьте отправку письма",?,"mail",?,"warning",0,NOW())',['Письмо №'.$mail['id'].' требует проверки. Откройте очередь уведомлений.',$mail['id']]);$pdo->commit();
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}}return $result;
    }
    /** State changes are serialized with senders; attempts remain an append-only history. */
    public function change(int $id,string $action,int $owner,array $input):int {
        if(!in_array($action,['retry','resend','cancel'],true))throw new RuntimeException('Неизвестное действие с письмом.');$op=LicensePolicy::installation((string)($input['operation_id']??''));$pdo=$this->db->pdo();$pdo->beginTransaction();try{
            $mail=$this->db->one('SELECT * FROM byp_notification_outbox WHERE id=? FOR UPDATE',[$id]);if(!$mail)throw new RuntimeException('Письмо не найдено.');
            if($old=$this->db->one('SELECT * FROM byp_mail_actions WHERE operation_id=?',[$op])){if((int)$old['mail_id']!==$id||$old['action']!==$action)throw new RuntimeException('Операция уже использована для другого действия.');$pdo->commit();return (int)$old['result_id'];}
            $meta=$this->metadata($id);$result=$id;
            if($action==='retry')$this->retryLocked($mail,$meta,!empty($input['acknowledge']));
            elseif($action==='cancel'){
                if(empty($input['confirmed'])||!in_array($mail['state'],['pending','retry','failed','uncertain','canceled'],true))throw new RuntimeException('Подтвердите отмену неотправленного письма. Принятое или отправляемое отменить нельзя.');
                $this->db->execute('UPDATE byp_notification_outbox SET state="canceled",last_error="Отменено владельцем",lease_until=NULL WHERE id=?',[$id]);
            }else{
                if(empty($input['confirmed'])||$mail['state']!=='accepted')throw new RuntimeException('Отдельная повторная отправка доступна для принятого SMTP письма после подтверждения.');
                if($reason=$this->obsolete($mail,$meta))throw new RuntimeException($reason);
                if($this->db->one('SELECT o.id FROM byp_notification_outbox o JOIN byp_mail_metadata m ON m.mail_id=o.id WHERE m.parent_id=? AND o.state IN ("pending","retry","sending","uncertain") LIMIT 1',[$id]))throw new RuntimeException('Повтор этого письма уже находится в очереди или требует сверки.');
                $result=$this->enqueue('mail-resend:'.$op,$mail['order_id']?(int)$mail['order_id']:null,$mail['recipient'],$mail['subject'],$mail['message'],$meta+['parent_id'=>$id]);
                // Override an existing null parent from the original metadata.
                $this->db->execute('UPDATE byp_mail_metadata SET parent_id=? WHERE mail_id=?',[$id,$result]);
            }
            $this->db->execute('INSERT INTO byp_mail_actions(operation_id,mail_id,action,result_id,owner_id,created_at) VALUES(?,?,?,?,?,NOW())',[$op,$id,$action,$result,$owner]);$pdo->commit();return $result;
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    }
    private function retryLocked(array $mail,array $meta,bool $acknowledge):void {
        if(!in_array($mail['state'],['pending','retry','failed','uncertain'],true))throw new RuntimeException('Это письмо нельзя вернуть в очередь: оно принято, отправляется, отменено или устарело.');
        if($mail['state']==='uncertain'&&!$acknowledge)throw new RuntimeException('SMTP мог уже принять письмо. Проверьте получателя и подтвердите риск дубля.');
        if($reason=$this->obsolete($mail,$meta))throw new RuntimeException($reason);
        if($mail['state']==='pending')return;
        $this->db->execute('UPDATE byp_notification_outbox SET state="pending",next_attempt_at=NOW(),last_error=NULL WHERE id=?',[$mail['id']]);$this->db->execute('UPDATE byp_mail_metadata SET cycle_attempts=0 WHERE mail_id=?',[$mail['id']]);
    }
    public function retry(int $id,bool $acknowledge=false):void {
        // Compatibility for existing trusted callers. The HTTP UI uses change() and an operation token.
        $pdo=$this->db->pdo();$pdo->beginTransaction();try{$mail=$this->db->one('SELECT * FROM byp_notification_outbox WHERE id=? FOR UPDATE',[$id]);if(!$mail)throw new RuntimeException('Письмо не найдено.');$this->retryLocked($mail,$this->metadata($id),$acknowledge);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    }
}
