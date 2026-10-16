'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('chart.html','utf8');
const dom=new JSDOM(html,{url:'https://example.test/chart.html?symbol=BTCUSDT&tf=4h&view=tv&lang=ar',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,doc=w.document;
w.DeepRiseStructure={};
const state={symbol:'BTCUSDT',tf:'4h',expanded:false,layers:{orderBlocks:true,rsi:false},result:null,error:false,errorMessage:''};
w.DeepRiseStructureChart={
 state,
 load:async(symbol,tf)=>{state.symbol=symbol;state.tf=tf;state.result={bars:Array(40).fill({}),blocks:[]}},
 toggleFullscreen:()=>{state.expanded=!state.expanded},
 updateLayer:(k,v)=>{state.layers[k]=v}
};
const inline=[...doc.querySelectorAll('script')].find(s=>s.textContent.includes('function mountTV('));
assert(inline,'standalone interactive TradingView host must exist');
w.eval(inline.textContent);
doc.dispatchEvent(new w.Event('DOMContentLoaded',{bubbles:true}));
const tv=()=>doc.querySelector('#tvWidget script[src*="embed-widget-advanced-chart.js"]');
const config=()=>JSON.parse(tv().textContent);
assert.equal(doc.querySelector('#tvStandalone').hidden,false,'TV view is visible from deep link');
assert.equal(doc.querySelector('#chartPanel').hidden,true,'native chart hidden while TV is selected');
assert.equal(config().symbol,'BINANCE:BTCUSDT');
assert.equal(config().interval,'240');
assert.equal(config().allow_symbol_change,true);
assert.equal(config().hide_top_toolbar,false);
assert.equal(config().hide_side_toolbar,false);
assert.equal(config().save_image,true);
assert(doc.querySelector('#tvExternal').href.includes('BINANCE%3ABTCUSDT'),'external TradingView fallback visible');
const tf=doc.querySelector('#tvTF');tf.value='1h';tf.dispatchEvent(new w.Event('change',{bubbles:true}));
assert.equal(config().interval,'60','timeframe button reloads TV widget');
const expand=doc.querySelector('#tvExpand');expand.click();
assert(doc.querySelector('#tvStandalone').classList.contains('tv-immersive'),'TV fullscreen works');
expand.click();assert(!doc.querySelector('#tvStandalone').classList.contains('tv-immersive'));
const input=doc.querySelector('#coinSymbol');input.value='ETHUSDT';
doc.querySelector('#symbolForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
assert.equal(config().symbol,'BINANCE:ETHUSDT','symbol changes TV immediately without waiting for native fetch');
assert(doc.querySelector('#tvExternal').href.includes('BINANCE%3AETHUSDT'));
const previous=tv();doc.querySelector('#tvRetry').click();assert.notEqual(tv(),previous,'TV retry remounts widget');
doc.querySelector('#nativeTop').click();assert.equal(doc.querySelector('#tvStandalone').hidden,true);
assert.equal(doc.querySelector('#chartPanel').hidden,false,'native chart restores correctly');
doc.querySelector('#tvTop').click();assert.equal(doc.querySelector('#tvStandalone').hidden,false);
dom.window.close();
console.log('DeepRise V18.2 TradingView integration PASS: full widget config, symbol, timeframe, retry, external fallback, fullscreen, native switch');
