<?php
declare(strict_types=1);
use BYPCMS\Core\{Business,Content,Atelier,Response};
require_once __DIR__.'/bootstrap.php';require_once __DIR__.'/Business.php';require_once __DIR__.'/Atelier.php';
$business=new Business($db,$config,BYPCMS_ROOT);$content=$business->content;$settings=$business->settings();
$path=trim(rawurldecode((string)parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH)),'/');
if($path==='manage'){require __DIR__.'/content-admin.php';return;}
if($settings['theme']==='custom'&&is_file(BYPCMS_ROOT.'/themes/custom/page.html')&&empty($_GET['preview_token'])){
    $page=$db->one('SELECT * FROM byp_pages WHERE slug=? AND status="published"',[$path?:'home']);if(!$page){http_response_code(404);exit('Страница не найдена.');}
    echo strtr(file_get_contents(BYPCMS_ROOT.'/themes/custom/page.html'),['{{site.name}}'=>Content::e($settings['site_name']),'{{page.title}}'=>Content::e($page['title']),'{{page.excerpt}}'=>Content::e($page['excerpt']),'{{page.content}}'=>Content::html($page['content'])]);return;
}
$options=[];$previewToken=(string)($_GET['preview_token']??'');$pages=$content->records(true,true);
if($previewToken!==''){
    $entry=$_SESSION['content_previews'][$previewToken]??null;
    if(!$auth->user()||!$entry||$entry['expires']<time()){http_response_code(403);header('X-Robots-Tag: noindex');exit('Предпросмотр истёк. Вернитесь в редактор.');}
    $p=$entry['page'];$pages=array_values(array_filter($pages,fn($v)=>(int)$v['id']!==(int)$p['id']&&$v['slug']!==$p['slug']));array_unshift($pages,$p);$path=$p['slug'];$options['preview']=true;
}
if(!$previewToken&&$path==='robots.txt'){header('Content-Type: text/plain; charset=utf-8');echo "User-agent: *\nDisallow: /manage/\nDisallow: /admin/\nDisallow: /api/\nDisallow: /request-success/\nDisallow: /*preview_token=\nSitemap: ".rtrim($settings['site_url'],'/')."/sitemap.xml\n";return;}
if(!$previewToken&&$path==='sitemap.xml'){
    header('Content-Type: application/xml; charset=utf-8');$urls=['/','/services/','/projects/','/contact/','/team/'];foreach($pages as $p)if(empty($p['noindex'])&&$p['slug']!=='home')$urls[]='/'.$p['slug'].'/';echo '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';foreach(array_unique($urls)as $url)echo '<url><loc>'.Content::e(rtrim($settings['site_url'],'/').$url).'</loc></url>';echo '</urlset>';return;
}
if(!$previewToken&&$r=$db->one('SELECT target,code FROM byp_content_redirects WHERE source=?',['/'.$path.'/'])){header('Location: '.$r['target'],true,(int)$r['code']);return;}
$_SESSION['csrf']??=bin2hex(random_bytes(24));$error='';$formValues=$_POST;
if($path==='contact'){
    if($_SERVER['REQUEST_METHOD']==='POST')try{
        if(!hash_equals($_SESSION['csrf'],(string)($_POST['csrf']??'')))throw new RuntimeException('Сессия формы истекла. Скопируйте введённое и обновите страницу перед повтором.');
        $saved=$business->submit($_POST,session_id(),$_SERVER['REMOTE_ADDR']??'');
        $_SESSION['business_receipts'][$saved['reference']]=time();$_SESSION['business_receipts']=array_slice($_SESSION['business_receipts'],-10,null,true);
        $url='/request-success/?ref='.$saved['reference'];
        if(str_contains($_SERVER['HTTP_ACCEPT']??'','application/json'))Response::ok(['url'=>$url]);
        header('Location: '.$url,true,303);return;
    }catch(Throwable $x){$error=$x instanceof PDOException?'Не удалось сохранить обращение. Повторите отправку: введённое осталось в форме.':$x->getMessage();if(str_contains($_SERVER['HTTP_ACCEPT']??'','application/json'))Response::error($error,422);$options['http_status']=422;}
    $formValues+=['name'=>'','email'=>'','phone'=>'','message'=>'','service_id'=>(int)($_GET['service']??0),'project_id'=>(int)($_GET['project']??0),'request_token'=>bin2hex(random_bytes(16))];
    $e=[Content::class,'e'];$services=array_values(array_filter($pages,fn($p)=>$p['kind']==='service'));$privacy=array_values(array_filter($pages,fn($p)=>$p['slug']==='privacy'));
    ob_start();
    if(($business->enabled('forms')&&$privacy)||($_SERVER['REQUEST_METHOD']==='POST'&&$error)): ?>
    <form id="business-request" method="post" action="/contact/">
      <p role="alert" class="a-form-error" <?= $error?'':'hidden' ?>><?= $e($error) ?></p>
      <input type="hidden" name="csrf" value="<?= $e($_SESSION['csrf']) ?>"><input type="hidden" name="request_token" value="<?= $e($formValues['request_token']) ?>"><input type="hidden" name="project_id" value="<?= (int)$formValues['project_id'] ?>">
      <?php if($formValues['project_id']): $context=$content->get((int)$formValues['project_id']);if($context&&$context['kind']==='project'&&Business::published($context)): ?><p>Проект: <?= $e($context['title']) ?></p><?php endif;endif ?>
      <label>Ваше имя<input name="name" required maxlength="150" autocomplete="name" value="<?= $e($formValues['name']) ?>"></label>
      <label>Email<input name="email" type="email" maxlength="190" autocomplete="email" value="<?= $e($formValues['email']) ?>"></label>
      <label>Телефон<input name="phone" type="tel" maxlength="60" autocomplete="tel" value="<?= $e($formValues['phone']) ?>"></label>
      <label>Направление<select name="service_id"><option value="">Хочу обсудить задачу</option><?php foreach($services as $service): ?><option value="<?= $service['id'] ?>" <?= (int)$formValues['service_id']===$service['id']?'selected':'' ?>><?= $e($service['title']) ?></option><?php endforeach ?></select></label>
      <label>Несколько слов о задаче<textarea name="message" rows="4" maxlength="5000" required><?= $e($formValues['message']) ?></textarea></label>
      <div class="a-honeypot" aria-hidden="true"><label>Ваш сайт<input name="website" tabindex="-1" autocomplete="off"></label></div>
      <label class="a-consent"><input name="consent" value="1" type="checkbox" required <?= !empty($formValues['consent'])?'checked':'' ?>><span>Согласен с <a href="/privacy/" target="_blank" rel="noopener">условиями обработки данных</a> для ответа на обращение. Оставьте email или телефон.</span></label>
      <button type="submit">Отправить заявку <span>↗</span></button>
    </form>
    <?php else: ?><div class="a-form-notice"><h2>Свяжитесь напрямую</h2><p>Форма временно недоступна. Контактные данные указаны на этой странице.</p></div><?php endif;
    $options['form']=ob_get_clean();
}
if($path==='request-success'){$ref=(string)($_GET['ref']??'');if(($_SESSION['business_receipts'][$ref]??0)>time()-86400)$options['receipt']=$ref;}
$paths=[];foreach($pages as $p)if(str_starts_with($p['cover']??'','/uploads/content/'))$paths[]=ltrim($p['cover'],'/');
foreach(array_chunk(array_unique($paths),200)as $chunk)foreach($db->all('SELECT path,width,metadata FROM byp_media WHERE path IN ('.implode(',',array_fill(0,count($chunk),'?')).')',$chunk)as $im){$m=json_decode($im['metadata']??'{}',true);Content::$images['/'.$im['path']]=['width'=>(int)$im['width'],'variants'=>$m['variants']??[]];}
Atelier::render($pages,$settings,$path,'',$options);
