<?php
declare(strict_types=1);

use BYPCMS\Core\Response;

require_once __DIR__ . '/../_core/bootstrap.php';

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = (string)($_GET['action'] ?? 'status');
$input = byp_input();

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    if ($action === 'status' && $method === 'GET') {
        $db->one('SELECT 1 AS healthy');
        Response::ok([
            'service' => 'BYPCMS API',
            'version' => (string)($config['app']['version'] ?? '2.0.0'),
            'php' => PHP_VERSION,
            'database' => 'connected',
            'installed' => true,
        ]);
    }

    if ($action === 'auth.login' && $method === 'POST') {
        $email = (string)($input['email'] ?? '');
        $password = (string)($input['password'] ?? '');
        if ($email === '' || $password === '') {
            Response::error('Введите email и пароль', 422);
        }
        $user = $auth->attempt($email, $password);
        if (!$user) {
            Response::error('Неверный email или пароль', 401);
        }
        byp_audit($db, $user, 'auth.login', 'user', (int)$user['id']);
        Response::ok(['user' => $user, 'csrf' => $_SESSION['csrf']]);
    }

    if ($action === 'auth.me' && $method === 'GET') {
        $user = $auth->requireUser();
        Response::ok(['user' => $user, 'csrf' => (string)($_SESSION['csrf'] ?? '')]);
    }

    if ($action === 'auth.logout' && $method === 'POST') {
        $user = $auth->requireUser();
        $auth->verifyCsrf();
        byp_audit($db, $user, 'auth.logout', 'user', (int)$user['id']);
        $auth->logout();
        Response::ok();
    }

    $user = $auth->requireUser();
    if ($method !== 'GET') {
        $auth->verifyCsrf();
    }

    if ($action === 'build.download' && $method === 'GET') {
        if (!class_exists('ZipArchive')) {
            Response::error('На сервере не включено расширение PHP ZipArchive', 501);
        }
        $edition = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($_GET['edition'] ?? 'Business'));
        $requested = array_values(array_filter(explode(',', (string)($_GET['modules'] ?? 'content'))));
        $allowed = ['content', 'seo', 'forms', 'commerce', 'payments', 'analytics'];
        $selected = array_values(array_intersect($requested, $allowed));
        $buildId = 'bypcms-' . strtolower($edition) . '-' . date('Ymd-His');
        $archivePath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . $buildId . '.zip';
        $zip = new ZipArchive();
        if ($zip->open($archivePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            Response::error('Не удалось создать архив сборки', 500);
        }
        $root = realpath(BYPCMS_ROOT);
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if (!$file->isFile()) continue;
            $full = $file->getRealPath();
            $relative = str_replace('\\', '/', substr($full, strlen($root) + 1));
            if (str_starts_with($relative, '_storage/') || str_starts_with($relative, '.git/')) continue;
            $zip->addFile($full, 'site/' . $relative);
        }
        $schema = require BYPCMS_ROOT . '/_core/schema.php';
        $zip->addFromString('database.sql', implode(";\n\n", $schema) . ";\n");
        $zip->addFromString('build-manifest.json', json_encode([
            'product' => 'BYPCMS',
            'edition' => $edition,
            'core_version' => (string)($config['app']['version'] ?? '2.1.0'),
            'modules' => $selected,
            'created_at' => date(DATE_ATOM),
            'installer' => 'site/install/index.php',
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $zip->addFromString('README.txt', "BYPCMS {$edition}\n\n1. Загрузите содержимое папки site на сервер.\n2. Откройте /install/.\n3. Укажите параметры MySQL и создайте владельца.\n");
        $zip->close();
        byp_audit($db, $user, 'build.download', 'build', null, ['edition' => $edition, 'modules' => $selected]);
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . $buildId . '.zip"');
        header('Content-Length: ' . filesize($archivePath));
        readfile($archivePath);
        @unlink($archivePath);
        exit;
    }

    if ($action === 'dashboard' && $method === 'GET') {
        $counts = [
            'pages' => (int)($db->one('SELECT COUNT(*) AS total FROM byp_pages')['total'] ?? 0),
            'published' => (int)($db->one('SELECT COUNT(*) AS total FROM byp_pages WHERE status = "published"')['total'] ?? 0),
            'users' => (int)($db->one('SELECT COUNT(*) AS total FROM byp_users WHERE status = "active"')['total'] ?? 0),
            'modules' => (int)($db->one('SELECT COUNT(*) AS total FROM byp_modules WHERE status = "active"')['total'] ?? 0),
            'submissions' => (int)($db->one('SELECT COUNT(*) AS total FROM byp_form_submissions WHERE status = "new"')['total'] ?? 0),
        ];
        $recentPages = $db->all('SELECT id, title, slug, status, updated_at FROM byp_pages ORDER BY updated_at DESC LIMIT 5');
        $license = $db->one('SELECT edition, domain, status, valid_until, updated_at FROM byp_licenses ORDER BY id DESC LIMIT 1');
        $modules = $db->all('SELECT module_key, name, version, status, updated_at FROM byp_modules ORDER BY name');
        Response::ok([
            'counts' => $counts,
            'recent_pages' => $recentPages,
            'license' => $license,
            'modules' => $modules,
            'health' => ['score' => 100, 'core' => (string)($config['app']['version'] ?? '2.0.0'), 'environment' => 'production'],
        ]);
    }

    if ($action === 'pages.list' && $method === 'GET') {
        Response::ok(['pages' => $db->all(
            'SELECT p.id, p.parent_id, p.slug, p.title, p.excerpt, p.template, p.status, p.published_at, p.created_at, p.updated_at,
                    u.name AS author_name
             FROM byp_pages p LEFT JOIN byp_users u ON u.id = p.author_id ORDER BY p.updated_at DESC'
        )]);
    }

    if ($action === 'pages.create' && $method === 'POST') {
        $title = trim((string)($input['title'] ?? ''));
        $slug = trim((string)($input['slug'] ?? ''));
        if ($title === '' || !preg_match('/^[a-z0-9][a-z0-9\-\/]*$/', $slug)) {
            Response::error('Укажите заголовок и корректный URL', 422);
        }
        $id = $db->insert(
            'INSERT INTO byp_pages (author_id, slug, title, excerpt, content, blocks, template, status, created_at, updated_at)
             VALUES (:author, :slug, :title, :excerpt, :content, :blocks, :template, :status, NOW(), NOW())',
            [
                'author' => $user['id'],
                'slug' => $slug,
                'title' => $title,
                'excerpt' => (string)($input['excerpt'] ?? ''),
                'content' => (string)($input['content'] ?? ''),
                'blocks' => json_encode($input['blocks'] ?? [], JSON_UNESCAPED_UNICODE),
                'template' => (string)($input['template'] ?? 'default'),
                'status' => in_array(($input['status'] ?? ''), ['draft', 'published'], true) ? $input['status'] : 'draft',
            ]
        );
        byp_audit($db, $user, 'page.create', 'page', $id);
        Response::ok(['id' => $id]);
    }

    if ($action === 'pages.update' && $method === 'POST') {
        $id = (int)($input['id'] ?? 0);
        $page = $db->one('SELECT * FROM byp_pages WHERE id = :id', ['id' => $id]);
        if (!$page) {
            Response::error('Страница не найдена', 404);
        }
        $db->execute(
            'INSERT INTO byp_page_revisions (page_id, user_id, snapshot, created_at) VALUES (:page, :user, :snapshot, NOW())',
            ['page' => $id, 'user' => $user['id'], 'snapshot' => json_encode($page, JSON_UNESCAPED_UNICODE)]
        );
        $db->execute(
            'UPDATE byp_pages SET title=:title, slug=:slug, excerpt=:excerpt, content=:content, blocks=:blocks,
             template=:template, status=:status, published_at=IF(:status2="published", COALESCE(published_at,NOW()), published_at),
             updated_at=NOW() WHERE id=:id',
            [
                'title' => trim((string)($input['title'] ?? $page['title'])),
                'slug' => trim((string)($input['slug'] ?? $page['slug'])),
                'excerpt' => (string)($input['excerpt'] ?? $page['excerpt']),
                'content' => (string)($input['content'] ?? $page['content']),
                'blocks' => json_encode($input['blocks'] ?? json_decode((string)$page['blocks'], true) ?? [], JSON_UNESCAPED_UNICODE),
                'template' => (string)($input['template'] ?? $page['template']),
                'status' => (string)($input['status'] ?? $page['status']),
                'status2' => (string)($input['status'] ?? $page['status']),
                'id' => $id,
            ]
        );
        byp_audit($db, $user, 'page.update', 'page', $id);
        Response::ok(['id' => $id]);
    }

    if ($action === 'modules.list' && $method === 'GET') {
        Response::ok(['modules' => $db->all('SELECT id, module_key, name, version, status, manifest, settings, installed_at, updated_at FROM byp_modules ORDER BY name')]);
    }

    if ($action === 'modules.toggle' && $method === 'POST') {
        $key = (string)($input['module_key'] ?? '');
        $status = ($input['status'] ?? '') === 'active' ? 'active' : 'inactive';
        $db->execute('UPDATE byp_modules SET status=:status, updated_at=NOW() WHERE module_key=:key', ['status' => $status, 'key' => $key]);
        byp_audit($db, $user, 'module.toggle', 'module', null, ['module_key' => $key, 'status' => $status]);
        Response::ok();
    }

    if ($action === 'settings.list' && $method === 'GET') {
        Response::ok(['settings' => $db->all('SELECT setting_group, setting_key, setting_value, value_type, is_public, updated_at FROM byp_settings ORDER BY setting_group, setting_key')]);
    }

    if ($action === 'settings.save' && $method === 'POST') {
        $group = preg_replace('/[^a-z0-9_\-]/', '', (string)($input['group'] ?? 'general'));
        $key = preg_replace('/[^a-z0-9_\-\.]/', '', (string)($input['key'] ?? ''));
        if ($key === '') {
            Response::error('Не указан ключ настройки', 422);
        }
        $db->execute(
            'INSERT INTO byp_settings (setting_group, setting_key, setting_value, value_type, is_public, updated_by, updated_at)
             VALUES (:group_name, :key_name, :value_data, :value_type, :public_flag, :user_id, NOW())
             ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), value_type=VALUES(value_type),
             is_public=VALUES(is_public), updated_by=VALUES(updated_by), updated_at=NOW()',
            [
                'group_name' => $group,
                'key_name' => $key,
                'value_data' => is_scalar($input['value'] ?? null) ? (string)$input['value'] : json_encode($input['value'], JSON_UNESCAPED_UNICODE),
                'value_type' => (string)($input['type'] ?? 'string'),
                'public_flag' => !empty($input['is_public']) ? 1 : 0,
                'user_id' => $user['id'],
            ]
        );
        byp_audit($db, $user, 'setting.save', 'setting', null, ['group' => $group, 'key' => $key]);
        Response::ok();
    }

    if ($action === 'audit.list' && $method === 'GET') {
        Response::ok(['events' => $db->all(
            'SELECT a.id, a.action, a.entity_type, a.entity_id, a.ip_address, a.metadata, a.created_at, u.name AS user_name
             FROM byp_audit_logs a LEFT JOIN byp_users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100'
        )]);
    }

    Response::error('Маршрут API не найден', 404);
} catch (Throwable $error) {
    error_log('[BYPCMS] ' . $error->getMessage());
    Response::error('Внутренняя ошибка BYPCMS', 500, !empty($config['app']['debug']) ? ['message' => $error->getMessage()] : []);
}
