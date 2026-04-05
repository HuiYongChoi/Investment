import datetime as dt
import http.server
import json
import os
import pathlib
import tempfile
import urllib.parse
import urllib.error
import urllib.request

import yfinance_bridge

APP_ROOT = pathlib.Path(__file__).resolve().parent
AWS_FILE = APP_ROOT / "AWS.txt"

DART_BASE = "https://opendart.fss.or.kr/api"
KRX_BASE = "https://data-dbg.krx.co.kr/svc/apis/sto"
KIWOOM_BASE = "https://api.kiwoom.com"
KIWOOM_TOKEN_URL = "https://api.kiwoom.com/oauth2/token"
NAVER_STOCK_BASE = "https://m.stock.naver.com/api/stock"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"


def read_aws_lines():
    if not AWS_FILE.exists():
        return []
    return [line.strip() for line in AWS_FILE.read_text(encoding="utf-8").splitlines()]


AWS_LINES = read_aws_lines()


def read_next_value(label: str) -> str:
    for index, line in enumerate(AWS_LINES):
        if label in line:
            for candidate in AWS_LINES[index + 1:]:
                if candidate and not candidate.startswith("[") and not candidate.startswith("#"):
                    return candidate
    return ""


def read_inline_value(prefix: str) -> str:
    for line in AWS_LINES:
        if line.startswith(prefix):
            return line.split(":", 1)[1].strip()
    return ""


def env_or_aws(env_name: str, next_label: str = "", inline_prefix: str = "") -> str:
    value = os.getenv(env_name, "").strip()
    if value:
        return value
    if inline_prefix:
        return read_inline_value(inline_prefix)
    if next_label:
        return read_next_value(next_label)
    return ""


DART_KEY = env_or_aws("DART_API_KEY", next_label="DART 오픈 API")
KRX_KEY = env_or_aws("KRX_AUTH_KEY", next_label="KRX Open API")
GEMINI_KEY = env_or_aws("GEMINI_API_KEY", next_label="Gemini API KEY")
KAKAO_REST_KEY = env_or_aws("KAKAO_REST_API_KEY", inline_prefix="Rest API:")
KIWOOM_APP_KEY = os.getenv("KIWOOM_APP_KEY", "").strip()
KIWOOM_SECRET_KEY = os.getenv("KIWOOM_SECRET_KEY", "").strip()
KIWOOM_TOKEN_CACHE = pathlib.Path(tempfile.gettempdir()) / "investment-navigator-kiwoom-token.json"


def request_json(url: str, method: str = "GET", params=None, headers=None, json_body=None, form_body=None):
    params = params or {}
    headers = headers or {}

    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)

    body = None
    if json_body is not None:
        body = json.dumps(json_body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    elif form_body is not None:
        body = urllib.parse.urlencode(form_body).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded;charset=utf-8"

    request = urllib.request.Request(url, data=body, method=method, headers=headers)
    with urllib.request.urlopen(request, timeout=20) as response:
        raw = response.read().decode("utf-8")
        return response.status, raw


def request_details(url: str, method: str = "GET", params=None, headers=None, json_body=None, form_body=None):
    params = params or {}
    headers = headers or {}

    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)

    body = None
    if json_body is not None:
        body = json.dumps(json_body).encode("utf-8")
        headers["Content-Type"] = "application/json;charset=UTF-8"
    elif form_body is not None:
        body = urllib.parse.urlencode(form_body).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded;charset=utf-8"

    request = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read().decode("utf-8")
            response_headers = {key.lower(): value for key, value in response.headers.items()}
            return response.status, raw, response_headers
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8")
        response_headers = {key.lower(): value for key, value in error.headers.items()}
        return error.code, raw, response_headers


def safe_json(raw: str):
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"raw": raw}


def date_token(value: dt.date) -> str:
    return value.strftime("%Y%m%d")


def business_days(start_date: dt.date, end_date: dt.date):
    cursor = start_date
    result = []
    while cursor <= end_date:
        if cursor.weekday() < 5:
            result.append(cursor)
        cursor += dt.timedelta(days=1)
    return result


def krx_api_id(market: str) -> str:
    market = (market or "KOSPI").upper()
    if market == "KOSDAQ":
        return "ksq_bydd_trd"
    if market == "KONEX":
        return "knx_bydd_trd"
    return "stk_bydd_trd"


