<?php
declare(strict_types=1);
namespace BYPCMS\Core;

/** Session-only sample shop. No gateway, database, SMTP or real fulfillment. */
final class DemoStore {
    private array $state;
    private array $variants=[];
    public function __construct(private array $products,private string $base,private string $token,private string $theme) {
        $key=$theme.':'.($token?:'public');
        $_SESSION['storefront']??=[];
        foreach(array_keys($_SESSION['storefront']) as $entryKey){$entry=explode(':',$entryKey,2)[1]??'';if($entry!=='public'&&(!isset($_SESSION['snapshots'][$entry])||$_SESSION['snapshots'][$entry]['expires']<time()))unset($_SESSION['storefront'][$entryKey]);}
        $_SESSION['storefront'][$key]??=['cart'=>$theme==='gallery'?($_SESSION['carts'][$token?:'public']??[]):[],'orders'=>[],'tokens'=>[],'shipping'=>'delivery','promo'=>''];
        $this->state=&$_SESSION['storefront'][$key];
        foreach($products as $p)foreach($p['variants'] as $v)$this->variants[(int)$v['id']]=$v+['product'=>$p];
        foreach($this->state['orders'] as &$order)if($order['state']==='pending'&&$order['created']<time()-3600)$order['state']='expired';unset($order);
        $this->state['tokens']=array_filter($this->state['tokens'],fn($t)=>$t>time()-1800);
    }
    private static function text(array $input,string $key,int $limit=190):string {
        if(!is_scalar($input[$key]??''))throw new \RuntimeException('Проверьте данные формы.');
        return mb_substr(trim((string)($input[$key]??'')),0,$limit);
    }
    private function href(string $path,array $query=[]):string {return $this->base.$path.(($query+($this->token?['snapshot'=>$this->token]:[]))?'?'.http_build_query($query+($this->token?['snapshot'=>$this->token]:[])):'');}
    private function stock(int $id):int {
        $n=(int)($this->variants[$id]['stock']??0);
        foreach($this->state['orders'] as $o)if(in_array($o['state'],['pending','paid'],true))foreach($o['items'] as $i)if($i['variant']===$id)$n-=$i['quantity'];
        return max(0,$n);
    }
    public function availableProducts():array {
        $rows=$this->products;foreach($rows as &$p)foreach($p['variants'] as &$v)$v['stock']=$this->stock((int)$v['id']);unset($p,$v);return $rows;
    }
    private function quote():array {
        $items=[];$subtotal=0;$issues=[];
        foreach($this->state['cart'] as $id=>$quantity){
            $v=$this->variants[$id]??null;if(!$v){$issues[]='Один из товаров больше недоступен. Удалите его из корзины.';continue;}
            $p=$v['product'];if($quantity>$this->stock((int)$id))$issues[]=$p['title'].': доступно '.$this->stock((int)$id).'. Уменьшите количество.';
            $items[]=['variant'=>(int)$id,'title'=>$p['title'],'variant_title'=>$v['title'],'slug'=>$p['slug'],'image'=>$p['images'][0]??'','quantity'=>$quantity,'price'=>(int)$v['price']];$subtotal+=$quantity*(int)$v['price'];
        }
        $discount=$this->state['promo']==='DEMO10'?(int)floor($subtotal/10):0;$delivery=$items&&$this->state['shipping']==='delivery'?59900:0;$total=$subtotal-$discount+$delivery;
        $hash=hash('sha256',json_encode([$items,$this->state['shipping'],$this->state['promo'],$total],JSON_THROW_ON_ERROR));
        return compact('items','subtotal','discount','delivery','total','issues','hash');
    }
    private function hidden(string $action,array $values=[]):void {
        foreach(['csrf'=>$_SESSION['csrf'],'action'=>$action]+$values as $key=>$value)echo '<input type="hidden" name="'.Content::e($key).'" value="'.Content::e((string)$value).'">';
    }
    private function summary(array $q):void { ?>
        <h2>Итого</h2><dl><div><dt>Товары</dt><dd><?= Gallery::money($q['subtotal']) ?></dd></div><div><dt>Скидка</dt><dd>− <?= Gallery::money($q['discount']) ?></dd></div><div><dt>Доставка</dt><dd><?= Gallery::money($q['delivery']) ?></dd></div><div class="g-total"><dt>К оплате</dt><dd><?= Gallery::money($q['total']) ?></dd></div></dl>
    <?php }
    private function mutate(string $path):string {
        if((int)($_SERVER['CONTENT_LENGTH']??0)>16000)throw new \RuntimeException('Форма слишком большая.');
        if(!hash_equals($_SESSION['csrf'],self::text($_POST,'csrf')))throw new \RuntimeException('Сессия истекла. Обновите страницу и повторите действие.');
        $action=self::text($_POST,'action',30);
        if($path==='cart'&&in_array($action,['add','quantity','undo'],true)){
            if($action==='undo'){$undo=$this->state['undo']??null;if(!$undo)throw new \RuntimeException('Удалённый товар уже восстановлен или больше недоступен.');$id=$undo['id'];$next=($this->state['cart'][$id]??0)+$undo['quantity'];}
            else{$raw=self::text($_POST,'variant',20);$quantity=self::text($_POST,'quantity',5);if(!ctype_digit($raw)||!ctype_digit($quantity))throw new \RuntimeException('Укажите целое количество от 0 до 99.');$id=(int)$raw;$next=(int)$quantity+($action==='add'?($this->state['cart'][$id]??0):0);}
            if(!isset($this->variants[$id])||$next>99||($next>0&&$next>$this->stock($id)))throw new \RuntimeException('Нет нужного количества в выбранном варианте.');
            if($next)$this->state['cart'][$id]=$next;else{if(isset($this->state['cart'][$id]))$this->state['undo']=['id'=>$id,'quantity'=>$this->state['cart'][$id]];unset($this->state['cart'][$id]);}
            if($action==='undo')unset($this->state['undo']);$this->state['notice']=$action==='add'?'Товар добавлен в корзину.':'Корзина обновлена.';return '/cart/';
        }
        if($path==='cart'&&$action==='preferences'){
            $shipping=self::text($_POST,'shipping',20);$promo=strtoupper(self::text($_POST,'promo',40));
            if(!in_array($shipping,['delivery','pickup'],true))throw new \RuntimeException('Выберите способ получения.');
            if(!in_array($promo,['','DEMO10'],true))throw new \RuntimeException('Промокод не найден. В демо можно проверить DEMO10.');
            $this->state['shipping']=$shipping;$this->state['promo']=$promo;$this->state['notice']=$promo?'Промокод DEMO10 применён.':'Способ получения обновлён.';return '/cart/';
        }
        if($path==='checkout'&&$action==='checkout'){
            $token=self::text($_POST,'token',40);$name=self::text($_POST,'name');$email=self::text($_POST,'email');$phone=self::text($_POST,'phone',60);$address=self::text($_POST,'address',1000);$fingerprint=hash('sha256',json_encode([$name,$email,$phone,$address],JSON_THROW_ON_ERROR));
            foreach($this->state['orders'] as $ref=>$order)if($order['token']===$token){if(!hash_equals($order['fingerprint'],$fingerprint))throw new \RuntimeException('Этот запрос уже создал заказ с другими данными. Откройте раздел «Заказы».');return '/order/?ref='.$ref;}
            if(!preg_match('/^[a-f0-9]{32}$/D',$token)||!isset($this->state['tokens'][$token]))throw new \RuntimeException('Форма устарела. Обновите страницу оформления.');
            if(!$name||!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen(preg_replace('/\D/','',$phone))<10)throw new \RuntimeException('Заполните имя, корректный email и телефон. Для проверки используйте тестовые данные.');
            if($this->state['shipping']==='delivery'&&mb_strlen($address)<5)throw new \RuntimeException('Укажите тестовый адрес доставки.');
            if(self::text($_POST,'demo_confirm')!=='1')throw new \RuntimeException('Подтвердите, что это тестовый заказ без реальной покупки.');
            $q=$this->quote();if(!$q['items']||$q['issues'])throw new \RuntimeException('Проверьте товары и остатки в корзине.');
            if(!hash_equals($q['hash'],self::text($_POST,'quote',80)))throw new \RuntimeException('Корзина или сумма изменились. Проверьте новый итог и подтвердите заказ ещё раз.');
            if(count($this->state['orders'])>=30)throw new \RuntimeException('Лимит тестовых заказов в этой сессии достигнут.');
            $ref='DEMO-'.strtoupper(bin2hex(random_bytes(6)));$this->state['orders'][$ref]=$q+['state'=>'pending','created'=>time(),'token'=>$token,'fingerprint'=>$fingerprint,'shipping'=>$this->state['shipping']];$this->state['cart']=[];unset($this->state['tokens'][$token]);return '/order/?ref='.$ref;
        }
        if($path==='order'&&in_array($action,['pay','cancel'],true)){
            $ref=self::text($_POST,'ref',40);if(!isset($this->state['orders'][$ref]))throw new \RuntimeException('Заказ не найден в этой сессии.');
            $order=&$this->state['orders'][$ref];$target=$action==='pay'?'paid':'canceled';
            if($order['state']!==$target){if($order['state']!=='pending')throw new \RuntimeException('Статус заказа уже изменился.');$order['state']=$target;}
            return '/order/?ref='.$ref;
        }
        throw new \RuntimeException('Действие недоступно на этой странице.');
    }
    public function run(string $path,array &$options):bool {
        if(($_SERVER['REQUEST_METHOD']??'GET')==='POST')try{$target=$this->mutate($path);$parts=explode('?',$target,2);parse_str($parts[1]??'',$query);header('Location: '.$this->href($parts[0],$query),true,303);return true;}catch(\Throwable $error){$options['error']=$error->getMessage();$options['http_status']=422;}
        $_POST=array_filter($_POST??[], 'is_scalar');
        $options['cart_count']=array_sum($this->state['cart']);$options['notice']=$this->state['notice']??'';unset($this->state['notice']);
        if(!in_array($path,['cart','checkout','order','account'],true))return false;
        $e=[Content::class,'e'];ob_start();$q=$this->quote();
        if(in_array($path,['cart','checkout'],true)){
            if(!$q['items']){ ?><div class="g-empty"><h2>Ваша корзина пуста</h2><p>Добавьте товары из каталога, чтобы продолжить покупку.</p><a class="g-button" href="<?= $e($this->href('/catalog/')) ?>">Перейти в каталог</a></div><?php }
            else { ?><div class="g-commerce-layout"><div><?php foreach($q['issues'] as $issue): ?><p role="alert" class="g-alert"><?= $e($issue) ?></p><?php endforeach;
                if($path==='cart'){foreach($q['items'] as $i){ ?><article class="g-cart-item"><a href="<?= $e($this->href('/product/'.$i['slug'].'/')) ?>"><img src="<?= $e(Content::asset($i['image'])) ?>" alt="<?= $e($i['title']) ?>" width="100" height="120"></a><div><h2><a href="<?= $e($this->href('/product/'.$i['slug'].'/')) ?>"><?= $e($i['title']) ?></a></h2><p><?= $e($i['variant_title']) ?> · <?= Gallery::money($i['price']) ?></p><form method="post"><?php $this->hidden('quantity',['variant'=>$i['variant']]); ?><label>Количество<input type="number" name="quantity" value="<?= $i['quantity'] ?>" min="0" max="<?= min(99,$this->stock($i['variant'])) ?>" required></label><button>Обновить</button></form><form method="post"><?php $this->hidden('quantity',['variant'=>$i['variant'],'quantity'=>0]); ?><button class="g-delete">Удалить товар</button></form></div><strong><?= Gallery::money($i['price']*$i['quantity']) ?></strong></article><?php }
                }else{$postedToken=self::text($_POST,'token',40);$token=isset($this->state['tokens'][$postedToken])?$postedToken:bin2hex(random_bytes(16));if(count($this->state['tokens'])>=20)array_shift($this->state['tokens']);$this->state['tokens'][$token]=time(); ?>
                <form class="g-checkout-form" method="post"><?php $this->hidden('checkout',['token'=>$token,'quote'=>$q['hash']]); ?><h2>1. Контактные данные</h2><p class="g-checkout-note">Это демонстрация. Не вводите настоящие персональные данные: письма и уведомления не отправляются.</p><?php foreach(['name'=>['Имя','text','Тестовый покупатель'],'email'=>['Email','email','buyer@example.test'],'phone'=>['Телефон','tel','+7 000 000-00-00']] as $key=>$field): ?><label><?= $field[0] ?><input type="<?= $field[1] ?>" name="<?= $key ?>" maxlength="190" autocomplete="off" required value="<?= $e(self::text($_POST,$key)?:$field[2]) ?>"></label><?php endforeach ?><h2>2. Получение</h2><p><?= $this->state['shipping']==='pickup'?'Самовывоз · бесплатно':'Тестовая доставка · 599 ₽' ?> · <a class="g-link" href="<?= $e($this->href('/cart/')) ?>">Изменить</a></p><?php if($this->state['shipping']==='delivery'): ?><label>Тестовый адрес<textarea name="address" maxlength="1000" required rows="3"><?= $e(self::text($_POST,'address',1000)?:'Демо-город, Примерная улица, 1') ?></textarea></label><?php endif ?><h2>3. Подтверждение</h2><label class="g-checkbox"><input type="checkbox" name="demo_confirm" value="1" required <?= self::text($_POST,'demo_confirm')==='1'?'checked':'' ?>><span>Понимаю, что это тестовый заказ. Реальной покупки, доставки и списания денег не будет.</span></label><button class="g-button" <?= $q['issues']?'disabled':'' ?>>Создать тестовый заказ</button></form>
                <?php } ?></div><aside class="g-summary"><?php $this->summary($q);if($path==='cart'): ?><form method="post"><?php $this->hidden('preferences'); ?><label>Получение<select name="shipping"><option value="delivery" <?= $this->state['shipping']==='delivery'?'selected':'' ?>>Тестовая доставка · 599 ₽</option><option value="pickup" <?= $this->state['shipping']==='pickup'?'selected':'' ?>>Самовывоз · бесплатно</option></select></label><label>Промокод<input name="promo" maxlength="40" placeholder="DEMO10" value="<?= $e(self::text($_POST,'promo',40)?:$this->state['promo']) ?>"></label><button>Применить</button></form><p class="g-checkout-note">DEMO10 — тестовая скидка 10% на товары.</p><a class="g-button" href="<?= $e($this->href('/checkout/')) ?>">К оформлению</a><?php endif ?><p class="g-checkout-note">Демонстрация без реальной оплаты. Товары резервируются в вашей сессии после создания заказа.</p></aside></div><?php }
            if($path==='cart'&&!empty($this->state['undo'])){ ?><form method="post"><?php $this->hidden('undo'); ?><button>Вернуть удалённый товар</button></form><?php }
        }elseif($path==='order'){
            $ref=is_scalar($_GET['ref']??'')?self::text($_GET,'ref',40):'';$order=$this->state['orders'][$ref]??null;
            if(!$order){$options['http_status']=404; ?><p>Заказ не найден в этом браузере. Данные другого посетителя недоступны.</p><a class="g-button" href="<?= $e($this->href('/account/')) ?>">Мои заказы</a><?php }
            else{ ?><p>Тестовый заказ <strong><?= $e($ref) ?></strong></p><p class="g-order-state"><?= ['pending'=>'Ожидает тестового подтверждения','paid'=>'Тестовая оплата подтверждена','canceled'=>'Отменён','expired'=>'Срок резерва истёк'][$order['state']] ?></p><p>Это демонстрация: деньги не списываются, письма не отправляются, товары не доставляются.</p><div class="g-order-actions"><?php if($order['state']==='pending'): ?><form method="post"><?php $this->hidden('pay',compact('ref')); ?><button class="g-button">Имитировать успешную оплату</button></form><a class="g-small-button" href="<?= $e($this->href('/order/',['ref'=>$ref,'cancel'=>1])) ?>">Отменить заказ</a><?php endif ?><a class="g-link" href="<?= $e($this->href('/account/')) ?>">Все мои заказы</a></div><?php if($order['state']==='pending'&&is_scalar($_GET['cancel']??'')&&self::text($_GET,'cancel')==='1'): ?><section class="g-cancel-confirm"><h2>Отменить тестовый заказ?</h2><p>Резерв товаров будет освобождён. Реального списания не было.</p><div class="g-order-actions"><form method="post"><?php $this->hidden('cancel',compact('ref')); ?><button class="g-button">Да, отменить заказ</button></form><a href="<?= $e($this->href('/order/',compact('ref'))) ?>">Оставить заказ</a></div></section><?php endif ?><div class="g-commerce-layout"><div><?php foreach($order['items'] as $i): ?><article class="g-cart-item"><img src="<?= $e(Content::asset($i['image'])) ?>" alt="<?= $e($i['title']) ?>" width="100" height="120"><div><h2><?= $e($i['title']) ?></h2><p><?= $e($i['variant_title']) ?> · <?= $i['quantity'] ?> шт.</p></div><strong><?= Gallery::money($i['price']*$i['quantity']) ?></strong></article><?php endforeach ?><p>Получение: <?= $order['shipping']==='pickup'?'самовывоз':'тестовая доставка' ?></p></div><aside class="g-summary"><?php $this->summary($order); ?></aside></div><?php }
        }else{ ?><p>Тестовые заказы этой сессии. В другом браузере они не видны.</p><?php if(!$this->state['orders']): ?><div class="g-empty"><h2>Заказов пока нет</h2><a class="g-button" href="<?= $e($this->href('/catalog/')) ?>">Выбрать товары</a></div><?php else: ?><div class="g-table-scroll"><table class="g-order-list"><thead><tr><th>Заказ</th><th>Статус</th><th>Сумма</th></tr></thead><tbody><?php foreach(array_reverse($this->state['orders'],true) as $ref=>$order): ?><tr><td><a class="g-link" href="<?= $e($this->href('/order/',compact('ref'))) ?>"><?= $e($ref) ?></a></td><td><?= ['pending'=>'Ожидает подтверждения','paid'=>'Тестовая оплата','canceled'=>'Отменён','expired'=>'Резерв истёк'][$order['state']] ?></td><td><?= Gallery::money($order['total']) ?></td></tr><?php endforeach ?></tbody></table></div><?php endif; }
        $options['body']=ob_get_clean();return false;
    }
}
