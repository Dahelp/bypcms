<?php
declare(strict_types=1);
use BYPCMS\Core\{Business,Response};
require_once __DIR__.'/Business.php';
$business=new Business($db,$config,BYPCMS_ROOT);
$user=$auth->requireUser();
if(!in_array($user['role'],['owner','admin','editor','manager'],true))Response::error('Нет доступа к CRM.',403);
if($method!=='GET')$auth->verifyCsrf();
try {
    if($action==='business.lead')Response::ok(['lead'=>$business->lead((int)($_GET['id']??0),$user)]);
    if($action==='business.leads'){
        $where=$user['role']==='manager'?' WHERE (l.assignee_id IS NULL OR l.assignee_id=?)':'';$params=$user['role']==='manager'?[$user['id']]:[];
        Response::ok(['leads'=>$db->all('SELECT l.*,m.state mail_state,m.last_error FROM byp_business_leads l LEFT JOIN byp_business_mail m ON m.lead_id=l.id'.$where.' ORDER BY l.id DESC LIMIT 50 OFFSET '.((max(1,(int)($_GET['page']??1))-1)*50),$params)]);
    }
    if($action==='business.lead.save'&&$method==='POST'){$business->updateLead($input,$user);Response::ok();}
    if(in_array($action,['business.mail.settings','business.mail.save','business.mail.send'],true)){
        if(!in_array($user['role'],['owner','admin'],true))Response::error('Почта доступна администратору.',403);
        if($action==='business.mail.settings')Response::ok(['settings'=>$business->mailSettings()]);
        if($method==='POST'&&$action==='business.mail.save'){$business->configureMail($input);Response::ok(['settings'=>$business->mailSettings()]);}
        if($method==='POST'&&$action==='business.mail.send'){$business->sendMail((int)$input['id'],!empty($input['acknowledge']));Response::ok();}
    }
    Response::error('Неизвестное действие Business.',404);
}catch(Throwable $e){Response::error($e instanceof PDOException?'Не удалось обработать запрос CRM.':$e->getMessage(),422);}
