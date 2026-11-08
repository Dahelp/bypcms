<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/UpdatePackage.php';
use BYPCMS\Core\UpdatePackage;
$root=realpath($argv[1]??'out');$target=$argv[2]??'out/_private/update-candidate.php';$payload=$target.'.payload';
$manifest=['schema'=>'bypcms.release/v1','version'=>$argv[3]??'2.5.0','from'=>['2.0.0','2.1.0','2.1.1','2.1.2','2.2.0','2.3.0','2.3.1','2.3.2','2.3.3','2.4.0'],'editions'=>['content','business','commerce'],'modules'=>['content'],'php_min'=>'8.2.0','migrations'=>[],'files'=>[]];
$files=[];foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS))as $file){if(!$file->isFile()||$file->isLink())continue;$path=str_replace('\\','/',substr($file->getPathname(),strlen($root)+1));if(UpdatePackage::path($path)&&!str_starts_with($path,'themes/'))$files[$path]=$file->getPathname();}ksort($files);
if(!is_dir(dirname($target)))mkdir(dirname($target),0750,true);$zip=new ZipArchive();if($zip->open($payload,ZipArchive::CREATE|ZipArchive::OVERWRITE)!==true)throw new RuntimeException('Cannot build update');
foreach($files as $path=>$source){$manifest['files'][$path]=['size'=>filesize($source),'sha256'=>hash_file('sha256',$source)];$zip->addFile($source,'files/'.$path);}UpdatePackage::manifest($manifest);$zip->addFromString('manifest.json',json_encode($manifest,JSON_THROW_ON_ERROR|JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES));if(!$zip->close())throw new RuntimeException('Cannot save update');UpdatePackage::inspect($payload,null);
$out=fopen($target,'wb');$in=fopen($payload,'rb');if(!$out||!$in)throw new RuntimeException('Cannot protect update');fwrite($out,UpdatePackage::GUARD);stream_copy_to_stream($in,$out);fclose($in);fclose($out);unlink($payload);echo 'Update candidate '.$manifest['version'].' prepared' .PHP_EOL;
