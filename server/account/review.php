<?php
declare(strict_types=1);
require __DIR__.'/../_core/bootstrap.php';
$user=$auth->requireUser();if($user['role']!=='owner'){http_response_code(403);exit('Только владелец');}
require __DIR__.'/../_core/customer-delivery.php';
header('Cache-Control: no-store');$_SESSION['review_csrf']??=bin2hex(random_bytes(32));$error='';
if($_SERVER['REQUEST_METHOD']==='POST'){try{if(!hash_equals($_SESSION['review_csrf'],(string)($_POST['csrf']??'')))throw new RuntimeException('Недействительная сессия');customer_fulfill($db,$config,(int)($_POST['order']??0),(int)$user['id']);header('Location: /account/review.php');exit;}catch(Throwable $e){$error='Подтверждение не выполнено. Проверьте заказ и доступность ZIP.';}}
$rows=$db->all('SELECT o.*,c.email FROM byp_customer_orders o JOIN byp_customer_accounts c ON c.id=o.customer_id ORDER BY o.id DESC');
$esc=static fn($v)=>htmlspecialchars((string)$v,ENT_QUOTES,'UTF-8');
?><!doctype html><html lang="ru"><meta charset="utf-8"><title>Тестовые заказы BYPCMS</title><style>body{max-width:1000px;margin:40px auto;font:16px/1.6 system-ui;padding:24px}article{padding:24px;border:1px solid #ddd;margin:20px 0}button{padding:12px}</style><h1>Подтверждение тестовых заказов</h1><p>Реальная оплата не производится. Действие выдаёт тестовую покупку.</p><p><?= $esc($error) ?></p><?php foreach($rows as $row): ?><article><h2>№<?= (int)$row['id'] ?> · <?= $esc($row['email']) ?></h2><p><?= $esc($row['domain']) ?> · <?= $esc($row['modules']) ?> · <?= $esc($row['status']) ?></p><?php if($row['status']==='pending'): ?><form method="post"><input type="hidden" name="csrf" value="<?= $esc($_SESSION['review_csrf']) ?>"><input type="hidden" name="order" value="<?= (int)$row['id'] ?>"><button>Подтвердить тестовую покупку</button></form><?php endif ?></article><?php endforeach ?></html>
