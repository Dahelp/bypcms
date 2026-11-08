<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/UpdateRuntime.php';
require_once __DIR__.'/../server/_core/Content.php';
use BYPCMS\Core\Content;
$root=sys_get_temp_dir().'/bypcms-assets-'.bin2hex(random_bytes(6));
$private=$root.'-private';$release=str_repeat('a',32);$checks=0;
mkdir($root);mkdir($root.'/_storage');mkdir($private);mkdir($private.'/updates');
define('BYPCMS_SITE_ROOT',$root);
try {
    file_put_contents($root.'/_storage/config.php','<?php return '.var_export(['updates'=>['private_dir'=>$private]],true).';');
    file_put_contents($private.'/updates/active.json',json_encode(['release'=>$release,'version'=>'2.4.0']));
    foreach(['journal','chronicle','atelier','gallery']as $theme){
        $url='/themes/'.$theme.'/assets/cover.jpg';
        Content::$images[$url]=['width'=>1200,'variants'=>[['width'=>480,'path'=>'themes/'.$theme.'/assets/cover-480.webp']]];
        $set=Content::imageSet($url);
        if(!str_contains($set,'/_update-assets/'.$release.'/_next/static/'.$theme.'/assets/cover-480.webp 480w')||str_contains($set,'/themes/'))throw new RuntimeException('Active release srcset: '.$theme);
        $checks++;
    }
    $url='/uploads/content/cover.jpg';Content::$images[$url]=['width'=>1200,'variants'=>[['width'=>480,'path'=>'uploads/content/cover-480.webp']]];
    if(!str_contains(Content::imageSet($url),'/uploads/content/cover-480.webp 480w')||str_contains(Content::imageSet($url),'_update-assets'))throw new RuntimeException('Customer upload must remain outside releases');$checks++;
    unlink($private.'/updates/active.json');
    if(Content::asset('/themes/chronicle/chronicle.css')!=='/themes/chronicle/chronicle.css')throw new RuntimeException('Fresh install asset path');$checks++;
} finally {
    foreach([$private.'/updates/active.json',$root.'/_storage/config.php']as $file)if(is_file($file))unlink($file);
    rmdir($private.'/updates');rmdir($private);rmdir($root.'/_storage');rmdir($root);
}
echo "Theme assets: $checks checks passed\n";
