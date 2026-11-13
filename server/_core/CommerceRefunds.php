<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use InvalidArgumentException;
use RuntimeException;
use Throwable;
require_once __DIR__.'/CommerceAccess.php';

final class CommerceRefunds {
    public function __construct(private Database $db,private array $config,private CommerceOrders $orders){}
    private function text(string $text):string{$text=trim($text);if(mb_strlen($text)<5||mb_strlen($text)>2000||str_contains($text,"\0"))throw new InvalidArgumentException('Укажите причину от 5 до 2000 символов.');return $text;}
    public function summary(int $id):array {
        $rows=$this->db->all('SELECT id,provider_id,amount_minor,state,license_action,reason,last_error,created_at FROM byp_commerce_refunds WHERE order_id=? ORDER BY created_at,id',[$id]);$total=0;$pending=false;
        foreach($rows as $r){if($r['state']==='succeeded')$total+=(int)$r['amount_minor'];if(in_array($r['state'],['approved','creating','uncertain','pending'],true))$pending=true;}
        return ['amount_minor'=>$total,'pending'=>$pending,'rows'=>$rows,'requests'=>$this->db->all('SELECT id,reason,state,decision,created_at FROM byp_refund_requests WHERE order_id=? ORDER BY id DESC LIMIT 30',[$id]),'license_effect'=>$this->db->one('SELECT state,reason FROM byp_commerce_license_blocks WHERE order_id=? AND state<>"cleared"',[$id]),'access_blocked'=>($total>0||$pending)&&CommerceAccess::orderDenied($this->db->pdo(),$id)];
    }
    public function request(int $id,int $customer,string $reason):array {
        $reason=$this->text($reason);$pdo=$this->db->pdo();$pdo->beginTransaction();try{
            $order=$this->orders->row($id,$customer,true);if($order['payment_state']!=='paid')throw new RuntimeException('Заявка доступна для оплаченного заказа.');
            if($old=$this->db->one('SELECT id FROM byp_refund_requests WHERE order_id=? AND state IN ("requested","processing") ORDER BY id DESC LIMIT 1',[$id])){$pdo->commit();return ['id'=>(int)$old['id']];}
            if($this->summary($id)['amount_minor']>=(int)$order['amount_minor'])throw new RuntimeException('Оплата уже полностью возвращена.');
            $request=$this->db->insert('INSERT INTO byp_refund_requests(order_id,customer_id,reason,state,created_at,updated_at) VALUES(?,?,?,"requested",NOW(),NOW())',[$id,$customer,$reason]);
            $this->orders->notifications->event($order,'refund_request:'.$request);$pdo->commit();return ['id'=>$request];
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    }
    public function decline(int $request,int $owner,string $reason):void {
        $reason=$this->text($reason);$pdo=$this->db->pdo();$pdo->beginTransaction();try{
            $r=$this->db->one('SELECT order_id FROM byp_refund_requests WHERE id=?',[$request]);if(!$r)throw new RuntimeException('Заявка не найдена.');$order=$this->orders->row((int)$r['order_id'],null,true);
            $r=$this->db->one('SELECT * FROM byp_refund_requests WHERE id=? FOR UPDATE',[$request]);if($r['state']!=='requested')throw new RuntimeException('Заявка уже обработана.');
            $this->db->execute('UPDATE byp_refund_requests SET state="declined",decision=?,decided_by=?,updated_at=NOW() WHERE id=?',[$reason,$owner,$request]);$this->orders->notifications->event($order,'refund_declined:'.$request);$pdo->commit();
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    }
    /** Explicit Owner approval is persisted before any financial HTTP operation. */
    public function approve(int $id,int $owner,array $input):array {
        $op=LicensePolicy::installation((string)($input['operation_id']??''));$reason=$this->text((string)($input['reason']??''));$minor=PaymentGateway::minor((string)($input['amount']??''));$action=(string)($input['license_action']??'');
        if($minor<1||!in_array($action,['keep','revoke'],true)||empty($input['confirmed']))throw new InvalidArgumentException('Подтвердите сумму возврата и действие с лицензией.');
        // Includes API checks for shop, mode, amount and the original order's metadata.
        $this->orders->sync($id);
        $pdo=$this->db->pdo();$pdo->beginTransaction();try{
            $order=$this->orders->row($id,null,true);$old=$this->db->one('SELECT * FROM byp_commerce_refunds WHERE id=?',[$op]);
            if($old){if((int)$old['order_id']!==$id||(int)$old['amount_minor']!==$minor||$old['license_action']!==$action||(int)$old['approved_by']!==$owner||$old['reason']!==$reason)throw new RuntimeException('Идентификатор уже использован для другого возврата.');$pdo->commit();return $this->send($op);}
            $summary=$this->summary($id);if($order['payment_state']!=='paid'||$summary['pending']||$minor>(int)$order['amount_minor']-$summary['amount_minor'])throw new RuntimeException('Сумма превышает остаток либо прежний возврат ещё не завершён.');
            $remaining=(int)$order['amount_minor']-$summary['amount_minor']-$minor;
            if($minor<100||($remaining>0&&$remaining<100))throw new InvalidArgumentException('Возврат — от 1 рубля; после возврата должно остаться 0 рублей или не менее 1 рубля.');
            if($minor+$summary['amount_minor']===(int)$order['amount_minor']&&$action!=='revoke')throw new RuntimeException('Полный возврат обязательно прекращает оплаченные этим заказом права.');
            $a=$this->db->one('SELECT * FROM byp_payment_attempts WHERE id=?',[$order['active_attempt_id']]);if(!$a||$a['state']!=='succeeded'||!$a['provider_id'])throw new RuntimeException('Исходная оплата не подтверждена.');
            $request=(int)($input['request_id']??0);if($request&&!$this->db->one('SELECT id FROM byp_refund_requests WHERE id=? AND order_id=? AND state="requested"',[$request,$id]))throw new RuntimeException('Заявка уже обработана или относится к другому заказу.');
            $payload=['payment_id'=>$a['provider_id'],'amount'=>['value'=>PaymentGateway::amount($minor),'currency'=>'RUB'],'description'=>mb_substr('Возврат BYPCMS №'.$id.': '.$reason,0,250),'metadata'=>['refund_ref'=>$op,'order_ref'=>$order['public_id']]];
            $s=$this->orders->settings->get();if($s['receipt_mode']==='yookassa'){
                // A partial refund requires an exact, separately agreed item allocation.
                if($minor!==(int)$order['amount_minor'])throw new RuntimeException('Для частичного возврата по 54-ФЗ оформите возврат и точный чек в кабинете ЮKassa, затем выполните сверку.');
                $original=json_decode($a['payload'],true);if(empty($original['receipt']))throw new RuntimeException('Нет исходных данных чека. Оформите возврат в ЮKassa и выполните сверку.');$payload['receipt']=$original['receipt'];
            }
            $this->db->execute('INSERT INTO byp_commerce_refunds(id,order_id,attempt_id,request_id,shop_id,mode,amount_minor,license_action,state,payload,reason,approved_by,created_at) VALUES(?,?,?,?,?,?,?,?,"approved",?,?,?,NOW())',[$op,$id,$a['id'],$request?:null,$a['shop_id'],$a['mode'],$minor,$action,json_encode($payload,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),$reason,$owner]);
            if($request)$this->db->execute('UPDATE byp_refund_requests SET state="processing",decision=?,decided_by=?,updated_at=NOW() WHERE id=?',[$reason,$owner,$request]);
            $this->db->execute('INSERT INTO byp_audit_logs(user_id,action,entity_type,entity_id,metadata,created_at) VALUES(?,"commerce.refund.approve","purchase",?,?,NOW())',[$owner,$id,json_encode(['refund'=>$op,'amount_minor'=>$minor,'license_action'=>$action])]);$this->rights($order);$this->orders->notifications->event($order,'refund_approved:'.$op);$pdo->commit();
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
        return $this->send($op);
    }
    public function send(string $id):array {
        $r=$this->db->one('SELECT *,TIMESTAMPDIFF(SECOND,created_at,NOW()) age_seconds FROM byp_commerce_refunds WHERE id=?',[$id]);if(!$r)throw new RuntimeException('Возврат не найден.');
        if(in_array($r['state'],['succeeded','canceled','error'],true))return $r;
        if($r['provider_id'])return $this->sync($id);
        if((int)$r['age_seconds']>23*3600)throw new RuntimeException('Окно безопасного повтора истекло. Нужна сверка ID возврата из кабинета ЮKassa; новый запрос не создаётся.');
        $s=$this->orders->settings->get();if($s['shop_id']!==$r['shop_id']||$s['mode']!==$r['mode'])throw new RuntimeException('Верните настройки исходного магазина и режима.');
        $this->db->execute('UPDATE byp_commerce_refunds SET state="creating" WHERE id=? AND state IN ("approved","uncertain","creating")',[$id]);
        try{$result=(new PaymentGateway($s,$this->config))->request('POST','refunds',json_decode($r['payload'],true),$id);$this->apply($r,$result);}
        catch(PaymentTransportException $e){$pdo=$this->db->pdo();$pdo->beginTransaction();try{$order=$this->orders->row((int)$r['order_id'],null,true);$changed=$this->db->execute('UPDATE byp_commerce_refunds SET state=?,last_error=? WHERE id=? AND provider_id IS NULL AND state IN ("approved","creating","uncertain")',[$e->definite?'error':'uncertain',$e->getMessage(),$id]);if($changed&&$e->definite){$this->db->execute('UPDATE byp_refund_requests SET state="requested",updated_at=NOW() WHERE id=? AND state="processing"',[$r['request_id']??0]);$this->orders->notifications->event($order,'refund_failed:'.$r['id']);}$this->rights($order);$pdo->commit();}catch(Throwable $ignored){if($pdo->inTransaction())$pdo->rollBack();}throw $e;}
        return $this->db->one('SELECT * FROM byp_commerce_refunds WHERE id=?',[$id]);
    }
    public function sync(string $id,?string $provider=null):array {
        $r=$this->db->one('SELECT * FROM byp_commerce_refunds WHERE id=?',[$id]);if(!$r)throw new RuntimeException('Возврат не найден.');$provider=$provider?:$r['provider_id'];if(!$provider)return $r;
        $s=$this->orders->settings->get();if($s['shop_id']!==$r['shop_id'])throw new RuntimeException('Нужны настройки исходного магазина.');
        $this->apply($r,(new PaymentGateway($s,$this->config))->request('GET','refunds/'.PaymentGateway::id($provider)));return $this->db->one('SELECT * FROM byp_commerce_refunds WHERE id=?',[$id]);
    }
    private function apply(array $r,array $value):void {
        $provider=PaymentGateway::id((string)($value['id']??''));$a=$this->db->one('SELECT * FROM byp_payment_attempts WHERE id=?',[$r['attempt_id']]);
        if(($value['payment_id']??'')!==$a['provider_id']||($value['amount']['currency']??'')!=='RUB'||PaymentGateway::minor((string)($value['amount']['value']??''))!==(int)$r['amount_minor']||!in_array($value['status']??'',['pending','succeeded','canceled'],true))throw new RuntimeException('Возврат не соответствует исходному платежу или сумме.');
        $this->orders->sync((int)$r['order_id']); // Authenticated original payment proof, including test/live.
        $pdo=$this->db->pdo();$pdo->beginTransaction();try{
            $order=$this->orders->row((int)$r['order_id'],null,true);$current=$this->db->one('SELECT * FROM byp_commerce_refunds WHERE id=? FOR UPDATE',[$r['id']]);
            if($current['provider_id']&&$current['provider_id']!==$provider)throw new RuntimeException('Возврат связан с другим ID ЮKassa.');
            if(in_array($current['state'],['succeeded','canceled'],true)&&$value['status']!==$current['state'])throw new RuntimeException('Противоречивое состояние завершённого возврата.');
            $error=null;if($value['status']==='canceled'){$reason=(string)($value['cancellation_details']['reason']??'general_decline');$error=['insufficient_funds'=>'Недостаточно средств для возврата в ЮKassa.','payment_expired'=>'Истёк допустимый срок возврата у платёжной системы.','rejected_by_timeout'=>'Платёжная система отменила возврат из-за таймаута.'][$reason]??'ЮKassa отменила возврат. Уточните причину в кабинете платёжной системы.';}
            $this->db->execute('UPDATE byp_commerce_refunds SET provider_id=?,state=?,last_error=?,checked_at=NOW() WHERE id=?',[$provider,$value['status'],$error,$r['id']]);
            $this->rights($order);
            if($value['status']==='succeeded'&&!$current['finalized_at']){
                $this->db->execute('UPDATE byp_commerce_refunds SET finalized_at=NOW() WHERE id=?',[$r['id']]);
                $this->db->execute('UPDATE byp_refund_requests SET state="completed",updated_at=NOW() WHERE id=?',[$r['request_id']??0]);
                $this->db->execute('INSERT INTO byp_commerce_receipts(order_id,refund_state,updated_at) VALUES(?,"required",NOW()) ON DUPLICATE KEY UPDATE refund_state="required",updated_at=NOW()',[$order['id']]);
                $summary=$this->summary((int)$order['id']);if($summary['amount_minor']>=(int)$order['amount_minor'])$this->db->execute('UPDATE byp_refund_requests SET state="completed",decision="Оплата полностью возвращена",updated_at=NOW() WHERE order_id=? AND state IN ("requested","processing")',[$order['id']]);
                $this->orders->notifications->event($order,'refund_succeeded:'.$r['id']);
            }elseif(in_array($value['status'],['canceled'],true)&&$current['state']!==$value['status']){
                $this->db->execute('UPDATE byp_refund_requests SET state="requested",updated_at=NOW() WHERE id=? AND state="processing"',[$r['request_id']??0]);$this->orders->notifications->event($order,'refund_failed:'.$r['id']);
            }$pdo->commit();
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    }
    /** Records an already completed bank/dashboard transfer; never sends money. */
    public function recordManual(int $id,int $owner,array $input):array {
        $op=LicensePolicy::installation((string)($input['operation_id']??''));$reason=$this->text((string)($input['reason']??''));$minor=PaymentGateway::minor((string)($input['amount']??''));$action=(string)($input['license_action']??'');$reference=trim((string)($input['reference']??''));$date=(string)($input['paid_on']??'');
        if(empty($input['confirmed'])||!in_array($action,['keep','revoke'],true)||mb_strlen($reference)<3||mb_strlen($reference)>190||preg_match('/[\x00-\x1f]/',$reference)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$date)||!strtotime($date.' UTC')||gmdate('Y-m-d',strtotime($date.' UTC'))!==$date||$date>gmdate('Y-m-d'))throw new InvalidArgumentException('Подтвердите выполненный возврат, его дату, номер операции и действие с правами.');
        $hash=hash('sha256',json_encode([$id,$minor,$action,$reference,$date,$reason],JSON_THROW_ON_ERROR));$refHash=hash('sha256',mb_strtolower(preg_replace('/\s+/u','',$reference)));
        $pdo=$this->db->pdo();$pdo->beginTransaction();try{
            $o=$this->orders->row($id,null,true);$m=$this->db->one('SELECT * FROM byp_commerce_manual_payments WHERE order_id=?',[$id]);if(!$m||$o['payment_state']!=='paid')throw new RuntimeException('Ручная запись возврата доступна для подтверждённой оплаты по счёту.');
            $old=$this->db->one('SELECT * FROM byp_commerce_manual_refunds WHERE id=?',[$op]);if($old){if($old['request_hash']!==$hash)throw new RuntimeException('Операция использована с другими данными.');$pdo->commit();return $this->summary($id);}
            $summary=$this->summary($id);if($summary['pending']||$minor<1||$minor>(int)$o['amount_minor']-$summary['amount_minor']||($minor===(int)$o['amount_minor']-$summary['amount_minor']&&$action!=='revoke')||$date<$m['paid_on'])throw new InvalidArgumentException('Проверьте остаток суммы, дату и права: полный возврат прекращает оплаченные права.');
            if($this->db->one('SELECT id FROM byp_commerce_manual_refunds WHERE reference_hash=?',[$refHash]))throw new RuntimeException('Этот возврат уже учтён.');
            $this->db->execute('INSERT INTO byp_commerce_manual_refunds(id,order_id,reference_hash,request_hash,reference,paid_on,created_by,created_at) VALUES(?,?,?,?,?,?,?,NOW())',[$op,$id,$refHash,$hash,$reference,$date,$owner]);
            $this->db->execute('INSERT INTO byp_commerce_refunds(id,order_id,attempt_id,shop_id,mode,amount_minor,license_action,state,payload,reason,approved_by,created_at,checked_at,finalized_at) VALUES(?,?,?,"manual","live",?,?,"succeeded","{}",?,?,NOW(),NOW(),NOW())',[$op,$id,$m['id'],$minor,$action,$reason,$owner]);
            $this->rights($o);$this->db->execute('UPDATE byp_commerce_receipts SET refund_state="required",updated_at=NOW() WHERE order_id=?',[$id]);$this->db->execute('UPDATE byp_refund_requests SET state="completed",decision=?,decided_by=?,updated_at=NOW() WHERE order_id=? AND state IN ("requested","processing")',[$reason,$owner,$id]);$this->orders->notifications->event($o,'refund_succeeded:'.$op);$pdo->commit();return $this->summary($id);
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    }
    /** Called under the order lock. Pending approval freezes server rights; only confirmed success terminates them. */
    private function rights(array $order):void {
        $id=(int)$order['id'];$refunds=$this->db->all('SELECT * FROM byp_commerce_refunds WHERE order_id=?',[$id]);$sum=0;$state='cleared';
        foreach($refunds as $r){if($r['state']==='succeeded'){$sum+=(int)$r['amount_minor'];if($r['license_action']==='revoke')$state='revoked';elseif($r['license_action']==='review'&&$state!=='revoked')$state='review';}elseif(in_array($r['state'],['approved','creating','uncertain','pending'],true)&&$r['license_action']!=='keep'&&$state==='cleared')$state='pending';}
        if($sum>=(int)$order['amount_minor'])$state='revoked';
        $terminal=$state==='revoked';if($terminal)$this->db->execute('UPDATE byp_commerce_orders SET fulfillment_state="refunded",updated_at=NOW() WHERE order_id=?',[$id]);
        $link=$this->db->one('SELECT license_id FROM byp_license_order_links WHERE order_id=?',[$id]);$licenseId=(int)($order['kind']==='renewal'?$order['renewal_license_id']:($link['license_id']??0));if(!$licenseId)return;
        $license=$this->db->one('SELECT * FROM byp_license_registry WHERE id=? FOR UPDATE',[$licenseId]);$block=$this->db->one('SELECT * FROM byp_commerce_license_blocks WHERE order_id=?',[$id]);
        if($order['kind']==='renewal'&&$state==='revoked'){
            $term=$this->db->one('SELECT * FROM byp_commerce_renewals WHERE order_id=?',[$id]);
            if($term){
                $all=$this->db->all('SELECT * FROM byp_commerce_renewals WHERE license_id=? ORDER BY granted_at,order_id',[$licenseId]);$expected=$all[0]['before_until'];$next=$expected;
                foreach($all as $t){if(!(int)$t['returned'])$expected=LicensePolicy::renew($expected,(int)$t['granted_at']);if(!(int)$t['returned']&&(int)$t['order_id']!==$id)$next=LicensePolicy::renew($next,(int)$t['granted_at']);}
                if((int)$term['returned']||substr((string)$license['valid_until'],0,10)===substr((string)$expected,0,10)){
                    if(!(int)$term['returned']){$this->db->execute('UPDATE byp_license_registry SET valid_until=?,updated_at=NOW() WHERE id=?',[$next,$licenseId]);$this->db->execute('UPDATE byp_commerce_renewals SET returned=1 WHERE order_id=?',[$id]);}$state='cleared';
                }else $state='review';
            }else $state='review';
            $this->db->execute('UPDATE byp_commerce_orders SET fulfillment_state="refunded",updated_at=NOW() WHERE order_id=?',[$id]);
        }elseif($order['kind']==='purchase'&&$sum>=(int)$order['amount_minor'])$this->db->execute('UPDATE byp_commerce_orders SET fulfillment_state="refunded",updated_at=NOW() WHERE order_id=?',[$id]);
        if($state!=='cleared'){
            $prior=$block['previous_status']??($this->db->one('SELECT previous_status FROM byp_commerce_license_blocks WHERE license_id=? AND state<>"cleared" LIMIT 1',[$licenseId])['previous_status']??$license['status']);
            $reason=$state==='review'?'Нужна сверка прав после внешнего возврата или изменения срока лицензии.':($state==='pending'?'Владелец подтвердил отправку возврата; результат уточняется.':'Права по покупке прекращены после подтверждённого возврата.');
            $this->db->execute('INSERT INTO byp_commerce_license_blocks(order_id,license_id,previous_status,state,reason,updated_at) VALUES(?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE state=VALUES(state),reason=VALUES(reason),updated_at=NOW()',[$id,$licenseId,$prior,$state,$reason]);$this->db->execute('UPDATE byp_license_registry SET status="suspended",updated_at=NOW() WHERE id=?',[$licenseId]);
            if($state==='revoked'){$this->db->execute('UPDATE byp_license_activations SET active=0 WHERE license_id=?',[$licenseId]);$this->db->execute('UPDATE byp_license_challenges SET consumed=1 WHERE license_id=?',[$licenseId]);}
        }elseif($block){
            $this->db->execute('UPDATE byp_commerce_license_blocks SET state="cleared",updated_at=NOW() WHERE order_id=?',[$id]);
            if(!CommerceAccess::blocked($this->db->pdo(),$licenseId)&&$license['status']==='suspended')$this->db->execute('UPDATE byp_license_registry SET status=?,updated_at=NOW() WHERE id=?',[$block['previous_status'],$licenseId]);
        }
    }
    public function reconcile(int $id,?string $provider=null):array {
        $order=$this->orders->row($id);$a=$this->db->one('SELECT * FROM byp_payment_attempts WHERE id=?',[$order['active_attempt_id']]);if(!$a||!$a['provider_id'])return $this->summary($id);
        $this->orders->sync($id);$s=$this->orders->settings->get();$gateway=new PaymentGateway($s,$this->config);
        // Discover manual dashboard refunds too; this endpoint never creates money movement.
        $values=[];if($provider)$values[]=$gateway->request('GET','refunds/'.PaymentGateway::id($provider));
        else { $cursor='';$pages=0;do{$list=$gateway->request('GET','refunds?payment_id='.$a['provider_id'].'&limit=100'.($cursor?'&cursor='.rawurlencode($cursor):''));foreach($list['items']??[]as $r)$values[]=$r;$cursor=(string)($list['next_cursor']??'');if(++$pages>10&&$cursor!=='')throw new RuntimeException('Список возвратов слишком велик. Сверьте нужный ID отдельно.');}while($cursor!==''); }
        foreach($values as $value){$uuid=PaymentGateway::id((string)($value['id']??''));if(($value['payment_id']??'')!==$a['provider_id'])throw new RuntimeException('Возврат относится к другому платежу.');$minor=PaymentGateway::minor((string)($value['amount']['value']??''));if($minor<1||$minor>(int)$order['amount_minor']||($value['amount']['currency']??'')!=='RUB')throw new RuntimeException('Некорректная сумма возврата.');
            $r=$this->db->one('SELECT * FROM byp_commerce_refunds WHERE provider_id=?',[$uuid]);
            if(!$r&&!empty($value['metadata']['refund_ref']))$r=$this->db->one('SELECT * FROM byp_commerce_refunds WHERE id=? AND order_id=?',[(string)$value['metadata']['refund_ref'],$id]);
            if(!$r){$local=substr(hash('sha256','external:'.$uuid),0,32);$pdo=$this->db->pdo();$pdo->beginTransaction();try{$this->orders->row($id,null,true);$this->db->execute('INSERT IGNORE INTO byp_commerce_refunds(id,order_id,attempt_id,provider_id,shop_id,mode,amount_minor,license_action,state,payload,reason,approved_by,created_at) VALUES(?,?,?,?,?,?,?,"review","pending","{}","Возврат создан в кабинете ЮKassa",0,NOW())',[$local,$id,$a['id'],$uuid,$a['shop_id'],$a['mode'],$minor]);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}$r=$this->db->one('SELECT * FROM byp_commerce_refunds WHERE id=?',[$local]);}
            // Always read a specific object; a webhook or list alone never changes rights.
            $this->apply($r,$gateway->request('GET','refunds/'.$uuid));
        }return $this->summary($id);
    }
    public function webhook(array $input):void {
        if(($input['type']??'')!=='notification'||($input['event']??'')!=='refund.succeeded')return;$object=$input['object']??[];$provider=PaymentGateway::id((string)($object['id']??''));
        $r=$this->db->one('SELECT order_id FROM byp_commerce_refunds WHERE provider_id=?',[$provider]);
        if(!$r&&!empty($object['payment_id']))$r=$this->db->one('SELECT order_id FROM byp_payment_attempts WHERE provider_id=?',[(string)$object['payment_id']]);
        if($r)$this->reconcile((int)$r['order_id'],$provider);
    }
    public function resolve(int $id,int $owner,string $refund,string $action,?string $until=null):void {
        if(!in_array($action,['keep','revoke'],true))throw new InvalidArgumentException('Выберите действие с правами.');$pdo=$this->db->pdo();$pdo->beginTransaction();try{
            $order=$this->orders->row($id,null,true);$r=$this->db->one('SELECT * FROM byp_commerce_refunds WHERE id=? AND order_id=? FOR UPDATE',[$refund,$id]);if(!$r||$r['state']!=='succeeded')throw new RuntimeException('Возврат не подтверждён.');if($this->summary($id)['amount_minor']>=(int)$order['amount_minor']&&$action==='keep')throw new RuntimeException('Полный возврат не может сохранять оплаченные им права.');
            $effect=$this->db->one('SELECT state FROM byp_commerce_license_blocks WHERE order_id=?',[$id]);
            if($r['license_action']!=='review'&&($effect['state']??'')!=='review')throw new RuntimeException('Решение по правам уже принято. Для изменения согласуйте новый сценарий отдельно.');
            $this->db->execute('UPDATE byp_commerce_refunds SET license_action=? WHERE id=?',[$action,$refund]);
            if($order['kind']==='renewal'&&$action==='revoke'&&$until){LicensePolicy::expiry($until);$this->db->execute('UPDATE byp_license_registry SET valid_until=?,updated_at=NOW() WHERE id=?',[$until,$order['renewal_license_id']]);$this->db->execute('INSERT INTO byp_commerce_renewals(order_id,license_id,before_until,after_until,granted_at,returned) VALUES(?,?,?,?,?,1) ON DUPLICATE KEY UPDATE returned=1',[$id,$order['renewal_license_id'],$until,$order['renewed_until']?:$until,time()]);}
            $this->rights($order);$this->db->execute('INSERT INTO byp_audit_logs(user_id,action,entity_type,entity_id,metadata,created_at) VALUES(?,"commerce.refund.rights","purchase",?,?,NOW())',[$owner,$id,json_encode(['refund'=>$refund,'action'=>$action,'until'=>$until])]);$pdo->commit();
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    }
    public function work():array {
        $result=['checked'=>0,'errors'=>0];foreach($this->db->all('SELECT id,provider_id FROM byp_commerce_refunds WHERE state IN ("approved","creating","uncertain","pending") AND (checked_at IS NULL OR checked_at<DATE_SUB(NOW(),INTERVAL 1 MINUTE)) ORDER BY created_at LIMIT 2')as $r)try{if($r['provider_id'])$this->sync($r['id']);else $this->send($r['id']);$result['checked']++;}catch(Throwable $e){$result['errors']++;}
        foreach($this->db->all('SELECT d.order_id FROM byp_commerce_orders d JOIN byp_payment_attempts a ON a.id=d.active_attempt_id LEFT JOIN byp_commerce_refund_scans s ON s.order_id=d.order_id WHERE d.payment_state="paid" AND a.provider_id IS NOT NULL AND (s.checked_at IS NULL OR s.checked_at<DATE_SUB(NOW(),INTERVAL 10 MINUTE)) ORDER BY COALESCE(s.checked_at,"1970-01-01"),d.order_id LIMIT 1')as $row)try{$this->reconcile((int)$row['order_id']);$this->db->execute('INSERT INTO byp_commerce_refund_scans(order_id,checked_at) VALUES(?,NOW()) ON DUPLICATE KEY UPDATE checked_at=NOW()',[$row['order_id']]);}catch(Throwable $e){$result['errors']++;}
        return $result;
    }
}
