<?php
declare(strict_types=1);
require_once __DIR__.'/bootstrap.php';
require_once __DIR__.'/CommerceOrders.php';
require_once __DIR__.'/CustomerRecovery.php';
header('Cache-Control: no-store, private');
header('X-Robots-Tag: noindex, nofollow');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
if(($config['app']['installation_type']??'platform')==='client'){http_response_code(403);exit('Восстановление кабинета покупателя доступно на платформе BYPCMS.');}
if((int)($_SERVER['CONTENT_LENGTH']??0)>8192){http_response_code(413);exit('Слишком большой запрос.');}
$_SESSION['customer_recovery_csrf']??=bin2hex(random_bytes(32));
$commerce=new \BYPCMS\Core\CommerceOrders($db,$config,BYPCMS_ROOT);
$recovery=new \BYPCMS\Core\CustomerRecovery($db,$commerce,$config,BYPCMS_ROOT);
$e=static fn($value)=>htmlspecialchars((string)$value,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
$error='';
function customer_recovery_page(string $title,string $body,string $error=''):void {
    $escape=static fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    ?><!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?= $escape($title) ?> — BYPCMS</title><link rel="stylesheet" href="/account/account.css?v=20261118-recovery1"></head><body><main class="recovery"><header><a href="/">BYPCMS</a><a href="/contacts/">Поддержка</a></header><section><h1><?= $escape($title) ?></h1><?php if($error):?><p class="error" role="alert"><?= $escape($error) ?></p><?php endif ?><?= $body ?></section><footer><a href="/legal/privacy/">Персональные данные</a></footer></main></body></html><?php
}
