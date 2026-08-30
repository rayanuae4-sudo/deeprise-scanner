/* DeepRise V15.6 — inline whale money-flow alert for coin cards.
   Presentation only: reads V15.5 whale-flow evidence and never creates or changes a trade signal. */
(()=>{'use strict';
if(window.DeepRiseWhaleInlineV156)return;
const VERSION='15.6';
const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
const lang=()=>{try{return typeof currentLang!=='undefined'?currentLang:(localStorage.getItem('deeprise_language')||'en')}catch(e){return'en'}};
const T={
 en:{arrived:'Whale arrival confirmed',likely:'Whale accumulation detected',rotation:'Large capital rotation detected',moving:'Whale capital is mobilizing',out:'Whale outflow detected',unusual:'Unusual money movement',possible:'Possible move in',evidence:'Evidence',sell:'Selling pressure active',watch:'Watch flow development'},
 ar:{arrived:'تم تأكيد وصول الحيتان',likely:'تم رصد تجميع من الحيتان',rotation:'تم رصد انتقال سيولة كبيرة',moving:'أموال الحيتان تتحرك نحو العملة',out:'تم رصد خروج أموال الحيتان',unusual:'حركة مالية غير اعتيادية',possible:'حركة محتملة خلال',evidence:'قوة الأدلة',sell:'ضغط بيع نشط',watch:'راقب تطور التدفق'},
 ru:{arrived:'Whale arrival confirmed',likely:'Whale accumulation detected',rotation:'Large capital rotation detected',moving:'Whale capital is mobilizing',out:'Whale outflow detected',unusual:'Unusual money movement',possible:'Possible move in',evidence:'Evidence',sell:'Selling pressure active',watch:'Watch flow development'}
};
const t=k=>(T[lang()]||T.en)[k]||k;
function symbolOf(card){
 let s=card?.dataset?.drSymbol||card?.dataset?.symbol;
 if(s)return String(s).toUpperCase();
 const base=(card?.querySelector('.sym')?.textContent||'').split('/')[0].replace(/[^A-Z0-9]/gi,'').toUpperCase();
 return base?base+'USDT':'';
}
function api(){return window.DeepRiseWhaleFlowV155||null}
function prediction(sym){
 try{
  const a=api();
  if(typeof a?.get==='function')return a.get(sym)||null;
  const st=a?.state?.();
  const ps=st?.predictions;
  if(ps instanceof Map)return ps.get(sym)||null;
  if(ps&&typeof ps==='object')return ps[sym]||null;
 }catch(e){}
 return null;
}
function classify(p){
 if(!p)return null;
 const ev=n(p.evidenceStrength),an=n(p.anomalyScore),stage=String(p.stage||''),dir=String(p.direction||'');
 if(dir==='IN'){
  if(stage==='ARRIVAL_CONFIRMED'&&ev>=78)return{mode:'in',title:t('arrived')};
  if(stage==='BUY_LIKELY'&&ev>=76)return{mode:'in',title:t('likely')};
  if(stage==='ROTATION'&&ev>=76)return{mode:'in',title:t('rotation')};
  if(stage==='MOBILIZING'&&ev>=80)return{mode:'watch',title:t('moving')};
 }
 if(dir==='OUT'&&ev>=82&&['DISTRIBUTION','OUTFLOW'].includes(stage))return{mode:'out',title:t('out')};
 if(an>=84&&ev>=70)return{mode:'unusual',title:t('unusual')};
 return null;
}
function fresh(p){
 const ts=Date.parse(p?.capturedAt||p?.captured_at||0);
 return !ts||Date.now()-ts<4*3600000;
}
function subtitle(p,c){
 const ev=Math.round(n(p.evidenceStrength)),eta=String(p.eta||'—');
 if(c.mode==='out')return `${t('sell')} • ${t('evidence')} ${ev}/100`;
 if(c.mode==='unusual')return `${t('watch')} • ${t('evidence')} ${ev}/100`;
 return `${t('possible')} ${eta} • ${t('evidence')} ${ev}/100`;
}
function css(){
 if(document.getElementById('dr-whale-inline-156-css'))return;
 const s=document.createElement('style');s.id='dr-whale-inline-156-css';s.textContent=`
.dr-whale-inline{display:flex;align-items:center;gap:9px;margin:8px 0 9px;padding:9px 10px;border-radius:12px;border:1px solid #214258;background:linear-gradient(90deg,#081a28,#0a1d2d);min-width:0;cursor:pointer;box-shadow:inset 0 1px 0 #ffffff08}.dr-whale-inline .wi-icon{width:30px;height:30px;flex:0 0 30px;border-radius:9px;display:grid;place-items:center;background:#0b2635;font-size:16px}.dr-whale-inline .wi-copy{min-width:0;flex:1}.dr-whale-inline b{display:block;font-size:10px;font-weight:900;line-height:1.25;white-space:normal}.dr-whale-inline small{display:block;margin-top:3px;color:#829db0;font-size:8.5px;line-height:1.25;white-space:normal}.dr-whale-inline .wi-score{flex:0 0 auto;font-size:9px;font-weight:900;padding:4px 6px;border-radius:999px;border:1px solid #24465c;color:#a6c5d8;background:#0b2030}.dr-whale-inline.in{border-color:#1c644f;background:linear-gradient(90deg,#08231d,#091d29)}.dr-whale-inline.in .wi-icon{background:#0b3127}.dr-whale-inline.in b,.dr-whale-inline.in .wi-score{color:#45e7ad}.dr-whale-inline.in .wi-score{border-color:#236b55;background:#0c2c24}.dr-whale-inline.watch{border-color:#645b2a;background:linear-gradient(90deg,#24200b,#0a1d2a)}.dr-whale-inline.watch b,.dr-whale-inline.watch .wi-score{color:#ffd166}.dr-whale-inline.out{border-color:#6e3040;background:linear-gradient(90deg,#281017,#0b1926)}.dr-whale-inline.out .wi-icon{background:#33131d}.dr-whale-inline.out b,.dr-whale-inline.out .wi-score{color:#ff7184}.dr-whale-inline.out .wi-score{border-color:#733243;background:#2c1520}.dr-whale-inline.unusual{border-color:#29597a}.dr-whale-inline.unusual b,.dr-whale-inline.unusual .wi-score{color:#78c8ff}@media(max-width:520px){.dr-whale-inline{padding:8px 9px;gap:8px}.dr-whale-inline .wi-icon{width:28px;height:28px;flex-basis:28px}.dr-whale-inline b{font-size:9.5px}.dr-whale-inline small{font-size:8px}}
`;document.head.appendChild(s)
}
function insert(card,el){
 const badges=card.querySelector('.badges');
 if(badges){badges.insertAdjacentElement('afterend',el);return}
 const head=card.querySelector('.coin-head,.card-head,.dr-card-head');
 if(head){head.insertAdjacentElement('afterend',el);return}
 card.prepend(el);
}
function paintCard(card){
 const old=card.querySelector('.dr-whale-inline'),sym=symbolOf(card),p=prediction(sym),c=fresh(p)?classify(p):null;
 if(!p||!c){old?.remove();return}
 let el=old;
 if(!el){el=document.createElement('div');el.className='dr-whale-inline';insert(card,el)}
 const ev=Math.round(n(p.evidenceStrength));
 el.className=`dr-whale-inline ${c.mode}`;
 el.innerHTML=`<span class="wi-icon">${c.mode==='out'?'↘':'🐋'}</span><span class="wi-copy"><b>${c.title}</b><small>${subtitle(p,c)}</small></span><span class="wi-score">${ev}</span>`;
 el.title=subtitle(p,c);
 el.onclick=e=>{e.preventDefault();e.stopPropagation();try{const a=api();if(typeof a?.open==='function')a.open(sym);else if(typeof a?.openPanel==='function')a.openPanel(sym)}catch(_){}};
}
function paint(){
 css();
 document.querySelectorAll('#results .card,#top3 .pick').forEach(paintCard);
}
let busy=false;
function schedule(){if(busy)return;busy=true;requestAnimationFrame(()=>{busy=false;paint()})}
function boot(){
 css();paint();
 const mo=new MutationObserver(()=>{clearTimeout(mo._t);mo._t=setTimeout(schedule,90)});
 ['results','top3'].forEach(id=>{const el=document.getElementById(id);if(el)mo.observe(el,{childList:true,subtree:true})});
 setTimeout(paint,700);setTimeout(paint,1800);setInterval(paint,30000);
}
window.DeepRiseWhaleInlineV156={version:VERSION,paint,selfTest:()=>typeof classify==='function'&&typeof prediction==='function'};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();