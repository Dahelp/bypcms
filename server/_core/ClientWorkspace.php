<?php
declare(strict_types=1);
namespace BYPCMS\Core;
require_once __DIR__.'/Content.php';
require_once __DIR__.'/Business.php';
require_once __DIR__.'/ClientProject.php';

final class ClientWorkspace {
    public Content $content;
    public ?ClientProject $project=null;
    public function __construct(public Database $db,public array $config,public Auth $auth,public string $root,public array $user){
        $this->content=new Content($db,$config,$root);
        $file=$root.'/project/workspace.php';
        if(is_file($file)){
            $provider=(static function($file,$db,$config,$auth,$root){return require $file;})($file,$db,$config,$auth,$root);
            if(!$provider instanceof ClientProject)throw new \RuntimeException('Интеграция темы недоступна. Обратитесь к разработчику.');
            $this->project=$provider;
        }
    }
    public static function available(string $root):bool {
        $config=is_file($root.'/_storage/config.php')?require $root.'/_storage/config.php':[];
        $entry=UpdateRuntime::code($root).'/admin/index.html';
        return strtolower($config['app']['edition']??'')==='business'&&is_file($entry)&&str_contains((string)file_get_contents($entry),'bypcms-client-workspace');
    }
    public static function serve(string $root):void {
        header('Content-Type: text/html; charset=utf-8');header('Cache-Control: no-store');header('X-Robots-Tag: noindex,nofollow');
        readfile(UpdateRuntime::code($root).'/admin/index.html');
    }
    public function administrator():bool {return in_array($this->user['role'],['owner','admin'],true);}
    public function owner():bool {return $this->user['role']==='owner';}
    public function editor():bool {return in_array($this->user['role'],['owner','admin','editor'],true);}
    public function module(string $key):bool {return (bool)$this->db->one('SELECT id FROM byp_modules WHERE module_key=? AND status="active"',[$key]);}
    public function manifest():array {
        $edition=strtolower($this->config['app']['edition']??'');$project=$this->project?->manifest()??[];$nav=[];
        $add=function($id,$label,$group='САЙТ')use(&$nav){$nav[]=['id'=>$id,'label'=>$label,'group'=>$group];};
        if($this->editor()){
            $add('overview','Обзор','');
            if($this->module('content')){
                $add('pages','Страницы');
                if($edition==='business')foreach(['services'=>'Услуги','projects'=>'Проекты','team'=>'Команда']as $id=>$name)if(!in_array($id,$project['hidden_sections']??[],true))$add($id,$name);
                if($edition==='content')foreach(['articles'=>'Материалы','categories'=>'Рубрики','authors'=>'Авторы']as $id=>$name)$add($id,$name);
            }
        }
        if($edition==='business'&&$this->db->one('SELECT id FROM byp_modules WHERE module_key="forms"'))$add('leads','Заявки','ПРОДАЖИ');
        if($this->administrator()&&$edition==='business'&&$this->db->one('SELECT id FROM byp_modules WHERE module_key="forms"'))$add('forms','Форма заявки','ПРОДАЖИ');
        if($this->editor()&&$this->module('content'))$add('media','Медиатека','СИСТЕМА');
        if($this->editor()&&$this->module('seo'))$add('seo','SEO','ПРОДВИЖЕНИЕ');
        if($this->administrator()){
            $add('design','Дизайн и меню','СИСТЕМА');
            foreach($project['sections']??[]as $id=>$label)$add($id,$label,'НАСТРОЙКИ САЙТА');
            if($edition==='business')$add('mail','Почта и уведомления','СИСТЕМА');
            $add('users','Пользователи и доступ','СИСТЕМА');$add('extensions','Модули сборки','СИСТЕМА');
            if($this->owner()){$add('license','Лицензия','СИСТЕМА');$add('updates','Обновления','СИСТЕМА');}
        }
        $settings=$edition==='business'?(new Business($this->db,$this->config,$this->root))->settings():$this->content->settings();
        return ['edition'=>$edition,'version'=>$this->config['app']['version'],'site_name'=>$settings['site_name']??$this->config['app']['name'],'theme'=>$project['theme']??$settings['theme']??'','locales'=>$project['locales']??['ru'],'navigation'=>$nav,'project'=>$project,'user'=>['id'=>$this->user['id'],'name'=>$this->user['name'],'role'=>$this->user['role']],'modules'=>$this->db->all('SELECT module_key,name,version,status FROM byp_modules ORDER BY name')];
    }
    public function assertSection(string $section):void {if(!in_array($section,array_column($this->manifest()['navigation'],'id'),true))throw new \DomainException('Раздел не входит в сборку или недоступен вашей роли.');}
    public function kind(string $section):string {
        $this->assertSection($section);$kinds=['pages'=>'page','articles'=>'article','services'=>'service','projects'=>'project','team'=>'person'];
        if(!isset($kinds[$section]))throw new \InvalidArgumentException('Выберите раздел материалов.');return $kinds[$section];
    }
    public function get(int $id,string $section):array {
        $record=$this->content->get($id);
        if(!$record||$record['kind']!==$this->kind($section)||($this->project&&!$this->project->owns($record)))throw new \DomainException('Запись недоступна в этом разделе.');return $record;
    }
    public function describe(array $record):array {
        $record['public_url']=$this->project?$this->project->url($record):($record['slug']==='home'?'/':'/'.trim($record['slug'],'/').'/');
        return $this->project?$this->project->record($record):$record;
    }
    public function listing(string $section,array $query):array {
        $kind=$this->kind($section);$params=[$kind];$where=['COALESCE(m.kind,"page")=?'];
        $status=(string)($query['status']??'');if($status!==''){if(!in_array($status,['draft','published','scheduled','archived'],true))throw new \InvalidArgumentException('Неизвестный статус.');$where[]='p.status=?';$params[]=$status;}
        $search=mb_substr(trim((string)($query['q']??'')),0,150);if($search!==''){$where[]='(p.title LIKE ? OR p.slug LIKE ?)';$params[]='%'.$search.'%';$params[]='%'.$search.'%';}
        $spec=$this->project?->manifest()??[];if(!empty($spec['content_prefix'])){$where[]='(p.slug LIKE ? OR m.kind="person")';$params[]=$spec['content_prefix'].'%';}
        $sql=implode(' AND ',$where);$total=(int)$this->db->one('SELECT COUNT(*) n FROM byp_pages p LEFT JOIN byp_content_meta m ON m.page_id=p.id WHERE '.$sql,$params)['n'];
        $pages=max(1,(int)ceil($total/12));$page=min($pages,max(1,(int)($query['page']??1)));$order=($query['sort']??'')==='title'?'p.title,p.id':'p.updated_at DESC,p.id DESC';
        $rows=$this->db->all('SELECT p.id FROM byp_pages p LEFT JOIN byp_content_meta m ON m.page_id=p.id WHERE '.$sql.' ORDER BY '.$order.' LIMIT 12 OFFSET '.(($page-1)*12),$params);
        return ['rows'=>array_map(fn($row)=>$this->describe($this->content->get((int)$row['id'])),$rows),'total'=>$total,'page'=>$page,'pages'=>$pages,'can_create'=>!in_array($section,$spec['fixed_sections']??[],true)];
    }
    public function save(string $section,array $input):array {
        $kind=$this->kind($section);$id=(int)($input['id']??0);$previous=$id?$this->get($id,$section):null;
        if(!$id&&in_array($section,$this->project?->manifest()['fixed_sections']??[],true))throw new \DomainException('Структура этой темы фиксирована. Изменяйте существующие страницы.');
        $input['kind']=$kind;if($previous)$input['id']=$id;
        if($this->project)$input=$this->project->prepare($input,$previous);
        $saved=$this->content->save($input,(int)$this->user['id']);if($this->project)$this->project->saved($this->content->get($saved));return ['id'=>$saved,'record'=>$this->describe($this->content->get($saved))];
    }
    public function bulk(string $section,array $input):array {
        $ids=array_values(array_unique(array_map('intval',(array)($input['ids']??[]))));$status=$input['status']??'';
        if(!$ids||count($ids)>100||!in_array($status,['published','draft','archived'],true))throw new \InvalidArgumentException('Выберите записи и допустимый статус.');
        $succeeded=[];$failed=[];
        foreach($ids as $id)try{$old=$this->get($id,$section);$data=$old;$data['status']=$status;if($status==='published')$data['published_at']=gmdate('Y-m-d H:i:s');$this->save($section,$data);$succeeded[]=$id;}catch(\Throwable $error){$failed[]=['id'=>$id,'error'=>$error instanceof \PDOException?'Запись временно недоступна.':$error->getMessage()];}
        return ['succeeded'=>$succeeded,'failed'=>$failed];
    }
    public static function field(string $name,string $label,mixed $value='',string $type='text',array $options=[]):array {return compact('name','label','value','type','options');}
    public function settings(string $section):array {
        $this->assertSection($section);if(!$this->administrator())throw new \DomainException('Настройки доступны администратору.');
        if($this->project&&($section==='design'||isset($this->project->manifest()['sections'][$section])))return $this->project->settings($section);
        if($section==='design'){
            $edition=strtolower($this->config['app']['edition']);$s=$edition==='business'?(new Business($this->db,$this->config,$this->root))->settings():$this->content->settings();$themes=$edition==='business'?['atelier','corporate','mono']:['journal','chronicle','focus'];
            if(is_file($this->root.'/themes/custom/page.html'))$themes[]='custom';
            if(($s['theme']??'')==='custom')return ['title'=>'Дизайн и меню · Индивидуальный макет','description'=>'Индивидуальный HTML-макет. Его специальные настройки подключаются разработчиком через интеграцию проекта. Вы можете выбрать одну из установленных стандартных тем.','fields'=>[self::field('site_name','Название сайта',$s['site_name']),self::field('theme','Тема сайта','custom','select',array_combine($themes,array_map('ucfirst',$themes)))]];
            $fields=[];foreach(['site_name'=>'Название сайта','tagline'=>'Подпись сайта','email'=>'Контактный email','phone'=>'Телефон','logo'=>'Адрес логотипа','accent'=>'Акцентный цвет']as $key=>$label)$fields[]=self::field($key,$label,$s[$key]??'',$key==='accent'?'color':'text');
            $fields[]=self::field('font','Шрифт текста',$s['font']??'manrope','select',['manrope'=>'Manrope','system'=>'Системный']);
            $fields[]=self::field('heading_font','Шрифт заголовков',$s['heading_font']??'manrope','select',['manrope'=>'Manrope','georgia'=>'Georgia']);
            $fields[]=self::field('theme','Тема сайта',$s['theme']??$themes[0],'select',array_combine($themes,array_map('ucfirst',$themes)));
            foreach(['menu'=>'Меню в шапке','footer_menu'=>'Меню в подвале']as $key=>$label)$fields[]=self::field($key,$label,$s[$key]??[],'menu');
            return ['title'=>'Дизайн и меню · '.ucfirst($s['theme']),'description'=>'Настройки активного макета сайта. Изменения применяются после сохранения.','fields'=>$fields];
        }
        if($section==='forms')return ['title'=>'Форма заявки','description'=>'Отключение приёма не удаляет заявки и историю писем.','fields'=>[self::field('forms_enabled','Принимать заявки через сайт',$this->module('forms'),'checkbox')]];
        if($section==='mail'){
            $s=(new Business($this->db,$this->config,$this->root))->mailSettings();$fields=[self::field('smtp_enabled','Включить отправку SMTP',$s['smtp_enabled'],'checkbox')];
            foreach(['smtp_host'=>'Сервер SMTP','smtp_port'=>'Порт','smtp_user'=>'Логин SMTP','from_email'=>'Email отправителя','from_name'=>'Имя отправителя','owner_email'=>'Получатель заявок']as $key=>$label)$fields[]=self::field($key,$label,$s[$key]);
            $fields[]=self::field('smtp_security','Защита',$s['smtp_security'],'select',['starttls'=>'STARTTLS','ssl'=>'SSL']);$fields[]=self::field('smtp_password','Новый пароль SMTP (пусто — сохранить прежний)','','password');
            return ['title'=>'Почта и уведомления','description'=>!empty($s['smtp_password_saved'])?'Пароль сохранён. Его значение не отображается.':'Подключение используется для уведомлений о заявках.','fields'=>$fields];
        }
        throw new \InvalidArgumentException('Настройки не найдены.');
    }
    public function saveSettings(string $section,array $input):void {
        $this->settings($section);
        if($this->project&&($section==='design'||isset($this->project->manifest()['sections'][$section]))){$this->project->saveSettings($section,$input);return;}
        if($section==='design'){$this->content->configure($input);return;}
        if($section==='forms'){$this->db->execute('UPDATE byp_modules SET status=?,updated_at=NOW() WHERE module_key="forms"',[!empty($input['forms_enabled'])?'active':'inactive']);return;}
        if($section==='mail'){(new Business($this->db,$this->config,$this->root))->configureMail($input);return;}
    }
    public function saveUser(array $input):void {
        $this->assertSection('users');$name=trim((string)($input['name']??''));$email=trim((string)($input['email']??''));$role=$input['role']??'';$password=(string)($input['password']??'');$id=(int)($input['id']??0);
        if(!$name||mb_strlen($name)>150||!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($email)>190||!in_array($role,['editor','manager'],true)||(($password!==''||!$id)&&strlen($password)<12))throw new \InvalidArgumentException('Укажите имя, email, роль и пароль от 12 символов для нового пользователя.');
        if($id){$old=$this->db->one('SELECT u.id,r.slug role FROM byp_users u JOIN byp_roles r ON r.id=u.role_id WHERE u.id=?',[$id]);if(!$old||!in_array($old['role'],['editor','manager'],true)||(int)$this->user['id']===$id)throw new \DomainException('Эта учётная запись недоступна для изменения.');}
        $pdo=$this->db->pdo();$pdo->beginTransaction();try{
            $this->db->execute('INSERT IGNORE INTO byp_roles(slug,name,permissions,created_at,updated_at) VALUES(?, ?,"[]",NOW(),NOW())',[$role,$role==='editor'?'Редактор':'Менеджер']);$rid=$this->db->one('SELECT id FROM byp_roles WHERE slug=?',[$role])['id'];$status=($input['status']??'active')==='blocked'?'blocked':'active';
            if($id){$this->db->execute('UPDATE byp_users SET role_id=?,name=?,email=?,status=?,updated_at=NOW() WHERE id=?',[$rid,$name,$email,$status,$id]);if($password!=='')$this->db->execute('UPDATE byp_users SET password_hash=? WHERE id=?',[password_hash($password,PASSWORD_DEFAULT),$id]);}
            else $id=$this->db->insert('INSERT INTO byp_users(role_id,name,email,password_hash,status,created_at,updated_at) VALUES(?,?,?,?,?,NOW(),NOW())',[$rid,$name,$email,password_hash($password,PASSWORD_DEFAULT),$status]);
            $this->db->execute('INSERT INTO byp_audit_logs(user_id,action,entity_type,entity_id,created_at) VALUES(?,"business.staff.save","user",?,NOW())',[$this->user['id'],$id]);$pdo->commit();
        }catch(\Throwable $error){$pdo->rollBack();throw $error;}
    }
}
