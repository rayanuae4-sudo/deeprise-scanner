const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const errors=[],requests=[];
 page.on('pageerror',e=>errors.push('JS: '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
 page.on('requestfailed',r=>requests.push(r.url()+' '+(r.failure()?.errorText||'')));
 const url=process.env.CHART_URL||'https://rayanuae4-sudo.github.io/deeprise-scanner/chart.html?symbol=BTCUSDT&tf=4h';
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForTimeout(10000);
 const detail=await page.evaluate(()=>{
 const c=window.DeepRiseStructureChart;
 return{status:document.querySelector('#standaloneStatus')?.textContent,
  version:c?.version,ready:!!c,state:c?{symbol:c.state.symbol,loading:c.state.loading,error:c.state.error,errorMessage:c.state.errorMessage,result:!!c.state.result,bars:c.state.result?.bars?.length}:null,
  buttons:document.querySelectorAll('[data-toggle-indicator]').length,
  svg:!!document.querySelector('#drStructurePanel svg[data-dr-interactive]'),
  panel:!!document.querySelector('#drStructurePanel'),
  body:document.body.textContent.slice(-600)}
 });
 console.log('HTTP',response?.status(),'DETAIL',JSON.stringify(detail),'ERRORS',JSON.stringify(errors.slice(0,10)),'FAILED_REQUESTS',JSON.stringify(requests.slice(0,12)));
 if(detail.buttons){
  await page.locator('[data-toggle-indicator="rsi"]').click({timeout:10000});
  await page.waitForTimeout(400);
  console.log('RSI',await page.evaluate(()=>({state:window.DeepRiseStructureChart?.state.layers.rsi,rendered:!!document.querySelector('svg path[stroke="#bba2ff"]'),feedback:document.querySelector('[data-indicator-feedback]')?.textContent})));
  await page.locator('[data-structure-fullscreen]').click({timeout:10000});
  console.log('FULL',await page.evaluate(()=>({expanded:window.DeepRiseStructureChart?.state.expanded,class:document.getElementById('drStructurePanel')?.className})));
 }
 await browser.close();
 if(errors.length||!detail.svg||detail.error)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
