# DeepRise iPhone notifications when the app is closed

## Current readiness
The scanner is a static GitHub Pages PWA. Its existing in-page bell and JavaScript timers cannot send notifications while the app is terminated. This update adds standard Web Push listeners and an opt-in subscription UI. Delivery is disabled until a trusted push sender is connected.

## Steps to enable remote delivery
1. Open the site in Safari on iOS 16.4 or later, then Share → Add to Home Screen, and launch the installed icon.
2. Run a trusted Web Push backend with VAPID public/private keys and secure subscription persistence. Private credentials must NEVER be placed in GitHub Pages JavaScript.
3. In deeprise-push-config.js set publicVapidKey (base64url public key) and the HTTPS subscribeUrl / unsubscribeUrl endpoints.
4. Subscribe endpoint: authenticated HTTPS POST accepts a JSON object with subscription (PushSubscription.toJSON), source, userAgent. Persist the browser push endpoint and keys securely per user/device and respond 2xx only on success. Enable CORS for https://rayanuae4-sudo.github.io.
5. Unsubscribe endpoint: authenticated HTTPS POST accepts JSON with endpoint and deletes that device subscription. Return 2xx only on success.
6. Run a server-side scan on closed candles and deliver Web Push when confirmed opportunities arise. Validate direction, 4H and 1H confirmation, cost-adjusted TP/SL, freshness; deduplicate alerts and limit frequency. Do not send alerts from timers inside the app.
7. Web Push JSON payload fields: title, body, url, tag. URL must be an own-site path, e.g. ./chart.html?symbol=WUSDT&tf=4h. The service worker confines links to the site's own scope.
8. From the installed PWA open the bell → Enable phone alerts → Allow. In iPhone Settings → Notifications → DeepRise enable Sounds and Lock Screen. Focus modes may silence or delay notifications.

## Testing
- Verify delivery with the phone locked and the PWA closed, not merely via an in-page Notification test.
- Verify unsubscribe / resubscribe, denied permission, malformed push data, multiple devices, expired subscriptions (404/410), stale signals and duplicate suppression.
- Web Push permissions do not guarantee prompt delivery when the device is offline or the OS is restricting delivery.

## Deployment caveat
GitHub Pages alone cannot safely persist subscriptions or operate an authenticated VAPID sender. The enrolment button stays disabled until endpoints and a public VAPID key have been configured.