/* DeepRise V15.4 — balanced entry gate: strict 6/6 + selective high-quality 5/6 fast-track. */
(()=>{'use strict';
if(window.DeepRiseEntryRank?.version==='15.4')return;
const FILTERS=new Set(['long','short','wait','pump']);
const lang=()=>localStorage.getItem('deeprise_language')||'en';
const TXT={
 en:{signal:'SIGNAL',watch:'WATCH',pump:'PUMP',ready:'ENTRY READY',early:'EARLY ENTRY',confirmed:'CONFIRMED — WAIT TRIGGER',forming:'FORMING',wait:'WAIT'},
 ar:{signal:'سيجنال',watch:'مراقبة',pump:'بامب',ready:'الدخول جاهز',early:'دخول مبكر',confirmed:'مؤكد — انتظر المحفز',forming:'قيد التكوين',wait:'انتظار'},
 ru:{signal:'СИГНАЛ',watch:'WATCH',pump:'PUMP',ready:'ВХОД ГОТОВ',early:'РАННИЙ ВХОД',confirmed:'ПОДТВЕРЖДЕНО — ЖДАТЬ',forming:'FORMING',wait:'WAIT'}
};
const t=k=>(TXT[lang()]||TXT.en)[k]||k;
const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
function data(){try{return typeof marketData!=='undefined'&&Array.isArray(marketData)?marketData:[]}catch(e){return[]}}
function stateData(){try{return window.DeepRiseBinanceUniverse?.state?.analyzed}catch(e){return null}}
function get(sym){try{return stateData()?.get?.(sym)||data().find(x=>x.symbol===sym)||null}catch(e){return null}}
function rawSide(x){const p=x?.proSignal?.direction;if(p==='LONG'||p==='SHORT')return p;const r=x?._rawDirection;if(r==='LONG'||r==='SHORT')return r;const d=x?.direction;return d==='LONG'||d==='SHORT'?d:'WAIT'}
function oppositeRiskCount(x,side){const f=x?.proSignal?.riskFlags||[];const badLong=['failed_breakout_up','spike_giveback_up','lower_high_sequence','rsi_fast_loss','volume_decay','sequence_exhaustion'];const badShort=['failed_breakout_down','spike_giveback_down','higher_low_sequence','rsi_fast_rebound','volume_decay','sequence_exhaustion'];const set=new Set(side==='LONG'?badLong:badShort);return f.filter(z=>set.has(String(z))).length}
function hiddenGate(x,side){
 const p=x?.proSignal||{},confidence=n(p.confidence,x?.score),rank=n(p.rank,confidence),rsi=n(x?.rsi,50),rawExpected=Number(p.expectedMovePct),hasExpected=Number.isFinite(rawExpected)&&Math.abs(rawExpected)>.01,expected=hasExpected?rawExpected:0,detailed=!!p.detailed,riskCount=oppositeRiskCount(x,side),reasons=[];
 const checks={
  forecastAlignment:!detailed||p.multiTfAligned===true,
  signalStrength:confidence>=74&&rank>=70,
  expectedDirection:!hasExpected||((side==='LONG'&&expected>0)||(side==='SHORT'&&expected<0)),
  notOverextended:side==='LONG'?rsi<74:rsi>26,
  reversalRisk:riskCount<2,
  volatility:n(x?.atrPct)<=6,
  rewardRisk:n(x?.rr)>=1.8,
  liquidity:n(x?.quoteVolume)>=20000000
 };
 if(!checks.forecastAlignment)reasons.push('15m/1H forecast conflict');
 if(!checks.signalStrength)reasons.push('confidence/rank below strict gate');
 if(!checks.expectedDirection)reasons.push('expected move conflicts with side');
 if(!checks.notOverextended)reasons.push('price momentum overextended');
 if(!checks.reversalRisk)reasons.push('multiple reversal-risk flags');
 if(!checks.volatility)reasons.push('ATR volatility too high');
 if(!checks.rewardRisk)reasons.push('R:R below 1.8');
 if(!checks.liquidity)reasons.push('24h liquidity below $20M');
 return{ok:Object.values(checks).every(Boolean),checks,reasons,confidence,rank,riskCount,detailed,hasExpected};
}
function quality(x){
 const side=rawSide(x),long=side==='LONG',short=side==='SHORT';
 if(!x||(!long&&!short))return{side:'WAIT',count:0,state:'WAIT',items:[],entryReady:false,entryMode:'NONE',hardAligned:false,hidden:{ok:false,reasons:['no directional edge']}};
 const confidence=n(x.proSignal?.confidence,x.score),rank=n(x.proSignal?.rank,confidence),items=[
  ['15m trend',long?n(x.e20)>n(x.e50):n(x.e20)<n(x.e50)],
  ['1H trend',long?!!x.h1Bull:!!x.h1Bear],
  ['Score ≥ 72',confidence>=72],
  ['Volume ≥ 1.2×',n(x.volumeRatio)>=1.2],
  ['Confirmation candle',long?!!x.candle?.bull:!!x.candle?.bear],
  ['Liquidity + R:R',n(x.quoteVolume)>=20000000&&n(x.rr)>=1.8&&n(x.atrPct)<=6]
 ];
 const count=items.filter(v=>v[1]).length,hardAligned=!!(items[0][1]&&items[1][1]),hidden=hiddenGate(x,side),missing=items.filter(v=>!v[1]).map(v=>v[0]);
 const strictReady=count===6&&hardAligned&&hidden.ok;
 const onlySoftMissing=count===5&&missing.length===1&&['Volume ≥ 1.2×','Confirmation candle'].includes(missing[0]);
 const softFloor=missing[0]==='Volume ≥ 1.2×'?n(x.volumeRatio)>=.95:true;
 const companionConfirm=missing[0]==='Volume ≥ 1.2×'?(long?!!x.candle?.bull:!!x.candle?.bear):n(x.volumeRatio)>=1.35;
 const fastTrack=onlySoftMissing&&hardAligned&&hidden.checks.forecastAlignment&&hidden.checks.expectedDirection&&hidden.checks.notOverextended&&hidden.checks.volatility&&hidden.checks.rewardRisk&&hidden.checks.liquidity&&hidden.riskCount===0&&confidence>=80&&rank>=76&&n(x.rr)>=2&&n(x.atrPct)<=5.5&&softFloor&&companionConfirm;
 let state='WAIT',entryMode='NONE';
 if(strictReady){state='READY';entryMode='STRICT'}
 else if(fastTrack){state='READY';entryMode='FAST_TRACK'}
 else if(count>=5&&hardAligned&&confidence>=70&&rank>=64&&hidden.riskCount<2){state='CONFIRMED'}
 else if(count>=4&&hardAligned&&hidden.riskCount<2){state='FORMING'}
 return{side,count,state,items,missing,entryReady:state==='READY',entryMode,hardAligned,confidence,rank,hidden};
}
function installQuality(){if(!window.DeepRiseV13)return false;try{Object.defineProperty(window.DeepRiseV13,'quality',{configurable:true,enumerable:true,get:()=>quality,set:()=>{}});return true}catch(e){try{window.DeepRiseV13.quality=quality;return true}catch(_){return false}}}
function applyGate(){
 installQuality();
 for(const x of data()){
  const q=quality(x);x.v13Quality=q;x.entryDecision={state:q.state,side:q.side,count:q.count,confidence:q.confidence||0,rank:q.rank||0,hidden:q.hidden,entryAllowed:q.entryReady,entryMode:q.entryMode,missing:q.missing,updated:Date.now()};
  if((q.side==='LONG'||q.side==='SHORT')&&q.state==='READY')x.direction=q.side;else x.direction='WAIT';
 }
}
function strength(x,f){const q=quality(x),p=n(x?.proSignal?.rank,x?.score),c=n(x?.proSignal?.confidence,x?.score),pump=n(x?.pump?.score);if(f==='pump')return pump*2+p*.35+q.count*2;if(f==='wait')return q.count*24+p+c*.2+(q.state==='CONFIRMED'?24:q.state==='FORMING'?14:0);const bonus=q.entryMode==='STRICT'?95:q.entryMode==='FAST_TRACK'?82:q.state==='CONFIRMED'?38:q.state==='FORMING'?12:0;return bonus+p+c*.5+q.count*7+n(x?.volumeRatio)*2-(q.hidden?.riskCount||0)*12}
function sortMarket(f){data().sort((x,y)=>strength(y,f)-strength(x,f)||n(y.quoteVolume)-n(x.quoteVolume))}
function filterKey(btn){return btn?.dataset?.smartFilter||btn?.dataset?.filter||btn?.dataset?.smartMenu||btn?.dataset?.menu||''}
function activeFilter(f){document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',filterKey(b)===f))}
function symbolFromCard(card){let s=card?.dataset?.drSymbol||card?.dataset?.symbol;if(s)return String(s).toUpperCase();let b=(card?.querySelector('.sym')?.textContent||'').split('/')[0].replace(/[^A-Z0-9]/gi,'').toUpperCase();return b?b+'USDT':''}
function stateLabel(q){return q.entryMode==='FAST_TRACK'?t('early'):q.state==='READY'?t('ready'):q.state==='CONFIRMED'?t('confirmed'):q.state==='FORMING'?t('forming'):t('wait')}
function rankLabel(f){return f==='pump'?t('pump'):f==='wait'?t('watch'):t('signal')}
function paintRanks(){let f='';try{f=currentFilter}catch(e){}if(!FILTERS.has(f))return;const cards=[...document.querySelectorAll('#results > .card')];cards.forEach((card,i)=>{card.querySelectorAll('.dr-smart-rank,.dr-smart-state').forEach(z=>z.remove());const x=get(symbolFromCard(card)),badges=card.querySelector('.badges');if(!x||!badges)return;const q=quality(x),r=document.createElement('span');r.className='badge score dr-smart-rank';r.textContent='#'+(i+1)+' '+rankLabel(f);badges.prepend(r);const s=document.createElement('span');s.className='badge dr-smart-state '+(q.state==='READY'?'safe':q.state==='CONFIRMED'?'score':q.state==='FORMING'?'wait':'caution');s.textContent=stateLabel(q)+' • '+q.count+'/6';badges.appendChild(s)})}
function applyFilter(f){if(!FILTERS.has(f))return;applyGate();sortMarket(f);const search=document.getElementById('search');if(search)search.value='';try{currentFilter=f}catch(e){}activeFilter(f);try{if(typeof render==='function')render()}catch(e){}requestAnimationFrame(()=>setTimeout(()=>{paintRanks();window.DeepRiseSignalCardUI?.paint?.();document.getElementById('results')?.scrollIntoView({behavior:'smooth',block:'start'})},50))}
function bindFilterButton(btn,f,kind){if(!btn||btn.dataset.smartBound==='154')return;btn.dataset.smartBound='154';if(kind==='filter'){btn.dataset.smartFilter=f;btn.removeAttribute('data-filter')}else{btn.dataset.smartMenu=f;btn.removeAttribute('data-menu')}btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();document.getElementById('dropdown')?.classList.remove('active');applyFilter(f)},true)}
function bind(){document.querySelectorAll('.filter[data-filter],.filter[data-smart-filter]').forEach(b=>{const f=filterKey(b);if(FILTERS.has(f))bindFilterButton(b,f,'filter')});document.querySelectorAll('#dropdown [data-menu],#dropdown [data-smart-menu]').forEach(b=>{const f=filterKey(b);if(FILTERS.has(f))bindFilterButton(b,f,'menu')})}
let painting=false;function refresh(){if(painting)return;painting=true;try{bind();applyGate();paintRanks();window.DeepRiseSignalCardUI?.paint?.()}finally{painting=false}}
const css=document.createElement('style');css.textContent=`.dr-smart-rank{font-weight:900!important}.dr-smart-state{white-space:nowrap}.dr-smart-state.safe{background:#123b31;color:#35e0a1}.dr-smart-state.score{background:#142b3e;color:#65b8ff}.dr-smart-state.wait,.dr-smart-state.caution{background:#3a3217;color:#ffd166}`;document.head.appendChild(css);
window.DeepRiseEntryRank={version:'15.4',quality,hiddenGate,applyGate,applyFilter,strength,refresh};
const obs=new MutationObserver(()=>{clearTimeout(obs._t);obs._t=setTimeout(()=>{bind();paintRanks()},100)});
addEventListener('DOMContentLoaded',()=>{const r=document.getElementById('results');if(r)obs.observe(r,{childList:true,subtree:false});refresh()});
addEventListener('load',()=>{refresh();setTimeout(refresh,900);setTimeout(refresh,2200)});
setTimeout(refresh,300);setTimeout(refresh,1200);setInterval(()=>{installQuality();applyGate()},2500);
})();