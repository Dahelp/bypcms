<?php
declare(strict_types=1);
namespace BYPCMS\Core;

/** Shared customer payload. Runtime storage and previous releases never ship. */
final class ClientPackage {
    public static function addFiles(\ZipArchive $zip,string $source):void {
        $root=realpath($source);if(!$root)throw new \RuntimeException('Исходная сборка недоступна.');
        foreach(['_core','api','install','admin','_next','themes','updates']as $directory){
            $path=$root.'/'.$directory;if(!is_dir($path)||is_link($path))continue;
            foreach(new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($path,\FilesystemIterator::SKIP_DOTS))as $file){
                if(!$file->isFile()||$file->isLink())continue;$full=$file->getRealPath();
                if($full===false||!str_starts_with($full,$root.DIRECTORY_SEPARATOR))continue;
                $relative=str_replace('\\','/',substr($full,strlen($root)+1));
                if(str_contains($relative,'.env')||str_ends_with($relative,'.log'))continue;
                if(!$zip->addFile($full,'site/'.$relative))throw new \RuntimeException('Не удалось добавить файл клиентской сборки.');
            }
        }
    }
}
