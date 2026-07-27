<?php
declare(strict_types=1);

use BYPCMS\Core\Auth;
use BYPCMS\Core\Database;
use BYPCMS\Core\Response;

require_once __DIR__ . '/Response.php';
require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/Auth.php';

const BYPCMS_ROOT = __DIR__ . '/..';
const BYPCMS_STORAGE = BYPCMS_ROOT . '/_storage';
const BYPCMS_CONFIG = BYPCMS_STORAGE . '/config.php';

function byp_config(): array
{
    if (!is_file(BYPCMS_CONFIG)) {
        Response::error('BYPCMS ещё не установлена', 503, ['install_url' => '/install/']);
    }
    $config = require BYPCMS_CONFIG;
    if (!is_array($config)) {
        Response::error('Некорректная конфигурация BYPCMS', 500);
    }
    return $config;
}

function byp_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return $_POST;
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function byp_audit(Database $db, ?array $user, string $action, string $entityType, ?int $entityId = null, array $meta = []): void
{
    $db->execute(
        'INSERT INTO byp_audit_logs (user_id, action, entity_type, entity_id, ip_address, user_agent, metadata, created_at)
         VALUES (:user_id, :action, :entity_type, :entity_id, :ip, :agent, :metadata, NOW())',
        [
            'user_id' => $user['id'] ?? null,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'ip' => substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45),
            'agent' => substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
            'metadata' => json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]
    );
}

$secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_name('bypcms_session');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $secure,
    'httponly' => true,
    'samesite' => 'Lax',
]);
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');

$config = byp_config();
$db = new Database($config);
$auth = new Auth($db);

$platformMarker = BYPCMS_STORAGE . '/platform-schema-v2.lock';
if (!is_file($platformMarker)) {
    foreach (require __DIR__ . '/platform_schema.php' as $statement) {
        $db->execute($statement);
    }
    @file_put_contents($platformMarker, date(DATE_ATOM));
}

if (random_int(1, 100) === 1) {
    $db->execute('DELETE FROM byp_demo_sessions WHERE expires_at < NOW()');
}
