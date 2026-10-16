# DeepRise on TradingView

DeepRise 18.0 offers two chart modes inside **chart.html**:

- **DeepRise**: Native, chart-first analysis with the scanner's own confirmed BOS/CHoCH, protected levels, FVG, order blocks, Fibonacci and optional technical studies.
- **TradingView**: An embedded TradingView chart for the same selected Binance symbol and initial timeframe. This widget is supplied by TradingView, and it does **not** provide an API for drawing DeepRise's custom scanner results inside its iframe.

## Pine Script companion (manual, independent calculations)

1. Open [TradingView](https://www.tradingview.com/chart/) in your account.
2. Select the same exchange and symbol as your DeepRise analysis, for example `BINANCE:NIGHTUSDT`, and the same timeframe.
3. Open the Pine Editor, create a new indicator and paste the contents of [DeepRise_Structure_Companion.pine](../tradingview/DeepRise_Structure_Companion.pine).
4. Choose **Save** and **Add to chart**.
5. From indicator settings, enable/disable order blocks, FVG, BOS/CHoCH, protected levels, Fibonacci and EMA overlays.

**Important:** The Pine indicator calculates on TradingView's candle data and is **not connected to DeepRise scan results**. It is a partial translation of chart annotations, not the same signal engine. Labels may not match DeepRise one-to-one due to swing confirmation, historical data and exchange differences. Order-block and FVG boxes in this first companion are historical markings; they are not automatically removed on mitigation or invalidation. This file is an integration starting point, not a verified trading signal or a guarantee of profitable trading.

For a single chart with exact DeepRise annotations, use the DeepRise native mode. Fully injecting external scanner data into TradingView's hosted embedded widget is not available; a licensed Advanced Charts integration with a custom datafeed and custom JavaScript studies (subject to licensing) would be a separate engineering project.

## If the TradingView chart stays empty

The embedded widget relies on TradingView's external scripts and iframe being reachable. Use **Retry** on the TradingView tab, or **TradingView.com** to open the selected symbol on the official site. If you're using the installed iPhone PWA, quit and relaunch it so cache revisions are loaded.
