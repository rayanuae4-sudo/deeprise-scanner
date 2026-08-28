#!/usr/bin/env python3
"""Maintain lifecycle of already-verified DeepRise forecasts using Binance 1m candles.
No forecasts are invented here. Ambiguous same-minute target/stop ordering is explicitly excluded.
"""
import json, os, sys, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

LEDGER=Path('forecast-ledger.json')
CHANGES=Path('.ledger_status_changes.json')
API='https://api.binance.com/api/v3/klines'

def iso(ms=None):
    d=datetime.fromtimestamp((ms/1000) if ms is not None else time.time(),timezone.utc)
    return d.isoformat(timespec='milliseconds').replace('+00:00','Z')

def ms(v):
    if not v:return 0
    return int(datetime.fromisoformat(str(v).replace('Z','+00:00')).timestamp()*1000)

def klines(symbol,start,end):
    out=[]; cursor=max(0,start)
    while cursor<=end:
        q=urlencode({'symbol':symbol,'interval':'1m','startTime':cursor,'endTime':end,'limit':1000})
        req=Request(API+'?'+q,headers={'User-Agent':'DeepRise-Ledger/13'})
        with urlopen(req,timeout=20) as r: batch=json.loads(r.read().decode())
        if not batch:break
        out.extend(batch)
        nxt=int(batch[-1][0])+60000
        if nxt<=cursor:break
        cursor=nxt
        if len(batch)<1000:break
        time.sleep(.08)
    return out

def crossed(side,high,low,level,kind):
    if not level:return False
    if side=='LONG': return high>=level if kind.startswith('tp') else low<=level
    if side=='SHORT': return low<=level if kind.startswith('tp') else high>=level
    return False

def move(entry,price,side):
    if not entry:return None
    raw=(price-entry)/entry*100
    return -raw if side=='SHORT' else raw

def maintain():
    data=json.loads(LEDGER.read_text(encoding='utf-8'))
    changed_ids=[]; touched=False; now_ms=int(time.time()*1000)
    for r in data.get('records',[]):
        status=str(r.get('status') or 'ACTIVE').upper()
        if status not in ('ACTIVE','TP1 HIT'): 
            if status=='TP2 HIT' and not r.get('ended_at') and r.get('tp2_hit_at'):
                r['ended_at']=r['tp2_hit_at']; touched=True
            continue
        symbol=str(r.get('symbol') or '').upper(); side=str(r.get('side') or '').upper()
        if not symbol or side not in ('LONG','SHORT'):continue
        start=ms(r.get('last_checked_at') or r.get('created_at'))
        if not start:continue
        try: bars=klines(symbol,max(start-60000,0),now_ms)
        except Exception as e:
            r['maintenance_error']=type(e).__name__; continue
        if not bars:continue
        old_status=status; entry=float(r.get('entry') or 0); tp1=float(r.get('tp1') or 0); tp2=float(r.get('tp2') or 0); sl=float(r.get('sl') or 0)
        for b in bars:
            high=float(b[2]); low=float(b[3]); close=float(b[4]); close_ms=int(b[6]); at=iso(close_ms)
            r['high']=max(float(r.get('high') or entry or high),high)
            r['low']=min(float(r.get('low') or entry or low),low)
            r['current']=close
            hit1=crossed(side,high,low,tp1,'tp1'); hit2=crossed(side,high,low,tp2,'tp2'); stop=crossed(side,high,low,sl,'sl')
            status=str(r.get('status') or 'ACTIVE').upper()
            if status=='ACTIVE':
                if stop and (hit1 or hit2):
                    r['status']='AMBIGUOUS 1M BAR'; r['end_reason']='TARGET_STOP_SAME_1M'; r['ended_at']=at; break
                if hit2:
                    r['tp1_hit_at']=r.get('tp1_hit_at') or at; r['tp2_hit_at']=r.get('tp2_hit_at') or at; r['status']='TP2 HIT'; r['end_reason']='TP2'; r['ended_at']=at; break
                if hit1:
                    r['tp1_hit_at']=r.get('tp1_hit_at') or at; r['status']='TP1 HIT'
                elif stop:
                    r['status']='STOP HIT'; r['end_reason']='STOP'; r['ended_at']=at; break
            elif status=='TP1 HIT':
                if hit2 and stop:
                    r['status']='AMBIGUOUS 1M BAR'; r['end_reason']='TP2_STOP_SAME_1M'; r['ended_at']=at; break
                if hit2:
                    r['tp2_hit_at']=r.get('tp2_hit_at') or at; r['status']='TP2 HIT'; r['end_reason']='TP2'; r['ended_at']=at; break
                if stop:
                    r['status']='STOP AFTER TP1'; r['end_reason']='STOP_AFTER_TP1'; r['ended_at']=at; break
        r['last_checked_at']=iso(int(bars[-1][6]))
        r.pop('maintenance_error',None)
        if entry:
            r['best_move']=move(entry,float(r.get('high') if side=='LONG' else r.get('low')),side)
            r['worst_move']=move(entry,float(r.get('low') if side=='LONG' else r.get('high')),side)
        new_status=str(r.get('status') or '').upper()
        if new_status!=old_status: changed_ids.append(str(r.get('forecast_id') or ''))
        touched=True
    if touched:
        data['generated_at']=iso()
        data['lifecycle_source']='Binance Spot 1m candles via GitHub Actions'
        data['lifecycle_precision']='1 minute; same-minute target/stop ordering marked AMBIGUOUS and excluded from performance'
        LEDGER.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    CHANGES.write_text(json.dumps([x for x in changed_ids if x]),encoding='utf-8')

def stamp():
    sha=os.environ.get('PROOF_SHA','').strip()
    if len(sha)!=40 or not CHANGES.exists():return
    ids=set(json.loads(CHANGES.read_text(encoding='utf-8') or '[]'))
    if not ids:return
    data=json.loads(LEDGER.read_text(encoding='utf-8')); now=iso()
    for r in data.get('records',[]):
        if str(r.get('forecast_id') or '') in ids:
            r['proof_commit']=sha; r['proof_verified_at']=now
    data['generated_at']=now
    LEDGER.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':
    (stamp if len(sys.argv)>1 and sys.argv[1]=='stamp' else maintain)()
