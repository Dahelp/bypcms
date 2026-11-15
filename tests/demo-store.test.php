<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/Gallery.php';
require_once __DIR__.'/../server/_core/DemoStore.php';
use BYPCMS\Core\DemoStore;
$seed=require __DIR__.'/../server/_core/GallerySeed.php';$checks=0;
$state=['cart'=>[],'orders'=>[],'tokens'=>[],'shipping'=>'delivery','promo'=>''];
$order=['state'=>'pending','created'=>time(),'items'=>[['variant'=>1,'quantity'=>2]]];
foreach(['pending'=>6,'paid'=>6,'canceled'=>8,'expired'=>8] as $status=>$expected){
    $_SESSION=['csrf'=>'fixture','storefront'=>['gallery:public'=>$state]];
    $_SESSION['storefront']['gallery:public']['orders']['DEMO-QA']=array_replace($order,['state'=>$status]);
    $store=new DemoStore($seed['products'],'/gallery','','gallery');
    if($store->availableProducts()[0]['variants'][0]['stock']!==$expected)throw new RuntimeException('Reservation state '.$status);$checks++;
}
$_SESSION=['csrf'=>'fixture','storefront'=>['gallery:public'=>$state]];
$_SESSION['storefront']['gallery:public']['orders']['DEMO-QA']=array_replace($order,['created'=>time()-3601]);
foreach([1,2] as $attempt){$store=new DemoStore($seed['products'],'/gallery','','gallery');if($store->availableProducts()[0]['variants'][0]['stock']!==8||$_SESSION['storefront']['gallery:public']['orders']['DEMO-QA']['state']!=='expired')throw new RuntimeException('Expiration releases only once');$checks++;}
$_SESSION['storefront']['gallery:public']['orders']['DEMO-QA']=$order;
$other=new DemoStore($seed['products'],'/market','','market');if($other->availableProducts()[0]['variants'][0]['stock']!==8)throw new RuntimeException('Store sessions isolated');$checks++;
echo "Demo shop reservations: $checks checks passed\n";
