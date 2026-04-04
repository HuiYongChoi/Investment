import datetime as dt
import http.server
import json
import os
import pathlib
import urllib.parse
import urllib.request

APP_ROOT = pathlib.Path(__file__).resolve().parent
AWS_FILE = APP_ROOT / "AWS.txt"

DART_BASE = "https://opendart.fss.or.kr/api"
KRX_BASE = "https://data-dbg.krx.co.kr/svc/apis/sto"
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
