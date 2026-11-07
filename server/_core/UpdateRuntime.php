<?php
declare(strict_types=1);
namespace BYPCMS\Core;

/** Stable bootstrap: deliberately outside replaceable releases. */
final class UpdateRuntime {
    public static function json(string $file,array $default=[]):array {
        if(!is_file($file))return $default;
        $data=json_decode((string)file_get_contents($file),true,64,JSON_THROW_ON_ERROR);
        if(!is_array($data))throw new \RuntimeException('Повреждены данные обновления. Откройте восстановление.');return $data;
    }
    public static function atomic(string $file,array $data):void {
        $tmp=$file.'.'.bin2hex(random_bytes(5)).'.tmp';
        if(file_put_contents($tmp,json_encode($data,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),LOCK_EX)===false||!rename($tmp,$file))throw new \RuntimeException('Не удалось сохранить состояние обновления.');
        @chmod($file,0600);clearstatcache(true,$file);
    }
    public static function pointer(string $root):array {
        $p=self::json($root.'/_storage/updates/active.json');
        if($p && (!preg_match('/^[a-f0-9]{32}$/D',$p['release']??'')||!preg_match('/^\d+\.\d+\.\d+$/D',$p['version']??'')))throw new \RuntimeException('Повреждён указатель версии.');return $p;
    }
    public static function code(string $root):string { $p=self::pointer($root);return $p?$root.'/_releases/'.$p['release']:$root; }
    public static function serve(string $root,string $entry):void {
        $root=realpath($root);$dir=$root.'/_storage/updates';if(!is_dir($dir))mkdir($dir,0750,true);
        $health=false;$maintenance=self::json($dir.'/maintenance.json');
        if($maintenance&&is_string($_SERVER['HTTP_X_UPDATE_HEALTH']??null))$health=hash_equals($maintenance['token'],$_SERVER['HTTP_X_UPDATE_HEALTH']);
        if(!$health){
            $lock=fopen($dir.'/runtime.lock','c');
            if(!$lock||!flock($lock,LOCK_SH|LOCK_NB)||$maintenance){
                http_response_code(503);header('Retry-After: 30');header('Cache-Control: no-store');
                if(str_starts_with($entry,'api/')){header('Content-Type: application/json');echo json_encode(['ok'=>false,'error'=>'Выполняется обновление. Откройте восстановление, если процесс прервался.','details'=>['code'=>'updating']]);}
                else echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><h1>Сайт обновляется</h1><p>Пожалуйста, подождите.</p><a href="/updates/recovery.php">Восстановление для владельца</a>';
                exit;
            }
            register_shutdown_function(static function()use($lock){flock($lock,LOCK_UN);fclose($lock);});
            // Re-read under the lock: a maintenance marker may have appeared meanwhile.
            if(self::json($dir.'/maintenance.json')){http_response_code(503);header('Retry-After: 30');exit('Выполняется обновление. /updates/recovery.php');}
        }
        define('BYPCMS_SITE_ROOT',$root);$code=self::code($root);$target=$code.'/'.$entry;
        if(!is_file($target)){http_response_code(503);exit('Версия недоступна. Откройте /updates/recovery.php');}
        if(str_ends_with($entry,'.html')){header('Cache-Control: no-store');readfile($target);}else require $target;
    }
}
