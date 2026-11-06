<?php
declare(strict_types=1);
namespace BYPCMS\Core;

use DateTimeImmutable;
use DateTimeZone;
use InvalidArgumentException;

final class LicensePolicy
{
    public static function domain(string $value, bool $local = false): string
    {
        $value = strtolower(rtrim(trim($value), '.'));
        if (str_starts_with($value, 'www.')) $value = substr($value, 4);
        if ($local && in_array($value, ['localhost', '127.0.0.1', '::1'], true)) return $value;
        if (strlen($value) > 190 || !preg_match('/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/D', $value)) throw new InvalidArgumentException('Укажите домен без протокола, порта и пути.');
        return $value;
    }

    public static function site(string $url, bool $local = false): array
    {
        $parts = parse_url(trim($url));
        if (!$parts || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) throw new InvalidArgumentException('Некорректный адрес установки.');
        if (($parts['scheme'] ?? '') !== 'https' && !($local && ($parts['scheme'] ?? '') === 'http')) throw new InvalidArgumentException('Для активации требуется HTTPS.');
        if (!$local && isset($parts['port']) && $parts['port'] !== 443) throw new InvalidArgumentException('Для активации требуется стандартный HTTPS-порт.');
        $path = rtrim($parts['path'] ?? '', '/');
        if ($path !== '' && !preg_match('#^(?:/[a-zA-Z0-9_-]+)+$#D', $path)) throw new InvalidArgumentException('Некорректный путь установки.');
        return ['domain' => self::domain($parts['host'], $local), 'url' => $parts['scheme'] . '://' . strtolower($parts['host']) . (isset($parts['port']) ? ':' . $parts['port'] : '') . $path];
    }

    public static function installation(string $id): string
    {
        if (!preg_match('/^[a-f0-9]{32}$/D', $id)) throw new InvalidArgumentException('Некорректный идентификатор установки.');
        return $id;
    }

    public static function expiry(?string $date): ?int
    {
        if (!$date) return null;
        $date = substr($date, 0, 10);
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, new DateTimeZone('UTC'));
        if (!$parsed || $parsed->format('Y-m-d') !== $date) throw new InvalidArgumentException('Некорректная дата лицензии.');
        return $parsed->setTime(23, 59, 59)->getTimestamp();
    }

    public static function renew(?string $until, int $now): string
    {
        $base = new DateTimeImmutable('@' . max(self::expiry($until) ?? 0, $now));
        $year = (int)$base->format('Y') + 1; $month = (int)$base->format('m');
        $first = $base->setDate($year, $month, 1);
        return $first->setDate($year, $month, min((int)$base->format('d'), (int)$first->format('t')))->format('Y-m-d');
    }

    public static function access(array $claims, int $now): array
    {
        $valid = in_array($claims['status'] ?? '', ['active', 'renewal', 'trial', 'expired'], true);
        $expired = ($claims['status'] ?? '') === 'expired' || ($claims['license_term'] !== 'lifetime' && ($claims['updates_until'] === null || $now > $claims['updates_until']));
        $offline = $now > $claims['offline_until'];
        return ['state' => !$valid ? 'suspended' : ($expired ? 'expired' : ($offline ? 'offline' : ($now > $claims['lease_until'] ? 'grace' : 'active'))),
            'can_update' => $valid && !$expired && !$offline, 'public_site_available' => true];
    }
}
