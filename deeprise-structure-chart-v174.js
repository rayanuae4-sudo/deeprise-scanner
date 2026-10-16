/* DeepRise V17.4: order blocks and fluid interactive chart. */
(()=>{'use strict';
const state={portalMarker:null,previousHtmlOverflow:'',symbol:'',tf:'4h',result:null,token:0,controller:null,loading:false,error:false,errorMessage:'',cache:new Map(),view:{count:75,offset:0},tool:'pan',expanded:false,previousOverflow:'',returnFocus:null,pending:null,geometry:null,pointers:new Map(),gesture:null,drawings:{},layers:{structure:true,pivots:true,protection:true,orderBlocks:true,ema20:true,ema50:true,bollinger:false,volume:false,rsi:false,fvg:true,fib:true,extensions:false,trendExtensions:false,sweeps:false,timeZones:false,fan:false}};
function defaultCount(){return window.innerWidth<650?40:75}
const wt=k=>window.DeepRiseWorkspace?.t(k)||k;
try{const saved=JSON.parse(localStorage.getItem('deeprise_drawings_v173')||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))state.drawings=saved}catch(_){}
const drawKey=()=>state.symbol+':'+state.tf;
function drawings(){const a=state.drawings[drawKey()];return Array.isArray(a)?a.filter(d=>d&&['line','horizontal','rectangle','drawFib'].includes(d.type)&&Number.isFinite(d.a?.time)&&Number.isFinite(d.a?.price)&&Number.isFinite(d.b?.time)&&Number.isFinite(d.b?.price)).slice(-60):[]}
function saveDrawings(a){state.drawings[drawKey()]=a.slice(-60);const keys=Object.keys(state.drawings);while(keys.length>50)delete state.drawings[keys.shift()];try{localStorage.setItem('deeprise_drawings_v173',JSON.stringify(state.drawings))}catch(_){}render()}
function viewport(total){const count=Math.min(total,Math.max(20,Math.min(180,Math.round(state.view.count))));state.view.count=count;state.view.offset=Math.max(0,Math.min(Math.max(0,total-count),Math.round(state.view.offset)));const end=total-state.view.offset;return{first:Math.max(0,end-count),end,count}}
function zoom(factor,anchor=.5){if(!state.result)return;const before=viewport(state.result.bars.length),idx=before.first+before.count*anchor;state.view.count=Math.max(20,Math.min(180,state.result.bars.length,Math.round(before.count*factor)));const first=idx-state.view.count*anchor;state.view.offset=state.result.bars.length-first-state.view.count;viewport(state.result.bars.length);queuePaint()}
function pan(candles){if(!state.result)return;state.view.offset+=candles;viewport(state.result.bars.length);queuePaint()}
function fit(){state.view={count:defaultCount(),offset:0};state.pending=null;queuePaint()}
function toolBar(){return `<div class="dr-draw-toolbar" aria-label="${esc(wt('drawings'))}"><div><button data-chart-zoom=".75" aria-label="${esc(wt('zoomIn'))}">＋</button><button data-chart-zoom="1.3333" aria-label="${esc(wt('zoomOut'))}">−</button><button data-chart-pan="1" aria-label="${esc(wt('older'))}">◀</button><button data-chart-pan="-1" aria-label="${esc(wt('newer'))}">▶</button><button data-chart-fit>${wt('fit')}</button><small data-bar-count>${state.view.count} ${wt('bars')}</small></div><div>${['pan','line','horizontal','rectangle','drawFib'].map(k=>`<button data-chart-tool="${k}" aria-pressed="${state.tool===k}" class="${state.tool===k?'active':''}">${wt(k)}</button>`).join('')}<button data-chart-undo ${drawings().length?'':'disabled'}>${wt('undo')}</button><button data-chart-clear ${drawings().length?'':'disabled'}>${wt('clear')}</button>${state.pending?`<button data-chart-cancel>${wt('cancel')}</button>`:''}</div></div><div class="dr-structure-note" role="status">${state.pending?wt('pending'):wt('hint')}</div>`}
let chartFrame=0;
function paintChart(){
 const plot=document.querySelector('#drStructurePanel .dr-structure-scroll');
 if(!plot||!state.result)return;
 const focused=document.activeElement?.matches('svg[data-dr-interactive]');
 plot.innerHTML=svg(state.result);
 const count=document.querySelector('#drStructurePanel [data-bar-count]');
 if(count)count.textContent=state.view.count+' '+wt('bars');
 if(focused)plot.querySelector('svg[data-dr-interactive]')?.focus({preventScroll:true});
}
function queuePaint(){if(chartFrame)return;chartFrame=requestAnimationFrame(()=>{chartFrame=0;paintChart()})}
function updateLayer(key,enabled){
 if(!Object.prototype.hasOwnProperty.call(state.layers,key))return;
 state.layers[key]=Boolean(enabled);
 const panel=document.getElementById('drStructurePanel');
 panel?.querySelectorAll('[data-structure-layer="'+key+'"]').forEach(el=>{el.checked=state.layers[key];el.closest('label')?.classList.toggle('is-on',state.layers[key])});
 panel?.querySelectorAll('[data-toggle-indicator="'+key+'"]').forEach(btn=>{btn.classList.toggle('active',state.layers[key]);btn.setAttribute('aria-pressed',String(state.layers[key]));const flag=btn.querySelector('[data-indicator-status]');if(flag)flag.textContent=state.layers[key]?'●':'○'});
 const status=panel?.querySelector('[data-indicator-feedback]');if(status)status.textContent=(state.layers[key]?'✓ ON · ':'○ OFF · ')+t(key)+(state.result?' · Chart updated ↓':' · '+t('loading'));if(state.result&&!state.error)queuePaint();
}
const indicatorCache=new WeakMap(),INDICATORS=new Set(['ema20','ema50','bollinger','volume','rsi']);
function studies(bars){
 if(indicatorCache.has(bars))return indicatorCache.get(bars);
 const ema20=[],ema50=[],bbTop=[],bbBottom=[],rsi=[];let e20=bars[0]?.close||0,e50=e20,gainAvg=0,lossAvg=0;
 for(let i=0;i<bars.length;i++){
  const close=bars[i].close;e20=i?e20+(close-e20)*2/21:close;e50=i?e50+(close-e50)*2/51:close;
  ema20.push(i>=19?e20:null);ema50.push(i>=49?e50:null);
  if(i>=19){let mid=0;for(let k=i-19;k<=i;k++)mid+=bars[k].close;mid/=20;let variance=0;for(let k=i-19;k<=i;k++)variance+=(bars[k].close-mid)**2;const band=2*Math.sqrt(variance/20);bbTop.push(mid+band);bbBottom.push(mid-band)}
  else{bbTop.push(null);bbBottom.push(null)}
  if(i===0){rsi.push(null);continue}
  const move=close-bars[i-1].close,g=Math.max(0,move),l=Math.max(0,-move);
  if(i<=14){gainAvg+=g;lossAvg+=l;if(i===14){gainAvg/=14;lossAvg/=14}}else{gainAvg=(gainAvg*13+g)/14;lossAvg=(lossAvg*13+l)/14}
  rsi.push(i>=14?(lossAvg===0?(gainAvg===0?50:100):100-100/(1+gainAvg/lossAvg)):null);
 }
 const result={ema20,ema50,bbTop,bbBottom,rsi};indicatorCache.set(bars,result);return result;
}
function pointFromEvent(e){const svg=e.target.closest('svg[data-dr-interactive]'),g=state.geometry;if(!svg||!g)return null;const r=svg.getBoundingClientRect();let x=(e.clientX-r.left)/r.width*g.W,y=(e.clientY-r.top)/r.height*g.H;const matrix=svg.getScreenCTM?.();if(matrix&&svg.createSVGPoint){const raw=svg.createSVGPoint();raw.x=e.clientX;raw.y=e.clientY;const mapped=raw.matrixTransform(matrix.inverse());x=mapped.x;y=mapped.y;}if(x<g.left||x>g.right||y<g.top||y>g.bottom)return null;const i=g.first+(x-g.left)/(g.right-g.left)*(g.count+g.extra-1);return{time:g.origin+i*g.step,price:g.hi-(y-g.top)/(g.bottom-g.top)*(g.hi-g.lo)}}
function addPoint(p){if(!p||!(p.price>0))return;if(state.tool==='horizontal'){saveDrawings([...drawings(),{type:state.tool,a:p,b:p}]);return}if(!state.pending){state.pending=p;render();return}const a=state.pending;state.pending=null;saveDrawings([...drawings(),{type:state.tool,a,b:p}])}
function drawingSvg(g){const X=p=>g.left+((p.time-g.origin)/g.step-g.first)/(g.count+g.extra-1)*(g.right-g.left),Y=p=>g.bottom-(p-g.lo)/(g.hi-g.lo)*(g.bottom-g.top),label=(x,y,s)=>`<text x="${x}" y="${y}" font-size="11" fill="#ffd166" direction="ltr">${esc(s)}</text>`;let out='';for(const d of drawings()){const x1=X(d.a),x2=X(d.b),y1=Y(d.a.price),y2=Y(d.b.price),title=`<title>${esc(wt(d.type)+' $'+pf(d.a.price)+' → $'+pf(d.b.price))}</title>`;
 if(d.type==='horizontal')out+=`<g>${title}<line x1="${g.left}" x2="${g.right}" y1="${y1}" y2="${y1}" stroke="#ffd166" stroke-width="2" stroke-dasharray="7 3"/>${label(g.left+5,y1-5,'$'+pf(d.a.price))}</g>`;
 if(d.type==='line')out+=`<g>${title}<line x1="${x1}" x2="${x2}" y1="${y1}" y2="${y2}" stroke="#ffd166" stroke-width="2.5"/></g>`;
 if(d.type==='rectangle')out+=`<g>${title}<rect x="${Math.min(x1,x2)}" y="${Math.min(y1,y2)}" width="${Math.max(1,Math.abs(x2-x1))}" height="${Math.max(1,Math.abs(y2-y1))}" fill="#ffd166" fill-opacity=".12" stroke="#ffd166"/></g>`;
 if(d.type==='drawFib')for(const ratio of [0,.236,.382,.5,.618,.786,1,1.272,1.618]){const price=d.b.price+(d.a.price-d.b.price)*ratio,y=Y(price);out+=`<g>${title}<line x1="${Math.min(x1,x2)}" x2="${g.right}" y1="${y}" y2="${y}" stroke="#ffd166" stroke-dasharray="4 5"/>${label(Math.max(g.left+3,Math.min(x1,x2)+3),y-4,'Fib '+ratio+' · $'+pf(price))}</g>`}
 }
 if(state.pending)out+=`<circle cx="${X(state.pending)}" cy="${Y(state.pending.price)}" r="5" fill="#ffd166"/>`;
 return `<g clip-path="url(#drDrawingClip)">${out}</g>`;
}
function bindInteractive(panel){
 panel.addEventListener('wheel',e=>{if(!e.target.closest('svg[data-dr-interactive]')||!state.result)return;e.preventDefault();const r=e.target.closest('svg').getBoundingClientRect();zoom(e.deltaY>0?1.15:.87,Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)))},{passive:false});
 panel.addEventListener('pointerdown',e=>{if(!e.target.closest('svg[data-dr-interactive]')||!state.result||e.button>0)return;e.preventDefault();state.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});panel.setPointerCapture?.(e.pointerId);if(state.pointers.size===1)state.gesture={startX:e.clientX,startY:e.clientY,offset:state.view.offset,moved:false,rect:e.target.closest('svg').getBoundingClientRect(),point:pointFromEvent(e)};else{const a=[...state.pointers.values()];state.gesture.moved=true;state.gesture.distance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}});
 panel.addEventListener('pointermove',e=>{if(!state.pointers.has(e.pointerId)||!state.gesture)return;e.preventDefault();state.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});const g=state.gesture;if(state.pointers.size===2){const a=[...state.pointers.values()],distance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(g.distance&&distance>0)zoom(g.distance/distance);g.distance=distance;return}if(Math.hypot(e.clientX-g.startX,e.clientY-g.startY)>7)g.moved=true;if(state.tool==='pan'&&g.moved){state.view.offset=g.offset+(e.clientX-g.startX)*state.view.count/g.rect.width;viewport(state.result.bars.length);queuePaint()}});
 const release=e=>{if(!state.pointers.has(e.pointerId))return;const g=state.gesture;state.pointers.delete(e.pointerId);if(!state.pointers.size){state.gesture=null;if(e.type==='pointerup'&&g&&!g.moved&&state.tool!=='pan')addPoint(g.point)}else if(g){const remaining=[...state.pointers.values()][0];g.moved=true;g.distance=null;g.startX=remaining.x;g.startY=remaining.y;g.offset=state.view.offset}};panel.addEventListener('pointerup',release);panel.addEventListener('pointercancel',release);
 panel.addEventListener('keydown',e=>{if(!e.target.matches('svg[data-dr-interactive]'))return;if(e.key==='+'||e.key==='='){e.preventDefault();zoom(.75)}if(e.key==='-'){e.preventDefault();zoom(1.3333)}if(e.key==='ArrowLeft'){e.preventDefault();pan(10)}if(e.key==='ArrowRight'){e.preventDefault();pan(-10)}if(e.key==='0'){e.preventDefault();fit()}});
}
const copy={
 en:{title:'Market structure & Fibonacci',loading:'Loading closed candles…',error:'Could not refresh candles. Retry.',retry:'Refresh',structure:'BOS / CHoCH',pivots:'HH / HL / LH / LL',protection:'Protected highs / lows',fvg:'Active FVG',fib:'Fib retracement',extensions:'2-point extensions',trendExtensions:'3-point extensions',sweeps:'Liquidity sweeps',timeZones:'Fib time zones',fan:'Fib fan',orderBlocks:'Order blocks',ema20:'EMA 20',ema50:'EMA 50',bollinger:'Bollinger bands',volume:'Volume',rsi:'RSI 14',indicators:'Indicators',structureTools:'Structure & order blocks',indicatorTools:'Technical indicators',noOrderBlocks:'No confirmed active order blocks on this timeframe',full:'Full screen',exitFull:'Exit full screen',note:'Closed candles only. Pivots need 3 subsequent closed candles; hover a label for its confirmation time. Readiness uses 4H, independently of this chart timeframe.',bias:'Structure',range:'Range',long:'Bullish',short:'Bearish',high:'Protected high',low:'Protected low',gap:'FVG',partial:'Partially filled',unfilled:'Unfilled',none:'No confirmed level',anchors:'Confirmed Fib anchors A → B',third:'C',waitingC:'A confirmed retracement point C is needed for 3-point extensions.',equilibrium:'Equilibrium 0.5',golden:'Fib 0.618–0.786',premium:'Premium',discount:'Discount',confirmed:'Confirmed',asof:'Closed at',timeNote:'Time zones are ratio markers, not activation forecasts.'},
 ar:{title:'هيكل السوق وفيبوناتشي',loading:'تحميل الشموع المغلقة…',error:'تعذر تحديث الشموع. أعد المحاولة.',retry:'تحديث',structure:'BOS / CHoCH',pivots:'القمم والقيعان HH / HL / LH / LL',protection:'القمم والقيعان المحمية',fvg:'فجوات FVG النشطة',fib:'تصحيح فيبوناتشي',extensions:'امتدادات نقطتين',trendExtensions:'امتدادات ثلاث نقاط',sweeps:'سحب السيولة',timeZones:'مناطق فيبوناتشي الزمنية',fan:'مروحة فيبوناتشي',orderBlocks:'مناطق الأوردر بلوك',ema20:'متوسط EMA 20',ema50:'متوسط EMA 50',bollinger:'بولينجر',volume:'حجم التداول',rsi:'مؤشر RSI 14',indicators:'المؤشرات',structureTools:'الهيكل والأوردر بلوك',indicatorTools:'المؤشرات الفنية',noOrderBlocks:'لا توجد مناطق أوردر بلوك نشطة مؤكدة على هذا الفريم',full:'ملء الشاشة',exitFull:'إغلاق ملء الشاشة',note:'شموع مغلقة فقط. تأكيد القمة أو القاع بعد 3 شموع لاحقة؛ مرّر فوق العلامة لمعرفة وقت التأكيد. تصنيف الجاهزية يستخدم 4 ساعات مستقلًا عن فريم هذه الخريطة.',bias:'الهيكل',range:'نطاق عرضي',long:'صاعد',short:'هابط',high:'قمة محمية',low:'قاع محمي',gap:'FVG',partial:'ممتلئة جزئيًا',unfilled:'غير ممتلئة',none:'لا يوجد مستوى مؤكد',anchors:'نقطتا فيبوناتشي المؤكدتان A ← B',third:'C',waitingC:'امتدادات الثلاث نقاط تنتظر تأكيد نقطة التصحيح C.',equilibrium:'التوازن 0.5',golden:'فيبوناتشي 0.618–0.786',premium:'النصف العلوي',discount:'النصف السفلي',confirmed:'وقت التأكيد',asof:'آخر إغلاق',timeNote:'المناطق الزمنية علامات نسبية وليست توقعًا لموعد التفعيل.'},
 ru:{title:'Структура рынка и Фибоначчи',loading:'Загрузка закрытых свечей…',error:'Не удалось обновить свечи.',retry:'Обновить',structure:'BOS / CHoCH',pivots:'HH / HL / LH / LL',protection:'Защищённые экстремумы',fvg:'Активные FVG',fib:'Коррекция Fib',extensions:'Расширения 2 точки',trendExtensions:'Расширения 3 точки',sweeps:'Снятие ликвидности',timeZones:'Временные зоны Fib',fan:'Веер Fib',orderBlocks:'Ордер-блоки',ema20:'EMA 20',ema50:'EMA 50',bollinger:'Полосы Боллинджера',volume:'Объём',rsi:'RSI 14',indicators:'Индикаторы',structureTools:'Структура и ордер-блоки',indicatorTools:'Технические индикаторы',noOrderBlocks:'Нет подтверждённых активных ордер-блоков',full:'Во весь экран',exitFull:'Закрыть полный экран',note:'Только закрытые свечи. Пивот подтверждается через 3 свечи; время подтверждения в подсказке. Готовность использует 4H независимо от графика.',bias:'Структура',range:'Диапазон',long:'Бычья',short:'Медвежья',high:'Защищённый максимум',low:'Защищённый минимум',gap:'FVG',partial:'Частично заполнен',unfilled:'Не заполнен',none:'Нет подтверждённого уровня',anchors:'Подтверждённые точки Fib A → B',third:'C',waitingC:'Для расширения 3 точек нужна подтверждённая точка C.',equilibrium:'Равновесие 0.5',golden:'Fib 0.618–0.786',premium:'Премия',discount:'Дисконт',confirmed:'Подтверждено',asof:'Закрыто',timeNote:'Временные зоны — отношения, не прогноз времени.'}
};
const lang=()=>localStorage.getItem('deeprise_language')||'en',t=k=>(copy[lang()]||copy.en)[k]||k;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pf=v=>Number(v).toLocaleString('en-US',{maximumFractionDigits:8});
const stamp=v=>new Date(v).toLocaleString(lang()==='ar'?'ar-SA':lang()==='ru'?'ru-RU':'en-GB',{timeZone:'Asia/Riyadh',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})+' UTC+3';
function toggleFullscreen(force){
 const panel=ensure();if(!panel)return;
 const next=typeof force==='boolean'?force:!state.expanded;if(next===state.expanded)return;
 if(next){
  state.returnFocus=document.activeElement;
  state.previousOverflow=document.body.style.overflow;
  state.previousHtmlOverflow=document.documentElement.style.overflow;
  // Escape the chart card stacking context so iPhone headers and bottom navigation cannot cover fullscreen.
  state.portalMarker=document.createComment('DeepRise fullscreen return position');
  panel.parentNode?.insertBefore(state.portalMarker,panel);
  document.body.appendChild(panel);
  document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';
  document.body.classList.add('dr-structure-immersive');
 }else{
  if(state.portalMarker?.parentNode)state.portalMarker.replaceWith(panel);
  state.portalMarker=null;
  document.body.style.overflow=state.previousOverflow;
  document.documentElement.style.overflow=state.previousHtmlOverflow;
  document.body.classList.remove('dr-structure-immersive');
 }
 state.expanded=next;panel.classList.toggle('dr-structure-fullscreen',next);
 render();
 requestAnimationFrame(()=>{
  if(next){panel.scrollTop=0;panel.querySelector('[data-structure-fullscreen]')?.focus({preventScroll:true})}
  else if(state.returnFocus?.isConnected)state.returnFocus.focus({preventScroll:true});
  window.dispatchEvent(new Event('resize'));
 });
}
function indicatorQuick(){
 const btn=k=>'<button type="button" data-toggle-indicator="'+k+'" class="'+(state.layers[k]?'active':'')+'" aria-pressed="'+Boolean(state.layers[k])+'">'+esc(t(k))+' <span data-indicator-status>'+(state.layers[k]?'●':'○')+'</span></button>';
 const group=(label,keys)=>'<div class="dr-quick-layer-group"><b>'+esc(t(label))+'</b><div class="dr-quick-layer-grid">'+keys.map(btn).join('')+'</div></div>';
 return '<section class="dr-indicator-shortcuts" aria-label="'+esc(t('indicators'))+'">'+group('structureTools',['orderBlocks','fvg','structure','fib','protection','pivots'])+group('indicatorTools',['rsi','ema20','ema50','bollinger','volume'])+'</section>'
}
function activateChartButton(target){
 const btn=target?.closest?.('button[data-toggle-indicator],button[data-structure-fullscreen],button[data-chart-zoom],button[data-chart-pan],button[data-chart-fit],button[data-chart-tool],button[data-chart-undo],button[data-chart-clear],button[data-chart-cancel],button[data-structure-tf],button[data-structure-refresh]');
 if(!btn||btn.disabled)return false;
 if(btn.hasAttribute('data-structure-fullscreen')){toggleFullscreen();return true}
 if(btn.hasAttribute('data-toggle-indicator')){const key=btn.dataset.toggleIndicator;updateLayer(key,!state.layers[key]);return true}
 if(btn.hasAttribute('data-chart-zoom')){zoom(Number(btn.dataset.chartZoom));return true}
 if(btn.hasAttribute('data-chart-pan')){pan(Number(btn.dataset.chartPan)*Math.max(5,state.view.count*.25));return true}
 if(btn.hasAttribute('data-chart-fit')){fit();return true}
 if(btn.hasAttribute('data-chart-tool')){state.tool=btn.dataset.chartTool;state.pending=null;render();return true}
 if(btn.hasAttribute('data-chart-undo')){saveDrawings(drawings().slice(0,-1));return true}
 if(btn.hasAttribute('data-chart-clear')){saveDrawings([]);return true}
 if(btn.hasAttribute('data-chart-cancel')){state.pending=null;render();return true}
 if(btn.hasAttribute('data-structure-tf')){load(state.symbol,btn.dataset.structureTf);return true}
 if(btn.hasAttribute('data-structure-refresh')){load(state.symbol,state.tf,true);return true}
 return false;
}
function ensure(){
 let panel=document.getElementById('drStructurePanel');if(panel)return panel;
 const chart=document.getElementById('tradingview_chart');if(!chart)return null;
 panel=document.createElement('section');panel.id='drStructurePanel';panel.className='dr-structure-panel';
 chart.after(panel);bindInteractive(panel);
 panel.addEventListener('change',e=>{const key=e.target?.dataset?.structureLayer;if(key)updateLayer(key,e.target.checked)});
 // Delegated click persists when render() replaces controls.
 panel.addEventListener('click',e=>{if(activateChartButton(e.target)){e.preventDefault();e.stopPropagation()}},true);
 // WebKit can drop synthetic click after touchend during frequent chart updates.
 // Fire stationary real touches directly and cancel duplicate synthetic clicks.
 let touch=null;
 const selector='button[data-toggle-indicator],button[data-structure-fullscreen],button[data-chart-zoom],button[data-chart-pan],button[data-chart-fit],button[data-chart-tool],button[data-chart-undo],button[data-chart-clear],button[data-chart-cancel],button[data-structure-tf],button[data-structure-refresh]';
 panel.addEventListener('touchstart',e=>{
  const button=e.target?.closest?.(selector),t=e.touches?.[0];
  touch=button&&e.touches.length===1?{button,x:t.clientX,y:t.clientY,id:t.identifier}:null;
 },{passive:true});
 panel.addEventListener('touchend',e=>{
  const start=touch;touch=null;
  if(!start||!start.button.isConnected||e.touches.length)return;
  const t=Array.from(e.changedTouches).find(x=>x.identifier===start.id);
  if(!t||Math.hypot(t.clientX-start.x,t.clientY-start.y)>14)return;
  if(!start.button.contains(e.target))return;
  e.preventDefault();e.stopPropagation();activateChartButton(start.button);
 },{passive:false});
 panel.addEventListener('touchcancel',()=>{touch=null},{passive:true});
 return panel;
}
function svg(result){
 const {bars,pivots,events,gaps,sweeps,fib}=result,{first,end,count}=viewport(bars.length),visible=bars.slice(first,end),W=Math.max(350,Math.min(1700,document.getElementById('drStructurePanel')?.clientWidth||1120)),H=state.layers.rsi?(state.layers.volume?615:570):state.layers.volume?535:460,left=20,right=W-(W<650?112:160),top=32,bottom=400,extra=12;
 const study=studies(bars),active=gaps.filter(g=>g.status!=='FILLED'),values=visible.flatMap(b=>[b.high,b.low]);
 if(state.layers.ema20)values.push(...study.ema20.slice(first,end).filter(Number.isFinite));
 if(state.layers.ema50)values.push(...study.ema50.slice(first,end).filter(Number.isFinite));
 if(state.layers.bollinger)values.push(...study.bbTop.slice(first,end).filter(Number.isFinite),...study.bbBottom.slice(first,end).filter(Number.isFinite));
 if(state.layers.protection)for(const p of [result.protectedHigh,result.protectedLow])if(p)values.push(p.price);
 if(fib&&state.layers.fib)values.push(...fib.levels.map(l=>l.price));
 if(fib&&state.layers.extensions)values.push(...fib.extensions.map(l=>l.price));
 if(fib&&state.layers.trendExtensions)values.push(...fib.trendExtensions.map(l=>l.price));
 const min=Math.min(...values),max=Math.max(...values),pad=(max-min)*.1||min*.01,lo=min-pad,hi=max+pad;
 const X=i=>left+(i-first)/(visible.length+extra-1)*(right-left),Y=p=>bottom-(p-lo)/(hi-lo)*(bottom-top),green='#35e0a1',red='#ff6574',gold='#ffd166';
 state.geometry={W,H,left,right,top,bottom,first,count,extra,lo,hi,origin:bars[0].time,step:result.intervalMs};
 const text=(x,y,label,color='#a7bccf',size=10)=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" direction="ltr">${esc(label)}</text>`;
 const labelRows=[];
 const line=(price,label,color,dash='5 4',start=left)=>{const actual=Y(price);let row=Math.max(top,Math.min(bottom,actual));while(labelRows.some(y=>Math.abs(y-row)<12))row+=12;labelRows.push(row);return `<line x1="${start}" x2="${right}" y1="${actual}" y2="${actual}" stroke="${color}" stroke-dasharray="${dash}"/><path d="M ${right} ${actual} L ${right+5} ${row}" stroke="${color}" opacity=".5"/>${text(right+8,row+3,label+' $'+pf(price),color)}`};
 let out='';for(let i=0;i<=5;i++){const p=lo+(hi-lo)*i/5;out+=`<line x1="${left}" x2="${right}" y1="${Y(p)}" y2="${Y(p)}" stroke="#173148"/>`+(!(fib&&(state.layers.fib||state.layers.extensions||state.layers.trendExtensions))&&!state.layers.protection?text(right+8,Y(p)+3,'$'+pf(p),'#526c81'):'')}
 if(fib&&state.layers.fib){const from=Math.min(right,Math.max(left,X(fib.start.index))),low=Math.min(fib.start.price,fib.end.price),high=Math.max(fib.start.price,fib.end.price),mid=fib.equilibrium;
  out+=`<rect x="${from}" y="${Y(high)}" width="${right-from}" height="${Y(mid)-Y(high)}" fill="${red}" opacity=".035"/><rect x="${from}" y="${Y(mid)}" width="${right-from}" height="${Y(low)-Y(mid)}" fill="${green}" opacity=".035"/><rect x="${from}" y="${Y(fib.golden[1])}" width="${right-from}" height="${Y(fib.golden[0])-Y(fib.golden[1])}" fill="${gold}" opacity=".09"/>`;
  fib.levels.forEach(l=>{out+=line(l.price,'Fib '+l.ratio,l.ratio===.618||l.ratio===.786?gold:'#716d98','3 5',from)});
 }
 if(state.layers.fvg)for(const g of active.filter(g=>g.startIndex<=end+extra-1&&g.remainingUpper>=lo&&g.remainingLower<=hi).slice(-8)){const x=Math.max(left,X(g.startIndex)),upper=Math.min(hi,g.remainingUpper),lower=Math.max(lo,g.remainingLower),c=g.side==='LONG'?green:red;
  out+=`<g><title>${esc(g.side+' FVG • '+t(g.status==='PARTIAL'?'partial':'unfilled')+' • '+stamp(g.createdAt))}</title><rect x="${x}" y="${Y(upper)}" width="${right-x}" height="${Math.max(1,Y(lower)-Y(upper))}" fill="${c}" fill-opacity=".13" stroke="${c}" stroke-opacity=".5"/>${text(x+3,Y(upper)+11,'FVG '+(g.status==='PARTIAL'?'PARTIAL':''),c)}</g>`;
 }
 if(state.layers.orderBlocks)for(const ob of (result.blocks||[]).filter(ob=>ob.status!=='INVALID'&&ob.breakIndex<end&&ob.lower<=hi&&ob.upper>=lo).slice(-10)){
  const x=Math.max(left,X(ob.originIndex)),upper=Math.min(hi,ob.upper),lower=Math.max(lo,ob.lower),c=ob.side==='LONG'?'#26d6ac':'#fa936d',tested=ob.status==='TESTED';
  out+=`<g><title>${esc((ob.side==='LONG'?'Bullish':'Bearish')+' order block · '+ob.status+' · $'+pf(ob.lower)+' – $'+pf(ob.upper)+' · '+stamp(ob.confirmedAt))}</title><rect x="${x}" y="${Y(upper)}" width="${Math.max(0,right-x)}" height="${Math.max(1,Y(lower)-Y(upper))}" fill="${c}" fill-opacity="${tested?'.07':'.16'}" stroke="${c}" stroke-width="1.2" stroke-dasharray="${tested?'5 4':'none'}"/>${text(Math.min(right-54,x+3),Y(upper)+11,(ob.side==='LONG'?'BULL':'BEAR')+' OB',c,10)}</g>`;
 }
 const drawStudy=(arr,color,dash='')=>{let path='',moving=false;for(let i=first;i<end;i++){if(!Number.isFinite(arr[i])){moving=false;continue}path+=(moving?' L ':'M ')+X(i).toFixed(1)+' '+Y(arr[i]).toFixed(1);moving=true}return `<path d="${path}" fill="none" stroke="${color}" stroke-width="1.8" stroke-dasharray="${dash}" vector-effect="non-scaling-stroke"/>`};
 if(state.layers.bollinger)out+=drawStudy(study.bbTop,'#9c8ada','5 4')+drawStudy(study.bbBottom,'#9c8ada','5 4');
 if(state.layers.ema20)out+=drawStudy(study.ema20,'#ffce77');
 if(state.layers.ema50)out+=drawStudy(study.ema50,'#72affd');
 if(fib&&state.layers.extensions)fib.extensions.forEach(l=>{if(l.price>=lo&&l.price<=hi)out+=line(l.price,'Ext '+l.ratio,'#cf9fff','2 6')});
 if(fib&&state.layers.trendExtensions)fib.trendExtensions.forEach(l=>{if(l.price>=lo&&l.price<=hi)out+=line(l.price,'ABC '+l.ratio,'#76d6ee','8 4')});
 if(fib&&state.layers.timeZones){const unit=fib.end.index-fib.start.index;for(const r of [1,2,3,5,8,13]){const idx=fib.start.index+unit*r;if(idx<first||idx>end+extra-1)continue;const x=X(idx);out+=`<line x1="${x}" x2="${x}" y1="${top}" y2="${bottom}" stroke="#c084fc" stroke-dasharray="3 7" opacity=".4"/>`+text(x+3,top+10,'T '+r,'#c084fc')}}
 if(fib&&state.layers.fan){const x1=X(fib.start.index),x2=X(fib.end.index);if(x2>x1)for(const ratio of [.382,.5,.618]){const y1=Y(fib.start.price),y2=Y(fib.start.price+(fib.end.price-fib.start.price)*ratio),endY=y1+(y2-y1)*(right-x1)/(x2-x1);out+=`<line x1="${x1}" x2="${right}" y1="${y1}" y2="${endY}" stroke="#9d8bcd" stroke-dasharray="6 5"/>`}}
 const width=Math.max(3,(right-left)/(visible.length+extra)*.55);
 visible.forEach((b,j)=>{const x=X(first+j),color=b.close>=b.open?green:red;out+=`<g><title>${esc(stamp(b.closeTime)+' • O '+pf(b.open)+' H '+pf(b.high)+' L '+pf(b.low)+' C '+pf(b.close))}</title><line x1="${x}" x2="${x}" y1="${Y(b.high)}" y2="${Y(b.low)}" stroke="${color}"/><rect x="${x-width/2}" y="${Math.min(Y(b.open),Y(b.close))}" width="${width}" height="${Math.max(1,Math.abs(Y(b.open)-Y(b.close)))}" fill="${color}"/></g>`;if(j%15===0)out+=text(x,bottom+25,new Date(b.time).toISOString().slice(5,16).replace('T',' '),'#6e879c',9)});
 if(state.layers.volume){
  const maxVolume=Math.max(1,...visible.map(b=>b.volume||0)),volumeTop=444,volumeBottom=485;
  out+=`<line x1="${left}" x2="${right}" y1="${volumeBottom}" y2="${volumeBottom}" stroke="#29445a"/>${text(left,437,t('volume'),'#9bb8ca',11)}`;
  visible.forEach((b,j)=>{const x=X(first+j),height=Math.max(1,(b.volume||0)/maxVolume*(volumeBottom-volumeTop)),color=b.close>=b.open?green:red;out+=`<rect x="${x-width/2}" y="${volumeBottom-height}" width="${width}" height="${height}" fill="${color}" fill-opacity=".58"/>`});
 }
 if(state.layers.rsi){
  const rTop=state.layers.volume?515:450,rBottom=rTop+70,rY=n=>rBottom-n/100*(rBottom-rTop);
  for(const level of [30,50,70])out+=`<line x1="${left}" x2="${right}" y1="${rY(level)}" y2="${rY(level)}" stroke="#52627a" stroke-dasharray="4 5" opacity=".6"/>${text(right+6,rY(level)+4,level,'#9bb8ca',9)}`;
  let path='',started=false;for(let i=first;i<end;i++){if(!Number.isFinite(study.rsi[i])){started=false;continue}path+=(started?' L ':'M ')+X(i).toFixed(1)+' '+rY(study.rsi[i]).toFixed(1);started=true}
  const last=study.rsi.at(-1);out+=`<path d="${path}" fill="none" stroke="#bba2ff" stroke-width="2" vector-effect="non-scaling-stroke"/>${text(left,rTop-8,'RSI 14'+(Number.isFinite(last)?' · '+last.toFixed(1):''),'#bba2ff',11)}`;
 }
 if(state.layers.pivots)for(const p of pivots.filter(p=>p.index>=first&&p.index<end)){const y=Y(p.price)+(p.type==='HIGH'?-8:17);out+=`<g><title>${esc(p.label+' $'+pf(p.price)+' • '+t('confirmed')+': '+stamp(p.confirmedAt))}</title>${text(X(p.index)-7,y,p.label,p.type==='HIGH'?red:green)}</g>`}
 if(state.layers.structure)for(const e of events.filter(e=>e.index>=first&&e.index<end)){const x1=Math.max(left,X(e.pivotIndex)),x2=X(e.index),color=e.side==='LONG'?green:red;out+=`<g><title>${esc(e.type+' '+e.side+' • '+stamp(e.confirmedAt))}</title><line x1="${x1}" x2="${x2}" y1="${Y(e.price)}" y2="${Y(e.price)}" stroke="${color}" stroke-width="2"/>${text((x1+x2)/2,Y(e.price)-5,e.type==='CHOCH'?'CHoCH':'BOS',color,11)}<circle cx="${x2}" cy="${Y(e.price)}" r="3" fill="${color}"/></g>`}
 if(state.layers.sweeps)for(const s of sweeps.filter(s=>s.index>=first&&s.index<end).slice(-12))out+=text(X(s.index)-4,Y(s.price)+(s.side==='LONG'?22:-16),'SW',gold);
 if(state.layers.protection)for(const [key,p] of [['high',result.protectedHigh],['low',result.protectedLow]])if(p)out+=line(p.price,t(key),key==='low'?green:red,'8 4',Math.max(left,X(p.index)));
 out+=text(left,26,state.symbol+' • '+state.tf+' • '+t('asof')+' '+stamp(result.barClose),'#d8e7f3',11);
 return `<svg viewBox="0 0 ${W} ${H}" data-dr-interactive tabindex="0" role="application" aria-label="${esc(t('title')+' '+state.symbol+' '+state.tf)}"><defs><clipPath id="drDrawingClip"><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}"/></clipPath><clipPath id="drStructureClip"><rect x="${left}" y="0" width="${W-left}" height="${H}"/></clipPath></defs><g clip-path="url(#drStructureClip)">${out}</g>${drawingSvg(state.geometry)}</svg>`;
}
function render(){const panel=ensure();if(!panel)return;panel.dir=lang()==='ar'?'rtl':'ltr';const r=state.result,fib=r?.fib;
 const header=`<div class="dr-structure-head"><b>${t('title')} • ${esc(state.symbol)}</b><div>${['5m','15m','1h','4h','1d'].map(tf=>`<button data-structure-tf="${tf}" class="${state.tf===tf?'active':''}" aria-pressed="${state.tf===tf}">${tf}</button>`).join('')}<button data-structure-refresh>${t('retry')}</button><button type="button" data-structure-fullscreen title="${t(state.expanded?'exitFull':'full')}" aria-pressed="${state.expanded}" class="dr-structure-expand">${t(state.expanded?'exitFull':'full')}</button></div></div>`;
 const selector=keys=>`<div class="dr-structure-controls">${keys.map(k=>`<label class="${state.layers[k]?'is-on':''}"><input type="checkbox" data-structure-layer="${k}" ${state.layers[k]?'checked':''}>${t(k)}</label>`).join('')}</div>`;
 const layersOpen=panel.querySelector('.dr-layer-picker')?.open??false,indicatorsOpen=panel.querySelector('.dr-indicator-picker')?.open??true;
 const controls=selector(Object.keys(state.layers).filter(k=>!INDICATORS.has(k))),indicatorControls=selector([...INDICATORS]);
 const status=state.loading?t('loading'):state.error?t('error')+(state.errorMessage?' · '+esc(state.errorMessage):''):'';
 let body=status?`<div class="dr-structure-status" role="status">${status}</div>`:'';
 // Never leave the preceding symbol or timeframe's chart under a new heading.
 if(r&&!state.error){body+=`<div class="dr-structure-summary"><span>${t('bias')}: <b>${t(r.bias==='LONG'?'long':r.bias==='SHORT'?'short':'range')}</b></span><span>${t('low')}: <b>${r.protectedLow?'$'+pf(r.protectedLow.price):'—'}</b></span><span>${t('high')}: <b>${r.protectedHigh?'$'+pf(r.protectedHigh.price):'—'}</b></span><span>FVG: <b>${r.gaps.filter(g=>g.status!=='FILLED').length}</b></span><span>OB: <b>${(r.blocks||[]).filter(b=>b.status!=='INVALID').length}</b></span></div><div class="dr-structure-scroll" dir="ltr">${svg(r)}</div>`;
  if(fib)body+=`<div class="dr-structure-note">${t('anchors')}: $${pf(fib.start.price)} → $${pf(fib.end.price)} • ${fib.side}${fib.third?' • C $'+pf(fib.third.price):''}<br>${t('golden')}: $${pf(fib.golden[0])} – $${pf(fib.golden[1])} • ${t('equilibrium')}: $${pf(fib.equilibrium)}${state.layers.trendExtensions&&!fib.third?'<br>'+t('waitingC'):''}</div>`;
 }
 const noOb=r&&!state.loading&&state.layers.orderBlocks&&!(r.blocks||[]).some(b=>b.status!=='INVALID')?'<div class="dr-structure-note dr-no-ob">'+esc(t('noOrderBlocks'))+'</div>':'';
 panel.innerHTML=header+indicatorQuick()+`<div class="dr-indicator-feedback" data-indicator-feedback role="status" aria-live="polite"></div>`+body+noOb+toolBar()+`<div class="dr-plot-options"><details class="dr-layer-picker" ${layersOpen?'open':''}><summary>${wt('layers')}</summary>${controls}</details><details class="dr-indicator-picker" ${indicatorsOpen?'open':''}><summary>${t('indicators')}</summary>${indicatorControls}</details></div><div class="dr-structure-note">${t('note')}${state.layers.timeZones?'<br>'+t('timeNote'):''}</div>`;
}
async function load(symbol,tf='4h',force=false){
 if(!symbol)return;symbol=String(symbol).replace(/[^A-Z0-9]/gi,'').toUpperCase();const token=++state.token;state.controller?.abort();if(state.symbol!==symbol||state.tf!==tf){state.view={count:defaultCount(),offset:0};state.pending=null;state.pointers.clear();state.gesture=null}state.symbol=symbol;state.tf=tf;state.result=null;state.error=false;state.errorMessage='';state.loading=true;render();
 const key=symbol+':'+tf,radar=tf==='4h'?window.DeepRisePreMove?.state.structures.get(symbol):null,cached=radar||state.cache.get(key);
 if(!force&&cached&&Date.now()-cached.updated<180000){state.result=cached;state.loading=false;render();return}
 const sources=['https://data-api.binance.vision','https://api.binance.com','https://api1.binance.com','https://api.binance.us'];let lastError=null;
 try{
  for(const origin of sources){
   if(token!==state.token)return;
   const controller=new AbortController();state.controller=controller;const timer=setTimeout(()=>controller.abort(),5200);
   try{
    const response=await fetch(origin+'/api/v3/klines?symbol='+encodeURIComponent(symbol)+'&interval='+encodeURIComponent(tf)+'&limit=180',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error('HTTP '+response.status);
    const raw=await response.json(),result=window.DeepRiseStructure?.analyse(raw,{tf});
    if(!result)throw Error('No valid closed candles');
    if(token!==state.token)return;
    state.cache.set(key,result);if(state.cache.size>24)state.cache.delete(state.cache.keys().next().value);
    state.result=result;state.error=false;lastError=null;break;
   }catch(e){lastError=e}finally{clearTimeout(timer)}
  }
  if(!state.result){state.error=true;state.errorMessage=lastError?.message||'Market data unavailable'}
 }finally{if(token===state.token){state.loading=false;render()}}
}
function hook(){if(typeof openChart!=='function'||openChart.__drStructure)return;const base=openChart;openChart=function(symbol){const out=base.apply(this,arguments);load(symbol,state.tf);return out};openChart.__drStructure=true;if(typeof closeChart==='function'&&!closeChart.__drStructure){const previous=closeChart;closeChart=function(){if(state.expanded)toggleFullscreen(false);return previous.apply(this,arguments)};closeChart.__drStructure=true}}
document.getElementById('languageSelect')?.addEventListener('change',()=>{if(state.symbol)render()});
const hostPanel=document.getElementById('chartPanel');
function ensureOpenedChart(){
 if(!hostPanel?.classList.contains('active'))return;
 let sym='';
 try{if(typeof chartSymbol==='string')sym=chartSymbol}catch(_){}
 if(!sym){const base=(document.getElementById('chartTitle')?.textContent||'').split('/')[0].trim().replace(/[^A-Z0-9]/gi,'');if(base)sym=base+'USDT'}
 if(!sym)sym='BTCUSDT';
 if(sym!==state.symbol&&!state.loading)load(sym,state.tf);
}
if(hostPanel){new MutationObserver(ensureOpenedChart).observe(hostPanel,{attributes:true,attributeFilter:['class']});setTimeout(ensureOpenedChart,100)}

document.addEventListener('deeprise-premove-updated',()=>{const r=window.DeepRisePreMove?.state.structures.get(state.symbol);if(state.tf==='4h'&&r&&!state.loading&&r!==state.result){state.result=r;queuePaint()}});
window.DeepRiseStructureChart={version:'17.8',state,load,render,zoom,pan,fit,viewport,drawings,saveDrawings,addPoint,svg,paintChart,studies,updateLayer,toggleFullscreen};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.expanded){e.preventDefault();e.stopImmediatePropagation();toggleFullscreen(false)}},true);
const css=document.createElement('style');css.textContent=`.dr-draw-toolbar{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;margin:12px 0}.dr-draw-toolbar>div{display:flex;flex-wrap:wrap;align-items:center;gap:5px}.dr-draw-toolbar button{padding:9px 11px;border:1px solid #29465e;background:#102236;color:#cae4f7;font-size:11px;min-height:38px}.dr-draw-toolbar button.active{border-color:#ffd166;color:#ffd166}.dr-draw-toolbar button:disabled{opacity:.35;cursor:default}.dr-draw-toolbar small{font-size:10px;color:#9bb8ca}.dr-layer-picker>summary{cursor:pointer;padding:10px;color:#65b8ff;font-size:12px}.dr-structure-scroll svg[data-dr-interactive]{touch-action:none;user-select:none;min-width:0;width:100%;display:block;outline-offset:-3px}.dr-structure-scroll{overflow:hidden!important}.dr-structure-panel:has([data-chart-tool].active:not([data-chart-tool=pan])) svg{cursor:crosshair}.dr-readiness-tabs{display:flex;flex-wrap:wrap;gap:7px;margin:13px 0}.dr-readiness-tabs button,.dr-structure-head button{border:1px solid #29465e;border-radius:8px;padding:8px 10px;background:#0b2130;color:#a9c1d1;font-size:11px;cursor:pointer}.dr-readiness-tabs button.active,.dr-structure-head button.active{border-color:#35e0a1;color:#72e8bf;background:#10382e}.dr-readiness-tabs b{margin-inline-start:6px}.dr-readiness-group{border-top:1px solid #264056;padding-top:5px;margin-top:12px;min-width:0}.dr-readiness-group h3{color:#9abbd0;font-size:14px;display:flex;gap:9px;align-items:center}.dr-readiness-group h3 span{font-size:11px;border-radius:20px;background:#163145;padding:3px 8px}.dr-readiness-group.ready h3{color:#35e0a1}.dr-readiness-group.near h3{color:#65b8ff}.dr-readiness-group.early h3{color:#ffd166}.dr-readiness-group.blocked h3{color:#ff9f62}.dr-premove-card.ready{border-color:#35e0a1}.dr-premove-card.near{border-color:#396d9b}.dr-premove-card.early{border-color:#6b5b32}.dr-premove-card.blocked{border-color:#8e533a}.dr-readiness-action{margin-top:8px;font-size:11px;color:#c5dce8;line-height:1.6}.dr-structure-panel{padding:16px;background:#071421;border-top:1px solid #26485d;min-width:0}.dr-structure-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;color:#d9edfa}.dr-structure-head>div{display:flex;gap:5px;flex-wrap:wrap}.dr-structure-controls{display:flex;flex-wrap:wrap;gap:8px 15px;margin:13px 0;font-size:11px;color:#a1bed0}.dr-structure-controls label{display:flex;gap:5px;align-items:center;cursor:pointer}.dr-structure-summary{display:flex;gap:10px 18px;flex-wrap:wrap;font-size:11px;color:#9bb8cd;margin:10px 0}.dr-structure-summary b{color:#dceef9}.dr-structure-scroll{overflow-x:auto;max-width:100%;border:1px solid #18344c;border-radius:10px;background:#050e19}.dr-structure-scroll svg{display:block;width:100%;min-width:900px;height:auto;font-family:Arial,sans-serif}.dr-structure-note{font-size:10px;color:#8da7b9;line-height:1.7;margin-top:9px;overflow-wrap:anywhere}.dr-structure-status{padding:18px;color:#ffd166}@media(min-width:1200px){.dr-readiness-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.dr-readiness-groups>.dr-readiness-group:only-child{grid-column:1/-1}}@media(max-width:700px){.dr-structure-panel{padding:11px}.dr-readiness-tabs button{padding:9px 7px;font-size:10px}.dr-premove-card{overflow-wrap:anywhere}.dr-premove-metrics b,.dr-premove-levels b{unicode-bidi:isolate;direction:ltr;display:inline-block}}`;
css.textContent+=".dr-structure-scroll svg[data-dr-interactive]{width:100%!important;min-width:0!important;height:auto;touch-action:none}.dr-draw-toolbar>div{max-width:100%;overflow-x:auto;flex-wrap:nowrap!important}.dr-draw-toolbar button{white-space:nowrap;flex-shrink:0;border-radius:7px}.dr-structure-scroll{overflow:hidden!important;contain:layout paint}.dr-chart-expanded .dr-structure-scroll svg[data-dr-interactive]{height:auto;min-height:min(50dvh,540px)}@media(max-width:650px){.dr-draw-toolbar>div{width:100%}.dr-structure-head button{min-height:38px}}";css.textContent+=".dr-plot-options{display:flex;gap:9px 18px;flex-wrap:wrap}.dr-plot-options details{flex:1 1 200px;min-width:0}.dr-indicator-picker>summary{padding:10px;color:#65b8ff;font-size:12px;cursor:pointer}.dr-plot-options .dr-structure-controls{max-height:210px;overflow-y:auto}.dr-structure-panel svg text{pointer-events:none}";css.textContent+=`.dr-no-ob{color:#ffc97b;border:1px dashed #906638;padding:8px 12px;border-radius:8px}.dr-quick-layer-group>b{font-size:12px;color:#b5d1e1;display:block;margin:7px 0}.dr-quick-layer-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.dr-indicator-shortcuts{display:block!important;margin:8px 0}.dr-indicator-shortcuts button{min-height:40px!important;text-align:center!important;white-space:normal!important;overflow-wrap:anywhere}.dr-structure-fullscreen .dr-quick-layer-grid{grid-template-columns:repeat(6,minmax(0,1fr))}@media(max-width:650px){.dr-quick-layer-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dr-structure-fullscreen .dr-quick-layer-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.dr-structure-fullscreen .dr-quick-layer-group>b{font-size:10px}}.dr-indicator-feedback{min-height:17px;color:#9edfc5;font-size:12px;padding:1px 4px}.dr-indicator-shortcuts{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:10px 0}.dr-indicator-shortcuts button{position:relative;z-index:1;-webkit-user-select:none;user-select:none;border:1px solid #31506b;background:#0e2435;color:#c1d8e8;padding:10px 12px;border-radius:10px;font-size:12px;cursor:pointer;min-height:42px;touch-action:manipulation}.dr-indicator-shortcuts button.active{background:#10382e;border-color:#35e0a1;color:#85f0cb}.dr-indicator-shortcuts [data-indicator-status]{font-size:15px;margin-inline-start:5px}.dr-structure-controls label.is-on{color:#81e9c2}.dr-structure-expand{border-color:#35e0a1!important;color:#a3f8d8!important;font-weight:700}.dr-structure-fullscreen{position:fixed!important;inset:0!important;z-index:9999999!important;width:100vw!important;height:100dvh!important;max-height:100dvh!important;overflow:auto!important;border:0!important;border-radius:0!important;margin:0!important;padding:calc(9px + env(safe-area-inset-top,0px)) max(10px,env(safe-area-inset-right,0px)) max(12px,env(safe-area-inset-bottom,0px)) max(10px,env(safe-area-inset-left,0px))!important;box-sizing:border-box;background:#050e19!important;display:flex!important;flex-direction:column!important;overscroll-behavior:contain}.dr-structure-fullscreen .dr-structure-head{position:sticky;top:0;z-index:3;background:#050e19;padding:8px 0}.dr-structure-fullscreen .dr-draw-toolbar{margin:6px 0}.dr-structure-fullscreen .dr-plot-options{flex-shrink:0}.dr-structure-fullscreen .dr-plot-options details:not([open]){flex:0 1 auto}.dr-structure-fullscreen .dr-structure-scroll{flex:1 1 auto!important;min-height:44dvh;overflow:hidden!important;contain:none!important}.dr-structure-fullscreen .dr-structure-scroll svg[data-dr-interactive]{height:100%!important;max-height:none!important;width:100%!important;min-width:0!important}.dr-structure-immersive .dr-bottom-nav,.dr-structure-immersive #deepriseInstall{visibility:hidden!important}@media(max-width:700px){.dr-structure-fullscreen .dr-structure-head{gap:5px}.dr-structure-fullscreen .dr-structure-note{font-size:9px}.dr-structure-fullscreen .dr-indicator-shortcuts{flex-wrap:nowrap;overflow-x:auto;padding:6px 0}.dr-indicator-shortcuts button{white-space:nowrap}.dr-structure-fullscreen .dr-draw-toolbar>div{overflow-x:auto!important}}`;
document.head.appendChild(css);hook();let resizeQueued=false;addEventListener('resize',()=>{if(resizeQueued||!state.result||state.pointers.size)return;resizeQueued=true;requestAnimationFrame(()=>{resizeQueued=false;paintChart()})});
})();
