#!/usr/bin/env python3
"""Publish DeepRise V13 forecasts directly into the central GitHub ledger.

This is the authoritative forecast creation path. It uses only public Binance
market data, requires the V13 quality gate, never weakens thresholds to fill
slots, and writes no fabricated results. Browser clients consume these records
instead of creating official forecasts locally.
"""
import json, math, os, sys, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

LEDGER = Path('forecast-ledger.json')
NEW_IDS = Path('.ledger_new_forecasts.json')
API = 'https://api.binance.com'
MAX_DAILY = 5
MIN_QUOTE_VOLUME = 20_000_000.0
UNIVERSE = 45
EXCLUDED_BASES = {'USDC','FDUSD','TUSD','USDP','DAI','EUR','TRY','BRL','GBP','BIDR','AEUR','EURI'}


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')


def day_utc():
    return datetime.now(timezone.utc).strftime('%Y-%m-%d')


def get_json(path, params=None):
    url = API + path
    if params:
        url += '?' + urlencode(params)
    req = Request(url, headers={'User-Agent': 'DeepRise-Central-Publisher/13'})
    with urlopen(req, timeout=25) as r:
        return json.loads(r.read().decode('utf-8'))


def ema(values, period):
    if len(values) < period:
        return None
    k = 2.0 / (period + 1.0)
    out = sum(values[:period]) / period
    for v in values[period:]:
        out = v * k + out * (1.0 - k)
    return out


def rsi(values, period=14):
    if len(values) <= period:
        return None
    gains = losses = 0.0
    diffs = [values[i] - values[i-1] for i in range(1, len(values))]
    seed = diffs[:period]
    gains = sum(max(x, 0.0) for x in seed) / period
    losses = sum(max(-x, 0.0) for x in seed) / period
    for d in diffs[period:]:
        gains = (gains * (period - 1) + max(d, 0.0)) / period
        losses = (losses * (period - 1) + max(-d, 0.0)) / period
    if losses == 0:
        return 100.0
    rs = gains / losses
    return 100.0 - 100.0 / (1.0 + rs)


def atr(bars, period=14):
    if len(bars) <= period:
        return None
    trs = []
    prev = float(bars[0][4])
    for b in bars[1:]:
        h, l, c = float(b[2]), float(b[3]), float(b[4])
        trs.append(max(h-l, abs(h-prev), abs(l-prev)))
        prev = c
    return sum(trs[-period:]) / period


def candles(symbol, interval, limit):
    return get_json('/api/v3/klines', {'symbol': symbol, 'interval': interval, 'limit': limit})


def analyze(symbol, quote_volume):
    b15 = candles(symbol, '15m', 120)
    b1h = candles(symbol, '1h', 90)
    if len(b15) < 60 or len(b1h) < 60:
        return None
    # Ignore the currently forming candle for deterministic closed-candle signals.
    b15 = b15[:-1]
    b1h = b1h[:-1]
    c15 = [float(b[4]) for b in b15]
    c1h = [float(b[4]) for b in b1h]
    e20_15, e50_15 = ema(c15, 20), ema(c15, 50)
    e20_1h, e50_1h = ema(c1h, 20), ema(c1h, 50)
    if None in (e20_15, e50_15, e20_1h, e50_1h):
        return None
    long_trend = e20_15 > e50_15 and e20_1h > e50_1h
    short_trend = e20_15 < e50_15 and e20_1h < e50_1h
    if not (long_trend or short_trend):
        return None
    side = 'LONG' if long_trend else 'SHORT'
    last = b15[-1]
    o, h, l, close, vol = map(float, [last[1], last[2], last[3], last[4], last[5]])
    if close <= 0:
        return None
    avgv = sum(float(b[5]) for b in b15[-21:-1]) / 20.0
    volume_ratio = vol / avgv if avgv > 0 else 0.0
    a = atr(b15, 14)
    if not a or a <= 0:
        return None
    atr_pct = a / close * 100.0
    if atr_pct < 0.12 or atr_pct > 6.0:
        return None
    span = max(h-l, close*1e-9)
    body = abs(close-o) / span
    candle_ok = (side == 'LONG' and close > o and body >= 0.25) or (side == 'SHORT' and close < o and body >= 0.25)
    rv = rsi(c15, 14)
    rsi_ok = rv is not None and ((side == 'LONG' and 52 <= rv <= 74) or (side == 'SHORT' and 26 <= rv <= 48))
    mom = (c15[-1] - c15[-5]) / c15[-5] * 100.0 if c15[-5] else 0.0
    momentum_ok = mom > 0 if side == 'LONG' else mom < 0
    liq_ok = quote_volume >= MIN_QUOTE_VOLUME

    score = 40.0  # both 15m and 1h trends are aligned
    score += min(15.0, max(0.0, (volume_ratio - 1.0) * 30.0))
    score += 10.0 if candle_ok else 0.0
    score += 10.0 if liq_ok else 0.0
    score += 10.0 if rsi_ok else 0.0
    score += 5.0 if momentum_ok else 0.0
    score = round(min(100.0, score), 1)

    rr = 1.8
    quality_count = 2
    quality_count += 1 if score >= 72 else 0
    quality_count += 1 if volume_ratio >= 1.2 else 0
    quality_count += 1 if candle_ok else 0
    quality_count += 1 if (liq_ok and rr >= 1.8 and atr_pct <= 6.0) else 0
    if score < 72 or quality_count < 5:
        return None

    if side == 'LONG':
        sl, tp1, tp2 = close-a, close+a, close+a*1.8
    else:
        sl, tp1, tp2 = close+a, close-a, close-a*1.8
    if min(sl, tp1, tp2) <= 0:
        return None
    return {
        'symbol': symbol, 'side': side, 'entry': close, 'tp1': tp1, 'tp2': tp2, 'sl': sl,
        'score': score, 'volume_ratio': round(volume_ratio, 4), 'quote_volume': round(quote_volume, 2),
        'atr_pct': round(atr_pct, 4), 'rsi_15m': round(rv, 2) if rv is not None else None,
        'quality_count': quality_count, 'candle_confirmed': candle_ok,
        'trend_15m': side, 'trend_1h': side, 'rr': rr, 'momentum_15m_pct': round(mom, 4)
    }


