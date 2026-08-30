#!/usr/bin/env python3
"""DeepRise V14.7 whale-arrival gate for newly-created central forecasts.

Attaches the latest public Whale Arrival Radar evidence to new forecasts.
Very strong fresh opposing large-wallet flow can remove a newly-created forecast
before it is committed, while aligned flow provides only a modest score boost.
"""
import json, time
from datetime import datetime, timezone
from pathlib import Path

LEDGER=Path('forecast-ledger.json')
NEW_IDS=Path('.ledger_new_forecasts.json')
RADAR=Path('whale-radar.json')

def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')

def ts(s):
    try:return datetime.fromisoformat(str(s).replace('Z','+00:00')).timestamp()
    except Exception:return 0.0

def grade(score,coverage):
    if score>=82 and coverage>=90:return'A+'
    if score>=78 and coverage>=70:return'A'
    if score>=70:return'B'
    return'C'

def main():
    if not LEDGER.exists() or not NEW_IDS.exists() or not RADAR.exists():return
    ids=list(json.loads(NEW_IDS.read_text(encoding='utf-8') or '[]'))
    if not ids:return
    data=json.loads(LEDGER.read_text(encoding='utf-8'))
    radar=json.loads(RADAR.read_text(encoding='utf-8'))
    coins=radar.get('coins') or {}
    keep=[];removed=[]
    for rec in data.get('records',[]):
        if rec.get('forecast_id') not in ids:
            keep.append(rec);continue
        z=coins.get(rec.get('symbol'))
        pred=rec.setdefault('predictive',{})
        if not z or time.time()-ts(z.get('captured_at'))>45*60:
            pred['whale_arrival_radar']={'available':False,'reason':'No fresh public on-chain whale snapshot within 45 minutes'}
            keep.append(rec);continue
        side=rec.get('side')
        arrival=float(z.get('arrival_score') or 0);distribution=float(z.get('distribution_score') or 0)
        supportive=arrival if side=='LONG' else distribution
        conflict=distribution if side=='LONG' else arrival
        snap={
            'available':True,'provider':'DeepRise public whale radar / GeckoTerminal + Binance',
            'captured_at':z.get('captured_at'),'signal':z.get('signal'),
            'arrival_score':arrival,'distribution_score':distribution,
            'large_net_usd_6h':z.get('large_net_usd_6h'),
            'fresh_large_buyers_30m':z.get('fresh_large_buyers_30m'),
            'repeat_buyers_6h':z.get('repeat_buyers_6h'),'rotation_in_30m':z.get('rotation_in_30m'),
            'large_buy_ratio':z.get('large_buy_ratio'),'evidence':z.get('evidence',[])[:6],
            'wallet_identity_note':'Public DEX sender addresses only unless a labelled provider explicitly confirms Smart Money.'
        }
        pred['whale_arrival_radar']=snap
        proof_count=int(z.get('fresh_large_buyers_30m') or 0)+int(z.get('rotation_in_30m') or 0)+int(z.get('repeat_buyers_6h') or 0)
        opposite_confirmed = conflict>=88 and proof_count>=2 and abs(float(z.get('large_net_usd_6h') or 0))>=float((z.get('pool') or {}).get('reserve_usd') or 0)*0.0007
        if opposite_confirmed:
            if side=='SHORT' and arrival>=88:
                removed.append(rec.get('forecast_id'));continue
            if side=='LONG' and distribution>=88:
                removed.append(rec.get('forecast_id'));continue
        old=float(pred.get('score') or rec.get('score') or 0)
        cov=float(pred.get('coverage_pct') or 0)
        delta=0.0
        if supportive>=75:delta+=min(6.0,(supportive-70)*0.22)
        if conflict>=72:delta-=min(8.0,(conflict-68)*0.28)
        new=max(0,min(100,old+delta))
        pred['score_before_whale_radar']=round(old,1)
        pred['score']=round(new,1)
        pred['whale_radar_adjustment']=round(delta,1)
        pred['coverage_pct']=round(min(100,cov+5),1)
        pred['grade']=grade(new,pred['coverage_pct'])
        if conflict>=78:pred['risk_override']='PUBLIC_WHALE_FLOW_CONFLICT'
        if supportive>=82:pred['whale_flow_alignment']='STRONG'
        keep.append(rec)
    if removed:
        ids=[x for x in ids if x not in set(removed)]
        data['whale_gate_last_removed']=removed
    data['records']=keep
    data['generated_at']=now_iso()
    data['whale_arrival_gate']='V14.7 uses fresh public DEX large-wallet flow as a capped confluence factor; only very strong opposing multi-wallet evidence can block a new forecast.'
    LEDGER.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    NEW_IDS.write_text(json.dumps(ids),encoding='utf-8')

if __name__=='__main__':main()
