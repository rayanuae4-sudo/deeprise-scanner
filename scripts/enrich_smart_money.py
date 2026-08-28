#!/usr/bin/env python3
"""DeepRise V13.3 optional Smart Money + Whale Divergence enrichment.

Runs centrally in GitHub Actions. If NANSEN_API_KEY is absent, no wallet signal is
invented. Whale divergence can still report exchange/order-flow proxy evidence,
but it explicitly marks whether a wallet-labelled Smart Money source confirmed it.
"""
import json, math, os
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

LEDGER = Path('forecast-ledger.json')
NEW_IDS = Path('.ledger_new_forecasts.json')
NANSEN_KEY = os.environ.get('NANSEN_API_KEY', '').strip()
NANSEN_URL = 'https://api.nansen.ai/api/v1/smart-money/netflow'
CHAINS = ['ethereum','solana','base','bnb','arbitrum','polygon','optimism','avalanche']


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')


def post_json(body):
    raw = json.dumps(body).encode('utf-8')
    req = Request(NANSEN_URL, data=raw, method='POST', headers={
        'apiKey': NANSEN_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'DeepRise-Smart-Money/13.3'
    })
    with urlopen(req, timeout=35) as r:
        return json.loads(r.read().decode('utf-8'))


def fetch_rows(direction):
    return (post_json({
        'chains': CHAINS,
        'filters': {
            'include_smart_money_labels': ['Fund','Smart Trader','30D Smart Trader'],
            'include_native_tokens': True,
            'include_stablecoins': False,
            'trader_count': {'min': 3}
        },
        'pagination': {'page': 1, 'per_page': 100},
        'order_by': [{'field': 'net_flow_24h_usd', 'direction': direction}]
    }).get('data') or [])


def smart_index():
    rows = fetch_rows('DESC') + fetch_rows('ASC')
    by_symbol = {}
    for row in rows:
        sym = str(row.get('token_symbol') or '').upper().strip()
        if not sym:
            continue
        mc = float(row.get('market_cap_usd') or 0)
        prev = by_symbol.get(sym)
        if prev is None or mc > float(prev.get('market_cap_usd') or 0):
            by_symbol[sym] = row
    return by_symbol


def factor(row, side):
    f1 = float(row.get('net_flow_1h_usd') or 0)
    f24 = float(row.get('net_flow_24h_usd') or 0)
    mc = max(float(row.get('market_cap_usd') or 0), 10_000_000.0)
    traders = max(0, int(row.get('trader_count') or 0))
    r1 = f1 / mc
    r24 = f24 / mc
    pressure = 0.35 * math.tanh(r1 * 250.0) + 0.65 * math.tanh(r24 * 100.0)
    confidence = min(1.0, traders / 20.0)
    directional = pressure if side == 'LONG' else -pressure
    score = max(0.0, min(100.0, 50.0 + 45.0 * directional * confidence))
    bias = 'ACCUMULATING' if f24 > 0 else 'DISTRIBUTING' if f24 < 0 else 'NEUTRAL'
    aligned = (side == 'LONG' and f24 > 0) or (side == 'SHORT' and f24 < 0)
    return {
        'available': True,
        'provider': 'Nansen Smart Money Netflow',
        'chain': row.get('chain'),
        'match_method': 'token_symbol + highest_market_cap representation',
        'net_flow_1h_usd': round(f1, 2),
        'net_flow_24h_usd': round(f24, 2),
        'trader_count': traders,
        'market_cap_usd': round(float(row.get('market_cap_usd') or 0), 2),
        'bias': bias,
        'alignment': 'ALIGNED' if aligned else 'CONFLICTING',
        'score': round(score, 1),
        'captured_at': now_iso()
    }


def whale_divergence(rec):
    pred = rec.get('predictive') or {}
    q = rec.get('quality') or {}
    of = pred.get('order_flow') or {}
    lo = pred.get('large_orders') or {}
    sm = pred.get('smart_money') or {}
    mom = float(q.get('momentum_15m_pct') or 0)
    cvd = float(of.get('cvd_proxy_pct') or 0) if of.get('available') else 0.0
    taker = float(of.get('taker_buy_ratio') or .5) if of.get('available') else .5
    buy = float(lo.get('buy_usd') or 0) if lo.get('available') else 0.0
    sell = float(lo.get('sell_usd') or 0) if lo.get('available') else 0.0
    f24 = float(sm.get('net_flow_24h_usd') or 0) if sm.get('available') else 0.0
    bearish=[];bullish=[];sources=[]

    if of.get('available'):
        sources.append('Binance order flow')
        if mom > .12 and cvd < 0: bearish.append('Price rising while CVD proxy is negative')
        if mom > .12 and taker < .49: bearish.append('Price rising with sub-49% taker-buy participation')
        if mom < -.12 and cvd > 0: bullish.append('Price falling while CVD proxy is positive')
        if mom < -.12 and taker > .51: bullish.append('Price falling with >51% taker-buy participation')
    if lo.get('available'):
        sources.append('CoinGlass large orders')
        if mom > .12 and sell > buy * 1.12 and sell > 0: bearish.append('Sell-side large orders dominate during price rise')
        if mom < -.12 and buy > sell * 1.12 and buy > 0: bullish.append('Buy-side large orders dominate during price decline')
    if sm.get('available'):
        sources.append('Nansen labelled Smart Money')
        if mom > .12 and f24 < 0: bearish.append('Nansen Smart Money distributing while price rises')
        if mom < -.12 and f24 > 0: bullish.append('Nansen Smart Money accumulating while price falls')

    if len(bearish) >= 2 and len(bearish) > len(bullish):
        kind='BEARISH_WHALE_DIVERGENCE';evidence=bearish
    elif len(bullish) >= 2 and len(bullish) > len(bearish):
        kind='BULLISH_WHALE_DIVERGENCE';evidence=bullish
    else:
        return {
            'available': bool(sources),'type':'NONE','strength':0,'wallet_confirmed':False,
            'sources':sources,'evidence':[],'note':'No multi-source whale/flow divergence confirmed at forecast creation.'
        }
    strength=min(100,45+18*len(evidence)+min(15,abs(mom)*4))
    wallet_confirmed=bool(sm.get('available') and ((kind.startswith('BEARISH') and f24<0) or (kind.startswith('BULLISH') and f24>0)))
    return {
        'available':True,'type':kind,'strength':round(strength,1),'wallet_confirmed':wallet_confirmed,
        'sources':sources,'evidence':evidence,
        'action':'AVOID_CHASING_LONG' if kind.startswith('BEARISH') else 'AVOID_CHASING_SHORT',
        'note':'Wallet-confirmed only when labelled Nansen Smart Money data is available; otherwise large-order/order-flow evidence is a proxy, not a wallet claim.'
    }


