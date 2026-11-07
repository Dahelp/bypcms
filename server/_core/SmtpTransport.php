<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use RuntimeException;
require_once __DIR__.'/CommerceSettings.php';

final class MailTransportException extends RuntimeException {public function __construct(string $message,public bool $uncertain=false){parent::__construct($message);}}
final class SmtpTransport {
    public function __construct(private array $settings,private array $config){}
    private static function header(string $text):string {
        if(preg_match('/[\r\n\x00]/',$text))throw new RuntimeException('Некорректный заголовок письма.');
        $words=[];$part='';foreach(preg_split('//u',$text,-1,PREG_SPLIT_NO_EMPTY)as $char){if(strlen($part.$char)>42){$words[]='=?UTF-8?B?'.base64_encode($part).'?=';$part='';}$part.=$char;}if($part!=='')$words[]='=?UTF-8?B?'.base64_encode($part).'?=';return implode("\r\n ",$words);
    }
    public function send(array $mail):void {
        $s=$this->settings;if(empty($s['smtp_enabled']))throw new MailTransportException('Отправка SMTP не включена.');
        $from=CommerceSettings::email($s['from_email']);$to=CommerceSettings::email($mail['recipient']);$domain=substr(strrchr($from,'@'),1);
        $body=str_replace(["\r\n","\r"],"\n",$mail['message']);
        $message='Date: '.gmdate('D, d M Y H:i:s').' +0000'."\r\n".'From: '.self::header($s['from_name']).' <'.$from.'>'."\r\n".'To: <'.$to.'>'."\r\n".'Subject: '.self::header($mail['subject'])."\r\n".'Message-ID: <bypcms-'.hash('sha256',$mail['event_key']).'@'.$domain.'>'."\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n".quoted_printable_encode(str_replace("\n","\r\n",$body))."\r\n";
        $host=$s['smtp_host'];$port=$s['smtp_port'];$ca=null;
        if(!empty($this->config['app']['debug'])&&!empty($this->config['commerce']['test_smtp'])){$test=$this->config['commerce']['test_smtp'];if(($test['host']??'')!=='127.0.0.1')throw new RuntimeException('Тестовый SMTP допускается только на loopback.');$host=$test['host'];$port=(int)$test['port'];$ca=$test['ca_file']??null;}
        $url=($s['smtp_security']==='ssl'?'smtps':'smtp').'://'.$host.':'.$port;
        $in=fopen('php://temp','w+b');fwrite($in,$message);rewind($in);$curl=curl_init($url);
        curl_setopt_array($curl,[CURLOPT_PROTOCOLS=>CURLPROTO_SMTP|CURLPROTO_SMTPS,CURLOPT_USE_SSL=>CURLUSESSL_ALL,CURLOPT_USERNAME=>$s['smtp_user'],CURLOPT_PASSWORD=>$s['smtp_password'],CURLOPT_MAIL_FROM=>'<'.$from.'>',CURLOPT_MAIL_RCPT=>['<'.$to.'>'],CURLOPT_UPLOAD=>true,CURLOPT_INFILE=>$in,CURLOPT_INFILESIZE=>strlen($message),CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>15,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_PROXY=>'',CURLOPT_RETURNTRANSFER=>true]);
        if($ca)curl_setopt($curl,CURLOPT_CAINFO,$ca);
        $ok=curl_exec($curl);$code=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);$uploaded=(int)curl_getinfo($curl,CURLINFO_SIZE_UPLOAD);curl_close($curl);fclose($in);
        if($ok===false||$code>=400){$uncertain=$uploaded>0&&$code<400;throw new MailTransportException($uncertain?'SMTP не подтвердил приём после передачи письма. Проверьте получателя перед повтором.':'SMTP не принял письмо. Проверьте подключение и данные отправителя.',$uncertain);}
    }
}
