#!/usr/bin/env python3
"""Publish DeepRise V13.1 forecasts directly into the central GitHub ledger.

Authoritative forecast creation path. Uses public Binance market data plus
optional authenticated CoinGlass intelligence when a GitHub secret is present.
Missing external providers are explicitly recorded as unavailable; no data is
fabricated or backfilled after forecast creation.
"""
import json, os, sys, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

LEDGER = Path('forecast-ledger.json')
NEW_IDS = Path('.ledger_new_forecasts.json')
API = 'https://data-api.binance.vision'
COINGLASS_API = 'https://open-api-v4.coinglass.com'
COINGLASS_KEY = os.environ.get('COINGLASS_API_KEY', '').strip()
MAX_DAILY = 5
MIN_QUOTE_VOLUME = 20_000_000.0
UNIVERSE = 45
EXCLUDED_BASES = {'USDC','FDUSD','TUSD','USDP','DAI','EUR','TRY','BRL','GBP','BIDR','AEUR','EURI'}


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')


def day_utc():
    return datetime.now(timezone.utc).strftime('%Y-%m-%d')


def request_json(base, path, params=None, headers=None, timeout=25):
    url = base + path
    if params:
        url += '?' + urlencode(params)
    h = {'User-Agent': 'DeepRise-Central-Publisher/13.1', 'accept': 'application/json'}
    if headers:
        h.update(headers)
    req = Request(url, headers=h)
    with urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))


def get_json(path, params=None):
    return request_json(API, path, params)


def coinglass_json(path, params=None):
    if not COINGLASS_KEY:
        return None
    return request_json(COINGLASS_API, path, params, {'CG-API-KEY': COINGLASS_KEY})


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


def order_flow_intelligence(bars, side):
    sample = bars[-8:]
    total = sum(float(b[5]) for b in sample)
    buys = sum(float(b[9]) for b in sample)
    sells = max(0.0, total - buys)
    ratio = buys / total if total > 0 else 0.5
    cvd = buys - sells
    cvd_pct = cvd / total * 100.0 if total > 0 else 0.0
    recent = bars[-3:]
    prior = bars[-8:-3]
    recent_ratio = (sum(float(b[9]) for b in recent) / max(sum(float(b[5]) for b in recent), 1e-12))
    prior_ratio = (sum(float(b[9]) for b in prior) / max(sum(float(b[5]) for b in prior), 1e-12))
    acceleration = (recent_ratio - prior_ratio) * 100.0
    aligned = (side == 'LONG' and ratio >= 0.52 and cvd_pct > 0) or (side == 'SHORT' and ratio <= 0.48 and cvd_pct < 0)
    directional = (ratio - 0.5) * 200.0
    if side == 'SHORT':
        directional = -directional
    score = 50.0 + directional * 0.55
    score += max(-15.0, min(15.0, acceleration * (1 if side == 'LONG' else -1) * 1.5))
    score = max(0.0, min(100.0, score))
    return {
        'available': True,
        'provider': 'Binance closed 15m klines',
        'taker_buy_ratio': round(ratio, 5),
        'cvd_proxy_pct': round(cvd_pct, 4),
        'taker_ratio_acceleration_pp': round(acceleration, 4),
        'alignment': 'ALIGNED' if aligned else 'CONFLICTING',
        'score': round(score, 1)
    }


def liquidity_proxy_intelligence(bars, close, side, a):
    look = bars[-41:-1] if len(bars) >= 42 else bars[:-1]
    highs = [float(b[2]) for b in look]
    lows = [float(b[3]) for b in look]
    swing_high = max(highs) if highs else close
    swing_low = min(lows) if lows else close
    target = swing_high if side == 'LONG' else swing_low
    distance = ((target-close)/close*100.0) if side == 'LONG' else ((close-target)/close*100.0)
    atr_distance = abs(target-close) / max(a, 1e-12)
    ahead = target > close if side == 'LONG' else target < close
    if ahead and 0.15 <= distance <= 4.0:
        score = 80.0
    elif ahead and distance <= 7.0:
        score = 65.0
    elif ahead:
        score = 52.0
    else:
        score = 35.0
    return {
        'available': True,
        'provider': 'Binance swing-liquidity proxy',
        'target_price': round(target, 12),
        'distance_pct': round(distance, 4),
        'atr_distance': round(atr_distance, 3),
        'alignment': 'AHEAD' if ahead else 'BEHIND',
        'score': score,
        'note': 'Swing-liquidity proxy; not a liquidation heatmap.'
    }


