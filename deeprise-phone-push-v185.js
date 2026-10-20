/* DeepRise Phone Push v18.5
   Uses standard Web Push. A server with VAPID keys and subscription storage
   must be configured before remote notifications work when the PWA is closed. */
(()=>{'use strict';
 const CONFIG=window.DeepRisePushConfig||{};
 const lang=()=>{try{return localStorage.getItem('deeprise_language')||'en'}catch(_){return'en'}};
 const tr={
  en:{title:'Phone alerts (app closed)',unavailable:'Web Push sender not connected yet. In-app alerts cannot wake a closed app.',needsHome:'On iPhone: Safari → Share → Add to Home Screen, then open the installed app.',unsupported:'Web Push is unsupported in this browser or is disabled.',idle:'Tap Enable to allow phone notifications.',active:'Phone push subscribed. Delivery depends on the configured sender.',denied:'Notifications were blocked. Enable DeepRise alerts in iPhone Settings.',error:'Could not connect to notification service: ',enable:'Enable phone alerts',disable:'Disable phone alerts',busy:'Connecting…',pairing:'One-time pairing code (12 characters)',codeRequired:'Get a one-time pairing code from the Cloudflare admin before enabling.',remoteTest:'Test from Cloudflare',remoteOk:'Push service accepted the remote test. Close the app and repeat to verify background receipt.',test:'Test this phone',testOk:'Local notification displayed. This does not test alerts while the app is closed.'},
  ar:{title:'تنبيهات الهاتف والتطبيق مغلق',unavailable:'خدمة إرسال Web Push غير متصلة بعد. تنبيهات التطبيق الداخلية لا توقظ التطبيق المغلق.',needsHome:'على الآيفون: Safari ← مشاركة ← إضافة إلى الشاشة الرئيسية، ثم افتح الأيقونة.',unsupported:'إشعارات Web Push غير مدعومة في هذا المتصفح أو معطلة.',idle:'اضغط تفعيل للسماح بتنبيهات الهاتف.',active:'اشتراك إشعارات الهاتف مفعل. وصولها يعتمد على خدمة الإرسال.',denied:'الإشعارات محظورة. اسمح بها من إعدادات الآيفون ← الإشعارات.',error:'تعذر الاتصال بخدمة الإشعارات: ',enable:'تفعيل إشعارات الهاتف',disable:'إيقاف إشعارات الهاتف',busy:'جارٍ الاتصال…',pairing:'رمز ربط الهاتف لمرة واحدة (12 خانة)',codeRequired:'احصل على رمز ربط مؤقت من إدارة Cloudflare قبل التفعيل.',remoteTest:'اختبار من Cloudflare',remoteOk:'قبلت خدمة Push الاختبار. أغلق التطبيق واختبر مجددًا للتحقق من الاستقبال بالخلفية.',test:'اختبار إشعار الهاتف',testOk:'تم عرض إشعار اختباري محلي. هذا لا يثبت وصول التنبيهات أثناء إغلاق التطبيق.'},
  ru:{title:'Уведомления на телефон при закрытом приложении',unavailable:'Сервис отправки Web Push ещё не подключён. Встроенные оповещения не разбудят закрытое приложение.',needsHome:'iPhone: Safari → Поделиться → На экран Домой, затем откройте приложение.',unsupported:'Web Push не поддерживается или отключен.',idle:'Нажмите Включить, чтобы получать оповещения.',active:'Подписка активна. Доставка зависит от сервера отправки.',denied:'Уведомления запрещены. Разрешите их в настройках iPhone.',error:'Ошибка службы уведомлений: ',enable:'Включить уведомления',disable:'Отключить уведомления',busy:'Подключение…',pairing:'Одноразовый код привязки (12 символов)',codeRequired:'Сначала получите временный код привязки у администратора Cloudflare.',remoteTest:'Тест с Cloudflare',remoteOk:'Push-сервис принял тест. Закройте приложение и проверьте получение.',test:'Тест на устройстве',testOk:'Локальное уведомление отправлено. Это не проверка доставки в закрытом приложении.'}
 };
 const t=k=>(tr[lang()]||tr.en)[k]||tr.en[k]||k;
 const iphone=/iPhone|iPad|iPod/i.test(navigator.userAgent||'');
 const installed=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const configured=!!(CONFIG.publicVapidKey&&/^https:\/\//.test(CONFIG.subscribeUrl||'')&&/^https:\/\//.test(CONFIG.unsubscribeUrl||''));
 const supported='serviceWorker'in navigator&&'PushManager'in window&&'Notification'in window&&window.isSecureContext;
 const DEVICE_KEY='deeprise_push_device_token_v1';
 const apiTestUrl=CONFIG.subscribeUrl?.replace(/\/v1\/subscribe\/?$/,'/v1/test');
 let busy=false,message='';
 function keyBytes(b64){const a=atob(b64.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-b64.length%4)%4));return Uint8Array.from(a,c=>c.charCodeAt(0))}
 async function current(){try{return await (await navigator.serviceWorker.ready).pushManager.getSubscription()}catch(_){return null}}
 async function status(){
  if(!supported)return t('unsupported');
  if(iphone&&!installed)return t('needsHome');
  if(!configured)return t('unavailable');
  if(Notification.permission==='denied')return t('denied');
  return (await current())?t('active'):t('idle');
 }
 async function refresh(){const root=document.getElementById('dr-phone-push'),info=root?.querySelector('[data-push-status]'),btn=root?.querySelector('[data-push-button]');if(!root)return;
  const sub=await current();if(info)info.textContent=message||await status();
  const pair=root.querySelector('[data-pair-code]');if(pair){pair.placeholder=t('pairing');pair.hidden=!!sub||!configured}
  const remote=root.querySelector('[data-push-remote]');if(remote){remote.textContent=t('remoteTest');remote.disabled=busy||!configured||!sub||!localStorage.getItem(DEVICE_KEY)}
  if(btn){btn.disabled=busy||!supported||!configured||(iphone&&!installed)||Notification.permission==='denied';btn.textContent=busy?t('busy'):sub?t('disable'):t('enable');}
  root.querySelector('b').textContent=t('title');const test=root.querySelectorAll('button')[1];if(test){test.textContent=t('test');test.disabled=busy||!supported||(iphone&&!installed)}
 }
 async function enable(){
  if(!configured||!supported||(iphone&&!installed))return;
  // Called synchronously from a user click: iOS requires user gesture.
  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw Error(t('denied'));
  const input=document.querySelector('#dr-phone-push [data-pair-code]'),pairingCode=(input?.value||'').trim();
  if(!/^[A-Za-z0-9_-]{12}$/.test(pairingCode))throw Error(t('codeRequired'));
  const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(CONFIG.publicVapidKey)});
  const deviceToken=crypto.randomUUID();
  let response;
  try{response=await fetch(CONFIG.subscribeUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON(),pairingCode,deviceToken})})}
  catch(e){await sub.unsubscribe();throw e}
  if(!response.ok){await sub.unsubscribe();throw Error('HTTP '+response.status)}
  localStorage.setItem(DEVICE_KEY,deviceToken);if(input)input.value='';
 }
 async function disable(){
  const sub=await current();if(!sub)return;
  // Inform server before removing local browser subscription.
  const deviceToken=localStorage.getItem(DEVICE_KEY);if(!deviceToken)throw Error(t('codeRequired'));
  const response=await fetch(CONFIG.unsubscribeUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,deviceToken})});
  if(!response.ok)throw Error('HTTP '+response.status);
  await sub.unsubscribe();localStorage.removeItem(DEVICE_KEY);
 }
 async function click(){if(busy)return;busy=true;message='';await refresh();try{const sub=await current();if(sub)await disable();else await enable()}catch(err){message=t('error')+String(err?.message||err)}finally{busy=false;await refresh()}}
 async function testPhone(){
  if(busy||!supported||(iphone&&!installed))return;
  busy=true;message='';await refresh();
  try{
   const permission=await Notification.requestPermission();
   if(permission!=='granted')throw Error(t('denied'));
   const reg=await navigator.serviceWorker.ready;
   await reg.showNotification('DeepRise Scanner TEST',{
    body:lang()==='ar'?'اختبار صوت وتنبيه الهاتف (ليس اختبارًا لتنبيه السوق في الخلفية)':'Device notification test (not a background market push test)',
    tag:'deeprise-device-test',icon:'./icon.svg',
    data:{url:new URL('./index.html',location.href).href}
   });
   message=t('testOk');
  }catch(err){message=t('error')+String(err?.message||err)}
  finally{busy=false;await refresh()}
 }
 async function testRemote(){
  if(busy||!configured||!supported)return;
  const sub=await current(),deviceToken=localStorage.getItem(DEVICE_KEY);
  if(!sub||!deviceToken)return;
  busy=true;message='';await refresh();
  try{
   const response=await fetch(apiTestUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:sub.endpoint,deviceToken})});
   if(!response.ok)throw Error('HTTP '+response.status);
   message=t('remoteOk');
  }catch(err){message=t('error')+String(err?.message||err)}
  finally{busy=false;await refresh()}
 }
 function mount(){
  const header=document.querySelector('#dr-notification-root .dr-notif-head');if(!header||document.getElementById('dr-phone-push'))return;
  const el=document.createElement('section');el.id='dr-phone-push';el.style.cssText='padding:10px 12px;display:grid;gap:7px;background:#0b2231;border-bottom:1px solid #23445c';
  const title=document.createElement('b'),info=document.createElement('small'),btn=document.createElement('button'),test=document.createElement('button'),pair=document.createElement('input'),remote=document.createElement('button');
  info.setAttribute('data-push-status','');info.setAttribute('role','status');info.style.cssText='color:#a0c1d4;line-height:1.6;font-size:11px';
  btn.setAttribute('data-push-button','');btn.type='button';btn.style.cssText='padding:9px;background:#134c40;color:#caffeb;border:1px solid #38ac8c;border-radius:9px;min-height:40px;cursor:pointer';
  pair.setAttribute('data-pair-code','');pair.maxLength=12;pair.autocomplete='off';pair.style.cssText='padding:10px;border:1px solid #4c7293;border-radius:8px;background:#081926;color:#e4f6ff';
  btn.addEventListener('click',click);test.textContent=t('test');test.type='button';test.style.cssText='padding:9px;background:#142c47;color:#caffff;border:1px solid #4c7293;border-radius:9px;min-height:40px;cursor:pointer';test.addEventListener('click',testPhone);
  remote.setAttribute('data-push-remote','');remote.type='button';remote.style.cssText=test.style.cssText;remote.addEventListener('click',testRemote);
  el.append(title,info,pair,btn,test,remote);
  header.after(el);refresh();
 }
 function init(){mount();if(!document.getElementById('dr-phone-push')){const obs=new MutationObserver(()=>{if(document.getElementById('dr-phone-push')){obs.disconnect();return}mount()});obs.observe(document.body,{childList:true,subtree:true});setTimeout(()=>obs.disconnect(),15000)}}
 window.DeepRisePhonePush={version:'18.5',refresh,status,isConfigured:()=>configured};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
