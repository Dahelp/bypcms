<?php
declare(strict_types=1);
if(in_array($_GET['action']??'',['updates.catalog','updates.download'],true)){require __DIR__.'/../updates/index.php';exit;}
require_once __DIR__.'/../_core/UpdateRuntime.php';
\BYPCMS\Core\UpdateRuntime::serve(dirname(__DIR__),'api/app.php');
