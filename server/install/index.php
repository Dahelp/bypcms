<?php
declare(strict_types=1);

const ROOT_PATH = __DIR__ . '/..';
const STORAGE_PATH = ROOT_PATH . '/_storage';
const CONFIG_PATH = STORAGE_PATH . '/config.php';

session_name('bypcms_install');
session_start();
$_SESSION['install_csrf'] ??= bin2hex(random_bytes(24));

$installed = is_file(CONFIG_PATH);
$errors = [];
if(version_compare(PHP_VERSION,'8.2.0','<'))$errors[]='Требуется PHP 8.2 или новее.';
foreach(['pdo_mysql','mbstring','zip']as $extension)if(!extension_loaded($extension))$errors[]='Включите расширение PHP: '.$extension;
$success = false;
$manifest = is_file(ROOT_PATH . '/build-manifest.json')
    ? json_decode((string)file_get_contents(ROOT_PATH . '/build-manifest.json'), true) : null;
$edition = strtolower((string)($manifest['edition'] ?? 'business'));
if(in_array($edition,['content','business','commerce'],true)){foreach(['dom','fileinfo','gd']as $extension)if(!extension_loaded($extension))$errors[]='Для Content включите расширение PHP: '.$extension;if(extension_loaded('gd')&&(!function_exists('imagewebp')||!(imagetypes()&IMG_WEBP)))$errors[]='Для Content требуется поддержка WebP в PHP GD.';}
if (!in_array($edition, ['content', 'business', 'commerce'], true)) {
    $errors[] = 'Некорректная редакция в manifest сборки.';
}
$moduleNames = ['content'=>'Контент','seo'=>'SEO Pro','forms'=>'Формы и CRM','analytics'=>'Аналитика','payments'=>'Платежи','reviews'=>'Отзывы','delivery'=>'Доставка','faq'=>'Вопросы и ответы','commerce'=>'Магазин','updates'=>'Обновления','automation'=>'Автоматизация'];
$packageModules = is_array($manifest['modules'] ?? null) ? $manifest['modules'] : ['content','seo','forms','analytics','automation','updates'];
foreach ($packageModules as $moduleKey) {
    if (!is_string($moduleKey) || !isset($moduleNames[$moduleKey])) $errors[] = 'Сборка содержит неизвестный модуль.';
}

