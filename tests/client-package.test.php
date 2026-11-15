<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/ClientPackage.php';
$root=sys_get_temp_dir().'/bypcms-client-payload-'.bin2hex(random_bytes(8));$checks=0;mkdir($root);
$files=['_core/App.php'=>'<?php echo "code";','api/app.php'=>'<?php echo "api";','api/.htaccess'=>'Require all denied','install/index.php'=>'<?php echo "installer";','admin/index.html'=>'<main>Admin</main>','_next/static/app.js'=>'app();','themes/journal/journal.css'=>'body{}','themes/mono/assets/manrope.woff2'=>'font','updates/index.php'=>'<?php echo "update";',
 '_storage/config.php'=>'PRIVATE_CONFIG','_private/key.pem'=>'PRIVATE_KEY','_releases/old/_core/App.php'=>'OLD_RELEASE','owner/index.php'=>'PLATFORM_OWNER','uploads/photo.jpg'=>'CUSTOMER_UPLOAD','themes/custom/.env.local'=>'PRIVATE_ENV','api/debug.log'=>'PRIVATE_LOG','index.html'=>'PLATFORM_HOME'];
try{
 foreach($files as $path=>$content){if(!is_dir(dirname($root.'/'.$path)))mkdir(dirname($root.'/'.$path),0755,true);file_put_contents($root.'/'.$path,$content);}
 $zip=new ZipArchive();if($zip->open($root.'/payload.zip',ZipArchive::CREATE)!==true)throw new RuntimeException('ZIP unavailable');BYPCMS\Core\ClientPackage::addFiles($zip,$root);$zip->close();$zip->open($root.'/payload.zip');
 foreach($files as $path=>$content){$expected=!preg_match('#^(?:_storage|_private|_releases|owner|uploads)/#',$path)&&!in_array($path,['themes/custom/.env.local','api/debug.log','index.html'],true);if(($zip->getFromName('site/'.$path)!==false)!==$expected)throw new RuntimeException('Payload boundary: '.$path);$checks++;}
 if($zip->numFiles!==9)throw new RuntimeException('Unexpected archive entries');$checks++;$zip->close();
}finally{
 $actual=realpath($root);if($actual&&realpath(dirname($actual))===realpath(sys_get_temp_dir())&&str_starts_with(basename($actual),'bypcms-client-payload-')){foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($actual,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST)as $file){if($file->isDir())rmdir($file->getPathname());else unlink($file->getPathname());}rmdir($actual);}
}
echo "Client package: $checks payload/privacy checks passed\n";
