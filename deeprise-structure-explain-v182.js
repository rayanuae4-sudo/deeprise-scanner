/* DeepRise V18.2 — auditable, closed-candle market-structure explanations.
   Every explanation is an observational rule, not proof of institutional intent or a win rate. */
(()=>{'use strict';
const fmt=(n)=>Number.isFinite(Number(n))?Number(n).toLocaleString('en-US',{maximumFractionDigits:8}):'—';
const at=(ms,lang)=>Number.isFinite(ms)?new Date(ms).toLocaleString(lang==='ar'?'ar-SA-u-ca-gregory':lang==='ru'?'ru-RU':'en-GB',{timeZone:'Asia/Riyadh',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})+' UTC+3':'—';
const select=(lang,a,r,e)=>lang==='ar'?a:lang==='ru'?r:e;
function build(s){
 if(!s||!Array.isArray(s.bars))return [];
 const bars=s.bars,pivots=s.pivots||[],events=s.events||[],records=[],span=s.pivotSpan||3;
 const push=x=>records.push(x),last=bars.length-1;
 const older=(p)=>[...pivots].reverse().find(x=>x.type===p.type&&x.index<p.index);
 for(const p of pivots)push({id:'pivot-'+p.type+'-'+p.index,kind:'PIVOT',index:p.index,at:p.confirmedAt,label:p.label,price:p.price,side:p.type==='HIGH'?'SHORT':'LONG',data:{type:p.type,span,previous:older(p)?.price??null,confirmedAt:p.confirmedAt}});
 for(let i=0;i<events.length;i++){
  const e=events[i],bar=bars[e.index],prior=i?events[i-1].side:'RANGE';
  if(!bar)continue;
  const prot=e.protection||null;
  push({id:'break-'+e.index+'-'+e.side,kind:'BREAK',index:e.index,at:e.confirmedAt,label:e.type,price:e.price,side:e.side,
   data:{prior:e.priorBias||prior,initial:Boolean(e.initial),close:bar.close,atr:e.atrAtBreak||null,protectedPrice:prot?.price??null,protectedKind:prot?.type??null,protectedQuality:prot?.protection?.quality??null}});
  if(prot&&Number.isFinite(prot.price)){
   const brokenAfter=bars.slice(e.index+1).some(b=>e.side==='LONG'?b.close<prot.price:b.close>prot.price);
   push({id:'protected-'+e.index+'-'+e.side,kind:'PROTECTED',index:e.index,at:e.confirmedAt,
    label:e.side==='LONG'?'PL':'PH',price:prot.price,side:e.side,
    data:{pivotIndex:prot.index,pivotTime:prot.confirmedAt,quality:prot.protection?.quality||'INITIAL',
     breakPrice:e.price,breakType:e.type,breakClose:bar.close,invalidated:brokenAfter,scope:'EXTERNAL'}});
  }
 }
 for(const q of s.sweeps||[]){const b=bars[q.index];if(!b)continue;push({id:'sweep-'+q.index+'-'+q.side,kind:'SWEEP',index:q.index,at:b.closeTime,label:'SWEEP',price:q.price,side:q.side,
  data:{high:b.high,low:b.low,close:b.close,extreme:q.side==='LONG'?b.low:b.high}});}
 for(const z of s.blocks||[]){if(!bars[z.breakIndex])continue;push({id:'ob-'+z.breakIndex+'-'+z.originIndex+'-'+z.side,kind:'OB',index:z.breakIndex,at:z.confirmedAt,label:'OB',price:z.mid,side:z.side,
  data:{low:z.lower,high:z.upper,originIndex:z.originIndex,breakPrice:z.breakPrice,breakType:z.breakType,status:z.status,tests:z.tests||0,invalidatedAt:z.invalidatedAt||null}});}
 for(const z of s.gaps||[]){if(!bars[z.index])continue;push({id:'fvg-'+z.index+'-'+z.side,kind:'FVG',index:z.index,at:z.createdAt,label:'FVG',price:z.mid,side:z.side,
  data:{low:z.lower,high:z.upper,remainingLower:z.remainingLower,remainingUpper:z.remainingUpper,status:z.status,firstIndex:z.startIndex}});}
 // Internal protected extrema can differ from external ones. Explain their smaller pivot span explicitly.
 for(const kind of ['protectedHigh','protectedLow']){
  const p=s.internal?.[kind];if(!p)continue;
  const side=kind==='protectedLow'?'LONG':'SHORT',brokenAfter=bars.slice((p.protection?.breakIndex??last)+1).some(b=>side==='LONG'?b.close<p.price:b.close>p.price);
  push({id:'internal-'+kind+'-'+p.index,kind:'PROTECTED',index:p.protection?.breakIndex??p.index,at:p.protection?.breakTime||p.confirmedAt,label:side==='LONG'?'PL':'PH',price:p.price,side,
   data:{pivotIndex:p.index,pivotTime:p.confirmedAt,quality:p.protection?.quality||'INITIAL',breakPrice:p.protection?.brokenLevel,
    breakType:p.protection?.eventType||'BOS',invalidated:brokenAfter,scope:'INTERNAL',span:s.internal.pivotSpan}});
 }
 return records.filter(x=>Number.isFinite(x.at)&&Number.isFinite(x.index)).sort((a,b)=>b.at-a.at||a.id.localeCompare(b.id));
}
function describe(r,lang='en'){
 const x=r.data||{},up=r.side==='LONG',dir=select(lang,'صعودي','бычий','bullish'),num=fmt,price='$'+num(r.price),
 intro={PIVOT:select(lang,'قمة/قاع سعري مؤكد','Подтверждённый свинг','Confirmed swing'),
 BREAK:select(lang,'كسر هيكل السوق','Пробой структуры','Structure break'),PROTECTED:select(lang,'مستوى محمي','Защищённый уровень','Protected level'),
 SWEEP:select(lang,'سحب سيولة محتمل','Предполагаемый сбор ликвидности','Potential liquidity sweep'),
 OB:select(lang,'منطقة أوردر بلوك مرشحة','Потенциальный ордер-блок','Candidate order block'),
 FVG:select(lang,'فجوة قيمة عادلة','Зона дисбаланса FVG','Fair value gap')}[r.kind]||r.kind;
 let why='',outlook='',invalid='';
 if(r.kind==='PIVOT'){
  const high=x.type==='HIGH',name=high?select(lang,'قمة','Максимум','High'):select(lang,'قاع','Минимум','Low');
  const comp=x.previous===null?
   select(lang,'أول مستوى من نوعه في البيانات المعروضة','Первый экстремум этого типа','First observed swing of this kind'):
   (r.label==='HH'||r.label==='HL'?select(lang,'أعلى من السابق','Выше предыдущего','higher than the prior'):r.label==='LH'||r.label==='LL'?select(lang,'أقل من السابق','Ниже предыдущего','lower than the prior'):select(lang,'مساوٍ للسابق','Равен предыдущему','equal to the prior'))+' ('+num(x.previous)+')';
  why=select(lang,name+' عند '+price+'؛ تفوّق على '+x.span+' شموع سابقة و'+x.span+' لاحقة، ولم يُعتمد إلا بعد إغلاق شمعة التأكيد '+at(x.confirmedAt,lang)+'. التصنيف '+r.label+' لأنه '+comp+'.',
   name+' '+price+': экстремум относительно '+x.span+' предыдущих и '+x.span+' следующих свечей; подтверждён '+at(x.confirmedAt,lang)+'. '+r.label+' — '+comp+'.',
   name+' '+price+' exceeds '+x.span+' preceding and '+x.span+' following candles; confirmed only at '+at(x.confirmedAt,lang)+'. '+r.label+' means '+comp+'.');
  outlook=select(lang,'هذا توصيف للهيكل لا إشارة دخول مستقلة؛ تتقوّى قراءة الاتجاه فقط إذا تبعه كسر بنية مؤكد متوافق.',
   'Это описание структуры, а не сигнал входа; нужно подтверждение закрытием за структурным уровнем.',
   'This is a swing classification, not an entry signal. Look for a subsequent aligned close-confirmed structure break.');
  invalid=select(lang,'لا يُمحى التصنيف التاريخي؛ تغيّر البنية اللاحقة يغيّر القراءة المستقبلية.', 'Историческая метка сохраняется, но прогноз меняется с новой структурой.',
   'Historical labels remain; newer structure can change the forward interpretation.');
 }else if(r.kind==='BREAK'){
  const reverse=x.prior&&x.prior!=='RANGE'&&x.prior!==r.side;
  const delta=Math.abs(x.close-r.price),atr=Number(x.atr);
  why=select(lang,
   'أغلقت الشمعة عند $'+num(x.close)+(up?' فوق ':' تحت ')+'القمة/القاع المؤكد '+price+' بمسافة $'+num(delta)+(atr>0?' ('+(delta/atr).toFixed(2)+' ATR)':'')+'. '+(r.label==='CHOCH'?'الاتجاه الهيكلي السابق كان معاكسًا، لذلك سُمّي CHoCH.':x.initial?'هذا أول كسر يحدد اتجاهًا مبدئيًا؛ BOS أولي وليس انعكاسًا مؤكدًا.':'الاتجاه السابق متوافق؛ لذلك سُمّي BOS استمرارًا.') ,
   'Закрытие $'+num(x.close)+(up?' выше ':' ниже ')+'уровня '+price+' на $'+num(delta)+(atr>0?' ('+(delta/atr).toFixed(2)+' ATR)':'')+'. '+(reverse?'CHoCH: прежняя структура была противоположной.':x.initial?'Первичный BOS из диапазона.':'BOS: продолжение прежнего направления.'),
   'Candle closed at $'+num(x.close)+(up?' above ':' below ')+'the confirmed level '+price+' by $'+num(delta)+(atr>0?' ('+(delta/atr).toFixed(2)+' ATR)':'')+'. '+(reverse?'CHoCH: prior structure pointed the other way.':x.initial?'Initial BOS from a range, not a confirmed reversal.':'BOS: continuation of the existing direction.'));
  outlook=select(lang,up?'يرجّح استمرارًا صعوديًا مشروطًا بثبات القاع المحمي وتجنّب الدخول بعد امتداد الحركة.':'يرجّح استمرارًا هبوطيًا مشروطًا بثبات القمة المحمية وعدم مطاردة الحركة.',
   up?'Возможное продолжение вверх при сохранении защищённого минимума.':'Возможное продолжение вниз при сохранении защищённого максимума.',
   up?'Supports a conditional bullish continuation if the protected low holds.':'Supports a conditional bearish continuation if the protected high holds.');
  invalid=x.protectedPrice!==null&&x.protectedPrice!==undefined?
    select(lang,'تُلغى هذه القراءة الهيكلية إذا أغلقت شمعة '+(up?'دون القاع المحمي ':'فوق القمة المحمية ')+'$'+num(x.protectedPrice)+'.',
    'Отмена структуры при закрытии '+(up?'ниже ':'выше ')+'защищённого уровня $'+num(x.protectedPrice)+'.',
    'Structural invalidation: a candle closes '+(up?'below ':'above ')+'the protected '+(up?'low ':'high ')+'$'+num(x.protectedPrice)+'.'):
    select(lang,'لم يتأكد مستوى محمي بعد؛ هذا الكسر وحده لا يحدد وقفًا فنيًا صالحًا.',
    'Подтверждённой защиты нет; стоп нельзя вывести из этого события.','No protected pivot is available yet; a defensible stop cannot be inferred from this break alone.');
 }else if(r.kind==='PROTECTED'){
  const q=x.quality==='CONFIRMED',base=up?select(lang,'قاعًا','минимум','low'):select(lang,'قمةً','максимум','high');
  const how=q?select(lang,'وهو ارتداد مؤكد تشكّل بعد المستوى المكسور وقبل الإغلاق الكاسر','Подтверждённый откат после пробитого уровня до импульса','a confirmed retracement formed after the broken swing and before the break'):
   select(lang,'وهو اختيار مبدئي لأقرب قمة/قاع مؤكد متاح، وليس حماية بنيوية قوية بعد','Предварительный выбор ближайшего свинга — не сильное подтверждение','a provisional selection of the latest known swing, not yet strong protection');
  why=select(lang,'بعد '+(x.breakType||'BOS')+' عند $'+num(x.breakPrice)+' اختار المحرك '+base+' عند '+price+' '+how+'. '+(x.scope==='INTERNAL'?'هيكل داخلي سريع (نطاق ارتكاز '+x.span+' شمعة).':'هيكل خارجي.') ,
  'После '+(x.breakType||'BOS')+' на $'+num(x.breakPrice)+' модель выбрала '+base+' '+price+'; '+how+'. '+(x.scope==='INTERNAL'?'Внутренняя структура.':'Внешняя структура.'),
  'After '+(x.breakType||'BOS')+' through $'+num(x.breakPrice)+', the model selected the '+base+' at '+price+': '+how+'. '+(x.scope==='INTERNAL'?'Internal swing scope.':'External swing scope.'));
  outlook=select(lang,up?'بقاء الإغلاقات فوق هذا القاع يدعم سيناريو استمرار الصعود، لكنه لا يضمن الارتفاع.':'بقاء الإغلاقات دون هذه القمة يدعم سيناريو استمرار الهبوط، لكنه لا يضمن الانخفاض.',
    up?'Закрытия выше защищённого минимума поддерживают рост, не гарантируя его.':'Закрытия ниже защищённого максимума поддерживают снижение.',
    up?'Closes holding above this low support, but do not guarantee, bullish continuation.':'Closes holding below this high support, but do not guarantee, bearish continuation.');
  invalid=select(lang,'الإبطال الهيكلي: إغلاق شمعة '+(up?'تحت ':'فوق ')+price+'. الحالة: '+(x.invalidated?'حدث إبطال لاحقًا.':'لم يُرصد إبطال بإغلاق حتى آخر شمعة.'),
   'Отмена: закрытие '+(up?'ниже ':'выше ')+price+'. '+(x.invalidated?'Позже был пробой.':'Пробой закрытием не зарегистрирован.'),
   'Structural invalidation: a candle closes '+(up?'below ':'above ')+price+'. '+(x.invalidated?'A later close invalidated it.':'No invalidating close was seen through the latest bar.'));
 }else if(r.kind==='SWEEP'){
  why=select(lang,'اخترقت الفتيلة '+(up?'القاع':'القمة')+' السابقة $'+num(r.price)+' إلى $'+num(x.extreme)+' ثم أغلقت الشمعة عند $'+num(x.close)+' داخل المستوى؛ لم يحدث كسر هيكلي بإغلاق.',
   'Тень пересекла '+(up?'минимум':'максимум')+' $'+num(r.price)+' до $'+num(x.extreme)+' и вернулась закрытием к $'+num(x.close)+'. Структурного пробоя нет.',
   'The wick swept the prior '+(up?'low':'high')+' $'+num(r.price)+' to $'+num(x.extreme)+' but closed back inside at $'+num(x.close)+'. This is not a close-confirmed break.');
  outlook=select(lang,'قد يشير إلى رفض اختراق وسيولة جرى اختبارها؛ لا يُرجّح انعكاسًا إلا بعد CHoCH ثم BOS أو تأكيدات إضافية.',
   'Возможен отказ от пробоя, но разворот требует CHoCH/BOS и дальнейших подтверждений.',
   'May indicate a failed break or liquidity probe; reversal needs later CHoCH/BOS or other confirmation.');
  invalid=select(lang,'إغلاق لاحق '+(up?'أسفل ':'أعلى ')+'أقصى الفتيلة $'+num(x.extreme)+' يضعف سيناريو الرفض.',
   'Закрытие '+(up?'ниже ':'выше ')+'экстремума тени $'+num(x.extreme)+' ослабляет сценарий.',
   'A later close '+(up?'below ':'above ')+'the swept extreme $'+num(x.extreme)+' weakens this rejection setup.');
 }else if(r.kind==='OB'){
  why=select(lang,'آخر شمعة معاكسة قبل الإزاحة التي رافقت '+(x.breakType||'BOS')+'؛ المنطقة $'+num(x.low)+'–$'+num(x.high)+' لم تُعتمد إلا عند إغلاق شمعة الكسر. الحالة '+x.status+'، وعدد الاختبارات '+x.tests+'. ليست دليلًا مباشرًا على أوامر مؤسسات.',
   'Последняя встречная свеча перед импульсом '+(x.breakType||'BOS')+'. Зона $'+num(x.low)+'–$'+num(x.high)+' стала известна только на закрытии пробоя. Статус '+x.status+', тесты '+x.tests+'. Не подтверждает институциональные ордера.',
   'Last opposing candle ahead of a displacement with '+(x.breakType||'BOS')+'. Zone $'+num(x.low)+'–$'+num(x.high)+' was confirmed only when the break closed. Status '+x.status+', tests '+x.tests+'. It does not prove institutional orders.');
  outlook=select(lang,'إعادة الاختبار مع رفض سعري وتوافق الهيكل قد تدعم استمرار '+(up?'الصعود':'الهبوط')+'؛ المنطقة وحدها لا تفعّل الدخول.',
  'Ретест с реакцией цены и подтверждённой структурой может поддержать движение '+(up?'вверх.':'вниз.'), 'A retest with price rejection and aligned structure may support '+(up?'upside':'downside')+' continuation; the zone alone is not an entry.');
  invalid=select(lang,'يُلغى الأوردر بلوك عند إغلاق '+(up?'تحت الحد السفلي $'+num(x.low):'فوق الحد العلوي $'+num(x.high))+'.',
  'Зона недействительна при закрытии '+(up?'ниже $'+num(x.low):'выше $'+num(x.high))+'.',
  'Invalidation: candle close '+(up?'below the lower edge $'+num(x.low):'above the upper edge $'+num(x.high))+'.');
 }else if(r.kind==='FVG'){
  why=select(lang,'فجوة فتائل بين الشمعة الأولى والثالثة من نموذج ثلاث شموع، والنطاق $'+num(x.low)+'–$'+num(x.high)+'؛ المتبقي غير الممتلئ $'+num(x.remainingLower)+'–$'+num(x.remainingUpper)+'. الحالة '+x.status+'.',
    'Разрыв теней между первой и третьей свечами: $'+num(x.low)+'–$'+num(x.high)+'. Незакрытая часть $'+num(x.remainingLower)+'–$'+num(x.remainingUpper)+'. Статус '+x.status+'.',
    'Three-candle wick imbalance between first and third candles: $'+num(x.low)+'–$'+num(x.high)+'. Unfilled portion $'+num(x.remainingLower)+'–$'+num(x.remainingUpper)+'. Status '+x.status+'.');
  outlook=select(lang,'قد يعود السعر لاختبار الفجوة؛ لا يمكن استنتاج موعد الملء أو الاتجاه المستقبلي منها وحدها.',
    'Цена может вернуться в зону; время заполнения и направление не гарантируются.',
    'Price may revisit the imbalance; fill timing and subsequent direction are not predictable from the gap alone.');
  invalid=select(lang,x.status==='FILLED'?'الفجوة ممتلئة؛ لم تعد منطقة FVG نشطة.':'تفقد صلاحيتها كفجوة نشطة عند امتلائها بالكامل.',
    x.status==='FILLED'?'Разрыв полностью заполнен и неактивен.':'Перестаёт быть активной зоной после полного заполнения.',
    x.status==='FILLED'?'Already fully mitigated; no longer an active FVG.':'Fully filling the gap removes it from active FVG zones.');
 }
 return{title:intro+' · '+r.label+' · '+price,why,outlook,invalid,confirmed:at(r.at,lang),kind:r.kind,scope:x.scope||null,quality:x.quality||null};
}
function outlook(s,side,lang='en'){
 if(!s)return null;
 const bullish=side==='LONG',p=bullish?s.protectedLow:s.protectedHigh;
 const seq=s.smc?.[side],recent=[...(s.events||[])].reverse().find(x=>x.side===side),
 activeOb=(s.blocks||[]).filter(x=>x.side===side&&x.status!=='INVALID').at(-1),
 activeFvg=(s.gaps||[]).filter(x=>x.side===side&&x.status!=='FILLED').at(-1);
 const reasons=[],risks=[];
 reasons.push(select(lang,
 s.bias===side?'الهيكل الخارجي متوافق مع الاتجاه المقترح.':'الهيكل الخارجي غير متوافق؛ لا يوجد تأكيد كافٍ.',
 s.bias===side?'Внешняя структура согласована.':'Внешняя структура не подтверждает направление.',
 s.bias===side?'External structure aligns with the proposed side.':'External structure does not align with this side.'));
 if(recent)reasons.push(select(lang,'آخر '+recent.type+' متوافق عند $'+fmt(recent.price)+' بإغلاق شمعة مؤكدة.',
   'Последний '+recent.type+' по направлению на $'+fmt(recent.price)+'.','Most recent aligned '+recent.type+' closed through $'+fmt(recent.price)+'.'));
 if(p){reasons.push(select(lang,'المستوى المحمي '+(bullish?'قاع':'قمة')+' $'+fmt(p.price)+'.',
   'Защищённый уровень $'+fmt(p.price)+'.','Protected '+(bullish?'low':'high')+' at $'+fmt(p.price)+'.'));
 }
 risks.push(select(lang,'الإبطال الهيكلي: إغلاق '+(bullish?'دون ':'فوق ')+(p?'$'+fmt(p.price):'مستوى محمي مؤكد لم يتشكل بعد')+'.',
  'Отмена: закрытие '+(bullish?'ниже ':'выше ')+(p?'$'+fmt(p.price):'защищённого уровня — ещё не сформирован')+'.',
  'Structural invalidation: a candle closes '+(bullish?'below ':'above ')+(p?'$'+fmt(p.price):'a not-yet-established protected level')+'.'));
 if(activeOb)reasons.push(select(lang,'أوردر بلوك صالح $'+fmt(activeOb.lower)+'–$'+fmt(activeOb.upper)+'.',
 'Активный OB $'+fmt(activeOb.lower)+'–$'+fmt(activeOb.upper)+'.','Active OB $'+fmt(activeOb.lower)+'–$'+fmt(activeOb.upper)+'.'));
 if(activeFvg)reasons.push(select(lang,'FVG غير ممتلئة $'+fmt(activeFvg.remainingLower)+'–$'+fmt(activeFvg.remainingUpper)+'.',
  'Незаполненная FVG $'+fmt(activeFvg.remainingLower)+'–$'+fmt(activeFvg.remainingUpper)+'.','Unfilled FVG $'+fmt(activeFvg.remainingLower)+'–$'+fmt(activeFvg.remainingUpper)+'.'));
 if(seq)risks.push(select(lang,'حالة تسلسل SMC: '+seq.phase+'.','Этап SMC: '+seq.phase+'.','SMC sequence phase: '+seq.phase+'.'));
 return{side,aligned:s.bias===side,confirmed:Boolean(p&&p.protection?.quality==='CONFIRMED'),reasons,risks,
  caveat:select(lang,'هذه مبررات فنية مشروطة وليست معرفة بدافع المشاركين أو نسبة نجاح مثبتة.',
   'Это условные технические доводы, а не сведения о намерениях участников или доказанная вероятность.',
   'These are conditional technical observations, not proof of participant intent or calibrated success probabilities.')};
}
window.DeepRiseStructureExplain={version:'18.2',build,describe,outlook};
})();