'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const values=new Map(),document={readyState:'loading',documentElement:{lang:'en'},getElementById(){return null},querySelector(){return null},querySelectorAll(){return[]},addEventListener(){},createElement(){return{style:{},appendChild(){}}},head:{appendChild(){}}};
const context={window:{},document,localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},console,Date,Intl,Math,Number,String,Object,Array,Set,Map,JSON,AbortController,Event,addEventListener(){},setTimeout(){},setInterval(){},clearTimeout(){},requestAnimationFrame(){},MutationObserver:class{observe(){}},fetch(){throw Error('No network in regression')}};
vm.createContext(context);
for(const name of ['deeprise-workspace-v173.js','deeprise-market-structure-v172.js','deeprise-structure-chart-v172.js','deeprise-pre-move-v170.js'])vm.runInContext(fs.readFileSync(name,'utf8'),context,{filename:name});
const w=context.window.DeepRiseWorkspace,chart=context.window.DeepRiseStructureChart,structure=context.window.DeepRiseStructure;
assert.equal(chart.version,'17.3');assert.equal(typeof chart.zoom,'function','drawing API must survive initialization');

// Positive directional returns and risk: shorts must not use absolute distance to an invalid target.
const long={symbol:'AUSDT',side:'LONG',entryLo:99,entryHi:101,invalid:95,tp1:110,tp2:120,score:80};
const short={symbol:'BUSDT',side:'SHORT',entry:100,sl:105,tp1:90,tp2:80,score:80};
for(const x of [long,short]){const m=w.targetMetrics(x);assert.equal(m.entry,100);assert.equal(m.tp1Pct,10);assert.equal(m.tp2Pct,20);assert.equal(m.riskPct,5);assert.equal(m.rr,4)}
assert.equal(w.targetMetrics({...short,tp2:110}).tp2Pct,null);
assert.equal(w.targetMetrics({...long,invalid:102}).rr,null);
assert.equal(w.targetMetrics({...short,tp2:0}).tp2Pct,null);
assert.equal(w.targetMetrics({...short,side:'WAIT'}).tp2Pct,null);
w.state.sort='target';assert(w.compare(long,{...long,symbol:'CUSDT',tp2:150},{group:'READY'},{group:'EARLY'})<0,'high target must not promote an early setup over ready');
assert(w.compare({...long,tp2:150},long,{group:'READY'},{group:'READY'})<0);
assert(w.compare(long,{...long,tp2:0},{group:'READY'},{group:'READY'})<0);
w.state.sort='combined';assert(w.compare({...long,score:90,tp2:110},long,{group:'NEAR'},{group:'NEAR'})<0);
assert(w.compare({...long,tp2:130},long,{group:'NEAR'},{group:'NEAR'})<0);

// Local-time sessions shift independently through UK / US DST; weekends cannot show open.
const london={id:'london',tz:'Europe/London',start:8,end:17},ny={id:'newyork',tz:'America/New_York',start:8,end:17},tokyo={id:'tokyo',tz:'Asia/Tokyo',start:9,end:18};
const iso=x=>new Date(x).toISOString();
assert.equal(iso(w.sessionInfo(london,Date.parse('2026-01-15T07:00Z')).start),'2026-01-15T08:00:00.000Z');
assert.equal(iso(w.sessionInfo(london,Date.parse('2026-07-15T06:00Z')).start),'2026-07-15T07:00:00.000Z');
assert.equal(iso(w.sessionInfo(ny,Date.parse('2026-01-15T10:00Z')).start),'2026-01-15T13:00:00.000Z');
assert.equal(iso(w.sessionInfo(ny,Date.parse('2026-07-15T10:00Z')).start),'2026-07-15T12:00:00.000Z');
assert.equal(iso(w.sessionInfo(london,Date.parse('2026-10-28T07:00Z')).start),'2026-10-28T08:00:00.000Z');
assert.equal(iso(w.sessionInfo(ny,Date.parse('2026-10-28T10:00Z')).start),'2026-10-28T12:00:00.000Z');
assert.equal(iso(w.sessionInfo(ny,Date.parse('2026-11-04T10:00Z')).start),'2026-11-04T13:00:00.000Z');
assert.equal(iso(w.sessionInfo(tokyo,Date.parse('2026-07-15T01:00Z')).start),'2026-07-15T00:00:00.000Z');
assert(w.sessionInfo(london,Date.parse('2026-10-16T07:00Z')).active);
assert(!w.sessionInfo(london,Date.parse('2026-10-16T16:00Z')).active,'end boundary must close session');
for(const session of [london,ny,tokyo]){const s=w.sessionInfo(session,Date.parse('2026-10-17T14:00Z'));assert(!s.active);assert.equal(new Date(s.start).getUTCDay(),1)}

