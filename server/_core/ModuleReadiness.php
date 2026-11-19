<?php
declare(strict_types=1);
namespace BYPCMS\Core;

/** Upper bound for NEW sales. Never rewrites historical purchases or licensed rights. */
final class ModuleReadiness {
    public static function all():array {
        static $modules=null;
        if($modules===null){$data=json_decode((string)file_get_contents(__DIR__.'/module-readiness.json'),true,32,JSON_THROW_ON_ERROR);if(($data['schema']??0)!==1)throw new \RuntimeException('Матрица модулей недоступна.');$modules=array_column($data['modules'],null,'slug');}
        return $modules;
    }
    public static function allowed(string $key,string $edition):bool {
        $m=self::all()[$key]??null;return $m&&in_array($m['readiness'],['ready','limited'],true)&&in_array(strtolower($edition),$m['editions'],true);
    }
    public static function assertSelection(array $keys,string $edition):void {
        foreach($keys as $key)if(!is_string($key)||!self::allowed($key,$edition))throw new \InvalidArgumentException('Модуль «'.(is_string($key)?(self::all()[$key]['name']??'Неизвестный'):'Неизвестный').'» недоступен для новых заказов и сборок выбранной редакции. Приобретённые ранее права сохраняются.');
    }
    public static function availability(array $rows):array {
        foreach($rows as &$r)if(!self::allowed($r['module_key'],$r['edition']))$r['availability']='hidden';unset($r);return $rows;
    }
    public static function describe(array $rows):array {
        foreach($rows as &$r){$m=self::all()[$r['module_key']]??null;$r['readiness']=$m['readiness']??'planned';$r['catalog_status']=$r['status']??null;if($r['readiness']==='planned'&&isset($r['status']))$r['status']='draft';$r['supported_editions']=$m['editions']??[];$r['sales_note']=$m['lead']??'Не подтверждён для продажи';if($m)$r['description']=$m['lead'];}unset($r);return $rows;
    }
}
