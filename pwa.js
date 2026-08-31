(()=>{'use strict';
const L=()=>localStorage.getItem('deeprise_language')||'en';
const copy={en:{install:'Install DeepRise',ios:'Install on iPhone',how:'Tap Share, then Add to Home Screen',ready:'DeepRise V15.9 is ready to install'},ar:{install:'تثبيت DeepRise',ios:'تثبيت على الآيفون',how:'اضغط مشاركة ثم إضافة إلى الشاشة الرئيسية',ready:'DeepRise V15.9 جاهز للتثبيت'},ru:{install:'Установить DeepRise',ios:'Установить на iPhone',how:'Нажмите Поделиться, затем На экран Домой',ready:'DeepRise V15.9 готов к установке'}};
const t=k=>(copy[L()]||copy.en)[k];let deferred=null;
function brand(){document.title='DeepRise V15.9 PRO';const h=document.querySelector('.brand h1');if(h)h.textContent='⚡ DeepRise V15.9 PRO';const mobileSub=document.querySelector('.dr-mobile-brand small');if(mobileSub)mobileSub.textContent='V15.9 PRO Mobile';const bars=[...document.querySelectorAll('.marketbar span')];const engine=bars.find(x=>/Engine:/i.test(x.textContent||''));if(engine)engine.innerHTML='Engine: <b>V15.9 PRO</b>';const footer=document.querySelector('.footer');if(footer)footer.textContent='DeepRise V15.9 PRO analyses public market and on-chain data. Signals are probabilistic, not guarantees or financial advice.'}
function languagePerformancePatch(){try{if(typeof languageObserver!=='undefined')languageObserver.disconnect()}catch(e){}let tm=null;const schedule=()=>{clearTimeout(tm);tm=setTimeout(()=>{try{if(typeof applyLanguage==='function')applyLanguage()}catch(e){}},450)};const opt={childList:true,subtree:true};['results','top3','signalResultsPanel','deepriseFastSearchResult'].forEach(id=>{const el=document.getElementById(id);if(el)try{new MutationObserver(schedule).observe(el,opt)}catch(e){}});window.DeepRiseLanguageRefresh=schedule}
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=stable-v15-9-fast2',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{}));
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function button(){if(standalone||document.getElementById('deepriseInstall'))return;let b=document.createElement('button');b.id='deepriseInstall';b.textContent='⬇ '+t('install');b.style.cssText='position:fixed;right:14px;bottom:14px;z-index:99998;border:1px solid #35e0a1;background:#071b26;color:#35e0a1;border-radius:14px;padding:12px 16px;font-weight:800;box-shadow:0 10px 30px #0008';b.onclick=async()=>{if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;b.remove();return}const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);alert(ios?t('how'):t('ready'))};document.body.appendChild(b)}
function load(id,src){if(document.getElementById(id))return;let s=document.createElement('script');s.id=id;s.src=src;s.defer=true;s.async=true;document.body.appendChild(s)}
function fastSearchLayer(){load('dr-fast-search-v160-loader','./deeprise-fast-search-v160.js?v=1601')}
function nextCandleLayer(){load('dr-next-candle-loader','./deeprise-next-candle-v145.js?v=1450')}
function forecastSafetyLayer(){load('dr-forecast-safety-loader','./deeprise-forecast-safety-v145.js?v=1450')}
function signalEngineLayer(){load('dr-signal-engine-v149-loader','./deeprise-signal-engine-v149.js?v=1490')}
function uiLayer(){load('dr-ui-v146-loader','./deeprise-ui-v146.js?v=1461')}
function whaleLayer(){load('dr-whale-v147-loader','./deeprise-whale-radar-v147.js?v=1470')}
function whaleFlowLayer(){load('dr-whale-flow-v155-loader','./deeprise-whale-flow-v155.js?v=1550')}
function publicLiquidityLayer(){load('dr-public-liquidity-v148-loader','./deeprise-public-liquidity-v148.js?v=1480')}
function tradeMonitorLayer(){load('dr-trade-monitor-loader','./deeprise-trade-monitor-v14.js?v=1440')}
function tradeZonesLayer(){load('dr-trade-zones-v157-loader','./deeprise-trade-zones-v157.js?v=1570')}
function moveTimingLayer(){load('dr-move-timing-v158-loader','./deeprise-move-timing-v158.js?v=1580')}
function entryRankingLayer(){load('dr-entry-ranking-v158-loader','./deeprise-entry-ranking-v158.js?v=1580')}
function integrityLayer(){load('dr-integrity-v158-loader','./deeprise-integrity-v158.js?v=1580')}
function signalCardUiLayer(){load('dr-signal-card-ui-v153-loader','./deeprise-signal-card-ui-v153.js?v=1531')}
function whaleInlineLayer(){load('dr-whale-inline-v156-loader','./deeprise-whale-inline-v156.js?v=1560')}
function earlyBreakoutLayer(){load('dr-early-breakout-v159-loader','./deeprise-early-breakout-v159.js?v=1590')}
function idle(fn,delay=0){setTimeout(()=>{if('requestIdleCallback'in window)requestIdleCallback(fn,{timeout:1800});else setTimeout(fn,0)},delay)}
function progressiveLayers(){const queue=[nextCandleLayer,signalEngineLayer,uiLayer,earlyBreakoutLayer,forecastSafetyLayer,tradeMonitorLayer,tradeZonesLayer,moveTimingLayer,entryRankingLayer,integrityLayer,signalCardUiLayer,publicLiquidityLayer,whaleLayer,whaleFlowLayer,whaleInlineLayer];queue.forEach((fn,i)=>idle(fn,650+i*320))}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;button()});
brand();languagePerformancePatch();fastSearchLayer();
addEventListener('load',()=>{brand();languagePerformancePatch();idle(button,1200);progressiveLayers();idle(brand,1800)},{once:true});
})();