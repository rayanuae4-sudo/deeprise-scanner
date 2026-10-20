# DeepRise iPhone background notifications — setup

## Status
DeepRise has foreground notifications, a service worker, a background Web Push receiver and a registration UI. However, GitHub Pages is static and cannot send remote push by itself. The public config in `deeprise-push-config.js` contains empty values. Consequently, remote notifications while the PWA is closed **are not yet active**.

## iPhone user steps
1. Update to iOS 16.4 or later.
2. In Safari open the scanner, Share → Add to Home Screen; launch the installed icon.
3. In the bell / notification center, tap **Test this phone** and accept the permission. This is a local test only.
4. After the backend is configured, tap **Enable phone alerts**.
5. iPhone Settings → Notifications → DeepRise: allow sounds and lock-screen banners. Review Focus modes.
6. Close the PWA and send a real push from the backend to test background delivery.

## Required external service
- Deploy an authenticated HTTPS Web Push sender with VAPID signing, encrypted payloads, durable subscription storage, abuse prevention, allowed origins and revocation.
- Keep the **private VAPID key** and subscription list in server secrets, never in public GitHub code.
- Implement POST subscription API accepting `{ subscription, source:'deeprise-scanner', userAgent:'pwa' }`.
- Implement POST unsubscribe API accepting `{ endpoint }`.
- Fill `publicVapidKey`, `subscribeUrl` and `unsubscribeUrl` in `deeprise-push-config.js`.
- Run server-side scheduled scanner checks and deduplicate alert IDs. Closed iOS PWAs cannot continuously scan markets using browser JavaScript.

## Example encrypted push message plaintext
```json
{
  "title": "DeepRise — SHORT confirmed",
  "body": "WUSDT 4H | Confirmed | Net TP2 3.0% | R:R 2.1",
  "url": "./chart.html?symbol=WUSDT&tf=4h",
  "tag": "WUSDT-4H-entry-confirmed"
}
```

Remote delivery can be delayed by network, Focus, iOS settings and battery. The on-device notification test does not establish background delivery. Avoid sending push alerts for unconfirmed or small-reward trades.