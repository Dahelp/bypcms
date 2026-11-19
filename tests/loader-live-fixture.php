<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/UpdatePackage.php';require_once __DIR__.'/../server/_core/UpdateRuntime.php';
use BYPCMS\Core\{UpdateRuntime,UpdatePackage};
$qa=realpath($argv[1]??'');$edition=$argv[2]??'';$mode=$argv[3]??'';$report=realpath($argv[4]??'');
if($qa!==realpath(__DIR__.'/../outputs/final-acceptance-live-20261118')||!in_array($edition,['content','business','commerce'],true)||!$report||!str_starts_with(str_replace('\\','/',$report),str_replace('\\','/',realpath(__DIR__.'/../outputs')).'/'))throw new RuntimeException('Explicit isolated QA roots required');
$root=$qa.'/clients/'.$edition.'/site';$c=require $root.'/_storage/config.php';
if($c['database']['host']!=='127.0.0.1'||$c['database']['port']!==3319||$c['database']['name']!=='bypcms_final_20261118_live_'.$edition||empty($c['app']['debug'])||$c['app']['installation_type']!=='client')throw new RuntimeException('Exact loopback fixture required');
$base=UpdateRuntime::storage($root,true).'/updates';$trustFile=$root.'/_core/license-trust.json';$saved=$report.'/trust-'.$edition.'.json';
if($mode==='fault'){$trust=json_decode(file_get_contents($trustFile),true);if($trust['issuer']!=='https://bypcms.ru/api/index.php')throw new RuntimeException('Original production issuer required');if(!is_file($saved))copy($trustFile,$saved);$trust['issuer']='http://127.0.0.1:8160/api/index.php';file_put_contents($trustFile,json_encode($trust));echo "Local corrupt-download fault enabled\n";exit;}
if($mode==='restore'){if(!is_file($saved))throw new RuntimeException('Trust backup required');copy($saved,$trustFile);exit;}
if($mode==='snapshot'){echo json_encode(['current'=>UpdateRuntime::pointer($root),'jobs'=>count(glob($base.'/jobs/*.json')?:[]),'backups'=>count(glob($base.'/backups/*/manifest.json')?:[]),'maintenance'=>is_file($base.'/maintenance.json'),'loader'=>hash_file('sha256',$root.'/_core/LicenseHttp.php'),'endpoint'=>hash_file('sha256',$root.'/updates/index.php')]);exit;}
if($mode==='verify'){
 $id=$argv[5]??'';if(!preg_match('/^[a-f0-9]{32}$/D',$id))throw new RuntimeException('Explicit job required');
 $trust=json_decode(file_get_contents($trustFile),true);if($trust['issuer']!=='https://bypcms.ru/api/index.php')throw new RuntimeException('Production trust must be restored');
 $package=$base.'/work/'.$id.'/package.zip';$m=UpdatePackage::inspect($package,$trust['public_key']);
 if($m['version']!=='2.7.2'||hash_file('sha256',$package)!=='dfdb22c1464c8b6d8d3a955b6cfeb778108cb45e74680cd1e804a34f9587896b'||filesize($package)!==18830706)throw new RuntimeException('Exact original production 2.7.2 package required');
 $manifest=UpdateRuntime::json($base.'/backups/'.$id.'/manifest.json');$pdo=new PDO('mysql:host=127.0.0.1;port=3319;dbname='.$c['database']['name'].';charset=utf8mb4',$c['database']['username'],$c['database']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$customerFiles=0;
 foreach($manifest['files']as $f)if(hash_file('sha256',$base.'/backups/'.$id.'/files/'.$f['path'])!==$f['sha256'])throw new RuntimeException('Backup file checksum mismatch');
 foreach($manifest['tables']as $i=>$table){
  $file=$base.'/backups/'.$id.'/db/'.$i.'.json.gz';if(hash_file('sha256',$file)!==$table['sha256'])throw new RuntimeException('Database backup checksum mismatch');$stream=gzopen($file,'rb');$header=json_decode(gzgets($stream),true);if($header['name']!==$table['name']||!str_starts_with($header['ddl'],'CREATE TABLE')||!preg_match('/^byp_[a-z0-9_]+$/D',$table['name']))throw new RuntimeException('Database DDL missing');
  $saved=[];while(($line=gzgets($stream))!==false)$saved[]=json_decode($line,true,64,JSON_THROW_ON_ERROR);gzclose($stream);if(count($saved)!==$table['rows'])throw new RuntimeException('Backup row count mismatch');
  $ddl=$pdo->query('SHOW CREATE TABLE `'.$table['name'].'`')->fetch(PDO::FETCH_NUM)[1];$normalizeDdl=static fn($s)=>preg_replace('/AUTO_INCREMENT=\d+ /','',$s);if($normalizeDdl($ddl)!==$normalizeDdl($header['ddl']))throw new RuntimeException('Live schema differs from backup: '.$table['name']);
  foreach($header['columns']as $column)if(!preg_match('/^[a-zA-Z0-9_]+$/D',$column))throw new RuntimeException('Unsupported column');
  $current=$pdo->query('SELECT `'.implode('`,`',$header['columns']).'` FROM `'.$table['name'].'`')->fetchAll(PDO::FETCH_NUM);$current=array_map(static fn($row)=>array_map(static fn($v)=>$v===null?null:base64_encode((string)$v),$row),$current);
  // A browser sign-in updates only these user metadata fields and appends auth.login audit entries.
  if($table['name']==='byp_users')foreach(['last_login_at','last_login_ip']as $column){$index=array_search($column,$header['columns'],true);if($index!==false){foreach($saved as &$row)unset($row[$index]);unset($row);foreach($current as &$row)unset($row[$index]);unset($row);}}
  $encode=static fn($rows)=>array_count_values(array_map(static fn($row)=>json_encode($row,JSON_THROW_ON_ERROR),$rows));$oldCounts=$encode($saved);$newCounts=$encode($current);
  if($table['name']==='byp_audit_logs'){
   foreach($oldCounts as $row=>$count)if(($newCounts[$row]??0)<$count)throw new RuntimeException('Original audit row lost');
   $action=array_search('action',$header['columns'],true);foreach($newCounts as $row=>$count)if($count>($oldCounts[$row]??0)&&($action===false||base64_decode(json_decode($row,true)[$action],true)!=='auth.login'))throw new RuntimeException('Unexpected post-backup audit mutation');
  }else{ksort($oldCounts);ksort($newCounts);if($oldCounts!==$newCounts)throw new RuntimeException('Live data differs from backup: '.$table['name']);}
 }
 foreach($manifest['files']as $f)if($f['path']==='_storage/config.php'||preg_match('#^(uploads|project|themes/custom)/#',$f['path'])){if(!is_file($root.'/'.$f['path'])||hash_file('sha256',$root.'/'.$f['path'])!==$f['sha256'])throw new RuntimeException('Customer file changed: '.$f['path']);$customerFiles++;}
 echo json_encode(['edition'=>$edition,'version'=>'2.7.2','sha256'=>hash_file('sha256',$package),'bytes'=>filesize($package),'signatureVerified'=>true,'files'=>count($m['files']),'backupFiles'=>count($manifest['files']),'backupTables'=>count($manifest['tables']),'backupHashesAndDdlVerified'=>true,'allTableDataPreserved'=>true,'loginMetadataExcluded'=>true,'existingAuditRowsPreserved'=>true,'customerFilesVerified'=>$customerFiles]);exit;
}
throw new RuntimeException('Unsupported test-only action');
