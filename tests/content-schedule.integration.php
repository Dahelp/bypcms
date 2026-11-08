<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/Database.php';require_once __DIR__.'/../server/_core/Content.php';
use BYPCMS\Core\{Database,Content};
$root=realpath($argv[1]??'');if(!$root)throw new RuntimeException('Fixture required');$config=require $root.'/_storage/config.php';if(($config['database']['port']??0)!==3319||!preg_match('/^bypcms_journal_acceptance(?:_final)?_\d{8}$/D',$config['database']['name'])||!str_starts_with($config['app']['url'],'http://127.0.0.1:805'))throw new RuntimeException('Disposable local Journal only');
$db=new Database($config);$content=new Content($db,$config,$root);$future=$db->one('SELECT id FROM byp_pages WHERE status="scheduled" AND slug LIKE "qa-journal-%-future" ORDER BY id DESC LIMIT 1');if(!$future)throw new RuntimeException('Run content-http first');$id=(int)$future['id'];$before=$content->get($id);$db->execute('UPDATE byp_pages SET published_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 MINUTE) WHERE id=?',[$id]);
try{
 $html=file_get_contents($config['app']['url'].'/'.$before['slug'].'/');if(!str_contains($http_response_header[0],'200')||!str_contains($html,$before['title']))throw new RuntimeException('Due schedule not public');
 $xml=file_get_contents($config['app']['url'].'/sitemap.xml');if(!str_contains($xml,$before['slug']))throw new RuntimeException('Due schedule absent from sitemap');
 $due=$content->get($id);$content->save($due,(int)$due['author_id']);if($content->get($id)['status']!=='published')throw new RuntimeException('Due material cannot be edited');
 echo "3 due-publication, sitemap and subsequent-edit checks passed.\n";
}finally{$db->execute('UPDATE byp_pages SET status=?,published_at=? WHERE id=?',[$before['status'],$before['published_at'],$id]);}
