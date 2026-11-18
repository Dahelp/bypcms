<?php
declare(strict_types=1);
require_once __DIR__.'/../_core/CustomerRecoveryPage.php';
$rawNext=$_POST['next']??$_GET['next']??'/account/';$next=\BYPCMS\Core\CustomerAccounts::returnTo(is_string($rawNext)?$rawNext:'/account/');
$email=is_string($_POST['email']??null)?$_POST['email']:'';
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
    $start=hrtime(true);
    try {
        if(!is_string($_POST['csrf']??null)||!hash_equals($_SESSION['customer_recovery_csrf'],$_POST['csrf'])){http_response_code(403);throw new InvalidArgumentException('Сессия формы истекла. Повторите запрос с этой страницы.');}
        $recovery->request($email,(string)($_SERVER['REMOTE_ADDR']??''),$next);
        $_SESSION['customer_recovery_sent']=true;
        // Same redirect and message for known, unknown and address-throttled requests.
        header('Location: /account/forgot.php?sent=1&next='.rawurlencode($next),true,303);
    }catch(Throwable $exception){
        if(http_response_code()<400)http_response_code($exception instanceof PDOException?503:422);
        $error=$exception instanceof PDOException?'Не удалось отправить запрос. Повторите позже или обратитесь в поддержку.':($exception instanceof InvalidArgumentException||$exception instanceof RuntimeException?$exception->getMessage():'Не удалось отправить запрос. Повторите позже.');
    }finally {
        // No synchronous SMTP; pad both account paths to avoid the normal lookup timing difference.
        $remaining=250000+random_int(0,40000)-(int)((hrtime(true)-$start)/1000);
        if($remaining>0)usleep($remaining);
    }
    if(!$error)exit;
}
$sent=isset($_GET['sent'])&&!empty($_SESSION['customer_recovery_sent']);
ob_start();
if($sent):?><p class="notice" role="status"><?= $e(\BYPCMS\Core\CustomerRecovery::RESPONSE) ?></p><p>Ссылка действует 30 минут. Новый запрос не меняет пароль и не закрывает покупки.</p><?php endif ?>
<p>Укажите email, с которым вы покупали BYPCMS. Мы отправим одноразовую ссылку.</p>
<form method="post" action="/account/forgot.php"><input type="hidden" name="csrf" value="<?= $e($_SESSION['customer_recovery_csrf']) ?>"><input type="hidden" name="next" value="<?= $e($next) ?>"><label>Email<input name="email" type="email" autocomplete="email" required maxlength="190" value="<?= $e($email) ?>"></label><button>Отправить ссылку</button></form>
<p><a href="/account/?next=<?= $e(rawurlencode($next)) ?>">Вернуться ко входу</a></p><p>Не получается восстановить доступ? <a href="/contacts/">Связаться с поддержкой</a>.</p>
<?php customer_recovery_page('Восстановление пароля',(string)ob_get_clean(),$error);
