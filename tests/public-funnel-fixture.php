<?php
declare(strict_types=1);
// Deliberately disposable, loopback-only database; never accepts production config.
$site=realpath($argv[1]??'');$mode=$argv[2]??'';
if(!$site||!str_ends_with(str_replace('\\','/',$site),'/outputs/edition-comparison/site'))throw new RuntimeException('Explicit comparison fixture required');
$configFile=$site.'/_storage/config.php';
if($mode==='setup'){
    $config=['app'=>['name'=>'BYPCMS Comparison QA','url'=>'http://127.0.0.1:8030','key'=>bin2hex(random_bytes(32)),'debug'=>true,'installation_type'=>'platform','version'=>'2.8.1','timezone'=>'Europe/Moscow'],
        'database'=>['host'=>'127.0.0.1','port'=>3331,'name'=>'bypcms_comparison_20261126','username'=>'root','password'=>'BYPCMS-Comparison-QA-2026','charset'=>'utf8mb4'],
        'updates'=>['private_dir'=>dirname($site).'/private']];
    if(!is_dir(dirname($configFile)))mkdir(dirname($configFile),0750,true);
    file_put_contents($configFile,'<?php return '.var_export($config,true).';');
}
$config=require $configFile;
if(($config['database']['host']??'')!=='127.0.0.1'||($config['database']['port']??0)!==3331||($config['database']['name']??'')!=='bypcms_comparison_20261126'||($config['app']['url']??'')!=='http://127.0.0.1:8030'||empty($config['app']['debug']))throw new RuntimeException('Comparison loopback fixture only');
require_once __DIR__.'/../server/_core/Database.php';
require_once __DIR__.'/../server/_core/PublicFunnel.php';
if($mode==='setup'){
    $admin=new PDO('mysql:host=127.0.0.1;port=3331;charset=utf8mb4','root',$config['database']['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
    $admin->exec('CREATE DATABASE IF NOT EXISTS bypcms_comparison_20261126 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
}
$db=new BYPCMS\Core\Database($config);
if($mode==='setup'){
    foreach(require __DIR__.'/../server/_core/schema.php' as $sql)$db->execute($sql);
    foreach(require __DIR__.'/../server/_core/platform_schema.php' as $sql)$db->execute($sql);
    foreach(['owner','editor']as $role){
        $db->execute('INSERT IGNORE INTO byp_roles(slug,name,permissions,created_at,updated_at) VALUES(?,?,"[]",NOW(),NOW())',[$role,'QA '.$role]);
        $id=$db->one('SELECT id FROM byp_roles WHERE slug=?',[$role])['id'];
        $db->execute('INSERT INTO byp_users(role_id,email,password_hash,name,status,created_at,updated_at) VALUES(?,?,?, ?,"active",NOW(),NOW()) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash),role_id=VALUES(role_id)',[$id,'comparison-'.$role.'@example.test',password_hash('Comparison-QA-2026-password',PASSWORD_DEFAULT),'Comparison QA '.$role]);
    }
    new BYPCMS\Core\PublicFunnel($db);
    echo json_encode(['fixture'=>'ready','origin'=>$config['app']['url']]).PHP_EOL;exit;
}
if($mode==='reset'){$db->execute('DELETE FROM byp_public_funnel_daily');echo "Comparison fixture counters cleared\n";exit;}
if($mode==='inspect'){
    echo json_encode(['columns'=>array_column($db->all('SHOW COLUMNS FROM byp_public_funnel_daily'),'Field'),'rows'=>$db->all('SELECT * FROM byp_public_funnel_daily ORDER BY event_day,event_name,edition')],JSON_UNESCAPED_UNICODE).PHP_EOL;exit;
}
if($mode==='retention'){
    $db->execute('INSERT INTO byp_public_funnel_daily VALUES(DATE_SUB(UTC_DATE(),INTERVAL 90 DAY),"comparison_view","all","annual","ru",500) ON DUPLICATE KEY UPDATE hits=500');
    $db->execute('INSERT INTO byp_public_funnel_daily VALUES(DATE_SUB(UTC_DATE(),INTERVAL 89 DAY),"comparison_view","all","annual","ru",5) ON DUPLICATE KEY UPDATE hits=5');
    $funnel=new BYPCMS\Core\PublicFunnel($db);$funnel->report(90);
    if((int)$db->one('SELECT COUNT(*) n FROM byp_public_funnel_daily WHERE event_day < DATE_SUB(UTC_DATE(),INTERVAL 89 DAY)')['n']!==0)throw new RuntimeException('Expired counts retained');
    if((int)$db->one('SELECT hits FROM byp_public_funnel_daily WHERE event_day=DATE_SUB(UTC_DATE(),INTERVAL 89 DAY)')['hits']!==5)throw new RuntimeException('Boundary day removed');
    echo "90-day retention and inclusive period boundary passed\n";exit;
}
if ($mode === 'age-order') {
    $orderId = filter_var($argv[3] ?? '', FILTER_VALIDATE_INT);
    $order = $db->one('SELECT a.email FROM byp_commerce_orders o
        JOIN byp_customer_accounts a ON a.id=o.customer_id WHERE o.order_id=?', [$orderId]);
    if (!$order || !preg_match('/^funnel-order-[a-f0-9]+@example\.test$/D', $order['email'])) {
        throw new RuntimeException('Only a synthetic funnel order may be aged');
    }
    // Simulate a later confirmation beyond the public-counter retention window.
    $db->execute('UPDATE byp_commerce_orders SET created_at=DATE_SUB(NOW(),INTERVAL 100 DAY) WHERE order_id=?', [$orderId]);
    exit;
}
throw new RuntimeException('Unknown fixture operation');
