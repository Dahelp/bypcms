<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use InvalidArgumentException;
require_once __DIR__.'/CommerceSettings.php';
require_once __DIR__.'/CommerceLegal.php';

/** Private beneficiary data. Never exported in the public catalogue or customer ZIP. */
final class CommerceBankSettings {
    private string $file;
    public function __construct(string $root,private array $config){$this->file=UpdateRuntime::storage($root,true).'/commerce/bank.json';}
    public function get():array {
        $saved=UpdateRuntime::json($this->file);$seller=CommerceLegal::documents()['seller'];
        return array_replace(['enabled'=>false,'recipient'=>$seller['name'],'inn'=>$seller['inn'],'bank'=>'','bik'=>'','account'=>'','correspondent'=>''],$saved?json_decode(LicenseCrypto::decrypt($saved['cipher'],$this->config['app']['key']),true,32,JSON_THROW_ON_ERROR):[]);
    }
    public function public():array{$s=$this->get();$s['account_saved']=$s['account']!=='';$s['account_hint']=$s['account']!==''?'•••• '.substr($s['account'],-4):'';unset($s['account']);return $s;}
    public static function validate(array $s):void {
        foreach(['recipient'=>190,'bank'=>190]as $key=>$max)if(mb_strlen($s[$key])<3||mb_strlen($s[$key])>$max||preg_match('/[\x00-\x1f]/',$s[$key]))throw new InvalidArgumentException('Заполните получателя и банк.');
        if(!preg_match('/^\d{12}$/D',$s['inn'])||!preg_match('/^\d{9}$/D',$s['bik'])||!preg_match('/^\d{20}$/D',$s['account'])||!preg_match('/^\d{20}$/D',$s['correspondent']))throw new InvalidArgumentException('Проверьте ИНН, БИК и оба банковских счёта.');
        foreach([substr($s['bik'],-3).$s['account'],'0'.substr($s['bik'],4,2).$s['correspondent']]as $digits){$sum=0;foreach(str_split($digits)as $i=>$digit)$sum+=(int)$digit*[7,1,3][$i%3];if($sum%10!==0)throw new InvalidArgumentException('Контрольная сумма счёта не соответствует БИК.');}
    }
    public function save(array $input):array {
        $lock=fopen($this->file.'.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new \RuntimeException('Настройки заняты. Повторите позже.');
        try{$s=$this->get();foreach($s as $key=>$value)if(array_key_exists($key,$input)&&($key!=='account'||$input[$key]!==''))$s[$key]=$key==='enabled'?(bool)$input[$key]:trim((string)$input[$key]);if($s['enabled'])self::validate($s);UpdateRuntime::atomic($this->file,['cipher'=>LicenseCrypto::encrypt(json_encode($s,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),$this->config['app']['key'])]);return $this->public();}finally{flock($lock,LOCK_UN);fclose($lock);}
    }
}
