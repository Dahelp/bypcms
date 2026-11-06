<?php
declare(strict_types=1);
$db->execute('CREATE TABLE IF NOT EXISTS byp_customer_deliveries (order_id INT UNSIGNED PRIMARY KEY,key_hash CHAR(64) NOT NULL UNIQUE,key_cipher TEXT NOT NULL,archive_path TEXT NOT NULL,confirmed_by INT UNSIGNED NOT NULL,confirmed_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
function customer_key_crypt(string $value, string $secret, bool $decrypt=false): string {
    $key=hash('sha256',$secret,true);
    if($decrypt){$bytes=base64_decode($value,true);if($bytes===false||strlen($bytes)<29)throw new RuntimeException('Ключ повреждён');$plain=openssl_decrypt(substr($bytes,28),'aes-256-gcm',$key,OPENSSL_RAW_DATA,substr($bytes,0,12),substr($bytes,12,16));if($plain===false)throw new RuntimeException('Ключ недоступен');return $plain;}
    $iv=random_bytes(12);$tag='';$cipher=openssl_encrypt($value,'aes-256-gcm',$key,OPENSSL_RAW_DATA,$iv,$tag);if($cipher===false)throw new RuntimeException('Не удалось защитить ключ');return base64_encode($iv.$tag.$cipher);
}
function customer_fulfill($db,array $config,int $id,int $owner): void {
    if(!class_exists('ZipArchive'))throw new RuntimeException('Требуется PHP zip');
    $pdo=$db->pdo();$pdo->beginTransaction();$archive=null;
    try{
        $order=$db->one('SELECT * FROM byp_customer_orders WHERE id=:id FOR UPDATE',['id'=>$id]);
        if(!$order)throw new RuntimeException('Заказ не найден');
        if($db->one('SELECT order_id FROM byp_customer_deliveries WHERE order_id=:id',['id'=>$id])){$pdo->commit();return;}
        if($order['status']!=='pending')throw new RuntimeException('Статус не позволяет подтверждение');
        $directory=BYPCMS_STORAGE.'/customer-packages';if(!is_dir($directory)&&!mkdir($directory,0750,true))throw new RuntimeException('Нет каталога пакетов');
        $archive=$directory.'/'.bin2hex(random_bytes(20)).'.zip';$zip=new ZipArchive();if($zip->open($archive,ZipArchive::CREATE)!==true)throw new RuntimeException('Архив не создан');
        $root=realpath(BYPCMS_ROOT);
        foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS)) as $file){if(!$file->isFile()||$file->isLink())continue;$relative=str_replace('\\','/',substr($file->getPathname(),strlen($root)+1));$first=explode('/',$relative)[0];if(!in_array($first,['_core','api','install','admin','_next','themes'],true))continue;if(str_contains($relative,'.env')||str_ends_with($relative,'.log'))continue;$zip->addFile($file->getPathname(),'site/'.$relative);}
        $zip->addFromString('site/index.php',"<?php require __DIR__.'/_core/client-front.php';");
        $zip->addFromString('site/.htaccess',"DirectoryIndex index.php index.html\nOptions -Indexes\nRewriteEngine On\nRewriteRule ^(?:_core|_storage|_private)(?:/|$) - [F,L]\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule ^ index.php [L,QSA]\n");
        $manifest=['product'=>'BYPCMS','edition'=>$order['edition'],'modules'=>json_decode($order['modules'],true),'license_term'=>$order['license_term'],'domain'=>$order['domain'],'order_id'=>$id,'core_version'=>$config['app']['version']??'2.1.0'];
        $zip->addFromString('site/build-manifest.json',json_encode($manifest,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
        $zip->addFromString('README.txt',"TEST PURCHASE — not production-certified. Upload site/ contents; open /install/. Use a new empty database. Create the admin password in installer. Activation protocol is a separate acceptance stage.\n");
        if(!$zip->close())throw new RuntimeException('Ошибка записи ZIP');
        $plain='BYP-'.strtoupper(bin2hex(random_bytes(24)));
        $db->execute('INSERT INTO byp_customer_deliveries (order_id,key_hash,key_cipher,archive_path,confirmed_by,confirmed_at) VALUES (:id,:hash,:cipher,:path,:owner,NOW())',['id'=>$id,'hash'=>hash('sha256',$plain),'cipher'=>customer_key_crypt($plain,$config['app']['key']),'path'=>$archive,'owner'=>$owner]);
        $db->execute('UPDATE byp_customer_orders SET status="test_confirmed" WHERE id=:id',['id'=>$id]);$pdo->commit();
    }catch(Throwable $error){if($pdo->inTransaction())$pdo->rollBack();if($archive&&is_file($archive))unlink($archive);throw $error;}
}
