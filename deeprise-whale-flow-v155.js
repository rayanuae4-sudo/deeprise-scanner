/* DeepRise V15.5 — Whale Money Flow Predictor.
   Converts the existing public whale-radar evidence into stage/ETA/anomaly guidance.
   ETA is a model window, never a transaction-time guarantee. */
(()=>{'use strict';
if(window.DeepRiseWhaleFlowV155)return;
const VERSION='15.5',FILE='whale-radar.json',REFRESH=60000;
const n=(v,d=0)=>Number.isFinite(+v)?+v:d,clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,v));
const lang=()=>{try{return typeof currentLang!=='undefined'?currentLang:(localStorage.getItem('deeprise_language')||'en')}catch(e){return'en'}};
const TXT={
 en:{menu:'🐋 Money Flow Predictor',title:'🐋 Whale Money Flow Predictor',sub:'Public wallet/CEX-flow evidence. ETA is a model window — not a promised transaction time.',close:'Close',stage:'Stage',eta:'Arrival window',evidence:'Evidence strength',anomaly:'Flow anomaly',net:'Detected whale net 6h',drivers:'Drivers',none:'No unusual whale-flow candidate is strong enough right now.',observed:'Observed public flow',arrived:'ARRIVAL CONFIRMED',likely:'BUY LIKELY',rotation:'ROTATION DETECTED',moving:'CAPITAL MOBILIZING',unusual:'UNUSUAL MOVEMENT',distribution:'DISTRIBUTION / OUTFLOW',neutral:'NORMAL FLOW',now:'ACTIVE NOW',watch:'WATCH',incoming:'INCOMING',outflow:'OUTFLOW',scoreNote:'Evidence score is not a probability of price movement.'},
 ar:{menu:'🐋 توقع تدفق أموال الحيتان',title:'🐋 توقع تدفق أموال الحيتان',sub:'أدلة من المحافظ العامة وتدفق المنصة. الوقت نافذة تقديرية للنموذج وليس موعد تحويل مضمونًا.',close:'إغلاق',stage:'مرحلة الحركة',eta:'نافذة الوصول',evidence:'قوة الأدلة',anomaly:'شذوذ التدفق',net:'صافي الحيتان المرصود 6س',drivers:'أسباب الرصد',none:'لا توجد حركة حيتان غير اعتيادية بقوة كافية الآن.',observed:'تدفق عام مرصود',arrived:'تم رصد الوصول',likely:'شراء مرجح قريبًا',rotation:'تم رصد انتقال السيولة',moving:'رأس المال يتحرك',unusual:'حركة مالية غير اعتيادية',distribution:'توزيع / خروج سيولة',neutral:'تدفق طبيعي',now:'نشط الآن',watch:'مراقبة',incoming:'تدفق داخل',outflow:'تدفق خارج',scoreNote:'درجة الأدلة ليست احتمالًا مضمونًا لحركة السعر.'},
 ru:{menu:'🐋 Money Flow Predictor',title:'🐋 Whale Money Flow Predictor',sub:'Public wallet/CEX-flow evidence. ETA is a model window, not a guaranteed transfer time.',close:'Close',stage:'Stage',eta:'Arrival window',evidence:'Evidence',anomaly:'Flow anomaly',net:'Whale net 6h',drivers:'Drivers',none:'No strong unusual whale-flow candidate right now.',observed:'Observed public flow',arrived:'ARRIVAL CONFIRMED',likely:'BUY LIKELY',rotation:'ROTATION DETECTED',moving:'CAPITAL MOBILIZING',unusual:'UNUSUAL MOVEMENT',distribution:'DISTRIBUTION / OUTFLOW',neutral:'NORMAL FLOW',now:'ACTIVE NOW',watch:'WATCH',incoming:'INCOMING',outflow:'OUTFLOW',scoreNote:'Evidence score is not a guaranteed probability of price movement.'}
};
const t=k=>(TXT[lang()]||TXT.en)[k]||k;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money=v=>{v=n(v);const a=Math.abs(v);let s=a>=1e9?(a/1e9).toFixed(2)+'B':a>=1e6?(a/1e6).toFixed(2)+'M':a>=1e3?(a/1e3).toFixed(1)+'K':a.toFixed(0);return(v<0?'-':'')+'$'+s};
let source=null,predictions=new Map(),lastRaw='',timer=null;

