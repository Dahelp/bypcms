<?php
declare(strict_types=1);

namespace BYPCMS\Core;

final class Auth
{
    public function __construct(private Database $db)
    {
    }

    public function attempt(string $email, string $password): ?array
    {
        $user = $this->db->one(
            'SELECT id, email, password_hash, name, status, role_id FROM byp_users WHERE email = :email LIMIT 1',
            ['email' => mb_strtolower(trim($email))]
        );

        if (!$user || $user['status'] !== 'active' || !password_verify($password, $user['password_hash'])) {
            return null;
        }

        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$user['id'];
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        $this->db->execute(
            'UPDATE byp_users SET last_login_at = NOW(), last_login_ip = :ip WHERE id = :id',
            ['ip' => substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45), 'id' => $user['id']]
        );

        return $this->user();
    }

    public function user(): ?array
    {
        $id = (int)($_SESSION['user_id'] ?? 0);
        if ($id < 1) {
            return null;
        }

        return $this->db->one(
            'SELECT u.id, u.email, u.name, u.status, u.last_login_at, r.slug AS role, r.name AS role_name
             FROM byp_users u LEFT JOIN byp_roles r ON r.id = u.role_id
             WHERE u.id = :id AND u.status = "active" LIMIT 1',
            ['id' => $id]
        );
    }

    public function requireUser(): array
    {
        $user = $this->user();
        if (!$user) {
            Response::error('Требуется авторизация', 401);
        }
        return $user;
    }

    public function verifyCsrf(): void
    {
        $provided = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
        $stored = (string)($_SESSION['csrf'] ?? '');
        if ($stored === '' || !hash_equals($stored, $provided)) {
            Response::error('Недействительный CSRF-токен', 419);
        }
    }

    public function logout(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
    }
}
