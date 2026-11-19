<?php
declare(strict_types=1);
require __DIR__.'/../server/_core/ModuleReadiness.php';
use BYPCMS\Core\ModuleReadiness as M;
$n=0;function check(bool $v,string $why):void{global $n;if(!$v)throw new RuntimeException($why);$n++;}
foreach(['content','business','commerce']as $ed){check(!M::allowed('analytics',$ed),'analytics not accepted');check(M::allowed('content',$ed)&&M::allowed('seo',$ed),'base modules accepted');try{M::assertSelection(['analytics'],$ed);throw new LogicException('Expected rejection');}catch(InvalidArgumentException $e){check(str_contains($e->getMessage(),'ранее'),'rejection explains retained rights');}}
check(M::allowed('forms','business')&&!M::allowed('forms','commerce')&&!M::allowed('forms','content'),'forms only in accepted edition');
check(!M::allowed('unknown','commerce'),'unknown module fails closed');
$rows=[['edition'=>'Content','module_key'=>'analytics','availability'=>'included'],['edition'=>'Commerce','module_key'=>'forms','availability'=>'optional'],['edition'=>'Business','module_key'=>'forms','availability'=>'included']];
$filtered=M::availability($rows);check($filtered[0]['availability']==='hidden'&&$filtered[1]['availability']==='hidden'&&$filtered[2]['availability']==='included','SQL flags cannot override readiness');check($rows[0]['availability']==='included','policy does not rewrite persisted rights');
$planned=M::describe([['module_key'=>'analytics','status'=>'published']])[0];check($planned['status']==='draft'&&$planned['catalog_status']==='published','owner sees effective status and stored history separately');
foreach(M::all()as $m)check($m['readiness']==='planned'?count($m['editions'])===0:count($m['features'])===6,'complete public contract');
echo "$n module readiness, compatibility and fail-closed checks passed\n";
