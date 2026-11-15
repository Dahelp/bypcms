<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use RuntimeException;
use Throwable;
require_once __DIR__.'/Content.php';
require_once __DIR__.'/BusinessDemoForm.php';

/** Session-isolated previews over actual editor data. Never writes CRM or sends mail. */
final class BusinessThemeDemo {
    private static function session(string $theme):void {
        if(!in_array($theme,['corporate','mono'],true))throw new \RuntimeException('Unknown Business theme');
        session_name('bypcms_'.$theme.'_demo');
        session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax','secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off']);
        session_start();
    }
    private static function seed(string $file):array {return (static fn()=>require $file)();}
    public static function serve(string $theme,string $renderer,string $seedFile,array $defaults):void {
        self::session($theme);
        $pages=self::seed($seedFile);$privacy=array_values(array_filter($pages,fn($p)=>$p['slug']==='privacy'))[0]??null;
        $settings=$defaults+['site_url'=>'https://demo.bypcms.ru','font'=>'manrope','heading_font'=>'manrope'];
        $base='/'.$theme;$path=trim(substr((string)parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH),strlen($base)),'/');
        $token=is_scalar($_GET['snapshot']??'')?(string)($_GET['snapshot']??''):'';
        if($token){
            $snapshot=$_SESSION['snapshots'][$token]??null;
            if(!$snapshot||$snapshot['expires']<time()){http_response_code(410);header('X-Robots-Tag: noindex');header('Cache-Control: no-store');echo 'Предпросмотр истёк. Откройте его из редактора заново.';return;}
            $pages=$snapshot['pages'];$settings=array_merge($settings,$snapshot['settings']);if(!$path&&!empty($snapshot['path']))$path=$snapshot['path'];
            if($privacy&&!array_filter($pages,fn($p)=>($p['slug']??'')==='privacy')){$privacy['id']=9999999;$pages[]=$privacy;}
        }
        $options=['demo'=>true,'snapshot'=>$token];
        if(BusinessDemoForm::handle($pages,$base,$token,$path,$options))return;
        $renderer::render($pages,$settings,$path,$base,$options);
    }
    public static function preview(string $theme,string $seedFile,array $defaults):void {
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Robots-Tag: noindex');
if($_SERVER['REQUEST_METHOD']!=='POST'){http_response_code(405);exit('{"error":"Требуется POST"}');}
if((int)($_SERVER['CONTENT_LENGTH']??0)>700000||(!empty($_SERVER['HTTP_ORIGIN'])&&parse_url($_SERVER['HTTP_ORIGIN'],PHP_URL_HOST)!==preg_replace('/:\d+$/','',$_SERVER['HTTP_HOST']))){http_response_code(403);exit('{"error":"Запрос отклонён"}');}
self::session($theme);
try{
    $input=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);if(!is_array($input))throw new RuntimeException('Invalid payload');
    $validate=static function(array $record,array $nested=[]):void {foreach($record as $key=>$value)if(!in_array($key,$nested,true)&&!is_scalar($value)&&$value!==null)throw new RuntimeException('Invalid field');};
    foreach(['settings','appearance'] as $key)if(isset($input[$key])){if(!is_array($input[$key]))throw new RuntimeException('Invalid settings');$validate($input[$key],['editionTemplates']);}
    if(isset($input['cover'])&&!is_string($input['cover']))throw new RuntimeException('Invalid cover');
    $media=is_array($input['media']??null)?$input['media']:[];foreach($media as $record){if(!is_array($record))throw new RuntimeException('Invalid media');$validate($record);}
    foreach([...(is_array($input['entities']??null)?$input['entities']:[]),...(isset($input['entity'])?[$input['entity']]:[])] as $record){if(!is_array($record))throw new RuntimeException('Invalid entity');$validate($record,['blocks','saveHistory','variants','specifications','orderItems']);foreach((array)($record['blocks']??[]) as $block){if(!is_array($block))throw new RuntimeException('Invalid block');$validate($block,['images']);foreach((array)($block['images']??[]) as $image){if(!is_array($image))throw new RuntimeException('Invalid image');$validate($image);}}}
    $convert=static function(array $p)use($media):array {
        $kind=['services'=>'service','projects'=>'project','team'=>'person','pages'=>'page'][$p['kind']??'']??'page';$image=(int)($p['image']??-1);$url=is_string($media[$image]['url']??null)?Content::imageUrl($media[$image]['url']):($image>=0&&$image<6?'/themes/atelier/assets/demo-'.$image.'.webp':'');
        $publishedAt=null;$rawDate=trim((string)($p['publishAt']??''));
        if($rawDate!==''){if(!preg_match('/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/D',$rawDate))throw new RuntimeException('Invalid publication date');$date=new \DateTimeImmutable($rawDate,new \DateTimeZone('UTC'));if(\DateTimeImmutable::getLastErrors()!==false)throw new RuntimeException('Invalid publication date');$publishedAt=$date->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s');}
        $slug=preg_replace('/[^a-z0-9\/-]/','',trim((string)($p['slug']??''),'/'))?:($kind==='page'&&(!empty($p['isHome'])||in_array($p['status']??'',['Опубликован','Опубликовано','Активен'],true))?'home':'new-preview');if(in_array($slug,['services','projects','team','contact','search','request-success'],true))$slug='preview-'.$slug;
        $blocks=[];foreach(array_slice((array)($p['blocks']??[]),0,40) as $b){if(!is_array($b))continue;$type=$b['type']??'';$value=['type'=>$type,'content'=>(string)($b['content']??'')];if($type==='heading'&&!empty($b['title'])){if($value['content']!==''&&$value['content']!==$b['title']){$blocks[]=['type'=>'heading','content'=>$b['title']];$value['type']='text';}else $value['content']=$b['title'];}if($type==='gallery'){$value['images']=[];foreach(array_slice((array)($b['images']??[]),0,12) as $im){$id=(int)($im['image']??-1);$src=is_string($media[$id]['url']??null)?Content::imageUrl($media[$id]['url']):'';if($src)$value['images'][]=['url'=>$src,'alt'=>(string)($im['alt']??''),'caption'=>(string)($im['caption']??'')];}}elseif($type==='button'){$value['url']=Content::url((string)($b['content']??''));$value['content']=(string)($b['title']??'Подробнее');}elseif(!in_array($type,['text','heading','quote'],true))continue;$blocks[]=$value;}
        return ['id'=>(int)($p['id']??0),'kind'=>$kind,'slug'=>$slug,'title'=>mb_substr((string)($p['title']??'Новая запись'),0,255),'excerpt'=>mb_substr((string)($p['excerpt']??''),0,3000),'content'=>Content::html((string)($p['body']??'')),'cover'=>$url,'cover_alt'=>(string)($p['imageAlt']??$p['title']??''),'blocks'=>$blocks,'status'=>'published','published_at'=>$publishedAt,'seo_title'=>(string)($p['seoTitle']??''),'seo_description'=>(string)($p['seoDescription']??''),'price'=>isset($p['price'])&&$p['price']>0?(!empty($p['oldPrice'])?'':'от ').number_format((float)$p['price'],0,',',' ').' ₽':'','parent_id'=>(int)($p['parentId']??$p['serviceId']??0),'person_id'=>(int)($p['personId']??0),'featured'=>!empty($p['featured']),'role'=>(string)($p['role']??($kind==='person'?($p['extra']??''):'')),'client'=>(string)($kind==='project'?($p['extra']??''):''),'location'=>(string)($p['location']??$p['category']??''),'year'=>(string)($p['year']??$p['date']??'')];
    };
    $pages=self::seed($seedFile);
    if(is_array($input['entities']??null)){$pages=[];foreach(array_slice($input['entities'],0,300) as $p)if(is_array($p)&&in_array($p['kind']??'',['services','projects','team','pages'],true)&&in_array($p['status']??'',['Опубликован','Опубликовано','Активен'],true)&&(trim((string)($p['slug']??''),'/')!==''||(($p['kind']??'')==='pages'&&($p['slug']??'')==='/'))){$converted=$convert($p);if(BusinessView::published($converted))$pages[]=$converted;}}
    $path='';if(is_array($input['entity']??null)){$page=$convert($input['entity']);$page['published_at']=null;if(!empty($input['cover']))$page['cover']=Content::imageUrl((string)$input['cover']);$pages=array_values(array_filter($pages,fn($p)=>$p['id']!==$page['id']&&$p['slug']!==$page['slug']));array_unshift($pages,$page);$path=$page['slug'];}
    $s=$input['settings']??[];$a=$input['appearance']??[];$settings=['site_name'=>mb_substr((string)($s['siteName']??$defaults['site_name']),0,100),'tagline'=>mb_substr((string)($s['slogan']??$defaults['tagline']),0,200),'email'=>mb_substr((string)($s['email']??''),0,190),'phone'=>mb_substr((string)($s['phone']??''),0,60),'accent'=>(string)($a['accent']??$defaults['accent']),'logo'=>Content::imageUrl((string)($s['logo']??'')),'font'=>($a['font']??'')==='system'?'system':'manrope','heading_font'=>($a['headingFont']??'')==='georgia'?'georgia':'manrope'];
    $token=bin2hex(random_bytes(16));$_SESSION['snapshots']=array_filter($_SESSION['snapshots']??[],fn($p)=>$p['expires']>time());if(count($_SESSION['snapshots'])>=8)array_shift($_SESSION['snapshots']);$_SESSION['snapshots'][$token]=['pages'=>$pages,'settings'=>$settings,'path'=>$path,'expires'=>time()+1800];echo json_encode(['url'=>'/'.$theme.'/?snapshot='.$token]);
}catch(Throwable $error){http_response_code(422);echo json_encode(['error'=>'Не удалось подготовить предпросмотр. Проверьте данные и повторите предпросмотр.']);}

    }
}
