<?php
declare(strict_types=1);
require_once __DIR__.'/../_core/UpdateRuntime.php';
$root=dirname(__DIR__);
$config=is_file($root.'/_storage/config.php')?require $root.'/_storage/config.php':[];
if(empty($_SERVER['HTTP_X_UPDATE_HEALTH']) && ($config['app']['installation_type']??'platform')==='client' && in_array(strtolower($config['app']['edition']??''),['content','business','commerce'],true) && !in_array($_GET['section']??'',['license','updates'],true)){header('Location: /manage/');exit;}
\BYPCMS\Core\UpdateRuntime::serve($root,'admin/index.html');
