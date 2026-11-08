<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/Shop.php';
require_once __DIR__.'/../server/_core/Database.php';
use BYPCMS\Core\{Shop,Database};
$root=realpath($argv[1]??'');
if(!$root||!str_contains(str_replace('\\','/',$root),'/outputs/gallery-acceptance/'))throw new RuntimeException('Disposable Gallery fixture required');
$config=require $root.'/_storage/config.php';
if($config['database']['host']!=='127.0.0.1'||(int)$config['database']['port']!==3319||!str_starts_with($config['database']['name'],'bypcms_gallery_'))throw new RuntimeException('QA DB only');
$db=new Database($config);$shop=new Shop($db,$config,$root);
if(($argv[2]??'')==='inspect'){
    $variant=$db->one('SELECT id,stock FROM byp_shop_variants WHERE id=?',[(int)($argv[4]??0)]);
    $order=$db->one('SELECT id,state,stock_released FROM byp_shop_orders WHERE reference=?',[$argv[3]??'']);
    $payments=$order?$db->one('SELECT COUNT(*) n FROM byp_shop_payments WHERE order_id=?',[$order['id']]):['n'=>0];
    $mail=$order?$db->one('SELECT COUNT(*) n FROM byp_shop_mail WHERE order_id=? AND (event_key LIKE "%canceled" OR event_key LIKE "%succeeded")',[$order['id']]):['n'=>0];
    echo json_encode(compact('variant','order','payments','mail'),JSON_THROW_ON_ERROR);exit;
}
$prefix='qa-final-'.bin2hex(random_bytes(4));$products=[];
for($i=0;$i<13;$i++){
    $slug=$prefix.'-'.str_pad((string)$i,2,'0',STR_PAD_LEFT);
    $id=$shop->saveProduct(['slug'=>$slug,'title'=>'QA Gallery '.$i,'category'=>'QA Filters','collection'=>$i%2?'QA Collection B':'QA Collection A','brand'=>$i%2?'QA Brand B':'QA Brand A','description'=>'<p>Isolated acceptance fixture</p>','specs'=>'QA','images'=>['/themes/gallery/assets/object-2.webp'],'status'=>'published','variants'=>[['sku'=>$slug,'title'=>'QA variant','price'=>number_format(100+$i/100,2,'.',''),'stock'=>12,'active'=>1]]],1);
    $variant=$db->one('SELECT id,stock FROM byp_shop_variants WHERE product_id=?',[$id]);
    $products[]=['id'=>$id,'slug'=>$slug,'variant'=>(int)$variant['id'],'stock'=>(int)$variant['stock']];
}
echo json_encode(['root'=>$root,'products'=>$products],JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES);
