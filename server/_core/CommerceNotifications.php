<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use RuntimeException;
use Throwable;
require_once __DIR__.'/SmtpTransport.php';

final class CommerceNotifications {
    public function __construct(private Database $db,private CommerceSettings $settings,private array $config){}
    public function enqueue(string $key,?int $order,string $email,string $subject,string $message):void {
        CommerceSettings::email($email);if(strlen($subject)>190||strlen($message)>20000)throw new RuntimeException('Слишком большое уведомление.');
        $this->db->execute('INSERT IGNORE INTO byp_notification_outbox(event_key,order_id,recipient,subject,message,state,next_attempt_at,created_at) VALUES(?,?,?,?,?,"pending",NOW(),NOW())',[$key,$order,$email,$subject,$message]);
    }
    /** Call inside the same transaction as the order transition. */
    public function event(array $order,string $type):void {
        $key='order:'.$order['id'].':'.$type;
        if(!$this->db->execute('INSERT IGNORE INTO byp_commerce_events(event_key,order_id,event_type,created_at) VALUES(?,?,?,NOW())',[$key,$order['id'],explode(':',$type)[0]]))return;
        $titles=['created'=>'Заказ BYPCMS создан','paid'=>'Оплата BYPCMS подтверждена','ready'=>'Покупка BYPCMS готова','fulfillment_error'=>'Нужна повторная выдача покупки','canceled'=>'Платёж BYPCMS отменён'];$base=explode(':',$type)[0];$titles+=['refund_request'=>'Запрос возврата получен','refund_approved'=>'Владелец подтвердил возврат','refund_succeeded'=>'Выполнение возврата подтверждено','invoice'=>'Счёт BYPCMS выставлен','invoice_canceled'=>'Счёт BYPCMS отменён','refund_declined'=>'Ответ на запрос возврата','refund_failed'=>'Возврат не выполнен','receipt'=>'Чек покупки BYPCMS доступен'];$title=$titles[$base]??$titles[$type]??'Событие заказа BYPCMS';
        $link=rtrim($this->config['app']['url'],'/').'/account/order.php?id='.$order['id'];
        $amount=isset($order['amount_minor'])?number_format($order['amount_minor']/100,2,',',' ').' RUB':'';
        $message=$title.'. Заказ №'.$order['id'].'. '.$order['edition'].' · '.$order['domain'].($amount?' · сумма заказа '.$amount:'').'.';
        $this->db->execute('INSERT INTO byp_owner_notifications(notification_type,title,message,entity_type,entity_id,severity,is_read,created_at) VALUES(?,?,?,"purchase",?,?,0,NOW())',['purchase_'.explode(':',$type)[0],$title,$message,$order['id'],$type==='fulfillment_error'?'warning':'info']);
        $owner=$this->settings->get()['owner_email'];
        if($owner==='')$owner=(string)($this->db->one('SELECT u.email FROM byp_users u JOIN byp_roles r ON r.id=u.role_id WHERE r.slug="owner" AND u.status="active" ORDER BY u.id LIMIT 1')['email']??'');
        if($owner!=='')$this->enqueue($key.':owner',(int)$order['id'],$owner,$title,$message."\n".rtrim($this->config['app']['url'],'/').'/owner/?section=payments&order='.$order['id']);
        if($type!=='fulfillment_error'){
            $customer=$this->db->one('SELECT email FROM byp_customer_accounts WHERE id=?',[$order['customer_id']]);
            $extra=$type==='paid'&&$order['kind']==='service'?"\nОплачены согласованные работы; результат и приёмка — по условиям счёта. Лицензия в этот заказ не входит.":($type==='paid'?"\nПоступление оплаты подтверждено. Выдача доступна в кабинете; если она ещё готовится, повторите проверку статуса.":($type==='ready'?"\nПокупка или продление доступны в личном кабинете. Ключи и пароли по почте не отправляются.":''));
            $this->enqueue($key.':customer',(int)$order['id'],$customer['email'],$title,$message.$extra."\n".$link);
        }
    }
    public function process(int $limit=3):array {
        $s=$this->settings->get();$result=['accepted'=>0,'failed'=>0,'uncertain'=>0];if(!$s['smtp_enabled'])return $result+['disabled'=>true];
        // A crashed sender might already have handed DATA to SMTP. Never resend it blindly.
        $this->db->execute('UPDATE byp_notification_outbox SET state="uncertain",last_error="Процесс отправки прерван. Проверьте получателя перед повтором.",lease_until=NULL WHERE state="sending" AND lease_until<NOW()');
        for($i=0;$i<min(10,$limit);$i++){
            $pdo=$this->db->pdo();$pdo->beginTransaction();
            try{$mail=$this->db->one('SELECT * FROM byp_notification_outbox WHERE state IN ("pending","retry") AND next_attempt_at<=NOW() ORDER BY id LIMIT 1 FOR UPDATE');if(!$mail){$pdo->commit();break;}$this->db->execute('UPDATE byp_notification_outbox SET state="sending",attempts=attempts+1,lease_until=DATE_ADD(NOW(),INTERVAL 5 MINUTE) WHERE id=?',[$mail['id']]);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
            try{(new SmtpTransport($s,$this->config))->send($mail);$this->db->execute('UPDATE byp_notification_outbox SET state="accepted",accepted_at=NOW(),lease_until=NULL,last_error=NULL WHERE id=?',[$mail['id']]);$result['accepted']++;}
            catch(MailTransportException $e){$attempt=(int)$mail['attempts']+1;$state=$e->uncertain?'uncertain':($attempt>=5?'failed':'retry');$this->db->execute('UPDATE byp_notification_outbox SET state=?,lease_until=NULL,last_error=?,next_attempt_at=DATE_ADD(NOW(),INTERVAL ? MINUTE) WHERE id=?',[$state,$e->getMessage(),min(1440,2**$attempt),$mail['id']]);$result[$e->uncertain?'uncertain':'failed']++;}
            catch(Throwable $e){$this->db->execute('UPDATE byp_notification_outbox SET state="failed",lease_until=NULL,last_error="Не удалось подготовить отправку письма" WHERE id=?',[$mail['id']]);$result['failed']++;}
        }
        foreach($this->db->all('SELECT id,order_id FROM byp_notification_outbox WHERE state IN ("failed","uncertain") ORDER BY id DESC LIMIT 100')as $mail){
            $pdo=$this->db->pdo();$pdo->beginTransaction();try{
                if($this->db->execute('INSERT IGNORE INTO byp_commerce_events(event_key,order_id,event_type,created_at) VALUES(?,?,"mail_error",NOW())',['mail-error:'.$mail['id'],$mail['order_id']??0]))
                    $this->db->execute('INSERT INTO byp_owner_notifications(notification_type,title,message,entity_type,entity_id,severity,is_read,created_at) VALUES("mail_error","Проверьте отправку письма",?,"mail",?,"warning",0,NOW())',['Письмо №'.$mail['id'].' не подтверждено SMTP. Откройте очередь уведомлений.',$mail['id']]);
                $pdo->commit();
            }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
        }return $result;
    }
    public function retry(int $id,bool $acknowledge=false):void {
        $mail=$this->db->one('SELECT * FROM byp_notification_outbox WHERE id=?',[$id]);if(!$mail)throw new RuntimeException('Письмо не найдено.');
        if($mail['state']==='accepted'||$mail['state']==='sending')throw new RuntimeException('Принятое или отправляемое письмо повторно не отправляется.');
        if($mail['state']==='uncertain'&&!$acknowledge)throw new RuntimeException('Проверьте получателя: SMTP мог уже принять письмо. Подтвердите осознанный повтор.');
        $this->db->execute('UPDATE byp_notification_outbox SET state="pending",next_attempt_at=NOW(),attempts=0,last_error=NULL WHERE id=? AND state NOT IN ("accepted","sending")',[$id]);
        if($this->db->one('SELECT state FROM byp_notification_outbox WHERE id=?',[$id])['state']!=='pending')throw new RuntimeException('Состояние письма изменилось. Обновите очередь перед повтором.');
    }
}
