<?php
declare(strict_types=1);

namespace BYPCMS\Core;

use Closure;
use DomainException;
use InvalidArgumentException;
use PDO;
use Throwable;

/** Only these record types, identifiers and status transitions may be batched. */
final class PanelBulk
{
    private const COLLECTIONS = [
        'pages' => ['table'=>'byp_pages', 'key'=>'id', 'statuses'=>['draft','published','archived'], 'delete'=>true],
        'concepts' => ['table'=>'byp_concepts', 'key'=>'id', 'statuses'=>['draft','shared','archived'], 'delete'=>true],
        'modules' => ['table'=>'byp_modules', 'key'=>'module_key', 'statuses'=>['active','inactive']],
        'owner.clients' => ['table'=>'byp_clients', 'key'=>'id', 'statuses'=>['lead','active','paused','closed']],
        'owner.tasks' => ['table'=>'byp_client_tasks', 'key'=>'id', 'statuses'=>['planned','in_progress','review','done','blocked']],
        'owner.licenses' => ['table'=>'byp_license_registry', 'key'=>'id', 'statuses'=>['active','renewal','expired','trial']],
        'owner.modules' => ['table'=>'byp_module_catalog', 'key'=>'id', 'statuses'=>['published','draft','archived']],
        'owner.services' => ['table'=>'byp_services', 'key'=>'id', 'statuses'=>['active','inactive']],
        'owner.portfolio' => ['table'=>'byp_portfolio_projects', 'key'=>'id', 'statuses'=>['published','draft','archived'], 'delete'=>true],
    ];

    public function __construct(private PDO $pdo, private Closure $audit) {}

    public static function validate(array $input, array $user): array
    {
        $collection = $input['collection'] ?? '';
        if (!is_string($collection) || !isset(self::COLLECTIONS[$collection])) throw new InvalidArgumentException('Неизвестный тип записей');
        if (str_starts_with($collection, 'owner.') && ($user['role'] ?? '') !== 'owner') throw new DomainException('Доступ разрешён только владельцу платформы');
        $spec = self::COLLECTIONS[$collection];
        $operation = $input['operation'] ?? '';
        $status = $input['status'] ?? null;
        if (!in_array($operation, ['status','delete'], true)) throw new InvalidArgumentException('Недоступное массовое действие');
        if ($operation === 'delete' && empty($spec['delete'])) throw new InvalidArgumentException('Для этих записей используйте изменение статуса');
        if ($operation === 'status' && !in_array($status, $spec['statuses'], true)) throw new InvalidArgumentException('Недопустимый статус');
        $ids = $input['ids'] ?? null;
        if (!is_array($ids) || !array_is_list($ids) || count($ids) < 1 || count($ids) > 200) throw new InvalidArgumentException('Выберите от 1 до 200 записей');
        $clean = [];
        foreach ($ids as $id) {
            if ($spec['key'] === 'module_key') {
                if (!is_string($id) || !preg_match('/^[a-z0-9_-]{1,120}$/', $id)) throw new InvalidArgumentException('Некорректный ключ модуля');
            } else {
                if ((!is_int($id) && !is_string($id)) || !preg_match('/^[1-9][0-9]*$/', (string)$id) || filter_var($id, FILTER_VALIDATE_INT) === false) throw new InvalidArgumentException('Некорректный ID записи');
                $id = (int)$id;
            }
            $clean[(string)$id] = $id;
        }
        return $spec + ['collection'=>$collection, 'operation'=>$operation, 'status'=>$status, 'ids'=>array_values($clean), 'user_id'=>(int)$user['id']];
    }

    public function run(array $spec): array
    {
        $succeeded = []; $failed = [];
        foreach ($spec['ids'] as $id) {
            try {
                $this->pdo->beginTransaction();
                $lock = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
                $select = $this->pdo->prepare("SELECT * FROM {$spec['table']} WHERE {$spec['key']}=:id" . $lock);
                $select->execute(['id'=>$id]);
                $record = $select->fetch(PDO::FETCH_ASSOC);
                if (!$record) throw new DomainException('Запись не найдена или уже удалена');
                if ($spec['operation'] === 'delete') {
                    if ($spec['collection'] === 'pages') {
                        if (in_array($record['slug'], ['modules','services','order','demo'], true)) throw new DomainException('Системную страницу удалить нельзя. Можно изменить её статус.');
                        $children = $this->pdo->prepare('SELECT id FROM byp_pages WHERE parent_id=:id LIMIT 1');
                        $children->execute(['id'=>$id]);
                        if ($children->fetchColumn() !== false) throw new DomainException('У страницы есть дочерние страницы. Сначала перенесите или удалите их.');
                    }
                    $statement = $this->pdo->prepare("DELETE FROM {$spec['table']} WHERE {$spec['key']}=:id");
                    $statement->execute(['id'=>$id]);
                } else {
                    $extra = ''; $params = ['status'=>$spec['status'], 'id'=>$id];
                    if ($spec['collection'] === 'pages') {
                        $revision = $this->pdo->prepare('INSERT INTO byp_page_revisions (page_id,user_id,snapshot,created_at) VALUES (:page,:user,:snapshot,CURRENT_TIMESTAMP)');
                        $revision->execute(['page'=>$id,'user'=>$spec['user_id'],'snapshot'=>json_encode($record, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
                        if ($spec['status'] === 'published') $extra = ', published_at=COALESCE(published_at,CURRENT_TIMESTAMP)';
                    }
                    if ($spec['collection'] === 'owner.tasks') {
                        $extra = ', progress=:progress, completed_at=:completed';
                        $params['progress'] = $spec['status'] === 'done' ? 100 : min(99, (int)$record['progress']);
                        $params['completed'] = $spec['status'] === 'done' ? ($record['completed_at'] ?: date('Y-m-d H:i:s')) : null;
                    }
                    $statement = $this->pdo->prepare("UPDATE {$spec['table']} SET status=:status, updated_at=CURRENT_TIMESTAMP{$extra} WHERE {$spec['key']}=:id");
                    $statement->execute($params);
                }
                ($this->audit)($spec['collection'], (int)($record['id'] ?? 0), ['operation'=>$spec['operation'], 'status'=>$spec['status'], 'identifier'=>$id, 'previous_status'=>$record['status']]);
                $this->pdo->commit();
                $succeeded[] = $id;
            } catch (Throwable $error) {
                if ($this->pdo->inTransaction()) $this->pdo->rollBack();
                if (!$error instanceof DomainException) error_log('[BYPCMS bulk] ' . $error->getMessage());
                $failed[] = ['id'=>$id, 'error'=>$error instanceof DomainException ? $error->getMessage() : 'Не удалось сохранить изменения. Повторите попытку.'];
            }
        }
        return ['succeeded'=>$succeeded, 'failed'=>$failed];
    }
}
