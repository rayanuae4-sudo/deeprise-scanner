/* DeepRise V17.1 — simplified radar UX + click-to-enter bridge.
 * UI-only: all signal validation, entry levels, monitoring and alerts remain
 * owned by the existing DeepRise analysis and trade-monitor modules.
 */
(()=>{'use strict';
const TRADE_STORE='deeprise_active_trades_v14';
const copy={
  ar:{radar:'الرادار المبسط',hint:'اضغط اسم العملة للدخول أو افتح التفاصيل عند الحاجة',scan:'فحص الآن',active:'صفقات مثبتة',details:'التفاصيل',hide:'إخفاء التفاصيل',chart:'الشارت',entry:'الدخول',stop:'الوقف',tp1:'الهدف 1',tp2:'الهدف 2',score:'السكور',side:'الاتجاه',liquidity:'سيولة 24س',enter:'تثبيت ومتابعة',analyze:'حلّل ثم ادخل',showPinned:'عرض الصفقة المثبتة',close:'إغلاق',wait:'الإشارة غير مؤكدة؛ سيعيد DeepRise تحليلها ولن يثبتها إلا إذا أصبحت LONG أو SHORT.',ready:'سيستخدم DeepRise سعر الدخول والوقف والأهداف الحالية ثم يثبت الصفقة تلقائيًا.',tracking:'هذه العملة مثبتة وتحت المراقبة المكثفة.',empty:'نفّذ الفحص أولًا لعرض بيانات الدخول.',local:'التثبيت للمتابعة داخل DeepRise ولا يرسل أمرًا إلى منصة التداول.'},
  en:{radar:'Simplified Radar',hint:'Tap a coin name to enter, or expand details when needed',scan:'Scan now',active:'Pinned trades',details:'Details',hide:'Hide details',chart:'Chart',entry:'Entry',stop:'Stop',tp1:'TP1',tp2:'TP2',score:'Score',side:'Side',liquidity:'24h liquidity',enter:'Pin & monitor',analyze:'Analyze & enter',showPinned:'Show pinned trade',close:'Close',wait:'The signal is not confirmed. DeepRise will re-analyze it and only pin a confirmed LONG or SHORT.',ready:'DeepRise will use the current entry, stop and targets, then pin the trade automatically.',tracking:'This coin is pinned and under intensive monitoring.',empty:'Run the scan first to load entry data.',local:'Pinning tracks the trade inside DeepRise; it does not place an exchange order.'},
  ru:{radar:'Упрощённый радар',hint:'Нажмите название монеты для входа или откройте детали',scan:'Сканировать',active:'Закреплённые сделки',details:'Подробнее',hide:'Скрыть',chart:'График',entry:'Вход',stop:'Стоп',tp1:'TP1',tp2:'TP2',score:'Оценка',side:'Сторона',liquidity:'Ликвидность 24ч',enter:'Закрепить',analyze:'Анализ + вход',showPinned:'Показать сделку',close:'Закрыть',wait:'Сигнал не подтверждён. DeepRise повторит анализ и закрепит только LONG или SHORT.',ready:'DeepRise использует текущие вход, стоп и цели и автоматически закрепит сделку.',tracking:'Монета закреплена и отслеживается.',empty:'Сначала запустите сканирование.',local:'Закрепление отслеживает сделку в DeepRise и не отправляет ордер на биржу.'}
};
const lang=()=>localStorage.getItem('deeprise_language')||document.documentElement.lang||'en';
const t=k=>(copy[lang()]||copy.en)[k]||k;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pf=n=>{n=Number(n)||0;if(n>=1000)return n.toFixed(2);if(n>=1)return n.toFixed(4);if(n>=.01)return n.toFixed(5);return n.toFixed(8)};
const compact=n=>{n=Number(n)||0;if(n>=1e9)return(n/1e9).toFixed(2)+'B';if(n>=1e6)return(n/1e6).toFixed(2)+'M';if(n>=1e3)return(n/1e3).toFixed(2)+'K';return n.toFixed(0)};
function trades(){try{return JSON.parse(localStorage.getItem(TRADE_STORE)||'{}')||{}}catch(e){return{}}}
function analysis(symbol){
  try{const x=window.DeepRiseBinanceUniverse?.state?.analyzed?.get?.(symbol);if(x)return x}catch(e){}
  try{if(typeof marketData!=='undefined'&&Array.isArray(marketData))return marketData.find(x=>x.symbol===symbol)||null}catch(e){}
  return null;
}
function cardSymbol(card){
  let s=(card?.dataset?.drSymbol||card?.dataset?.symbol||'').toUpperCase();
  if(s)return s;
  const base=(card?.querySelector('.sym')?.textContent||'').split('/')[0].replace(/[^A-Z0-9]/gi,'').toUpperCase();
  return base?base+'USDT':'';
}
function activeCount(){return Object.keys(trades()).length}
function updateDock(){
  const n=activeCount(),out=document.querySelector('[data-radar-active-count]');
  if(out&&out.textContent!==String(n))out.textContent=n;
  syncPinnedPosition();
}
function syncPinnedPosition(){
  const panel=document.getElementById('dr-active-trades-panel'),hero=document.querySelector('.hero');
  if(panel&&hero&&panel.nextElementSibling!==hero)hero.parentNode.insertBefore(panel,hero);
}
function makeDock(){
  if(document.getElementById('dr-radar-dock'))return;
  const filters=document.querySelector('.filters');if(!filters)return;
  const dock=document.createElement('section');dock.id='dr-radar-dock';dock.className='dr-radar-dock';
  dock.innerHTML=`<div class="dr-radar-title"><span class="dr-radar-dot"></span><div><b>${t('radar')}</b><small>${t('hint')}</small></div></div><div class="dr-radar-shortcuts"><button type="button" data-radar-scan>⚡ ${t('scan')}</button><button type="button" data-radar-pinned>📌 ${t('active')} <strong data-radar-active-count>0</strong></button></div>`;
  filters.after(dock);
  dock.querySelector('[data-radar-scan]').onclick=()=>document.querySelector('.controls button')?.click();
  dock.querySelector('[data-radar-pinned]').onclick=()=>{const p=document.getElementById('dr-active-trades-panel');if(p)p.scrollIntoView({behavior:'smooth',block:'start'});else document.querySelector('.hero')?.scrollIntoView({behavior:'smooth',block:'start'})};
  updateDock();
}
function annotate(){
  document.querySelectorAll('#results .card,#top3 .pick').forEach(card=>{
    const symbol=cardSymbol(card);if(!symbol)return;
    card.dataset.drSymbol=symbol;
    if(card.querySelector('.dr-compact-actions'))return;
    const actions=document.createElement('div');actions.className='dr-compact-actions';
    actions.innerHTML=`<button type="button" data-radar-details aria-expanded="false">☰ ${t('details')}</button><button type="button" data-radar-chart="${esc(symbol)}">📈 ${t('chart')}</button>`;
    const head=card.querySelector('.coin-head')||card.firstElementChild;
    head?.insertAdjacentElement('afterend',actions);
  });
}
function sheet(){
  let root=document.getElementById('dr-entry-sheet');if(root)return root;
  root=document.createElement('div');root.id='dr-entry-sheet';root.className='dr-entry-sheet';root.setAttribute('aria-hidden','true');
  root.innerHTML='<button class="dr-sheet-backdrop" type="button" data-sheet-close aria-label="Close"></button><section class="dr-sheet-card" role="dialog" aria-modal="true"><div data-sheet-body></div></section>';
  document.body.appendChild(root);
  root.querySelector('[data-sheet-close]').onclick=closeSheet;
  return root;
}
function closeSheet(){const root=document.getElementById('dr-entry-sheet');if(!root)return;root.classList.remove('active');root.setAttribute('aria-hidden','true')}
function showChart(symbol){
  try{if(typeof window.DeepRiseOpenCoin==='function')window.DeepRiseOpenCoin(symbol);else if(typeof openChart==='function')openChart(symbol)}catch(e){}
}
function openSheet(symbol){
  const root=sheet(),body=root.querySelector('[data-sheet-body]'),a=analysis(symbol),tr=trades()[symbol],base=symbol.replace(/USDT$/,'');
  const side=tr?.side||a?.direction||'WAIT',active=!!tr,ready=['LONG','SHORT'].includes(side);
  const entry=tr?.entry||a?.price||a?.entry||0,sl=tr?.sl||a?.sl||0,tp1=tr?.tp1||a?.tp1||0,tp2=tr?.tp2||a?.tp2||0,score=a?.score??tr?.score??'—';
  const note=active?t('tracking'):(ready?t('ready'):a?t('wait'):t('empty'));
  const primary=active?t('showPinned'):(ready?t('enter'):t('analyze'));
  body.innerHTML=`<div class="dr-sheet-head"><div><small>${t('radar')}</small><h3>${esc(base)}/USDT</h3></div><button type="button" data-sheet-close>✕</button></div><div class="dr-entry-badges"><span class="${side==='LONG'?'long':side==='SHORT'?'short':'wait'}">${esc(side)}</span><span>${t('score')} ${esc(score)}</span>${a?.quoteVolume?`<span>${t('liquidity')} $${compact(a.quoteVolume)}</span>`:''}</div><div class="dr-entry-levels"><div><small>${t('entry')}</small><b>$${pf(entry)}</b></div><div><small>${t('stop')}</small><b>$${pf(sl)}</b></div><div><small>${t('tp1')}</small><b>$${pf(tp1)}</b></div><div><small>${t('tp2')}</small><b>$${pf(tp2)}</b></div></div><p class="dr-entry-note">${esc(note)}</p><div class="dr-sheet-actions"><button type="button" class="primary" data-sheet-enter="${esc(symbol)}">${active?'📌':'✓'} ${primary}</button><button type="button" data-sheet-chart="${esc(symbol)}">📈 ${t('chart')}</button></div><p class="dr-local-note">${t('local')}</p>`;
  body.querySelector('[data-sheet-close]').onclick=closeSheet;
  body.querySelector('[data-sheet-chart]').onclick=()=>{closeSheet();showChart(symbol)};
  body.querySelector('[data-sheet-enter]').onclick=()=>active?showPinned():invokeEntry(symbol);
  root.classList.add('active');root.setAttribute('aria-hidden','false');
}
function showPinned(){closeSheet();const p=document.getElementById('dr-active-trades-panel');if(p){syncPinnedPosition();p.scrollIntoView({behavior:'smooth',block:'start'})}}
function invokeEntry(symbol){
  closeSheet();
  let card=[...document.querySelectorAll('#results .card,#top3 .pick')].find(x=>cardSymbol(x)===symbol);
  if(!card)return;
  let btn=card.querySelector('.dr-enter-trade');
  if(!btn){btn=document.createElement('button');btn.type='button';btn.className='dr-enter-trade';btn.dataset.tradeSymbol=symbol;btn.hidden=true;card.appendChild(btn)}
  btn.click();
  setTimeout(()=>{updateDock();syncPinnedPosition();const p=document.getElementById('dr-active-trades-panel');if(p)p.scrollIntoView({behavior:'smooth',block:'start'})},500);
}
document.addEventListener('click',e=>{
  const details=e.target.closest('[data-radar-details]');
  if(details){e.preventDefault();e.stopImmediatePropagation();const card=details.closest('.card,.pick'),on=card.classList.toggle('dr-expanded');details.setAttribute('aria-expanded',String(on));details.textContent=(on?'− '+t('hide'):'☰ '+t('details'));return}
  const chart=e.target.closest('[data-radar-chart]');
  if(chart){e.preventDefault();e.stopImmediatePropagation();showChart(chart.dataset.radarChart);return}
  const card=e.target.closest('#results .card,#top3 .pick');
  if(card&&!e.target.closest('button,input,select,textarea,a,[data-stop-trade],[data-trade-open],.dr-enter-trade')){
    const symbol=cardSymbol(card);if(symbol){e.preventDefault();e.stopImmediatePropagation();openSheet(symbol)}
  }
},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet()});
const css=document.createElement('style');css.id='dr-radar-ui-v171-css';css.textContent=`
.dr-radar-dock{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0 13px;padding:11px 12px;background:linear-gradient(135deg,#081b2a,#0b2130);border:1px solid #1c4659;border-radius:14px;box-shadow:0 10px 28px #0003}.dr-radar-title{display:flex;align-items:center;gap:9px;min-width:0}.dr-radar-title b{display:block;color:#edf8ff;font-size:13px}.dr-radar-title small{display:block;color:#7290a6;font-size:9px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dr-radar-dot{width:10px;height:10px;border-radius:50%;background:#35e0a1;box-shadow:0 0 14px #35e0a1;flex:none}.dr-radar-shortcuts{display:flex;gap:7px}.dr-radar-shortcuts button,.dr-compact-actions button{background:#102b3a;color:#cfe8f5;border:1px solid #245068;box-shadow:none;padding:8px 10px}.dr-radar-shortcuts strong{display:inline-grid;place-items:center;min-width:20px;height:20px;margin-inline-start:4px;background:#35e0a1;color:#042017;border-radius:20px}.dr-compact-actions{display:flex;gap:7px;margin:8px 0 10px}.dr-compact-actions button{flex:1;font-size:10px}.card:not(.dr-expanded)>.data,.card:not(.dr-expanded)>.early,.card:not(.dr-expanded)>.confirm{display:none!important}.card:not(.dr-expanded)>.decision{margin-top:8px}.card:not(.dr-expanded)>.decision .small{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px 12px}.card:not(.dr-expanded)>.dr-v13-quality .dr-v13-checks{display:none}.dr-enter-trade{min-height:42px;font-size:12px!important;font-weight:900!important}.dr-active-trades-panel{scroll-margin-top:84px;border-width:2px!important;box-shadow:0 12px 30px #0005,0 0 0 1px #35e0a11f!important}.dr-entry-sheet{position:fixed;inset:0;z-index:100800;display:none;align-items:flex-end;justify-content:center}.dr-entry-sheet.active{display:flex}.dr-sheet-backdrop{position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:0;background:#010811c9;backdrop-filter:blur(5px)}.dr-sheet-card{position:relative;width:min(560px,100%);max-height:88vh;overflow:auto;background:#071827;border:1px solid #28566d;border-radius:22px 22px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom,0px));box-shadow:0 -18px 50px #000a;animation:drSheetIn .18s ease-out}.dr-sheet-head{display:flex;align-items:flex-start;justify-content:space-between}.dr-sheet-head small{color:#6f92aa}.dr-sheet-head h3{font-size:24px;margin:3px 0 0;color:#f1f8ff}.dr-sheet-head button{background:#12293a;color:#bcd1df;border:1px solid #24465a;padding:7px 10px}.dr-entry-badges{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0}.dr-entry-badges span{padding:6px 9px;border-radius:20px;background:#102333;border:1px solid #1c4055;color:#9eb9ca;font-size:10px;font-weight:800}.dr-entry-badges .long{color:#62eebc;border-color:#257558;background:#0d2a23}.dr-entry-badges .short{color:#ff8995;border-color:#71323c;background:#301821}.dr-entry-badges .wait{color:#ffe092;border-color:#705d22;background:#302810}.dr-entry-levels{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.dr-entry-levels>div{background:#06121e;border:1px solid #17354a;border-radius:12px;padding:10px}.dr-entry-levels small{display:block;color:#6e8aa1;font-size:9px}.dr-entry-levels b{display:block;color:#e7f4ff;margin-top:4px;font-size:14px}.dr-entry-note{color:#a9c0cf;font-size:11px;line-height:1.65;background:#0a2030;border-inline-start:3px solid #65b8ff;padding:9px 11px;border-radius:8px}.dr-sheet-actions{display:grid;grid-template-columns:1.6fr 1fr;gap:8px}.dr-sheet-actions button{min-height:44px;background:#102b3a;color:#cae6f4;border:1px solid #245068}.dr-sheet-actions .primary{background:linear-gradient(135deg,#087765,#0b596c);border-color:#52e8c6;color:white;font-weight:900}.dr-local-note{font-size:9px;color:#617f94;text-align:center;margin:10px 0 0}@keyframes drSheetIn{from{transform:translateY(28px);opacity:.5}to{transform:none;opacity:1}}
@media(max-width:720px){.dr-radar-dock{position:sticky;top:calc(60px + env(safe-area-inset-top,0px));z-index:55;padding:9px}.dr-radar-title small{max-width:145px}.dr-radar-shortcuts button{font-size:0;padding:8px}.dr-radar-shortcuts button:first-child::first-letter{font-size:14px}.dr-radar-shortcuts button:last-child{font-size:0}.dr-radar-shortcuts strong{font-size:10px}.dr-v13-hub{padding:6px!important;margin:6px 0 9px!important}.dr-v13-hub button{padding:7px 8px!important;font-size:10px!important}.card{padding:12px!important}.card .data{grid-template-columns:repeat(2,1fr)!important}.dr-sheet-card{padding-inline:14px}}
`;
document.head.appendChild(css);
function boot(){
  makeDock();annotate();syncPinnedPosition();updateDock();
  const observer=new MutationObserver(()=>{annotate();updateDock()});
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('storage',e=>{if(e.key===TRADE_STORE)updateDock()});
  setInterval(updateDock,3000);
}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
