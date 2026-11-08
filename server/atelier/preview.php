<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Robots-Tag: noindex');
if($_SERVER['REQUEST_METHOD']!=='POST'){http_response_code(405);exit('{"error":"Требуется POST"}');}
if((int)($_SERVER['CONTENT_LENGTH']??0)>700000||(!empty($_SERVER['HTTP_ORIGIN'])&&parse_url($_SERVER['HTTP_ORIGIN'],PHP_URL_HOST)!==preg_replace('/:\d+$/','',$_SERVER['HTTP_HOST']))){http_response_code(403);exit('{"error":"Запрос отклонён"}');}
require_once __DIR__.'/../_core/Content.php';
session_name('bypcms_atelier_demo');session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax','secure'=>(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')]);session_start();
try {
    $input=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);
    $convert=static function(array $p):array {
        $kind=['services'=>'service','projects'=>'project','team'=>'person','pages'=>'page'][$p['kind']??'']??'page';
        return ['id'=>(int)($p['id']??-1),'kind'=>$kind,'slug'=>preg_replace('/[^a-z0-9\/-]/','',trim($p['slug']??'new-preview','/'))?:'new-preview','title'=>mb_substr($p['title']??'Новая запись',0,255),'excerpt'=>mb_substr($p['excerpt']??'',0,3000),'content'=>\BYPCMS\Core\Content::html($p['body']??''),'blocks'=>is_array($p['blocks']??null)?$p['blocks']:[],'cover'=>(int)($p['image']??-1)>=0&&(int)$p['image']<6?'/themes/atelier/assets/demo-'.(int)$p['image'].'.webp':'','status'=>'published','seo_title'=>$p['seoTitle']??'','seo_description'=>$p['seoDescription']??'','price'=>isset($p['price'])&&$p['price']>0?'от '.number_format((float)$p['price'],0,',',' ').' ₽':'','featured'=>!empty($p['featured'])];
    };
    $pages=require __DIR__.'/../_core/AtelierSeed.php';
    if(is_array($input['entities']??null)){$pages=[];foreach(array_slice($input['entities'],0,300)as $p)if(is_array($p)&&in_array($p['kind']??'',['services','projects','team','pages'],true)&&in_array($p['status']??'',['Опубликован','Опубликовано','Активен'],true)&&trim($p['slug']??'','/')!=='')$pages[]=$convert($p);}
    $path='';if(is_array($input['entity']??null)){$p=$convert($input['entity']);if(!empty($input['cover']))$p['cover']=\BYPCMS\Core\Content::imageUrl($input['cover']);$pages=array_values(array_filter($pages,fn($v)=>$v['id']!==$p['id']&&$v['slug']!==$p['slug']));array_unshift($pages,$p);$path=$p['slug'];}
    $s=$input['settings']??[];$a=$input['appearance']??[];$settings=['site_name'=>mb_substr($s['siteName']??'Atelier',0,100),'tagline'=>mb_substr($s['slogan']??'Пространства для жизни и работы.',0,200),'accent'=>$a['accent']??'#d9fd75','logo'=>\BYPCMS\Core\Content::imageUrl($s['logo']??''),'font'=>($a['font']??'')==='system'?'system':'manrope','heading_font'=>($a['headingFont']??'')==='georgia'?'georgia':'manrope'];
    $token=bin2hex(random_bytes(16));$_SESSION['snapshots']=array_filter($_SESSION['snapshots']??[],fn($v)=>$v['expires']>time());if(count($_SESSION['snapshots'])>=8)array_shift($_SESSION['snapshots']);$_SESSION['snapshots'][$token]=['pages'=>$pages,'settings'=>$settings,'path'=>$path,'expires'=>time()+1800];echo json_encode(['url'=>'/atelier/?snapshot='.$token]);
}catch(Throwable $e){http_response_code(422);echo json_encode(['error'=>'Не удалось подготовить Atelier. Повторите предпросмотр.']);}
