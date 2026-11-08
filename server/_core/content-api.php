<?php
declare(strict_types=1);
use BYPCMS\Core\{Content,Response};
require_once __DIR__.'/Content.php';
$user=$auth->requireUser();
if(!in_array($user['role'],['owner','admin','editor'],true))Response::error('Нет прав для работы с контентом.',403);
if($method!=='GET')$auth->verifyCsrf();
$content=new Content($db,$config,BYPCMS_ROOT);
try {
    if(in_array($action,['content.list','pages.list'],true))Response::ok(['pages'=>$content->records(false,true,50,(max(1,(int)($_GET['page']??1))-1)*50),'terms'=>$content->terms(),'settings'=>$content->settings()]);
    if(in_array($action,['content.save','pages.create','pages.update'],true)&&$method==='POST')Response::ok(['id'=>$content->save($input,(int)$user['id'])]);
    if($action==='content.revisions')Response::ok(['revisions'=>$db->all('SELECT id,page_id,snapshot,created_at FROM byp_page_revisions WHERE page_id=? ORDER BY id DESC LIMIT 50',[(int)($_GET['id']??0)])]);
    if($action==='content.restore'&&$method==='POST')Response::ok(['id'=>$content->restore((int)$input['id'],(int)$input['revision'],(int)$user['id'])]);
    if($action==='content.preview'&&$method==='POST') {
        if(strlen(json_encode($input))>600000)throw new RuntimeException('Материал слишком большой.');
        $id=(int)($input['id']??0);$p=array_merge($id?($content->get($id)??[]):[],$input);$p['id']=$id?:-1;$p['title']=mb_substr(trim($p['title']??'')?:'Новый материал',0,255);$p['slug']=$p['slug']?:'new-preview';$p['kind']=$p['kind']??'article';$p['content']=Content::html($p['content']??'');$p['blocks']=is_array($p['blocks']??null)?$p['blocks']:[];$p['published_at']=$p['published_at']??gmdate('Y-m-d H:i:s');
        $token=bin2hex(random_bytes(20));$_SESSION['content_previews']=array_filter($_SESSION['content_previews']??[],fn($s)=>$s['expires']>time());if(count($_SESSION['content_previews'])>=8)array_shift($_SESSION['content_previews']);
        $_SESSION['content_previews'][$token]=['page'=>$p,'expires'=>time()+1800];Response::ok(['url'=>'/?preview_token='.$token]);
    }
    if($action==='media.list')Response::ok($content->media($_GET));
    if($action==='media.upload'&&$method==='POST')Response::ok(['file'=>$content->upload($_FILES['file']??[],(int)$user['id'])]);
    if($action==='media.alt'&&$method==='POST'){$db->execute('UPDATE byp_media SET alt_text=? WHERE id=?',[mb_substr($input['alt']??'',0,500),(int)$input['id']]);Response::ok();}
    if($action==='media.delete'&&$method==='POST'){
        $file=$db->one('SELECT * FROM byp_media WHERE id=?',[(int)$input['id']]);if(!$file)throw new RuntimeException('Файл не найден.');
        if($db->one('SELECT id FROM byp_page_revisions WHERE snapshot LIKE ? LIMIT 1',['%'.basename($file['path']).'%']))throw new RuntimeException('Файл используется в истории версий. Его удаление нарушит восстановление.');
        if($db->one('SELECT p.id FROM byp_pages p LEFT JOIN byp_content_meta m ON m.page_id=p.id WHERE p.content LIKE ? OR p.blocks LIKE ? OR m.data LIKE ? LIMIT 1',array_fill(0,3,'%'.basename($file['path']).'%')))throw new RuntimeException('Файл используется в материале. Сначала замените его.');
        if(preg_match('#^uploads/content/[a-f0-9]{32}\.(jpg|png|webp|gif|pdf)$#D',$file['path'])&&is_file(BYPCMS_ROOT.'/'.$file['path'])&&!unlink(BYPCMS_ROOT.'/'.$file['path']))throw new RuntimeException('Не удалось удалить файл.');
        $meta=json_decode($file['metadata']??'{}',true);foreach($meta['variants']??[]as $variant)if(preg_match('#^uploads/content/'.preg_quote(pathinfo($file['path'],PATHINFO_FILENAME),'#').'-(480|1280)\.webp$#D',$variant['path'])&&is_file(BYPCMS_ROOT.'/'.$variant['path']))unlink(BYPCMS_ROOT.'/'.$variant['path']);
        $db->execute('DELETE FROM byp_media WHERE id=?',[$file['id']]);Response::ok();
    }
    if($action==='content.term'&&$method==='POST')Response::ok(['id'=>$content->termSave($input)]);
    if($action==='content.configure'&&$method==='POST'){if(!in_array($user['role'],['owner','admin'],true))Response::error('Настройки доступны администратору.',403);$content->configure($input);Response::ok();}
    Response::error('Неизвестное действие Content.',404);
}catch(Throwable $error){Response::error($error instanceof PDOException?'Не удалось сохранить запись. Проверьте уникальность адреса.':$error->getMessage(),422);}
