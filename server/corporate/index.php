<?php
declare(strict_types=1);
require_once __DIR__.'/../_core/Corporate.php';require_once __DIR__.'/../_core/BusinessDemoForm.php';
use BYPCMS\Core\{Corporate,BusinessDemoForm};
session_name('bypcms_corporate_demo');session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax','secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off']);session_start();
$pages=require __DIR__.'/../_core/CorporateSeed.php';$settings=['site_name'=>'Corporate','tagline'=>'Решения, на которые можно опереться.','accent'=>'#2454d5','font'=>'manrope','heading_font'=>'manrope','site_url'=>'https://demo.bypcms.ru'];
$path=trim(substr((string)parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH),strlen('/corporate')),'/');$token=is_scalar($_GET['snapshot']??'')?(string)($_GET['snapshot']??''):'';
if($token){$snapshot=$_SESSION['snapshots'][$token]??null;if(!$snapshot||$snapshot['expires']<time()){http_response_code(410);header('X-Robots-Tag: noindex');exit('Предпросмотр истёк. Откройте его из редактора заново.');}$pages=$snapshot['pages'];$settings=array_merge($settings,$snapshot['settings']);if(!$path&&!empty($snapshot['path']))$path=$snapshot['path'];}
if($token&&!array_filter($pages,fn($page)=>($page['slug']??'')==='privacy')){$privacy=array_values(array_filter(require __DIR__.'/../_core/CorporateSeed.php',fn($page)=>$page['slug']==='privacy'))[0];$privacy['id']=9999999;$pages[]=$privacy;}
$options=['demo'=>true,'snapshot'=>$token];if(BusinessDemoForm::handle($pages,'/corporate',$token,$path,$options))return;
Corporate::render($pages,$settings,$path,'/corporate',$options);
