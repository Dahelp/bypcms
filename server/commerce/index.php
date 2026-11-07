<?php
declare(strict_types=1);
require_once __DIR__.'/../_core/bootstrap.php';
require_once __DIR__.'/../_core/CommerceOrders.php';
use BYPCMS\Core\{CommerceOrders,CommerceSettings,PaymentGateway,Response};
header('X-Robots-Tag: noindex, nofollow');header('X-Frame-Options: SAMEORIGIN');
if(($config['app']['installation_type']??'platform')==='client')Response::error('Раздел доступен на платформе BYPCMS',403);
$action=(string)($_GET['action']??'bootstrap');$method=$_SERVER['REQUEST_METHOD']??'GET';
if((int)($_SERVER['CONTENT_LENGTH']??0)>32768)Response::error('Слишком большой запрос',413);
$input=byp_input();$_SESSION['customer_csrf']??=bin2hex(random_bytes(32));
try {
    $commerce=new CommerceOrders($db,$config,BYPCMS_ROOT);$user=$auth->user();$owner=$user&&$user['role']==='owner';$customer=empty($_SESSION['customer_id'])?null:$db->one('SELECT id,name,email FROM byp_customer_accounts WHERE id=?',[(int)$_SESSION['customer_id']]);$settings=$commerce->settings->get();
    $allowTest=$owner||!empty($config['app']['debug']);$available=$commerce->available($allowTest);
    if($action==='bootstrap'&&$method==='GET')Response::ok(['customer'=>$customer,'csrf'=>$_SESSION['customer_csrf'],'catalog'=>$commerce->catalog(),'payments_available'=>$available,'test_mode'=>$settings['mode']==='test','renewal_quote'=>$customer&&!empty($_GET['renewal'])?$commerce->renewalQuote((int)$customer['id'],(int)$_GET['renewal']):null]);
    if($action==='quote'&&$method==='POST')Response::ok(['quote'=>$commerce->quote($input)]);
    if($action==='webhook'){
        if($method!=='POST')Response::error('Требуется POST',405);
        // The supplied event never confirms money: the order is changed only after an authenticated GET to YooKassa.
        $commerce->limit('webhook:'.($_SERVER['REMOTE_ADDR']??''),120,60);session_write_close();$commerce->webhook($input);Response::ok();
    }
    if(str_starts_with($action,'owner.')){
        if(!$user)Response::error('Требуется вход владельца',401);if(!$owner)Response::error('Доступно только владельцу',403);if($method!=='GET')$auth->verifyCsrf();
        if($action==='owner.status'&&$method==='GET'){
            $mailPage=max(1,min(10000,(int)($_GET['mail_page']??1)));$mailOffset=($mailPage-1)*40;
            $page=max(1,min(10000,(int)($_GET['page']??1)));$offset=($page-1)*20;$where='';$params=[];$query=mb_substr(trim((string)($_GET['q']??'')),0,190);if(!empty($_GET['order'])){$where=' WHERE o.id=?';$params[]=(int)$_GET['order'];}elseif($query!==''){$where=' WHERE (c.email LIKE ? OR c.name LIKE ? OR o.domain LIKE ? OR o.id=?)';$params=['%'.$query.'%','%'.$query.'%','%'.$query.'%',ctype_digit($query)?(int)$query:0];}
            $mailWhere=$query!==''?' WHERE recipient LIKE ? OR subject LIKE ?':'';$mailParams=$query!==''?['%'.$query.'%','%'.$query.'%']:[];
            $rows=$db->all('SELECT o.id,o.edition,o.domain,o.license_term,c.name,c.email,d.kind,d.amount_minor,d.payment_state,d.fulfillment_state,d.fulfillment_error,d.mode,d.created_at,d.active_attempt_id FROM byp_commerce_orders d JOIN byp_customer_orders o ON o.id=d.order_id JOIN byp_customer_accounts c ON c.id=o.customer_id'.$where.' ORDER BY o.id DESC LIMIT 20 OFFSET '.$offset,$params);
            foreach($rows as &$row)$row['attempt']=$row['active_attempt_id']?$db->one('SELECT id,provider_id,state,last_error,created_at FROM byp_payment_attempts WHERE id=?',[$row['active_attempt_id']]):null;unset($row);
            Response::ok(['settings'=>$commerce->settings->public(),'orders'=>$rows,'page'=>$page,'query'=>$query,'total'=>(int)$db->one('SELECT COUNT(*) AS total FROM byp_commerce_orders d JOIN byp_customer_orders o ON o.id=d.order_id JOIN byp_customer_accounts c ON c.id=o.customer_id'.$where,$params)['total'],'mail_page'=>$mailPage,'mail_total'=>(int)$db->one('SELECT COUNT(*) AS total FROM byp_notification_outbox'.$mailWhere,$mailParams)['total'],'outbox'=>$db->all('SELECT id,order_id,recipient,subject,state,attempts,last_error,created_at,accepted_at FROM byp_notification_outbox'.$mailWhere.' ORDER BY id DESC LIMIT 40 OFFSET '.$mailOffset,$mailParams),'worker'=>$commerce->settings->workerStatus(),'worker_command'=>'php '.escapeshellarg(BYPCMS_ROOT.'/_core/commerce-worker.php'),'webhook_url'=>rtrim($config['app']['url'],'/').'/commerce/index.php?action=webhook']);
        }
        if($method!=='POST')Response::error('Требуется POST',405);session_write_close();
        if($action==='owner.settings'){$saved=$commerce->settings->save($input,$db);byp_audit($db,$user,'commerce.settings','commerce',null,array_intersect_key($saved,array_flip(['payments_enabled','mode','smtp_enabled'])));Response::ok(['settings'=>$saved]);}
        if($action==='owner.gateway.test'){(new PaymentGateway($settings,$config))->request('GET','payments');Response::ok(['message'=>'ЮKassa приняла настройки подключения. Платёж не создавался.']);}
        if($action==='owner.mail.test'){$email=CommerceSettings::email($settings['owner_email']);$op=\BYPCMS\Core\LicensePolicy::installation((string)($input['operation_id']??''));$commerce->notifications->enqueue('smtp-test:'.$op,null,$email,'Проверка уведомлений BYPCMS','Тестовое письмо BYPCMS. Если оно получено, SMTP принял отправку и письмо дошло до вашего ящика.');Response::ok(['message'=>'Письмо добавлено в очередь. Запустите обработку или дождитесь cron.']);}
        if($action==='owner.mail.retry'){$commerce->notifications->retry((int)($input['id']??0),!empty($input['acknowledge']));Response::ok();}
        if($action==='owner.sync'){$id=(int)($input['id']??0);if(!$commerce->row($id)['active_attempt_id'])throw new InvalidArgumentException('Платёж по этому заказу ещё не создавался.');$order=$commerce->sync($id,null,empty($input['provider_id'])?null:(string)$input['provider_id']);Response::ok(['order'=>$order]);}
        if($action==='owner.fulfill'){$commerce->fulfill((int)($input['id']??0));Response::ok();}
        if($action==='owner.work'){ignore_user_abort(true);@set_time_limit(120);Response::ok(['result'=>$commerce->work()]);}
        Response::error('Действие не найдено',404);
    }
    if(!$customer)Response::error('Войдите в личный кабинет. Заполненные данные заказа останутся в этой вкладке.',401);
    if($method!=='GET'){$csrf=(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'');if(!hash_equals($_SESSION['customer_csrf'],$csrf))Response::error('Сессия формы истекла. Обновите данные сессии и повторите действие.',403,['code'=>'csrf_expired']);}
    if($method!=='GET')$commerce->limit('customer:'.$customer['id'],60,600);session_write_close();$customerId=(int)$customer['id'];
    if($action==='create'&&$method==='POST')Response::ok(['order'=>$commerce->create($customerId,$input)]);
    $id=(int)($input['id']??$_GET['id']??0);
    if($action==='order'&&$method==='GET')Response::ok(['order'=>$commerce->view($id,$customerId),'payments_available'=>$available]);
    if($action==='pay'&&$method==='POST')Response::ok(['order'=>$commerce->pay($id,$customerId,$allowTest),'payments_available'=>$available]);
    if($action==='sync'&&$method==='POST'){
        $order=$commerce->sync($id,$customerId);if($order['payment_state']==='paid'&&$order['fulfillment_state']!=='ready')try{$commerce->fulfill($id);}catch(RuntimeException $ignored){}
        Response::ok(['order'=>$commerce->view($id,$customerId),'payments_available'=>$available]);
    }
    Response::error('Действие не найдено',404);
}catch(InvalidArgumentException $e){Response::error($e->getMessage(),422);}
catch(PDOException $e){error_log('[BYPCMS commerce] database operation failed');Response::error('Сервис заказов временно недоступен. Повторите запрос; сохранённый заказ останется в кабинете.',503);}
catch(RuntimeException $e){Response::error($e->getMessage(),str_contains($e->getMessage(),'Слишком много')?429:(str_contains($e->getMessage(),'Заказ не найден')?404:422));}
catch(Throwable $e){error_log('[BYPCMS commerce] unexpected operation failure');Response::error('Не удалось завершить действие. Повторите проверку состояния заказа.',503);}
