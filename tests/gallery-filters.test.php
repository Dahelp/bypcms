<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/Gallery.php';
use BYPCMS\Core\Gallery;
$seed=require __DIR__.'/../server/_core/GallerySeed.php';$products=$seed['products'];
$n=0;$check=static function($v,$m)use(&$n){if(!$v)throw new RuntimeException($m);$n++;};
$render=static function(array $query,array $rows)use($seed){$_GET=$query;ob_start();Gallery::render($rows,['site_name'=>'QA'],$seed['pages'],'catalog');$html=ob_get_clean();$doc=new DOMDocument();@$doc->loadHTML('<?xml encoding="utf-8" ?>'.$html);$xp=new DOMXPath($doc);$slugs=[];foreach($xp->query('//article[contains(@class,"g-card")]/a[1]')as $link)$slugs[]=trim(str_replace('/product/','',$link->getAttribute('href')),'/');return [$slugs,$html];};
$cases=[
 [[],['forma-chair','oak-light','spaces-book']],
 [['q'=>'FORMA-SAND'],['forma-chair']],[['q'=>'светильник'],['oak-light']],[['q'=>'Gallery Editions'],['spaces-book']],[['q'=>'unmatched'],[]],
 [['category'=>'Свет'],['oak-light']],[['collection'=>'Тихое утро'],['forma-chair','oak-light']],[['brand'=>'Gallery Editions'],['spaces-book']],
 [['category'=>'Свет','collection'=>'Тихое утро','brand'=>'Gallery Objects','min'=>'18900','max'=>'18900'],['oak-light']],
 [['category'=>'Свет','brand'=>'Gallery Editions'],[]],
 [['max'=>'0'],[]],[['min'=>'0','max'=>'0'],[]],[['min'=>'0'],['forma-chair','oak-light','spaces-book']],
 [['sort'=>'price'],['spaces-book','oak-light','forma-chair']],[['sort'=>'price-desc'],['forma-chair','oak-light','spaces-book']],
 [['min'=>'3900','max'=>'18900'],['oak-light','spaces-book']],[['min'=>'20000','max'=>'100'],[]],
];
foreach($cases as [$q,$want]){[$actual,$html]=$render($q,$products);$check($actual===$want,'filter '.json_encode($q,JSON_UNESCAPED_UNICODE));}
[$actual]=$render(['q'=>'0'],$products);$check(!$actual,'literal zero search is not an empty search');
set_error_handler(static function($level,$message){if(!(error_reporting()&$level))return false;throw new RuntimeException($message);});
foreach(['q','category','collection','brand','sort','page','min','max']as $key){[$actual,$html]=$render([$key=>['bad']],$products);$check(!$actual&&str_contains($html,'role="alert"'),'array filter fails without PHP warning: '.$key);}
restore_error_handler();
$fraction=$products;$fraction[0]['variants'][0]['price']=3745;$fraction[0]['variants'][1]['price']=3746;
foreach(['37.45','37,45']as $value){[$actual]=$render(['min'=>$value,'max'=>$value],$fraction);$check($actual===['forma-chair'],'fractional bound');}
foreach(['-1','bad','1e3','0.001']as $value){[$actual,$html]=$render(['max'=>$value],$products);$check(!$actual&&str_contains($html,'role="alert"'),'invalid range fails visibly');}
$many=[];for($i=1;$i<=25;$i++){$p=$products[0];$p['slug']='qa-'.str_pad((string)$i,2,'0',STR_PAD_LEFT);$p['title']='QA '.$i;$p['variants'][0]['price']=$i*100;$p['variants']=[$p['variants'][0]];$p['category']='QA';$many[]=$p;}
foreach([1,2,3]as $page){[$actual,$html]=$render(['category'=>'QA','min'=>'0.01','max'=>'25','sort'=>'price','page'=>$page],$many);$want=array_map(fn($i)=>'qa-'.str_pad((string)$i,2,'0',STR_PAD_LEFT),range(($page-1)*9+1,min($page*9,25)));$check($actual===$want,'pagination page '.$page);$check(str_contains($html,'category=QA')&&str_contains($html,'min=0.01')&&str_contains($html,'max=25')&&str_contains($html,'sort=price'),'pagination preserves all filters');}
[$actual,$normal]=$render([],$products);$check(!str_contains($normal,'web-vitals.iife.js'),'diagnostics off by default');[$actual,$audit]=$render(['vitals'=>'1'],$products);$check(str_contains($audit,'web-vitals.iife.js')&&str_contains($audit,'vitals.js'),'explicit diagnostics use same renderer');
echo 'Gallery filters: '.$n." checks passed\n";
