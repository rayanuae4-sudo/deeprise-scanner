#!/usr/bin/env python3
"""DeepRise liquidity-sweep trap detector.

Scans liquid USDT spot markets using CLOSED Binance candles only. It publishes
market-alerts.json with evidence-based warnings when price is rising toward
buy-side liquidity while aggressive buying weakens, or when a buy-side sweep
has already rejected back below the prior high.

The alert score is evidence strength, NOT a probability of reversal.
"""
import json, math, time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API='https://data-api.binance.vision'
OUT=Path('market-alerts.json')
MIN_QV=20_000_000.0
UNIVERSE=45
MAX_HISTORY=160
EXCLUDED={'USDC','FDUSD','TUSD','USDP','DAI','EUR','TRY','BRL','GBP','BIDR','AEUR','EURI'}


def iso_now():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')


def get(path, params=None, timeout=20):
    u=API+path
    if params: u+='?'+urlencode(params)
    req=Request(u,headers={'User-Agent':'DeepRise-Liquidity-Sweep/13.3','accept':'application/json'})
    with urlopen(req,timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))


def ema(vals,p):
    if len(vals)<p:return None
    k=2/(p+1);x=sum(vals[:p])/p
    for v in vals[p:]:x=v*k+x*(1-k)
    return x


def atr(bars,p=14):
    if len(bars)<=p:return 0.0
    prev=float(bars[0][4]);trs=[]
    for b in bars[1:]:
        h,l,c=float(b[2]),float(b[3]),float(b[4])
        trs.append(max(h-l,abs(h-prev),abs(l-prev)));prev=c
    return sum(trs[-p:])/p


def universe():
    info=get('/api/v3/exchangeInfo');allowed=set()
    for s in info.get('symbols',[]):
        if s.get('status')=='TRADING' and s.get('quoteAsset')=='USDT' and s.get('baseAsset') not in EXCLUDED:
            allowed.add(s.get('symbol'))
    rows=[]
    for t in get('/api/v3/ticker/24hr'):
        try:qv=float(t.get('quoteVolume') or 0)
        except Exception:continue
        if t.get('symbol') in allowed and qv>=MIN_QV:rows.append((t['symbol'],qv))
    rows.sort(key=lambda x:x[1],reverse=True)
    return rows[:UNIVERSE]


def flow(bars):
    s=bars[-6:];total=sum(float(x[5]) for x in s);buy=sum(float(x[9]) for x in s)
    ratio=buy/total if total else .5
    recent=bars[-2:];prior=bars[-6:-2]
    rb=sum(float(x[9]) for x in recent)/max(sum(float(x[5]) for x in recent),1e-12)
    pb=sum(float(x[9]) for x in prior)/max(sum(float(x[5]) for x in prior),1e-12)
    return ratio,(rb-pb)*100


