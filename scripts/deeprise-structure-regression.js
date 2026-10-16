'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},Date,Number,Math,Map,Set};vm.createContext(context);
vm.runInContext(fs.readFileSync('deeprise-market-structure-v172.js','utf8'),context);
const api=context.window.DeepRiseStructure,step=14400000,start=Date.UTC(2026,0,1);
function bars(prices){return prices.map((close,i)=>[start+i*step,close,close+.3,close-.3,close,100,start+(i+1)*step-1])}
function run(raw,extra={}){return api.analyse(raw,{tf:'4h',pivotSpan:1,now:Number(raw.at(-1)[6])+5000,...extra})}
const raw=bars([10,12,10,11,10.5,13,12,14,12.5,13,11,10,11]);
const result=run(raw);
assert(result.events.some(e=>e.type==='BOS'&&e.side==='LONG'));
assert(result.events.some(e=>e.type==='CHOCH'&&e.side==='SHORT'),'protected low close break must reverse the structure');
assert.equal(result.bias,'SHORT');assert(result.protectedHigh,'bearish break must protect its origin high');
const pre=run(raw.slice(0,10));assert.equal(pre.bias,'LONG');assert(pre.protectedLow);
const wick=raw.slice(0,10).map(x=>x.slice());wick.push([start+10*step,13,13.2,pre.protectedLow.price-.5,13,100,start+11*step-1]);
assert.equal(run(wick).bias,'LONG','wick-only protected low sweep must not create CHoCH');
const live=raw.slice(0,10).map(x=>x.slice()),now=Number(live.at(-1)[6])+5000;
live.push([now,10,100,.1,90,1,now+step]);
assert.equal(JSON.stringify(api.analyse(live,{now,pivotSpan:1}).events),JSON.stringify(pre.events),'unfinished candle cannot change structure');
// Later data may confirm new pivots but cannot rewrite previously emitted break events.
for(let count=7;count<raw.length;count++){const cut=run(raw.slice(0,count));for(const event of cut.events)assert(result.events.some(e=>JSON.stringify(e)===JSON.stringify(event)),'historical event changed after new candles')}
for(const p of result.pivots)assert.equal(p.confirmedIndex,p.index+1);

const gapBars=bars([10,10.8,12,11.5,10.2,9.8,10]);
gapBars[0][2]=10.3;gapBars[2][3]=11.7;
let gap=run(gapBars.slice(0,3),{pivotSpan:1});assert.equal(gap,null,'insufficient structure history is rejected');
const gapAll=run(gapBars),bull=gapAll.gaps.find(g=>g.index===2&&g.side==='LONG');assert(bull);assert.equal(bull.status,'FILLED');assert(bull.filledAt>bull.createdAt);
const longer=bars([9,10,9.5,10,10.8,12,11.5,11.1,11.4]);
const partial=run(longer).gaps.find(g=>g.index===5&&g.side==='LONG');assert(partial);assert.equal(partial.status,'PARTIAL');assert(partial.remainingUpper<partial.upper);assert(partial.remainingLower<partial.remainingUpper);

const pivots=[{type:'LOW',price:100,index:1},{type:'HIGH',price:200,index:5},{type:'LOW',price:150,index:9}];
const fib=api.fibonacci(pivots,'LONG');assert.equal(fib.levels.find(x=>x.ratio===.618).price,138.2);assert.equal(fib.extensions.find(x=>x.ratio===1.618).price,261.8);assert.equal(fib.trendExtensions.find(x=>x.ratio===1).price,250);
const shortFib=api.fibonacci([{type:'HIGH',price:200,index:1},{type:'LOW',price:100,index:5},{type:'HIGH',price:150,index:9}],'SHORT');assert.equal(shortFib.levels.find(x=>x.ratio===.618).price,161.8);assert.equal(shortFib.trendExtensions.find(x=>x.ratio===1).price,50);

const at=Date.now(),z={symbol:'TESTUSDT',side:'LONG',stage:'IGNITION',price:100.05,closedPrice:100.1,trigger:100,atr:1,entryLo:99.65,entryHi:100.15,invalid:98,tp1:102,ts:at};
const structure={updated:at,barClose:at-10000,intervalMs:step,bias:'LONG',protectedLow:{price:99},lastEvent:{side:'LONG',type:'BOS',index:8},bars:Array(10),gaps:[],fib:null};
assert.equal(api.classify(z,structure,at).group,'READY');
const overlap={...structure,gaps:[{side:'LONG',status:'PARTIAL',remainingLower:100,remainingUpper:100.1}],fib:{side:'LONG',golden:[100,100.1]}};
assert.equal(api.classify(z,overlap,at).confluence,4,'active FVG and matching Fib must contribute to ranking');
assert.equal(api.classify(z,{...overlap,gaps:[{...overlap.gaps[0],status:'FILLED'}]},at).confluence,3,'filled FVG cannot count as active evidence');
assert.equal(api.classify({...z,closedPrice:99.9},structure,at).group,'NEAR','live trigger touch cannot authorize entry');
assert.equal(api.classify({...z,stage:'ARMED',price:98.9,invalid:97},structure,at).group,'BLOCKED','broken protected low must block entry');
assert.equal(api.classify({...z,stage:'ARMED',price:98.9,invalid:97},{...structure,protectedLow:{price:98}},at).group,'EARLY','ARMED far from trigger is still early');
assert.equal(api.classify({...z,price:101},structure,at).group,'BLOCKED');
assert.equal(api.classify({...z,ts:at-400000},structure,at).group,'EARLY');
assert.equal(api.classify(z,null,at).group,'EARLY');
assert.equal(api.classify(z,{...structure,bias:'SHORT'},at).group,'EARLY');
assert.equal(api.classify({...z,extended:true},structure,at).group,'BLOCKED');
const short={...z,side:'SHORT',price:99.95,closedPrice:99.9,invalid:102,entryLo:99.85,entryHi:100.35};
assert.equal(api.classify(short,{...structure,bias:'SHORT',protectedLow:null,protectedHigh:{price:101},lastEvent:{side:'SHORT',type:'CHOCH',index:8}},at).group,'READY');
console.log('V17.2 structure regression: PASS — causal BOS/CHoCH, protected swings, wick sweeps, FVG mitigation, directional Fibonacci and guarded entry stages.');
