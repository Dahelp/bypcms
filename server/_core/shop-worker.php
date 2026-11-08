<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
if(!defined('BYPCMS_SITE_ROOT')){require_once __DIR__.'/UpdateRuntime.php';\BYPCMS\Core\UpdateRuntime::serve(dirname(__DIR__),'_core/shop-worker.php');exit;}
require __DIR__.'/shop-worker-run.php';
