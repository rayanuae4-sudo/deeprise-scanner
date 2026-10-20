-- Execute against the bound D1 database before first deployment.
CREATE TABLE IF NOT EXISTS subscriptions (
 endpoint TEXT PRIMARY KEY NOT NULL,
 p256dh TEXT NOT NULL,
 auth TEXT NOT NULL,
 token_hash TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 last_test_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS subscriptions_created_idx ON subscriptions(created_at);
CREATE TABLE IF NOT EXISTS pairing_codes (
 code_hash TEXT PRIMARY KEY NOT NULL,
 expires_at INTEGER NOT NULL,
 used_at INTEGER
);
CREATE INDEX IF NOT EXISTS pairing_codes_expires_idx ON pairing_codes(expires_at);
CREATE TABLE IF NOT EXISTS sent_events (
 event_id TEXT PRIMARY KEY NOT NULL,
 category TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sent_events_created_idx ON sent_events(created_at);
