#!/usr/bin/env python3
"""Annotate and gate newly-created forecasts using DeepRise V13.3 trap logic.

A strong upward buy-side liquidity sweep is bearish evidence. New LONG forecasts
are removed before the authoritative ledger commit when a HIGH/confirmed trap is
detected. SHORT forecasts are annotated but never promoted solely because of it.
"""
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

LEDGER=Path('forecast-ledger.json');NEW_IDS=Path('.ledger_new_forecasts.json')
API='https://data-api.binance.vision'


def now_iso():return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')

def get(path,params=None):
    u=API+path
    if params:u+='?'+urlencode(params)
    with urlopen(Request(u,headers={'User-Agent':'DeepRise-Trap-Gate/13.3'}),timeout=20) as r:return json.loads(r.read().decode())

def ema(v,p):
    if len(v)<p:return None
    k=2/(p+1);x=sum(v[:p])/p
    for n in v[p:]:x=n*k+x*(1-k)
    return x

def atr(b,p=14):
    prev=float(b[0][4]);tr=[]
    for x in b[1:]:
        h,l,c=float(x[2]),float(x[3]),float(x[4]);tr.append(max(h-l,abs(h-prev),abs(l-prev)));prev=c
    return sum(tr[-p:])/p if len(tr)>=p else 0

def inspect(symbol):
    b5=get('/api/v3/klines',{'symbol':symbol,'interval':'5m','limit':90})[:-1]
    b15=get('/api/v3/klines',{'symbol':symbol,'interval':'15m','limit':70})[:-1]
    if len(b5)<35 or len(b15)<55:return {'available':False,'reason':'insufficient closed candles'}
    last=b5[-1];o,h,l,c,v=map(float,[last[1],last[2],last[3],last[4],last[5]])
    prior=b5[-22:-1];ph=max(float(x[2]) for x in prior);pc=float(b5[-7][4]);mom=(c-pc)/pc*100 if pc else 0
    a=atr(b5);ap=a/c*100 if c and a else 0;dist=(ph-c)/c*100 if c else 999
    span=max(h-l,c*1e-12);upper=max(0,h-max(o,c))/span
    av=sum(float(x[5]) for x in prior)/len(prior);vr=v/av if av else 1
    s=b5[-6:];tot=sum(float(x[5]) for x in s);buy=sum(float(x[9]) for x in s);taker=buy/tot if tot else .5
    r=b5[-2:];p=b5[-6:-2];rr=sum(float(x[9]) for x in r)/max(sum(float(x[5]) for x in r),1e-12);pr=sum(float(x[9]) for x in p)/max(sum(float(x[5]) for x in p),1e-12);acc=(rr-pr)*100
    c15=[float(x[4]) for x in b15];e20=ema(c15[-55:],20);e50=ema(c15,50);strong=bool(e20 and e50 and c15[-1]>e20>e50)
    swept=h>ph*1.0002 and c<ph;near=max(.15,min(2,max(ap*1.6,.55)));rising=mom>max(.16,ap*.30) and 0<=dist<=near
    ev=[];score=0
    if swept:score+=42;ev.append('confirmed sweep above prior 5m high with close back below')
    elif rising:score+=27;ev.append('rising into nearby prior-high liquidity')
    if taker<.50:score+=16;ev.append('weak taker-buy participation')
    if acc<-1.5:score+=12;ev.append('aggressive buying decelerating')
    if upper>=.30:score+=12;ev.append('upper-wick rejection')
    if vr>=1.25:score+=8;ev.append('volume expansion')
    if not strong:score+=8;ev.append('15m structure not strongly bullish')
    score=min(100,score);kind='NONE';severity='LOW'
    if swept and score>=64 and (taker<.51 or upper>=.30):kind='BUY_SIDE_SWEEP_CONFIRMED';severity='HIGH' if score>=78 else 'MEDIUM'
    elif rising and score>=64 and (taker<.50 or acc<-1.5) and not strong:kind='UPWARD_LIQUIDITY_SWEEP_RISK';severity='HIGH' if score>=78 else 'MEDIUM'
    return {'available':True,'type':kind,'severity':severity,'trap_score':score,'score_meaning':'Evidence strength, not reversal probability','liquidity_level':ph,'distance_pct':round(dist,4),'momentum_30m_pct':round(mom,4),'taker_buy_ratio':round(taker,5),'taker_acceleration_pp':round(acc,4),'upper_wick_ratio':round(upper,4),'volume_ratio':round(vr,4),'evidence':ev,'captured_at':now_iso()}


def main():
    if not LEDGER.exists() or not NEW_IDS.exists():return
    ids=list(json.loads(NEW_IDS.read_text() or '[]'))
    if not ids:return
    data=json.loads(LEDGER.read_text(encoding='utf-8'));records=data.get('records',[]);keep=[];removed=[]
    for rec in records:
        if rec.get('forecast_id') not in ids:
            keep.append(rec);continue
        try:trap=inspect(rec.get('symbol'))
        except Exception as e:trap={'available':False,'reason':f'{type(e).__name__}: {e}'}
        pred=rec.setdefault('predictive',{});pred['liquidity_sweep']=trap
        block=rec.get('side')=='LONG' and trap.get('type') in {'UPWARD_LIQUIDITY_SWEEP_RISK','BUY_SIDE_SWEEP_CONFIRMED'} and (trap.get('severity')=='HIGH' or trap.get('type')=='BUY_SIDE_SWEEP_CONFIRMED')
        if block:
            removed.append(rec.get('forecast_id'));continue
        if rec.get('side')=='SHORT' and trap.get('type')!='NONE':pred['liquidity_sweep_supports_short']=True
        keep.append(rec)
    if removed:
        ids=[x for x in ids if x not in set(removed)]
        data['trap_gate_last_removed']=removed
    data['records']=keep;data['generated_at']=now_iso();data['liquidity_sweep_gate']='V13.3 blocks newly-created LONG forecasts before commit when closed-candle evidence shows a confirmed or HIGH upward buy-side liquidity sweep trap.'
    LEDGER.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');NEW_IDS.write_text(json.dumps(ids),encoding='utf-8')

if __name__=='__main__':main()
