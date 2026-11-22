<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use PDO;
use RuntimeException;

/** Portable streaming backup, including DDL; DDL is not transactionally reversible in MySQL. */
final class UpdateDatabase {
    public function __construct(private PDO $pdo){}
    private function identifier(string $name):string{return '`'.str_replace('`','``',$name).'`';}
    private function line($out,array $data):void {$line=json_encode($data,JSON_THROW_ON_ERROR)."\n";if(strlen($line)>32000000||gzwrite($out,$line)!==strlen($line))throw new RuntimeException('Не удалось записать резервную копию или строка превышает 32 МБ.');}
    public function inventory():array {
        $schema=(string)$this->pdo->query('SELECT DATABASE()')->fetchColumn();$privileges=[];
        foreach($this->pdo->query('SHOW GRANTS')->fetchAll(PDO::FETCH_COLUMN)as $grant)if(preg_match('/^GRANT (.*?) ON (.*?) TO /i',$grant,$match)&&in_array(str_replace('`','',$match[2]),['*.*',$schema.'.*'],true))foreach(explode(',',$match[1])as $privilege)$privileges[strtoupper(trim($privilege))]=true;
        if(!isset($privileges['ALL PRIVILEGES']))foreach(['SELECT','INSERT','UPDATE','DELETE','CREATE','DROP','ALTER','INDEX','REFERENCES']as $required)if(!isset($privileges[$required]))throw new RuntimeException('Не подтверждены права БД для безопасного восстановления: '.$required.'. Нужны прямые права на всю БД.');
        $rows=$this->pdo->query('SHOW FULL TABLES')->fetchAll(PDO::FETCH_NUM);$result=[];
        if($this->pdo->query('SHOW TRIGGERS')->fetch())throw new RuntimeException('Обновление остановлено: для БД с триггерами требуется отдельная процедура резервирования.');
        foreach(['PROCEDURE','FUNCTION']as $kind)if($this->pdo->query('SHOW '.$kind.' STATUS WHERE Db='.$this->pdo->quote($schema))->fetch())throw new RuntimeException('Обновление остановлено: БД содержит хранимые программы.');
        if($this->pdo->query('SHOW EVENTS')->fetch())throw new RuntimeException('Обновление остановлено: БД содержит фоновые события.');
        foreach($rows as[$name,$type]){
            if($type!=='BASE TABLE')throw new RuntimeException('Обновление остановлено: представления в БД требуют отдельного резервирования.');
            $statement=$this->pdo->prepare('SELECT ENGINE,DATA_LENGTH+INDEX_LENGTH AS bytes FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?');$statement->execute([$name]);$info=$statement->fetch(PDO::FETCH_ASSOC);
            if(strtoupper($info['ENGINE'])!=='INNODB')throw new RuntimeException('Обновление поддерживает только таблицы InnoDB.');
            $result[]=['name'=>$name,'bytes'=>(int)$info['bytes']];
        }return $result;
    }
    public function backup(string $name,string $file):array {
        $columns=[];foreach($this->pdo->query('SHOW FULL COLUMNS FROM '.$this->identifier($name))as $column)if(!preg_match('/(?:VIRTUAL|STORED) GENERATED/',$column['Extra']))$columns[]=$column['Field'];
        $ddl=$this->pdo->query('SHOW CREATE TABLE '.$this->identifier($name))->fetch(PDO::FETCH_NUM)[1];
        $out=gzopen($file.'.tmp','wb6');if(!$out)throw new RuntimeException('Не удалось создать резервную копию БД.');
        $rows=0;try {
            $this->line($out,['name'=>$name,'ddl'=>$ddl,'columns'=>$columns]);
            $this->pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY,false);
            $select=$this->pdo->query('SELECT '.implode(',',array_map($this->identifier(...),$columns)).' FROM '.$this->identifier($name));
            while($row=$select->fetch(PDO::FETCH_NUM)){$this->line($out,array_map(static fn($value)=>$value===null?null:base64_encode((string)$value),$row));$rows++;}
        }finally{if(isset($select))$select->closeCursor();$this->pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY,true);gzclose($out);}
        if(!rename($file.'.tmp',$file))throw new RuntimeException('Не удалось завершить копию БД.');return ['name'=>$name,'rows'=>$rows,'sha256'=>hash_file('sha256',$file)];
    }
    public function dropCurrent():void {
        $this->pdo->exec('SET FOREIGN_KEY_CHECKS=0');try{foreach($this->pdo->query('SHOW FULL TABLES')->fetchAll(PDO::FETCH_NUM)as[$name,$type]){if($type!=='BASE TABLE')throw new RuntimeException('Неподдерживаемый объект БД при восстановлении.');$this->pdo->exec('DROP TABLE '.$this->identifier($name));}}finally{$this->pdo->exec('SET FOREIGN_KEY_CHECKS=1');}
    }
    public function restore(string $file,array $expected):void {
        if(!is_file($file)||!hash_equals($expected['sha256'],hash_file('sha256',$file)))throw new RuntimeException('Резервная копия повреждена. Восстановление остановлено.');
        $in=gzopen($file,'rb');$header=json_decode((string)gzgets($in,32000001),true,64,JSON_THROW_ON_ERROR);if($header['name']!==$expected['name'])throw new RuntimeException('Таблица копии не совпадает.');
        $this->pdo->exec('SET FOREIGN_KEY_CHECKS=0');$rows=0;
        try{
            $this->pdo->exec('DROP TABLE IF EXISTS '.$this->identifier($header['name']));$this->pdo->exec($header['ddl']);
            $oldMode=(string)$this->pdo->query('SELECT @@SESSION.sql_mode')->fetchColumn();$this->pdo->exec('SET SESSION sql_mode='.$this->pdo->quote($oldMode.',NO_AUTO_VALUE_ON_ZERO'));
            $statement=$this->pdo->prepare('INSERT INTO '.$this->identifier($header['name']).' ('.implode(',',array_map($this->identifier(...),$header['columns'])).') VALUES ('.implode(',',array_fill(0,count($header['columns']),'?')).')');
            $this->pdo->beginTransaction();while(($line=gzgets($in,32000001))!==false){$values=json_decode($line,true,64,JSON_THROW_ON_ERROR);$statement->execute(array_map(static fn($value)=>$value===null?null:base64_decode($value,true),$values));$rows++;}if($rows!==$expected['rows'])throw new RuntimeException('Количество строк копии не совпадает.');$this->pdo->commit();
        }catch(\Throwable $error){if($this->pdo->inTransaction())$this->pdo->rollBack();throw $error;}
        finally{gzclose($in);if(isset($oldMode))$this->pdo->exec('SET SESSION sql_mode='.$this->pdo->quote($oldMode));$this->pdo->exec('SET FOREIGN_KEY_CHECKS=1');}
    }
}
