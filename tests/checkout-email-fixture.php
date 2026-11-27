<?php
declare(strict_types=1);

// Separate loopback database and TLS mail sink. No fixture route is served by PHP.
$root=realpath(__DIR__.'/../outputs/checkout-email/site');
$comparison=realpath(__DIR__.'/../outputs/edition-comparison/site');
if (!$root || !$comparison) throw new RuntimeException('Prepare the two loopback fixture directories first.');
define('BYPCMS_ROOT',$root);
define('BYPCMS_STORAGE',$root.'/_storage');
require_once __DIR__.'/../server/_core/Database.php';
require_once __DIR__.'/../server/_core/CommerceOrders.php';
use BYPCMS\Core\{CommerceOrders,Database};

$mode=$argv[1]??'';
if ($mode==='setup') {
    $baseline=require $comparison.'/_storage/config.php';
    if ($baseline['database']['host']!=='127.0.0.1'||$baseline['database']['port']!==3331||$baseline['database']['name']!=='bypcms_comparison_20261126') {
        throw new RuntimeException('Expected a disposable comparison database connection.');
    }
    $certificate=realpath($argv[2]??'');
    if (!$certificate) throw new RuntimeException('Provide a local TLS mail sink certificate.');
    $config=[
        'app'=>[
            'name'=>'BYPCMS Checkout Email QA','url'=>'http://127.0.0.1:8032',
            'key'=>bin2hex(random_bytes(32)),'debug'=>true,'installation_type'=>'platform',
            'version'=>'2.8.1','timezone'=>'Europe/Moscow',
        ],
        'database'=>array_replace($baseline['database'],['name'=>'bypcms_checkout_email_qa']),
        'updates'=>['private_dir'=>dirname($root).'/private'],
        'commerce'=>['test_smtp'=>['host'=>'127.0.0.1','port'=>8465,'ca_file'=>$certificate]],
    ];
    $admin=new PDO('mysql:host=127.0.0.1;port=3331;charset=utf8mb4',$config['database']['username'],$config['database']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $admin->exec('CREATE DATABASE IF NOT EXISTS bypcms_checkout_email_qa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    file_put_contents(BYPCMS_STORAGE.'/config.php','<?php return '.var_export($config,true).';');
}
$config=require BYPCMS_STORAGE.'/config.php';
if ($config['database']['host']!=='127.0.0.1'||$config['database']['port']!==3331||$config['database']['name']!=='bypcms_checkout_email_qa'
    ||$config['app']['url']!=='http://127.0.0.1:8032'||empty($config['app']['debug'])||($config['commerce']['test_smtp']['host']??'')!=='127.0.0.1') {
    throw new RuntimeException('Isolated checkout email fixture only.');
}
$db=new Database($config);
if ($mode==='setup') {
    foreach (require __DIR__.'/../server/_core/schema.php' as $sql) $db->execute($sql);
    foreach (require __DIR__.'/../server/_core/platform_schema.php' as $sql) $db->execute($sql);
    $db->execute('INSERT IGNORE INTO byp_roles(slug,name,permissions,created_at,updated_at) VALUES("owner","QA owner","[]",NOW(),NOW())');
    $role=$db->one('SELECT id FROM byp_roles WHERE slug="owner"')['id'];
    $db->execute('INSERT INTO byp_users(role_id,email,password_hash,name,status,created_at,updated_at)
        VALUES(?,?,?,"QA Owner","active",NOW(),NOW()) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)',
        [$role,'checkout-owner@example.test',password_hash('Checkout-Email-QA-2026',PASSWORD_DEFAULT)]);
    (new CommerceOrders($db,$config,$root))->settings->save([
        'payments_enabled'=>false,'smtp_enabled'=>true,'smtp_host'=>'smtp.example.test','smtp_security'=>'ssl','smtp_port'=>465,
        'smtp_user'=>'qa-smtp-user','smtp_password'=>'qa-smtp-password','from_email'=>'sender@example.test','owner_email'=>'checkout-owner@example.test',
    ],$db);
    echo "Checkout email fixture ready\n";
    exit;
}
if ($mode==='clear-rates') {
    $db->execute('DELETE FROM byp_license_requests');
    exit;
}
if ($mode==='mail-cooldown' || $mode==='expire') {
    $operation=$argv[2]??'';
    if (!preg_match('/^[a-f0-9]{32}$/D',$operation)) throw new RuntimeException('Invalid fixture operation.');
    if ($mode==='expire') $db->execute('UPDATE byp_checkout_email_codes SET expires_at=? WHERE operation_id=?', [time()-1,$operation]);
    else $db->execute('UPDATE byp_checkout_email_codes SET sent_at=? WHERE operation_id=?', [time()-61,$operation]);
    exit;
}
throw new RuntimeException('Unknown fixture operation.');
