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
        $handle = curl_init($url); $bytes = ''; $count=0;
        $output=$destination!==null?fopen($destination,'wb'):null;
        if($destination!==null&&!$output)throw new LicenseException('Не удалось записать пакет.',503,'storage_error');
        if (!$handle) throw new LicenseException('Не удалось открыть соединение.', 503, 'network_error');
        curl_setopt_array($handle, [CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_TIMEOUT => 8,
            CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2, CURLOPT_PROXY => '',
            CURLOPT_PROTOCOLS => $loopback ? CURLPROTO_HTTP | CURLPROTO_HTTPS : CURLPROTO_HTTPS,
            CURLOPT_RESOLVE => [$host . ':' . $port . ':' . (str_contains($ip, ':') ? '[' . $ip . ']' : $ip)],
            CURLOPT_HTTPHEADER => array_merge(['Accept: application/json', 'Content-Type: application/json'],$headers),
            CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$bytes,&$count,$limit,$output): int { if ($count + strlen($chunk) > $limit) return 0; $count+=strlen($chunk);if($output)return fwrite($output,$chunk);$bytes .= $chunk; return strlen($chunk); }]);
        if ($body !== null) curl_setopt_array($handle, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body, JSON_THROW_ON_ERROR)]);
        $ok = curl_exec($handle); $status = (int)curl_getinfo($handle, CURLINFO_RESPONSE_CODE); curl_close($handle);
        if($output)fclose($output);
        if ($ok === false) {if($destination!==null)@unlink($destination);throw new LicenseException('Сервер проверки временно недоступен. Повторите запрос позже.', 503, 'network_error');}
        if($destination!==null&&$status>=200&&$status<300)return ['bytes'=>$count,'sha256'=>hash_file('sha256',$destination)];
        if($destination!==null){$bytes=(string)file_get_contents($destination,false,null,0,65536);unlink($destination);}
        $data = json_decode($bytes, true);
        if ($status < 200 || $status >= 300) throw new LicenseException(is_string($data['error'] ?? null) ? mb_substr($data['error'], 0, 300) : 'Сервер не подтвердил запрос.', $status ?: 503, $data['details']['code'] ?? 'remote_error');
        if (!is_array($data)) throw new LicenseException('Некорректный ответ сервера проверки.', 503, 'invalid_response');
        return $data;
    }
}
