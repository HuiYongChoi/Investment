<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: {$origin}");
header('Vary: Origin');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

const DART_BASE = 'https://opendart.fss.or.kr/api';
const KRX_BASE = 'https://data-dbg.krx.co.kr/svc/apis/sto';
const KIWOOM_BASE = 'https://api.kiwoom.com';
const KIWOOM_TOKEN_URL = 'https://api.kiwoom.com/oauth2/token';
const NAVER_STOCK_BASE = 'https://m.stock.naver.com/api/stock';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';

function json_response(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function aws_lines(): array
{
    static $lines = null;
    if ($lines !== null) return $lines;
    $path = __DIR__ . '/AWS.txt';
    if (!is_file($path)) {
        $lines = [];
        return $lines;
    }

    $lines = array_map('trim', file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: []);
    return $lines;
}

function aws_next_value(string $label): string
{
    $lines = aws_lines();
    foreach ($lines as $index => $line) {
        if (strpos($line, $label) !== false) {
            for ($cursor = $index + 1; $cursor < count($lines); $cursor += 1) {
                $candidate = trim($lines[$cursor]);
                if ($candidate !== '' && $candidate[0] !== '[' && $candidate[0] !== '#') {
                    return $candidate;
                }
            }
        }
    }
    return '';
}

function aws_inline_value(string $prefix): string
{
    foreach (aws_lines() as $line) {
        if (strpos($line, $prefix) === 0) {
            $parts = explode(':', $line, 2);
            return isset($parts[1]) ? trim($parts[1]) : '';
        }
    }
    return '';
}

function secret_config(): array
{
    static $config = null;
    if ($config !== null) return $config;

    $config = [];
    $secretFiles = [
        '/opt/bitnami/apache/conf/investment-proxy-secrets.php',
        '/home/bitnami/investment-proxy-secrets.php',
        __DIR__ . '/proxy.secrets.php',
    ];

    foreach ($secretFiles as $secretFile) {
        if (is_readable($secretFile)) {
            $loaded = require $secretFile;
            if (is_array($loaded)) {
                $config = $loaded;
                break;
            }
        }
    }

    return $config;
}

function get_secret(string $envName, string $configKey, string $fallback = ''): string
{
    $env = trim((string) getenv($envName));
    if ($env !== '') return $env;

    $config = secret_config();
    if (!empty($config[$configKey])) return trim((string) $config[$configKey]);

    return $fallback;
}

function dart_key(): string
{
    return get_secret('DART_API_KEY', 'dart_api_key', aws_next_value('DART 오픈 API'));
}

function krx_key(): string
{
    return get_secret('KRX_AUTH_KEY', 'krx_auth_key', aws_next_value('KRX Open API'));
}

function gemini_key(): string
{
    return get_secret('GEMINI_API_KEY', 'gemini_api_key', aws_next_value('Gemini API KEY'));
}

function kakao_rest_key(): string
{
    return get_secret('KAKAO_REST_API_KEY', 'kakao_rest_api_key', aws_inline_value('Rest API:'));
}

function kiwoom_app_key(): string
{
    return get_secret('KIWOOM_APP_KEY', 'kiwoom_app_key');
}

function kiwoom_secret_key(): string
{
    return get_secret('KIWOOM_SECRET_KEY', 'kiwoom_secret_key');
}

function kiwoom_token_cache_path(): string
{
    $config = secret_config();
    if (!empty($config['kiwoom_token_cache'])) {
        return trim((string) $config['kiwoom_token_cache']);
    }
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'investment-navigator-kiwoom-token.json';
}

function resolve_redirect_url(string $currentUrl, string $location): string
{
    if (preg_match('#^https?://#i', $location)) return $location;
    $parts = parse_url($currentUrl);
    $scheme = $parts['scheme'] ?? 'https';
    $host = $parts['host'] ?? '';
    $port = isset($parts['port']) ? ':' . $parts['port'] : '';

    if (strpos($location, '/') === 0) {
        return "{$scheme}://{$host}{$port}{$location}";
    }

    $path = $parts['path'] ?? '/';
    $baseDir = rtrim(str_replace('\\', '/', dirname($path)), '/');
    return "{$scheme}://{$host}{$port}{$baseDir}/{$location}";
}

function now_kst(): DateTimeImmutable
{
    return new DateTimeImmutable('now', new DateTimeZone('Asia/Seoul'));
}

function parse_kiwoom_expiry_timestamp(string $raw): int
{
    $value = trim($raw);
    if ($value === '') return now_kst()->modify('+23 hours')->getTimestamp();

    $formats = ['YmdHis', 'Y-m-d H:i:s', DateTimeInterface::ATOM];
    foreach ($formats as $format) {
        $parsed = DateTimeImmutable::createFromFormat($format, $value, new DateTimeZone('Asia/Seoul'));
        if ($parsed instanceof DateTimeImmutable) return $parsed->getTimestamp();
    }

    try {
        return (new DateTimeImmutable($value, new DateTimeZone('Asia/Seoul')))->getTimestamp();
    } catch (Throwable $ignored) {
        return now_kst()->modify('+23 hours')->getTimestamp();
    }
}

function read_cached_kiwoom_token(): array
{
    $path = kiwoom_token_cache_path();
    if (!is_readable($path)) return [];

    $payload = safe_json_decode((string) file_get_contents($path));
    $token = trim((string) ($payload['token'] ?? ''));
    $expiresAt = (int) ($payload['expires_ts'] ?? 0);
    if ($token === '' || $expiresAt <= (time() + 300)) return [];
    return $payload;
}

function write_cached_kiwoom_token(array $payload): void
{
    $path = kiwoom_token_cache_path();
    @file_put_contents($path, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    @chmod($path, 0600);
}

function invalidate_cached_kiwoom_token(): void
{
    $path = kiwoom_token_cache_path();
    if (is_file($path)) {
        @unlink($path);
    }
}

function request_upstream(string $url, array $headers = [], ?string $body = null, string $method = 'GET', int $redirects = 0): array
{
    $responseHeaders = [];
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_USERAGENT => 'InvestmentNavigator/3.0',
        CURLOPT_TIMEOUT => 25,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_HEADERFUNCTION => static function ($curl, $header) use (&$responseHeaders) {
            $length = strlen($header);
            $parts = explode(':', $header, 2);
            if (count($parts) === 2) {
                $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
            }
            return $length;
        },
    ]);

    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }

    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($raw === false) {
        throw new RuntimeException($error ?: 'upstream request failed');
    }

    if (in_array($status, [301, 302, 303, 307, 308], true) && !empty($responseHeaders['location']) && $redirects < 5) {
        $nextUrl = resolve_redirect_url($url, $responseHeaders['location']);
        return request_upstream($nextUrl, $headers, $body, $method, $redirects + 1);
    }

    return ['status' => $status, 'body' => $raw];
}

