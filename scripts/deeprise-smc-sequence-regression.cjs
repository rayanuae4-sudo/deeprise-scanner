/* SMC sequence: direction, causality, zone retest, strict readiness. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const win={},scope={window:win,Date,Number,Math,Set,Map};
vm.runInNewContext(fs.readFileSync('deeprise-market-structure-v174.js','utf8'),scope);
const api=win.DeepRiseStructure,now=Date.now();
assert.equal(typeof api.smartMoneySequence,'function');
const bars=Array.from({length:10},(_,i)=>({time:now-(10-i)*14_400_000,
  closeTime:now-(9-i)*14_400_000-3000,open:100,high:105,low:95,close:100}));
bars[1].low=90;bars[6].low=98;bars[7].low=99;
const sweep={side:'LONG',index:1,price:95},choch={side:'LONG',type:'CHOCH',index:3,price:104},
 bos={side:'LONG',type:'BOS',index:5,price:105};
const ob={side:'LONG',originIndex:2,breakIndex:3,lower:98,upper:102,status:'TESTED'};
const gap={side:'LONG',index:4,remainingLower:99,remainingUpper:101,status:'PARTIAL'};
const frame={bars,sweeps:[sweep],events:[choch,bos],blocks:[ob],gaps:[gap],atr:2,price:100,
 bias:'LONG',protectedLow:{price:94,protection:{quality:'CONFIRMED'}},lastEvent:bos,
 updated:now-1000,barClose:now-3000,intervalMs:14_400_000};
const seq=(x=frame,p=100)=>api.smartMoneySequence(x,'LONG',p);
assert.equal(seq().phase,'READY');
assert(seq().retestIndex>bos.index);
assert.equal(seq().zone.type,'FVG','prefer latest eligible active zone');
assert.equal(seq({...frame,sweeps:[]}).phase,'WAIT_SWEEP');
assert.equal(seq({...frame,events:[]}).phase,'WAIT_CHOCH');
assert.equal(seq({...frame,events:[bos,choch]}).phase,'WAIT_BOS');
assert.equal(seq({...frame,gaps:[],blocks:[]}).phase,'WAIT_ZONE');
assert.equal(seq(frame,110).phase,'WAIT_RETEST');
assert.equal(seq({...frame,blocks:[{...ob,status:'INVALID'}],gaps:[{...gap,status:'FILLED'}]}).phase,'WAIT_ZONE');
const invalidBars=bars.map(x=>({...x}));invalidBars[9].close=89;
assert.equal(seq({...frame,bars:invalidBars}).phase,'INVALIDATED');
assert.equal(api.smartMoneySequence(frame,'SHORT').phase,'WAIT_SWEEP');
const earlyFrame={...frame,bars:bars.slice(0,5),events:[choch],blocks:[ob]};
assert.equal(seq(earlyFrame).phase,'WAIT_BOS','future BOS must not be visible in earlier slices');
const z={side:'LONG',stage:'IGNITION',price:100,closedPrice:100.1,trigger:99,entryLo:98,entryHi:102,
 invalid:92,atr:2,ts:now};
assert.equal(api.classify(z,frame,now).group,'READY');
const noSweep=api.classify(z,{...frame,sweeps:[]},now);
assert.equal(noSweep.group,'NEAR');
assert.equal(noSweep.reason,'SMC_WAIT_SWEEP');
assert.equal(api.classify(z,{...frame,bars:invalidBars},now).group,'BLOCKED');
const raw=Array.from({length:20},(_,i)=>[now-(20-i)*14_400_000,100,102,98,100,10,now-(19-i)*14_400_000-3000]);
const real=api.analyse(raw,{tf:'4h',pivotSpan:1,now});
assert(real?.smc?.LONG&&real?.smc?.SHORT,'real chart produces both directional workflows');
assert(real.smc.LONG.phase!=='READY'&&real.smc.SHORT.phase!=='READY','no synthetic signal without evidence');
console.log('SMC V18.1 regression PASS: ordered sweep/CHoCH/BOS, closed-bar retest, invalidation and readiness gate');