function rows(st){
 const a=Array.isArray(st?.leaders)?st.leaders:Object.values(st?.coins||{});
 return a.filter(z=>z&&z.symbol);
}
function ageOk(z){const ts=Date.parse(z?.captured_at||source?.generated_at||0);return !ts||Date.now()-ts<4*3600000}
function anomalyScore(z){
 const vr=n(z.volume_ratio_15m,1),tk=n(z.taker_buy_ratio,.5),acc=Math.abs(n(z.taker_acceleration_pp)),fresh=n(z.fresh_large_buyers_30m),rep=n(z.repeat_buyers_6h),rot=n(z.rotation_in_30m),cnt=n(z.large_trade_count_6h);
 const reserve=Math.max(n(z.pool?.reserve_usd),1),net=Math.abs(n(z.large_net_usd_6h)),liqPct=net/reserve*100;
 let s=18;
 s+=clamp((vr-1)*13,0,25);
 s+=clamp(Math.abs(tk-.5)*90,0,18);
 s+=clamp(acc*.55,0,12);
 s+=clamp(fresh*5,0,15)+clamp(rep*3,0,9)+clamp(rot*6,0,18);
 s+=clamp(cnt*1.8,0,10)+clamp(liqPct*150,0,15);
 return Math.round(clamp(s));
}
function directionOf(z){
 const a=n(z.arrival_score),d=n(z.distribution_score),net=n(z.large_net_usd_6h),tk=n(z.taker_buy_ratio,.5);
 if((d>=70&&d>a+5)||(net<0&&d>=62&&tk<.5))return'OUT';
 if((a>=62&&a>d)||(net>0&&a>=58&&tk>=.5))return'IN';
 return'NEUTRAL';
}
function predict(z){
 const anomaly=anomalyScore(z),a=n(z.arrival_score),d=n(z.distribution_score),fresh=n(z.fresh_large_buyers_30m),rep=n(z.repeat_buyers_6h),rot=n(z.rotation_in_30m),net=n(z.large_net_usd_6h),tk=n(z.taker_buy_ratio,.5),vr=n(z.volume_ratio_15m,1),sig=String(z.signal||'NEUTRAL');
 const dir=directionOf(z);let stage='NORMAL',eta='—',severity='neutral';
 if(dir==='OUT'&&(sig==='DISTRIBUTION'||d>=82)){stage='DISTRIBUTION';eta=t('now');severity='red'}
 else if(dir==='OUT'&&(sig==='SELL_PRESSURE'||d>=70||anomaly>=78)){stage='OUTFLOW';eta=t('now');severity='red'}
 else if(dir==='IN'&&(sig==='WHALE_ARRIVAL'||a>=85)){stage='ARRIVAL_CONFIRMED';eta='0–10m';severity='green'}
 else if(dir==='IN'&&(sig==='ACCUMULATION'||a>=75)){stage='BUY_LIKELY';eta='10–30m';severity='green'}
 else if(dir==='IN'&&rot>=1&&(fresh>=1||rep>=2)&&a>=60){stage='ROTATION';eta='15–45m';severity='green'}
 else if(dir==='IN'&&(sig==='EARLY_WATCH'||a>=65||(anomaly>=78&&tk>=.55&&vr>=1.15))){stage='MOBILIZING';eta='30–90m';severity='yellow'}
 else if(anomaly>=72){stage='UNUSUAL';eta='1–4h '+t('watch');severity=dir==='OUT'?'red':dir==='IN'?'yellow':'blue'}
 const sideScore=dir==='OUT'?d:dir==='IN'?a:Math.max(a,d);
 const evidence=Math.round(clamp(sideScore*.68+anomaly*.32));
 const flow=Math.abs(net);
 const drivers=[];
 if(rot)drivers.push(`${rot} rotation-in`);
 if(fresh)drivers.push(`${fresh} fresh large buyer${fresh===1?'':'s'}`);
 if(rep)drivers.push(`${rep} repeat buyer${rep===1?'':'s'}`);
 if(flow>0)drivers.push(`${net>=0?'net buy':'net sell'} ${money(flow)}`);
 if(vr>=1.25)drivers.push(`15m volume ${vr.toFixed(1)}×`);
 if(tk>=.58)drivers.push(`taker buy ${(tk*100).toFixed(0)}%`);
 if(tk<=.42)drivers.push(`taker sell ${((1-tk)*100).toFixed(0)}%`);
 if(Array.isArray(z.evidence))for(const e of z.evidence)if(e&&!drivers.includes(e)&&drivers.length<6)drivers.push(String(e));
 return{symbol:z.symbol,base:z.base||String(z.symbol).replace(/USDT$/,''),direction:dir,stage,eta,severity,evidenceStrength:evidence,anomalyScore:anomaly,detectedNetUsd:net,largestTradeUsd:n(z.largest_trade_usd),arrivalScore:a,distributionScore:d,signal:sig,drivers:drivers.slice(0,6),capturedAt:z.captured_at||source?.generated_at||null,raw:z};
}
function rebuild(st){
 source=st||source||{};predictions=new Map();
 for(const z of rows(source))if(ageOk(z)){const p=predict(z);predictions.set(p.symbol,p)}
 decorate();banner();
}
function get(input){
 const sym=typeof input==='string'?input:input?.symbol;
 return predictions.get(String(sym||'').toUpperCase())||null;
}
function support(input,side){
 const p=get(input),s=String(side||'').toUpperCase();
 if(!p)return{available:false,supportive:false,conflict:false,score:0,stage:'NONE',eta:'—'};
 const same=(s==='LONG'&&p.direction==='IN')||(s==='SHORT'&&p.direction==='OUT');
 const opposite=(s==='LONG'&&p.direction==='OUT')||(s==='SHORT'&&p.direction==='IN');
 const actionable=['ARRIVAL_CONFIRMED','BUY_LIKELY','ROTATION'];
 const supportive=same&&actionable.includes(p.stage)&&p.evidenceStrength>=80;
 const conflict=opposite&&p.evidenceStrength>=86&&['ARRIVAL_CONFIRMED','BUY_LIKELY','DISTRIBUTION','OUTFLOW'].includes(p.stage);
 return{available:true,supportive,conflict,score:p.evidenceStrength,stage:p.stage,eta:p.eta,anomaly:p.anomalyScore,direction:p.direction};
}
function stageText(p){
 return p.stage==='ARRIVAL_CONFIRMED'?t('arrived'):p.stage==='BUY_LIKELY'?t('likely'):p.stage==='ROTATION'?t('rotation'):p.stage==='MOBILIZING'?t('moving'):p.stage==='UNUSUAL'?t('unusual'):p.stage==='DISTRIBUTION'||p.stage==='OUTFLOW'?t('distribution'):t('neutral');
}
function symbolOf(card){
 let s=card?.dataset?.drSymbol||card?.dataset?.symbol;if(s)return String(s).toUpperCase();
 const base=(card?.querySelector('.sym')?.textContent||'').split('/')[0].replace(/[^A-Z0-9]/gi,'').toUpperCase();return base?base+'USDT':'';
}
function css(){
 if(document.getElementById('dr-whale-flow-155-css'))return;
 const s=document.createElement('style');s.id='dr-whale-flow-155-css';s.textContent=`
.dr-flow-badge{cursor:pointer;white-space:nowrap}.dr-flow-badge.in{background:#0d3329!important;color:#45e7ad!important;border-color:#1c7157!important}.dr-flow-badge.out{background:#3a1b24!important;color:#ff7184!important;border-color:#753143!important}.dr-flow-badge.unusual{background:#152d42!important;color:#7dc6ff!important;border-color:#285578!important}
.dr-flow-banner{display:none;width:min(96%,1180px);margin:8px auto}.dr-flow-banner.active{display:block}.dr-flow-banner button{width:100%;border:1px solid #275777;background:linear-gradient(90deg,#071b27,#092035);color:#dff4ff;border-radius:13px;padding:9px 12px;display:flex;justify-content:space-between;gap:9px;align-items:center;text-align:start}.dr-flow-banner b{font-size:11px}.dr-flow-banner span{font-size:9px;color:#8eabc0}
.dr-flow-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}.dr-flow-card{background:#071522;border:1px solid #193950;border-radius:14px;padding:12px}.dr-flow-card.green{border-color:#23624f}.dr-flow-card.red{border-color:#6e3140}.dr-flow-card.yellow{border-color:#655b2e}.dr-flow-head{display:flex;justify-content:space-between;gap:8px}.dr-flow-stage{font-size:10px;font-weight:900}.dr-flow-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:9px}.dr-flow-stat{background:#091b2a;border:1px solid #17364d;border-radius:9px;padding:8px}.dr-flow-stat small{display:block;color:#718da2;font-size:8px;margin-bottom:4px}.dr-flow-stat b{font-size:10px;overflow-wrap:anywhere}.dr-flow-drivers{margin-top:8px;font-size:9px;line-height:1.55;color:#8aa5b8}.dr-flow-note{margin-top:10px;color:#718da2;font-size:9px;line-height:1.55}
@media(max-width:820px){.dr-flow-grid{grid-template-columns:1fr}.dr-flow-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.dr-flow-card{padding:11px}}
`;document.head.appendChild(s)
}
function decorate(){
 document.querySelectorAll('#results .card,#top3 .pick').forEach(card=>{
  const p=get(symbolOf(card)),badges=card.querySelector('.badges')||card;let b=card.querySelector('.dr-flow-badge');
  const show=p&&p.evidenceStrength>=68&&(p.stage!=='NORMAL'||p.anomalyScore>=72);
  if(!show){b?.remove();return}
  if(!b){b=document.createElement('span');badges.appendChild(b)}
  const mode=p.direction==='IN'?'in':p.direction==='OUT'?'out':'unusual';
  b.className=`badge dr-flow-badge ${mode}`;
  b.textContent=p.direction==='IN'?`🐋 ${p.eta} • ${p.evidenceStrength}`:p.direction==='OUT'?`🐋 ${t('outflow')} • ${p.evidenceStrength}`:`⚡ ${t('unusual')} • ${p.anomalyScore}`;
  b.title=`${stageText(p)} — ${t('eta')}: ${p.eta}. ${t('scoreNote')}`;
  b.onclick=e=>{e.preventDefault();e.stopPropagation();openPanel(p.symbol)}
 })
}
function cardHtml(p){
 const cls=p.severity==='green'?'green':p.severity==='red'?'red':p.severity==='yellow'?'yellow':'';
 return `<div class="dr-flow-card ${cls}">
 <div class="dr-flow-head"><div><div class="sym">${esc(p.base)}/USDT</div><div class="small">${esc(stageText(p))}</div></div><div class="dr-flow-stage ${p.direction==='OUT'?'red':p.direction==='IN'?'green':'score'}">${p.direction==='IN'?t('incoming'):p.direction==='OUT'?t('outflow'):t('watch')}</div></div>
 <div class="dr-flow-stats">
  <div class="dr-flow-stat"><small>${t('eta')}</small><b>${esc(p.eta)}</b></div>
  <div class="dr-flow-stat"><small>${t('evidence')}</small><b>${p.evidenceStrength}/100</b></div>
  <div class="dr-flow-stat"><small>${t('anomaly')}</small><b>${p.anomalyScore}/100</b></div>
  <div class="dr-flow-stat"><small>${t('net')}</small><b class="${p.detectedNetUsd>0?'green':p.detectedNetUsd<0?'red':''}">${money(p.detectedNetUsd)}</b></div>
  <div class="dr-flow-stat"><small>Arrival / Distribution</small><b>${Math.round(p.arrivalScore)} / ${Math.round(p.distributionScore)}</b></div>
  <div class="dr-flow-stat"><small>Largest public trade</small><b>${money(p.largestTradeUsd)}</b></div>
 </div>
 <div class="dr-flow-drivers"><b>${t('drivers')}:</b> ${esc(p.drivers.join(' • ')||'—')}</div></div>`;
}
function ensurePanel(){
 let p=document.getElementById('dr-whale-flow-panel');if(!p){p=document.createElement('section');p.id='dr-whale-flow-panel';p.className='signal-results-panel';document.querySelector('.hero')?.before(p)}return p
}
function openPanel(focus){
 const p=ensurePanel();let list=[...predictions.values()].filter(x=>x.evidenceStrength>=60&&(x.stage!=='NORMAL'||x.anomalyScore>=70)).sort((a,b)=>b.evidenceStrength-a.evidenceStrength||b.anomalyScore-a.anomalyScore);
 if(focus){const i=list.findIndex(x=>x.symbol===focus);if(i>0)list.unshift(...list.splice(i,1))}
 p.classList.add('active');p.innerHTML=`<div class="coin-head"><div><div class="sym">${t('title')}</div><div class="small">${t('sub')}</div></div><button class="chart-btn" data-flow-close>✕ ${t('close')}</button></div>${list.length?`<div class="dr-flow-grid">${list.slice(0,20).map(cardHtml).join('')}</div>`:`<div class="loading">${t('none')}</div>`}<div class="dr-flow-note">${t('scoreNote')} ${source?.score_note?esc(source.score_note):''}</div>`;
 p.querySelector('[data-flow-close]')?.addEventListener('click',()=>p.classList.remove('active'));setTimeout(()=>p.scrollIntoView({behavior:'smooth',block:'start'}),30)
}
function wire(){
 const dd=document.getElementById('dropdown');if(dd&&!dd.querySelector('[data-whale-flow]')){const b=document.createElement('button');b.dataset.whaleFlow='1';b.textContent=t('menu');b.onclick=e=>{e.preventDefault();dd.classList.remove('active');openPanel()};dd.insertBefore(b,dd.children[1]||null)}
 const q=document.querySelector('.dr-quick-grid');if(q&&!q.querySelector('[data-whale-flow]')){const b=document.createElement('button');b.dataset.whaleFlow='1';b.innerHTML=`<b>${t('title')}</b>${t('sub')}`;b.onclick=()=>{document.querySelector('.dr-quick-sheet')?.classList.remove('active');openPanel()};q.appendChild(b)}
}
function banner(){
 let b=document.getElementById('dr-flow-banner');if(!b){b=document.createElement('div');b.id='dr-flow-banner';b.className='dr-flow-banner';const bars=document.querySelectorAll('.marketbar');const a=bars[bars.length-1];a?.parentNode?.insertBefore(b,a.nextSibling)}
 if(!b)return;const p=[...predictions.values()].filter(x=>x.direction==='IN'&&x.evidenceStrength>=88&&['ARRIVAL_CONFIRMED','BUY_LIKELY','ROTATION'].includes(x.stage)).sort((a,c)=>c.evidenceStrength-a.evidenceStrength)[0];
 if(!p){b.classList.remove('active');return}
 b.innerHTML=`<button><b>🐋 ${esc(p.base)}/USDT — ${esc(stageText(p))}</b><span>${t('eta')}: ${esc(p.eta)} • ${t('evidence')}: ${p.evidenceStrength}/100 • ${t('net')}: ${money(p.detectedNetUsd)}</span></button>`;b.classList.add('active');b.querySelector('button').onclick=()=>openPanel(p.symbol)
}
async function load(){
 try{
  let st=window.DeepRiseWhaleRadarV147?.state?.();
  if(!st){const r=await fetch(FILE+'?flow='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('flow source '+r.status);st=await r.json()}
  const raw=JSON.stringify(st);if(raw===lastRaw)return;lastRaw=raw;rebuild(st);wire()
 }catch(e){}
}
function selfTest(){
 const sample={symbol:'TESTUSDT',base:'TEST',signal:'ACCUMULATION',arrival_score:82,distribution_score:25,volume_ratio_15m:1.6,taker_buy_ratio:.63,taker_acceleration_pp:8,fresh_large_buyers_30m:2,repeat_buyers_6h:2,rotation_in_30m:1,large_net_usd_6h:300000,largest_trade_usd:120000,large_trade_count_6h:4,pool:{reserve_usd:20000000},captured_at:new Date().toISOString()};
 const p=predict(sample);return p.direction==='IN'&&['BUY_LIKELY','ROTATION','ARRIVAL_CONFIRMED'].includes(p.stage)&&p.evidenceStrength>=70&&p.eta!=='—'
}
function boot(){
 css();wire();load();timer=setInterval(load,REFRESH);
 const mo=new MutationObserver(()=>{clearTimeout(mo._t);mo._t=setTimeout(()=>{wire();decorate();banner()},150)});['results','top3'].forEach(id=>{const el=document.getElementById(id);if(el)mo.observe(el,{childList:true,subtree:false})})
}
window.DeepRiseWhaleFlowV155={version:VERSION,predict,get,support,open:openPanel,refresh:load,state:()=>({source,predictions}),selfTest};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
