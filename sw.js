const CACHE='deeprise-pwa-recovery-v16-0-1';
const CORE=[
  './index.html',
  './',
  './manifest.json',
  './icon.svg',
  './mobile-app-v11.css?v=1310',
  './deeprise-fast-search-v160.js?v=1601',
  './deeprise-v13-gate-hotfix.js?v=1310',
  './mobile-app-v11.js?v=1310',
  './pwa.js?v=1310'
];
const NAV_FALLBACK='./index.html';

async function cacheUrl(cache,url){
  const r=await fetch(new Request(url,{cache:'reload'}));
  if(!r||!r.ok)throw new Error('core '+url+' '+(r?r.status:'no-response'));
  await cache.put(url,r.clone());
  return true;
}

self.addEventListener('install',e=>e.waitUntil((async()=>{
  const c=await caches.open(CACHE);
  let shellReady=false;
  for(const url of ['./index.html','./']){
    try{await cacheUrl(c,url);shellReady=true}catch(_e){}
  }
  if(!shellReady)throw new Error('DeepRise shell could not be cached; keeping previous worker active');
  await Promise.allSettled(CORE.slice(2).map(url=>cacheUrl(c,url)));
  await self.skipWaiting();
})()));

self.addEventListener('activate',e=>e.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('deeprise-pwa-')&&k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));

async function navigationFallback(cache){
  return (await cache.match(NAV_FALLBACK))||(await cache.match('./'))||(await caches.match(NAV_FALLBACK))||(await caches.match('./'))||null;
}

function offlinePage(){
  return new Response('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeepRise</title><style>body{margin:0;background:#050d18;color:#edf6ff;font-family:Arial,sans-serif;display:grid;place-items:center;min-height:100vh}.box{max-width:520px;margin:24px;padding:24px;border:1px solid #18344c;border-radius:16px;background:#0a1827;text-align:center}button{padding:12px 18px;border:0;border-radius:10px;background:#35e0a1;color:#04110d;font-weight:700}</style></head><body><div class="box"><h2>DeepRise</h2><p>Connection is temporarily unavailable. The app shell is protected and can retry safely.</p><button onclick="location.reload()">Retry</button></div></body></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}

async function networkFirst(req,timeout=4500){
  const c=await caches.open(CACHE);
  const isNav=req.mode==='navigate';
  let cached=(await c.match(req))||(await caches.match(req));
  if(!cached&&isNav)cached=await navigationFallback(c);

  const net=fetch(new Request(req,{cache:'no-store'})).then(async r=>{
    if(r&&r.ok){
      try{await c.put(req,r.clone());if(isNav)await c.put(NAV_FALLBACK,r.clone())}catch(_e){}
    }
    return r;
  });

  if(!cached){
    try{return await net}catch(_e){return isNav?offlinePage():Response.error()}
  }

  try{
    return await Promise.race([net,new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),timeout))]);
  }catch(_e){
    net.catch(()=>{});
    return cached;
  }
}

async function staleWhileRevalidate(req){
  const c=await caches.open(CACHE);
  const hit=(await c.match(req))||(await caches.match(req));
  const refresh=fetch(new Request(req,{cache:'no-store'})).then(async r=>{
    if(r&&r.ok){try{await c.put(req,r.clone())}catch(_e){}}
    return r;
  }).catch(()=>null);
  if(hit){refresh.catch(()=>{});return hit}
  return (await refresh)||Response.error();
}

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;
  if(e.request.mode==='navigate'||u.pathname.endsWith('.html')){
    e.respondWith(networkFirst(e.request,5000));
    return;
  }
  if(u.pathname.endsWith('.json')){
    e.respondWith(networkFirst(e.request,3500));
    return;
  }
  if(/\.(?:js|css|svg|png|jpg|jpeg|webp|ico|woff2?)$/i.test(u.pathname)){
    e.respondWith(staleWhileRevalidate(e.request));
    return;
  }
  e.respondWith(networkFirst(e.request,3500));
});