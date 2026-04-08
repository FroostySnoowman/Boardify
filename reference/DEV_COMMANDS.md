# Quick Developer Commands

## Daily Development

```bash
# Start local dev server (uses remote development DB)
npx wrangler dev

# Start dev server with specific config
npx wrangler dev -c wrangler.dev.toml
```

## Database Operations

```bash
# Upload schema to remote dev database
npx wrangler d1 execute mybreakpoint-db-dev --remote --file=../db/d1_schema.sql

# Upload schema to production database
npx wrangler d1 execute mybreakpoint-db --remote --file=../db/d1_schema.sql

# Query dev database
npx wrangler d1 execute mybreakpoint-db-dev --remote --command="SELECT * FROM users LIMIT 5"

# Query production database
npx wrangler d1 execute mybreakpoint-db --remote --command="SELECT * FROM users LIMIT 5"
```

## Secrets Management

Secrets are **per-environment**. `npm run dev` uses `--env dev`, so you must set secrets for **dev** for local development.

```bash
# Set secret for DEV (used when you run: npm run dev)
npx wrangler secret put SESSION_SECRET --env dev
npx wrangler secret put BUG_REPORT_WEBHOOK_URL --env dev
npx wrangler secret put SUGGESTIONS_WEBHOOK_URL --env dev

# Set secret for PRODUCTION (used when you deploy)
npx wrangler secret put SESSION_SECRET --env production
npx wrangler secret put BUG_REPORT_WEBHOOK_URL --env production
npx wrangler secret put SUGGESTIONS_WEBHOOK_URL --env production

# List secrets (doesn't show values)
npx wrangler secret list --env dev
npx wrangler secret list --env production
```

Testing Stripe
```
stripe login
stripe listen --forward-to http://localhost:8787/webhooks/stripe
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env dev
```

## Deployment

Worker names: **production** uses the `api` worker, **development** uses the `api-dev` worker (configured in `wrangler.jsonc` via `name` per env).

```bash
# Deploy to production (deploys to worker: api)
npx wrangler deploy --env production

# View production logs
npx wrangler tail --env production

# View production metrics
npx wrangler pages deployment list
```

## Database Migrations

```bash
# Create backup before migration
npx wrangler d1 export mybreakpoint-db --remote --output=backup_$(date +%Y%m%d).sql

# Apply migration
npx wrangler d1 execute mybreakpoint-db --remote --file=migration.sql

# Verify migration
npx wrangler d1 execute mybreakpoint-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

**Live Activity tokens (apns_environment):** If you added the `apns_environment` column for push-to-start tokens, run once (production DB):

```bash
npx wrangler d1 execute mybreakpoint-db --remote --command="ALTER TABLE live_activity_push_tokens ADD COLUMN apns_environment TEXT DEFAULT 'production'"
```

## Token validation and cleanup (device_tokens, live_activity_push_tokens)

**device_tokens (Expo push):**

- The app registers the Expo push token on every launch via `POST /devices/register`. Stored tokens are used for chat notifications.
- When we send a push via Expo and get **DeviceNotRegistered**, we **delete that token** from `device_tokens` so we don't keep trying. The next time the user opens the app, they re-register and we store a fresh token.

**live_activity_push_tokens (APNs push-to-start):**

- **On register:** The app calls `POST /live-activity-push-token` with `token` and `apns_environment` (`sandbox` for dev/Xcode builds, `production` for TestFlight/App Store). We store both so the cron only sends to tokens that match the server's APNs environment. **BadDeviceToken** happens when a sandbox token (from a dev build) is sent to production APNs (or vice versa); filtering by `apns_environment` fixes this.
- **On every app launch (iOS):** The app subscribes to the push-to-start token listener, then calls `ensurePushToStartTokenRegistered()`. If there's an upcoming match/tournament it starts that Live Activity (token is delivered and registered). If there's no upcoming event, it starts a short-lived temporary Live Activity just to elicit the token, registers it, then stops the activity. So every launch ensures the account has a token (or fixes it).
- **On send (cron):** The cron sends to **all** tokens (sandbox and production). Each token is sent to the APNs endpoint that matches its `apns_environment` (sandbox tokens → api.sandbox.push.apple.com, production tokens → api.push.apple.com). So the production cron (production DB) can deliver to both Xcode/sandbox builds and TestFlight/App Store builds. When APNs returns **BadDeviceToken**, **Unregistered**, or **410 Gone**, we **delete that token** from `live_activity_push_tokens`. The next launch will re-register a fresh token.

So invalid tokens are removed automatically and the app ensures a token exists on every launch.

## Live Activity push-to-start test

Send a **test** Live Activity "start" push to a given token (to verify APNs and payload without waiting for the cron).

**Option A – with session (logged-in user):**  
Use your app session cookie in the request.

**Option B – with test secret (no session):**  
Add to `.dev.vars`: `LIVE_ACTIVITY_TEST_SECRET=your-secret`. Then call with header `X-Test-Secret: your-secret`.

```bash
# With test secret (set LIVE_ACTIVITY_TEST_SECRET in .dev.vars)
curl -X POST http://localhost:8787/live-activity-push-token/test \
  -H "Content-Type: application/json" \
  -H "X-Test-Secret: your-secret" \
  -d '{"token":"YOUR_PUSH_TO_START_TOKEN"}'
