/* DeepRise V18.5 | conservative, fee-aware trade opportunity filter.
   Estimates are planning assumptions, NOT profits or win probabilities.
   All direction/stop/target checks are based on actual symbol-specific levels. */
(()=>{'use strict';
 const COST_PCT=.35; // conservative round-trip transaction cost + slippage allowance, user fee can differ
 const MIN_GROSS_TP1=1.30,MIN_GROSS_TP2=2.80,MIN_NET_TP2=2.30,MIN_NET_RR=2.0;
 const n=x=>x===null||x===undefined||x===''?NaN:Number(x);
 function evaluate({side,entry,stop,tp1,tp2,atrPct,expectedPct,updated,now=Date.now()}={}){
  const e=n(entry),sl=n(stop),t1=n(tp1),t2=n(tp2),atr=n(atrPct),sign=side==='LONG'?1:side==='SHORT'?-1:0;
  const errors=[],fail=(code,description)=>errors.push({code,description});
  if(!sign)fail('SIDE','Direction unconfirmed');
  if(![e,sl,t1,t2].every(v=>Number.isFinite(v)&&v>0)){fail('LEVELS','Missing valid entry, stop or TP levels');return{ok:false,reason:errors[0].code,reasons:errors,metrics:null,assumptions:{costPct:COST_PCT}}}
  const risk=sign*(e-sl)/e*100,p1=sign*(t1-e)/e*100,p2=sign*(t2-e)/e*100;
  const net1=p1-COST_PCT,net2=p2-COST_PCT,netRR=net2/(risk+COST_PCT);
  const minTP1=Math.max(MIN_GROSS_TP1,Number.isFinite(atr)?Math.min(2.6,atr*.65):0);
  const minTP2=Math.max(MIN_GROSS_TP2,Number.isFinite(atr)?Math.min(4.5,atr*1.15):0);
  if(!(risk>0))fail('STOP_DIRECTION','Invalid stop-loss side');
  if(!(p1>0&&p2>p1))fail('TARGET_DIRECTION','Targets not aligned with entry side');
  if(!(p1>=minTP1))fail('TP1_SMALL','TP1 expected return too small');
  if(!(p2>=minTP2&&net2>=MIN_NET_TP2))fail('TP2_SMALL','TP2 net expected return too small');
  if(!(risk>0&&netRR>=MIN_NET_RR))fail('RR_LOW','Risk/reward after estimated trading costs under 2.0');
  if(!(risk<=5.5))fail('STOP_WIDE','Stop-loss too far for intraday entry');
  if(Number.isFinite(n(expectedPct))&&Math.abs(n(expectedPct))>.01){
   if(sign*n(expectedPct)<=0)fail('FORECAST_CONFLICT','Forecast direction conflicts with trade');
  }
  if(Number.isFinite(n(updated))&&(updated>now+60000||now-updated>15*60000))fail('STALE','Forecast is older than 15 minutes');
  return{ok:errors.length===0,reason:errors[0]?.code||'QUALIFIED',reasons:errors,metrics:{grossTP1:p1,grossTP2:p2,netTP1:net1,netTP2:net2,riskPct:risk,netRR,minTP1,minTP2},assumptions:{costPct:COST_PCT}};
 }
 function scanner(x){
  if(!x)return{ok:false,reason:'MISSING_DATA',reasons:[{code:'MISSING_DATA',description:'No analysis'}]};
  const side=x._rawDirection||x.proSignal?.direction||x.direction;
  return evaluate({side,entry:x.price,stop:x.sl,tp1:x.tp1,tp2:x.tp2,atrPct:x.atrPct,expectedPct:x.proSignal?.expectedMovePct,updated:x.proSignal?.updated});
 }
 function radar(z){if(!z)return{ok:false,reason:'MISSING_DATA',reasons:[{code:'MISSING_DATA',description:'No radar setup'}]};const e=(Number(z.entryLo)+Number(z.entryHi))/2;
  return evaluate({side:z.side,entry:e,stop:z.invalid,tp1:z.tp1,tp2:z.tp2,atrPct:Number.isFinite(n(z.atr))&&e>0?n(z.atr)/e*100:NaN,updated:z.ts});
 }
 window.DeepRiseProfitQuality={version:'18.5',evaluate,scanner,radar,assumptions:{costPct:COST_PCT,minGrossTP1:MIN_GROSS_TP1,minGrossTP2:MIN_GROSS_TP2,minNetTP2:MIN_NET_TP2,minNetRR:MIN_NET_RR}};
})();
