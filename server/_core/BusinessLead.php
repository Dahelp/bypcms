<?php
declare(strict_types=1);
namespace BYPCMS\Core;
/** Shared input contract; usable in an isolated demo without database or SMTP. */
final class BusinessLead {
    public static function input(array $values):array {
        foreach(['name','email','phone','message','consent','website','request_token','service_id','project_id'] as $key)if(isset($values[$key])&&!is_scalar($values[$key]))throw new \RuntimeException('Проверьте поля заявки.');
        $out=[];foreach(['name'=>150,'email'=>190,'phone'=>60,'message'=>5000] as $key=>$limit){$out[$key]=trim((string)($values[$key]??''));if(mb_strlen($out[$key])>$limit||preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f]/',$out[$key]))throw new \RuntimeException('Проверьте длину полей заявки.');}
        if($out['name']===''||$out['message']==='')throw new \RuntimeException('Укажите имя и расскажите о задаче.');
        if($out['email']===''&&$out['phone']==='')throw new \RuntimeException('Оставьте email или телефон для ответа.');
        if($out['email']!==''&&!filter_var($out['email'],FILTER_VALIDATE_EMAIL))throw new \RuntimeException('Проверьте email.');
        if($out['phone']!==''&&!preg_match('/^[+()0-9 .-]{7,60}$/D',$out['phone']))throw new \RuntimeException('Проверьте телефон.');
        if(($values['consent']??'')!=='1')throw new \RuntimeException('Для отправки необходимо согласие на обработку данных.');
        if(trim((string)($values['website']??''))!=='')throw new \RuntimeException('Заявка отклонена антиспам-проверкой.');
        if(!preg_match('/^[a-f0-9]{32}$/D',(string)($values['request_token']??'')))throw new \RuntimeException('Обновите форму и повторите отправку.');
        foreach(['service_id','project_id'] as $key){$id=(string)($values[$key]??'');if($id!==''&&(!ctype_digit($id)||strlen($id)>16||(float)$id>9007199254740991))throw new \RuntimeException('Выберите корректную услугу или проект.');$out[$key]=(int)$id?:null;}
        return $out;
    }
}
