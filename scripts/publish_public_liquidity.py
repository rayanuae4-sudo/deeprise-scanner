#!/usr/bin/env python3
"""DeepRise V14.8 public liquidity fallback.

Publishes real public market microstructure from Binance spot data:
- current visible order-book walls
- buy/sell wall imbalance
- recent volume-at-price liquidity concentration zones

This is deliberately NOT labelled as a CoinGlass liquidation heatmap. It is a
public proxy used when authenticated/private providers are unavailable.
"""
import json, math, statistics
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API='https://data-api.binance.vision'
OUT=Path('public-liquidity.json')
LEDGER=Path('forecast-ledger.json')
WHALE=Path('whale-radar.json')
DEFAULTS=['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT']
MAX_SYMBOLS=12


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')

def get(path,params=None,timeout=25):
    u=API+path
    if params:u+='?'+urlencode(params)
    req=Request(u,headers={'User-Agent':'DeepRise-Public-Liquidity/14.8','Accept':'application/json'})
    with urlopen(req,timeout=timeout) as r:return json.loads(r.read().decode('utf-8'))

def pctile(xs,p):
    if not xs:return 0.0
    a=sorted(xs);i=(len(a)-1)*p;lo=int(math.floor(i));hi=int(math.ceil(i))
    if lo==hi:return a[lo]
    return a[lo]*(hi-i)+a[hi]*(i-lo)

def symbols():
    out=[]
    def add(s):
        s=str(s or '').upper()
        if s.endswith('USDT') and s not in out:out.append(s)
    try:
        d=json.loads(LEDGER.read_text(encoding='utf-8'))
        rows=sorted((d.get('records') or []),key=lambda x:str(x.get('created_at') or ''),reverse=True)
        for r in rows[:20]:
            if str(r.get('status') or '').upper() in {'OPEN','ACTIVE','PENDING'} or len(out)<5:add(r.get('symbol'))
    except Exception:pass
    try:
        d=json.loads(WHALE.read_text(encoding='utf-8'))
        for r in d.get('leaders') or []:add(r.get('symbol'))
    except Exception:pass
    for s in DEFAULTS:add(s)
    return out[:MAX_SYMBOLS]

def depth_metrics(symbol):
    d=get('/api/v3/depth',{'symbol':symbol,'limit':500})
    bids=[(float(p),float(q)) for p,q in d.get('bids') or []]
    asks=[(float(p),float(q)) for p,q in d.get('asks') or []]
    if not bids or not asks:raise ValueError('empty order book')
    mid=(bids[0][0]+asks[0][0])/2
    def side(rows):
        vals=[]
        for p,q in rows:
            dist=abs(p-mid)/mid*100
            if dist>4.0:continue
            vals.append({'price':p,'quantity':q,'usd':p*q,'distance_pct':dist})
        notionals=[x['usd'] for x in vals]
        threshold=max(50_000.0,pctile(notionals,.90)*1.35 if notionals else 0.0)
        walls=[x for x in vals if x['usd']>=threshold]
        walls.sort(key=lambda x:x['usd'],reverse=True)
        top=sorted(vals,key=lambda x:x['usd'],reverse=True)[:20]
        return walls[:8],sum(x['usd'] for x in top),threshold
    bw,btotal,bth=side(bids);aw,atotal,ath=side(asks)
    total=btotal+atotal;br=btotal/total if total else .5
    bias='BUY_WALLS' if br>=.57 else 'SELL_WALLS' if br<=.43 else 'BALANCED'
    return {
        'mid_price':mid,'bias':bias,'buy_wall_ratio':br,
        'top_bid_walls':bw[:5],'top_ask_walls':aw[:5],
        'visible_bid_wall_usd':btotal,'visible_ask_wall_usd':atotal,
        'dynamic_large_threshold_usd':max(bth,ath),
        'note':'Real public Binance spot order book. Visible limit orders can be changed or cancelled and are not proof of intent.'
    }

def volume_profile(symbol,mid):
    rows=get('/api/v3/klines',{'symbol':symbol,'interval':'15m','limit':97})
    rows=rows[:-1] if len(rows)>1 else rows
    if len(rows)<24:raise ValueError('insufficient klines')
    lo=min(float(x[3]) for x in rows);hi=max(float(x[2]) for x in rows)
    if hi<=lo:raise ValueError('flat range')
    bins=48;step=(hi-lo)/bins;vp=[0.0]*bins
    for x in rows:
        h,l,c,qv=float(x[2]),float(x[3]),float(x[4]),float(x[7])
        typical=(h+l+c)/3
        i=max(0,min(bins-1,int((typical-lo)/step)))
        vp[i]+=qv
    levels=[]
    for i,v in enumerate(vp):
        p=lo+(i+.5)*step;dist=(p-mid)/mid*100
        if abs(dist)<=8.0:levels.append({'price':p,'quote_volume_usd':v,'distance_pct':dist})
    above=sorted((x for x in levels if x['price']>mid),key=lambda x:x['quote_volume_usd'],reverse=True)
    below=sorted((x for x in levels if x['price']<mid),key=lambda x:x['quote_volume_usd'],reverse=True)
    up=above[0] if above else None;down=below[0] if below else None
    uv=float(up['quote_volume_usd']) if up else 0;dv=float(down['quote_volume_usd']) if down else 0
    total=uv+dv;ratio=uv/total if total else .5
    bias='UPPER_LIQUIDITY_MAGNET' if ratio>=.58 else 'LOWER_LIQUIDITY_MAGNET' if ratio<=.42 else 'BALANCED'
    return {
        'bias':bias,'upper_zone':up,'lower_zone':down,'upper_share':ratio,
        'window':'24h closed 15m candles','method':'volume-at-price concentration proxy',
        'note':'Public liquidity/stop-cluster proxy only. This is not a liquidation heatmap and does not estimate private leverage positions.'
    }

def analyze(symbol):
    ob=depth_metrics(symbol);vp=volume_profile(symbol,ob['mid_price'])
    br=ob['buy_wall_ratio'];ur=vp['upper_share']
    combined=(br-.5)*.55+(ur-.5)*.45
    direction='UP' if combined>.07 else 'DOWN' if combined<-.07 else 'NEUTRAL'
    strength=min(100,round(50+abs(combined)*190,1))
    return {
        'symbol':symbol,'captured_at':now_iso(),'provider':'Binance public spot market data',
        'large_orders_public':ob,'liquidity_proxy':vp,
        'combined_bias':direction,'evidence_strength':strength,
        'exact_coinglass':False,
        'disclaimer':'Fallback is public market microstructure, not CoinGlass liquidation heatmap/large-order proprietary data.'
    }

def main():
    data={'version':'14.8','generated_at':now_iso(),'status':'OK','method':'public fallback; no paid/private data','symbols':{},'errors':[]}
    for s in symbols():
        try:data['symbols'][s]=analyze(s)
        except Exception as e:data['errors'].append(f'{s}: {type(e).__name__}: {e}')
    if not data['symbols']:data['status']='DEGRADED'
    OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':main()
