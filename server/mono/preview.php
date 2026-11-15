<?php
declare(strict_types=1);
require_once __DIR__.'/../_core/Mono.php';
require_once __DIR__.'/../_core/BusinessThemeDemo.php';
\BYPCMS\Core\BusinessThemeDemo::preview('mono',__DIR__.'/../_core/MonoSeed.php',['site_name'=>'Mono','tagline'=>'Меньше шума. Больше смысла.','accent'=>'#d5ef62']);
