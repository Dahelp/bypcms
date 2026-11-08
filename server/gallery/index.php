<?php
declare(strict_types=1);
require_once __DIR__.'/../_core/Gallery.php';
use BYPCMS\Core\{Content,Gallery};
session_name('bypcms_gallery_demo');session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax','secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off']);session_start();
$seed=require __DIR__.'/../_core/GallerySeed.php';$settings=['site_name'=>'Gallery','tagline'=>'Вещи, с которыми хочется жить.','site_url'=>'https://demo.bypcms.ru'];$path=trim(substr((string)parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH),strlen('/gallery')),'/');$token=(string)($_GET['snapshot']??'');
if($token){$snapshot=$_SESSION['snapshots'][$token]??null;if(!$snapshot||$snapshot['expires']<time()){http_response_code(410);header('X-Robots-Tag: noindex');exit('Предпросмотр истёк. Откройте его заново.');}$seed['products']=$snapshot['products'];$settings=array_merge($settings,$snapshot['settings']);if(!$path&&!empty($snapshot['path']))$path=$snapshot['path'];}
$_SESSION['csrf']??=bin2hex(random_bytes(24));$options=['demo'=>true,'snapshot'=>$token,'csrf'=>$_SESSION['csrf'],'groups'=>$seed['groups']];$key=$token?:'public';$_SESSION['carts']=array_intersect_key($_SESSION['carts']??[],($_SESSION['snapshots']??[])+['public'=>true]);$cart=$_SESSION['carts'][$key]??[];
if($_SERVER['REQUEST_METHOD']==='POST'&&$path==='cart')try{
 if(!hash_equals($_SESSION['csrf'],(string)($_POST['csrf']??'')))throw new RuntimeException('Сессия истекла. Повторите выбор.');$id=(int)($_POST['variant']??0);$qty=(int)($_POST['quantity']??0);$variant=null;foreach($seed['products']as $p)foreach($p['variants']as $v)if((int)$v['id']===$id)$variant=$v;
 $next=($_POST['action']??'')==='add'?(int)($cart[$id]??0)+$qty:$qty;if(!$variant||$next<0||$next>min(99,(int)$variant['stock']))throw new RuntimeException('Нет нужного количества в выбранном варианте.');if($next)$cart[$id]=$next;else unset($cart[$id]);$_SESSION['carts'][$key]=$cart;header('Location: /gallery/cart/'.($token?'?snapshot='.$token:''),true,303);return;
}catch(Throwable $x){$options['error']=$x->getMessage();$options['http_status']=422;}
$options['cart_count']=array_sum($cart);
if($path==='cart'){
 $e=[Content::class,'e'];ob_start();$total=0;foreach($seed['products']as $p)foreach($p['variants']as $v)if(isset($cart[$v['id']])){$qty=$cart[$v['id']];$total+=$qty*$v['price'];?><article class="g-cart-item"><img src="<?= $e(Content::asset($p['images'][0]??'')) ?>" alt="<?= $e($p['title']) ?>"><div><h2><a href="/gallery/product/<?= $e($p['slug']) ?>/<?= $token?'?snapshot='.$e($token):'' ?>"><?= $e($p['title']) ?></a></h2><p><?= $e($v['title']) ?></p><form method="post"><input type="hidden" name="csrf" value="<?= $e($_SESSION['csrf']) ?>"><input type="hidden" name="action" value="quantity"><input type="hidden" name="variant" value="<?= (int)$v['id'] ?>"><label>Количество (0 — убрать)<input type="number" name="quantity" value="<?= $qty ?>" min="0" max="99"></label><button>Обновить</button></form></div><strong><?= Gallery::money($v['price']*$qty) ?></strong></article><?php }
 if(!$cart)echo '<p class="g-empty">Ваша корзина пуста. Начните с предмета, который вам близок.</p>';else echo '<p>Предметы: <strong>'.Gallery::money($total).'</strong></p><p>Публичная демонстрация не принимает заказы и оплату. В установленной CMS дальше доступны доставка, промокод, сохранение заказа и ЮKassa.</p>';
 echo '<a class="g-button" href="/gallery/catalog/'.($token?'?snapshot='.$e($token):'').'">Вернуться к предметам ↗</a>';$options['body']=ob_get_clean();
}
Gallery::render($seed['products'],$settings,$seed['pages'],$path,'/gallery',$options);
