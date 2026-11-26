<?php
declare(strict_types=1);
namespace BYPCMS\Core;

/** Aggregate event counts only: no raw events, identities, IPs, URLs or user agents. */
final class PublicFunnel {
    public const EVENTS = ['comparison_view','details_click','demo_click','order_click','product_order_click','checkout_open'];

    public static function validate(array $input):array {
        if (array_diff(array_keys($input), ['event','edition','term','locale']) || count($input)!==4) throw new \InvalidArgumentException('Invalid event fields');
        foreach($input as $value) if(!is_string($value)) throw new \InvalidArgumentException('Invalid event value');
        if(!in_array($input['event'],self::EVENTS,true) || !in_array($input['term'],['annual','lifetime'],true) || !in_array($input['locale'],['ru','en'],true)) throw new \InvalidArgumentException('Unknown event value');
        $editions=$input['event']==='comparison_view'?['all']:['business','commerce','content'];
        if(!in_array($input['edition'],$editions,true)) throw new \InvalidArgumentException('Unknown edition');
        return $input;
    }

    public static function sameOrigin(string $origin,string $configuredUrl):bool {
        $a=parse_url($origin);$b=parse_url($configuredUrl);
        if(!$a||!$b||!isset($a['scheme'],$a['host'],$b['scheme'],$b['host'])||isset($a['user'])||isset($a['pass'])||isset($a['query'])||isset($a['fragment'])||(!empty($a['path'])&&$a['path']!=='/'))return false;
        $port=static fn(array $u):int=>(int)($u['port']??($u['scheme']==='https'?443:80));
        return in_array($a['scheme'],['http','https'],true)&&$a['scheme']===$b['scheme']&&strtolower($a['host'])===strtolower($b['host'])&&$port($a)===$port($b);
    }

    public function __construct(private Database $db) {
        $db->execute('CREATE TABLE IF NOT EXISTS byp_public_funnel_daily (
            event_day DATE NOT NULL, event_name VARCHAR(32) NOT NULL,
            edition VARCHAR(12) NOT NULL, license_term VARCHAR(8) NOT NULL,
            locale CHAR(2) NOT NULL, hits BIGINT UNSIGNED NOT NULL DEFAULT 0,
            PRIMARY KEY (event_day,event_name,edition,license_term,locale)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    }

    public function record(array $input):void {
        $event=self::validate($input);
        $this->db->execute('INSERT INTO byp_public_funnel_daily (event_day,event_name,edition,license_term,locale,hits)
            VALUES (UTC_DATE(),:event,:edition,:term,:locale,1)
            ON DUPLICATE KEY UPDATE hits=hits+1',$event);
        $this->prune();
    }
    private function prune():void {
        $this->db->execute('DELETE FROM byp_public_funnel_daily WHERE event_day < DATE_SUB(UTC_DATE(),INTERVAL 89 DAY)');
    }
    public function report(int $days):array {
        if(!in_array($days,[7,30,90],true))throw new \InvalidArgumentException('Выберите период 7, 30 или 90 дней.');
        $this->prune();
        $rows=$this->db->all('SELECT event_name AS event,edition,license_term AS term,locale,SUM(hits) AS hits
            FROM byp_public_funnel_daily WHERE event_day >= DATE_SUB(UTC_DATE(),INTERVAL '.($days-1).' DAY)
            GROUP BY event_name,edition,license_term,locale');
        foreach($rows as &$row)$row['hits']=(int)$row['hits'];unset($row);
        return ['days'=>$days,'timezone'=>'UTC','updated_at'=>gmdate(DATE_ATOM),'rows'=>$rows];
    }
}
