#!/usr/bin/env python3
"""DeepRise V14.7 Public Whale Arrival Radar.

Uses Binance public closed-candle/order-flow data to select pre-move candidates,
then GeckoTerminal public on-chain pool/trade data to observe large DEX wallets.
Optional Nansen Smart Money data is merged only when NANSEN_API_KEY is configured.

The radar score is evidence strength, not a probability. Unlabelled DEX addresses
are never assigned a real-world identity.
"""
import json, math, os, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

OUT = Path('whale-radar.json')
BINANCE = 'https://data-api.binance.vision'
GT = 'https://api.geckoterminal.com/api/v2'
NANSEN_URL = 'https://api.nansen.ai/api/v1/smart-money/netflow'
NANSEN_KEY = os.environ.get('NANSEN_API_KEY', '').strip()
CALL_BUDGET = 8
CANDIDATE_SCAN = 16
RADAR_WINDOW_H = 6
FRESH_MIN = 30
EXCLUDED = {'USDC','FDUSD','TUSD','USDP','DAI','EUR','TRY','BRL','GBP','BIDR','AEUR','EURI'}
ALIASES = {
    'ETH': {'ETH','WETH'},
    'BTC': {'BTC','WBTC','CBTC','TBTC'},
    'BNB': {'BNB','WBNB'},
    'SOL': {'SOL','WSOL'},
    'AVAX': {'AVAX','WAVAX'},
}
STABLES = {'USDT','USDC','DAI','FDUSD','USDE','USDS','USD1','TUSD'}
PREFERRED_QUOTES = STABLES | {'WETH','WBNB','WSOL','ETH','BNB','SOL'}

def now():
    return datetime.now(timezone.utc)

def now_iso():
    return now().isoformat(timespec='milliseconds').replace('+00:00','Z')

def ts(s):
    try:
        return datetime.fromisoformat(str(s).replace('Z','+00:00')).timestamp()
    except Exception:
        return 0.0

def clamp(n,a,b):
    return max(a,min(b,n))

def request_json(base, path, params=None, headers=None, timeout=25):
    u = base + path
    if params:
        u += '?' + urlencode(params)
    h = {'User-Agent':'DeepRise-Whale-Radar/14.7','Accept':'application/json'}
    if base == GT:
        h['Accept'] = 'application/json;version=20230203'
    if headers:
        h.update(headers)
    with urlopen(Request(u, headers=h), timeout=timeout) as r:
        return json.loads(r.read().decode('utf-8'))

def bj(path, params=None):
    return request_json(BINANCE, path, params)

def gt(path, params=None):
    return request_json(GT, path, params)

def load():
    if not OUT.exists():
        return {'version':'14.7','pool_cache':{},'wallet_profiles':{},'coins':{},'events':[],'rotation_index':0}
    try:
        d=json.loads(OUT.read_text(encoding='utf-8'))
        if not isinstance(d,dict): raise ValueError
        d.setdefault('pool_cache',{});d.setdefault('wallet_profiles',{});d.setdefault('coins',{});d.setdefault('events',[]);d.setdefault('rotation_index',0)
        return d
    except Exception:
        return {'version':'14.7','pool_cache':{},'wallet_profiles':{},'coins':{},'events':[],'rotation_index':0}

def closed15(symbol):
    rows=bj('/api/v3/klines',{'symbol':symbol,'interval':'15m','limit':18})
    return rows[:-1] if len(rows)>1 else []