function field(string $name, string $default = ''): string
{
    return htmlspecialchars((string)($_POST[$name] ?? $default), ENT_QUOTES, 'UTF-8');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$installed) {
    if (!hash_equals((string)$_SESSION['install_csrf'], (string)($_POST['csrf'] ?? ''))) {
        $errors[] = 'Сессия установщика истекла. Обновите страницу.';
    }

    $dbHost = trim((string)($_POST['db_host'] ?? 'localhost'));
    $dbPort = (int)($_POST['db_port'] ?? 3306);
    $dbName = trim((string)($_POST['db_name'] ?? ''));
    $dbUser = trim((string)($_POST['db_user'] ?? ''));
    $dbPassword = (string)($_POST['db_password'] ?? '');
    $siteName = trim((string)($_POST['site_name'] ?? 'BYPCMS'));
    $siteUrl = rtrim(trim((string)($_POST['site_url'] ?? '')), '/');
    $adminName = trim((string)($_POST['admin_name'] ?? 'Администратор'));
    $adminEmail = strtolower(trim((string)($_POST['admin_email'] ?? '')));
    $adminPassword = (string)($_POST['admin_password'] ?? '');

    if ($dbName === '' || $dbUser === '') {
        $errors[] = 'Заполните имя базы и пользователя.';
    }
    if (!filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Укажите корректный email администратора.';
    }
    if (strlen($adminPassword) < 12) {
        $errors[] = 'Пароль администратора должен содержать минимум 12 символов.';
    }
    if ($siteUrl === '' || !filter_var($siteUrl, FILTER_VALIDATE_URL)) {
        $errors[] = 'Укажите полный адрес сайта с https://.';
    }
    if (!is_dir(STORAGE_PATH) && !mkdir(STORAGE_PATH, 0750, true)) {
        $errors[] = 'Не удалось создать каталог хранения.';
    }
    if (!is_writable(STORAGE_PATH)) {
        $errors[] = 'Каталог _storage недоступен для записи.';
    }

    if (!$errors) {
        $createdTables = [];
        $installLock = fopen(STORAGE_PATH . '/install.lock', 'c');
        try {
            if (!$installLock || !flock($installLock, LOCK_EX | LOCK_NB)) {
                throw new RuntimeException('Установка уже выполняется. Дождитесь завершения.');
            }
            if (is_file(CONFIG_PATH)) {
                throw new RuntimeException('Система уже установлена. Повторная установка запрещена.');
            }
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $dbHost, $dbPort, $dbName);
            $pdo = new PDO($dsn, $dbUser, $dbPassword, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);

            if ((int)$pdo->query("SELECT GET_LOCK(CONCAT('bypcms-install-', MD5(DATABASE())), 0)")->fetchColumn() !== 1) {
                throw new RuntimeException('Эта база уже используется другой установкой.');
            }
            if ($pdo->query('SHOW TABLES')->fetchColumn() !== false) {
                throw new RuntimeException('База данных не пустая. Создайте отдельную пустую базу; существующие данные не изменены.');
            }

            $schema = require ROOT_PATH . '/_core/schema.php';
            foreach ($schema as $statement) {
                $pdo->exec($statement);
                if (preg_match('/^CREATE TABLE IF NOT EXISTS ([a-z0-9_]+)/i', $statement, $match)) $createdTables[] = $match[1];
            }

            if (is_array($manifest) && in_array($edition,['content','business','commerce'],true)) {
                require_once ROOT_PATH.'/_core/Content.php';
                \BYPCMS\Core\Content::schema($pdo);
                array_push($createdTables,'byp_content_meta','byp_content_terms','byp_content_redirects');
                if($edition==='commerce'){require_once ROOT_PATH.'/_core/Shop.php';\BYPCMS\Core\Shop::schema($pdo);array_push($createdTables,...\BYPCMS\Core\Shop::TABLES);}
                if($edition==='business'){require_once ROOT_PATH.'/_core/Business.php';\BYPCMS\Core\Business::schema($pdo);array_push($createdTables,'byp_business_leads','byp_business_mail');}
            }
            $pdo->beginTransaction();
            $roleStatement = $pdo->prepare(
                'INSERT INTO byp_roles (slug, name, permissions, created_at, updated_at)
                 VALUES (:slug, :name, :permissions, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE name=VALUES(name), permissions=VALUES(permissions), updated_at=NOW()'
            );
            $roleStatement->execute([
                'slug' => 'owner',
                'name' => 'Владелец',
                'permissions' => json_encode(['*'], JSON_UNESCAPED_UNICODE),
            ]);
            $roleId = (int)$pdo->query('SELECT id FROM byp_roles WHERE slug="owner" LIMIT 1')->fetchColumn();

            $userStatement = $pdo->prepare(
                'INSERT INTO byp_users (role_id, email, password_hash, name, status, created_at, updated_at)
                 VALUES (:role, :email, :password, :name, "active", NOW(), NOW())
                 ON DUPLICATE KEY UPDATE role_id=VALUES(role_id), password_hash=VALUES(password_hash),
                 name=VALUES(name), status="active", updated_at=NOW()'
            );
            $userStatement->execute([
                'role' => $roleId,
                'email' => $adminEmail,
                'password' => password_hash($adminPassword, PASSWORD_DEFAULT),
                'name' => $adminName,
            ]);
            $adminId = (int)$pdo->query('SELECT id FROM byp_users WHERE email=' . $pdo->quote($adminEmail) . ' LIMIT 1')->fetchColumn();

            $settingStatement = $pdo->prepare(
                'INSERT INTO byp_settings (setting_group, setting_key, setting_value, value_type, is_public, updated_by, updated_at)
                 VALUES (:group_name, :key_name, :value_data, "string", :public_flag, :user_id, NOW())
                 ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), updated_by=VALUES(updated_by), updated_at=NOW()'
            );
            foreach ([
                ['general', 'site_name', $siteName, 1],
                ['general', 'site_url', $siteUrl, 1],
                ['general', 'locale', 'ru', 1],
                ['system', 'core_version', '2.0.0', 0],
                ['system', 'installed_at', date('c'), 0],
            ] as [$group, $key, $value, $public]) {
                $settingStatement->execute([
                    'group_name' => $group,
                    'key_name' => $key,
                    'value_data' => $value,
                    'public_flag' => $public,
                    'user_id' => $adminId,
                ]);
            }

            $moduleStatement = $pdo->prepare(
                'INSERT INTO byp_modules (module_key, name, version, status, manifest, settings, installed_at, updated_at)
                 VALUES (:module_key, :name, "1.0.0", "active", :manifest, "{}", NOW(), NOW())
                 ON DUPLICATE KEY UPDATE name=VALUES(name), version=VALUES(version), updated_at=NOW()'
            );
            foreach ($packageModules as $key) {
                $name = $moduleNames[$key];
                $moduleStatement->execute([
                    'module_key' => $key,
                    'name' => $name,
                    'manifest' => json_encode([
                        'key' => $key,
                        'name' => $name,
                        'requires_core' => '^2.0',
                        'permissions' => [],
                    ], JSON_UNESCAPED_UNICODE),
                ]);
            }

            $pageStatement = $pdo->prepare(
                'INSERT INTO byp_pages (author_id, slug, title, excerpt, content, blocks, template, status, published_at, created_at, updated_at)
                 VALUES (:author, "home", "Главная", :excerpt, :content, :blocks, "landing", "published", NOW(), NOW(), NOW())'
            );
            if (!(int)$pdo->query('SELECT COUNT(*) FROM byp_pages')->fetchColumn() && (!is_array($manifest) || !in_array($edition,['content','business','commerce'],true))) {
                $pageStatement->execute([
                    'author' => $adminId,
                    'excerpt' => 'Главная страница BYPCMS',
                    'content' => '',
                    'blocks' => json_encode([
                        ['type' => 'hero', 'data' => ['title' => 'Сайты, которые не боятся изменений.']],
                    ], JSON_UNESCAPED_UNICODE),
                ]);
            }

            if (is_array($manifest) && !in_array($edition,['content','business','commerce'],true)) {
                $starter = $pdo->prepare('INSERT INTO byp_pages (author_id,slug,title,excerpt,content,blocks,template,status,published_at,created_at,updated_at) SELECT :author,:slug,:title,:excerpt,:content,"[]","page","published",NOW(),NOW(),NOW() WHERE NOT EXISTS (SELECT 1 FROM byp_pages WHERE slug=:existing)');
                foreach ([['about','О компании'],['contacts','Контакты'],[$edition==='content'?'journal':($edition==='commerce'?'catalog':'services'),$edition==='content'?'Журнал':($edition==='commerce'?'Каталог':'Услуги')]] as [$starterSlug,$starterTitle]) {
                    $starter->execute(['author'=>$adminId,'slug'=>$starterSlug,'existing'=>$starterSlug,'title'=>$starterTitle,'excerpt'=>$starterTitle.' — '.$siteName,'content'=>'Заполните содержание этой страницы в разделе «Контент» панели управления.']);
                }
            }

            if (!(int)$pdo->query('SELECT COUNT(*) FROM byp_licenses')->fetchColumn()) {
                $licenseStatement = $pdo->prepare(
                    'INSERT INTO byp_licenses (edition, domain, status, entitlements, valid_until, created_at, updated_at)
                     VALUES (:edition, :domain, "trial", :entitlements, DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW())'
                );
                $licenseStatement->execute([
                    'edition' => $edition,
                    'domain' => (string)(parse_url($siteUrl, PHP_URL_HOST) ?: ''),
                    'entitlements' => json_encode($packageModules, JSON_UNESCAPED_UNICODE),
                ]);
            }

            $pdo->exec(
                'INSERT IGNORE INTO byp_migrations (migration, batch, applied_at)
                 VALUES ("2026_07_27_000001_initial_core", 1, NOW())'
            );
            if(is_array($manifest)&&$edition==='content')\BYPCMS\Core\Content::seed($pdo,$adminId,$siteName);
            if(is_array($manifest)&&$edition==='business')\BYPCMS\Core\Business::seed($pdo,$adminId,$siteName);
            if(is_array($manifest)&&$edition==='commerce')\BYPCMS\Core\Shop::seed($pdo,$adminId,$siteName);
            $pdo->commit();

            $config = [
                'app' => [
                    'name' => $siteName,
                    'url' => $siteUrl,
                    'version' => (string)($manifest['core_version'] ?? '2.1.0'),
                    'debug' => false,
                    'key' => bin2hex(random_bytes(32)),
                    'edition' => $edition,
                    'modules' => $packageModules,
                    'installation_type' => is_array($manifest) ? 'client' : 'platform',
                    'installation_id' => bin2hex(random_bytes(16)),
                ],
                'database' => [
                    'host' => $dbHost,
                    'port' => $dbPort,
                    'name' => $dbName,
                    'username' => $dbUser,
                    'password' => $dbPassword,
                    'charset' => 'utf8mb4',
                ],
            ];
            $payload = "<?php\n// Generated by BYPCMS installer. Keep this file private.\nreturn " . var_export($config, true) . ";\n";
            $temporary = CONFIG_PATH . '.tmp';
            if (file_put_contents($temporary, $payload, LOCK_EX) === false || !rename($temporary, CONFIG_PATH)) {
                throw new RuntimeException('Не удалось записать конфигурацию.');
            }
            @chmod(CONFIG_PATH, 0640);
            file_put_contents(STORAGE_PATH . '/installed.lock', date('c') . PHP_EOL, LOCK_EX);

            $success = true;
            $installed = true;
        } catch (Throwable $error) {
            if (isset($pdo) && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            // MySQL DDL is not transactional. Only tables created in this previously
            // empty database belong to this failed attempt and may be removed.
            if (isset($pdo) && $createdTables && !is_file(CONFIG_PATH)) {
                try {
                    $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
                    foreach (array_reverse($createdTables) as $table) $pdo->exec('DROP TABLE IF EXISTS `' . $table . '`');
                } catch (Throwable $cleanupError) {
                    error_log('[BYPCMS install cleanup] ' . $cleanupError->getMessage());
                    $errors[] = 'Не удалось очистить неполную установку. Для повторной попытки используйте новую пустую базу.';
                } finally { $pdo->exec('SET FOREIGN_KEY_CHECKS=1'); }
            }
            $errors[] = 'Установка не завершена: ' . $error->getMessage();
        } finally {
            if (isset($pdo)) $pdo->query("SELECT RELEASE_LOCK(CONCAT('bypcms-install-', MD5(DATABASE())))");
            if (is_resource($installLock)) { flock($installLock, LOCK_UN); fclose($installLock); }
        }
    }
}
?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Установка BYPCMS</title>
  <style>
    :root{--ink:#161713;--paper:#f5f3ed;--acid:#caff3d;--violet:#7d5cff}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:Inter,Segoe UI,Arial,sans-serif;min-height:100vh;display:grid;place-items:center;padding:30px}
    .wrap{width:min(930px,100%);display:grid;grid-template-columns:.8fr 1.2fr;background:#fff;border:1px solid #deddd7;box-shadow:0 30px 80px rgba(25,24,20,.13)}
    aside{background:var(--ink);color:#fff;padding:45px;display:flex;flex-direction:column}.logo{width:44px;height:44px;display:grid;place-items:center;background:var(--acid);color:var(--ink);border-radius:11px;font-weight:900;font-size:24px}
    aside h1{font-size:38px;line-height:1;letter-spacing:-.05em;margin:45px 0 18px}aside p{color:#a7aaa0;line-height:1.6;font-size:14px}aside small{margin-top:auto;color:#74776e}
    main{padding:45px}.label{font-size:9px;font-weight:800;letter-spacing:.17em;color:#8d8b84}h2{font-size:27px;letter-spacing:-.04em;margin:8px 0 28px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}.full{grid-column:1/-1}
    label{display:grid;gap:6px;font-size:10px;font-weight:700}input{width:100%;height:42px;border:1px solid #deded8;border-radius:6px;padding:0 11px;font:inherit;font-size:12px;background:#fafaf8}input:focus{outline:2px solid #cfc7ff;border-color:var(--violet)}
    button,.button{width:100%;height:45px;border:0;border-radius:6px;background:var(--violet);color:#fff;font-weight:800;margin-top:23px;cursor:pointer;display:grid;place-items:center;text-decoration:none;font-size:12px}
    .errors{background:#fff0ef;color:#a3322e;padding:13px;border-radius:6px;margin-bottom:18px;font-size:12px}.errors p{margin:4px}.done{text-align:center;padding:45px 10px}.done i{display:grid;place-items:center;width:70px;height:70px;border-radius:50%;background:var(--acid);font-size:30px;font-style:normal;margin:0 auto 20px}.done p{color:#77756e;line-height:1.6}
    @media(max-width:760px){.wrap{grid-template-columns:1fr}aside{padding:28px}aside h1{margin:25px 0 10px}aside small{display:none}main{padding:28px}.grid{grid-template-columns:1fr}.full{grid-column:auto}}
  </style>
</head>
<body>
<div class="wrap">
  <aside>
    <span class="logo">B</span>
    <h1>BYPCMS<br>2.0</h1>
    <p>Стабильное ядро, независимые модули и безопасные обновления.</p>
    <small>Системные требования: PHP 8.2+ · MySQL 5.7+ / MariaDB 10.3+</small>
  </aside>
  <main>
    <?php if ($success): ?>
      <div class="done">
        <i>✓</i>
        <p class="label">УСТАНОВКА ЗАВЕРШЕНА</p>
        <h2>BYPCMS готова к работе</h2>
        <p>Таблицы созданы, модули зарегистрированы, владелец системы настроен.</p>
        <a class="button" href="/admin/">Открыть панель управления →</a>
      </div>
    <?php elseif ($installed): ?>
      <div class="done">
        <i>✓</i>
        <p class="label">СИСТЕМА УЖЕ УСТАНОВЛЕНА</p>
        <h2>Повторная установка заблокирована</h2>
        <p>Для безопасности установщик не изменяет действующую конфигурацию.</p>
        <a class="button" href="/admin/">Перейти в панель →</a>
      </div>
    <?php else: ?>
      <p class="label">ШАГ 1 ИЗ 1</p>
      <h2>Настройка платформы</h2>
      <?php if ($errors): ?><div class="errors"><?php foreach ($errors as $error): ?><p><?=htmlspecialchars($error, ENT_QUOTES, 'UTF-8')?></p><?php endforeach ?></div><?php endif ?>
      <form method="post" autocomplete="off">
        <input type="hidden" name="csrf" value="<?=htmlspecialchars($_SESSION['install_csrf'], ENT_QUOTES, 'UTF-8')?>">
        <div class="grid">
          <label>Название сайта<input name="site_name" value="<?=field('site_name', 'BYPCMS')?>" required></label>
          <label>Адрес сайта<input name="site_url" value="<?=field('site_url', 'https://')?>" required></label>
          <label>Сервер базы<input name="db_host" value="<?=field('db_host', 'localhost')?>" required></label>
          <label>Порт<input name="db_port" value="<?=field('db_port', '3306')?>" inputmode="numeric" required></label>
          <label>Имя базы<input name="db_name" value="<?=field('db_name')?>" required></label>
          <label>Пользователь БД<input name="db_user" value="<?=field('db_user')?>" required></label>
          <label class="full">Пароль БД<input type="password" name="db_password" required></label>
          <label>Имя владельца<input name="admin_name" value="<?=field('admin_name', 'Администратор')?>" required></label>
          <label>Email владельца<input type="email" name="admin_email" value="<?=field('admin_email')?>" required></label>
          <label class="full">Пароль владельца<input type="password" name="admin_password" minlength="12" required></label>
        </div>
        <button type="submit">Установить BYPCMS</button>
      </form>
    <?php endif ?>
  </main>
</div>
</body>
</html>