def liquidation_map_intelligence(symbol, close, side):
    if not COINGLASS_KEY:
        return {'available': False, 'provider': 'CoinGlass', 'reason': 'COINGLASS_API_KEY not configured'}
    try:
        raw = coinglass_json('/api/futures/liquidation/map', {'exchange': 'Binance', 'symbol': symbol, 'range': '1d'})
        levels = (((raw or {}).get('data') or {}).get('data') or {})
        above = below = 0.0
        candidates = []
        for price_key, rows in levels.items():
            try:
                price = float(price_key)
            except Exception:
                continue
            usd = 0.0
            for row in rows or []:
                try:
                    usd += float(row[1] or 0)
                except Exception:
                    pass
            if usd <= 0 or abs(price-close)/close > 0.08:
                continue
            candidates.append((usd, price))
            if price > close:
                above += usd
            elif price < close:
                below += usd
        target = max(candidates)[1] if candidates else None
        total = above + below
        directional = (above / total) if total else 0.5
        if side == 'SHORT':
            directional = 1.0 - directional
        score = round(35.0 + directional * 65.0, 1)
        bias = 'ABOVE' if above > below*1.08 else 'BELOW' if below > above*1.08 else 'BALANCED'
        return {'available': True, 'provider': 'CoinGlass V4 liquidation map', 'above_usd': round(above,2), 'below_usd': round(below,2), 'dominant': bias, 'target_price': target, 'score': score}
    except Exception as e:
        return {'available': False, 'provider': 'CoinGlass', 'reason': f'{type(e).__name__}: {e}'}


def large_orders_intelligence(symbol, side):
    if not COINGLASS_KEY:
        return {'available': False, 'provider': 'CoinGlass', 'reason': 'COINGLASS_API_KEY not configured'}
    try:
        raw = coinglass_json('/api/futures/orderbook/large-limit-order', {'exchange': 'Binance', 'symbol': symbol})
        rows = (raw or {}).get('data') or []
        buy = sell = 0.0
        for r in rows:
            try:
                usd = float(r.get('current_usd_value') or 0)
                order_side = int(r.get('order_side') or 0)
            except Exception:
                continue
            # CoinGlass futures endpoint: 1=Sell, 2=Buy.
            if order_side == 2:
                buy += usd
            elif order_side == 1:
                sell += usd
        total = buy + sell
        buy_ratio = buy / total if total else 0.5
        directional = buy_ratio if side == 'LONG' else 1.0-buy_ratio
        score = round(35.0 + directional*65.0, 1)
        bias = 'BUY WALLS' if buy > sell*1.08 else 'SELL WALLS' if sell > buy*1.08 else 'BALANCED'
        return {'available': True, 'provider': 'CoinGlass V4 futures large orders', 'buy_usd': round(buy,2), 'sell_usd': round(sell,2), 'bias': bias, 'score': score}
    except Exception as e:
        return {'available': False, 'provider': 'CoinGlass', 'reason': f'{type(e).__name__}: {e}'}


