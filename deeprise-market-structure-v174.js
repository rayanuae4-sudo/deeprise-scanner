/* DeepRise V17.4: causal, closed-candle market structure and confirmed order blocks. */
(()=>{'use strict';
const VERSION='17.4',TF_MS={'5m':300000,'15m':900000,'1h':3600000,'4h':14400000,'1d':86400000};
function parse(raw,now){
 return (raw||[]).map(x=>Array.isArray(x)?{time:+x[0],open:+x[1],high:+x[2],low:+x[3],close:+x[4],volume:+x[5],closeTime:+x[6]}:{...x})
 .filter(x=>[x.time,x.open,x.high,x.low,x.close,x.closeTime].every(Number.isFinite)&&x.low>0&&x.high>=Math.max(x.open,x.close)&&x.low<=Math.min(x.open,x.close)&&x.closeTime<now-1200)
 .sort((a,b)=>a.time-b.time).filter((x,i,a)=>!i||x.time>a[i-1].time);
}
function atrAt(b,i){let sum=0,count=0;for(let j=Math.max(1,i-13);j<=i;j++){sum+=Math.max(b[j].high-b[j].low,Math.abs(b[j].high-b[j-1].close),Math.abs(b[j].low-b[j-1].close));count++}return count?sum/count:b[i].high-b[i].low}
function fibonacci(pivots,bias){
 const endType=bias==='SHORT'?'LOW':bias==='LONG'?'HIGH':pivots.at(-1)?.type;
 const end=[...pivots].reverse().find(p=>p.type===endType);
 if(!end)return null;
 const start=[...pivots].reverse().find(p=>p.index<end.index&&p.type!==end.type);
 if(!start||start.price===end.price)return null;
 const long=end.type==='HIGH',delta=end.price-start.price;
 if((long&&delta<=0)||(!long&&delta>=0))return null;
 const third=pivots.find(p=>p.index>end.index&&p.type===start.type&&(long?p.price>start.price&&p.price<end.price:p.price<start.price&&p.price>end.price));
 const levels=[0,.236,.382,.5,.618,.786,1].map(r=>({ratio:r,price:end.price-delta*r}));
 const extensions=[1.272,1.618,2,2.618].map(r=>({ratio:r,price:end.price+delta*(r-1)})).filter(x=>x.price>0);
 const trendExtensions=third?[.618,1,1.272,1.618,2,2.618].map(r=>({ratio:r,price:third.price+delta*r})).filter(x=>x.price>0):[];
 const golden=[end.price-delta*.618,end.price-delta*.786].sort((a,b)=>a-b);
 return{side:long?'LONG':'SHORT',start,end,third:third||null,levels,extensions,trendExtensions,golden,equilibrium:(start.price+end.price)/2};
}
function analyse(raw,options={}){
 const now=options.now??Date.now(),tf=options.tf||'4h',span=Math.max(1,Math.min(10,Math.floor(options.pivotSpan||3))),bars=parse(raw,now);
 if(bars.length<span*2+3)return null;
 const pivots=[],events=[],gaps=[],sweeps=[],blocks=[],broken=new Set();
 let high=null,low=null,protectedHigh=null,protectedLow=null,bias='RANGE';
 function pivot(type,index,confirmedIndex){
  const price=type==='HIGH'?bars[index].high:bars[index].low,prev=[...pivots].reverse().find(p=>p.type===type);
  const label=!prev?(type==='HIGH'?'H':'L'):type==='HIGH'?(price>prev.price?'HH':price<prev.price?'LH':'EQH'):(price<prev.price?'LL':price>prev.price?'HL':'EQL');
  const p={type,index,price,label,time:bars[index].time,confirmedIndex,confirmedAt:bars[confirmedIndex].closeTime};pivots.push(p);if(type==='HIGH')high=p;else low=p;
 }
 for(let i=0;i<bars.length;i++){
  const b=bars[i],a=atrAt(bars,i);
  // A confirmed block can be tested only on candles closing after its breakout.
  for(const ob of blocks){
   if(ob.status==='INVALID'||i<=ob.breakIndex)continue;
   if(ob.side==='LONG'?b.close<ob.lower:b.close>ob.upper){ob.status='INVALID';ob.invalidatedAt=b.closeTime;continue}
   if(b.low<=ob.upper&&b.high>=ob.lower){ob.status='TESTED';ob.tests++;ob.lastTestAt=b.closeTime}
  }
  for(const g of gaps){if(g.status==='FILLED'||g.index===i)continue;const reached=g.side==='LONG'?b.low<=g.upper:b.high>=g.lower;if(!reached)continue;
   if(!g.firstTouchAt)g.firstTouchAt=b.closeTime;g.lastTouchAt=b.closeTime;
   if(g.side==='LONG')g.remainingUpper=Math.max(g.lower,Math.min(g.remainingUpper,b.low));else g.remainingLower=Math.min(g.upper,Math.max(g.remainingLower,b.high));
   g.status=(g.side==='LONG'?b.low<=g.lower:b.high>=g.upper)?'FILLED':'PARTIAL';if(g.status==='FILLED')g.filledAt=b.closeTime;
  }
  if(i>=2){const first=bars[i-2],bull=b.low>first.high,bear=b.high<first.low;
   if(bull||bear){const lower=bull?first.high:b.high,upper=bull?b.low:first.low;if(upper-lower>=a*.05)gaps.push({side:bull?'LONG':'SHORT',lower,upper,remainingLower:lower,remainingUpper:upper,index:i,startIndex:i-2,time:b.time,createdAt:b.closeTime,status:'UNFILLED',mid:(lower+upper)/2})}
  }
  const p=i-span;
  if(p>=span){const left=bars.slice(p-span,p),right=bars.slice(p+1,p+span+1);
   if(left.every(x=>bars[p].high>x.high)&&right.every(x=>bars[p].high>=x.high))pivot('HIGH',p,i);
   if(left.every(x=>bars[p].low<x.low)&&right.every(x=>bars[p].low<=x.low))pivot('LOW',p,i);
  }
  const upTarget=bias==='SHORT'?protectedHigh:high,downTarget=bias==='LONG'?protectedLow:low;
  const up=upTarget&&!broken.has('HIGH:'+upTarget.index)&&b.close>upTarget.price,down=downTarget&&!broken.has('LOW:'+downTarget.index)&&b.close<downTarget.price;
  const fire=(side,target)=>{
   const oldBias=bias,type=oldBias==='RANGE'||oldBias===side?'BOS':'CHOCH';
   events.push({type,side,index:i,time:b.time,confirmedAt:b.closeTime,price:target.price,pivotIndex:target.index,initial:oldBias==='RANGE'});
   // Last opposite candle before a meaningful, closed-candle displacement and BOS / CHoCH.
   // The zone becomes observable ONLY when this break closes, never at its origin candle.
   if(Math.abs(b.close-b.open)>=a*.32&&Math.abs(b.close-target.price)>=a*.07){
    let origin=-1;for(let k=i-1;k>=Math.max(0,i-8);k--){const c=bars[k];if(side==='LONG'?c.close<c.open:c.close>c.open){origin=k;break}}
    if(origin>=0){const c=bars[origin],lower=side==='LONG'?c.low:c.open,upper=side==='LONG'?c.open:c.high;
     if(upper>lower&&upper-lower<=a*2.5&&!blocks.some(x=>x.originIndex===origin&&x.side===side)){
      blocks.push({side,lower,upper,mid:(lower+upper)/2,originIndex:origin,breakIndex:i,originTime:c.time,confirmedAt:b.closeTime,breakType:type,breakPrice:target.price,status:'FRESH',tests:0,lastTestAt:null,invalidatedAt:null});
     }
    }
   }
   broken.add(target.type+':'+target.index);bias=side;
   if(side==='LONG'){protectedHigh=null;protectedLow=[...pivots].reverse().find(x=>x.type==='LOW'&&x.index<i)||null}
   else{protectedLow=null;protectedHigh=[...pivots].reverse().find(x=>x.type==='HIGH'&&x.index<i)||null}
  };
  if(up)fire('LONG',upTarget);else if(down)fire('SHORT',downTarget);
  for(const target of [high,low]){if(!target||broken.has(target.type+':'+target.index))continue;
   if(target.type==='HIGH'?b.high>target.price&&b.close<=target.price:b.low<target.price&&b.close>=target.price)sweeps.push({side:target.type==='HIGH'?'SHORT':'LONG',index:i,time:b.time,price:target.price,pivotIndex:target.index});
  }
 }
 const last=bars.at(-1),atr=atrAt(bars,bars.length-1),fib=fibonacci(pivots,bias);
 return{version:VERSION,tf,pivotSpan:span,intervalMs:TF_MS[tf]||TF_MS['4h'],bars,pivots,events,gaps,sweeps,blocks,bias,protectedHigh,protectedLow,lastEvent:events.at(-1)||null,lastHigh:high,lastLow:low,fib,atr,price:last.close,barClose:last.closeTime,updated:now};
}
function classify(z,structure,now=Date.now()){
 if(!z)return{group:'EARLY',reason:'NO_SETUP'};
 const long=z.side==='LONG',p=Number(z.price),atr=Number(z.atr),trigger=Number(z.trigger),closed=Number(z.closedPrice);
 if(z.stage==='LATE'||z.extended)return{group:'BLOCKED',reason:'EXTENDED'};
 if(!Number.isFinite(z.ts)||now-z.ts>360000||z.ts>now+60000)return{group:'EARLY',reason:'STALE'};
 if(!(p>0&&atr>0&&trigger>0&&closed>0))return{group:'EARLY',reason:'MISSING_DATA'};
 if((long?p<=z.invalid:p>=z.invalid))return{group:'BLOCKED',reason:'INVALIDATED'};
 const distanceAtr=Math.max(0,(long?trigger-p:p-trigger)/atr),inZone=p>=z.entryLo&&p<=z.entryHi;
 if(long?p>z.entryHi+atr*.25:p<z.entryLo-atr*.25)return{group:'BLOCKED',reason:'OUTSIDE_ENTRY',distanceAtr};
 if(!structure||now-structure.barClose>structure.intervalMs*1.1||now-structure.updated>360000)return{group:'EARLY',reason:'STRUCTURE_UNAVAILABLE',distanceAtr};
 const protection=long?structure.protectedLow:structure.protectedHigh,aligned=structure.bias===z.side;
 if(!aligned&&structure.bias!=='RANGE')return{group:'EARLY',reason:'STRUCTURE_CONFLICT',distanceAtr};
 const intact=!!protection&&(long?p>protection.price:p<protection.price);
 if(protection&&!intact)return{group:'BLOCKED',reason:'PROTECTION_BROKEN',distanceAtr};
 const event=structure.lastEvent,recent=event&&event.side===z.side&&structure.bars.length-1-event.index<=3;
 const closedTrigger=long?closed>trigger:closed<trigger;
 const fvg=structure.gaps.find(g=>g.side===z.side&&g.status!=='FILLED'&&p>=g.remainingLower-atr*.15&&p<=g.remainingUpper+atr*.15);
 const fib=structure.fib,atFib=!!fib&&fib.side===z.side&&p>=fib.golden[0]-atr*.15&&p<=fib.golden[1]+atr*.15;
 const confluence=Number(aligned)+Number(intact)+Number(!!fvg)+Number(atFib);
 const context={distanceAtr,aligned,protected:intact,closedTrigger,inZone,event:event?.type||null,fvg:!!fvg,fib:atFib,confluence};
 if(['IGNITION','ARMED'].includes(z.stage)&&closedTrigger&&inZone&&aligned&&intact&&recent)return{group:'READY',reason:'CONFIRMED_ENTRY',...context};
 if(['IGNITION','ARMED'].includes(z.stage)&&distanceAtr<=.75)return{group:'NEAR',reason:!closedTrigger?'WAIT_CLOSE':!inZone?'WAIT_RETEST':'WAIT_STRUCTURE',...context};
 return{group:'EARLY',reason:'FORMING',...context};
}
window.DeepRiseStructure={version:VERSION,analyse,fibonacci,classify,parse};
})();
