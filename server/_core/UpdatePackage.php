<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use RuntimeException;
use ZipArchive;

final class UpdatePackage {
    public const GUARD="<?php http_response_code(403); exit; __halt_compiler();\n";
    public static function payload(string $source,string $target):void {
        $in=fopen($source,'rb');$out=fopen($target,'wb');if(!$in||!$out)throw new RuntimeException('Не удалось открыть подготовленный пакет.');
        try{if(fread($in,strlen(self::GUARD))!==self::GUARD)rewind($in);if(stream_copy_to_stream($in,$out)===false)throw new RuntimeException('Не удалось прочитать пакет.');}finally{fclose($in);fclose($out);}
    }
    public static function sign(array $data,string $private,string $public):array {
        $payload=base64_encode(json_encode($data,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES));$kid=hash('sha256',$public);
        if(!openssl_sign("bypcms.updates/v1\n$kid\n$payload",$signature,$private,OPENSSL_ALGO_SHA256))throw new RuntimeException('Ошибка подписи обновления.');
        return ['schema'=>'bypcms.updates/v1','key_id'=>$kid,'payload'=>$payload,'signature'=>base64_encode($signature)];
    }
    public static function verify(array $data,string $public):array {
        $payload=$data['payload']??'';$signature=is_string($data['signature']??null)?base64_decode($data['signature'],true):false;
        if(($data['schema']??'')!=='bypcms.updates/v1'||($data['key_id']??'')!==hash('sha256',$public)||!is_string($payload)||strlen($payload)>2000000||!$signature||openssl_verify("bypcms.updates/v1\n{$data['key_id']}\n$payload",$signature,$public,OPENSSL_ALGO_SHA256)!==1)throw new RuntimeException('Подпись обновления не подтверждена.');
        $plain=base64_decode($payload,true);$result=$plain===false?null:json_decode($plain,true,64,JSON_THROW_ON_ERROR);if(!is_array($result))throw new RuntimeException('Повреждён подписанный manifest.');return $result;
    }
    public static function path(string $path):bool {
        if(!preg_match('#^[a-zA-Z0-9_@./-]+$#D',$path)||str_starts_with($path,'/')||str_contains($path,'..')||str_contains($path,'//'))return false;
        if(preg_match('#^_core/[A-Za-z0-9_-]+\.php$#D',$path))return !str_starts_with(basename($path),'Update');
        if(preg_match('#^themes/(?:journal|atelier|gallery)/(?:assets/)?[a-zA-Z0-9_.-]+\.(?:css|js|json|svg|jpg|png|webp|woff2|ttf|txt)$#D',$path))return true;
        return $path==='api/app.php'||$path==='admin/index.html'||(str_starts_with($path,'_next/static/')&&preg_match('/\.(?:js|css|woff2?|ttf|svg|png|jpg|webp|json)$/D',$path));
    }
    public static function manifest(array $m):void {
        if(($m['schema']??'')!=='bypcms.release/v1'||!preg_match('/^\d+\.\d+\.\d+$/D',$m['version']??'')||!is_array($m['from']??null)||!$m['from']||!is_array($m['editions']??null)||!$m['editions']||!is_array($m['modules']??null)||!is_array($m['files']??null)||count($m['files'])>3000||!preg_match('/^\d+\.\d+\.\d+$/D',$m['php_min']??''))throw new RuntimeException('Некорректные параметры выпуска.');
        foreach($m['from']as $version)if(!is_string($version)||!preg_match('/^\d+\.\d+\.\d+$/D',$version)||version_compare($version,$m['version'],'>='))throw new RuntimeException('Некорректная исходная версия.');
        foreach($m['editions']as $edition)if(!in_array($edition,['content','business','commerce'],true))throw new RuntimeException('Неизвестная редакция.');
        foreach($m['modules']as $module)if(!is_string($module)||!preg_match('/^[a-z0-9_-]{1,120}$/D',$module))throw new RuntimeException('Некорректный модуль.');
        foreach(['api/app.php','_core/bootstrap.php','_core/client-front.php','admin/index.html']as $required)if(!isset($m['files'][$required]))throw new RuntimeException('Выпуск не содержит обязательный файл: '.$required);
        $total=0;foreach($m['files']as $path=>$info){if(!self::path($path)||!is_array($info)||!is_int($info['size']??null)||$info['size']<1||$info['size']>20000000||!preg_match('/^[a-f0-9]{64}$/D',$info['sha256']??''))throw new RuntimeException('Недопустимый файл выпуска.');$total+=$info['size'];}
        if($total>200000000)throw new RuntimeException('Распакованный выпуск превышает 200 МБ.');
        if(!is_array($m['migrations']??null)||count($m['migrations'])>100)throw new RuntimeException('Некорректные миграции.');
        $ids=[];foreach($m['migrations']as $migration){$id=$migration['id']??'';if(!is_string($id)||!preg_match('/^[a-z0-9_-]{1,150}$/D',$id)||isset($ids[$id])||!is_array($migration['sql']??null)||!$migration['sql']||count($migration['sql'])>100)throw new RuntimeException('Некорректная миграция.');$ids[$id]=true;
            foreach($migration['sql']as $sql)if(!is_string($sql)||strlen($sql)>100000||str_contains($sql,';')||!preg_match('/^(?:CREATE TABLE|ALTER TABLE|UPDATE|INSERT INTO|DELETE FROM)\s+`?byp_[a-z0-9_]+`?\b/i',trim($sql))||preg_match('/\b(?:OUTFILE|INFILE|LOAD_FILE|SLEEP|BENCHMARK|GRANT|TRIGGER|PROCEDURE|EVENT)\b/i',$sql))throw new RuntimeException('Недопустимая SQL-миграция.');
        }
    }
    public static function inspect(string $file,?string $public):array {
        if(!is_file($file)||filesize($file)>50000000)throw new RuntimeException('Пакет отсутствует или превышает 50 МБ.');
        $zip=new ZipArchive();if($zip->open($file)!==true)throw new RuntimeException('Некорректный ZIP выпуска.');
        try {
            $raw=$zip->getFromName('manifest.json',2000001);if($raw===false||strlen($raw)>2000000)throw new RuntimeException('Manifest отсутствует или слишком велик.');
            $m=json_decode($raw,true,64,JSON_THROW_ON_ERROR);if(!is_array($m))throw new RuntimeException('Некорректный manifest.');self::manifest($m);
            if($public!==null){$signed=json_decode((string)$zip->getFromName('signature.json',3000000),true,64,JSON_THROW_ON_ERROR);if(self::verify($signed,$public)!==$m)throw new RuntimeException('Manifest не совпадает с подписью.');}
            $seen=[];for($i=0;$i<$zip->numFiles;$i++){$stat=$zip->statIndex($i);$name=$stat['name'];if(isset($seen[$name]))throw new RuntimeException('Повтор файла ZIP.');$seen[$name]=true;
                $opsys=0;$attr=0;$zip->getExternalAttributesIndex($i,$opsys,$attr);if(($attr>>16&0170000)===0120000)throw new RuntimeException('Ссылки в ZIP запрещены.');
                if(in_array($name,['manifest.json','signature.json'],true))continue;
                if(!str_starts_with($name,'files/')||!isset($m['files'][substr($name,6)])||$stat['size']!==$m['files'][substr($name,6)]['size'])throw new RuntimeException('Лишний или повреждённый файл ZIP.');
                $stream=$zip->getStream($name);$hash=hash_init('sha256');hash_update_stream($hash,$stream);fclose($stream);if(hash_final($hash)!==$m['files'][substr($name,6)]['sha256'])throw new RuntimeException('Контрольная сумма файла не совпадает.');
            }
            foreach($m['files']as $path=>$info)if(!isset($seen['files/'.$path]))throw new RuntimeException('Файл выпуска отсутствует.');return $m;
        }finally{$zip->close();}
    }
    public static function unpack(string $file,string $directory,array $manifest):void {
        $zip=new ZipArchive();$zip->open($file);
        try{foreach($manifest['files']as $path=>$info){$target=$directory.'/'.$path;if(!is_dir(dirname($target)))mkdir(dirname($target),0750,true);$in=$zip->getStream('files/'.$path);$out=fopen($target,'wb');if(!$in||!$out)throw new RuntimeException('Не удалось распаковать выпуск.');$bytes=stream_copy_to_stream($in,$out);fclose($in);fclose($out);if($bytes!==$info['size']||hash_file('sha256',$target)!==$info['sha256'])throw new RuntimeException('Ошибка записи выпуска.');if(str_ends_with($path,'.php'))token_get_all((string)file_get_contents($target),TOKEN_PARSE);}}
        finally{$zip->close();}
    }
}
