(()=>{'use strict';
const L=()=>localStorage.getItem('deeprise_language')||'en';
const copy={en:{install:'Install DeepRise',ios:'Install on iPhone',how:'Tap Share, then Add to Home Screen',ready:'DeepRise is ready to install'},ar:{install:'تثبيت DeepRise',ios:'تثبيت على الآيفون',how:'اضغط مشاركة ثم إضافة إلى الشاشة الرئيسية',ready:'DeepRise جاهز للتثبيت'},ru:{install:'Установить DeepRise',ios:'Установить на iPhone',how:'Нажмите Поделиться, затем На экран Домой',ready:'DeepRise готов к установке'}};
const t=k=>(copy[L()]||copy.en)[k];let deferred=null,langObservers=[],langTimer=null;
const MOBILE=/iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent||'');
function brand(){if(window.DeepRiseBinanceUniverse)return;document.title='DeepRise PRO';const h=document.querySelector('.brand h1');if(h)h.textContent='⚡ DeepRise PRO'}
function translateRoot(root){if(!root)return;try{const nodes=[root,...root.querySelectorAll('*:not(script):not(style):not(option)')];for(const el of nodes)for(const n of el.childNodes)if(n.nodeType===3&&typeof translateTextNode==='function')translateTextNode(n)}catch(e){}}
function refreshDynamic(){clearTimeout(langTimer);langTimer=setTimeout(()=>{['results','top3','signalResultsPanel','deepriseFastSearchResult'].forEach(id=>translateRoot(document.getElementById(id)))},MOBILE?420:240)}
function languagePerformancePatch(){try{if(typeof languageObserver!=='undefined')languageObserver.disconnect()}catch(e){}langObservers.forEach(o=>{try{o.disconnect()}catch(e){}});langObservers=[];const opt={childList:true,subtree:true};['results','top3','signalResultsPanel','deepriseFastSearchResult'].forEach(id=>{const el=document.getElementById(id);if(!el)return;try{const o=new MutationObserver(refreshDynamic);o.observe(el,opt);langObservers.push(o)}catch(e){}});window.DeepRiseLanguageRefresh=refreshDynamic}
async function registerWorker(){if(!('serviceWorker'in navigator))return;try{const reg=await navigator.serviceWorker.register('./sw.js?v=network-v16-0-2',{updateViaCache:'none'});await reg.update();const marker='deeprise_sw_cleanup_1602';if(!sessionStorage.getItem(marker)&&'caches'in window){sessionStorage.setItem(marker,'1');const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('deeprise-pwa-')&&k!=='deeprise-pwa-network-v16-0-2').map(k=>caches.delete(k)))} }catch(_e){}}
addEventListener('load',registerWorker,{once:true});
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function button(){if(standalone||document.getElementById('deepriseInstall'))return;let b=document.createElement('button');b.id='deepriseInstall';b.textContent='⬇ '+t('install');b.style.cssText='position:fixed;right:14px;bottom:14px;z-index:99998;border:1px solid #35e0a1;background:#071b26;color:#35e0a1;border-radius:14px;padding:12px 16px;font-weight:800;box-shadow:0 10px 30px #0008';b.onclick=async()=>{if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;b.remove();return}const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);alert(ios?t('how'):t('ready'))};document.body.appendChild(b)}
function load(id,src){if(document.getElementById(id)||document.querySelector(`script[src*="${src.split('?')[0].replace('./','')}"]`))return;let s=document.createElement('script');s.id=id;s.src=src;s.defer=true;s.async=true;document.body.appendChild(s)}
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
function idle(fn,delay=0){setTimeout(()=>{if(document.hidden)return;if('requestIdleCallback'in window)requestIdleCallback(fn,{timeout:MOBILE?3000:1800});else setTimeout(fn,0)},delay)}
function progressiveLayers(){const primary=[nextCandleLayer,signalEngineLayer,uiLayer,earlyBreakoutLayer,forecastSafetyLayer,tradeMonitorLayer];const secondary=[tradeZonesLayer,moveTimingLayer,entryRankingLayer,integrityLayer,signalCardUiLayer,publicLiquidityLayer,whaleLayer,whaleFlowLayer,whaleInlineLayer];if(MOBILE){primary.forEach((fn,i)=>idle(fn,2600+i*1200));secondary.forEach((fn,i)=>idle(fn,14000+i*1700))}else{[...primary,...secondary].forEach((fn,i)=>idle(fn,900+i*420))}}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;button()});
brand();languagePerformancePatch();fastSearchLayer();
window.DeepRiseLoadOptionalLayers=progressiveLayers;addEventListener('load',()=>{brand();languagePerformancePatch();idle(button,1800)},{once:true});
})();