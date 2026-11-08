<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/Database.php';
$root=realpath($argv[1]??'');$c=require $root.'/_storage/config.php';if(($c['database']['port']??0)!==3319||!str_starts_with($c['database']['name'],'bypcms_business_acceptance_')||($c['app']['url']??'')!=='http://qa.example.test:8055')throw new RuntimeException('Disposable Business update fixture only');
$d=new \BYPCMS\Core\Database($c);$snapshot=[];
foreach(['byp_pages','byp_content_meta','byp_settings','byp_media','byp_business_leads','byp_business_mail']as $table)$snapshot[$table]=$d->all('SELECT * FROM '.$table.' ORDER BY '.($table==='byp_content_meta'?'page_id':'id'));
foreach($d->all('SELECT path FROM byp_media')as $m)if(is_file($root.'/'.$m['path']))$snapshot['files'][$m['path']]=hash_file('sha256',$root.'/'.$m['path']);
$file=dirname($root,2).'/update-proof.json';
if(($argv[2]??'verify')==='seed'){file_put_contents($file,json_encode($snapshot));echo "Business content, settings, leads, notifications and media recorded.\n";}
else{if(json_decode(file_get_contents($file),true)!==$snapshot)throw new RuntimeException('Business data changed during update/rollback');echo "Business content, CRM, notifications, settings and media preserved.\n";}
