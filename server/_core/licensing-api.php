<?php
declare(strict_types=1);

use BYPCMS\Core\LicenseAuthority;
use BYPCMS\Core\LicenseClient;
use BYPCMS\Core\LicenseException;
use BYPCMS\Core\Response;

require_once __DIR__.'/LicenseAuthority.php';
require_once __DIR__.'/LicenseClient.php';

function byp_license_authority($db, array $config, ?array $user = null): LicenseAuthority {
    return new LicenseAuthority($db->pdo(), BYPCMS_STORAGE, $config,
        static fn(string $action, int $id, array $meta=[]) => byp_audit($db,$user,$action,'license',$id,$meta));
}
function byp_license_status(array $config): array {
    if (($config['app']['installation_type']??'platform')!=='client') return ['state'=>'platform','edition'=>$config['app']['edition']??'platform','domain'=>parse_url($config['app']['url'],PHP_URL_HOST),'can_update'=>false,'public_site_available'=>true];
    return (new LicenseClient(BYPCMS_ROOT,$config))->status();
}
function byp_license_route(string $action, string $method, array $input, $db, array $config, ?array $user): void {
    if (str_starts_with($action,'licensing.')) {
        if ($user!==null) return;
        if ($method!=='POST') Response::error('Требуется POST',405);
        $authority=byp_license_authority($db,$config);
        $authority->limit((string)($_SERVER['REMOTE_ADDR']??''),time());
        // Server-to-server authentication uses the key or activation credential, not a browser session.
        session_write_close();
        $result=match($action){
            'licensing.challenge'=>$authority->challenge($input,time()),
            'licensing.activate'=>$authority->activate($input,time()),
            'licensing.check'=>$authority->check($input,time()),
            'licensing.release'=>$authority->check($input,time(),true),
            default=>throw new LicenseException('Маршрут лицензирования не найден.',404),
        };
        Response::ok($result);
    }
    if ($user===null) return;
    if (str_starts_with($action,'license.')) {
        if ($action==='license.status' && $method==='GET') {
            if (($config['app']['installation_type']??'platform')==='client' && ($user['role']??'')==='owner') {
                $client=new LicenseClient(BYPCMS_ROOT,$config);
                if ($client->due()) {session_write_close();try {$client->refresh();}catch(Throwable $error){/* Signed cache remains available; status includes the last error. */}}
            }
            Response::ok(['license'=>byp_license_status($config)]);
        }
        if ($method!=='POST') Response::error('Требуется POST',405);
        if (($user['role']??'')!=='owner') Response::error('Активация доступна владельцу установки',403);
        if (($config['app']['installation_type']??'platform')!=='client') throw new LicenseException('Платформа выпускает лицензии. Активация выполняется в установленной CMS.',409);
        $client=new LicenseClient(BYPCMS_ROOT,$config);
        session_write_close();
        $result=match($action){
            'license.activate'=>$client->activate((string)($input['key']??''),(string)($input['operation_id']??'')),
            'license.check'=>$client->refresh(),
            'license.release'=>$client->release(),
            default=>throw new LicenseException('Действие не найдено.',404),
        };
        Response::ok(['license'=>$result]);
    }
    if (in_array($action,['owner.license.key','owner.license.rotate','owner.license.renew','owner.license.release'],true)) {
        if ($method!=='POST') Response::error('Требуется POST',405);
        if (($user['role']??'')!=='owner') Response::error('Доступно только владельцу',403);
        $authority=byp_license_authority($db,$config,$user);$id=(int)($input['id']??0);
        if ($action==='owner.license.key') Response::ok(['key'=>$authority->reveal($id)]);
        $operation=substr($action,strlen('owner.license.'));
        $result=$authority->operation($id,$operation,(string)($input['operation_id']??''),(int)$user['id'],time());
        if ($operation==='rotate') $result['key']=$authority->reveal($id);
        Response::ok($result);
    }
}
