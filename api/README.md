# Boardify API (Cloudflare Workers)

TypeScript Worker in [`src/index.ts`](src/index.ts): **D1** (`DB`), **R2** (`IMAGES`), **Durable Objects** (`BOARD_ROOM` → [`BoardRoom`](src/board-room-do.ts)) for board WebSockets.

---

## Step-by-step: Wrangler & Cloudflare setup

Do these in order from your machine. All shell commands assume **`cd api`** first.

### Step 0 — Prerequisites

1. Install **Node.js 18+**.
2. Install dependencies: `npm install`
3. Log in to Cloudflare: `npx wrangler login`
4. Confirm account: `npx wrangler whoami`

### Step 1 — Create D1 databases

Create **two** databases (dev + production). Names should match [`wrangler.toml`](wrangler.toml) (`boardify-db-dev`, `boardify-db`) or change the TOML to match what you create.

```bash
npx wrangler d1 create boardify-db-dev
npx wrangler d1 create boardify-db
```

Copy each **`database_id`** from the output (or run `npx wrangler d1 list`) into `wrangler.toml`:

- `[[d1_databases]]` and `[[env.production.d1_databases]]` → production `database_id`
- `[[env.dev.d1_databases]]` → dev `database_id`

### Step 2 — Create R2 buckets

```bash
npx wrangler r2 bucket create boardify-images-dev
npx wrangler r2 bucket create boardify-images
```

Bucket names are already wired in `wrangler.toml` (`boardify-images-dev`, `boardify-images`). If you used different names, update the TOML.

### Step 2b — Queues (deadline reminders + daily digest) — production only

