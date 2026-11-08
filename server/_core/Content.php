<?php
declare(strict_types=1);
namespace BYPCMS\Core;

use PDO;
use RuntimeException;
use Throwable;

/** Content data contract shared by installed themes, the editor and previews. */
final class Content {
    public const VERSION='2.5.1';
    public static array $images=[];
    public static function imageSet(string $url,string $sizes='(max-width: 650px) calc(100vw - 40px), (max-width: 1000px) 50vw, 720px'): string {
        $image=self::$images[$url]??null;if(!$image)return '';$sources=[];foreach($image['variants']??[]as $v)if(self::url('/'.$v['path'])&&($v['width']??0)>0)$sources[(int)$v['width']]=self::asset('/'.$v['path']).' '.(int)$v['width'].'w';if(($image['width']??0)>0)$sources[(int)$image['width']]=self::asset($url).' '.(int)$image['width'].'w';ksort($sources);return $sources?' srcset="'.self::e(implode(', ',$sources)).'" sizes="'.self::e($sizes).'"':'';
    }
    public function __construct(public Database $db, public array $config, public string $root) { self::schema($db->pdo()); }
    public static function schema(PDO $pdo): void {
        if ($pdo->query("SELECT 1 FROM byp_migrations WHERE migration='2026_11_07_journal_v1'")->fetchColumn()) return;
        $pdo->exec('CREATE TABLE IF NOT EXISTS byp_content_meta (page_id INT UNSIGNED PRIMARY KEY, kind VARCHAR(20) NOT NULL DEFAULT "page", data LONGTEXT NOT NULL, revision INT UNSIGNED NOT NULL DEFAULT 1, FOREIGN KEY(page_id) REFERENCES byp_pages(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $pdo->exec('CREATE TABLE IF NOT EXISTS byp_content_terms (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, kind VARCHAR(20) NOT NULL, slug VARCHAR(190) NOT NULL, title VARCHAR(190) NOT NULL, description TEXT NOT NULL, image VARCHAR(500) NOT NULL DEFAULT "", UNIQUE KEY(kind,slug)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $pdo->exec('CREATE TABLE IF NOT EXISTS byp_content_redirects (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, source VARCHAR(190) NOT NULL UNIQUE, target VARCHAR(500) NOT NULL, code INT NOT NULL DEFAULT 301) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $pdo->exec('INSERT IGNORE INTO byp_migrations(migration,batch,applied_at) VALUES("2026_11_07_journal_v1",2,NOW())');
    }
    public static function e(mixed $s): string {return htmlspecialchars((string)$s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
    public static function money(int $minor): string {return number_format($minor/100,$minor%100===0?0:2,',',' ').' ₽';}
    public static function imageUrl(string $url): string {return strlen($url)<=550000&&preg_match('#^data:image/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$#D',$url)?$url:self::url($url);}
    public static function asset(string $path): string {
        if(preg_match('#^/themes/(journal|chronicle|focus|atelier|gallery)/#',$path,$theme)&&defined('BYPCMS_SITE_ROOT')&&class_exists(UpdateRuntime::class)){$p=UpdateRuntime::pointer(BYPCMS_SITE_ROOT);if($p)return '/_update-assets/'.$p['release'].'/_next/static/'.$theme[1].'/'.substr($path,strlen('/themes/'.$theme[1].'/'));}return $path;
    }
    public static function url(string $url): string {
        $url=trim($url);
        if (preg_match('#^/(?!/)[^\x00-\x20\\\\]*$#u',$url)||preg_match('#^https?://[^\s<>"\x00-\x20]+$#iu',$url)||preg_match('#^(?:mailto:|tel:)[a-zA-Z0-9@+._-]+$#D',$url)) return $url;
        return '';
    }
    public static function html(string $html): string {
        $dom=new \DOMDocument('1.0','UTF-8');$prev=libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="utf-8" ?><div id="byp-content-root">'.$html.'</div>',LIBXML_HTML_NOIMPLIED|LIBXML_HTML_NODEFDTD|LIBXML_NONET);
        libxml_clear_errors();libxml_use_internal_errors($prev);
        $allowed=['p','br','h2','h3','h4','ul','ol','li','strong','b','em','i','blockquote','a','img','figure','figcaption','hr','table','thead','tbody','tr','td','th','code','pre','span'];
        $clean=function(\DOMNode $parent)use(&$clean,$allowed){foreach(iterator_to_array($parent->childNodes)as $node){
            if($node instanceof \DOMElement){$tag=strtolower($node->tagName);
                if(!in_array($tag,$allowed,true)){ $parent->removeChild($node);continue; }
                foreach(iterator_to_array($node->attributes)as $attr){$name=strtolower($attr->name);$value=$attr->value;
                    $keep=in_array($name,['alt','title'],true)||($tag==='a'&&$name==='href'&&self::url($value)!=='')||($tag==='img'&&$name==='src'&&self::imageUrl($value)!=='');
                    if(!$keep)$node->removeAttribute($attr->name);
                }
                if($tag==='img'){$node->setAttribute('loading','lazy');$node->setAttribute('decoding','async');}
                $clean($node);
            }elseif(!($node instanceof \DOMText))$parent->removeChild($node);
        }};
        $root=$dom->getElementById('byp-content-root');if(!$root)return '';$clean($root);$out='';foreach($root->childNodes as $child)$out.=$dom->saveHTML($child);return $out;
    }
    public static function blocks(array $blocks): string {
        $out='';foreach(array_slice($blocks,0,100)as $b){if(!is_array($b))continue;$type=$b['type']??'';$d=is_array($b['data']??null)?$b['data']:$b;$text=(string)($d['content']??$d['text']??$d['title']??'');
            if(in_array($type,['heading','hero'],true))$out.='<h2>'.self::e($text).'</h2>';
            elseif(in_array($type,['text','paragraph','richtext'],true))$out.=self::html($text);
            elseif($type==='quote')$out.='<blockquote>'.self::e($text).'</blockquote>';
            elseif($type==='image'){$src=self::imageUrl((string)($d['url']??$d['src']??''));if($src)$out.='<figure><img src="'.self::e($src).'" alt="'.self::e($d['alt']??'').'" loading="lazy"><figcaption>'.self::e($d['caption']??$d['content']??'').'</figcaption></figure>';}
            elseif($type==='gallery'){if($text!=='')$out.='<p>'.self::e($text).'</p>'; $out.='<div class="j-gallery">';foreach(array_slice((array)($d['images']??[]),0,12)as $im){if(!is_array($im)||!is_scalar($im['url']??''))continue;$src=self::imageUrl((string)($im['url']??''));if($src)$out.='<figure><img src="'.self::e($src).'" alt="'.self::e($im['alt']??'').'" loading="lazy"><figcaption>'.self::e($im['caption']??'').'</figcaption></figure>';}$out.='</div>';}
            elseif($type==='button'){$url=self::url((string)($d['url']??''));if($url)$out.='<p><a class="j-button" href="'.self::e($url).'">'.self::e($text).'</a></p>';}
        }return $out;
    }
    public function settings(): array {
        $out=['site_name'=>$this->config['app']['name']??'Journal','tagline'=>'Архитектура. Люди. Пространство.','email'=>'','phone'=>'','accent'=>'#b7472f','logo'=>'','font'=>'manrope','heading_font'=>'cormorant','theme'=>'journal','menu'=>[],'footer_menu'=>[]];
        foreach($this->db->all('SELECT setting_key,setting_value FROM byp_settings WHERE setting_group IN ("general","journal") ORDER BY setting_group,id')as $r)$out[$r['setting_key']]=in_array($r['setting_key'],['menu','footer_menu'],true)?(json_decode($r['setting_value'],true)??[]):$r['setting_value'];return $out;
    }
    public function configure(array $input): void {
        if(!empty($input['activate_journal']))$input['theme']='journal';
        $data=[];foreach(['site_name','tagline','email','phone','accent','logo','font','heading_font','focus_heading_font','menu','footer_menu','theme']as $key)if(isset($input[$key]))$data[$key]=$input[$key];
        if(isset($data['theme'])&&(!in_array($data['theme'],strtolower($this->config['app']['edition']??'')==='business'?['atelier']:(strtolower($this->config['app']['edition']??'')==='commerce'?['gallery']:['journal','chronicle','focus']),true)&&($data['theme']!=='custom'||!is_file($this->root.'/themes/custom/page.html'))))throw new RuntimeException('Тема не установлена.');
        if(isset($data['site_name'])&&(trim($data['site_name'])===''||mb_strlen($data['site_name'])>100))throw new RuntimeException('Укажите название сайта до 100 символов.');
        if(isset($data['accent'])&&!preg_match('/^#[0-9a-f]{6}$/i',$data['accent']))throw new RuntimeException('Некорректный цвет.');
        if(isset($data['email'])&&$data['email']!==''&&!filter_var($data['email'],FILTER_VALIDATE_EMAIL))throw new RuntimeException('Проверьте email.');
        foreach(['menu','footer_menu']as $menuKey)if(isset($data[$menuKey])){
            if(is_string($data[$menuKey]))$data[$menuKey]=json_decode($data[$menuKey],true,16,JSON_THROW_ON_ERROR);
            $menu=$data[$menuKey];if(!is_array($menu)||count($menu)>30)throw new RuntimeException('В меню допускается до 30 пунктов.');$ids=[];
            foreach($menu as $i=>&$m){if(!is_array($m)||!self::url((string)($m['url']??''))||trim((string)($m['label']??''))===''||mb_strlen($m['label'])>120)throw new RuntimeException('Проверьте название и URL пунктов меню.');$m['id']=$m['id']??substr(hash('sha256',$m['url'].$i),0,20);$m['parent']=$m['parent']??'';if(!preg_match('/^[a-zA-Z0-9-]{1,64}$/D',$m['id'])||isset($ids[$m['id']]))throw new RuntimeException('Пункты меню должны иметь уникальные идентификаторы.');$ids[$m['id']]=$m['parent'];}unset($m);
            foreach($menu as $m){$seen=[$m['id']];$parent=$m['parent'];while($parent!==''){if(!isset($ids[$parent])||in_array($parent,$seen,true)||count($seen)>3)throw new RuntimeException('Проверьте вложенность меню: до трёх уровней, без циклов.');$seen[]=$parent;$parent=$ids[$parent];}}
            $data[$menuKey]=$menu;
        }

        if(isset($data['logo'])&&$data['logo']!==''&&!self::url($data['logo']))throw new RuntimeException('Некорректный адрес логотипа.');
        if(isset($data['focus_heading_font'])&&!in_array($data['focus_heading_font'],['manrope','georgia'],true))throw new RuntimeException('Некорректный шрифт Focus.');
        if(isset($data['font'])&&!in_array($data['font'],['manrope','system'],true))throw new RuntimeException('Некорректный шрифт.');
        if(isset($data['heading_font'])&&!in_array($data['heading_font'],strtolower($this->config['app']['edition']??'')==='business'?['manrope','georgia']:['cormorant','georgia'],true))throw new RuntimeException('Некорректный шрифт заголовков.');
        $pdo=$this->db->pdo();$pdo->beginTransaction();try{foreach($data as $k=>$v)$this->db->execute('INSERT INTO byp_settings(setting_group,setting_key,setting_value,value_type,is_public,updated_at) VALUES("journal",?,?,"string",1,NOW()) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_at=NOW()',[$k,is_array($v)?json_encode($v,JSON_UNESCAPED_UNICODE):mb_substr((string)$v,0,1000)]);$pdo->commit();}catch(Throwable $e){$pdo->rollBack();throw $e;}
    }
    public function records(bool $public=false,bool $full=true,int $limit=0,int $offset=0): array {
        $fields=$full?'p.*':'p.id,p.parent_id,p.slug,p.title,p.excerpt,p.status,p.published_at,p.updated_at,p.created_at,\'\' AS content,\'[]\' AS blocks';
        $rows=$this->db->all('SELECT '.$fields.',COALESCE(m.kind,"page") AS kind,m.data,COALESCE(m.revision,1) AS revision FROM byp_pages p LEFT JOIN byp_content_meta m ON m.page_id=p.id'.($public?' WHERE p.status IN ("published","scheduled") AND (p.published_at IS NULL OR p.published_at<=UTC_TIMESTAMP())':'').' ORDER BY COALESCE(p.published_at,p.created_at) DESC,p.id DESC'.($limit?' LIMIT '.min(100,$limit).' OFFSET '.max(0,$offset):''));
        $terms=array_column($this->terms(),null,'id');return array_map(static fn($r)=>self::normalise(self::decode($r),$terms),$rows);
    }
    public static function decode(array $row): array { $data=json_decode((string)($row['data']??'{}'),true);$row=array_merge($row,is_array($data)?$data:[]);$row['blocks']=is_array($row['blocks']??null)?$row['blocks']:(json_decode((string)($row['blocks']??'[]'),true)??[]);unset($row['data']);$row['id']=(int)$row['id'];$row['revision']=(int)$row['revision'];return $row; }
    private static function normalise(array $row,array $terms):array {foreach(['category','author']as $kind){$id=$row[$kind.'_term_id']??0;if($id&&isset($terms[$id])&&$terms[$id]['kind']===$kind)$row[$kind]=$terms[$id]['slug'];}return $row;}
    public function get(int $id): ?array {$row=$this->db->one('SELECT p.*,COALESCE(m.kind,\'page\') kind,m.data,COALESCE(m.revision,1) revision FROM byp_pages p LEFT JOIN byp_content_meta m ON m.page_id=p.id WHERE p.id=?',[$id]);return $row?self::normalise(self::decode($row),array_column($this->terms(),null,'id')):null;}
    public function validate(array $v): array {
        $v['title']=trim((string)($v['title']??''));$v['slug']=trim((string)($v['slug']??''),'/ ');$v['kind']=$v['kind']??'article';
        if($v['title']===''||mb_strlen($v['title'])>255)throw new RuntimeException('Название обязательно, не более 255 символов.');
        if(!preg_match('#^[a-z0-9][a-z0-9/-]{0,189}$#D',$v['slug'])||str_contains($v['slug'],'//')||in_array(explode('/',$v['slug'])[0],['admin','manage','api','themes','uploads','_core','_storage','_private','_releases','updates','install','category','author','search','articles','preview'],true))throw new RuntimeException('Укажите уникальный адрес латиницей; служебные адреса зарезервированы.');
        if(strtolower($this->config['app']['edition']??'')==='commerce'&&in_array(explode('/',$v['slug'])[0],['catalog','product','cart','checkout','order','account','payment-notification'],true))throw new RuntimeException('Этот адрес используется магазином.');
        if(!in_array($v['kind'],strtolower($this->config['app']['edition']??'')==='business'?['service','project','person','page']:(strtolower($this->config['app']['edition']??'')==='commerce'?['page']:['article','page']),true)||!in_array($v['status']??'draft',['draft','published','scheduled','archived'],true))throw new RuntimeException('Некорректный тип или статус.');
        $v['status']=$v['status']??'draft';$date=trim((string)($v['published_at']??''));
        if($date!==''){ $dt=\DateTimeImmutable::createFromFormat('!Y-m-d\TH:i',$date,new \DateTimeZone('UTC'))?:\DateTimeImmutable::createFromFormat('!Y-m-d H:i:s',$date,new \DateTimeZone('UTC'));if(!$dt||$dt->format(str_contains($date,'T')?'Y-m-d\\TH:i':'Y-m-d H:i:s')!==$date)throw new RuntimeException('Проверьте дату публикации (UTC).');$date=$dt->format('Y-m-d H:i:s');}
        if($v['status']==='scheduled'&&($date===''||strtotime($date.' UTC')<=time()))throw new RuntimeException('Для отложенной публикации укажите будущую дату (UTC).');
        $v['published_at']=$date?:($v['status']==='published'?gmdate('Y-m-d H:i:s'):null);
        $blocks=$v['blocks']??[];if(is_string($blocks))$blocks=json_decode($blocks,true,32,JSON_THROW_ON_ERROR);if(!is_array($blocks)||count($blocks)>100)throw new RuntimeException('Допускается до 100 блоков.');$v['blocks']=$blocks;
        if(strlen((string)($v['content']??''))>500000||strlen(json_encode($blocks))>500000)throw new RuntimeException('Материал слишком большой.');
        foreach($blocks as &$block){
            if(!is_array($block)||!is_scalar($block['type']??''))throw new RuntimeException('Некорректный блок материала.');
            if(array_key_exists('images_json',$block)){$block['images']=json_decode((string)$block['images_json'],true,16,JSON_THROW_ON_ERROR);unset($block['images_json']);}
            $data=is_array($block['data']??null)?$block['data']:$block;
            foreach(['content','text','title','url','src','alt','caption']as $key)if(isset($data[$key])&&!is_scalar($data[$key]))throw new RuntimeException('Содержание и подписи блока должны быть текстом.');
            if(($block['type']??'')==='gallery'){
                $images=$data['images']??[];if(!is_array($images)||count($images)>12)throw new RuntimeException('В галерее допускается до 12 фотографий.');
                foreach($images as $image){if(!is_array($image)||!is_string($image['url']??null)||self::url($image['url'])===''||!preg_match('#^(?:/(?!/)|https?://)#i',$image['url']))throw new RuntimeException('Выберите корректные изображения галереи.');foreach(['alt','caption']as $key)if(isset($image[$key])&&(!is_string($image[$key])||mb_strlen($image[$key])>1000))throw new RuntimeException('Подпись фотографии должна быть текстом до 1000 символов.');}
            }
        }unset($block);$v['blocks']=$blocks;
        foreach(['cover','canonical']as $key)if(!empty($v[$key])&&!self::url((string)$v[$key]))throw new RuntimeException('Некорректный URL: '.$key);
        foreach(['category','author']as $key){$v[$key.'_term_id']=null;if(empty($v[$key]))continue;$slug=(string)$v[$key];$term=null;
            for($i=0;$i<8;$i++){$term=$this->db->one('SELECT id,slug FROM byp_content_terms WHERE kind=? AND slug=?',[$key,$slug]);if($term)break;$redirect=$this->db->one('SELECT target FROM byp_content_redirects WHERE source=?',['/'.$key.'/'.$slug.'/']);if(!$redirect||!preg_match('#^/'.$key.'/([a-z0-9-]+)/$#D',$redirect['target'],$match))break;$slug=$match[1];}
            if(!$term)throw new RuntimeException('Выберите существующую рубрику и автора.');$v[$key]=$term['slug'];$v[$key.'_term_id']=(int)$term['id'];
        }
        if(strtolower($this->config['app']['edition']??'')==='business') {
            if(in_array($v['slug'],['services','projects','team','contact','search','privacy','request-success'],true))throw new RuntimeException('Этот адрес используется разделом Business.');
            foreach(['price'=>190,'client'=>190,'year'=>20,'location'=>190,'role'=>190]as $key=>$length){$v[$key]=trim((string)($v[$key]??''));if(mb_strlen($v[$key])>$length)throw new RuntimeException('Сократите поле '.$key);}
            $v['person_id']=(int)($v['person_id']??0)?:null;if($v['person_id']){$person=$this->get($v['person_id']);if(!$person||$person['kind']!=='person')throw new RuntimeException('Выберите существующего участника команды.');}
            if(!empty($v['parent_id'])&&$v['kind']==='project'){ $parent=$this->get((int)$v['parent_id']);if(!$parent||$parent['kind']!=='service')throw new RuntimeException('Для проекта выберите существующую услугу.');}
        }
        return $v;
    }
    public function save(array $input,int $user): int {
        $creationKey='';$payloadHash='';
        if(empty($input['id'])&&!empty($input['create_token'])){if(!preg_match('/^[a-f0-9]{32}$/D',$input['create_token']))throw new RuntimeException('Некорректный идентификатор сохранения.');$creationKey=hash('sha256',$user.':'.$input['create_token']);$payload=array_intersect_key($input,array_flip(['kind','title','slug','excerpt','content','blocks','status','published_at','cover','cover_alt','category','author','canonical','featured','noindex','price','client','year','location','role','person_id']));ksort($payload);$payloadHash=hash('sha256',json_encode($payload));}
        $lookup=function()use($creationKey,$payloadHash){if(!$creationKey)return null;$row=$this->db->one('SELECT page_id,data FROM byp_content_meta WHERE JSON_UNQUOTE(JSON_EXTRACT(data,\'$.create_token_hash\'))=?',[$creationKey]);if(!$row)return null;$m=json_decode($row['data'],true);if(!hash_equals($m['create_payload_hash']??'',$payloadHash))throw new RuntimeException('Материал уже создан (#'.$row['page_id'].'). Откройте его из списка; ваш новый текст остаётся в форме.');return (int)$row['page_id'];};
        if($created=$lookup())return $created;
        $pdo=$this->db->pdo();$pdo->beginTransaction();try{
            $id=(int)($input['id']??0);$old=null;
            if($id){$locked=$this->db->one('SELECT id FROM byp_pages WHERE id=? FOR UPDATE',[$id]);if(!$locked)throw new RuntimeException('Материал не найден.');$old=$this->get($id);if(isset($input['revision'])&&(int)$input['revision']!==(int)$old['revision'])throw new RuntimeException('Материал уже изменён в другой вкладке. Скопируйте свой текст и обновите страницу.');}
            $merged=array_merge($old??[],$input);if(($old['status']??'')==='scheduled'&&($merged['status']??'')==='scheduled'&&!empty($old['published_at'])&&strtotime($old['published_at'].' UTC')<=time()&&strtotime(($merged['published_at']??'').' UTC')===strtotime($old['published_at'].' UTC'))$merged['status']='published';$v=$this->validate($merged);$parent=(int)($v['parent_id']??0);
            if($parent){$seen=[$id];$cursor=$parent;while($cursor){if(in_array($cursor,$seen,true))throw new RuntimeException('Родитель создаёт цикл.');$seen[]=$cursor;$p=$this->db->one('SELECT parent_id FROM byp_pages WHERE id=? FOR UPDATE',[$cursor]);if(!$p)throw new RuntimeException('Родительская страница не найдена.');$cursor=(int)$p['parent_id'];}}
            if($this->db->one('SELECT id FROM byp_pages WHERE slug=? AND id<>?',[$v['slug'],$id]))throw new RuntimeException('Этот адрес уже используется.');
            if($old)$this->db->execute('INSERT INTO byp_page_revisions(page_id,user_id,snapshot,created_at) VALUES(?,?,?,NOW())',[$id,$user,json_encode($old,JSON_UNESCAPED_UNICODE)]);
            $params=[$parent?:null,$v['slug'],$v['title'],mb_substr((string)($v['excerpt']??''),0,3000),self::html((string)($v['content']??'')),json_encode($v['blocks'],JSON_UNESCAPED_UNICODE),$v['status'],mb_substr((string)($v['seo_title']??''),0,255),mb_substr((string)($v['seo_description']??''),0,3000),$v['published_at']];
            if($id)$this->db->execute('UPDATE byp_pages SET parent_id=?,slug=?,title=?,excerpt=?,content=?,blocks=?,status=?,seo_title=?,seo_description=?,published_at=?,updated_at=NOW() WHERE id=?',[...$params,$id]);
            else $id=$this->db->insert('INSERT INTO byp_pages(parent_id,slug,title,excerpt,content,blocks,status,seo_title,seo_description,published_at,author_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,NOW(),NOW())',[...$params,$user]);
            $meta=[];foreach(['cover','cover_alt','category','author','canonical','featured','noindex','category_term_id','author_term_id','price','client','year','location','role','person_id']as $k)$meta[$k]=$v[$k]??'';$meta['create_token_hash']=$old['create_token_hash']??$creationKey;$meta['create_payload_hash']=$old['create_payload_hash']??$payloadHash;
            $this->db->execute('INSERT INTO byp_content_meta(page_id,kind,data,revision) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE kind=VALUES(kind),data=VALUES(data),revision=VALUES(revision)',[$id,$v['kind'],json_encode($meta,JSON_UNESCAPED_UNICODE),(int)($old['revision']??0)+1]);
            $this->db->execute('INSERT INTO byp_audit_logs(user_id,action,entity_type,entity_id,created_at) VALUES(?,"content.save","page",?,NOW())',[$user,$id]);$pdo->commit();return $id;
        }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if($created=$lookup())return $created;throw $e;}
    }
    public function terms(string $kind=''): array {return $this->db->all('SELECT * FROM byp_content_terms'.($kind!==''?' WHERE kind=?':'').' ORDER BY title',$kind!==''?[$kind]:[]);}
    public function termSave(array $v): int {
        if(strtolower($this->config['app']['edition']??'')==='commerce'&&in_array(explode('/',$v['slug'])[0],['catalog','product','cart','checkout','order','account','payment-notification'],true))throw new RuntimeException('Этот адрес используется магазином.');
        if(!in_array($v['kind']??'',['category','author'],true)||!preg_match('/^[a-z0-9][a-z0-9-]{0,189}$/D',$v['slug']??'')||trim($v['title']??'')==='')throw new RuntimeException('Заполните название и адрес латиницей.');
        $id=(int)($v['id']??0);$old=$id?$this->db->one('SELECT * FROM byp_content_terms WHERE id=?',[$id]):null;
        if($id&&!$old)throw new RuntimeException('Запись не найдена.');if($old&&$old['kind']!==$v['kind'])throw new RuntimeException('Нельзя изменить тип рубрики или автора.');
        $pdo=$this->db->pdo();$pdo->beginTransaction();try{
            if($old&&$old['slug']!==$v['slug']){foreach($this->records(false,false)as $p)if(($p[$old['kind']]??'')===$old['slug']){ $p[$old['kind']]=$v['slug'];$meta=[];foreach(['cover','cover_alt','category','author','canonical','featured','noindex','create_token_hash','create_payload_hash','category_term_id','author_term_id','price','client','year','location','role','person_id']as $k)$meta[$k]=$p[$k]??'';$meta[$old['kind'].'_term_id']=(int)$old['id'];$this->db->execute('UPDATE byp_content_meta SET data=?,revision=revision+1 WHERE page_id=?',[json_encode($meta,JSON_UNESCAPED_UNICODE),$p['id']]);}}
            $params=[$v['kind'],$v['slug'],mb_substr($v['title'],0,190),mb_substr($v['description']??'',0,5000),self::url($v['image']??'')];
            if($id)$this->db->execute('UPDATE byp_content_terms SET kind=?,slug=?,title=?,description=?,image=? WHERE id=?',[...$params,$id]);else$id=$this->db->insert('INSERT INTO byp_content_terms(kind,slug,title,description,image) VALUES(?,?,?,?,?)',$params);
            if($old&&$old['slug']!==$v['slug']){$source='/'.$old['kind'].'/'.$old['slug'].'/';$target='/'.$old['kind'].'/'.$v['slug'].'/';$this->db->execute('DELETE FROM byp_content_redirects WHERE source=?',[$target]);$this->db->execute('UPDATE byp_content_redirects SET target=? WHERE target=?',[$target,$source]);$this->db->execute('INSERT INTO byp_content_redirects(source,target,code) VALUES(?,?,301) ON DUPLICATE KEY UPDATE target=VALUES(target)',[$source,$target]);}
            $pdo->commit();return $id;
        }catch(Throwable $e){$pdo->rollBack();throw $e;}
    }
    public function restore(int $id,int $revision,int $user): int {$r=$this->db->one('SELECT snapshot FROM byp_page_revisions WHERE id=? AND page_id=?',[$revision,$id]);if(!$r)throw new RuntimeException('Версия не найдена.');$v=json_decode($r['snapshot'],true,32,JSON_THROW_ON_ERROR);$v['id']=$id;foreach(['category','author']as $kind)if(!empty($v[$kind.'_term_id'])){$term=$this->db->one('SELECT slug FROM byp_content_terms WHERE id=? AND kind=?',[(int)$v[$kind.'_term_id'],$kind]);if($term)$v[$kind]=$term['slug'];}$v['revision']=$this->get($id)['revision'];return $this->save($v,$user);}
    public function media(array $q): array {
        $page=max(1,(int)($q['page']??1));$search=mb_substr((string)($q['q']??''),0,100);$where=' WHERE (filename LIKE ? OR alt_text LIKE ?)';$args=['%'.$search.'%','%'.$search.'%'];if(($q['type']??'')==='image')$where.=' AND mime_type LIKE "image/%"';
        $count=(int)$this->db->one('SELECT COUNT(*) n FROM byp_media'.$where,$args)['n'];$page=min($page,max(1,(int)ceil($count/24)));$rows=$this->db->all('SELECT * FROM byp_media'.$where.' ORDER BY created_at DESC,id DESC LIMIT 24 OFFSET '.(($page-1)*24),$args);foreach($rows as &$r){$r['url']='/'.$r['path'];$meta=json_decode($r['metadata']??'{}',true);$r['thumbnail']=!empty($meta['variants'][0]['path'])?'/'.$meta['variants'][0]['path']:$r['url'];}return ['items'=>$rows,'total'=>$count,'page'=>$page,'pages'=>max(1,(int)ceil($count/24))];
    }
    public function upload(array $file,int $user): array {
        if(($file['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK)throw new RuntimeException('Загрузка не завершена. Максимум 10 МБ; проверьте настройки PHP.');
        if($file['size']>10*1024*1024)throw new RuntimeException('Максимальный размер файла — 10 МБ.');
        $mime=(new \finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);$ext=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','image/gif'=>'gif','application/pdf'=>'pdf'][$mime]??null;if(!$ext)throw new RuntimeException('Разрешены JPG, PNG, WebP, GIF и PDF.');
        $dimensions=$ext==='pdf'?null:getimagesize($file['tmp_name']);if($ext!=='pdf'&&(!$dimensions||$dimensions[0]*$dimensions[1]>16000000||max($dimensions[0],$dimensions[1])>16000))throw new RuntimeException('Изображение повреждено или больше 16 мегапикселей. Уменьшите его перед загрузкой.');
        if($ext!=='pdf'&&!extension_loaded('gd'))throw new RuntimeException('Для обработки изображений включите расширение PHP GD.');
        $dir=$this->root.'/uploads/content';if(!is_dir($dir)&&!mkdir($dir,0755,true))throw new RuntimeException('Нет доступа к каталогу загрузок.');
        $name=bin2hex(random_bytes(16)).'.'.$ext;$path='uploads/content/'.$name;
        if(!move_uploaded_file($file['tmp_name'],$this->root.'/'.$path))throw new RuntimeException('Файл не удалось сохранить.');
        $variants=[];
        try{
            if($ext!=='pdf'){
                $source=@imagecreatefromstring((string)file_get_contents($this->root.'/'.$path));if(!$source)throw new RuntimeException('Не удалось обработать изображение.');
                if($mime==='image/jpeg'&&function_exists('exif_read_data')){$exif=@exif_read_data($this->root.'/'.$path);$orientation=(int)($exif['Orientation']??1);if(in_array($orientation,[2,4,5,7],true))imageflip($source,in_array($orientation,[2,5],true)?IMG_FLIP_HORIZONTAL:IMG_FLIP_VERTICAL);$angle=[3=>180,4=>180,5=>-90,6=>-90,7=>90,8=>90][$orientation]??0;if($angle){$rotated=imagerotate($source,$angle,0);imagedestroy($source);$source=$rotated;}}
                $dimensions=[imagesx($source),imagesy($source)];
                foreach([480,1280]as $edge){if($dimensions[0]<=$edge)continue;$width=$edge;$height=max(1,(int)round($dimensions[1]*$width/$dimensions[0]));$thumb=imagecreatetruecolor($width,$height);imagealphablending($thumb,false);imagesavealpha($thumb,true);imagecopyresampled($thumb,$source,0,0,0,0,$width,$height,$dimensions[0],$dimensions[1]);$variant='uploads/content/'.pathinfo($name,PATHINFO_FILENAME).'-'.$edge.'.webp';$variants[]=['path'=>$variant,'width'=>$width,'height'=>$height];if(!imagewebp($thumb,$this->root.'/'.$variant,82))throw new RuntimeException('Не удалось сохранить вариант изображения.');imagedestroy($thumb);}
                imagedestroy($source);
            }
            $id=$this->db->insert('INSERT INTO byp_media(user_id,path,filename,mime_type,size_bytes,width,height,alt_text,metadata,created_at) VALUES(?,?,?,?,?,?,?,"",?,NOW())',[$user,$path,mb_substr(basename($file['name']),0,255),$mime,$file['size'],$dimensions[0]??null,$dimensions[1]??null,json_encode(['variants'=>$variants])]);
        }catch(Throwable $e){if(is_file($this->root.'/'.$path))unlink($this->root.'/'.$path);foreach($variants as $v)if(is_file($this->root.'/'.$v['path']))unlink($this->root.'/'.$v['path']);throw $e;}
        return ['id'=>$id,'url'=>'/'.$path,'filename'=>basename($file['name'])];
    }
    public static function seed(PDO $pdo,int $user,string $site):void {
        self::schema($pdo);$seed=require __DIR__.'/JournalSeed.php';
        $term=$pdo->prepare('INSERT IGNORE INTO byp_content_terms(kind,slug,title,description,image) VALUES(?,?,?,?,?)');foreach($seed['terms']as $t)$term->execute([$t['kind'],$t['slug'],$t['title'],$t['description'],$t['image']??'']);
        $insert=$pdo->prepare('INSERT IGNORE INTO byp_pages(author_id,slug,title,excerpt,content,blocks,template,status,published_at,created_at,updated_at) VALUES(?,?,?,?,?,"[]","journal","published",?,NOW(),NOW())');
        foreach($seed['pages']as $p){$insert->execute([$user,$p['slug'],$p['title'],$p['excerpt'],$p['content'],$p['published_at']]);$id=$pdo->query('SELECT id FROM byp_pages WHERE slug='.$pdo->quote($p['slug']))->fetchColumn();$meta=$pdo->prepare('INSERT IGNORE INTO byp_content_meta(page_id,kind,data,revision) VALUES(?,?,?,1)');$meta->execute([$id,$p['kind'],json_encode(array_intersect_key($p,array_flip(['cover','cover_alt','category','author','featured'])),JSON_UNESCAPED_UNICODE)]);}
    }
}
