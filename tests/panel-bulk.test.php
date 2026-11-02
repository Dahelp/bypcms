<?php
declare(strict_types=1);

require_once __DIR__ . '/../server/_core/PanelBulk.php';
use BYPCMS\Core\PanelBulk;

$checks = 0;
function check(bool $ok, string $message): void { global $checks; if (!$ok) throw new RuntimeException($message); $checks++; echo "PASS: $message\n"; }
function rejects(callable $fn, string $class, string $message): void { try { $fn(); } catch (Throwable $error) { check($error instanceof $class, $message); return; } throw new RuntimeException($message); }
$owner = ['id'=>1,'role'=>'owner'];
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE TABLE byp_pages (id INTEGER PRIMARY KEY, parent_id INTEGER, slug TEXT, title TEXT, content TEXT, status TEXT, published_at TEXT, updated_at TEXT)');
$pdo->exec('CREATE TABLE byp_page_revisions (page_id INTEGER,user_id INTEGER,snapshot TEXT,created_at TEXT)');
$pdo->exec('CREATE TABLE byp_client_tasks (id INTEGER PRIMARY KEY, title TEXT, status TEXT, progress INTEGER, completed_at TEXT, updated_at TEXT)');
$pdo->exec('CREATE TABLE byp_modules (id INTEGER PRIMARY KEY, module_key TEXT, status TEXT, updated_at TEXT)');
$pdo->exec('CREATE TABLE audit (collection TEXT, id INTEGER, metadata TEXT)');
$pdo->exec('INSERT INTO byp_pages (id,parent_id,slug,title,content,status) VALUES (1,NULL,"about","О компании","Keep body","draft"),(2,NULL,"services","Услуги","System body","published"),(3,1,"child","Дочерняя","Child body","draft")');
$pdo->exec('INSERT INTO byp_client_tasks (id,title,status,progress) VALUES (1,"Задача","planned",20)');
$pdo->exec('INSERT INTO byp_modules VALUES (1,"seo","active",NULL),(2,"analytics","active",NULL)');
$audit = function($collection,$id,$meta) use ($pdo): void { $pdo->prepare('INSERT INTO audit VALUES (?,?,?)')->execute([$collection,$id,json_encode($meta)]); };
$bulk = new PanelBulk($pdo, $audit);
$spec = fn(array $input)=>PanelBulk::validate($input, $owner);
$input=['collection'=>'pages','operation'=>'status','status'=>'published','ids'=>[1,1,999]];
$result=$bulk->run($spec($input));
check($result['succeeded']===[1] && count($result['failed'])===1 && $result['failed'][0]['id']===999, 'partial success reports exact identifiers and deduplicates rows');
check($pdo->query('SELECT status FROM byp_pages WHERE id=1')->fetchColumn()==='published', 'selected page status is persisted');
check($pdo->query('SELECT status FROM byp_pages WHERE id=3')->fetchColumn()==='draft', 'unselected rows are untouched');
check($pdo->query('SELECT content FROM byp_pages WHERE id=1')->fetchColumn()==='Keep body', 'bulk status preserves record content');
check($pdo->query('SELECT published_at FROM byp_pages WHERE id=1')->fetchColumn()!==null, 'publication sets its timestamp');
$snapshot=json_decode($pdo->query('SELECT snapshot FROM byp_page_revisions')->fetchColumn(),true);
check($snapshot['content']==='Keep body' && $snapshot['status']==='draft', 'page revision stores the pre-change record');
check((int)$pdo->query('SELECT COUNT(*) FROM audit')->fetchColumn()===1, 'successful change has exactly one audit entry');
$result=$bulk->run($spec(['collection'=>'pages','operation'=>'delete','ids'=>[2,1,3]]));
check(count($result['failed'])===2 && $result['succeeded']===[3], 'system pages and parents are protected while independent deletions succeed');
check((int)$pdo->query('SELECT COUNT(*) FROM byp_pages WHERE id IN (1,2)')->fetchColumn()===2, 'protected records remain present');
$result=$bulk->run($spec(['collection'=>'pages','operation'=>'delete','ids'=>[1]]));
check($result['succeeded']===[1], 'custom page can be deleted after its children are removed');
$bulk->run($spec(['collection'=>'modules','operation'=>'status','status'=>'inactive','ids'=>['seo']]));
check($pdo->query('SELECT status FROM byp_modules WHERE module_key="seo"')->fetchColumn()==='inactive' && $pdo->query('SELECT status FROM byp_modules WHERE module_key="analytics"')->fetchColumn()==='active', 'module keys target only selected modules');
$bulk->run($spec(['collection'=>'owner.tasks','operation'=>'status','status'=>'done','ids'=>[1]]));
$task=$pdo->query('SELECT * FROM byp_client_tasks WHERE id=1')->fetch(PDO::FETCH_ASSOC);
check((int)$task['progress']===100 && $task['completed_at']!==null, 'completing tasks also completes progress and timestamp');
$bulk->run($spec(['collection'=>'owner.tasks','operation'=>'status','status'=>'in_progress','ids'=>[1]]));
$task=$pdo->query('SELECT * FROM byp_client_tasks WHERE id=1')->fetch(PDO::FETCH_ASSOC);
check((int)$task['progress']<100 && $task['completed_at']===null, 'reopening tasks restores consistent progress and timestamp');
$broken=new PanelBulk($pdo, function(){throw new RuntimeException('audit unavailable');});
$result=$broken->run($spec(['collection'=>'modules','operation'=>'status','status'=>'active','ids'=>['seo']]));
check(count($result['failed'])===1 && $pdo->query('SELECT status FROM byp_modules WHERE module_key="seo"')->fetchColumn()==='inactive', 'audit failure rolls back the row transaction');
foreach([
  ['ids'=>[]],['ids'=>array_fill(0,201,1)],['ids'=>['1 OR 1=1']],['ids'=>[0]],['ids'=>[1.5]],['ids'=>[true]],['ids'=>['01']],['status'=>'invalid'],['collection'=>'byp_users'],['operation'=>'drop'],
] as $case) rejects(fn()=>$spec(array_replace($input,$case)),InvalidArgumentException::class,'reject invalid request '.json_encode($case));
rejects(fn()=>PanelBulk::validate(['collection'=>'owner.clients','operation'=>'status','status'=>'active','ids'=>[1]],['id'=>2,'role'=>'editor']),DomainException::class,'owner records reject non-owner access');
rejects(fn()=>$spec(['collection'=>'owner.licenses','operation'=>'delete','ids'=>[1]]),InvalidArgumentException::class,'license records cannot be mass-deleted');
rejects(fn()=>$spec(['collection'=>'modules','operation'=>'status','status'=>'active','ids'=>['seo; DROP TABLE byp_users']]),InvalidArgumentException::class,'module keys reject SQL injection');
echo "Completed $checks checks\n";
