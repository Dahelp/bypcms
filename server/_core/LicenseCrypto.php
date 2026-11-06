<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use RuntimeException;

final class LicenseCrypto
{
    public static function encrypt(string $plain, string $secret): string
    {
        $iv = random_bytes(12); $tag = '';
        $cipher = openssl_encrypt($plain, 'aes-256-gcm', hash('sha256', $secret, true), OPENSSL_RAW_DATA, $iv, $tag);
        if ($cipher === false) throw new RuntimeException('Не удалось защитить ключ.');
        return base64_encode($iv . $tag . $cipher);
    }
    public static function decrypt(string $cipher, string $secret): string
    {
        $bytes = base64_decode($cipher, true);
        if ($bytes === false || strlen($bytes) < 29) throw new RuntimeException('Ключ повреждён.');
        $plain = openssl_decrypt(substr($bytes, 28), 'aes-256-gcm', hash('sha256', $secret, true), OPENSSL_RAW_DATA, substr($bytes, 0, 12), substr($bytes, 12, 16));
        if ($plain === false) throw new RuntimeException('Не удалось прочитать ключ.');
        return $plain;
    }
    private static function encode(string $value): string { return rtrim(strtr(base64_encode($value), '+/', '-_'), '='); }
    private static function decode(string $value): string
    {
        if (!preg_match('/^[a-zA-Z0-9_-]+$/D', $value) || strlen($value) > 32000) throw new RuntimeException('Некорректная подпись лицензии.');
        $decoded = base64_decode(strtr($value, '-_', '+/'), true);
        if ($decoded === false) throw new RuntimeException('Некорректная подпись лицензии.');
        return $decoded;
    }
    public static function sign(array $claims, string $privateKey, string $publicKey): array
    {
        $payload = self::encode(json_encode($claims, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $kid = hash('sha256', $publicKey);
        if (!openssl_sign("bypcms.license/v1\n$kid\n$payload", $signature, $privateKey, OPENSSL_ALGO_SHA256)) throw new RuntimeException('Не удалось подписать лицензию.');
        return ['schema' => 'bypcms.license/v1', 'algorithm' => 'RS256', 'key_id' => $kid, 'payload' => $payload, 'signature' => self::encode($signature)];
    }
    public static function verify(array $envelope, string $publicKey, string $installation, string $domain, string $edition, int $now): array
    {
        $kid = hash('sha256', $publicKey);
        if (($envelope['schema'] ?? '') !== 'bypcms.license/v1' || ($envelope['algorithm'] ?? '') !== 'RS256' || ($envelope['key_id'] ?? '') !== $kid || !is_string($envelope['payload'] ?? null) || !is_string($envelope['signature'] ?? null)) throw new RuntimeException('Подпись лицензии не подтверждена.');
        $key = openssl_pkey_get_public($publicKey); $details = $key ? openssl_pkey_get_details($key) : false;
        if (!$details || $details['type'] !== OPENSSL_KEYTYPE_RSA || $details['bits'] < 2048 || openssl_verify("bypcms.license/v1\n$kid\n{$envelope['payload']}", self::decode($envelope['signature']), $key, OPENSSL_ALGO_SHA256) !== 1) throw new RuntimeException('Подпись лицензии не подтверждена.');
        $claims = json_decode(self::decode($envelope['payload']), true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($claims) || ($claims['installation_id'] ?? '') !== $installation || ($claims['domain'] ?? '') !== $domain || ($claims['edition'] ?? '') !== strtolower($edition)) throw new RuntimeException('Лицензия предназначена для другой установки, редакции или домена.');
        foreach (['issued_at','lease_until','offline_until','license_id','activation_id'] as $field) if (!is_int($claims[$field] ?? null)) throw new RuntimeException('Некорректное подтверждение лицензии.');
        if ($claims['issued_at'] > $now + 300 || $claims['lease_until'] <= $claims['issued_at'] || $claims['lease_until'] > $claims['issued_at'] + 86400 || $claims['offline_until'] < $claims['lease_until'] || $claims['offline_until'] > $claims['issued_at'] + 604800 || !in_array($claims['license_term'] ?? '', ['annual','lifetime'], true) || !array_key_exists('updates_until', $claims) || ($claims['updates_until'] !== null && !is_int($claims['updates_until'])) || !is_array($claims['entitlements'] ?? null) || !array_is_list($claims['entitlements']) || array_filter($claims['entitlements'], fn($key) => !is_string($key) || !preg_match('/^[a-z0-9_-]{1,120}$/D', $key))) throw new RuntimeException('Некорректное подтверждение лицензии.');
        if ($claims['license_id'] < 1 || $claims['activation_id'] < 1 || !is_string($claims['generation']??null) || !preg_match('/^[a-f0-9]{32}$/D', $claims['generation']) || !in_array($claims['status'] ?? '', ['active','renewal','trial','expired','suspended'],true) || ($claims['license_term'] === 'annual' && $claims['updates_until'] === null) || ($claims['license_term'] === 'lifetime' && $claims['updates_until'] !== null)) throw new RuntimeException('Некорректные условия лицензии.');
        return $claims;
    }
}