def universe():
    info = get_json('/api/v3/exchangeInfo')
    allowed = set()
    for s in info.get('symbols', []):
        symbol = s.get('symbol', '')
        base = s.get('baseAsset', '')
        if s.get('status') == 'TRADING' and s.get('quoteAsset') == 'USDT' and base not in EXCLUDED_BASES:
            allowed.add(symbol)
    rows = []
    for t in get_json('/api/v3/ticker/24hr'):
        symbol = t.get('symbol', '')
        if symbol not in allowed:
            continue
        try:
            qv = float(t.get('quoteVolume') or 0)
        except Exception:
            continue
        if qv >= MIN_QUOTE_VOLUME:
            rows.append((symbol, qv))
    rows.sort(key=lambda x: x[1], reverse=True)
    return rows[:UNIVERSE]


def publish():
    data = json.loads(LEDGER.read_text(encoding='utf-8'))
    records = data.setdefault('records', [])
    today = day_utc()
    official_today = [r for r in records if r.get('day') == today and not r.get('legacy')]
    slots = max(0, MAX_DAILY - len(official_today))
    created = []
    if slots:
        used = {str(r.get('symbol') or '') for r in official_today}
        candidates = []
        for symbol, qv in universe():
            if symbol in used:
                continue
            try:
                row = analyze(symbol, qv)
                if row:
                    candidates.append(row)
            except Exception:
                # One unavailable market must never create a fake row or abort the whole publication.
                continue
            time.sleep(0.05)
        candidates.sort(key=lambda x: (x['score'], x['quote_volume'], x['volume_ratio']), reverse=True)
        now = now_iso()
        for row in candidates[:slots]:
            rank = len(official_today) + 1
            fid = f"{today}-{row['symbol']}"
            if any(str(r.get('forecast_id')) == fid for r in records):
                continue
            rec = {
                'forecast_id': fid, 'source': 'central-v13-publisher', 'method': 'V13 quality gate / closed Binance candles',
                'symbol': row['symbol'], 'side': row['side'], 'created_at': now, 'entry': row['entry'],
                'tp1': row['tp1'], 'tp2': row['tp2'], 'sl': row['sl'], 'status': 'ACTIVE',
                'score': row['score'], 'rank': rank, 'day': today, 'current': row['entry'],
                'high': row['entry'], 'low': row['entry'], 'best_move': 0.0, 'worst_move': 0.0,
                'final_move': None, 'end_reason': None, 'tp1_hit_at': None, 'tp2_hit_at': None,
                'ended_at': None, 'proof_commit': None, 'proof_verified_at': None,
                'quality': {
                    'count': row['quality_count'], 'required': 5, 'volume_ratio': row['volume_ratio'],
                    'quote_volume_usdt': row['quote_volume'], 'atr_pct': row['atr_pct'], 'rsi_15m': row['rsi_15m'],
                    'candle_confirmed': row['candle_confirmed'], 'trend_15m': row['trend_15m'],
                    'trend_1h': row['trend_1h'], 'rr': row['rr'], 'momentum_15m_pct': row['momentum_15m_pct']
                }
            }
            records.insert(0, rec)
            official_today.append(rec)
            used.add(row['symbol'])
            created.append(fid)
    data['generated_at'] = now_iso()
    data['source'] = 'GitHub Actions central V13 publisher + Binance market data; historical verified imports retained'
    data['forecast_creation'] = 'Authoritative forecasts are created centrally before browser display; no browser secret or local-only official forecast path'
    data['quality_gate'] = 'V13: aligned 15m/1h trend, score >=72, volume/candle/liquidity/R:R checks; minimum 5/6 conditions'
    LEDGER.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    NEW_IDS.write_text(json.dumps(created), encoding='utf-8')


def stamp():
    sha = os.environ.get('PROOF_SHA', '').strip()
    if len(sha) != 40 or not NEW_IDS.exists():
        return
    ids = set(json.loads(NEW_IDS.read_text(encoding='utf-8') or '[]'))
    if not ids:
        return
    data = json.loads(LEDGER.read_text(encoding='utf-8'))
    at = now_iso()
    for r in data.get('records', []):
        if str(r.get('forecast_id') or '') in ids:
            r['proof_commit'] = sha
            r['proof_verified_at'] = at
    data['generated_at'] = at
    LEDGER.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    stamp() if len(sys.argv) > 1 and sys.argv[1] == 'stamp' else publish()
