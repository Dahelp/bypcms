<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/Chronicle.php';
use BYPCMS\Core\{Chronicle,Content};
$seed=require __DIR__.'/../server/_core/ChronicleSeed.php';$settings=['site_name'=>'Chronicle QA','site_url'=>'https://example.test','tagline'=>'Independent reading','accent'=>'#a82b24'];
$n=0;$check=static function($v,$m)use(&$n){if(!$v)throw new RuntimeException($m);$n++;};
set_error_handler(static function($level,$message){if(error_reporting()&$level)throw new RuntimeException($message);return false;});
$render=static function(string $path,array $query=[],?array $pages=null,bool $preview=false,string $snapshot='')use($seed,$settings){$_GET=$query;ob_start();Chronicle::render($pages??$seed['pages'],$seed['terms'],$settings,$path,'/chronicle',$preview,$snapshot);return [ob_get_clean(),http_response_code()];};
foreach(['','articles','category/city','category/letters','author/editors','author/guest','walkable-city','about','contacts','search']as $path){[$html,$status]=$render($path);$check($status===200&&str_contains($html,'chronicle.css')&&str_contains($html,'c-footer'),'route '.$path);$check(!str_contains($html,'Warning:')&&!str_contains($html,'j-site'),'independent safe renderer '.$path);}
foreach(['missing','category/missing','author/missing']as $path){[$html,$status]=$render($path);$check($status===404&&str_contains($html,'Эта страница'),'real 404 '.$path);}
[$html]=$render('walkable-city');$check(str_contains($html,'reading-1')&&str_contains($html,'aria-label="Оглавление"')&&str_contains($html,'c-prose'),'long reading and toc');$check(str_contains($html,'/author/city-desk/')&&str_contains($html,'/category/city/'),'author and category links');$check(str_contains($html,'srcset=')&&str_contains($html,'editorial-1-480.webp'),'responsive media');$check(str_contains($html,'og:type" content="article"')&&str_contains($html,'rel="canonical"'),'article SEO');
[$html]=$render('articles',['page'=>'2']);$doc=new DOMDocument();@$doc->loadHTML('<?xml encoding="utf-8" ?>'.$html);$xp=new DOMXPath($doc);$check($xp->query('//div[contains(@class,"c-archive-grid")]/article')->length===3,'second page exactly three records');
[$html]=$render('articles',['category'=>'city','sort'=>'old']);$check(str_contains($html,'Право на медленный маршрут')&&!str_contains($html,'class="c-card "><a class="c-card-image" href="/chronicle/library-as-place/'),'category filter');
$date=$seed['pages'][0]['published_at'];[$html]=$render('articles',['year'=>substr($date,0,4),'month'=>substr($date,5,2)]);$check(str_contains($html,'walkable-city'),'archive period finds current issue');
[$html]=$render('articles',['year'=>'1900']);$check(str_contains($html,'Публикаций пока нет'),'empty archive');$check(str_contains($html,'<option selected>1900</option>'),'empty archive retains requested year in controls');
[$html]=$render('category/city');$check(!str_contains($html,'name="category"'),'rubric page does not offer a conflicting rubric filter');
[$html]=$render('articles',['archive'=>'1']);$check(str_contains($html,'name="archive" value="1"')&&str_contains($html,'archive=1'),'archive context survives filters and pagination');
[$html]=$render('search',['q'=>'маршрут']);$check(str_contains($html,'<mark>')&&str_contains($html,'walkable-city'),'search and highlighting');
[$html]=$render('search',['q'=>'NO_MATCH_XYZ']);$check(str_contains($html,'ничего не найдено')&&!str_contains($html,'c-card-image'),'empty search');
foreach(['q','year','month','category','sort','page']as $key){[$html,$status]=$render('search',[$key=>['bad']]);$check($status===400&&str_contains($html,'role="alert"'),'invalid parameter '.$key);}
foreach([['month'=>'13'],['year'=>'not-year']]as $q){[$html,$status]=$render('articles',$q);$check($status===400&&str_contains($html,'корректные год'),'invalid archive');}
$draft=$seed['pages'][0];$draft['slug']='draft-proof';$draft['status']='draft';[$html,$status]=$render('draft-proof',[],[$draft]);$check($status===404,'draft not public');[$html,$status]=$render('draft-proof',[],[$draft],true,'token-proof');$check($status===200&&str_contains($html,'snapshot=token-proof'),'private preview and internal links retain token');
$future=$draft;$future['status']='published';$future['published_at']=gmdate('Y-m-d H:i:s',time()+86400);[$html,$status]=$render('draft-proof',[],[$future]);$check($status===404,'future publication is private');
[$html]=$render('',[],[]);$check(str_contains($html,'Новый выпуск начинается здесь'),'empty home');$check(!str_contains($html,'Другая перспектива'),'empty home omits empty collections');
[$html]=$render('',[],[$seed['pages'][0]]);$check(str_contains($html,'c-front-solo')&&!str_contains($html,'Другая перспектива'),'single article uses complete single feature composition');
[$html]=$render('articles',['vitals'=>'1']);$check(str_contains($html,'web-vitals.iife.js'),'opt-in metrics');[$html]=$render('articles');$check(!str_contains($html,'web-vitals.iife.js'),'no metrics by default');
$due=$draft;$due['slug']='scheduled-now';$due['status']='scheduled';$due['published_at']='2020-01-01 12:00:00';[$html,$status]=$render('scheduled-now',[],[$due]);$check($status===200&&str_contains($html,$due['title']),'scheduled record appears when its time arrives');
ob_start();Chronicle::feed([...$seed['pages'],$draft,$future,$due],$settings,'/chronicle');$rss=ob_get_clean();$xml=simplexml_load_string($rss);$check($xml!==false&&count($xml->channel->item)===13,'RSS only public articles');$check(!str_contains($rss,'draft-proof'),'RSS protects draft and schedule');
$manifest=json_decode(file_get_contents(__DIR__.'/../server/themes/chronicle/theme.json'),true);$check($manifest['id']==='chronicle'&&in_array('content',$manifest['editions'],true)&&in_array('feed',$manifest['templates'],true),'theme contract');
restore_error_handler();echo 'Chronicle: '.$n." checks passed\n";
