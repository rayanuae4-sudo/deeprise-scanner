/* DeepRise CI regression — production V15.5 Whale Money Flow Predictor. */
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
function el(){return{dataset:{},className:'',classList:{add(){},remove(){},toggle(){}},style:{},innerHTML:'',textContent:'',appendChild(){},insertBefore(){},remove(){},addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},scrollIntoView(){}}}
const document={readyState:'loading',head:{appendChild(){}},body:el(),getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]},createElement(){return el()},addEventListener(){}};
const localStorage={getItem(){return'en'},setItem(){}};
const window={};
const context={window,document,localStorage,console,Date,Math,Number,String,Object,Array,Set,Map,JSON,Promise,MutationObserver:class{observe(){} disconnect(){}},setTimeout(){return 0},clearTimeout(){},setInterval(){return 0},clearInterval(){},fetch:async()=>({ok:true,json:async()=>({coins:{}})}),currentLang:'en'};
context.globalThis=context;vm.createContext(context);
vm.runInContext(fs.readFileSync('deeprise-whale-flow-v155.js','utf8'),context,{filename:'deeprise-whale-flow-v155.js'});
const api=context.window.DeepRiseWhaleFlowV155;
assert(api&&api.version==='15.5','Whale Flow V15.5 did not initialize');
assert.strictEqual(api.selfTest(),true,'Whale Flow self-test failed');
function base(o={}){return Object.assign({symbol:'TESTUSDT',base:'TEST',signal:'NEUTRAL',arrival_score:50,distribution_score:50,volume_ratio_15m:1,taker_buy_ratio:.5,taker_acceleration_pp:0,fresh_large_buyers_30m:0,repeat_buyers_6h:0,rotation_in_30m:0,large_net_usd_6h:0,largest_trade_usd:0,large_trade_count_6h:0,pool:{reserve_usd:20000000},captured_at:new Date().toISOString(),evidence:[]},o)}
const arrival=api.predict(base({signal:'WHALE_ARRIVAL',arrival_score:91,distribution_score:24,volume_ratio_15m:1.8,taker_buy_ratio:.65,taker_acceleration_pp:9,fresh_large_buyers_30m:3,repeat_buyers_6h:2,rotation_in_30m:1,large_net_usd_6h:450000,large_trade_count_6h:5}));
assert.strictEqual(arrival.direction,'IN');assert.strictEqual(arrival.stage,'ARRIVAL_CONFIRMED');assert.notStrictEqual(arrival.eta,'—');assert(arrival.evidenceStrength>=80);
const rotation=api.predict(base({arrival_score:72,distribution_score:31,volume_ratio_15m:1.35,taker_buy_ratio:.6,taker_acceleration_pp:6,fresh_large_buyers_30m:1,repeat_buyers_6h:2,rotation_in_30m:1,large_net_usd_6h:180000,large_trade_count_6h:3}));
assert.strictEqual(rotation.direction,'IN');assert(['ROTATION','MOBILIZING','BUY_LIKELY'].includes(rotation.stage));assert.notStrictEqual(rotation.eta,'—');
const out=api.predict(base({signal:'DISTRIBUTION',arrival_score:25,distribution_score:90,volume_ratio_15m:1.7,taker_buy_ratio:.34,taker_acceleration_pp:-8,large_net_usd_6h:-500000,large_trade_count_6h:6}));
assert.strictEqual(out.direction,'OUT');assert(['DISTRIBUTION','OUTFLOW'].includes(out.stage));assert(out.evidenceStrength>=75);
const quiet=api.predict(base());assert.strictEqual(quiet.stage,'NORMAL');
console.log('DeepRise V15.5 whale-flow regression: PASS — arrival, rotation, outflow and quiet-flow cases verified.');
