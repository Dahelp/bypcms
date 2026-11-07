<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use InvalidArgumentException;
use RuntimeException;
require_once __DIR__.'/UpdateRuntime.php';
require_once __DIR__.'/LicenseCrypto.php';
require_once __DIR__.'/LicensePolicy.php';

final class CommerceSettings {
    private string $directory;
    public function __construct(private string $root,private array $config){$this->directory=UpdateRuntime::storage($root,true).'/commerce';if(!is_dir($this->directory)&&!mkdir($this->directory,0750,true))throw new RuntimeException('Нет приватного каталога настроек оплаты.');}
    public static function defaults():array{return ['payments_enabled'=>false,'mode'=>'test','shop_id'=>'','receipt_mode'=>'yookassa','vat_code'=>0,'tax_system_code'=>0,'payment_subject'=>'','payment_mode'=>'','smtp_enabled'=>false,'smtp_host'=>'','smtp_port'=>587,'smtp_security'=>'starttls','smtp_user'=>'','from_email'=>'','from_name'=>'BYPCMS','owner_email'=>''];}
    public function get():array {
        $saved=UpdateRuntime::json($this->directory.'/settings.json');$data=array_replace(self::defaults(),$saved);
        foreach(['shop_secret','smtp_password']as $key)$data[$key]=empty($saved[$key.'_cipher'])?'':LicenseCrypto::decrypt($saved[$key.'_cipher'],$this->config['app']['key']);
        unset($data['shop_secret_cipher'],$data['smtp_password_cipher']);return $data;
    }
    public function public():array{$data=$this->get();foreach(['shop_secret','smtp_password']as $key){$data[$key.'_saved']=$data[$key]!=='';unset($data[$key]);}return $data;}
    public static function email(string $value):string{$value=trim($value);if(strlen($value)>190||!filter_var($value,FILTER_VALIDATE_EMAIL)||preg_match('/[\r\n]/',$value))throw new InvalidArgumentException('Укажите корректный email.');return $value;}
    public function save(array $input,Database $db):array {
        $lock=@fopen($this->directory.'/settings.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('Настройки заняты или хранилище недоступно. Повторите позже.');
        try {
            $old=$this->get();$data=$old;
            foreach(self::defaults()as $key=>$default)if(array_key_exists($key,$input))$data[$key]=is_bool($default)?(bool)$input[$key]:(is_int($default)?(int)$input[$key]:trim((string)$input[$key]));
            foreach(['shop_secret','smtp_password']as $key){if(!empty($input['clear_'.$key]))$data[$key]='';elseif(isset($input[$key])&&$input[$key]!=='')$data[$key]=(string)$input[$key];if(strlen($data[$key])>2048||preg_match('/[\r\n\x00]/',$data[$key]))throw new InvalidArgumentException('Некорректный секрет подключения.');}
            if(!in_array($data['mode'],['test','live'],true)||!in_array($data['receipt_mode'],['yookassa','external'],true))throw new InvalidArgumentException('Проверьте режим оплаты и чеков.');
            if($data['shop_id']!==''&&!preg_match('/^[0-9]{1,40}$/D',$data['shop_id']))throw new InvalidArgumentException('Shop ID должен состоять из цифр.');
            if($data['payments_enabled']){
                if($data['shop_id']===''||$data['shop_secret']==='')throw new InvalidArgumentException('Для включения оплаты нужны Shop ID и секретный ключ ЮKassa.');
                if($data['receipt_mode']==='yookassa'&&(!in_array($data['vat_code'],range(1,12),true)||!in_array($data['payment_subject'],['intellectual_activity','service','property_right'],true)||!in_array($data['payment_mode'],['full_payment','full_prepayment'],true)))throw new InvalidArgumentException('Выберите параметры чеков по настройкам вашего магазина.');
                if($data['tax_system_code']<0||$data['tax_system_code']>6)throw new InvalidArgumentException('Некорректная система налогообложения.');
                $url=LicensePolicy::site($this->config['app']['url'],(bool)($this->config['app']['debug']??false));
            }
            if(($old['shop_id']!==$data['shop_id']||$old['mode']!==$data['mode'])&&$db->one('SELECT id FROM byp_payment_attempts WHERE state IN ("creating","uncertain","pending","waiting_for_capture") LIMIT 1'))throw new InvalidArgumentException('Сначала завершите или сверьте незавершённые платежи прежнего магазина/режима.');
            if(!in_array($data['smtp_security'],['ssl','starttls'],true)||!in_array($data['smtp_port'],[465,587],true))throw new InvalidArgumentException('SMTP: используйте SSL:465 или STARTTLS:587.');
            if($data['smtp_host']!==''&&!preg_match('/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/D',$data['smtp_host']))throw new InvalidArgumentException('SMTP host указывается без протокола и пути.');
            foreach(['owner_email','from_email']as $key)if($data[$key]!=='')$data[$key]=self::email($data[$key]);
            if(strlen($data['from_name'])>120||preg_match('/[\r\n\x00]/',$data['from_name'])||strlen($data['smtp_user'])>190||preg_match('/[\r\n\x00]/',$data['smtp_user']))throw new InvalidArgumentException('Проверьте имя отправителя и логин SMTP.');
            if($data['smtp_enabled']&&($data['smtp_host']===''||$data['smtp_user']===''||$data['smtp_password']===''||$data['from_email']===''||$data['owner_email']===''))throw new InvalidArgumentException('Заполните SMTP, отправителя и email владельца.');
            $saved=$data;foreach(['shop_secret','smtp_password']as $key){$saved[$key.'_cipher']=$data[$key]===''?'':LicenseCrypto::encrypt($data[$key],$this->config['app']['key']);unset($saved[$key]);}UpdateRuntime::atomic($this->directory.'/settings.json',$saved);return $this->public();
        } finally {flock($lock,LOCK_UN);fclose($lock);}
    }
    public function workerReport(array $data):void{UpdateRuntime::atomic($this->directory.'/worker.json',$data+['at'=>time()]);}
    public function workerStatus():array{$data=UpdateRuntime::json($this->directory.'/worker.json');$data['healthy']=($data['at']??0)>time()-900;return $data;}
}