def grade(score, coverage):
    if score >= 82 and coverage >= 90:
        return 'A+'
    if score >= 78 and coverage >= 70:
        return 'A'
    if score >= 70:
        return 'B'
    return 'C'


def main():
    if not LEDGER.exists() or not NEW_IDS.exists():
        return
    ids = set(json.loads(NEW_IDS.read_text(encoding='utf-8') or '[]'))
    if not ids:
        return
    data = json.loads(LEDGER.read_text(encoding='utf-8'))
    if not NANSEN_KEY:
        for rec in data.get('records', []):
            if rec.get('forecast_id') in ids:
                pred = rec.setdefault('predictive', {})
                pred['smart_money'] = {
                    'available': False,
                    'provider': 'Nansen',
                    'reason': 'NANSEN_API_KEY not configured; no Smart Money wallet value inferred'
                }
                pred['whale_divergence'] = whale_divergence(rec)
        data['generated_at'] = now_iso()
        data['whale_divergence_schema'] = 'V13.3: divergence requires at least two pieces of opposing flow evidence; wallet_confirmed is true only with labelled Nansen Smart Money data.'
        LEDGER.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        return

    try:
        idx = smart_index()
    except Exception as e:
        idx = {}
        provider_error = f'{type(e).__name__}: {e}'
    else:
        provider_error = None

    for rec in data.get('records', []):
        if rec.get('forecast_id') not in ids:
            continue
        pred = rec.setdefault('predictive', {})
        base = str(rec.get('symbol') or '').upper().replace('USDT','')
        row = idx.get(base)
        if not row:
            pred['smart_money'] = {
                'available': False,
                'provider': 'Nansen',
                'reason': provider_error or 'No unambiguous Smart Money netflow match for this symbol'
            }
        else:
            sm = factor(row, rec.get('side'))
            pred['smart_money'] = sm
            old_score = float(pred.get('score') or rec.get('score') or 0)
            old_cov = float(pred.get('coverage_pct') or 0)
            weight = 10.0
            new_cov = min(100.0, old_cov + weight)
            new_score = (old_score * old_cov + float(sm['score']) * weight) / max(old_cov + weight, 1e-9)
            pred['score_before_smart_money'] = round(old_score, 1)
            pred['score'] = round(new_score, 1)
            pred['coverage_pct'] = round(new_cov, 1)
            pred['grade'] = grade(new_score, new_cov)
            pred['model_version'] = 'V13.3 Predictive Confluence + Smart Money + Trap Intelligence'
            pred['smart_money_weight_pct'] = weight
            pred['smart_money_conflict'] = sm['alignment'] == 'CONFLICTING' and sm['score'] < 35
        pred['whale_divergence'] = whale_divergence(rec)
        div = pred['whale_divergence']
        if div.get('wallet_confirmed') and div.get('strength',0) >= 80:
            if rec.get('side')=='LONG' and div.get('type')=='BEARISH_WHALE_DIVERGENCE':
                pred['risk_override']='STRONG_WALLET_DIVERGENCE_AGAINST_LONG'
            if rec.get('side')=='SHORT' and div.get('type')=='BULLISH_WHALE_DIVERGENCE':
                pred['risk_override']='STRONG_WALLET_DIVERGENCE_AGAINST_SHORT'

    data['generated_at'] = now_iso()
    data['smart_money_schema'] = 'V13.3 optional Nansen Smart Money Netflow: 10-point incremental evidence weight, snapshotted at forecast creation; unavailable data is never inferred.'
    data['whale_divergence_schema'] = 'V13.3: compares price momentum against Binance order flow, optional CoinGlass large orders, and optional labelled Nansen Smart Money; wallet-confirmed divergence is explicitly distinguished from proxy evidence.'
    LEDGER.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
