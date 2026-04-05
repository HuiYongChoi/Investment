#!/usr/bin/env python3

import argparse
import datetime as dt
import json
import math
from typing import Any, Dict, Iterable, Optional


KST = dt.timezone(dt.timedelta(hours=9))


def now_kst() -> dt.datetime:
    return dt.datetime.now(KST)


def build_yahoo_symbol(stock_code: str, market: str) -> str:
    raw = str(stock_code or "").strip().upper()
    if not raw:
        return ""
    if "." in raw:
        return raw

    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 6 and digits == raw:
        suffix = "KQ" if str(market or "").strip().upper() == "KOSDAQ" else "KS"
        return f"{digits}.{suffix}"
    return raw


def import_yfinance():
    try:
        import yfinance as yf  # type: ignore
    except ModuleNotFoundError as error:
        return None, str(error)
    except Exception as error:  # pragma: no cover - defensive only
        return None, str(error)
    return yf, ""


def parse_date_token(token: str, fallback: dt.date) -> dt.date:
    digits = "".join(ch for ch in str(token or "") if ch.isdigit())[:8]
    if len(digits) != 8:
        return fallback
    return dt.datetime.strptime(digits, "%Y%m%d").date()


def normalize_number(value: Any) -> Optional[float]:
    if value is None:
        return None
    if hasattr(value, "item"):
        try:
            value = value.item()
        except Exception:
            pass
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return None
        value = value.replace(",", "")
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(numeric) or math.isinf(numeric):
        return None
    return int(numeric) if numeric.is_integer() else numeric


def isoformat_kst(value: Any) -> str:
    if value is None:
        return ""
    if hasattr(value, "to_pydatetime"):
        value = value.to_pydatetime()
    if isinstance(value, dt.date) and not isinstance(value, dt.datetime):
        value = dt.datetime.combine(value, dt.time.min)
    if not isinstance(value, dt.datetime):
        return ""
    if value.tzinfo is None:
        value = value.replace(tzinfo=KST)
    else:
        value = value.astimezone(KST)
    return value.isoformat()


def safe_fast_info(ticker) -> Dict[str, Any]:
    try:
        fast_info = getattr(ticker, "fast_info", None)
        return dict(fast_info or {})
    except Exception:
        return {}


def safe_info(ticker) -> Dict[str, Any]:
    try:
        return dict(getattr(ticker, "info", {}) or {})
    except Exception:
        return {}


def safe_history(ticker, **kwargs):
    try:
        return ticker.history(auto_adjust=False, actions=False, repair=True, **kwargs)
    except TypeError:
        return ticker.history(auto_adjust=False, actions=False, **kwargs)
    except Exception:
        return ticker.history(auto_adjust=False, actions=False, **kwargs)


def series_last_valid(values: Iterable[Any]) -> Optional[float]:
    for value in reversed(list(values)):
        numeric = normalize_number(value)
        if numeric is not None:
            return numeric
    return None


def fetch_quote_payload(stock_code: str, market: str = "KOSPI") -> Dict[str, Any]:
    symbol = build_yahoo_symbol(stock_code, market)
    if not symbol:
        return {
            "live": False,
            "source": "yfinance_python",
            "error": "stock_code is required",
            "symbol": "",
            "market": market,
        }

    yf, import_error = import_yfinance()
    if yf is None:
        return {
            "live": False,
            "source": "yfinance_python",
            "error": f"Python yfinance module is unavailable: {import_error}",
            "symbol": symbol,
            "market": market,
        }

    try:
        ticker = yf.Ticker(symbol)
        fast_info = safe_fast_info(ticker)
        info = safe_info(ticker)
        history = safe_history(ticker, period="7d", interval="1d")

        history_close = series_last_valid(history["Close"].tolist()) if not history.empty and "Close" in history else None
        previous_close = None
        last_timestamp = None
        open_price = None
        day_high = None
        day_low = None
        volume = None

        if not history.empty:
            rows = history.dropna(subset=["Close"]) if "Close" in history else history
            if not rows.empty:
                last_row = rows.iloc[-1]
                previous_row = rows.iloc[-2] if len(rows.index) > 1 else None
                previous_close = normalize_number(previous_row.get("Close")) if previous_row is not None else None
                last_timestamp = rows.index[-1]
                open_price = normalize_number(last_row.get("Open"))
                day_high = normalize_number(last_row.get("High"))
                day_low = normalize_number(last_row.get("Low"))
                volume = normalize_number(last_row.get("Volume"))

        current_price = normalize_number(
            fast_info.get("lastPrice")
            or fast_info.get("regularMarketPrice")
            or info.get("currentPrice")
            or info.get("regularMarketPrice")
            or history_close
        )
        previous_close = normalize_number(
            fast_info.get("previousClose")
            or info.get("previousClose")
            or info.get("regularMarketPreviousClose")
            or previous_close
        )
        open_price = normalize_number(
            fast_info.get("open")
            or info.get("open")
            or info.get("regularMarketOpen")
            or open_price
        )
        day_high = normalize_number(
            fast_info.get("dayHigh")
            or info.get("dayHigh")
            or info.get("regularMarketDayHigh")
            or day_high
        )
        day_low = normalize_number(
            fast_info.get("dayLow")
            or info.get("dayLow")
            or info.get("regularMarketDayLow")
            or day_low
        )
        volume = normalize_number(
            fast_info.get("lastVolume")
            or fast_info.get("regularMarketVolume")
            or info.get("volume")
            or info.get("regularMarketVolume")
            or volume
        )

        if current_price is None:
            return {
                "live": False,
                "source": "yfinance_python",
                "error": "Yahoo Finance returned no quote data",
                "symbol": symbol,
                "market": market,
                "fetched_at": now_kst().isoformat(),
            }

        return {
            "live": True,
            "source": "yfinance_python",
            "symbol": symbol,
            "market": market,
            "shortName": info.get("shortName") or info.get("longName") or "",
            "currentPrice": current_price,
            "previousClose": previous_close,
            "open": open_price,
            "dayHigh": day_high,
            "dayLow": day_low,
            "volume": volume,
            "regularMarketTime": isoformat_kst(last_timestamp),
            "fetched_at": now_kst().isoformat(),
        }
    except Exception as error:
        return {
            "live": False,
            "source": "yfinance_python",
            "error": str(error),
            "symbol": symbol,
            "market": market,
            "fetched_at": now_kst().isoformat(),
        }


