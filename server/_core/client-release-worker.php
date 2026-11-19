<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
if(!defined('BYPCMS_SITE_ROOT')){require_once __DIR__.'/UpdateRuntime.php';\BYPCMS\Core\UpdateRuntime::serve(dirname(__DIR__),'_core/client-release-worker.php');exit;}
require_once __DIR__.'/Database.php';require_once __DIR__.'/ReleaseDiscovery.php';
$root=BYPCMS_SITE_ROOT;$config=require $root.'/_storage/config.php';$db=new \BYPCMS\Core\Database($config);
$result=(new \BYPCMS\Core\ReleaseDiscovery($root,$db->pdo(),$config))->discover(false,true);
echo json_encode(['state'=>$result['discovery']['state'],'last_success'=>$result['discovery']['last_success'],'next_check'=>$result['discovery']['next_check']],JSON_THROW_ON_ERROR).PHP_EOL;
exit($result['discovery']['error']!==''?1:0);
