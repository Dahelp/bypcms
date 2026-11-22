<?php
declare(strict_types=1);
use BYPCMS\Core\{ClientWorkspace,Response,Business,Content};
require_once __DIR__.'/ClientWorkspace.php';
if(($config['app']['installation_type']??'platform')!=='client')Response::error('Панель предназначена для клиентской установки.',403);
$who=$auth->requireUser();if(!in_array($who['role'],['owner','admin','editor','manager'],true))Response::error('Нет доступа к панели сайта.',403);
if($method!=='GET')$auth->verifyCsrf();
$operation=substr($action,strlen('client.workspace.'));$section=(string)($method==='GET'?($_GET['section']??'pages'):($input['section']??'pages'));
try{
    $workspace=new ClientWorkspace($db,$config,$auth,BYPCMS_ROOT,$who);
    if($operation==='bootstrap'&&$method==='GET')Response::ok($workspace->manifest());
    if($operation==='list'&&$method==='GET')Response::ok($workspace->listing($section,$_GET));
    if($operation==='record'&&$method==='GET')Response::ok(['record'=>$workspace->describe($workspace->get((int)($_GET['id']??0),$section))]);
    if($operation==='new'&&$method==='GET'){
        $kind=$workspace->kind($section);if(in_array($section,$workspace->project?->manifest()['fixed_sections']??[],true))throw new DomainException('Структура этой темы фиксирована.');
        Response::ok(['record'=>$workspace->describe(['id'=>0,'revision'=>0,'kind'=>$kind,'title'=>'','slug'=>'','excerpt'=>'','content'=>'','blocks'=>[],'status'=>'draft','cover'=>''])]);
    }
    if($operation==='save'&&$method==='POST')Response::ok($workspace->save($section,(array)($input['record']??[])));
    if($operation==='bulk'&&$method==='POST')Response::ok($workspace->bulk($section,$input));
    $settingsResult=static function()use($workspace,$section){$result=$workspace->settings($section);$fields=array_values(array_filter($result['fields'],fn($field)=>!($field['readonly']??false)));$result['revision']=hash('sha256',json_encode($fields,JSON_THROW_ON_ERROR));return $result;};
    if($operation==='settings'&&$method==='GET')Response::ok($settingsResult());
    if($operation==='settings.save'&&$method==='POST'){
        $pdo=$db->pdo();$pdo->beginTransaction();try{
            $db->all('SELECT setting_group,setting_key FROM byp_settings ORDER BY setting_group,setting_key FOR UPDATE');$db->all('SELECT id FROM byp_modules ORDER BY id FOR UPDATE');
            $before=$settingsResult();if(!is_string($input['revision']??null)||!hash_equals($before['revision'],$input['revision']))throw new RuntimeException('Настройки изменены в другой вкладке. Ваш ввод сохранён в форме; обновите страницу перед повтором.');
            $values=(array)($input['values']??[]);if($section==='delivery'&&!empty($values['retry_id'])){$pdo->commit();$workspace->saveSettings($section,$values);}else{$workspace->saveSettings($section,$values);$pdo->commit();}
        }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();throw $error;}
        Response::ok($settingsResult());
    }
    if($operation==='preview'&&$method==='POST'){
        $record=(array)($input['record']??[]);$previous=!empty($record['id'])?$workspace->get((int)$record['id'],$section):null;$workspace->kind($section);
        if($workspace->project)$record=$workspace->project->prepare($record,$previous);
        $record=$workspace->content->validate($record);$token=bin2hex(random_bytes(20));$_SESSION['content_previews']=array_filter($_SESSION['content_previews']??[],fn($row)=>$row['expires']>time());
        if(count($_SESSION['content_previews'])>=8)array_shift($_SESSION['content_previews']);$_SESSION['content_previews'][$token]=['page'=>$record,'expires'=>time()+600];Response::ok(['url'=>'/?preview_token='.$token]);
    }
    if($operation==='revisions'&&$method==='GET'){$record=$workspace->get((int)($_GET['id']??0),$section);Response::ok(['rows'=>$db->all('SELECT id,created_at FROM byp_page_revisions WHERE page_id=? ORDER BY id DESC LIMIT 50',[$record['id']])]);}
    if($operation==='restore'&&$method==='POST'){
        $record=$workspace->get((int)($input['id']??0),$section);
        if((int)($input['expected_revision']??0)!==$record['revision'])throw new RuntimeException('Запись уже изменена. Обновите её перед восстановлением.');
        if($workspace->project){$row=$db->one('SELECT snapshot FROM byp_page_revisions WHERE id=? AND page_id=?',[(int)($input['revision']??0),$record['id']]);if(!$row)throw new RuntimeException('Версия не найдена.');$snapshot=json_decode($row['snapshot'],true,32,JSON_THROW_ON_ERROR);$snapshot['id']=$record['id'];$snapshot['revision']=$record['revision'];$workspace->save($section,$snapshot);}else $workspace->content->restore($record['id'],(int)($input['revision']??0),(int)$who['id']);Response::ok(['record'=>$workspace->describe($workspace->content->get($record['id']))]);
    }
    if($operation==='leads'&&$method==='GET'){
        $workspace->assertSection('leads');$where=[];$params=[];if($who['role']==='manager'){$where[]='(l.assignee_id IS NULL OR l.assignee_id=?)';$params[]=$who['id'];}
        if(!empty($_GET['q'])){$where[]='(l.name LIKE ? OR l.reference LIKE ?)';$params[]='%'.mb_substr((string)$_GET['q'],0,100).'%';$params[]=end($params);}
        if(!empty($_GET['status'])){$where[]='l.status=?';$params[]=(string)$_GET['status'];}$sql=$where?' WHERE '.implode(' AND ',$where):'';
        $total=(int)$db->one('SELECT COUNT(*) n FROM byp_business_leads l'.$sql,$params)['n'];$pages=max(1,(int)ceil($total/12));$page=min($pages,max(1,(int)($_GET['page']??1)));
        Response::ok(['rows'=>$db->all('SELECT l.*,m.state mail_state FROM byp_business_leads l LEFT JOIN byp_business_mail m ON m.lead_id=l.id'.$sql.' ORDER BY l.id DESC LIMIT 12 OFFSET '.(($page-1)*12),$params),'total'=>$total,'pages'=>$pages,'page'=>$page,'states'=>Business::STATES]);
    }
    if($operation==='lead'&&$method==='GET'){$workspace->assertSection('leads');Response::ok(['record'=>(new Business($db,$config,BYPCMS_ROOT))->lead((int)($_GET['id']??0),$who),'states'=>Business::STATES,'users'=>$db->all('SELECT u.id,u.name FROM byp_users u JOIN byp_roles r ON r.id=u.role_id WHERE u.status="active" AND r.slug IN ("owner","admin","editor","manager")')]);}
    if($operation==='lead.save'&&$method==='POST'){$workspace->assertSection('leads');(new Business($db,$config,BYPCMS_ROOT))->updateLead((array)($input['record']??[]),$who);Response::ok();}
    if($operation==='lead.bulk'&&$method==='POST'){
        $workspace->assertSection('leads');$ids=array_values(array_unique(array_map('intval',(array)($input['ids']??[]))));if(!$ids||count($ids)>100)throw new InvalidArgumentException('Выберите до 100 заявок.');$ok=[];$failed=[];$business=new Business($db,$config,BYPCMS_ROOT);
        foreach($ids as $id)try{$row=$business->lead($id,$who);$row['status']=$input['status']??'';if($who['role']==='manager')$row['assignee_id']=$who['id'];$business->updateLead($row,$who);$ok[]=$id;}catch(Throwable $e){$failed[]=['id'=>$id,'error'=>$e instanceof PDOException?'Запись временно недоступна.':$e->getMessage()];}Response::ok(['succeeded'=>$ok,'failed'=>$failed]);
    }
    if($operation==='overview'&&$method==='GET'){
        $workspace->assertSection('overview');$manifest=$workspace->manifest();$counts=[];foreach(['pages','articles','services','projects','team']as $kind)if(in_array($kind,array_column($manifest['navigation'],'id'),true))$counts[$kind]=$workspace->listing($kind,[])['total'];
        Response::ok(['counts'=>$counts,'theme'=>$manifest['theme'],'version'=>$manifest['version']]);
    }
    if($operation==='users'&&$method==='GET'){
        $workspace->assertSection('users');Response::ok(['rows'=>$db->all('SELECT u.id,u.name,u.email,u.status,r.slug role,r.name role_name FROM byp_users u JOIN byp_roles r ON r.id=u.role_id ORDER BY u.id LIMIT 100')]);
    }
    if($operation==='users.save'&&$method==='POST'){
        $workspace->saveUser((array)($input['record']??[]));Response::ok();
    }
    if(in_array($operation,['terms','terms.save'],true)&&!in_array($section,['categories','authors'],true))throw new DomainException('Выберите рубрики или авторов.');
    if($operation==='terms'&&$method==='GET'){$workspace->assertSection($section);Response::ok(['rows'=>array_values(array_filter($workspace->content->terms(),fn($r)=>$r['kind']===($section==='authors'?'author':'category')))]);}
    if($operation==='terms.save'&&$method==='POST'){$workspace->assertSection($section);$record=(array)($input['record']??[]);$record['kind']=$section==='authors'?'author':'category';Response::ok(['id'=>$workspace->content->termSave($record)]);}
    if($operation==='redirects'&&$method==='GET'){$workspace->assertSection('seo');Response::ok(['rows'=>$db->all('SELECT id,source,target,code FROM byp_content_redirects ORDER BY id DESC LIMIT 100')]);}
    if($operation==='redirects.save'&&$method==='POST'){
        $workspace->assertSection('seo');if(!$workspace->administrator())throw new DomainException('Редиректы доступны администратору.');
        $source='/'.trim((string)($input['source']??''),'/').'/';$target=Content::url((string)($input['target']??''));if(!preg_match('#^/[a-z0-9/-]+/$#D',$source)||!$target||$source===$target)throw new InvalidArgumentException('Проверьте исходный адрес и цель.');
        $cursor=$target;$seen=[$source];for($i=0;$i<30;$i++){if(in_array($cursor,$seen,true))throw new InvalidArgumentException('Редирект создаёт цикл.');$seen[]=$cursor;$row=$db->one('SELECT target FROM byp_content_redirects WHERE source=?',[$cursor]);if(!$row)break;$cursor=$row['target'];}
        $db->execute('INSERT INTO byp_content_redirects(source,target,code) VALUES(?,?,301) ON DUPLICATE KEY UPDATE target=VALUES(target)',[$source,$target]);Response::ok();
    }
    Response::error('Действие панели не найдено.',404);
}catch(DomainException $e){Response::error($e->getMessage(),403);}catch(Throwable $e){Response::error($e instanceof PDOException?'Не удалось сохранить данные. Проверьте адрес записи или повторите позже.':$e->getMessage(),422);}
