/* DeepRise V18.5: technical indicators + SMC overlay + iPhone full screen. */
(()=>{'use strict';
const state={portalMarker:null,previousHtmlOverflow:'',symbol:'',tf:'4h',result:null,token:0,controller:null,loading:false,error:false,errorMessage:'',cache:new Map(),view:{count:75,offset:0},tool:'pan',expanded:false,previousOverflow:'',returnFocus:null,pending:null,geometry:null,pointers:new Map(),gesture:null,dragPreview:null,helpOpen:false,priceFocus:false,drawings:{},layers:{smc:true,structure:true,pivots:true,protection:true,internalProtection:true,orderBlocks:true,ema20:true,ema50:true,ema200:true,bollinger:true,volume:true,rsi:true,macd:true,atr:true,liquidity:true,poc:true,volumeProfile:true,fvg:true,fib:true,extensions:false,trendExtensions:false,sweeps:false,timeZones:false,fan:false}};
function defaultCount(){return window.innerWidth<650?38:75}
const wt=k=>window.DeepRiseWorkspace?.t(k)||k;
try{const saved=JSON.parse(localStorage.getItem('deeprise_drawings_v173')||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))state.drawings=saved}catch(_){}
const drawKey=()=>state.symbol+':'+state.tf;
function drawings(){const a=state.drawings[drawKey()];return Array.isArray(a)?a.filter(d=>d&&['line','horizontal','rectangle','drawFib'].includes(d.type)&&Number.isFinite(d.a?.time)&&Number.isFinite(d.a?.price)&&Number.isFinite(d.b?.time)&&Number.isFinite(d.b?.price)).slice(-60):[]}
function saveDrawings(a){state.drawings[drawKey()]=a.slice(-60);const keys=Object.keys(state.drawings);while(keys.length>50)delete state.drawings[keys.shift()];try{localStorage.setItem('deeprise_drawings_v173',JSON.stringify(state.drawings))}catch(_){}render()}
function viewport(total){const count=Math.min(total,Math.max(20,Math.min(180,Math.round(state.view.count))));state.view.count=count;state.view.offset=Math.max(0,Math.min(Math.max(0,total-count),Math.round(state.view.offset)));const end=total-state.view.offset;return{first:Math.max(0,end-count),end,count}}
function zoom(factor,anchor=.5){if(!state.result)return;const before=viewport(state.result.bars.length),idx=before.first+before.count*anchor;state.view.count=Math.max(20,Math.min(180,state.result.bars.length,Math.round(before.count*factor)));const first=idx-state.view.count*anchor;state.view.offset=state.result.bars.length-first-state.view.count;viewport(state.result.bars.length);queuePaint()}
function pan(candles){if(!state.result)return;state.view.offset+=candles;viewport(state.result.bars.length);queuePaint()}
function fit(){state.view={count:defaultCount(),offset:0};state.pending=null;queuePaint()}
function toolBar(){return `<div class="dr-draw-toolbar" aria-label="${esc(wt('drawings'))}"><div><button data-chart-zoom=".75" aria-label="${esc(wt('zoomIn'))}">＋</button><button data-chart-zoom="1.3333" aria-label="${esc(wt('zoomOut'))}">−</button><button data-chart-pan="1" aria-label="${esc(wt('older'))}">◀</button><button data-chart-pan="-1" aria-label="${esc(wt('newer'))}">▶</button><button data-chart-fit>${wt('fit')}</button><small data-bar-count>${state.view.count} ${wt('bars')}</small></div><div>${['pan','line','horizontal','rectangle','drawFib'].map(k=>`<button data-chart-tool="${k}" aria-pressed="${state.tool===k}" class="${state.tool===k?'active':''}">${wt(k)}</button>`).join('')}<button data-chart-undo ${drawings().length?'':'disabled'}>${wt('undo')}</button><button data-chart-clear ${drawings().length?'':'disabled'}>${wt('clear')}</button>${state.pending?`<button data-chart-cancel>${wt('cancel')}</button>`:''}<button type="button" data-chart-price-focus aria-pressed="${state.priceFocus}">${lang()==='ar'?'▣ سعر فقط':'▣ Price focus'}</button><button type="button" data-chart-help aria-expanded="${state.helpOpen}">${lang()==='ar'?'ⓘ شرح الأدوات':'ⓘ Help'}</button></div></div><div class="dr-structure-note" role="status">${state.pending?wt('pending'):wt('hint')}</div>`}
let chartFrame=0;
function paintChart(){
 const plot=document.querySelector('#drStructurePanel .dr-structure-scroll');
 if(!plot||!state.result)return;
 const focused=document.activeElement?.matches('svg[data-dr-interactive]');
 plot.innerHTML=svg(state.result);
 const count=document.querySelector('#drStructurePanel [data-bar-count]');
 if(count)count.textContent=state.view.count+' '+wt('bars');
 const legend=document.querySelector('#drStructurePanel [data-chart-levels]');if(legend)legend.innerHTML=priceLegend(state.result);
 if(focused)plot.querySelector('svg[data-dr-interactive]')?.focus({preventScroll:true});
}
function queuePaint(){if(chartFrame)return;chartFrame=requestAnimationFrame(()=>{chartFrame=0;paintChart()})}
function updateLayer(key,enabled){
 if(!Object.prototype.hasOwnProperty.call(state.layers,key))return;
 state.layers[key]=Boolean(enabled);if(['volume','rsi','macd','atr'].includes(key)&&enabled)state.priceFocus=false;
 const panel=document.getElementById('drStructurePanel');
 panel?.querySelectorAll('[data-structure-layer="'+key+'"]').forEach(el=>{el.checked=state.layers[key];el.closest('label')?.classList.toggle('is-on',state.layers[key])});
 panel?.querySelectorAll('[data-toggle-indicator="'+key+'"]').forEach(btn=>{btn.classList.toggle('active',state.layers[key]);btn.setAttribute('aria-pressed',String(state.layers[key]));const flag=btn.querySelector('[data-indicator-status]');if(flag)flag.textContent=state.layers[key]?'●':'○'});
 state.preset='custom';const presetNodes=panel?.querySelectorAll('[data-chart-preset]');presetNodes?.forEach(btn=>{btn.classList.remove('active');btn.setAttribute('aria-pressed','false')});
  const status=panel?.querySelector('[data-indicator-feedback]');if(status)status.textContent=(state.layers[key]?'✓ ON · ':'○ OFF · ')+t(key)+(state.result?' · Chart updated ↓':' · '+t('loading'));if(state.result&&!state.error)queuePaint();
}
const indicatorCache=new WeakMap(),INDICATORS=new Set(['ema20','ema50','ema200','bollinger','volume','rsi','macd','atr','poc','volumeProfile']);
function studies(bars){
 if(indicatorCache.has(bars))return indicatorCache.get(bars);
 const ema20=[],ema50=[],ema200=[],bbTop=[],bbMid=[],bbBottom=[],rsi=[],macd=[],macdSignal=[],macdHist=[],atr=[],volMA=[];
 let e20=0,e50=0,e200=0,e12=0,e26=0,eSignal=0,gainAvg=0,lossAvg=0,trSum=0,atrPrev=0;
 for(let i=0;i<bars.length;i++){
  const b=bars[i],close=Number(b.close),prev=Number(bars[Math.max(0,i-1)].close),vol=Number(b.volume)||0;
  if(i===0){e20=e50=e200=e12=e26=close}
  else{e20+=(close-e20)*2/21;e50+=(close-e50)*2/51;e200+=(close-e200)*2/201;e12+=(close-e12)*2/13;e26+=(close-e26)*2/27}
  ema20.push(i>=19?e20:null);ema50.push(i>=49?e50:null);ema200.push(i>=199?e200:null);
  if(i>=19){
   let sum=0,vsum=0;for(let k=i-19;k<=i;k++){sum+=Number(bars[k].close);vsum+=Number(bars[k].volume)||0}
   const mean=sum/20;let sq=0;for(let k=i-19;k<=i;k++)sq+=(Number(bars[k].close)-mean)**2;
   const spread=2*Math.sqrt(sq/20);bbMid.push(mean);bbTop.push(mean+spread);bbBottom.push(mean-spread);volMA.push(vsum/20);
  }else{bbMid.push(null);bbTop.push(null);bbBottom.push(null);volMA.push(null)}
  if(i===0)rsi.push(null);
  else {
   const change=close-prev,g=Math.max(change,0),l=Math.max(-change,0);
   if(i<=14){gainAvg+=g;lossAvg+=l;if(i===14){gainAvg/=14;lossAvg/=14}}
   else{gainAvg=(gainAvg*13+g)/14;lossAvg=(lossAvg*13+l)/14}
   rsi.push(i>=14?(lossAvg===0?(gainAvg===0?50:100):100-100/(1+gainAvg/lossAvg)):null);
  }
  const diff=e12-e26;
  if(i===25)eSignal=diff;
  else if(i>25)eSignal+=(diff-eSignal)*.2;
  macd.push(i>=25?diff:null);macdSignal.push(i>=33?eSignal:null);macdHist.push(i>=33?diff-eSignal:null);
  const tr=i===0?b.high-b.low:Math.max(b.high-b.low,Math.abs(b.high-prev),Math.abs(b.low-prev));
  if(i<14){trSum+=tr;if(i===13)atrPrev=trSum/14}
  else atrPrev=(atrPrev*13+tr)/14;
  atr.push(i>=13?atrPrev:null);
 }
 const result={ema20,ema50,ema200,bbTop,bbMid,bbBottom,rsi,macd,macdSignal,macdHist,atr,volMA};
 indicatorCache.set(bars,result);return result;
}

/* Visible-range volume profile estimated from OHLCV candles, NOT trade-by-trade volume at price.
   Each candle contributes uniformly across intersecting price bins; 70% value-area expansion. */
function volumeProfileFor(bars,binCount=48){
 if(!Array.isArray(bars)||!bars.length)return null;
 const high=Math.max(...bars.map(b=>Number(b.high))),low=Math.min(...bars.map(b=>Number(b.low)));
 if(!Number.isFinite(high)||!Number.isFinite(low)||high<=low)return null;
 const n=Math.max(12,Math.min(80,Math.round(binCount))),size=(high-low)/n,volumes=new Array(n).fill(0);
 for(const bar of bars){
  const lo=Math.max(low,Number(bar.low)),hi=Math.min(high,Number(bar.high)),v=Math.max(0,Number(bar.volume)||0);
  if(!(v>0&&Number.isFinite(lo)&&Number.isFinite(hi)))continue;
  if(hi<=lo){const i=Math.max(0,Math.min(n-1,Math.floor((lo-low)/size)));volumes[i]+=v;continue}
  const first=Math.max(0,Math.min(n-1,Math.floor((lo-low)/size))),last=Math.max(0,Math.min(n-1,Math.floor((hi-low)/size)));
  for(let i=first;i<=last;i++){
   const overlap=Math.max(0,Math.min(hi,low+(i+1)*size)-Math.max(lo,low+i*size));
   if(overlap>0)volumes[i]+=v*overlap/(hi-lo);
  }
 }
 const total=volumes.reduce((a,b)=>a+b,0);if(!(total>0))return null;
 const maxVolume=Math.max(...volumes),pocIndex=volumes.indexOf(maxVolume);
 let start=pocIndex,stop=pocIndex,area=volumes[pocIndex];
 while(area<total*.7&&(start>0||stop<n-1)){
  const below=start>0?volumes[start-1]:-1,above=stop<n-1?volumes[stop+1]:-1;
  if(above>=below){stop++;area+=volumes[stop]}else{start--;area+=volumes[start]}
 }
 return {volumes,low,high,size,total,maxVolume,poc:low+(pocIndex+.5)*size,
   pocIndex,vah:low+(stop+1)*size,val:low+start*size,start,stop,estimation:'OHLCV_UNIFORM_BIN'};
}
function pointFromEvent(e){const svg=e.target.closest('svg[data-dr-interactive]'),g=state.geometry;if(!svg||!g)return null;const r=svg.getBoundingClientRect();let x=(e.clientX-r.left)/r.width*g.W,y=(e.clientY-r.top)/r.height*g.H;const matrix=svg.getScreenCTM?.();if(matrix&&svg.createSVGPoint){const raw=svg.createSVGPoint();raw.x=e.clientX;raw.y=e.clientY;const mapped=raw.matrixTransform(matrix.inverse());x=mapped.x;y=mapped.y;}if(x<g.left||x>g.right||y<g.top||y>g.bottom)return null;const i=g.first+(x-g.left)/(g.right-g.left)*(g.count+g.extra-1);return{time:g.origin+i*g.step,price:g.hi-(y-g.top)/(g.bottom-g.top)*(g.hi-g.lo)}}
function pointFromClient(x,y,rect){const g=state.geometry;if(!g||!rect?.width||!rect?.height)return null;const px=(x-rect.left)/rect.width*g.W,py=(y-rect.top)/rect.height*g.H;if(px<g.left||px>g.right||py<g.top||py>g.bottom)return null;const i=g.first+(px-g.left)/(g.right-g.left)*(g.count+g.extra-1);return{time:g.origin+i*g.step,price:g.hi-(py-g.top)/(g.bottom-g.top)*(g.hi-g.lo)}}
function addPoint(p){if(!p||!(p.price>0))return;if(state.tool==='horizontal'){saveDrawings([...drawings(),{type:state.tool,a:p,b:p}]);return}if(!state.pending){state.pending=p;render();return}const a=state.pending;state.pending=null;saveDrawings([...drawings(),{type:state.tool,a,b:p}])}
function drawingSvg(g){const X=p=>g.left+((p.time-g.origin)/g.step-g.first)/(g.count+g.extra-1)*(g.right-g.left),Y=p=>g.bottom-(p-g.lo)/(g.hi-g.lo)*(g.bottom-g.top),label=(x,y,s)=>`<text x="${x}" y="${y}" font-size="11" fill="#ffd166" direction="ltr">${esc(s)}</text>`;let out='';for(const d of drawings()){const x1=X(d.a),x2=X(d.b),y1=Y(d.a.price),y2=Y(d.b.price),title=`<title>${esc(wt(d.type)+' $'+pf(d.a.price)+' → $'+pf(d.b.price))}</title>`;
 if(d.type==='horizontal')out+=`<g>${title}<line x1="${g.left}" x2="${g.right}" y1="${y1}" y2="${y1}" stroke="#ffd166" stroke-width="2" stroke-dasharray="7 3"/>${label(g.left+5,y1-5,'$'+pf(d.a.price))}</g>`;
 if(d.type==='line')out+=`<g>${title}<line x1="${x1}" x2="${x2}" y1="${y1}" y2="${y2}" stroke="#ffd166" stroke-width="2.5"/></g>`;
 if(d.type==='rectangle')out+=`<g>${title}<rect x="${Math.min(x1,x2)}" y="${Math.min(y1,y2)}" width="${Math.max(1,Math.abs(x2-x1))}" height="${Math.max(1,Math.abs(y2-y1))}" fill="#ffd166" fill-opacity=".12" stroke="#ffd166"/></g>`;
 if(d.type==='drawFib')for(const ratio of [0,.236,.382,.5,.618,.786,1,1.272,1.618]){const price=d.b.price+(d.a.price-d.b.price)*ratio,y=Y(price);out+=`<g>${title}<line x1="${Math.min(x1,x2)}" x2="${g.right}" y1="${y}" y2="${y}" stroke="#ffd166" stroke-dasharray="4 5"/>${label(Math.max(g.left+3,Math.min(x1,x2)+3),y-4,'Fib '+ratio+' · $'+pf(price))}</g>`}
 }
 if(state.dragPreview){
    const d=state.dragPreview,x1=X(d.a),x2=X(d.b),y1=Y(d.a.price),y2=Y(d.b.price);
    if(d.type==='line'||d.type==='drawFib')out+=`<line x1="${x1}" x2="${x2}" y1="${y1}" y2="${y2}" stroke="#ffd166" stroke-width="2.5" stroke-dasharray="5 3"/>`;
    else if(d.type==='rectangle')out+=`<rect x="${Math.min(x1,x2)}" y="${Math.min(y1,y2)}" width="${Math.abs(x1-x2)}" height="${Math.abs(y1-y2)}" fill="#ffd166" fill-opacity=".12" stroke="#ffd166" stroke-dasharray="5 3"/>`;
    else if(d.type==='horizontal')out+=`<line x1="${g.left}" x2="${g.right}" y1="${y1}" y2="${y1}" stroke="#ffd166" stroke-dasharray="5 3"/>`;
   }
   if(state.pending)out+=`<circle cx="${X(state.pending)}" cy="${Y(state.pending.price)}" r="5" fill="#ffd166"/>`;
 return `<g clip-path="url(#drDrawingClip)">${out}</g>`;
}
function bindInteractive(panel){
 panel.addEventListener('wheel',e=>{if(!e.target.closest('svg[data-dr-interactive]')||!state.result)return;e.preventDefault();const r=e.target.closest('svg').getBoundingClientRect();zoom(e.deltaY>0?1.15:.87,Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)))},{passive:false});
 panel.addEventListener('pointerdown',e=>{
  const canvas=e.target.closest('svg[data-dr-interactive]');if(!canvas||!state.result||e.button>0)return;
  e.preventDefault();state.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  try{panel.setPointerCapture?.(e.pointerId)}catch(_){}
  if(state.pointers.size===1){state.dragPreview=null;state.gesture={startX:e.clientX,startY:e.clientY,offset:state.view.offset,moved:false,multitouch:false,rect:canvas.getBoundingClientRect(),point:pointFromEvent(e)}}
  else if(state.gesture){state.gesture.moved=true;state.gesture.multitouch=true;const a=[...state.pointers.values()];state.gesture.distance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}
 });
 panel.addEventListener('pointermove',e=>{
  if(!state.pointers.has(e.pointerId)||!state.gesture)return;e.preventDefault();state.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const g=state.gesture;if(state.pointers.size===2){const a=[...state.pointers.values()],distance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(g.distance&&distance>0)zoom(g.distance/distance);g.distance=distance;state.dragPreview=null;return}
  if(Math.hypot(e.clientX-g.startX,e.clientY-g.startY)>7)g.moved=true;
  if(state.tool==='pan'&&g.moved){state.view.offset=g.offset+(e.clientX-g.startX)*state.view.count/Math.max(1,g.rect.width);viewport(state.result.bars.length);queuePaint()}
  else if(state.tool!=='pan'&&g.moved&&!g.multitouch&&g.point){const finish=pointFromClient(e.clientX,e.clientY,g.rect);if(finish){state.dragPreview={type:state.tool,a:g.point,b:finish};queuePaint()}}
 });
 const release=e=>{
  if(!state.pointers.has(e.pointerId))return;const g=state.gesture;state.pointers.delete(e.pointerId);
  if(!state.pointers.size){
   state.gesture=null;const wasPreview=!!state.dragPreview;state.dragPreview=null;
   if(e.type==='pointerup'&&g&&!g.multitouch&&state.tool!=='pan'){
    if(g.moved&&g.point){const endpoint=pointFromClient(e.clientX,e.clientY,g.rect);if(endpoint){state.pending=null;saveDrawings([...drawings(),{type:state.tool,a:g.point,b:state.tool==='horizontal'?g.point:endpoint}]);return}}
    if(!g.moved&&g.point){addPoint(g.point);return}
   }
   if(wasPreview)queuePaint();
  }else if(g){const remaining=[...state.pointers.values()][0];g.moved=true;g.multitouch=true;g.distance=null;g.startX=remaining.x;g.startY=remaining.y;g.offset=state.view.offset;state.dragPreview=null}
 };
 panel.addEventListener('pointerup',release);panel.addEventListener('pointercancel',release);
 panel.addEventListener('keydown',e=>{if(!e.target.matches('svg[data-dr-interactive]'))return;if(e.key==='+'||e.key==='='){e.preventDefault();zoom(.75)}if(e.key==='-'){e.preventDefault();zoom(1.3333)}if(e.key==='ArrowLeft'){e.preventDefault();pan(10)}if(e.key==='ArrowRight'){e.preventDefault();pan(-10)}if(e.key==='0'){e.preventDefault();fit()}});
}
const copy={
 en:{internalProtection:'Internal protected swings',reason:'Protection confirmed by',initial:'Initial / pending further BOS',confirmedStructure:'Confirmed BOS protection',externalScope:'External',internalScope:'Internal',title:'Market structure & Fibonacci',loading:'Loading closed candles…',error:'Could not refresh candles. Retry.',retry:'Refresh',structure:'BOS / CHoCH',pivots:'HH / HL / LH / LL',protection:'Protected highs / lows',fvg:'Active FVG',fib:'Fib retracement',extensions:'2-point extensions',trendExtensions:'3-point extensions',sweeps:'Liquidity sweeps',timeZones:'Fib time zones',fan:'Fib fan',orderBlocks:'Order blocks',ema20:'EMA 20',ema50:'EMA 50',ema200:'EMA 200',bollinger:'Bollinger (20,2)',volume:'Volume + MA20',rsi:'RSI 14',macd:'MACD (12,26,9)',atr:'ATR 14',liquidity:'Liquidity lines',poc:'POC / VAH / VAL',volumeProfile:'Volume Profile (est.)',indicators:'Indicators',structureTools:'Structure & order blocks',indicatorTools:'Technical indicators',noOrderBlocks:'No confirmed active order blocks on this timeframe',full:'Full screen',exitFull:'Exit full screen',note:'Closed candles only. Pivots need 3 subsequent closed candles; hover a label for its confirmation time. Readiness uses 4H, independently of this chart timeframe.',bias:'Structure',range:'Range',long:'Bullish',short:'Bearish',high:'Protected high',low:'Protected low',gap:'FVG',partial:'Partially filled',unfilled:'Unfilled',none:'No confirmed level',anchors:'Confirmed Fib anchors A → B',third:'C',waitingC:'A confirmed retracement point C is needed for 3-point extensions.',equilibrium:'Equilibrium 0.5',golden:'Fib 0.618–0.786',premium:'Premium',discount:'Discount',confirmed:'Confirmed',asof:'Closed at',timeNote:'Time zones are ratio markers, not activation forecasts.'},
 ar:{internalProtection:'القمم والقيعان الداخلية المحمية',reason:'سبب الحماية',initial:'مبدئي / ينتظر BOS جديد',confirmedStructure:'حماية مؤكدة بكسر البنية',externalScope:'الهيكل الخارجي',internalScope:'الهيكل الداخلي',title:'هيكل السوق وفيبوناتشي',loading:'تحميل الشموع المغلقة…',error:'تعذر تحديث الشموع. أعد المحاولة.',retry:'تحديث',structure:'BOS / CHoCH',pivots:'القمم والقيعان HH / HL / LH / LL',protection:'القمم والقيعان المحمية',fvg:'فجوات FVG النشطة',fib:'تصحيح فيبوناتشي',extensions:'امتدادات نقطتين',trendExtensions:'امتدادات ثلاث نقاط',sweeps:'سحب السيولة',timeZones:'مناطق فيبوناتشي الزمنية',fan:'مروحة فيبوناتشي',orderBlocks:'مناطق الأوردر بلوك',ema20:'متوسط EMA 20',ema50:'متوسط EMA 50',ema200:'متوسط EMA 200',bollinger:'بولينجر (20،2)',volume:'الحجم ومتوسط 20',rsi:'RSI 14',macd:'MACD (12،26،9)',atr:'ATR 14',liquidity:'خطوط السيولة',poc:'POC / VAH / VAL',volumeProfile:'بروفايل الحجم (تقديري)',indicators:'المؤشرات',structureTools:'الهيكل والأوردر بلوك',indicatorTools:'المؤشرات الفنية',noOrderBlocks:'لا توجد مناطق أوردر بلوك نشطة مؤكدة على هذا الفريم',full:'ملء الشاشة',exitFull:'إغلاق ملء الشاشة',note:'شموع مغلقة فقط. تأكيد القمة أو القاع بعد 3 شموع لاحقة؛ مرّر فوق العلامة لمعرفة وقت التأكيد. تصنيف الجاهزية يستخدم 4 ساعات مستقلًا عن فريم هذه الخريطة.',bias:'الهيكل',range:'نطاق عرضي',long:'صاعد',short:'هابط',high:'قمة محمية',low:'قاع محمي',gap:'FVG',partial:'ممتلئة جزئيًا',unfilled:'غير ممتلئة',none:'لا يوجد مستوى مؤكد',anchors:'نقطتا فيبوناتشي المؤكدتان A ← B',third:'C',waitingC:'امتدادات الثلاث نقاط تنتظر تأكيد نقطة التصحيح C.',equilibrium:'التوازن 0.5',golden:'فيبوناتشي 0.618–0.786',premium:'النصف العلوي',discount:'النصف السفلي',confirmed:'وقت التأكيد',asof:'آخر إغلاق',timeNote:'المناطق الزمنية علامات نسبية وليست توقعًا لموعد التفعيل.'},
 ru:{internalProtection:'Внутренние защищённые экстремумы',reason:'Причина защиты',initial:'Предварительно / ожидание BOS',confirmedStructure:'Подтверждено BOS',externalScope:'Внешняя',internalScope:'Внутренняя',title:'Структура рынка и Фибоначчи',loading:'Загрузка закрытых свечей…',error:'Не удалось обновить свечи.',retry:'Обновить',structure:'BOS / CHoCH',pivots:'HH / HL / LH / LL',protection:'Защищённые экстремумы',fvg:'Активные FVG',fib:'Коррекция Fib',extensions:'Расширения 2 точки',trendExtensions:'Расширения 3 точки',sweeps:'Снятие ликвидности',timeZones:'Временные зоны Fib',fan:'Веер Fib',orderBlocks:'Ордер-блоки',ema20:'EMA 20',ema50:'EMA 50',ema200:'EMA 200',bollinger:'Боллинджер (20,2)',volume:'Объём + MA20',rsi:'RSI 14',macd:'MACD (12,26,9)',atr:'ATR 14',liquidity:'Линии ликвидности',poc:'POC / VAH / VAL',volumeProfile:'Профиль объема (оценка)',indicators:'Индикаторы',structureTools:'Структура и ордер-блоки',indicatorTools:'Технические индикаторы',noOrderBlocks:'Нет подтверждённых активных ордер-блоков',full:'Во весь экран',exitFull:'Закрыть полный экран',note:'Только закрытые свечи. Пивот подтверждается через 3 свечи; время подтверждения в подсказке. Готовность использует 4H независимо от графика.',bias:'Структура',range:'Диапазон',long:'Бычья',short:'Медвежья',high:'Защищённый максимум',low:'Защищённый минимум',gap:'FVG',partial:'Частично заполнен',unfilled:'Не заполнен',none:'Нет подтверждённого уровня',anchors:'Подтверждённые точки Fib A → B',third:'C',waitingC:'Для расширения 3 точек нужна подтверждённая точка C.',equilibrium:'Равновесие 0.5',golden:'Fib 0.618–0.786',premium:'Премия',discount:'Дисконт',confirmed:'Подтверждено',asof:'Закрыто',timeNote:'Временные зоны — отношения, не прогноз времени.'}
};
Object.assign(copy.en,{smc:'SMC workflow',smcStages:'Ordered confirmations',smcInfo:'Sweep → CHoCH → BOS → active OB/FVG → retest. Closed candles only.'});
Object.assign(copy.ar,{smc:'تسلسل السيولة والهيكل SMC',smcStages:'التأكيدات بالترتيب',smcInfo:'سحب السيولة ← CHoCH ← BOS ← منطقة OB/FVG ← إعادة الاختبار. شموع مغلقة فقط.'});
Object.assign(copy.ru,{smc:'Последовательность SMC',smcStages:'Подтверждения по порядку',smcInfo:'Снятие ликвидности → CHoCH → BOS → зона OB/FVG → повторный тест. Закрытые свечи.'});
const lang=()=>localStorage.getItem('deeprise_language')||'en',t=k=>(copy[lang()]||copy.en)[k]||k;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pf=v=>Number(v).toLocaleString('en-US',{maximumFractionDigits:8});
const stamp=v=>new Date(v).toLocaleString(lang()==='ar'?'ar-SA':lang()==='ru'?'ru-RU':'en-GB',{timeZone:'Asia/Riyadh',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})+' UTC+3';
function toggleFullscreen(force){
 const panel=ensure();if(!panel)return;
 const next=typeof force==='boolean'?force:!state.expanded;if(next===state.expanded)return;
 if(next){
  if(window.matchMedia?.('(max-width:700px)')?.matches)state.priceFocus=true;
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
const CHART_PRESETS={
 clean:{smc:false,structure:false,pivots:false,protection:false,internalProtection:false,orderBlocks:false,fvg:false,fib:false,ema20:true,ema50:false,ema200:false,bollinger:false,volume:false,rsi:false,macd:false,atr:false,liquidity:false,poc:false,volumeProfile:false},
 structure:{smc:true,structure:true,pivots:true,protection:true,internalProtection:false,orderBlocks:true,fvg:true,fib:true,ema20:true,ema50:true,ema200:true,bollinger:false,volume:false,rsi:false,macd:false,atr:false,liquidity:true,poc:true,volumeProfile:false},
 advanced:{smc:true,structure:true,pivots:true,protection:true,internalProtection:true,orderBlocks:true,fvg:true,fib:true,ema20:true,ema50:true,ema200:true,bollinger:true,volume:true,rsi:true,macd:true,atr:true,liquidity:true,poc:true,volumeProfile:true}
};
state.preset=localStorage.getItem('deeprise_chart_preset_v185')||'structure';
if(!CHART_PRESETS[state.preset])state.preset='structure';
Object.assign(state.layers,CHART_PRESETS[state.preset]);
function setPreset(name){
 if(!CHART_PRESETS[name])return;
 state.priceFocus=false;Object.assign(state.layers,CHART_PRESETS[name]);
 state.preset=name;
 try{localStorage.setItem('deeprise_chart_preset_v185',name)}catch(_){}
 render();
}
function indicatorButton(k){
 return '<button type="button" data-toggle-indicator="'+k+'" class="'+(state.layers[k]?'active':'')+'" aria-pressed="'+Boolean(state.layers[k])+'">'+esc(t(k))+' <span data-indicator-status>'+(state.layers[k]?'●':'○')+'</span></button>';
}
function indicatorQuick(){
 const labels=lang()==='ar'?['نظيف','هيكل السوق','متقدم']:lang()==='ru'?['Чистый','Структура','Подробно']:['Clean','Structure','Advanced'];
 const presets='<div class="dr-chart-presets" role="group" aria-label="Chart density">'+Object.keys(CHART_PRESETS).map((key,i)=>'<button type="button" data-chart-preset="'+key+'" aria-pressed="'+(state.preset===key)+'" class="'+(state.preset===key?'active':'')+'">'+labels[i]+'</button>').join('')+'</div>';
 const fast='<div class="dr-fast-toggles" role="group" aria-label="Quick indicators">'+['smc','orderBlocks','fvg','liquidity','poc','volumeProfile','ema20','ema50','ema200','bollinger','volume','rsi','macd','atr','fib'].map(indicatorButton).join('')+'</div>';
 return '<div class="dr-quick-chart-controls">'+presets+fast+'</div>';
}
function extraIndicators(open){
 const groups=[['structureTools',['smc','structure','pivots','protection','internalProtection','orderBlocks','fvg','fib','sweeps','liquidity']],['indicatorTools',['ema20','ema50','ema200','rsi','macd','atr','bollinger','volume','poc','volumeProfile','extensions','trendExtensions','fan','timeZones']]];
 const inner=groups.map(([label,keys])=>'<div class="dr-quick-layer-group"><b>'+esc(t(label))+'</b><div class="dr-quick-layer-grid">'+keys.map(indicatorButton).join('')+'</div></div>').join('');
 const label=lang()==='ar'?'جميع المؤشرات وأدوات الرسم':lang()==='ru'?'Все индикаторы и инструменты':'All indicators and drawing tools';
 return '<details class="dr-extra-indicators" '+(open?'open':'')+'><summary>'+label+' ⚙</summary><section class="dr-indicator-shortcuts">'+inner+'</section></details>';
}


const guide={
 ar:[['طريقة الرسم','اختر خط الاتجاه أو أفقي أو منطقة سعرية أو فيبوناتشي، ثم اسحب بين نقطتين على الشارت. بإصبعين للتكبير.'],['القمم والقيعان المحمية','تتحدد حماية القمة أو القاع بعد كسر بنية معتبر؛ المستويات وأسعارها موضحة أسفل الشارت.'],['BOS / CHoCH','BOS كسر بنية مؤكد، وCHoCH إشارة أولية محتملة لتغير الاتجاه.'],['Order Block / FVG','مناطق سعرية محتملة وليست ضمانًا للارتداد.'],['Fibonacci','ارسم من القمة إلى القاع أو العكس؛ مستويات 0.618 و0.786 مراجع للتصحيح.'],['POC / Volume Profile','تقدير من شموع OHLCV، وليس بيانات التداول الفعلية عند كل سعر.'],['EMA / RSI / MACD / ATR','EMA للاتجاه، RSI للزخم، MACD لتحوله، وATR للتذبذب. اضغط المؤشر لإظهاره.']],
 en:[['Draw tools','Select Trendline, Horizontal, Zone or Fib and drag between two points. Pinch to zoom.'],['Protected highs/lows','Require a validated structure break; prices are listed below.'],['BOS / CHoCH','BOS confirms a structural break; CHoCH warns of possible change.'],['Order block / FVG','Potential zones, not guaranteed reversals.'],['Fibonacci','Draw between swing anchors; 0.618 and 0.786 are common references.'],['POC / Profile','Estimated using OHLCV candles, not true trade-by-trade volume at price.'],['EMA / RSI / MACD / ATR','Trend, momentum, momentum shifts and volatility. Tap a control to show the indicator.']]}
function helpPanel(){if(!state.helpOpen)return '';return '<section class="dr-chart-help" data-chart-help-panel role="region"><b>'+(lang()==='ar'?'شرح أدوات الشارت':'Chart tools explained')+'</b>'+((guide[lang()]||guide.en).map(([a,b])=>'<p><strong>'+esc(a)+'</strong> — '+esc(b)+'</p>').join(''))+'</section>'}
function priceLegend(r){const v=viewport(r.bars.length),profile=state.layers.poc?volumeProfileFor(r.bars.slice(v.first,v.end),32):null;const levels=[['Close',r.bars.at(-1)?.close],['PH',state.layers.protection?r.protectedHigh?.price:null],['PL',state.layers.protection?r.protectedLow?.price:null],['POC est.',profile?.poc],['VAH est.',profile?.vah],['VAL est.',profile?.val],['Fib 0.618',state.layers.fib?r.fib?.levels?.find(x=>Math.abs(x.ratio-.618)<.001)?.price:null]].filter(x=>Number.isFinite(x[1]));return levels.map(([name,price])=>'<span><small>'+esc(name)+'</small> <b>$'+pf(price)+'</b></span>').join('')}
function activateChartButton(target){
 const btn=target?.closest?.('button[data-chart-preset],button[data-toggle-indicator],button[data-structure-fullscreen],button[data-chart-zoom],button[data-chart-pan],button[data-chart-fit],button[data-chart-tool],button[data-chart-undo],button[data-chart-clear],button[data-chart-cancel],button[data-chart-help],button[data-chart-price-focus],button[data-structure-tf],button[data-structure-refresh]');
 if(!btn||btn.disabled)return false;
 if(btn.hasAttribute('data-chart-help')){state.helpOpen=!state.helpOpen;render();return true}
 if(btn.hasAttribute('data-chart-price-focus')){state.priceFocus=!state.priceFocus;render();return true}
 if(btn.hasAttribute('data-chart-preset')){setPreset(btn.dataset.chartPreset);return true}
 if(btn.hasAttribute('data-structure-fullscreen')){toggleFullscreen();return true}
 if(btn.hasAttribute('data-toggle-indicator')){const key=btn.dataset.toggleIndicator;updateLayer(key,!state.layers[key]);return true}
 if(btn.hasAttribute('data-chart-zoom')){zoom(Number(btn.dataset.chartZoom));return true}
 if(btn.hasAttribute('data-chart-pan')){pan(Number(btn.dataset.chartPan)*Math.max(5,state.view.count*.25));return true}
 if(btn.hasAttribute('data-chart-fit')){fit();return true}
 if(btn.hasAttribute('data-chart-tool')){state.tool=btn.dataset.chartTool;state.pending=null;state.dragPreview=null;render();return true}
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
  panel.addEventListener('contextmenu',e=>{if(e.target.closest('svg[data-dr-interactive]'))e.preventDefault()});
 // Delegated click persists when render() replaces controls.
 panel.addEventListener('click',e=>{if(activateChartButton(e.target)){e.preventDefault();e.stopPropagation()}},true);
 // WebKit can drop synthetic click after touchend during frequent chart updates.
 // Fire stationary real touches directly and cancel duplicate synthetic clicks.
 let touch=null;
 const selector='button[data-chart-preset],button[data-toggle-indicator],button[data-structure-fullscreen],button[data-chart-zoom],button[data-chart-pan],button[data-chart-fit],button[data-chart-tool],button[data-chart-undo],button[data-chart-clear],button[data-chart-cancel],button[data-chart-help],button[data-chart-price-focus],button[data-structure-tf],button[data-structure-refresh]';
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
 const {bars,pivots,events,gaps,sweeps,fib}=result,{first,end,count}=viewport(bars.length),visible=bars.slice(first,end),host=document.querySelector('#drStructurePanel .dr-structure-scroll'),W=Math.max(320,Math.min(1700,host?.clientWidth||document.getElementById('drStructurePanel')?.clientWidth||1120)),mobile=W<650,left=mobile?14:20,right=W-(mobile?72:112),top=32,extra=mobile?7:12;
 const paneSpecs=[['volume',state.layers.volume,mobile?28:54],['rsi',state.layers.rsi,mobile?36:70],['macd',state.layers.macd,mobile?43:88],['atr',state.layers.atr,mobile?30:60]].filter(([,on])=>on&&!(state.expanded&&state.priceFocus));
 const gap=mobile?13:21,paneTotal=paneSpecs.reduce((n,a)=>n+a[2]+gap,0),target=state.expanded&&host?.clientHeight>250?host.clientHeight:(mobile?600:740),bottom=Math.max(mobile?228:350,target-paneTotal-34),panes={};let cursor=bottom+20;
 for(const [name,,height] of paneSpecs){panes[name]={top:cursor,bottom:cursor+height};cursor+=height+gap}
 const H=cursor+12;
 const study=studies(bars),active=gaps.filter(g=>g.status!=='FILLED'),values=visible.flatMap(b=>[b.high,b.low]);
  const profile=(state.layers.poc||state.layers.volumeProfile)?volumeProfileFor(visible,W<650?32:56):null;
 if(state.layers.ema20)values.push(...study.ema20.slice(first,end).filter(Number.isFinite));
 if(state.layers.ema50)values.push(...study.ema50.slice(first,end).filter(Number.isFinite));
  if(state.layers.ema200)values.push(...study.ema200.slice(first,end).filter(Number.isFinite));
 if(state.layers.bollinger)values.push(...study.bbTop.slice(first,end).filter(Number.isFinite),...study.bbBottom.slice(first,end).filter(Number.isFinite));
 if(state.layers.protection)for(const p of [result.protectedHigh,result.protectedLow])if(p)values.push(p.price);
  if(state.layers.internalProtection&&result.internal)for(const p of [result.internal.protectedHigh,result.internal.protectedLow])if(p)values.push(p.price);
 if(fib&&state.layers.fib)values.push(...fib.levels.map(l=>l.price));
 if(fib&&state.layers.extensions)values.push(...fib.extensions.map(l=>l.price));
 if(fib&&state.layers.trendExtensions)values.push(...fib.trendExtensions.map(l=>l.price));
 const min=Math.min(...values),max=Math.max(...values),pad=(max-min)*.1||min*.01,lo=min-pad,hi=max+pad;
 const X=i=>left+(i-first)/(visible.length+extra-1)*(right-left),Y=p=>bottom-(p-lo)/(hi-lo)*(bottom-top),green='#35e0a1',red='#ff6574',gold='#ffd166';
 state.geometry={W,H,left,right,top,bottom,first,count,extra,lo,hi,origin:bars[0].time,step:result.intervalMs};
 const text=(x,y,label,color='#a7bccf',size=10)=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" direction="ltr">${esc(label)}</text>`;
 const line=(price,label,color,dash='5 4',start=left)=>{const y=Y(price);return Number.isFinite(y)?'<g data-chart-level="'+esc(label)+'"><title>'+esc(label+' · $'+pf(price))+'</title><line x1="'+start+'" x2="'+right+'" y1="'+y+'" y2="'+y+'" stroke="'+color+'" stroke-dasharray="'+dash+'" stroke-width="1.3" opacity=".8"/></g>':''};
 let out='';
  if(profile&&state.layers.volumeProfile){
    const maxBar=(right-left)*(W<650?.24:.19);
    out+='<g data-volume-profile="estimated-ohlcv" aria-label="Estimated visible range volume by candle (not tick volume)">';
    profile.volumes.forEach((amount,i)=>{
      if(!(amount>0))return;
      const from=profile.low+i*profile.size,to=from+profile.size,y=Y(to),h=Math.max(1,Y(from)-y),barWidth=Math.max(1,maxBar*amount/profile.maxVolume);
      out+=`<rect x="${right-barWidth}" y="${y}" width="${barWidth}" height="${h}" fill="${i>=profile.start&&i<=profile.stop?'#7faed4':'#557b9a'}" fill-opacity="${i>=profile.start&&i<=profile.stop?'.29':'.14'}" pointer-events="none"/>`;
    });
    out+='</g>';
  }
  for(let i=0;i<=5;i++){const p=lo+(hi-lo)*i/5;out+=`<line x1="${left}" x2="${right}" y1="${Y(p)}" y2="${Y(p)}" stroke="#173148"/>`+text(right+5,Y(p)+3,'$'+pf(p),'#a9cada',mobile?9:11)}
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
 if(state.layers.bollinger)out+=drawStudy(study.bbTop,'#9c8ada','5 4')+drawStudy(study.bbMid,'#c3a8ec','4 5')+drawStudy(study.bbBottom,'#9c8ada','5 4');
 if(profile&&state.layers.poc){
   out+=`<g data-poc-price="${profile.poc}" data-value-area="70" aria-label="Estimated POC and 70 percent value area"><title>Estimated candle-volume profile: POC ${pf(profile.poc)}, VAH ${pf(profile.vah)}, VAL ${pf(profile.val)}. Not tick-by-tick traded volume.</title>${line(profile.poc,'POC est.','#ffe083','4 3')}${line(profile.vah,'VAH','#76afdc','3 5')}${line(profile.val,'VAL','#76afdc','3 5')}</g>`;
  }
  if(state.layers.ema20)out+=drawStudy(study.ema20,'#ffce77');
 if(state.layers.ema50)out+=drawStudy(study.ema50,'#72affd');
  if(state.layers.ema200)out+=drawStudy(study.ema200,'#ef85f5');
 if(fib&&state.layers.extensions)fib.extensions.forEach(l=>{if(l.price>=lo&&l.price<=hi)out+=line(l.price,'Ext '+l.ratio,'#cf9fff','2 6')});
 if(fib&&state.layers.trendExtensions)fib.trendExtensions.forEach(l=>{if(l.price>=lo&&l.price<=hi)out+=line(l.price,'ABC '+l.ratio,'#76d6ee','8 4')});
 if(fib&&state.layers.timeZones){const unit=fib.end.index-fib.start.index;for(const r of [1,2,3,5,8,13]){const idx=fib.start.index+unit*r;if(idx<first||idx>end+extra-1)continue;const x=X(idx);out+=`<line x1="${x}" x2="${x}" y1="${top}" y2="${bottom}" stroke="#c084fc" stroke-dasharray="3 7" opacity=".4"/>`+text(x+3,top+10,'T '+r,'#c084fc')}}
 if(fib&&state.layers.fan){const x1=X(fib.start.index),x2=X(fib.end.index);if(x2>x1)for(const ratio of [.382,.5,.618]){const y1=Y(fib.start.price),y2=Y(fib.start.price+(fib.end.price-fib.start.price)*ratio),endY=y1+(y2-y1)*(right-x1)/(x2-x1);out+=`<line x1="${x1}" x2="${right}" y1="${y1}" y2="${endY}" stroke="#9d8bcd" stroke-dasharray="6 5"/>`}}
 const width=Math.max(3,(right-left)/(visible.length+extra)*.76);
 visible.forEach((b,j)=>{const x=X(first+j),color=b.close>=b.open?green:red;out+=`<g><title>${esc(stamp(b.closeTime)+' • O '+pf(b.open)+' H '+pf(b.high)+' L '+pf(b.low)+' C '+pf(b.close))}</title><line x1="${x}" x2="${x}" y1="${Y(b.high)}" y2="${Y(b.low)}" stroke="${color}"/><rect x="${x-width/2}" y="${Math.min(Y(b.open),Y(b.close))}" width="${width}" height="${Math.max(1,Math.abs(Y(b.open)-Y(b.close)))}" fill="${color}"/></g>`;if(j%15===0)out+=text(x,bottom+25,new Date(b.time).toISOString().slice(5,16).replace('T',' '),'#6e879c',9)});
 if(panes.volume){
   const p=panes.volume,maxVolume=Math.max(1,...visible.map((b,j)=>Math.max(Number(b.volume)||0,Number(study.volMA[first+j])||0)));
   const y=v=>p.bottom-v/maxVolume*(p.bottom-p.top);
   out+=`<line x1="${left}" x2="${right}" y1="${p.bottom}" y2="${p.bottom}" stroke="#29445a"/>${text(left,p.top-5,t('volume')+' MA20 · '+(Number.isFinite(study.volMA[end-1])?((Number(visible.at(-1)?.volume)||0)/study.volMA[end-1]).toFixed(2)+'×':'—'),'#9bb8ca',10)}`;
   visible.forEach((b,j)=>{const x=X(first+j),height=Math.max(1,p.bottom-y(Number(b.volume)||0)),color=b.close>=b.open?green:red;out+=`<rect x="${x-width/2}" y="${p.bottom-height}" width="${width}" height="${height}" fill="${color}" fill-opacity=".58"/>`});
   let volPath='',active=false;for(let i=first;i<end;i++){if(!Number.isFinite(study.volMA[i])){active=false;continue}volPath+=(active?' L ':'M ')+X(i).toFixed(1)+' '+y(study.volMA[i]).toFixed(1);active=true}
   out+=`<path d="${volPath}" stroke="#f5d37c" stroke-width="1.5" fill="none" vector-effect="non-scaling-stroke"/>`;
  }
  if(panes.rsi){
   const p=panes.rsi,rY=n=>p.bottom-n/100*(p.bottom-p.top);
   for(const level of [30,50,70])out+=`<line x1="${left}" x2="${right}" y1="${rY(level)}" y2="${rY(level)}" stroke="#52627a" stroke-dasharray="4 5" opacity=".6"/>${text(right+5,rY(level)+4,level,'#9bb8ca',9)}`;
   let path='',active=false;for(let i=first;i<end;i++){if(!Number.isFinite(study.rsi[i])){active=false;continue}path+=(active?' L ':'M ')+X(i).toFixed(1)+' '+rY(study.rsi[i]).toFixed(1);active=true}
   const last=study.rsi[end-1];out+=`<path d="${path}" fill="none" stroke="#bba2ff" stroke-width="2" vector-effect="non-scaling-stroke"/>${text(left,p.top-4,'RSI 14'+(Number.isFinite(last)?' · '+last.toFixed(1):''),'#bba2ff',10)}`;
  }
  if(panes.macd){
   const p=panes.macd,series=[...study.macd.slice(first,end),...study.macdSignal.slice(first,end),...study.macdHist.slice(first,end)].filter(Number.isFinite),extent=Math.max(...series.map(Math.abs),1e-9),center=(p.top+p.bottom)/2,dy=extent?((p.bottom-p.top)*.46)/extent:1;
   const my=v=>center-v*dy;
   out+=`<line x1="${left}" x2="${right}" y1="${center}" y2="${center}" stroke="#416074" stroke-dasharray="3 4"/>${text(left,p.top-5,'MACD 12/26/9 · '+(Number.isFinite(study.macdHist[end-1])?pf(study.macdHist[end-1]):'—'),'#8cc7ff',10)}`;
   for(let i=first;i<end;i++){const v=study.macdHist[i];if(Number.isFinite(v))out+=`<rect x="${X(i)-width/2}" y="${Math.min(center,my(v))}" width="${width}" height="${Math.max(1,Math.abs(v*dy))}" fill="${v>=0?green:red}" opacity=".65"/>`}
   for(const [key,color] of [['macd','#68b8ff'],['macdSignal','#ffbb7c']]){let path='',active=false;for(let i=first;i<end;i++){const v=study[key][i];if(!Number.isFinite(v)){active=false;continue}path+=(active?' L ':'M ')+X(i).toFixed(1)+' '+my(v).toFixed(1);active=true}out+=`<path d="${path}" fill="none" stroke="${color}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`}
  }
  if(panes.atr){
   const p=panes.atr,vals=study.atr.slice(first,end).filter(Number.isFinite),amax=Math.max(...vals,1e-9),amin=Math.max(0,Math.min(...vals,amax)*.88),ay=v=>p.bottom-(v-amin)/(amax-amin||1)*(p.bottom-p.top);
   let path='',active=false;for(let i=first;i<end;i++){const v=study.atr[i];if(!Number.isFinite(v)){active=false;continue}path+=(active?' L ':'M ')+X(i).toFixed(1)+' '+ay(v).toFixed(1);active=true}
   const val=study.atr[end-1],ratio=Number.isFinite(val)&&visible.length?100*val/visible.at(-1).close:null;
   out+=`<path d="${path}" fill="none" stroke="#e2a4f1" stroke-width="2" vector-effect="non-scaling-stroke"/>${text(left,p.top-5,'ATR 14 · '+(Number.isFinite(val)?pf(val):'—')+(ratio!==null?' ('+ratio.toFixed(2)+'%)':''),'#e2a4f1',10)}`;
  }
 if(state.layers.pivots)for(const p of pivots.filter(p=>p.index>=first&&p.index<end)){const y=Y(p.price)+(p.type==='HIGH'?-8:17);out+=`<g><title>${esc(p.label+' $'+pf(p.price)+' • '+t('confirmed')+': '+stamp(p.confirmedAt))}</title>${text(X(p.index)-7,y,p.label,p.type==='HIGH'?red:green)}</g>`}
 if(state.layers.structure)for(const e of events.filter(e=>e.index>=first&&e.index<end)){const x1=Math.max(left,X(e.pivotIndex)),x2=X(e.index),color=e.side==='LONG'?green:red;out+=`<g><title>${esc(e.type+' '+e.side+' • '+stamp(e.confirmedAt))}</title><line x1="${x1}" x2="${x2}" y1="${Y(e.price)}" y2="${Y(e.price)}" stroke="${color}" stroke-width="2"/>${text((x1+x2)/2,Y(e.price)-5,e.type==='CHOCH'?'CHoCH':'BOS',color,11)}<circle cx="${x2}" cy="${Y(e.price)}" r="3" fill="${color}"/></g>`}
 if(state.layers.smc&&result.smc){
  const seq=result.smc[result.bias]||(result.smc.LONG?.sweep?.index>=result.smc.SHORT?.sweep?.index?result.smc.LONG:result.smc.SHORT);
  for(const [label,e,p] of [['SW',seq?.sweep,seq?.sweep?.price],['CH',seq?.choch,seq?.choch?.price],['BOS',seq?.bos,seq?.bos?.price]]){
   if(!e||e.index<first||e.index>=end||!Number.isFinite(p))continue;
   const cx=X(e.index),cy=Y(p),color=seq.side==='LONG'?green:red;
   out+='<g><title>'+esc(label+' · '+seq.side+' · '+stamp(bars[e.index].closeTime))+'</title><circle cx="'+cx+'" cy="'+cy+'" r="7" fill="#071827" stroke="'+color+'" stroke-width="1.8"/>'+text(cx-7,cy-11,label,color,10)+'</g>';
  }
  if(seq?.retestIndex!==null&&Number.isInteger(seq?.retestIndex)&&seq.retestIndex>=first&&seq.retestIndex<end&&seq.zone){
   out+='<g><title>'+esc('SMC retest · '+seq.zone.type)+'</title>'+text(X(seq.retestIndex),Y((seq.zone.upper+seq.zone.lower)/2)-12,'RETEST',gold,10)+'</g>';
  }
 }
 if(state.layers.sweeps)for(const s of sweeps.filter(s=>s.index>=first&&s.index<end).slice(-12))out+=text(X(s.index)-4,Y(s.price)+(s.side==='LONG'?22:-16),'SW',gold);
 if(state.layers.liquidity&&pivots.length){
    const latest=Math.max(1e-10,...study.atr.filter(Number.isFinite).slice(-20)),tol=latest*.20;
    const levels=[];
    for(const kind of ['HIGH','LOW']){
     const candidates=pivots.filter(p=>p.type===kind&&p.confirmedIndex<bars.length).slice(-22),clusters=[];
     for(const p of candidates){let c=clusters.find(x=>Math.abs(x.price-p.price)<=tol);
       if(c){c.items.push(p);c.price=c.items.reduce((a,z)=>a+z.price,0)/c.items.length}
       else clusters.push({price:p.price,items:[p]});
     }
     const last=bars.at(-1).close;
     const selected=clusters.filter(x=>x.items.length>=2&&(kind==='HIGH'?x.price>last:x.price<last)).sort((a,b)=>b.items.at(-1).index-a.items.at(-1).index).slice(0,2);
     levels.push(...selected.map(x=>({...x,kind})));
    }
    for(const c of levels){
     const color=c.kind==='HIGH'?'#ffb16b':'#65e1bc',x=Math.max(left,Math.min(right-40,X(c.items[0].index)));
     out+=`<g><title>${esc((c.kind==='HIGH'?'Potential buy-side liquidity':'Potential sell-side liquidity')+' · '+c.items.length+' confirmed pivots · $'+pf(c.price))}</title>${line(c.price,(c.kind==='HIGH'?'BSL':'SSL')+' ×'+c.items.length,color,'3 5',x)}</g>`;
    }
   }
  if(state.layers.protection)for(const [key,p] of [['high',result.protectedHigh],['low',result.protectedLow]])if(p){
   const detail=p.protection;
   out+='<g><title>'+esc(t('externalScope')+' · '+t(key)+' · '+(detail?.eventType||'BOS')+
    ' · '+(detail?.quality||'INITIAL')+' · '+t('confirmed')+': '+stamp(detail?.breakTime||p.confirmedAt))+
    '</title>'+line(p.price,key==='high'?'EX PH':'EX PL',key==='low'?green:red,'8 4',Math.max(left,X(p.index)))+'</g>';
  }
  if(state.layers.internalProtection&&result.internal)for(const [key,p] of [['high',result.internal.protectedHigh],['low',result.internal.protectedLow]])if(p&&p.price!==(key==='high'?result.protectedHigh?.price:result.protectedLow?.price)){
   out+='<g><title>'+esc(t('internalScope')+' · '+t(key)+' · '+stamp(p.protection?.breakTime||p.confirmedAt))+
    '</title>'+line(p.price,key==='high'?'IN PH':'IN PL',key==='low'?'#8defc7':'#ffb2ab','3 6',Math.max(left,X(p.index)))+'</g>';
  }
 const last=visible.at(-1);if(last){const y=Y(last.close);out+='<g data-last-close-price="'+last.close+'"><line x1="'+left+'" x2="'+right+'" y1="'+y+'" y2="'+y+'" stroke="#b1ffe3" stroke-dasharray="3 4"/><rect x="'+(right+1)+'" y="'+(y-10)+'" width="'+(W-right-2)+'" height="20" rx="4" fill="#125b4e"/><text x="'+(right+4)+'" y="'+(y+3)+'" font-size="'+(mobile?9:12)+'" fill="#fff" direction="ltr">$'+pf(last.close)+'</text></g>'}
 out+=text(left,26,state.symbol+' • '+state.tf+' • '+t('asof')+' '+stamp(result.barClose),'#d8e7f3',mobile?9:11);
 return `<svg viewBox="0 0 ${W} ${H}" data-dr-interactive tabindex="0" role="application" aria-label="${esc(t('title')+' '+state.symbol+' '+state.tf)}"><defs><clipPath id="drDrawingClip"><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}"/></clipPath><clipPath id="drStructureClip"><rect x="${left}" y="0" width="${W-left}" height="${H}"/></clipPath></defs><g clip-path="url(#drStructureClip)">${out}</g>${drawingSvg(state.geometry)}</svg>`;
}

function smcCard(r){
 const all=r?.smc;if(!all)return '';
 const a=all.LONG,b=all.SHORT;
 const side=r.bias==='LONG'?'LONG':r.bias==='SHORT'?'SHORT':((a?.sweep?.index??-1)>=(b?.sweep?.index??-1)?'LONG':'SHORT');
 const q=all[side];if(!q)return '';
 const phases={en:{WAIT_SWEEP:'Waiting for a liquidity sweep',WAIT_CHOCH:'Waiting for CHoCH',WAIT_BOS:'Waiting for continuation BOS',WAIT_ZONE:'Waiting for an active OB/FVG',WAIT_RETEST:'Waiting for zone retest',READY:'SMC sequence confirmed',INVALIDATED:'Swept extreme invalidated',EXPIRED:'Sequence expired',NO_DATA:'No data'},
 ar:{WAIT_SWEEP:'انتظار سحب السيولة',WAIT_CHOCH:'انتظار تغير الشخصية CHoCH',WAIT_BOS:'انتظار كسر الاستمرار BOS',WAIT_ZONE:'انتظار منطقة OB/FVG نشطة',WAIT_RETEST:'انتظار إعادة اختبار المنطقة',READY:'تسلسل SMC مكتمل',INVALIDATED:'كُسرت منطقة الإبطال بعد سحب السيولة',EXPIRED:'انتهت صلاحية التسلسل',NO_DATA:'لا توجد بيانات'},
 ru:{WAIT_SWEEP:'Ожидание снятия ликвидности',WAIT_CHOCH:'Ожидание CHoCH',WAIT_BOS:'Ожидание BOS',WAIT_ZONE:'Ожидание OB/FVG',WAIT_RETEST:'Ожидание ретеста зоны',READY:'Последовательность подтверждена',INVALIDATED:'Экстремум пробит',EXPIRED:'Сетап устарел',NO_DATA:'Нет данных'}};
 const names=lang()==='ar'?['سحب السيولة','CHoCH','BOS','OB/FVG','إعادة الاختبار']:lang()==='ru'?['Ликвидность','CHoCH','BOS','OB/FVG','Ретест']:['Liquidity sweep','CHoCH','BOS','OB/FVG','Retest'];
 const done=['sweep','choch','bos','zone','retest'];
 const rows=done.map((key,i)=>'<span style="white-space:nowrap;color:'+(q.checks?.[key]?'#35e0a1':'#8ca5b7')+'">'+(q.checks?.[key]?'✓ ':'○ ')+esc(names[i])+'</span>').join(' <span aria-hidden="true" style="opacity:.5">→</span> ');
 const phase=(phases[lang()]||phases.en)[q.phase]||q.phase;
 return '<div class="dr-structure-note dr-smc-path" role="status"><b>'+esc(t('smcStages'))+' · '+side+' · '+esc(phase)+'</b><div style="display:flex;gap:7px;flex-wrap:wrap;margin:7px 0">'+rows+'</div>'+
  (q.zone?'<small>'+esc(q.zone.type)+' $'+pf(q.zone.lower)+' – $'+pf(q.zone.upper)+'</small>':'')+
  '<small style="display:block;margin-top:5px">'+esc(t('smcInfo'))+'</small></div>';
}

function protectionInfo(p,scope,label){
 if(!p)return '';
 const d=p.protection||{},quality=d.quality==='CONFIRMED'?t('confirmedStructure'):t('initial');
 const broken=Number.isFinite(d.brokenLevel)?'$'+pf(d.brokenLevel):'—';
 return '<div class="dr-protection-record"><b>'+esc(scope)+' · '+esc(label)+' · $'+pf(p.price)+'</b>'+
 '<span>'+esc(quality)+' · '+esc(d.eventType||'BOS')+' '+esc(t('reason'))+
 ' '+esc(broken)+(d.breakTime?' · '+esc(stamp(d.breakTime)):'')+'</span></div>';
}
function render(){const panel=ensure();if(!panel)return;panel.dir=lang()==='ar'?'rtl':'ltr';const r=state.result,fib=r?.fib;
 const header=`<div class="dr-structure-head"><b>${t('title')} • ${esc(state.symbol)}</b><div>${['5m','15m','1h','4h','1d'].map(tf=>`<button data-structure-tf="${tf}" class="${state.tf===tf?'active':''}" aria-pressed="${state.tf===tf}">${tf}</button>`).join('')}<button data-structure-refresh>${t('retry')}</button><button type="button" data-structure-fullscreen title="${t(state.expanded?'exitFull':'full')}" aria-pressed="${state.expanded}" class="dr-structure-expand">${t(state.expanded?'exitFull':'full')}</button></div></div>`;
 const selector=keys=>`<div class="dr-structure-controls">${keys.map(k=>`<label class="${state.layers[k]?'is-on':''}"><input type="checkbox" data-structure-layer="${k}" ${state.layers[k]?'checked':''}>${t(k)}</label>`).join('')}</div>`;
 const layersOpen=panel.querySelector('.dr-layer-picker')?.open??false,indicatorsOpen=panel.querySelector('.dr-indicator-picker')?.open??false,extraOpen=panel.querySelector('.dr-extra-indicators')?.open??false;
 const controls=selector(Object.keys(state.layers).filter(k=>!INDICATORS.has(k))),indicatorControls=selector([...INDICATORS]);
 const status=state.loading?t('loading'):state.error?t('error')+(state.errorMessage?' · '+esc(state.errorMessage):''):'';
 let body=status?`<div class="dr-structure-status" role="status">${status}</div>`:'';
 // Never leave the preceding symbol or timeframe's chart under a new heading.
 if(r&&!state.error){body+=`<div class="dr-structure-summary"><span>${t('bias')}: <b>${t(r.bias==='LONG'?'long':r.bias==='SHORT'?'short':'range')}</b></span><span>${t('low')}: <b>${r.protectedLow?'$'+pf(r.protectedLow.price):'—'}</b></span><span>${t('high')}: <b>${r.protectedHigh?'$'+pf(r.protectedHigh.price):'—'}</b></span><span>FVG: <b>${r.gaps.filter(g=>g.status!=='FILLED').length}</b></span><span>OB: <b>${(r.blocks||[]).filter(b=>b.status!=='INVALID').length}</b></span></div>${smcCard(r)}${toolBar()}<div class="dr-structure-scroll" dir="ltr">${svg(r)}</div><div class="dr-chart-levels" data-chart-levels dir="ltr">${priceLegend(r)}</div>${helpPanel()}`;
  if(fib)body+=`<div class="dr-structure-note">${t('anchors')}: $${pf(fib.start.price)} → $${pf(fib.end.price)} • ${fib.side}${fib.third?' • C $'+pf(fib.third.price):''}<br>${t('golden')}: $${pf(fib.golden[0])} – $${pf(fib.golden[1])} • ${t('equilibrium')}: $${pf(fib.equilibrium)}${state.layers.trendExtensions&&!fib.third?'<br>'+t('waitingC'):''}</div>`;
 }
 if(r&&!state.error)body+='<div class="dr-protection-records">'+
  protectionInfo(r.protectedHigh,t('externalScope'),t('high'))+
  protectionInfo(r.protectedLow,t('externalScope'),t('low'))+
  protectionInfo(r.internal?.protectedHigh,t('internalScope'),t('high'))+
  protectionInfo(r.internal?.protectedLow,t('internalScope'),t('low'))+'</div>';
  const noOb=r&&!state.loading&&state.layers.orderBlocks&&!(r.blocks||[]).some(b=>b.status!=='INVALID')?'<div class="dr-structure-note dr-no-ob">'+esc(t('noOrderBlocks'))+'</div>':'';
 panel.innerHTML=header+indicatorQuick()+`<div class="dr-indicator-feedback" data-indicator-feedback role="status" aria-live="polite"></div>`+body+noOb+extraIndicators(extraOpen)+`<div class="dr-plot-options"><details class="dr-layer-picker" ${layersOpen?'open':''}><summary>${wt('layers')}</summary>${controls}</details><details class="dr-indicator-picker" ${indicatorsOpen?'open':''}><summary>${t('indicators')}</summary>${indicatorControls}</details></div><div class="dr-structure-note">${t('note')}${state.layers.timeZones?'<br>'+t('timeNote'):''}</div>`;
 if(r&&!state.error)requestAnimationFrame(()=>{if(panel.isConnected&&!state.pointers.size)paintChart()});
}
async function load(symbol,tf='4h',force=false){
 if(!symbol)return;symbol=String(symbol).replace(/[^A-Z0-9]/gi,'').toUpperCase();const token=++state.token;state.controller?.abort();if(state.symbol!==symbol||state.tf!==tf){state.view={count:defaultCount(),offset:0};state.pending=null;state.pointers.clear();state.gesture=null;state.dragPreview=null}state.symbol=symbol;state.tf=tf;state.result=null;state.error=false;state.errorMessage='';state.loading=true;render();
 const key=symbol+':'+tf,radar=tf==='4h'?window.DeepRisePreMove?.state.structures.get(symbol):null,localCache=state.cache.get(key),cached=(localCache?.bars?.length>=220?localCache:radar?.bars?.length>=220?radar:null);
 if(!force&&cached&&Date.now()-cached.updated<180000){state.result=cached;state.loading=false;render();return}
 const sources=['https://data-api.binance.vision','https://api.binance.com','https://api1.binance.com','https://api.binance.us'];let lastError=null;
 try{
  for(const origin of sources){
   if(token!==state.token)return;
   const controller=new AbortController();state.controller=controller;const timer=setTimeout(()=>controller.abort(),5200);
   try{
    const response=await fetch(origin+'/api/v3/klines?symbol='+encodeURIComponent(symbol)+'&interval='+encodeURIComponent(tf)+'&limit=320',{cache:'no-store',signal:controller.signal});
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
function hook(){if(typeof openChart!=='function'||openChart.__drStructure)return;const base=openChart;openChart=function(symbol){const out=base.apply(this,arguments);load(symbol,state.tf).then(()=>{if(state.result&&!state.error&&window.matchMedia?.('(max-width:650px)')?.matches&&document.getElementById('chartPanel')?.classList.contains('active')&&!state.expanded)toggleFullscreen(true)});return out};openChart.__drStructure=true;if(typeof closeChart==='function'&&!closeChart.__drStructure){const previous=closeChart;closeChart=function(){if(state.expanded)toggleFullscreen(false);return previous.apply(this,arguments)};closeChart.__drStructure=true}}
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

document.addEventListener('deeprise-premove-updated',()=>{const r=window.DeepRisePreMove?.state.structures.get(state.symbol);if(state.tf==='4h'&&r?.bars?.length>=220&&!state.loading&&r!==state.result&&(!state.result||r.barClose>state.result.barClose)){state.result=r;queuePaint()}});
window.DeepRiseStructureChart={version:'18.8',state,load,render,zoom,pan,fit,setPreset,viewport,drawings,saveDrawings,addPoint,svg,paintChart,studies,volumeProfileFor,updateLayer,toggleFullscreen};document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.expanded){e.preventDefault();e.stopImmediatePropagation();toggleFullscreen(false)}},true);
const css=document.createElement('style');css.textContent=`.dr-draw-toolbar{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;margin:12px 0}.dr-draw-toolbar>div{display:flex;flex-wrap:wrap;align-items:center;gap:5px}.dr-draw-toolbar button{padding:9px 11px;border:1px solid #29465e;background:#102236;color:#cae4f7;font-size:11px;min-height:38px}.dr-draw-toolbar button.active{border-color:#ffd166;color:#ffd166}.dr-draw-toolbar button:disabled{opacity:.35;cursor:default}.dr-draw-toolbar small{font-size:10px;color:#9bb8ca}.dr-layer-picker>summary{cursor:pointer;padding:10px;color:#65b8ff;font-size:12px}.dr-structure-scroll svg[data-dr-interactive]{touch-action:none;user-select:none;min-width:0;width:100%;display:block;outline-offset:-3px}.dr-structure-scroll{overflow:hidden!important}.dr-structure-panel:has([data-chart-tool].active:not([data-chart-tool=pan])) svg{cursor:crosshair}.dr-readiness-tabs{display:flex;flex-wrap:wrap;gap:7px;margin:13px 0}.dr-readiness-tabs button,.dr-structure-head button{border:1px solid #29465e;border-radius:8px;padding:8px 10px;background:#0b2130;color:#a9c1d1;font-size:11px;cursor:pointer}.dr-readiness-tabs button.active,.dr-structure-head button.active{border-color:#35e0a1;color:#72e8bf;background:#10382e}.dr-readiness-tabs b{margin-inline-start:6px}.dr-readiness-group{border-top:1px solid #264056;padding-top:5px;margin-top:12px;min-width:0}.dr-readiness-group h3{color:#9abbd0;font-size:14px;display:flex;gap:9px;align-items:center}.dr-readiness-group h3 span{font-size:11px;border-radius:20px;background:#163145;padding:3px 8px}.dr-readiness-group.ready h3{color:#35e0a1}.dr-readiness-group.near h3{color:#65b8ff}.dr-readiness-group.early h3{color:#ffd166}.dr-readiness-group.blocked h3{color:#ff9f62}.dr-premove-card.ready{border-color:#35e0a1}.dr-premove-card.near{border-color:#396d9b}.dr-premove-card.early{border-color:#6b5b32}.dr-premove-card.blocked{border-color:#8e533a}.dr-readiness-action{margin-top:8px;font-size:11px;color:#c5dce8;line-height:1.6}.dr-structure-panel{padding:16px;background:#071421;border-top:1px solid #26485d;min-width:0}.dr-structure-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;color:#d9edfa}.dr-structure-head>div{display:flex;gap:5px;flex-wrap:wrap}.dr-structure-controls{display:flex;flex-wrap:wrap;gap:8px 15px;margin:13px 0;font-size:11px;color:#a1bed0}.dr-structure-controls label{display:flex;gap:5px;align-items:center;cursor:pointer}.dr-structure-summary{display:flex;gap:10px 18px;flex-wrap:wrap;font-size:11px;color:#9bb8cd;margin:10px 0}.dr-structure-summary b{color:#dceef9}.dr-structure-scroll{overflow-x:auto;max-width:100%;border:1px solid #18344c;border-radius:10px;background:#050e19}.dr-structure-scroll svg{display:block;width:100%;min-width:900px;height:auto;font-family:Arial,sans-serif}.dr-structure-note{font-size:10px;color:#8da7b9;line-height:1.7;margin-top:9px;overflow-wrap:anywhere}.dr-structure-status{padding:18px;color:#ffd166}@media(min-width:1200px){.dr-readiness-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.dr-readiness-groups>.dr-readiness-group:only-child{grid-column:1/-1}}@media(max-width:700px){.dr-structure-panel{padding:11px}.dr-readiness-tabs button{padding:9px 7px;font-size:10px}.dr-premove-card{overflow-wrap:anywhere}.dr-premove-metrics b,.dr-premove-levels b{unicode-bidi:isolate;direction:ltr;display:inline-block}}`;
css.textContent+=".dr-structure-scroll svg[data-dr-interactive]{width:100%!important;min-width:0!important;height:auto;touch-action:none}.dr-draw-toolbar>div{max-width:100%;overflow-x:auto;flex-wrap:nowrap!important}.dr-draw-toolbar button{white-space:nowrap;flex-shrink:0;border-radius:7px}.dr-structure-scroll{overflow:hidden!important;contain:layout paint}.dr-chart-expanded .dr-structure-scroll svg[data-dr-interactive]{height:auto;min-height:min(50dvh,540px)}@media(max-width:650px){.dr-draw-toolbar>div{width:100%}.dr-structure-head button{min-height:38px}}";css.textContent+=".dr-plot-options{display:flex;gap:9px 18px;flex-wrap:wrap}.dr-plot-options details{flex:1 1 200px;min-width:0}.dr-indicator-picker>summary{padding:10px;color:#65b8ff;font-size:12px;cursor:pointer}.dr-plot-options .dr-structure-controls{max-height:210px;overflow-y:auto}.dr-structure-panel svg text{pointer-events:none}";css.textContent+=`.dr-no-ob{color:#ffc97b;border:1px dashed #906638;padding:8px 12px;border-radius:8px}.dr-quick-layer-group>b{font-size:12px;color:#b5d1e1;display:block;margin:7px 0}.dr-quick-layer-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.dr-indicator-shortcuts{display:block!important;margin:8px 0}.dr-indicator-shortcuts button{min-height:40px!important;text-align:center!important;white-space:normal!important;overflow-wrap:anywhere}.dr-structure-fullscreen .dr-quick-layer-grid{grid-template-columns:repeat(6,minmax(0,1fr))}@media(max-width:650px){.dr-quick-layer-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.dr-structure-fullscreen .dr-quick-layer-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.dr-structure-fullscreen .dr-quick-layer-group>b{font-size:10px}}.dr-indicator-feedback{min-height:17px;color:#9edfc5;font-size:12px;padding:1px 4px}.dr-indicator-shortcuts{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:10px 0}.dr-indicator-shortcuts button{position:relative;z-index:1;-webkit-user-select:none;user-select:none;border:1px solid #31506b;background:#0e2435;color:#c1d8e8;padding:10px 12px;border-radius:10px;font-size:12px;cursor:pointer;min-height:42px;touch-action:manipulation}.dr-indicator-shortcuts button.active{background:#10382e;border-color:#35e0a1;color:#85f0cb}.dr-indicator-shortcuts [data-indicator-status]{font-size:15px;margin-inline-start:5px}.dr-structure-controls label.is-on{color:#81e9c2}.dr-structure-expand{border-color:#35e0a1!important;color:#a3f8d8!important;font-weight:700}.dr-structure-fullscreen{position:fixed!important;inset:0!important;z-index:9999999!important;width:100vw!important;height:100dvh!important;max-height:100dvh!important;overflow:auto!important;border:0!important;border-radius:0!important;margin:0!important;padding:calc(9px + env(safe-area-inset-top,0px)) max(10px,env(safe-area-inset-right,0px)) max(12px,env(safe-area-inset-bottom,0px)) max(10px,env(safe-area-inset-left,0px))!important;box-sizing:border-box;background:#050e19!important;display:flex!important;flex-direction:column!important;overscroll-behavior:contain}.dr-structure-fullscreen .dr-structure-head{position:sticky;top:0;z-index:3;background:#050e19;padding:8px 0}.dr-structure-fullscreen .dr-draw-toolbar{margin:6px 0}.dr-structure-fullscreen .dr-plot-options{flex-shrink:0}.dr-structure-fullscreen .dr-plot-options details:not([open]){flex:0 1 auto}.dr-structure-fullscreen .dr-structure-scroll{flex:1 1 auto!important;min-height:44dvh;overflow:hidden!important;contain:none!important}.dr-structure-fullscreen .dr-structure-scroll svg[data-dr-interactive]{height:100%!important;max-height:none!important;width:100%!important;min-width:0!important}.dr-structure-immersive .dr-bottom-nav,.dr-structure-immersive #deepriseInstall{visibility:hidden!important}@media(max-width:700px){.dr-structure-fullscreen .dr-structure-head{gap:5px}.dr-structure-fullscreen .dr-structure-note{font-size:9px}.dr-structure-fullscreen .dr-indicator-shortcuts{flex-wrap:nowrap;overflow-x:auto;padding:6px 0}.dr-indicator-shortcuts button{white-space:nowrap}.dr-structure-fullscreen .dr-draw-toolbar>div{overflow-x:auto!important}}`;
css.textContent+=`.dr-structure-scroll svg[data-dr-interactive],.dr-structure-scroll svg[data-dr-interactive] *{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}.dr-protection-records{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,235px),1fr));gap:7px;margin:10px 0}.dr-protection-record{border:1px solid #29485f;background:#0a2130;padding:9px 11px;border-radius:9px;display:grid;gap:5px;font-size:11px;line-height:1.5}.dr-protection-record>b{color:#dbedf7}.dr-protection-record>span{color:#9ac2d5}.dr-structure-scroll{overscroll-behavior:contain}.dr-structure-head button,.dr-indicator-shortcuts button,.dr-draw-toolbar button{touch-action:manipulation}`;
css.textContent+="\n/* V18.5 iPhone CSS immersive with readable controls and safe-area padding */\n@media(max-width:700px){\n .dr-structure-fullscreen{position:fixed!important;inset:0!important;height:100dvh!important;max-height:100dvh!important;width:100vw!important;overflow:hidden!important;padding:calc(env(safe-area-inset-top,0px) + 4px) calc(env(safe-area-inset-right,0px) + 5px) calc(env(safe-area-inset-bottom,0px) + 5px) calc(env(safe-area-inset-left,0px) + 5px)!important;display:flex!important;flex-direction:column!important;}\n .dr-structure-fullscreen .dr-structure-head{position:relative!important;top:auto!important;flex-shrink:0;align-items:center;padding:3px 0!important;min-height:38px}\n .dr-structure-fullscreen .dr-structure-head>b{font-size:12px;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n .dr-structure-fullscreen .dr-structure-head>div{width:100%;justify-content:space-between;overflow-x:auto}\n .dr-structure-fullscreen .dr-structure-head button{padding:6px 5px!important;min-height:34px!important;min-width:36px!important;font-size:10px}\n .dr-structure-fullscreen .dr-quick-chart-controls{position:relative!important;top:auto!important;flex-shrink:0;padding:0!important;margin:0!important;gap:2px}\n .dr-structure-fullscreen .dr-chart-presets button{min-height:28px!important;padding:4px!important;font-size:10px}\n .dr-structure-fullscreen .dr-fast-toggles{max-height:37px;margin:0;padding:0 0 2px}\n .dr-structure-fullscreen .dr-fast-toggles button{min-height:32px!important;padding:5px 7px!important;font-size:10px}\n .dr-structure-fullscreen .dr-structure-summary,.dr-structure-fullscreen .dr-smc-card,.dr-structure-fullscreen .dr-protection-records,.dr-structure-fullscreen .dr-extra-indicators,.dr-structure-fullscreen .dr-plot-options,.dr-structure-fullscreen .dr-no-ob,.dr-structure-fullscreen>.dr-structure-note,.dr-structure-fullscreen>.dr-indicator-feedback{display:none!important}\n .dr-structure-fullscreen .dr-draw-toolbar{flex:0 0 auto!important;padding:3px!important;margin:2px 0!important;gap:2px!important}\n .dr-structure-fullscreen .dr-draw-toolbar>div{width:100%;justify-content:flex-start!important;gap:2px}\n .dr-structure-fullscreen .dr-draw-toolbar button{min-height:31px!important;min-width:30px!important;padding:5px 6px!important;font-size:10px!important}\n .dr-structure-fullscreen .dr-structure-scroll{flex:1 1 auto!important;min-height:0!important;height:auto!important;overflow:hidden!important;margin-top:2px;border-color:#355872}\n .dr-structure-fullscreen .dr-structure-scroll svg[data-dr-interactive]{width:100%!important;height:100%!important;max-height:none!important;touch-action:none!important}\n .dr-structure-fullscreen .dr-structure-note[role=status]{display:none}\n}\n@media(orientation:landscape) and (max-height:550px){\n .dr-structure-fullscreen .dr-chart-presets,.dr-structure-fullscreen .dr-fast-toggles{display:none!important}\n .dr-structure-fullscreen .dr-draw-toolbar{padding:1px!important}\n .dr-structure-fullscreen .dr-structure-head{min-height:28px!important}\n}\n";
 css.textContent+=`
/* V18: Chart-first, compact touch controls, self-contained chart interaction */
.dr-quick-chart-controls{display:grid;gap:7px;margin:9px 0 4px}
.dr-chart-presets{display:flex;align-items:stretch;gap:6px}
.dr-chart-presets button{min-height:38px;flex:1 1 0;padding:7px 5px;border:1px solid #31506b;border-radius:9px;background:#102236;color:#aecde1;font-size:12px;touch-action:manipulation}
.dr-chart-presets button.active{background:#13503c;border-color:#35e0a1;color:#a6ffe0}
.dr-fast-toggles{display:flex;overflow-x:auto;gap:6px;overscroll-behavior-x:contain;padding:2px 1px 6px;scrollbar-width:thin}
.dr-fast-toggles button{flex:1 0 auto;min-height:39px;white-space:nowrap;padding:7px 11px;border:1px solid #31506b;border-radius:9px;background:#102236;color:#bdd4e4;font-size:12px}
.dr-fast-toggles button.active{background:#10382e;border-color:#35e0a1;color:#8ff4d3}
.dr-extra-indicators{border:1px solid #24445c;border-radius:10px;padding:5px 10px;margin:10px 0;background:#091d2c}
.dr-extra-indicators>summary{padding:9px 0;cursor:pointer;color:#9fddf6;font-size:13px;font-weight:700;touch-action:manipulation}
.dr-extra-indicators .dr-indicator-shortcuts{display:grid!important;grid-template-columns:1fr 1fr;gap:10px;margin:0}
.dr-extra-indicators .dr-quick-layer-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.dr-structure-panel .dr-draw-toolbar{background:#0a2030;border:1px solid #25445c;border-radius:10px;padding:7px;margin:8px 0 5px;gap:7px}
.dr-structure-panel .dr-draw-toolbar>div:first-child{display:flex;flex:1;justify-content:center}
.dr-structure-panel .dr-draw-toolbar>div:nth-child(2){display:flex;justify-content:flex-start;max-width:100%;overflow:auto}
.dr-draw-toolbar button{min-width:38px;min-height:42px!important;font-size:12px!important}
.dr-structure-head{align-items:flex-start}
.dr-structure-head>div{flex-wrap:nowrap!important;overflow-x:auto;max-width:100%;scrollbar-width:thin}
.dr-structure-scroll{min-height:380px;user-select:none}
.dr-structure-summary{padding:7px 9px;border:1px solid #1c364c;border-radius:8px;background:#081d2b;font-size:11px}
.dr-structure-panel .dr-structure-note{margin-top:5px}
@media(max-width:650px){
 .dr-structure-panel{padding:9px!important}
 .dr-structure-scroll{min-height:370px!important}
 .dr-structure-head>div{width:100%;gap:3px!important}
 .dr-structure-head button{padding:8px 7px!important;min-width:42px!important}
 .dr-chart-presets button{font-size:12px}
 .dr-extra-indicators .dr-indicator-shortcuts{grid-template-columns:1fr}
 .dr-extra-indicators .dr-quick-layer-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
 .dr-draw-toolbar>div{width:100%}
 .dr-structure-scroll svg{width:100%!important;height:auto!important}
}
.dr-structure-fullscreen .dr-quick-chart-controls{position:sticky;top:0;z-index:4;background:#050e19;padding:3px 0}
.dr-structure-fullscreen .dr-structure-scroll{min-height:50dvh!important;flex:1 1 auto!important}
`;css.textContent+="\n/* V18.8 adaptive chart axis and accessible mobile controls */\n.dr-chart-levels{display:flex;gap:7px;overflow-x:auto;white-space:nowrap;padding:7px 2px;scrollbar-width:thin}\n.dr-chart-levels span{flex:0 0 auto;display:flex;gap:5px;align-items:center;padding:6px 8px;border:1px solid #31566e;background:#0d2738;border-radius:7px;font-size:11px}\n.dr-chart-levels small{color:#9ac0d5;font-size:10px}.dr-chart-levels b{color:#e4faff}\n.dr-chart-help{position:relative;background:#0b2535;border:1px solid #48b69b;border-radius:10px;margin:8px 0;padding:12px;max-height:50dvh;overflow:auto;line-height:1.6}\n.dr-chart-help>b{color:#8ff5d0}.dr-chart-help p{font-size:12px;margin:7px 0;color:#c7dbea}.dr-chart-help strong{color:#f0f9ff}\n.dr-draw-toolbar button[aria-pressed=true]{border-color:#36d9ac;background:#123f34;color:#a9ffdf}\n.dr-structure-fullscreen .dr-chart-levels{display:none}\n.dr-structure-fullscreen>.dr-indicator-feedback{display:block!important;min-height:18px!important;flex:0 0 auto!important;color:#a1f8d3!important;font-size:11px!important}\n.dr-structure-fullscreen .dr-chart-help{position:absolute;bottom:max(10px,env(safe-area-inset-bottom));left:7px;right:7px;z-index:9;max-height:55dvh;box-shadow:0 -10px 35px #0009}\n@media(max-width:650px){.dr-structure-fullscreen .dr-structure-scroll{min-height:0!important;flex:1 1 auto!important}.dr-structure-fullscreen .dr-structure-scroll svg[data-dr-interactive]{width:100%!important;height:100%!important}}\n";document.head.appendChild(css);hook();let resizeQueued=false;addEventListener('resize',()=>{if(resizeQueued||!state.result||state.pointers.size)return;resizeQueued=true;requestAnimationFrame(()=>{resizeQueued=false;paintChart()})});
})();
