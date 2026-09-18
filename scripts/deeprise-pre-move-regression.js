/* DeepRise V17 deterministic regression against the ARB 4H setup supplied by the user. */
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');

const document={readyState:'loading',documentElement:{lang:'en'},addEventListener(){},createElement(){return{style:{},appendChild(){}}},head:{appendChild(){}}};
const localStorage={getItem(){return null},setItem(){}};
const window={};
const context={window,document,localStorage,console,Date,Math,Number,String,Object,Array,Set,Map,JSON,fetch(){throw new Error('network disabled in regression')},Notification:function(){},MutationObserver:class{},requestAnimationFrame(){},setTimeout(){},setInterval(){}};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('deeprise-pre-move-v170.js','utf8'),context,{filename:'deeprise-pre-move-v170.js'});

const api=window.DeepRisePreMove;
assert(api&&api.version==='17.0','V17 pre-move API unavailable');
const fixture=JSON.parse(fs.readFileSync('scripts/fixtures/arb-usdt-4h-pre-move-2026.json','utf8'));

function analyseAt(openTime){
  const cut=Date.parse(openTime),bars=fixture.bars.filter(x=>Number(x[0])<=cut),last=bars.at(-1);
  return api.analyse(bars,fixture.symbol,2_000_000,Number(last[4]),Number(last[6])+5000);
}

const watch=analyseAt('2026-08-17T16:00:00Z');
assert(watch&&watch.stage==='WATCH',`expected ARB WATCH, got ${watch?.stage}`);
assert(watch.price<0.076,'WATCH must precede the first expansion');
assert(watch.atrRatio<=.92||watch.bbRatio<=.92,'WATCH must have relative volatility compression');

const armed=analyseAt('2026-08-18T04:00:00Z');
assert(armed&&armed.stage==='ARMED',`expected ARB ARMED, got ${armed?.stage}`);
assert(armed.price<=0.0755,`expected pre-move price near 0.075, got ${armed.price}`);
assert(armed.score>=72,'ARMED score below gate');
assert(armed.extended===false,'pre-move ARB setup incorrectly marked extended');
assert(armed.atrRatio<=.92||armed.bbRatio<=.92,'ARMED must have relative volatility compression');

const stable=[];
for(let i=0;i<100;i++){
  const t=Date.UTC(2026,0,1)+i*4*3600000,c=1+(i%3-1)*0.00005;
  stable.push([t,'1.00000','1.00050','0.99950',c.toFixed(5),'1000000',t+4*3600000-1,'1000000',100,'500000','500000','0']);
}
assert(api.analyse(stable,'RLUSDUSDT',20_000_000,1,Number(stable.at(-1)[6])+5000)===null,'stable-like low-volatility asset must be rejected');

const expanded=fixture.bars.slice(),p=Number(expanded.at(-1)[4]),end=Number(expanded.at(-1)[6]);
const late=api.analyse(expanded,fixture.symbol,20_000_000,p*1.17,end+5000);
assert(late&&late.stage==='LATE',`extended move must be LATE, got ${late?.stage}`);
assert(late.extended===true,'late move missing anti-chase flag');

console.log(`DeepRise V17 pre-move regression: PASS — ARB WATCH ${watch.price.toFixed(4)}, ARMED ${armed.price.toFixed(4)}, extended entry blocked.`);
