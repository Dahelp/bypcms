<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/LicenseCrypto.php';
require_once __DIR__.'/../server/_core/LicensePolicy.php';
require_once __DIR__.'/../server/_core/LicenseHttp.php';
use BYPCMS\Core\LicenseCrypto as Crypto;
use BYPCMS\Core\LicensePolicy as Policy;
use BYPCMS\Core\LicenseHttp;
$checks=0;
function check(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function rejects(callable $action,string $message):void{try{$action();}catch(Throwable $error){check(true,$message);return;}throw new RuntimeException($message);}
$now=strtotime('2026-11-07 00:00:00 UTC');
check(Policy::domain(' WWW.Example.RU. ')==='example.ru','canonical domain');
foreach(['https://example.ru','example.ru/path','example.ru:443','localhost','a..ru','example.ru@evil.ru']as $bad)rejects(fn()=>Policy::domain($bad),'reject bad domain');
check(Policy::site('https://www.example.ru/cms/')['domain']==='example.ru','subdirectory site');
foreach(['http://example.ru','https://example.ru:8443','https://user@example.ru','https://example.ru/a/../b','https://example.ru?x=1']as $bad)rejects(fn()=>Policy::site($bad),'reject bad site');
rejects(fn()=>Policy::expiry('2026-02-29'),'invalid date');
check(Policy::renew('2028-02-29',$now)==='2029-02-28','leap-day renewal clamps');
check(Policy::renew('2026-01-01',$now)==='2027-11-07','expired license renews from now');
check(Policy::renew('2027-12-09',$now)==='2028-12-09','early renewal preserves remaining time');
$key=openssl_pkey_new(['private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);
if(!$key||!openssl_pkey_export($key,$private))throw new RuntimeException('OpenSSL test key unavailable');
$public=openssl_pkey_get_details($key)['key'];$installation=str_repeat('a',32);
$claims=['license_id'=>1,'activation_id'=>2,'installation_id'=>$installation,'generation'=>str_repeat('b',32),'domain'=>'example.ru','edition'=>'content','license_term'=>'annual','status'=>'active','entitlements'=>['content','seo'],'updates_until'=>$now+31536000,'issued_at'=>$now,'lease_until'=>$now+86400,'offline_until'=>$now+604800];
$receipt=Crypto::sign($claims,$private,$public);
check(Crypto::verify($receipt,$public,$installation,'example.ru','content',$now)===$claims,'signed claims roundtrip');
$modified=$receipt;$modified['payload'][0]=$modified['payload'][0]==='a'?'b':'a';
rejects(fn()=>Crypto::verify($modified,$public,$installation,'example.ru','content',$now),'reject altered payload');
$modified=$receipt;$modified['signature'][0]=$modified['signature'][0]==='a'?'b':'a';
rejects(fn()=>Crypto::verify($modified,$public,$installation,'example.ru','content',$now),'reject altered signature');
foreach([['wrong.ru','content',$installation],['example.ru','business',$installation],['example.ru','content',str_repeat('c',32)]]as[$domain,$edition,$id])rejects(fn()=>Crypto::verify($receipt,$public,$id,$domain,$edition,$now),'reject different installation target');
$other=openssl_pkey_new(['private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);
rejects(fn()=>Crypto::verify($receipt,openssl_pkey_get_details($other)['key'],$installation,'example.ru','content',$now),'reject another signing authority');
foreach([['license_id'=>0],['status'=>'invented'],['updates_until'=>null],['offline_until'=>$now+604801],['issued_at'=>$now+301],['generation'=>'bad'],['license_term'=>'lifetime'],['lease_until'=>$now+86401],['entitlements'=>['module'=>'content']]]as $change){$bad=Crypto::sign(array_replace($claims,$change),$private,$public);rejects(fn()=>Crypto::verify($bad,$public,$installation,'example.ru','content',$now),'reject invalid signed fields');}
check(Policy::access($claims,$now)['can_update'],'active updates');
check(Policy::access($claims,$now+86401)['state']==='grace','offline grace');
check(!Policy::access($claims,$now+604801)['can_update'],'offline lease ends');
check(Policy::access(array_replace($claims,['updates_until'=>$now-1]),$now)['state']==='expired','annual expires');
check(Policy::access(array_replace($claims,['license_term'=>'lifetime','updates_until'=>null]),$now)['can_update'],'lifetime active');
check(!Policy::access(array_replace($claims,['status'=>'suspended']),$now)['can_update'],'suspended denies update');
foreach(['active','expired','suspended','invalid']as $state)check(Policy::access(array_replace($claims,['status'=>$state]),$now)['public_site_available'],'public site never disabled');
$cipher=Crypto::encrypt('BYP-test-secret','app-test-secret');
check(Crypto::decrypt($cipher,'app-test-secret')==='BYP-test-secret','encrypted key roundtrip');
check(!str_contains($cipher,'BYP-test-secret'),'cipher contains no plaintext');
rejects(fn()=>Crypto::decrypt($cipher,'wrong'),'reject incorrect encryption key');
rejects(fn()=>(new LicenseHttp())->request('http://127.0.0.1/'),'production forbids http');
rejects(fn()=>(new LicenseHttp())->request('https://127.0.0.1/'),'production forbids private network');
rejects(fn()=>(new LicenseHttp(true,['qa.example.test'=>'10.0.0.1']))->request('http://qa.example.test/'),'test override loopback only');
echo "$checks license policy/crypto/transport checks passed\n";
