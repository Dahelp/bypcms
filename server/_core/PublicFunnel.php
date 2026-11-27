<?php
declare(strict_types=1);
namespace BYPCMS\Core;

/** Combines anonymous traffic counts and aggregate milestones for attributed orders. */
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

    public static function orderSource(mixed $input): ?array {
        if (!is_array($input) || !is_string($input['tag'] ?? null)
            || !preg_match('/\A(business|commerce|content)\.(annual|lifetime)\.(ru|en)\z/', $input['tag'], $parts)) {
            return null;
        }
        $path = $input['via'] ?? null;
        return [
            'edition' => $parts[1],
            'term' => $parts[2],
            'locale' => $parts[3],
            'path' => in_array($path, ['direct', 'details'], true) ? $path : 'unknown',
        ];
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

    private function orderMilestones(int $days): array {
        // The order schema is installed lazily. Until the first order request there may be no source table.
        if (!$this->db->one("SHOW TABLES LIKE 'byp_commerce_order_sources'")) return [];

        // Orders use NOW(). Convert the UTC reporting boundary to the database session's time zone.
        $start = 'FROM_UNIXTIME(TIMESTAMPDIFF(SECOND, "1970-01-01", DATE_SUB(UTC_DATE(), INTERVAL '.($days - 1).' DAY)))';
        return $this->db->all(
            'SELECT "order_saved" AS event, s.edition, s.license_term AS term, s.locale, s.comparison_path AS path, COUNT(*) AS hits
             FROM byp_commerce_order_sources s JOIN byp_commerce_orders o ON o.order_id=s.order_id
             WHERE o.created_at >= '.$start.'
             GROUP BY s.edition, s.license_term, s.locale, s.comparison_path
             UNION ALL
             SELECT "payment_confirmed", s.edition, s.license_term, s.locale, s.comparison_path, COUNT(*)
             FROM byp_commerce_order_sources s JOIN byp_commerce_orders o ON o.order_id=s.order_id
             WHERE o.mode="live" AND o.paid_at >= '.$start.'
             GROUP BY s.edition, s.license_term, s.locale, s.comparison_path'
        );
    }

    public function report(int $days):array {
        if(!in_array($days,[7,30,90],true))throw new \InvalidArgumentException('Выберите период 7, 30 или 90 дней.');
        $this->prune();
        $rows=$this->db->all('SELECT event_name AS event,edition,license_term AS term,locale,SUM(hits) AS hits
            FROM byp_public_funnel_daily WHERE event_day >= DATE_SUB(UTC_DATE(),INTERVAL '.($days-1).' DAY)
            GROUP BY event_name,edition,license_term,locale');
        $rows = array_merge($rows, $this->orderMilestones($days));
        foreach($rows as &$row)$row['hits']=(int)$row['hits'];unset($row);
        return ['days'=>$days,'timezone'=>'UTC','updated_at'=>gmdate(DATE_ATOM),'rows'=>$rows];
    }
}
