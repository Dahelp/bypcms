<?php
declare(strict_types=1);
require_once __DIR__.'/repair-update-transport.php';
if(realpath($_SERVER['SCRIPT_FILENAME']??'')===__FILE__){
    if(PHP_SAPI!=='cli'){http_response_code(403);exit;}
    try{if(!isset($argv[1])||isset($argv[2])&&$argv[2]!=='--apply')throw new RuntimeException('php scripts/repair-project-updates.php <корень CMS> [--apply]');echo json_encode(byp_repair_update_transport($argv[1],($argv[2]??'')==='--apply',null,'project'),JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES).PHP_EOL;}
    catch(Throwable $error){fwrite(STDERR,$error->getMessage().PHP_EOL);exit(1);}
}
