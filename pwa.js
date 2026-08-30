(()=>{'use strict';
const L=()=>localStorage.getItem('deeprise_language')||'en';
const copy={en:{install:'Install DeepRise',ios:'Install on iPhone',how:'Tap Share, then Add to Home Screen',ready:'DeepRise V13.3 is ready to install'},ar:{install:'تثبيت DeepRise',ios:'تثبيت على الآيفون',how:'اضغط مشاركة ثم إضافة إلى الشاشة الرئيسية',ready:'DeepRise V13.3 جاهز للتثبيت'},ru:{install:'Установить DeepRise',ios:'Установить на iPhone',how:'Нажмите Поделиться, затем На экран Домой',ready:'DeepRise V13.3 готов к установке'}};
const t=k=>(copy[L()]||copy.en)[k];let deferred=null;
function brand(){
  document.title='DeepRise V13.3 PRO';
  const h=document.querySelector('.brand h1'); if(h)h.textContent='⚡ DeepRise V13.3 PRO';
  const bars=[...document.querySelectorAll('.marketbar span')];
  const engine=bars.find(x=>/Engine:/i.test(x.textContent||'')); if(engine)engine.innerHTML='Engine: <b>V13.3 PRO</b>';
  const footer=document.querySelector('.footer'); if(footer)footer.textContent='DeepRise V13.3 PRO analyses public market data. Signals are probabilistic, not guarantees or financial advice.';
}
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=stable-v14-1',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{}));
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function button(){if(standalone||document.getElementById('deepriseInstall'))return;let b=document.createElement('button');b.id='deepriseInstall';b.textContent='⬇ '+t('install');b.style.cssText='position:fixed;right:14px;bottom:14px;z-index:99998;border:1px solid #35e0a1;background:#071b26;color:#35e0a1;border-radius:14px;padding:12px 16px;font-weight:800;box-shadow:0 10px 30px #0008';b.onclick=async()=>{if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;b.remove();return}const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);alert(ios?t('how'):t('ready'))};document.body.appendChild(b)}
function nextCandleLayer(){if(document.getElementById('dr-next-candle-loader'))return;let s=document.createElement('script');s.id='dr-next-candle-loader';s.src='./deeprise-next-candle-v14.js?v=1410';s.defer=true;document.body.appendChild(s)}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;button()});addEventListener('load',()=>{brand();setTimeout(button,1800);setTimeout(nextCandleLayer,100)});setTimeout(brand,250);setTimeout(nextCandleLayer,700);
})();