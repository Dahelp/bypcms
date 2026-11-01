<?php
declare(strict_types=1);
require_once __DIR__ . '/../_core/bootstrap.php';
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
$db->execute('CREATE TABLE IF NOT EXISTS byp_customer_accounts (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,email VARCHAR(190) NOT NULL UNIQUE,name VARCHAR(190) NOT NULL,password_hash VARCHAR(255) NOT NULL,created_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$db->execute('CREATE TABLE IF NOT EXISTS byp_customer_orders (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,customer_id INT UNSIGNED NOT NULL,edition VARCHAR(30) NOT NULL,modules LONGTEXT NOT NULL,domain VARCHAR(190) NOT NULL,license_term VARCHAR(20) NOT NULL,status VARCHAR(30) NOT NULL DEFAULT "pending",created_at DATETIME NOT NULL,INDEX(customer_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
$_SESSION['customer_csrf'] ??= bin2hex(random_bytes(32));
$error = '';
$e = static fn($value): string => htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (!hash_equals($_SESSION['customer_csrf'], (string)($_POST['csrf'] ?? ''))) throw new RuntimeException('Сессия истекла. Обновите страницу.');
        $action = (string)($_POST['action'] ?? '');
        if ($action === 'logout') { unset($_SESSION['customer_id']); session_regenerate_id(true); }
        elseif (in_array($action, ['register','login'], true)) {
            if ((int)($_SESSION['customer_attempts'] ?? 0) >= 10 && time() - (int)($_SESSION['customer_attempt_at'] ?? 0) < 900) throw new RuntimeException('Слишком много попыток. Повторите через 15 минут.');
            $_SESSION['customer_attempts'] = (int)($_SESSION['customer_attempts'] ?? 0) + 1;
            $_SESSION['customer_attempt_at'] = time();
            $email = strtolower(trim((string)($_POST['email'] ?? '')));
            $password = (string)($_POST['password'] ?? '');
            if (!filter_var($email,FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Укажите корректный email.');
            if ($action === 'register') {
                $name = trim((string)($_POST['name'] ?? ''));
                if ($name === '' || strlen($name) > 190 || strlen($password) < 12 || strlen($password) > 1024) throw new RuntimeException('Укажите имя и пароль от 12 символов.');
                if ($db->one('SELECT id FROM byp_customer_accounts WHERE email=:email',['email'=>$email])) throw new RuntimeException('Не удалось зарегистрироваться. Если аккаунт существует, используйте вход.');
                $id = $db->insert('INSERT INTO byp_customer_accounts (email,name,password_hash,created_at) VALUES (:email,:name,:hash,NOW())',['email'=>$email,'name'=>$name,'hash'=>password_hash($password,PASSWORD_DEFAULT)]);
            } else {
                $account = $db->one('SELECT id,password_hash FROM byp_customer_accounts WHERE email=:email',['email'=>$email]);
                if (!$account || !password_verify($password,$account['password_hash'])) throw new RuntimeException('Неверный email или пароль.');
                $id = (int)$account['id'];
            }
            session_regenerate_id(true); $_SESSION['customer_id'] = $id; $_SESSION['customer_attempts'] = 0;
        } elseif ($action === 'order') {
            if (empty($_SESSION['customer_id'])) throw new RuntimeException('Необходимо войти.');
            $domain = strtolower(rtrim(trim((string)($_POST['domain'] ?? '')),'.'));
            if (!filter_var($domain,FILTER_VALIDATE_DOMAIN,FILTER_FLAG_HOSTNAME) || !str_contains($domain,'.') || str_contains($domain,':')) throw new RuntimeException('Домен указывается без https://, пути и порта: example.ru');
            // First acceptance scenario is deliberately restricted to Content + optional SEO.
            $modules = ['content']; if (isset($_POST['seo'])) $modules[] = 'seo';
            $term = ($_POST['term'] ?? '') === 'lifetime' ? 'lifetime' : 'annual';
            $db->insert('INSERT INTO byp_customer_orders (customer_id,edition,modules,domain,license_term,status,created_at) VALUES (:customer,"content",:modules,:domain,:term,"pending",NOW())',['customer'=>(int)$_SESSION['customer_id'],'modules'=>json_encode($modules),'domain'=>$domain,'term'=>$term]);
        }
        header('Location: /account/'); exit;
    } catch (Throwable $exception) { $error = $exception instanceof RuntimeException ? $exception->getMessage() : 'Не удалось выполнить операцию. Попробуйте позже.'; }
}
$customer = empty($_SESSION['customer_id']) ? null : $db->one('SELECT id,name,email FROM byp_customer_accounts WHERE id=:id',['id'=>(int)$_SESSION['customer_id']]);
$orders = $customer ? $db->all('SELECT id,edition,modules,domain,license_term,status,created_at FROM byp_customer_orders WHERE customer_id=:id ORDER BY id DESC',['id'=>$customer['id']]) : [];
?><!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Личный кабинет — BYPCMS</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f7f4;color:#26362b;font:16px/1.6 system-ui,sans-serif}main{max-width:1040px;margin:auto;padding:40px 24px}header{display:flex;justify-content:space-between;align-items:center;margin-bottom:40px}a{color:inherit}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}section,article{padding:28px;border:1px solid #dde4dc;border-radius:12px;background:white;margin-bottom:24px}label{display:grid;gap:7px;margin:16px 0}input,select{width:100%;padding:12px;border:1px solid #ccd6cd;border-radius:7px;font:inherit}input[type=checkbox]{width:auto}button{padding:12px 20px;border:0;border-radius:7px;background:#52675e;color:white;font:inherit;cursor:pointer}small{color:#6d786e}.error{padding:16px;background:#fff1ed;color:#9b3727}h1{font-size:32px}h2{font-size:23px}.check{display:flex;align-items:center;gap:12px}.status{padding:5px 10px;background:#fff3da;border-radius:20px}header form{margin:0}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style></head><body><main><header><a href="/">BYPCMS</a><?php if($customer): ?><form method="post"><input type="hidden" name="csrf" value="<?= $e($_SESSION['customer_csrf']) ?>"><button name="action" value="logout">Выйти</button></form><?php endif ?></header><h1>Личный кабинет</h1><?php if($error): ?><p class="error"><?= $e($error) ?></p><?php endif ?>
<?php if(!$customer): ?><div class="grid"><?php foreach(['login'=>'Войти','register'=>'Регистрация'] as $action=>$title): ?><section><h2><?= $title ?></h2><form method="post"><input type="hidden" name="csrf" value="<?= $e($_SESSION['customer_csrf']) ?>"><input type="hidden" name="action" value="<?= $action ?>"><?php if($action==='register'): ?><label>Имя<input name="name" required maxlength="190" autocomplete="name"></label><?php endif ?><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Пароль<input name="password" type="password" required <?= $action==='register'?'minlength="12"':'' ?> autocomplete="<?= $action==='register'?'new-password':'current-password' ?>"></label><button><?= $title ?></button></form></section><?php endforeach ?></div>
<?php else: ?><p><?= $e($customer['name']) ?> · <?= $e($customer['email']) ?></p><section><h2>Тестовый заказ Content</h2><p>Страницы, материалы и медиатека. Оплата не производится. Аналитика не включена.</p><form method="post"><input type="hidden" name="csrf" value="<?= $e($_SESSION['customer_csrf']) ?>"><input type="hidden" name="action" value="order"><label>Домен установки<input name="domain" required placeholder="example.ru"></label><label>Срок лицензии<select name="term"><option value="annual">1 год</option><option value="lifetime">Пожизненная</option></select></label><label class="check"><input type="checkbox" name="seo" checked>Дополнительный модуль SEO</label><button>Создать тестовый заказ</button></form></section><h2>Мои заказы</h2><?php foreach($orders as $order): ?><article><h3>Заказ №<?= (int)$order['id'] ?> · Content</h3><p><?= $e($order['domain']) ?> · <?= $e($order['license_term']) ?></p><p>Модули: <?= $e(implode(', ',json_decode($order['modules'],true))) ?></p><span class="status"><?= $order['status']==='pending'?'Ожидает подтверждения владельца':$e($order['status']) ?></span><p><small>До подтверждения архив и ключ активации не выдаются.</small></p></article><?php endforeach ?><?php if(!$orders): ?><p>Заказов пока нет.</p><?php endif ?><?php endif ?></main></body></html>
