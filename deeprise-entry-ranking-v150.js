/* DeepRise V15.0 — smart entry gate + ranked LONG/SHORT/WAIT/PUMP filters */
(()=>{'use strict';
if(window.DeepRiseEntryRank?.version==='15.0')return;
const FILTERS=new Set(['long','short','wait','pump']);
const lang=()=>localStorage.getItem('deeprise_language')||'en';
const TXT={
 en:{signal:'SIGNAL',watch:'WATCH',pump:'PUMP',ready:'ENTRY READY',confirmed:'CONFIRMED',forming:'FORMING',wait:'WAIT',entry:'Entry timing',waiting:'Waiting'},
 ar:{signal:'سيجنال',watch:'مراقبة',pump:'بامب',ready:'الدخول جاهز',confirmed:'مؤكد',forming:'قيد التكوين',wait:'انتظار',entry:'توقيت الدخول',waiting:'بانتظار'},
 ru:{signal:'СИГНАЛ',watch:'WATCH',pump:'PUMP',ready:'ENTRY READY',confirmed:'CONFIRMED',forming:'FORMING',wait:'WAIT',entry:'Время входа',waiting:'Ожидание'}
};
const C={
 en:{'15m trend':'15m trend','1H trend':'1H trend','Score ≥ 72':'Score ≥ 72','Volume ≥ 1.2×':'Volume ≥ 1.2×','Confirmation candle':'Confirmation candle','Liquidity + R:R':'Liquidity + R:R'},
 ar:{'15m trend':'اتجاه 15 دقيقة','1H trend':'اتجاه 1 ساعة','Score ≥ 72':'السكور ≥ 72','Volume ≥ 1.2×':'الحجم ≥ 1.2×','Confirmation candle':'شمعة التأكيد','Liquidity + R:R':'السيولة + العائد/المخاطرة'},
 ru:{'15m trend':'Тренд 15м','1H trend':'Тренд 1ч','Score ≥ 72':'Score ≥ 72','Volume ≥ 1.2×':'Объём ≥ 1.2×','Confirmation candle':'Свеча подтверждения','Liquidity + R:R':'Ликвидность + R:R'}
};
const t=k=>(TXT[lang()]||TXT.en)[k]||k,ct=k=>(C[lang()]||C.en)[k]||k;
const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
function data(){try{return typeof marketData!=='undefined'&&Array.isArray(marketData)?marketData:[]}catch(e){return[]}}
function stateData(){try{return window.DeepRiseBinanceUniverse?.state?.analyzed}catch(e){return null}}
function get(sym){try{return stateData()?.get?.(sym)||data().find(x=>x.symbol===sym)||null}catch(e){return null}}
function rawSide(x){const p=x?.proSignal?.direction;if(p==='LONG'||p==='SHORT')return p;const r=x?._rawDirection;if(r==='LONG'||r==='SHORT')return r;const d=x?.direction;return d==='LONG'||d==='SHORT'?d:'WAIT'}
function quality(x){
 const side=rawSide(x),long=side==='LONG',short=side==='SHORT';
 if(!x||(!long&&!short))return{side:'WAIT',count:0,state:'WAIT',items:[],entryReady:false,hardAligned:false};
 const confidence=n(x.proSignal?.confidence,x.score),rank=n(x.proSignal?.rank,confidence),items=[
  ['15m trend',long?n(x.e20)>n(x.e50):n(x.e20)<n(x.e50)],
  ['1H trend',long?!!x.h1Bull:!!x.h1Bear],
  ['Score ≥ 72',confidence>=72],
  ['Volume ≥ 1.2×',n(x.volumeRatio)>=1.2],
  ['Confirmation candle',long?!!x.candle?.bull:!!x.candle?.bear],
  ['Liquidity + R:R',n(x.quoteVolume)>=20000000&&n(x.rr)>=1.8&&n(x.atrPct)<=6]
 ];
 const count=items.filter(v=>v[1]).length,hardAligned=!!(items[0][1]&&items[1][1]);
 let state='WAIT';
 if(count===6&&hardAligned&&confidence>=72&&rank>=65)state='READY';
 else if(count>=5&&hardAligned&&confidence>=68&&rank>=58)state='CONFIRMED';
 else if(count>=4&&hardAligned)state='FORMING';
 return{side,count,state,items,entryReady:state==='READY',hardAligned,confidence,rank};
}
function installQuality(){
 if(!window.DeepRiseV13)return false;
 try{Object.defineProperty(window.DeepRiseV13,'quality',{configurable:true,enumerable:true,get:()=>quality,set:()=>{}});return true}catch(e){try{window.DeepRiseV13.quality=quality;return true}catch(_){return false}}
}
function applyGate(){
 installQuality();
 for(const x of data()){
  const q=quality(x);x.v13Quality=q;x.entryDecision={state:q.state,side:q.side,count:q.count,confidence:q.confidence||0,rank:q.rank||0,updated:Date.now()};
  if((q.side==='LONG'||q.side==='SHORT')&&(q.state==='READY'||q.state==='CONFIRMED'))x.direction=q.side;else x.direction='WAIT';
 }
}
function strength(x,f){
 const q=quality(x),p=n(x?.proSignal?.rank,x?.score),c=n(x?.proSignal?.confidence,x?.score),pump=n(x?.pump?.score);
 if(f==='pump')return pump*2+p*.35+q.count*2;
 if(f==='wait')return q.count*24+p+c*.2+(q.state==='FORMING'?18:0);
 const bonus=q.state==='READY'?70:q.state==='CONFIRMED'?42:q.state==='FORMING'?12:0;
 return bonus+p+c*.45+q.count*6+n(x?.volumeRatio)*2;
}
function sortMarket(f){const a=data();a.sort((x,y)=>strength(y,f)-strength(x,f)||n(y.quoteVolume)-n(x.quoteVolume))}
function filterKey(btn){return btn?.dataset?.smartFilter||btn?.dataset?.filter||btn?.dataset?.smartMenu||btn?.dataset?.menu||''}
function activeFilter(f){document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',filterKey(b)===f))}
function symbolFromCard(card){let s=card?.dataset?.drSymbol||card?.dataset?.symbol;if(s)return String(s).toUpperCase();let b=(card?.querySelector('.sym')?.textContent||'').split('/')[0].replace(/[^A-Z0-9]/gi,'').toUpperCase();return b?b+'USDT':''}
function stateLabel(q){return q.state==='READY'?t('ready'):q.state==='CONFIRMED'?t('confirmed'):q.state==='FORMING'?t('forming'):t('wait')}
function rankLabel(f){return f==='pump'?t('pump'):f==='wait'?t('watch'):t('signal')}
function stateClass(q){return q.state==='READY'?'green':q.state==='CONFIRMED'?'blue':q.state==='FORMING'?'yellow':'red'}
function setNodeText(el,txt){if(!el)return;if(el.childNodes.length===1&&el.firstChild?.nodeType===3)el.firstChild.nodeValue=txt;else{const n=[...el.childNodes].find(x=>x.nodeType===3);if(n)n.nodeValue=txt}}
function timing(q){const missing=(q.items||[]).filter(v=>!v[1]).map(v=>ct(v[0]));let s='⏱ '+t('entry')+': '+stateLabel(q);if(missing.length)s+=' • '+t('waiting')+': '+missing.join(' + ');return s}
function paintConditionStates(){
 document.querySelectorAll('#results > .card').forEach(card=>{
  const x=get(symbolFromCard(card)),box=card.querySelector('.dr-v13-quality');if(!x||!box)return;const q=quality(x),cls=stateClass(q);
  const head=box.querySelector('.dr-six-head strong')||box.querySelector('strong');if(head){head.className=cls;setNodeText(head,stateLabel(q))}
  const count=box.querySelector('.dr-six-head b span')||box.querySelector('b span');if(count){count.className=cls;setNodeText(count,q.count+'/6')}
  const tm=box.querySelector('.dr-entry-timing');if(tm){tm.classList.remove('green','blue','yellow','red');tm.classList.add(cls);setNodeText(tm,timing(q))}
 })
}
function paintRanks(){
 let f='';try{f=currentFilter}catch(e){}if(!FILTERS.has(f))return;
 const cards=[...document.querySelectorAll('#results > .card')];
 cards.forEach((card,i)=>{
  card.querySelectorAll('.dr-smart-rank,.dr-smart-state').forEach(z=>z.remove());
  const x=get(symbolFromCard(card)),badges=card.querySelector('.badges');if(!x||!badges)return;
  const q=quality(x),r=document.createElement('span');r.className='badge score dr-smart-rank';r.textContent='#'+(i+1)+' '+rankLabel(f);badges.prepend(r);
  const s=document.createElement('span');s.className='badge dr-smart-state '+(q.state==='READY'?'safe':q.state==='CONFIRMED'?'score':q.state==='FORMING'?'wait':'caution');s.textContent=stateLabel(q)+' • '+q.count+'/6';badges.appendChild(s);
 })
}
function applyFilter(f){
 if(!FILTERS.has(f))return;applyGate();sortMarket(f);
 const search=document.getElementById('search');if(search)search.value='';
 try{currentFilter=f}catch(e){}activeFilter(f);
 try{if(typeof render==='function')render()}catch(e){}
 requestAnimationFrame(()=>setTimeout(()=>{paintConditionStates();paintRanks();document.getElementById('results')?.scrollIntoView({behavior:'smooth',block:'start'})},50));
}
function bindFilterButton(btn,f,kind){
 if(!btn||btn.dataset.smartBound==='1')return;btn.dataset.smartBound='1';
 if(kind==='filter'){btn.dataset.smartFilter=f;btn.removeAttribute('data-filter')}else{btn.dataset.smartMenu=f;btn.removeAttribute('data-menu')}
 btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();document.getElementById('dropdown')?.classList.remove('active');applyFilter(f)},true);
}
function bind(){
 document.querySelectorAll('.filter[data-filter]').forEach(b=>{const f=b.dataset.filter;if(FILTERS.has(f))bindFilterButton(b,f,'filter')});
 document.querySelectorAll('#dropdown [data-menu]').forEach(b=>{const f=b.dataset.menu;if(FILTERS.has(f))bindFilterButton(b,f,'menu')});
}
let painting=false;
function refresh(){if(painting)return;painting=true;try{bind();applyGate();try{window.DeepRiseV13?.refresh?.()}catch(e){}paintRanks();setTimeout(paintConditionStates,70)}finally{painting=false}}
const css=document.createElement('style');css.textContent=`.dr-smart-rank{font-weight:900!important}.dr-smart-state{white-space:nowrap}.dr-smart-state.safe{background:#123b31;color:#35e0a1}.dr-smart-state.score{background:#142b3e;color:#65b8ff}.dr-smart-state.wait,.dr-smart-state.caution{background:#3a3217;color:#ffd166}`;document.head.appendChild(css);
window.DeepRiseEntryRank={version:'15.0',quality,applyGate,applyFilter,strength,refresh};
const obs=new MutationObserver(()=>{clearTimeout(obs._t);obs._t=setTimeout(()=>{bind();paintConditionStates();paintRanks()},100)});
addEventListener('DOMContentLoaded',()=>{const r=document.getElementById('results');if(r)obs.observe(r,{childList:true,subtree:false});refresh()});
addEventListener('load',()=>{refresh();setTimeout(refresh,900);setTimeout(refresh,2200)});
setTimeout(refresh,300);setTimeout(refresh,1200);setInterval(()=>{installQuality();applyGate();paintConditionStates()},2500);
})();