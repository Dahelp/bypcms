<?php
declare(strict_types=1);
require __DIR__.'/../_core/bootstrap.php';
header('Cache-Control: no-store');
$_SESSION['review_login_csrf'] ??= bin2hex(random_bytes(32));
$user=$auth->user();
if (!$user) {
    $loginError='';
    if ($_SERVER['REQUEST_METHOD']==='POST') {
        if (!hash_equals($_SESSION['review_login_csrf'],(string)($_POST['csrf']??''))) $loginError='Сессия истекла. Обновите страницу.';
        elseif (time()-(int)($_SESSION['review_login_attempt']??0)<3) $loginError='Повторите попытку через несколько секунд.';
        else {
            $_SESSION['review_login_attempt']=time();
            $signed=$auth->attempt((string)($_POST['email']??''),(string)($_POST['password']??''));
            if ($signed) { header('Location: /account/review.php'); exit; }
            $loginError='Неверный email или пароль владельца.';
        }
    }
    $escape=static fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES,'UTF-8');
    ?><!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Вход владельца — заказы BYPCMS</title><style>body{margin:0;background:#f5f7f4;color:#26362b;font:16px/1.6 system-ui}main{max-width:440px;margin:10vh auto;padding:32px;background:white;border:1px solid #dce3dc;border-radius:12px}label{display:grid;gap:8px;margin:18px 0}input{padding:12px;font:inherit;border:1px solid #ccd6cd;border-radius:7px}button{padding:12px 18px;background:#52675e;color:white;border:0;border-radius:7px;font:inherit}</style><main><h1>Вход владельца</h1><p>Подтверждение тестовых заказов. Используйте учётную запись owner center, не аккаунт клиента.</p><p role="alert"><?= $escape($loginError) ?></p><form method="post"><input type="hidden" name="csrf" value="<?= $escape($_SESSION['review_login_csrf']) ?>"><label>Email<input type="email" name="email" autocomplete="username" required></label><label>Пароль<input type="password" name="password" autocomplete="current-password" required></label><button>Войти к заказам</button></form><p><a href="/account/">Кабинет клиента</a> · <a href="/owner/">Owner center</a></p></main></html><?php
    exit;
}
if($user['role']!=='owner'){http_response_code(403);exit('Доступ только владельцу. Выйдите из текущей учётной записи через админку и войдите как владелец.');}
require __DIR__.'/../_core/customer-delivery.php';
header('Cache-Control: no-store');$_SESSION['review_csrf']??=bin2hex(random_bytes(32));$error='';
if($_SERVER['REQUEST_METHOD']==='POST'){try{if(!hash_equals($_SESSION['review_csrf'],(string)($_POST['csrf']??'')))throw new RuntimeException('Недействительная сессия');customer_fulfill($db,$config,(int)($_POST['order']??0),(int)$user['id']);header('Location: /account/review.php');exit;}catch(Throwable $e){$error='Подтверждение не выполнено. Проверьте заказ и доступность ZIP.';}}
$exists=$db->one("SHOW TABLES LIKE 'byp_customer_orders'");
$rows=$exists?$db->all('SELECT o.*,c.email FROM byp_customer_orders o JOIN byp_customer_accounts c ON c.id=o.customer_id ORDER BY o.id DESC'):[];
$esc=static fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES,'UTF-8');
?><!doctype html><html lang="ru"><meta charset="utf-8"><title>Тестовые заказы BYPCMS</title><style>body{max-width:1000px;margin:40px auto;font:16px/1.6 system-ui;padding:24px}article{padding:24px;border:1px solid #ddd;margin:20px 0}button{padding:12px}</style><h1>Подтверждение тестовых заказов</h1><p>Реальная оплата не производится. Действие выдаёт тестовую покупку.</p><p><?= $esc($error) ?></p><?php foreach($rows as $row): ?><article><h2>№<?= (int)$row['id'] ?> · <?= $esc($row['email']) ?></h2><p><?= $esc($row['domain']) ?> · <?= $esc($row['modules']) ?> · <?= $esc($row['status']) ?></p><?php if($row['status']==='pending'): ?><form method="post"><input type="hidden" name="csrf" value="<?= $esc($_SESSION['review_csrf']) ?>"><input type="hidden" name="order" value="<?= (int)$row['id'] ?>"><button>Подтвердить тестовую покупку</button></form><?php endif ?></article><?php endforeach ?></html>
