const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

let now=1800000000000;
const storage=new Map();
const context={
 window:{},document:{createElement:()=>({}),head:{appendChild(){}}},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 Date:{now:()=>now},Number,Math,JSON,String,Object,Array
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('deeprise-signal-stability-v171.js','utf8'),context);
const gate=context.window.DeepRiseSignalStability;
const coin={symbol:'TESTUSDT',score:88,proSignal:{confidence:88,detailed:true,multiTfAligned:true}};
const bar=now-1000;
assert.equal(gate.apply(coin,'LONG',bar).direction,'LONG');
assert.equal(gate.apply(coin,'SHORT',bar).direction,'WAIT');
assert.equal(coin.signalStability.status,'REVERSAL_PENDING');
now+=60000;
assert.equal(gate.apply(coin,'SHORT',bar).direction,'WAIT','repeat ticks on one candle do not confirm');
now+=14*60000;
assert.equal(gate.apply(coin,'SHORT',bar+15*60000).direction,'WAIT');
now+=15*60000;
assert.equal(gate.apply(coin,'SHORT',bar+30*60000).direction,'SHORT');
assert.equal(coin.signalStability.status,'REVERSAL_CONFIRMED');
coin.proSignal.multiTfAligned=false;
assert.equal(gate.apply(coin,'LONG',bar+45*60000).direction,'WAIT','conflicting timeframes fail closed');
coin.proSignal.multiTfAligned=true;
assert.equal(gate.apply(coin,'WAIT',bar+45*60000).direction,'WAIT','weak evidence does not preserve entry');
console.log('Signal stability regression passed');
