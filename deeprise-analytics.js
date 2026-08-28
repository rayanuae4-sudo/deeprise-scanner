(()=>{'use strict';
const CFG=window.DEEPRISE_ANALYTICS_CONFIG||{};
const QK='deeprise_analytics_queue_v1',IDK='deeprise_visitor_id_v1',SESSK='deeprise_session_id_v1';
const now=()=>Date.now();
function id(k){let v=localStorage.getItem(k);if(!v){v=(crypto?.randomUUID?.()||('dr-'+Math.random().toString(36).slice(2)+Date.now().toString(36)));localStorage.setItem(k,v)}return v}
const visitorId=id(IDK);let sessionId=sessionStorage.getItem(SESSK);if(!sessionId){sessionId='s-'+(crypto?.randomUUID?.()||Math.random().toString(36).slice(2));sessionStorage.setItem(SESSK,sessionId)}
function readQ(){try{return JSON.parse(localStorage.getItem(QK)||'[]')}catch(e){return[]}}
function writeQ(q){try{localStorage.setItem(QK,JSON.stringify(q.slice(-120)))}catch(e){}}
function baseProps(){return{distinct_id:visitorId,session_id:sessionId,app:'DeepRise Scanner',app_version:CFG.version||'V11 PRO',language:localStorage.getItem('deeprise_language')||document.documentElement.lang||navigator.language||'unknown',path:location.pathname,query:location.search,referrer:document.referrer||'',display_mode:(matchMedia('(display-mode: standalone)').matches||navigator.standalone)?'standalone':'browser',viewport:`${innerWidth}x${innerHeight}`,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||'',user_agent:navigator.userAgent}}
async function send(ev){if(!CFG.enabled)return false;if(!CFG.projectKey){let q=readQ();q.push(ev);writeQ(q);return false}try{let r=await fetch((CFG.host||'https://us.i.posthog.com').replace(/\/$/,'')+'/capture/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:CFG.projectKey,event:ev.event,properties:ev.properties}),keepalive:true});return r.ok}catch(e){return false}}
function capture(event,props={}){const ev={event,properties:{...baseProps(),...props,$lib:'deeprise-direct'}};send(ev).then(ok=>{if(!ok&&CFG.projectKey){let q=readQ();q.push(ev);writeQ(q)}});return ev}
async function flush(){if(!CFG.projectKey)return;let q=readQ();if(!q.length)return;let left=[];for(const ev of q){if(!(await send(ev)))left.push(ev)}writeQ(left)}
function classify(el){const txt=(el?.textContent||'').trim().replace(/\s+/g,' ').slice(0,120);const low=txt.toLowerCase();let event='ui_click';if(/scan|فحص|скан/.test(low))event='scan_click';else if(/chart|الشارت|граф/.test(low))event='chart_open';else if(/top 5|أفضل 5|топ-5|results|نتائج/.test(low))event='top5_open';else if(/pump|بامب|памп|radar|رادار/.test(low))event='radar_open';else if(/signal|توصي|сигнал/.test(low))event='signals_open';else if(/language|العربية|english|рус/.test(low))event='language_action';return{event,label:txt,tag:el?.tagName||'',id:el?.id||'',cls:(el?.className&&String(el.className).slice(0,120))||''}}
addEventListener('click',e=>{const el=e.target?.closest?.('button,a,[role=button]');if(!el)return;const c=classify(el);capture(c.event,{label:c.label,element_tag:c.tag,element_id:c.id,element_class:c.cls})},{capture:true});
addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')capture('session_hidden',{duration_ms:Math.max(0,now()-started)})});
addEventListener('beforeunload',()=>capture('session_end',{duration_ms:Math.max(0,now()-started)}));
const started=now();
window.DeepRiseAnalytics={capture,flush,visitorId,sessionId,configure:(projectKey,host)=>{CFG.projectKey=projectKey||'';if(host)CFG.host=host;flush();capture('analytics_configured')}};
addEventListener('load',()=>{capture('$pageview',{title:document.title,url:location.href});capture('app_open');flush();setTimeout(()=>capture('engaged_30s',{elapsed_ms:30000}),30000)});
})();
