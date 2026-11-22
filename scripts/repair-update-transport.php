<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/UpdateRuntime.php';
use BYPCMS\Core\UpdateRuntime;

/** Explicit CLI maintenance only; never called by discovery, cron or an HTTP route. */
function byp_repair_update_transport(string $directory,bool $apply=false,?callable $checkpoint=null,string $profile="transport"):array {
    $root=realpath($directory);if(!$root||!is_file($root.'/_storage/config.php'))throw new RuntimeException('Укажите корень установленной клиентской CMS.');
    $config=require $root.'/_storage/config.php';if(($config['app']['installation_type']??'')!=='client')throw new RuntimeException('Исправление предназначено только для клиентской CMS.');
    $normalize=static fn(string $text)=>str_replace("\r\n","\n",$text);
    $sources=['_core/LicenseHttp.php'=>file_get_contents(__DIR__.'/../server/_core/LicenseHttp.php'),'updates/index.php'=>file_get_contents(__DIR__.'/../server/updates/index.php')];
    $known=['_core/LicenseHttp.php'=>['bee77722b635e7c616fc94c2e1ebd6caaa8182fd77ef4ef7e1dbb71f61589928'],'updates/index.php'=>['ee93b178075d82d4f09227aad9e977ae85b672ac4443e950d5e85379772742e3']];
    // Also accept the immediately preceding endpoint with explicit confirmation and a 60s PHP budget.
    $known['updates/index.php'][]=hash('sha256',$normalize(str_replace('@set_time_limit(150)','@set_time_limit(60)',$sources['updates/index.php'])));
    if($profile==='project'){
        if(($config['app']['edition']??'')!=='business'||!is_file($root.'/project/workspace.php'))throw new RuntimeException('Сначала подключите проектный адаптер клиентской Business.');
        $sources=['_core/UpdateEngine.php'=>file_get_contents(__DIR__.'/../server/_core/UpdateEngine.php')];
        $known=['_core/UpdateEngine.php'=>['b42e631c54c27ca67d843b443d57df6c76124c76043d2cffb92c41e298d40643']];
    }elseif($profile!=='transport')throw new RuntimeException('Неизвестное исправление загрузчика.');
    $private=UpdateRuntime::storage($root,true);$base=$private.'/updates';$handle=fopen($root.'/_storage/update-runtime.lock','c');
    if(!$handle)throw new RuntimeException('Не удалось открыть блокировку установки.');
    if(!flock($handle,LOCK_EX|LOCK_NB)){fclose($handle);throw new RuntimeException('CMS или обновление выполняет запрос. Повторите исправление позже.');}
    try{
        if(is_file($base.'/maintenance.json'))throw new RuntimeException('Сначала завершите обновление или восстановление.');
        foreach(glob($base.'/jobs/*.json')?:[]as $file)if(in_array(UpdateRuntime::json($file)['state']??'',['running','restoring','recovery_required'],true))throw new RuntimeException('Есть незавершённая операция обновления.');
        $changes=[];
        foreach($sources as $path=>$source){
            if(is_link($root.'/'.$path)||!is_file($root.'/'.$path))throw new RuntimeException('Отсутствует обычный файл загрузчика: '.$path);
            token_get_all($source,TOKEN_PARSE);$old=file_get_contents($root.'/'.$path);$hash=hash('sha256',$normalize($old));
            if($hash===hash('sha256',$normalize($source)))continue;
            if(!in_array($hash,$known[$path],true))throw new RuntimeException('Неизвестная или изменённая версия '.$path.'. Автоматическая замена отклонена.');
            $changes[$path]=['old'=>$old,'new'=>$source,'mode'=>fileperms($root.'/'.$path)&0777];
        }
        $result=['applied'=>false,'files'=>array_keys($changes),'backup'=>null];if(!$apply||!$changes)return $result;
        if(stat($root)['dev']!==stat($private)['dev'])throw new RuntimeException('Приватная копия и CMS должны быть на одном файловом разделе.');
        $backup=$private.'/bootstrap-repairs/'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(6));if(!mkdir($backup,0750,true))throw new RuntimeException('Не удалось создать резервную копию загрузчика.');
        $manifest=['state'=>'prepared','files'=>[]];
        foreach($changes as $path=>$change){$saved=$backup.'/'.$path;if(!is_dir(dirname($saved)))mkdir(dirname($saved),0750,true);if(file_put_contents($saved,$change['old'])!==strlen($change['old'])||hash_file('sha256',$saved)!==hash('sha256',$change['old']))throw new RuntimeException('Ошибка проверки резервной копии '.$path);$manifest['files'][$path]=['before'=>hash('sha256',$change['old']),'after'=>hash('sha256',$change['new'])];}
        UpdateRuntime::atomic($backup.'/manifest.json',$manifest);
        $write=static function(string $target,string $bytes,int $mode)use($backup):void{
            $stage=$backup.'/stage-'.bin2hex(random_bytes(6));
            try{if(file_put_contents($stage,$bytes)!==strlen($bytes)||!chmod($stage,$mode?:0600)||!rename($stage,$target))throw new RuntimeException('Не удалось атомарно записать '.$target);}
            finally{if(is_file($stage))unlink($stage);}
        };
        $written=[];
        try{foreach($changes as $path=>$change){$write($root.'/'.$path,$change['new'],$change['mode']);$written[]=$path;if(hash_file('sha256',$root.'/'.$path)!==$manifest['files'][$path]['after'])throw new RuntimeException('Ошибка проверки записанного файла.');if($checkpoint)$checkpoint($path);}
            $manifest['state']='completed';UpdateRuntime::atomic($backup.'/manifest.json',$manifest);
        }catch(Throwable $error){
            $unrestored=[];foreach(array_reverse($written)as $path)try{$write($root.'/'.$path,$changes[$path]['old'],$changes[$path]['mode']);if(hash_file('sha256',$root.'/'.$path)!==$manifest['files'][$path]['before'])throw new RuntimeException('Checksum mismatch');}catch(Throwable){$unrestored[]=$path;}
            $manifest['state']=$unrestored?'recovery_required':'rolled_back';$manifest['unrestored']=$unrestored;UpdateRuntime::atomic($backup.'/manifest.json',$manifest);
            if($unrestored)throw new RuntimeException('Не удалось вернуть все файлы загрузчика. Восстановите их из приватной копии: '.$backup,0,$error);throw $error;
        }
        return ['applied'=>true,'files'=>$result['files'],'backup'=>$backup];
    }finally{flock($handle,LOCK_UN);fclose($handle);}
}
if(realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){
    if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
    try{if(!isset($argv[1])||isset($argv[2])&&$argv[2]!=='--apply')throw new RuntimeException('php scripts/repair-update-transport.php <корень CMS> [--apply]');echo json_encode(byp_repair_update_transport($argv[1],($argv[2]??'')==='--apply'),JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES).PHP_EOL;}
    catch(Throwable $e){fwrite(STDERR,$e->getMessage().PHP_EOL);exit(1);}
}