Queues are **not** bound for `env.dev` because [`wrangler dev --remote` does not support Queues](https://developers.cloudflare.com/workers/development-testing/) (requests would return **503**). Production (`--env production`) binds `boardify-notifications`, cron triggers, and the queue consumer.

Create the production queue (name must match `wrangler.toml`):

```bash
npx wrangler queues create boardify-notifications
```

The Worker uses **cron triggers** (`*/20 * * * *` scans due dates, `10 14 * * *` UTC enqueues daily digests) and a **queue consumer** on the same script to send Expo push, SMTP email, and `board_audit_log` inbox rows. Optional: set plain var `DIGEST_DRY_RUN=1` on the Worker to log without sending.

To exercise queues locally, use **local** `wrangler dev` (without `--remote`) and local D1/queue bindings, or test against a deployed preview/staging Worker that uses the production-style config.

### Step 3 — Apply the SQL schema

Schema file (repo root): [`../db/d1_schema.sql`](../db/d1_schema.sql). Run **dev first**, then production when ready.

```bash
# Development (remote D1)
npx wrangler d1 execute boardify-db-dev --remote --file=../db/d1_schema.sql

# Production
npx wrangler d1 execute boardify-db --remote --file=../db/d1_schema.sql
```

Sanity check (dev):

```bash
npx wrangler d1 execute boardify-db-dev --remote --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1"
```

**Existing database:** if you applied the schema before `user_expo_push_tokens` existed, add it with:

```sql
CREATE TABLE IF NOT EXISTS user_expo_push_tokens (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

The mobile app registers an Expo token via `POST /user/expo-push-token` when the user enables Account → Notifications. After a successful board Durable Object broadcast (or if the DO is unavailable), the Worker sends pushes via the [Expo Push API](https://docs.expo.dev/push-notifications/sending-notifications/) using tokens from this table and per-board `pushEnabled` in `board_notification_settings`. Optional secret `EXPO_ACCESS_TOKEN` improves rate limits; see [`SECRETS.md`](SECRETS.md).

**AI & scheduled notifications:** apply [`../db/migrations/20260215_ai_notifications.sql`](../db/migrations/20260215_ai_notifications.sql) to D1 (in addition to the main schema) for `notification_dedupe` and `ai_usage_daily`. The Worker exposes **Workers AI** (`[ai]` binding) for `POST /api/boards/:boardId/ai/prioritize`, `.../ai/next-task`, and `POST /api/cards/:cardId/ai/subtasks` (session auth, board membership required).

### Step 4 — Register the Durable Object (first time)

The `[[migrations]]` block defines `BoardRoom`. Apply it by deploying **once** to dev or production:

```bash
npx wrangler deploy --env dev
```

(or `npm run deploy` for production after secrets exist)

### Step 5 — Set secrets

Secrets are **per environment**: `--env dev` for `boardify-api-dev`, `--env production` for `boardify-api`.

```bash
npx wrangler secret put AUTH_SECRET --env dev
npx wrangler secret put AUTH_SECRET --env production
```

Add any others you use (Google/Apple OAuth, SMTP, `WEB_APP_URL`, etc.). See **Secrets reference** below.

Optional local overrides: create **`api/.dev.vars`** (gitignored) with `KEY=value` lines — [Wrangler local dev vars](https://developers.cloudflare.com/workers/testing/local-development/#local-only-environment-variables).

### Step 6 — Run the API locally (remote D1/R2/DO)

```bash
npm run dev
```

This runs **`wrangler dev --env dev --remote`**: Worker on **http://127.0.0.1:8787**, data in **remote** dev D1/R2/DO.

- Health: `GET http://127.0.0.1:8787/health`

Fully **offline** dev (local D1 simulation only):

```bash
npx wrangler dev --env dev
```

### Step 7 — Deploy production

```bash
npm run deploy
```

Same as `wrangler deploy --env production`.

**Logs:**

```bash
npx wrangler tail --env production
npx wrangler tail --env dev
```

---

## Secrets reference (Boardify-only)

Step-by-step obtain + `wrangler secret put` for dev and production: **[`SECRETS.md`](SECRETS.md)**.

| Name | Role |
| ---- | ---- |
| `AUTH_SECRET` | Session signing; also used as `X-Board-Sync-Secret` for Worker → Durable Object board broadcasts |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Web OAuth |
| `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` / `APPLE_BUNDLE_ID` | Sign in with Apple |
| `WEB_APP_URL` | Frontend origin (emails, OAuth `return_to`) |
| `AUTH_URL` | Public API base URL if callbacks must not use the request host |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Transactional email |

**Google / Apple redirect URLs** (register at the provider):

- `http://127.0.0.1:8787/api/auth/callback/google` and `.../apple`
- `https://<your-dev-worker-host>/api/auth/callback/google` (and `/apple`)
- Production API URLs with the same paths

**Apple:** `APPLE_CLIENT_ID` is a **Services ID**, not your iOS bundle ID. Use a separate identifier (e.g. `app.example.boardify.web`). See [Creating a client secret](https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret).

Non-secret CORS: optional `ALLOWED_ORIGINS` in `wrangler.toml` `[vars]` (comma-separated). Built-in origins for Boardify + localhost are in [`src/http.ts`](src/http.ts).

---

## Routes (summary)

- **Auth:** `/api/auth/*` and `/auth/*` — [`src/auth.ts`](src/auth.ts)
- **User:** `/user/profile`, `/user/profile-picture` — [`src/user.ts`](src/user.ts)
- **Images:** `POST /upload/profile-picture`, `GET /api/images/{key}` — [`src/images.ts`](src/images.ts)
- **Boards:** `/boards`, lists, cards, full snapshot, archive, restore, audit, dashboard, notification settings — [`src/boards.ts`](src/boards.ts)

An optional **`/api`** prefix is stripped for routing so `API_BASE` may or may not include `/api`.

**WebSockets:** `GET` `wss://<host>/ws/boards/<boardId>` or `.../api/ws/boards/<boardId>`. Auth: cookie, `?token=`, or `Authorization: Bearer`. See [`src/wsBoard.ts`](src/wsBoard.ts).

---

## Troubleshooting

```bash
npx wrangler whoami
rm -rf .wrangler
npx wrangler types
```

If D1 errors persist, confirm `database_id` values and that `d1 execute … --remote` targeted the correct **database name**.

---

## Reference worker

[`../reference/`](../reference/) shares the same **Wrangler** habits (dev + remote, `d1 execute --remote`). [`../reference/DEV_COMMANDS.md`](../reference/DEV_COMMANDS.md) has extra command examples — use **Boardify** resource names and URLs here.
