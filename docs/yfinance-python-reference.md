# yfinance Python Reference

Investment Navigator에서 한국 상장 종목 시세와 차트를 `Python yfinance`로 직접 가져올 때 바로 복붙해서 쓸 수 있는 예시 모음입니다.

## 1. 설치

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install yfinance pandas requests
```

## 2. 한국 종목 티커 변환

```python
def yahoo_symbol(stock_code: str, market: str) -> str:
    market = market.upper()
    if market == "KOSPI":
        return f"{stock_code}.KS"
    if market == "KOSDAQ":
        return f"{stock_code}.KQ"
    raise ValueError(f"Unsupported market: {market}")
```

예시:

```python
print(yahoo_symbol("005930", "KOSPI"))   # 005930.KS
print(yahoo_symbol("035720", "KOSDAQ"))  # 035720.KQ
```

## 3. 현재가와 기본 정보

```python
import yfinance as yf


symbol = "005930.KS"
ticker = yf.Ticker(symbol)
info = ticker.fast_info

payload = {
    "symbol": symbol,
    "currency": info.get("currency"),
    "lastPrice": info.get("lastPrice"),
    "open": info.get("open"),
    "dayHigh": info.get("dayHigh"),
    "dayLow": info.get("dayLow"),
    "previousClose": info.get("previousClose"),
    "volume": info.get("lastVolume"),
}

print(payload)
```

## 4. 일봉 / 주봉 / YTD

```python
import datetime as dt
import yfinance as yf


ticker = yf.Ticker("005930.KS")

daily_1m = ticker.history(period="1mo", interval="1d", auto_adjust=False)
daily_3m = ticker.history(period="3mo", interval="1d", auto_adjust=False)
weekly_1y = ticker.history(period="1y", interval="1wk", auto_adjust=False)

start_of_year = dt.date(dt.date.today().year, 1, 1)
ytd = ticker.history(start=start_of_year.isoformat(), interval="1d", auto_adjust=False)
```

## 5. 앱용 OHLCV 정규화

```python
import math


def normalize_history(frame):
    rows = []
    previous_close = None

    for index, row in frame.iterrows():
        close = float(row["Close"])
        change = 0.0 if previous_close is None else close - previous_close
        change_pct = 0.0 if previous_close in (None, 0) else (change / previous_close) * 100

        rows.append({
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

    return rows
```

## 6. 최소 수집 함수 예시

```python
import datetime as dt
import yfinance as yf


def yahoo_symbol(stock_code: str, market: str) -> str:
    if market.upper() == "KOSPI":
        return f"{stock_code}.KS"
    if market.upper() == "KOSDAQ":
        return f"{stock_code}.KQ"
    raise ValueError(f"Unsupported market: {market}")


def fetch_market_bundle(stock_code: str, market: str):
    symbol = yahoo_symbol(stock_code, market)
    ticker = yf.Ticker(symbol)

    quote = ticker.fast_info
    daily = ticker.history(period="3mo", interval="1d", auto_adjust=False)
    weekly = ticker.history(period="1y", interval="1wk", auto_adjust=False)
    ytd = ticker.history(
        start=dt.date(dt.date.today().year, 1, 1).isoformat(),
        interval="1d",
        auto_adjust=False,
    )

    return {
        "source": "yfinance_python",
        "symbol": symbol,
        "quote": {
            "close": quote.get("lastPrice"),
            "open": quote.get("open"),
            "high": quote.get("dayHigh"),
            "low": quote.get("dayLow"),
            "previousClose": quote.get("previousClose"),
            "volume": quote.get("lastVolume"),
        },
        "daily3m": normalize_history(daily),
        "weekly1y": normalize_history(weekly),
        "ytd": normalize_history(ytd),
    }
```

## 7. 운영 시 주의점

* `yfinance`는 무인증이지만, 응답 지연이나 일시 실패가 있을 수 있으므로 재시도와 캐시를 두는 편이 좋습니다.
* 분봉 데이터는 제공 범위가 제한적이므로, 항상 지원된다고 가정하지 않습니다.
* 데이터가 비어 있으면 합성 차트보다 빈 상태와 오류 메시지를 우선합니다.
* UI에는 `Yahoo Finance (yfinance Python)` 같은 출처 문구를 명시합니다.
