<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use InvalidArgumentException;
use RuntimeException;

final class PaymentTransportException extends RuntimeException {public function __construct(string $message,public bool $definite=false){parent::__construct($message);}}
final class PaymentGateway {
    public function __construct(private array $settings,private array $config){}
    public static function id(string $id):string{if(!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D',$id))throw new InvalidArgumentException('Некорректный ID платежа ЮKassa.');return $id;}
    public static function minor(string $value):int{if(!preg_match('/^(0|[1-9][0-9]{0,8})\.([0-9]{2})$/D',$value,$m))throw new InvalidArgumentException('Некорректная сумма платежа.');return (int)$m[1]*100+(int)$m[2];}
    public static function amount(int $value):string{if($value<1||$value>9999999999)throw new InvalidArgumentException('Некорректная стоимость заказа.');return intdiv($value,100).'.'.str_pad((string)($value%100),2,'0',STR_PAD_LEFT);}
    public function request(string $method,string $path,?array $body=null,?string $operation=null):array {
        if(!preg_match('#^(?:payments(?:/[a-f0-9-]{36})?|refunds(?:/[a-f0-9-]{36}|\?payment_id=[a-f0-9-]{36}&limit=100(?:&cursor=[a-zA-Z0-9_.%-]{1,300})?)?)$#D',$path))throw new RuntimeException('Недопустимый запрос оплаты.');
        $base='https://api.yookassa.ru/v3';
        if(!empty($this->config['app']['debug'])&&!empty($this->config['commerce']['test_api_base'])){
            $test=$this->config['commerce']['test_api_base'];if(!preg_match('#^http://127\.0\.0\.1:[0-9]{2,5}/v3$#D',$test))throw new RuntimeException('Тестовый эквайринг допускается только на loopback.');$base=$test;
        }
        $out='';$curl=curl_init($base.'/'.$path);$headers=['Content-Type: application/json'];if($operation)$headers[]='Idempotence-Key: '.$operation;
        curl_setopt_array($curl,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPAUTH=>CURLAUTH_BASIC,CURLOPT_USERPWD=>$this->settings['shop_id'].':'.$this->settings['shop_secret'],CURLOPT_HTTPHEADER=>$headers,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROXY=>'',CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>15,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS|(!empty($this->config['app']['debug'])?CURLPROTO_HTTP:0),CURLOPT_WRITEFUNCTION=>static function($curl,$part)use(&$out){if(strlen($out)+strlen($part)>131072)return 0;$out.=$part;return strlen($part);}]);
        if($body!==null)curl_setopt($curl,CURLOPT_POSTFIELDS,json_encode($body,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE));
        $ok=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);curl_close($curl);
        if($ok===false)throw new PaymentTransportException('Нет подтверждённого ответа ЮKassa. Повтор использует тот же платёж.');
        if($status<200||$status>=300)throw new PaymentTransportException(in_array($status,[401,403],true)?'ЮKassa не приняла настройки магазина. Проверьте Shop ID и ключ.':'ЮKassa не подтвердила запрос. Проверьте журнал и повторите проверку.',in_array($status,[400,401,403,404,422],true));
        $data=json_decode($out,true);if(!is_array($data))throw new PaymentTransportException('ЮKassa вернула некорректный ответ.');return $data;
    }
    public function confirmation(string $url):string {
        $p=parse_url($url);$host=strtolower($p['host']??'');
        if(!empty($this->config['app']['debug'])&&preg_match('#^http://127\.0\.0\.1:[0-9]{2,5}/pay/[a-f0-9-]{36}$#D',$url))return $url;
        if(($p['scheme']??'')!=='https'||isset($p['user'])||isset($p['pass'])||isset($p['port'])||!preg_match('/^(?:[a-z0-9-]+\.)*(?:yoomoney\.ru|yookassa\.ru)$/D',$host))throw new RuntimeException('Недопустимый адрес подтверждения оплаты.');return $url;
    }
}
