<?php
declare(strict_types=1);
require_once __DIR__.'/../_core/Content.php';require_once __DIR__.'/../_core/Chronicle.php';
use BYPCMS\Core\{Content,Chronicle};
session_name('bypcms_chronicle_demo');session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax','secure'=>(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')]);session_start();
header('X-Robots-Tag: noindex, follow');
$seed=require __DIR__.'/../_core/ChronicleSeed.php';$settings=['site_name'=>'Chronicle','tagline'=>'Сначала контекст. Затем выводы.','site_url'=>'https://demo.bypcms.ru','email'=>'hello@bypcms.ru','phone'=>''];if(!is_scalar($_GET['snapshot']??'')){http_response_code(400);exit('Некорректный адрес предпросмотра.');}$token=(string)($_GET['snapshot']??'');$path=trim(substr((string)parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH),strlen('/chronicle')),'/');
if($token!==''){$snapshot=$_SESSION['snapshots'][$token]??null;if(!$snapshot||$snapshot['expires']<time()){http_response_code(410);exit('Предпросмотр истёк. Откройте его снова из редактора.');}$seed=$snapshot['data'];$settings=array_merge($settings,$snapshot['settings']);if($path===''&&!empty($snapshot['path']))$path=$snapshot['path'];}
if($path==='feed.xml'){Chronicle::feed($seed['pages'],$settings,'/chronicle');exit;}Chronicle::render($seed['pages'],$seed['terms'],$settings,$path,'/chronicle',true,$token);
