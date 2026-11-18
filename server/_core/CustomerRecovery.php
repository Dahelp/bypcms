<?php
declare(strict_types=1);
namespace BYPCMS\Core;
require_once __DIR__.'/CustomerAccounts.php';
require_once __DIR__.'/LicenseCrypto.php';

final class CustomerRecovery {
    public const TTL=1800;
    public const RESPONSE='Если для этого email есть кабинет, мы отправим ссылку для смены пароля. Проверьте входящие и спам. Повторный запрос доступен через минуту. Если письма нет, обратитесь в поддержку.';
    public const INVALID='Ссылка недействительна, уже использована или срок её действия истёк. Запросите новую ссылку.';
    public function __construct(private Database $db,private CommerceOrders $commerce,private array $config,private string $root){CustomerAccounts::schema($db,$root);$db->execute('UPDATE byp_customer_password_resets SET payload_cipher=NULL WHERE expires_at<=? AND payload_cipher IS NOT NULL',[time()]);}
    public function request(string $email,string $ip,string $next):void {
        $email=strtolower(trim($email));
        if(!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($email)>190)throw new \InvalidArgumentException('Введите корректный email.');
        $this->commerce->limit('password-request-ip:'.$ip,10,900);
        // Per-address throttling is intentionally silent, including for unknown addresses.
        try{$this->commerce->limit('password-request-email:'.$email,3,3600);}catch(\RuntimeException $e){return;}
        if(!$this->commerce->settings->get()['smtp_enabled'])throw new \RuntimeException('Отправка писем временно недоступна. Повторите позже или обратитесь в поддержку.');
        $origin=rtrim((string)$this->config['app']['url'],'/');
        if(!preg_match('~^https://[^/]+$~D',$origin)&&!(!empty($this->config['app']['debug'])&&$origin==='http://127.0.0.1:8019'))throw new \RuntimeException('Восстановление временно недоступно. Обратитесь в поддержку.');
        $token=bin2hex(random_bytes(32));$now=time();$pdo=$this->db->pdo();$pdo->beginTransaction();
        try {
            $customer=$this->db->one('SELECT id,email FROM byp_customer_accounts WHERE email=? FOR UPDATE',[$email]);
            if(!$customer){$pdo->commit();return;}
            if($this->db->one('SELECT id FROM byp_customer_password_resets WHERE customer_id=? AND created_at>? LIMIT 1',[$customer['id'],$now-60])){$pdo->commit();return;}
            $mail=$this->commerce->notifications->enqueue('password-reset:'.bin2hex(random_bytes(16)),null,$customer['email'],'Восстановление пароля BYPCMS','Защищённое письмо восстановления. Ссылка доступна только получателю и действует 30 минут.',['template_key'=>'customer_password_reset','template_version'=>'1','audience'=>'customer']);
            $url=$origin.'/account/reset.php?token='.$token;
            $message="Вы запросили смену пароля кабинета покупателя BYPCMS.\n\nОткройте ссылку в течение 30 минут:\n".$url."\n\nОна работает один раз. Пароль не изменится, пока вы не зададите новый. Если вы не отправляли запрос, просто проигнорируйте письмо. Никому не пересылайте ссылку.\n\nПоддержка: hello@bypcms.ru";
            $safe=htmlspecialchars($url,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
            $html='<html lang="ru"><meta charset="utf-8"><body><h1>Восстановление пароля BYPCMS</h1><p>Вы запросили смену пароля кабинета покупателя.</p><p><a href="'.$safe.'">Задать новый пароль</a></p><p>Ссылка действует 30 минут и работает один раз. Пароль не изменится до подтверждения. Если вы не отправляли запрос, проигнорируйте письмо. Никому не пересылайте ссылку.</p><p>Поддержка: hello@bypcms.ru</p></body></html>';
            $cipher=LicenseCrypto::encrypt(json_encode(['message'=>$message,'html'=>$html],JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE),$this->config['app']['key']);
            $this->db->execute('INSERT INTO byp_customer_password_resets(customer_id,token_hash,mail_id,payload_cipher,next_url,created_at,expires_at) VALUES(?,?,?,?,?,?,?)',[$customer['id'],hash('sha256',$token),$mail,$cipher,CustomerAccounts::returnTo($next),$now,$now+self::TTL]);
            $pdo->commit();
        }catch(\Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    }
    public function valid(string $token):bool {
        return (bool)$this->record($token);
    }
    private function record(string $token):?array {
        if(!preg_match('/^[a-f0-9]{64}$/D',$token))return null;
        return $this->db->one('SELECT * FROM byp_customer_password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at>?',[hash('sha256',$token),time()]);
    }
    public function reset(string $token,string $password,string $confirmation):string {
        CustomerAccounts::password($password,$confirmation);
        $record=$this->record($token);if(!$record)throw new \InvalidArgumentException(self::INVALID);
        $hash=password_hash($password,PASSWORD_DEFAULT);$pdo=$this->db->pdo();$pdo->beginTransaction();
        try {
            // Same lock order as request(): customer first, reset second. Concurrent links win once.
            $customer=$this->db->one('SELECT id,email FROM byp_customer_accounts WHERE id=? FOR UPDATE',[$record['customer_id']]);
            $record=$this->db->one('SELECT * FROM byp_customer_password_resets WHERE id=? FOR UPDATE',[$record['id']]);
            if(!$customer||$record['used_at']!==null||(int)$record['expires_at']<=time())throw new \InvalidArgumentException(self::INVALID);
            $this->db->execute('UPDATE byp_customer_accounts SET password_hash=? WHERE id=?',[$hash,$customer['id']]);
            $version=bin2hex(random_bytes(16));
            $this->db->execute('INSERT INTO byp_customer_security(customer_id,session_version,password_changed_at) VALUES(?,?,?) ON DUPLICATE KEY UPDATE session_version=VALUES(session_version),password_changed_at=VALUES(password_changed_at)',[$customer['id'],$version,time()]);
            $this->db->execute('UPDATE byp_customer_password_resets SET used_at=?,payload_cipher=NULL WHERE customer_id=? AND used_at IS NULL',[time(),$customer['id']]);
            $text="Пароль кабинета покупателя BYPCMS изменён. Старые сеансы завершены.\n\nВойти: ".rtrim($this->config['app']['url'],'/')."/account/\n\nЕсли пароль изменили не вы, восстановите доступ и напишите hello@bypcms.ru. Заказы и лицензии сохранены.";
            $this->commerce->notifications->enqueue('password-changed:'.$version,null,$customer['email'],'Пароль BYPCMS изменён',$text,['template_key'=>'customer_password_changed','template_version'=>'1','audience'=>'customer']);
            $pdo->commit();return CustomerAccounts::returnTo($record['next_url']);
        }catch(\Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
    }
    /** The outbox and Owner previews never contain a usable reset URL. Decrypt only at send time. */
    public static function mail(Database $db,array $config,array $mail):?array {
        $r=$db->one('SELECT payload_cipher,used_at,expires_at FROM byp_customer_password_resets WHERE mail_id=?',[$mail['id']]);
        if(!$r||$r['used_at']!==null||(int)$r['expires_at']<=time()||!$r['payload_cipher'])return null;
        return json_decode(LicenseCrypto::decrypt($r['payload_cipher'],$config['app']['key']),true,8,JSON_THROW_ON_ERROR);
    }
}
