# 🧭 Investment Navigator

Investment Navigator는 투자자의 건강한 가치투자 판단을 돕기 위해 `DART(전자공시시스템)`와 `Python yfinance (Yahoo Finance)`를 결합해 재무 분석, 가격 차트, 기술적 분석, AI 브리핑을 제공하는 웹 서비스입니다.

현재 저장소에는 `Kiwoom REST API`와 `KRX Open API` 기반 레거시 코드가 일부 남아 있을 수 있습니다. 다만 앞으로의 기본 시세/차트 소스는 `Python yfinance`로 간주합니다.

---

## 🌟 주요 기능 및 특징

### 1. 🔒 편리한 인증 및 개인화
* **카카오 로그인**: Kakao JS SDK를 이용해 간편하게 로그인할 수 있습니다.
* **카카오 공유/메시지 연동**: 브리핑을 카카오톡으로 전송하거나 공유 흐름으로 보낼 수 있도록 구성되어 있습니다.

### 2. 📊 데이터 파이프라인 기준 (DART + yfinance)
* **DART API**
  * 역할: 사업보고서, 반기보고서, 분기보고서, 재무제표 등 펀더멘털 데이터 수집
  * 활용: 매출, 영업이익, 순이익, 자산, 부채, 자본 기반 가치평가
* **Python yfinance (Yahoo Finance)**
  * 역할: 현재가, 전일 대비, 거래량, 일봉/주봉/제한적 분봉 OHLCV 수집
  * 활용: 가격 스트립, 캔들 차트, 이동평균선, RSI, MACD, 스토캐스틱, 볼린저 밴드 계산
  * 장점: 고정 IP 의존성이 없고, 로컬 개발이나 핫스팟 환경에서도 바로 시작하기 쉽습니다.

### 3. 🤖 AI 투자 브리핑 및 리포트 자동 생성
* **Gemini 통합**: 재무 데이터 및 기술 지표를 바탕으로 핵심만 짚은 요약 리포트를 한국어로 생성합니다.
* **수동 보고서 작성 UX**: 자동 호출 대신 사용자가 직접 `보고서 작성` 버튼을 눌렀을 때만 AI 리포트를 생성합니다.
* **PDF 리포트**: 브리핑 내용을 별도 PDF 페이지로 조합해 내려받을 수 있습니다.

---

## 🛠 권장 아키텍처

### Frontend
* **순수 HTML / Vanilla JS SPA**
* 가격/차트 소스 라벨은 `Yahoo Finance (yfinance Python)`처럼 명확히 표기
* 실제 데이터가 없을 때는 가짜 차트 대신 빈 상태와 오류 메시지 표시

### Market Data Layer
* **권장**: Python에서 `yfinance`로 시세/차트를 수집하고, 프론트엔드가 쓰기 쉬운 JSON으로 정규화
* 정규화 필드 예시: `date`, `open`, `high`, `low`, `close`, `volume`, `change`, `changePct`
* 한국 종목 티커 규칙:
  * `KOSPI`: `005930.KS`
  * `KOSDAQ`: `035720.KQ`

### Legacy Files
* 현재 런타임의 시세/차트 경로는 공통 Python 브리지인 `yfinance_bridge.py`를 통해 `Yahoo Finance` 데이터를 정규화합니다.
* `api_proxy.py`, `api_proxy.rb`, `proxy.php`는 각각 로컬/운영 진입점이지만, `quote`/`chart` 응답 형식은 같은 `yfinance` 규칙을 따르도록 맞춥니다.
* 기존 `Kiwoom`/`KRX` 관련 엔드포인트는 레거시 또는 검증 보조용으로만 남겨두는 방향을 권장합니다.

---

## 🚀 빠른 시작

### 1. Python 환경 준비

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install yfinance pandas requests
python3 api_proxy.py
```

로컬 프런트엔드는 기본적으로 `http://localhost:8081/yfinance/quote` 와 `http://localhost:8081/yfinance/chart` 를 사용합니다.

### 2. yfinance로 한국 종목 데이터 바로 가져오기

