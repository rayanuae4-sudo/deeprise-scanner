import test from 'node:test';
import assert from 'node:assert/strict';
import {pushEndpointAllowed,validSubscription,qualityForEntry,qualityForLiquidity,safeAlertLink} from '../src/core.js';
const now=Date.UTC(2026,9,20,18,0,0);
const entry={eventId:'W-123',type:'ENTRY_CONFIRMED',symbol:'WUSDT',side:'SHORT',timeframe:'4h',
 closedAt:new Date(now-60000).toISOString(),closedCandle:true,confirmed4h:true,confirmed1h:true,structureConfirmed:true,entryZoneReached:true,
 confidence:85,quoteVolumeUSDT:50000000,volumeRatio:1.6,entry:100,stop:102,tp1:98,tp2:94};
test('strict entry accepts directional, net profitable setup',()=>{const q=qualityForEntry(entry,now);assert.equal(q.ok,true);assert(q.metrics.netRR>=2)});
test('short-direction and tiny profit are rejected',()=>{
 assert.equal(qualityForEntry({...entry,stop:99},now).ok,false);
 assert.equal(qualityForEntry({...entry,tp1:99.6,tp2:98.9},now).code,'LOW_NET_REWARD');
});
test('no stale, incomplete or contradictory signals',()=>{
 assert.equal(qualityForEntry({...entry,closedAt:new Date(now-50*60000).toISOString()},now).code,'STALE_CLOSE');
 assert.equal(qualityForEntry({...entry,confirmed1h:false},now).code,'MISSING_CONFIRMATIONS');
 assert.equal(qualityForEntry({...entry,entryZoneReached:false},now).code,'MISSING_CONFIRMATIONS');
 assert.equal(qualityForEntry({...entry,quoteVolumeUSDT:10000},now).code,'WEAK_EVIDENCE');
});
test('reject attacker-controlled or private push endpoints',()=>{
 for(const x of ['http://127.0.0.1/', 'https://localhost/', 'https://evil.com/', 'https://fcm.googleapis.com.evil.com/x'])assert.equal(pushEndpointAllowed(x),false);
 assert.equal(pushEndpointAllowed('https://web.push.apple.com/a'),true);
 assert.equal(pushEndpointAllowed('https://fcm.googleapis.com/fcm/send/abc'),true);
 assert.equal(validSubscription({endpoint:'https://evil.com/',keys:{p256dh:'x'.repeat(87),auth:'x'.repeat(22)}}),false);
});
test('liquidity watch must be high confidence, fresh and cannot become an entry signal',()=>{
 const x={symbol:'WUSDT',type:'BUY_SIDE_SWEEP_CONFIRMED',severity:'HIGH',trap_score:91,bar_closed_at:new Date(now-60000).toISOString(),volume_ratio:1.5,quote_volume_usdt:4e7,price:.015};
 assert.equal(qualityForLiquidity(x,now).code,'WATCH_ONLY');
 assert.equal(qualityForLiquidity({...x,bar_closed_at:new Date(now-40*60000).toISOString()},now).ok,false);
 assert.equal(qualityForLiquidity({...x,type:'UPWARD_LIQUIDITY_SWEEP_RISK'},now).ok,false);
 assert.equal(qualityForEntry(x,now).ok,false);
});
test('symbol is escaped and timeframe allowlisted',()=>assert.equal(safeAlertLink('WUSDT','hacked'),'./chart.html?symbol=WUSDT&tf=4h'));
