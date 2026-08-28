/* DeepRise V13.0.1 — ensure the quality gate is applied before every visible/top recommendation render */
(()=>{'use strict';
function gate(){try{if(typeof marketData==='undefined'||!Array.isArray(marketData)||!window.DeepRiseV13?.quality)return;for(const x of marketData){if(!x._rawDirection)x._rawDirection=x.direction;const q=window.DeepRiseV13.quality(x);x.v13Quality=q;if((x._rawDirection==='LONG'||x._rawDirection==='SHORT')&&q.count<5)x.direction='WAIT';else if(q.count>=5)x.direction=x._rawDirection}}catch(e){}}
try{if(typeof render==='function'){const base=render;render=function(){gate();return base()}}}catch(e){}
try{if(typeof renderTop==='function'){const base=renderTop;renderTop=function(){gate();return base()}}}catch(e){}
setInterval(gate,5000);setTimeout(gate,1200);
})();