```python
import yfinance as yf


def yahoo_symbol(stock_code: str, market: str) -> str:
    suffix = ".KS" if market.upper() == "KOSPI" else ".KQ"
    return f"{stock_code}{suffix}"


symbol = yahoo_symbol("005930", "KOSPI")
ticker = yf.Ticker(symbol)

quote = ticker.fast_info
daily = ticker.history(period="3mo", interval="1d", auto_adjust=False)
weekly = ticker.history(period="1y", interval="1wk", auto_adjust=False)

print(symbol)
print("last price:", quote.get("lastPrice"))
print(daily.tail())
print(weekly.tail())
```

### 3. 앱에서 바로 쓰기 좋은 정규화 예시

```python
import math
import yfinance as yf


def yahoo_symbol(stock_code: str, market: str) -> str:
    suffix = ".KS" if market.upper() == "KOSPI" else ".KQ"
    return f"{stock_code}{suffix}"


def normalize_ohlcv(frame):
    points = []
    previous_close = None

    for index, row in frame.iterrows():
        close = float(row["Close"])
        change = 0.0 if previous_close is None else close - previous_close
        change_pct = 0.0 if previous_close in (None, 0) else (change / previous_close) * 100

        points.append({
            "date": index.strftime("%Y%m%d"),
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": close,
            "volume": int(row["Volume"]) if not math.isnan(row["Volume"]) else 0,
            "change": change,
            "changePct": change_pct,
        })
        previous_close = close

    return points


frame = yf.Ticker(yahoo_symbol("005930", "KOSPI")).history(
    period="1mo",
    interval="1d",
    auto_adjust=False,
)

payload = {
    "source": "yfinance_python",
    "symbol": "005930.KS",
    "points": normalize_ohlcv(frame),
}

print(payload["points"][-3:])
```

더 긴 예시는 [docs/yfinance-python-reference.md](/Users/huiyong/Desktop/Vibe%20Investment/docs/yfinance-python-reference.md) 에 정리했습니다.

---

## 📌 운영 원칙

* 비밀값은 환경변수 또는 서버 외부 비밀파일로 관리합니다.
* `yfinance` 수집 실패 시 합성 차트를 채우지 말고, 빈 상태와 명확한 오류 메시지를 우선합니다.
* 가격/차트/브리핑의 데이터 출처는 UI에 명확히 표기합니다.
* `KRX Open API`는 검증 보조용으로만 사용하고, 기본 시세/차트 파이프라인은 `Python yfinance`로 둡니다.

---

## 📝 마이그레이션 메모

* 기존 `Kiwoom REST API` 고정 IP 제약이 있는 환경에서는 `Python yfinance`가 더 실용적입니다.
* 현재 저장소의 가격 스트립, 차트, 기술적 분석 입력 OHLCV는 `yfinance_bridge.py` 기반 `Yahoo Finance (yfinance Python)` 흐름으로 전환되어 있습니다.
* 남아 있는 `Kiwoom`/`KRX` 코드는 보조 검증이나 과거 비교를 위한 레거시로 간주합니다.

---

## 🔍 운영 검증 체크리스트

### PDF 리포트
PDF 관련 수정은 아래를 모두 만족해야 완료로 간주합니다.

1. 실제 PDF 파일을 생성한다.
2. 파일 크기와 페이지 수를 확인한다.
3. `PyMuPDF(fitz)` 같은 렌더러로 첫 페이지를 이미지로 렌더링한다.
4. 렌더 이미지에서 사용자가 텍스트를 읽을 수 있어야 한다.

### 카카오 전송
카카오 관련 수정은 아래 순서로 확인합니다.

1. 버튼 클릭 이벤트가 실제 함수로 연결되는지 확인
2. 브라우저 Network에서 요청 URL, 상태코드, 응답 본문 확인
3. `proxy.php`가 upstream `code/msg/status`를 제대로 전달하는지 확인
4. 직접 전송이 막히면 fallback 공유 흐름이 실제 동작하는지 확인

### 라이브 배포
* 서버 반영 뒤 `curl`로 라이브 `index.html`, `script.js`, `style.css`의 버전 문자열을 확인합니다.
* JS/CSS 수정 시 `?v=`를 올려 캐시를 무효화합니다.
* 배포 방식은 `scp -> /home/bitnami -> backup -> sudo cp`를 기본으로 사용합니다.
