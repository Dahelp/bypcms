<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/UpdateEngine.php';
use BYPCMS\Core\UpdateEngine;
$root=sys_get_temp_dir().'/bypcms-project-entry-'.bin2hex(random_bytes(6));mkdir($root);mkdir($root.'/project');mkdir($root.'/archive');file_put_contents($root.'/project/Archive.php','<?php echo "read-only";');
$valid=<<<'PHP'
<?php
declare(strict_types=1);
$root=dirname(__DIR__,1);
header('X-Robots-Tag: noindex, nofollow, noarchive, noimageindex');
require_once $root.'/_core/UpdateRuntime.php';
\BYPCMS\Core\UpdateRuntime::serve($root,'_core/bootstrap.php');
require $root.'/project/Archive.php';
PHP;
$valid.="\n";$checks=0;
try{
 foreach([$valid,true,str_replace("\n","\r\n",$valid),true,str_replace("\BYPCMS\Core\UpdateRuntime::serve(\$root,'_core/bootstrap.php');",'', $valid),false,$valid."echo 'injected';",false,str_replace('dirname(__DIR__,1)','dirname(__DIR__,2)',$valid),false,str_replace('Archive.php','../config.php',$valid),false]as $i=>$value){if($i%2===0){file_put_contents($root.'/archive/index.php',$value);clearstatcache();}else{if(UpdateEngine::projectEntrypoint($root,'archive/index.php')!==$value)throw new RuntimeException('Runtime gate validation case '.($i-1));$checks++;}}
 unlink($root.'/project/Archive.php');if(UpdateEngine::projectEntrypoint($root,'archive/index.php'))throw new RuntimeException('Missing private controller accepted');$checks++;
}finally{if(is_file($root.'/project/Archive.php'))unlink($root.'/project/Archive.php');unlink($root.'/archive/index.php');rmdir($root.'/project');rmdir($root.'/archive');rmdir($root);}
echo "$checks project runtime-gate and tampering checks passed\n";
