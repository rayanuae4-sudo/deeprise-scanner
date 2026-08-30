/* DeepRise CI regression test — executes the production V15.0 entry gate itself. */
'use strict';
const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

function classList(){return{add(){},remove(){},toggle(){},contains(){return false}}}
function element(){return{dataset:{},classList:classList(),style:{},childNodes:[],firstChild:null,textContent:'',innerHTML:'',appendChild(){},prepend(){},remove(){},removeAttribute(){},setAttribute(){},addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},insertAdjacentElement(){},scrollIntoView(){}}}
const document={
 documentElement:{lang:'en'},head:{appendChild(){}},body:element(),
 getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]},
 createElement(){return element()}
};
const localStorage={getItem(){return null},setItem(){},removeItem(){}};
const window={DeepRiseV13:{}};
const context={window,document,localStorage,console,Date,Math,Number,String,Object,Array,Set,Map,JSON,
 MutationObserver:class{observe(){} disconnect(){}},CSS:{escape:s=>String(s)},
 requestAnimationFrame:fn=>{if(typeof fn==='function')fn();return 0},
 setTimeout(){return 0},clearTimeout(){},setInterval(){return 0},clearInterval(){},addEventListener(){},
 alert(){},history:{replaceState(){}},location:{pathname:'/',search:''},scrollTo(){},marketData:[]};
context.globalThis=context;
vm.createContext(context);
const src=fs.readFileSync('deeprise-entry-ranking-v150.js','utf8');
vm.runInContext(src,context,{filename:'deeprise-entry-ranking-v150.js'});
const api=context.window.DeepRiseEntryRank;
assert(api&&api.version==='15.0','DeepRiseEntryRank V15.0 did not initialize');
assert.strictEqual(typeof api.quality,'function','quality() is not exposed');
assert.strictEqual(typeof api.applyGate,'function','applyGate() is not exposed');

function coin(overrides={}){
 return Object.assign({symbol:'TESTUSDT',direction:'LONG',_rawDirection:'LONG',e20:110,e50:100,h1Bull:true,h1Bear:false,
  score:80,volumeRatio:1.45,candle:{bull:true,bear:false},quoteVolume:50000000,rr:2.3,atrPct:2.2,
  proSignal:{direction:'LONG',confidence:80,rank:82}},overrides);
}
function expectState(name,x,state,count,side){const q=api.quality(x);assert.strictEqual(q.state,state,`${name}: expected ${state}, got ${q.state}`);assert.strictEqual(q.count,count,`${name}: expected ${count}/6, got ${q.count}/6`);if(side)assert.strictEqual(q.side,side,`${name}: expected ${side}, got ${q.side}`);return q}

const readyLong=coin();
expectState('ready LONG',readyLong,'READY',6,'LONG');
const confirmedLong=coin({candle:{bull:false,bear:false}});
expectState('confirmed LONG missing candle',confirmedLong,'CONFIRMED',5,'LONG');
const unsafeFive=coin({h1Bull:false,h1Bear:true});
const uq=expectState('misaligned 5/6 must not confirm',unsafeFive,'WAIT',5,'LONG');
assert.strictEqual(uq.hardAligned,false,'misaligned 1H condition was incorrectly treated as aligned');
const formingLong=coin({candle:{bull:false,bear:false},volumeRatio:.9});
expectState('forming LONG',formingLong,'FORMING',4,'LONG');
const readyShort=coin({direction:'SHORT',_rawDirection:'SHORT',e20:90,e50:100,h1Bull:false,h1Bear:true,candle:{bull:false,bear:true},proSignal:{direction:'SHORT',confidence:81,rank:84}});
expectState('ready SHORT',readyShort,'READY',6,'SHORT');
const weakScore=coin({score:66,proSignal:{direction:'LONG',confidence:66,rank:70}});
expectState('weak score remains forming',weakScore,'FORMING',5,'LONG');

context.marketData=[readyLong,confirmedLong,unsafeFive,formingLong,readyShort,weakScore];
api.applyGate();
assert.strictEqual(readyLong.direction,'LONG','READY LONG was blocked');
assert.strictEqual(confirmedLong.direction,'LONG','CONFIRMED LONG was blocked');
assert.strictEqual(unsafeFive.direction,'WAIT','misaligned 5/6 signal was allowed through');
assert.strictEqual(formingLong.direction,'WAIT','FORMING signal was allowed through');
assert.strictEqual(readyShort.direction,'SHORT','READY SHORT was blocked');
assert.strictEqual(weakScore.direction,'WAIT','weak-confidence signal was allowed through');
assert(api.strength(readyLong,'long')>api.strength(formingLong,'long'),'ranking no longer prioritizes READY above FORMING');
console.log('DeepRise entry regression: PASS — READY/CONFIRMED/FORMING/WAIT + LONG/SHORT gate invariants verified.');
