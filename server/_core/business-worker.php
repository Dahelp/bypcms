<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
if(!defined('BYPCMS_SITE_ROOT')){require_once __DIR__.'/UpdateRuntime.php';\BYPCMS\Core\UpdateRuntime::serve(dirname(__DIR__),'_core/business-worker.php');exit;}
require_once __DIR__.'/Database.php';require_once __DIR__.'/Business.php';
$root=BYPCMS_SITE_ROOT;$config=require $root.'/_storage/config.php';
if(($config['app']['installation_type']??'')!=='client'||strtolower($config['app']['edition']??'')!=='business')throw new RuntimeException('Business client required.');
$db=new \BYPCMS\Core\Database($config);$business=new \BYPCMS\Core\Business($db,$config,$root);
foreach($db->all('SELECT lead_id FROM byp_business_mail WHERE state="pending" ORDER BY id LIMIT 10')as $row)try{$business->sendMail((int)$row['lead_id']);echo 'Accepted notification for lead '.$row['lead_id'].PHP_EOL;}catch(Throwable $e){echo 'Notification pending or failed for lead '.$row['lead_id'].PHP_EOL;}
