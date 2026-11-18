<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/CommerceWorker.php';
use BYPCMS\Core\{CommerceSettings,CommerceWorker,UpdateRuntime};
$checks=0;function check(bool $ok,string $why):void{global $checks;if(!$ok)throw new RuntimeException($why);$checks++;}
$dir=__DIR__.'/../outputs/worker-unit-'.bin2hex(random_bytes(6));mkdir($dir.'/site/_storage',0750,true);$root=realpath($dir.'/site');$private=realpath($dir).'/private';$config=['app'=>['key'=>'synthetic-unit-key'],'updates'=>['private_dir'=>$private]];file_put_contents($root.'/_storage/config.php','<?php return '.var_export($config,true).';');
$s=new CommerceSettings($root,$config);$worker=new CommerceWorker($s,$root);check(!$s->workerStatus()['healthy'],'empty report never confirms cron');
UpdateRuntime::atomic($private.'/commerce/worker.json',['at'=>time()]);check(!$s->workerStatus()['healthy']&&$s->workerStatus()['legacy'],'old manual/CLI report is explicitly unverified');
$worker->run(fn()=>['fulfilled'=>1,'errors'=>0],'manual');$status=$s->workerStatus();check(!$status['healthy']&&$status['manual']['source']==='manual','manual completion cannot mask absent cron');
$r=$worker->run(fn()=>['fulfilled'=>2,'errors'=>0],'cli');$status=$s->workerStatus();check($r['fulfilled']===2&&$status['healthy']&&$status['source']==='cli','CLI cycle writes independent heartbeat');$run=$status['run_id'];
$worker->run(fn()=>['errors'=>0],'manual');check($s->workerStatus()['run_id']===$run,'manual report never overwrites CLI report');
$called=false;$outer=$worker->run(function()use($worker,&$called){$result=$worker->run(function()use(&$called){$called=true;return [];},'cli');check(!empty($result['skipped'])&&$result['reason']==='busy','overlapping complete cycle skips');return ['errors'=>0];},'cli');check(!$called,'second cycle does not touch business data');
try{$worker->run(fn()=>throw new RuntimeException('Synthetic failure'),'cli');throw new LogicException('Expected worker failure');}catch(RuntimeException $e){check($e->getMessage()==='Synthetic failure','fatal cycle failure propagated');}$status=$s->workerStatus();check(!$status['healthy']&&$status['state']==='failed'&&!str_contains(json_encode($status),'Synthetic failure'),'failed cycle visible without exposing exception detail');
$worker->run(fn()=>['errors'=>1,'stage_errors'=>['mail']],'cli');check($s->workerStatus()['healthy']&&$s->workerStatus()['state']==='warning','business error does not conceal live CLI, warning remains explicit');
foreach([time()-901,time()+120]as $at){$data=$s->workerStatus();unset($data['manual'],$data['healthy'],$data['legacy']);$data['at']=$at;UpdateRuntime::atomic($private.'/commerce/worker.json',$data);check(!$s->workerStatus()['healthy'],'stale/future heartbeat cannot confirm schedule');}
try{$worker->run(fn()=>[],'http');throw new LogicException('Expected invalid source');}catch(InvalidArgumentException $e){check(true,'unknown source rejected');}
$worker->run(fn()=>[],'cli');check($s->workerStatus()['healthy'],'lock released after failure and next cycle succeeds');
echo "$checks scheduled worker isolation, failure, heartbeat and locking checks passed\n";
