/* DeepRise V15.5 — runtime integrity monitor.
   Core signal failures fail closed. Optional whale-flow degradation never blocks otherwise valid market entries. */
(()=>{'use strict';
if(window.DeepRiseIntegrity?.version==='15.5')return;
const VERSION='15.5',START=Date.now(),KEY='deeprise_integrity_v155_errors';
const S={status:'BOOTING',blockTrading:false,issues:[],warnings:[],errors:[],lastCheck:0};
const coreReq=[
 ['DeepRiseBinanceUniverse',()=>!!window.DeepRiseBinanceUniverse],
 ['DeepRiseV13',()=>!!window.DeepRiseV13],
 ['DeepRiseNextCandleV14',()=>!!window.DeepRiseNextCandleV14],
 ['DeepRiseSignalEngine',()=>!!window.DeepRiseSignalEngine],
 ['DeepRiseEntryRank',()=>window.DeepRiseEntryRank?.version==='15.5']
];
function save(){try{localStorage.setItem(KEY,JSON.stringify(S.errors.slice(-30)))}catch(e){}}
function record(type,msg,src){S.errors.push({time:Date.now(),type,msg:String(msg||'unknown'),src:String(src||'')});S.errors=S.errors.slice(-30);save()}
addEventListener('error',e=>record('error',e.message,e.filename));
addEventListener('unhandledrejection',e=>record('promise',e.reason?.message||e.reason||'unhandled rejection','promise'));
function sample(side){const long=side==='LONG';return{symbol:'INTEGRITYUSDT',direction:side,_rawDirection:side,e20:long?110:90,e50:100,h1Bull:long,h1Bear:!long,score:84,rsi:long?58:42,volumeRatio:1.45,candle:{bull:long,bear:!long},quoteVolume:50000000,rr:2.3,atrPct:2,proSignal:{direction:side,confidence:84,rank:84,multiTfAligned:true,riskFlags:[]}}}
function entryLogicTest(){try{
 const q=window.DeepRiseEntryRank?.quality;if(typeof q!=='function')return'entry quality unavailable';
 const a=q(sample('LONG')),b=q(sample('SHORT')),m=q({...sample('LONG'),h1Bull:false,h1Bear:true});
 const fast=q({...sample('LONG'),candle:{bull:false,bear:false},volumeRatio:1.5});
 if(a.state!=='READY'||a.count!==6||a.entryMode!=='STRICT')return'LONG strict regression failed';
 if(b.state!=='READY'||b.count!==6||b.entryMode!=='STRICT')return'SHORT strict regression failed';
 if(m.state==='READY'||m.state==='CONFIRMED')return'misaligned 1H regression failed';
 if(fast.state!=='READY'||fast.entryMode!=='FAST_TRACK'||fast.count!==5)return'fast-track regression failed';
 return null
 }catch(e){return'logic self-test: '+e.message}}
function paint(){let el=document.getElementById('dr-integrity-health');if(!el){el=document.createElement('span');el.id='dr-integrity-health';el.style.cssText='display:inline-flex;align-items:center;gap:5px;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:900;border:1px solid #18344c;margin-left:6px';const bar=document.querySelector('.marketbar');if(bar)bar.appendChild(el);else document.querySelector('.brand')?.appendChild(el)}if(!el)return;const ok=S.status==='HEALTHY',boot=S.status==='BOOTING',deg=S.status==='DEGRADED';el.textContent=(ok?'● SYSTEM OK':boot?'● SYSTEM CHECK':deg?'● SYSTEM DEGRADED':'● SYSTEM CRITICAL');el.style.color=ok?'#35e0a1':boot||deg?'#ffd166':'#ff6574';el.title=[...S.issues,...S.warnings].join(' | ')||'DeepRise runtime integrity checks passed'}
function check(){const issues=[],warnings=[];const age=Date.now()-START;
 if(age>8000)for(const [name,fn] of coreReq)if(!fn())issues.push('missing '+name);
 if(age>8000&&window.DeepRiseWhaleFlowV155?.version!=='15.5')warnings.push('optional whale-flow module unavailable');
 const logic=age>3500?entryLogicTest():null;if(logic)issues.push(logic);
 try{const st=window.DeepRiseBinanceUniverse?.state;if(st?.lastSync&&Date.now()-st.lastSync>360000)issues.push('market data stale >6m')}catch(e){issues.push('market freshness check failed')}
 try{if(window.DeepRiseWhaleFlowV155&&window.DeepRiseWhaleFlowV155.selfTest?.()!==true)warnings.push('whale-flow self-test failed')}catch(e){warnings.push('whale-flow self-test failed')}
 try{const ws=window.DeepRiseWhaleFlowV155?.state?.()?.source;const stamp=Date.parse(ws?.generated_at||0);if(stamp&&Date.now()-stamp>4*3600000)warnings.push('whale-flow source stale >4h')}catch(e){warnings.push('whale-flow freshness check failed')}
 S.issues=issues;S.warnings=warnings;S.lastCheck=Date.now();const noisy=S.errors.filter(x=>Date.now()-x.time<300000).length>=3;
 if(age<3500)S.status='BOOTING';else if(issues.length)S.status='CRITICAL';else if(warnings.length||noisy)S.status='DEGRADED';else S.status='HEALTHY';
 S.blockTrading=issues.length>0;paint();return{status:S.status,issues:[...S.issues],warnings:[...S.warnings],errors:[...S.errors],blockTrading:S.blockTrading,lastCheck:S.lastCheck}}
document.addEventListener('click',e=>{if(!S.blockTrading)return;const b=e.target.closest?.('.dr-enter-trade,.dr-native-entry,[data-trade-symbol]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const ar=(localStorage.getItem('deeprise_language')||'en')==='ar';alert(ar?'تم إيقاف الدخول مؤقتًا لأن فحص سلامة المحرك الأساسي اكتشف مشكلة حرجة. راجع مؤشر SYSTEM.':'Entry is temporarily blocked because the core integrity monitor detected a critical system issue. Check the SYSTEM indicator.')},true);
window.DeepRiseIntegrity={version:VERSION,state:S,check,report:()=>({version:VERSION,...check()})};
addEventListener('DOMContentLoaded',()=>setTimeout(check,1400));addEventListener('load',()=>{setTimeout(check,3500);setTimeout(check,9000)});setTimeout(check,2000);setInterval(check,30000);
})();