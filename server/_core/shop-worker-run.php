<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/bootstrap.php';require_once __DIR__.'/Shop.php';
if(($config['app']['installation_type']??'')!=='client'||strtolower($config['app']['edition']??'')!=='commerce')exit("Commerce client required\n");
$shop=new \BYPCMS\Core\Shop($db,$config,BYPCMS_ROOT);
foreach($db->all('SELECT id FROM byp_shop_mail WHERE state="pending" ORDER BY id LIMIT 25')as $m)try{$shop->sendMail((int)$m['id']);}catch(Throwable $x){fwrite(STDERR,'Mail #'.$m['id']." needs attention\n");}
// Reconcile saved attempts without making new charges or assuming a redirect succeeded.
foreach($db->all('SELECT o.reference,o.actor FROM byp_shop_orders o JOIN byp_shop_payments p ON p.order_id=o.id WHERE o.state="pending" AND p.state IN ("creating","pending") ORDER BY COALESCE(p.last_checked_at,p.created_at) LIMIT 25')as $o)try{$shop->payment($o['reference'],$o['actor']);}catch(Throwable $x){fwrite(STDERR,"Payment needs attention\n");}

foreach($db->all('SELECT order_id,amount,operation FROM byp_shop_refunds WHERE state="pending" ORDER BY id LIMIT 25')as $r)try{$shop->refund((int)$r['order_id'],(int)$r['amount'],$r['operation']);}catch(Throwable $x){fwrite(STDERR,"Refund needs attention\n");}

// No payment attempt exists: an abandoned reservation can safely expire after one hour.
foreach($db->all('SELECT o.reference,o.actor FROM byp_shop_orders o LEFT JOIN byp_shop_payments p ON p.order_id=o.id WHERE o.state="pending" AND p.id IS NULL AND o.created_at<DATE_SUB(NOW(),INTERVAL 1 HOUR) LIMIT 50')as $o)try{$shop->cancel($o['reference'],$o['actor']);}catch(Throwable $x){fwrite(STDERR,"Reservation needs attention\n");}
$db->execute('DELETE FROM byp_shop_limits WHERE created_at<DATE_SUB(NOW(),INTERVAL 2 DAY)');
$db->execute('DELETE FROM byp_shop_carts WHERE updated_at<DATE_SUB(NOW(),INTERVAL 90 DAY)');
