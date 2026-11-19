<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/LicenseHttp.php';
use BYPCMS\Core\{LicenseHttp,LicenseException};
$origin=$argv[1]??'';if(!preg_match('#^http://127\.0\.0\.1:\d+$#D',$origin))throw new RuntimeException('Explicit loopback sink required');
$qa=__DIR__.'/../outputs/loader-http-'.bin2hex(random_bytes(5));mkdir($qa,0750,true);$client=new LicenseHttp(true);$checks=0;
function verify(bool $ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function failure(LicenseHttp $c,string $url,?string $destination,int $limit,string $reason):void{
 try{$c->request($url,null,$destination,$limit);throw new LogicException('Expected failure');}catch(LicenseException $e){verify($e->reason===$reason,'specific failure '.$reason);if($destination!==null)verify(!is_file($destination),'partial package removed');}
}
$start=microtime(true);$r=$client->request($origin.'/slow-package',null,$qa.'/slow.zip',200000);$elapsed=microtime(true)-$start;
verify($elapsed>8&&$elapsed<20,'real streamed download exceeds the old 8s limit');verify($r['bytes']===131072&&$r['sha256']===hash('sha256',str_repeat('x',131072)),'slow package bytes and hash verified');
$start=microtime(true);failure($client,$origin.'/slow-json',null,65536,'network_error');verify(microtime(true)-$start>=7&&microtime(true)-$start<12,'JSON keeps its short timeout');
failure($client,$origin.'/partial',$qa.'/partial.zip',200000,'network_error');failure($client,$origin.'/oversize',$qa.'/large.zip',16,'response_too_large');failure($client,$origin.'/error',$qa.'/error.zip',200000,'synthetic_upstream');failure($client,$origin.'/redirect',$qa.'/redirect.zip',200000,'remote_error');
failure($client,$origin.'/retry',$qa.'/retry.zip',200000,'network_error');$r=$client->request($origin.'/retry',null,$qa.'/retry.zip',200000);verify($r['bytes']===3&&file_get_contents($qa.'/retry.zip')==='ok!','explicit retry succeeds with a new clean file');
$start=microtime(true);failure($client,$origin.'/stall',$qa.'/stalled.zip',200000,'download_timeout');verify(microtime(true)-$start>=18&&microtime(true)-$start<28,'stalled download is bounded by the low-speed timeout');
echo json_encode(['checks'=>$checks,'slowDownloadSeconds'=>round($elapsed,2),'destination'=>$qa],JSON_THROW_ON_ERROR).PHP_EOL;
