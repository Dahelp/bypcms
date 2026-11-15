<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/ClientPackage.php';
require_once __DIR__.'/../server/_core/UpdateRuntime.php';
$base=realpath(__DIR__.'/../outputs');if(!$base){mkdir(__DIR__.'/../outputs');$base=realpath(__DIR__.'/../outputs');}
$root=$base.'/build-storage-qa-'.bin2hex(random_bytes(8));mkdir($root);mkdir($root.'/site');mkdir($root.'/site/_storage');
file_put_contents($root.'/site/_storage/config.php','<?php return '.var_export(['app'=>['key'=>'qa-only'],'updates'=>['private_dir'=>$root.'/private']],true).';');
$_SERVER['DOCUMENT_ROOT']=$root.'/site';
// Reproduce shared-hosting access restrictions: the system temp path is unavailable.
ini_set('open_basedir',$base.PATH_SEPARATOR.realpath(__DIR__.'/../server/_core'));
try{
 if(@is_writable(sys_get_temp_dir()))throw new RuntimeException('Fixture must deny global temp');
 $a=BYPCMS\Core\ClientPackage::temporaryArchive($root.'/site');$b=BYPCMS\Core\ClientPackage::temporaryArchive($root.'/site');
 if($a===$b||!str_starts_with(str_replace('\\','/',$a),str_replace('\\','/',$root).'/private/build-downloads/'))throw new RuntimeException('Independent private paths required');
 foreach([$a,$b]as $path){$zip=new ZipArchive();if($zip->open($path,ZipArchive::CREATE)!==true)throw new RuntimeException('Private ZIP creation failed');$zip->addFromString('proof.txt','actual-build');if(!$zip->close()||!is_file($path))throw new RuntimeException('Private ZIP completion failed');$zip->open($path);if($zip->getFromName('proof.txt')!=='actual-build')throw new RuntimeException('ZIP content mismatch');$zip->close();unlink($path);}
}finally{$actual=realpath($root);if(!$actual||realpath(dirname($actual))!==$base||!str_starts_with(basename($actual),"build-storage-qa-"))throw new RuntimeException("Unsafe cleanup target");foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST)as $file){if($file->isDir())rmdir($file->getPathname());else unlink($file->getPathname());}rmdir($root);}

echo "Client build storage: restricted system temp, private directory and two independent ZIP downloads passed\n";
