<?php
declare(strict_types=1);
$root=realpath($argv[1]??'');if(!$root)throw new RuntimeException('Explicit fixture required');$c=require $root.'/_storage/config.php';
if($c['database']['host']!=='127.0.0.1'||$c['database']['port']!==3319||$c['app']['url']!=='http://127.0.0.1:8019'||empty($c['app']['debug'])||!str_starts_with($c['database']['name'],'bypcms_purchase_'))throw new RuntimeException('Own loopback database only');
require __DIR__.'/../server/_core/Database.php';$db=new BYPCMS\Core\Database($c);$in=json_decode(stream_get_contents(STDIN),true,32,JSON_THROW_ON_ERROR);
if($in['action']==='snapshot'){
 $out=[];foreach(['byp_customer_orders','byp_customer_deliveries','byp_license_registry','byp_license_order_links','byp_commerce_manual_payments']as $t)$out[$t]=(int)$db->one('SELECT COUNT(*) n FROM '.$t)['n'];
 if(isset($in['license']))$out['rights']=$db->one('SELECT entitlements,license_key_hash,status,valid_until,purchase_price FROM byp_license_registry WHERE id=?',[(int)$in['license']]);
 echo json_encode($out);exit;
}
if($in['action']==='tamper'){
 $db->execute('UPDATE byp_edition_modules SET availability=? WHERE edition="Content" AND module_key="analytics"',[$in['enabled']?'included':'optional']);echo '{}';exit;
}
if($in['action']==='open-invoice'){
 $old=(int)$in['id'];$o=$db->one('SELECT o.*,c.email FROM byp_customer_orders o JOIN byp_customer_accounts c ON c.id=o.customer_id WHERE o.id=?',[$old]);
 if(!$o||!str_starts_with($o['email'],'legacy-sales-')||!str_ends_with($o['email'],'@example.test'))throw new RuntimeException('Own synthetic historical purchase only');
 $id=$db->insert('INSERT INTO byp_customer_orders(customer_id,edition,modules,domain,license_term,status,created_at) SELECT customer_id,edition,modules,domain,license_term,"pending",NOW() FROM byp_customer_orders WHERE id=?',[$old]);
 $db->execute('INSERT INTO byp_commerce_orders(order_id,public_id,customer_id,operation_id,request_hash,kind,amount_minor,items_json,contact_json,created_at,updated_at) SELECT ?,?,customer_id,?,?,kind,amount_minor,items_json,contact_json,NOW(),NOW() FROM byp_commerce_orders WHERE order_id=?',[$id,bin2hex(random_bytes(16)),bin2hex(random_bytes(16)),bin2hex(random_bytes(32)),$old]);
 $invoice=$db->insert('INSERT INTO byp_commerce_invoices(order_id,operation_id,request_hash,number,state,amount_minor,license_minor,items_json,scope,seller_cipher,yookassa_url,legal_version,expires_on,created_by,created_at) SELECT ?,?,?,?,"issued",amount_minor,license_minor,items_json,scope,seller_cipher,yookassa_url,legal_version,expires_on,created_by,NOW() FROM byp_commerce_invoices WHERE order_id=? ORDER BY id DESC LIMIT 1',[$id,bin2hex(random_bytes(16)),bin2hex(random_bytes(32)),'QA-open-'.bin2hex(random_bytes(8)),$old]);
 echo json_encode(['id'=>$id,'invoice'=>$invoice]);exit;
}
throw new RuntimeException('Explicit action required');
