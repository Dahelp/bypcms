<?php
declare(strict_types=1);
require_once __DIR__.'/../server/_core/UpdateDatabase.php';use BYPCMS\Core\UpdateDatabase as D;
$cases=[
 [['GRANT ALL PRIVILEGES ON `tenant\_site`.* TO user'],'tenant_site',9],
 [['GRANT ALL PRIVILEGES ON `tenant\%site`.* TO user'],'tenant%site',9],
 [['GRANT ALL PRIVILEGES ON `tenant_site`.* TO user'],'tenant_site',9],
 [['GRANT ALL PRIVILEGES ON *.* TO user'],'tenant_site',9],
 [['GRANT SELECT, INSERT, UPDATE ON `tenant\_site`.* TO user'],'tenant_site',3],
 [['GRANT ALL PRIVILEGES ON `other_site`.* TO user'],'tenant_site',0],
 [['GRANT ALL PRIVILEGES ON `tenant\_site`.`byp_pages` TO user'],'tenant_site',0],
 [['GRANT ALL PRIVILEGES ON `tenant_%`.* TO user'],'tenant_site',0],
 [['GRANT ALL PRIVILEGES ON `tenant_site`.* TO user'],'tenant9site',0],
 [['GRANT `role_name` TO user'],'tenant_site',0],
 [['GRANT ALL PRIVILEGES ON *.* TO user','REVOKE DROP ON `tenant\_site`.* FROM user'],'tenant_site',8],
 [['GRANT ALL PRIVILEGES ON *.* TO user','REVOKE ALL PRIVILEGES ON `tenant\_site`.* FROM user'],'tenant_site',0],
];
foreach($cases as $i=>[$grants,$schema,$count])if(count(array_intersect_key(D::privileges($grants,$schema),array_flip(D::REQUIRED)))!==$count)throw new RuntimeException('Grant boundary case '.$i);
echo count($cases)." escaped database/grant/revoke/table/role boundaries passed\n";
