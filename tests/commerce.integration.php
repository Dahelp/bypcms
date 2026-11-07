<?php
declare(strict_types=1);
// Requires a disposable platform DB and tests/commerce-mock.mjs. Refuses production.
$root=realpath($argv[1]??'');if(!$root)throw new RuntimeException('Provide disposable root');
$config=require $root.'/_storage/config.php';
if(($config['database']['port']??0)!==3319||($config['app']['url']??'')!=='http://127.0.0.1:8019'||empty($config['app']['debug']))throw new RuntimeException('Only isolated QA fixture is allowed');
define('BYPCMS_ROOT',$root);define('BYPCMS_STORAGE',$root.'/_storage');
require_once __DIR__.'/../server/_core/Database.php';
require_once __DIR__.'/../server/_core/CommerceOrders.php';
$config['commerce']=['test_api_base'=>'http://127.0.0.1:8049/v3','test_smtp'=>['host'=>'127.0.0.1','port'=>8465,'ca_file'=>dirname($root).'/smtp-cert.pem']];
$db=new BYPCMS\Core\Database($config);$commerce=new BYPCMS\Core\CommerceOrders($db,$config,$root);$checks=0;
function check(bool $ok,string $why):void{global $checks;if(!$ok)throw new RuntimeException($why);$checks++;}
function rejects(callable $fn,string $why):void{try{$fn();}catch(Throwable $e){check(true,$why);return;}throw new RuntimeException($why);}
function control(array $body=[]):array{$options=['http'=>['method'=>$body?'POST':'GET','header'=>'Content-Type: application/json','content'=>json_encode($body),'timeout'=>5]];return json_decode(file_get_contents('http://127.0.0.1:8049/control',false,stream_context_create($options)),true,32,JSON_THROW_ON_ERROR);}
function input(array $extra=[]):array{return array_replace(['edition'=>'content','term'=>'annual','domain'=>'qa.example.test','modules'=>[],'services'=>[],'operation_id'=>bin2hex(random_bytes(16))],$extra);}
function paid(array $order):array{global $commerce;$id=$order['attempt']['provider_id'];control(['id'=>$id,'patch'=>['status'=>'succeeded','paid'=>true]]);$commerce->webhook(['type'=>'notification','event'=>'payment.succeeded','object'=>['id'=>$id]]);return $commerce->view((int)$order['id']);}
$email='commerce-'.bin2hex(random_bytes(5)).'@example.test';$buyer=$db->insert('INSERT INTO byp_customer_accounts(email,name,password_hash,created_at) VALUES(?,?,?,NOW())',[$email,'Commerce QA',password_hash('BYPCMS-QA-Buyer-2026',PASSWORD_DEFAULT)]);
$commerce->settings->save(['payments_enabled'=>false,'smtp_enabled'=>false,'clear_shop_secret'=>true],$db);
check(!$commerce->available(),'disabled until configured');
rejects(fn()=>$commerce->settings->save(['payments_enabled'=>true],$db),'missing keys rejected');
$commerce->settings->save(['payments_enabled'=>true,'mode'=>'test','shop_id'=>'12345','shop_secret'=>'qa-payment-secret','receipt_mode'=>'yookassa','vat_code'=>1,'payment_subject'=>'intellectual_activity','payment_mode'=>'full_payment','owner_email'=>'qa-owner@example.test','smtp_enabled'=>false],$db);
$commerce->settings->workerReport([]);
check(!$commerce->available(false)&&$commerce->available(true),'test payments restricted');
$public=$commerce->settings->public();check(!isset($public['shop_secret'])&&!str_contains(json_encode($public),'qa-payment-secret')&&$public['shop_secret_saved'],'settings never echo secrets');
$quote=$commerce->quote(input(['amount_minor'=>1,'modules'=>['content']]));check($quote['amount_minor']===790000,'server price ignores client amount and included module');
rejects(fn()=>$commerce->quote(input(['modules'=>['imaginary']])),'unknown module rejected');
rejects(fn()=>$commerce->quote(input(['edition'=>'imaginary'])),'unknown edition rejected');
check($commerce->quote(input(['modules'=>['seo']]))['amount_minor']===790000,'included SEO never double billed');
check($commerce->quote(input(['modules'=>['analytics']]))['amount_minor']===1380000,'published compatible add-on priced by DB');
$in=input();$order=$commerce->create($buyer,$in);$id=(int)$order['id'];
check($commerce->create($buyer,$in)['id']==$id,'double create same order');
rejects(fn()=>$commerce->create($buyer,array_replace($in,['domain'=>'different.test'])),'changed payload cannot reuse operation');
rejects(fn()=>$commerce->view($id,$buyer+100000),'other buyer cannot read');
rejects(fn()=>$commerce->pay($id,$buyer,false),'public cannot pay in test mode');
rejects(fn()=>$commerce->fulfill($id+100000),'unknown fulfillment rejected');
$order=$commerce->pay($id,$buyer,true);$posts=control()['posts'];$same=$commerce->pay($id,$buyer,true);check($same['attempt']['id']===$order['attempt']['id']&&control()['posts']===$posts,'double pay reuses pending payment');
rejects(fn()=>$commerce->settings->save(['shop_id'=>'999'],$db),'cannot switch pending merchant');
// A submitted success event does not override the authenticated provider's pending state.
$commerce->webhook(['type'=>'notification','event'=>'payment.succeeded','object'=>['id'=>$order['attempt']['provider_id'],'status'=>'succeeded','paid'=>true]]);
check($commerce->view($id)['payment_state']==='pending','spoofed success event not trusted');
foreach([['amount'=>['value'=>'1.00','currency'=>'RUB']],['amount'=>['value'=>'7900.00','currency'=>'USD']],['recipient'=>['account_id'=>'999']],['test'=>false],['metadata'=>['order_ref'=>'wrong','attempt_ref'=>$order['attempt']['id']]]]as $patch){
 $original=control()['payments'];$original=array_values(array_filter($original,fn($p)=>$p['id']===$order['attempt']['provider_id']))[0];
 control(['id'=>$original['id'],'patch'=>$patch]);rejects(fn()=>$commerce->sync($id,$buyer),'provider mismatch rejected');control(['id'=>$original['id'],'patch'=>$original]);
}
$order=paid($order);check($order['payment_state']==='paid','authenticated success marks paid');
$commerce->fulfill($id);$commerce->fulfill($id);$order=$commerce->view($id);check($order['fulfillment_state']==='ready','purchase fulfillment retry succeeds');
$delivery=$db->one('SELECT * FROM byp_customer_deliveries WHERE order_id=?',[$id]);$license=$db->one('SELECT l.* FROM byp_license_registry l JOIN byp_license_order_links k ON k.license_id=l.id WHERE k.order_id=?',[$id]);
check($license['status']==='trial'&&$license['license_term']==='annual','test purchase cannot issue production lifetime');
check((int)$db->one('SELECT COUNT(*) n FROM byp_license_order_links WHERE order_id=?',[$id])['n']===1,'one license per order');
$zip=new ZipArchive();check($zip->open($delivery['archive_path'])===true,'real ZIP generated');
check(json_decode($zip->getFromName('site/build-manifest.json'),true)['test_purchase']===true,'test archive marked');
for($i=0;$i<$zip->numFiles;$i++)check(!preg_match('#^site/(?:_storage|_private|owner|account|commerce)(?:/|$)|\.pem$#',$zip->getNameIndex($i)),'private runtime absent from ZIP');$zip->close();
$events=(int)$db->one('SELECT COUNT(*) n FROM byp_commerce_events WHERE order_id=?',[$id])['n'];paid($order);$commerce->fulfill($id);check((int)$db->one('SELECT COUNT(*) n FROM byp_commerce_events WHERE order_id=?',[$id])['n']===$events,'duplicate webhook has no duplicate events');
$inquiry=$commerce->create($buyer,input(['services'=>['launch'],'domain'=>'']));check($inquiry['kind']==='inquiry','services produce inquiry');rejects(fn()=>$commerce->pay((int)$inquiry['id'],$buyer,true),'inquiry cannot charge estimated services');
// An indeterminate POST is retried with the exact same provider idempotence key.
$lost=$commerce->create($buyer,input());control(['next'=>'drop']);rejects(fn()=>$commerce->pay((int)$lost['id'],$buyer,true),'lost response reported');
$uncertain=$commerce->view((int)$lost['id']);check($uncertain['attempt']['state']==='uncertain','unknown charge retained');
$lost=$commerce->pay((int)$lost['id'],$buyer,true);check($lost['attempt']['id']===$uncertain['attempt']['id'],'retry retains idempotence key');
control(['id'=>$lost['attempt']['provider_id'],'patch'=>['status'=>'canceled']]);$commerce->sync((int)$lost['id'],$buyer);check($commerce->view((int)$lost['id'])['payment_state']==='canceled','cancel recorded');
$again=$commerce->pay((int)$lost['id'],$buyer,true);check($again['attempt']['id']!==$lost['attempt']['id'],'confirmed cancellation allows new attempt');control(['id'=>$again['attempt']['provider_id'],'patch'=>['status'=>'canceled']]);$commerce->sync((int)$lost['id'],$buyer);
$aged=$commerce->create($buyer,input());control(['next'=>'drop']);rejects(fn()=>$commerce->pay((int)$aged['id'],$buyer,true),'aged unknown setup');$aged=$commerce->view((int)$aged['id']);$db->execute('UPDATE byp_payment_attempts SET created_at=DATE_SUB(NOW(),INTERVAL 25 HOUR) WHERE id=?',[$aged['attempt']['id']]);$posts=control()['posts'];rejects(fn()=>$commerce->pay((int)$aged['id'],$buyer,true),'outside provider idempotence window blocked');check(control()['posts']===$posts,'no uncertain duplicate charge after 24h');
$remote=array_values(array_filter(control()['payments'],fn($p)=>$p['metadata']['attempt_ref']===$aged['attempt']['id']))[0];control(['id'=>$remote['id'],'patch'=>['status'=>'canceled']]);$commerce->sync((int)$aged['id'],null,$remote['id']);
// TLS SMTP acceptance, safe failure, unknown DATA acknowledgement, explicit retry.
$commerce->settings->save(['smtp_enabled'=>true,'smtp_host'=>'smtp.example.test','smtp_security'=>'ssl','smtp_port'=>465,'smtp_user'=>'qa-smtp-user','smtp_password'=>'qa-smtp-password','from_email'=>'sender@example.test'], $db);
$db->execute('UPDATE byp_notification_outbox SET next_attempt_at=DATE_ADD(NOW(),INTERVAL 1 YEAR) WHERE state IN ("pending","retry")');
$mailKey='qa-mail:'.bin2hex(random_bytes(8));$commerce->notifications->enqueue($mailKey,null,$email,'Проверка SMTP','Текст уведомления');$commerce->notifications->enqueue($mailKey,null,$email,'Проверка SMTP','Текст уведомления');
$commerce->notifications->process(1);$mail=$db->one('SELECT * FROM byp_notification_outbox WHERE event_key=?',[$mailKey]);check($mail['state']==='accepted','real TLS SMTP accepted');$messages=count(control()['messages']);$commerce->notifications->process(1);check(count(control()['messages'])===$messages,'accepted mail not resent');rejects(fn()=>$commerce->notifications->retry((int)$mail['id']),'accepted retry refused');
check(str_contains(control()['messages'][$messages-1],'Message-ID: <bypcms-'.hash('sha256',$mailKey)),'stable message id');
$bad=$config;$bad['commerce']['test_smtp']['ca_file']=__DIR__.'/missing-ca.pem';rejects(fn()=>(new BYPCMS\Core\SmtpTransport($commerce->settings->get(),$bad))->send($mail),'untrusted TLS certificate rejected');
foreach(['reject'=>'retry','drop'=>'uncertain']as $mode=>$expected){control(['mail'=>$mode]);$key='qa-mail:'.bin2hex(random_bytes(8));$commerce->notifications->enqueue($key,null,$email,'Проверка сбоя','Текст');$commerce->notifications->process(1);$row=$db->one('SELECT * FROM byp_notification_outbox WHERE event_key=?',[$key]);check($row['state']===$expected,'SMTP '.$mode.' classified');if($mode==='drop')rejects(fn()=>$commerce->notifications->retry((int)$row['id']),'uncertain resend needs acknowledgment');$commerce->notifications->retry((int)$row['id'],true);control(['mail'=>'accept']);$commerce->notifications->process(1);check($db->one('SELECT state FROM byp_notification_outbox WHERE id=?',[$row['id']])['state']==='accepted','mail recovered');}
check($commerce->view($id)['payment_state']==='paid','SMTP errors never roll back payment');
// Reconcile stale attempts from earlier interrupted runs of this disposable fixture.
$db->execute('UPDATE byp_payment_attempts SET state="canceled" WHERE state IN ("creating","uncertain","pending","waiting_for_capture")');
$commerce->settings->save(['mode'=>'live','smtp_enabled'=>false],$db);control(['test'=>false]);
$live=$commerce->create($buyer,input());$live=$commerce->pay((int)$live['id'],$buyer,false);$live=paid($live);
$commerce->fulfill((int)$live['id']);$license=$db->one('SELECT l.* FROM byp_license_registry l JOIN byp_license_order_links k ON k.license_id=l.id WHERE k.order_id=?',[$live['id']]);
check($license['status']==='active'&&$license['purchase_price']==='7900.00','verified live-mode payment issues correct license');
$renewal=$commerce->create($buyer,input(['renewal_license_id'=>$license['id']]));$renewal=$commerce->pay((int)$renewal['id'],$buyer,false);$renewal=paid($renewal);
$commerce->fulfill((int)$renewal['id']);$until=$db->one('SELECT valid_until FROM byp_license_registry WHERE id=?',[$license['id']])['valid_until'];$commerce->fulfill((int)$renewal['id']);
check($db->one('SELECT valid_until FROM byp_license_registry WHERE id=?',[$license['id']])['valid_until']===$until&&$until>$license['valid_until'],'renewal adds one year exactly once');
rejects(fn()=>$commerce->renewalQuote($buyer+100000,(int)$license['id']),'other buyer cannot renew license');
// Missing ZIP preparation cannot undo the provider-confirmed payment; retry uses one license.
$failure=$commerce->create($buyer,input());$failure=paid($commerce->pay((int)$failure['id'],$buyer,false));
$packageDir=BYPCMS\Core\UpdateRuntime::storage($root).'/customer-packages';$holding=$packageDir.'-qa-hold';
if(!rename($packageDir,$holding))throw new RuntimeException('Cannot isolate package failure');file_put_contents($packageDir,'QA forced unavailable directory');
try{rejects(fn()=>$commerce->fulfill((int)$failure['id']),'ZIP failure reported');check($commerce->view((int)$failure['id'])['payment_state']==='paid'&&$commerce->view((int)$failure['id'])['fulfillment_state']==='failed','paid remains paid on delivery failure');}
finally{unlink($packageDir);rename($holding,$packageDir);}
$commerce->fulfill((int)$failure['id']);check($commerce->view((int)$failure['id'])['fulfillment_state']==='ready','failed delivery recovers');
$commerce->settings->save(['mode'=>'test'], $db);control(['test'=>true]);$commerce->settings->workerReport([]);
file_put_contents(dirname($root).'/commerce-result.json',json_encode(['customer_id'=>$buyer,'email'=>$email,'order_id'=>$id,'license_id'=>$license['id'],'checks'=>$checks]));
echo "$checks commerce/provider/TLS/storage checks passed\n";
