<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use InvalidArgumentException;
use RuntimeException;
use Throwable;
require_once __DIR__.'/CommerceSchema.php';
require_once __DIR__.'/CommerceSettings.php';
require_once __DIR__.'/CommerceNotifications.php';
require_once __DIR__.'/PaymentGateway.php';
require_once __DIR__.'/LicensePolicy.php';
require_once __DIR__.'/CommerceRefunds.php';
require_once __DIR__.'/CommerceLegal.php';

final class CommerceOrders {
    public CommerceSettings $settings;
    public CommerceNotifications $notifications;
    public const EDITIONS=['content'=>['name'=>'Content','annual'=>790000,'lifetime'=>1990000],'business'=>['name'=>'Business','annual'=>990000,'lifetime'=>2490000],'commerce'=>['name'=>'Commerce','annual'=>1990000,'lifetime'=>4990000]];
    public const SERVICES=['ux-ui'=>['UX/UI-дизайн',6500000],'frontend'=>['Frontend-разработка',8500000],'launch'=>['Запуск и настройка',2500000],'migration'=>['Перенос данных',1800000],'support'=>['Сопровождение',1200000]];
    public function __construct(private Database $db,private array $config,private string $root){CommerceSchema::ensure($db,$config,$root);$this->settings=new CommerceSettings($root,$config);$this->notifications=new CommerceNotifications($db,$this->settings,$config);}
    public function available(bool $allowTest=false):bool {
        $s=$this->settings->get();return $s['payments_enabled']&&($s['mode']==='live'||$allowTest)&&($this->settings->workerStatus()['at']??0)>time()-900;
    }
    public function limit(string $bucket,int $maximum=60,int $seconds=600):void {
        $key=hash_hmac('sha256','commerce:'.$bucket,$this->config['app']['key']);$start=intdiv(time(),$seconds)*$seconds;
        $this->db->execute('INSERT INTO byp_license_requests(bucket,window_start,request_count) VALUES(?,?,1) ON DUPLICATE KEY UPDATE request_count=request_count+1',[$key,$start]);
        if((int)$this->db->one('SELECT request_count FROM byp_license_requests WHERE bucket=? AND window_start=?',[$key,$start])['request_count']>$maximum)throw new RuntimeException('Слишком много запросов. Повторите позже.');
    }
    public function catalog():array {
        $modules=$this->db->all('SELECT module_key,name,price FROM byp_module_catalog WHERE status="published" ORDER BY module_key');
        foreach($modules as &$m){$m['minor']=PaymentGateway::minor((string)$m['price']);unset($m['price']);}unset($m);
        return ['editions'=>self::EDITIONS,'modules'=>$modules,'availability'=>$this->db->all('SELECT edition,module_key,availability FROM byp_edition_modules'),'services'=>self::SERVICES];
    }
    private static function strings(mixed $values):array{if(!is_array($values)||count($values)>20)throw new InvalidArgumentException('Некорректный состав заказа.');$values=array_values(array_unique(array_map('strval',$values)));sort($values);return $values;}
    public function quote(array $input):array {
        $edition=strtolower((string)($input['edition']??'content'));$term=(string)($input['term']??'annual');if(!isset(self::EDITIONS[$edition])||!in_array($term,['annual','lifetime'],true))throw new InvalidArgumentException('Выберите редакцию и срок лицензии.');
        $extra=self::strings($input['modules']??[]);$services=self::strings($input['services']??[]);$catalog=$this->catalog();$access=[];foreach($catalog['availability']as $row)if(strtolower($row['edition'])===$edition)$access[$row['module_key']]=$row['availability'];
        $included=array_keys(array_filter($access,fn($value)=>$value==='included'));if(!in_array('content',$included,true))throw new RuntimeException('Комплектация редакции не настроена.');
        $modules=$included;$items=[['name'=>'BYPCMS '.self::EDITIONS[$edition]['name'].' · '.($term==='annual'?'1 год':'пожизненная'),'minor'=>self::EDITIONS[$edition][$term]]];$total=self::EDITIONS[$edition][$term];$byKey=array_column($catalog['modules'],null,'module_key');
        foreach($extra as $key){if(in_array($key,$modules,true))continue;if(!isset($byKey[$key])||!isset($access[$key])||$access[$key]==='hidden')throw new InvalidArgumentException('Модуль не доступен для выбранной редакции.');if(in_array($key,$modules,true))continue;$modules[]=$key;$total+=$byKey[$key]['minor'];$items[]=['name'=>$byKey[$key]['name'],'minor'=>$byKey[$key]['minor']];}
        foreach($services as $key)if(!isset(self::SERVICES[$key]))throw new InvalidArgumentException('Услуга не найдена.');
        sort($modules);return ['edition'=>$edition,'term'=>$term,'modules'=>$modules,'services'=>$services,'items'=>$items,'amount_minor'=>$total,'kind'=>$services?'inquiry':'purchase'];
    }
    private function renewal(int $customer,int $id):array {
        $row=$this->db->one('SELECT l.* FROM byp_license_registry l JOIN byp_license_order_links k ON k.license_id=l.id JOIN byp_customer_orders o ON o.id=k.order_id WHERE l.id=? AND o.customer_id=?',[$id,$customer]);
        if(!$row||$row['license_term']!=='annual'||!in_array($row['status'],['active','renewal','expired'],true)||CommerceAccess::blocked($this->db->pdo(),$id))throw new InvalidArgumentException('Продление доступно владельцу годовой покупки.');
        $edition=strtolower($row['edition']);if(!isset(self::EDITIONS[$edition]))throw new RuntimeException('Редакция лицензии не поддерживается.');
        return ['edition'=>$edition,'term'=>'annual','modules'=>json_decode($row['entitlements'],true,32,JSON_THROW_ON_ERROR),'services'=>[],'items'=>[['name'=>'Продление BYPCMS '.$row['edition'].' на 1 год','minor'=>self::EDITIONS[$edition]['annual']]],'amount_minor'=>self::EDITIONS[$edition]['annual'],'kind'=>'renewal','renewal_license_id'=>$id,'domain'=>$row['domain']];
    }
    public function renewalQuote(int $customer,int $id):array{return $this->renewal($customer,$id);}
    public function create(int $customer,array $input):array {
        $operation=LicensePolicy::installation((string)($input['operation_id']??''));$contact=[];foreach(['company'=>190,'phone'=>60,'comment'=>2000]as $key=>$limit){$contact[$key]=trim((string)($input[$key]??''));if(mb_strlen($contact[$key])>$limit||str_contains($contact[$key],"\0"))throw new InvalidArgumentException('Слишком длинные контактные данные.');}
        $renew=(int)($input['renewal_license_id']??0);
        $raw=['edition'=>strtolower((string)($input['edition']??'content')),'term'=>(string)($input['term']??'annual'),'modules'=>self::strings($input['modules']??[]),'services'=>self::strings($input['services']??[]),'domain'=>strtolower(rtrim(trim((string)($input['domain']??'')),'.')),'renewal'=>$renew,'contact'=>$contact];
        $hash=hash('sha256',json_encode($raw,JSON_THROW_ON_ERROR));
        $existing=$this->db->one('SELECT order_id,request_hash FROM byp_commerce_orders WHERE customer_id=? AND operation_id=?',[$customer,$operation]);
        if($existing){if(!hash_equals($existing['request_hash'],$hash))throw new RuntimeException('Этот запрос уже создал другой заказ. Откройте его в кабинете или начните новый.');return $this->view((int)$existing['order_id'],$customer);}
        CommerceLegal::validate($input);
        $quote=$renew?$this->renewal($customer,$renew):$this->quote($input);
        $domain=trim((string)($quote['domain']??$input['domain']??''));$domain=$quote['kind']==='inquiry'&&$domain===''?'Домен не указан':LicensePolicy::domain($domain);

        $pdo=$this->db->pdo();$pdo->beginTransaction();
        try{
            // Lock the customer to serialize two tabs using the same operation token.
            if(!$this->db->one('SELECT id FROM byp_customer_accounts WHERE id=? FOR UPDATE',[$customer]))throw new RuntimeException('Требуется вход в кабинет.');
            $old=$this->db->one('SELECT order_id,request_hash FROM byp_commerce_orders WHERE customer_id=? AND operation_id=?',[$customer,$operation]);
            if($old){if(!hash_equals($old['request_hash'],$hash))throw new RuntimeException('Этот запрос уже создал другой заказ. Откройте его в кабинете или начните новый.');$pdo->commit();return $this->view((int)$old['order_id'],$customer);}
            $id=$this->db->insert('INSERT INTO byp_customer_orders(customer_id,edition,modules,domain,license_term,status,created_at) VALUES(?,?,?,?,?,"pending",NOW())',[$customer,$quote['edition'],json_encode($quote['modules']),$domain,$quote['term']]);
            $this->db->execute('INSERT INTO byp_commerce_orders(order_id,public_id,customer_id,operation_id,request_hash,kind,amount_minor,items_json,contact_json,renewal_license_id,fulfillment_state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())',[$id,bin2hex(random_bytes(16)),$customer,$operation,$hash,$quote['kind'],$quote['amount_minor'],json_encode(['items'=>$quote['items'],'services'=>$quote['services']],JSON_UNESCAPED_UNICODE),json_encode($contact,JSON_UNESCAPED_UNICODE),$renew?:null,$quote['kind']==='inquiry'?'not_needed':'pending']);
            CommerceLegal::record($this->db,$customer,$id);$order=$this->row($id);$this->notifications->event($order,'created');$pdo->commit();return $this->view($id,$customer);
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    }
    public function row(int $id,?int $customer=null,bool $lock=false):array {
        $sql='SELECT o.*,d.* FROM byp_customer_orders o JOIN byp_commerce_orders d ON d.order_id=o.id WHERE o.id=?';$params=[$id];if($customer!==null){$sql.=' AND o.customer_id=?';$params[]=$customer;}if($lock)$sql.=' FOR UPDATE';$row=$this->db->one($sql,$params);if(!$row)throw new RuntimeException('Заказ не найден.');return $row;
    }
    public function view(int $id,?int $customer=null):array {
        $r=$this->row($id,$customer);$result=array_intersect_key($r,array_flip(['id','edition','domain','license_term','kind','amount_minor','currency','payment_state','fulfillment_state','fulfillment_error','paid_at','fulfilled_at','created_at','mode','renewed_until','renewal_license_id']));$result['items']=json_decode($r['items_json'],true);$result['modules']=json_decode($r['modules'],true);
        $result['attempt']=$r['active_attempt_id']?$this->db->one('SELECT id,provider_id,state,confirmation_url,last_error,created_at FROM byp_payment_attempts WHERE id=?',[$r['active_attempt_id']]):null;
        $result['purchase_url']=$r['kind']==='purchase'&&$r['fulfillment_state']==='ready'&&!CommerceAccess::orderDenied($this->db->pdo(),$id)?'/account/purchase.php?id='.$id:null;
        $result['legal_accepted']=CommerceLegal::accepted($this->db,$id);$result['legal']=CommerceLegal::info();$result['refunds']=(new CommerceRefunds($this->db,$this->config,$this))->summary($id);$result['receipt']=$this->db->one('SELECT sale_state,sale_url,refund_state,refund_note FROM byp_commerce_receipts WHERE order_id=?',[$id]);
        $result['notifications']=$this->db->all('SELECT state,created_at,accepted_at FROM byp_notification_outbox WHERE order_id=? AND event_key LIKE "%:customer" ORDER BY id',[$id]);return $result;
    }
    private function payload(array $order,array $s,string $attempt):array {
        $customer=$this->db->one('SELECT email FROM byp_customer_accounts WHERE id=?',[$order['customer_id']]);
        $data=['amount'=>['value'=>PaymentGateway::amount((int)$order['amount_minor']),'currency'=>'RUB'],'capture'=>true,'confirmation'=>['type'=>'redirect','return_url'=>rtrim($this->config['app']['url'],'/').'/account/order.php?id='.$order['id']],'description'=>'BYPCMS · заказ №'.$order['id'],'metadata'=>['order_ref'=>$order['public_id'],'attempt_ref'=>$attempt]];
        if($s['receipt_mode']==='yookassa'){
            $data['receipt']=['customer'=>['email'=>$customer['email']],'items'=>[]];if($s['tax_system_code'])$data['receipt']['tax_system_code']=$s['tax_system_code'];
            foreach(json_decode($order['items_json'],true)['items']as $item)if($item['minor']>0)$data['receipt']['items'][]=['description'=>mb_substr($item['name'],0,128),'quantity'=>'1.000','amount'=>['value'=>PaymentGateway::amount($item['minor']),'currency'=>'RUB'],'vat_code'=>$s['vat_code'],'payment_subject'=>$s['payment_subject'],'payment_mode'=>$s['payment_mode']];
        }return $data;
    }
    public function pay(int $id,int $customer,bool $allowTest):array {
        $s=$this->settings->get();if(!$s['payments_enabled'])throw new RuntimeException('Онлайн-оплата пока не подключена. Заказ сохранён в кабинете.');if(!$this->available($allowTest)&&$s['mode']!=='test')throw new RuntimeException('Оплата временно недоступна: фоновая обработка остановлена. Заказ сохранён, повторите позже.');if($s['mode']==='test'&&!$allowTest)throw new RuntimeException('Магазин проходит тестирование. Онлайн-оплата покупателям пока недоступна.');
        $pdo=$this->db->pdo();$pdo->beginTransaction();
        try {
            $order=$this->row($id,$customer,true);if(!CommerceLegal::accepted($this->db,$id))throw new RuntimeException('Перед оплатой подтвердите условия покупки и согласие на обработку данных.');if($order['kind']==='renewal'&&$s['mode']==='test')throw new RuntimeException('Тестовый платёж не может продлевать действующую лицензию.');if($order['kind']==='inquiry')throw new RuntimeException('Стоимость услуг требует согласования. Заявка передана владельцу.');
            if($order['payment_state']==='paid'){$pdo->commit();return $this->view($id,$customer);}if($order['kind']==='renewal')$this->renewal($customer,(int)$order['renewal_license_id']);
            $attempt=$order['active_attempt_id']?$this->db->one('SELECT *,TIMESTAMPDIFF(SECOND,created_at,NOW()) AS age_seconds FROM byp_payment_attempts WHERE id=? FOR UPDATE',[$order['active_attempt_id']]):null;
            if($attempt&&!in_array($attempt['state'],['canceled','error'],true)){
                if($attempt['provider_id']&&$attempt['confirmation_url']){$pdo->commit();return $this->view($id,$customer);}
                if((int)$attempt['age_seconds']>23*3600)throw new RuntimeException('Результат прежнего запроса неизвестен. Нужна сверка ID платежа владельцем в ЮKassa; новая попытка не создаётся.');
                if($attempt['shop_id']!==$s['shop_id']||$attempt['mode']!==$s['mode'])throw new RuntimeException('Нельзя повторить платёж с другим магазином или режимом.');
            }else{
                $aid=bin2hex(random_bytes(16));$payload=$this->payload($order,$s,$aid);$this->db->execute('INSERT INTO byp_payment_attempts(id,order_id,shop_id,mode,state,payload,created_at) VALUES(?,?,?,?,"creating",?,NOW())',[$aid,$id,$s['shop_id'],$s['mode'],json_encode($payload,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE)]);
                $this->db->execute('UPDATE byp_commerce_orders SET active_attempt_id=?,mode=?,payment_state="pending",updated_at=NOW() WHERE order_id=?',[$aid,$s['mode'],$id]);$attempt=$this->db->one('SELECT * FROM byp_payment_attempts WHERE id=?',[$aid]);
            }$pdo->commit();
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
        try{$payment=(new PaymentGateway($s,$this->config))->request('POST','payments',json_decode($attempt['payload'],true),$attempt['id']);$this->apply($attempt,$payment);}
        catch(PaymentTransportException $e){$this->db->execute('UPDATE byp_payment_attempts SET state=?,last_error=? WHERE id=? AND provider_id IS NULL AND state IN ("creating","uncertain","error")',[$e->definite?'error':'uncertain',$e->getMessage(),$attempt['id']]);throw $e;}
        return $this->view($id,$customer);
    }
    private function apply(array $attempt,array $payment):void {
        $order=$this->row((int)$attempt['order_id']);$provider=PaymentGateway::id((string)($payment['id']??''));$meta=$payment['metadata']??[];
        if(!is_string($payment['amount']['value']??null)||PaymentGateway::minor($payment['amount']['value'])!==(int)$order['amount_minor']||($payment['amount']['currency']??'')!=='RUB'||(string)($payment['recipient']['account_id']??'')!==$attempt['shop_id']||($payment['test']??null)!==($attempt['mode']==='test')||($meta['order_ref']??'')!==$order['public_id']||($meta['attempt_ref']??'')!==$attempt['id'])throw new RuntimeException('Платёж не совпадает с заказом, суммой или магазином. Выдача заблокирована.');
        $state=(string)($payment['status']??'');if(!in_array($state,['pending','waiting_for_capture','succeeded','canceled'],true)||($state==='succeeded'&&($payment['paid']??null)!==true))throw new RuntimeException('Статус платежа не подтверждён.');
        $url=null;if(!empty($payment['confirmation']['confirmation_url']))$url=(new PaymentGateway($this->settings->get(),$this->config))->confirmation($payment['confirmation']['confirmation_url']);
        $pdo=$this->db->pdo();$pdo->beginTransaction();try{
            $current=$this->row((int)$order['id'],null,true);$saved=$this->db->one('SELECT *,TIMESTAMPDIFF(SECOND,created_at,NOW()) AS age_seconds FROM byp_payment_attempts WHERE id=? FOR UPDATE',[$attempt['id']]);if($saved['provider_id']&&$saved['provider_id']!==$provider)throw new RuntimeException('Запрос связан с другим платежом.');
            if($saved['state']==='succeeded'&&$state!=='succeeded')throw new RuntimeException('Получено противоречивое состояние оплаченного заказа.');
            $this->db->execute('UPDATE byp_payment_attempts SET provider_id=?,state=?,confirmation_url=COALESCE(?,confirmation_url),checked_at=NOW(),last_error=NULL WHERE id=?',[$provider,$state,$url,$attempt['id']]);
            if($state==='succeeded'&&$current['payment_state']!=='paid'){
                if($current['active_attempt_id']!==$attempt['id'])throw new RuntimeException('Оплачен неактуальный платёж. Нужна ручная сверка владельцем.');
                $this->db->execute('UPDATE byp_commerce_orders SET payment_state="paid",paid_at=NOW(),updated_at=NOW() WHERE order_id=?',[$order['id']]);$this->db->execute('UPDATE byp_customer_orders SET status="paid" WHERE id=?',[$order['id']]);$this->db->execute('INSERT IGNORE INTO byp_commerce_receipts(order_id,sale_state,updated_at) VALUES(?,?,NOW())',[$order['id'],$this->settings->get()['receipt_mode']==='npd_manual'?'required':'provider']);$this->notifications->event($current,'paid');
            }elseif($state==='canceled'&&$current['payment_state']!=='paid'&&$current['active_attempt_id']===$attempt['id']){$this->db->execute('UPDATE byp_commerce_orders SET payment_state="canceled",updated_at=NOW() WHERE order_id=?',[$order['id']]);$this->notifications->event($current,'canceled');}
            $pdo->commit();
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    }
    public function sync(int $id,?int $customer=null,?string $provider=null):array {
        $order=$this->row($id,$customer);if(!$order['active_attempt_id'])return $this->view($id,$customer);
        $attempt=$this->db->one('SELECT * FROM byp_payment_attempts WHERE id=?',[$order['active_attempt_id']]);$provider=$provider?:$attempt['provider_id'];if(!$provider)return $this->view($id,$customer);
        $s=$this->settings->get();if($s['shop_id']!==$attempt['shop_id'])throw new RuntimeException('Нужны настройки магазина исходного платежа.');
        $this->apply($attempt,(new PaymentGateway($s,$this->config))->request('GET','payments/'.PaymentGateway::id($provider)));return $this->view($id,$customer);
    }
    public function webhook(array $input):void {
        if(($input['type']??'')!=='notification'||!in_array($input['event']??'',['payment.succeeded','payment.canceled','payment.waiting_for_capture'],true))return;
        $object=$input['object']??[];$provider=PaymentGateway::id((string)($object['id']??''));$attempt=$this->db->one('SELECT * FROM byp_payment_attempts WHERE provider_id=?',[$provider]);
        if(!$attempt&&!empty($object['metadata']['attempt_ref'])&&preg_match('/^[a-f0-9]{32}$/D',$object['metadata']['attempt_ref']))$attempt=$this->db->one('SELECT * FROM byp_payment_attempts WHERE id=?',[$object['metadata']['attempt_ref']]);
        if(!$attempt)return; // No database state is derived from the submitted object.
        if($attempt['state']==='succeeded')return;
        $this->sync((int)$attempt['order_id'],null,$provider);
    }
    public function fulfill(int $id):void {
        $order=$this->row($id);if(CommerceAccess::orderDenied($this->db->pdo(),$id)){$this->db->execute('UPDATE byp_commerce_orders SET updated_at=NOW() WHERE order_id=?',[$id]);return;}if($order['payment_state']!=='paid'||$order['fulfillment_state']==='ready'||$order['kind']==='inquiry')return;
        try {
            if($order['kind']==='renewal'){
                $pdo=$this->db->pdo();$pdo->beginTransaction();try{$order=$this->row($id,null,true);if($order['fulfillment_state']==='ready'){$pdo->commit();return;}if($order['mode']==='test')throw new RuntimeException('Тестовая оплата не продлевает лицензию.');$license=$this->db->one('SELECT * FROM byp_license_registry WHERE id=? FOR UPDATE',[$order['renewal_license_id']]);if(!$license||CommerceAccess::blocked($this->db->pdo(),(int)$license['id'])||$license['license_term']!=='annual')throw new RuntimeException('Условия лицензии изменились. Нужна проверка владельца.');$granted=time();$until=LicensePolicy::renew($license['valid_until'],$granted);$this->db->execute('INSERT IGNORE INTO byp_commerce_renewals(order_id,license_id,before_until,after_until,granted_at) VALUES(?,?,?,?,?)',[$id,$license['id'],$license['valid_until'],$until,$granted]);$status=$license['status']==='suspended'?'suspended':'active';$this->db->execute('UPDATE byp_license_registry SET valid_until=?,status=?,updated_at=NOW() WHERE id=?',[$until,$status,$license['id']]);$this->db->execute('UPDATE byp_commerce_orders SET renewed_until=?,fulfillment_state="ready",fulfilled_at=NOW(),fulfillment_error=NULL,updated_at=NOW() WHERE order_id=?',[$until,$id]);$this->notifications->event($order,'ready');$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
            }else{
                $db=$this->db;$config=$this->config;require_once __DIR__.'/customer-delivery.php';\customer_fulfill($db,$config,$id,0,true);
                $pdo=$this->db->pdo();$pdo->beginTransaction();try{$order=$this->row($id,null,true);$this->db->execute('UPDATE byp_commerce_orders SET fulfillment_state="ready",fulfilled_at=COALESCE(fulfilled_at,NOW()),fulfillment_error=NULL,updated_at=NOW() WHERE order_id=?',[$id]);$this->notifications->event($order,'ready');$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
            }
        }catch(Throwable $e){$pdo=$this->db->pdo();if($pdo->inTransaction())$pdo->rollBack();$pdo->beginTransaction();try{$order=$this->row($id,null,true);$this->db->execute('UPDATE byp_commerce_orders SET fulfillment_state="failed",fulfillment_error="Оплата получена; выдачу нужно повторить. Владелец уведомлён.",updated_at=NOW() WHERE order_id=?',[$id]);$this->notifications->event($order,'fulfillment_error');$pdo->commit();}catch(Throwable $ignored){if($pdo->inTransaction())$pdo->rollBack();}throw new RuntimeException('Оплата подтверждена, но выдача ещё не завершена. Повторите проверку позже.');}
    }
    public function work():array {
        $result=['fulfilled'=>0,'errors'=>0];
        foreach($this->db->all('SELECT order_id FROM byp_payment_attempts WHERE provider_id IS NOT NULL AND state IN ("pending","waiting_for_capture","uncertain") AND (checked_at IS NULL OR checked_at<DATE_SUB(NOW(),INTERVAL 1 MINUTE)) ORDER BY created_at LIMIT 2')as $row){try{$this->sync((int)$row['order_id']);}catch(Throwable $e){$result['errors']++;}}
        foreach($this->db->all('SELECT order_id FROM byp_commerce_orders WHERE payment_state="paid" AND (fulfillment_state="pending" OR (fulfillment_state="failed" AND updated_at<DATE_SUB(NOW(),INTERVAL 1 MINUTE))) ORDER BY updated_at,order_id LIMIT 2')as $row){try{$this->fulfill((int)$row['order_id']);$result['fulfilled']++;}catch(Throwable $e){$result['errors']++;}}
        $result['refunds']=(new CommerceRefunds($this->db,$this->config,$this))->work();$result['mail']=$this->notifications->process(3);$this->settings->workerReport($result);return $result;
    }
}
