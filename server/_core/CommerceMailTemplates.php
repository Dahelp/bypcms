<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use InvalidArgumentException;

/** Deterministic, escaped email snapshots. No keys, bank details or bearer links. */
final class CommerceMailTemplates {
    public const VERSION='2026-11-13.1';
    public const EVENTS=['created','invoice','invoice_accepted','invoice_canceled','invoice_expired','paid','ready','fulfillment_error','canceled','receipt','refund_request','refund_approved','refund_succeeded','refund_declined','refund_failed'];
    public static function render(array $o,string $event,string $audience,string $origin,?array $invoice=null):array {
        if(!in_array($event,self::EVENTS,true)||!in_array($audience,['customer','owner'],true))throw new InvalidArgumentException('Неизвестный шаблон письма.');
        $p=parse_url($origin);if(!in_array($p['scheme']??'',['https','http'],true)||empty($p['host'])||isset($p['user'])||isset($p['pass'])||isset($p['query'])||isset($p['fragment']))throw new InvalidArgumentException('Некорректный адрес кабинета.');
        $id=(int)$o['id'];$owner=$audience==='owner';$service=$o['kind']==='service'||$o['edition']==='services';$renew=$o['kind']==='renewal';
        $titles=['created'=>'Заказ BYPCMS создан','invoice'=>'Счёт BYPCMS выставлен','invoice_accepted'=>'Счёт BYPCMS принят','invoice_canceled'=>'Счёт BYPCMS отменён','invoice_expired'=>'Срок оплаты счёта истёк','paid'=>'Оплата BYPCMS подтверждена','ready'=>$renew?'Лицензия BYPCMS продлена':'Лицензия BYPCMS готова','fulfillment_error'=>'Оплата сохранена, выдача задерживается','canceled'=>'Платёж BYPCMS отменён','receipt'=>'Чек покупки BYPCMS доступен','refund_request'=>'Обращение о возврате получено','refund_approved'=>'Возврат согласован владельцем','refund_succeeded'=>'Выполнение возврата подтверждено','refund_declined'=>'Ответ на обращение о возврате','refund_failed'=>'Возврат не завершён'];
        if($event==='paid'&&$service)$titles['paid']='Оплата работ BYPCMS подтверждена';
        $title=$titles[$event];$lines=[];$action='Открыть заказ';
        switch($event){
            case 'created':$lines[]=$o['kind']==='inquiry'?($owner?'Подготовьте точную стоимость, результат, срок и порядок приёмки работ в счёте.':'Заявка сохранена. Продавец согласует точную стоимость, результат, сроки и порядок приёмки работ до оплаты.'):'Заказ сохранён. Создание заказа не означает поступление оплаты.';break;
            case 'invoice':
                $lines[]=$invoice&&!empty($invoice['accepted_at'])?'Счёт готов. Основной способ оплаты — банковский перевод по реквизитам в личном кабинете.':'Проверьте состав, точную сумму, результат и сроки в кабинете. Перед оплатой примите конкретный счёт и условия.';
                if($owner)$lines[]='Поступление проверяется по выписке банка или успешному результату в кабинете ЮKassa. Скриншот покупателя не подтверждает оплату.';
                else $lines[]='Оплачивайте только один раз и только актуальный счёт. Сначала откройте заказ: реквизиты и дополнительная ссылка ЮKassa находятся в нём.';
                $action=$owner?'Проверить счёт':'Открыть счёт в кабинете';break;
            case 'invoice_accepted':$lines[]=$owner?'Покупатель принял конкретный состав, сумму и условия счёта. Это согласование, а не подтверждение поступления денег.':'Принятие состава и условий счёта сохранено. Само принятие не является оплатой; проверьте актуальный счёт в кабинете перед переводом.';break;
            case 'invoice_canceled':$lines[]='Этот счёт отменён. Не оплачивайте его. Актуальный состав и новый счёт проверяйте в заказе; новая версия требует отдельного согласования.';break;
            case 'invoice_expired':$lines[]='Срок оплаты этого счёта истёк. Не переводите деньги по нему без сверки с продавцом. Если перевод уже выполнен, сообщите продавцу номер счёта и дату поступления.';break;
            case 'paid':$lines[]='Фактическое поступление оплаты подтверждено. Повторно оплачивать этот заказ не нужно.';$lines[]=$service?'Оплачены согласованные работы. Лицензия в этот заказ не входит. Результат, срок исполнения и приёмка — по условиям счёта.':($renew?'Статус продления и новая дата окончания доступны в заказе. Повтор проверки не добавляет второй оплаченный период.':'Статус подготовки архива и лицензии доступен в заказе. Отдельное уведомление сообщит о готовности лицензии.');break;
            case 'ready':$lines[]=$renew?'Оплаченный период продления применён. Итоговая дата указана в заказе.':'Архив CMS, ключ и инструкция доступны в вашем личном кабинете. Ключи, пароли и вложения с лицензией по почте не отправляются.';if(!empty($o['renewed_until']))$lines[]='Лицензия продлена до: '.$o['renewed_until'].'.';if(!empty($o['services']))$lines[]='Выдана лицензионная часть. Индивидуальные работы выполняются и принимаются отдельно по согласованному счёту.';$action=$owner?'Проверить выдачу':'Открыть лицензию в кабинете';break;
            case 'fulfillment_error':$lines[]='Оплата сохранена. Повторный перевод не требуется. Подготовка лицензии или продление задерживается по технической причине.';$lines[]=$owner?'Повторите выдачу из карточки заказа. Ошибка отправки письма не должна повторять финансовую операцию.':'Продавец уведомлён и завершит выдачу. Статус доступен в заказе; при задержке обратитесь в поддержку с номером заказа.';break;
            case 'receipt':$lines[]='Продавец добавил сведения о чеке «Мой налог». Откройте заказ, чтобы посмотреть актуальную ссылку и отметку о корректировке. Счёт и это сервисное письмо не заменяют чек.';break;
            case 'refund_request':$lines[]=$owner?'Покупатель отправил обращение. Рассмотрите причину в заказе. Обращение само по себе не переводит деньги и не отзывает лицензию.':'Обращение передано продавцу. Оно не создаёт автоматический возврат и не отключает лицензию. Ответ и результат появятся в заказе.';break;
            case 'refund_approved':$lines[]='Владелец согласовал возврат. Итоговый результат и действие с оплаченными правами проверяйте в заказе.';break;
            case 'refund_succeeded':$lines[]='Выполнение возврата зафиксировано. Точная сумма, история и действие с лицензией отображаются в заказе. При полном возврате оплаченные этим заказом права прекращаются.';break;
            case 'refund_declined':$lines[]='Продавец добавил мотивированный ответ на обращение. Прочитайте его в заказе.';break;
            case 'refund_failed':$lines[]='Возврат не завершён. Продавец сверит результат; не создавайте новую финансовую операцию вслепую. Текущий статус доступен в заказе.';break;
            default:$lines[]='Платёж отменён. Проверьте актуальное состояние заказа и счёта перед новой оплатой.';
        }
        $facts=['Заказ'=>'№'.$id,'Редакция'=>$service?'Услуги':ucfirst($o['edition'])];
        if(($o['domain']??'')!==''&&$o['domain']!=='Домен не указан')$facts['Домен']=$o['domain'];
        if($invoice){$facts['Счёт']=$invoice['number'];$facts['Сумма счёта']=self::money((int)$invoice['amount_minor']);if(in_array($event,['invoice','invoice_accepted','invoice_canceled','invoice_expired'],true))$facts['Срок оплаты']=$invoice['expires_on'];}
        elseif((int)($o['amount_minor']??0)>0)$facts[$o['kind']==='inquiry'?'Лицензия и модули, без услуг':'Сумма заказа']=self::money((int)$o['amount_minor']);
        if(($o['mode']??null)==='test')array_unshift($lines,'ТЕСТОВЫЙ ЗАКАЗ. Реального списания денег не было; это не подтверждение боевой покупки.');
        $link=rtrim($origin,'/').($owner?'/owner/?section=payments&order=':'/account/order.php?id=').$id;
        $text=$title."\n\n";foreach($facts as $label=>$value)$text.=$label.': '.$value."\n";$text.="\n".implode("\n\n",$lines)."\n\n".$action.': '.$link."\n\nЭто сервисное уведомление BYPCMS. Ошибка письма не отменяет оплату. По вопросам заказа: hello@bypcms.ru. Вход в кабинет обязателен.";
        $e=fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');$rows='';foreach($facts as $label=>$value)$rows.='<tr><td style="padding:7px 0;color:#637268;width:42%">'.$e($label).'</td><td style="padding:7px 0;font-weight:600;overflow-wrap:anywhere">'.$e($value).'</td></tr>';
        $body='';foreach($lines as $line)$body.='<p style="margin:0 0 18px;line-height:1.65">'.$e($line).'</p>';
        $html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f2f5f0;color:#24382d;font:16px Arial,sans-serif"><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:20px 12px"><table role="presentation" style="width:100%;max-width:620px;margin:auto;border-collapse:collapse;background:#fff"><tr><td style="padding:28px 24px;border-top:5px solid #b5ff35;overflow-wrap:anywhere"><p style="font-weight:800;margin:0 0 24px">BYPCMS</p><h1 style="font-size:25px;line-height:1.3;margin:0 0 20px">'.$e($title).'</h1><table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px">'.$rows.'</table>'.$body.'<p style="margin:28px 0"><a href="'.$e($link).'" style="display:inline-block;padding:14px 20px;background:#486458;color:#fff;text-decoration:none;border-radius:7px;font-weight:600">'.$e($action).'</a></p><p style="font-size:12px;line-height:1.6;color:#637268;border-top:1px solid #e1e7df;padding-top:20px">Сервисное уведомление. Вход в кабинет обязателен. Ключи и банковские реквизиты по почте не передаются. Вопросы: hello@bypcms.ru.</p><p style="font-size:12px;overflow-wrap:anywhere">'.$e($link).'</p></td></tr></table></td></tr></table></body></html>';
        return ['subject'=>$title.' · заказ №'.$id,'message'=>$text,'html'=>$html,'template_key'=>$event,'template_version'=>self::VERSION,'audience'=>$audience,'invoice_id'=>$invoice['id']??null];
    }
    private static function money(int $minor):string{return number_format($minor/100,2,',',' ').' ₽';}
    public static function samples(string $origin):array {
        $samples=[];foreach(['customer','owner']as $audience)foreach(['purchase','renewal','service','mixed','test']as $kind)foreach(self::EVENTS as $event){if($kind==='service'&&in_array($event,['ready','fulfillment_error'],true))continue;$o=['id'=>123,'edition'=>$kind==='service'?'services':'content','kind'=>$kind==='renewal'?'renewal':($kind==='service'?'service':'purchase'),'amount_minor'=>790000,'domain'=>'example.test','mode'=>$kind==='test'?'test':'live','services'=>$kind==='mixed'?['launch']:[],'renewed_until'=>$kind==='renewal'?'2028-11-13':null];$invoice=['id'=>1,'number'=>'BYP-123-1','amount_minor'=>790000,'expires_on'=>'2026-11-27','accepted_at'=>null];$samples[]=self::render($o,$event,$audience,$origin,$invoice)+['sample'=>$kind.':'.$audience.':'.$event,'kind'=>$kind];}return $samples;
    }
}
