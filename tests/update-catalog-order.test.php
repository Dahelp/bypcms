<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/UpdatePublisher.php';
require_once __DIR__.'/../server/_core/ReleaseDiscovery.php';
use BYPCMS\Core\{UpdatePublisher,UpdateRuntime,UpdatePackage,LicenseAuthority,ReleaseDiscovery};
final class CatalogOrderPDO extends PDO {public function __construct(){}}
$directory=dirname(__DIR__).'/outputs/catalog-order-'.bin2hex(random_bytes(6));$root=$directory.'/site';mkdir($root.'/_storage',0750,true);
$config=['app'=>['installation_type'=>'platform','key'=>str_repeat('a',64),'url'=>'https://issuer.example.test'],'updates'=>['private_dir'=>$directory.'/private']];
file_put_contents($root.'/_storage/config.php','<?php return '.var_export($config,true).';');
$checks=0;function verify(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
try{
 $authority=new LicenseAuthority(new CatalogOrderPDO(),$root.'/_storage',$config);$publisher=new UpdatePublisher($root,$authority);$feed=UpdateRuntime::storage($root,true).'/feed';
 verify($publisher->catalog()['releases']===[],'empty catalogue stays empty');
 $rows=[];$hashes=[];
 foreach(['2.7.2','2.8.0','2.8.9','2.8.1','2.8.10']as $version){
  $id=hash('sha256',$version);$rows[]=['id'=>$id,'sha256'=>$id,'bytes'=>10,'version'=>$version,'from'=>['2.7.1'],'editions'=>['business'],'modules'=>['content'],'php_min'=>'8.2.0','notes'=>['Notes '.$version]];
  file_put_contents($feed.'/'.$id.'.zip','IMMUTABLE '.$version);$hashes[$id]=hash_file('sha256',$feed.'/'.$id.'.zip');
 }
 $stored=['schema'=>'bypcms.catalog/v1','issued_at'=>1700000000,'releases'=>$rows];UpdateRuntime::atomic($feed.'/catalog.json',$stored);$storedHash=hash_file('sha256',$feed.'/catalog.json');
 $expected=['2.8.10','2.8.9','2.8.1','2.8.0','2.7.2'];$ordered=$publisher->catalog();
 verify(array_column($ordered['releases'],'version')===$expected,'versions sort numerically newest first');
 verify(array_column($publisher->catalog()['releases'],'version')===$expected,'repeated reads keep order');
 verify(hash_file('sha256',$feed.'/catalog.json')===$storedHash,'reading does not rewrite publication history');
 foreach($rows as $row){$actual=array_values(array_filter($ordered['releases'],fn($r)=>$r['id']===$row['id']))[0];verify($actual===$row,'all release metadata preserved');verify(hash_file('sha256',$feed.'/'.$row['id'].'.zip')===$hashes[$row['id']],'published package bytes preserved');}
 $signed=$publisher->publicCatalog();$trust=$authority->trust();$public=UpdatePackage::verify($signed,$trust['public_key']);
 verify(array_column($public['releases'],'version')===$expected,'signed public catalogue carries newest first');
 verify(hash_file('sha256',$feed.'/catalog.json')===$storedHash,'signing public view leaves stored history untouched');
 $clientConfig=$config;$clientConfig['app']+=['version'=>'2.7.1','edition'=>'business','modules'=>['content']];$clientConfig['app']['installation_type']='client';$clientRoot=$directory.'/client';mkdir($clientRoot.'/_storage',0750,true);$clientConfig['updates']['private_dir']=$directory.'/client-private';file_put_contents($clientRoot.'/_storage/config.php','<?php return '.var_export($clientConfig,true).';');
 $clientBase=UpdateRuntime::storage($clientRoot,true).'/updates';mkdir($clientBase,0750,true);UpdateRuntime::atomic($clientBase.'/catalog.json',$public);
 $client=new ReleaseDiscovery($clientRoot,new CatalogOrderPDO(),$clientConfig);$status=$client->status();
 verify(array_column($status['releases'],'version')===$expected&&$status['releases'][0]['compatible'],'existing client receives active newest release first');
 verify(!is_dir($clientBase.'/jobs')&&!is_file($clientBase.'/maintenance.json'),'catalogue refresh starts no installation or backup');
}finally{
 $resolved=realpath($directory);$parent=realpath(dirname(__DIR__).'/outputs');
 if(!$resolved||realpath(dirname($resolved))!==$parent||!str_starts_with(basename($resolved),'catalog-order-'))throw new RuntimeException('Unexpected cleanup directory');
 foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($resolved,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST)as $file){if($file->isDir())rmdir($file->getPathname());else unlink($file->getPathname());}rmdir($resolved);
}
echo $checks." catalogue order/signature/immutability/client checks passed\n";
