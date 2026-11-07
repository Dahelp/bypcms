<?php
declare(strict_types=1);
use BYPCMS\Core\{UpdateRuntime,UpdateEngine,UpdatePublisher,LicenseAuthority,LicenseCrypto,Database,Auth,Response};
$root=dirname(__DIR__);
foreach(['Response','Database','Auth','UpdateEngine','UpdatePublisher']as $class)require_once $root.'/_core/'.$class.'.php';
header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('X-Frame-Options: SAMEORIGIN');
$config=is_file($root.'/_storage/config.php')?require $root.'/_storage/config.php':null;if(!is_array($config))Response::error('Сначала установите CMS',503);
session_name('bypcms_session');session_set_cookie_params(['path'=>'/','secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off','httponly'=>true,'samesite'=>'Lax']);session_start();$_SESSION['csrf']??=bin2hex(random_bytes(24));
$action=(string)($_GET['action']??'status');$method=$_SERVER['REQUEST_METHOD']??'GET';$input=json_decode((string)file_get_contents('php://input'),true);if(!is_array($input))$input=$_POST;
try{
    $db=new Database($config);$pdo=$db->pdo();$auth=new Auth($db);$engine=new UpdateEngine($root,$pdo,$config);
    if(in_array($action,['updates.catalog','updates.download'],true)){
        if(($config['app']['installation_type']??'platform')==='client')Response::error('Установка не публикует выпуски',403);
        $authority=new LicenseAuthority($pdo,$root.'/_storage',$config);$publisher=new UpdatePublisher($root,$authority);$authority->limit($_SERVER['REMOTE_ADDR']??'',time());session_write_close();
        if($action==='updates.catalog'&&$method==='GET')Response::ok(['catalog'=>$publisher->publicCatalog()]);
        if($action==='updates.download'&&$method==='POST'){
            $receipt=$authority->check($input,time())['receipt'];$trust=$authority->trust();
            $claims=json_decode((string)base64_decode(strtr($receipt['payload'],'-_','+/')),true,32,JSON_THROW_ON_ERROR);
            $claims=LicenseCrypto::verify($receipt,$trust['public_key'],$input['installation_id'],$claims['domain'],$claims['edition'],time());
            $path=$publisher->package((string)($input['id']??''),$claims);header('Content-Type: application/zip');header('Content-Disposition: attachment; filename="bypcms-update.zip"');header('Content-Length: '.filesize($path));readfile($path);exit;
        }
        Response::error('Требуется другой HTTP-метод',405);
    }
    $maintenance=UpdateRuntime::json($root.'/_storage/updates/maintenance.json');$recovery=null;
    if($maintenance){$job=$engine->job($maintenance['job']);if(!empty($job['recovery_owner']))$recovery=json_decode(LicenseCrypto::decrypt($job['recovery_owner'],$config['app']['key']),true,32,JSON_THROW_ON_ERROR);}
    if($action==='csrf'&&$method==='GET')Response::ok(['csrf'=>$_SESSION['csrf']]);
    if($method!=='GET'){
        $csrf=$_SERVER['HTTP_X_CSRF_TOKEN']??($input['csrf']??'');if(!is_string($csrf)||!hash_equals($_SESSION['csrf'],$csrf))Response::error('Недействительный CSRF-токен',403,['code'=>'csrf_expired']);
    }
    if($action==='recover.login'&&$method==='POST'){
        $email=strtolower(trim((string)($input['email']??'')));$password=(string)($input['password']??'');
        $bucket=hash_hmac('sha256',(string)($_SERVER['REMOTE_ADDR']??''),$config['app']['key']);$ratePath=$root.'/_storage/updates/login-'.$bucket.'.json';$rateLock=fopen($ratePath.'.lock','c');flock($rateLock,LOCK_EX);
        try{$rate=UpdateRuntime::json($ratePath,['start'=>time(),'count'=>0]);if($rate['start']<time()-900)$rate=['start'=>time(),'count'=>0];if($rate['count']>=10)Response::error('Повторите вход через 15 минут',429);$rate['count']++;UpdateRuntime::atomic($ratePath,$rate);}finally{flock($rateLock,LOCK_UN);fclose($rateLock);}
        $_SESSION['recovery_attempt_at']=time();$_SESSION['recovery_attempts']=($_SESSION['recovery_attempts']??0)+1;
        $user=null;try{$user=$auth->attempt($email,$password);}catch(Throwable $error){/* A failed migration may have removed the auth tables. */}
        if((!$user||$user['role']!=='owner')&&$recovery&&$email===$recovery['email']&&password_verify($password,$recovery['password_hash'])){session_regenerate_id(true);$_SESSION['user_id']=$recovery['id'];$_SESSION['csrf']=bin2hex(random_bytes(24));$user=$recovery;}
        if(!$user||$user['role']!=='owner')Response::error('Неверный email или пароль владельца',401);
        $_SESSION['recovery_attempts']=0;Response::ok(['csrf'=>$_SESSION['csrf']]);
    }
    $user=null;try{$user=$auth->user();}catch(Throwable $error){}
    if($recovery&&(int)($_SESSION['user_id']??0)===(int)$recovery['id'])$user=$recovery;
    if(!$user)Response::error('Требуется вход владельца',401);if($user['role']!=='owner')Response::error('Доступно только владельцу',403);
    if($action==='status'&&$method==='GET')Response::ok($engine->status());
    if($action==='publisher'&&$method==='GET'){
        if(($config['app']['installation_type']??'platform')==='client')Response::error('Клиентская установка не публикует выпуски',403);
        $publisher=new UpdatePublisher($root,new LicenseAuthority($pdo,$root.'/_storage',$config));$candidate=$root.'/_private/update-candidate.zip';
        Response::ok(['releases'=>$publisher->catalog()['releases'],'candidate'=>is_file($candidate)?\BYPCMS\Core\UpdatePackage::inspect($candidate,null)['version']:null]);
    }
    if($method!=='POST')Response::error('Требуется POST',405);
    ignore_user_abort(true);@set_time_limit(60);session_write_close();
    if($action==='publish'){
        if(($config['app']['installation_type']??'platform')==='client')Response::error('Клиентская установка не публикует выпуски',403);
        $publisher=new UpdatePublisher($root,new LicenseAuthority($pdo,$root.'/_storage',$config));Response::ok(['release'=>$publisher->publish($root.'/_private/update-candidate.zip')]);
    }
    if($action==='check')Response::ok($engine->check());
    if($action==='begin'){
        $owner=$db->one('SELECT id,email,password_hash FROM byp_users WHERE id=?',[$user['id']]);$owner['role']='owner';
        Response::ok(['job'=>$engine->begin((string)($input['package']??''),(string)($input['operation_id']??''),$owner)]);
    }
    if($action==='step')Response::ok(['job'=>$engine->step((string)($input['id']??''))]);
    if($action==='rollback')Response::ok(['job'=>$engine->rollback((string)($input['id']??''))]);
    Response::error('Действие не найдено',404);
}catch(\BYPCMS\Core\LicenseException $error){Response::error($error->getMessage(),$error->httpStatus,['code'=>$error->reason]);}
catch(Throwable $error){Response::error($error->getMessage(),422);}
