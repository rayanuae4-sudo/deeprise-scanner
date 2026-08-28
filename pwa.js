(()=>{'use strict';
const L=()=>localStorage.getItem('deeprise_language')||'en';
const copy={en:{install:'Install DeepRise',ios:'Install on iPhone',how:'Tap Share, then Add to Home Screen',ready:'DeepRise V13 is ready to install'},ar:{install:'تثبيت DeepRise',ios:'تثبيت على الآيفون',how:'اضغط مشاركة ثم إضافة إلى الشاشة الرئيسية',ready:'DeepRise V13 جاهز للتثبيت'},ru:{install:'Установить DeepRise',ios:'Установить на iPhone',how:'Нажмите Поделиться, затем На экран Домой',ready:'DeepRise V13 готов к установке'}};
const t=k=>(copy[L()]||copy.en)[k];let deferred=null;
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=stable-v13-2',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{}));
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
function button(){if(standalone||document.getElementById('deepriseInstall'))return;let b=document.createElement('button');b.id='deepriseInstall';b.textContent='⬇ '+t('install');b.style.cssText='position:fixed;right:14px;bottom:14px;z-index:99998;border:1px solid #35e0a1;background:#071b26;color:#35e0a1;border-radius:14px;padding:12px 16px;font-weight:800;box-shadow:0 10px 30px #0008';b.onclick=async()=>{if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;b.remove();return}const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);alert(ios?t('how'):t('ready'))};document.body.appendChild(b)}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;button()});addEventListener('load',()=>setTimeout(button,1800));
})();
