/* DeepRise V18.5: opt-in PWA Web Push client. Requires a configured HTTPS push backend. */
(()=>{'use strict';
const LANG=()=>{try{return localStorage.getItem('deeprise_language')||'en'}catch(_){return'en'}};
const T={
 en:{enable:'Enable phone push',disable:'Disable phone push',test:'Test this phone',status:'Background push status',unconfigured:'Push sending server not configured. On-device test is available; alerts when closed are NOT enabled.',unsupported:'This browser does not support Web Push.',install:'iPhone: open in Safari → Share → Add to Home Screen, then open the installed app.',blocked:'Notifications are blocked in iPhone settings.',ready:'Phone registered for background push. Server delivery still depends on the push sender.',off:'Phone is not subscribed.',testOk:'Local test sent. This does not test delivery while the app is closed.',failed:'Could not enable push:',disabled:'Phone unsubscribed.',waiting:'Working…'},
 ar:{enable:'تفعيل تنبيهات الهاتف',disable:'إيقاف تنبيهات الهاتف',test:'اختبار تنبيه الهاتف',status:'حالة التنبيهات بالخلفية',unconfigured:'خادم إرسال Push غير مُعدّ. الاختبار المحلي متاح، لكن التنبيهات أثناء إغلاق التطبيق غير مفعّلة.',unsupported:'هذا المتصفح لا يدعم Web Push.',install:'على الآيفون: Safari ← مشاركة ← إضافة إلى الشاشة الرئيسية، ثم افتح التطبيق المثبت.',blocked:'الإشعارات محظورة من إعدادات الآيفون.',ready:'تم تسجيل الهاتف لاستقبال Push. وصول التنبيهات يعتمد أيضًا على خدمة الإرسال.',off:'الهاتف غير مشترك بالإشعارات.',testOk:'تم إرسال اختبار محلي. هذا لا يثبت وصول التنبيهات والتطبيق مغلق.',failed:'تعذّر تفعيل Push:',disabled:'تم إلغاء الاشتراك.',waiting:'جارٍ التنفيذ…'},
 ru:{enable:'Включить Push',disable:'Отключить Push',test:'Тест на телефоне',status:'Фоновые уведомления',unconfigured:'Сервер Push не настроен. Локальный тест доступен; уведомления при закрытом приложении НЕ включены.',unsupported:'Web Push не поддерживается.',install:'iPhone: Safari → Поделиться → На экран «Домой», затем откройте установленное приложение.',blocked:'Уведомления запрещены в настройках iPhone.',ready:'Устройство подписано на Push; доставка зависит от сервера.',off:'Устройство не подписано.',testOk:'Локальный тест отправлен. Это не проверяет получение при закрытом приложении.',failed:'Не удалось включить Push:',disabled:'Подписка отключена.',waiting:'Выполняется…'}};
const t=k=>(T[LANG()]||T.en)[k]||k;
let config=null,busy=false,renderQueued=false;
const isiOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(/macintosh/i.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
const installed=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const supported=()=>isSecureContext&&'serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window;
const validHttps=url=>{try{return new URL(url).protocol==='https:'}catch(_){return false}};
const configured=()=>!!(config&&/^[A-Za-z0-9_-]{80,}$/.test(config.vapidPublicKey||'')&&validHttps(config.subscribeEndpoint));
function keyToBytes(str){const p=String(str).replace(/-/g,'+').replace(/_/g,'/'),raw=atob(p.padEnd(Math.ceil(p.length/4)*4,'='));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function readConfig(){try{const r=await fetch('./deeprise-push-config.json',{cache:'no-store'});config=r.ok?await r.json():null}catch(_){config=null}}
async function subscription(){try{const reg=await navigator.serviceWorker.ready;return await reg.pushManager.getSubscription()}catch(_){return null}}
function mount(){
 const root=document.getElementById('dr-notification-root');if(!root)return;
 const panel=root.querySelector('.dr-notif-panel');if(!panel||panel.querySelector('#drPushPanel'))return;
 const bar=document.createElement('section');bar.id='drPushPanel';bar.dir=LANG()==='ar'?'rtl':'ltr';
 bar.innerHTML='<div id="drPushStatus" role="status" aria-live="polite"></div><div class="dr-push-buttons"><button type="button" id="drPushToggle"></button><button type="button" id="drPushTest"></button></div>';
 panel.querySelector('.dr-notif-head')?.after(bar);
 bar.querySelector('#drPushToggle').addEventListener('click',togglePush);
 bar.querySelector('#drPushTest').addEventListener('click',testLocal);
 scheduleRender();
}
function scheduleRender(){if(renderQueued)return;renderQueued=true;setTimeout(()=>{renderQueued=false;render()},100)}
async function render(){
 mount();
 const root=document.getElementById('drPushPanel');if(!root)return;
 const btn=root.querySelector('#drPushToggle'),test=root.querySelector('#drPushTest'),status=root.querySelector('#drPushStatus');
 const sub=supported()?await subscription():null;
 btn.disabled=busy||!supported()||!configured()||(isiOS()&&!installed());
 test.disabled=busy||!supported()||(isiOS()&&!installed());
 btn.textContent=sub?t('disable'):t('enable');test.textContent=t('test');
 const state=!supported()?t('unsupported'):isiOS()&&!installed()?t('install'):Notification.permission==='denied'?t('blocked'):!configured()?t('unconfigured'):sub?t('ready'):t('off');
 status.textContent=t('status')+': '+state;
 btn.dataset.active=sub?'true':'false';
}
async function togglePush(){
 if(busy||!supported()||!configured()||(isiOS()&&!installed()))return;
 busy=true;const el=document.getElementById('drPushStatus');if(el)el.textContent=t('waiting');
 try{
  const reg=await navigator.serviceWorker.ready,existing=await reg.pushManager.getSubscription();
  if(existing){
   if(validHttps(config.unsubscribeEndpoint)){const resp=await fetch(config.unsubscribeEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:existing.toJSON()})});if(!resp.ok)throw Error('unsubscribe server HTTP '+resp.status)}
   await existing.unsubscribe();if(el)el.textContent=t('disabled');
  }else{
   const p=Notification.permission==='granted'?'granted':await Notification.requestPermission();
   if(p!=='granted'){if(el)el.textContent=t('blocked');return}
   const created=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyToBytes(config.vapidPublicKey)});
   try{
    const resp=await fetch(config.subscribeEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:created.toJSON(),app:'deeprise',channel:'trade-alerts',source:'pwa',createdAt:new Date().toISOString()})});
    if(!resp.ok)throw Error('subscribe server HTTP '+resp.status);
   }catch(e){await created.unsubscribe();throw e}
   if(el)el.textContent=t('ready');
  }
 }catch(e){if(el)el.textContent=t('failed')+' '+String(e?.message||e)}finally{busy=false;await render()}
}
async function testLocal(){
 if(busy||!supported()||(isiOS()&&!installed()))return;
 busy=true;const el=document.getElementById('drPushStatus');
 try{
  const p=Notification.permission==='granted'?'granted':await Notification.requestPermission();
  if(p!=='granted')throw Error(t('blocked'));
  const reg=await navigator.serviceWorker.ready;
  await reg.showNotification('DeepRise Scanner · TEST',{body:'This is a local device test, not a server Push alert.',icon:'./icon.svg',tag:'deeprise-test',data:{url:new URL('./index.html',location.href).href}});
  if(el)el.textContent=t('testOk');
 }catch(e){if(el)el.textContent=t('failed')+' '+String(e?.message||e)}finally{busy=false;await render()}
}
function boot(){
 const css=document.createElement('style');css.textContent='#drPushPanel{padding:10px 12px;background:#0d2634;border-bottom:1px solid #244b65;font-size:11px;color:#b3d5e2;line-height:1.5}#drPushStatus{margin-bottom:8px}#drPushPanel .dr-push-buttons{display:flex;gap:6px}#drPushPanel button{flex:1;min-width:0;border:1px solid #398c85;border-radius:8px;background:#124138;color:#d6ffef;padding:9px 6px;font-size:11px;min-height:40px}#drPushPanel button:disabled{opacity:.48;cursor:not-allowed}';document.head.appendChild(css);
 const observer=new MutationObserver(()=>{if(document.getElementById('dr-notification-root')&&!document.getElementById('drPushPanel'))mount()});
 observer.observe(document.body,{subtree:true,childList:true});
 readConfig().then(()=>{mount();render()});window.addEventListener('deeprise:language-changed',render);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.DeepRisePush={getStatus:async()=>({supported:supported(),installed:installed(),serverConfigured:configured(),subscribed:!!(await subscription())}),showSettings:()=>{document.querySelector('.dr-notif-bell')?.click()}};
})();