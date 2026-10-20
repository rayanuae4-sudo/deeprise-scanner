/* Shared pure validations: no live trade is promoted without verifiable fields. */
export const COST_PCT = 0.35;
export const MIN_NET_RR = 2;
export const MIN_NET_TP2 = 2.3;
export const APP_ORIGIN = 'https://rayanuae4-sudo.github.io';

export function pushEndpointAllowed(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return false;
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443')
      && (h === 'fcm.googleapis.com'
        || h === 'updates.push.services.mozilla.com'
        || h === 'web.push.apple.com'
        || h === 'api.push.apple.com'
        || h.endsWith('.push.apple.com')
        || h.endsWith('.push.services.mozilla.com'));
  } catch (_) { return false; }
}
export function validSubscription(s) {
  return !!(s && typeof s === 'object' && pushEndpointAllowed(s.endpoint)
    && typeof s.keys?.p256dh === 'string' && /^[A-Za-z0-9_-]{85,90}$/.test(s.keys.p256dh)
    && typeof s.keys?.auth === 'string' && /^[A-Za-z0-9_-]{20,30}$/.test(s.keys.auth));
}
export function qualityForEntry(event, now = Date.now()) {
  const e = event || {}, side = e.side === 'LONG' ? 1 : e.side === 'SHORT' ? -1 : 0;
  const entry = Number(e.entry), stop = Number(e.stop), tp1 = Number(e.tp1), tp2 = Number(e.tp2);
  const at = new Date(e.closedAt).getTime();
  const invalid = (code) => ({ ok:false, code });
  if (e.type !== 'ENTRY_CONFIRMED') return invalid('NOT_ENTRY_CONFIRMED');
  if (!/^[A-Z0-9]{2,18}USDT$/.test(e.symbol || '') || !side) return invalid('SYMBOL_OR_SIDE');
  if (!['4h','1h'].includes(e.timeframe)) return invalid('TIMEFRAME');
  if (!Number.isFinite(at) || at > now + 60000 || now - at > 15*60000) return invalid('STALE_CLOSE');
  if (e.confirmed4h !== true || e.confirmed1h !== true || e.closedCandle !== true
    || e.structureConfirmed !== true || e.entryZoneReached !== true) return invalid('MISSING_CONFIRMATIONS');
  if (Number(e.confidence) < 74 || Number(e.quoteVolumeUSDT) < 20000000 || Number(e.volumeRatio) < 1.2) return invalid('WEAK_EVIDENCE');
  if (![entry,stop,tp1,tp2].every(x => Number.isFinite(x) && x > 0)) return invalid('LEVELS');
  const riskPct = side * (entry - stop)/entry*100;
  const gross1 = side * (tp1-entry)/entry*100;
  const gross2 = side * (tp2-entry)/entry*100;
  const netTP1 = gross1 - COST_PCT, netTP2 = gross2 - COST_PCT;
  const netRR = netTP2/(riskPct+COST_PCT);
  if (!(riskPct >= .25 && riskPct <= 5.5 && gross1 > 0 && gross2 > gross1)) return invalid('DIRECTION_OR_RISK');
  if (!(gross1 >= 1.3 && gross2 >= 2.8 && netTP2 >= MIN_NET_TP2 && netRR >= MIN_NET_RR)) return invalid('LOW_NET_REWARD');
  return { ok:true, code:'QUALIFIED', metrics:{riskPct, netTP1, netTP2, netRR} };
}
export function qualityForLiquidity(alert, now=Date.now()) {
  const a=alert||{},close=new Date(a.bar_closed_at).getTime();
  if (!/^[A-Z0-9]{2,18}USDT$/.test(a.symbol||'')) return {ok:false,code:'SYMBOL'};
  if (a.type!=='BUY_SIDE_SWEEP_CONFIRMED' && a.type!=='SELL_SIDE_SWEEP_CONFIRMED') return {ok:false,code:'NOT_CONFIRMED'};
  if (a.severity!=='HIGH' || Number(a.trap_score)<85) return {ok:false,code:'WEAK'};
  if (Number(a.quote_volume_usdt)<20000000 || Number(a.volume_ratio)<1.2) return {ok:false,code:'LIQUIDITY_VOLUME'};
  if (!Number.isFinite(close) || close>now+60000 || now-close>20*60000) return {ok:false,code:'STALE'};
  if (!Number.isFinite(Number(a.price)) || Number(a.price)<=0) return {ok:false,code:'PRICE'};
  return {ok:true,code:'WATCH_ONLY',side:a.type==='BUY_SIDE_SWEEP_CONFIRMED'?'SHORT':'LONG'};
}
export function safeAlertLink(symbol, tf='4h') {
  if (!/^[A-Z0-9]{2,18}USDT$/.test(symbol||'')) return './index.html';
  return './chart.html?symbol='+encodeURIComponent(symbol)+'&tf='+(['4h','1h','15m'].includes(tf)?tf:'4h');
}
