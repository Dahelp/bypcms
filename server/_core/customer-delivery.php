<?php
declare(strict_types=1);
require_once __DIR__.'/LicenseAuthority.php';
$db->execute('CREATE TABLE IF NOT EXISTS byp_customer_deliveries (order_id INT UNSIGNED PRIMARY KEY,key_hash CHAR(64) NOT NULL UNIQUE,key_cipher TEXT NOT NULL,archive_path TEXT NOT NULL,confirmed_by INT UNSIGNED NOT NULL,confirmed_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
function customer_key_crypt(string $value, string $secret, bool $decrypt=false): string {
    $key=hash('sha256',$secret,true);
    if($decrypt){$bytes=base64_decode($value,true);if($bytes===false||strlen($bytes)<29)throw new RuntimeException('Ключ повреждён');$plain=openssl_decrypt(substr($bytes,28),'aes-256-gcm',$key,OPENSSL_RAW_DATA,substr($bytes,0,12),substr($bytes,12,16));if($plain===false)throw new RuntimeException('Ключ недоступен');return $plain;}
    $iv=random_bytes(12);$tag='';$cipher=openssl_encrypt($value,'aes-256-gcm',$key,OPENSSL_RAW_DATA,$iv,$tag);if($cipher===false)throw new RuntimeException('Не удалось защитить ключ');return base64_encode($iv.$tag.$cipher);
}
/** Called while the order is locked; register the same previously issued key on retries. */
function customer_license_register($db,array $config,array $order,array $delivery): int {
    $existing=$db->one('SELECT license_id FROM byp_license_order_links WHERE order_id=?',[$order['id']]);
    if($existing)return (int)$existing['license_id'];
    $plain=customer_key_crypt($delivery['key_cipher'],$config['app']['key'],true);
    $customer=$db->one('SELECT name,email FROM byp_customer_accounts WHERE id=?',[$order['customer_id']]);
    $client=$db->one('SELECT id FROM byp_clients WHERE email=? ORDER BY id LIMIT 1',[$customer['email']]);
    $clientId=$client?(int)$client['id']:$db->insert('INSERT INTO byp_clients(name,email,status,created_at,updated_at) VALUES(?,?,"active",NOW(),NOW())',[$customer['name'],$customer['email']]);
    $term=$order['license_term']==='lifetime'?'lifetime':'annual';
    $until=$term==='lifetime'?null:\BYPCMS\Core\LicensePolicy::renew(null,strtotime($delivery['confirmed_at'].' UTC'));
    $id=$db->insert('INSERT INTO byp_license_registry(client_id,license_key_hash,license_hint,domain,edition,license_term,purchase_price,core_version,installed_version,entitlements,status,activated_at,valid_until,created_at,updated_at) VALUES(?,?,?,?,?,?,0,?,"",?,"active",NULL,?,NOW(),NOW())',[$clientId,hash('sha256',$plain),substr($plain,0,12).'••••',\BYPCMS\Core\LicensePolicy::domain($order['domain']),ucfirst($order['edition']),$term,$config['app']['version']??'2.1.0',$order['modules'],$until]);
    (new \BYPCMS\Core\LicenseAuthority($db->pdo(),BYPCMS_STORAGE,$config))->storeKey($id,$plain);
    $db->execute('INSERT INTO byp_license_order_links(order_id,license_id) VALUES(?,?)',[$order['id'],$id]);
    return $id;
}
function customer_license_prepare($db,array $config,array $purchase): void {
    $db->pdo()->beginTransaction();
    try {
        $order=$db->one('SELECT * FROM byp_customer_orders WHERE id=? FOR UPDATE',[$purchase['id']]);
        customer_license_register($db,$config,$order,$purchase);$db->pdo()->commit();
    } catch(Throwable $error){if($db->pdo()->inTransaction())$db->pdo()->rollBack();throw $error;}
}
function customer_package_trust($db,array $config,string $path): void {
    $lock=fopen($path.'.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('Архив временно занят');
    $temporary=$path.'.tmp';
    try {
        $trust=(new \BYPCMS\Core\LicenseAuthority($db->pdo(),BYPCMS_STORAGE,$config))->trust();
        $current=new ZipArchive();
        if($current->open($path)===true){$existing=json_decode((string)$current->getFromName('site/_core/license-trust.json'),true);$current->close();if($existing===$trust)return;}
        if(!copy($path,$temporary))throw new RuntimeException('Не удалось подготовить архив');
        $zip=new ZipArchive();if($zip->open($temporary)!==true)throw new RuntimeException('Архив недоступен');
        $zip->addFromString('site/_core/license-trust.json',json_encode($trust,JSON_THROW_ON_ERROR|JSON_PRETTY_PRINT));
        if(!$zip->close()||!rename($temporary,$path))throw new RuntimeException('Не удалось обновить пакет');
    } finally {if(is_file($temporary))unlink($temporary);flock($lock,LOCK_UN);fclose($lock);}
}
function customer_fulfill($db,array $config,int $id,int $owner): void {
    if(!class_exists('ZipArchive'))throw new RuntimeException('Требуется PHP zip');
    $pdo=$db->pdo();$pdo->beginTransaction();$archive=null;
    try{
        $order=$db->one('SELECT * FROM byp_customer_orders WHERE id=:id FOR UPDATE',['id'=>$id]);
        if(!$order)throw new RuntimeException('Заказ не найден');
        if($delivery=$db->one('SELECT * FROM byp_customer_deliveries WHERE order_id=:id',['id'=>$id])){customer_license_register($db,$config,$order,$delivery);$pdo->commit();return;}
        if($order['status']!=='pending')throw new RuntimeException('Статус не позволяет подтверждение');
        $directory=BYPCMS_STORAGE.'/customer-packages';if(!is_dir($directory)&&!mkdir($directory,0750,true))throw new RuntimeException('Нет каталога пакетов');
        $archive=$directory.'/'.bin2hex(random_bytes(20)).'.zip';$zip=new ZipArchive();if($zip->open($archive,ZipArchive::CREATE)!==true)throw new RuntimeException('Архив не создан');
        $root=realpath(BYPCMS_ROOT);
        foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS)) as $file){if(!$file->isFile()||$file->isLink())continue;$relative=str_replace('\\','/',substr($file->getPathname(),strlen($root)+1));$first=explode('/',$relative)[0];if(!in_array($first,['_core','api','install','admin','_next','themes'],true))continue;if(str_contains($relative,'.env')||str_ends_with($relative,'.log'))continue;$zip->addFile($file->getPathname(),'site/'.$relative);}
        $zip->addFromString('site/index.php',"<?php require __DIR__.'/_core/client-front.php';");
        $zip->addFromString('site/.htaccess',"DirectoryIndex index.php index.html\nOptions -Indexes\nRewriteEngine On\nRewriteRule ^(?:_core|_storage|_private)(?:/|$) - [F,L]\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule ^ index.php [L,QSA]\n");
        $manifest=['product'=>'BYPCMS','edition'=>$order['edition'],'modules'=>json_decode($order['modules'],true),'license_term'=>$order['license_term'],'domain'=>$order['domain'],'order_id'=>$id,'core_version'=>$config['app']['version']??'2.1.0'];
        $zip->addFromString('site/build-manifest.json',json_encode($manifest,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
        $zip->addFromString('site/_core/license-trust.json',json_encode((new \BYPCMS\Core\LicenseAuthority($pdo,BYPCMS_STORAGE,$config))->trust(),JSON_THROW_ON_ERROR|JSON_PRETTY_PRINT));
        $zip->addFromString('README.txt',"TEST PURCHASE — not production-certified. Upload site/ contents; open /install/. Use a new empty database. Create the admin password in installer. Then open /admin/?section=license and activate the purchase key on the licensed HTTPS domain.\n");
        if(!$zip->close())throw new RuntimeException('Ошибка записи ZIP');
        $plain='BYP-'.strtoupper(bin2hex(random_bytes(24)));
        $db->execute('INSERT INTO byp_customer_deliveries (order_id,key_hash,key_cipher,archive_path,confirmed_by,confirmed_at) VALUES (:id,:hash,:cipher,:path,:owner,NOW())',['id'=>$id,'hash'=>hash('sha256',$plain),'cipher'=>customer_key_crypt($plain,$config['app']['key']),'path'=>$archive,'owner'=>$owner]);
        customer_license_register($db,$config,$order,$db->one('SELECT * FROM byp_customer_deliveries WHERE order_id=?',[$id]));
        $db->execute('UPDATE byp_customer_orders SET status="test_confirmed" WHERE id=:id',['id'=>$id]);$pdo->commit();
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();if($archive&&is_file($archive))unlink($archive);throw $error;}
}