```

Response: `{ "ok": true, "status": 200, "apnsEnvironment": "sandbox"|"production" }` on success, or `{ "ok": false, ... }` with APNs error details.

**If APNs returns 200 but no Live Activity appears:**

1. **Sandbox vs production** – The push-to-start token is tied to the app's environment. The app sends **sandbox** when built from Xcode or EAS dev profile, **production** only for EAS production builds (TestFlight/App Store). Xcode may use `.env.production` for API but still uses sandbox APNs (no EAS_BUILD_PROFILE). Dev builds (Xcode / Expo dev client) use **sandbox**. Set in `.dev.vars`: `APNS_PRODUCTION=0` (or `false`) so the test sends to sandbox. For TestFlight/App Store builds use production (`APNS_PRODUCTION=1`). The response includes `apnsEnvironment` so you can confirm which was used.
2. **App in foreground** – Some behavior depends on the app not being in the foreground when the push is sent.
3. **Device** – Push-to-start is only supported on a physical device (iOS 17.2+), not the simulator.

## Live Activity cron (push-to-start at 1hr)

The worker runs a cron every minute to send Live Activity start pushes for **match** and **tournament** calendar events whose start time falls in the next **55–65 minutes (UTC)**. Each (user, event instance) is sent at most once (tracked in `live_activity_sent`).

- **Production tokens:** Set `APNS_PRODUCTION=1` (or `true`) in production secrets so the cron **always sends to production APNs**. Tokens in `live_activity_push_tokens` must be **push-to-start tokens** from a **TestFlight or App Store build** (not from a dev/Xcode run, and not Expo push tokens like `ExponentPushToken[...]`).
- **Calendar events:** Events must be type `match` or `tournament`. Create/edit events from the app so `start_at` (epoch ms) is stored.
- **Token:** The user's push-to-start token must be in `live_activity_push_tokens` (same `user_id` as the event's `user_id`, or the user must be a member of the event's team).

### Discord logging (see if the cron is running)

Set a Discord webhook so **every cron run** posts a summary to a channel. The report now includes **APNs environment** (production vs sandbox) so you can confirm `APNS_PRODUCTION` is correct for the deployment (use `0` for dev/sandbox, `1` for production). If "Tokens found: 0" but you have events, ensure the app has been opened at least once so `ensurePushToStartTokenRegistered()` has run and registered a token.

**Important:** With `wrangler deploy --env production`, the cron trigger must be defined **under the production env**. In `wrangler.toml` that's `[env.production.triggers]` with `crons = ["* * * * *"]`. If you only had top-level `[triggers]`, production had no cron and nothing was sent.

```bash
# Production: set webhook URL (paste your Discord webhook URL when prompted)
npx wrangler secret put LIVE_ACTIVITY_LOG_WEBHOOK --env production
```

Then **redeploy** so the cron (and any config change) is live:

```bash
npx wrangler deploy --env production
```

**Test the webhook without waiting for the cron:** Call the manual cron endpoint; it runs the same logic and posts to Discord:

```bash
curl -X POST "https://YOUR_API_URL/live-activity-push-token/cron" \
  -H "X-Test-Secret: YOUR_LIVE_ACTIVITY_TEST_SECRET"
