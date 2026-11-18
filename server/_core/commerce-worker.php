<?php
declare(strict_types=1);
// Protected by the _core HTTP deny rule. No public cron token or arbitrary commands.
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
require_once __DIR__.'/bootstrap.php';
require_once __DIR__.'/CommerceOrders.php';
$commerce=new \BYPCMS\Core\CommerceOrders($db,$config,BYPCMS_ROOT);
$result=$commerce->work('cli');
echo json_encode($result,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE).PHP_EOL;

exit(!empty($result['skipped'])?0:((int)($result['errors']??0)>0?1:0));
