<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use PDO;
use RuntimeException;
use Throwable;

require_once __DIR__ . '/LicenseCrypto.php';
require_once __DIR__ . '/LicensePolicy.php';
require_once __DIR__ . '/LicenseHttp.php';

final class LicenseAuthority
{
    public function __construct(private PDO $pdo, private string $storage, private array $config, private $audit = null) {
        if (($config['app']['installation_type'] ?? 'platform') === 'client') throw new LicenseException('Эта установка не выпускает лицензии.', 403, 'client_installation');
    }
    private function one(string $sql, array $params): ?array { $query = $this->pdo->prepare($sql); $query->execute($params); return $query->fetch(PDO::FETCH_ASSOC) ?: null; }
    private function execute(string $sql, array $params = []): void { $this->pdo->prepare($sql)->execute($params); }
    private function audit(string $action, int $id, array $meta = []): void { if ($this->audit) ($this->audit)($action, $id, $meta); }
    public function trust(): array
    {
        $path = $this->storage . '/license-authority.pem'; $publicPath = $this->storage . '/license-authority-public.json';
        $lock = fopen($this->storage . '/license-signing.lock', 'c');
        if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException('Не удалось открыть ключ подписи.');
        try {
            if (!is_file($path)) {
                if (is_file($publicPath)) throw new RuntimeException('Ключ подписи отсутствует. Восстановите его из резервной копии.');
                $key = openssl_pkey_new(['private_key_bits' => 3072, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
                if (!$key || !openssl_pkey_export($key, $pem)) throw new RuntimeException('Не удалось создать ключ подписи OpenSSL.');
                $temporary = $path . '.tmp';
                if (file_put_contents($temporary, $pem, LOCK_EX) === false || !rename($temporary, $path)) throw new RuntimeException('Не удалось сохранить ключ подписи.');
                chmod($path, 0600);
            }
            $key = openssl_pkey_get_private((string)file_get_contents($path)); $details = $key ? openssl_pkey_get_details($key) : false;
            if (!$details) throw new RuntimeException('Не удалось прочитать ключ подписи.');
            $trust = ['schema' => 'bypcms.license-trust/v1', 'issuer' => rtrim($this->config['app']['url'], '/') . '/api/index.php', 'key_id' => hash('sha256', $details['key']), 'public_key' => $details['key']];
            if (!is_file($publicPath) && file_put_contents($publicPath, json_encode($trust, JSON_THROW_ON_ERROR), LOCK_EX) === false) throw new RuntimeException('Не удалось сохранить открытый ключ.');
            return $trust;
        } finally { flock($lock, LOCK_UN); fclose($lock); }
    }
    public static function key(): string { return 'BYP-' . strtoupper(bin2hex(random_bytes(24))); }
    public function storeKey(int $id, string $key): void
    {
        $this->execute('INSERT INTO byp_license_secrets(license_id,key_cipher) VALUES(?,?) ON DUPLICATE KEY UPDATE key_cipher=VALUES(key_cipher)', [$id, LicenseCrypto::encrypt($key, $this->config['app']['key'])]);
    }
    public function reveal(int $id): string
    {
        $row = $this->one('SELECT key_cipher FROM byp_license_secrets WHERE license_id=?', [$id]);
        if (!$row) throw new LicenseException('Для старой лицензии ключ не сохранён. Выпустите новый ключ.', 409, 'legacy_key');
        $this->audit('owner.license.reveal', $id);
        return LicenseCrypto::decrypt($row['key_cipher'], $this->config['app']['key']);
    }
    public function operation(int $id, string $action, string $operation, int $user, int $now): array
    {
        if (!preg_match('/^[a-f0-9]{32}$/D', $operation) || !in_array($action, ['renew','release','rotate'], true)) throw new LicenseException('Некорректное действие лицензии.');
        $this->pdo->beginTransaction();
        try {
            $row = $this->one('SELECT * FROM byp_license_registry WHERE id=? FOR UPDATE', [$id]); if (!$row) throw new LicenseException('Лицензия не найдена.', 404);
            $previous = $this->one('SELECT * FROM byp_license_operations WHERE operation_id=?', [$operation]);
            if ($previous) { if ((int)$previous['license_id'] !== $id || $previous['action'] !== $action || (int)$previous['user_id'] !== $user) throw new LicenseException('Идентификатор действия уже использован.', 409); $this->pdo->commit(); return json_decode($previous['result_json'], true, 16, JSON_THROW_ON_ERROR); }
            if ($action === 'renew') {
                if ($row['license_term'] === 'lifetime') throw new LicenseException('Пожизненная лицензия не требует продления.');
                $until = LicensePolicy::renew($row['valid_until'], $now);
                $this->execute('UPDATE byp_license_registry SET valid_until=?,status=IF(status="suspended",status,"active"),updated_at=UTC_TIMESTAMP() WHERE id=?', [$until, $id]);
                $result = ['id' => $id, 'valid_until' => $until];
            } elseif ($action === 'rotate') {
                $key = self::key();
                $this->execute('UPDATE byp_license_registry SET license_key_hash=?,license_hint=?,updated_at=UTC_TIMESTAMP() WHERE id=?', [hash('sha256',$key),substr($key,0,12).'••••',$id]);
                $this->storeKey($id,$key);
                $result = ['id'=>$id];
            } else {
                $this->execute('UPDATE byp_license_activations SET active=0 WHERE license_id=?', [$id]);
                $this->execute('UPDATE byp_license_registry SET activated_at=NULL,updated_at=UTC_TIMESTAMP() WHERE id=?', [$id]); $result = ['id' => $id];
            }
            $this->execute('INSERT INTO byp_license_operations(operation_id,license_id,action,user_id,result_json) VALUES(?,?,?,?,?)', [$operation,$id,$action,$user,json_encode($result, JSON_THROW_ON_ERROR)]);
            $this->audit('owner.license.' . $action, $id, $result); $this->pdo->commit(); return $result;
        } catch (Throwable $error) { if ($this->pdo->inTransaction()) $this->pdo->rollBack(); throw $error; }
    }
    public function limit(string $ip, int $now): void
    {
        $bucket = hash_hmac('sha256', $ip, $this->config['app']['key']); $window = intdiv($now, 600) * 600;
        $this->execute('INSERT INTO byp_license_requests(bucket,window_start,request_count) VALUES(?,?,1) ON DUPLICATE KEY UPDATE request_count=request_count+1', [$bucket,$window]);
        if ((int)$this->one('SELECT request_count FROM byp_license_requests WHERE bucket=? AND window_start=?',[$bucket,$window])['request_count'] > 60) throw new LicenseException('Слишком много проверок. Повторите позже.',429,'rate_limit');
        if (random_int(1,100) === 1) { $this->execute('DELETE FROM byp_license_requests WHERE window_start<?',[$now-3600]); $this->execute('DELETE FROM byp_license_challenges WHERE expires_at<UTC_TIMESTAMP()'); }
    }
    private function license(string $key): array
    {
        $key = strtoupper(trim($key));
        if (!preg_match('/^BYP-[A-Z0-9-]{10,100}$/D', $key)) throw new LicenseException('Лицензия не найдена.',403,'license_invalid');
        $license = $this->one('SELECT * FROM byp_license_registry WHERE license_key_hash=?', [hash('sha256', $key)]);
        if (!$license) throw new LicenseException('Лицензия не найдена.',403,'license_invalid');
        if (!in_array($license['status'], ['active','renewal','trial','expired'], true)) throw new LicenseException('Лицензия приостановлена.',403,'license_suspended');
        return $license;
    }
    public function challenge(array $input, int $now): array
    {
        $license = $this->license((string)($input['key'] ?? '')); $installation = LicensePolicy::installation((string)($input['installation_id'] ?? ''));
        $site = LicensePolicy::site((string)($input['site_url'] ?? ''), (bool)($this->config['app']['debug'] ?? false));
        if (!$license['domain'] || $site['domain'] !== LicensePolicy::domain($license['domain'], (bool)($this->config['app']['debug'] ?? false))) throw new LicenseException('Домен установки не совпадает с лицензией.',403,'domain_mismatch');
        if (strtolower($license['edition']) !== ($input['edition'] ?? '')) throw new LicenseException('Редакция установки не совпадает с лицензией.',403,'edition_mismatch');
        $active = $this->one('SELECT installation_id FROM byp_license_activations WHERE license_id=? AND active=1', [$license['id']]);
        if ($active && $active['installation_id'] !== $installation) throw new LicenseException('Лицензия уже привязана к другой установке. Освободите привязку в Owner.',409,'activation_conflict');
        $id = bin2hex(random_bytes(16)); $nonce = bin2hex(random_bytes(32));
        $this->execute('INSERT INTO byp_license_challenges(id,license_id,installation_id,site_url,nonce,expires_at) VALUES(?,?,?,?,?,?)', [$id,$license['id'],$installation,$site['url'],$nonce,gmdate('Y-m-d H:i:s',$now+600)]);
        return ['challenge_id' => $id, 'nonce' => $nonce, 'expires_at' => $now+600];
    }
    public function activate(array $input, int $now): array
    {
        $license = $this->license((string)($input['key'] ?? '')); $id = (string)($input['challenge_id'] ?? '');
        if (!preg_match('/^[a-f0-9]{32}$/D', $id)) throw new LicenseException('Некорректная проверка домена.');
        $challenge = $this->one('SELECT * FROM byp_license_challenges WHERE id=? AND license_id=?',[$id,$license['id']]);
        if (!$challenge || (int)$challenge['consumed'] || strtotime($challenge['expires_at'].' UTC') < $now) throw new LicenseException('Проверка домена истекла. Повторите активацию.',409,'challenge_expired');
        $http = new LicenseHttp((bool)($this->config['app']['debug'] ?? false), $this->config['licensing']['test_hosts'] ?? []);
        $proof = $http->request($challenge['site_url'] . '/.well-known/bypcms-activation/' . $id . '.json');
        if (($proof['installation_id'] ?? '') !== $challenge['installation_id'] || !is_string($proof['nonce'] ?? null) || !hash_equals($challenge['nonce'], $proof['nonce'])) throw new LicenseException('Не удалось подтвердить домен установки.',403,'domain_proof_failed');
        $this->trust(); $this->pdo->beginTransaction();
        try {
            $license = $this->one('SELECT * FROM byp_license_registry WHERE id=? FOR UPDATE',[$license['id']]);
            if (!hash_equals($license['license_key_hash'],hash('sha256',strtoupper(trim((string)($input['key']??'')))))) throw new LicenseException('Ключ был перевыпущен. Используйте актуальный ключ.',403,'license_invalid');
            if (!in_array($license['status'],['active','renewal','trial','expired'],true)) throw new LicenseException('Лицензия приостановлена.',403,'license_suspended');
            if (LicensePolicy::domain($license['domain'], (bool)($this->config['app']['debug'] ?? false)) !== LicensePolicy::site($challenge['site_url'], (bool)($this->config['app']['debug'] ?? false))['domain']) throw new LicenseException('Домен лицензии изменён. Повторите проверку.',409,'domain_mismatch');
            $locked = $this->one('SELECT consumed,expires_at FROM byp_license_challenges WHERE id=? FOR UPDATE',[$id]); if ((int)$locked['consumed']) throw new LicenseException('Проверка уже использована.',409,'challenge_consumed');
            if (strtotime($locked['expires_at'].' UTC') < max($now,time())) throw new LicenseException('Проверка домена истекла. Повторите активацию.',409,'challenge_expired');
            $active = $this->one('SELECT * FROM byp_license_activations WHERE license_id=? FOR UPDATE',[$license['id']]);
            if ($active && (int)$active['active'] && $active['installation_id'] !== $challenge['installation_id']) throw new LicenseException('Лицензия уже активирована на другой установке.',409,'activation_conflict');
            $other = $this->one('SELECT * FROM byp_license_activations WHERE installation_id=? FOR UPDATE',[$challenge['installation_id']]);
            if ($other && (int)$other['active'] && (int)$other['license_id'] !== (int)$license['id']) throw new LicenseException('Сначала отключите прежнюю лицензию этой установки.',409,'activation_conflict');
            if ($other && !(int)$other['active']) $this->execute('DELETE FROM byp_license_activations WHERE id=?',[$other['id']]);
            $credential = bin2hex(random_bytes(32)); $generation = bin2hex(random_bytes(16));
            $this->execute('DELETE FROM byp_license_activations WHERE license_id=? AND active=0',[$license['id']]);
            $this->execute('INSERT INTO byp_license_activations(license_id,installation_id,credential_hash,generation,site_url,active,last_seen_at,created_at) VALUES(?,?,?,?,?,1,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE credential_hash=VALUES(credential_hash),generation=VALUES(generation),site_url=VALUES(site_url),active=1,last_seen_at=UTC_TIMESTAMP()',[$license['id'],$challenge['installation_id'],hash('sha256',$credential),$generation,$challenge['site_url']]);
            $activation = $this->one('SELECT * FROM byp_license_activations WHERE license_id=?',[$license['id']]);
            if ($activation['installation_id'] !== $challenge['installation_id']) throw new LicenseException('Установка уже использует другую лицензию.',409,'activation_conflict');
            $this->execute('UPDATE byp_license_challenges SET consumed=1 WHERE id=?',[$id]);
            $this->execute('UPDATE byp_license_registry SET activated_at=COALESCE(activated_at,UTC_TIMESTAMP()),last_seen_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=?',[$license['id']]);
            $receipt = $this->receipt($license, $activation, $now); $this->audit('license.activate',(int)$license['id'],['installation_id'=>$activation['installation_id']]); $this->pdo->commit();
            return ['receipt'=>$receipt,'activation_token'=>$credential];
        } catch (Throwable $error) { if ($this->pdo->inTransaction()) $this->pdo->rollBack(); throw $error; }
    }
    public function check(array $input, int $now, bool $release = false): array
    {
        $installation = LicensePolicy::installation((string)($input['installation_id'] ?? '')); $token = (string)($input['activation_token'] ?? '');
        if (!preg_match('/^[a-f0-9]{64}$/D', $token)) throw new LicenseException('Привязка установки не подтверждена.',403,'activation_revoked');
        $this->trust(); $this->pdo->beginTransaction();
        try {
            $activation = $this->one('SELECT * FROM byp_license_activations WHERE installation_id=? AND active=1 FOR UPDATE',[$installation]);
            if (!$activation || !hash_equals($activation['credential_hash'],hash('sha256',$token))) throw new LicenseException('Привязка установки отозвана. Повторите активацию.',403,'activation_revoked');
            $license = $this->one('SELECT * FROM byp_license_registry WHERE id=?',[$activation['license_id']]);
            if (!$license || (!$release && !in_array($license['status'],['active','renewal','trial','expired'],true))) throw new LicenseException('Лицензия приостановлена.',403,'license_suspended');
            if (!$release && LicensePolicy::domain($license['domain'], (bool)($this->config['app']['debug'] ?? false)) !== LicensePolicy::site($activation['site_url'], (bool)($this->config['app']['debug'] ?? false))['domain']) throw new LicenseException('Домен лицензии изменён.',403,'domain_mismatch');
            $this->execute('UPDATE byp_license_activations SET active=?,last_seen_at=UTC_TIMESTAMP() WHERE id=?',[$release?0:1,$activation['id']]);
            $this->execute('UPDATE byp_license_registry SET last_seen_at=UTC_TIMESTAMP(),activated_at=IF(?=1,NULL,activated_at) WHERE id=?',[$release?1:0,$license['id']]);
            $result = $release ? ['released'=>true] : ['receipt'=>$this->receipt($license,$activation,$now)];
            if ($release) $this->audit('license.release',(int)$license['id'],['installation_id'=>$installation]); $this->pdo->commit(); return $result;
        } catch (Throwable $error) { if ($this->pdo->inTransaction()) $this->pdo->rollBack(); throw $error; }
    }
    private function receipt(array $license, array $activation, int $now): array
    {
        $trust = $this->trust(); $modules = json_decode($license['entitlements'] ?: '[]', true, 16, JSON_THROW_ON_ERROR); sort($modules);
        $claims = ['license_id'=>(int)$license['id'],'activation_id'=>(int)$activation['id'],'installation_id'=>$activation['installation_id'],'generation'=>$activation['generation'],
            'domain'=>LicensePolicy::domain($license['domain'], (bool)($this->config['app']['debug'] ?? false)), 'edition'=>strtolower($license['edition']),'license_term'=>$license['license_term'],
            'status'=>$license['status'],'entitlements'=>$modules,'updates_until'=>$license['license_term']==='lifetime'?null:LicensePolicy::expiry($license['valid_until']),
            'issued_at'=>$now,'lease_until'=>$now+86400,'offline_until'=>$now+604800];
        return LicenseCrypto::sign($claims,(string)file_get_contents($this->storage.'/license-authority.pem'),$trust['public_key']);
    }
}