function ensure_kiwoom_token(bool $forceRefresh = false): string
{
    $appKey = kiwoom_app_key();
    $secretKey = kiwoom_secret_key();
    if ($appKey === '' || $secretKey === '') {
        throw new RuntimeException('Kiwoom App Key/Secret가 설정되지 않았습니다.');
    }

    if (!$forceRefresh) {
        $cached = read_cached_kiwoom_token();
        if (!empty($cached['token'])) {
            $tokenType = trim((string) ($cached['token_type'] ?? 'Bearer'));
            return "{$tokenType} " . trim((string) $cached['token']);
        }
    }

    $upstream = request_upstream(
        KIWOOM_TOKEN_URL,
        ['Content-Type: application/json;charset=UTF-8'],
        json_encode([
            'grant_type' => 'client_credentials',
            'appkey' => $appKey,
            'secretkey' => $secretKey,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'POST'
    );
    $payload = safe_json_decode($upstream['body']);
    $token = trim((string) ($payload['token'] ?? ''));

    if ($upstream['status'] >= 400 || $token === '') {
        $message = (string) ($payload['return_msg'] ?? $payload['msg'] ?? $payload['error'] ?? 'Kiwoom access token issuance failed');
        throw new RuntimeException($message);
    }

    $tokenType = trim((string) ($payload['token_type'] ?? 'Bearer'));
    write_cached_kiwoom_token([
        'token' => $token,
        'token_type' => $tokenType,
        'expires_dt' => (string) ($payload['expires_dt'] ?? ''),
        'expires_ts' => parse_kiwoom_expiry_timestamp((string) ($payload['expires_dt'] ?? '')),
    ]);

    return "{$tokenType} {$token}";
}

function request_kiwoom_api(string $path, string $apiId, array $body, array $options = []): array
{
    $headers = [
        'Content-Type: application/json;charset=UTF-8',
        'Authorization: ' . ensure_kiwoom_token((bool) ($options['force_refresh'] ?? false)),
        'api-id: ' . $apiId,
    ];

    $contYn = trim((string) ($options['cont_yn'] ?? ''));
    $nextKey = trim((string) ($options['next_key'] ?? ''));
    if ($contYn !== '') $headers[] = 'cont-yn: ' . $contYn;
    if ($nextKey !== '') $headers[] = 'next-key: ' . $nextKey;

    $upstream = request_upstream(
        KIWOOM_BASE . $path,
        $headers,
        json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'POST'
    );

    if (in_array($upstream['status'], [401, 403], true) && empty($options['force_refresh'])) {
        invalidate_cached_kiwoom_token();
        return request_kiwoom_api($path, $apiId, $body, [
            'cont_yn' => $contYn,
            'next_key' => $nextKey,
            'force_refresh' => true,
        ]);
    }

    return $upstream;
}

function query_without(array $source, array $omit): array
{
    $result = [];
    foreach ($source as $key => $value) {
        if (in_array($key, $omit, true)) continue;
        $result[$key] = $value;
    }
    return $result;
}

function parse_json_body(): array
{
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw ?: '{}', true);
    return is_array($decoded) ? $decoded : [];
}

function safe_json_decode(string $raw): array
{
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : ['raw' => $raw];
}

function yfinance_bridge_path(): string
{
    return __DIR__ . '/yfinance_bridge.py';
}

function company_directory_cache_path(): string
{
    $config = secret_config();
    if (!empty($config['company_directory_cache'])) {
        return trim((string) $config['company_directory_cache']);
    }
    return rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'investment-navigator-company-directory.json';
}

function read_cached_company_directory(bool $allowStale = false): ?array
{
    $path = company_directory_cache_path();
    if (!is_readable($path)) return null;

    $payload = safe_json_decode((string) file_get_contents($path));
    if (!is_array($payload) || !isset($payload['directory']) || !is_array($payload['directory'])) {
        return null;
    }

    $cachedAt = strtotime((string) ($payload['cachedAt'] ?? '')) ?: 0;
    $isFresh = $cachedAt >= (time() - (12 * 60 * 60));
    if (!$allowStale && !$isFresh) return null;
    return $payload;
}

function write_cached_company_directory(array $payload): void
{
    $path = company_directory_cache_path();
    @file_put_contents($path, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    @chmod($path, 0600);
}

function extract_zip_entry_text(string $zipBinary, string $entryName): string
{
    $tempPath = tempnam(sys_get_temp_dir(), 'dart-corp-');
    if ($tempPath === false) {
        throw new RuntimeException('Unable to allocate temp file for DART corpCode');
    }

    file_put_contents($tempPath, $zipBinary);
    $zip = new ZipArchive();
    $status = $zip->open($tempPath);
    if ($status !== true) {
        @unlink($tempPath);
        throw new RuntimeException('Unable to open DART corpCode archive');
    }

    $xmlRaw = $zip->getFromName($entryName);
    $zip->close();
    @unlink($tempPath);

    if (!is_string($xmlRaw) || $xmlRaw === '') {
        throw new RuntimeException('DART corpCode archive entry was empty');
    }

    return $xmlRaw;
}

function build_company_directory_entries(string $xmlRaw): array
{
    $xml = @simplexml_load_string($xmlRaw);
    if (!$xml) {
        throw new RuntimeException('Unable to parse DART corpCode XML');
    }

    $entries = [];
    foreach ($xml->list as $node) {
        $stockCode = preg_replace('/\D+/', '', trim((string) ($node->stock_code ?? '')));
        if (strlen($stockCode) !== 6) continue;

        $name = trim((string) ($node->corp_name ?? ''));
        if ($name === '') continue;
        $corpCode = trim((string) ($node->corp_code ?? ''));
        $corpEngName = trim(html_entity_decode((string) ($node->corp_eng_name ?? ''), ENT_QUOTES | ENT_XML1, 'UTF-8'));
        $aliases = [];
        $normalizedEng = function_exists('mb_strtolower') ? mb_strtolower($corpEngName, 'UTF-8') : strtolower($corpEngName);
        $normalizedName = function_exists('mb_strtolower') ? mb_strtolower($name, 'UTF-8') : strtolower($name);
        if ($corpEngName !== '' && $normalizedEng !== $normalizedName) {
            $aliases[] = $corpEngName;
        }

        $entries[] = [
            'name' => $name,
            'stockCode' => $stockCode,
            'corpCode' => $corpCode,
            'market' => 'AUTO',
            'aliases' => $aliases,
        ];
    }

    usort($entries, static fn ($left, $right) => strcmp(
        ($left['name'] ?? '') . ($left['stockCode'] ?? ''),
        ($right['name'] ?? '') . ($right['stockCode'] ?? '')
    ));

    return $entries;
}

function fetch_company_directory_payload(): array
{
    $key = dart_key();
    if ($key === '') {
        throw new RuntimeException('DART API key is not configured');
    }

    $upstream = request_upstream(DART_BASE . '/corpCode.xml?crtfc_key=' . rawurlencode($key));
    $xmlRaw = extract_zip_entry_text($upstream['body'], 'CORPCODE.xml');
    $entries = build_company_directory_entries($xmlRaw);
    $payload = [
        'live' => true,
        'source' => 'dart_corp_code',
        'cachedAt' => now_kst()->format(DateTimeInterface::ATOM),
        'count' => count($entries),
        'directory' => $entries,
    ];
    write_cached_company_directory($payload);
    return $payload;
}

function company_directory_payload(): array
{
    $cached = read_cached_company_directory();
    if ($cached !== null) return $cached;

    try {
        return fetch_company_directory_payload();
    } catch (Throwable $error) {
        $stale = read_cached_company_directory(true);
        if ($stale !== null) {
            $stale['stale'] = true;
            $stale['error'] = $error->getMessage();
            return $stale;
        }

        return [
            'live' => false,
            'source' => 'dart_corp_code',
            'cachedAt' => now_kst()->format(DateTimeInterface::ATOM),
            'count' => 0,
            'directory' => [],
            'error' => $error->getMessage(),
        ];
    }
}

function yfinance_python_candidates(): array
{
    $configured = get_secret('YFINANCE_PYTHON_BIN', 'yfinance_python_bin');
    return array_values(array_unique(array_filter([
        trim($configured),
        'python3',
        'python',
    ], static fn ($item) => $item !== '')));
}

function run_yfinance_bridge(array $args): array
{
    foreach (yfinance_python_candidates() as $pythonBin) {
        $parts = [escapeshellarg($pythonBin), escapeshellarg(yfinance_bridge_path())];
        foreach ($args as $arg) {
            $parts[] = escapeshellarg((string) $arg);
        }

        $command = implode(' ', $parts);
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $process = @proc_open($command, $descriptors, $pipes, __DIR__);
        if (!is_resource($process)) {
            continue;
        }

        fclose($pipes[0]);
        $stdout = stream_get_contents($pipes[1]) ?: '';
        $stderr = stream_get_contents($pipes[2]) ?: '';
        fclose($pipes[1]);
        fclose($pipes[2]);

        return [
            'status' => proc_close($process),
            'stdout' => $stdout,
            'stderr' => $stderr,
        ];
    }

    return [
        'status' => 127,
        'stdout' => '',
        'stderr' => 'Python runtime was not found for yfinance bridge',
    ];
}

function request_yfinance_bridge(string $command, array $params): array
{
    $args = [$command];
    foreach ($params as $key => $value) {
        $text = trim((string) $value);
        if ($text === '') continue;
        $args[] = '--' . str_replace('_', '-', (string) $key);
        $args[] = $text;
    }

    $result = run_yfinance_bridge($args);
    $payload = trim($result['stdout']) !== '' ? safe_json_decode($result['stdout']) : [];
    if (!is_array($payload)) {
        $payload = [];
    }

    if (!array_key_exists('live', $payload)) $payload['live'] = false;
    if (empty($payload['source'])) $payload['source'] = 'yfinance_python';
    if ((int) $result['status'] !== 0 && empty($payload['error'])) {
        $payload['error'] = trim((string) $result['stderr']) ?: 'yfinance bridge failed';
    }

    return $payload;
}

function extract_gold_usd_ounce(array $payload): float
{
    if (isset($payload[0]) && is_array($payload)) {
        foreach ($payload as $row) {
            if (!is_array($row)) continue;
            if (array_key_exists('gold', $row) && (float) $row['gold'] > 0) {
                return (float) $row['gold'];
            }
            if (array_key_exists('price', $row) && (float) $row['price'] > 0) {
                return (float) $row['price'];
            }
        }
    }

    if (isset($payload['gold']) && (float) $payload['gold'] > 0) {
        return (float) $payload['gold'];
    }

    if (isset($payload['price']) && (float) $payload['price'] > 0) {
        return (float) $payload['price'];
    }

    return 0.0;
}

function resolve_gold_usd_ounce(): float
{
    $sources = [
        static fn () => safe_json_decode(request_upstream('https://api.metals.live/v1/spot/gold')['body']),
        static fn () => safe_json_decode(request_upstream('https://api.gold-api.com/price/XAU')['body']),
        static fn () => request_yfinance_bridge('quote', [
            'stock_code' => 'GC=F',
            'market' => 'COMMODITY',
        ]),
    ];

    foreach ($sources as $load) {
        try {
            $value = extract_gold_usd_ounce((array) $load());
            if ($value > 0) return $value;
        } catch (Throwable $ignored) {
        }
    }

    return 0.0;
}

function business_dates(string $startToken, string $endToken): array
{
    $dates = [];
    $start = DateTimeImmutable::createFromFormat('Ymd', $startToken);
    $end = DateTimeImmutable::createFromFormat('Ymd', $endToken);
    if (!$start || !$end) return $dates;

    for ($cursor = $start; $cursor <= $end; $cursor = $cursor->modify('+1 day')) {
        $weekday = (int) $cursor->format('N');
        if ($weekday <= 5) $dates[] = $cursor;
    }

    return $dates;
}

function krx_api_id(string $market): string
{
    $market = strtoupper(trim($market));
    if ($market === 'KOSDAQ') return 'ksq_bydd_trd';
    if ($market === 'KONEX') return 'knx_bydd_trd';
    return 'stk_bydd_trd';
}

function normalize_krx_row(array $item): array
{
    return [
        'date' => $item['BAS_DD'] ?? '',
        'open' => (int) ($item['TDD_OPNPRC'] ?? 0),
        'high' => (int) ($item['TDD_HGPRC'] ?? 0),
        'low' => (int) ($item['TDD_LWPRC'] ?? 0),
        'close' => (int) ($item['TDD_CLSPRC'] ?? 0),
        'volume' => (int) ($item['ACC_TRDVOL'] ?? 0),
        'change' => (int) ($item['CMPPREVDD_PRC'] ?? 0),
        'changePct' => (float) ($item['FLUC_RT'] ?? 0),
        'listedShares' => (int) ($item['LIST_SHRS'] ?? 0),
    ];
}

function kiwoom_chart_config(string $interval): array
{
    $normalized = strtolower(trim($interval));
    if ($normalized === 'weekly') {
        return [
            'interval' => 'weekly',
            'api_id' => 'ka10082',
            'series_key' => 'stk_stk_pole_chart_qry',
            'date_key' => 'dt',
            'time_key' => '',
        ];
    }
    if ($normalized === 'minute') {
        return [
            'interval' => 'minute',
            'api_id' => 'ka10080',
            'series_key' => 'stk_min_pole_chart_qry',
            'date_key' => '',
            'time_key' => 'cntr_tm',
        ];
    }

    return [
        'interval' => 'daily',
        'api_id' => 'ka10081',
        'series_key' => 'stk_dt_pole_chart_qry',
        'date_key' => 'dt',
        'time_key' => '',
    ];
}

function kiwoom_chart_body(string $stockCode, array $config, string $endDate, string $adjusted, string $tickScope): array
{
    $body = [
        'stk_cd' => $stockCode,
        'upd_stkpc_tp' => $adjusted === '0' ? '0' : '1',
    ];

    if ($config['interval'] === 'minute') {
        $body['tic_scope'] = $tickScope !== '' ? $tickScope : '1';
        if ($endDate !== '') $body['base_dt'] = $endDate;
        return $body;
    }

    $body['base_dt'] = $endDate;
    return $body;
}

function kiwoom_row_date_token(array $row, array $config): string
{
    $dateKey = $config['date_key'];
    $timeKey = $config['time_key'];

    if ($dateKey !== '' && !empty($row[$dateKey])) {
        return preg_replace('/\D/', '', (string) $row[$dateKey]);
    }
    if ($timeKey !== '' && !empty($row[$timeKey])) {
        return preg_replace('/\D/', '', (string) $row[$timeKey]);
    }
    return '';
}

$action = $_GET['action'] ?? '';
$endpoint = $_GET['endpoint'] ?? '';

try {
    if ($action === 'dart') {
        $key = dart_key();
        if ($key === '') json_response(503, ['error' => 'DART API key is not configured']);

        $params = query_without($_GET, ['action', 'endpoint']);
        $params['crtfc_key'] = $key;
        $url = DART_BASE . $endpoint . '?' . http_build_query($params);
        $upstream = request_upstream($url);
        http_response_code($upstream['status']);
        echo $upstream['body'];
        exit;
    }

    if ($action === 'kiwoom_quote') {
        if (kiwoom_app_key() === '' || kiwoom_secret_key() === '') {
            json_response(200, ['live' => false, 'error' => 'Kiwoom App Key/Secret is not configured']);
        }

        $stockCode = trim((string) ($_GET['stock_code'] ?? ''));
        if ($stockCode === '') json_response(400, ['error' => 'stock_code is required']);

        $upstream = request_kiwoom_api('/api/dostk/stkinfo', 'ka10001', ['stk_cd' => $stockCode]);
        $payload = safe_json_decode($upstream['body']);
        $payload['live'] = $upstream['status'] < 400;
        $payload['source'] = 'kiwoom_rest';
        $payload['fetched_at'] = now_kst()->format(DateTimeInterface::ATOM);
        json_response($upstream['status'], $payload);
    }

    if ($action === 'kiwoom_chart') {
        if (kiwoom_app_key() === '' || kiwoom_secret_key() === '') {
            json_response(200, [
                'live' => false,
                'source' => 'kiwoom_rest',
                'error' => 'Kiwoom App Key/Secret is not configured',
                'interval' => strtolower(trim((string) ($_GET['interval'] ?? 'daily'))),
                'series_key' => '',
                'date_key' => '',
                'time_key' => '',
                'rows' => [],
            ]);
        }

        $stockCode = trim((string) ($_GET['stock_code'] ?? ''));
        $interval = strtolower(trim((string) ($_GET['interval'] ?? 'daily')));
        $startDate = preg_replace('/\D/', '', (string) ($_GET['start_date'] ?? date('Y') . '0101'));
        $endDate = preg_replace('/\D/', '', (string) ($_GET['end_date'] ?? date('Ymd')));
        $adjusted = trim((string) ($_GET['adjusted'] ?? '1'));
        $tickScope = trim((string) ($_GET['tick_scope'] ?? '1'));

        if ($stockCode === '') {
            json_response(400, ['error' => 'stock_code is required', 'rows' => []]);
        }

        $config = kiwoom_chart_config($interval);
        $rows = [];
        $page = 0;
        $error = null;
        $contYn = '';
        $nextKey = '';

        do {
            $page += 1;
            $upstream = request_kiwoom_api(
                '/api/dostk/chart',
                $config['api_id'],
                kiwoom_chart_body($stockCode, $config, $endDate, $adjusted, $tickScope),
                [
                    'cont_yn' => $contYn,
                    'next_key' => $nextKey,
                ]
            );
            $payload = safe_json_decode($upstream['body']);

            if ($upstream['status'] >= 400) {
                $error = (string) ($payload['return_msg'] ?? $payload['msg'] ?? $payload['error'] ?? 'Kiwoom chart request failed');
                break;
            }

            $chunk = $payload[$config['series_key']] ?? [];
            if (!is_array($chunk) || !$chunk) {
                break;
            }

            $rows = array_merge($rows, $chunk);
            $contYn = strtoupper(trim((string) ($upstream['headers']['cont-yn'] ?? '')));
            $nextKey = trim((string) ($upstream['headers']['next-key'] ?? ''));

            $earliest = null;
            foreach ($chunk as $row) {
                if (!is_array($row)) continue;
                $token = kiwoom_row_date_token($row, $config);
                if ($token === '') continue;
                $earliest = $earliest === null ? $token : min($earliest, $token);
            }

            if ($contYn !== 'Y' || $nextKey === '') {
                break;
            }

            if ($startDate !== '' && $earliest !== null && substr($earliest, 0, 8) < $startDate) {
                break;
            }
        } while ($page < 20);

        json_response(200, [
            'live' => $error === null && !empty($rows),
            'source' => 'kiwoom_rest',
            'error' => $error,
            'interval' => $config['interval'],
            'fetched_at' => now_kst()->format(DateTimeInterface::ATOM),
            'series_key' => $config['series_key'],
            'date_key' => $config['date_key'],
            'time_key' => $config['time_key'],
            'rows' => $rows,
        ]);
    }

    if ($action === 'yfinance_quote') {
        $stockCode = trim((string) ($_GET['stock_code'] ?? ''));
        $market = trim((string) ($_GET['market'] ?? 'KOSPI'));
        $nameHint = trim((string) ($_GET['name_hint'] ?? ''));
        if ($stockCode === '') {
            json_response(400, ['error' => 'stock_code is required', 'live' => false, 'source' => 'yfinance_python']);
        }

        $payload = request_yfinance_bridge('quote', [
            'stock_code' => $stockCode,
            'market' => $market !== '' ? $market : 'KOSPI',
            'name_hint' => $nameHint,
        ]);
        json_response(200, $payload);
    }

    if ($action === 'yfinance_chart') {
        $stockCode = trim((string) ($_GET['stock_code'] ?? ''));
        $market = trim((string) ($_GET['market'] ?? 'KOSPI'));
        $interval = strtolower(trim((string) ($_GET['interval'] ?? 'daily')));
        $startDate = preg_replace('/\D/', '', (string) ($_GET['start_date'] ?? date('Y') . '0101'));
        $endDate = preg_replace('/\D/', '', (string) ($_GET['end_date'] ?? date('Ymd')));
        $nameHint = trim((string) ($_GET['name_hint'] ?? ''));

        if ($stockCode === '') {
            json_response(400, ['error' => 'stock_code is required', 'live' => false, 'source' => 'yfinance_python', 'rows' => []]);
        }

        $payload = request_yfinance_bridge('chart', [
            'stock_code' => $stockCode,
            'market' => $market !== '' ? $market : 'KOSPI',
            'interval' => $interval !== '' ? $interval : 'daily',
            'start_date' => $startDate,
            'end_date' => $endDate,
            'name_hint' => $nameHint,
        ]);
        json_response(200, $payload);
    }

    if ($action === 'krx') {
        $key = krx_key();
        if ($key === '') json_response(503, ['error' => 'KRX auth key is not configured']);

        $params = query_without($_GET, ['action', 'endpoint']);
        $url = KRX_BASE . $endpoint . '?' . http_build_query($params);
        $upstream = request_upstream($url, ['AUTH_KEY: ' . $key]);
        http_response_code($upstream['status']);
        echo $upstream['body'];
        exit;
    }

    if ($action === 'krx_chart') {
        $key = krx_key();
        if ($key === '') json_response(200, ['live' => false, 'error' => 'KRX auth key is not configured', 'points' => []]);

        $stockCode = trim((string) ($_GET['stock_code'] ?? ''));
        $market = trim((string) ($_GET['market'] ?? 'KOSPI'));
        $startDate = trim((string) ($_GET['start_date'] ?? date('Y') . '0101'));
        $endDate = trim((string) ($_GET['end_date'] ?? date('Ymd')));

        if ($stockCode === '') json_response(400, ['error' => 'stock_code is required', 'points' => []]);

        $apiId = krx_api_id($market);
        $points = [];
        $authError = null;

        foreach (business_dates($startDate, $endDate) as $date) {
            $url = KRX_BASE . '/' . $apiId . '?basDd=' . $date->format('Ymd');
            $upstream = request_upstream($url, ['AUTH_KEY: ' . $key]);
            $payload = safe_json_decode($upstream['body']);

            if (($payload['respCode'] ?? '') === '401') {
                $authError = 'KRX Open API key is unauthorized';
                break;
            }

            $rows = $payload['OutBlock_1'] ?? [];
            foreach ($rows as $row) {
                if (($row['ISU_CD'] ?? '') === $stockCode) {
                    $points[] = normalize_krx_row($row);
                    break;
                }
            }
        }

        json_response(200, [
            'live' => $authError === null && !empty($points),
            'source' => 'php_proxy',
            'error' => $authError,
            'points' => $points,
        ]);
    }

    if ($action === 'gemini') {
        $key = gemini_key();
        if ($key === '') json_response(503, ['error' => 'Gemini API key is not configured']);

        $url = GEMINI_URL . '?key=' . rawurlencode($key);
        $body = file_get_contents('php://input') ?: '{}';
        $upstream = request_upstream($url, ['Content-Type: application/json'], $body, 'POST');
        http_response_code($upstream['status']);
        echo $upstream['body'];
        exit;
    }

    if ($action === 'quote') {
        $stockCode = trim((string) ($_GET['stock_code'] ?? ''));
        if ($stockCode === '') json_response(400, ['error' => 'stock_code is required']);

        $url = NAVER_STOCK_BASE . '/' . rawurlencode($stockCode) . '/basic';
        $upstream = request_upstream($url);
        http_response_code($upstream['status']);
        echo $upstream['body'];
        exit;
    }

    if ($action === 'kakao') {
        $key = kakao_rest_key();
        if ($key === '') json_response(503, ['error' => 'Kakao REST API key is not configured']);

        $payload = parse_json_body();
        $code = trim((string) ($payload['code'] ?? ''));
        $redirectUri = trim((string) ($payload['redirectUri'] ?? ''));
        if ($code === '' || $redirectUri === '') {
            json_response(400, ['error' => 'code and redirectUri are required']);
        }

        $body = http_build_query([
            'grant_type' => 'authorization_code',
            'client_id' => $key,
            'redirect_uri' => $redirectUri,
            'code' => $code,
        ]);

        $upstream = request_upstream(
            KAKAO_TOKEN_URL,
            ['Content-Type: application/x-www-form-urlencoded;charset=utf-8'],
            $body,
            'POST'
        );
        http_response_code($upstream['status']);
        echo $upstream['body'];
        exit;
    }

    if ($action === 'market') {
        $summary = [
            'usdKrw'          => null,
            'jpyKrw'          => null,
            'goldKrwPerGram'  => null,
            'usdKrwChangePct' => null,
            'jpyKrwChangePct' => null,
            'goldChangePct'   => null,
            'vix'             => null,
            'vixChangePct'    => null,
        ];

        // yfinance quote 응답: currentPrice + previousClose → changePct 직접 계산
        $calcChangePct = function(array $q): ?float {
            $cur  = (float) ($q['currentPrice'] ?? 0);
            $prev = (float) ($q['previousClose'] ?? 0);
            if ($cur > 0 && $prev > 0) return (($cur - $prev) / $prev) * 100;
            return null;
        };

        // ── USD/KRW: yfinance 우선, 실패 시 open.er-api 폴백 ──
        try {
            $usdQ = request_yfinance_bridge('quote', ['stock_code' => 'USDKRW=X', 'market' => 'FX']);
            $usdCur = (float) ($usdQ['currentPrice'] ?? 0);
            if ($usdCur > 0) {
                $summary['usdKrw'] = $usdCur;
                $summary['usdKrwChangePct'] = $calcChangePct($usdQ);
            }
        } catch (Throwable $ignored) {}

        // ── JPY/KRW: yfinance 우선, 실패 시 USD 환율로 역산 ──
        try {
            $jpyQ = request_yfinance_bridge('quote', ['stock_code' => 'JPYKRW=X', 'market' => 'FX']);
            $jpyCur = (float) ($jpyQ['currentPrice'] ?? 0);
            if ($jpyCur > 0) {
                $summary['jpyKrw'] = $jpyCur;
                $summary['jpyKrwChangePct'] = $calcChangePct($jpyQ);
            }
        } catch (Throwable $ignored) {}

        // yfinance 실패 시 open.er-api 폴백
        if (!$summary['usdKrw'] || !$summary['jpyKrw']) {
            try {
                $fxUpstream = request_upstream('https://open.er-api.com/v6/latest/USD');
                $fx = safe_json_decode($fxUpstream['body']);
                $usdKrw = (float) ($fx['rates']['KRW'] ?? 0);
                $usdJpy = (float) ($fx['rates']['JPY'] ?? 0);
                if (!$summary['usdKrw'] && $usdKrw > 0) $summary['usdKrw'] = $usdKrw;
                if (!$summary['jpyKrw'] && $usdKrw > 0 && $usdJpy > 0) $summary['jpyKrw'] = $usdKrw / $usdJpy;
            } catch (Throwable $ignored) {}
        }

        // ── 금 시세: GC=F yfinance (전일비 포함) ──
        try {
            $gcQ = request_yfinance_bridge('quote', ['stock_code' => 'GC=F', 'market' => 'COMMODITY']);
            $gcCur = (float) ($gcQ['currentPrice'] ?? 0);
            if ($gcCur > 0 && !empty($summary['usdKrw'])) {
                $summary['goldKrwPerGram'] = round(($gcCur * (float) $summary['usdKrw']) / 31.1034768, 2);
                $summary['goldChangePct'] = $calcChangePct($gcQ);
            }
        } catch (Throwable $ignored) {}

        // 금 폴백: 기존 멀티소스
        if (!$summary['goldKrwPerGram']) {
            try {
                $goldUsdOunce = resolve_gold_usd_ounce();
                if ($goldUsdOunce > 0 && !empty($summary['usdKrw'])) {
                    $summary['goldKrwPerGram'] = round(($goldUsdOunce * (float) $summary['usdKrw']) / 31.1034768, 2);
                }
            } catch (Throwable $ignored) {}
        }

        // ── VIX 지수: ^VIX yfinance ──
        try {
            $vixQ = request_yfinance_bridge('quote', ['stock_code' => '^VIX', 'market' => 'INDEX']);
            $vixCur = (float) ($vixQ['currentPrice'] ?? 0);
            if ($vixCur > 0) {
                $summary['vix'] = round($vixCur, 2);
                $summary['vixChangePct'] = $calcChangePct($vixQ);
            }
        } catch (Throwable $ignored) {}

        json_response(200, $summary);
    }

    if ($action === 'company_directory') {
        json_response(200, company_directory_payload());
    }

    json_response(200, [
        'service' => 'Investment Navigator PHP proxy',
        'status' => 'ok',
        'dart' => dart_key() !== '',
        'kiwoom' => kiwoom_app_key() !== '' && kiwoom_secret_key() !== '',
        'yfinance' => is_file(yfinance_bridge_path()),
        'krx' => krx_key() !== '',
        'gemini' => gemini_key() !== '',
        'kakao' => kakao_rest_key() !== '',
    ]);
} catch (Throwable $error) {
    json_response(500, ['error' => $error->getMessage()]);
}
