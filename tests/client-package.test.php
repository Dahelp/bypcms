<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/ClientPackage.php';
$root=sys_get_temp_dir().'/bypcms-client-payload-'.bin2hex(random_bytes(8));$checks=0;mkdir($root);
$files=['_core/App.php'=>'<?php echo "code";','_core/LicenseHttp.php'=>file_get_contents(__DIR__.'/../server/_core/LicenseHttp.php'),'api/app.php'=>'<?php echo "api";','api/.htaccess'=>'Require all denied','install/index.php'=>'<?php echo "installer";','admin/index.html'=>'<main>Admin</main>','_next/static/app.js'=>'app();','themes/journal/journal.css'=>'body{}','themes/mono/assets/manrope.woff2'=>'font','updates/index.php'=>file_get_contents(__DIR__.'/../server/updates/index.php'),
 '_storage/config.php'=>'PRIVATE_CONFIG','_private/key.pem'=>'PRIVATE_KEY','_releases/old/_core/App.php'=>'OLD_RELEASE','owner/index.php'=>'PLATFORM_OWNER','uploads/photo.jpg'=>'CUSTOMER_UPLOAD','themes/custom/.env.local'=>'PRIVATE_ENV','api/debug.log'=>'PRIVATE_LOG','index.html'=>'PLATFORM_HOME'];
try{
 foreach($files as $path=>$content){if(!is_dir(dirname($root.'/'.$path)))mkdir(dirname($root.'/'.$path),0755,true);file_put_contents($root.'/'.$path,$content);}
 $zip=new ZipArchive();if($zip->open($root.'/payload.zip',ZipArchive::CREATE)!==true)throw new RuntimeException('ZIP unavailable');BYPCMS\Core\ClientPackage::addFiles($zip,$root);$zip->close();$zip->open($root.'/payload.zip');
 foreach($files as $path=>$content){$expected=!preg_match('#^(?:_storage|_private|_releases|owner|uploads)/#',$path)&&!in_array($path,['themes/custom/.env.local','api/debug.log','index.html'],true);if(($zip->getFromName('site/'.$path)!==false)!==$expected)throw new RuntimeException('Payload boundary: '.$path);$checks++;}
 if($zip->numFiles!==10)throw new RuntimeException('Unexpected archive entries');$checks++;
 foreach(['_core/LicenseHttp.php','updates/index.php']as $path){if($zip->getFromName('site/'.$path)!==$files[$path])throw new RuntimeException('New client must receive the exact repaired root loader: '.$path);$checks++;}
 $zip->close();
 mkdir($root.'/client');$workspace='<meta name="bypcms-client-workspace" content="1"><main>Business workspace</main>';file_put_contents($root.'/client/index.html',$workspace);
 foreach(['business','content','commerce']as $edition){$zip->open($root.'/payload.zip',ZipArchive::CREATE|ZipArchive::OVERWRITE);BYPCMS\Core\ClientPackage::addFiles($zip,$root,$edition);$zip->close();$zip->open($root.'/payload.zip');if($zip->getFromName('site/admin/index.html')!==($edition==='business'?$workspace:$files['admin/index.html']))throw new RuntimeException('Incorrect edition workspace: '.$edition);$checks++;if($zip->locateName('site/client/index.html')!==false)throw new RuntimeException('Build input must not become a second customer panel');$checks++;$zip->close();}
 unlink($root.'/client/index.html');$zip->open($root.'/payload.zip',ZipArchive::CREATE|ZipArchive::OVERWRITE);$refused=false;try{BYPCMS\Core\ClientPackage::addFiles($zip,$root,'business');}catch(RuntimeException $error){$refused=true;}finally{$zip->close();}if(!$refused)throw new RuntimeException('Missing compiled Business workspace was silently shipped');$checks++;
}finally{
 $actual=realpath($root);if($actual&&realpath(dirname($actual))===realpath(sys_get_temp_dir())&&str_starts_with(basename($actual),'bypcms-client-payload-')){foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($actual,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST)as $file){if($file->isDir())rmdir($file->getPathname());else unlink($file->getPathname());}rmdir($actual);}
}
echo "Client package: $checks payload/privacy checks passed\n";
