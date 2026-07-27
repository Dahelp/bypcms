<?php
declare(strict_types=1);

use BYPCMS\Core\Response;

require_once __DIR__ . '/../_core/bootstrap.php';

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$action = (string)($_GET['action'] ?? 'status');
$input = byp_input();

if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    if ($action === 'status' && $method === 'GET') {
        $db->one('SELECT 1 AS healthy');
        Response::ok([
            'service' => 'BYPCMS API',
            'version' => (string)($config['app']['version'] ?? '2.0.0'),
            'php' => PHP_VERSION,
            'database' => 'connected',
            'installed' => true,
        ]);
    }

    if ($action === 'auth.login' && $method === 'POST') {
        $email = (string)($input['email'] ?? '');
        $password = (string)($input['password'] ?? '');
        if ($email === '' || $password === '') {
            Response::error('Введите email и пароль', 422);
        }
        $user = $auth->attempt($email, $password);
        if (!$user) {
            Response::error('Неверный email или пароль', 401);
        }
        byp_audit($db, $user, 'auth.login', 'user', (int)$user['id']);
        Response::ok(['user' => $user, 'csrf' => $_SESSION['csrf']]);
    }

    if ($action === 'auth.me' && $method === 'GET') {
        $user = $auth->requireUser();
        Response::ok(['user' => $user, 'csrf' => (string)($_SESSION['csrf'] ?? '')]);
    }

    if ($action === 'auth.logout' && $method === 'POST') {
        $user = $auth->requireUser();
        $auth->verifyCsrf();
        byp_audit($db, $user, 'auth.logout', 'user', (int)$user['id']);
        $auth->logout();
        Response::ok();
    }

    $user = $auth->requireUser();
    if ($method !== 'GET') {
        $auth->verifyCsrf();
    }

    if (str_starts_with($action, 'owner.')) {
        if (($user['role'] ?? '') !== 'owner') {
            Response::error('Доступ разрешён только владельцу платформы', 403);
        }

        if ($action === 'owner.bootstrap' && $method === 'GET') {
            if ((int)($db->one('SELECT COUNT(*) AS total FROM byp_module_catalog')['total'] ?? 0) === 0) {
                $catalog = [
                    ['content', 'Контент', 'Базовый', 'Страницы, блоки, меню, медиа и версии', '2.1.0', 0],
                    ['seo', 'SEO Pro', 'Маркетинг', 'Метаданные, sitemap, редиректы и аудит', '1.8.2', 5900],
                    ['forms', 'Формы и CRM', 'Продажи', 'Формы, обращения, статусы и уведомления', '1.4.0', 9900],
                    ['commerce', 'Commerce', 'Интернет-магазин', 'Каталог, корзина, заказы и промокоды', '2.0.1', 14900],
                    ['payments', 'Платежи', 'Интернет-магазин', 'ЮKassa, СБП, чеки и возвраты', '1.3.0', 7900],
                    ['analytics', 'Аналитика', 'Маркетинг', 'События, цели, воронки и отчёты', '1.2.4', 5900],
                ];
                foreach ($catalog as $module) {
                    $db->execute(
                        'INSERT IGNORE INTO byp_module_catalog
                         (module_key,name,category,description,current_version,price,compatibility,status,created_at,updated_at)
                         VALUES (:key,:name,:category,:description,:version,:price,"Core >= 2.0","published",NOW(),NOW())',
                        ['key'=>$module[0],'name'=>$module[1],'category'=>$module[2],'description'=>$module[3],'version'=>$module[4],'price'=>$module[5]]
                    );
                }
            }
            if ((int)($db->one('SELECT COUNT(*) AS total FROM byp_services')['total'] ?? 0) === 0) {
                $services = [
                    ['ux-ui', 'UX/UI-дизайн', 'Исследование, прототип и дизайн-система', 65000, 'проект'],
                    ['frontend', 'Frontend-разработка', 'Адаптивная реализация утверждённого дизайна', 85000, 'проект'],
                    ['launch', 'Запуск и настройка', 'Развёртывание, интеграции и обучение', 25000, 'проект'],
                    ['migration', 'Перенос данных', 'Импорт материалов из прежней системы', 18000, 'проект'],
                    ['support', 'Сопровождение', 'Поддержка, мониторинг и развитие', 12000, 'месяц'],
                ];
                foreach ($services as $service) {
                    $db->execute(
                        'INSERT IGNORE INTO byp_services
                         (service_key,name,description,price_from,billing_unit,status,created_at,updated_at)
                         VALUES (:key,:name,:description,:price,:unit,"active",NOW(),NOW())',
                        ['key'=>$service[0],'name'=>$service[1],'description'=>$service[2],'price'=>$service[3],'unit'=>$service[4]]
                    );
                }
            }
            $db->execute(
                'INSERT INTO byp_owner_notifications (notification_type,title,message,entity_type,entity_id,severity,is_read,created_at)
                 SELECT "license_expiry", "Заканчивается лицензия",
                        CONCAT(COALESCE(c.company,c.name,"Клиент"), ": ", l.domain, " — до ", DATE_FORMAT(l.valid_until,"%d.%m.%Y")),
                        "license", l.id, "warning", 0, NOW()
                 FROM byp_license_registry l LEFT JOIN byp_clients c ON c.id=l.client_id
                 WHERE l.valid_until BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)
                   AND NOT EXISTS (SELECT 1 FROM byp_owner_notifications n WHERE n.notification_type="license_expiry" AND n.entity_id=l.id AND n.created_at>DATE_SUB(NOW(),INTERVAL 7 DAY))'
            );
            $db->execute(
                'INSERT INTO byp_owner_notifications (notification_type,title,message,entity_type,entity_id,severity,is_read,created_at)
                 SELECT "task_overdue", "Просрочена договорная работа",
                        CONCAT(COALESCE(c.company,c.name), ": ", t.title), "client_task", t.id, "danger", 0, NOW()
                 FROM byp_client_tasks t JOIN byp_clients c ON c.id=t.client_id
                 WHERE t.due_at < NOW() AND t.status NOT IN ("done","blocked")
                   AND NOT EXISTS (SELECT 1 FROM byp_owner_notifications n WHERE n.notification_type="task_overdue" AND n.entity_id=t.id AND n.created_at>DATE_SUB(NOW(),INTERVAL 1 DAY))'
            );
            $settingsRows = $db->all('SELECT setting_key, setting_value FROM byp_owner_settings');
            $settings = [];
            foreach ($settingsRows as $row) $settings[$row['setting_key']] = $row['setting_value'];
            $clients = $db->all(
                'SELECT c.*,
                    (SELECT COUNT(*) FROM byp_client_tasks t WHERE t.client_id=c.id) AS task_count,
                    (SELECT COUNT(*) FROM byp_client_tasks t WHERE t.client_id=c.id AND t.status="done") AS done_count,
                    (SELECT COALESCE(SUM(t.price),0) FROM byp_client_tasks t WHERE t.client_id=c.id) AS contract_total
                 FROM byp_clients c ORDER BY c.updated_at DESC'
            );
            $licenses = $db->all(
                'SELECT l.id,l.client_id,l.license_hint,l.domain,l.edition,l.core_version,l.installed_version,
                        l.entitlements,l.status,l.activated_at,l.valid_until,l.last_seen_at,l.created_at,l.updated_at,
                        COALESCE(c.company,c.name,"Без клиента") AS client_name
                 FROM byp_license_registry l LEFT JOIN byp_clients c ON c.id=l.client_id ORDER BY l.updated_at DESC'
            );
            $tasks = $db->all(
                'SELECT t.*, COALESCE(c.company,c.name) AS client_name, s.name AS service_name
                 FROM byp_client_tasks t JOIN byp_clients c ON c.id=t.client_id
                 LEFT JOIN byp_services s ON s.id=t.service_id ORDER BY t.updated_at DESC'
            );
            $orders = $db->all('SELECT * FROM byp_orders ORDER BY updated_at DESC LIMIT 200');
            $builds = $db->all('SELECT * FROM byp_builds ORDER BY updated_at DESC LIMIT 100');
            $notifications = $db->all('SELECT * FROM byp_owner_notifications ORDER BY is_read, created_at DESC LIMIT 100');
            Response::ok([
                'user'=>$user,
                'clients'=>$clients,
                'licenses'=>$licenses,
                'tasks'=>$tasks,
                'services'=>$db->all('SELECT * FROM byp_services ORDER BY name'),
                'modules'=>$db->all('SELECT * FROM byp_module_catalog ORDER BY category,name'),
                'edition_modules'=>$db->all('SELECT edition,module_key,availability FROM byp_edition_modules ORDER BY edition,module_key'),
                'orders'=>$orders,
                'builds'=>$builds,
                'notifications'=>$notifications,
                'settings'=>$settings,
                'csrf'=>(string)($_SESSION['csrf'] ?? ''),
            ]);
        }

        if ($action === 'owner.client.save' && $method === 'POST') {
            $id = (int)($input['id'] ?? 0);
            $name = trim((string)($input['name'] ?? ''));
            if ($name === '') Response::error('Укажите имя клиента', 422);
            $params = [
                'name'=>$name, 'email'=>trim((string)($input['email'] ?? '')),
                'phone'=>trim((string)($input['phone'] ?? '')), 'company'=>trim((string)($input['company'] ?? '')),
                'status'=>in_array(($input['status'] ?? ''), ['lead','active','paused','closed'], true) ? $input['status'] : 'active',
                'notes'=>(string)($input['notes'] ?? ''),
            ];
            if ($id > 0) {
                $params['id'] = $id;
                $db->execute('UPDATE byp_clients SET name=:name,email=:email,phone=:phone,company=:company,status=:status,notes=:notes,updated_at=NOW() WHERE id=:id', $params);
            } else {
                $id = $db->insert('INSERT INTO byp_clients (name,email,phone,company,status,notes,created_at,updated_at) VALUES (:name,:email,:phone,:company,:status,:notes,NOW(),NOW())', $params);
            }
            byp_audit($db,$user,'owner.client.save','client',$id);
            Response::ok(['id'=>$id]);
        }

        if ($action === 'owner.task.save' && $method === 'POST') {
            $id = (int)($input['id'] ?? 0);
            $clientId = (int)($input['client_id'] ?? 0);
            $title = trim((string)($input['title'] ?? ''));
            if ($clientId < 1 || $title === '') Response::error('Выберите клиента и укажите задачу', 422);
            $status = in_array(($input['status'] ?? ''), ['planned','in_progress','review','done','blocked'], true) ? $input['status'] : 'planned';
            $progress = max(0,min(100,(int)($input['progress'] ?? ($status === 'done' ? 100 : 0))));
            $params = [
                'client'=>$clientId,'title'=>$title,'description'=>(string)($input['description'] ?? ''),
                'contract'=>trim((string)($input['contract_ref'] ?? '')),'service'=>(int)($input['service_id'] ?? 0) ?: null,
                'assignee'=>trim((string)($input['assignee'] ?? '')),'status'=>$status,'progress'=>$progress,
                'price'=>(float)($input['price'] ?? 0),'due'=>!empty($input['due_at']) ? (string)$input['due_at'] : null,
                'completed'=>$status === 'done' ? date('Y-m-d H:i:s') : null,
            ];
            if ($id > 0) {
                $params['id']=$id;
                $db->execute('UPDATE byp_client_tasks SET client_id=:client,title=:title,description=:description,contract_ref=:contract,
                    service_id=:service,assignee=:assignee,status=:status,progress=:progress,price=:price,due_at=:due,
                    completed_at=:completed,updated_at=NOW() WHERE id=:id',$params);
            } else {
                $id=$db->insert('INSERT INTO byp_client_tasks (client_id,title,description,contract_ref,service_id,assignee,status,progress,price,due_at,completed_at,created_at,updated_at)
                    VALUES (:client,:title,:description,:contract,:service,:assignee,:status,:progress,:price,:due,:completed,NOW(),NOW())',$params);
            }
            byp_audit($db,$user,'owner.task.save','client_task',$id);
            Response::ok(['id'=>$id]);
        }

        if ($action === 'owner.service.save' && $method === 'POST') {
            $id=(int)($input['id'] ?? 0);
            $name=trim((string)($input['name'] ?? ''));
            if ($name==='') Response::error('Укажите название услуги',422);
            $key=preg_replace('/[^a-z0-9_-]/','',mb_strtolower((string)($input['service_key'] ?? '')));
            if ($key==='') $key='service-'.bin2hex(random_bytes(4));
            $params=['key'=>$key,'name'=>$name,'description'=>(string)($input['description'] ?? ''),'price'=>(float)($input['price_from'] ?? 0),
                'unit'=>trim((string)($input['billing_unit'] ?? 'проект')),'status'=>($input['status'] ?? '')==='inactive'?'inactive':'active'];
            if($id>0){$params['id']=$id;$db->execute('UPDATE byp_services SET service_key=:key,name=:name,description=:description,price_from=:price,billing_unit=:unit,status=:status,updated_at=NOW() WHERE id=:id',$params);}
            else{$id=$db->insert('INSERT INTO byp_services (service_key,name,description,price_from,billing_unit,status,created_at,updated_at) VALUES (:key,:name,:description,:price,:unit,:status,NOW(),NOW())',$params);}
            byp_audit($db,$user,'owner.service.save','service',$id);
            Response::ok(['id'=>$id]);
        }

        if ($action === 'owner.license.save' && $method === 'POST') {
            $id=(int)($input['id'] ?? 0);
            $client=(int)($input['client_id'] ?? 0);
            $edition=(string)($input['edition'] ?? 'Business');
            if($client<1 || !in_array($edition,['Business','Commerce','Content'],true)) Response::error('Выберите клиента и редакцию',422);
            $entitlements=array_values(array_filter((array)($input['entitlements'] ?? [])));
            $params=['client'=>$client,'domain'=>trim((string)($input['domain'] ?? '')),'edition'=>$edition,
                'core'=>(string)($input['core_version'] ?? '2.1.0'),'installed'=>(string)($input['installed_version'] ?? ''),
                'entitlements'=>json_encode($entitlements,JSON_UNESCAPED_UNICODE),'status'=>(string)($input['status'] ?? 'active'),
                'until'=>!empty($input['valid_until'])?(string)$input['valid_until']:null];
            if($id>0){$params['id']=$id;$db->execute('UPDATE byp_license_registry SET client_id=:client,domain=:domain,edition=:edition,core_version=:core,
                installed_version=:installed,entitlements=:entitlements,status=:status,valid_until=:until,updated_at=NOW() WHERE id=:id',$params);}
            else{
                $plain='BYP-'.strtoupper(substr($edition,0,3)).'-'.strtoupper(bin2hex(random_bytes(6)));
                $params['hash']=hash('sha256',$plain);$params['hint']=substr($plain,0,11).'••••';
                $id=$db->insert('INSERT INTO byp_license_registry (client_id,license_key_hash,license_hint,domain,edition,core_version,installed_version,entitlements,status,activated_at,valid_until,created_at,updated_at)
                    VALUES (:client,:hash,:hint,:domain,:edition,:core,:installed,:entitlements,:status,NOW(),:until,NOW(),NOW())',$params);
            }
            byp_audit($db,$user,'owner.license.save','license',$id);
            Response::ok(['id'=>$id]);
        }

        if ($action === 'owner.module.save' && $method === 'POST') {
            $id=(int)($input['id'] ?? 0);$key=preg_replace('/[^a-z0-9_-]/','',mb_strtolower((string)($input['module_key'] ?? '')));
            $name=trim((string)($input['name'] ?? ''));if($key===''||$name==='')Response::error('Укажите ключ и название модуля',422);
            $params=['key'=>$key,'name'=>$name,'category'=>(string)($input['category'] ?? 'Расширение'),'description'=>(string)($input['description'] ?? ''),
                'version'=>(string)($input['current_version'] ?? '1.0.0'),'price'=>(float)($input['price'] ?? 0),
                'compatibility'=>(string)($input['compatibility'] ?? 'Core >= 2.0'),'status'=>(string)($input['status'] ?? 'published')];
            if($id>0){$params['id']=$id;$db->execute('UPDATE byp_module_catalog SET module_key=:key,name=:name,category=:category,description=:description,current_version=:version,price=:price,compatibility=:compatibility,status=:status,updated_at=NOW() WHERE id=:id',$params);}
            else{$id=$db->insert('INSERT INTO byp_module_catalog (module_key,name,category,description,current_version,price,compatibility,status,created_at,updated_at) VALUES (:key,:name,:category,:description,:version,:price,:compatibility,:status,NOW(),NOW())',$params);}
            foreach(['Business','Commerce','Content'] as $editionName){
                $availability=(string)($input['availability'][$editionName] ?? 'hidden');
                $db->execute('INSERT INTO byp_edition_modules (edition,module_key,availability) VALUES (:edition,:key,:availability)
                    ON DUPLICATE KEY UPDATE availability=VALUES(availability)',['edition'=>$editionName,'key'=>$key,'availability'=>$availability]);
            }
            byp_audit($db,$user,'owner.module.save','module_catalog',$id);
            Response::ok(['id'=>$id]);
        }

        if ($action === 'owner.settings.save' && $method === 'POST') {
            foreach ((array)($input['settings'] ?? []) as $key=>$value) {
                $clean=preg_replace('/[^a-z0-9_.-]/','',mb_strtolower((string)$key));
                if($clean==='')continue;
                $db->execute('INSERT INTO byp_owner_settings (setting_key,setting_value,updated_by,updated_at) VALUES (:key,:value,:user,NOW())
                    ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value),updated_by=VALUES(updated_by),updated_at=NOW()',
                    ['key'=>$clean,'value'=>is_scalar($value)?(string)$value:json_encode($value,JSON_UNESCAPED_UNICODE),'user'=>$user['id']]);
            }
            byp_audit($db,$user,'owner.settings.save','owner_settings');
            Response::ok();
        }

        if ($action === 'owner.notification.read' && $method === 'POST') {
            $id=(int)($input['id'] ?? 0);
            if($id>0)$db->execute('UPDATE byp_owner_notifications SET is_read=1,read_at=NOW() WHERE id=:id',['id'=>$id]);
            else$db->execute('UPDATE byp_owner_notifications SET is_read=1,read_at=NOW() WHERE is_read=0');
            Response::ok();
        }
    }

    if ($action === 'build.download' && $method === 'GET') {
        if (!class_exists('ZipArchive')) {
            Response::error('На сервере не включено расширение PHP ZipArchive', 501);
        }
        $edition = preg_replace('/[^a-zA-Z0-9_-]/', '', (string)($_GET['edition'] ?? 'Business'));
        $requested = array_values(array_filter(explode(',', (string)($_GET['modules'] ?? 'content'))));
        $editionRows = $db->all(
            'SELECT module_key, availability FROM byp_edition_modules WHERE edition=:edition AND availability IN ("included","optional")',
            ['edition'=>$edition]
        );
        $allowed = array_column($editionRows, 'module_key');
        $included = array_column(array_values(array_filter($editionRows, fn(array $row): bool => $row['availability'] === 'included')), 'module_key');
        $selected = array_values(array_unique(array_merge($included, array_intersect($requested, $allowed))));
        $buildId = 'bypcms-' . strtolower($edition) . '-' . date('Ymd-His');
        $archivePath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . $buildId . '.zip';
        $zip = new ZipArchive();
        if ($zip->open($archivePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            Response::error('Не удалось создать архив сборки', 500);
        }
        $root = realpath(BYPCMS_ROOT);
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if (!$file->isFile()) continue;
            $full = $file->getRealPath();
            $relative = str_replace('\\', '/', substr($full, strlen($root) + 1));
            if (str_starts_with($relative, '_storage/') || str_starts_with($relative, '.git/')) continue;
            $zip->addFile($full, 'site/' . $relative);
        }
        $schema = require BYPCMS_ROOT . '/_core/schema.php';
        $zip->addFromString('database.sql', implode(";\n\n", $schema) . ";\n");
        $zip->addFromString('build-manifest.json', json_encode([
            'product' => 'BYPCMS',
            'edition' => $edition,
            'core_version' => (string)($config['app']['version'] ?? '2.1.0'),
            'modules' => $selected,
            'created_at' => date(DATE_ATOM),
            'installer' => 'site/install/index.php',
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $zip->addFromString('README.txt', "BYPCMS {$edition}\n\n1. Загрузите содержимое папки site на сервер.\n2. Откройте /install/.\n3. Укажите параметры MySQL и создайте владельца.\n");
        $zip->close();
        $moduleRows = $selected ? $db->all(
            'SELECT module_key, price FROM byp_module_catalog WHERE module_key IN (' . implode(',', array_fill(0,count($selected),'?')) . ')',
            $selected
        ) : [];
        $optionalKeys = array_values(array_diff($selected,$included));
        $moduleTotal = array_reduce($moduleRows, fn(float $sum,array $row): float => $sum + (in_array($row['module_key'],$optionalKeys,true) ? (float)$row['price'] : 0), 0.0);
        $corePrices=['Business'=>24900,'Commerce'=>49900,'Content'=>19900];
        $buildKey='BLD-'.strtoupper(bin2hex(random_bytes(5)));
        $db->execute(
            'INSERT INTO byp_builds (build_key,name,edition,core_version,modules,services,total,archive_path,status,created_at,updated_at)
             VALUES (:key,:name,:edition,:core,:modules,"[]",:total,:archive,"ready",NOW(),NOW())',
            ['key'=>$buildKey,'name'=>$buildId,'edition'=>$edition,'core'=>(string)($config['app']['version'] ?? '2.1.0'),
             'modules'=>json_encode($selected,JSON_UNESCAPED_UNICODE),'total'=>(float)($corePrices[$edition] ?? 24900)+$moduleTotal,'archive'=>$buildId.'.zip']
        );
        byp_audit($db, $user, 'build.download', 'build', null, ['edition' => $edition, 'modules' => $selected]);
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . $buildId . '.zip"');
        header('Content-Length: ' . filesize($archivePath));
        readfile($archivePath);
        @unlink($archivePath);
        exit;
    }

    if ($action === 'dashboard' && $method === 'GET') {
        $counts = [
            'pages' => (int)($db->one('SELECT COUNT(*) AS total FROM byp_pages')['total'] ?? 0),
            'published' => (int)($db->one('SELECT COUNT(*) AS total FROM byp_pages WHERE status = "published"')['total'] ?? 0),
            'users' => (int)($db->one('SELECT COUNT(*) AS total FROM byp_users WHERE status = "active"')['total'] ?? 0),
            'modules' => (int)($db->one('SELECT COUNT(*) AS total FROM byp_modules WHERE status = "active"')['total'] ?? 0),
            'submissions' => (int)($db->one('SELECT COUNT(*) AS total FROM byp_form_submissions WHERE status = "new"')['total'] ?? 0),
        ];
        $recentPages = $db->all('SELECT id, title, slug, status, updated_at FROM byp_pages ORDER BY updated_at DESC LIMIT 5');
        $license = $db->one('SELECT edition, domain, status, valid_until, updated_at FROM byp_licenses ORDER BY id DESC LIMIT 1');
        $modules = $db->all('SELECT module_key, name, version, status, updated_at FROM byp_modules ORDER BY name');
        Response::ok([
            'counts' => $counts,
            'recent_pages' => $recentPages,
            'license' => $license,
            'modules' => $modules,
            'health' => ['score' => 100, 'core' => (string)($config['app']['version'] ?? '2.0.0'), 'environment' => 'production'],
        ]);
    }

    if ($action === 'pages.list' && $method === 'GET') {
        Response::ok(['pages' => $db->all(
            'SELECT p.id, p.parent_id, p.slug, p.title, p.excerpt, p.template, p.status, p.published_at, p.created_at, p.updated_at,
                    u.name AS author_name
             FROM byp_pages p LEFT JOIN byp_users u ON u.id = p.author_id ORDER BY p.updated_at DESC'
        )]);
    }

    if ($action === 'pages.create' && $method === 'POST') {
        $title = trim((string)($input['title'] ?? ''));
        $slug = trim((string)($input['slug'] ?? ''));
        if ($title === '' || !preg_match('/^[a-z0-9][a-z0-9\-\/]*$/', $slug)) {
            Response::error('Укажите заголовок и корректный URL', 422);
        }
        $id = $db->insert(
            'INSERT INTO byp_pages (author_id, slug, title, excerpt, content, blocks, template, status, created_at, updated_at)
             VALUES (:author, :slug, :title, :excerpt, :content, :blocks, :template, :status, NOW(), NOW())',
            [
                'author' => $user['id'],
                'slug' => $slug,
                'title' => $title,
                'excerpt' => (string)($input['excerpt'] ?? ''),
                'content' => (string)($input['content'] ?? ''),
                'blocks' => json_encode($input['blocks'] ?? [], JSON_UNESCAPED_UNICODE),
                'template' => (string)($input['template'] ?? 'default'),
                'status' => in_array(($input['status'] ?? ''), ['draft', 'published'], true) ? $input['status'] : 'draft',
            ]
        );
        byp_audit($db, $user, 'page.create', 'page', $id);
        Response::ok(['id' => $id]);
    }

    if ($action === 'pages.update' && $method === 'POST') {
        $id = (int)($input['id'] ?? 0);
        $page = $db->one('SELECT * FROM byp_pages WHERE id = :id', ['id' => $id]);
        if (!$page) {
            Response::error('Страница не найдена', 404);
        }
        $db->execute(
            'INSERT INTO byp_page_revisions (page_id, user_id, snapshot, created_at) VALUES (:page, :user, :snapshot, NOW())',
            ['page' => $id, 'user' => $user['id'], 'snapshot' => json_encode($page, JSON_UNESCAPED_UNICODE)]
        );
        $db->execute(
            'UPDATE byp_pages SET title=:title, slug=:slug, excerpt=:excerpt, content=:content, blocks=:blocks,
             template=:template, status=:status, published_at=IF(:status2="published", COALESCE(published_at,NOW()), published_at),
             updated_at=NOW() WHERE id=:id',
            [
                'title' => trim((string)($input['title'] ?? $page['title'])),
                'slug' => trim((string)($input['slug'] ?? $page['slug'])),
                'excerpt' => (string)($input['excerpt'] ?? $page['excerpt']),
                'content' => (string)($input['content'] ?? $page['content']),
                'blocks' => json_encode($input['blocks'] ?? json_decode((string)$page['blocks'], true) ?? [], JSON_UNESCAPED_UNICODE),
                'template' => (string)($input['template'] ?? $page['template']),
                'status' => (string)($input['status'] ?? $page['status']),
                'status2' => (string)($input['status'] ?? $page['status']),
                'id' => $id,
            ]
        );
        byp_audit($db, $user, 'page.update', 'page', $id);
        Response::ok(['id' => $id]);
    }

    if ($action === 'modules.list' && $method === 'GET') {
        Response::ok(['modules' => $db->all('SELECT id, module_key, name, version, status, manifest, settings, installed_at, updated_at FROM byp_modules ORDER BY name')]);
    }

    if ($action === 'modules.toggle' && $method === 'POST') {
        $key = (string)($input['module_key'] ?? '');
        $status = ($input['status'] ?? '') === 'active' ? 'active' : 'inactive';
        $db->execute('UPDATE byp_modules SET status=:status, updated_at=NOW() WHERE module_key=:key', ['status' => $status, 'key' => $key]);
        byp_audit($db, $user, 'module.toggle', 'module', null, ['module_key' => $key, 'status' => $status]);
        Response::ok();
    }

    if ($action === 'settings.list' && $method === 'GET') {
        Response::ok(['settings' => $db->all('SELECT setting_group, setting_key, setting_value, value_type, is_public, updated_at FROM byp_settings ORDER BY setting_group, setting_key')]);
    }

    if ($action === 'settings.save' && $method === 'POST') {
        $group = preg_replace('/[^a-z0-9_\-]/', '', (string)($input['group'] ?? 'general'));
        $key = preg_replace('/[^a-z0-9_\-\.]/', '', (string)($input['key'] ?? ''));
        if ($key === '') {
            Response::error('Не указан ключ настройки', 422);
        }
        $db->execute(
            'INSERT INTO byp_settings (setting_group, setting_key, setting_value, value_type, is_public, updated_by, updated_at)
             VALUES (:group_name, :key_name, :value_data, :value_type, :public_flag, :user_id, NOW())
             ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), value_type=VALUES(value_type),
             is_public=VALUES(is_public), updated_by=VALUES(updated_by), updated_at=NOW()',
            [
                'group_name' => $group,
                'key_name' => $key,
                'value_data' => is_scalar($input['value'] ?? null) ? (string)$input['value'] : json_encode($input['value'], JSON_UNESCAPED_UNICODE),
                'value_type' => (string)($input['type'] ?? 'string'),
                'public_flag' => !empty($input['is_public']) ? 1 : 0,
                'user_id' => $user['id'],
            ]
        );
        byp_audit($db, $user, 'setting.save', 'setting', null, ['group' => $group, 'key' => $key]);
        Response::ok();
    }

    if ($action === 'audit.list' && $method === 'GET') {
        Response::ok(['events' => $db->all(
            'SELECT a.id, a.action, a.entity_type, a.entity_id, a.ip_address, a.metadata, a.created_at, u.name AS user_name
             FROM byp_audit_logs a LEFT JOIN byp_users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100'
        )]);
    }

    Response::error('Маршрут API не найден', 404);
} catch (Throwable $error) {
    error_log('[BYPCMS] ' . $error->getMessage());
    Response::error('Внутренняя ошибка BYPCMS', 500, !empty($config['app']['debug']) ? ['message' => $error->getMessage()] : []);
}
