<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Robots-Tag: noindex');
if($_SERVER['REQUEST_METHOD']!=='POST'){http_response_code(405);exit('{"error":"Требуется POST"}');}
if((int)($_SERVER['CONTENT_LENGTH']??0)>700000||(!empty($_SERVER['HTTP_ORIGIN'])&&parse_url($_SERVER['HTTP_ORIGIN'],PHP_URL_HOST)!==preg_replace('/:\d+$/','',$_SERVER['HTTP_HOST']))){http_response_code(403);exit('{"error":"Запрос отклонён"}');}
require_once __DIR__.'/../_core/Content.php';
session_name('bypcms_chronicle_demo');session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax','secure'=>(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')]);session_start();
try{
 $input=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);$seed=require __DIR__.'/../_core/ChronicleSeed.php';$p=$input['entity']??null;
 $convert=static function(array $p)use(&$seed):array{
  $meta=[];
  foreach(['category','author']as $kind){$label=mb_substr((string)($p[$kind]??($kind==='author'?'Редакция':'')),0,190);$slug='demo-'.substr(sha1($label),0,12);$meta[$kind]=$slug;if($label!=='')$seed['terms'][]=['kind'=>$kind,'slug'=>$slug,'title'=>$label,'description'=>''];}
  return array_merge(['id'=>(int)($p['id']??-1),'kind'=>($p['kind']??'')==='pages'?'page':'article','slug'=>preg_replace('/[^a-z0-9\/-]/','',trim($p['slug']??'new-preview','/'))?:'new-preview','title'=>mb_substr($p['title']??'Новый материал',0,255),'excerpt'=>mb_substr($p['excerpt']??'',0,3000),'content'=>\BYPCMS\Core\Content::html($p['body']??''),'blocks'=>is_array($p['blocks']??null)?$p['blocks']:[],'cover'=>(int)($p['image']??-1)>=0?'/themes/chronicle/assets/editorial-'.((int)$p['image']%8+1).'.jpg':'','featured'=>!empty($p['featured']),'published_at'=>gmdate('Y-m-d H:i:s'),'seo_title'=>$p['seoTitle']??'','seo_description'=>$p['seoDescription']??''], $meta);
 };
 if(is_array($input['entities']??null)){$pages=[];$seed['terms']=[];foreach(array_slice($input['entities'],0,300)as $v)if(is_array($v)&&in_array($v['kind']??'',['pages','articles'],true)&&in_array($v['status']??'',['Опубликован','Опубликовано'],true))$pages[]=$convert($v);$seed['pages']=$pages;$unique=[];foreach($seed['terms']as $t)$unique[$t['kind'].$t['slug']]=$t;$seed['terms']=array_values($unique);}
 if(is_array($p)){$page=$convert($p);if(!empty($input['cover']))$page['cover']=\BYPCMS\Core\Content::imageUrl($input['cover']);$seed['pages']=array_values(array_filter($seed['pages'],fn($v)=>$v['id']!==$page['id']&&$v['slug']!==$page['slug']));array_unshift($seed['pages'],$page);}
 $token=bin2hex(random_bytes(16));$_SESSION['snapshots']=array_filter($_SESSION['snapshots']??[],fn($s)=>$s['expires']>time());if(count($_SESSION['snapshots'])>=8)array_shift($_SESSION['snapshots']);
 $settings=['accent'=>$input['appearance']['accent']??'#a82b24','font'=>($input['appearance']['font']??'')==='system'?'system':'manrope','heading_font'=>($input['appearance']['headingFont']??'')==='georgia'?'georgia':'cormorant','logo'=>\BYPCMS\Core\Content::imageUrl($input['settings']['logo']??''),'site_name'=>mb_substr($input['settings']['siteName']??'Chronicle',0,100),'tagline'=>mb_substr($input['settings']['slogan']??'Сначала контекст. Затем выводы.',0,200)];
 $_SESSION['snapshots'][$token]=['data'=>$seed,'settings'=>$settings,'path'=>is_array($p)?$page['slug']:'','expires'=>time()+1800];echo json_encode(['url'=>'/chronicle/?snapshot='.$token]);
}catch(Throwable $e){http_response_code(422);echo json_encode(['error'=>'Не удалось подготовить предпросмотр.']);}
