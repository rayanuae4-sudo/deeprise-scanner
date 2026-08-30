/* DeepRise V14.2 — intensive entered-trade monitor + mobile scroll stability */
(()=>{'use strict';
const STORE='deeprise_active_trades_v14';
const DEEP_MS=20000;
const ALERT_COOLDOWN=10*60*1000;
const state={trades:{},socket:null,deepBusy:false,lastDeep:0,lastUi:0,injectQueued:false,anchor:null,userActionAt:0,restoreQueued:false};
const lang=()=>localStorage.getItem('deeprise_language')||'en';
const copy={
 en:{enter:'ENTER TRADE',active:'ACTIVE MONITORING',analyze:'ANALYZE & ENTER',noEntry:'No confirmed LONG/SHORT entry yet.',entered:'Trade entered — intensive monitoring is active.',stopped:'Trade monitoring stopped.',title:'🎯 Active Trade Monitor',live:'LIVE PRICE',deep:'20s DEEP ANALYSIS',entry:'Entry',stop:'Stop',tp1:'TP1',tp2:'TP2',score:'Score',remove:'Stop monitoring',note:'Live price alerts run while the app is active. Browser notifications depend on device permission.',perm:'Enable notifications for reversal alerts.',rev:'Reversal warning',flip:'Direction reversal',weak:'Setup weakening',sl:'Stop level reached',t1:'TP1 reached',t2:'TP2 reached',side:'Side'},
 ar:{enter:'دخول الصفقة',active:'مراقبة مكثفة نشطة',analyze:'حلّل ثم ادخل',noEntry:'لا توجد إشارة دخول LONG/SHORT مؤكدة الآن.',entered:'تم تسجيل دخول الصفقة وتفعيل المراقبة المكثفة.',stopped:'تم إيقاف مراقبة الصفقة.',title:'🎯 مراقبة الصفقات النشطة',live:'السعر اللحظي',deep:'تحليل عميق كل 20ث',entry:'الدخول',stop:'الوقف',tp1:'الهدف 1',tp2:'الهدف 2',score:'السكور',remove:'إيقاف المراقبة',note:'تنبيهات السعر اللحظية تعمل أثناء نشاط التطبيق. إشعارات الجهاز تعتمد على سماح المتصفح.',perm:'فعّل الإشعارات لتنبيهات الانعكاس.',rev:'تحذير انعكاس',flip:'انعكاس الاتجاه',weak:'ضعف الصفقة',sl:'وصل السعر إلى الوقف',t1:'تحقق الهدف الأول',t2:'تحقق الهدف الثاني',side:'الاتجاه'},
 ru:{enter:'ВОЙТИ В СДЕЛКУ',active:'УСИЛЕННЫЙ МОНИТОРИНГ',analyze:'АНАЛИЗ + ВХОД',noEntry:'Подтверждённого LONG/SHORT входа пока нет.',entered:'Сделка сохранена — усиленный мониторинг включён.',stopped:'Мониторинг сделки остановлен.',title:'🎯 Активные сделки',live:'LIVE ЦЕНА',deep:'ГЛУБОКИЙ АНАЛИЗ 20с',entry:'Вход',stop:'Стоп',tp1:'TP1',tp2:'TP2',score:'Score',remove:'Остановить мониторинг',note:'Live-оповещения работают пока приложение активно. Системные уведомления зависят от разрешения устройства.',perm:'Разрешите уведомления для сигналов разворота.',rev:'Риск разворота',flip:'Разворот направления',weak:'Ослабление сетапа',sl:'Достигнут стоп',t1:'Достигнут TP1',t2:'Достигнут TP2',side:'Сторона'}};
const t=k=>(copy[lang()]||copy.en)[k]||k;
const pf=n=>{n=Number(n)||0;if(n>=1000)return n.toFixed(2);if(n>=1)return n.toFixed(4);if(n>=.01)return n.toFixed(5);return n.toFixed(8)};
function load(){try{state.trades=JSON.parse(localStorage.getItem(STORE)||'{}')||{}}catch(e){state.trades={}}}
function save(){try{localStorage.setItem(STORE,JSON.stringify(state.trades))}catch(e){}}
function toast(msg,kind='green'){
 let x=document.getElementById('dr-trade-toast');if(!x){x=document.createElement('div');x.id='dr-trade-toast';document.body.appendChild(x)}
 x.className='dr-trade-toast '+kind;x.textContent=msg;x.classList.add('show');clearTimeout(x._tm);x._tm=setTimeout(()=>x.classList.remove('show'),3600)
}
function askNotifications(){try{if('Notification' in window&&Notification.permission==='default')Notification.requestPermission().catch(()=>{})}catch(e){}}
function notify(title,body,kind='yellow'){
 toast(title+' — '+body,kind);
 try{if('Notification' in window&&Notification.permission==='granted')new Notification('DeepRise • '+title,{body,icon:'icon.svg',tag:'deeprise-'+title,renotify:true})}catch(e){}
 try{navigator.vibrate?.([120,80,120])}catch(e){}
}
function fire(tr,key,title,body,kind='yellow',cooldown=ALERT_COOLDOWN){
 tr.alerts=tr.alerts||{};const now=Date.now(),last=tr.alerts[key]||0;if(last&&now-last<cooldown)return false;tr.alerts[key]=now;save();notify(title,body,kind);return true
}
function analysisFor(symbol){try{return window.DeepRiseBinanceUniverse?.state?.analyzed?.get(symbol)||((typeof marketData!=='undefined'&&Array.isArray(marketData))?marketData.find(x=>x.symbol===symbol):null)}catch(e){return null}}
function symbolFrom(el){
 const host=el.closest('[data-symbol],[data-dr-symbol],.card,.pick');if(!host)return'';let s=host.dataset.symbol||host.dataset.drSymbol||'';
 if(!s){const txt=host.querySelector('.sym')?.textContent||'';const base=txt.split('/')[0].trim().replace(/[^A-Z0-9]/gi,'').toUpperCase();if(base)s=base+'USDT'}
 return s.toUpperCase()
}
function annotateCards(){
 document.querySelectorAll('#results .card,.top-grid .pick').forEach(card=>{let s=card.dataset.symbol||card.dataset.drSymbol;if(!s){const txt=card.querySelector('.sym')?.textContent||'';const base=txt.split('/')[0].trim().replace(/[^A-Z0-9]/gi,'').toUpperCase();if(base)s=base+'USDT'}if(!s)return;card.dataset.drSymbol=s;
  let btn=card.querySelector('.dr-enter-trade');const a=analysisFor(s),active=!!state.trades[s];
  if(!btn){btn=document.createElement('button');btn.className='dr-enter-trade';btn.dataset.tradeSymbol=s;card.appendChild(btn)}
  btn.classList.toggle('active',active);btn.textContent=active?'✓ '+t('active'):(a?(a.direction==='WAIT'?t('analyze'):t('enter')):t('analyze'));
 })
}
function queueInject(){if(state.injectQueued)return;state.injectQueued=true;requestAnimationFrame(()=>{state.injectQueued=false;annotateCards();renderPanel()})}
function tradeBody(tr,price){const move=tr.side==='SHORT'?(tr.entry-price)/tr.entry*100:(price-tr.entry)/tr.entry*100;return `${tr.symbol.replace('USDT','')}/USDT • ${tr.side} • $${pf(price)} • ${move>=0?'+':''}${move.toFixed(2)}%`}
function renderPanel(){
 const entries=Object.values(state.trades);let p=document.getElementById('dr-active-trades-panel');
 if(!entries.length){p?.remove();return}
 if(!p){p=document.createElement('section');p.id='dr-active-trades-panel';p.className='dr-active-trades-panel';const hero=document.querySelector('.hero');hero?.parentNode?.insertBefore(p,hero)}
 p.innerHTML=`<div class="dr-trade-head"><div><b>${t('title')}</b><small>${t('live')} • ${t('deep')}</small></div><span class="dr-trade-pulse">● LIVE</span></div><div class="dr-trade-grid">${entries.map(tr=>{const a=analysisFor(tr.symbol),price=tr.livePrice||a?.price||tr.entry,move=tr.side==='SHORT'?(tr.entry-price)/tr.entry*100:(price-tr.entry)/tr.entry*100,score=a?.score??tr.lastScore??tr.score;return `<article class="dr-active-trade" data-active-symbol="${tr.symbol}"><div class="dr-active-top"><button class="dr-trade-open" data-trade-open="${tr.symbol}"><b>${tr.symbol.replace('USDT','')}/USDT</b><span class="${tr.side==='LONG'?'green':'red'}">${tr.side}</span></button><span class="${move>=0?'green':'red'}">${move>=0?'+':''}${move.toFixed(2)}%</span></div><div class="dr-active-price">$${pf(price)}</div><div class="dr-trade-levels"><span>${t('entry')} <b>$${pf(tr.entry)}</b></span><span>${t('score')} <b>${score??'—'}</b></span><span>${t('stop')} <b>$${pf(tr.sl)}</b></span><span>${t('tp1')} <b>$${pf(tr.tp1)}</b></span><span>${t('tp2')} <b>$${pf(tr.tp2)}</b></span></div><button class="dr-stop-monitor" data-stop-trade="${tr.symbol}">${t('remove')}</button></article>`}).join('')}</div><div class="dr-trade-note">${t('note')}</div>`
}
async function enterTrade(symbol){
 askNotifications();
 if(state.trades[symbol]){if(confirm(t('remove')+'?'))stopTrade(symbol);return}
 let a=analysisFor(symbol);try{a=await window.DeepRiseBinanceUniverse?.analyze?.(symbol,true)||a}catch(e){}
 if(!a||!['LONG','SHORT'].includes(a.direction)){toast(t('noEntry'),'yellow');queueInject();return}
 state.trades[symbol]={symbol,side:a.direction,entry:+a.price,created:Date.now(),score:+a.score||0,lastScore:+a.score||0,sl:+a.sl,tp1:+a.tp1,tp2:+a.tp2,livePrice:+a.price,alerts:{},lastDirection:a.direction,status:'ACTIVE'};save();toast(t('entered'),'green');restartSocket();renderPanel();queueInject();deepCheckOne(symbol,true)
}
function stopTrade(symbol){delete state.trades[symbol];save();restartSocket();renderPanel();queueInject();toast(t('stopped'),'yellow')}
function priceCheck(symbol,price){const tr=state.trades[symbol];if(!tr)return;tr.livePrice=price;
 if(tr.side==='LONG'){
  if(price<=tr.sl)fire(tr,'stop',t('sl'),tradeBody(tr,price),'red',365*24*3600*1000);
  if(price>=tr.tp1)fire(tr,'tp1',t('t1'),tradeBody(tr,price),'green',365*24*3600*1000);
  if(price>=tr.tp2)fire(tr,'tp2',t('t2'),tradeBody(tr,price),'green',365*24*3600*1000)
 }else{
  if(price>=tr.sl)fire(tr,'stop',t('sl'),tradeBody(tr,price),'red',365*24*3600*1000);
  if(price<=tr.tp1)fire(tr,'tp1',t('t1'),tradeBody(tr,price),'green',365*24*3600*1000);
  if(price<=tr.tp2)fire(tr,'tp2',t('t2'),tradeBody(tr,price),'green',365*24*3600*1000)
 }
 const now=Date.now();if(now-state.lastUi>650){state.lastUi=now;renderPanel()}
}
function restartSocket(){
 try{state.socket?.close()}catch(e){}state.socket=null;const syms=Object.keys(state.trades);if(!syms.length)return;
 const streams=syms.map(s=>s.toLowerCase()+'@trade').join('/');
 try{const ws=new WebSocket('wss://stream.binance.com:9443/stream?streams='+streams);state.socket=ws;ws.onmessage=e=>{try{const d=JSON.parse(e.data),x=d.data||d,s=(x.s||'').toUpperCase(),p=+x.p;if(s&&p)priceCheck(s,p)}catch(_){} };ws.onclose=()=>{if(state.socket===ws&&Object.keys(state.trades).length)setTimeout(restartSocket,2500)};ws.onerror=()=>{}}catch(e){}
}
function reversalReason(a,tr){
 if(!a)return null;
 if(tr.side==='LONG'){
  if(a.direction==='SHORT')return{key:'flip',title:t('flip'),body:`${a.base}/USDT: LONG → SHORT • ${t('score')} ${a.score}`,kind:'red'};
  if((a.candle?.bear&&a.h1Bear)||(a.e20<a.e50&&a.h1Bear))return{key:'reversal',title:t('rev'),body:`${a.base}/USDT • ${a.candle?.name||'bearish structure'} • RSI ${Number(a.rsi||0).toFixed(1)}`,kind:'red'}
 }else{
  if(a.direction==='LONG')return{key:'flip',title:t('flip'),body:`${a.base}/USDT: SHORT → LONG • ${t('score')} ${a.score}`,kind:'red'};
  if((a.candle?.bull&&a.h1Bull)||(a.e20>a.e50&&a.h1Bull))return{key:'reversal',title:t('rev'),body:`${a.base}/USDT • ${a.candle?.name||'bullish structure'} • RSI ${Number(a.rsi||0).toFixed(1)}`,kind:'red'}
 }
 if(Number(a.score)<62&&tr.lastScore>=70)return{key:'weak',title:t('weak'),body:`${a.base}/USDT • ${t('score')} ${tr.lastScore} → ${a.score}`,kind:'yellow'};
 return null
}
async function deepCheckOne(symbol,force=false){const tr=state.trades[symbol];if(!tr)return;let a=null;try{a=await window.DeepRiseBinanceUniverse?.analyze?.(symbol,true)}catch(e){}if(!a)return;const r=reversalReason(a,tr);if(r)fire(tr,r.key,r.title,r.body,r.kind,r.key==='flip'?5*60*1000:ALERT_COOLDOWN);tr.lastScore=+a.score||tr.lastScore;tr.lastDirection=a.direction;tr.sl=Number.isFinite(+a.sl)?+a.sl:tr.sl;tr.tp1=Number.isFinite(+a.tp1)?+a.tp1:tr.tp1;tr.tp2=Number.isFinite(+a.tp2)?+a.tp2:tr.tp2;save();renderPanel();queueInject()}
async function deepLoop(){if(state.deepBusy||document.hidden||!Object.keys(state.trades).length)return;state.deepBusy=true;try{for(const s of Object.keys(state.trades))await deepCheckOne(s)}finally{state.deepBusy=false;state.lastDeep=Date.now()}}
function markUser(){state.userActionAt=Date.now()}
function visibleAnchor(){
 if(scrollY<260)return null;const cards=[...document.querySelectorAll('#results [data-dr-symbol],#results [data-symbol]')];let best=null,bestD=1e9;for(const c of cards){const r=c.getBoundingClientRect();if(r.bottom<100||r.top>innerHeight)continue;const d=Math.abs(r.top-130);if(d<bestD){bestD=d;best={symbol:c.dataset.drSymbol||c.dataset.symbol,top:r.top}}}return best
}
function captureAnchor(){const a=visibleAnchor();if(a)state.anchor=a}
function restoreAnchor(){
 if(state.restoreQueued||Date.now()-state.userActionAt<850||!state.anchor)return;state.restoreQueued=true;requestAnimationFrame(()=>{state.restoreQueued=false;if(Date.now()-state.userActionAt<850)return;const el=document.querySelector(`#results [data-dr-symbol="${CSS.escape(state.anchor.symbol)}"],#results [data-symbol="${CSS.escape(state.anchor.symbol)}"]`);if(!el)return;const top=el.getBoundingClientRect().top,d=top-state.anchor.top;if(Math.abs(d)>2&&Math.abs(d)<1200)scrollBy(0,d);state.anchor={symbol:state.anchor.symbol,top:el.getBoundingClientRect().top}})
}
function installScrollGuard(){
 const original=Element.prototype.scrollIntoView;if(!original||original._drGuard)return;function guarded(arg){const recent=Date.now()-state.userActionAt<700;if(recent)return original.call(this,arg);if(this.id==='results'||this.closest?.('#results'))return;return original.call(this,arg)}guarded._drGuard=true;Element.prototype.scrollIntoView=guarded
}
function stability(){
 ['touchstart','touchmove','pointerdown','wheel','keydown','input'].forEach(ev=>addEventListener(ev,markUser,{capture:true,passive:ev!=='keydown'&&ev!=='input'}));addEventListener('scroll',()=>requestAnimationFrame(captureAnchor),{passive:true});
 const mo=new MutationObserver(()=>{queueInject();restoreAnchor()});mo.observe(document.body,{childList:true,subtree:true});captureAnchor();installScrollGuard()
}
document.addEventListener('click',e=>{
 const b=e.target.closest('.dr-enter-trade');if(b){e.preventDefault();e.stopImmediatePropagation();enterTrade((b.dataset.tradeSymbol||symbolFrom(b)).toUpperCase());return}
 const s=e.target.closest('[data-stop-trade]');if(s){e.preventDefault();e.stopImmediatePropagation();stopTrade(s.dataset.stopTrade);return}
 const o=e.target.closest('[data-trade-open]');if(o){e.preventDefault();e.stopImmediatePropagation();try{openChart(o.dataset.tradeOpen)}catch(_){} }
},true);
const css=document.createElement('style');css.id='dr-trade-monitor-css';css.textContent=`
html,body{overflow-anchor:none}#results,.hero,.dr-active-trades-panel{overflow-anchor:none}.dr-enter-trade{width:100%;margin-top:11px;background:linear-gradient(135deg,#123c31,#0c2b25);color:#62f0bd;border:1px solid #216f5a;box-shadow:0 8px 22px #0004}.dr-enter-trade.active{background:#0a3028;color:#7dffd0;border-color:#35e0a1}.dr-active-trades-panel{background:#071827;border:1px solid #216f5a;border-radius:14px;padding:14px;margin:0 0 16px;box-shadow:0 12px 30px #0005}.dr-trade-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.dr-trade-head b{color:#edf6ff}.dr-trade-head small{display:block;color:#7f99af;margin-top:4px;font-size:10px}.dr-trade-pulse{color:#35e0a1;font-size:11px;font-weight:900}.dr-trade-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.dr-active-trade{background:#06131f;border:1px solid #173a4d;border-radius:12px;padding:11px}.dr-active-top{display:flex;justify-content:space-between;align-items:center;gap:8px}.dr-trade-open{background:none!important;border:0!important;padding:0!important;color:#edf6ff!important;text-align:left}.dr-trade-open span{display:block;font-size:10px;margin-top:3px}.dr-active-price{font-size:19px;font-weight:900;margin:10px 0;color:#65b8ff}.dr-trade-levels{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;font-size:10px;color:#7895ad}.dr-trade-levels b{color:#dfeeff}.dr-stop-monitor{width:100%;margin-top:9px;background:#301821;color:#ff8995;border:1px solid #5d2632;padding:8px}.dr-trade-note{color:#69849a;font-size:9px;line-height:1.5;margin-top:9px}.dr-trade-toast{position:fixed;z-index:100500;left:14px;right:14px;top:calc(12px + env(safe-area-inset-top,0px));padding:12px 14px;border-radius:13px;transform:translateY(-150%);opacity:0;transition:.22s ease;font-size:12px;font-weight:800;box-shadow:0 14px 40px #0009;background:#102337;color:#edf6ff;border:1px solid #2a4960}.dr-trade-toast.show{transform:translateY(0);opacity:1}.dr-trade-toast.red{background:#35161e;border-color:#74303d;color:#ffb3bb}.dr-trade-toast.yellow{background:#332b12;border-color:#69591f;color:#ffe29a}.dr-trade-toast.green{background:#0b2d25;border-color:#216f5a;color:#9effda}
@media(max-width:900px){.dr-trade-grid{grid-template-columns:1fr}.dr-active-trades-panel{margin-top:2px}.dr-mobile-header,.dr-bottom-nav{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}.dr-mobile-header{background:#050d18f7!important}body.dr-app-mode>header:not(.dr-mobile-header){position:relative!important;top:auto!important;z-index:10!important}html,body{overscroll-behavior-y:none}.card,.pick{transform:translateZ(0)}}`;
document.head.appendChild(css);
function boot(){load();stability();queueInject();restartSocket();renderPanel();setInterval(deepLoop,DEEP_MS);setTimeout(deepLoop,2500)}
if(document.readyState==='loading')addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
