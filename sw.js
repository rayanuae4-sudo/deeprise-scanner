const CACHE='deeprise-pwa-network-v18-8-2';
const STATIC_CORE=[
  './chart.html',
  './manifest.json',
  './icon.svg',
  './mobile-app-v11.css?v=1310',
  './deeprise-analytics-config.js?v=1700',
  './deeprise-workspace-v173.js?v=1850',
  './deeprise-market-structure-v174.js?v=1850',
  './deeprise-structure-chart-v174.js?v=1882',
  './deeprise-structure-explain-v182.js?v=1820',
  './deeprise-structure-reasons-v182.js?v=1820',
  './deeprise-pre-move-v170.js?v=1730',
  './deeprise-profit-quality-v185.js?v=1850',
  './deeprise-phone-push-v185.js?v=1850',
  './deeprise-signal-stability-v171.js?v=1710',
  './deeprise-fast-search-v160.js?v=1601',
  './deeprise-v13-gate-hotfix.js?v=1730',
  './mobile-app-v11.js?v=1800',
  './pwa.js?v=1882'
];

function offlinePage(){
  return new Response('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeepRise</title><style>body{margin:0;background:#050d18;color:#edf6ff;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh}.box{max-width:520px;margin:24px;padding:24px;border:1px solid #18344c;border-radius:16px;background:#0a1827;text-align:center}a{display:inline-block;padding:12px 18px;border-radius:10px;background:#35e0a1;color:#04110d;font-weight:700;text-decoration:none}</style></head><body><div class="box"><h2>DeepRise</h2><p>Connection is unavailable. Reconnect and reopen the scanner.</p><a href="./recover.html">Repair app cache</a></div></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled(STATIC_CORE.map(async url=>{
      const response=await fetch(new Request(url,{cache:'reload'}));
      if(response&&response.ok)await cache.put(url,response.clone());
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('deeprise-pwa-')&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkOnlyNavigation(request){
  try{
    const response=await fetch(new Request(request,{cache:'no-store'}));
    if(response)return response;
  }catch(_e){}
  return offlinePage();
}

async function networkFirst(request,timeout=5000){
  const cache=await caches.open(CACHE);
  const cached=(await cache.match(request))||(await caches.match(request));
  const network=fetch(new Request(request,{cache:'no-store'})).then(async response=>{
    if(response&&response.ok){try{await cache.put(request,response.clone())}catch(_e){}}
    return response;
  });
  if(!cached){try{return await network}catch(_e){return Response.error()}}
  try{
    return await Promise.race([network,new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),timeout))]);
  }catch(_e){
    network.catch(()=>{});
    return cached;
  }
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;

  if(event.request.mode==='navigate'||url.pathname.endsWith('.html')){
    event.respondWith(networkOnlyNavigation(event.request));
    return;
  }

  if(url.pathname.endsWith('.json')){
    event.respondWith(networkFirst(event.request,4500));
    return;
  }

  if(/\.(?:js|css|svg|png|jpg|jpeg|webp|ico|woff2?)$/i.test(url.pathname)){
    event.respondWith(networkFirst(event.request,5000));
  }
});


/* Background Web Push delivery for installed iOS / Android PWAs.
   Delivery requires a separate authenticated Web Push sender and registered subscription. */
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  let data={};try{data=event.data?.json()||{}}catch(_){data={body:event.data?.text()||''}}
  const title=String(data.title||'DeepRise Alert').slice(0,120);
  const body=String(data.body||'You have a new scanner alert.').slice(0,260);
  const candidate=String(data.url||'./index.html');
  let target='./index.html';
  try{const parsed=new URL(candidate,self.registration.scope);if(parsed.origin===self.location.origin&&parsed.href.startsWith(self.registration.scope))target=parsed.href}catch(_){}
  await self.registration.showNotification(title,{
   body,tag:String(data.tag||'deeprise-market-alert').slice(0,90),icon:'./icon.svg',
   badge:'./icon.svg',data:{url:target},renotify:false
  });
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const requested=String(event.notification.data?.url||'./index.html');
  const url=new URL(requested,self.registration.scope);
  if(url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){
   if(new URL(client.url).origin===url.origin&&'focus'in client){
    try{await client.navigate(url.href)}catch(_){}
    return client.focus();
   }
  }
  return self.clients.openWindow(url.href);
 })());
});
