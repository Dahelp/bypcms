<?php
declare(strict_types=1);
require_once __DIR__.'/../_core/Atelier.php';
use BYPCMS\Core\Atelier;
session_name('bypcms_atelier_demo');session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax','secure'=>(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')]);session_start();
$pages=require __DIR__.'/../_core/AtelierSeed.php';$settings=['site_name'=>'Atelier','tagline'=>'Пространства для жизни и работы.','site_url'=>'https://demo.bypcms.ru','accent'=>'#d9fd75'];
$token=(string)($_GET['snapshot']??'');$path=trim(substr((string)parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH),strlen('/atelier')),'/');
if($token!==''){$snapshot=$_SESSION['snapshots'][$token]??null;if(!$snapshot||$snapshot['expires']<time()){http_response_code(410);header('X-Robots-Tag: noindex');exit('Предпросмотр истёк. Откройте его снова из редактора.');}$pages=$snapshot['pages'];$settings=array_merge($settings,$snapshot['settings']);if($path===''&&!empty($snapshot['path']))$path=$snapshot['path'];}
Atelier::render($pages,$settings,$path,'/atelier',['demo'=>true,'snapshot'=>$token]);
