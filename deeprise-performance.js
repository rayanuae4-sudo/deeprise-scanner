/* DeepRise V13 Performance + Reversal Intelligence
   UI/analytics layer only. It does not alter analyseCoin(), scoring, LONG/SHORT,
   entry, stop-loss, take-profit, or the scanner's market engine. */
(()=>{'use strict';

const LEDGER='forecast-ledger.json';
const lang=()=>localStorage.getItem('deeprise_language')||document.documentElement.lang||'en';
const T={
 ar:{
  title:'📊 Performance / سجل الأداء',sub:'أرقام محسوبة حصريًا من السجل المركزي الحقيقي — لا بيانات تجريبية.',d7:'7 أيام',d30:'30 يومًا',all:'الكل',signals:'الإشارات',completed:'المكتملة',active:'النشطة',win:'Win Rate (TP2)',tp1:'TP1 Rate',tp2:'TP2 Rate',stop:'Stop Rate',avg:'متوسط زمن الهدف',long:'LONG',short:'SHORT',top3:'Top 3',ins:'بيانات غير كافية',proof:'ACTIVE و TP1 HIT المفتوحة لا تدخل في الفوز/الخسارة. الحالات غير الحاسمة تستبعد. Win Rate = TP2 من الإشارات المكتملة.',close:'إغلاق',
  revTitle:'↩️ توقع انعكاس الاتجاه',revSub:'يقدّر منطقة وتوقيت الانعكاس المحتمل من بيانات المحرك الحالية دون تغيير قرار المحرك.',revNow:'احتمال الانعكاس',revTime:'الوقت المتوقع',revTrigger:'شرط التأكيد',revZone:'منطقة المراقبة',revTrend:'الاتجاه الحالي',revOpp:'الانعكاس المحتمل',revFactors:'عوامل التحذير',revNo:'لا توجد إشارة انعكاس موثوقة الآن',revVery:'قريب جدًا',revNear:'قريب',revWatch:'تحت المراقبة',revLow:'ضعيف',up:'صاعد',down:'هابط',mixed:'مختلط',toUp:'إلى صعود',toDown:'إلى هبوط',mins1545:'15–45 دقيقة (1–3 شمعات 15د)',mins3090:'30–90 دقيقة (2–6 شمعات 15د)',hours13:'1–3 ساعات',notReliable:'لا يوجد توقيت موثوق بعد',revDisclaimer:'هذه إشارة احتمالية وليست توقيتًا مضمونًا. الانعكاس لا يُعتمد إلا بعد إغلاق شمعة التأكيد وظهور الحجم.'
 },
 en:{
  title:'📊 Performance',sub:'Metrics calculated exclusively from the real central ledger — no demo data.',d7:'7 Days',d30:'30 Days',all:'All Time',signals:'Signals',completed:'Completed',active:'Active',win:'Win Rate (TP2)',tp1:'TP1 Rate',tp2:'TP2 Rate',stop:'Stop Rate',avg:'Avg. time to target',long:'LONG',short:'SHORT',top3:'Top 3',ins:'Insufficient data',proof:'Open ACTIVE/TP1 HIT signals do not count as wins or losses. Ambiguous results are excluded. Win Rate equals TP2 hits among completed signals.',close:'Close',
  revTitle:'↩️ Trend Reversal Estimate',revSub:'Estimates a possible reversal zone and timing from the engine’s existing data without changing the engine decision.',revNow:'Reversal probability',revTime:'Expected timing',revTrigger:'Confirmation trigger',revZone:'Watch zone',revTrend:'Current trend',revOpp:'Potential reversal',revFactors:'Warning factors',revNo:'No reliable reversal signal yet',revVery:'Very near',revNear:'Near',revWatch:'Watch',revLow:'Weak',up:'Bullish',down:'Bearish',mixed:'Mixed',toUp:'to bullish',toDown:'to bearish',mins1545:'15–45 min (1–3 x 15m candles)',mins3090:'30–90 min (2–6 x 15m candles)',hours13:'1–3 hours',notReliable:'No reliable timing yet',revDisclaimer:'This is probabilistic, not a guaranteed turn time. Confirm only after the trigger candle closes with supporting volume.'
 },
 ru:{
  title:'📊 Performance / Результаты',sub:'Метрики только из реального центрального журнала — без демо-данных.',d7:'7 дней',d30:'30 дней',all:'Всё время',signals:'Сигналы',completed:'Завершено',active:'Активно',win:'Win Rate (TP2)',tp1:'TP1 Rate',tp2:'TP2 Rate',stop:'Stop Rate',avg:'Среднее время до цели',long:'LONG',short:'SHORT',top3:'Top 3',ins:'Недостаточно данных',proof:'Открытые ACTIVE/TP1 HIT не считаются победой или поражением. Неоднозначные результаты исключаются. Win Rate = TP2 среди завершённых.',close:'Закрыть',
  revTitle:'↩️ Оценка разворота тренда',revSub:'Оценивает возможную зону и время разворота по уже рассчитанным данным движка, не меняя его решение.',revNow:'Вероятность разворота',revTime:'Ожидаемое время',revTrigger:'Подтверждение',revZone:'Зона наблюдения',revTrend:'Текущий тренд',revOpp:'Возможный разворот',revFactors:'Факторы риска',revNo:'Надёжного сигнала разворота пока нет',revVery:'Очень близко',revNear:'Близко',revWatch:'Наблюдать',revLow:'Слабый',up:'Бычий',down:'Медвежий',mixed:'Смешанный',toUp:'к росту',toDown:'к снижению',mins1545:'15–45 мин (1–3 свечи 15м)',mins3090:'30–90 мин (2–6 свечей 15м)',hours13:'1–3 часа',notReliable:'Надёжного времени пока нет',revDisclaimer:'Это вероятностная оценка, а не гарантированное время разворота. Нужны закрытие подтверждающей свечи и объём.'
 }
};
const t=k=>(T[lang()]||T.en)[k]||k;
const status=r=>String(r.status||'ACTIVE').toUpperCase();
const ambiguous=r=>/AMBIGUOUS|INVALID|UNKNOWN/.test(status(r));
const isOpen=r=>status(r)==='ACTIVE'||status(r)==='TP1 HIT';
const completed=r=>!isOpen(r)&&!ambiguous(r);
const hit1=r=>!!r.tp1_hit_at||/TP1|TP2/.test(status(r));
const hit2=r=>!!r.tp2_hit_at||/TP2/.test(status(r));
const stopped=r=>/STOP/.test(status(r));

function durationToTarget(r){const e=r.tp2_hit_at||r.tp1_hit_at;if(!e||!r.created_at)return null;const ms=new Date(e)-new Date(r.created_at);return Number.isFinite(ms)&&ms>=0?ms:null;}
function fmtDur(ms){if(ms==null)return'—';let m=Math.round(ms/60000);if(m<60)return m+'m';if(m<1440)return Math.floor(m/60)+'h '+m%60+'m';return Math.floor(m/1440)+'d '+Math.floor((m%1440)/60)+'h';}
function pct(n,d){return d?((n/d)*100).toFixed(1)+'%':'—';}
function filterDays(rows,days){if(!days)return rows;const cut=Date.now()-days*86400000;return rows.filter(r=>{const x=new Date(r.created_at).getTime();return Number.isFinite(x)&&x>=cut});}
function stats(rows){const c=rows.filter(completed),a=rows.filter(isOpen),p1=c.filter(hit1),p2=c.filter(hit2),sl=c.filter(stopped),ds=c.map(durationToTarget).filter(x=>x!=null);return{n:rows.length,c:c.length,a:a.length,win:pct(p2.length,c.length),p1:pct(p1.length,c.length),p2:pct(p2.length,c.length),sl:pct(sl.length,c.length),avg:ds.length?fmtDur(ds.reduce((x,y)=>x+y,0)/ds.length):'—'};}
function card(label,v,cls=''){return `<div class="signal-stat"><div class="label">${label}</div><div class="value ${cls}">${v}</div></div>`;}
function ensure(){let p=document.getElementById('dr-performance');if(!p){p=document.createElement('section');p.id='dr-performance';p.className='signal-results-panel';let hero=document.querySelector('.hero');if(hero?.parentNode)hero.parentNode.insertBefore(p,hero);else document.querySelector('.container')?.prepend(p)}return p;}

async function open(days=30){
 document.getElementById('dr-v13-performance')?.remove();
 const p=ensure();p.classList.add('active');p.innerHTML='<div class="loading">Loading verified performance…</div>';
 try{
  const r=await fetch(LEDGER+'?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('ledger '+r.status);
  const d=await r.json(),all=Array.isArray(d.records)?d.records:[],rows=filterDays(all,days),s=stats(rows),ls=stats(rows.filter(r=>r.side==='LONG')),ss=stats(rows.filter(r=>r.side==='SHORT')),ts=stats(rows.filter(r=>Number(r.rank)<=3)),low=s.c<10;
  p.innerHTML=`<div class="coin-head"><div><div class="sym">${t('title')}</div><div class="small">${t('sub')}</div></div><button class="chart-btn chart-close" data-pclose>✕ ${t('close')}</button></div><div class="dr-periods"><button data-days="7">${t('d7')}</button><button data-days="30">${t('d30')}</button><button data-days="0">${t('all')}</button></div>${low?`<div class="dr-insufficient">⚠️ ${t('ins')} — ${s.c} ${t('completed')}</div>`:''}<div class="result-summary">${card(t('signals'),s.n,'blue')}${card(t('completed'),s.c)}${card(t('active'),s.a,'yellow')}${card(t('win'),s.win,'green')}${card(t('tp1'),s.p1,'green')}${card(t('tp2'),s.p2,'green')}${card(t('stop'),s.sl,'red')}${card(t('avg'),s.avg)}</div><div class="dr-breakdown"><div><b>${t('long')}</b><span>${ls.c} ${t('completed')} · ${t('win')} ${ls.win} · TP1 ${ls.p1}</span></div><div><b>${t('short')}</b><span>${ss.c} ${t('completed')} · ${t('win')} ${ss.win} · TP1 ${ss.p1}</span></div><div><b>${t('top3')}</b><span>${ts.c} ${t('completed')} · ${t('win')} ${ts.win} · TP1 ${ts.p1}</span></div></div><div class="dr-performance-proof">✅ ${t('proof')}</div>`;
  p.querySelector('[data-pclose]').onclick=()=>p.classList.remove('active');
  p.querySelectorAll('[data-days]').forEach(b=>b.onclick=()=>open(+b.dataset.days));
  window.DeepRiseAnalytics?.capture?.('performance_dashboard_open',{days,records:rows.length,completed:s.c,app_version:'V13 PRO'});
 }catch(e){p.innerHTML='<div class="loading red">Unable to load verified performance.</div>';}
 setTimeout(()=>p.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}),30);
}

/* ---------- Reversal intelligence: read-only model over existing marketData ---------- */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const pf=v=>typeof window.priceFmt==='function'?window.priceFmt(v):Number(v||0).toPrecision(6).replace(/\.?0+$/,'');
function dataRows(){try{return typeof marketData!=='undefined'&&Array.isArray(marketData)?marketData:[]}catch(_){return[]}}
function getCoin(symbol){return dataRows().find(x=>x.symbol===symbol)||null;}

function reversalModel(x){
 const atr=Math.max(Number(x.atr)||0,Number(x.price||0)*0.002);
 const price=Number(x.price)||0,e20=Number(x.e20)||price,e50=Number(x.e50)||price,rsi=Number(x.rsi)||50,vr=Number(x.volumeRatio)||0,funding=Number(x.funding)||0,chg=Number(x.change)||0;
 const up15=e20>e50,down15=e20<e50,up1=!!x.h1Bull,down1=!!x.h1Bear;
 let trend=up15&&up1?'UP':down15&&down1?'DOWN':up15?'UP_WEAK':down15?'DOWN_WEAK':'MIXED';
 let side=trend.startsWith('UP')?'DOWN':trend.startsWith('DOWN')?'UP':'MIXED';
 let score=18,factors=[];
 const dist20=Math.abs(price-e20)/atr;
 const oppCandle=side==='DOWN'?!!x.candle?.bear:side==='UP'?!!x.candle?.bull:false;

 if(side==='DOWN'){
  if(rsi>=72){score+=23;factors.push(`RSI ${rsi.toFixed(1)} ≥ 72`)}else if(rsi>=65){score+=14;factors.push(`RSI ${rsi.toFixed(1)} ≥ 65`)}
  if(dist20>=1.35){score+=16;factors.push(`Price ${dist20.toFixed(1)} ATR above EMA20`)}else if(dist20>=0.75){score+=9;factors.push(`Price extended ${dist20.toFixed(1)} ATR`)}
  if(oppCandle){score+=18;factors.push(x.candle?.name||'Bearish reversal candle')}
  if(vr>=1.5){score+=oppCandle?15:7;factors.push(`Volume ${vr.toFixed(2)}×`)}
  if(funding>=0.03){score+=10;factors.push(`Crowded positive funding ${funding.toFixed(4)}%`)}
  if(chg>=4){score+=7;factors.push(`24h extension +${chg.toFixed(1)}%`)}
 }else if(side==='UP'){
  if(rsi<=28){score+=23;factors.push(`RSI ${rsi.toFixed(1)} ≤ 28`)}else if(rsi<=35){score+=14;factors.push(`RSI ${rsi.toFixed(1)} ≤ 35`)}
  if(dist20>=1.35){score+=16;factors.push(`Price ${dist20.toFixed(1)} ATR below EMA20`)}else if(dist20>=0.75){score+=9;factors.push(`Price extended ${dist20.toFixed(1)} ATR`)}
  if(oppCandle){score+=18;factors.push(x.candle?.name||'Bullish reversal candle')}
  if(vr>=1.5){score+=oppCandle?15:7;factors.push(`Volume ${vr.toFixed(2)}×`)}
  if(funding<=-0.02){score+=10;factors.push(`Crowded negative funding ${funding.toFixed(4)}%`)}
  if(chg<=-4){score+=7;factors.push(`24h extension ${chg.toFixed(1)}%`)}
 }else{
  score=35+(vr>=1.5?8:0)+(rsi>=68||rsi<=32?10:0);
  factors.push('15m / 1H structure is mixed');
 }
 if(trend.endsWith('_WEAK'))score+=6;
 score=clamp(Math.round(score),20,94);

 let timing=t('notReliable'),grade=t('revLow');
 if(score>=80){timing=t('mins1545');grade=t('revVery')}
 else if(score>=65){timing=t('mins3090');grade=t('revNear')}
 else if(score>=50){timing=t('hours13');grade=t('revWatch')}

 const trigger=side==='DOWN'
  ?(lang()==='ar'?`إغلاق 15د تحت EMA20 ($${pf(e20)}) + شمعة هابطة وحجم ≥ 1.3×`:lang()==='ru'?`Закрытие 15м ниже EMA20 ($${pf(e20)}) + медвежья свеча и объём ≥ 1.3×`:`15m close below EMA20 ($${pf(e20)}) + bearish candle + volume ≥ 1.3×`)
  :side==='UP'
  ?(lang()==='ar'?`إغلاق 15د فوق EMA20 ($${pf(e20)}) + شمعة صاعدة وحجم ≥ 1.3×`:lang()==='ru'?`Закрытие 15м выше EMA20 ($${pf(e20)}) + бычья свеча и объём ≥ 1.3×`:`15m close above EMA20 ($${pf(e20)}) + bullish candle + volume ≥ 1.3×`)
  :t('revNo');

 const z1=side==='DOWN'?price:side==='UP'?Math.max(0,price-atr*.8):Math.min(e20,e50);
 const z2=side==='DOWN'?price+atr*.8:side==='UP'?price:Math.max(e20,e50);
 const zone=`$${pf(Math.min(z1,z2))} – $${pf(Math.max(z1,z2))}`;
 return{trend,side,score,timing,grade,trigger,zone,factors,atr,e20,e50};
}

function ensureReversal(){
 const chart=document.getElementById('chartPanel');if(!chart)return null;
 let p=document.getElementById('dr-reversal');
 if(!p){p=document.createElement('section');p.id='dr-reversal';p.className='dr-reversal';const anchor=document.getElementById('forecastPro');(anchor||chart.querySelector('.chart-analysis'))?.insertAdjacentElement('afterend',p)}
 return p;
}
function trendText(m){return m.trend.startsWith('UP')?t('up'):m.trend.startsWith('DOWN')?t('down'):t('mixed');}
function oppText(m){return m.side==='UP'?t('toUp'):m.side==='DOWN'?t('toDown'):'—';}
function renderReversal(symbol){
 const x=getCoin(symbol);const p=ensureReversal();if(!x||!p)return;
 const m=reversalModel(x),cls=m.score>=80?'red':m.score>=65?'yellow':m.score>=50?'blue':'';
 const factorText=m.factors.length?m.factors.slice(0,5).join(' • '):t('revNo');
 p.innerHTML=`<div class="dr-rev-head"><div><h3>${t('revTitle')}</h3><div class="small">${t('revSub')}</div></div><span class="dr-rev-grade ${cls}">${m.grade}</span></div><div class="dr-rev-grid">${card(t('revTrend'),trendText(m),m.trend.startsWith('UP')?'green':m.trend.startsWith('DOWN')?'red':'yellow')}${card(t('revOpp'),oppText(m),m.side==='UP'?'green':m.side==='DOWN'?'red':'yellow')}${card(t('revNow'),m.score+'%',cls)}${card(t('revTime'),m.timing,'yellow')}${card(t('revZone'),m.zone,'blue')}<div class="signal-stat dr-rev-trigger"><div class="label">${t('revTrigger')}</div><div class="value">${m.trigger}</div></div></div><div class="dr-rev-factors"><b>${t('revFactors')}</b><span>${factorText}</span></div><div class="forecast-warning">${t('revDisclaimer')}</div>`;
 window.DeepRiseReversal.last={symbol,model:m,at:Date.now()};
}

function bestSymbol(){
 const d=dataRows();
 const actionable=d.filter(x=>x.direction!=='WAIT').sort((a,b)=>(b.score||0)-(a.score||0));
 let current='';try{current=typeof chartSymbol!=='undefined'?chartSymbol:''}catch(_){}
 return current&&getCoin(current)?current:(actionable[0]||d[0])?.symbol;
}
function openReversal(){
 const symbol=bestSymbol();if(!symbol)return;
 if(typeof window.openChart==='function')window.openChart(symbol);
 setTimeout(()=>renderReversal(symbol),0);
}

function wire(){
 const fn=e=>{e?.preventDefault?.();document.querySelector('.dr-quick-sheet')?.classList.remove('active');document.getElementById('dropdown')?.classList.remove('active');open(30)};
 const hub=document.querySelector('[data-v13="perf"]');
 if(hub&&!hub.dataset.verifiedPerformance){hub.dataset.verifiedPerformance='1';hub.textContent=t('title');hub.onclick=fn}
 const menu=document.querySelector('[data-v13-menu="perf"]');
 if(menu&&!menu.dataset.verifiedPerformance){menu.dataset.verifiedPerformance='1';menu.textContent=t('title');menu.onclick=fn}
 const dd=document.getElementById('dropdown');
 if(!hub&&!menu&&dd&&!dd.querySelector('[data-dr-performance-btn]')){let b=document.createElement('button');b.dataset.drPerformanceBtn='1';b.textContent=t('title');b.onclick=fn;dd.appendChild(b)}
 if(dd&&!dd.querySelector('[data-dr-reversal-btn]')){let b=document.createElement('button');b.dataset.drReversalBtn='1';b.textContent=t('revTitle');b.onclick=e=>{e.preventDefault();dd.classList.remove('active');openReversal()};dd.appendChild(b)}
 const rb=dd?.querySelector('[data-dr-reversal-btn]');if(rb&&rb.textContent!==t('revTitle'))rb.textContent=t('revTitle');
 const pb=dd?.querySelector('[data-dr-performance-btn]');if(pb&&pb.textContent!==t('title'))pb.textContent=t('title');
 if(hub&&hub.textContent!==t('title'))hub.textContent=t('title');if(menu&&menu.textContent!==t('title'))menu.textContent=t('title');
}

/* Hook chart opening without altering the engine or its analytics. */
const originalOpenChart=window.openChart;
if(typeof originalOpenChart==='function'&&!originalOpenChart.__drReversalWrapped){
 const wrapped=function(symbol){const out=originalOpenChart.apply(this,arguments);queueMicrotask(()=>renderReversal(symbol));return out;};
 wrapped.__drReversalWrapped=true;window.openChart=wrapped;
}

window.DeepRisePerformance={open,stats};
window.DeepRiseReversal={open:openReversal,analyse:reversalModel,render:renderReversal,last:null};

/* Performance: event-driven wiring instead of a permanent 1-second polling loop. */
let wireQueued=false;
const scheduleWire=()=>{if(wireQueued)return;wireQueued=true;(window.requestAnimationFrame||setTimeout)(()=>{wireQueued=false;wire()},16)};
const mo=new MutationObserver(scheduleWire);
mo.observe(document.body,{childList:true,subtree:true});
setTimeout(wire,0);
document.getElementById('languageSelect')?.addEventListener('change',()=>{wire();const s=bestSymbol();if(document.getElementById('chartPanel')?.classList.contains('active')&&s)renderReversal(s)});

let s=document.createElement('style');
s.textContent=`
.dr-periods{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}.dr-periods button{background:#0c2032;color:#cde9ff;border:1px solid #24465f;border-radius:8px;padding:8px 12px;font-weight:800}
.dr-insufficient{padding:10px 12px;margin:8px 0;border:1px solid #755b1e;background:#2b230c;color:#ffd166;border-radius:9px;font-size:12px}
.dr-breakdown{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}.dr-breakdown>div{background:#081725;border:1px solid #17354c;border-radius:10px;padding:10px}.dr-breakdown b,.dr-breakdown span{display:block}.dr-breakdown span{font-size:11px;color:#9db6ca;margin-top:5px;line-height:1.5}
.dr-performance-proof{padding:10px 12px;border:1px solid #1d6e58;background:#09271f;color:#cffff0;border-radius:9px;font-size:11px;line-height:1.6}
.dr-reversal{padding:14px 15px;border-bottom:1px solid var(--border);background:#07131f}.dr-rev-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}.dr-rev-head h3{margin:0 0 4px;color:var(--purple);font-size:15px}.dr-rev-grade{white-space:nowrap;background:#102236;border:1px solid var(--border);padding:7px 9px;border-radius:999px;font-size:11px;font-weight:800}
.dr-rev-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.dr-rev-trigger{grid-column:span 2}.dr-rev-trigger .value{font-size:11px;line-height:1.55}
.dr-rev-factors{margin-top:9px;padding:10px;border-radius:9px;background:var(--panel2);border:1px solid var(--border)}.dr-rev-factors b,.dr-rev-factors span{display:block}.dr-rev-factors b{font-size:10px;color:var(--purple);margin-bottom:5px}.dr-rev-factors span{font-size:11px;color:#9db2c4;line-height:1.55}
.card,.pick{content-visibility:auto;contain-intrinsic-size:260px}.signal-results-panel{content-visibility:auto;contain-intrinsic-size:320px}
@media(max-width:700px){.dr-rev-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dr-rev-trigger{grid-column:1/-1}.dr-breakdown{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto!important}}
`;
document.head.appendChild(s);
})();