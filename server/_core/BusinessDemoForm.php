<?php
declare(strict_types=1);
namespace BYPCMS\Core;
require_once __DIR__.'/BusinessLead.php';
require_once __DIR__.'/Content.php';

/** No production CRM, outgoing messages or personal data persistence. */
final class BusinessDemoForm {
    public static function handle(array $pages,string $base,string $snapshot,string $path,array &$options):bool {
        $_SESSION['csrf']??=bin2hex(random_bytes(24));$_SESSION['corporate_forms']??=[];
        foreach(array_keys($_SESSION['corporate_forms']) as $key)if($key!=='public'&&(!isset($_SESSION['snapshots'][$key])||$_SESSION['snapshots'][$key]['expires']<time()))unset($_SESSION['corporate_forms'][$key]);
        $key=$snapshot?:'public';$_SESSION['corporate_forms'][$key]??=['tokens'=>[],'receipts'=>[]];$state=&$_SESSION['corporate_forms'][$key];
        $state['tokens']=array_filter($state['tokens'],fn($t)=>$t>time()-3600);$state['receipts']=array_filter($state['receipts'],fn($r)=>$r['time']>time()-86400);
        $href=static fn(string $p,array $q=[])=>$base.$p.(($q+($snapshot?['snapshot'=>$snapshot]:[]))?'?'.http_build_query($q+($snapshot?['snapshot'=>$snapshot]:[])):'');
        $lookup=static function(int $id,string $kind)use($pages){foreach($pages as $p)if((int)$p['id']===$id&&$p['kind']===$kind&&Corporate::published($p))return $p;return null;};
        if($path==='request-success'){$ref=is_scalar($_GET['ref']??'')?(string)($_GET['ref']??''):'';if(isset($state['receipts'][$ref]))$options['receipt']=$ref;return false;}
        if($path!=='contact')return false;
        $error='';$status=422;$values=[];foreach($_POST??[] as $field=>$value)if(is_scalar($value))$values[$field]=mb_substr((string)$value,0,$field==='message'?5000:200);
        if(($_SERVER['REQUEST_METHOD']??'GET')==='POST')try{
            if((int)($_SERVER['CONTENT_LENGTH']??0)>65536)throw new \RuntimeException('Форма слишком большая.');
            if(!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['csrf'],$_POST['csrf'])){$status=403;throw new \RuntimeException('Сессия формы истекла. Обновите страницу и повторите отправку.');}
            $data=BusinessLead::input($_POST);$token=$_POST['request_token'];$hash=hash('sha256',json_encode($data,JSON_THROW_ON_ERROR));$existing=null;
            foreach($state['receipts'] as $ref=>$receipt)if($receipt['token']===$token){if(!hash_equals($receipt['hash'],$hash))throw new \RuntimeException('Эта заявка уже сохранена с другими данными. Откройте новую форму.');$existing=$ref;break;}
            if($existing===null){
                if(!isset($state['tokens'][$token]))throw new \RuntimeException('Форма устарела. Обновите страницу перед отправкой.');
                foreach(['service_id'=>'service','project_id'=>'project'] as $field=>$kind)if($data[$field]&&!$lookup($data[$field],$kind))throw new \RuntimeException('Выбранная услуга или проект недоступны.');
                if(count(array_filter($state['receipts'],fn($r)=>$r['time']>time()-3600))>=10)throw new \RuntimeException('Слишком много тестовых заявок. Повторите позже.');
                $existing=strtoupper(bin2hex(random_bytes(8)));$state['receipts'][$existing]=['token'=>$token,'hash'=>$hash,'time'=>time()];unset($state['tokens'][$token]);
            }
            $url=$href('/request-success/',['ref'=>$existing]);
            if(str_contains($_SERVER['HTTP_ACCEPT']??'','application/json')){header('Content-Type: application/json; charset=utf-8');echo json_encode(['ok'=>true,'url'=>$url]);}else header('Location: '.$url,true,303);return true;
        }catch(\Throwable $exception){$error=$exception->getMessage();if(str_contains($_SERVER['HTTP_ACCEPT']??'','application/json')){http_response_code($status);header('Content-Type: application/json; charset=utf-8');echo json_encode(['ok'=>false,'error'=>$error]);return true;}$options['http_status']=$status;}
        foreach(['service_id'=>'service','project_id'=>'project'] as $field=>$kind){$queryKey=$kind==='service'?'service':'project';$raw=$values[$field]??$_GET[$queryKey]??'';$values[$field]=is_scalar($raw)&&ctype_digit((string)$raw)?(int)$raw:0;if($values[$field]&&!$lookup($values[$field],$kind)){$error=$error?:'Выбранное направление недоступно. Выберите услугу из списка.';$values[$field]=0;}}
        $project=$values['project_id']?$lookup($values['project_id'],'project'):null;if($project&&!$values['service_id']&&!empty($project['parent_id'])&&$lookup((int)$project['parent_id'],'service'))$values['service_id']=(int)$project['parent_id'];
        $token=$values['request_token']??'';if(!isset($state['tokens'][$token]))$token=bin2hex(random_bytes(16));if(count($state['tokens'])>=20)array_shift($state['tokens']);$state['tokens'][$token]=time();$e=[Content::class,'e'];
        ob_start(); ?><form id="business-request" method="post" action="<?= $e($href('/contact/')) ?>"><p class="co-form-note">Демонстрационная форма. Используйте тестовые данные: письма не отправляются, контактные данные не сохраняются в CRM.</p><p role="alert" class="a-form-error" <?= $error?'':'hidden' ?>><?= $e($error) ?></p><input type="hidden" name="csrf" value="<?= $e($_SESSION['csrf']) ?>"><input type="hidden" name="request_token" value="<?= $e($token) ?>"><input type="hidden" name="project_id" value="<?= $values['project_id'] ?>"><?php if($project): ?><p>Проект: <?= $e($project['title']) ?></p><?php endif ?><label>Ваше имя<input name="name" required maxlength="150" autocomplete="off" value="<?= $e($values['name']??'') ?>" placeholder="Тестовый посетитель"></label><label>Email<input name="email" type="email" maxlength="190" autocomplete="off" value="<?= $e($values['email']??'') ?>" placeholder="visitor@example.test"></label><label>Телефон<input name="phone" type="tel" maxlength="60" autocomplete="off" value="<?= $e($values['phone']??'') ?>" placeholder="Можно оставить только email"></label><label>Направление<select name="service_id"><option value="">Хочу обсудить задачу</option><?php foreach($pages as $p)if($p['kind']==='service'&&Corporate::published($p)): ?><option value="<?= (int)$p['id'] ?>" <?= $values['service_id']===(int)$p['id']?'selected':'' ?>><?= $e($p['title']) ?></option><?php endif ?></select></label><label>Несколько слов о задаче<textarea name="message" rows="4" required maxlength="5000"><?= $e($values['message']??'') ?></textarea></label><div class="a-honeypot" aria-hidden="true"><label>Ваш сайт<input name="website" tabindex="-1" autocomplete="off"></label></div><label class="a-consent"><input type="checkbox" name="consent" value="1" required <?= ($values['consent']??'')==='1'?'checked':'' ?>><span>Понимаю, что это тестовая заявка без отправки сообщений. <a href="<?= $e($href('/privacy/')) ?>" target="_blank" rel="noopener">О демонстрации и данных</a>.</span></label><button type="submit">Отправить тестовую заявку ↗</button></form><?php
        $options['form']=ob_get_clean();return false;
    }
}
