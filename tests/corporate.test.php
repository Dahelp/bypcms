<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/Corporate.php';
require_once __DIR__.'/../server/_core/BusinessLead.php';
use BYPCMS\Core\{Corporate,BusinessLead};
$n=0;function check(bool $ok,string $why):void {global $n;if(!$ok)throw new RuntimeException($why);$n++;}
set_error_handler(static function($level,$message){throw new RuntimeException($message);});
$pages=require __DIR__.'/../server/_core/CorporateSeed.php';
$settings=['site_name'=>'CORPORATE_PROOF','site_url'=>'https://example.test','tagline'=>'B2B_PROOF','menu'=>[]];
function render(string $path,array $query=[],?array $records=null,array $options=[]):string {global $pages,$settings;$_GET=$query;ob_start();Corporate::render($records??$pages,$settings,$path,'/corporate',$options+['demo'=>true]);return ob_get_clean();}
foreach(['','services','projects','team','contact','search','about','privacy',...array_column(array_filter($pages,fn($p)=>in_array($p['kind'],['service','project','person'])),'slug')] as $path){$h=render($path);check(http_response_code()===200,'route '.$path);check(str_contains($h,'corporate.css')&&str_contains($h,'CORPORATE_PROOF'),'theme '.$path);check(substr_count($h,'<h1')===1,'one heading '.$path);}
$h=render('projects',['service'=>102]);check(str_contains($h,'business-campus')&&str_contains($h,'workplace-platform')&&!str_contains($h,'operating-model'),'project filter');
$h=render('services/infrastructure');check(str_contains($h,'project=')===false&&str_contains($h,'service=102')&&str_contains($h,'business-campus'),'service to cases and request');
$h=render('projects/business-campus');check(str_contains($h,'project=201')&&str_contains($h,'service=102')&&str_contains($h,'team/technical-lead'),'case relationships');
check(str_contains(render('search'),'Введите запрос'),'initial search');check(str_contains(render('search',['q'=>'NO_MATCH_PROOF']),'Ничего не найдено'),'empty search');
check(str_contains(render('search',['q'=>'Стратегия']),'services/strategy'),'real search');
render('search',['q'=>['bad']]);check(http_response_code()===400,'array search rejected');render('projects',['service'=>'1x']);check(http_response_code()===400,'invalid filter');
render('missing');check(http_response_code()===404,'missing 404');render('request-success');check(http_response_code()===404,'receipt private');check(str_contains(render('request-success',[],null,['receipt'=>'TEST_REF']),'TEST_REF'),'owned receipt');
$private=$pages;$private[]=['id'=>999,'kind'=>'service','slug'=>'private','title'=>'PRIVATE_PROOF','status'=>'draft'];check(!str_contains(render('services',[],$private),'PRIVATE_PROOF'),'draft hidden');$private[count($private)-1]['status']='scheduled';$private[count($private)-1]['published_at']='2099-01-01 00:00:00';check(!str_contains(render('services',[],$private),'PRIVATE_PROOF'),'future hidden');
for($i=0;$i<8;$i++)$private[]=['id'=>500+$i,'kind'=>'project','slug'=>'case-'.$i,'title'=>'PAGINATION_PROOF '.$i,'parent_id'=>102,'status'=>'published'];$h=render('projects',['service'=>102],$private,['snapshot'=>'abcdef']);check(str_contains($h,'page=2')&&str_contains($h,'snapshot=abcdef')&&str_contains($h,'service=102'),'pagination preserves filter and snapshot');
$h=render('services',[],[]);check(str_contains($h,'Материалы пока не опубликованы'),'empty content');
$h=render('search',['q'=>'<script>alert(1)</script>']);check(!str_contains($h,'<script>alert(1)</script>')&&str_contains($h,'&lt;script&gt;'),'query escaped');
$v=['name'=>'Тест','email'=>'visitor@example.test','message'=>'Тестовая задача','consent'=>'1','request_token'=>str_repeat('a',32)];check(BusinessLead::input($v)['email']==='visitor@example.test','valid shared lead');
foreach([['email'=>[]],['service_id'=>'1x'],['project_id'=>'-1'],['website'=>'0'],['consent'=>'0'],['phone'=>'bad'],['request_token'=>[]]] as $bad){try{BusinessLead::input(array_replace($v,$bad));throw new LogicException('Accepted malformed lead');}catch(RuntimeException){check(true,'invalid lead');}}
restore_error_handler();echo "Corporate: $n checks passed\n";
