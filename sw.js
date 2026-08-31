const CACHE='deeprise-pwa-network-v16-0-2';
const STATIC_CORE=[
  './manifest.json',
  './icon.svg',
  './mobile-app-v11.css?v=1310',
  './deeprise-fast-search-v160.js?v=1601',
  './deeprise-v13-gate-hotfix.js?v=1310',
  './mobile-app-v11.js?v=1310',
  './pwa.js?v=1310'
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