// The visible 4H checklist matches the actual readiness gate; FVG and Fib stay optional.
const now=Date.now(),step=14400000,z={...long,stage:'IGNITION',price:100.05,closedPrice:100.1,trigger:100,atr:1,entryLo:99.65,entryHi:100.15,invalid:98,ts:now};
const st={updated:now,barClose:now-10000,intervalMs:step,bias:'LONG',protectedLow:{price:99},lastEvent:{side:'LONG',type:'BOS',index:8},bars:Array(10),gaps:[],fib:null};
assert(w.radarChecks(z,st,now).every(([,ok])=>ok));assert.equal(structure.classify(z,st,now).group,'READY');
const noClose={...z,closedPrice:99.9};assert(!w.radarChecks(noClose,st,now).find(([key])=>key==='close')[1]);assert.equal(structure.classify(noClose,st,now).group,'NEAR');
assert(!w.radarChecks(z,{...st,updated:now-400000},now).find(([key])=>key==='fresh')[1]);
assert(!w.radarChecks({...z,price:98.5},st,now).find(([key])=>key==='protected')[1]);

// Chart view bounds, data-coordinate drawings, directional Fib and symbol/timeframe isolation.
const fixture=JSON.parse(fs.readFileSync('scripts/fixtures/arb-usdt-4h-pre-move-2026.json','utf8'));
const result=structure.analyse(fixture.bars,{tf:'4h',now:Number(fixture.bars.at(-1)[6])+5000});assert(result);
Object.assign(chart.state,{symbol:'ARBUSDT',tf:'4h',result});const n=result.bars.length;
chart.zoom(.5);assert.equal(chart.state.view.count,38);chart.zoom(.0001);assert.equal(chart.state.view.count,20);chart.pan(1e6);assert.equal(chart.viewport(n).first,0);chart.pan(-1e6);assert.equal(chart.state.view.offset,0);chart.fit();assert.equal(chart.state.view.count,75);
chart.state.tool='line';const a={time:result.bars.at(-20).time,price:result.bars.at(-20).close},b={time:result.bars.at(-3).time,price:result.bars.at(-3).close};chart.addPoint(a);assert(chart.state.pending);chart.addPoint(b);assert.equal(chart.drawings().length,1);assert(values.get('deeprise_drawings_v173').includes('ARBUSDT:4h'));
chart.state.tool='horizontal';chart.addPoint(a);assert.equal(chart.drawings().length,2);
chart.state.tool='rectangle';chart.addPoint(a);chart.addPoint(b);
chart.state.tool='drawFib';chart.addPoint(a);chart.addPoint(b);assert.equal(chart.drawings().length,4);
for(const key of Object.keys(chart.state.layers))chart.state.layers[key]=true;
for(const offset of [0,50,1e4]){chart.state.view.offset=offset;const svg=chart.svg(result);assert(!/NaN|Infinity|undefined/.test(svg));assert(!/\b(?:width|height)="-/.test(svg),'panning must not emit negative SVG rectangles');assert(svg.includes('drDrawingClip'));assert(svg.includes('Fib 0.618'));assert(svg.includes('data-dr-interactive'))}
chart.state.tf='1h';assert.equal(chart.drawings().length,0);chart.state.tf='4h';chart.state.symbol='BTCUSDT';assert.equal(chart.drawings().length,0);chart.state.symbol='ARBUSDT';assert.equal(chart.drawings().length,4);
chart.saveDrawings(chart.drawings().slice(0,-1));assert.equal(chart.drawings().length,3);chart.saveDrawings([]);assert.equal(chart.drawings().length,0);
assert.equal(structure.analyse(fixture.bars,{tf:'5m',now:Number(fixture.bars.at(-1)[6])+5000}).intervalMs,300000);

// New UI is translated and does not leak invalid prices in sparse data.
for(const language of ['en','ar','ru']){values.set('deeprise_language',language);const html=w.checklistHtml(z,st)+w.sessionHtml(Date.parse('2026-10-16T12:00Z'))+w.sortControl()+w.metricsHtml({});assert(!/NaN|undefined/.test(html));assert(html.includes('data-dr-sort'));assert(!html.includes('>checks<'))}
assert(context.window.DeepRisePreMove.card({...z,stage:'ARMED',score:80,detectedPrice:100,distanceAtr:0,R:55,volBuild:1.2,reasons:[]}).includes('dr-checklist'));

// The optional calibrated engine must preserve the selected order and avoid self-triggering DOM moves.
context.marketData=[long,{...long,symbol:'CUSDT',tp2:150}];
const cards=[{dataset:{drSymbol:'AUSDT'}},{dataset:{drSymbol:'CUSDT'}}];let moves=0;
const root={querySelectorAll(){return [...cards]},querySelector(){return null},insertBefore(card){cards.splice(cards.indexOf(card),1);cards.push(card);moves++}};
document.getElementById=id=>id==='results'?root:null;
vm.runInContext(fs.readFileSync('deeprise-signal-engine-v149.js','utf8'),context,{filename:'deeprise-signal-engine-v149.js'});
w.state.sort='target';context.window.DeepRiseSignalEngine.render();assert.equal(cards[0].dataset.drSymbol,'CUSDT');const before=moves;context.window.DeepRiseSignalEngine.render();assert.equal(moves,before,'unchanged card order must not retrigger observers');
document.getElementById=id=>id==='drStructurePanel'?{clientWidth:390}:null;
assert(chart.svg(result).includes('viewBox="0 0 420 460"'),'mobile chart must use a readable responsive viewBox');
document.getElementById=()=>null;

console.log('V17.3 workspace regression: PASS — directional return/risk, stage-preserving sorting, independent DST/weekends, exact entry checklist, zoom/pan bounds, saved drawings and EN/AR/RU.');
