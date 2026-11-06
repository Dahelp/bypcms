<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use RuntimeException;
use Throwable;
require_once __DIR__.'/LicenseCrypto.php';
require_once __DIR__.'/LicensePolicy.php';
require_once __DIR__.'/LicenseHttp.php';

final class LicenseClient
{
    public function __construct(private string $root, private array $config) {}
    private function storage(): string { return $this->root.'/_storage/license-state.json'; }
    private function read(): array {
        if (!is_file($this->storage())) return [];
        try { $data=json_decode((string)file_get_contents($this->storage()),true,32,JSON_THROW_ON_ERROR); if(!is_array($data))throw new RuntimeException();return $data; }
        catch(Throwable $error){throw new LicenseException('Рабочие данные лицензии повреждены. Повторите активацию.',409,'invalid_state');}
    }
    private function write(array $state): void {
        $temporary=$this->storage().'.tmp';
        if(file_put_contents($temporary,json_encode($state,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES),LOCK_EX)===false || !rename($temporary,$this->storage()))throw new LicenseException('Не удалось сохранить подтверждение лицензии. Данные сайта не изменены.',503,'storage_error');
        chmod($this->storage(),0600);
    }
    public function installation(): string {
        $id=$this->config['app']['installation_id']??'';
        if($id)return LicensePolicy::installation($id);
        $path=$this->root.'/_storage/installation-id';
        if(!is_file($path)){
            $handle=@fopen($path,'x');
            if($handle){try{if(fwrite($handle,bin2hex(random_bytes(16)))!==32)throw new RuntimeException('Не удалось создать идентификатор установки.');}finally{fclose($handle);}chmod($path,0600);}
        }
        return LicensePolicy::installation(trim((string)@file_get_contents($path)));
    }
    private function trust(): array {
        $file=$this->root.'/_core/license-trust.json';
        if(!is_file($file))throw new LicenseException('Открытый ключ проверки отсутствует в пакете. Получите актуальную сборку.',409,'trust_missing');
        $trust=json_decode((string)file_get_contents($file),true,16,JSON_THROW_ON_ERROR);
        if(($trust['schema']??'')!=='bypcms.license-trust/v1' || !is_string($trust['public_key']??null) || hash('sha256',$trust['public_key'])!==($trust['key_id']??'') || !is_string($trust['issuer']??null))throw new LicenseException('Пакет не содержит корректный открытый ключ.',409,'trust_invalid');
        return $trust;
    }
    private function site(): array { return LicensePolicy::site($this->config['app']['url'],(bool)($this->config['app']['debug']??false)); }
    private function verify(array $receipt,int $now): array {
        $trust=$this->trust();$claims=LicenseCrypto::verify($receipt,$trust['public_key'],$this->installation(),$this->site()['domain'],$this->config['app']['edition'],$now);
        if(array_diff($this->config['app']['modules']??[],$claims['entitlements']))throw new LicenseException('Лицензия не включает все модули этой сборки.',403,'modules_mismatch');
        return $claims;
    }
    private function post(string $action,array $body): array {
        $trust=$this->trust();$http=new LicenseHttp((bool)($this->config['app']['debug']??false),$this->config['licensing']['test_hosts']??[]);
        return $http->request($trust['issuer'].'?action=licensing.'.$action,$body);
    }
    private function locked(callable $action): array {
        $handle=fopen($this->root.'/_storage/license-client.lock','c');if(!$handle||!flock($handle,LOCK_EX))throw new RuntimeException('Не удалось открыть данные лицензии.');
        try{return $action();}finally{flock($handle,LOCK_UN);fclose($handle);}
    }
    public function status(?int $now=null): array {
        $now??=time();$base=['installation_id'=>$this->installation(),'domain'=>$this->site()['domain'],'edition'=>$this->config['app']['edition'],'state'=>'unactivated','can_update'=>false,'public_site_available'=>true,'license_term'=>null,'valid_until'=>null,'modules'=>[],'checked_at'=>null,'error'=>''];
        try{
            $state=$this->read();$base['checked_at']=$state['checked_at']??null;$base['error']=$state['error']??'';
            if(empty($state['receipt']))return $base;
            $claims=$this->verify($state['receipt'],$now);$access=LicensePolicy::access($claims,$now);
            if(!empty($state['blocked']))$access=['state'=>$state['blocked'],'can_update'=>false,'public_site_available'=>true];
            return array_merge($base,$access,['license_term'=>$claims['license_term'],'valid_until'=>$claims['updates_until']===null?null:gmdate(DATE_ATOM,$claims['updates_until']),'modules'=>$claims['entitlements'],'license_id'=>$claims['license_id'],'lease_until'=>$claims['lease_until'],'offline_until'=>$claims['offline_until']]);
        }catch(Throwable $error){return array_merge($base,['state'=>'invalid','error'=>$error->getMessage()]);}
    }
    public function activate(string $key,string $operation): array {
        if(!preg_match('/^[a-f0-9]{32}$/D',$operation))throw new LicenseException('Некорректный идентификатор активации.');
        return $this->locked(function()use($key,$operation){
            try {$state=$this->read();} catch (LicenseException $error) {$state=[];}
            if(($state['last_operation']??'')===$operation&&!empty($state['receipt']))return $this->status();
            $request=['key'=>trim($key),'installation_id'=>$this->installation(),'site_url'=>$this->site()['url'],'edition'=>$this->config['app']['edition']];
            $challenge=$this->post('challenge',$request);$id=$challenge['challenge_id']??'';
            if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id)||!is_string($challenge['nonce']??null)||!preg_match('/^[a-f0-9]{64}$/D',$challenge['nonce']))throw new LicenseException('Некорректный ответ проверки домена.',503,'invalid_response');
            $directory=$this->root.'/.well-known/bypcms-activation';if(!is_dir($directory)&&!mkdir($directory,0755,true))throw new LicenseException('Не удалось создать файл подтверждения домена. Проверьте права каталога установки.',503,'proof_write');
            $path=$directory.'/'.$id.'.json';
            try{
                if(file_put_contents($path,json_encode(['installation_id'=>$this->installation(),'nonce'=>$challenge['nonce']],JSON_THROW_ON_ERROR),LOCK_EX)===false)throw new LicenseException('Не удалось сохранить файл подтверждения домена.',503,'proof_write');
                $result=$this->post('activate',$request+['challenge_id'=>$id]);
                if(!is_array($result['receipt']??null)||!is_string($result['activation_token']??null)||!preg_match('/^[a-f0-9]{64}$/D',$result['activation_token']))throw new LicenseException('Некорректный ответ активации.',503,'invalid_response');
                $this->verify($result['receipt'],time());
                $this->write(['receipt'=>$result['receipt'],'credential'=>LicenseCrypto::encrypt($result['activation_token'],$this->config['app']['key']),'checked_at'=>time(),'attempted_at'=>time(),'last_operation'=>$operation,'error'=>'']);
                return $this->status();
            }finally{if(is_file($path))unlink($path);}
        });
    }
    public function refresh(): array {
        return $this->locked(function(){
            $state=$this->read();if(empty($state['credential']))throw new LicenseException('Сначала активируйте лицензию.',409,'not_activated');
            $state['attempted_at']=time();
            try{
                $result=$this->post('check',['installation_id'=>$this->installation(),'activation_token'=>LicenseCrypto::decrypt($state['credential'],$this->config['app']['key'])]);
                if(!is_array($result['receipt']??null))throw new LicenseException('Некорректное подтверждение лицензии.',503,'invalid_response');
                try{$this->verify($result['receipt'],time());}catch(Throwable $error){$state['blocked']='invalid';throw $error;}
                $state['receipt']=$result['receipt'];$state['checked_at']=time();$state['error']='';unset($state['blocked']);
            }catch(Throwable $error){
                $state['error']=$error->getMessage();
                if($error instanceof LicenseException && in_array($error->reason,['activation_revoked','license_suspended','domain_mismatch','edition_mismatch','modules_mismatch','license_invalid'],true))$state['blocked']=$error->reason;
                $this->write($state);throw $error;
            }
            $this->write($state);return $this->status();
        });
    }
    public function release(): array {
        return $this->locked(function(){
            $state=$this->read();
            if(!empty($state['credential'])){
                try{$this->post('release',['installation_id'=>$this->installation(),'activation_token'=>LicenseCrypto::decrypt($state['credential'],$this->config['app']['key'])]);}
                catch(LicenseException $error){if($error->reason!=='activation_revoked')throw $error;}
            }
            $this->write(['deactivated_at'=>time()]);return $this->status();
        });
    }
    public function due(): bool {
        try{$state=$this->read();return !empty($state['credential'])&&($state['checked_at']??0)<time()-86400&&($state['attempted_at']??0)<time()-3600;}catch(Throwable $error){return false;}
    }
}
