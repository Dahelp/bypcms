<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/Business.php';require_once __DIR__.'/../server/_core/Atelier.php';
use BYPCMS\Core\{Business,Atelier};
$n=0;$check=static function(bool $ok,string $message)use(&$n){if(!$ok)throw new RuntimeException($message);$n++;};
$v=['name'=>'Заказчик','email'=>'test@example.test','phone'=>'','message'=>'Нужен интерьер','consent'=>'1','request_token'=>str_repeat('a',32)];
$check(Business::leadInput($v)['name']==='Заказчик','valid lead');
foreach([['name'=>''],['email'=>'bad'],['consent'=>'0'],['website'=>'spam'],['phone'=>'<script>'],['request_token'=>'x'],['message'=>str_repeat('a',5001)]]as $bad){try{Business::leadInput(array_merge($v,$bad));throw new LogicException('Not rejected');}catch(RuntimeException $e){$check(true,'invalid field rejected');}}
$check(!Business::published(['status'=>'draft']),'draft private');$check(!Business::published(['status'=>'scheduled','published_at'=>'2099-01-01 00:00:00']),'future private');$check(Business::published(['status'=>'published']),'published visible');
$pages=require __DIR__.'/../server/_core/AtelierSeed.php';$s=['site_name'=>'ATELIER_TEST','site_url'=>'https://example.test','tagline'=>'Space','menu'=>[]];
foreach(['','services','projects','services/interiors','projects/quiet-house','about','privacy','team','search','contact','no-such-page']as $path){$_GET=[];ob_start();Atelier::render($pages,$s,$path,'/atelier',['demo'=>true]);$html=ob_get_clean();$check(str_contains($html,'ATELIER_TEST')&&str_contains($html,'atelier.css'),'actual renderer '.$path);$check(!str_contains($html,'Warning:')&&!str_contains($html,'Fatal error'),'no warning '.$path);}
$_GET=['service'=>1];ob_start();Atelier::render($pages,$s,'projects');$html=ob_get_clean();$check(str_contains($html,'Жить проще')&&!str_contains($html,'Тихий дом'),'service filter');
$check(http_response_code()===200,'filter status');
echo 'Business / Atelier: '.$n." checks passed\n";
