<?php
declare(strict_types=1);
namespace BYPCMS\Core;
require_once __DIR__.'/UpdateRuntime.php';
require_once __DIR__.'/UpdatePackage.php';
require_once __DIR__.'/LicenseAuthority.php';
use RuntimeException;

final class UpdatePublisher {
    private string $base;
    public function __construct(private string $root,private LicenseAuthority $authority){$this->base=UpdateRuntime::storage($root,true).'/feed';if(!is_dir($this->base))mkdir($this->base,0750,true);}
    public function candidate(string $source):array {
        $file=$this->base.'/inspect-'.bin2hex(random_bytes(6)).'.zip';try{UpdatePackage::payload($source,$file);return UpdatePackage::inspect($file,null);}finally{if(is_file($file))unlink($file);}
    }
    public function catalog():array{return UpdateRuntime::json($this->base.'/catalog.json',['schema'=>'bypcms.catalog/v1','issued_at'=>time(),'releases'=>[]]);}
    private function signed(array $data):array{$trust=$this->authority->trust();return UpdatePackage::sign($data,(string)file_get_contents($this->root.'/_storage/license-authority.pem'),$trust['public_key']);}
    public function publicCatalog():array{$catalog=$this->catalog();$catalog['issued_at']=time();return $this->signed($catalog);}
    public function publish(string $candidate):array {
        $lock=fopen($this->base.'/publish.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('Каталог занят.');
        $tmp=$this->base.'/candidate.tmp.zip';$input=$this->base.'/candidate-input.zip';
        try{
            UpdatePackage::payload($candidate,$input);$manifest=UpdatePackage::inspect($input,null);$catalog=$this->catalog();
            foreach($catalog['releases']as $release)if($release['version']===$manifest['version']){
                $old=UpdatePackage::inspect($this->base.'/'.$release['id'].'.zip',$this->authority->trust()['public_key']);if($old!==$manifest)throw new RuntimeException('Версия уже опубликована с другим содержимым. Укажите новый номер выпуска.');return $release;
            }
            if(!copy($input,$tmp))throw new RuntimeException('Не удалось подготовить публикацию.');
            $zip=new \ZipArchive();$zip->open($tmp);$zip->addFromString('signature.json',json_encode($this->signed($manifest),JSON_THROW_ON_ERROR));if(!$zip->close())throw new RuntimeException('Не удалось подписать пакет.');
            $id=hash_file('sha256',$tmp);$release=['id'=>$id,'sha256'=>$id,'bytes'=>filesize($tmp)]+array_intersect_key($manifest,array_flip(['version','from','editions','modules','php_min']));
            if(!rename($tmp,$this->base.'/'.$id.'.zip'))throw new RuntimeException('Не удалось сохранить публикацию.');
            $catalog['releases'][]=$release;$catalog['issued_at']=time();UpdateRuntime::atomic($this->base.'/catalog.json',$catalog);return $release;
        }finally{if(is_file($tmp))unlink($tmp);if(is_file($input))unlink($input);flock($lock,LOCK_UN);fclose($lock);}
    }
    public function package(string $id,array $claims):string {
        if(!preg_match('/^[a-f0-9]{64}$/D',$id))throw new RuntimeException('Выпуск не найден.');
        if(!LicensePolicy::access($claims,time())['can_update'])throw new RuntimeException('Срок доступа к обновлениям истёк.');
        foreach($this->catalog()['releases']as $release)if($release['id']===$id){if(!in_array($claims['edition'],$release['editions'],true)||array_diff($release['modules'],$claims['entitlements']))throw new RuntimeException('Лицензия не включает этот выпуск.');$path=$this->base.'/'.$id.'.zip';if(!is_file($path)||hash_file('sha256',$path)!==$release['sha256'])throw new RuntimeException('Пакет повреждён.');return $path;}throw new RuntimeException('Выпуск не найден.');
    }
}
