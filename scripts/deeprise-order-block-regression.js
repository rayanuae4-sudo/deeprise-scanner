/* DeepRise V17.4: closed-candle order-block and mobile chart smoke regression. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const engine=fs.readFileSync('deeprise-market-structure-v174.js','utf8');
const chartCode=fs.readFileSync('deeprise-structure-chart-v174.js','utf8');
const win={innerWidth:390,DeepRiseWorkspace:{t:k=>k}};
vm.runInNewContext(engine,{window:win},{filename:'deeprise-market-structure-v174.js'});
assert.equal(win.DeepRiseStructure.version,'17.9');
const closes=[100,101,103,105,103,101,99,100,101,100,99,102,104,108,105,101,98,99,100,96,97,103,110,107,105,103,106,112,108,105,99,96,98,104,113,110,106,103,101,107,114,120];
const now=Date.now(),interval=14_400_000;
const raw=closes.map((close,i)=>{
 const open=i?closes[i-1]:close-1,start=now-(closes.length-i)*interval;
 return[start,open,Math.max(open,close)+.3,Math.min(open,close)-.3,close,250+i*3,start+interval-3000];
});
const result=win.DeepRiseStructure.analyse(raw,{tf:'4h',pivotSpan:2,now});
assert.ok(result&&result.events.length>=3,'expected confirmed structure breaks');
assert.ok(result.internal&&result.external,'separate internal/external structure tracks must exist');
assert.equal(result.internal.pivotSpan,1);
assert.equal(result.external.pivotSpan,2);
assert.ok(result.blocks.length>=3,'expected confirmed order blocks');
assert.ok(result.blocks.some(b=>b.status==='FRESH'),'fresh blocks');
assert.ok(result.blocks.some(b=>b.status==='TESTED'),'retested blocks');
assert.ok(result.blocks.some(b=>b.status==='INVALID'),'invalidated blocks');
for(const b of result.blocks){
 assert.ok(b.breakIndex>b.originIndex,'confirmed only after origin candle');
 assert.ok(b.lower>0&&b.upper>b.lower,'positive zone');
 assert.equal(b.confirmedAt,result.bars[b.breakIndex].closeTime,'break-candle confirmation timestamp');
 const before=win.DeepRiseStructure.analyse(raw.slice(0,b.breakIndex),{tf:'4h',pivotSpan:2,now});
 assert.ok(!before.blocks.some(x=>x.breakIndex===b.breakIndex),'no future blocks visible before confirmed break');
}
const panel={clientWidth:390,innerHTML:'',querySelector:()=>({open:true}),addEventListener:()=>{},dir:''};
const doc={getElementById:id=>id==='drStructurePanel'?panel:null,querySelector:()=>null,createElement:()=>({textContent:''}),head:{appendChild:()=>{}},addEventListener:()=>{}};
const store={getItem:key=>key==='deeprise_language'?'ar':null};
vm.runInNewContext(chartCode,{window:win,document:doc,localStorage:store,addEventListener:()=>{},requestAnimationFrame:()=>{}},{filename:'deeprise-structure-chart-v174.js'});
const chart=win.DeepRiseStructureChart;chart.state.symbol='TESTUSDT';chart.state.tf='4h';chart.state.result=result;
chart.render();
assert.ok(panel.innerHTML.includes('مناطق الأوردر بلوك'),'Arabic order-block toggle');
assert.ok(panel.innerHTML.includes('المؤشرات'),'Arabic indicators picker');
assert.ok(panel.innerHTML.includes('BULL OB')||panel.innerHTML.includes('BEAR OB'),'plotted active order blocks');
assert.ok(chart.svg(result).includes('viewBox="0 0 390 460"'),'mobile width');
chart.setPreset('advanced');
assert.ok(panel.innerHTML.includes('#ffce77')&&panel.innerHTML.includes('#72affd'),'EMA overlays in advanced mode');
chart.state.layers.rsi=true;chart.state.layers.volume=true;chart.render();
assert.ok(chart.svg(result).includes('viewBox="0 0 390 615"'),'RSI/volume expanded chart');
assert.ok(panel.innerHTML.includes('RSI 14'),'RSI pane label');
assert.ok(panel.innerHTML.includes('حجم التداول'),'volume pane label');
const oldCount=chart.state.view.count;chart.zoom(.75);assert.ok(chart.state.view.count<=oldCount,'zoom in');
console.log('V18.0 order-block and chart smoke regression PASS');
