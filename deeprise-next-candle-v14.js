/* DeepRise — Next Candle Forecast Layer v14.0
   Additive only: does not modify the core scanner logic.
   Uses live scanner state + Binance candles + existing DeepRise predictive context when available.
*/
(()=>{'use strict';
const ID='dr-next-candle-v14', SPOT='https://data-api.binance.vision', CACHE_MS=45000;
const cache=new Map(), inflight=new Map();
const L={
  en:{next:'Next candle',up:'UP',down:'DOWN',flat:'MIXED',conf:'confidence',live:'live model',detail:'Next Candle Forecast',note:'Probabilistic forecast from live price structure, momentum, volume, volatility, BTC context and available DeepRise intelligence. It is not a guarantee.',loading:'Updating…',tf15:'15m',tf1h:'1H',evidence:'Evidence',projected:'Projected close zone'},
  ar:{next:'توقع الشمعة التالية',up:'صاعدة',down:'هابطة',flat:'مختلطة',conf:'ثقة',live:'نموذج حي',detail:'توقع الشمعة التالية',note:'توقع احتمالي مبني على هيكل السعر والزخم والحجم والتذبذب وسياق BTC وطبقات ذكاء DeepRise المتاحة. ليس ضمانًا.',loading:'تحديث…',tf15:'15د',tf1h:'1س',evidence:'الأدلة',projected:'نطاق الإغلاق المتوقع'},
  ru:{next:'Следующая свеча',up:'ВВЕРХ',down:'ВНИЗ',flat:'СМЕШАННО',conf:'уверенность',live:'live-модель',detail:'Прогноз следующей свечи',note:'Вероятностный прогноз по структуре цены, импульсу, объёму, волатильности, контексту BTC и доступным слоям DeepRise. Это не гарантия.',loading:'Обновление…',tf15:'15м',tf1h:'1ч',evidence:'Факторы',projected:'Ожидаемая зона закрытия'}
};
const lang=()=>localStorage.getItem('deeprise_language')||document.documentElement.lang||'en';
const t=k=>(L[lang()]||L.en)[k]||k;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const num=(v,d=0)=>Number.isFinite(+v)?+v:d;
const pf=n=>{try{return typeof priceFmt==='function'?priceFmt(n):(n>=1?n.toFixed(4):n.toPrecision(5))}catch(e){return String(n)}};
function data(){try{return typeof marketData!=='undefined'&&Array.isArray(marketData)?marketData:[]}catch(e){return[]}}
function bySymbol(symbol){return data().find(x=>x.symbol===symbol)}
function emaLocal(a,p){if(!a.length)return 0;let e=a[0],k=2/(p+1);for(let i=1;i<a.length;i++)e=a[i]*k+e*(1-k);return e}
function rsiLocal(a,p=14){if(a.length<=p)return 50;let g=0,l=0;for(let i=a.length-p;i<a.length;i++){let d=a[i]-a[i-1];d>0?g+=d:l-=d}if(!l)return 100;let rs=(g/p)/(l/p);return 100-100/(1+rs)}
function atrLocal(k,p=14){if(k.length<p+1)return 0;let tr=[];for(let i=1;i<k.length;i++){let h=+k[i][2],l=+k[i][3],pc=+k[i-1][4];tr.push(Math.max(h-l,Math.abs(h-pc),Math.abs(l-pc)))}return tr.slice(-p).reduce((a,b)=>a+b,0)/p}
function centralBias(symbol){try{
  const rows=window.DeepRiseCentralForecasts?.getRecords?.()||[];
  const now=Date.now();
  const r=rows.find(z=>z?.symbol===symbol&&now-new Date(z.created_at||0).getTime()<4*3600000);
  if(!r)return null;
  const side=String(r.side||r.direction||'').toUpperCase();
  const score=num(r.predictive?.score,r.score||0);
  return {side,score};
}catch(e){return null}}
function btcContext(tf){let b=bySymbol('BTCUSDT');if(!b)return null;return quickModel(b,tf,true)}
function quickModel(x,tf,skipBtc=false){
  if(!x)return {dir:'MIXED',confidence:50,score:0,evidence:[]};
  let bull=0,bear=0,e=[];
  const rsi=num(x.rsi,50), ch=num(x.change), vr=num(x.volumeRatio,1), score=num(x.score,50), funding=num(x.funding);
  if(tf==='15'){
    if(num(x.price)>num(x.e20)){bull+=10;e.push('price>EMA20')}else{bear+=10;e.push('price<EMA20')}
    if(num(x.e20)>num(x.e50)){bull+=12;e.push('EMA20>EMA50')}else{bear+=12;e.push('EMA20<EMA50')}
    if(rsi>=52&&rsi<=68){bull+=9;e.push('RSI momentum')}else if(rsi>=32&&rsi<=48){bear+=8;e.push('RSI soft')}
    if(rsi>74){bear+=6;e.push('RSI stretched')}else if(rsi<26){bull+=6;e.push('RSI washed')}
    if(x.candle?.bull){bull+=12;e.push(x.candle.name||'bull candle')}if(x.candle?.bear){bear+=12;e.push(x.candle.name||'bear candle')}
    if(vr>=1.5){if(ch>=0)bull+=8;else bear+=8;e.push('volume '+vr.toFixed(1)+'x')}
  }else{
    if(x.h1Bull){bull+=26;e.push('1H bullish structure')}else if(x.h1Bear){bear+=26;e.push('1H bearish structure')}else e.push('1H mixed')
    if(num(x.e20)>num(x.e50))bull+=7;else bear+=7;
    if(ch>1)bull+=8;else if(ch<-1)bear+=8;
    if(rsi>=52&&rsi<=68)bull+=6;else if(rsi>=32&&rsi<=48)bear+=6;
  }
  if(x.direction==='LONG'){bull+=10;e.push('core LONG')}else if(x.direction==='SHORT'){bear+=10;e.push('core SHORT')}
  const coreEdge=clamp((score-50)*.22,0,10);if(x.direction==='LONG')bull+=coreEdge;else if(x.direction==='SHORT')bear+=coreEdge;
  if(funding>.05){bear+=4;e.push('crowded funding')}else if(funding<-.03){bull+=4;e.push('negative funding')}
  const cb=centralBias(x.symbol);if(cb){if(cb.side==='LONG'){bull+=6;e.push('central LONG')}else if(cb.side==='SHORT'){bear+=6;e.push('central SHORT')}}
  if(!skipBtc&&x.symbol!=='BTCUSDT'){
    const b=btcContext(tf);if(b?.dir==='UP'){bull+=5;e.push('BTC supportive')}else if(b?.dir==='DOWN'){bear+=5;e.push('BTC pressure')}
  }
  const diff=bull-bear, ad=Math.abs(diff);let dir=ad<7?'MIXED':diff>0?'UP':'DOWN';
  let confidence=dir==='MIXED'?clamp(Math.round(54-ad*.2),50,58):clamp(Math.round(56+ad*.62),56,90);
  return {dir,confidence,score:diff,evidence:e.slice(0,5)};
}
async function getBars(symbol,interval){
  const r=await fetch(`${SPOT}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=80`,{cache:'no-store'});
  if(!r.ok)throw new Error('Binance '+r.status);return r.json();
}
function detailedModel(bars,x,tf){
  if(!Array.isArray(bars)||bars.length<30)return quickModel(x,tf);
  const closes=bars.map(z=>+z[4]), vols=bars.map(z=>+z[5]), last=bars.at(-1), o=+last[1], h=+last[2], l=+last[3], c=+last[4];
  const e9=emaLocal(closes.slice(-60),9),e21=emaLocal(closes.slice(-70),21),e50=emaLocal(closes,50),r=rsiLocal(closes),atr=atrLocal(bars),range=Math.max(h-l,1e-12),body=Math.abs(c-o),upper=h-Math.max(o,c),lower=Math.min(o,c)-l,pos=(c-l)/range;
  const avgVol=vols.slice(-21,-1).reduce((a,b)=>a+b,0)/20||1,vr=vols.at(-1)/avgVol;
  const prev=closes.slice(-5,-1),mom=prev.length?(c-prev[0])/Math.max(prev[0],1e-12)*100:0;
  const hist=bars.slice(-12,-1),high10=Math.max(...hist.map(z=>+z[2])),low10=Math.min(...hist.map(z=>+z[3]));
  let bull=0,bear=0,e=[];
  if(e9>e21){bull+=10;e.push('EMA9>EMA21')}else{bear+=10;e.push('EMA9<EMA21')}
  if(e21>e50){bull+=12;e.push('EMA21>EMA50')}else{bear+=12;e.push('EMA21<EMA50')}
  if(c>e21)bull+=8;else bear+=8;
  if(r>=52&&r<=68){bull+=8;e.push('RSI '+r.toFixed(0))}else if(r>=32&&r<=48){bear+=8;e.push('RSI '+r.toFixed(0))}
  if(r>72){bear+=5;e.push('RSI overbought')}else if(r<28){bull+=5;e.push('RSI oversold')}
  if(mom>.12){bull+=8;e.push('momentum +')}else if(mom<-.12){bear+=8;e.push('momentum −')}
  if(pos>.68)bull+=6;else if(pos<.32)bear+=6;
  if(lower>Math.max(body,.00000001)*1.25){bull+=6;e.push('lower-wick rejection')}if(upper>Math.max(body,.00000001)*1.25){bear+=6;e.push('upper-wick rejection')}
  if(c>high10&&vr>1.15){bull+=9;e.push('breakout + volume')}if(c<low10&&vr>1.15){bear+=9;e.push('breakdown + volume')}
  if(vr>=1.6){if(c>=o)bull+=7;else bear+=7;e.push('volume '+vr.toFixed(1)+'x')}
  const q=quickModel(x,tf);if(q.dir==='UP')bull+=7;else if(q.dir==='DOWN')bear+=7;
  const diff=bull-bear,ad=Math.abs(diff);let dir=ad<7?'MIXED':diff>0?'UP':'DOWN';
  let confidence=dir==='MIXED'?clamp(Math.round(55-ad*.25),50,58):clamp(Math.round(58+ad*.62),58,92);
  const atrPct=atr/Math.max(c,1e-12)*100,step=atr*(tf==='15'?.34:.40),mid=dir==='UP'?c+step:dir==='DOWN'?c-step:c;
  const lo=Math.max(0,mid-atr*.18),hi=mid+atr*.18;
  let shape=dir==='UP'?(lower>upper?'Bullish rejection':'Bullish continuation'):dir==='DOWN'?(upper>lower?'Bearish rejection':'Bearish continuation'):'Indecision / Doji risk';
  return {dir,confidence,score:diff,evidence:e.slice(0,6),rsi:r,volumeRatio:vr,atrPct,zone:[lo,hi],shape,updated:Date.now()};
}
async function refresh(symbol,force=false){
  const old=cache.get(symbol);if(!force&&old&&Date.now()-old.time<CACHE_MS)return old;
  if(inflight.has(symbol))return inflight.get(symbol);
  const p=(async()=>{
    const x=bySymbol(symbol);if(!x)throw new Error('Coin not in current scan');
    let f15=quickModel(x,'15'),f1=quickModel(x,'60');
    try{const [b15,b1]=await Promise.all([getBars(symbol,'15m'),getBars(symbol,'1h')]);f15=detailedModel(b15,x,'15');f1=detailedModel(b1,x,'60')}catch(e){}
    const out={time:Date.now(),f15,f1};cache.set(symbol,out);paintSymbol(symbol,out);return out;
  })().finally(()=>inflight.delete(symbol));inflight.set(symbol,p);return p;
}
function dirClass(f){return f?.dir==='UP'?'up':f?.dir==='DOWN'?'down':'flat'}
function dirText(f){return f?.dir==='UP'?t('up'):f?.dir==='DOWN'?t('down'):t('flat')}
function arrow(f){return f?.dir==='UP'?'↑':f?.dir==='DOWN'?'↓':'↔'}
function btnHtml(tf,f){const label=tf==='15'?t('tf15'):t('tf1h');return `<span class="ncf-tf">${label}</span><b>${arrow(f)} ${dirText(f)}</b><small>${Math.round(f?.confidence||50)}% ${t('conf')}</small>`}
function paintSymbol(symbol,out){
  document.querySelectorAll(`.ncf-strip[data-symbol="${CSS.escape(symbol)}"]`).forEach(s=>{
    const b15=s.querySelector('[data-ncf-tf="15"]'),b1=s.querySelector('[data-ncf-tf="60"]');
    if(b15){b15.className='ncf-btn '+dirClass(out.f15);b15.innerHTML=btnHtml('15',out.f15)}
    if(b1){b1.className='ncf-btn '+dirClass(out.f1);b1.innerHTML=btnHtml('60',out.f1)}
  });
  if(typeof chartSymbol!=='undefined'&&chartSymbol===symbol)renderDetail(symbol,out);
}
function openForecast(symbol,tf){
  try{
    if(typeof openChart==='function')openChart(symbol);
    if(typeof changeChartTF==='function')setTimeout(()=>changeChartTF(tf),0);
  }catch(e){}
  refresh(symbol,true).then(out=>renderDetail(symbol,out)).catch(()=>{});
}
function clickHandler(e){const b=e.target.closest('[data-ncf-tf]');if(!b)return;e.preventDefault();e.stopPropagation();const strip=b.closest('.ncf-strip');if(strip)openForecast(strip.dataset.symbol,b.dataset.ncfTf)}
function symbolFrom(el){let raw=(el?.textContent||'').trim().toUpperCase().replace(/\s/g,'');if(!raw)return'';let base=raw.split('/')[0].replace(/[^A-Z0-9]/g,'');return base?base+'USDT':''}
function makeStrip(symbol){
  const x=bySymbol(symbol),q15=quickModel(x,'15'),q1=quickModel(x,'60'),d=document.createElement('div');d.className='ncf-strip';d.dataset.symbol=symbol;
  d.innerHTML=`<button type="button" class="ncf-btn ${dirClass(q15)}" data-ncf-tf="15">${btnHtml('15',q15)}</button><button type="button" class="ncf-btn ${dirClass(q1)}" data-ncf-tf="60">${btnHtml('60',q1)}</button>`;
  d.addEventListener('click',clickHandler);observer?.observe(d);return d;
}
function inject(){
  const xmap=new Set(data().map(x=>x.symbol));
  document.querySelectorAll('.card .coin-head > div:first-child, .pick').forEach(host=>{
    if(host.querySelector(':scope > .ncf-strip'))return;
    const sym=host.querySelector('.sym');if(!sym)return;const symbol=symbolFrom(sym);if(!xmap.has(symbol))return;
    const strip=makeStrip(symbol);if(host.classList.contains('pick')){const sm=host.querySelector('.small');sm?host.insertBefore(strip,sm):host.appendChild(strip)}else{host.appendChild(strip)}
  });
}
function renderDetail(symbol,out){
  const panel=document.getElementById('chartPanel');if(!panel)return;
  let d=document.getElementById('ncf-chart-detail');if(!d){d=document.createElement('div');d.id='ncf-chart-detail';d.className='ncf-detail';const a=panel.querySelector('.chart-analysis');a?.insertAdjacentElement('afterend',d)}
  const card=(tf,f)=>{const zone=f?.zone?`$${pf(f.zone[0])} – $${pf(f.zone[1])}`:'—';return `<button class="ncf-detail-card ${dirClass(f)}" data-open-ncf="${tf}"><div class="ncf-detail-top"><span>${tf==='15'?t('tf15'):t('tf1h')} • ${t('next')}</span><b>${arrow(f)} ${dirText(f)} ${Math.round(f?.confidence||50)}%</b></div><div class="ncf-detail-body"><span>${f?.shape||t('live')}</span><span><b>${t('projected')}:</b> ${zone}</span><span><b>${t('evidence')}:</b> ${(f?.evidence||[]).join(' • ')||'—'}</span></div></button>`};
  d.innerHTML=`<div class="ncf-detail-head"><b>🕯️ ${t('detail')} — ${symbol.replace('USDT','')}/USDT</b><span>${t('note')}</span></div><div class="ncf-detail-grid">${card('15',out.f15)}${card('60',out.f1)}</div>`;
  d.querySelectorAll('[data-open-ncf]').forEach(b=>b.onclick=()=>openForecast(symbol,b.dataset.openNcf));
}
let observer=null;
function css(){if(document.getElementById(ID+'-css'))return;const s=document.createElement('style');s.id=ID+'-css';s.textContent=`
.ncf-strip{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;align-items:stretch}.ncf-btn{appearance:none;display:grid;grid-template-columns:auto auto;grid-template-areas:"tf val" "tf sub";column-gap:7px;align-items:center;min-width:116px;padding:7px 9px!important;border-radius:9px!important;border:1px solid #23435a!important;background:#081827!important;color:#dcecff!important;line-height:1.1;text-align:left;box-shadow:none!important}.ncf-btn .ncf-tf{grid-area:tf;font-size:10px;color:#7f99af;font-weight:800}.ncf-btn b{grid-area:val;font-size:11px}.ncf-btn small{grid-area:sub;font-size:9px;color:#8fa9bd}.ncf-btn.up{border-color:#1d654e!important;background:#0a211b!important}.ncf-btn.up b{color:var(--green)}.ncf-btn.down{border-color:#70303b!important;background:#261218!important}.ncf-btn.down b{color:var(--red)}.ncf-btn.flat{border-color:#665824!important;background:#211d0d!important}.ncf-btn.flat b{color:var(--yellow)}
.ncf-detail{padding:12px 15px;border-bottom:1px solid var(--border);background:#06111d}.ncf-detail-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:9px}.ncf-detail-head>b{font-size:14px;color:#eaf4ff}.ncf-detail-head span{max-width:720px;text-align:right;font-size:9px;line-height:1.45;color:#708ba0}.ncf-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ncf-detail-card{width:100%;background:var(--panel2)!important;color:var(--text)!important;border:1px solid var(--border)!important;border-radius:10px!important;padding:10px!important;text-align:left}.ncf-detail-card.up{border-left:3px solid var(--green)!important}.ncf-detail-card.down{border-left:3px solid var(--red)!important}.ncf-detail-card.flat{border-left:3px solid var(--yellow)!important}.ncf-detail-top{display:flex;justify-content:space-between;gap:8px;font-size:11px}.ncf-detail-card.up .ncf-detail-top b{color:var(--green)}.ncf-detail-card.down .ncf-detail-top b{color:var(--red)}.ncf-detail-card.flat .ncf-detail-top b{color:var(--yellow)}.ncf-detail-body{display:grid;gap:4px;margin-top:7px;color:#91a9ba;font-size:10px;line-height:1.45}
html[dir="rtl"] .ncf-btn,html[dir="rtl"] .ncf-detail-card{text-align:right}html[dir="rtl"] .ncf-detail-head span{text-align:left}
@media(max-width:900px){.card{padding:13px}.coin-head{align-items:flex-start}.badges{max-width:48%}.data{gap:7px}.box{min-width:0}.value{overflow-wrap:anywhere}.ncf-detail-grid{grid-template-columns:1fr}.chart-actions{max-width:100%;overflow-x:auto;flex-wrap:nowrap;padding-bottom:2px}.chart-btn{flex:0 0 auto}#tradingview_chart{height:58vh;min-height:390px}}
@media(max-width:560px){header{padding-left:3%;padding-right:3%}.header-row{gap:8px}.brand h1{font-size:18px}.language-select{max-width:102px;padding:8px 6px}.live{font-size:11px}.container{width:96%;margin-top:10px}.marketbar{padding:10px 11px;gap:8px;font-size:11px}.card,.hero,.signal-results-panel{border-radius:12px}.coin-head{flex-direction:column}.badges{max-width:none;justify-content:flex-start;width:100%}.ncf-strip{width:100%}.ncf-btn{flex:1;min-width:0}.data{grid-template-columns:repeat(2,minmax(0,1fr))}.chart-head{align-items:flex-start}.chart-actions{width:100%}.ncf-detail-head{display:block}.ncf-detail-head span{display:block;text-align:start!important;margin-top:5px}#tradingview_chart{height:56vh;min-height:360px}}
@media(max-width:380px){.data{grid-template-columns:1fr 1fr}.ncf-btn{padding:6px 7px!important}.ncf-btn b{font-size:10px}.badge{font-size:10px}.box{padding:8px}.label{font-size:8px}}
`;
  document.head.appendChild(s)
}
function boot(){
  css();
  observer='IntersectionObserver'in window?new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting){const s=en.target.dataset.symbol;if(s)refresh(s).catch(()=>{});observer.unobserve(en.target)}}),{rootMargin:'180px'}):null;
  inject();
  const mo=new MutationObserver(()=>{clearTimeout(mo._t);mo._t=setTimeout(inject,80)});mo.observe(document.getElementById('results')||document.body,{childList:true,subtree:true});
  const top=document.getElementById('top3');if(top)mo.observe(top,{childList:true,subtree:true});
  setInterval(inject,3000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
