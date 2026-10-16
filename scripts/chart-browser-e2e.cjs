const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push('JS: '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
 page.on('requestfailed',r=>requests.push(r.url()+' '+(r.failure()?.errorText||'')));
 const url=process.env.CHART_URL||'https://rayanuae4-sudo.github.io/deeprise-scanner/chart.html?symbol=BTCUSDT&tf=4h';
 let response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 for(let i=0;i<15;i++){
  await page.waitForTimeout(7000);
  const version=await page.evaluate(()=>window.DeepRiseStructureChart?.version||null);
  if(version==='17.8')break;
  if(i===14)throw Error('Deployment did not serve chart version 17.8; got '+version);
  response=await page.reload({waitUntil:'domcontentloaded',timeout:60000});
 }
 const detail=await page.evaluate(()=>{
 const c=window.DeepRiseStructureChart;
 return{status:document.querySelector('#standaloneStatus')?.textContent,
  version:c?.version,ready:!!c,state:c?{symbol:c.state.symbol,loading:c.state.loading,error:c.state.error,errorMessage:c.state.errorMessage,result:!!c.state.result,bars:c.state.result?.bars?.length}:null,
  buttons:document.querySelectorAll('[data-toggle-indicator]').length,
  obToggle:!!document.querySelector('[data-toggle-indicator="orderBlocks"]'),
  obTop:!!document.getElementById('obTop'),
  fullTop:!!document.getElementById('fullTop'),
  orderBlocks:c?.state.result?.blocks?.filter(x=>x.status!=='INVALID').length??0,
  svg:!!document.querySelector('#drStructurePanel svg[data-dr-interactive]'),
  panel:!!document.querySelector('#drStructurePanel'),
  body:document.body.textContent.slice(-600)}
 });
 console.log('HTTP',response?.status(),'DETAIL',JSON.stringify(detail),'ERRORS',JSON.stringify(errors.slice(0,10)),'FAILED_REQUESTS',JSON.stringify(requests.slice(0,12)));
 if(detail.buttons){
  await page.locator('[data-toggle-indicator="rsi"]').click({timeout:10000});
  await page.waitForTimeout(400);
  console.log('RSI',await page.evaluate(()=>({state:window.DeepRiseStructureChart?.state.layers.rsi,rendered:!!document.querySelector('svg path[stroke="#bba2ff"]'),feedback:document.querySelector('[data-indicator-feedback]')?.textContent})));
  if(!detail.obTop||!detail.obToggle||!detail.fullTop)throw Error('Missing prominent OB/full-screen controls');
  await page.locator('#obTop').click();
  const obAfter=await page.evaluate(()=>window.DeepRiseStructureChart?.state.layers.orderBlocks);
  if(obAfter!==false)throw Error('Top order-block button failed');
  await page.locator('[data-toggle-indicator="orderBlocks"]').click();
  const obBack=await page.evaluate(()=>window.DeepRiseStructureChart?.state.layers.orderBlocks);
  if(obBack!==true)throw Error('In-chart order-block button failed');
  const beforeZoom=await page.evaluate(()=>window.DeepRiseStructureChart?.state.view.count);
  await page.locator('[data-chart-zoom=".75"]').click();
  await page.waitForTimeout(250);
  const afterZoom=await page.evaluate(()=>window.DeepRiseStructureChart?.state.view.count);
  console.log('ORDER_BLOCKS_AND_ZOOM',JSON.stringify({obAfter,obBack,beforeZoom,afterZoom}));
  if(afterZoom>=beforeZoom)throw Error('Zoom button did not adjust candle count');
  await page.locator('#fullTop').click({timeout:10000});
  console.log('FULL',await page.evaluate(()=>({expanded:window.DeepRiseStructureChart?.state.expanded,class:document.getElementById('drStructurePanel')?.className})));
 }
 await browser.close();
 if(errors.length||!detail.svg||detail.error||detail.version!=='17.8')process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