def fetch_chart_payload(
    stock_code: str,
    market: str = "KOSPI",
    interval: str = "daily",
    start_date: str = "",
    end_date: str = "",
) -> Dict[str, Any]:
    symbol = build_yahoo_symbol(stock_code, market)
    if not symbol:
        return {
            "live": False,
            "source": "yfinance_python",
            "error": "stock_code is required",
            "symbol": "",
            "market": market,
            "interval": interval,
            "rows": [],
        }

    yf, import_error = import_yfinance()
    if yf is None:
        return {
            "live": False,
            "source": "yfinance_python",
            "error": f"Python yfinance module is unavailable: {import_error}",
            "symbol": symbol,
            "market": market,
            "interval": interval,
            "rows": [],
        }

    normalized_interval = str(interval or "daily").strip().lower()
    if normalized_interval not in {"daily", "weekly"}:
        return {
            "live": False,
            "source": "yfinance_python",
            "error": f"Unsupported yfinance interval: {normalized_interval}",
            "symbol": symbol,
            "market": market,
            "interval": normalized_interval,
            "rows": [],
        }

    today = now_kst().date()
    start = parse_date_token(start_date, dt.date(today.year, 1, 1))
    end = parse_date_token(end_date, today)
    yf_interval = "1wk" if normalized_interval == "weekly" else "1d"

    try:
        ticker = yf.Ticker(symbol)
        history = safe_history(
            ticker,
            start=start.isoformat(),
            end=(end + dt.timedelta(days=1)).isoformat(),
            interval=yf_interval,
        )
        if history.empty:
            return {
                "live": False,
                "source": "yfinance_python",
                "error": "Yahoo Finance returned no chart rows",
                "symbol": symbol,
                "market": market,
                "interval": normalized_interval,
                "rows": [],
                "fetched_at": now_kst().isoformat(),
            }

        rows = []
        previous_close = None
        for index, row in history.iterrows():
            close = normalize_number(row.get("Close"))
            open_price = normalize_number(row.get("Open"))
            high = normalize_number(row.get("High"))
            low = normalize_number(row.get("Low"))
            volume = normalize_number(row.get("Volume")) or 0
            if close is None or open_price is None or high is None or low is None:
                continue

            base = previous_close if previous_close is not None else open_price
            change = close - base if base is not None else 0
            change_pct = (change / base) * 100 if base else 0
            rows.append({
                "date": index.strftime("%Y-%m-%d"),
                "open": open_price,
                "high": high,
                "low": low,
                "close": close,
                "volume": int(volume) if isinstance(volume, (int, float)) else volume,
                "previousClose": previous_close,
                "change": change,
                "changePct": change_pct,
            })
            previous_close = close

        return {
            "live": bool(rows),
            "source": "yfinance_python",
            "error": None if rows else "Yahoo Finance returned no chart rows",
            "symbol": symbol,
            "market": market,
            "interval": normalized_interval,
            "rows": rows,
            "fetched_at": now_kst().isoformat(),
        }
    except Exception as error:
        return {
            "live": False,
            "source": "yfinance_python",
            "error": str(error),
            "symbol": symbol,
            "market": market,
            "interval": normalized_interval,
            "rows": [],
            "fetched_at": now_kst().isoformat(),
        }


def main() -> None:
    parser = argparse.ArgumentParser(description="Investment Navigator yfinance bridge")
    subparsers = parser.add_subparsers(dest="command", required=True)

    quote_parser = subparsers.add_parser("quote")
    quote_parser.add_argument("--stock-code", required=True)
    quote_parser.add_argument("--market", default="KOSPI")

    chart_parser = subparsers.add_parser("chart")
    chart_parser.add_argument("--stock-code", required=True)
    chart_parser.add_argument("--market", default="KOSPI")
    chart_parser.add_argument("--interval", default="daily")
    chart_parser.add_argument("--start-date", default="")
    chart_parser.add_argument("--end-date", default="")

    args = parser.parse_args()
    if args.command == "quote":
        payload = fetch_quote_payload(args.stock_code, args.market)
    else:
        payload = fetch_chart_payload(args.stock_code, args.market, args.interval, args.start_date, args.end_date)
    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
