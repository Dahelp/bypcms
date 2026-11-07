<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/PaymentGateway.php';
require_once __DIR__.'/../server/_core/CommerceSettings.php';
use BYPCMS\Core\{PaymentGateway as Gateway,CommerceSettings as Settings};
$checks=0;
function check(bool $ok,string $why):void{global $checks;if(!$ok)throw new RuntimeException($why);$checks++;}
function rejects(callable $fn,string $why):void{try{$fn();}catch(Throwable $e){check(true,$why);return;}throw new RuntimeException($why);}
foreach([1,99,100,790000,1990000,9999999999]as $minor)check(Gateway::minor(Gateway::amount($minor))===$minor,'money roundtrip without floats');
foreach(['1e3','1,00','-1.00','01.00','1.001','1.0','NaN','1000000000.00']as $bad)rejects(fn()=>Gateway::minor($bad),'ambiguous provider money rejected');
foreach([0,-1,10000000000]as $bad)rejects(fn()=>Gateway::amount($bad),'invalid order amount rejected');
$gateway=new Gateway([],['app'=>['debug'=>false]]);
foreach(['https://yoomoney.ru/checkout/payments/v2/contract','https://payment.yookassa.ru/checkout']as $url)check($gateway->confirmation($url)===$url,'provider redirect allowed');
foreach(['http://yoomoney.ru/','https://yoomoney.ru.evil.test/','https://yoomoney.ru@evil.test/','javascript:alert(1)','https://yookassa.ru:8443/','http://127.0.0.1:8049/pay/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']as $url)rejects(fn()=>$gateway->confirmation($url),'untrusted redirect rejected');
foreach(['../../config.php','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa?x=1','1']as $id)rejects(fn()=>Gateway::id($id),'unsafe payment id rejected');
check(Gateway::id('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')==='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','provider UUID supported');
foreach(["a@example.test\r\nBcc: evil@example.test",'wrong','a@b.test,evil@b.test']as $email)rejects(fn()=>Settings::email($email),'header injection rejected');
check(!Settings::defaults()['payments_enabled']&&!Settings::defaults()['smtp_enabled'],'deployment defaults disabled');
echo "$checks payment boundary and configuration checks passed\n";
