<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use InvalidArgumentException;
final class CommerceLegal {
    public const VERSION='2026-11-07.1';
    public static function documents():array{return json_decode((string)file_get_contents(__DIR__.'/../legal/documents/'.self::VERSION.'.json'),true,32,JSON_THROW_ON_ERROR);}
    public static function info():array{return ['version'=>self::VERSION,'offer'=>'/legal/offer/','privacy'=>'/legal/privacy/','consent'=>'/legal/consent/','refunds'=>'/legal/refunds/','archive'=>'/legal/documents/'.self::VERSION.'.json'];}
    public static function validate(array $input,bool $offer=true):void {
        if(($input['legal_version']??'')!==self::VERSION)throw new InvalidArgumentException('Версия документов изменилась. Откройте актуальные документы и подтвердите согласие повторно.');
        if(!in_array($input['accept_privacy']??null,[true,1,'1'],true))throw new InvalidArgumentException('Нужно отдельное согласие на обработку данных.');
        if($offer&&!in_array($input['accept_terms']??null,[true,1,'1'],true))throw new InvalidArgumentException('Подтвердите принятие условий покупки.');
    }
    public static function record(Database $db,int $customer,?int $order,bool $offer=true):void {
        $docs=self::documents();foreach($offer?['offer','privacy','consent']:['privacy','consent']as $key){
            if($order&&$db->one('SELECT id FROM byp_commerce_consents WHERE order_id=? AND document_key=? AND version=?',[$order,$key,self::VERSION]))continue;
            $db->execute('INSERT INTO byp_commerce_consents(customer_id,order_id,document_key,version,document_hash,ip_address,user_agent,created_at) VALUES(?,?,?,?,?,?,?,NOW())',[$customer,$order,$key,self::VERSION,hash('sha256',json_encode($docs['documents'][$key],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)),substr((string)($_SERVER['REMOTE_ADDR']??''),0,45),substr((string)($_SERVER['HTTP_USER_AGENT']??''),0,255)]);
        }
    }
    public static function accepted(Database $db,int $order):bool{return (int)$db->one('SELECT COUNT(DISTINCT document_key) n FROM byp_commerce_consents WHERE order_id=? AND document_key IN ("offer","consent")',[$order])['n']===2;}
}
