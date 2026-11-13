<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/CommerceBankSettings.php';
use BYPCMS\Core\{CommerceBankSettings,CommerceLegal};
$checks=0;
function check(bool $ok,string $why):void{global $checks;if(!$ok)throw new RuntimeException($why);$checks++;}
function rejects(callable $fn,string $why):void{try{$fn();}catch(InvalidArgumentException $e){check(true,$why);return;}throw new RuntimeException($why);}
// Artificial checksum-valid account; never a real beneficiary or payment destination.
function account(string $base,string $prefix):string{for($i=0;$i<10;$i++){$s=substr_replace($base,(string)$i,8,1);$sum=0;foreach(str_split($prefix.$s)as $n=>$d)$sum+=(int)$d*[7,1,3][$n%3];if($sum%10===0)return $s;}throw new RuntimeException('Fixture checksum');}
$bank=['recipient'=>'Тестовый получатель','inn'=>'550519989590','bank'=>'Тестовый банк','bik'=>'044525225','account'=>account('40817810000000000000','225'),'correspondent'=>account('30101810000000000000','025')];
CommerceBankSettings::validate($bank);check(true,'valid beneficiary checksum');
foreach([['bik'=>'bad'],['account'=>'123'],['account'=>substr_replace($bank['account'],'9',0,1)],['correspondent'=>'00000000000000000000'],['recipient'=>"Имя\nполучателя"],['inn'=>'123'],['bank'=>'']]as $bad)rejects(fn()=>CommerceBankSettings::validate(array_replace($bank,$bad)),'invalid bank fields rejected');
$docs=CommerceLegal::documents();check($docs['version']===CommerceLegal::VERSION,'current legal version matches server');check(is_file(__DIR__.'/../server/legal/documents/2026-11-07.1.json'),'old consent archive preserved');
$offer=json_encode($docs['documents']['offer'],JSON_UNESCAPED_UNICODE);check(str_contains($offer,'банковский перевод')&&str_contains($offer,'Автоплатежи')&&str_contains($offer,'точный состав'),'invoice billing and service agreement documented');
$refunds=json_encode($docs['documents']['refunds'],JSON_UNESCAPED_UNICODE);check(str_contains($refunds,'не инициирует банковский перевод'),'manual refund recording does not send money');
$source=file_get_contents(__DIR__.'/../app/components/CommerceInvoicePanel.tsx');check(str_contains($source,'else dialog.current?.close()'),'confirmation dialog closes on cancel and completion');
echo "$checks invoice policy, beneficiary and archived-terms checks passed\n";
