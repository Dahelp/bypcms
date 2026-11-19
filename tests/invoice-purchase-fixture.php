<?php
declare(strict_types=1);
// CLI-only inspection and fault injection for a deliberately disposable purchase platform.
$qa=realpath($argv[1]??'');$mode=$argv[2]??'';$edition=$argv[3]??'';
if(!$qa||dirname($qa)!==realpath(__DIR__.'/../outputs')||!str_starts_with(basename($qa),'purchase-acceptance-')||!in_array($edition,['content','business','commerce'],true))throw new RuntimeException('Explicit disposable purchase fixture required');
$root=$qa.'/site';$config=require $root.'/_storage/config.php';
if(($config['database']['host']??'')!=='127.0.0.1'||($config['database']['port']??0)!==3319||!str_starts_with($config['database']['name'],'bypcms_purchase_')||($config['app']['url']??'')!=='http://127.0.0.1:8019'||empty($config['app']['debug']))throw new RuntimeException('Loopback synthetic database only');
require_once __DIR__.'/../server/_core/Database.php';$db=new BYPCMS\Core\Database($config);
$state=is_file($qa.'/journey-private.json')?json_decode((string)file_get_contents($qa.'/journey-private.json'),true,64,JSON_THROW_ON_ERROR):[];$entries=array_values(array_filter($state,fn($s)=>$s['edition']===$edition));$order=$entries[0]??null;
if($mode==='authority'){require_once __DIR__.'/../server/_core/LicenseAuthority.php';(new BYPCMS\Core\LicenseAuthority($db->pdo(),$root.'/_storage',$config))->trust();echo json_encode(['syntheticAuthorityReady'=>true]).PHP_EOL;exit;}
if($mode==='extract'){
 $zip=new ZipArchive();if($zip->open($qa.'/'.$edition.'.zip')!==true)throw new RuntimeException('Downloaded ZIP missing');$manifest=json_decode((string)$zip->getFromName('site/build-manifest.json'),true,64,JSON_THROW_ON_ERROR);if($manifest['edition']!==$edition||$manifest['core_version']!=='2.7.2'||!empty($manifest['test_purchase']))throw new RuntimeException('Wrong purchase package');
 $secrets=[$config['app']['key']];foreach($state as $s)if(!empty($s['key']))$secrets[]=$s['key'];
 for($i=0;$i<$zip->numFiles;$i++){$path=$zip->getNameIndex($i);if(str_contains($path,'..')||str_contains($path,'\\')||str_starts_with($path,'/')||preg_match('#^site/(?:_storage|_private|_releases|owner|account|commerce)/#',$path))throw new RuntimeException('Unsafe/private ZIP entry');$body=$zip->getFromIndex($i);if($body===false)throw new RuntimeException('Corrupt ZIP entry');foreach($secrets as $secret)if(str_contains($body,$secret))throw new RuntimeException('Secret included in buyer archive');}
 $target=$qa.'/clients/'.$edition;if(is_file($target.'/site/_storage/config.php'))throw new RuntimeException('Refusing to replace an installed client');if(!$zip->extractTo($target))throw new RuntimeException('ZIP extraction failed');$files=$zip->numFiles;$zip->close();echo json_encode(['edition'=>$edition,'files'=>$files,'manifest'=>$manifest,'privateFilesExcluded'=>true]).PHP_EOL;exit;
}
if($mode==='client-config'){
 $client=$qa.'/clients/'.$edition.'/site';$c=require $client.'/_storage/config.php';if(($c['database']['port']??0)!==3319||$c['database']['name']!=='bypcms_purchase_20261118_'.$edition||($c['app']['installation_type']??'')!=='client')throw new RuntimeException('Only newly installed local client');$port=['content'=>8121,'business'=>8122,'commerce'=>8123][$edition];$c['app']['debug']=true;$c['app']['url']='http://purchase-'.$edition.'.example.test:'.$port;$c['licensing']['test_hosts']=$config['licensing']['test_hosts'];$c['updates']['private_dir']=$qa.'/private/'.$edition;file_put_contents($client.'/_storage/config.php','<?php return '.var_export($c,true).';');echo json_encode(['edition'=>$edition,'fixtureTransportConfigured'=>true]).PHP_EOL;exit;
}
if(!$order||!is_int($order['id'])||$order['id']<1)throw new RuntimeException('Own QA order required');
$row=$db->one('SELECT * FROM byp_customer_orders WHERE id=?',[$order['id']]);if(!$row||$row['edition']!==$edition||!str_starts_with($row['domain'],'purchase-')&&$row['domain']!=='invalid domain')throw new RuntimeException('Unexpected QA order');
if($mode==='fault-domain'||$mode==='repair-domain'){$db->execute('UPDATE byp_customer_orders SET domain=? WHERE id=?',[$mode==='fault-domain'?'invalid domain':'purchase-'.$edition.'.example.test',$order['id']]);echo json_encode(['edition'=>$edition,'localFault'=>$mode]).PHP_EOL;exit;}
if($mode==='inspect'){
 $licence=$db->one('SELECT l.id,l.status,l.edition,l.domain,l.entitlements,l.license_key_hash FROM byp_license_registry l JOIN byp_license_order_links k ON k.license_id=l.id WHERE k.order_id=?',[$order['id']]);$keyMatches=$licence&&!empty($order['key'])?hash_equals($licence['license_key_hash'],hash('sha256',$order['key'])):null;if($licence)unset($licence['license_key_hash']);
 echo json_encode(['payments'=>(int)$db->one('SELECT COUNT(*) n FROM byp_commerce_manual_payments WHERE order_id=?',[$order['id']])['n'],'deliveries'=>(int)$db->one('SELECT COUNT(*) n FROM byp_customer_deliveries WHERE order_id=?',[$order['id']])['n'],'licences'=>(int)$db->one('SELECT COUNT(*) n FROM byp_license_order_links WHERE order_id=?',[$order['id']])['n'],'licence'=>$licence,'purchaseKeyMatchesRegistry'=>$keyMatches,'activations'=>$licence?(int)$db->one('SELECT COUNT(*) n FROM byp_license_activations WHERE license_id=? AND active=1',[$licence['id']])['n']:0]).PHP_EOL;exit;
}
throw new RuntimeException('Explicit fixture action required');