```

If you see a Discord message from that curl but not every minute, the scheduled cron was not configured for production (fix config and redeploy). If you never see a message even from curl, check that both `LIVE_ACTIVITY_LOG_WEBHOOK` and `LIVE_ACTIVITY_TEST_SECRET` are set in production.

Each message shows: **APNs configured**, **Events in 55–65min window**, **Tokens found**, **Pushes sent**, **Errors**.

### Trigger cron manually (returns report)

Set `LIVE_ACTIVITY_TEST_SECRET` in production so you can trigger the cron and inspect the report:

```bash
# Production: set secret once
npx wrangler secret put LIVE_ACTIVITY_TEST_SECRET --env production
# Enter a secret value when prompted (e.g. a random string).

# Trigger cron once (replace YOUR_API_URL and YOUR_SECRET)
curl -X POST "https://YOUR_API_URL/live-activity-push-token/cron" \
  -H "Content-Type: application/json" \
  -H "X-Test-Secret: YOUR_SECRET"
```

Response shape: `{ "ok": true|false, "apnsConfigured": true|false, "eventsInWindow": N, "tokensFound": N, "pushesSent": N, "errors": [] }`. Use this to confirm: APNs is configured, events are in the 55–65 min window, tokens are found, and any APNs errors.

### Test push (single token, no event)

To verify APNs and your token without an event in the DB:

```bash
# Production (replace YOUR_API_URL, YOUR_SECRET, YOUR_LIVE_ACTIVITY_TOKEN)
curl -X POST "https://YOUR_API_URL/live-activity-push-token/test" \
  -H "Content-Type: application/json" \
  -H "X-Test-Secret: YOUR_SECRET" \
  -d '{"token":"YOUR_LIVE_ACTIVITY_PUSH_TO_START_TOKEN"}'
```

Success: `{ "ok": true, "status": 200, "apnsEnvironment": "production" }`. If `ok` is false, check `apnsReason` / `body` for APNs errors.

### Run scheduled handler locally

```bash
# Fire the scheduled handler once (dev env)
npx wrangler dev --test-scheduled

# With remote DB
npx wrangler dev --env dev --remote --test-scheduled
```

Requires APNS_* secrets and `live_activity_push_tokens` table. Events must be type `match` or `tournament` with `start_at` in the 55–65 minute window from now (UTC).

### Comprehensive test checklist (production)

1. **Set test secret in production** (once):
   ```bash
   npx wrangler secret put LIVE_ACTIVITY_TEST_SECRET --env production
   ```
   Use a strong random value; you'll pass it as `X-Test-Secret` in curl.

2. **Verify test push** (APNs + your token; no event needed):
   ```bash
   curl -X POST "https://YOUR_WORKER_URL/live-activity-push-token/test" \
     -H "Content-Type: application/json" \
     -H "X-Test-Secret: YOUR_SECRET" \
     -d '{"token":"YOUR_LIVE_ACTIVITY_PUSH_TO_START_TOKEN"}'
   ```
   Expect `{ "ok": true, "status": 200, "apnsEnvironment": "production" }`. If `ok` is false, check `apnsReason` / `body` (e.g. BadDeviceToken, wrong sandbox/production).

3. **Trigger cron and inspect report** (events + tokens in DB):
   ```bash
   curl -X POST "https://YOUR_WORKER_URL/live-activity-push-token/cron" \
     -H "X-Test-Secret: YOUR_SECRET"
   ```
   Check: `apnsConfigured`, `eventsInWindow`, `tokensFound`, `pushesSent`, `errors`. If `eventsInWindow` is 0, create a **match** or **tournament** event in the app with start time **55–65 minutes from now** (UTC), then run the cron again. If `tokensFound` is 0, ensure your `user_id` has a row in `live_activity_push_tokens` (the app registers this when you open it on a physical device).

## Troubleshooting

```bash
# Clear local dev cache
rm -rf .wrangler

# Regenerate types
npx wrangler types

# Check configuration
npx wrangler whoami
```

## Notes

- **Workers:** Production commands use the `api` worker; development uses `api-dev`. This is set in `wrangler.jsonc` (`name` under `env.production` and `env.dev`) so `wrangler deploy --env production` and `wrangler secret put ... --env production` target `api`, not `api-production`. (Wrangler prefers `wrangler.jsonc` over `wrangler.toml` when both exist.)
- `npx wrangler dev` automatically uses remote development database (mybreakpoint-db-dev)
- Development secrets are stored in `.dev.vars` (not committed to git)
- Production uses `--env production` flag
- Always test migrations on development database first
