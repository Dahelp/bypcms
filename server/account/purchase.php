<?php
declare(strict_types=1);
require_once __DIR__.'/../_core/PublicLocale.php';
require __DIR__.'/../_core/bootstrap.php';
header('Cache-Control: no-store');header('X-Robots-Tag: noindex, nofollow');
if(empty($_SESSION['customer_id'])){
    $returnTo='/account/purchase.php?id='.(int)($_GET['id']??0).(isset($_GET['download'])?'&download=1':'');
    header('Location: /account/?next='.rawurlencode($returnTo),true,302);exit;
}
require __DIR__.'/../_core/customer-delivery.php';
$purchase=$db->one('SELECT o.*,d.key_cipher,d.archive_path,d.confirmed_at FROM byp_customer_orders o JOIN byp_customer_deliveries d ON d.order_id=o.id WHERE o.id=:id AND o.customer_id=:customer AND o.status IN ("test_confirmed","paid")',['id'=>(int)($_GET['id']??0),'customer'=>(int)$_SESSION['customer_id']]);
if($purchase&&\BYPCMS\Core\CommerceAccess::orderDenied($db->pdo(),(int)$purchase['id'])){http_response_code(403);exit(public_t('Доступ к покупке закрыт в связи с возвратом. Откройте заказ в личном кабинете.'));}
if(!$purchase){http_response_code(404);exit(public_t('Покупка недоступна'));}
$details=$db->one("SHOW TABLES LIKE 'byp_commerce_orders'")?$db->one('SELECT mode FROM byp_commerce_orders WHERE order_id=?',[$purchase['id']]):null;
$isTest=$purchase['status']==='test_confirmed'||($details['mode']??'')==='test';
if(($details['mode']??'')==='test'&&empty($config['app']['debug'])&&($auth->user()['role']??'')!=='owner'){http_response_code(403);exit(public_t('Тестовая выдача доступна только владельцу платформы.'));}
try {customer_license_prepare($db,$config,$purchase);}catch(Throwable $error){error_log('[BYPCMS delivery] '.$error->getMessage());http_response_code(503);exit(public_t('Не удалось подготовить лицензию. Повторите запрос позже.'));}
if(isset($_GET['download'])){
    $path=realpath($purchase['archive_path']);$bases=[realpath(BYPCMS_STORAGE.'/customer-packages'),realpath(\BYPCMS\Core\UpdateRuntime::storage(BYPCMS_ROOT).'/customer-packages')];$allowed=false;foreach($bases as $base)if($path&&$base&&str_starts_with($path,$base.DIRECTORY_SEPARATOR))$allowed=true;
    if(!$allowed||!$path||!is_file($path)){http_response_code(404);exit(public_t('Архив недоступен'));}
    try{customer_package_trust($db,$config,$path);}catch(Throwable $error){http_response_code(503);exit(public_t('Не удалось подготовить архив. Повторите запрос позже.'));}
    header('Content-Type: application/zip');header('Content-Disposition: attachment; filename="bypcms-'.preg_replace('/[^a-z]/','',(string)$purchase['edition']).'-'.(int)$purchase['id'].'.zip"');header('Content-Length: '.filesize($path));readfile($path);exit;
}
$key=customer_key_crypt($purchase['key_cipher'],$config['app']['key'],true);
$e=static fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES,'UTF-8');
?><!doctype html><html lang="<?= public_lang() ?>"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?= public_text('Покупка BYPCMS') ?></title><style>body{max-width:850px;margin:40px auto;padding:24px;font:16px/1.7 system-ui;color:#26362b}section{padding:24px;border:1px solid #d5ddd5;border-radius:10px}code{overflow-wrap:anywhere}a{color:#395c43}</style><a href="/account/"><?= public_text('← Мой кабинет') ?></a><p><a href="<?= public_href('/contacts/') ?>"><?= public_text('Контакты и реквизиты') ?></a></p><h1><?= $isTest?public_t('Тестовая покупка'):public_t('Покупка') ?> №<?= (int)$purchase['id'] ?></h1><section><p><?= public_text('Редакция: ') ?><?= $e(ucfirst($purchase['edition'])) ?></p><p><?= public_text('Домен: ') ?><?= $e($purchase['domain']) ?></p><p><?= public_text('Состав: ') ?><?= $e($purchase['modules']) ?></p><p><?= public_text('Подтверждено: ') ?><?= $e($purchase['confirmed_at']) ?></p><h2><?= public_text('Ключ покупки') ?></h2><code><?= $e($key) ?></code><p><strong><?= public_text('После установки откройте /admin/?section=license и активируйте этот ключ на указанном HTTPS-домене. Выдача ключа сама по себе не активирует установку.') ?></strong></p><a href="?id=<?= (int)$purchase['id'] ?>&amp;download=1"><?= public_text('Скачать архив BYPCMS') ?></a><h2><?= public_text('Установка') ?></h2><ol><li><?= public_text('Используйте указанный домен и отдельную пустую БД.') ?></li><li><?= public_text('Загрузите содержимое site/ и откройте /install/.') ?></li><li><?= public_text('Задайте собственные логин и пароль администратора. Пароль в кабинете не хранится.') ?></li></ol><p><?= $isTest?public_t('Это тестовая покупка, реальная оплата не производилась.'):public_t('Сохраните архив и ключ. Для обновлений и резервных копий используйте раздел «Обновления» в установленной CMS.') ?></p></section></html>
