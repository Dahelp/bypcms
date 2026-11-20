<?php
declare(strict_types=1);
require_once __DIR__.'/../_core/PublicLocale.php';
require_once __DIR__.'/../_core/CustomerRecoveryPage.php';
if(isset($_GET['token'])){
    $token=is_string($_GET['token'])?$_GET['token']:'';
    if(preg_match('/^[a-f0-9]{64}$/D',$token))$_SESSION['customer_reset_token']=$token;
    else unset($_SESSION['customer_reset_token']);
    // Reading/scanning a link does not consume it. Strip it before loading any resources.
    header('Location: /account/reset.php',true,303);exit;
}
$token=(string)($_SESSION['customer_reset_token']??'');
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST')try {
    if(!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['customer_recovery_csrf'],$_POST['csrf'])){http_response_code(403);throw new InvalidArgumentException(public_t('Сессия формы истекла. Введите новый пароль ещё раз.'));}
    if(!is_string($_POST['form_key']??null)||!hash_equals(hash_hmac('sha256',$token,$_SESSION['customer_recovery_csrf']),$_POST['form_key']))throw new InvalidArgumentException(public_t('В другой вкладке открыта другая ссылка. Снова откройте нужное письмо и повторите смену пароля.'));
    $commerce->limit('password-reset-ip:'.($_SERVER['REMOTE_ADDR']??''),20,900);
    $password=is_string($_POST['password']??null)?$_POST['password']:'';
    $confirmation=is_string($_POST['confirmation']??null)?$_POST['confirmation']:'';
    $next=$recovery->reset($token,$password,$confirmation);
    unset($_SESSION['customer_id'],$_SESSION['customer_version'],$_SESSION['customer_reset_token']);
    session_regenerate_id(true);$_SESSION['customer_csrf']=bin2hex(random_bytes(32));$_SESSION['customer_recovery_csrf']=bin2hex(random_bytes(32));
    $_SESSION['customer_notice']=public_t('Пароль изменён. Войдите с новым паролем. Ваши заказы и лицензии сохранены.');
    header('Location: /account/?next='.rawurlencode($next),true,303);exit;
}catch(Throwable $exception){
    if(http_response_code()<400)http_response_code($exception instanceof PDOException?503:422);
    $error=$exception instanceof PDOException?public_t('Не удалось изменить пароль. Повторите позже; ссылка не использована.'):($exception instanceof InvalidArgumentException||$exception instanceof RuntimeException?$exception->getMessage():public_t('Не удалось изменить пароль. Повторите позже.'));
}
$valid=$recovery->valid($token);
ob_start();if($valid):?>
<p><?= public_text('Задайте новый пароль от 12 символов. После сохранения потребуется войти заново. Старые сеансы кабинета будут завершены.') ?></p>
<form method="post" action="/account/reset.php"><input type="hidden" name="csrf" value="<?= $e($_SESSION['customer_recovery_csrf']) ?>"><input type="hidden" name="form_key" value="<?= $e(hash_hmac('sha256',$token,$_SESSION['customer_recovery_csrf'])) ?>"><label><?= public_text('Новый пароль') ?><input name="password" type="password" autocomplete="new-password" required minlength="12" maxlength="72"></label><label><?= public_text('Повторите пароль') ?><input name="confirmation" type="password" autocomplete="new-password" required minlength="12" maxlength="72"></label><button><?= public_text('Сохранить новый пароль') ?></button></form>
<?php else: if(!$error):?><p class="error" role="alert"><?= $e(\BYPCMS\Core\CustomerRecovery::INVALID) ?></p><?php endif;endif ?>
<p><a href="/account/forgot.php"><?= public_text('Запросить новую ссылку') ?></a></p><p><a href="/account/"><?= public_text('Вернуться ко входу') ?></a></p>
<?php customer_recovery_page(public_t('Новый пароль'),(string)ob_get_clean(),$error);
