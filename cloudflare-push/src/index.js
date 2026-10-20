/* DeepRise single-user encrypted Web Push sender for Cloudflare Workers + D1.
   No private key, administration bearer, pairing code or subscriptions live in GitHub Pages. */
import {buildPushPayload} from '@block65/webcrypto-web-push';
import {APP_ORIGIN,validSubscription,qualityForEntry,qualityForLiquidity,safeAlertLink} from './core.js';

const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const MAX_DEVICES=20;
const now=()=>Date.now();
const json=(data,status=200,origin='')=>new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...(origin===APP_ORIGIN?{'access-control-allow-origin':APP_ORIGIN,'vary':'Origin'}:{})}});
const invalid=(msg,status=400,origin='')=>json({ok:false,error:msg},status,origin);
const bytes=n=>crypto.getRandomValues(new Uint8Array(n));
const b64url=arr=>btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function digest(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('')}
async function auth(req,value) {
  if(typeof value!=='string'||value.length<32)return false;
  const raw=req.headers.get('Authorization')||'';
  if(!raw.startsWith('Bearer ')||raw.length>200)return false;
  const token=raw.slice(7);
  if(!token||token.length<32)return false;
  const [a,b]=await Promise.all([digest(token),digest(value)]);
  let mismatch=0;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^b.charCodeAt(i);
  return mismatch===0;
}
function settingsReady(env){return !!(env.DB&&typeof env.VAPID_PUBLIC_KEY==='string'&&env.VAPID_PUBLIC_KEY.length>80&&
 typeof env.VAPID_PRIVATE_KEY==='string'&&env.VAPID_PRIVATE_KEY.length>35&&
 typeof env.VAPID_SUBJECT==='string'&&/^(mailto:|https:\/\/)/.test(env.VAPID_SUBJECT))}
