# DeepRise 17.3 chart workspace

The chart opens in the scanner-native closed-candle view. Choose **Live TradingView** for the live embedded chart, or **Interactive chart & drawing** for the scanner’s structure analysis. **Expand chart** uses the full viewport on desktop and mobile; Restore, Close or Escape exits it.

The interactive chart has zoom, pinch, pan, older/newer candles and reset controls. Select a drawing tool, then tap its first and second points; a horizontal level takes one point. Available tools: trendline, horizontal level, price rectangle and Fibonacci retracement. Undo removes the latest drawing; Clear removes drawings for the current coin/timeframe. Drawings are stored on this device by coin and timeframe, with bounded storage. Auto tools (BOS/CHoCH, swing labels, protected levels, FVG and Fibonacci variants) remain independently selectable.

Direct shortcuts lead to the scanner, entry radar, ready/near groups, chart tools and sessions. Mobile Radar and Chart navigation uses explicit destinations rather than text searches. The mobile More menu also contains these shortcuts.

The 4H radar checklist mirrors the existing readiness classifier. Fresh data, stage, closed trigger, entry zone, aligned structure, recent event, intact protected swing and anti-chase/invalidation conditions are shown individually. FVG and Fibonacci remain supporting evidence. The 15m/1H scanner lists its separate gate conditions and any failing safety checks. This update does not weaken either entry gate or alter the early accumulation detector.

Sorting defaults to readiness, signal strength and target return. Other modes: signal, TP2 return percentage, reward/risk and liquidity. Readiness groups remain separate in every mode. Return is directional and unleveraged, calculated from the planned entry (zone midpoint on the 4H radar). Missing or wrong-side targets rank last. R:R uses TP2 reward divided by planned entry-to-stop risk. The calibrated signal engine respects the same sorting, without moving cards repeatedly when order is unchanged.

Session clocks use IANA timezones, converted to Asia/Riyadh: Tokyo 09:00–18:00 Asia/Tokyo, London 08:00–17:00 Europe/London, New York 08:00–17:00 America/New_York, weekdays. Local daylight-saving transitions are handled independently. Public holidays are excluded from the model and explicitly disclosed. These are indicative FX sessions; crypto remains 24/7. A separate 09:30 America/New_York reference distinguishes the US equities opening.

References: https://www.babypips.com/tools/forex-market-hours and https://www.nyse.com/markets/hours-calendars .

Validation: workspace regression covers directional returns and invalid targets, stage-preserving sorting, UK/US DST mismatch weeks, weekend/end boundaries, checklist/classifier agreement, chart view bounds, drawing persistence/isolation, responsive SVG geometry, EN/AR/RU, and calibrated-engine sorting stability. Existing signal, pre-move, structure, timing and whale-flow regressions remain required. Browser and physical-device touch QA were unavailable in this environment.
