/* DeepRise chart controls: DOM-level interaction smoke test. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const now=Date.now();
const step=4*60*60*1000;
const rows=Array.from({length:180},(_,i)=>{
 const o=0.2+i*0.0002,c=o+(i%2?0.0005:-0.0002),t=now-(181-i)*step;
 return [t,String(o),String(Math.max(o,c)+0.0005),String(Math.min(o,c)-0.0005),String(c),"12000",t+step-1];
});
const html='<!doctype html><html><head></head><body><div id="chartPanel" class="chart-panel"><div class="chart-head"><div id="chartTitle">BTC/USDT LIVE CHART</div></div><div id="tradingview_chart"></div></div><select id="languageSelect"><option value="en">English</option></select></body></html>';
const dom=new JSDOM(html,{url:'https://deeprise.test/chart.html',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
w.requestAnimationFrame=fn=>w.setTimeout(fn,0);
w.fetch=async()=>({ok:true,json:async()=>rows});
w.openChart=symbol=>{w.chartSymbol=symbol;w.document.querySelector('#chartPanel').classList.add('active')};
w.closeChart=()=>w.document.querySelector('#chartPanel').classList.remove('active');
w.DeepRiseWorkspace={t:key=>key};
w.DeepRiseStructure={
 analyse(raw,{tf}){
  const bars=raw.map(row=>({time:+row[0],open:+row[1],high:+row[2],low:+row[3],close:+row[4],volume:+row[5],closeTime:+row[6]}));
  return{bars,intervalMs:step,pivots:[],events:[],gaps:[],sweeps:[],blocks:[],fib:null,bias:'RANGE',protectedHigh:null,protectedLow:null,barClose:bars.at(-1).closeTime,updated:Date.now()};
 }
};
w.eval(fs.readFileSync('deeprise-structure-chart-v174.js','utf8'));
const engine=w.DeepRiseStructureChart;
assert.ok(engine,'Structure chart module should boot');
assert.equal(engine.version,'17.9');
function button(selector){const b=w.document.querySelector(selector);assert.ok(b,'Missing '+selector);return b}
(async()=>{
 w.openChart('BTCUSDT');
 for(let i=0;i<50&&!engine.state.result;i++)await wait(20);
 assert.ok(engine.state.result,'Opening a coin must fetch and render candles');
 const plot=button('#drStructurePanel svg[data-dr-interactive]');
 assert.match(plot.outerHTML,/BTCUSDT/);
 assert.ok(button('[data-toggle-indicator="orderBlocks"]'),'Order Block toggle must be visible');
 assert.equal(engine.state.layers.orderBlocks,true);
 button('[data-toggle-indicator="orderBlocks"]').click();
 assert.equal(engine.state.layers.orderBlocks,false,'Order Block button must toggle off');
 button('[data-toggle-indicator="orderBlocks"]').click();
 assert.equal(engine.state.layers.orderBlocks,true,'Order Block button must toggle on');
 assert.equal(engine.state.layers.rsi,false);
 button('[data-toggle-indicator="rsi"]').click();
 assert.equal(engine.state.layers.rsi,true,'RSI button must activate study');
 await wait(25);
 assert.match(button('#drStructurePanel svg').outerHTML,/RSI 14/,'RSI should render on chart');
 assert.match(button('[data-indicator-feedback]').textContent,/rsi/i,'A tap needs visible feedback');
 button('[data-toggle-indicator="volume"]').click();
 assert.equal(engine.state.layers.volume,true,'Volume must activate');
 await wait(25);
 assert.match(button('#drStructurePanel svg').outerHTML,/volume/i);
 button('[data-structure-layer="bollinger"]').click();
 assert.equal(engine.state.layers.bollinger,true,'Checkbox must activate Bollinger');
 await wait(25);
 assert.match(button('#drStructurePanel svg').outerHTML,/#9c8ada/,'Bollinger bands must render');
 button('[data-structure-fullscreen]').click();
 assert.ok(button('#drStructurePanel').classList.contains('dr-structure-fullscreen'),'Fullscreen must expand marked chart');
  assert.equal(button('#drStructurePanel').parentElement,w.document.body,'Fullscreen must escape the chart card');
 button('[data-structure-fullscreen]').click();
 assert.ok(!button('#drStructurePanel').classList.contains('dr-structure-fullscreen'),'Fullscreen must close');
  assert.equal(button('#drStructurePanel').parentElement,w.document.getElementById('chartPanel'),'Fullscreen must restore original container');
 const standalone=fs.readFileSync('chart.html','utf8');
 assert.match(standalone,/DOMContentLoaded/);
 assert.match(standalone,/deeprise-structure-chart-v174.js\?v=1790/);
 assert.match(standalone,/symbolForm/);
 console.log('DeepRise v17.9 chart-click DOM regression: PASS');
 dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1;dom.window.close()});
