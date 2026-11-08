<?php
declare(strict_types=1);
use BYPCMS\Core\{Content,Journal};
require_once __DIR__.'/bootstrap.php';require_once __DIR__.'/Content.php';require_once __DIR__.'/Journal.php';require_once __DIR__.'/Chronicle.php';require_once __DIR__.'/Focus.php';
$content=new Content($db,$config,BYPCMS_ROOT);$settings=$content->settings();$settings['site_url']=$config['app']['url'];$path=trim(rawurldecode((string)parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH)),'/');
if($path==='manage'){require __DIR__.'/content-admin.php';return;}
if(!is_scalar($_GET['preview_token']??'')){http_response_code(400);header('X-Robots-Tag: noindex');exit('Некорректный адрес предпросмотра.');}$previewToken=(string)($_GET['preview_token']??'');$preview=false;$pages=$content->records(true,false);
if($previewToken!==''){
    $entry=$_SESSION['content_previews'][$previewToken]??null;
    if(!$auth->user()||!$entry||$entry['expires']<time()){http_response_code(403);header('X-Robots-Tag: noindex');exit('Предпросмотр истёк или доступен только автору сессии. Вернитесь в редактор.');}
    $preview=true;$p=$entry['page'];$pages=array_values(array_filter($pages,fn($v)=>(int)$v['id']!==(int)$p['id']));array_unshift($pages,$p);$path=$p['slug'];
}
if(!$preview&&$path==='robots.txt'){header('Content-Type: text/plain; charset=utf-8');echo "User-agent: *\nDisallow: /admin/\nDisallow: /manage/\nDisallow: /api/\nDisallow: /*preview_token=\nSitemap: ".rtrim($settings['site_url'],'/')."/sitemap.xml\n";exit;}
if(!$preview&&$path==='sitemap.xml'){
    header('Content-Type: application/xml; charset=utf-8');$base=rtrim($settings['site_url'],'/');$urls=['/','/articles/'];foreach($content->terms()as $t)$urls[]='/'.$t['kind'].'/'.$t['slug'].'/';foreach($pages as $p)if(empty($p['noindex'])&&$p['slug']!=='home')$urls[]='/'.$p['slug'].'/';echo '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';foreach(array_unique($urls)as $url)echo '<url><loc>'.Content::e($base.$url).'</loc></url>';echo '</urlset>';exit;
}
if(!$preview&&$r=$db->one('SELECT target,code FROM byp_content_redirects WHERE source=?',['/'.$path.'/'])){header('Location: '.$r['target'],true,(int)$r['code']);exit;}
if(!$preview){foreach($pages as $i=>$p)if(trim($p['slug'],'/')===$path){$pages[$i]=$content->get((int)$p['id']);break;}
 if($path==='search'){$q=is_scalar($_GET['q']??'')?mb_substr(trim((string)($_GET['q']??'')),0,100):'';$settings['_search_matches']=$q===''?[]:array_map('intval',array_column($db->all('SELECT id FROM byp_pages WHERE title LIKE ? OR excerpt LIKE ? OR content LIKE ?',array_fill(0,3,'%'.$q.'%')),'id'));}}
$terms=$content->terms();$paths=[];if(($settings['theme']??'')==='focus')foreach($pages as $p)foreach(\BYPCMS\Core\Focus::mediaUrls($p)as $url)if(str_starts_with($url,'/uploads/content/'))$paths[]=ltrim($url,'/');foreach($terms as $t)if(str_starts_with($t['image']??'','/uploads/content/'))$paths[]=ltrim($t['image'],'/');foreach($pages as $p)if(str_starts_with($p['cover']??'','/uploads/content/'))$paths[]=ltrim($p['cover'],'/');
foreach(array_chunk(array_unique($paths),200)as $chunk)foreach($db->all('SELECT path,width,height,metadata FROM byp_media WHERE path IN ('.implode(',',array_fill(0,count($chunk),'?')).')',$chunk)as $im){$metadata=json_decode($im['metadata']??'{}',true);Content::$images['/'.$im['path']]=['width'=>(int)$im['width'],'height'=>(int)$im['height'],'variants'=>$metadata['variants']??[]];}
$renderer=match($settings['theme']??'journal'){'focus'=>\BYPCMS\Core\Focus::class,'chronicle'=>\BYPCMS\Core\Chronicle::class,default=>Journal::class};
if(!$preview&&$path==='feed.xml'&&$renderer!==Journal::class){$renderer::feed($pages,$settings);exit;}$renderer::render($pages,$terms,$settings,$path,'',$preview);
