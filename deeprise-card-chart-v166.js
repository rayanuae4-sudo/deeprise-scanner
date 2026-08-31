/* DeepRise V16.6 — reliable coin card -> chart + analysis navigation */
(()=>{'use strict';
function symFrom(card){
  let s=(card?.dataset?.drSymbol||card?.dataset?.symbol||'').toUpperCase();
  if(s)return s;
  const txt=card?.querySelector('.sym')?.textContent||'';
  const base=txt.split('/')[0].replace(/[^A-Z0-9]/gi,'').toUpperCase();
  return base?base+'USDT':'';
}
function current(sym){
  try{const a=window.DeepRiseBinanceUniverse?.state?.analyzed?.get?.(sym);if(a)return a}catch(e){}
  try{if(typeof marketData!=='undefined'&&Array.isArray(marketData))return marketData.find(x=>x.symbol===sym)||null}catch(e){}
  return null;
}
function sync(a){
  if(!a||!a.symbol)return;
  try{if(typeof marketData!=='undefined'&&Array.isArray(marketData)){const i=marketData.findIndex(x=>x.symbol===a.symbol);if(i>=0)marketData[i]=a;else marketData.unshift(a)}}catch(e){}
}
function refreshAnalysis(sym,a){
  sync(a);
  try{if(typeof updateChartAnalysis==='function')updateChartAnalysis(sym)}catch(e){}
}
function show(sym){
  if(!sym)return;
  const a=current(sym);sync(a);
  try{if(typeof openChart==='function')openChart(sym)}catch(e){}
  const panel=document.getElementById('chartPanel');
  if(panel){panel.classList.add('active');requestAnimationFrame(()=>panel.scrollIntoView({behavior:'auto',block:'start'}))}
  if(a){refreshAnalysis(sym,a);return}
  try{const fn=window.DeepRiseBinanceUniverse?.analyze;if(fn)Promise.resolve(fn(sym,false)).then(x=>{if(x)refreshAnalysis(sym,x)}).catch(()=>{})}catch(e){}
}
function decorate(){document.querySelectorAll('#results .card,#top3 .pick').forEach(card=>{card.classList.add('dr-coin-clickable');if(!card.getAttribute('role'))card.setAttribute('role','button');if(!card.hasAttribute('tabindex'))card.tabIndex=0})}
let tm=null;const queue=()=>{clearTimeout(tm);tm=setTimeout(decorate,80)};
document.addEventListener('click',e=>{
  if(e.target.closest('button,input,select,textarea,a,[data-stop-trade],[data-trade-open],.dr-enter-trade,.filter,.chart-btn'))return;
  const card=e.target.closest('#results .card,#top3 .pick');if(!card)return;
  const sym=symFrom(card);if(!sym)return;
  e.preventDefault();e.stopPropagation();show(sym);
},true);
document.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key))return;const card=e.target.closest('#results .card,#top3 .pick');if(!card||e.target.closest('button,input,select,textarea,a'))return;e.preventDefault();show(symFrom(card))});
const css=document.createElement('style');css.textContent='.dr-coin-clickable{cursor:pointer;touch-action:manipulation}.dr-coin-clickable:active{transform:translateY(1px)}';document.head.appendChild(css);
if(document.readyState==='loading')addEventListener('DOMContentLoaded',()=>{decorate();const r=document.getElementById('results'),t=document.getElementById('top3');if(r)new MutationObserver(queue).observe(r,{childList:true,subtree:true});if(t)new MutationObserver(queue).observe(t,{childList:true,subtree:true})},{once:true});else decorate();
window.DeepRiseOpenCoin=show;
})();
