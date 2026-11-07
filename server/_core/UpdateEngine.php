<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use PDO;
use RuntimeException;
use Throwable;
require_once __DIR__.'/UpdateRuntime.php';
require_once __DIR__.'/UpdatePackage.php';
require_once __DIR__.'/UpdateDatabase.php';
require_once __DIR__.'/LicenseClient.php';

/** Durable steps: each HTTP request advances one bounded unit; interruption leaves maintenance active. */
final class UpdateEngine {
    private string $base;
    private UpdateDatabase $database;
    public function __construct(private string $root,private PDO $pdo,private array $config,private $fault=null){
        $this->root=realpath($root);$this->base=UpdateRuntime::storage($this->root,true).'/updates';if(!is_dir($this->base))mkdir($this->base,0750,true);$this->database=new UpdateDatabase($pdo);
    }
    private function lock(callable $callback):array {
        $file=fopen($this->root.'/_storage/update-runtime.lock','c');if(!$file||!flock($file,LOCK_EX|LOCK_NB))throw new RuntimeException('Сайт ещё обрабатывает запрос или обновление уже выполняется. Повторите действие.');
        try{return $callback();}finally{flock($file,LOCK_UN);fclose($file);}
    }
    private function save(array $s):void{UpdateRuntime::atomic($this->base.'/jobs/'.$s['id'].'.json',$s);}
    public function job(string $id):array {if(!preg_match('/^[a-f0-9]{32}$/D',$id))throw new RuntimeException('Некорректная операция.');return UpdateRuntime::json($this->base.'/jobs/'.$id.'.json');}
    public function current():array{return UpdateRuntime::pointer($this->root)?:['release'=>null,'version'=>$this->config['app']['version']??'2.1.0'];}
    private function trust():array {$trust=UpdateRuntime::json($this->root.'/_core/license-trust.json');if(($trust['schema']??'')!=='bypcms.license-trust/v1'||hash('sha256',$trust['public_key']??'')!==($trust['key_id']??''))throw new RuntimeException('В сборке отсутствует открытый ключ проверки.');return $trust;}
    private function http():LicenseHttp{return new LicenseHttp((bool)($this->config['app']['debug']??false),$this->config['licensing']['test_hosts']??[]);}
    private function entitlement():void {
        if(($this->config['app']['installation_type']??'platform')!=='client')throw new RuntimeException('Обновление этим механизмом предназначено для клиентской CMS. Платформа публикует выпуски.');
        $client=new LicenseClient($this->root,$this->config);try{$client->refresh();}catch(Throwable $error){/* Only a still-valid signed offline lease may be used. */}
        if(!$client->status()['can_update'])throw new RuntimeException('Для нового обновления нужна действующая подтверждённая лицензия. Откат доступен без связи с сервером лицензий.');
    }
    public function check():array {
        $this->entitlement();$trust=$this->trust();$result=$this->http()->request($trust['issuer'].'?action=updates.catalog',null,null,2000000);
        $catalog=UpdatePackage::verify($result['catalog']??[],$trust['public_key']);if(($catalog['schema']??'')!=='bypcms.catalog/v1'||!is_int($catalog['issued_at']??null)||$catalog['issued_at']>time()+300||$catalog['issued_at']<time()-86400||!is_array($catalog['releases']??null))throw new RuntimeException('Каталог версий устарел или повреждён.');
        foreach($catalog['releases']as $release)if(!preg_match('/^[a-f0-9]{64}$/D',$release['id']??'')||!preg_match('/^[a-f0-9]{64}$/D',$release['sha256']??'')||!is_int($release['bytes']??null)||$release['bytes']>50000000)throw new RuntimeException('Каталог содержит недопустимый пакет.');
        UpdateRuntime::atomic($this->base.'/catalog.json',$catalog);return $this->status();
    }
    public function status():array {
        $catalog=UpdateRuntime::json($this->base.'/catalog.json');$current=$this->current();$jobs=[];
        foreach(glob($this->base.'/jobs/*.json')?:[]as $file){$s=UpdateRuntime::json($file);$jobs[]=$this->publicJob($s);}
        usort($jobs,static fn($a,$b)=>$b['created_at']<=>$a['created_at']);
        $available=[];foreach($catalog['releases']??[]as $release){$compatible=in_array($current['version'],$release['from'],true)&&in_array($this->config['app']['edition'],$release['editions'],true)&&!array_diff($release['modules'],$this->config['app']['modules']??[])&&version_compare(PHP_VERSION,$release['php_min'],'>=');$release['compatible']=$compatible;$available[]=$release;}
        return ['current'=>$current,'releases'=>$available,'jobs'=>$jobs,'maintenance'=>is_file($this->base.'/maintenance.json'),'backup_directory'=>$this->base.'/backups','client'=>($this->config['app']['installation_type']??'platform')==='client'];
    }
    public function publicJob(array $s):array {
        return array_intersect_key($s,array_flip(['id','package','version','phase','state','created_at','updated_at','error','backup_ready','files_done','files_total','tables_done','tables_total','previous_version','restore_done','restore_total']));
    }
    public function begin(string $package,string $operation,array $owner):array {
        $previous=$this->job($operation);if($previous){if($previous['package']!==$package||$previous['owner_id']!==(int)$owner['id'])throw new RuntimeException('Идентификатор операции уже использован.');return $this->publicJob($previous);}
        $this->entitlement();$catalog=UpdateRuntime::json($this->base.'/catalog.json');$release=null;foreach($catalog['releases']??[]as $row)if($row['id']===$package)$release=$row;
        if(!$release)throw new RuntimeException('Сначала проверьте каталог и выберите выпуск.');
        $current=$this->current();if(!in_array($current['version'],$release['from'],true)||!in_array($this->config['app']['edition'],$release['editions'],true)||array_diff($release['modules'],$this->config['app']['modules']??[])||version_compare(PHP_VERSION,$release['php_min'],'<'))throw new RuntimeException('Выпуск несовместим с этой установкой.');
        $free=disk_free_space($this->root);if($free===false||$free<$release['bytes']+232000000)throw new RuntimeException('Недостаточно места для загрузки и проверки пакета.');
        return $this->lock(function()use($operation,$package,$owner,$release,$current){
            if(is_file($this->base.'/maintenance.json'))throw new RuntimeException('Сначала завершите текущее обновление или восстановление.');
            foreach(glob($this->base.'/jobs/*.json')?:[]as $file)if(in_array(UpdateRuntime::json($file)['state'],['running','restoring','recovery_required'],true))throw new RuntimeException('Уже существует незавершённая операция. Откройте её.');
            foreach(['jobs','work/'.$operation,'backups/'.$operation.'/files','backups/'.$operation.'/db']as $dir)if(!is_dir($this->base.'/'.$dir))mkdir($this->base.'/'.$dir,0750,true);
            $s=['id'=>$operation,'package'=>$package,'release'=>$release,'version'=>$release['version'],'previous'=>$current['release']?UpdateRuntime::pointer($this->root):[],'previous_version'=>$current['version'],'phase'=>'download','state'=>'running','created_at'=>microtime(true),'owner_id'=>(int)$owner['id'],'recovery_owner'=>LicenseCrypto::encrypt(json_encode($owner,JSON_THROW_ON_ERROR),$this->config['app']['key']),'error'=>'','backup_ready'=>false,'database_touched'=>false,'files_done'=>0,'tables_done'=>0,'updated_at'=>time()];$this->save($s);return $this->publicJob($s);
        });
    }
    private function inventory():array {
        $result=[];$prefix=$this->root.DIRECTORY_SEPARATOR;$active=UpdateRuntime::pointer($this->root)['release']??null;
        $iterator=new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->root,\FilesystemIterator::SKIP_DOTS));
        foreach($iterator as $file){$relative=str_replace('\\','/',substr($file->getPathname(),strlen($prefix)));if(str_starts_with($relative,'_storage/updates/')||$relative==='_storage/update-runtime.lock')continue;
            if(preg_match('#^(_releases|_update-assets)/([^/]+)/#',$relative,$match)&&$match[2]!==$active)continue;
            if($file->isLink())throw new RuntimeException('В каталоге сайта обнаружена символическая ссылка. Требуется отдельная резервная копия.');
            if(!$file->isFile())continue;$real=$file->getRealPath();if(!$real||!str_starts_with($real,$prefix))throw new RuntimeException('Файл находится вне каталога установки.');$result[]=['path'=>$relative,'size'=>$file->getSize()];
        }return $result;
    }
    private function maintenance(array &$s):void { $s['token']??=bin2hex(random_bytes(32));UpdateRuntime::atomic($this->base.'/maintenance.json',['job'=>$s['id'],'token'=>$s['token']]); }
    private function clearMaintenance():void {if(is_file($this->base.'/maintenance.json')&&!unlink($this->base.'/maintenance.json'))throw new RuntimeException('Не удалось снять режим обслуживания.');}
    private function checkpoint(string $phase):void {if($this->fault)($this->fault)($phase);}
    private function rewriteAssets(string $directory,string $id,?string $previous=null):void {
        if(!is_dir($directory))return;
        if(!chmod($directory,0755))throw new RuntimeException('Не удалось открыть чтение публичных ресурсов.');
        foreach(new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory,\FilesystemIterator::SKIP_DOTS),\RecursiveIteratorIterator::SELF_FIRST)as $file){
            if(!chmod($file->getPathname(),$file->isDir()?0755:0644))throw new RuntimeException('Не удалось задать права публичного ресурса.');
            if(!$file->isFile()||!in_array(strtolower($file->getExtension()),['js','css','json','html'],true))continue;
            $body=(string)file_get_contents($file->getPathname());$normalized=str_replace('/_update-assets/'.$id.'/_next/','/_next/',$body);if($previous)$normalized=str_replace('/_update-assets/'.$previous.'/_next/','/_next/',$normalized);
            $changed=str_replace('/_next/','/_update-assets/'.$id.'/_next/',$normalized);if($changed!==$body&&file_put_contents($file->getPathname(),$changed)===false)throw new RuntimeException('Не удалось подготовить адреса ресурсов версии.');
        }
    }
    public function step(string $id):array {
        return $this->lock(function()use($id){
            $s=$this->job($id);if(!$s)throw new RuntimeException('Операция не найдена.');if(in_array($s['state'],['completed','rolled_back','failed'],true)){if((UpdateRuntime::json($this->base.'/maintenance.json')['job']??null)===$id)$this->clearMaintenance();return $this->publicJob($s);}
            $work=$this->base.'/work/'.$id;$backup=$this->base.'/backups/'.$id;
            if($s['state']==='recovery_required'&&str_starts_with($s['phase'],'restore_'))$s['state']='restoring';
            try {
                switch($s['phase']){
                case 'download':
                    $trust=$this->trust();$state=UpdateRuntime::json($this->root.'/_storage/license-state.json');$credential=LicenseCrypto::decrypt($state['credential'],$this->config['app']['key']);
                    $download=$this->http()->request($trust['issuer'].'?action=updates.download',['id'=>$s['package'],'installation_id'=>(new LicenseClient($this->root,$this->config))->installation(),'activation_token'=>$credential],$work.'/package.zip',50000000);
                    if($download['bytes']!==$s['release']['bytes']||!hash_equals($s['release']['sha256'],$download['sha256']))throw new RuntimeException('Пакет не совпадает с подписанным каталогом.');
                    $m=UpdatePackage::inspect($work.'/package.zip',$trust['public_key']);if($m['version']!==$s['version']||!in_array($s['previous_version'],$m['from'],true)||!in_array($this->config['app']['edition'],$m['editions'],true)||array_diff($m['modules'],$this->config['app']['modules']??[])||version_compare(PHP_VERSION,$m['php_min'],'<'))throw new RuntimeException('Manifest несовместим с установкой.');
                    $free=disk_free_space($this->root);if($free===false||$free<array_sum(array_column($m['files'],'size'))+32000000)throw new RuntimeException('Недостаточно места для распаковки.');
                    UpdatePackage::unpack($work.'/package.zip',$work.'/release',$m);$s['manifest']=$m;$s['phase']='preflight';break;
                case 'preflight':
                    if($this->current()['version']!==$s['previous_version'])throw new RuntimeException('Версия сайта изменилась. Повторите проверку.');
                    if(stat($this->root)['dev']!==stat($this->base)['dev'])throw new RuntimeException('Приватное хранилище и сайт должны быть на одном файловом разделе.');
                    foreach([$this->root,$this->root.'/_releases',$this->root.'/_update-assets']as $directory)if(is_dir($directory)&&!is_writable($directory))throw new RuntimeException('PHP не может записывать каталоги версий и ресурсов. Изменения БД не начаты.');
                    $this->maintenance($s);$s['inventory']=$this->inventory();
                    foreach($s['inventory']as $item)if(str_ends_with(strtolower($item['path']),'.php')&&!preg_match('#^(?:_core|_storage|_private|_releases)/#',$item['path'])&&!in_array($item['path'],['index.php','api/index.php','api/app.php','admin/index.php','install/index.php','updates/index.php','updates/recovery.php'],true))throw new RuntimeException('Публичный PHP-вход не подключён к режиму обслуживания: '.$item['path'].'. Нужна интеграция до обновления.');
                    $s['tables']=$this->database->inventory();
                    $bytes=array_sum(array_column($s['inventory'],'size'));$dbBytes=array_sum(array_column($s['tables'],'bytes'));$free=disk_free_space($this->root);
                    if($bytes>536870912||$dbBytes>268435456||$free===false||$free<($bytes+$dbBytes)*2+250000000)throw new RuntimeException('Недостаточно места для проверяемой копии или превышен лимит: файлы 512 МБ, БД 256 МБ. Изменения не начаты.');
                    $s['files_total']=count($s['inventory']);$s['tables_total']=count($s['tables']);$s['phase']='backup_files';break;
                case 'backup_files':
                    $end=min($s['files_done']+40,$s['files_total']);for($i=$s['files_done'];$i<$end;$i++){$item=$s['inventory'][$i];$source=$this->root.'/'.$item['path'];$target=$backup.'/files/'.$item['path'];if(!is_dir(dirname($target)))mkdir(dirname($target),0750,true);if(!copy($source,$target)||filesize($target)!==$item['size']||hash_file('sha256',$source)!==hash_file('sha256',$target))throw new RuntimeException('Ошибка резервирования файла: '.$item['path']);$s['inventory'][$i]['sha256']=hash_file('sha256',$target);}$s['files_done']=$end;if($end===$s['files_total'])$s['phase']='backup_database';break;
                case 'backup_database':
                    $i=$s['tables_done'];if($i<$s['tables_total']){$s['snapshots'][]=$this->database->backup($s['tables'][$i]['name'],$backup.'/db/'.$i.'.json.gz');$s['tables_done']++;}
                    if($s['tables_done']===$s['tables_total']){
                        UpdateRuntime::atomic($backup.'/manifest.json',['previous'=>$s['previous'],'version'=>$s['previous_version'],'tables'=>$s['snapshots']??[],'files'=>$s['inventory']]);$s['backup_ready']=true;$s['migration_done']=0;$s['phase']='migrations';$this->save($s);$this->checkpoint('after_backup');
                    }break;
                case 'migrations':
                    if(!empty($s['inflight']))throw new RuntimeException('Миграция была прервана. Выполняется восстановление копии.');
                    $migrations=$s['manifest']['migrations'];$index=$s['migration_done'];
                    if($index<count($migrations)){
                        $migration=$migrations[$index];$s['database_touched']=true;$s['inflight']=true;$this->save($s);
                        $query=$this->pdo->prepare('SELECT id FROM byp_migrations WHERE migration=?');$query->execute([$migration['id']]);if($query->fetch())throw new RuntimeException('Идентификатор миграции уже использован.');
                        foreach($migration['sql']as $sql)$this->pdo->exec($sql);
                        $this->pdo->prepare('INSERT INTO byp_migrations(migration,batch,applied_at) VALUES(?,1,NOW())')->execute([$migration['id']]);$s['inflight']=false;$s['migration_done']++;$this->checkpoint('after_migration');
                    }else{$s['phase']='switch';}break;
                case 'switch':
                    if(!is_dir($this->root.'/_releases'))mkdir($this->root.'/_releases',0750,true);
                    if(!is_dir($this->root.'/_update-assets'))mkdir($this->root.'/_update-assets',0755,true);
                    $target=$this->root.'/_releases/'.$id;
                    if(!is_dir($target)){
                        $html=$work.'/release/admin/index.html';$body=(string)file_get_contents($html);$body=str_replace('/_next/','/_update-assets/'.$id.'/_next/',$body);if(file_put_contents($html,$body)===false)throw new RuntimeException('Ошибка подготовки панели.');
                        if(!rename($work.'/release',$target))throw new RuntimeException('Не удалось подготовить каталог версии.');
                    }
                    if(is_dir($target.'/_next')&&!is_dir($this->root.'/_update-assets/'.$id)){
                        $assets=$this->root.'/_update-assets/'.$id;mkdir($assets,0755,true);file_put_contents($assets.'/.htaccess',"Options -Indexes\n<FilesMatch \"\\.(?:php|phtml|phar)$\">\nRequire all denied\n</FilesMatch>\n");if(!rename($target.'/_next',$assets.'/_next'))throw new RuntimeException('Не удалось подготовить ресурсы панели.');
                    }
                    $this->rewriteAssets($this->root.'/_update-assets/'.$id,$id);
                    $s['phase']='health';$this->save($s);UpdateRuntime::atomic($this->base.'/active.json',['release'=>$id,'version'=>$s['version']]);$this->checkpoint('after_switch');break;
                case 'health':
                    if($this->current()['release']!==$id)UpdateRuntime::atomic($this->base.'/active.json',['release'=>$id,'version'=>$s['version']]);
                    $ownerQuery=$this->pdo->prepare('SELECT u.status,r.slug AS role FROM byp_users u LEFT JOIN byp_roles r ON r.id=u.role_id WHERE u.id=?');$ownerQuery->execute([$s['owner_id']]);$ownerAccess=$ownerQuery->fetch(PDO::FETCH_ASSOC);
                    if(!$ownerAccess||$ownerAccess['status']!=='active'||$ownerAccess['role']!=='owner')throw new RuntimeException('После миграции потерян доступ владельца. Выполняется откат.');
                    $headers=['X-Update-Health: '.$s['token']];$base=rtrim($this->config['app']['url'],'/');
                    $health=$this->http()->request($base.'/api/index.php?action=status',null,null,65536,$headers);
                    if(($health['version']??'')!==$s['version']||($health['database']??'')!=='connected')throw new RuntimeException('Новая версия не прошла проверку API.');
                    $sample=$this->pdo->query('SELECT slug FROM byp_pages WHERE status="published" ORDER BY id LIMIT 1')->fetchColumn();
                    if($sample!==false){$url=$base.($sample==='home'?'/':'/'.implode('/',array_map('rawurlencode',explode('/',trim($sample,'/')))).'/');$this->http()->request($url,null,$work.'/health.html',2000000,$headers);}
                    $this->http()->request($base.'/admin/',null,$work.'/admin.html',2000000,$headers);
                    preg_match_all('/(?:src|href)="([^"]+\.(js|css))"/',(string)file_get_contents($work.'/admin.html'),$resources,PREG_SET_ORDER);$checked=[];
                    foreach($resources as $resource){$kind=$resource[2];if(isset($checked[$kind]))continue;if(!str_starts_with($resource[1],'/_update-assets/'.$id.'/_next/'))throw new RuntimeException('Панель ссылается на ресурсы другой версии.');$asset=$this->http()->request($base.$resource[1],null,$work.'/asset-'.$kind,20000000,$headers);if(!$asset['bytes']||!preg_match($kind==='css'?'#text/css#i':'#(?:javascript|ecmascript)#i',$asset['content_type']))throw new RuntimeException('Неверный тип ресурса панели.');$checked[$kind]=true;}
                    if(!isset($checked['js'],$checked['css']))throw new RuntimeException('Панель не содержит обязательные JS/CSS.');
                    $s['phase']='done';$s['state']='completed';$this->save($s);$this->clearMaintenance();break;
                case 'restore_prepare':
                    $this->maintenance($s);$meta=UpdateRuntime::json($backup.'/manifest.json');if(!$meta||empty($s['backup_ready']))throw new RuntimeException('Завершённая резервная копия отсутствует.');
                    foreach($meta['tables']as $i=>$table)if(!is_file($backup.'/db/'.$i.'.json.gz')||!hash_equals($table['sha256'],hash_file('sha256',$backup.'/db/'.$i.'.json.gz')))throw new RuntimeException('Копия БД повреждена. Восстановление не начато.');
                    foreach($meta['files']as $item)if(!is_file($backup.'/files/'.$item['path'])||!hash_equals($item['sha256'],hash_file('sha256',$backup.'/files/'.$item['path'])))throw new RuntimeException('Копия файлов повреждена. Восстановление не начато.');
                    $s['phase']='restore_database';$s['restore_done']=0;$s['restore_total']=count($meta['tables']);$s['restore_dropped']=false;break;
                case 'restore_database':
                    if(empty($s['restore_dropped'])){$this->database->dropCurrent();$s['restore_dropped']=true;$this->save($s);}
                    $meta=UpdateRuntime::json($backup.'/manifest.json');$i=$s['restore_done'];if($i<$s['restore_total']){$this->database->restore($backup.'/db/'.$i.'.json.gz',$meta['tables'][$i]);$s['restore_done']++;}
                    if($s['restore_done']===$s['restore_total']){$s['phase']='restore_files';$s['restore_file_done']=0;}break;
                case 'restore_files':
                    $meta=UpdateRuntime::json($backup.'/manifest.json');$restoreId=substr(hash('sha256',$id.'restore'),0,32);$prefix=$s['previous']?'_releases/'.$s['previous']['release'].'/':'';$assetPrefix=$s['previous']?'_update-assets/'.$s['previous']['release'].'/':'';$files=[];
                    foreach($meta['files']as $item){$relative=$item['path'];$mapped=null;if($prefix===''||str_starts_with($relative,$prefix)){$candidate=substr($relative,strlen($prefix));if(UpdatePackage::path($candidate))$mapped=$candidate;}if($assetPrefix!==''&&str_starts_with($relative,$assetPrefix.'_next/'))$mapped=substr($relative,strlen($assetPrefix));if($mapped!==null)$files[]=[$item,$mapped];}
                    $end=min($s['restore_file_done']+40,count($files));for($i=$s['restore_file_done'];$i<$end;$i++){[$item,$mapped]=$files[$i];$target=str_starts_with($mapped,'_next/')?$this->root.'/_update-assets/'.$restoreId.'/'.$mapped:$this->root.'/_releases/'.$restoreId.'/'.$mapped;if(!is_dir(dirname($target)))mkdir(dirname($target),0755,true);if(!copy($backup.'/files/'.$item['path'],$target)||hash_file('sha256',$target)!==$item['sha256'])throw new RuntimeException('Не удалось вернуть файл версии.');}
                    $s['restore_file_done']=$end;if($end===count($files)){
                        $html=$this->root.'/_releases/'.$restoreId.'/admin/index.html';$body=(string)file_get_contents($html);if($s['previous'])$body=str_replace('/_update-assets/'.$s['previous']['release'].'/_next/','/_next/',$body);$body=str_replace('/_next/','/_update-assets/'.$restoreId.'/_next/',$body);if(file_put_contents($html,$body)===false)throw new RuntimeException('Не удалось вернуть панель.');$s['restored_release']=$restoreId;$s['phase']='restore_pointer';
                        $this->rewriteAssets($this->root.'/_update-assets/'.$restoreId,$restoreId,$s['previous']['release']??null);
                    }break;
                case 'restore_pointer':
                    UpdateRuntime::atomic($this->base.'/active.json',['release'=>$s['restored_release'],'version'=>$s['previous_version']]);
                    $this->pdo->query('SELECT id FROM byp_users LIMIT 1');$this->pdo->query('SELECT id FROM byp_pages LIMIT 1');$s['phase']='done';$s['state']='rolled_back';$this->save($s);$this->clearMaintenance();break;
                default:throw new RuntimeException('Неизвестный этап обновления.');
                }
                $s['updated_at']=time();$this->save($s);
            }catch(Throwable $error){
                $s['error']=$error->getMessage();$s['updated_at']=time();
                if(str_starts_with($s['phase'],'restore_')){$s['state']='recovery_required';}
                elseif($s['backup_ready']&&($s['database_touched']||in_array($s['phase'],['switch','health'],true))){$s['state']='restoring';$s['phase']='restore_prepare';$this->maintenance($s);}
                else{$s['state']='failed';$this->clearMaintenance();}
                $this->save($s);
            }return $this->publicJob($s);
        });
    }
    public function rollback(string $id):array {
        return $this->lock(function()use($id){$s=$this->job($id);if(!$s||!$s['backup_ready'])throw new RuntimeException('Нет завершённой копии этой операции.');if($s['state']==='rolled_back')return $this->publicJob($s);
            if($s['state']==='failed')throw new RuntimeException('Эта операция не меняла рабочую версию. Откат не требуется.');
            $maintenance=UpdateRuntime::json($this->base.'/maintenance.json');if($maintenance&&$maintenance['job']!==$id)throw new RuntimeException('Выполняется другая операция.');
            if($s['state']==='completed'&&$this->current()['release']!==$id)throw new RuntimeException('Откат доступен только для текущего установленного выпуска.');
            if(str_starts_with($s['phase'],'restore_'))return $this->publicJob($s);
            $s['state']='restoring';$s['phase']='restore_prepare';$this->maintenance($s);$this->save($s);return $this->publicJob($s);});
    }
}
