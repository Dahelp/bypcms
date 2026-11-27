<?php
declare(strict_types=1);
namespace BYPCMS\Core;

use InvalidArgumentException;
use RuntimeException;
use Throwable;

require_once __DIR__.'/CustomerAccounts.php';
require_once __DIR__.'/LicenseCrypto.php';
require_once __DIR__.'/PublicFunnel.php';

final class CheckoutEmail {
    public const TEMPLATE = 'checkout_email_code';
    private const TTL = 600;
    private const COOLDOWN = 60;
    private const MAX_ATTEMPTS = 5;
    private const INVALID = 'Код недействителен или истёк. Запросите новый код.';

    public function __construct(
        private Database $db,
        private CommerceOrders $commerce,
        private array $config,
        string $root,
    ) {
        CustomerAccounts::schema($db,$root);
        $db->execute('CREATE TABLE IF NOT EXISTS byp_checkout_email_codes (
            operation_id CHAR(32) NOT NULL, browser_key CHAR(64) NOT NULL,
            email VARCHAR(190) NULL, mail_id BIGINT UNSIGNED NULL, code_mac CHAR(64) NULL,
            payload_cipher TEXT NULL, source_json VARCHAR(255) NULL,
            attempts TINYINT UNSIGNED NOT NULL DEFAULT 0, sent_at BIGINT UNSIGNED NULL,
            expires_at BIGINT UNSIGNED NULL, verified_at BIGINT UNSIGNED NULL,
            PRIMARY KEY(operation_id,browser_key), UNIQUE KEY(mail_id), KEY(expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $db->execute('CREATE TABLE IF NOT EXISTS byp_checkout_verified_customers (
            customer_id INT UNSIGNED PRIMARY KEY, verified_at BIGINT UNSIGNED NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    }

    private function row(string $operation, string $browser, bool $lock = false): ?array {
        return $this->db->one('SELECT * FROM byp_checkout_email_codes WHERE operation_id=? AND browser_key=?'
            .($lock ? ' FOR UPDATE' : ''), [$operation,$browser]);
    }

    public function pending(string $operation, string $browser): ?array {
        if (!preg_match('/^[a-f0-9]{32}$/D',$operation)) return null;
        $row = $this->row($operation,$browser);
        if (!$row || !$row['email'] || $row['verified_at'] !== null || (int)$row['expires_at'] <= time()) return null;
        $mail = $this->db->one('SELECT state FROM byp_notification_outbox WHERE id=?', [$row['mail_id']]);
        return self::status($row) + ['delivery_failed'=>in_array($mail['state'] ?? '',['failed','canceled','superseded'],true)];
    }

    private static function status(array $row): array {
        return [
            'email'=>$row['email'],
            'resend_after'=>max(0,(int)$row['sent_at'] + self::COOLDOWN - time()),
            'expires_in'=>max(0,(int)$row['expires_at'] - time()),
            'locked'=>(int)$row['attempts'] >= self::MAX_ATTEMPTS,
        ];
    }

    private function mac(string $operation, string $browser, string $code): string {
        return hash_hmac('sha256','checkout-email:'.$operation.':'.$browser.':'.$code,$this->config['app']['key']);
    }

    public function request(array $input, string $browser, string $ip, ?array $source): ?int {
        CommerceLegal::validate($input,false);
        $operation = LicensePolicy::installation((string)($input['operation_id'] ?? ''));
        $email = strtolower(CommerceSettings::email((string)($input['email'] ?? '')));
        if (!$this->commerce->settings->get()['smtp_enabled']) {
            throw new RuntimeException('Отправка кодов временно недоступна. Войдите через личный кабинет или повторите позже.');
        }
        $this->commerce->limit('checkout-code-request-ip:'.$ip,18,900);
        $this->db->execute('UPDATE byp_checkout_email_codes SET email=NULL,code_mac=NULL,payload_cipher=NULL
            WHERE expires_at<=? AND email IS NOT NULL', [time()]);
        $this->db->execute('DELETE FROM byp_checkout_email_codes WHERE expires_at<=?', [time()-86400]);
        $funnel = $source ? new PublicFunnel($this->db) : null;
        $pdo = $this->db->pdo();
        $pdo->beginTransaction();
        try {
            $this->db->execute('INSERT INTO byp_checkout_email_codes(operation_id,browser_key) VALUES(?,?)
                ON DUPLICATE KEY UPDATE operation_id=operation_id', [$operation,$browser]);
            $row = $this->row($operation,$browser,true);
            $now = time();
            if ($row['email'] === $email && (int)$row['expires_at'] > $now && (int)$row['sent_at'] + self::COOLDOWN > $now) {
                $pdo->commit();
                return null;
            }
            // The rate bucket contains a keyed digest in the database, not the address.
            $this->commerce->limit('checkout-code-request-email:'.$email,5,3600);
            do {
                $code = str_pad((string)random_int(0,999999),6,'0',STR_PAD_LEFT);
                $mac = $this->mac($operation,$browser,$code);
            } while ($row['code_mac'] && hash_equals($row['code_mac'],$mac));
            $en = ($input['locale'] ?? 'ru') === 'en';
            $subject = $en ? 'Your BYPCMS checkout code' : 'Код подтверждения заказа BYPCMS';
            $body = $en
                ? "Your BYPCMS checkout code\n\n$code\n\nIt expires in 10 minutes. Enter it on the checkout page. Keep this code private. If you did not request it, ignore this email."
                : "Ваш код для оформления заказа BYPCMS\n\n$code\n\nОн действует 10 минут. Введите его на странице оформления. Никому не сообщайте код. Если вы его не запрашивали, проигнорируйте письмо.";
            $preview = $en ? 'The one-time code is visible only to the recipient.' : 'Одноразовый код доступен только получателю.';
            $mail = $this->commerce->notifications->enqueue('checkout-code:'.bin2hex(random_bytes(16)),null,$email,$subject,$preview,[
                'template_key'=>self::TEMPLATE,'template_version'=>'1','audience'=>'customer',
            ]);
            $cipher = LicenseCrypto::encrypt($body,$this->config['app']['key']);
            // Fresh code invalidates any previous one, while the first comparison
            // context remains associated with this checkout for valid resends.
            $first = $row['sent_at'] === null;
            $sourceJson = $source ? ($first ? json_encode($source,JSON_THROW_ON_ERROR) : $row['source_json']) : null;
            $this->db->execute('UPDATE byp_checkout_email_codes SET email=?,mail_id=?,code_mac=?,payload_cipher=?,
                source_json=?,attempts=0,sent_at=?,expires_at=?,verified_at=NULL WHERE operation_id=? AND browser_key=?',
                [$email,$mail,$mac,$cipher,$sourceJson,$now,$now+self::TTL,$operation,$browser]);
            if ($first && $funnel) $funnel->recordCheckoutEmail('checkout_email_started',$source);
            $pdo->commit();
            return $mail;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public function verify(array $input, string $browser, string $ip, bool $allowTracking): array {
        CommerceLegal::validate($input,false);
        $operation = LicensePolicy::installation((string)($input['operation_id'] ?? ''));
        $code = (string)($input['code'] ?? '');
        if (!preg_match('/^[0-9]{6}$/D',$code)) throw new InvalidArgumentException('Введите шесть цифр из письма.');
        $this->commerce->limit('checkout-code-verify-ip:'.$ip,45,900);
        $hasSource = $allowTracking && !empty($this->row($operation,$browser)['source_json']);
        $funnel = $hasSource ? new PublicFunnel($this->db) : null;
        $pdo = $this->db->pdo();
        $pdo->beginTransaction();
        try {
            $row = $this->row($operation,$browser,true);
            if (!$row || !$row['email'] || !$row['code_mac'] || $row['verified_at'] !== null
                || (int)$row['expires_at'] <= time() || (int)$row['attempts'] >= self::MAX_ATTEMPTS) {
                throw new InvalidArgumentException(self::INVALID);
            }
            if (!hash_equals($row['code_mac'],$this->mac($operation,$browser,$code))) {
                $attempts = (int)$row['attempts'] + 1;
                $locked = $attempts >= self::MAX_ATTEMPTS;
                $this->db->execute('UPDATE byp_checkout_email_codes SET attempts=?,code_mac=?,payload_cipher=? WHERE operation_id=? AND browser_key=?',
                    [$attempts,$locked ? null : $row['code_mac'],$locked ? null : $row['payload_cipher'],$operation,$browser]);
                $pdo->commit();
                throw new InvalidArgumentException($locked ? self::INVALID : 'Код не совпадает. Проверьте цифры в последнем письме.');
            }
            $identity = CustomerAccounts::verifiedCheckout($this->db,$row['email']);
            $this->db->execute('UPDATE byp_checkout_email_codes SET verified_at=?,email=NULL,code_mac=NULL,payload_cipher=NULL,source_json=NULL
                WHERE operation_id=? AND browser_key=?', [time(),$operation,$browser]);
            if ($funnel && $row['source_json']) {
                $funnel->recordCheckoutEmail('checkout_email_verified',json_decode($row['source_json'],true,8,JSON_THROW_ON_ERROR));
            }
            $pdo->commit();
            return $identity;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
    }

    public static function mail(Database $db, array $config, int $mail): ?array {
        $row = $db->one('SELECT payload_cipher,expires_at FROM byp_checkout_email_codes WHERE mail_id=?', [$mail]);
        if (!$row || !$row['payload_cipher'] || (int)$row['expires_at'] <= time()) return null;
        return ['message'=>LicenseCrypto::decrypt($row['payload_cipher'],$config['app']['key'])];
    }

    public static function activeMail(Database $db, int $mail): bool {
        return (bool)$db->one('SELECT mail_id FROM byp_checkout_email_codes WHERE mail_id=? AND expires_at>? AND code_mac IS NOT NULL', [$mail,time()]);
    }

    public static function clearMail(Database $db, int $mail): void {
        $db->execute('UPDATE byp_checkout_email_codes SET payload_cipher=NULL WHERE mail_id=?', [$mail]);
    }
}
