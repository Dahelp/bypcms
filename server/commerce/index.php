<?php
declare(strict_types=1);
require_once __DIR__.'/../_core/bootstrap.php';
require_once __DIR__.'/../_core/CommerceOrders.php';
use BYPCMS\Core\{CommerceOrders,CommerceSettings,CommerceRefunds,CommerceLegal,PaymentGateway,Response};
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');header('X-Frame-Options: SAMEORIGIN');
if(($config['app']['installation_type']??'platform')==='client')Response::error('Раздел доступен на платформе BYPCMS',403);
$action=(string)($_GET['action']??'bootstrap');$method=$_SERVER['REQUEST_METHOD']??'GET';
if((int)($_SERVER['CONTENT_LENGTH']??0)>32768)Response::error('Слишком большой запрос',413);
$input=byp_input();$_SESSION['customer_csrf']??=bin2hex(random_bytes(32));
try {
    $commerce=new CommerceOrders($db,$config,BYPCMS_ROOT);$user=$auth->user();$owner=$user&&$user['role']==='owner';$customer=empty($_SESSION['customer_id'])?null:$db->one('SELECT id,name,email FROM byp_customer_accounts WHERE id=?',[(int)$_SESSION['customer_id']]);$settings=$commerce->settings->get();$refunds=new CommerceRefunds($db,$config,$commerce);
    $allowTest=$owner||!empty($config['app']['debug']);$available=$commerce->available($allowTest);
    if($action==='bootstrap'&&$method==='GET')Response::ok(['customer'=>$customer,'csrf'=>$_SESSION['customer_csrf'],'catalog'=>$commerce->catalog(),'bank_available'=>$commerce->invoices->bank->get()['enabled'],'payments_available'=>$available,'test_mode'=>$settings['mode']==='test','legal'=>CommerceLegal::info(),'renewal_quote'=>$customer&&!empty($_GET['renewal'])?$commerce->renewalQuote((int)$customer['id'],(int)$_GET['renewal']):null]);
    if($action==='quote'&&$method==='POST')Response::ok(['quote'=>$commerce->quote($input)]);
    if($action==='webhook'){
        if($method!=='POST')Response::error('Требуется POST',405);
        // The supplied event never confirms money: the order is changed only after an authenticated GET to YooKassa.
        $commerce->limit('webhook:'.($_SERVER['REMOTE_ADDR']??''),120,60);session_write_close();$commerce->webhook($input);$refunds->webhook($input);Response::ok();
    }
    if(str_starts_with($action,'owner.')){
        if(!$user)Response::error('Требуется вход владельца',401);if(!$owner)Response::error('Доступно только владельцу',403);if($method!=='GET')$auth->verifyCsrf();
        if($action==='owner.status'&&$method==='GET'){
            $mailPage=max(1,min(10000,(int)($_GET['mail_page']??1)));$mailOffset=($mailPage-1)*40;
            $page=max(1,min(10000,(int)($_GET['page']??1)));$offset=($page-1)*20;$where='';$params=[];$query=mb_substr(trim((string)($_GET['q']??'')),0,190);if(!empty($_GET['order'])){$where=' WHERE o.id=?';$params[]=(int)$_GET['order'];}elseif($query!==''){$where=' WHERE (c.email LIKE ? OR c.name LIKE ? OR o.domain LIKE ? OR o.id=?)';$params=['%'.$query.'%','%'.$query.'%','%'.$query.'%',ctype_digit($query)?(int)$query:0];}
            $mailParts=[];$mailParams=[];if($query!==''){$mailParts[]='(o.recipient LIKE ? OR o.subject LIKE ?)';$mailParams=['%'.$query.'%','%'.$query.'%'];}
            $mailFilter=(string)($_GET['mail_state']??'');if($mailFilter!==''&&!in_array($mailFilter,['pending','retry','sending','accepted','failed','uncertain','superseded','canceled'],true))throw new InvalidArgumentException('Неизвестный фильтр писем.');if($mailFilter!==''){$mailParts[]='o.state=?';$mailParams[]=$mailFilter;}$mailOrder=max(0,(int)($_GET['mail_order']??0));if($mailOrder){$mailParts[]='o.order_id=?';$mailParams[]=$mailOrder;}$mailWhere=$mailParts?' WHERE '.implode(' AND ',$mailParts):'';
            $rows=$db->all('SELECT o.id,o.edition,o.domain,o.license_term,c.name,c.email,d.kind,d.amount_minor,d.payment_state,d.fulfillment_state,d.fulfillment_error,d.mode,d.created_at,d.active_attempt_id FROM byp_commerce_orders d JOIN byp_customer_orders o ON o.id=d.order_id JOIN byp_customer_accounts c ON c.id=o.customer_id'.$where.' ORDER BY o.id DESC LIMIT 20 OFFSET '.$offset,$params);
            foreach($rows as &$row){$row['invoice']=$commerce->invoices->view((int)$row['id']);$row['manual_payment']=$db->one('SELECT source,paid_on FROM byp_commerce_manual_payments WHERE order_id=?',[$row['id']]);$row['refunds']=$refunds->summary((int)$row['id']);$row['receipt']=$db->one('SELECT sale_state,sale_url,refund_state,refund_note FROM byp_commerce_receipts WHERE order_id=?',[$row['id']]);$row['attempt']=$row['active_attempt_id']?$db->one('SELECT id,provider_id,state,last_error,created_at FROM byp_payment_attempts WHERE id=?',[$row['active_attempt_id']]):null;}unset($row);
            Response::ok(['bank_settings'=>$commerce->invoices->bank->public(),'settings'=>$commerce->settings->public(),'orders'=>$rows,'page'=>$page,'query'=>$query,'total'=>(int)$db->one('SELECT COUNT(*) AS total FROM byp_commerce_orders d JOIN byp_customer_orders o ON o.id=d.order_id JOIN byp_customer_accounts c ON c.id=o.customer_id'.$where,$params)['total'],'mail_summary'=>$commerce->notifications->summary(),'mail_filter'=>$mailFilter,'mail_order'=>$mailOrder,'mail_page'=>$mailPage,'mail_total'=>(int)$db->one('SELECT COUNT(*) AS total FROM byp_notification_outbox o'.$mailWhere,$mailParams)['total'],'outbox'=>$db->all('SELECT o.id,o.order_id,o.recipient,o.subject,o.state,o.attempts,o.last_error,o.created_at,o.accepted_at,o.next_attempt_at,m.template_key,m.template_version,m.audience,m.parent_id FROM byp_notification_outbox o LEFT JOIN byp_mail_metadata m ON m.mail_id=o.id'.$mailWhere.' ORDER BY o.id DESC LIMIT 40 OFFSET '.$mailOffset,$mailParams),'worker'=>$commerce->settings->workerStatus(),'worker_command'=>'php '.escapeshellarg(BYPCMS_ROOT.'/_core/commerce-worker.php'),'webhook_url'=>rtrim($config['app']['url'],'/').'/commerce/index.php?action=webhook']);
        }
        if($action==='owner.mail'&&$method==='GET')Response::ok(['mail'=>$commerce->notifications->detail((int)($_GET['id']??0))]);
        if($action==='owner.mail.templates'&&$method==='GET')Response::ok(['templates'=>\BYPCMS\Core\CommerceMailTemplates::samples($config['app']['url'])]);
        if($action==='owner.order'&&$method==='GET')Response::ok(['order'=>$commerce->view((int)($_GET['id']??0))]);
        if($method!=='POST')Response::error('Требуется POST',405);session_write_close();
        if($action==='owner.bank.settings'){$saved=$commerce->invoices->bank->save($input);byp_audit($db,$user,'commerce.bank.settings','commerce',null,['enabled'=>$saved['enabled']]);Response::ok(['bank_settings'=>$saved]);}
        if($action==='owner.invoice.issue'){$id=(int)($input['id']??0);$r=$commerce->invoices->issue($id,(int)$user['id'],$input);byp_audit($db,$user,'commerce.invoice.issue','purchase',$id,['invoice_id'=>$r['id']]);Response::ok(['invoice'=>$r]);}
        if($action==='owner.invoice.cancel'){$id=(int)($input['id']??0);$commerce->invoices->cancel($id,(int)($input['invoice_id']??0),(string)($input['reason']??''));byp_audit($db,$user,'commerce.invoice.cancel','purchase',$id,['invoice_id'=>$input['invoice_id']??0]);Response::ok();}
        if($action==='owner.invoice.confirm'){$id=(int)($input['id']??0);$r=$commerce->invoices->confirm($id,(int)$user['id'],$input);byp_audit($db,$user,'commerce.invoice.confirm','purchase',$id,['invoice_id'=>$input['invoice_id']??0]);Response::ok(['order'=>$r]);}
        if($action==='owner.settings'){$saved=$commerce->settings->save($input,$db);byp_audit($db,$user,'commerce.settings','commerce',null,array_intersect_key($saved,array_flip(['payments_enabled','mode','smtp_enabled'])));Response::ok(['settings'=>$saved]);}
        if($action==='owner.gateway.test'){(new PaymentGateway($settings,$config))->request('GET','payments');Response::ok(['message'=>'ЮKassa приняла настройки подключения. Платёж не создавался.']);}
        if($action==='owner.mail.process'){ignore_user_abort(true);@set_time_limit(90);Response::ok(['result'=>$commerce->notifications->process(3)]);}
        if($action==='owner.mail.test'){$email=CommerceSettings::email($settings['owner_email']);$op=\BYPCMS\Core\LicensePolicy::installation((string)($input['operation_id']??''));$commerce->notifications->enqueue('smtp-test:'.$op,null,$email,'Проверка уведомлений BYPCMS','Тестовое письмо BYPCMS. Если оно получено, SMTP принял отправку и письмо дошло до вашего ящика.');Response::ok(['message'=>'Письмо добавлено в очередь. Запустите обработку или дождитесь cron.']);}
        if(in_array($action,['owner.mail.retry','owner.mail.resend','owner.mail.cancel'],true)){$id=(int)($input['id']??0);$operation=substr($action,strrpos($action,'.')+1);$result=$commerce->notifications->change($id,$operation,(int)$user['id'],$input);byp_audit($db,$user,'commerce.mail.'.$operation,'mail',$id,['result_id'=>$result,'operation_id'=>$input['operation_id']??'']);Response::ok(['mail_id'=>$result]);}
        if($action==='owner.sync'){$id=(int)($input['id']??0);if(!$commerce->row($id)['active_attempt_id'])Response::ok(['order'=>$commerce->view($id),'message'=>'Статус обновлён. Банковский перевод сверяет владелец по выписке, без автоматического подтверждения.']);$order=$commerce->sync($id,null,empty($input['provider_id'])?null:(string)$input['provider_id']);if($order['payment_state']==='paid')$refunds->reconcile($id);Response::ok(['order'=>$commerce->view($id)]);}
        if($action==='owner.fulfill'){$commerce->fulfill((int)($input['id']??0));Response::ok();}
        if($action==='owner.refund.record'){$id=(int)($input['id']??0);$r=$refunds->recordManual($id,(int)$user['id'],$input);byp_audit($db,$user,'commerce.refund.record','purchase',$id,['operation_id'=>$input['operation_id']??'']);Response::ok(['refunds'=>$r]);}
        if($action==='owner.refund.approve'){ignore_user_abort(true);$r=$refunds->approve((int)($input['id']??0),(int)$user['id'],$input);Response::ok(['refund'=>array_intersect_key($r,array_flip(['id','state','last_error']))]);}
        if($action==='owner.refund.sync'){$id=(int)($input['id']??0);Response::ok(['refunds'=>$refunds->reconcile($id,empty($input['provider_id'])?null:(string)$input['provider_id'])]);}
        if($action==='owner.refund.retry'){$r=$refunds->send((string)($input['refund_id']??''));Response::ok(['refund'=>array_intersect_key($r,array_flip(['id','state','last_error']))]);}
        if($action==='owner.refund.decline'){$refunds->decline((int)($input['request_id']??0),(int)$user['id'],(string)($input['reason']??''));Response::ok();}
        if($action==='owner.refund.rights'){if(empty($input['confirmed']))throw new InvalidArgumentException('Подтвердите результат сверки прав.');$refunds->resolve((int)($input['id']??0),(int)$user['id'],(string)($input['refund_id']??''),(string)($input['license_action']??''),empty($input['valid_until'])?null:(string)$input['valid_until']);Response::ok();}
        if($action==='owner.receipt'){
            $id=(int)($input['id']??0);$order=$commerce->row($id);if($order['payment_state']!=='paid')throw new RuntimeException('Заказ не оплачен.');$url=trim((string)($input['sale_url']??''));$p=parse_url($url);if(strlen($url)>2048||preg_match('/[\r\n\x00]/',$url)||($p['scheme']??'')!=='https'||!in_array(strtolower($p['host']??''),['lknpd.nalog.ru','npd.nalog.ru'],true)||isset($p['user'])||isset($p['port']))throw new InvalidArgumentException('Укажите HTTPS-ссылку на чек из Мой налог.');
            $refundState=!empty($input['refund_corrected'])?'corrected':'not_required';$note=mb_substr(trim((string)($input['refund_note']??'')),0,255);if($refundState==='corrected'&&$note==='')throw new InvalidArgumentException('Укажите сведения о корректировке чека.');
            $db->execute('INSERT INTO byp_commerce_receipts(order_id,sale_state,sale_url,refund_state,refund_note,updated_by,updated_at) VALUES(?,"issued",?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE sale_state="issued",sale_url=VALUES(sale_url),refund_state=IF(VALUES(refund_state)="corrected","corrected",refund_state),refund_note=VALUES(refund_note),updated_by=VALUES(updated_by),updated_at=NOW()',[$id,$url,$refundState,$note,$user['id']]);byp_audit($db,$user,'commerce.receipt','purchase',$id,['state'=>'owner_recorded']);$commerce->notifications->event($order,'receipt:'.substr(hash('sha256',$url.$refundState.$note),0,24));Response::ok();
        }
        if($action==='owner.work'){ignore_user_abort(true);@set_time_limit(120);Response::ok(['result'=>$commerce->work()]);}
        Response::error('Действие не найдено',404);
    }
    if(!$customer)Response::error('Войдите в личный кабинет. Заполненные данные заказа останутся в этой вкладке.',401);
    if($method!=='GET'){$csrf=(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'');if(!hash_equals($_SESSION['customer_csrf'],$csrf))Response::error('Сессия формы истекла. Обновите данные сессии и повторите действие.',403,['code'=>'csrf_expired']);}
    if($method!=='GET')$commerce->limit('customer:'.$customer['id'],60,600);session_write_close();$customerId=(int)$customer['id'];
    if($action==='refund.request'&&$method==='POST')Response::ok(['request'=>$refunds->request((int)($input['id']??0),$customerId,(string)($input['reason']??''))]);
    if($action==='legal.accept'&&$method==='POST'){CommerceLegal::validate($input);$pdo=$db->pdo();$pdo->beginTransaction();try{$order=$commerce->row((int)($input['id']??0),$customerId,true);CommerceLegal::record($db,$customerId,(int)$order['id']);$pdo->commit();Response::ok();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}}
    if($action==='invoice.accept'&&$method==='POST'){$commerce->invoices->accept((int)($input['id']??0),$customerId,$input);Response::ok(['order'=>$commerce->view((int)$input['id'],$customerId)]);}
    if($action==='create'&&$method==='POST')Response::ok(['order'=>$commerce->create($customerId,$input)]);
    $id=(int)($input['id']??$_GET['id']??0);
    if($action==='order'&&$method==='GET')Response::ok(['order'=>$commerce->view($id,$customerId),'payments_available'=>$available]);
    if($action==='pay'&&$method==='POST')Response::ok(['order'=>$commerce->pay($id,$customerId,$allowTest),'payments_available'=>$available]);
    if($action==='sync'&&$method==='POST'){
        $order=$commerce->sync($id,$customerId);if($order['payment_state']==='paid')$refunds->reconcile($id);if($order['payment_state']==='paid'&&$order['fulfillment_state']!=='ready')try{$commerce->fulfill($id);}catch(RuntimeException $ignored){}
        Response::ok(['order'=>$commerce->view($id,$customerId),'payments_available'=>$available]);
    }
    Response::error('Действие не найдено',404);
}catch(InvalidArgumentException $e){Response::error($e->getMessage(),422);}
catch(PDOException $e){error_log('[BYPCMS commerce] database operation failed');Response::error('Сервис заказов временно недоступен. Повторите запрос; сохранённый заказ останется в кабинете.',503);}
catch(RuntimeException $e){Response::error($e->getMessage(),str_contains($e->getMessage(),'Слишком много')?429:((str_contains($e->getMessage(),'Заказ не найден')||str_contains($e->getMessage(),'Письмо не найдено'))?404:422));}
catch(Throwable $e){error_log('[BYPCMS commerce] unexpected operation failure');Response::error('Не удалось завершить действие. Повторите проверку состояния заказа.',503);}
