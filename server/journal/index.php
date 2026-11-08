<?php
declare(strict_types=1);
require_once __DIR__.'/../_core/Content.php';require_once __DIR__.'/../_core/Journal.php';
use BYPCMS\Core\{Content,Journal};
session_name('bypcms_journal_demo');session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax','secure'=>(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')]);session_start();
header('X-Robots-Tag: noindex, follow');
$seed=require __DIR__.'/../_core/JournalSeed.php';$settings=['site_name'=>'Journal','tagline'=>'Архитектура. Люди. Пространство.','site_url'=>'https://demo.bypcms.ru','email'=>'','phone'=>''];$token=(string)($_GET['snapshot']??'');$path=trim(substr((string)parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH),strlen('/journal')),'/');
if($token!==''){$snapshot=$_SESSION['snapshots'][$token]??null;if(!$snapshot||$snapshot['expires']<time()){http_response_code(410);exit('Предпросмотр истёк. Откройте его снова из редактора.');}$seed=$snapshot['data'];$settings=array_merge($settings,$snapshot['settings']);if($path===''&&!empty($snapshot['path']))$path=$snapshot['path'];}
Journal::render($seed['pages'],$seed['terms'],$settings,$path,'/journal',true,$token);
