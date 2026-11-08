<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/Database.php';require_once __DIR__.'/../server/_core/Business.php';
use BYPCMS\Core\{Business,Database};
$root=realpath($argv[1]??'');if(!$root)throw new RuntimeException('QA fixture required');$c=require $root.'/_storage/config.php';if(($c['database']['port']??0)!==3319||!str_starts_with($c['database']['name'],'bypcms_business_acceptance_')||!str_starts_with($c['app']['url'],'http://127.0.0.1:805'))throw new RuntimeException('Disposable Business fixture only');
$c['app']['debug']=true;$c['commerce']['test_smtp']=['host'=>'127.0.0.1','port'=>8465,'ca_file'=>__DIR__.'/../outputs/acceptance/smtp-cert.pem'];$db=new Database($c);$b=new Business($db,$c,$root);$n=0;
function check(bool $ok,string $m):void{global $n;if(!$ok)throw new RuntimeException($m);$n++;}
function rejects(callable $f,string $m):void{try{$f();}catch(Throwable $e){check(true,$m);return;}throw new RuntimeException($m);}
function control(string $mail):void{file_get_contents('http://127.0.0.1:8049/control',false,stream_context_create(['http'=>['method'=>'POST','header'=>'Content-Type: application/json','content'=>json_encode(['mail'=>$mail])]]));}
$service=$db->one('SELECT p.id FROM byp_pages p JOIN byp_content_meta m ON m.page_id=p.id WHERE m.kind="service" LIMIT 1')['id'];
$lead=fn()=>$b->submit(['name'=>'MAIL PROOF','email'=>'mail-proof@example.test','message'=>'SMTP scenario','consent'=>'1','request_token'=>bin2hex(random_bytes(16)),'service_id'=>$service],'qa-mail-session','127.0.0.9');
try {
    $b->configureMail(['smtp_enabled'=>1,'smtp_host'=>'smtp.example.test','smtp_port'=>465,'smtp_security'=>'ssl','smtp_user'=>'qa-smtp','smtp_password'=>'Business-SMTP-Test-Only-2026','from_email'=>'studio@example.test','from_name'=>'Atelier QA','owner_email'=>'owner@example.test']);
    $raw=$db->one('SELECT setting_value FROM byp_settings WHERE setting_group="business_private" AND setting_key="smtp"')['setting_value'];check(!str_contains($raw,'Business-SMTP-Test-Only-2026'),'password encrypted at rest');check(!isset($b->mailSettings()['smtp_password']),'password never returned');
    $a=$lead();control('reject');rejects(fn()=>$b->sendMail($a['id']),'SMTP rejection visible');check($db->one('SELECT state FROM byp_business_mail WHERE lead_id=?',[$a['id']])['state']==='failed','failed state');check((bool)$db->one('SELECT id FROM byp_business_leads WHERE id=?',[$a['id']]),'lead survives mail failure');
    control('accept');$b->sendMail($a['id']);check($db->one('SELECT state FROM byp_business_mail WHERE lead_id=?',[$a['id']])['state']==='accepted','retry accepted');rejects(fn()=>$b->sendMail($a['id']),'accepted message cannot resend');
    $a=$lead();control('drop');rejects(fn()=>$b->sendMail($a['id']),'lost SMTP confirmation');check($db->one('SELECT state FROM byp_business_mail WHERE lead_id=?',[$a['id']])['state']==='uncertain','ambiguous state');rejects(fn()=>$b->sendMail($a['id']),'blind retry blocked');control('accept');$b->sendMail($a['id'],true);check($db->one('SELECT state FROM byp_business_mail WHERE lead_id=?',[$a['id']])['state']==='accepted','acknowledged retry accepted');
}finally{$b->configureMail(['smtp_enabled'=>false,'clear_password'=>1]);control('accept');}
echo $n." Business SMTP checks passed\n";
