<?php
declare(strict_types=1);
// This endpoint intentionally does not start a session or set a cookie.
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
if(($_SERVER['REQUEST_METHOD']??'GET')!=='POST'){header('Allow: POST');http_response_code(405);exit;}
if(($_SERVER['HTTP_DNT']??'')==='1'||($_SERVER['HTTP_SEC_GPC']??'')==='1'){http_response_code(204);exit;}
if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json'){http_response_code(415);exit;}
if((int)($_SERVER['CONTENT_LENGTH']??0)>1024){http_response_code(413);exit;}
$raw=file_get_contents('php://input',false,null,0,1025);
if($raw===false||strlen($raw)>1024){http_response_code(413);exit;}
$root=dirname(__DIR__);
require_once $root.'/_core/Database.php';
require_once $root.'/_core/PublicFunnel.php';
try {
    $configFile=$root.'/_storage/config.php';
    if(!is_file($configFile)){http_response_code(503);exit;}
    $config=require $configFile;
    if(!is_array($config)||($config['app']['installation_type']??'platform')!=='platform'){http_response_code(404);exit;}
    if(!\BYPCMS\Core\PublicFunnel::sameOrigin((string)($_SERVER['HTTP_ORIGIN']??''),(string)($config['app']['url']??''))){http_response_code(403);exit;}
    if(isset($_SERVER['HTTP_SEC_FETCH_SITE'])&&$_SERVER['HTTP_SEC_FETCH_SITE']!=='same-origin'){http_response_code(403);exit;}
    $input=json_decode($raw,true,8,JSON_THROW_ON_ERROR);
    if(!is_array($input))throw new InvalidArgumentException('Invalid event');
    $event=\BYPCMS\Core\PublicFunnel::validate($input);
    $funnel=new \BYPCMS\Core\PublicFunnel(new \BYPCMS\Core\Database($config));
    $funnel->record($event);
    http_response_code(204);
} catch(InvalidArgumentException|JsonException $e){http_response_code(422);}
catch(Throwable $e){error_log('BYPCMS comparison counters unavailable');http_response_code(503);}
