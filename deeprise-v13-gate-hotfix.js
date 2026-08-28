/* DeepRise V13.0.2 — enforce quality gate and launch version labels before visible recommendations */
(()=>{'use strict';
function gate(){try{if(typeof marketData==='undefined'||!Array.isArray(marketData)||!window.DeepRiseV13?.quality)return;for(const x of marketData){if(!x._rawDirection)x._rawDirection=x.direction;const q=window.DeepRiseV13.quality(x);x.v13Quality=q;if((x._rawDirection==='LONG'||x._rawDirection==='SHORT')&&q.count<5)x.direction='WAIT';else if(q.count>=5)x.direction=x._rawDirection}}catch(e){}}
function labels(){try{document.title='DeepRise V13 PRO';document.querySelectorAll('.dr-mobile-brand small').forEach(x=>x.textContent='V13 PRO Mobile');document.querySelectorAll('.brand h1').forEach(x=>{if(/DeepRise/i.test(x.textContent||''))x.textContent='⚡ DeepRise V13 PRO'});document.querySelectorAll('.marketbar span').forEach(x=>{if(/Engine:/i.test(x.textContent||''))x.innerHTML='Engine: <b>V13 PRO</b>'})}catch(e){}}
try{if(typeof render==='function'){const base=render;render=function(){gate();return base()}}}catch(e){}
try{if(typeof renderTop==='function'){const base=renderTop;renderTop=function(){gate();return base()}}}catch(e){}
setInterval(()=>{gate();labels()},5000);setTimeout(()=>{gate();labels()},1200);
})();
