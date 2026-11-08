<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/UpdatePackage.php';
require_once __DIR__.'/../server/_core/UpdateRuntime.php';
use BYPCMS\Core\UpdatePackage as Package;
$checks=0;function check(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function rejects(callable $callback,string $message):void{try{$callback();}catch(Throwable $error){check(true,$message);return;}throw new RuntimeException($message);}
foreach(['_core/bootstrap.php','_core/LicenseClient.php','api/app.php','admin/index.html','_next/static/a.js','_next/static/a.css','themes/chronicle/assets/manrope.woff2','_next/static/chronicle/chronicle.css','themes/gallery/assets/manrope.woff2','_next/static/gallery/assets/cormorant.woff2']as $path)check(Package::path($path),'supported managed path');
foreach(['../config.php','files/../config.php','/absolute','_core/../config.php','_core/UpdateRuntime.php','_core/UpdateEngine.php','api/index.php','updates/index.php','_storage/config.php','uploads/a.jpg','project/a.php','themes/custom/page.html','_core/license-trust.json','_next/static/a.php','_next/static\\a.js']as $path)check(!Package::path($path),'protected or traversing path rejected');
$files=['api/app.php'=>'<?php echo "OK";','_core/bootstrap.php'=>'<?php','_core/client-front.php'=>'<?php','admin/index.html'=>'<!doctype html><title>Test</title>'];
$m=['schema'=>'bypcms.release/v1','version'=>'2.1.1','from'=>['2.1.0'],'editions'=>['content'],'modules'=>['content'],'php_min'=>'8.2.0','migrations'=>[],'files'=>[]];
foreach($files as $path=>$content)$m['files'][$path]=['size'=>strlen($content),'sha256'=>hash('sha256',$content)];Package::manifest($m);check(true,'complete manifest accepted');
foreach([['version'=>'bad'],['from'=>['2.1.1']],['editions'=>['unknown']],['modules'=>['../private']],['php_min'=>'bad'],['files'=>[]],['migrations'=>[['id'=>'bad','sql'=>['DROP TABLE byp_users']]]],['migrations'=>[['id'=>'bad','sql'=>['UPDATE byp_pages SET title="a"; DELETE FROM byp_users']]]]]as $change)rejects(fn()=>Package::manifest(array_replace($m,$change)),'unsafe manifest rejected');
$withDdl=$m;$withDdl['migrations']=[['id'=>'test_ddl','sql'=>['ALTER TABLE byp_pages ADD COLUMN test INT NULL']]];Package::manifest($withDdl);check(true,'single trusted namespace migration accepted');
$key=openssl_pkey_new(['private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);openssl_pkey_export($key,$private);$public=openssl_pkey_get_details($key)['key'];$signature=Package::sign($m,$private,$public);
check(Package::verify($signature,$public)===$m,'update signature roundtrip');$bad=$signature;$bad['payload'][4]=$bad['payload'][4]==='A'?'B':'A';rejects(fn()=>Package::verify($bad,$public),'tampered payload rejected');$bad=$signature;$bad['signature'][0]=$bad['signature'][0]==='A'?'B':'A';rejects(fn()=>Package::verify($bad,$public),'tampered signature rejected');
$other=openssl_pkey_new(['private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);rejects(fn()=>Package::verify($signature,openssl_pkey_get_details($other)['key']),'different authority rejected');
$zipFile=sys_get_temp_dir().'/bypcms-update-'.bin2hex(random_bytes(8)).'.zip';
try{
    $zip=new ZipArchive();$zip->open($zipFile,ZipArchive::CREATE);foreach($files as $path=>$content)$zip->addFromString('files/'.$path,$content);$zip->addFromString('manifest.json',json_encode($m));$zip->addFromString('signature.json',json_encode($signature));$zip->close();
    check(Package::inspect($zipFile,$public)===$m,'signed real zip accepted');
    $zip->open($zipFile);$zip->addFromString('files/../../outside.php','unsafe');$zip->close();rejects(fn()=>Package::inspect($zipFile,$public),'zip traversal rejected');$zip->open($zipFile);$zip->deleteName('files/../../outside.php');$zip->addFromString('files/api/app.php','changed');$zip->close();rejects(fn()=>Package::inspect($zipFile,$public),'changed payload file rejected');
    $zip->open($zipFile);$zip->addFromString('files/api/app.php',$files['api/app.php']);$zip->setExternalAttributesName('files/api/app.php',ZipArchive::OPSYS_UNIX,0120777<<16);$zip->close();rejects(fn()=>Package::inspect($zipFile,$public),'zip symbolic link rejected');
    $guarded=$zipFile.'.php';$payload=$zipFile.'.payload';file_put_contents($guarded,Package::GUARD.file_get_contents($zipFile));Package::payload($guarded,$payload);check(hash_file('sha256',$payload)===hash_file('sha256',$zipFile),'protected PHP candidate preserves exact ZIP payload');token_get_all((string)file_get_contents($guarded),TOKEN_PARSE);check(true,'PHP guard halts parsing before binary payload');
}finally{foreach([$zipFile,$guarded??'',$payload??'']as $file)if($file!==''&&is_file($file))unlink($file);}
echo "$checks update signature/package/path/migration checks passed\n";
$root=sys_get_temp_dir().'/bypcms-private-test-'.bin2hex(random_bytes(6));mkdir($root);mkdir($root.'/_storage');$oldWeb=$_SERVER['DOCUMENT_ROOT']??null;$_SERVER['DOCUMENT_ROOT']=$root;
try{
    file_put_contents($root.'/_storage/config.php','<?php return '.var_export(['app'=>['key'=>'qa-only'],'updates'=>['private_dir'=>$root.'/unsafe']],true).';');
    rejects(fn()=>\BYPCMS\Core\UpdateRuntime::storage($root,true),'storage inside DocumentRoot rejected');
    file_put_contents($root.'/_storage/config.php','<?php return '.var_export(['app'=>['key'=>'qa-only'],'updates'=>['private_dir'=>dirname($root).'/safe-qa-location']],true).';');
    check(\BYPCMS\Core\UpdateRuntime::storage($root)===dirname($root).'/safe-qa-location','external storage accepted without creating it');
}finally{if(is_dir($root.'/unsafe'))rmdir($root.'/unsafe');unlink($root.'/_storage/config.php');rmdir($root.'/_storage');rmdir($root);if($oldWeb===null)unset($_SERVER['DOCUMENT_ROOT']);else $_SERVER['DOCUMENT_ROOT']=$oldWeb;}
echo "$checks total update package/privacy checks passed\n";
