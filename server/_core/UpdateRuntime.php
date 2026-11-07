<?php
declare(strict_types=1);
namespace BYPCMS\Core;

/** Stable bootstrap: deliberately outside replaceable releases. */
final class UpdateRuntime {
    /** Static files can bypass Apache on Nginx proxy hosting: private bytes stay outside DocumentRoot. */
    public static function storage(string $root,bool $create=false):string {
        $root=realpath($root)?:$root;$config=is_file($root.'/_storage/config.php')?require $root.'/_storage/config.php':[];
        $documentRoot=(string)($_SERVER['DOCUMENT_ROOT']??'');$web=$documentRoot!==''?(realpath($documentRoot)?:$root):$root;
        $path=$config['updates']['private_dir']??dirname($web).'/.bypcms-private-'.substr(hash_hmac('sha256',$root,(string)($config['app']['key']??'uninstalled')),0,24);
        if(!is_string($path)||!preg_match('#^(?:[A-Za-z]:[\\\\/]|/)#',$path))throw new \RuntimeException('Задайте абсолютный updates.private_dir вне DocumentRoot.');
        if(!$create&&!is_dir($path)&&(is_file($root.'/_storage/updates/active.json')||is_file($root.'/_storage/updates/maintenance.json')))return self::storage($root,true);
        if($create&&!is_dir($path)&&!@mkdir($path,0750,true))throw new \RuntimeException('Не удалось создать приватное хранилище вне DocumentRoot. Настройте updates.private_dir у хостинга.');
        $resolved=realpath($path);if($resolved){$normalized=str_replace('\\','/',$resolved);foreach([$root,$web]as $public){$prefix=rtrim(str_replace('\\','/',$public),'/');if(strcasecmp($normalized,$prefix)===0||str_starts_with(strtolower($normalized),strtolower($prefix).'/'))throw new \RuntimeException('Приватное хранилище не должно находиться в публичном каталоге.');}$path=$resolved;}
        if($create){
            if(!is_writable($path))throw new \RuntimeException('Приватное хранилище недоступно для записи.');
            foreach(['updates'=>'updates','update-feed'=>'feed']as $old=>$new){$legacy=$root.'/_storage/'.$old;$target=$path.'/'.$new;if(is_dir($legacy)&&!is_dir($target)&&!@rename($legacy,$target))throw new \RuntimeException('Не удалось перенести прежнее хранилище. Данные сохранены; нужна проверка прав и раздела диска.');}
        }return $path;
    }
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
        $p=self::json(self::storage($root).'/updates/active.json');
        if($p && (!preg_match('/^[a-f0-9]{32}$/D',$p['release']??'')||!preg_match('/^\d+\.\d+\.\d+$/D',$p['version']??'')))throw new \RuntimeException('Повреждён указатель версии.');return $p;
    }
    public static function code(string $root):string { $p=self::pointer($root);return $p?$root.'/_releases/'.$p['release']:$root; }
    public static function serve(string $root,string $entry):void {
        $root=realpath($root);$dir=self::storage($root).'/updates';
        $health=false;$maintenance=self::json($dir.'/maintenance.json');
        if($maintenance&&is_string($_SERVER['HTTP_X_UPDATE_HEALTH']??null))$health=hash_equals($maintenance['token'],$_SERVER['HTTP_X_UPDATE_HEALTH']);
        if(!$health){
            if(!is_dir($root.'/_storage'))mkdir($root.'/_storage',0750,true);
            $lock=fopen($root.'/_storage/update-runtime.lock','c');
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
