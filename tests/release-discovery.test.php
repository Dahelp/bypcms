<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/ReleaseDiscovery.php';
use BYPCMS\Core\{ReleaseDiscovery,UpdateRuntime};
final class DiscoveryPDO extends PDO {public function __construct(){}}
$root=dirname(__DIR__).'/outputs/release-discovery-unit-'.bin2hex(random_bytes(5)).'/site';mkdir($root.'/_storage',0750,true);
$config=['app'=>['installation_type'=>'client','version'=>'2.7.1','edition'=>'content','modules'=>['content','seo'],'key'=>str_repeat('a',64)],'updates'=>['private_dir'=>dirname($root).'/private']];file_put_contents($root.'/_storage/config.php','<?php return '.var_export($config,true).';');
$base=UpdateRuntime::storage($root,true).'/updates';mkdir($base);$now=1700000000;$calls=0;$fail=false;
$release=['id'=>str_repeat('a',64),'sha256'=>str_repeat('a',64),'bytes'=>1000,'version'=>'2.7.2','from'=>['2.7.1'],'editions'=>['content','business','commerce'],'modules'=>['content'],'php_min'=>'8.2.0','notes'=>['Новые уведомления']];
$catalog=[$release];$check=function()use(&$calls,&$fail,&$catalog,$base){$calls++;if($fail)throw new RuntimeException('Synthetic network failure');UpdateRuntime::atomic($base.'/catalog.json',['releases'=>$catalog]);};
$engine=new ReleaseDiscovery($root,new DiscoveryPDO(),$config,$check,function()use(&$now){return $now;});$checks=0;
function verify(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
verify($engine->status()['discovery']['state']==='never_checked','empty cache is not an empty release feed');
$s=$engine->discover();verify($calls===1&&$s['discovery']['state']==='available','owner entry discovers release');verify($s['discovery']['unread']&&$s['releases'][0]['compatible'],'one compatible unread notice');verify(!is_dir($base.'/jobs')&&!is_file($base.'/active.json')&&!is_file($base.'/maintenance.json'),'discovery creates no installation, backup or maintenance');
$engine->discover();$engine->discover(true);verify($calls===1,'automatic and rapid manual repeat are cached');
$engine->acknowledge($release['id']);verify(!$engine->status()['discovery']['unread'],'read action hides the notice');$engine->acknowledge($release['id']);verify(!$engine->status()['discovery']['unread'],'read retry idempotent');
$now+=ReleaseDiscovery::INTERVAL;$engine->discover();verify($calls===2&&!$engine->status()['discovery']['unread'],'same release does not create another notice');
$lock=fopen($base.'/discovery.lock','c');flock($lock,LOCK_EX);$s=$engine->discover(true);verify(!empty($s['checking'])&&$calls===2,'parallel checker does not duplicate outbound calls');flock($lock,LOCK_UN);fclose($lock);
$now+=61;$fail=true;$s=$engine->discover(true);verify($s['discovery']['state']==='failed'&&count($s['releases'])===1,'network failure retains verified cached release');verify($s['discovery']['last_success']===$now-61,'failure does not fabricate successful time');$engine->discover();verify($calls===3,'backoff prevents a retry storm');
$now+=ReleaseDiscovery::RETRY;$fail=false;$engine->discover();verify($calls===4&&$engine->status()['discovery']['error']==='','scheduled retry recovers');
$engine->preference(false);$now+=ReleaseDiscovery::INTERVAL;$engine->discover();verify($calls===4,'automatic check opt-out respected');$engine->discover(true);verify($calls===5,'manual check remains available with automatic checking off');
$engine->discover(false,true);verify($engine->status()['discovery']['worker_last_run']===$now,'cron heartbeat recorded separately');
$catalog[0]['version']='2.8.0';$catalog[0]['id']=str_repeat('b',64);$catalog[0]['editions']=['commerce'];$now+=61;$engine->discover(true);verify($engine->status()['discovery']['state']==='incompatible'&&!$engine->status()['discovery']['latest'],'incompatible edition never triggers update notification');
$catalog[0]=$release;$catalog[0]['version']='2.7.1';$now+=61;$engine->discover(true);$s=$engine->status();verify($s['releases'][0]['installed']&&!$s['releases'][0]['compatible'],'installed release is labelled installed');
$catalog[]=$release;$catalog[1]['version']='2.8.0';$catalog[1]['editions']=['commerce'];$now+=61;$engine->discover(true);verify($engine->status()['discovery']['state']==='incompatible','new incompatible release distinguished even alongside installed version');array_pop($catalog);
$catalog[0]['version']='2.6.0';$catalog[0]['from']=['2.7.1'];$now+=61;$engine->discover(true);verify(!$engine->status()['releases'][0]['compatible'],'older version cannot be suggested as an update');
try{$engine->acknowledge(str_repeat('f',64));throw new LogicException('unknown notice accepted');}catch(RuntimeException $e){verify(!$e instanceof LogicException,'unknown notice rejected');}
verify(!is_file($base.'/active.json')&&!is_dir($base.'/jobs'),'all error and retry paths leave runtime untouched');
echo $checks." discovery, cache, scheduling, failure, deduplication and no-auto-install checks passed\n";
