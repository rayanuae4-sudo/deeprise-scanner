/* Regression for causal 15m internal/external protection and guarded READY classification. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const sandbox={window:{},Date,Math,Number,Set,Map};
vm.runInNewContext(fs.readFileSync('deeprise-market-structure-v174.js','utf8'),sandbox);
const api=sandbox.window.DeepRiseStructure;
assert.equal(api.version,'17.9');
const step=900000,start=Date.UTC(2026,9,10);
const prices=[10,11,12,13,12,11,10,11,12,10,9,8,9,10,9,8,7,8,9,8,7,6,7,8,7,6,5,6,7,6,5,4,5,6,5,4,3,4,5,4,3,2.5,3,4,3,2.4,2.1,2.5,2.8,2.4,2];
const raw=prices.map((close,i)=>{
 const open=i?prices[i-1]:close;
 return[start+i*step,String(open),String(Math.max(open,close)+.1),String(Math.min(open,close)-.1),
  String(close),'100',start+(i+1)*step-1];
});
const now=start+(prices.length+1)*step;
const run=(candles,opts={})=>api.analyse(candles,{tf:'15m',pivotSpan:3,now,...opts});
const all=run(raw);
assert(all&&all.internal&&all.external,'both structure scopes should be published');
assert.equal(all.pivotSpan,3);
assert.equal(all.internal.pivotSpan,1);
assert(all.internal.pivots.length>all.pivots.length,'internal map should contain shorter swings');
assert(all.events.some(e=>e.side==='SHORT'),'bearish breaks expected in fixture');
for(let n=10;n<=raw.length;n++){
 const snapshot=run(raw.slice(0,n));if(!snapshot)continue;
 const historical=all.events.filter(e=>e.index<n);
 assert.equal(JSON.stringify(snapshot.events),JSON.stringify(historical),
  'confirmed history cannot be repainted by future candles at '+n);
 for(const swing of [snapshot.protectedHigh,snapshot.protectedLow,snapshot.internal?.protectedHigh,snapshot.internal?.protectedLow].filter(Boolean)){
  assert(swing.confirmedIndex<=n-1,'never use an unconfirmed swing');
  assert(swing.protection&&swing.protection.breakIndex<n,'protection requires a closed break');
  if(swing.protection.quality==='CONFIRMED')assert(swing.index>swing.protection.brokenPivotIndex,
   'protected swing must be later than the broken level, not an older extreme');
 }
}
const partial=raw.slice();const future=[start+(prices.length)*step,2,200,.01,190,100,now+step];
partial.push(future);
assert.equal(JSON.stringify(run(partial).events),JSON.stringify(all.events),
 'open candles must not change history');
const ts=Date.now();
const setup={side:'SHORT',stage:'ARMED',price:99.95,closedPrice:99.9,trigger:100,
 atr:1,invalid:102,entryLo:99.85,entryHi:100.35,ts};
const structure={bias:'SHORT',updated:ts,barClose:ts-10000,intervalMs:step,
 protectedHigh:{price:101,protection:{quality:'CONFIRMED'}},bars:Array(10),lastEvent:{side:'SHORT',type:'BOS',index:8},gaps:[],fib:null};
assert.equal(api.classify(setup,structure,ts).group,'READY');
const preliminary={...structure,protectedHigh:{price:101,protection:{quality:'INITIAL'}}};
assert.notEqual(api.classify(setup,preliminary,ts).group,'READY',
 'initial reversal swing must not be treated as a confirmed entry guard');
assert.equal(api.classify({...setup,price:101.1},structure,ts).group,'BLOCKED');
console.log('DeepRise V17.9 protected structure regression PASS');
