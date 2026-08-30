/* DeepRise CI regression — executes production V15.8 entry gate. */
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
function classList(){return{add(){},remove(){},toggle(){},contains(){return false}}}
function element(){return{dataset:{},classList:classList(),style:{},childNodes:[],firstChild:null,textContent:'',innerHTML:'',appendChild(){},prepend(){},remove(){},removeAttribute(){},setAttribute(){},addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},insertAdjacentElement(){},scrollIntoView(){}}}
const document={documentElement:{lang:'en'},head:{appendChild(){}},body:element(),getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]},createElement(){return element()},addEventListener(){}};
const localStorage={getItem(){return null},setItem(){},removeItem(){}};
const normalTiming={available:true,status:'NORMAL',hardBlock:false,earlyStrong:false,score:50,excursionAtr:.4,targetDistanceAtr:2};
const window={DeepRiseV13:{},DeepRiseWhaleFlowV155:{support(x){return x?.__flow||{available:false,supportive:false,conflict:false,score:0}}},DeepRiseMoveTimingV158:{version:'15.8',gate(x){return x?.__timing||normalTiming},paint(){}}};
const context={window,document,localStorage,console,Date,Math,Number,String,Object,Array,Set,Map,JSON,MutationObserver:class{observe(){} disconnect(){}},requestAnimationFrame:fn=>{if(typeof fn==='function')fn();return 0},setTimeout(){return 0},clearTimeout(){},setInterval(){return 0},clearInterval(){},addEventListener(){},alert(){},history:{replaceState(){}},location:{pathname:'/',search:''},scrollTo(){},marketData:[]};
context.globalThis=context;vm.createContext(context);vm.runInContext(fs.readFileSync('deeprise-entry-ranking-v158.js','utf8'),context,{filename:'deeprise-entry-ranking-v158.js'});
const api=context.window.DeepRiseEntryRank;assert(api&&api.version==='15.8');
function coin(overrides={}){const base={symbol:'TESTUSDT',direction:'LONG',_rawDirection:'LONG',e20:110,e50:100,h1Bull:true,h1Bear:false,score:84,rsi:58,volumeRatio:1.45,candle:{bull:true,bear:false},quoteVolume:50000000,rr:2.3,atrPct:2.2,proSignal:{direction:'LONG',confidence:84,rank:84,multiTfAligned:true,riskFlags:[]}};const out=Object.assign({},base,overrides);if(overrides.proSignal)out.proSignal=Object.assign({},base.proSignal,overrides.proSignal);return out}
function q(name,x,state,count,mode){const z=api.quality(x);assert.strictEqual(z.state,state,`${name}: ${z.state}`);assert.strictEqual(z.count,count,`${name}: ${z.count}`);if(mode)assert.strictEqual(z.entryMode,mode,`${name}: ${z.entryMode}`);return z}
const strict=coin();q('strict',strict,'READY',6,'STRICT');
const early=coin({candle:{bull:false,bear:false},volumeRatio:1.25,proSignal:{confidence:78,rank:74},__timing:{available:true,status:'EARLY_START',hardBlock:false,earlyStrong:true,score:88,excursionAtr:.72,targetDistanceAtr:1.8}});q('early-flow soft missing',early,'READY',5,'EARLY_FLOW');
const chase=coin({__timing:{available:true,status:'EXTENDED',hardBlock:true,earlyStrong:false,score:94,excursionAtr:2.2,targetDistanceAtr:.3}});const cq=q('late chase',chase,'WAIT',6,'NONE');assert.strictEqual(cq.entryReady,false);assert(cq.hidden.reasons.some(r=>/do not chase/.test(r)));
const giveback=coin({__timing:{available:true,status:'EXTENDED',hardBlock:true,score:90,excursionAtr:1.5,givebackAtr:.6,targetDistanceAtr:1.1}});q('spike giveback',giveback,'WAIT',6,'NONE');
const reload=coin({__timing:{available:true,status:'RELOAD',hardBlock:false,earlyStrong:false,score:82,excursionAtr:.9,targetDistanceAtr:2}});q('safe reload',reload,'READY',6,'STRICT');
const ordinaryFive=coin({candle:{bull:false,bear:false},volumeRatio:1.25,proSignal:{confidence:74,rank:70}});q('ordinary five',ordinaryFive,'CONFIRMED',5,'NONE');
const badH1=coin({h1Bull:false,h1Bear:true});q('bad h1',badH1,'WAIT',5,'NONE');
context.marketData=[strict,early,chase,giveback,reload,ordinaryFive,badH1];api.applyGate();
assert.strictEqual(strict.direction,'LONG');assert.strictEqual(early.direction,'LONG');assert.strictEqual(chase.direction,'WAIT');assert.strictEqual(giveback.direction,'WAIT');assert.strictEqual(reload.direction,'LONG');assert.strictEqual(ordinaryFive.direction,'WAIT');assert.strictEqual(badH1.direction,'WAIT');
assert(api.strength(strict,'long')>api.strength(chase,'long'));
console.log('DeepRise V15.8 entry regression: PASS — strict, early-flow, anti-chase, giveback and reload behavior verified.');