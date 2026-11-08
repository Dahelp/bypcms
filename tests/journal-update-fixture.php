<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/Database.php';require_once __DIR__.'/../server/_core/Content.php';
use BYPCMS\Core\{Database,Content};
$qa=realpath($argv[1]??'');if(!$qa)throw new RuntimeException('Local fixture required');$root=$qa.'/packages/content/site';$config=require $root.'/_storage/config.php';if(($config['database']['port']??0)!==3319||!str_starts_with($config['app']['url'],'http://qa.example.test:8029'))throw new RuntimeException('Disposable update fixture only');
$db=new Database($config);$content=new Content($db,$config,$root);$mode=$argv[2]??'verify';$file=$qa.'/journal-update-proof.json';
if($mode==='seed'){
 $user=(int)$db->one('SELECT id FROM byp_users WHERE email=?',['owner@content.example.test'])['id'];$image='uploads/content/'.str_repeat('d',32).'.jpg';if(!is_dir($root.'/uploads/content'))mkdir($root.'/uploads/content',0755,true);copy(__DIR__.'/../server/themes/journal/assets/story-1.jpg',$root.'/'.$image);
 $old=$db->one('SELECT id FROM byp_pages WHERE slug="qa-journal-update-proof"');$v=['title'=>'Journal update proof','slug'=>'qa-journal-update-proof','kind'=>'article','status'=>'published','content'=>'<h2>JOURNAL_UPDATE_HEADING</h2><p>Content, blocks and uploaded media survive update and rollback.</p>','blocks'=>[['type'=>'quote','content'=>'JOURNAL_UPDATE_BLOCK']],'cover'=>'/'.$image,'cover_alt'=>'Preserved media','featured'=>1,'seo_title'=>'JOURNAL_UPDATE_SEO'];if($old)$v['id']=(int)$old['id'];$id=$content->save($v,$user);$content->configure(['site_name'=>'Journal upgrade','accent'=>'#b7472f','menu'=>[['label'=>'Proof','url'=>'/qa-journal-update-proof/']]]);
 file_put_contents($file,json_encode(['id'=>$id,'page'=>$content->get($id),'settings'=>$content->settings(),'image'=>$image,'sha256'=>hash_file('sha256',$root.'/'.$image)],JSON_UNESCAPED_UNICODE));echo "Journal content, theme settings and media seeded before update.\n";exit;
}
$proof=json_decode(file_get_contents($file),true);if($content->get($proof['id'])!==$proof['page']||$content->settings()!==$proof['settings']||hash_file('sha256',$root.'/'.$proof['image'])!==$proof['sha256'])throw new RuntimeException('Journal data or media changed during update/rollback');echo "Journal data, blocks, theme settings and original image preserved.\n";