def cex_candidate(symbol, qv, change24):
    b=closed15(symbol)
    if len(b)<12: return None
    q=[float(x[7]) for x in b]
    tq=[float(x[10]) for x in b]
    c=[float(x[4]) for x in b]
    last=q[-1]
    prior=sum(q[-9:-1])/8 if sum(q[-9:-1])>0 else 1.0
    vr=last/prior
    rq=sum(q[-3:]); rb=sum(tq[-3:])
    pq=sum(q[-8:-3]); pb=sum(tq[-8:-3])
    taker=rb/max(rq,1e-9)
    prev_taker=pb/max(pq,1e-9)
    accel=(taker-prev_taker)*100
    mom=(c[-1]-c[-5])/max(c[-5],1e-12)*100
    early=1.0 if -1.5<=mom<=2.5 else max(0.0,1.0-abs(mom-0.5)/7.0)
    score=42.0
    score += clamp((vr-1.0)*14.0,-6,18)
    score += clamp((taker-.5)*90.0,-12,12)
    score += clamp(accel*.55,-8,8)
    score += early*8
    score += 5 if qv>=50_000_000 else 3 if qv>=20_000_000 else 0
    if mom>4.0: score-=min(16,(mom-4)*3)
    return {
        'symbol':symbol,'base':symbol[:-4],'quote_volume_24h':round(qv,2),'change_24h_pct':round(change24,3),
        'volume_ratio_15m':round(vr,3),'taker_buy_ratio':round(taker,5),'taker_acceleration_pp':round(accel,3),
        'momentum_1h_pct':round(mom,3),'pre_score':round(clamp(score,0,100),1)
    }

def candidates():
    ticks=bj('/api/v3/ticker/24hr')
    rows=[]
    for x in ticks:
        s=str(x.get('symbol',''))
        if not s.endswith('USDT') or any(k in s for k in ('UPUSDT','DOWNUSDT','BULLUSDT','BEARUSDT')): continue
        base=s[:-4]
        if base in EXCLUDED: continue
        try:qv=float(x.get('quoteVolume') or 0);ch=float(x.get('priceChangePercent') or 0)
        except Exception:continue
        if qv<10_000_000:continue
        rows.append((qv,s,ch))
    rows.sort(reverse=True)
    out=[]
    for qv,s,ch in rows[:CANDIDATE_SCAN]:
        try:z=cex_candidate(s,qv,ch)
        except Exception: z=None
        if z: out.append(z)
    return sorted(out,key=lambda z:z['pre_score'],reverse=True)

def token_symbols(base):
    return ALIASES.get(base,{base})

def resolve_pool(base, cache):
    old=cache.get(base)
    if old and time.time()-ts(old.get('updated_at'))<7*86400:
        return old,0
    raw=gt('/search/pools',{'query':base,'include':'base_token,quote_token'})
    inc={x.get('id'):x.get('attributes',{}) for x in (raw.get('included') or [])}
    best=None; best_score=-1
    aliases=token_symbols(base)
    for p in raw.get('data') or []:
        rel=p.get('relationships') or {}
        bid=((rel.get('base_token') or {}).get('data') or {}).get('id')
        qid=((rel.get('quote_token') or {}).get('data') or {}).get('id')
        ba,qa=inc.get(bid,{}),inc.get(qid,{})
        bs=str(ba.get('symbol') or '').upper(); qs=str(qa.get('symbol') or '').upper()
        if bs in aliases:
            token=ba; token_side='base'; quote=qs
        elif qs in aliases:
            token=qa; token_side='quote'; quote=bs
        else:
            continue
        attrs=p.get('attributes') or {}
        try:reserve=float(attrs.get('reserve_in_usd') or 0)
        except Exception:reserve=0
        if reserve<50_000:continue
        pref=2 if quote in STABLES else 1 if quote in PREFERRED_QUOTES else 0
        score=math.log10(max(reserve,1))*10 + pref*8
        if score>best_score:
            pid=str(p.get('id') or '')
            network=pid.split('_',1)[0] if '_' in pid else ''
            addr=str(attrs.get('address') or (pid.split('_',1)[1] if '_' in pid else ''))
            best={'network':network,'pool_address':addr,'token_address':str(token.get('address') or ''),'token_side':token_side,
                  'token_symbol':str(token.get('symbol') or base),'quote_symbol':quote,'reserve_usd':round(reserve,2),
                  'pool_name':attrs.get('name'),'updated_at':now_iso()}
            best_score=score
    if best: cache[base]=best
    return best,1

