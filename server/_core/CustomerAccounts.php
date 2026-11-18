<?php
declare(strict_types=1);
namespace BYPCMS\Core;

/** Customer authentication is independent of staff accounts and purchased rights. */
final class CustomerAccounts {
    public static function schema(Database $db,string $root):void {
        $marker=$root.'/_storage/customer-recovery-v1.lock';
        if(is_file($marker))return;
        $lock=fopen($marker.'.mutex','c');
        if(!$lock||!flock($lock,LOCK_EX))throw new \RuntimeException('Не удалось подготовить восстановление доступа.');
        try {
            if(is_file($marker))return;
            $db->execute('CREATE TABLE IF NOT EXISTS byp_customer_security (customer_id INT UNSIGNED PRIMARY KEY,session_version CHAR(32) NOT NULL,password_changed_at BIGINT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
            $db->execute('CREATE TABLE IF NOT EXISTS byp_customer_password_resets (id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,customer_id INT UNSIGNED NOT NULL,token_hash CHAR(64) NOT NULL UNIQUE,mail_id BIGINT UNSIGNED NOT NULL UNIQUE,payload_cipher TEXT NULL,next_url VARCHAR(2500) NOT NULL,created_at BIGINT NOT NULL,expires_at BIGINT NOT NULL,used_at BIGINT NULL,INDEX(customer_id,created_at),INDEX(expires_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
            if(file_put_contents($marker,date(DATE_ATOM),LOCK_EX)===false)throw new \RuntimeException('Не удалось завершить подготовку восстановления.');
        } finally {flock($lock,LOCK_UN);fclose($lock);}
    }
    public static function returnTo(string $next):string {
        return strlen($next)>2500||strpbrk($next,"\r\n\0\\")!==false||!preg_match('~^/(?:order/?|account/(?:(?:order|purchase)\.php)?)(?:\?[^#]*)?$~D',$next)?'/account/':$next;
    }
    /** Existing sessions remain valid until the first password reset; no staff session is revoked. */
    public static function validateSession(Database $db,string $root):void {
        if(empty($_SESSION['customer_id']))return;
        self::schema($db,$root);
        $row=$db->one('SELECT c.id,COALESCE(s.session_version,"") AS session_version FROM byp_customer_accounts c LEFT JOIN byp_customer_security s ON s.customer_id=c.id WHERE c.id=?',[(int)$_SESSION['customer_id']]);
        if(!$row||!hash_equals($row['session_version'],(string)($_SESSION['customer_version']??''))){
            unset($_SESSION['customer_id'],$_SESSION['customer_version']);
            $_SESSION['customer_csrf']=bin2hex(random_bytes(32));
            $_SESSION['customer_notice']='Пароль изменён. Войдите снова, чтобы открыть свои покупки.';
            session_regenerate_id(true);
        }
    }
    public static function login(Database $db,string $root,string $email,string $password):?array {
        self::schema($db,$root);
        $row=$db->one('SELECT c.id,c.password_hash,COALESCE(s.session_version,"") AS session_version FROM byp_customer_accounts c LEFT JOIN byp_customer_security s ON s.customer_id=c.id WHERE c.email=?',[$email]);
        if(!$row||!password_verify($password,$row['password_hash']))return null;
        return $row;
    }
    public static function password(string $password,string $confirmation):void {
        // bcrypt accepts at most 72 bytes; never silently truncate a new password.
        if(mb_strlen($password)<12||strlen($password)>72||str_contains($password,"\0"))throw new \InvalidArgumentException('Используйте пароль от 12 символов. Если он слишком длинный, сократите его.');
        if(!hash_equals($password,$confirmation))throw new \InvalidArgumentException('Пароли не совпадают. Введите их ещё раз.');
    }
}
