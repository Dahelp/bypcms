<?php
declare(strict_types=1);

// Installed customer frontend: direct HTTP routes, no dependency on the demo app.
$root = defined('BYPCMS_SITE_ROOT') ? BYPCMS_SITE_ROOT : dirname(__DIR__);
if (!is_file($root . '/_storage/config.php')) {
    header('Location: /install/'); exit;
}
$config = require $root . '/_storage/config.php';
$db = $config['database'];
$pdo = new PDO(sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $db['host'], $db['port'], $db['name']), $db['username'], $db['password'], [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$escape = static fn($value): string => htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$path = trim(rawurldecode((string)parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)), '/');
$slug = $path === '' ? 'home' : $path;
$query = $pdo->prepare('SELECT * FROM byp_pages WHERE slug IN (:slug, :slash_slug) AND status="published" LIMIT 1');
$query->execute(['slug'=>$slug,'slash_slug'=>'/'.$slug]);
$page = $query->fetch(PDO::FETCH_ASSOC);
$navigation = $pdo->query('SELECT slug,title FROM byp_pages WHERE status="published" ORDER BY id LIMIT 30')->fetchAll(PDO::FETCH_ASSOC);
if (!$page) { http_response_code(404); $page=['title'=>'Страница не найдена','excerpt'=>'Проверьте адрес или вернитесь на главную.','content'=>'']; }
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
$site = (string)($config['app']['name'] ?? 'BYPCMS');
$template = $root . '/themes/custom/page.html';
if (is_file($template)) {
    // HTML templates are developer-owned files, not executable PHP uploaded by visitors.
    echo strtr((string)file_get_contents($template), ['{{site.name}}'=>$escape($site),'{{page.title}}'=>$escape($page['title']),'{{page.excerpt}}'=>$escape($page['excerpt']),'{{page.content}}'=>$escape($page['content'])]);
    exit;
}
?><!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?= $escape($page['title']) ?> — <?= $escape($site) ?></title><meta name="description" content="<?= $escape($page['excerpt']) ?>"><style>
*{box-sizing:border-box}body{margin:0;background:#f7f8f6;color:#26352d;font:16px/1.7 system-ui,sans-serif}a{color:inherit}header,main,footer{max-width:1200px;margin:auto;padding:28px}header{display:flex;align-items:center;justify-content:space-between;gap:28px;border-bottom:1px solid #dce3db}nav{display:flex;flex-wrap:wrap;gap:22px}nav a{text-decoration:none}main{min-height:65vh;padding-block:72px}h1{font-size:clamp(34px,5vw,64px);line-height:1.15;font-weight:600}article{max-width:800px;white-space:pre-wrap}.lead{font-size:21px;color:#647568}footer{border-top:1px solid #dce3db}@media(max-width:700px){header{align-items:flex-start;flex-direction:column}main{padding-block:38px}}
</style></head><body><header><a href="/"><strong><?= $escape($site) ?></strong></a><nav><?php foreach ($navigation as $item): ?><a href="<?= $escape($item['slug']==='home'?'/':'/'.trim($item['slug'],'/').'/') ?>"><?= $escape($item['title']) ?></a><?php endforeach ?></nav></header><main><h1><?= $escape($page['title']) ?></h1><p class="lead"><?= $escape($page['excerpt']) ?></p><article><?= $escape($page['content']) ?></article></main><footer><?= $escape($site) ?> · <?= date('Y') ?></footer></body></html>
