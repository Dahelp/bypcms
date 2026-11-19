<?php
declare(strict_types=1);
namespace BYPCMS\Core;
require_once (defined('BYPCMS_SITE_ROOT')?BYPCMS_SITE_ROOT.'/_core/UpdateRuntime.php':__DIR__.'/UpdateRuntime.php');
require_once (defined('BYPCMS_SITE_ROOT')?BYPCMS_SITE_ROOT.'/_core/UpdatePackage.php':__DIR__.'/UpdatePackage.php');
if(!class_exists(LicenseClient::class))require_once __DIR__.'/LicenseClient.php';

/** Discovery only: never begins, advances or rolls back an installation. */
final class ReleaseDiscovery {
    public const INTERVAL=21600;
    public const RETRY=900;
    private string $base;
    public function __construct(private string $root,private \PDO $pdo,private array $config,private $checker=null,private $clock=null){
        if(($config['app']['installation_type']??'')!=='client')throw new \RuntimeException('Обнаружение выпусков предназначено для клиентской CMS.');
        $this->base=UpdateRuntime::storage($root,true).'/updates';if(!is_dir($this->base))mkdir($this->base,0750,true);
    }
    private function current():array{return UpdateRuntime::pointer($this->root)?:['release'=>null,'version'=>$this->config['app']['version']??'2.1.0'];}
    private function snapshot():array {
        $current=$this->current();$catalog=UpdateRuntime::json($this->base.'/catalog.json');$releases=[];$jobs=[];
        foreach($catalog['releases']??[]as $r){$r['compatible']=in_array($current['version'],$r['from'],true)&&in_array($this->config['app']['edition'],$r['editions'],true)&&!array_diff($r['modules'],$this->config['app']['modules']??[])&&version_compare(PHP_VERSION,$r['php_min'],'>=');$releases[]=$r;}
        foreach(glob($this->base.'/jobs/*.json')?:[]as $file){$j=UpdateRuntime::json($file);$jobs[]=array_intersect_key($j,array_flip(['id','package','version','phase','state','created_at','updated_at','error','backup_ready','files_done','files_total','tables_done','tables_total','previous_version','restore_done','restore_total']));}
        usort($jobs,fn($a,$b)=>$b['created_at']<=>$a['created_at']);
        return ['current'=>$current,'releases'=>$releases,'jobs'=>$jobs,'maintenance'=>is_file($this->base.'/maintenance.json'),'backup_directory'=>$this->base.'/backups','client'=>true];
    }
    private function checkCatalog():void {
        $config=$this->config;$config['app']['version']=$this->current()['version'];$client=new LicenseClient($this->root,$config);
        try{$client->refresh();}catch(\Throwable $e){} // A still-valid signed offline lease may be used.
        if(!$client->status()['can_update'])throw new LicenseException('Для проверки выпусков нужна действующая подтверждённая лицензия.',409,'update_license_required');
        $trust=UpdateRuntime::json($this->root.'/_core/license-trust.json');if(($trust['schema']??'')!=='bypcms.license-trust/v1'||hash('sha256',$trust['public_key']??'')!==($trust['key_id']??''))throw new \RuntimeException('Не найден ключ проверки каталога.');
        $result=(new LicenseHttp((bool)($config['app']['debug']??false),$config['licensing']['test_hosts']??[]))->request($trust['issuer'].'?action=updates.catalog',null,null,2000000);
        $catalog=UpdatePackage::verify($result['catalog']??[],$trust['public_key']);
        if(($catalog['schema']??'')!=='bypcms.catalog/v1'||!is_int($catalog['issued_at']??null)||$catalog['issued_at']>time()+300||$catalog['issued_at']<time()-86400||!is_array($catalog['releases']??null)||count($catalog['releases'])>500)throw new \RuntimeException('Каталог версий устарел или повреждён.');
        foreach($catalog['releases']as $r){
            foreach(['version','php_min']as $k)if(!is_string($r[$k]??null)||!preg_match('/^\d+\.\d+\.\d+$/D',$r[$k]))throw new \RuntimeException('Некорректная версия в каталоге.');
            foreach(['id','sha256']as $k)if(!is_string($r[$k]??null)||!preg_match('/^[a-f0-9]{64}$/D',$r[$k]))throw new \RuntimeException('Некорректный пакет в каталоге.');
            if(!is_int($r['bytes']??null)||$r['bytes']<1||$r['bytes']>50000000)throw new \RuntimeException('Недопустимый размер пакета.');
            foreach(['from','editions','modules']as $k){if(!is_array($r[$k]??null)||count($r[$k])>100)throw new \RuntimeException('Некорректная совместимость выпуска.');foreach($r[$k]as $v)if(!is_string($v)||strlen($v)>120)throw new \RuntimeException('Некорректная совместимость выпуска.');}
            if(isset($r['notes'])){if(!is_array($r['notes'])||count($r['notes'])>20)throw new \RuntimeException('Некорректное описание выпуска.');foreach($r['notes']as $n)if(!is_string($n)||mb_strlen($n)>1000)throw new \RuntimeException('Некорректное описание выпуска.');}
        }
        UpdateRuntime::atomic($this->base.'/catalog.json',$catalog);
    }
    private function now():int{return $this->clock?($this->clock)():time();}
    private function read():array{return UpdateRuntime::json($this->base.'/discovery.json',['auto_check'=>true,'last_attempt'=>null,'last_success'=>null,'next_check'=>0,'error'=>'','notices'=>[]]);}
    private function locked(callable $run):array {
        $file=fopen($this->base.'/discovery.lock','c');if(!$file)throw new \RuntimeException('Не удалось открыть журнал проверки выпусков.');
        if(!flock($file,LOCK_EX|LOCK_NB)){fclose($file);return $this->status()+['checking'=>true];}
        try{return $run();}finally{flock($file,LOCK_UN);fclose($file);}
    }
    public function status():array {
        $s=$this->read();$data=$this->snapshot();$latest=null;
        foreach($data['releases']as &$r){
            $r['installed']=$r['version']===$data['current']['version'];
            $r['newer']=version_compare($r['version'],$data['current']['version'],'>');
            $r['compatible']=$r['compatible']&&$r['newer'];
            if($r['compatible']&&(!$latest||version_compare($r['version'],$latest['version'],'>')))$latest=$r;
        }unset($r);
        $state=!$s['last_attempt']?'never_checked':($s['error']!==''?'failed':($latest?'available':(!$data['releases']?'empty':($data['releases']&&array_filter($data['releases'],fn($r)=>$r['newer'])?'incompatible':'current'))));
        $notice=$latest?($s['notices'][$latest['id']]??null):null;
        $root=realpath($this->root);$bootstrap='require '.var_export($root.'/_core/UpdateRuntime.php',true).'; $root='.var_export($root,true).'; if(is_file(\BYPCMS\Core\UpdateRuntime::code($root).'.var_export('/_core/client-release-worker.php',true).')) \BYPCMS\Core\UpdateRuntime::serve($root,'.var_export('_core/client-release-worker.php',true).');';
        return $data+['discovery'=>array_intersect_key($s,array_flip(['auto_check','last_attempt','last_success','next_check','error','worker_last_run']))+['state'=>$state,'latest'=>$latest,'unread'=>$latest&&empty($notice['read_at'])],'cron_command'=>'*/5 * * * * php -r '.escapeshellarg($bootstrap)];
    }
    public function discover(bool $force=false,bool $worker=false):array {
        return $this->locked(function()use($force,$worker){
            $s=$this->read();$now=$this->now();$activated=($s['error_code']??'')==='update_license_required'&&(new LicenseClient($this->root,$this->config))->status()['can_update'];if($worker)$s['worker_last_run']=$now;
            if(is_file($this->base.'/maintenance.json')||(!$force&&!$s['auto_check'])||(!$activated&&($force?($s['last_attempt']&&$s['last_attempt']>$now-60):($s['next_check']>$now)))){if($worker)UpdateRuntime::atomic($this->base.'/discovery.json',$s);return $this->status();}
            $s['last_attempt']=$now;
            try{
                if($this->checker)($this->checker)();else $this->checkCatalog();
                $s['last_success']=$now;$s['error']='';$s['error_code']='';$s['next_check']=$now+self::INTERVAL;
                // Persist the verified catalogue and discovery before publishing one notice per release.
                foreach($this->snapshot()['releases']as $r)if($r['compatible']&&version_compare($r['version'],$this->current()['version'],'>')&&!isset($s['notices'][$r['id']]))$s['notices'][$r['id']]=['found_at'=>$now,'read_at'=>null];
                if(count($s['notices'])>200)$s['notices']=array_slice($s['notices'],-200,null,true);
            }catch(\Throwable $e){$s['error_code']=$e instanceof LicenseException?$e->reason:'check_failed';$s['error']=$e instanceof LicenseException||$e instanceof \RuntimeException?mb_substr($e->getMessage(),0,500):'Не удалось проверить каталог. Повторите позже.';$s['next_check']=$now+self::RETRY;}
            UpdateRuntime::atomic($this->base.'/discovery.json',$s);return $this->status();
        });
    }
    public function preference(bool $enabled):array{return $this->locked(function()use($enabled){$s=$this->read();$s['auto_check']=$enabled;UpdateRuntime::atomic($this->base.'/discovery.json',$s);return $this->status();});}
    public function acknowledge(string $id):array {
        if(!preg_match('/^[a-f0-9]{64}$/D',$id))throw new \InvalidArgumentException('Некорректный выпуск.');
        return $this->locked(function()use($id){$s=$this->read();if(!isset($s['notices'][$id]))throw new \RuntimeException('Уведомление не найдено.');$s['notices'][$id]['read_at']??=$this->now();UpdateRuntime::atomic($this->base.'/discovery.json',$s);return $this->status();});
    }
}
