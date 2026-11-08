<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Robots-Tag: noindex');
if($_SERVER['REQUEST_METHOD']!=='POST'){http_response_code(405);exit('{"error":"Требуется POST"}');}
if((int)($_SERVER['CONTENT_LENGTH']??0)>700000||(!empty($_SERVER['HTTP_ORIGIN'])&&parse_url($_SERVER['HTTP_ORIGIN'],PHP_URL_HOST)!==preg_replace('/:\d+$/','',$_SERVER['HTTP_HOST']))){http_response_code(403);exit('{"error":"Запрос отклонён"}');}
require_once __DIR__.'/../_core/Content.php';
session_name('bypcms_focus_demo');session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax','secure'=>(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off')]);session_start();
try{
 $input=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);if(!is_array($input))throw new RuntimeException('Некорректный запрос.');$seed=require __DIR__.'/../_core/FocusSeed.php';$p=$input['entity']??null;
 $media=is_array($input['media']??null)?array_slice($input['media'],0,60,true):[];
 $safeImage=static fn($url)=>is_string($url)&&preg_match('#^(?:/(?!/)|https?://|data:image/)#i',$url)?\BYPCMS\Core\Content::imageUrl($url):'';
 $resolve=static function(int $id)use($media,$safeImage):string{return isset($media[$id])?$safeImage($media[$id]['url']??''):($id>=0&&$id<=5?'/themes/gallery/assets/object-'.$id.'.webp':'');};
 $convert=static function(array $p)use(&$seed,$resolve,$safeImage):array{
  $meta=[];
  foreach(['category','author']as $kind){$label=mb_substr((string)($p[$kind]??($kind==='author'?'Редакция':'')),0,190);$slug='demo-'.substr(sha1($label),0,12);$meta[$kind]=$slug;if($label!=='')$seed['terms'][]=['kind'=>$kind,'slug'=>$slug,'title'=>$label,'description'=>''];}
  $blocks=[];foreach(array_slice(is_array($p['blocks']??null)?$p['blocks']:[],0,100)as $b){if(!is_array($b))continue;$type=$b['type']??'';
   if($type==='gallery'){$images=[];foreach(array_slice(is_array($b['images']??null)?$b['images']:[],0,12)as $im){if(!is_array($im))continue;$url=isset($im['image'])?$resolve((int)$im['image']):$safeImage($im['url']??'');if($url!=='')$images[]=['url'=>$url,'alt'=>mb_substr(is_scalar($im['alt']??'')?(string)($im['alt']??''):'',0,1000),'caption'=>mb_substr(is_scalar($im['caption']??'')?(string)($im['caption']??''):'',0,1000)];}if(!empty($b['title']))$blocks[]=['type'=>'heading','content'=>$b['title']];$blocks[]=['type'=>'gallery','content'=>$b['content']??'','images'=>$images];}
   elseif($type==='heading'){$blocks[]=['type'=>'heading','content'=>$b['title']??$b['content']??''];if(!empty($b['title'])&&!empty($b['content']))$blocks[]=['type'=>'text','content'=>'<p>'.\BYPCMS\Core\Content::e($b['content']).'</p>'];}
   elseif($type==='button')$blocks[]=['type'=>'button','content'=>$b['title']??'Открыть','url'=>$b['url']??$b['content']??''];
   elseif($type==='code')$blocks[]=['type'=>'text','content'=>\BYPCMS\Core\Content::html($b['content']??'')];else $blocks[]=$b;
  }
  return array_merge(['id'=>(int)($p['id']??-1),'kind'=>($p['kind']??'')==='pages'?'page':'article','slug'=>preg_replace('/[^a-z0-9\/-]/','',trim($p['slug']??'new-preview','/'))?:'new-preview','title'=>mb_substr($p['title']??'Новый материал',0,255),'excerpt'=>mb_substr($p['excerpt']??'',0,3000),'content'=>\BYPCMS\Core\Content::html($p['body']??''),'blocks'=>$blocks,'cover'=>$resolve((int)($p['image']??-1)),'featured'=>!empty($p['featured']),'published_at'=>gmdate('Y-m-d H:i:s'),'seo_title'=>$p['seoTitle']??'','seo_description'=>$p['seoDescription']??''], $meta);
 };
 if(is_array($input['entities']??null)){$pages=[];$seed['terms']=[];foreach(array_slice($input['entities'],0,300)as $v)if(is_array($v)&&in_array($v['kind']??'',['pages','articles'],true)&&in_array($v['status']??'',['Опубликован','Опубликовано'],true))$pages[]=$convert($v);$seed['pages']=$pages;$unique=[];foreach($seed['terms']as $t)$unique[$t['kind'].$t['slug']]=$t;$seed['terms']=array_values($unique);}
 if(is_array($p)){$page=$convert($p);if(!empty($input['cover']))$page['cover']=\BYPCMS\Core\Content::imageUrl($input['cover']);$seed['pages']=array_values(array_filter($seed['pages'],fn($v)=>$v['id']!==$page['id']&&$v['slug']!==$page['slug']));array_unshift($seed['pages'],$page);}
 $token=bin2hex(random_bytes(16));$_SESSION['snapshots']=array_filter($_SESSION['snapshots']??[],fn($s)=>$s['expires']>time());if(count($_SESSION['snapshots'])>=8)array_shift($_SESSION['snapshots']);
 $settings=['accent'=>$input['appearance']['accent']??'#c7411f','font'=>($input['appearance']['font']??'')==='system'?'system':'manrope','focus_heading_font'=>($input['appearance']['focusHeadingFont']??'')==='georgia'?'georgia':'manrope','logo'=>\BYPCMS\Core\Content::imageUrl($input['settings']['logo']??''),'site_name'=>mb_substr($input['settings']['siteName']??'Focus',0,100),'tagline'=>mb_substr($input['settings']['slogan']??'Истории, которые стоит увидеть.',0,200)];
 $settings['_media_images']=[];foreach($media as $row){$url=$safeImage($row['url']??'');if($url!=='')$settings['_media_images'][$url]=['width'=>min(50000,max(1,(int)($row['width']??1200))),'height'=>min(50000,max(1,(int)($row['height']??800)))];}
 $_SESSION['snapshots'][$token]=['data'=>$seed,'settings'=>$settings,'path'=>is_array($p)?$page['slug']:'','expires'=>time()+1800];echo json_encode(['url'=>'/focus/?snapshot='.$token]);
}catch(Throwable $e){http_response_code(422);echo json_encode(['error'=>'Не удалось подготовить предпросмотр.']);}
