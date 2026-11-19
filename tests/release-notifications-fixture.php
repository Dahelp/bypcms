<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/Database.php';require_once __DIR__.'/../server/_core/CommerceOrders.php';require_once __DIR__.'/../server/_core/UpdatePackage.php';
use BYPCMS\Core\{Database,CommerceOrders,UpdatePackage,UpdateRuntime};
$qa=realpath($argv[1]??'');if(!$qa)throw new RuntimeException('Explicit fixture required');$targets=json_decode(file_get_contents($qa.'/targets.json'),true);$root=$targets['platform']['root'];$config=require $root.'/_storage/config.php';
if($config['database']['host']!=='127.0.0.1'||$config['database']['port']!==3319||!str_starts_with($config['database']['name'],'bypcms_purchase_')||empty($config['app']['debug'])||$config['app']['url']!=='http://127.0.0.1:8019')throw new RuntimeException('Own disposable platform only');
$mode=$argv[2]??'';
if($mode==='future'){
    $candidate=$root.'/_private/update-candidate.php';if(!is_file($qa.'/original-candidate.php'))copy($candidate,$qa.'/original-candidate.php');
    UpdatePackage::payload($candidate,$qa.'/future.zip');$zip=new ZipArchive();$zip->open($qa.'/future.zip');$m=json_decode($zip->getFromName('manifest.json'),true);$m['version']='2.7.3';$m['from']=['2.7.2'];$m['notes']=['Только синтетический будущий выпуск для проверки обнаружения; не устанавливать.'];$zip->addFromString('manifest.json',json_encode($m));$zip->close();file_put_contents($candidate,UpdatePackage::GUARD.file_get_contents($qa.'/future.zip'));echo "Synthetic future candidate prepared\n";exit;
}
if($mode==='restore-candidate'){copy($qa.'/original-candidate.php',$root.'/_private/update-candidate.php');exit;}
if(in_array($mode,['due','bad-issuer','restore-issuer','editor','activation-recovery','refresh-ui'],true)){
    $edition=$argv[3]??'';$client=null;foreach($targets['clients']as $c)if($c['edition']===$edition)$client=$c;if(!$client)throw new RuntimeException('Unknown fixture edition');$r=$client['root'];$cc=require $r.'/_storage/config.php';if($cc['database']['port']!==3319||$cc['database']['host']!=='127.0.0.1'||!str_starts_with($cc['database']['name'],'bypcms_purchase_'))throw new RuntimeException('Wrong client fixture');
    if($mode==='editor'){$d=new Database($cc);$role=$d->one('SELECT id FROM byp_roles WHERE slug="editor"');if(!$role){$role=['id'=>$d->insert('INSERT INTO byp_roles(slug,name,permissions,created_at,updated_at) VALUES("editor","QA editor",?,NOW(),NOW())',[json_encode(['content.manage'])])];}$d->execute('INSERT INTO byp_users(role_id,name,email,password_hash,status,created_at,updated_at) VALUES(?,"QA Release Editor","release-editor@example.test",?,"active",NOW(),NOW()) ON DUPLICATE KEY UPDATE role_id=VALUES(role_id)',[$role['id'],password_hash('BYPCMS-Release-Editor-2026',PASSWORD_DEFAULT)]);exit;}
    if($mode==='refresh-ui'){
        $active=UpdateRuntime::pointer($r);if(($active['version']??'')!=='2.7.2')throw new RuntimeException('Expected updated disposable client');$source=dirname(__DIR__).'/out';$prefix='/_update-assets/'.$active['release'].'/_next/';$destination=$r.'/_update-assets/'.$active['release'].'/_next';
        foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($source.'/_next',FilesystemIterator::SKIP_DOTS))as $f)if($f->isFile()){$path=$destination.'/'.str_replace('\\','/',substr($f->getPathname(),strlen($source.'/_next')+1));if(!is_dir(dirname($path)))mkdir(dirname($path),0755,true);$bytes=file_get_contents($f->getPathname());if(in_array(strtolower($f->getExtension()),['js','css','json','html'],true))$bytes=str_replace('/_next/',$prefix,$bytes);file_put_contents($path,$bytes);}
        file_put_contents($r.'/_releases/'.$active['release'].'/admin/index.html',str_replace('/_next/',$prefix,file_get_contents($source.'/admin/index.html')));echo "Current built interface staged on own updated QA installation\n";exit;
    }
    if($mode==='activation-recovery'){
        require_once __DIR__.'/../server/_core/ReleaseDiscovery.php';$file=$r.'/_storage/license-state.json';$saved=file_get_contents($file);$stateFile=UpdateRuntime::storage($r,true).'/updates/discovery.json';$old=UpdateRuntime::json($stateFile);$due=$old;$due['last_attempt']=0;$due['next_check']=0;UpdateRuntime::atomic($stateFile,$due);$d=new Database($cc);
        try{UpdateRuntime::atomic($file,[]);$engine=new \BYPCMS\Core\ReleaseDiscovery($r,$d->pdo(),$cc);$s=$engine->discover();if($s['discovery']['state']!=='failed')throw new RuntimeException('Unactivated licence accepted');file_put_contents($file,$saved);$s=$engine->discover();if($s['discovery']['error']!==''||$s['discovery']['state']!=='available')throw new RuntimeException('New activation stuck behind failure cache');echo "Activation clears cached licence failure immediately\n";}finally{file_put_contents($file,$saved);UpdateRuntime::atomic($stateFile,$old);}exit;
    }
    $base=UpdateRuntime::storage($r,true).'/updates';$s=UpdateRuntime::json($base.'/discovery.json');$s['next_check']=0;$s['last_attempt']=0;UpdateRuntime::atomic($base.'/discovery.json',$s);
    $trust=$r.'/_core/license-trust.json';if($mode==='bad-issuer'){copy($trust,$qa.'/trust-'.$edition.'.json');$t=json_decode(file_get_contents($trust),true);$t['issuer']='http://127.0.0.1:8160/api/';file_put_contents($trust,json_encode($t));}elseif($mode==='restore-issuer')copy($qa.'/trust-'.$edition.'.json',$trust);echo "Disposable discovery state prepared\n";exit;
}
throw new RuntimeException('Unknown fixture action');