def nansen_index():
    if not NANSEN_KEY:return {},{'available':False,'reason':'NANSEN_API_KEY not configured'}
    headers={'apiKey':NANSEN_KEY,'Content-Type':'application/json','Accept':'application/json'}
    def post(direction):
        body=json.dumps({'chains':['ethereum','solana','base','bnb','arbitrum','polygon','optimism','avalanche'],
                         'filters':{'include_smart_money_labels':['Fund','Smart Trader','30D Smart Trader'],
                                    'include_native_tokens':True,'include_stablecoins':False,'trader_count':{'min':3}},
                         'pagination':{'page':1,'per_page':100},
                         'order_by':[{'field':'net_flow_24h_usd','direction':direction}]}).encode()
        req=Request(NANSEN_URL,data=body,method='POST',headers={**headers,'User-Agent':'DeepRise-Whale-Radar/14.7'})
        with urlopen(req,timeout=35) as r:return (json.loads(r.read().decode()).get('data') or [])
    try:rows=post('DESC')+post('ASC')
    except Exception as e:return {},{'available':False,'reason':f'{type(e).__name__}: {e}'}
    idx={}
    for r in rows:
        s=str(r.get('token_symbol') or '').upper().strip()
        if not s:continue
        mc=float(r.get('market_cap_usd') or 0)
        if s not in idx or mc>float(idx[s].get('market_cap_usd') or 0):idx[s]=r
    return idx,{'available':True,'provider':'Nansen Smart Money Netflow'}

def profile_rotation(prior, wallet, base, when):
    p=prior.get(wallet) or {}
    last=ts(p.get('last_seen'))
    return bool(p.get('last_symbol') and p.get('last_symbol')!=base and 0<when-last<=48*3600)

