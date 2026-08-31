/* DeepRise Stable Loader v16.4.1 */
(()=>{'use strict';
const status=document.getElementById('status');
const retry=document.getElementById('retry');
const fail=(msg)=>{if(status)status.textContent=msg;if(retry){retry.hidden=false;retry.onclick=()=>location.reload()}};
(async()=>{
  try{
    const r=await fetch('./index.html?stable=16.4.1&t='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    let html=await r.text();
    const startup=/loadMarket\(\);\s*setInterval\(loadMarket,60000\);/;
    if(!startup.test(html))throw new Error('startup marker not found');
    const safe=`try{const results=document.getElementById("results"),top3=document.getElementById("top3"),regime=document.getElementById("marketRegime");if(results)results.innerHTML='<div class="loading">Ready. Search a coin instantly or tap ⚡ DEEP SCAN.</div>';if(top3)top3.innerHTML='<div class="loading">Tap ⚡ DEEP SCAN to build Top Setups.</div>';if(regime)regime.innerHTML='Market: <b class="yellow">READY</b>'}catch(e){}`;
    html=html.replace(startup,safe);
    html=html.replace('deeprise-fast-search-v160.js?v=1601','deeprise-fast-search-v160.js?v=1641');
    html=html.replace('deeprise-v13-gate-hotfix.js?v=1310','deeprise-v13-gate-hotfix.js?v=1641');
    html=html.replace('pwa.js?v=1310','pwa.js?v=1641');
    document.open();
    document.write(html);
    document.close();
  }catch(e){fail('Could not start DeepRise safely: '+e.message)}
})();
})();