function cors(origin){return {'access-control-allow-origin':origin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'Content-Type, Authorization','access-control-max-age':'3600','vary':'Origin'}}
async function body(req) {
  const n=Number(req.headers.get('content-length')||0);
  if(n>12000)throw Error('PAYLOAD_TOO_LARGE');
  const raw=await req.text();if(raw.length>12000)throw Error('PAYLOAD_TOO_LARGE');
  return JSON.parse(raw);
}
function deviceTokenOk(v){return typeof v==='string'&&/^[0-9a-f-]{36}$/i.test(v)}
function codeOk(v){return typeof v==='string'&&/^[A-Za-z0-9_-]{12}$/.test(v)}
async function pairing(req,env,origin) {
 if(!await auth(req,env.ADMIN_TOKEN))return invalid('UNAUTHORIZED',401,origin);
 const code=b64url(bytes(9)),hash=await digest(code),expires=now()+15*60000;
 await env.DB.prepare('INSERT INTO pairing_codes(code_hash,expires_at,used_at) VALUES(?,?,NULL)').bind(hash,expires).run();
 await env.DB.prepare('DELETE FROM pairing_codes WHERE expires_at < ? OR used_at < ?').bind(now()-86400000,now()-86400000).run();
 return json({ok:true,pairingCode:code,expiresAt:new Date(expires).toISOString(),note:'One use, valid for 15 minutes'},201,origin);
}
async function subscribe(req,env,origin) {
 let data;try{data=await body(req)}catch(_){return invalid('BAD_JSON',400,origin)}
 const sub=data.subscription,token=data.deviceToken,code=data.pairingCode;
 if(!validSubscription(sub)||!deviceTokenOk(token)||!codeOk(code))return invalid('INVALID_ENROLLMENT',400,origin);
 const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM subscriptions').first();
 if(Number(count?.n||0)>=MAX_DEVICES)return invalid('DEVICE_LIMIT',409,origin);
 const at=now(),hash=await digest(code),tokenHash=await digest(token);
 const consume=await env.DB.prepare('UPDATE pairing_codes SET used_at=? WHERE code_hash=? AND used_at IS NULL AND expires_at>?')
  .bind(at,hash,at).run();
 if(!consume.meta?.changes)return invalid('PAIR_CODE_EXPIRED_OR_USED',403,origin);
 const saved=await env.DB.prepare(
  'INSERT INTO subscriptions(endpoint,p256dh,auth,token_hash,created_at,updated_at,last_test_at) VALUES(?,?,?,?,?,?,0) '+
  'ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh,auth=excluded.auth,updated_at=excluded.updated_at '+
  'WHERE subscriptions.token_hash=excluded.token_hash'
 ).bind(sub.endpoint,sub.keys.p256dh,sub.keys.auth,tokenHash,at,at).run();
 if(!saved.meta?.changes)return invalid('ALREADY_REGISTERED_ON_ANOTHER_DEVICE',409,origin);
 return json({ok:true,subscribed:true},201,origin);
}
async function unsubscribe(req,env,origin) {
 let data;try{data=await body(req)}catch(_){return invalid('BAD_JSON',400,origin)}
 if(!deviceTokenOk(data.deviceToken)||typeof data.endpoint!=='string')return invalid('INVALID_REQUEST',400,origin);
 const tokenHash=await digest(data.deviceToken);
 const outcome=await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint=? AND token_hash=?').bind(data.endpoint,tokenHash).run();
 if(!outcome.meta?.changes)return invalid('UNAUTHORIZED_DEVICE',403,origin);
 return json({ok:true},200,origin);
}
async function sendOne(env,row,msg) {
 const sub={endpoint:row.endpoint,expirationTime:null,keys:{p256dh:row.p256dh,auth:row.auth}};
 if(!validSubscription(sub))return {ok:false,status:400};
 try{
  const payload=await buildPushPayload({data:msg,options:{ttl:300,urgency:'high'}},sub,
   {subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY});
  const res=await fetch(sub.endpoint,payload);
  if(res.status===404||res.status===410){
   await env.DB.prepare('DELETE FROM subscriptions WHERE endpoint=?').bind(sub.endpoint).run();
  }
  return {ok:res.status>=200&&res.status<300,status:res.status};
 }catch(_){return {ok:false,status:0}}
}
async function testDevice(req,env,origin) {
 let data;try{data=await body(req)}catch(_){return invalid('BAD_JSON',400,origin)}
 if(!deviceTokenOk(data.deviceToken)||typeof data.endpoint!=='string')return invalid('INVALID_REQUEST',400,origin);
 const stamp=now(),tokenHash=await digest(data.deviceToken);
 const updated=await env.DB.prepare('UPDATE subscriptions SET last_test_at=? WHERE endpoint=? AND token_hash=? AND last_test_at<?')
  .bind(stamp,data.endpoint,tokenHash,stamp-60000).run();
 if(!updated.meta?.changes)return invalid('INVALID_DEVICE_OR_RATE_LIMIT',429,origin);
 const row=await env.DB.prepare('SELECT endpoint,p256dh,auth FROM subscriptions WHERE endpoint=?').bind(data.endpoint).first();
 if(!row)return invalid('DEVICE_NOT_FOUND',404,origin);
 const status=await sendOne(env,row,{title:'DeepRise · Remote push test',body:'This notification was sent by Cloudflare, not by the open web page.',url:'./index.html',tag:'deeprise-server-test-'+stamp});
 return status.ok?json({ok:true,deliveredToPushService:true},202,origin):invalid('PUSH_SERVICE_REJECTED',502,origin);
}
async function broadcast(env, id, message, kind='ENTRY') {
 const time=now(),record=await env.DB.prepare('INSERT OR IGNORE INTO sent_events(event_id,category,created_at) VALUES(?,?,?)').bind(id,kind,time).run();
 if(!record.meta?.changes)return {duplicate:true,attempted:0,accepted:0};
 const rows=await env.DB.prepare('SELECT endpoint,p256dh,auth FROM subscriptions ORDER BY created_at LIMIT ?').bind(MAX_DEVICES).all();
 const list=rows.results||[];
 const result=await Promise.all(list.map(r=>sendOne(env,r,message)));
 return {duplicate:false,attempted:list.length,accepted:result.filter(x=>x.ok).length,failed:result.filter(x=>!x.ok).length};
}
async function publish(req,env,origin) {
 if(!await auth(req,env.PRODUCER_TOKEN))return invalid('UNAUTHORIZED',401,origin);
 let data;try{data=await body(req)}catch(_){return invalid('BAD_JSON',400,origin)}
 const q=qualityForEntry(data);
 if(!q.ok)return invalid('REJECTED_'+q.code,422,origin);
 if(!/^[a-zA-Z0-9:_-]{8,100}$/.test(data.eventId||''))return invalid('EVENT_ID',400,origin);
 const m=q.metrics,side=data.side==='SHORT'?'SHORT':'LONG';
 const title='DeepRise · '+data.symbol+' '+side+' confirmed';
 const body='4H+1H confirmed · net TP2 '+m.netTP2.toFixed(2)+'% · net R:R '+m.netRR.toFixed(2)+' · Check entry and stop on chart.';
 const sent=await broadcast(env,'entry:'+data.eventId,{title,body,url:safeAlertLink(data.symbol,data.timeframe),tag:'entry-'+data.eventId},'ENTRY');
 return json({ok:true,metrics:m,...sent},202,origin);
}
async function scanLiquidity(env) {
 const res=await fetch('https://rayanuae4-sudo.github.io/deeprise-scanner/market-alerts.json',
  {cache:'no-store',headers:{'accept':'application/json'}});
 if(!res.ok)throw Error('MARKET_FEED_UNAVAILABLE');
 const feed=await res.json(),updated=new Date(feed.generated_at).getTime(),time=now();
 if(!Number.isFinite(updated)||updated>time+60000||time-updated>20*60000||!Array.isArray(feed.alerts))return {status:'stale_or_invalid_feed',sent:0};
 let checked=0,sent=0;
 for(const a of feed.alerts.slice(0,60)){
  if(checked>=2)break;
  const q=qualityForLiquidity(a,time);if(!q.ok)continue;
  if(!/^[A-Za-z0-9:_-]{8,120}$/.test(a.id||''))continue;
  checked++;
  const side=q.side==='SHORT'?'خطر هبوط بعد سحب سيولة الشراء':'احتمال ارتداد بعد سحب سيولة البيع';
  const msg={title:'DeepRise · '+a.symbol+' سيولة',body:side+' · قوة الأدلة '+a.trap_score+'/100 · مراقبة فقط وليست إشارة دخول.',url:safeAlertLink(a.symbol,'15m'),tag:'liq-'+a.id};
  const out=await broadcast(env,'liquidity:'+a.id,msg,'LIQUIDITY_WATCH');
  sent+=out.accepted||0;
 }
 await env.DB.prepare('DELETE FROM sent_events WHERE created_at<?').bind(time-14*86400000).run();
 return {status:'ok',checked,sent};
}
export default {
 async fetch(request,env){
  const u=new URL(request.url),origin=request.headers.get('Origin')||'';
  if(request.method==='OPTIONS')return origin===APP_ORIGIN
   ? new Response(null,{status:204,headers:cors(origin)}):new Response(null,{status:403});
  if(u.pathname==='/health'&&request.method==='GET')return json({ok:true,service:'deeprise-push',configured:settingsReady(env)});
  if(origin&&origin!==APP_ORIGIN)return invalid('FORBIDDEN_ORIGIN',403);
  if(!settingsReady(env))return invalid('SERVER_NOT_CONFIGURED',503,origin);
  if(request.method!=='POST')return invalid('NOT_FOUND',404,origin);
  try{
   switch(u.pathname){
    case '/v1/pairing': return await pairing(request,env,origin);
    case '/v1/subscribe':return await subscribe(request,env,origin);
    case '/v1/unsubscribe':return await unsubscribe(request,env,origin);
    case '/v1/test':return await testDevice(request,env,origin);
    case '/v1/alerts':return await publish(request,env,origin);
    default:return invalid('NOT_FOUND',404,origin);
   }
  }catch(_){return invalid('SERVER_ERROR',500,origin)}
 },
 async scheduled(controller,env,ctx){
  if(settingsReady(env))ctx.waitUntil(scanLiquidity(env).catch(()=>{}));
 }
};
