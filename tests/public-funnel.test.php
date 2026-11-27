<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/PublicFunnel.php';
use BYPCMS\Core\PublicFunnel;
$checks=0;
$check=static function(bool $valid)use(&$checks):void{if(!$valid)throw new RuntimeException('Public funnel policy failed');$checks++;};
foreach(PublicFunnel::EVENTS as $event){
    $input=['event'=>$event,'edition'=>$event==='comparison_view'?'all':'business','term'=>'annual','locale'=>'ru'];
    $check(PublicFunnel::validate($input)===$input);
}
$base=['event'=>'checkout_open','edition'=>'content','term'=>'lifetime','locale'=>'en'];
foreach([
    [...$base,'domain'=>'buyer.example'],[...$base,'email'=>'buyer@example.test'],[...$base,'visitor_id'=>'123'],
    [...$base,'event'=>'order_saved'],[...$base,'event'=>'payment_confirmed'],
    [...$base,'event'=>'paid'],[...$base,'edition'=>'all'],[...$base,'term'=>'monthly'],[...$base,'locale'=>'de'],
    [...$base,'locale'=>['en']],array_diff_key($base,['term'=>true]),
]as $invalid){$rejected=false;try{PublicFunnel::validate($invalid);}catch(InvalidArgumentException){$rejected=true;}$check($rejected);}
$check(PublicFunnel::orderSource(['tag'=>'commerce.lifetime.en','via'=>'details']) === [
    'edition'=>'commerce','term'=>'lifetime','locale'=>'en','path'=>'details',
]);
$check(PublicFunnel::orderSource(['tag'=>'content.annual.ru'])['path'] === 'unknown');
foreach ([null, 'business.annual.en', ['tag'=>['business.annual.en']], ['tag'=>"business.annual.en\n"]] as $invalid) {
    $check(PublicFunnel::orderSource($invalid) === null);
}
$check(PublicFunnel::sameOrigin('https://bypcms.ru','https://bypcms.ru/'));
$check(PublicFunnel::sameOrigin('http://127.0.0.1:8030','http://127.0.0.1:8030/'));
foreach(['null','https://other.example','http://bypcms.ru','https://bypcms.ru.evil.test','https://user@bypcms.ru','https://bypcms.ru:444','https://bypcms.ru/path','https://bypcms.ru?x=1']as $origin)$check(!PublicFunnel::sameOrigin($origin,'https://bypcms.ru'));
echo "$checks public funnel validation and same-origin checks passed\n";
