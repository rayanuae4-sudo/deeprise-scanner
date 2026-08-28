# DeepRise Security Policy

DeepRise treats forecast integrity, API credentials, analytics access, and future account/billing data as security-sensitive.

## Supported deployment

The supported public deployment is the current `main` branch published through GitHub Pages after repository validation workflows pass.

## Reporting a vulnerability

Please do not disclose exploitable vulnerabilities, credentials, private API keys, authentication bypasses, or unpublished security details in a public issue.

Report security findings privately to the repository owner through GitHub's private vulnerability reporting/security advisory channel when available.

Include:

- affected file or component;
- reproduction steps;
- expected and observed behavior;
- security impact;
- a minimal proof of concept when needed.

## Secrets policy

Never commit private credentials to this repository. In particular, do not commit:

- exchange trading API secrets;
- Stripe secret/restricted keys;
- GitHub personal access tokens;
- PostHog personal/admin API keys;
- Nansen, CoinGlass, or other paid-provider private keys;
- database service-role keys;
- OAuth client secrets;
- private keys or signing keys.

Public browser ingestion keys may exist only when the provider explicitly documents them as safe for client-side use. All privileged credentials must remain in GitHub Actions Secrets or a server-side secret manager.

## Forecast integrity

`forecast-ledger.json` is an audit artifact. Historical losing, stopped, expired, or unsuccessful forecasts must not be removed to improve displayed performance. Proof commits must reference commits that already contain the corresponding recorded lifecycle state.

## Production account security

Before accounts or paid subscriptions are enabled, DeepRise must use server-side authorization and must not trust `localStorage`, browser flags, or client-side JavaScript as proof of paid entitlement.
