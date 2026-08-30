/* DeepRise CI regression test — executes the production V15.4 entry gate itself. */
'use strict';
const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

function classList(){return{add(){},remove(){},toggle(){},contains(){return false}}}
function element(){return{dataset:{},classList:classList(),style:{},childNodes:[],firstChild:null,textContent:'',innerHTML:'',appendChild(){},prepend(){},remove(){},removeAttribute(){},setAttribute(){},addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},insertAdjacentElement(){},scrollIntoView(){}}}
const document={documentElement:{lang:'en'},head:{appendChild(){}},body:element(),getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]},createElement(){return element()}};
const localStorage={getItem(){return null},setItem(){},removeItem(){}};
const window={DeepRiseV13:{}};
const context={window,document,localStorage,console,Date,Math,Number,String,Object,Array,Set,Map,JSON,
 MutationObserver:class{observe(){} disconnect(){}},CSS:{escape:s=>String(s)},requestAnimationFrame:fn=>{if(typeof fn==='function')fn();return 0},setTimeout(){return 0},clearTimeout(){},setInterval(){return 0},clearInterval(){},addEventListener(){},alert(){},history:{replaceState(){}},location:{pathname:'/',search:''},scrollTo(){},marketData:[]};
context.globalThis=context;vm.createContext(context);
const src=fs.readFileSync('deeprise-entry-ranking-v154.js','utf8');
vm.runInContext(src,context,{filename:'deeprise-entry-ranking-v154.js'});
const api=context.window.DeepRiseEntryRank;
assert(api&&api.version==='15.4','DeepRiseEntryRank V15.4 did not initialize');
assert.strictEqual(typeof api.quality,'function','quality() is not exposed');
assert.strictEqual(typeof api.applyGate,'function','applyGate() is not exposed');

function coin(overrides={}){
 const base={symbol:'TESTUSDT',direction:'LONG',_rawDirection:'LONG',e20:110,e50:100,h1Bull:true,h1Bear:false,score:84,rsi:58,volumeRatio:1.45,candle:{bull:true,bear:false},quoteVolume:50000000,rr:2.3,atrPct:2.2,
  proSignal:{direction:'LONG',confidence:84,rank:84,multiTfAligned:true,riskFlags:[]}};
 const out=Object.assign({},base,overrides);if(overrides.proSignal)out.proSignal=Object.assign({},base.proSignal,overrides.proSignal);return out;
}
function expectState(name,x,state,count,side,mode){const q=api.quality(x);assert.strictEqual(q.state,state,`${name}: expected ${state}, got ${q.state}`);assert.strictEqual(q.count,count,`${name}: expected ${count}/6, got ${q.count}/6`);if(side)assert.strictEqual(q.side,side,`${name}: expected ${side}, got ${q.side}`);if(mode)assert.strictEqual(q.entryMode,mode,`${name}: expected mode ${mode}, got ${q.entryMode}`);return q}

const strictLong=coin();expectState('strict LONG',strictLong,'READY',6,'LONG','STRICT');
const fastNoCandle=coin({candle:{bull:false,bear:false},volumeRatio:1.5});expectState('fast-track missing candle',fastNoCandle,'READY',5,'LONG','FAST_TRACK');
const fastNoVolume=coin({volumeRatio:.98});expectState('fast-track missing volume',fastNoVolume,'READY',5,'LONG','FAST_TRACK');
const ordinaryFive=coin({candle:{bull:false,bear:false},volumeRatio:1.25,proSignal:{confidence:74,rank:70}});expectState('ordinary 5/6 waits trigger',ordinaryFive,'CONFIRMED',5,'LONG','NONE');
const unsafeFive=coin({h1Bull:false,h1Bear:true});const uq=expectState('misaligned 5/6 must not confirm',unsafeFive,'WAIT',5,'LONG','NONE');assert.strictEqual(uq.hardAligned,false,'misaligned 1H condition was incorrectly treated as aligned');
const formingLong=coin({candle:{bull:false,bear:false},volumeRatio:.8});expectState('forming LONG',formingLong,'FORMING',4,'LONG','NONE');
const overextended=coin({rsi:78});const oq=expectState('overextended 6/6 is not executable',overextended,'CONFIRMED',6,'LONG','NONE');assert.strictEqual(oq.entryReady,false,'overextended LONG was incorrectly executable');
const conflictingForecast=coin({proSignal:{detailed:true,multiTfAligned:false,expectedMovePct:2.5}});const cq=expectState('forecast conflict blocks READY',conflictingForecast,'CONFIRMED',6,'LONG','NONE');assert.strictEqual(cq.entryReady,false,'conflicting multi-timeframe forecast was executable');
const readyShort=coin({direction:'SHORT',_rawDirection:'SHORT',e20:90,e50:100,h1Bull:false,h1Bear:true,rsi:42,candle:{bull:false,bear:true},proSignal:{direction:'SHORT',confidence:85,rank:86,multiTfAligned:true,riskFlags:[]}});expectState('strict SHORT',readyShort,'READY',6,'SHORT','STRICT');
const wrongExpected=coin({proSignal:{detailed:true,multiTfAligned:true,expectedMovePct:-2,confidence:86,rank:87}});const wq=expectState('opposite expected move blocks READY',wrongExpected,'CONFIRMED',6,'LONG','NONE');assert.strictEqual(wq.entryReady,false,'opposite expected move was executable');

context.marketData=[strictLong,fastNoCandle,fastNoVolume,ordinaryFive,unsafeFive,formingLong,overextended,conflictingForecast,readyShort,wrongExpected];
api.applyGate();
assert.strictEqual(strictLong.direction,'LONG','STRICT LONG was blocked');
assert.strictEqual(fastNoCandle.direction,'LONG','valid fast-track candle opportunity was missed');
assert.strictEqual(fastNoVolume.direction,'LONG','valid fast-track volume opportunity was missed');
assert.strictEqual(ordinaryFive.direction,'WAIT','ordinary 5/6 was executed too early');
assert.strictEqual(unsafeFive.direction,'WAIT','misaligned 5/6 signal was allowed through');
assert.strictEqual(formingLong.direction,'WAIT','FORMING signal was allowed through');
assert.strictEqual(overextended.direction,'WAIT','overextended signal was allowed through');
assert.strictEqual(conflictingForecast.direction,'WAIT','forecast-conflict signal was allowed through');
assert.strictEqual(readyShort.direction,'SHORT','STRICT SHORT was blocked');
assert.strictEqual(wrongExpected.direction,'WAIT','opposite expected-move signal was allowed through');
assert(api.strength(strictLong,'long')>api.strength(ordinaryFive,'long'),'ranking no longer prioritizes strict entries');
console.log('DeepRise V15.4 entry regression: PASS — strict + fast-track opportunity capture + false-entry blockers verified.');