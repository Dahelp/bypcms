<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use PDO;

/** Central guard used by activation, updates, delivery and the customer account. */
final class CommerceAccess {
    public static function blocked(PDO $pdo,int $license):bool {
        if(!$pdo->query("SHOW TABLES LIKE 'byp_commerce_license_blocks'")->fetchColumn())return false;
        $q=$pdo->prepare('SELECT order_id FROM byp_commerce_license_blocks WHERE license_id=? AND state IN ("pending","review","revoked") LIMIT 1');$q->execute([$license]);return (bool)$q->fetchColumn();
    }
    public static function orderDenied(PDO $pdo,int $order):bool {
        if(!$pdo->query("SHOW TABLES LIKE 'byp_commerce_refunds'")->fetchColumn())return false;
        $q=$pdo->prepare('SELECT d.amount_minor,d.kind,d.renewal_license_id,k.license_id FROM byp_commerce_orders d LEFT JOIN byp_license_order_links k ON k.order_id=d.order_id WHERE d.order_id=?');$q->execute([$order]);$row=$q->fetch(PDO::FETCH_ASSOC);if(!$row)return false;
        $license=(int)($row['license_id']??$row['renewal_license_id']??0);if($license&&self::blocked($pdo,$license))return true;
        $q=$pdo->prepare('SELECT state,amount_minor,license_action FROM byp_commerce_refunds WHERE order_id=?');$q->execute([$order]);$total=0;
        foreach($q->fetchAll(PDO::FETCH_ASSOC)as $refund){if($refund['state']==='succeeded'){$total+=(int)$refund['amount_minor'];if(in_array($refund['license_action'],['revoke','review'],true))return true;}if(in_array($refund['state'],['approved','creating','uncertain','pending'],true)&&$refund['license_action']!=='keep')return true;}
        return $total>=(int)$row['amount_minor'];
    }
}
