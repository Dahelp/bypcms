<?php
declare(strict_types=1);
// This harness never runs against production or a customer database.
$root=realpath($argv[1]??'');if(!$root)throw new RuntimeException('Explicit loopback fixture required');
$config=require $root.'/_storage/config.php';
if($config['database']['host']!=='127.0.0.1'||$config['database']['port']!==3319||!str_starts_with($config['database']['name'],'bypcms_purchase_')||$config['app']['url']!=='http://127.0.0.1:8019'||empty($config['app']['debug'])||($config['commerce']['test_smtp']['host']??'')!=='127.0.0.1')throw new RuntimeException('Isolated fixture only');
define('BYPCMS_ROOT',$root);define('BYPCMS_STORAGE',$root.'/_storage');
require_once __DIR__.'/../server/_core/Database.php';require_once __DIR__.'/../server/_core/CommerceOrders.php';
use BYPCMS\Core\{Database,CommerceOrders,CustomerRecovery,CommerceLegal,LicenseCrypto};
$db=new Database($config);$o=new CommerceOrders($db,$config,$root);$recovery=new CustomerRecovery($db,$o,$config,$root);
$input=json_decode(stream_get_contents(STDIN),true,32,JSON_THROW_ON_ERROR);$action=$input['action'];$result=[];
function snapshot(Database $db):string {
    $data=[];foreach(['byp_customer_orders','byp_commerce_orders','byp_customer_deliveries','byp_license_registry','byp_license_order_links','byp_license_activations','byp_commerce_invoices','byp_commerce_manual_payments','byp_commerce_consents']as $table)$data[$table]=$db->all('SELECT * FROM '.$table);
    return hash('sha256',json_encode($data,JSON_THROW_ON_ERROR));
}
if($action==='setup'){
    $o->settings->save(['payments_enabled'=>false,'smtp_enabled'=>true,'smtp_host'=>'smtp.example.test','smtp_security'=>'ssl','smtp_port'=>465,'smtp_user'=>'qa-smtp-user','smtp_password'=>'qa-smtp-password','from_email'=>'sender@example.test','owner_email'=>'qa-owner@example.test'],$db);
    $bank=json_decode(file_get_contents(dirname($root).'/invoice-result.json'),true)['bank_settings'];$o->invoices->bank->save($bank);
    $db->execute('UPDATE byp_notification_outbox SET next_attempt_at=DATE_ADD(NOW(),INTERVAL 1 YEAR) WHERE state IN ("pending","retry")');
    $email='recovery-'.bin2hex(random_bytes(5)).'@example.test';$customer=$db->insert('INSERT INTO byp_customer_accounts(email,name,password_hash,created_at) VALUES(?,?,?,NOW())',[$email,'Recovery QA',password_hash('BYPCMS-QA-Buyer-2026',PASSWORD_DEFAULT)]);
    $order=$o->create($customer,['accept_terms'=>true,'accept_privacy'=>true,'legal_version'=>CommerceLegal::VERSION,'edition'=>'content','term'=>'annual','domain'=>'recovery.example.test','modules'=>[],'services'=>[],'operation_id'=>bin2hex(random_bytes(16))]);
    $owner=(int)$db->one('SELECT u.id FROM byp_users u JOIN byp_roles r ON r.id=u.role_id WHERE r.slug="owner" LIMIT 1')['id'];
    $o->invoices->confirm((int)$order['id'],$owner,['operation_id'=>bin2hex(random_bytes(16)),'invoice_id'=>$order['invoice']['id'],'amount'=>'7900.00','source'=>'bank','reference'=>'QA-recovery-'.bin2hex(random_bytes(5)),'paid_on'=>gmdate('Y-m-d'),'confirmed'=>true]);
    $db->execute('UPDATE byp_notification_outbox SET next_attempt_at=DATE_ADD(NOW(),INTERVAL 1 YEAR) WHERE state IN ("pending","retry")');
    $result=['email'=>$email,'customer'=>$customer,'order'=>(int)$order['id'],'snapshot'=>snapshot($db)];
}elseif($action==='clear-rate'){$db->execute('DELETE FROM byp_license_requests');}
elseif($action==='smtp'){$o->settings->save(['smtp_enabled'=>(bool)$input['enabled']],$db);}
elseif($action==='snapshot'){$result=['snapshot'=>snapshot($db)];}
elseif($action==='trigger'){
    if($input['enabled'])$db->execute('CREATE TRIGGER byp_qa_reset_fault BEFORE UPDATE ON byp_customer_accounts FOR EACH ROW SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT="Synthetic QA recovery fault"');else $db->execute('DROP TRIGGER IF EXISTS byp_qa_reset_fault');
}elseif($action==='queue-trigger'){
    if($input['enabled'])$db->execute('CREATE TRIGGER byp_qa_reset_queue_fault BEFORE INSERT ON byp_notification_outbox FOR EACH ROW SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT="Synthetic QA outbox fault"');else $db->execute('DROP TRIGGER IF EXISTS byp_qa_reset_queue_fault');
}else{
    $customer=$db->one('SELECT id,email,password_hash FROM byp_customer_accounts WHERE id=?',[$input['customer']??0]);
    if(!$customer||!preg_match('/^recovery-[a-f0-9]+@example\.test$/D',$customer['email']))throw new RuntimeException('Own synthetic buyer only');
    if($action==='latest'){
        $r=$db->one('SELECT * FROM byp_customer_password_resets WHERE customer_id=? ORDER BY id DESC LIMIT 1',[$customer['id']]);
        $result=['count'=>(int)$db->one('SELECT COUNT(*) n FROM byp_customer_password_resets WHERE customer_id=?',[$customer['id']])['n'],'mail_id'=>$r?(int)$r['mail_id']:null,'valid'=>$r&&$r['used_at']===null&&(int)$r['expires_at']>time(),'outbox'=>$r?$o->notifications->detail((int)$r['mail_id']):null];
        // Token is returned only to this explicit loopback fixture; never printed by tests.
        if($r&&$r['payload_cipher']){$payload=json_decode(LicenseCrypto::decrypt($r['payload_cipher'],$config['app']['key']),true);preg_match('/token=([a-f0-9]{64})/',$payload['message'],$match);$result['token']=$match[1];$result['tokenOnlyHashed']=hash_equals($r['token_hash'],hash('sha256',$match[1]))&&!str_contains(json_encode($r),$match[1]);}
    }elseif($action==='process'){$result=$o->notifications->process(1,(int)$input['id']);}
    elseif($action==='expire'){$db->execute('UPDATE byp_customer_password_resets SET expires_at=? WHERE mail_id=? AND customer_id=?',[time()-1,$input['id'],$customer['id']]);}
    elseif($action==='cooldown'){$db->execute('UPDATE byp_customer_password_resets SET created_at=created_at-61 WHERE customer_id=?',[$customer['id']]);}
    elseif($action==='due'){$db->execute('UPDATE byp_notification_outbox SET next_attempt_at=NOW() WHERE id=?',[$input['id']]);}
    elseif($action==='status'){$result=['passwordMatches'=>password_verify($input['password'],$customer['password_hash']),'snapshot'=>snapshot($db),'remainingSecrets'=>(int)$db->one('SELECT COUNT(*) n FROM byp_customer_password_resets WHERE customer_id=? AND payload_cipher IS NOT NULL',[$customer['id']])['n']];}
    elseif($action==='retry'){
        try{$o->notifications->change((int)$input['id'],'retry',1,['operation_id'=>bin2hex(random_bytes(16))]);$result=['rejected'=>false];}catch(RuntimeException $e){$result=['rejected'=>true];}
    }elseif($action==='race'){
        try{$recovery->reset($input['token'],$input['password'],$input['password']);$result=['changed'=>true];}catch(InvalidArgumentException $e){$result=['changed'=>false];}
    }elseif($action==='request'){$recovery->request($customer['email'],'qa-browser','/account/');$result=['queued'=>true];}else throw new RuntimeException('Explicit fixture action required');
}
echo json_encode($result,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);
