<?php
declare(strict_types=1);
require __DIR__.'/../server/_core/CustomerAccounts.php';
use BYPCMS\Core\CustomerAccounts;
$checks=0;
function check(bool $value,string $label):void{global $checks;if(!$value)throw new RuntimeException($label);$checks++;}
foreach(['/account/','/account/order.php?id=4','/account/purchase.php?id=4&download=1','/order/?edition=commerce']as $path)check(CustomerAccounts::returnTo($path)===$path,'safe return');
foreach(['https://evil.test','//evil.test','/owner/','/account/reset.php?token=x',"/account/\r\nX: x",'/account/\\evil.test','/account/#fragment',str_repeat('x',2501)]as $path)check(CustomerAccounts::returnTo($path)==='/account/','unsafe return');
CustomerAccounts::password('A-secure-password-2026','A-secure-password-2026');check(true,'normal password');
foreach([['short','short'],['A-secure-password-2026','different'],[str_repeat('a',73),str_repeat('a',73)],[str_repeat('я',37),str_repeat('я',37)],["password\0long-enough","password\0long-enough"]]as [$a,$b]){try{CustomerAccounts::password($a,$b);throw new LogicException('Expected rejection');}catch(InvalidArgumentException $e){check(true,'invalid password rejected');}}
echo "$checks recovery password and return URL checks passed\n";
