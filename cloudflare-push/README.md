# DeepRise Cloudflare Push — setup and deployment

Status: source is prepared, NOT deployed. Cloudflare account authorization, D1, a VAPID keypair and real worker URL must be configured before alerts can arrive while iOS app is closed.

## Deploy on your Cloudflare account

1. Install Node.js 22+ and run from the cloudflare-push folder: npm install
2. Sign in using npx wrangler login.
3. Create D1: npx wrangler d1 create deeprise-push
4. Copy the returned database_id into wrangler.toml in place of REPLACE_WITH_D1_DATABASE_ID.
5. Initialize storage: npx wrangler d1 execute deeprise-push --remote --file=./schema.sql
6. Generate VAPID keys locally: npx --yes web-push generate-vapid-keys
7. Put ONLY the generated public VAPID key in wrangler.toml under VAPID_PUBLIC_KEY.
8. Put the private VAPID key using: npx wrangler secret put VAPID_PRIVATE_KEY
9. Generate two independent random 32+-character credentials locally (openssl rand -hex 32):
   npx wrangler secret put ADMIN_TOKEN
   npx wrangler secret put PRODUCER_TOKEN
   Keep both outside Github and do not paste secrets into this chat.
10. Deploy: npx wrangler deploy
11. Use the exact workers.dev HTTPS URL returned by the CLI. Verify WORKER_URL/health says configured:true.

## Connect the iPhone app

After the worker is deployed, update the PUBLIC file deeprise-push-config.js in the scanner repository:
- publicVapidKey = your generated PUBLIC key
- subscribeUrl = WORKER_URL/v1/subscribe
- unsubscribeUrl = WORKER_URL/v1/unsubscribe

Open DeepRise in Safari on iOS 16.4+, choose Share > Add to Home Screen, open from the home screen icon, and tap the bell. The local notification test checks permission only.

## Pair a phone (mandatory to prevent outsiders registering)

Create a one-time 15-minute pairing code with an admin-authenticated HTTP request:
    curl -X POST "$WORKER_URL/v1/pairing" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{}'

Do not publish ADMIN_TOKEN. Enter the 12-character code into the bell panel's pairing-code field and tap Enable phone alerts. Allow the browser permission. Tap Test from Cloudflare for a real remote service-sent Web Push. Lock the screen or close DeepRise and send another real test to verify background delivery.

Each device has a local random ownership token and can unsubscribe. Tests are limited to once per minute; a pairing code can be used only once.

## Alerts with the app closed

A Cloudflare Cron Trigger runs every 5 minutes to read DeepRise's public market-alerts.json. It notifies only for fresh, HIGH severity confirmed liquidity sweeps with evidence >=85, volume >=1.2x, volume >=$20M, and a newly closed candle <=20 minutes. These messages explicitly say WATCH ONLY, not confirmed trading entry. Stale GitHub publisher files cause no alerts.

For genuine confirmed entry notifications the trusted external publisher must call POST /v1/alerts with Bearer PRODUCER_TOKEN, a unique eventId, type ENTRY_CONFIRMED, LONG/SHORT direction, timeframe 4h/1h, closedAt within 15 minutes, closedCandle true, confirmed4h and confirmed1h true, structureConfirmed and entryZoneReached true, confidence >=74, quoteVolumeUSDT >=20m, volumeRatio >=1.2, actual entry, stop, tp1 and tp2. The Worker verifies profitable directional levels, minimum gross TP1 of 1.3%, gross TP2 of 2.8%, estimated 0.35% roundtrip friction, net TP2 >=2.3%, and net R:R >=2. These fields are supplied by the trusted publisher, not independently fetched/validated by the Worker. No automatic browser page signals are relayed while iOS is closed.

The current in-browser DeepRise recommendations and Daily Top 5 are NOT YET automatically delivered as remote background push; completing that requires linking an authenticated, server-side verified signal producer.

## Testing and security

Run npm test and npm run check in cloudflare-push. GitHub CI also checks Worker bundling. This does not replace real device testing.

VAPID private keys, pairing admin tokens, producer keys and subscription endpoints are sensitive: never commit or share them. CORS is restricted to https://rayanuae4-sudo.github.io, pairing codes are hashed, remote destinations are allowlisted to Apple/Google/Mozilla push hosts, stale events are rejected and duplicate notifications suppressed. D1 stores subscriptions; treat their retention/deletion as part of your privacy policy.

Web Push requires user consent on installed iOS 16.4+ PWAs; Focus, network outages and system limits can delay delivery. GitHub Pages alone cannot send background push.
