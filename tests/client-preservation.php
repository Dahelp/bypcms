<?php
declare(strict_types=1);
// Product-data and user-file fingerprints for disposable final acceptance sites.
$root=realpath($argv[1]??'');$mode=$argv[2]??'';$proof=$argv[3]??'';
$normalized=str_replace('\\','/',$root?:'');$purchase=str_contains($normalized,'/outputs/purchase-acceptance-20261118/clients/');
$proofBase=$purchase?dirname(__DIR__).'/outputs/release-acceptance-20261119':dirname($root?:'',3);
if(!$root||(!$purchase&&!str_contains($normalized,'/outputs/final-acceptance-'))||!in_array($mode,['record','verify'],true)||!str_starts_with(str_replace('\\','/',realpath(dirname($proof))?:''),str_replace('\\','/',$proofBase)))throw new RuntimeException('Explicit disposable fixture/proof required');
$config=require $root.'/_storage/config.php';
if(($config['database']['host']??'')!=='127.0.0.1'||($config['database']['port']??0)!==3319||(!str_starts_with($config['database']['name'],$purchase?'bypcms_purchase_':'bypcms_final_')||empty($config['app']['debug'])))throw new RuntimeException('Loopback QA database only');
require_once __DIR__.'/../server/_core/Database.php';require_once __DIR__.'/../server/_core/Shop.php';
$db=new BYPCMS\Core\Database($config);$snapshot=['tables'=>[],'files'=>[]];
$tables=['byp_pages','byp_page_revisions','byp_content_meta','byp_content_terms','byp_content_redirects','byp_settings','byp_media'];
if($config['app']['edition']==='business')array_push($tables,'byp_business_leads','byp_business_mail');
if($config['app']['edition']==='commerce')array_push($tables,...BYPCMS\Core\Shop::TABLES);
foreach($tables as $table){$rows=$db->all('SELECT * FROM '.$table);usort($rows,fn($a,$b)=>strcmp(serialize($a),serialize($b)));$ddl=$db->pdo()->query('SHOW CREATE TABLE `'.$table.'`')->fetch(PDO::FETCH_NUM)[1];$snapshot['tables'][$table]=hash('sha256',serialize([$ddl,$rows]));}
foreach(['uploads','project']as $dir)if(is_dir($root.'/'.$dir))foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root.'/'.$dir,FilesystemIterator::SKIP_DOTS))as $file)if($file->isFile())$snapshot['files'][str_replace('\\','/',substr($file->getPathname(),strlen($root)+1))]=hash_file('sha256',$file->getPathname());
$snapshot['files']['_storage/config.php']=hash_file('sha256',$root.'/_storage/config.php');ksort($snapshot['files']);
if($mode==='record')file_put_contents($proof,json_encode($snapshot,JSON_THROW_ON_ERROR|JSON_PRETTY_PRINT));
else{if(json_decode((string)file_get_contents($proof),true,32,JSON_THROW_ON_ERROR)!==$snapshot)throw new RuntimeException('Product schema/data or original customer files differ from snapshot');}
echo $config['app']['edition'].' preservation '.$mode.': '.count($tables).' tables and '.count($snapshot['files'])." files\n";