def predictive_confluence(base_score, order_flow, liquidity_proxy, liquidation_map, large_orders):
    components = [
        ('technical', 30.0, float(base_score), True),
        ('order_flow', 25.0, float(order_flow.get('score', 0)), bool(order_flow.get('available'))),
        ('liquidity_proxy', 15.0, float(liquidity_proxy.get('score', 0)), bool(liquidity_proxy.get('available'))),
        ('liquidation_map', 20.0, float(liquidation_map.get('score', 0)), bool(liquidation_map.get('available'))),
        ('large_orders', 10.0, float(large_orders.get('score', 0)), bool(large_orders.get('available'))),
    ]
    available_weight = sum(w for _,w,_,ok in components if ok)
    weighted = sum(w*s for _,w,s,ok in components if ok)
    score = weighted / max(available_weight, 1e-12)
    coverage = available_weight
    if score >= 82 and coverage >= 90:
        grade = 'A+'
    elif score >= 78 and coverage >= 70:
        grade = 'A'
    elif score >= 70:
        grade = 'B'
    else:
        grade = 'C'
    return round(score,1), round(coverage,1), grade


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

    score = 40.0
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

    oflow = order_flow_intelligence(b15, side)
    lproxy = liquidity_proxy_intelligence(b15, close, side, a)
    lmap = liquidation_map_intelligence(symbol, close, side)
    large = large_orders_intelligence(symbol, side)
    pscore, coverage, grade = predictive_confluence(score, oflow, lproxy, lmap, large)
    if pscore < 68 or coverage < 70:
        return None

    if side == 'LONG':
        sl, tp1, tp2 = close-a, close+a, close+a*1.8
    else:
        sl, tp1, tp2 = close+a, close-a, close-a*1.8
    if min(sl, tp1, tp2) <= 0:
        return None
    predictive = {
        'model_version': 'V13.1 Predictive Confluence',
        'score': pscore,
        'coverage_pct': coverage,
        'grade': grade,
        'order_flow': oflow,
        'liquidity_proxy': lproxy,
        'liquidation_map': lmap,
        'large_orders': large,
        'smart_money': {'available': False, 'provider': 'Not configured', 'reason': 'Dedicated wallet-label / Smart Money provider not connected'},
        'explanation': 'Technical trend + closed-candle order flow + liquidity target; CoinGlass liquidation/large-order layers are included only when authenticated data is available.'
    }
    return {
        'symbol': symbol, 'side': side, 'entry': close, 'tp1': tp1, 'tp2': tp2, 'sl': sl,
        'score': score, 'predictive': predictive,
        'volume_ratio': round(volume_ratio, 4), 'quote_volume': round(quote_volume, 2),
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


def health():
    t = get_json('/api/v3/time')
    bars = candles('BTCUSDT', '15m', 10)
    if not isinstance(t, dict) or not t.get('serverTime') or not isinstance(bars, list) or len(bars) < 2:
        raise RuntimeError('Binance public market-data endpoint did not return valid data')
    probe = order_flow_intelligence(bars[:-1], 'LONG')
    if not probe.get('available'):
        raise RuntimeError('Order-flow calculation unavailable')
    print(f"DeepRise V13.1 market-data health OK via {API}; CoinGlass={'configured' if COINGLASS_KEY else 'optional/not configured'}")


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
                continue
            time.sleep(0.05)
        candidates.sort(key=lambda x: (x['predictive']['score'], x['score'], x['quote_volume']), reverse=True)
        now = now_iso()
        for row in candidates[:slots]:
            rank = len(official_today) + 1
            fid = f"{today}-{row['symbol']}"
            if any(str(r.get('forecast_id')) == fid for r in records):
                continue
            rec = {
                'forecast_id': fid, 'source': 'central-v13.1-publisher', 'method': 'V13.1 Predictive Confluence / closed Binance candles + optional authenticated external intelligence',
                'symbol': row['symbol'], 'side': row['side'], 'created_at': now, 'entry': row['entry'],
                'tp1': row['tp1'], 'tp2': row['tp2'], 'sl': row['sl'], 'status': 'ACTIVE',
                'score': row['score'], 'predictive': row['predictive'], 'rank': rank, 'day': today, 'current': row['entry'],
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
    data['source'] = 'GitHub Actions central V13.1 publisher + Binance public market data; optional CoinGlass authenticated intelligence; historical verified imports retained'
    data['forecast_creation'] = 'Authoritative forecasts are created centrally before browser display. Predictive layers are snapshotted at creation and never fabricated when a provider is unavailable.'
    data['quality_gate'] = 'V13.1: aligned 15m/1h trend, base score >=72, minimum 5/6 quality conditions, Predictive Confluence >=68 with >=70% real-data coverage'
    data['predictive_schema'] = 'V13.1 Predictive Confluence: technical 30%, order flow/CVD proxy 25%, liquidity proxy 15%, CoinGlass liquidation map 20% optional, CoinGlass large orders 10% optional; Smart Money wallet layer reserved until a dedicated real provider is connected'
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
    if len(sys.argv) > 1 and sys.argv[1] == 'stamp':
        stamp()
    elif len(sys.argv) > 1 and sys.argv[1] == 'health':
        health()
    else:
        publish()
