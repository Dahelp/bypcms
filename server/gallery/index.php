<?php
declare(strict_types=1);
require_once __DIR__.'/../_core/Gallery.php';require_once __DIR__.'/../_core/DemoStore.php';
use BYPCMS\Core\{Gallery,DemoStore};
$theme=defined('BYPCMS_STORE_THEME')?BYPCMS_STORE_THEME:'gallery';$base='/'.$theme;
session_name('bypcms_gallery_demo');session_set_cookie_params(['httponly'=>true,'samesite'=>'Lax','secure'=>!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off']);session_start();
$seed=require __DIR__.'/../_core/GallerySeed.php';
$seed['products']=array_values(array_filter($seed['products'],fn($p)=>$theme==='market'||empty($p['demo_market_only'])));
if($theme==='market')usort($seed['products'],fn($a,$b)=>(int)!empty($b['demo_market_only'])<=>(int)!empty($a['demo_market_only']));
$settings=['theme'=>$theme,'site_name'=>ucfirst($theme),'tagline'=>['gallery'=>'Мебель для жизни. Детали для уюта.','market'=>'Всё нужное. В одном месте.','luxe'=>'Искусство жить красиво.'][$theme],'accent'=>['gallery'=>'#3e594c','market'=>'#2558d9','luxe'=>'#6d283a'][$theme],'site_url'=>'https://demo.bypcms.ru'];
$path=trim(substr((string)parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH),strlen($base)),'/');$token=is_scalar($_GET['snapshot']??'')?(string)($_GET['snapshot']??''):'';
if($token){$snapshot=$_SESSION['snapshots'][$token]??null;if(!$snapshot||$snapshot['expires']<time()||($snapshot['settings']['theme']??'gallery')!==$theme){http_response_code(410);header('X-Robots-Tag: noindex');exit('Предпросмотр истёк. Откройте его заново.');}$seed['products']=$snapshot['products'];$seed['pages']=$snapshot['pages']??$seed['pages'];$settings=array_merge($settings,$snapshot['settings']);if(!$path&&!empty($snapshot['path']))$path=$snapshot['path'];}
foreach($seed['pages'] as &$page){if($token)break;if($page['slug']==='about'){$page['title']='О магазине '.ucfirst($theme);$page['excerpt']='Выбор, покупка и получение — понятный путь к вашему заказу.';$page['content']='<h2>Добро пожаловать в '.ucfirst($theme).'</h2><p>Здесь можно подобрать товары по категории, бренду и цене, изучить варианты и характеристики, собрать корзину и пройти тестовое оформление.</p><p>Это демонстрационный магазин BYPCMS. Товары и цены иллюстративные. Заказы доступны только в вашей сессии: деньги не списываются, сообщения и товары не отправляются.</p>';}
if($page['slug']==='delivery')$page['content']='<h2>Получение в демонстрации</h2><p>Тестовая доставка стоит 599 ₽, самовывоз — бесплатно. Выберите способ в корзине: итоговая сумма покажется до оформления.</p><h2>Тестовая оплата</h2><p>После создания заказа можно имитировать успешную оплату. Платёжная система не вызывается, денег и банковских данных не требуется. Для скидки 10% на товары используйте DEMO10.</p><p>Перед запуском своего магазина замените эти примеры фактическими условиями.</p>';}
unset($page);$_SESSION['csrf']??=bin2hex(random_bytes(24));$options=['demo'=>true,'snapshot'=>$token,'csrf'=>$_SESSION['csrf'],'groups'=>$seed['groups']];
$store=new DemoStore($seed['products'],$base,$token,$theme);if($store->run($path,$options))return;
Gallery::render($store->availableProducts(),$settings,$seed['pages'],$path,$base,$options);
