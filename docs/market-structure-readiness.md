# Market structure and trade readiness (V17.2)

The pre-move detector retains its original WATCH / ARMED / IGNITION evidence model and swing / position holding windows. A separate readiness layer groups its results into READY, NEAR, EARLY and BLOCKED. These are analytical classifications; no orders are placed. Existing directional stability and historical performance records are unchanged.

## Readiness rules

- READY: original ARMED or IGNITION, the last closed 4H candle is through the trigger, current scan price is inside the entry zone, confirmed 4H structure agrees, its protected level is intact, and a same-side BOS or CHoCH occurred within the last three closed candles.
- NEAR: ARMED or IGNITION within 0.75 ATR of the trigger, with an explanation of the missing close, retest or structure confirmation.
- EARLY: a forming or distant setup, unavailable/stale structure, or an opposing structural bias. An ARMED detection is not automatically a ready entry.
- BLOCKED: extended price movement, breached invalidation/protected level, or a price more than 0.25 ATR past the far edge of the entry zone.

A scan older than six minutes cannot authorize READY. Structure older than six minutes, or a closed candle older than 1.1 timeframe intervals, is unavailable for readiness. The scanner refreshes on its existing three-minute schedule; displayed prices are scan snapshots, not execution quotes. A fresh ticker request supplies each scan's prices. Failed symbols disappear from the current scan rather than keeping an old ready entry.

Within a group, aligned structure, an intact protected level, proximity to an active same-direction FVG and proximity to the matching Fib 0.618–0.786 region contribute to a separate 0–4 confluence count, then the original evidence score ranks ties. A missing FVG or Fibonacci overlap alone does not cancel an otherwise confirmed structural entry. Neither count is a success probability.

## Structure conventions

- Only closed candles are consumed, with a 1.2-second close buffer.
- A swing uses three candles on each side. It becomes known only after the third subsequent candle closes. Labels include the confirmation timestamp; historical break events are not backdated to the pivot candle.
- HH / LH classify successive confirmed highs; HL / LL classify successive confirmed lows. Equal levels have EQH / EQL labels.
- BOS is a close beyond an unbroken confirmed swing in the current bias. The first directional break initializes the bias and is marked BOS with `initial: true`.
- A bullish structural break protects the preceding confirmed swing low; bearish structure protects the preceding confirmed high. CHoCH requires a close through that protected level against the established bias. A wick alone is a liquidity sweep, not CHoCH.
- FVG uses the three-candle wick gap: third low above first high for bullish gaps; third high below first low for bearish gaps. Gaps smaller than 0.05 ATR are filtered. Later wicks reduce the remaining unfilled region; completely filled gaps no longer appear as active zones. An FVG is not an order-book observation or a guarantee of a future fill.

## Fibonacci and chart

The native candle chart sits below the embedded TradingView chart and offers 15m, 1h, 4h and 1d views. Its timeframe is independent of readiness, which always uses 4H. Loading another symbol or timeframe clears the old result; an older request cannot overwrite a later selection.

Retracements use confirmed directional anchors A → B, with 0 at B and 1 at A: 0, 0.236, 0.382, 0.5, 0.618, 0.786 and 1. The 0.5 equilibrium divides the range and 0.618–0.786 is shaded. Two-point extensions continue the same leg at 1.272, 1.618, 2 and 2.618. Three-point extensions require a confirmed retracement C inside A–B and use C + (B − A) × ratio; they remain unavailable until C exists. Optional fan rays and time-zone ratios are geometric references, not price or activation forecasts.

Ten independent layer controls cover structure breaks, swings, protected levels, active FVGs, retracements, two-point extensions, three-point extensions, sweeps, time zones and the Fibonacci fan. Tool names and explanatory controls support English, Arabic and Russian. Times in the native chart are displayed in UTC+3.

The TradingView iframe does not expose its drawing API to this application; calculated overlays are drawn on the native chart, not injected into the iframe. Forming extrema are not presented as confirmed swings. This release has deterministic and regression validation, not a measured predictive win rate.

## Validation

Run `node scripts/deeprise-structure-regression.js` for protected structure, wick-only sweeps, causal closed-candle events, FVG mitigation, directional Fibonacci and readiness safeguards. Existing entry, timing, whale flow, ARB pre-move and signal-stability regressions remain in both CI gates. The production index generator and service-worker asset list include both V17.2 modules.

Method references: [TradingView repainting and pivot confirmation](https://www.tradingview.com/pine-script-docs/concepts/repainting/), [Fibonacci retracement](https://www.tradingview.com/support/solutions/43000518158-fibonacci-retracement-drawing-tool/), [trend-based Fibonacci extension](https://www.tradingview.com/support/solutions/43000518137-trend-based-fib-extension-drawing-tool/).
