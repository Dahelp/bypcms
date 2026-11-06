<?php
declare(strict_types=1);
// Only a disposable QA platform root on loopback, never a deployed installation.
$root=realpath($argv[1]??'');if(!$root)throw new RuntimeException('Provide disposable platform root');
$config=require $root.'/_storage/config.php';
if(($config['database']['port']??0)!==3319||($config['app']['url']??'')!=='http://127.0.0.1:8019')throw new RuntimeException('Only isolated QA fixture is allowed');
define('BYPCMS_ROOT',$root);define('BYPCMS_STORAGE',$root.'/_storage');
require_once __DIR__.'/../server/_core/Database.php';
$db=new \BYPCMS\Core\Database($config);require_once __DIR__.'/../server/_core/customer-delivery.php';$checks=0;
function check(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
$result=json_decode(file_get_contents($argv[2]),true,16,JSON_THROW_ON_ERROR);
$secret=$db->one('SELECT key_cipher FROM byp_license_secrets WHERE license_id=?',[$result['license_id']])['key_cipher'];
check(!str_contains($secret,$result['key']),'no plaintext in license secrets');
check(\BYPCMS\Core\LicenseCrypto::decrypt($secret,$config['app']['key'])===$result['key'],'encrypted key is recoverable by issuer');
foreach($db->all('SELECT metadata FROM byp_audit_logs WHERE entity_type="license" AND entity_id=?',[$result['license_id']])as $event)check(!str_contains($event['metadata'],$result['key']),'audit contains no key');
foreach($db->all('SELECT result_json FROM byp_license_operations WHERE license_id=?',[$result['license_id']])as $event)check(!str_contains($event['result_json'],$result['key']),'idempotency record contains no key');
$zip=new ZipArchive();check($zip->open($argv[3])===true,'real builder archive opens');
$trust=json_decode($zip->getFromName('site/_core/license-trust.json'),true,16,JSON_THROW_ON_ERROR);
check(isset($trust['public_key'])&&!isset($trust['private_key']),'package contains public trust only');
for($i=0;$i<$zip->numFiles;$i++){$name=$zip->getNameIndex($i);check(!preg_match('#^site/(?:_storage|_private|owner|account)(?:/|$)|\.pem$#',$name),'no private runtime files in package');}
$zip->close();
// Account tables are initialized by the real account route before running this test.
$email='license-'.bin2hex(random_bytes(6)).'@example.test';
$customer=$db->insert('INSERT INTO byp_customer_accounts(email,name,password_hash,created_at) VALUES(?,?,?,NOW())',[$email,'License delivery QA',password_hash('disposable-qa-only',PASSWORD_DEFAULT)]);
$order=$db->insert('INSERT INTO byp_customer_orders(customer_id,edition,modules,domain,license_term,status,created_at) VALUES(?,"content",?,"qa.example.test","annual","pending",NOW())',[$customer,'["content","seo"]']);
customer_fulfill($db,$config,$order,1);$delivery=$db->one('SELECT * FROM byp_customer_deliveries WHERE order_id=?',[$order]);
$license=$db->one('SELECT l.* FROM byp_license_registry l JOIN byp_license_order_links o ON o.license_id=l.id WHERE o.order_id=?',[$order]);
$plain=customer_key_crypt($delivery['key_cipher'],$config['app']['key'],true);
check($license['license_key_hash']===hash('sha256',$plain),'issued purchase key is registered');
check($license['activated_at']===null,'purchase issuance is not activation');
customer_fulfill($db,$config,$order,1);
check((int)$db->one('SELECT license_id FROM byp_license_order_links WHERE order_id=?',[$order])['license_id']===(int)$license['id'],'fulfillment retry has one license');
$legacyId=(int)$license['id'];
// Remove only this newly-created fixture license to emulate a delivery issued before licensing existed.
$db->execute('DELETE FROM byp_license_order_links WHERE order_id=?',[$order]);$db->execute('DELETE FROM byp_license_secrets WHERE license_id=?',[$legacyId]);$db->execute('DELETE FROM byp_license_registry WHERE id=?',[$legacyId]);
customer_license_prepare($db,$config,$db->one('SELECT o.*,d.key_cipher,d.archive_path,d.confirmed_at FROM byp_customer_orders o JOIN byp_customer_deliveries d ON d.order_id=o.id WHERE o.id=?',[$order]));
$migrated=$db->one('SELECT l.* FROM byp_license_registry l JOIN byp_license_order_links o ON o.license_id=l.id WHERE o.order_id=?',[$order]);
check($migrated['license_key_hash']===hash('sha256',$plain),'legacy delivery keeps the same purchase key');
check(substr($migrated['valid_until'],0,10)===substr($license['valid_until'],0,10),'migration preserves original term start');
customer_package_trust($db,$config,$delivery['archive_path']);
$zip=new ZipArchive();$zip->open($delivery['archive_path']);check($zip->getFromName('site/_core/license-trust.json')!==false,'customer archive carries public trust');$zip->close();
$authority=new \BYPCMS\Core\LicenseAuthority($db->pdo(),BYPCMS_STORAGE,$config);
$installation=bin2hex(random_bytes(16));
$challenge=$authority->challenge(['key'=>$plain,'installation_id'=>$installation,'site_url'=>'http://qa.example.test:8029','edition'=>'content'],time());
$proofRoot=dirname($root).'/packages/content/site/.well-known/bypcms-activation';if(!is_dir($proofRoot))mkdir($proofRoot,0755,true);$path=$proofRoot.'/'.$challenge['challenge_id'].'.json';
try {
    file_put_contents($path,json_encode(['installation_id'=>$installation,'nonce'=>'wrong']));
    try{$authority->activate(['key'=>$plain,'challenge_id'=>$challenge['challenge_id']],time());throw new RuntimeException('bad proof accepted');}catch(\BYPCMS\Core\LicenseException $error){check($error->reason==='domain_proof_failed','wrong proof rejected');}
    file_put_contents($path,json_encode(['installation_id'=>$installation,'nonce'=>$challenge['nonce']]));
    $activation=$authority->activate(['key'=>$plain,'challenge_id'=>$challenge['challenge_id']],time());check(isset($activation['receipt']),'real domain proof succeeds');
    try{$authority->activate(['key'=>$plain,'challenge_id'=>$challenge['challenge_id']],time());throw new RuntimeException('replay accepted');}catch(\BYPCMS\Core\LicenseException $error){check(in_array($error->reason,['challenge_expired','challenge_consumed'],true),'consumed challenge cannot replay');}
    $authority->check(['installation_id'=>$installation,'activation_token'=>$activation['activation_token']],time(),true);
}finally{if(is_file($path))unlink($path);}
echo "$checks real storage/package/delivery/proof checks passed\n";
if(isset($argv[4]))file_put_contents($argv[4],json_encode(['email'=>$email,'order_id'=>$order,'key'=>$plain]));
