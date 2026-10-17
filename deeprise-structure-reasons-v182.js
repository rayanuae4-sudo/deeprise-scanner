/* DeepRise V18.2 — interactive, evidence-backed explanations; native chart only. */
(()=>{'use strict';
const model={symbol:'',tf:'',filter:'ALL',limit:16,selected:'',side:'AUTO',records:[],result:null,host:null,observer:null};
const ns='http://www.w3.org/2000/svg';
const l=()=>{try{return localStorage.getItem('deeprise_language')||document.documentElement.lang||'en'}catch(_){return'en'}};
const tr=(en,ar,ru)=>l()==='ar'?ar:l()==='ru'?ru:en;
const esc=s=>String(s??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
const pf=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:8});
const exp=()=>window.DeepRiseStructureExplain,chart=()=>window.DeepRiseStructureChart;
const labels=()=>({
 title:tr('Why these levels?','لماذا صُنّفت هذه القمم والقيعان والكسور؟','Почему классифицированы эти уровни?'),
 all:tr('All','الكل','Все'),more:tr('Show more','عرض المزيد','Ещё'),
 evidence:tr('Evidence and reason','دليل التصنيف وسببه','Причина и доказательства'),
 outlook:tr('Conditional expectation','الدافع لترجيح الحركة التالية','Условное ожидание'),
 invalidate:tr('Invalidation','متى تُبطل القراءة؟','Условие отмены'),
 time:tr('Confirmed at','وقت التأكيد','Подтверждено'),
 prediction:tr('Directional reading and supporting factors','اتجاه مرجّح وأسباب الترجيح','Направление и доводы'),
 risk:tr('Key invalidation','مستوى إبطال السيناريو','Уровень отмены'),
 notice:tr('Rule-based reading of closed candles; not proof of institutional intent or win probability.','قواعد فنية تعتمد على شموع مغلقة، ولا تثبت نية المؤسسات أو نسبة نجاح الصفقة.','Технические правила по закрытым свечам, не доказательство намерений участников.'),
 locate:tr('Show on chart','اعرض موقعه على الشارت','Показать на графике')
});
function selectionHtml(){
 const x=model.records.find(z=>z.id===model.selected)||model.records[0],api=exp();
 if(!x||!api)return '';
 const d=api.describe(x,l()),t=labels();
 return '<div class="dr-why-detail" data-dr-why-detail><b>'+esc(d.title)+'</b>'+
 '<div><strong>'+t.evidence+'</strong><p>'+esc(d.why)+'</p></div>'+
 '<div><strong>'+t.outlook+'</strong><p>'+esc(d.outlook)+'</p></div>'+
 '<div><strong>'+t.invalidate+'</strong><p>'+esc(d.invalid)+'</p></div>'+
 '<small>'+t.time+': '+esc(d.confirmed)+'</small><div><button class="dr-why-jump" data-dr-why-jump="'+esc(x.id)+'">'+t.locate+' ↗</button></div></div>';
}
function drawSelection(){
 const root=model.host?.querySelector('#drWhyRoot');if(!root)return;
 const detail=root.querySelector('[data-dr-why-detail]');if(detail)detail.outerHTML=selectionHtml();
 root.querySelectorAll('button[data-dr-why-select]').forEach(b=>{const on=b.dataset.drWhySelect===model.selected;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
}
function buildUI(){
 const result=model.result,api=exp(),t=labels();if(!result||!api)return '';
 const records=model.records,groups=[['ALL',t.all],['PROTECTED','PH / PL'],['BREAK','BOS / CHoCH'],['PIVOT','HH / HL / LH / LL'],['SWEEP','Sweep'],['OB','Order Block'],['FVG','FVG']];
 const list=model.filter==='ALL'?records:records.filter(x=>x.kind===model.filter),current=list.slice(0,model.limit);
 const side=model.side==='AUTO'?(result.bias==='SHORT'?'SHORT':'LONG'):model.side,o=api.outlook(result,side,l());
 const prediction=o?'<div class="dr-why-outlook"><b>'+t.prediction+' · '+side+'</b>'+
 '<div class="dr-why-directions"><button data-dr-why-side="LONG" aria-pressed="'+(side==='LONG')+'">LONG</button><button data-dr-why-side="SHORT" aria-pressed="'+(side==='SHORT')+'">SHORT</button></div>'+
 '<ul>'+o.reasons.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul><b>'+t.risk+'</b><ul>'+o.risks.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>':'';
 const buttons='<div class="dr-why-filters">'+groups.map(([id,name])=>'<button data-dr-why-filter="'+id+'" aria-pressed="'+(id===model.filter)+'" class="'+(id===model.filter?'active':'')+'">'+name+' <small>'+(id==='ALL'?records.length:records.filter(x=>x.kind===id).length)+'</small></button>').join('')+'</div>';
 const history='<div class="dr-why-history">'+current.map(x=>'<button data-dr-why-select="'+esc(x.id)+'" aria-pressed="'+(x.id===model.selected)+'" class="'+(x.id===model.selected?'active':'')+'">'+esc(x.label)+' · $'+pf(x.price)+'<small>'+esc(api.describe(x,l()).confirmed)+'</small></button>').join('')+'</div>';
 const more=current.length<list.length?'<button data-dr-why-more class="dr-why-more">'+t.more+' ('+current.length+'/'+list.length+')</button>':'';
 return '<div id="drWhyRoot" dir="'+(l()==='ar'?'rtl':'ltr')+'"><details class="dr-why-explainer" open><summary>ⓘ '+t.title+'</summary>'+prediction+buttons+history+more+
 selectionHtml()+'<small class="dr-why-caveat">'+t.notice+'</small></details></div>';
}
function highlight(record){
 const c=chart(),r=c?.state?.result;if(!c||!r)return;
 const count=Math.max(20,Math.min(180,c.state.view.count)),n=r.bars.length;
 c.state.view.offset=Math.max(0,Math.min(Math.max(0,n-count),n-Math.round(record.index+count/2)));
 c.paintChart();
 requestAnimationFrame(()=>{
  const g=c.state.geometry,svg=model.host?.querySelector('svg[data-dr-interactive]');if(!g||!svg)return;
  const view=c.viewport(r.bars.length),length=view.end-view.first;
  const x=g.left+(record.index-view.first)/(length+g.extra-1)*(g.right-g.left);
  const y=g.bottom-(record.price-g.lo)/(g.hi-g.lo)*(g.bottom-g.top);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<g.left||x>g.right||y<g.top||y>g.bottom)return;
  svg.querySelectorAll('[data-dr-why-highlight]').forEach(el=>el.remove());
  const ring=document.createElementNS(ns,'circle');ring.setAttribute('data-dr-why-highlight','1');ring.setAttribute('cx',x);ring.setAttribute('cy',y);
  ring.setAttribute('r','10');ring.setAttribute('fill','none');ring.setAttribute('stroke','#ffe18b');ring.setAttribute('stroke-width','3');ring.setAttribute('pointer-events','none');svg.appendChild(ring);
  model.host.querySelector('.dr-structure-scroll')?.scrollIntoView?.({behavior:'smooth',block:'nearest'});
 });
}
function refresh(){
 if(!model.host||!model.result)return;
 const old=model.host.querySelector('#drWhyRoot');
 if(old){const open=old.querySelector('.dr-why-explainer')?.open;old.outerHTML=buildUI();if(open===false){const el=model.host.querySelector('.dr-why-explainer');if(el)el.open=false}}
 else{const wrap=document.createElement('div');wrap.innerHTML=buildUI();const el=wrap.firstElementChild;if(el)model.host.appendChild(el)}
}
function onAction(e){
 const b=e.target.closest('button[data-dr-why-filter],button[data-dr-why-select],button[data-dr-why-more],button[data-dr-why-side],button[data-dr-why-jump]');
 if(!b)return;
 e.preventDefault();e.stopPropagation();
 if(b.hasAttribute('data-dr-why-select')){model.selected=b.dataset.drWhySelect;drawSelection();return}
 if(b.hasAttribute('data-dr-why-filter')){model.filter=b.dataset.drWhyFilter;model.limit=16;refresh();return}
 if(b.hasAttribute('data-dr-why-more')){model.limit+=20;refresh();return}
 if(b.hasAttribute('data-dr-why-side')){model.side=b.dataset.drWhySide;refresh();return}
 if(b.hasAttribute('data-dr-why-jump')){const record=model.records.find(x=>x.id===b.dataset.drWhyJump);if(record)highlight(record)}
}
function sync(){
 const panel=document.getElementById('drStructurePanel'),result=chart()?.state.result;
 if(!panel||!exp()||!result)return;
 if(model.host!==panel){model.observer?.disconnect();model.host=panel;panel.addEventListener('click',onAction);
  model.observer=new MutationObserver(()=>{if(panel.isConnected&&!panel.querySelector('#drWhyRoot'))refresh()});
  model.observer.observe(panel,{childList:true});}
 if(model.result!==result||model.symbol!==chart().state.symbol||model.tf!==chart().state.tf){
  model.result=result;model.symbol=chart().state.symbol;model.tf=chart().state.tf;
  model.filter='ALL';model.limit=16;model.side='AUTO';model.records=exp().build(result);
  model.selected=(model.records.find(x=>x.kind==='PROTECTED'&&x.data?.quality==='CONFIRMED')||model.records.find(x=>x.kind==='BREAK')||model.records[0])?.id||'';
  model.host.querySelector('#drWhyRoot')?.remove();refresh();
 }else if(!panel.querySelector('#drWhyRoot'))refresh();
}
const css=document.createElement('style');css.textContent=[
 '#drWhyRoot{width:100%;clear:both;margin:12px 0;color:#d3e7f3}',
 '.dr-why-explainer{background:#0b1d2a;border:1px solid #376076;border-radius:12px;padding:12px;line-height:1.65}',
 '.dr-why-explainer summary{font-size:14px;font-weight:750;color:#8cebc9;cursor:pointer;padding:7px 4px}',
 '.dr-why-outlook{background:#102a36;padding:10px;border-radius:8px;margin:11px 0;font-size:12px}',
 '.dr-why-outlook ul{margin:6px 0 12px;padding-inline-start:18px}',
 '.dr-why-directions,.dr-why-filters,.dr-why-history{display:flex;flex-wrap:wrap;gap:7px;margin:9px 0}',
 '.dr-why-directions button,.dr-why-filters button,.dr-why-history button,.dr-why-more,.dr-why-jump{background:#122c3e;border:1px solid #426176;border-radius:8px;min-height:40px;padding:9px;color:#e2edf5;cursor:pointer;touch-action:manipulation;font-size:11px}',
 '.dr-why-filters button.active,.dr-why-history button.active,.dr-why-directions button[aria-pressed="true"]{background:#145244;border-color:#30deb0}',
 '.dr-why-history{max-height:244px;overflow-y:auto;overscroll-behavior:contain}',
 '.dr-why-history button{text-align:start;flex:1 1 180px}.dr-why-history button small{display:block;opacity:.7}',
 '.dr-why-detail{margin-top:10px;padding:12px;border:1px solid #23485a;border-inline-start:3px solid #27d5a5;border-radius:9px;font-size:12px}',
 '.dr-why-detail>div{margin-top:12px}.dr-why-detail p{margin:3px 0 0;line-height:1.8}.dr-why-detail strong{color:#b3ecde}',
 '.dr-why-detail small,.dr-why-caveat{display:block;margin-top:10px;color:#88a5b4;font-size:10px}'
].join('');document.head.appendChild(css);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
setInterval(()=>{if(!document.hidden)sync()},1600);
window.DeepRiseStructureReasons={version:'18.2',model,sync,refresh};
})();