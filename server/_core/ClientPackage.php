<?php
declare(strict_types=1);
namespace BYPCMS\Core;

/** Shared customer payload. Runtime storage and previous releases never ship. */
final class ClientPackage {
    /** Hosting may forbid the global PHP temp directory through open_basedir. */
    public static function temporaryArchive(string $source):string {
        require_once __DIR__.'/UpdateRuntime.php';
        $directory=UpdateRuntime::storage($source,true).'/build-downloads';
        if(!is_dir($directory)&&!@mkdir($directory,0700,true))throw new \RuntimeException('Не удалось создать приватный каталог сборок.');
        if(!is_writable($directory))throw new \RuntimeException('Приватный каталог сборок недоступен для записи.');
        return $directory.'/'.bin2hex(random_bytes(20)).'.zip';
    }
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