def analyze_onchain(c, pool, prior_profiles, nansen):
    reserve=float(pool.get('reserve_usd') or 0)
    threshold=clamp(reserve*.0015,20_000,200_000)
    raw=gt(f"/networks/{pool['network']}/pools/{pool['pool_address']}/trades",
           {'trade_volume_in_usd_greater_than':round(threshold,2),'token':pool['token_address']})
    rows=[]
    cutoff=time.time()-RADAR_WINDOW_H*3600
    for x in raw.get('data') or []:
        a=x.get('attributes') or {}; when=ts(a.get('block_timestamp'))
        if when<cutoff:continue
        try:usd=float(a.get('volume_in_usd') or 0)
        except Exception:continue
        wallet=str(a.get('tx_from_address') or '').lower()
        kind=str(a.get('kind') or '').lower()
        if not wallet or kind not in {'buy','sell'}:continue
        rows.append({'wallet':wallet,'kind':kind,'usd':usd,'when':when,'at':a.get('block_timestamp'),'tx_hash':a.get('tx_hash')})
    per={}
    for r in rows:
        z=per.setdefault(r['wallet'],{'buy':0.0,'sell':0.0,'buys':0,'sells':0,'last':0.0})
        z[r['kind']]+=r['usd'];z[r['kind']+'s']+=1;z['last']=max(z['last'],r['when'])
    buy=sum(r['usd'] for r in rows if r['kind']=='buy');sell=sum(r['usd'] for r in rows if r['kind']=='sell');tot=buy+sell
    fresh_cut=time.time()-FRESH_MIN*60
    fresh={r['wallet'] for r in rows if r['kind']=='buy' and r['when']>=fresh_cut and c['base'] not in (prior_profiles.get(r['wallet'],{}).get('symbols') or [])}
    repeat={w for w,z in per.items() if z['buys']>=2 and z['buy']>z['sell']}
    rotation={r['wallet'] for r in rows if r['kind']=='buy' and r['when']>=fresh_cut and profile_rotation(prior_profiles,r['wallet'],c['base'],r['when'])}
    largest=max([r['usd'] for r in rows],default=0.0)
    br=buy/tot if tot else .5
    net=buy-sell
    net_liq=net/max(reserve,1)*100
    top_buy=sorted(((z['buy']-z['sell'],w,z) for w,z in per.items()),reverse=True)[:5]
    nrow=nansen.get(c['base']) or {}
    nf1=float(nrow.get('net_flow_1h_usd') or 0) if nrow else 0.0
    nf24=float(nrow.get('net_flow_24h_usd') or 0) if nrow else 0.0
    nt=int(nrow.get('trader_count') or 0) if nrow else 0
    nbonus=0
    if nrow:
        scale=math.tanh(nf24/max(float(nrow.get('market_cap_usd') or 10_000_000),10_000_000)*100)
        nbonus=clamp(scale*10,-10,10)*min(1,nt/10)
    base_flow=clamp((br-.5)*80,-20,20)
    liq_flow=clamp(net_liq*120,-15,15)
    cex=clamp((c['taker_buy_ratio']-.5)*60,-8,8)+clamp((c['volume_ratio_15m']-1)*5,-5,8)
    fresh_bonus=min(12,len(fresh)*3);repeat_bonus=min(10,len(repeat)*2);rotation_bonus=min(12,len(rotation)*4)
    chase=max(0,min(16,(c['momentum_1h_pct']-3)*3)) if c['momentum_1h_pct']>3 else 0
    arrival=clamp(40+base_flow+liq_flow+cex+fresh_bonus+repeat_bonus+rotation_bonus+nbonus-chase,0,100)
    sell_flow=clamp((.5-br)*80,-20,20)
    sell_liq=clamp(-net_liq*120,-15,15)
    sell_cex=clamp((.5-c['taker_buy_ratio'])*60,-8,8)+clamp((c['volume_ratio_15m']-1)*5,-5,8)
    npen=-nbonus
    fresh_sellers={r['wallet'] for r in rows if r['kind']=='sell' and r['when']>=fresh_cut}
    repeat_sellers={w for w,z in per.items() if z['sells']>=2 and z['sell']>z['buy']}
    distribution=clamp(40+sell_flow+sell_liq+sell_cex+min(12,len(fresh_sellers)*3)+min(10,len(repeat_sellers)*2)+npen,0,100)
    sig='NEUTRAL'
    if arrival>=85 and arrival>=distribution+8:sig='WHALE_ARRIVAL'
    elif arrival>=75 and arrival>=distribution+5:sig='ACCUMULATION'
    elif arrival>=65 and arrival>distribution:sig='EARLY_WATCH'
    elif distribution>=82 and distribution>=arrival+8:sig='DISTRIBUTION'
    elif distribution>=70 and distribution>arrival+5:sig='SELL_PRESSURE'
    evidence=[]
    if br>=.62:evidence.append(f'large DEX buys {br*100:.0f}%')
    if net>0:evidence.append(f'large-wallet net buy ${net:,.0f}')
    if fresh:evidence.append(f'{len(fresh)} fresh large buyer wallet(s)')
    if repeat:evidence.append(f'{len(repeat)} repeat buyer wallet(s)')
    if rotation:evidence.append(f'{len(rotation)} wallet rotation-in signal(s)')
    if c['taker_buy_ratio']>=.55:evidence.append(f"CEX taker-buy {c['taker_buy_ratio']*100:.0f}%")
    if c['volume_ratio_15m']>=1.25:evidence.append(f"15m volume {c['volume_ratio_15m']:.1f}x")
    if nrow and nf24>0:evidence.append(f'Nansen Smart Money +${nf24:,.0f}/24h')
    return {
        **c,'captured_at':now_iso(),'signal':sig,'arrival_score':round(arrival,1),'distribution_score':round(distribution,1),
        'score_meaning':'Evidence strength, not probability','pool':pool,'large_trade_threshold_usd':round(threshold,2),
        'large_buy_usd_6h':round(buy,2),'large_sell_usd_6h':round(sell,2),'large_net_usd_6h':round(net,2),
        'large_buy_ratio':round(br,4),'large_trade_count_6h':len(rows),'largest_trade_usd':round(largest,2),
        'unique_large_wallets_6h':len(per),'fresh_large_buyers_30m':len(fresh),'repeat_buyers_6h':len(repeat),
        'rotation_in_30m':len(rotation),'top_buy_wallets':[{'address':w,'net_buy_usd':round(v,2),'buy_usd':round(z['buy'],2),'sell_usd':round(z['sell'],2)} for v,w,z in top_buy if v>0],
        'nansen':({'available':True,'net_flow_1h_usd':round(nf1,2),'net_flow_24h_usd':round(nf24,2),'trader_count':nt,'chain':nrow.get('chain')} if nrow else {'available':False}),
        'evidence':evidence[:8]
    }, rows

