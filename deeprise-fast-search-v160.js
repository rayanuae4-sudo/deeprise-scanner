/* DeepRise Fast Search v16.4 — bounded network, no competing startup scan, instant search */
(()=>{'use strict';
const INPUT_ID='search',RESULTS_ID='results',FAST_ID='deepriseFastSearchResult';
let timer=null,seq=0,lastQuery='',rescueStarted=false;
const lang=()=>{try{return localStorage.getItem('deeprise_language')||'en'}catch(e){return'en'}};
const copy={en:{searching:'Searching and analysing',error:'Direct search failed. Try again.',direct:'INSTANT SEARCH',live:'Fresh direct analysis',ready:'Scanner ready. Search a coin or tap DEEP SCAN.',reconnecting:'Restoring live market feed…'},ar:{searching:'جارٍ البحث والتحليل المباشر',error:'تعذر البحث المباشر. أعد المحاولة.',direct:'بحث فوري',live:'تحليل مباشر محدث',ready:'الاسكانر جاهز. ابحث عن عملة أو اضغط DEEP SCAN.',reconnecting:'جارٍ استعادة بيانات السوق المباشرة…'},ru:{searching:'Поиск и прямой анализ',error:'Ошибка прямого поиска. Повторите попытку.',direct:'БЫСТРЫЙ ПОИСК',live:'Свежий прямой анализ',ready:'Сканер готов. Найдите монету или нажмите DEEP SCAN.',reconnecting:'Восстановление рыночных данных…'}};
const t=k=>(copy[lang()]||copy.en)[k]||k;
function normalize(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/USDT$/,'')}
function ensureHost(){let h=document.getElementById(FAST_ID);if(h)return h;h=document.createElement('div');h.id=FAST_ID;h.style.display='none';let r=document.getElementById(RESULTS_ID);if(r&&r.parentNode)r.parentNode.insertBefore(h,r);return h}
function showFast(html){let h=ensureHost(),r=document.getElementById(RESULTS_ID);h.innerHTML=html;h.style.display='block';if(r)r.style.display='none'}
function clearFast(){let h=ensureHost(),r=document.getElementById(RESULTS_ID);h.style.display='none';h.innerHTML='';if(r)r.style.display=''}
function p(n){try{return typeof priceFmt==='function'?priceFmt(Number(n)):Number(n).toPrecision(6)}catch(e){return String(n)}}
function f(n){try{return typeof fmt==='function'?fmt(Number(n)):Math.round(Number(n)).toLocaleString()}catch(e){return String(n)}}
function existing(symbol){try{return Array.isArray(marketData)?marketData.find(x=>x.symbol===symbol):null}catch(e){return null}}
function card(x){let d=String(x.direction||'WAIT').toLowerCase();return `<div class="card" data-fast-search="1"><div class="coin-head"><div><div class="rank">⚡ ${t('direct')} • ${t('live')}</div><div class="sym sym-link" onclick="openChart('${x.symbol}')">${x.base}/USDT</div><div class="small">$${p(x.price)} <span class="${x.change>=0?'green':'red'}">${x.change>=0?'+':''}${Number(x.change).toFixed(2)}%</span></div></div><div class="badges"><span class="badge ${d}">${x.direction}</span><span class="badge score">SCORE ${x.score}</span><span class="badge pump">🔥 ${x.pump?.score||0}%</span></div></div><div class="data"><div class="box"><div class="label">Liquidity 24H</div><div class="value blue">$${f(x.quoteVolume)}</div></div><div class="box"><div class="label">Volume Surge</div><div class="value">${Number(x.volumeRatio).toFixed(2)}×</div></div><div class="box"><div class="label">RSI 15m</div><div class="value">${Number(x.rsi).toFixed(1)}</div></div><div class="box"><div class="label">Funding</div><div class="value">${Number(x.funding||0).toFixed(4)}%</div></div><div class="box"><div class="label">15m Trend</div><div class="value">${x.e20>x.e50?'BULLISH':'BEARISH'}</div></div><div class="box"><div class="label">1H Trend</div><div class="value">${x.h1Bull?'BULLISH':x.h1Bear?'BEARISH':'MIXED'}</div></div></div><div class="decision"><b>${x.direction} • ${x.score}/100</b><div class="small">ENTRY: $${p(x.entry)} • STOP: $${p(x.sl)} • TP1: $${p(x.tp1)} • TP2: $${p(x.tp2)}</div></div></div>`}

const spotEndpoints=['https://data-api.binance.vision','https://api.binance.com','https://api1.binance.com'];
async function timedFetch(url,ms=2600){const c=new AbortController(),id=setTimeout(()=>c.abort(),ms);try{const r=await fetch(url,{signal:c.signal,cache:'no-store'});if(!r.ok)throw new Error('API '+r.status);return await r.json()}finally{clearTimeout(id)}}
try{
  getJSON=async function(url){
    let urls=[url];
    if(url.includes('/api/v3/')){const tail=url.slice(url.indexOf('/api/v3/'));urls=spotEndpoints.map(x=>x+tail)}
    let last;
    for(const u of urls){try{return await timedFetch(u,url.includes('/fapi/')?2200:2600)}catch(e){last=e}}
    throw last||new Error('Market data unavailable');
  };
}catch(e){}

try{
  const originalAnalyse=analyseCoin;
  analyseCoin=async function(tick){
    try{return await Promise.race([originalAnalyse(tick),new Promise(resolve=>setTimeout(()=>resolve(null),7500))])}
    catch(e){return null}
  };
}catch(e){}

async function direct(symbol,mySeq){
  let local=existing(symbol);if(local){showFast(card(local));return}
  try{
    let tick=await getJSON(`https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${symbol}`);
    if(mySeq!==seq)return;
    let coin=await analyseCoin(tick);
    if(mySeq!==seq)return;
    if(!coin)throw new Error('analysis unavailable');
    showFast(card(coin));
  }catch(e){if(mySeq!==seq)return;showFast(`<div class="card"><div class="loading red">${t('error')}</div></div>`)}
}
function run(){let input=document.getElementById(INPUT_ID);if(!input)return;let q=normalize(input.value);lastQuery=q;seq++;let mySeq=seq;clearTimeout(timer);if(!q){clearFast();try{render()}catch(e){}return}let symbol=q+'USDT',local=existing(symbol);if(local)showFast(card(local));else showFast(`<div class="card"><div class="loading">⚡ ${t('searching')} ${q}/USDT…</div></div>`);timer=setTimeout(()=>{if(mySeq===seq&&lastQuery===q)direct(symbol,mySeq)},120)}

async function rescueQuickScan(){
  if(rescueStarted)return;rescueStarted=true;
  let r=document.getElementById('results'),top=document.getElementById('top3'),regime=document.getElementById('marketRegime');
  if(r)r.innerHTML=`<div class="loading">${t('reconnecting')}</div>`;
  try{
    const ticks=await getJSON('https://data-api.binance.vision/api/v3/ticker/24hr');
    const universe=ticks.filter(x=>x.symbol&&x.symbol.endsWith('USDT')&&!/(UPUSDT|DOWNUSDT|BULLUSDT|BEARUSDT)/.test(x.symbol)&&Number(x.quoteVolume)>10000000).sort((a,b)=>Number(b.quoteVolume)-Number(a.quoteVolume)).slice(0,12);
    const out=[];
    for(let i=0;i<universe.length;i+=4){const batch=await Promise.all(universe.slice(i,i+4).map(x=>analyseCoin(x)));out.push(...batch.filter(Boolean));if(out.length){marketData=[...out].sort((a,b)=>b.score-a.score);try{updateBTC();render()}catch(e){}}}
    if(out.length){marketData=out.sort((a,b)=>b.score-a.score);try{updateBTC();render();renderTop()}catch(e){};if(regime)regime.innerHTML='Market: <b class="green">LIVE</b>';let u=document.getElementById('lastUpdate');if(u)u.innerHTML='Updated: <b>'+new Date().toLocaleTimeString()+'</b>'}
    else throw new Error('no data');
  }catch(e){if(r)r.innerHTML=`<div class="loading">${t('ready')}</div>`;if(top)top.innerHTML='<div class="loading">Tap DEEP SCAN to build Top Setups.</div>';if(regime)regime.innerHTML='Market: <b class="yellow">READY</b>'}
  finally{try{scanRunning=false}catch(e){}}
}

function init(){
  let input=document.getElementById(INPUT_ID);
  if(input&&!input.dataset.fastSearchReady){input.dataset.fastSearchReady='1';input.setAttribute('autocomplete','off');input.addEventListener('input',run,{passive:true});input.addEventListener('search',run,{passive:true})}
  setTimeout(()=>{try{const noData=!Array.isArray(marketData)||!marketData.length;const universeReady=!!window.DeepRiseBinanceUniverse?.state?.symbols?.length;if(!scanRunning&&noData&&!universeReady)rescueQuickScan()}catch(e){}},10000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();