def normalize_krx(item):
    return {
        "date": item.get("BAS_DD"),
        "open": int(item.get("TDD_OPNPRC", 0)),
        "high": int(item.get("TDD_HGPRC", 0)),
        "low": int(item.get("TDD_LWPRC", 0)),
        "close": int(item.get("TDD_CLSPRC", 0)),
        "volume": int(item.get("ACC_TRDVOL", 0)),
        "change": int(item.get("CMPPREVDD_PRC", 0)),
        "changePct": float(item.get("FLUC_RT", 0)),
        "listedShares": int(item.get("LIST_SHRS", 0)),
    }


def parse_kiwoom_expiry(value: str) -> float:
    text = (value or "").strip()
    if not text:
        return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=23)).timestamp()
    for fmt in ("%Y%m%d%H%M%S", "%Y-%m-%d %H:%M:%S"):
        try:
            parsed = dt.datetime.strptime(text, fmt)
            return parsed.replace(tzinfo=dt.timezone(dt.timedelta(hours=9))).timestamp()
        except ValueError:
            continue
    try:
        return dt.datetime.fromisoformat(text).timestamp()
    except ValueError:
        return (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=23)).timestamp()


def read_cached_kiwoom_token():
    if not KIWOOM_TOKEN_CACHE.exists():
        return {}
    payload = safe_json(KIWOOM_TOKEN_CACHE.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        return {}
    token = str(payload.get("token", "")).strip()
    expires_ts = float(payload.get("expires_ts", 0) or 0)
    if not token or expires_ts <= (dt.datetime.now().timestamp() + 300):
        return {}
    return payload


def write_cached_kiwoom_token(payload):
    KIWOOM_TOKEN_CACHE.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    try:
        os.chmod(KIWOOM_TOKEN_CACHE, 0o600)
    except OSError:
        pass


def invalidate_cached_kiwoom_token():
    if KIWOOM_TOKEN_CACHE.exists():
        KIWOOM_TOKEN_CACHE.unlink()


def ensure_kiwoom_token(force_refresh: bool = False) -> str:
    if not KIWOOM_APP_KEY or not KIWOOM_SECRET_KEY:
        raise RuntimeError("Kiwoom App Key/Secret가 설정되지 않았습니다.")

    if not force_refresh:
        cached = read_cached_kiwoom_token()
        if cached.get("token"):
            token_type = str(cached.get("token_type", "Bearer")).strip() or "Bearer"
            return f"{token_type} {str(cached['token']).strip()}"

    status, raw, _ = request_details(
        KIWOOM_TOKEN_URL,
        method="POST",
        json_body={
            "grant_type": "client_credentials",
            "appkey": KIWOOM_APP_KEY,
            "secretkey": KIWOOM_SECRET_KEY,
        },
    )
    payload = safe_json(raw)
    token = str(payload.get("token", "")).strip()
    if status >= 400 or not token:
        raise RuntimeError(str(payload.get("return_msg") or payload.get("msg") or payload.get("error") or "Kiwoom access token issuance failed"))

    token_type = str(payload.get("token_type", "Bearer")).strip() or "Bearer"
    write_cached_kiwoom_token({
        "token": token,
        "token_type": token_type,
        "expires_dt": str(payload.get("expires_dt", "")),
        "expires_ts": parse_kiwoom_expiry(str(payload.get("expires_dt", ""))),
    })
    return f"{token_type} {token}"


def request_kiwoom_api(path: str, api_id: str, body: dict, cont_yn: str = "", next_key: str = "", force_refresh: bool = False):
    headers = {
        "Authorization": ensure_kiwoom_token(force_refresh=force_refresh),
        "api-id": api_id,
    }
    if cont_yn:
        headers["cont-yn"] = cont_yn
    if next_key:
        headers["next-key"] = next_key

    status, raw, response_headers = request_details(
        f"{KIWOOM_BASE}{path}",
        method="POST",
        headers=headers,
        json_body=body,
    )
    if status in (401, 403) and not force_refresh:
        invalidate_cached_kiwoom_token()
        return request_kiwoom_api(path, api_id, body, cont_yn=cont_yn, next_key=next_key, force_refresh=True)
    return status, raw, response_headers


def kiwoom_chart_config(interval: str):
    normalized = (interval or "daily").strip().lower()
    if normalized == "weekly":
        return {"interval": "weekly", "api_id": "ka10082", "series_key": "stk_stk_pole_chart_qry", "date_key": "dt", "time_key": ""}
    if normalized == "minute":
        return {"interval": "minute", "api_id": "ka10080", "series_key": "stk_min_pole_chart_qry", "date_key": "", "time_key": "cntr_tm"}
    return {"interval": "daily", "api_id": "ka10081", "series_key": "stk_dt_pole_chart_qry", "date_key": "dt", "time_key": ""}


def kiwoom_chart_body(stock_code: str, config: dict, end_date: str, adjusted: str, tick_scope: str):
    body = {"stk_cd": stock_code, "upd_stkpc_tp": "0" if adjusted == "0" else "1"}
    if config["interval"] == "minute":
        body["tic_scope"] = tick_scope or "1"
        if end_date:
            body["base_dt"] = end_date
        return body
    body["base_dt"] = end_date
    return body


def kiwoom_row_date_token(row: dict, config: dict):
    date_key = config.get("date_key", "")
    time_key = config.get("time_key", "")
    if date_key and row.get(date_key):
        return "".join(ch for ch in str(row.get(date_key)) if ch.isdigit())
    if time_key and row.get(time_key):
        return "".join(ch for ch in str(row.get(time_key)) if ch.isdigit())
    return ""


class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def send_json(self, status: int, payload):
        self.send_response(status)
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        self.handle_request("GET")

    def do_POST(self):
        self.handle_request("POST")

    def handle_request(self, method: str):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        params = urllib.parse.parse_qs(parsed.query)
        params = {key: value[0] for key, value in params.items()}

        if path.startswith("/dart"):
            self.handle_dart(path, params)
            return
        if path == "/kiwoom/quote":
            self.handle_kiwoom_quote(params)
            return
        if path == "/kiwoom/chart":
            self.handle_kiwoom_chart(params)
            return
        if path == "/yfinance/quote":
            self.handle_yfinance_quote(params)
            return
        if path == "/yfinance/chart":
            self.handle_yfinance_chart(params)
            return
        if path == "/krx/chart":
            self.handle_krx_chart(params)
            return
        if path.startswith("/krx"):
            self.handle_krx(path, params)
            return
        if path == "/gemini":
            self.handle_gemini()
            return
        if path == "/kakao/token":
            self.handle_kakao_token()
            return
        if path == "/market/summary":
            self.handle_market_summary()
            return
        if path == "/market/quote":
            self.handle_market_quote(params)
            return

        self.send_json(200, {
            "service": "Investment Navigator proxy",
            "dart": bool(DART_KEY),
            "kiwoom": bool(KIWOOM_APP_KEY and KIWOOM_SECRET_KEY),
            "yfinance": True,
            "krx": bool(KRX_KEY),
            "gemini": bool(GEMINI_KEY),
            "kakao": bool(KAKAO_REST_KEY),
        })

    def handle_dart(self, path, params):
        if not DART_KEY:
            self.send_json(503, {"error": "DART API 키가 설정되지 않았습니다."})
            return

        params["crtfc_key"] = DART_KEY
        try:
            status, raw = request_json(f"{DART_BASE}{path[5:]}", params=params)
            self.send_response(status)
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(raw.encode("utf-8"))
        except Exception as error:
            self.send_json(500, {"error": str(error)})

    def handle_kiwoom_quote(self, params):
        if not KIWOOM_APP_KEY or not KIWOOM_SECRET_KEY:
            self.send_json(200, {"live": False, "error": "Kiwoom App Key/Secret가 설정되지 않았습니다."})
            return

        stock_code = params.get("stock_code", "").strip()
        if not stock_code:
            self.send_json(400, {"error": "stock_code 파라미터가 필요합니다."})
            return

        try:
            status, raw, _ = request_kiwoom_api("/api/dostk/stkinfo", "ka10001", {"stk_cd": stock_code})
            payload = safe_json(raw)
            payload["live"] = status < 400
            payload["source"] = "kiwoom_rest"
            payload["fetched_at"] = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).isoformat()
            self.send_json(status, payload)
        except Exception as error:
            self.send_json(500, {"error": str(error)})

    def handle_kiwoom_chart(self, params):
        if not KIWOOM_APP_KEY or not KIWOOM_SECRET_KEY:
            self.send_json(200, {
                "live": False,
                "source": "kiwoom_rest",
                "error": "Kiwoom App Key/Secret가 설정되지 않았습니다.",
                "interval": (params.get("interval", "daily") or "daily").lower(),
                "series_key": "",
                "date_key": "",
                "time_key": "",
                "rows": [],
            })
            return

        stock_code = params.get("stock_code", "").strip()
        interval = params.get("interval", "daily").strip().lower()
        start_date = "".join(ch for ch in params.get("start_date", f"{dt.date.today().year}0101") if ch.isdigit())
        end_date = "".join(ch for ch in params.get("end_date", date_token(dt.date.today())) if ch.isdigit())
        adjusted = params.get("adjusted", "1").strip()
        tick_scope = params.get("tick_scope", "1").strip()

        if not stock_code:
            self.send_json(400, {"error": "stock_code 파라미터가 필요합니다.", "rows": []})
            return

        try:
            config = kiwoom_chart_config(interval)
            rows = []
            page = 0
            error_message = None
            cont_yn = ""
            next_key = ""

            while page < 20:
                page += 1
                status, raw, headers = request_kiwoom_api(
                    "/api/dostk/chart",
                    config["api_id"],
                    kiwoom_chart_body(stock_code, config, end_date, adjusted, tick_scope),
                    cont_yn=cont_yn,
                    next_key=next_key,
                )
                payload = safe_json(raw)
                if status >= 400:
                    error_message = str(payload.get("return_msg") or payload.get("msg") or payload.get("error") or "Kiwoom chart request failed")
                    break

                chunk = payload.get(config["series_key"]) or []
                if not isinstance(chunk, list) or not chunk:
                    break

                rows.extend(chunk)
                cont_yn = str(headers.get("cont-yn", "")).strip().upper()
                next_key = str(headers.get("next-key", "")).strip()

                earliest = None
                for row in chunk:
                    if not isinstance(row, dict):
                        continue
                    token = kiwoom_row_date_token(row, config)
                    if not token:
                        continue
                    earliest = token if earliest is None else min(earliest, token)

                if cont_yn != "Y" or not next_key:
                    break
                if start_date and earliest and earliest[:8] < start_date:
                    break

            self.send_json(200, {
                "live": error_message is None and bool(rows),
                "source": "kiwoom_rest",
                "error": error_message,
                "interval": config["interval"],
                "fetched_at": dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).isoformat(),
                "series_key": config["series_key"],
                "date_key": config["date_key"],
                "time_key": config["time_key"],
                "rows": rows,
            })
        except Exception as error:
            self.send_json(500, {"error": str(error), "rows": []})

    def handle_yfinance_quote(self, params):
        stock_code = params.get("stock_code", "").strip()
        market = params.get("market", "KOSPI").strip() or "KOSPI"
        if not stock_code:
            self.send_json(400, {"error": "stock_code 파라미터가 필요합니다.", "live": False, "source": "yfinance_python"})
            return

        payload = yfinance_bridge.fetch_quote_payload(stock_code, market)
        self.send_json(200, payload)

    def handle_yfinance_chart(self, params):
        stock_code = params.get("stock_code", "").strip()
        market = params.get("market", "KOSPI").strip() or "KOSPI"
        interval = params.get("interval", "daily").strip().lower() or "daily"
        start_date = "".join(ch for ch in params.get("start_date", f"{dt.date.today().year}0101") if ch.isdigit())
        end_date = "".join(ch for ch in params.get("end_date", date_token(dt.date.today())) if ch.isdigit())

        if not stock_code:
            self.send_json(400, {"error": "stock_code 파라미터가 필요합니다.", "live": False, "source": "yfinance_python", "rows": []})
            return

        payload = yfinance_bridge.fetch_chart_payload(stock_code, market, interval, start_date, end_date)
        self.send_json(200, payload)

    def handle_krx_chart(self, params):
        if not KRX_KEY:
            self.send_json(200, {"live": False, "error": "KRX 인증키가 설정되지 않았습니다.", "points": []})
            return

        stock_code = params.get("stock_code", "").strip()
        market = params.get("market", "KOSPI")
        start_date = dt.datetime.strptime(params.get("start_date", f"{dt.date.today().year}0101"), "%Y%m%d").date()
        end_date = dt.datetime.strptime(params.get("end_date", date_token(dt.date.today())), "%Y%m%d").date()

        if not stock_code:
            self.send_json(400, {"error": "stock_code 파라미터가 필요합니다.", "points": []})
            return

        api_id = krx_api_id(market)
        series = []
        auth_error = None

        for day in business_days(start_date, end_date):
            try:
                status, raw = request_json(
                    f"{KRX_BASE}/{api_id}",
                    params={"basDd": date_token(day)},
                    headers={"AUTH_KEY": KRX_KEY},
                )
                payload = safe_json(raw)
                if payload.get("respCode") == "401":
                    auth_error = "KRX Open API 인증키가 승인되지 않았거나 권한이 없습니다."
                    break
                items = payload.get("OutBlock_1") or []
                match = next((item for item in items if item.get("ISU_CD") == stock_code), None)
                if match:
                    series.append(normalize_krx(match))
            except Exception as error:
                auth_error = str(error)
                break

        self.send_json(200, {
            "live": auth_error is None and bool(series),
            "source": "krx_open_api",
            "error": auth_error,
            "points": series,
        })

    def handle_krx(self, path, params):
        if not KRX_KEY:
            self.send_json(503, {"error": "KRX 인증키가 설정되지 않았습니다."})
            return

        try:
            status, raw = request_json(
                f"{KRX_BASE}{path[4:]}",
                params=params,
                headers={"AUTH_KEY": KRX_KEY},
            )
            self.send_response(status)
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(raw.encode("utf-8"))
        except Exception as error:
            self.send_json(500, {"error": str(error)})

    def handle_gemini(self):
        if not GEMINI_KEY:
            self.send_json(503, {"error": "Gemini API 키가 설정되지 않았습니다."})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            status, raw = request_json(
                GEMINI_URL,
                method="POST",
                params={"key": GEMINI_KEY},
                json_body=payload,
            )
            self.send_response(status)
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(raw.encode("utf-8"))
        except Exception as error:
            self.send_json(500, {"error": str(error)})

    def handle_kakao_token(self):
        if not KAKAO_REST_KEY:
            self.send_json(503, {"error": "Kakao REST API 키가 설정되지 않았습니다."})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            code = payload.get("code", "").strip()
            redirect_uri = payload.get("redirectUri", "").strip()
            if not code or not redirect_uri:
                self.send_json(400, {"error": "code와 redirectUri가 필요합니다."})
                return
            status, raw = request_json(
                KAKAO_TOKEN_URL,
                method="POST",
                form_body={
                    "grant_type": "authorization_code",
                    "client_id": KAKAO_REST_KEY,
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
            )
            self.send_response(status)
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(raw.encode("utf-8"))
        except Exception as error:
            self.send_json(500, {"error": str(error)})

    def handle_market_summary(self):
        summary = {"usdKrw": None, "jpyKrw": None, "goldKrwPerGram": None}

        try:
            _, fx_raw = request_json("https://open.er-api.com/v6/latest/USD")
            fx = safe_json(fx_raw)
            usd_krw = fx.get("rates", {}).get("KRW")
            usd_jpy = fx.get("rates", {}).get("JPY")
            if usd_krw:
                summary["usdKrw"] = float(usd_krw)
            if usd_krw and usd_jpy:
                summary["jpyKrw"] = float(usd_krw) / float(usd_jpy)
        except Exception:
            pass

        try:
            _, gold_raw = request_json("https://api.metals.live/v1/spot/gold")
            gold_payload = safe_json(gold_raw)
            gold_usd_oz = None
            if isinstance(gold_payload, list):
                for item in gold_payload:
                    if isinstance(item, dict) and "gold" in item:
                        gold_usd_oz = item["gold"]
                        break
            elif isinstance(gold_payload, dict):
                gold_usd_oz = gold_payload.get("gold")

            if gold_usd_oz and summary["usdKrw"]:
                summary["goldKrwPerGram"] = round(float(gold_usd_oz) * float(summary["usdKrw"]) / 31.1034768, 2)
        except Exception:
            pass

        self.send_json(200, summary)

    def handle_market_quote(self, params):
        stock_code = params.get("stock_code", "").strip()
        if not stock_code:
            self.send_json(400, {"error": "stock_code 파라미터가 필요합니다."})
            return

        try:
            status, raw = request_json(f"{NAVER_STOCK_BASE}/{urllib.parse.quote(stock_code)}/basic")
            self.send_response(status)
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(raw.encode("utf-8"))
        except Exception as error:
            self.send_json(500, {"error": str(error)})


if __name__ == "__main__":
    server = http.server.ThreadingHTTPServer(("0.0.0.0", 8081), ProxyHandler)
    print("Investment Navigator Python proxy listening on 8081")
    server.serve_forever()
