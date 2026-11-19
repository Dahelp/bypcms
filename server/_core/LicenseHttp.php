<?php
declare(strict_types=1);
namespace BYPCMS\Core;
use RuntimeException;

final class LicenseException extends RuntimeException
{
    public function __construct(string $message, public int $httpStatus = 422, public string $reason = 'license_error') { parent::__construct($message); }
}

/** Outbound licensing calls: HTTPS, verified certificates, pinned public DNS, no redirects. */
final class LicenseHttp
{
    public const CONNECT_TIMEOUT = 4;
    public const JSON_TIMEOUT = 8;
    public const DOWNLOAD_TIMEOUT = 120;
    public const DOWNLOAD_LOW_SPEED_TIME = 20;
    public const DOWNLOAD_LOW_SPEED_LIMIT = 1024;
    public function __construct(private bool $development = false, private array $testHosts = []) {}
    public function request(string $url, ?array $body = null, ?string $destination = null, int $limit = 65536, array $headers = []): array
    {
        if (!extension_loaded('curl')) throw new LicenseException('На сервере требуется расширение PHP cURL.', 503, 'transport_unavailable');
        $parts = parse_url($url); $host = strtolower($parts['host'] ?? ''); $port = (int)($parts['port'] ?? (($parts['scheme'] ?? '') === 'http' ? 80 : 443));
        if (!$parts || !$host || isset($parts['user']) || isset($parts['pass']) || isset($parts['fragment'])) throw new LicenseException('Некорректный адрес сервера лицензий.');
        $loopback = $this->development && (in_array($host, ['127.0.0.1', 'localhost'], true) || isset($this->testHosts[$host]));
        if ((!$loopback && (($parts['scheme'] ?? '') !== 'https' || $port !== 443)) || ($loopback && !in_array($parts['scheme'] ?? '', ['http','https'], true))) throw new LicenseException('Для проверки лицензии требуется HTTPS.');
        $ip = $loopback ? ($this->testHosts[$host] ?? '127.0.0.1') : null;
        if ($loopback && !in_array($ip, ['127.0.0.1','::1'], true)) throw new LicenseException('Тестовый транспорт допускает только loopback.');
        if (!$loopback) {
            $records = @dns_get_record($host, DNS_A | DNS_AAAA);
            foreach ($records ?: [] as $record) {
                $candidate = $record['ip'] ?? $record['ipv6'] ?? '';
                if (!filter_var($candidate, FILTER_VALIDATE_IP, FILTER_FLAG_GLOBAL_RANGE)) throw new LicenseException('Адрес проверки должен указывать на публичный сервер.', 422, 'private_address');
                $ip ??= $candidate;
            }
            if (!$ip) throw new LicenseException('Не удалось определить адрес сервера.', 503, 'network_error');
        }
        $handle = curl_init($url); $bytes = ''; $count=0; $tooLarge=false; $writeFailed=false;
        $output=$destination!==null?fopen($destination,'wb'):null;
        if($destination!==null&&!$output)throw new LicenseException('Не удалось записать пакет.',503,'storage_error');
        if (!$handle) throw new LicenseException('Не удалось открыть соединение.', 503, 'network_error');
        curl_setopt_array($handle, [CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => self::CONNECT_TIMEOUT,
            CURLOPT_TIMEOUT => $destination!==null ? self::DOWNLOAD_TIMEOUT : self::JSON_TIMEOUT,
            CURLOPT_LOW_SPEED_LIMIT => $destination!==null ? self::DOWNLOAD_LOW_SPEED_LIMIT : 0,
            CURLOPT_LOW_SPEED_TIME => $destination!==null ? self::DOWNLOAD_LOW_SPEED_TIME : 0,
            CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2, CURLOPT_PROXY => '',
            CURLOPT_PROTOCOLS => $loopback ? CURLPROTO_HTTP | CURLPROTO_HTTPS : CURLPROTO_HTTPS,
            CURLOPT_RESOLVE => [$host . ':' . $port . ':' . (str_contains($ip, ':') ? '[' . $ip . ']' : $ip)],
            CURLOPT_HTTPHEADER => array_merge(['Accept: application/json', 'Content-Type: application/json'],$headers),
            CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$bytes,&$count,&$tooLarge,&$writeFailed,$limit,$output): int {
                $length=strlen($chunk);if($count+$length>$limit){$tooLarge=true;return 0;}
                if($output){$written=fwrite($output,$chunk);if($written!==$length){$writeFailed=true;return 0;}}
                else $bytes.=$chunk;
                $count+=$length;return $length;
            }]);
        if ($body !== null) curl_setopt_array($handle, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body, JSON_THROW_ON_ERROR)]);
        $ok = curl_exec($handle); $errno=curl_errno($handle); $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE); $contentType=(string)curl_getinfo($handle,CURLINFO_CONTENT_TYPE); curl_close($handle);
        if($output)fclose($output);
        if ($ok === false) {
            if($destination!==null)@unlink($destination);
            if($tooLarge)throw new LicenseException('Ответ сервера превышает допустимый размер.',503,'response_too_large');
            if($writeFailed)throw new LicenseException('Не удалось записать пакет. Проверьте место и права записи.',503,'storage_error');
            if($destination!==null&&$errno===CURLE_OPERATION_TIMEDOUT)throw new LicenseException('Загрузка пакета прервана: превышено время ожидания или сервер перестал передавать данные. Рабочая версия не изменена. Повторите установку.',503,'download_timeout');
            throw new LicenseException($destination!==null?'Не удалось скачать пакет. Рабочая версия не изменена. Повторите установку.':'Сервер проверки временно недоступен. Повторите запрос позже.',503,'network_error');
        }
        if($destination!==null&&$status>=200&&$status<300)return ['bytes'=>$count,'sha256'=>hash_file('sha256',$destination),'content_type'=>$contentType];
        if($destination!==null){$bytes=(string)file_get_contents($destination,false,null,0,65536);unlink($destination);}
        $data = json_decode($bytes, true);
        if ($status < 200 || $status >= 300) throw new LicenseException(is_string($data['error'] ?? null) ? mb_substr($data['error'], 0, 300) : 'Сервер не подтвердил запрос.', $status ?: 503, $data['details']['code'] ?? 'remote_error');
        if (!is_array($data)) throw new LicenseException('Некорректный ответ сервера проверки.', 503, 'invalid_response');
        return $data;
    }
}
