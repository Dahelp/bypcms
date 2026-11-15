<?php
declare(strict_types=1);
namespace BYPCMS\Core;

/** Publication and route input rules shared by Business presentations. */
final class BusinessView {
    public static function published(array $page):bool {
        $status=$page['status']??'published';$date=$page['published_at']??'';
        return in_array($status,['published','scheduled'],true)&&(!$date?$status==='published':strtotime($date.' UTC')!==false&&strtotime($date.' UTC')<=time());
    }
    public static function query(string $key,int $limit=100):string {
        if(!is_scalar($_GET[$key]??''))throw new \RuntimeException('Проверьте параметры поиска и фильтра.');
        return mb_substr(trim((string)($_GET[$key]??'')),0,$limit);
    }
    public static function number(string $key):int {
        $value=self::query($key,20);$max=$key==='page'?9999999:9007199254740991;
        if($value!==''&&(!ctype_digit($value)||strlen($value)>16||(float)$value>$max))throw new \RuntimeException('Укажите корректный номер страницы или направление.');
        return $key==='page'?max(1,(int)$value):(int)$value;
    }
}
