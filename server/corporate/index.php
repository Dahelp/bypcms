<?php
declare(strict_types=1);
require_once __DIR__.'/../_core/Corporate.php';
require_once __DIR__.'/../_core/BusinessThemeDemo.php';
\BYPCMS\Core\BusinessThemeDemo::serve('corporate',\BYPCMS\Core\Corporate::class,__DIR__.'/../_core/CorporateSeed.php',['site_name'=>'Corporate','tagline'=>'Решения, на которые можно опереться.','accent'=>'#2454d5']);