def update_profiles(profiles, rows, base):
    newest={}
    for r in rows:
        if r['when']>newest.get(r['wallet'],{}).get('when',0):newest[r['wallet']]=r
    for w,r in newest.items():
        p=profiles.setdefault(w,{'symbols':[]})
        syms=list(p.get('symbols') or [])
        if base not in syms:syms.append(base)
        p['symbols']=syms[-8:];p['last_symbol']=base;p['last_side']=r['kind'].upper();p['last_seen']=r['at'];p['last_trade_usd']=round(r['usd'],2)
    cut=time.time()-7*86400
    items=[(w,p) for w,p in profiles.items() if ts(p.get('last_seen'))>=cut]
    items.sort(key=lambda x:ts(x[1].get('last_seen')),reverse=True)
    return dict(items[:800])

def main():
    state=load();pool_cache=state['pool_cache'];profiles=state['wallet_profiles'];coins=state['coins']
    try:cands=candidates()
    except Exception as e:
        state.update({'generated_at':now_iso(),'status':'DEGRADED','error':f'Binance candidate scan: {type(e).__name__}: {e}'})
        OUT.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');return
    nidx,nstatus=nansen_index()
    top=cands[:3];rest=cands[3:12]
    start=int(state.get('rotation_index') or 0)%max(len(rest),1) if rest else 0
    rotated=(rest[start:]+rest[:start]) if rest else []
    queue=[];seen=set()
    for z in top+rotated:
        if z['symbol'] not in seen:queue.append(z);seen.add(z['symbol'])
    budget=CALL_BUDGET;scanned=[];errors=[]
    for c in queue:
        if budget<=0:break
        cached=pool_cache.get(c['base'])
        valid=cached and time.time()-ts(cached.get('updated_at'))<7*86400
        try:
            if valid:pool=cached;cost=0
            else:
                if budget<2:break
                pool,cost=resolve_pool(c['base'],pool_cache);budget-=cost
            if not pool:continue
            if budget<1:break
            snap,rows=analyze_onchain(c,pool,profiles,nidx);budget-=1
            coins[c['symbol']]=snap;profiles=update_profiles(profiles,rows,c['base']);scanned.append(c['symbol'])
        except Exception as e:
            budget=max(0,budget-1);errors.append(f"{c['symbol']}: {type(e).__name__}: {e}")
    coins={s:z for s,z in coins.items() if time.time()-ts(z.get('captured_at'))<=8*3600}
    ranked=sorted(coins.values(),key=lambda z:max(float(z.get('arrival_score') or 0),float(z.get('distribution_score') or 0)),reverse=True)
    events=list(state.get('events') or [])
    for z in ranked:
        if z.get('signal') in {'WHALE_ARRIVAL','DISTRIBUTION'} and time.time()-ts(z.get('captured_at'))<600:
            key=f"{z['symbol']}|{z['signal']}|{z.get('captured_at','')[:16]}"
            if not any(e.get('key')==key for e in events):
                events.insert(0,{'key':key,'at':z.get('captured_at'),'symbol':z['symbol'],'signal':z['signal'],
                                 'arrival_score':z['arrival_score'],'distribution_score':z['distribution_score']})
    state={
        'version':'14.7','generated_at':now_iso(),'status':'OK' if scanned else 'DEGRADED',
        'method':'Binance pre-move order flow + GeckoTerminal public DEX large-wallet trades + optional Nansen labelled Smart Money',
        'score_note':'Arrival/distribution scores measure evidence strength, not future-price probability.',
        'wallet_note':'Unlabelled addresses are public DEX transaction senders; DeepRise does not infer real-world identity.',
        'geckoterminal_call_budget':CALL_BUDGET,'scanned_symbols':scanned,'errors':errors[:8],
        'nansen_status':nstatus,'rotation_index':(start+max(1,len(scanned)-len(top)))%max(len(rest),1) if rest else 0,
        'pool_cache':pool_cache,'wallet_profiles':profiles,'coins':coins,'leaders':ranked[:12],'events':events[:150]
    }
    OUT.write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':
    main()
