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
            'usdKrw' => null,
            'jpyKrw' => null,
            'goldKrwPerGram' => null,
        ];

        try {
            $fxUpstream = request_upstream('https://open.er-api.com/v6/latest/USD');
            $fx = safe_json_decode($fxUpstream['body']);
            $usdKrw = (float) ($fx['rates']['KRW'] ?? 0);
            $usdJpy = (float) ($fx['rates']['JPY'] ?? 0);
            if ($usdKrw > 0) $summary['usdKrw'] = $usdKrw;
            if ($usdKrw > 0 && $usdJpy > 0) $summary['jpyKrw'] = $usdKrw / $usdJpy;
        } catch (Throwable $ignored) {
        }

        try {
            $goldUpstream = request_upstream('https://api.metals.live/v1/spot/gold');
            $goldPayload = safe_json_decode($goldUpstream['body']);
            $goldUsdOunce = null;
            if (isset($goldPayload[0]) && is_array($goldPayload)) {
                foreach ($goldPayload as $row) {
                    if (is_array($row) && array_key_exists('gold', $row)) {
                        $goldUsdOunce = (float) $row['gold'];
                        break;
                    }
                }
            } elseif (isset($goldPayload['gold'])) {
                $goldUsdOunce = (float) $goldPayload['gold'];
            }

            if ($goldUsdOunce && !empty($summary['usdKrw'])) {
                $summary['goldKrwPerGram'] = round(($goldUsdOunce * (float) $summary['usdKrw']) / 31.1034768, 2);
            }
        } catch (Throwable $ignored) {
        }

        json_response(200, $summary);
    }

    json_response(200, [
        'service' => 'Investment Navigator PHP proxy',
        'status' => 'ok',
        'dart' => dart_key() !== '',
        'krx' => krx_key() !== '',
        'gemini' => gemini_key() !== '',
        'kakao' => kakao_rest_key() !== '',
    ]);
} catch (Throwable $error) {
    json_response(500, ['error' => $error->getMessage()]);
}
