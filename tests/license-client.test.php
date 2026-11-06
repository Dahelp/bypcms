<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/LicenseClient.php';
use BYPCMS\Core\LicenseClient;
use BYPCMS\Core\LicenseCrypto;
$root=sys_get_temp_dir().'/bypcms-license-test-'.bin2hex(random_bytes(8));mkdir($root);mkdir($root.'/_core');mkdir($root.'/_storage');
$checks=0;
function check(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
try {
    $now=time();$id=str_repeat('a',32);$config=['app'=>['key'=>'test-app-secret','url'=>'https://www.example.ru','edition'=>'content','modules'=>['content'],'installation_id'=>$id]];
    $client=new LicenseClient($root,$config);
    check($client->status()['state']==='unactivated','unsigned trial does not count as activated');
    $key=openssl_pkey_new(['private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);openssl_pkey_export($key,$private);$public=openssl_pkey_get_details($key)['key'];
    file_put_contents($root.'/_core/license-trust.json',json_encode(['schema'=>'bypcms.license-trust/v1','issuer'=>'https://issuer.example.ru/api/index.php','key_id'=>hash('sha256',$public),'public_key'=>$public]));
    $claims=['license_id'=>1,'activation_id'=>2,'installation_id'=>$id,'generation'=>str_repeat('b',32),'domain'=>'example.ru','edition'=>'content','license_term'=>'annual','status'=>'active','entitlements'=>['content'],'updates_until'=>$now+10000000,'issued_at'=>$now,'lease_until'=>$now+86400,'offline_until'=>$now+604800];
    $receipt=LicenseCrypto::sign($claims,$private,$public);$state=['receipt'=>$receipt,'checked_at'=>$now,'error'=>'Temporary network failure'];
    $save=fn($value)=>file_put_contents($root.'/_storage/license-state.json',json_encode($value));$save($state);
    check($client->status($now)['can_update'],'valid receipt grants updates');
    check($client->status($now+86401)['state']==='grace','cached signed receipt supports offline grace');
    check(!$client->status($now+604801)['can_update'],'offline grace has bounded duration');
    check($client->status($now)['error']==='Temporary network failure','transport error stays visible');
    $save($state+['blocked'=>'activation_revoked']);check(!$client->status()['can_update'],'authoritative revocation overrides cached receipt');
    $bad=$receipt;$bad['signature'][0]=$bad['signature'][0]==='a'?'b':'a';$save(['receipt'=>$bad]);
    check($client->status()['state']==='invalid'&&!$client->status()['can_update'],'tampered receipt never grants updates');
    $claims['entitlements']=[];$save(['receipt'=>LicenseCrypto::sign($claims,$private,$public)]);check($client->status()['state']==='invalid','missing package module rejects receipt');
    file_put_contents($root.'/_storage/license-state.json','{broken');check($client->status()['state']==='invalid','corrupt cache is explicit');
    check($client->status()['public_site_available'],'corrupt cache never disables public site');
    echo "$checks license client cache checks passed\n";
} finally {
    foreach(['/_core/license-trust.json','/_storage/license-state.json']as $file)if(is_file($root.$file))unlink($root.$file);
    rmdir($root.'/_core');rmdir($root.'/_storage');rmdir($root);
}
