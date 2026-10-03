/* DeepRise V17.1 — confirmed closed-candle signal stability. */
(()=>{'use strict';
const VERSION='17.1',KEY='deeprise_v171_signal_stability',state={book:{}};
const n=(v,d=0)=>Number.isFinite(+v)?+v:d;
function load(){try{state.book=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){state.book={}}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state.book))}catch(_){}}
function decide(x,raw,barClose){
 const symbol=String(x?.symbol||''),p=x?.proSignal||{},confidence=n(p.confidence,x?.score),aligned=p.detailed===true&&p.multiTfAligned===true,now=Date.now(),closed=Number(barClose),valid=raw==='LONG'||raw==='SHORT';
 if(!symbol)return{direction:valid?raw:'WAIT',status:'UNTRACKED'};
 let z=state.book[symbol]||{accepted:'WAIT',acceptedAt:0,pending:'WAIT',bars:[]};if(!Array.isArray(z.bars))z.bars=[];z.lastSeen=now;
 if(!valid){z.pending='WAIT';z.bars=[];state.book[symbol]=z;save();return{direction:'WAIT',accepted:z.accepted,status:z.accepted==='WAIT'?'NEUTRAL':'WEAKENING',confirmations:0,required:0}}
 // Missing or fallback forecasts never turn a live price tick into a new recommendation.
 if(!aligned||!Number.isFinite(closed)||closed<=0){state.book[symbol]=z;return{direction:'WAIT',accepted:z.accepted,status:'AWAITING_CLOSED_CANDLES',confirmations:0,required:0}}
 if(raw===z.accepted){z.pending='WAIT';z.bars=[];state.book[symbol]=z;save();return{direction:raw,accepted:raw,status:'STABLE',confirmations:0,required:0}}
 if(z.accepted==='WAIT'&&confidence>=72){z.accepted=raw;z.acceptedAt=now;z.acceptedBar=closed;z.pending='WAIT';z.bars=[];state.book[symbol]=z;save();return{direction:raw,accepted:raw,status:'STABLE',confirmations:1,required:1}}
 if(z.pending!==raw){z.pending=raw;z.bars=[]}
 if(closed>n(z.acceptedBar)&&!z.bars.includes(closed))z.bars.push(closed);
 const required=confidence>=86?2:3,confirmed=z.bars.length>=required&&z.bars.at(-1)-z.bars[0]>=15*60000*(required-1)&&confidence>=76;
 if(confirmed){z.accepted=raw;z.acceptedAt=now;z.acceptedBar=closed;z.pending='WAIT';z.bars=[];state.book[symbol]=z;save();return{direction:raw,accepted:raw,status:'REVERSAL_CONFIRMED',confirmations:required,required}}
 state.book[symbol]=z;save();return{direction:'WAIT',accepted:z.accepted,candidate:raw,status:'REVERSAL_PENDING',confirmations:z.bars.length,required}
}
function apply(x,raw,barClose){if(!x)return x;raw=['LONG','SHORT','WAIT'].includes(raw)?raw:'WAIT';const s=decide(x,raw,barClose);x.signalStability={...s,updated:Date.now(),modelVersion:VERSION};x.direction=s.direction;x._rawDirection=s.direction;if(x.proSignal){x.proSignal.rawDirection=raw;x.proSignal.direction=s.direction;x.proSignal.stability=x.signalStability}return x}
const css=document.createElement('style');css.textContent='.dr-premove-timing{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;padding:8px;border-radius:8px;background:#0b2130;color:#9fc7d8;font-size:10px}.dr-premove-timing b{color:#e5f6ff}';document.head.appendChild(css);
load();window.DeepRiseSignalStability={version:VERSION,state,decide,apply};
})();
