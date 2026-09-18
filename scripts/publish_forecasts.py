#!/usr/bin/env python3
"""Publish DeepRise V17 pre-move forecasts into the central GitHub ledger.

The authoritative path looks for 4H accumulation, volatility compression,
money-flow support and a momentum turn before expansion. It explicitly blocks
fresh entries once price is extended. Optional authenticated CoinGlass layers
are included only when configured; unavailable inputs are never fabricated.
"""
import concurrent.futures, json, os, sys
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
MIN_QUOTE_VOLUME = 1_000_000.0
UNIVERSE = 140
EXCLUDED_BASES = {'USDC','FDUSD','TUSD','USDP','DAI','RLUSD','USDE','USDS','USD1','BFUSD','EUR','TRY','BRL','GBP','BIDR','AEUR','EURI','PAXG','XAUT','NVDAB','SPYB','GOOGLB','SNDKB'}


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')


def day_utc():
    return datetime.now(timezone.utc).strftime('%Y-%m-%d')


def request_json(base, path, params=None, headers=None, timeout=25):
    url = base + path
    if params:
        url += '?' + urlencode(params)
    h = {'User-Agent': 'DeepRise-Central-Publisher/17.0', 'accept': 'application/json'}
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


def median(values):
    values = sorted(float(x) for x in values if x is not None)
    if not values:
        return 0.0
    n = len(values)
    return values[n//2] if n % 2 else (values[n//2-1] + values[n//2]) / 2.0


def bb_width(values, period=20):
    if len(values) < period:
        return None
    sample = values[-period:]
    mean = sum(sample) / period
    if mean <= 0:
        return None
    variance = sum((x-mean)**2 for x in sample) / period
    return 4.0 * variance**0.5 / mean * 100.0


def cmf(bars, period=20):
    if len(bars) < period:
        return 0.0
    flow = volume = 0.0
    for b in bars[-period:]:
        high, low, close, vol = map(float, [b[2], b[3], b[4], b[5]])
        multiplier = ((close-low)-(high-close))/(high-low) if high > low else 0.0
        flow += multiplier * vol
        volume += vol
    return flow / volume if volume else 0.0


def clamp(value, low=0.0, high=100.0):
    return max(low, min(high, value))


def candles(symbol, interval, limit):
    return get_json('/api/v3/klines', {'symbol': symbol, 'interval': interval, 'limit': limit})


def pre_move_setup(bars, quote_volume, live_price=None):
    """Return WATCH/ARMED/IGNITION/LATE from closed 4H candles only."""
    if len(bars) < 85:
        return None
    closes = [float(b[4]) for b in bars]
    volumes = [float(b[5]) for b in bars]
    close = closes[-1]
    live = float(live_price or close)
    current_atr = atr(bars, 14)
    if not current_atr or current_atr <= 0:
        return None
    if current_atr / close * 100.0 < .2:
        return None
    old_atrs = [atr(bars[:-back], 14) for back in (12,18,24,30) if len(bars)-back > 15]
    old_atr = median(old_atrs) or current_atr
    atr_ratio = current_atr / old_atr
    width = bb_width(closes, 20)
    old_width = median([bb_width(closes[:-back], 20) for back in (12,18,24,30)]) or width
    if width is None or old_width is None:
        return None
    bb_ratio = width / old_width if old_width else 1.0
    rv = rsi(closes, 14)
    rv3 = rsi(closes[:-3], 14)
    e10, e20, e50 = ema(closes, 10), ema(closes, 20), ema(closes, 50)
    e10_old = ema(closes[:-3], 10)
    if None in (rv, rv3, e10, e20, e50, e10_old):
        return None

    base = bars[-31:-1]
    range_high = max(float(b[2]) for b in base)
    range_low = min(float(b[3]) for b in base)
    range_width = max(range_high-range_low, current_atr*.1)
    range_atr = range_width/current_atr
    position = clamp((close-range_low)/range_width, 0.0, 1.0)
    money_flow = cmf(bars, 20)
    recent, prior = bars[-6:], bars[-18:-6]
    recent_vol = sum(float(b[5]) for b in recent)
    prior_vol = sum(float(b[5]) for b in prior)
    buy_ratio = sum(float(b[9]) for b in recent)/recent_vol if recent_vol else .5
    prior_buy = sum(float(b[9]) for b in prior)/prior_vol if prior_vol else .5
    buy_acceleration = buy_ratio-prior_buy
    vol_base = sum(volumes[-23:-3])/20.0
    volume_build = (sum(volumes[-3:])/3.0)/vol_base if vol_base else 1.0
    close_24h = closes[-7]
    last = bars[-1]
    body_atr = abs(float(last[4])-float(last[1]))/current_atr

    def score_side(side):
        long = side == 'LONG'
        score = 0.0
        reasons = []
        if atr_ratio <= .78:
            score += 14; reasons.append(f'ATR compression {atr_ratio:.2f}')
        elif atr_ratio <= .92:
            score += 8; reasons.append(f'ATR contraction {atr_ratio:.2f}')
        if bb_ratio <= .78 or width <= 4.5:
            score += 14; reasons.append(f'BB compression {width:.2f}%')
        elif bb_ratio <= .92 or width <= 6.0:
            score += 8; reasons.append(f'BB contraction {width:.2f}%')

        base_quality = range_atr <= 10 and (position >= .35 if long else position <= .65)
        if base_quality:
            score += 10; reasons.append('tight 4H base')
        rsi_zone = 45 <= rv <= 62 if long else 38 <= rv <= 55
        if rsi_zone:
            score += 7
        rsi_turn = rv-rv3 >= 3 if long else rv-rv3 <= -3
        if rsi_turn:
            score += 10; reasons.append('momentum turning up' if long else 'momentum turning down')
        ema_near = e10 >= e20*.995 if long else e10 <= e20*1.005
        ema_turning = e10 > e10_old if long else e10 < e10_old
        trend_repair = e20/e50 >= .97 if long else e20/e50 <= 1.03
        if ema_near: score += 7
        if ema_turning: score += 5
        if trend_repair: score += 5

        flow_evidence = (money_flow >= .03 or buy_ratio >= .52) if long else (money_flow <= -.03 or buy_ratio <= .48)
        if (long and money_flow >= .08) or ((not long) and money_flow <= -.08):
            score += 12; reasons.append('positive money flow' if long else 'negative money flow')
        elif (long and money_flow >= .03) or ((not long) and money_flow <= -.03):
            score += 6; reasons.append('positive money flow' if long else 'negative money flow')
        if (long and buy_ratio >= .52) or ((not long) and buy_ratio <= .48):
            score += 8; reasons.append('taker buy pressure' if long else 'taker sell pressure')
        if (long and buy_acceleration >= .015) or ((not long) and buy_acceleration <= -.015):
            score += 5

        distance_atr = (range_high-close)/current_atr if long else (close-range_low)/current_atr
        if -.35 <= distance_atr <= 1.4:
            score += 18; reasons.append('near trigger')
        elif -.7 <= distance_atr <= 2.2:
            score += 10; reasons.append('approaching trigger')
        if 1.05 <= volume_build <= 1.8:
            score += 5; reasons.append(f'controlled volume build {volume_build:.2f}x')
        score += 6 if quote_volume >= 5_000_000 else 4 if quote_volume >= MIN_QUOTE_VOLUME else 0

        live_distance = (live-range_high)/current_atr if long else (range_low-live)/current_atr
        live_change_24h = ((live/close_24h)-1)*100 if long else ((close_24h/live)-1)*100
        extended = live_change_24h >= 6 or live_distance > 1.2 or body_atr > 1.8 or (rv > 68 if long else rv < 32)
        raw_score = clamp(round(score))
        final_score = clamp(round(score-(28 if extended else 0)))
        directional_repair = ema_near and (rsi_zone or ema_turning)
        compressed = atr_ratio <= .92 or bb_ratio <= .92
        small_break = -.8 <= distance_atr < 0
        stage = 'NONE'
        if extended and raw_score >= 62:
            stage = 'LATE'
        elif small_break and raw_score >= 72 and volume_build >= 1.05 and flow_evidence:
            stage = 'IGNITION'
        elif -.35 <= distance_atr <= 1.5 and raw_score >= 72 and base_quality and compressed and flow_evidence and directional_repair:
            stage = 'ARMED'
        elif raw_score >= 58 and base_quality and compressed and flow_evidence and directional_repair:
            stage = 'WATCH'
        return {
            'side': side, 'stage': stage, 'score': final_score, 'raw_score': raw_score,
            'reasons': reasons, 'distance_atr': distance_atr, 'live_distance_atr': live_distance,
            'live_change_24h': live_change_24h, 'extended': extended,
            'base_quality': base_quality, 'flow_evidence': flow_evidence,
            'directional_repair': directional_repair
        }

    choices = [score_side('LONG'), score_side('SHORT')]
    priority = {'NONE':0, 'LATE':1, 'WATCH':2, 'ARMED':3, 'IGNITION':4}
    best = max(choices, key=lambda x: (priority[x['stage']], x['raw_score']))
    if best['stage'] == 'NONE':
        return None
    long = best['side'] == 'LONG'
    trigger = range_high if long else range_low
    entry_low = trigger-current_atr*.35 if long else trigger-current_atr*.15
    entry_high = trigger+current_atr*.15 if long else trigger+current_atr*.35
    entry_low, entry_high = min(entry_low,entry_high), max(entry_low,entry_high)
    entry_mid = (entry_low+entry_high)/2.0
    recent_low = min(float(b[3]) for b in bars[-12:])
    recent_high = max(float(b[2]) for b in bars[-12:])
    invalid = max(recent_low-current_atr*.2, entry_mid-current_atr*2.2) if long else min(recent_high+current_atr*.2, entry_mid+current_atr*2.2)
    risk = max(abs(entry_mid-invalid), current_atr*.8)
    invalid = entry_mid-risk if long else entry_mid+risk
    tp1 = entry_mid+risk*1.5 if long else entry_mid-risk*1.5
    tp2 = entry_mid+risk*2.7 if long else entry_mid-risk*2.7
    best.update({
        'watch_price': live, 'closed_price': close, 'trigger': trigger,
        'entry_low': entry_low, 'entry_high': entry_high, 'invalid': invalid,
        'tp1': tp1, 'tp2': tp2, 'atr': current_atr, 'atr_ratio': atr_ratio,
        'bb_width': width, 'bb_ratio': bb_ratio, 'range_high': range_high,
        'range_low': range_low, 'range_atr': range_atr, 'rsi_4h': rv,
        'rsi_delta_3': rv-rv3, 'cmf_4h': money_flow,
        'taker_buy_ratio': buy_ratio, 'volume_build': volume_build,
        'momentum_4h_pct': ((closes[-1]/closes[-4])-1)*100
    })
    return best


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


def analyze(symbol, quote_volume, live_price=None):
    # Stage one is deliberately broad and cheap: one 4H request across the
    # expanded universe. Lower-timeframe/order-flow data is fetched only after
    # a genuine pre-move candidate survives the anti-chase gate.
    b4h = candles(symbol, '4h', 150)
    if len(b4h) < 86:
        return None
    b4h = b4h[:-1]  # deterministic closed candles only
    setup = pre_move_setup(b4h, quote_volume, live_price)
    if not setup or setup['stage'] not in ('ARMED','IGNITION') or setup['extended']:
        return None

    b15 = candles(symbol, '15m', 90)
    if len(b15) < 45:
        return None
    b15 = b15[:-1]
    c15 = [float(b[4]) for b in b15]
    entry = float(live_price or setup['closed_price'])
    if entry <= 0:
        return None
    side = setup['side']
    a = float(setup['atr'])
    atr_pct = a/entry*100.0
    if atr_pct <= 0 or atr_pct > 8.0:
        return None
    oflow = order_flow_intelligence(b15, side)
    lproxy = liquidity_proxy_intelligence(b4h, entry, side, a)
    lmap = liquidation_map_intelligence(symbol, entry, side)
    large = large_orders_intelligence(symbol, side)
    pscore, coverage, grade = predictive_confluence(setup['score'], oflow, lproxy, lmap, large)
    if pscore < 68 or coverage < 70:
        return None

    sl = float(setup['invalid'])
    risk = max(abs(entry-sl), a*.8)
    if side == 'LONG':
        sl, tp1, tp2 = entry-risk, entry+risk*1.5, entry+risk*2.7
    else:
        sl, tp1, tp2 = entry+risk, entry-risk*1.5, entry-risk*2.7
    if min(sl, tp1, tp2) <= 0:
        return None
    rr = abs(tp2-entry)/max(abs(entry-sl),1e-12)
    rv15 = rsi(c15,14)
    mom15 = (c15[-1]-c15[-5])/c15[-5]*100.0 if c15[-5] else 0.0
    quality_count = sum([
        setup['score'] >= 72, setup['base_quality'], setup['flow_evidence'],
        setup['directional_repair'], abs(setup['distance_atr']) <= 1.5,
        quote_volume >= MIN_QUOTE_VOLUME, not setup['extended']
    ])
    if quality_count < 6:
        return None
    predictive = {
        'model_version': 'V17.0 Pre-Move Confluence',
        'score': pscore, 'coverage_pct': coverage, 'grade': grade,
        'order_flow': oflow, 'liquidity_proxy': lproxy,
        'liquidation_map': lmap, 'large_orders': large,
        'smart_money': {'available': False, 'provider': 'Not configured', 'reason': 'Dedicated wallet-label / Smart Money provider not connected'},
        'explanation': '4H compression/base/flow/turn detected before expansion, then checked against closed 15m order flow and liquidity. Extended prices are rejected rather than chased.'
    }
    return {
        'symbol': symbol, 'side': side, 'stage': setup['stage'],
        'entry': entry, 'tp1': tp1, 'tp2': tp2, 'sl': sl,
        'score': round(setup['score'],1), 'predictive': predictive,
        'volume_ratio': round(setup['volume_build'],4), 'quote_volume': round(quote_volume,2),
        'atr_pct': round(atr_pct,4), 'rsi_15m': round(rv15,2) if rv15 is not None else None,
        'quality_count': quality_count, 'candle_confirmed': False,
        'trend_15m': 'PRE_MOVE', 'trend_1h': 'PRE_MOVE', 'rr': rr,
        'momentum_15m_pct': round(mom15,4), 'pre_move': setup
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
            price = float(t.get('lastPrice') or 0)
        except Exception:
            continue
        if qv >= MIN_QUOTE_VOLUME and price > 0:
            rows.append((symbol, qv, price))
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
    bars4h = candles('BTCUSDT', '4h', 90)
    if not isinstance(bars4h,list) or len(bars4h) < 86:
        raise RuntimeError('4H pre-move history unavailable')
    pre_move_setup(bars4h[:-1], 1_000_000_000, float(bars4h[-1][4]))
    print(f"DeepRise V17.0 pre-move health OK via {API}; CoinGlass={'configured' if COINGLASS_KEY else 'optional/not configured'}")


def collect_candidates(used=None):
    used = set(used or ())
    candidates = []
    rows = [(symbol,qv,price) for symbol,qv,price in universe() if symbol not in used]

    def inspect(row):
        symbol, qv, price = row
        try:
            return analyze(symbol, qv, price)
        except Exception:
            return None

    # Binance's public kline weight remains well below the documented limit,
    # while bounded concurrency keeps a 140-symbol pre-move sweep practical.
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        candidates.extend(x for x in pool.map(inspect, rows) if x)
    candidates.sort(key=lambda x: (x['predictive']['score'], x['score'], x['quote_volume']), reverse=True)
    return candidates


def invalidate_nonconforming_v17(records):
    """Cancel, but retain, V17 rows invalidated by a quality-rule migration."""
    changed = []
    at = now_iso()
    for rec in records:
        if rec.get('source') != 'central-v17-pre-move' or rec.get('audit_eligible') is False:
            continue
        base = str(rec.get('symbol') or '').removesuffix('USDT')
        pre = rec.get('pre_move') or {}
        quality = rec.get('quality') or {}
        relative_compression = float(pre.get('atr_ratio') or 99) <= .92 or float(pre.get('bb_ratio') or 99) <= .92
        sufficient_volatility = float(quality.get('atr_pct') or 0) >= .2
        if base not in EXCLUDED_BASES and relative_compression and sufficient_volatility:
            continue
        rec['audit_eligible'] = False
        rec['status'] = 'CANCELLED'
        rec['ended_at'] = at
        rec['end_reason'] = 'V17.0.1 QUALITY MIGRATION — non-crypto/stable asset or no relative 4H compression'
        rec.setdefault('status_history', []).append({'event':'QUALITY_MIGRATION_CANCELLED','at':at,'status':'CANCELLED'})
        changed.append(rec.get('forecast_id'))
    return changed


def publish():
    data = json.loads(LEDGER.read_text(encoding='utf-8'))
    records = data.setdefault('records', [])
    invalidated = invalidate_nonconforming_v17(records)
    today = day_utc()
    # V17 starts a clean, independently measurable cohort. Older central
    # forecasts stay in history, but do not consume today's V17 publication cap.
    official_today = [r for r in records if r.get('day') == today and r.get('source') == 'central-v17-pre-move' and r.get('audit_eligible') is not False]
    slots = max(0, MAX_DAILY - len(official_today))
    created = []
    if slots:
        used = {str(r.get('symbol') or '') for r in official_today}
        candidates = collect_candidates(used)
        now = now_iso()
        for row in candidates[:slots]:
            rank = len(official_today) + 1
            fid = f"{today}-{row['symbol']}"
            if any(str(r.get('forecast_id')) == fid for r in records):
                continue
            rec = {
                'forecast_id': fid, 'source': 'central-v17-pre-move', 'method': 'V17.0 4H Pre-Move Confluence / accumulation + compression + flow + momentum turn + anti-chase',
                'symbol': row['symbol'], 'side': row['side'], 'created_at': now, 'entry': row['entry'],
                'tp1': row['tp1'], 'tp2': row['tp2'], 'sl': row['sl'], 'status': 'ACTIVE',
                'score': row['score'], 'predictive': row['predictive'], 'rank': rank, 'day': today, 'current': row['entry'],
                'stage': row['stage'], 'trigger': row['pre_move']['trigger'],
                'entry_zone': [row['pre_move']['entry_low'], row['pre_move']['entry_high']],
                'pre_move': row['pre_move'],
                'high': row['entry'], 'low': row['entry'], 'best_move': 0.0, 'worst_move': 0.0,
                'final_move': None, 'end_reason': None, 'tp1_hit_at': None, 'tp2_hit_at': None,
                'ended_at': None, 'proof_commit': None, 'proof_verified_at': None,
                'quality': {
                    'count': row['quality_count'], 'required': 6, 'volume_ratio': row['volume_ratio'],
                    'quote_volume_usdt': row['quote_volume'], 'atr_pct': row['atr_pct'], 'rsi_15m': row['rsi_15m'],
                    'candle_confirmed': row['candle_confirmed'], 'trend_15m': row['trend_15m'],
                    'trend_1h': row['trend_1h'], 'rr': row['rr'], 'momentum_15m_pct': row['momentum_15m_pct'],
                    'stage': row['stage'], 'rsi_4h': row['pre_move']['rsi_4h'],
                    'atr_ratio': row['pre_move']['atr_ratio'], 'bb_ratio': row['pre_move']['bb_ratio'],
                    'cmf_4h': row['pre_move']['cmf_4h'], 'taker_buy_ratio': row['pre_move']['taker_buy_ratio'],
                    'distance_to_trigger_atr': row['pre_move']['distance_atr'],
                    'anti_chase_extended': row['pre_move']['extended']
                }
            }
            records.insert(0, rec)
            official_today.append(rec)
            used.add(row['symbol'])
            created.append(fid)
    data['generated_at'] = now_iso()
    data['source'] = 'GitHub Actions central V17.0 pre-move publisher + Binance public market data; optional CoinGlass authenticated intelligence; historical verified cohorts retained'
    data['forecast_creation'] = 'V17 creates official entries only in ARMED/IGNITION pre-move stages after relative 4H volatility compression. WATCH remains observational and LATE is blocked. Stable, commodity-backed and known tokenized-equity bases are excluded.'
    data['quality_gate'] = 'V17.0.1: relative 4H ATR or Bollinger compression + base + flow + directional repair + <=1.5 ATR to trigger, score >=72, minimum 6/7 checks, anti-chase pass, Predictive Confluence >=68 with >=70% real-data coverage'
    data['predictive_schema'] = 'V17.0: pre-move technical 30%, closed 15m order flow/CVD proxy 25%, 4H swing-liquidity proxy 15%, CoinGlass liquidation map 20% optional, CoinGlass large orders 10% optional'
    if invalidated:
        data['v17_quality_migration_last_invalidated'] = invalidated
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
    elif len(sys.argv) > 1 and sys.argv[1] == 'dry-run':
        print(json.dumps(collect_candidates()[:10], ensure_ascii=False, indent=2))
    else:
        publish()