def analyze(symbol,qv):
    b5=get('/api/v3/klines',{'symbol':symbol,'interval':'5m','limit':90})[:-1]
    b15=get('/api/v3/klines',{'symbol':symbol,'interval':'15m','limit':70})[:-1]
    if len(b5)<35 or len(b15)<55:return None
    last=b5[-1];o,h,l,c,v=map(float,[last[1],last[2],last[3],last[4],last[5]])
    if c<=0:return None
    prior=b5[-22:-1];prior_high=max(float(x[2]) for x in prior)
    prior_close=float(b5[-7][4])
    momentum=(c-prior_close)/prior_close*100 if prior_close else 0
    a=atr(b5);ap=a/c*100 if a else 0
    dist=(prior_high-c)/c*100
    span=max(h-l,c*1e-12);upper=max(0,h-max(o,c))/span
    avgv=sum(float(x[5]) for x in prior)/len(prior);vr=v/avgv if avgv else 1
    taker,accel=flow(b5)
    closes15=[float(x[4]) for x in b15];e20=ema(closes15[-55:],20);e50=ema(closes15,50)
    strong_bull=bool(e20 and e50 and closes15[-1]>e20>e50)
    swept=h>prior_high*1.0002 and c<prior_high
    near=max(0.15,min(2.0,max(ap*1.6,.55)))
    rising=momentum>max(.16,ap*.30) and 0<=dist<=near

    reasons=[];score=0
    if swept:
        score+=42;reasons.append('High swept prior 5m buy-side liquidity and closed back below it')
    elif rising:
        score+=27;reasons.append('Price is rising into nearby prior-high liquidity')
    if taker<.50:
        score+=16;reasons.append(f'Taker buy ratio weak at {taker*100:.1f}%')
    if accel<-1.5:
        score+=12;reasons.append(f'Aggressive buying decelerating {accel:.1f}pp')
    if upper>=.30:
        score+=12;reasons.append(f'Upper-wick rejection {upper*100:.0f}% of candle range')
    if vr>=1.25:
        score+=8;reasons.append(f'Volume expansion {vr:.2f}x')
    if not strong_bull:
        score+=8;reasons.append('15m structure is not strongly bullish')
    score=min(100,score)

    kind=None;severity=None
    if swept and score>=64 and (taker<.51 or upper>=.30):
        kind='BUY_SIDE_SWEEP_CONFIRMED';severity='HIGH' if score>=78 else 'MEDIUM'
    elif rising and score>=64 and (taker<.50 or accel<-1.5) and not strong_bull:
        kind='UPWARD_LIQUIDITY_SWEEP_RISK';severity='HIGH' if score>=78 else 'MEDIUM'
    if not kind:return None
    close_time=datetime.fromtimestamp(int(last[6])/1000,tz=timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
    return {
      'id':f"{symbol}-{kind}-{int(last[6])}",'symbol':symbol,'type':kind,'severity':severity,
      'trap_score':score,'score_meaning':'Evidence strength, not reversal probability',
      'price':c,'liquidity_level':prior_high,'distance_to_liquidity_pct':round(dist,4),
      'momentum_30m_pct':round(momentum,4),'taker_buy_ratio':round(taker,5),
      'taker_acceleration_pp':round(accel,4),'upper_wick_ratio':round(upper,4),
      'volume_ratio':round(vr,4),'atr_pct':round(ap,4),'quote_volume_usdt':round(qv,2),
      'fifteen_min_strong_bull':strong_bull,'reasons':reasons,'bar_closed_at':close_time,
      'invalidation':f"A sustained 5m close above {prior_high:.12g} with taker-buy recovery above 52% weakens/cancels the trap thesis.",
      'created_at':iso_now(),'source':'Binance closed 5m + 15m candles'
    }


def main():
    old={'version':1,'alerts':[]}
    if OUT.exists():
        try:old=json.loads(OUT.read_text(encoding='utf-8'))
        except Exception:pass
    existing={a.get('id'):a for a in old.get('alerts',[]) if a.get('id')}
    scanned=0;errors=0;new=[]
    for symbol,qv in universe():
        try:
            a=analyze(symbol,qv);scanned+=1
            if a and a['id'] not in existing:new.append(a)
        except Exception:
            errors+=1
        time.sleep(.035)
    merged=new+list(existing.values())
    def ts(a):
        try:return datetime.fromisoformat(str(a.get('created_at','')).replace('Z','+00:00'))
        except Exception:return datetime(1970,1,1,tzinfo=timezone.utc)
    cutoff=datetime.now(timezone.utc)-timedelta(hours=24)
    merged=[a for a in merged if ts(a)>=cutoff]
    merged.sort(key=ts,reverse=True);merged=merged[:MAX_HISTORY]
    out={
      'version':1,'model':'DeepRise V13.3 Liquidity Sweep Trap','generated_at':iso_now(),
      'source':'Binance public market data; closed candles only','scanned_symbols':scanned,'scan_errors':errors,
      'method_note':'Alerts require rising price into prior-high liquidity plus weakening order flow, or a confirmed high sweep and rejection. trap_score is evidence strength, never a guaranteed reversal probability.',
      'alerts':merged
    }
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':main()
