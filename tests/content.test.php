<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/Content.php';require_once __DIR__.'/../server/_core/Journal.php';
use BYPCMS\Core\{Content,Journal};
$checks=0;function check($ok,$message){global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
foreach(['javascript:alert(1)','data:text/html,<script>x</script>','//evil.test','/path'."\n".'Header:x','https://site.test/'."\r\n".'x']as $url)check(Content::url($url)==='','unsafe URL rejected');
foreach(['/local/path/','https://example.test/article','mailto:hello@example.test','tel:+71234567890']as $url)check(Content::url($url)===$url,'normal URL retained');
$dirty='<h2>Heading</h2><p onclick="x()">Body <strong>bold</strong><script>evil()</script><a href="jav&#x61;script:alert(1)">bad</a><a href="/safe/">safe</a><img src="/uploads/a.jpg" onerror="x()"><iframe src="https://evil.test"></iframe></p>';
$html=Content::html($dirty);check(str_contains($html,'<h2>Heading</h2>')&&str_contains($html,'<strong>bold</strong>'),'rich text rendered');foreach(['onclick','onerror','javascript','<script','<iframe','evil()']as $bad)check(!str_contains($html,$bad),'unsafe rich content removed: '.$bad);check(str_contains($html,'href="/safe/"'),'safe links retained');
$blocks=Content::blocks([['type'=>'heading','content'=>'A < B'],['type'=>'quote','content'=>'Quote'],['type'=>'text','content'=>'<p>Text</p>'],['type'=>'image','url'=>'javascript:x()'],['type'=>'image','url'=>'/cover.jpg','alt'=>'Alt'],['type'=>'button','url'=>'/about/','content'=>'Open']]);check(str_contains($blocks,'A &lt; B')&&str_contains($blocks,'<blockquote>Quote</blockquote>'),'block text escaped');check(!str_contains($blocks,'javascript:')&&str_contains($blocks,'src="/cover.jpg"'),'block images checked');
$menu=Journal::menu([['id'=>'a','label'=>'Parent','url'=>'/parent/','parent'=>''],['id'=>'b','label'=>'Child','url'=>'/child/','parent'=>'a']]);check(str_contains($menu,'<details')&&str_contains($menu,'href="/child/"'),'nested menu uses real links');
$seed=require __DIR__.'/../server/_core/JournalSeed.php';$settings=['site_name'=>'Journal','site_url'=>'https://example.test','tagline'=>'Editorial journal'];
function render($path,$settings,$seed){ob_start();Journal::render($seed['pages'],$seed['terms'],$settings,$path,'',true);return ob_get_clean();}
$home=render('',$settings,$seed);check(str_contains($home,'j-lead')&&str_contains($home,'/space-and-light/'),'complete homepage');
$story=render('space-and-light',$settings,$seed);check(str_contains($story,'id="story-section-1"')&&str_contains($story,'href="#story-section-1"'),'real reading contents');check(str_contains($story,'rel="canonical"')&&str_contains($story,'property="og:image"'),'SEO markup');check(str_contains($story,'j-related')&&str_contains($story,'j-prose'),'full story and related content');
$_GET=['q'=>'<script>'];$search=render('search',$settings,$seed);check(!str_contains($search,'value="<script>'),'query safely escaped');$_GET=[];
foreach(['articles','category/architecture','author/journal','about','contacts','unknown']as $path)check(str_contains(render($path,$settings,$seed),'j-footer'),'complete route: '.$path);
echo "Content Journal: $checks checks passed\n";
