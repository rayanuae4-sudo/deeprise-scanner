#!/usr/bin/env python3
"""Read-only DeepRise accuracy audit with optional Binance 1m replay."""
import argparse, concurrent.futures, datetime, json, urllib.parse, urllib.request
from pathlib import Path

LEDGER=Path('forecast-ledger.json')
API='https://data-api.binance.vision/api/v3/klines'

def status(row): return str(row.get('status') or 'ACTIVE').upper()
def ambiguous(row): return any(x in status(row) for x in ('AMBIGUOUS','INVALID','UNKNOWN'))
def opened(row): return status(row) in ('ACTIVE','TP1 HIT')
def completed(row): return not opened(row) and not ambiguous(row)
def hit1(row): return bool(row.get('tp1_hit_at')) or 'TP1' in status(row) or 'TP2' in status(row)
def hit2(row): return bool(row.get('tp2_hit_at')) or 'TP2' in status(row)
def stopped(row): return 'STOP' in status(row)
def stamp(value): return datetime.datetime.fromisoformat(str(value).replace('Z','+00:00'))

def stats(rows):
    done=[r for r in rows if completed(r)]
    def pct(n): return round(n/len(done)*100,1) if done else None
    p1=sum(hit1(r) for r in done);p2=sum(hit2(r) for r in done);sl=sum(stopped(r) for r in done)
    return {'signals':len(rows),'completed':len(done),'active':sum(opened(r) for r in rows),'ambiguous':sum(ambiguous(r) for r in rows),'tp1':p1,'tp1_rate_pct':pct(p1),'tp2':p2,'strict_win_rate_pct':pct(p2),'stops':sl,'stop_rate_pct':pct(sl),'stops_before_tp1':sum(stopped(r) and not hit1(r) for r in done),'stops_after_tp1':sum('STOP AFTER TP1' in status(r) for r in done)}

def replay_one(row):
    start=int(stamp(row['created_at']).timestamp()*1000)-60000
    end=int(stamp(row.get('ended_at') or row.get('last_checked_at')).timestamp()*1000)+60000
    query=urllib.parse.urlencode({'symbol':row['symbol'],'interval':'1m','startTime':max(0,start),'endTime':end,'limit':1000})
    req=urllib.request.Request(API+'?'+query,headers={'User-Agent':'DeepRise-Accuracy-Audit/1.0','accept':'application/json'})
    with urllib.request.urlopen(req,timeout=35) as res: bars=json.loads(res.read().decode())
    side=row['side'];tp1=float(row['tp1']);tp2=float(row['tp2']);sl=float(row['sl']);state='ACTIVE'
    def crossed(high,low,level,kind):
        if side=='LONG': return high>=level if kind.startswith('tp') else low<=level
        return low<=level if kind.startswith('tp') else high>=level
    for bar in bars:
        high,low=float(bar[2]),float(bar[3]);one=crossed(high,low,tp1,'tp1');two=crossed(high,low,tp2,'tp2');stop=crossed(high,low,sl,'sl')
        if state=='ACTIVE':
            if stop and (one or two): return row['forecast_id'],'AMBIGUOUS 1M BAR'
            if two: return row['forecast_id'],'TP2 HIT'
            if one: state='TP1 HIT'
            elif stop: return row['forecast_id'],'STOP HIT'
        elif state=='TP1 HIT':
            if two and stop: return row['forecast_id'],'AMBIGUOUS 1M BAR'
            if two: return row['forecast_id'],'TP2 HIT'
            if stop: return row['forecast_id'],'STOP AFTER TP1'
    return row['forecast_id'],state

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--replay-binance',action='store_true');args=ap.parse_args()
    data=json.loads(LEDGER.read_text(encoding='utf-8'));raw=data.get('records',[]);rows=[r for r in raw if r.get('audit_eligible') is not False and r.get('legacy') is not True and r.get('source') != 'daily-top5'];now=datetime.datetime.now(datetime.timezone.utc)
    groups={'all':rows,'7d':[r for r in rows if stamp(r['created_at'])>=now-datetime.timedelta(days=7)],'30d':[r for r in rows if stamp(r['created_at'])>=now-datetime.timedelta(days=30)],'long':[r for r in rows if r.get('side')=='LONG'],'short':[r for r in rows if r.get('side')=='SHORT'],'top3':[r for r in rows if int(r.get('rank') or 99)<=3],'v17':[r for r in rows if r.get('source')=='central-v17-pre-move']}
    report={'generated_at':data.get('generated_at'),'raw_records':len(raw),'audited_records':len(rows),'excluded_legacy_records':len(raw)-len(rows),'proofed_audited_records':sum(bool(r.get('proof_commit')) for r in rows),'unique_audited_forecast_ids':len({r.get('forecast_id') for r in rows}),'groups':{k:stats(v) for k,v in groups.items()},'sources':{}}
    for source in sorted({r.get('source','unknown') for r in raw}): report['sources'][source]=stats([r for r in raw if r.get('source','unknown')==source])
    if args.replay_binance:
        checked=[r for r in rows if completed(r) and r.get('ended_at')]
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool: outcomes=dict(pool.map(replay_one,checked))
        mismatches=[{'forecast_id':r['forecast_id'],'ledger':status(r),'replayed':outcomes.get(r['forecast_id'])} for r in checked if outcomes.get(r['forecast_id'])!=status(r)]
        report['binance_1m_replay']={'checked':len(checked),'matched':len(checked)-len(mismatches),'mismatches':mismatches}
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
