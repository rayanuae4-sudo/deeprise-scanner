'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const context={window:{},Date,Number,Math,Set,Map,Intl};
vm.createContext(context);
for(const path of ['deeprise-market-structure-v174.js','deeprise-structure-explain-v182.js']){
 vm.runInContext(fs.readFileSync(path,'utf8'),context,{filename:path});
}
const engine=context.window.DeepRiseStructure,api=context.window.DeepRiseStructureExplain;
assert.equal(api.version,'18.2');
const closes=[100,101,103,105,103,101,99,100,101,100,99,102,104,108,105,101,98,99,100,96,97,103,110,107,105,103,106,112,108,105,99,96,98,104,113,110,106,103,101,107,114,120];
const now=Date.now(),step=14400000;
const raw=closes.map((close,i)=>{
 const open=i?closes[i-1]:close-1,start=now-(closes.length-i)*step;
 return[start,open,Math.max(open,close)+.3,Math.min(open,close)-.3,close,250+i*3,start+step-3000];
});
const result=engine.analyse(raw,{tf:'4h',pivotSpan:2,now});
assert(result&&result.events.length>0&&result.pivots.length>0);
const records=api.build(result);
for(const type of ['PIVOT','BREAK','OB','FVG'])assert(records.some(x=>x.kind===type),'missing '+type);
assert(records.some(x=>x.kind==='PROTECTED'),'protected levels must have a time-specific explanation');
const expectedBreak=result.events[0],observed=records.find(x=>x.id==='break-'+expectedBreak.index+'-'+expectedBreak.side);
assert.equal(observed.data.prior,expectedBreak.priorBias,'frozen historical bias');
assert.equal(observed.data.close,result.bars[observed.index].close,'use actual closed-candle close');
assert.equal(observed.data.atr,expectedBreak.atrAtBreak,'show displacement in historical ATR units');
const p=records.find(x=>x.kind==='PROTECTED'),d=api.describe(p,'ar');
assert(/قاع|قمة/.test(d.why),'Arabic protected-level rationale');
assert(/إغلاق/.test(d.invalid),'explicit closed-candle invalidation');
for(const x of records){
 const detail=api.describe(x,'en');
 assert(detail.title&&detail.why&&detail.outlook&&detail.invalid&&detail.confirmed,'complete explanation '+x.id);
}
const bull=api.outlook(result,'LONG','ar'),bear=api.outlook(result,'SHORT','ar');
assert(bull.reasons.length&&bear.risks.length&&bull.caveat);
assert(records.every(x=>x.at<=now&&Number.isFinite(x.index)),'no future confirmations');
const dom=new JSDOM('<!doctype html><html><head></head><body><div id="drStructurePanel"></div></body></html>',{
 url:'https://localhost/chart.html?symbol=TESTUSDT',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
w.localStorage.setItem('deeprise_language','ar');
w.DeepRiseStructureExplain=api;
let paints=0;
w.DeepRiseStructureChart={state:{symbol:'TESTUSDT',tf:'4h',result,view:{count:30,offset:0},geometry:null},
 paintChart:()=>{paints++;},
 viewport:(n)=>({first:0,end:n,count:n})};
w.eval(fs.readFileSync('deeprise-structure-reasons-v182.js','utf8'));
w.DeepRiseStructureReasons.sync();
let root=w.document.querySelector('#drWhyRoot');
assert(root&&root.textContent.includes('لماذا'),'Arabic explanation panel displayed');
assert(root.querySelectorAll('[data-dr-why-select]').length,'individual level controls present');
assert(root.textContent.includes('دليل التصنيف'),'evidence is available');
root.querySelector('[data-dr-why-filter="BREAK"]').click();
root=w.document.querySelector('#drWhyRoot');
assert.equal(w.DeepRiseStructureReasons.model.filter,'BREAK');
assert([...root.querySelectorAll('[data-dr-why-select]')].every(x=>x.textContent.includes('BOS')||x.textContent.includes('CHOCH')));
root.querySelector('[data-dr-why-side="SHORT"]').click();
assert.equal(w.DeepRiseStructureReasons.model.side,'SHORT');
root=w.document.querySelector('#drWhyRoot');
root.querySelector('[data-dr-why-select]').click();
assert(root.querySelector('[data-dr-why-detail]').textContent.includes('إغلاق'),'selection details update');
root.querySelector('[data-dr-why-jump]').click();
assert(paints>0,'chart navigation redraws native chart');
// Native chart wipes its own panel on re-render; explanation panel should restore itself.
w.document.querySelector('#drStructurePanel').innerHTML='<div class="dr-structure-scroll"></div>';
returnAfterMutation();
function returnAfterMutation(){
 w.DeepRiseStructureReasons.sync();
 assert(w.document.querySelector('#drWhyRoot'),'explanations survive chart re-render');
}
dom.window.close();
console.log('DeepRise V18.2 explanation regression PASS — closed-candle evidence, all marker categories, AR notes, DOM controls and chart navigation');
