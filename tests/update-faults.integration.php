<?php
declare(strict_types=1);
// Faults exist only in this CLI test, never in production routes/configuration.
require_once __DIR__.'/../server/_core/UpdateEngine.php';require_once __DIR__.'/../server/_core/UpdatePublisher.php';require_once __DIR__.'/../server/_core/Database.php';
use BYPCMS\Core\{UpdateEngine,UpdatePublisher,LicenseAuthority,UpdateRuntime,Database};
$qa=realpath($argv[1]??'');if(!$qa)throw new RuntimeException('QA directory required');$platform=$qa.'/site';$client=$qa.'/packages/content/site';$config=require $client.'/_storage/config.php';$pc=require $platform.'/_storage/config.php';
if(($config['database']['port']??0)!==3319||($pc['app']['url']??'')!=='http://127.0.0.1:8019')throw new RuntimeException('Only disposable loopback fixture allowed');
$db=new Database($config);$pdo=$db->pdo();$mode=$argv[2]??'';$case=$qa.'/update-fault-case.json';
function fingerprint(PDO $pdo):string{$all=[];foreach($pdo->query('SHOW FULL TABLES')->fetchAll(PDO::FETCH_NUM)as[$table,$type]){if($type!=='BASE TABLE')continue;$id='`'.str_replace('`','``',$table).'`';$ddl=$pdo->query('SHOW CREATE TABLE '.$id)->fetch(PDO::FETCH_NUM)[1];$all[$table]=[$ddl,$pdo->query('SELECT * FROM '.$id)->fetchAll(PDO::FETCH_ASSOC)];}ksort($all);return hash('sha256',serialize($all));}
if($mode==='seed'){$pdo->exec('CREATE TABLE IF NOT EXISTS qa_update_blob (id INT PRIMARY KEY,payload LONGBLOB,description LONGTEXT,total INT GENERATED ALWAYS AS (id+1) STORED,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');if(!$pdo->query('SELECT COUNT(*) FROM qa_update_blob')->fetchColumn())$pdo->prepare('INSERT INTO qa_update_blob(id,payload,description) VALUES(?,?,?)')->execute([7,random_bytes(4096),str_repeat('Проверка восстановления 🟢',1800)]);echo "Binary/generated-column fixture ready\n";exit;}
if(in_array($mode,['deny','allow'],true)){
    $issued=UpdateRuntime::json($qa.'/license-result.json');$pdb=new Database($pc);$row=$pdb->one('SELECT id,status,license_key_hash FROM byp_license_registry WHERE id=?',[$issued['license_id']]);if(!$row||$row['license_key_hash']!==hash('sha256',$issued['key']))throw new RuntimeException('Unexpected fixture license');
    if($mode==='deny'){UpdateRuntime::atomic($case.'.license',['id'=>$row['id'],'status'=>$row['status']]);$pdb->execute('UPDATE byp_license_registry SET status="suspended" WHERE id=?',[$row['id']]);$clientLicense=new \BYPCMS\Core\LicenseClient($client,$config);try{$clientLicense->refresh();}catch(Throwable $error){}if($clientLicense->status()['can_update'])throw new RuntimeException('Suspended license still grants update');
        $engine=new UpdateEngine($client,$pdo,$config);$catalog=$engine->status()['releases'];$owner=$db->one('SELECT id,email,password_hash FROM byp_users WHERE email=?',['owner@content.example.test']);$owner['role']='owner';$operation=bin2hex(random_bytes(16));$denied=false;try{$engine->begin($catalog[0]['id'],$operation,$owner);}catch(RuntimeException $error){$denied=str_contains($error->getMessage(),'действующая подтверждённая лицензия');}if(!$denied||$engine->job($operation))throw new RuntimeException('Suspended license started an update');echo "Fixture license suspended; new update denied before journal creation\n";}
    else{$saved=UpdateRuntime::json($case.'.license');$pdb->execute('UPDATE byp_license_registry SET status=? WHERE id=?',[$saved['status'],$saved['id']]);(new \BYPCMS\Core\LicenseClient($client,$config))->refresh();echo "Fixture license restored\n";}exit;
}
if($mode==='preflight'){
    $engine=new UpdateEngine($client,$pdo,$config);$status=$engine->check();$release=null;foreach($status['releases']as $candidate)if($candidate['compatible']){$release=$candidate;break;}if(!$release)throw new RuntimeException('Need compatible fixture release');
    $owner=$db->one('SELECT id,email,password_hash FROM byp_users WHERE email=?',['owner@content.example.test']);$owner['role']='owner';$file=$client.'/qa_unmanaged.php';if(is_file($file))throw new RuntimeException('Fixture already exists');$before=fingerprint($pdo);file_put_contents($file,'<?php echo "unmanaged";');
    try{$job=$engine->begin($release['id'],bin2hex(random_bytes(16)),$owner);for($i=0;$i<10;$i++){$job=$engine->step($job['id']);if($job['state']==='failed')break;}if($job['state']!=='failed'||$job['backup_ready']||is_file($client.'/_storage/updates/maintenance.json')||fingerprint($pdo)!==$before)throw new RuntimeException('Unsafe preflight failure');echo "Unmanaged public PHP rejected without database changes\n";}finally{unlink($file);}exit;
}
if($mode==='verify'){$state=UpdateRuntime::json($case);if(fingerprint($pdo)!==$state['before'])throw new RuntimeException('Database differs from pre-update snapshot');foreach($state['files']as $file=>$hash)if(hash_file('sha256',$client.'/'.$file)!==$hash)throw new RuntimeException('User file changed');echo "Database schema, all rows, binary data, generated columns and user files restored\n";exit;}
if($mode==='corrupt'){$state=UpdateRuntime::json($case);$path=$client.'/_storage/updates/backups/'.$state['id'].'/db/0.json.gz';copy($path,$case.'.original');file_put_contents($path,'broken',FILE_APPEND);echo "Disposable backup deliberately corrupted\n";exit;}
if($mode==='repair'){$state=UpdateRuntime::json($case);copy($case.'.original',$client.'/_storage/updates/backups/'.$state['id'].'/db/0.json.gz');echo "Disposable backup restored\n";exit;}
if(!in_array($mode,['migration-fail','health-fail','crash-users','migration-ok','role-fail','asset-fail'],true))throw new RuntimeException('Unknown test mode');
$number=['migration-fail'=>2,'health-fail'=>3,'crash-users'=>4,'migration-ok'=>5,'role-fail'=>6,'asset-fail'=>7][$mode];$temp=$qa.'/fault-candidate.zip';copy($platform.'/_private/update-candidate.zip',$temp);$zip=new ZipArchive();$zip->open($temp);$manifest=json_decode($zip->getFromName('manifest.json'),true,64,JSON_THROW_ON_ERROR);$manifest['version']='2.'.$number.'.'.time();
$sql=['ALTER TABLE byp_pages ADD COLUMN qa_update_added VARCHAR(40) NULL','UPDATE byp_pages SET title="Changed by update test" WHERE id=1','CREATE TABLE byp_update_created (id INT PRIMARY KEY) ENGINE=InnoDB'];
if($mode==='migration-fail')$sql[]='ALTER TABLE byp_absent_update_table ADD COLUMN broken INT';
if($mode==='role-fail')$sql[]='UPDATE byp_roles SET slug="qa_changed_role" WHERE slug="owner"';
if($mode==='crash-users')$sql[]='DROP TABLE byp_users';
if($mode==='crash-users'){
    // Test abrupt interruption after destructive DDL without exposing a production fault endpoint.
    $sql=['ALTER TABLE byp_users RENAME TO byp_users_interrupted'];
}
$manifest['migrations']=[['id'=>'qa_'.$mode,'sql'=>$sql]];
if($mode==='health-fail'){$broken='<?php http_response_code(500); echo "QA runtime failure";';$zip->addFromString('files/api/app.php',$broken);$manifest['files']['api/app.php']=['size'=>strlen($broken),'sha256'=>hash('sha256',$broken)];}
if($mode==='asset-fail'){$html=$zip->getFromName('files/admin/index.html');$broken=str_replace('.js"','-absent.js"',$html);if($html===$broken)throw new RuntimeException('No script to break');$zip->addFromString('files/admin/index.html',$broken);$manifest['files']['admin/index.html']=['size'=>strlen($broken),'sha256'=>hash('sha256',$broken)];}
$zip->addFromString('manifest.json',json_encode($manifest,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES));$zip->close();
$pdb=new Database($pc);$publisher=new UpdatePublisher($platform,new LicenseAuthority($pdb->pdo(),$platform.'/_storage',$pc));$release=$publisher->publish($temp);
$owner=$db->one('SELECT id,email,password_hash FROM byp_users WHERE email=?',['owner@content.example.test']);$owner['role']='owner';$operation=bin2hex(random_bytes(16));
$engine=new UpdateEngine($client,$pdo,$config,$mode==='crash-users'?static function($phase){if($phase==='after_migration')exit(77);}:null);$engine->check();
$before=['id'=>$operation,'before'=>fingerprint($pdo),'mode'=>$mode,'files'=>[]];foreach(['uploads/qa-preserve.txt','project/qa-preserve.txt','_storage/config.php']as $file)$before['files'][$file]=hash_file('sha256',$client.'/'.$file);UpdateRuntime::atomic($case,$before);
$job=$engine->begin($release['id'],$operation,$owner);
for($i=0;$i<400;$i++){$job=$engine->step($operation);if($job['state']==='restoring')break;if($mode==='migration-ok'&&$job['state']==='completed'){if(!$pdo->query('SHOW COLUMNS FROM byp_pages LIKE "qa_update_added"')->fetch()||$pdo->query('SELECT title FROM byp_pages WHERE id=1')->fetchColumn()!=='Changed by update test')throw new RuntimeException('Migration did not persist');echo "Successful migration and runtime verified\n";exit;}if(in_array($job['state'],['failed','recovery_required','completed'],true))throw new RuntimeException(json_encode($job));}
if($mode==='crash-users')throw new RuntimeException('Crash checkpoint was not reached');
echo "Failure detected; durable automatic rollback prepared\n";
