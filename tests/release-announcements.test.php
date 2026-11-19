<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/ReleaseAnnouncements.php';
use BYPCMS\Core\ReleaseAnnouncements as A;
$checks=0;function verify(bool $yes,string $why):void{global $checks;if(!$yes)throw new RuntimeException($why);$checks++;}
$release=['version'=>'2.7.2','editions'=>['content','business','commerce'],'from'=>['2.7.1'],'modules'=>['content'],'notes'=>['Новая проверка','<script>alert(1)</script>']];
$license=['edition'=>'Content','installed_version'=>'2.7.1','core_version'=>'2.7.1','entitlements'=>'["content","seo"]'];
foreach(['Content','Business','Commerce']as $e)verify(A::eligible($release,array_replace($license,['edition'=>$e])),'compatible edition '.$e);
foreach([['installed_version'=>'2.7.2'],['installed_version'=>'2.8.0'],['entitlements'=>'[]'],['edition'=>'Unknown']]as $wrong)verify(!A::eligible($release,array_replace($license,$wrong)),'unavailable or installed release excluded');
$mail=A::message($release,'https://example.test');verify($mail['template_key']==='release_available'&&str_contains($mail['message'],'2.7.2'),'dedicated release template');verify(str_contains($mail['message'],'подтвердите')&&str_contains($mail['message'],'/account/'),'owner confirmation and subscription controls explained');verify(!str_contains($mail['html'],'<script>')&&str_contains($mail['html'],'&lt;script&gt;'),'notes safely escaped');verify(!preg_match('/[\r\n]/',$mail['subject']),'safe subject');
foreach(['javascript:alert(1)','https://user:pass@example.test/','https://example.test/#secret']as $origin)try{A::message($release,$origin);throw new LogicException('Unsafe origin');}catch(InvalidArgumentException $e){verify(true,'unsafe origin rejected');}
echo $checks." release eligibility, notes, escaping and confirmation checks passed\n";
