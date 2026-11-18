<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use InvalidArgumentException;
use RuntimeException;
use Throwable;
require_once __DIR__.'/CommerceSettings.php';

/** Serializes complete cycles; manual runs never masquerade as a scheduled CLI run. */
final class CommerceWorker {
    public function __construct(private CommerceSettings $settings,private string $root){}
    public function run(callable $cycle,string $source='manual'):array {
        if(!in_array($source,['cli','manual'],true)||($source==='cli'&&PHP_SAPI!=='cli'))throw new InvalidArgumentException('Недопустимый источник фонового запуска.');
        $directory=UpdateRuntime::storage($this->root,true).'/commerce';
        $lock=@fopen($directory.'/worker.lock','c');if(!$lock)throw new RuntimeException('Не удалось открыть блокировку фоновой обработки.');
        if(!flock($lock,LOCK_EX|LOCK_NB)){fclose($lock);return ['skipped'=>true,'reason'=>'busy'];}
        $started=time();$run=bin2hex(random_bytes(16));
        try{
            $result=$cycle();
            $issues=(int)($result['errors']??0)+(int)($result['refunds']['errors']??0)+(int)($result['mail']['failed']??0)+(int)($result['mail']['uncertain']??0);
            $this->settings->workerReport(['state'=>$issues?'warning':'completed','started_at'=>$started,'duration_seconds'=>time()-$started,'run_id'=>$run,'result'=>$result],$source);
            return $result;
        }catch(Throwable $e){
            $this->settings->workerReport(['state'=>'failed','started_at'=>$started,'duration_seconds'=>time()-$started,'run_id'=>$run,'error'=>'Цикл прерван. Проверьте серверный журнал и состояние очереди.'],$source);
            error_log('[BYPCMS worker '.$run.'] '.get_class($e));throw $e;
        }finally{flock($lock,LOCK_UN);fclose($lock);}
    }
}
