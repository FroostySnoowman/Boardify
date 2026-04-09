# Boardify API — secrets setup

This file is a **step-by-step** guide to **obtaining** each credential and **installing** it with Wrangler for **development** and **production**.

- **Development Worker** (`npm run dev`): `boardify-api-dev` → use **`--env dev`**.
- **Production Worker** (`npm run deploy`): `boardify-api` → use **`--env production`**.

You can paste the **same** value when prompted for dev and production, or use **different** values (recommended for `AUTH_SECRET`, and often for `AUTH_URL` / `WEB_APP_URL`).

Run all commands from the **`api/`** directory (`cd api`).

**Important:** After you set a secret, Cloudflare **does not show it again**. Keep a copy in a **password manager**. Do **not** commit secrets into git (use this doc only for procedures, not real values).

---

## Quick reference: Wrangler commands

Every secret is set **twice** (once per environment) unless you only deploy one environment:

```bash
# Development
npx wrangler secret put <SECRET_NAME> --env dev

# Production
npx wrangler secret put <SECRET_NAME> --env production
```

Wrangler will **prompt** for the value (paste, then Enter). Nothing is echoed.

List names (not values) already configured:

```bash
npx wrangler secret list --env dev
npx wrangler secret list --env production
```

**Optional — local file only:** [`api/.dev.vars`](https://developers.cloudflare.com/workers/testing/local-development/#local-only-environment-variables) can override secrets for `wrangler dev`. It is gitignored. Do not put production-only values there if the file might leak.

---

## 1. `AUTH_SECRET`

**What it’s for:** Signing sessions. The same value is used internally for **Worker → Durable Object** board sync (`X-Board-Sync-Secret`). If it is missing, sessions and board broadcasts will not work as intended.

**How to obtain it**

1. Generate a long random string (at least 32 bytes of randomness), for example:

   ```bash
   openssl rand -hex 32
   ```

2. Use **different** random values for dev vs production if you want isolation; or **one** value for both if you accept coupling (not ideal for security rotation).

**Install**

```bash
npx wrangler secret put AUTH_SECRET --env dev
npx wrangler secret put AUTH_SECRET --env production
```

---

## 2. `WEB_APP_URL`

**What it’s for:** Canonical **frontend** origin (no trailing slash), e.g. `https://boardify.mybreakpoint.app`. Used in emails (verification, password reset, delete account) and to validate OAuth `return_to` / deep links.

**How to obtain it**

1. Decide the URL users see in the browser for your Boardify web/app shell.
2. Examples:
   - Local / tunnel: `https://your-ngrok-url.ngrok.io` (only if you really send email against it).
   - Staging: `https://staging.boardify.example`.
   - Production: `https://boardify.mybreakpoint.app`.

**Install**

```bash
npx wrangler secret put WEB_APP_URL --env dev
npx wrangler secret put WEB_APP_URL --env production
```

Paste the full origin, **no** trailing `/`.

**Alternative:** You can put this in `wrangler.toml` under `[vars]` / `[env.dev.vars]` / `[env.production.vars]` instead of a secret if you are fine with it being visible in config and the dashboard. Secrets are better if you treat the URL as sensitive or change it often.

---

## 3. `AUTH_URL`

**What it’s for:** Public **API** base URL (no trailing slash). OAuth redirect URIs are built as `{AUTH_URL}/api/auth/callback/google` (and `/apple`). Set this when the Worker’s public URL is not obvious from the incoming request (custom domain, split API vs app domain).

**How to obtain it**

1. **Dev:** After `npx wrangler deploy --env dev` (or from the dashboard), copy the worker URL, e.g. `https://boardify-api-dev.<subdomain>.workers.dev`.
2. **Production:** Your custom API domain or `https://boardify-api.<subdomain>.workers.dev`.
3. For **local-only** `wrangler dev` without a tunnel, you often **omit** `AUTH_URL` and the code uses the request origin (e.g. `http://127.0.0.1:8787`). For **Google/Apple** console registration you still add `http://127.0.0.1:8787/api/auth/callback/...`.

**Install**

```bash
npx wrangler secret put AUTH_URL --env dev
npx wrangler secret put AUTH_URL --env production
```

You may use the **same** URL only if dev and prod are never both used with real OAuth in the same Google/Apple client; usually **dev** and **prod** differ.

---

## 4. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

**What they’re for:** Google OAuth (web redirect flow and token exchange).

**How to obtain them**

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Select or create a **project**.
3. **APIs & Services** → **OAuth consent screen** — configure app name, support email, scopes if prompted.
4. **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**.
5. Application type: **Web application**.
6. Under **Authorized redirect URIs**, add **every** URL you will use (examples — replace hosts with yours):
   - `http://127.0.0.1:8787/api/auth/callback/google`
   - `https://<your-dev-worker-host>/api/auth/callback/google`
   - `https://<your-production-api-host>/api/auth/callback/google`
7. Create → copy **Client ID** and **Client secret**.

**Install**

```bash
npx wrangler secret put GOOGLE_CLIENT_ID --env dev
npx wrangler secret put GOOGLE_CLIENT_ID --env production

npx wrangler secret put GOOGLE_CLIENT_SECRET --env dev
npx wrangler secret put GOOGLE_CLIENT_SECRET --env production
```

You can use **one** OAuth client for both environments **only if** all dev and prod redirect URIs are listed on that client. Otherwise create two clients (dev + prod) and use different IDs/secrets per `--env`.

---

## 5. `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `APPLE_BUNDLE_ID`

**What they’re for:** Sign in with Apple (web + native). `APPLE_CLIENT_ID` is your **Services ID** (web), **not** the iOS bundle ID. `APPLE_BUNDLE_ID` is the **iOS / Expo bundle identifier** (e.g. `app.mybreakpoint.boardify`). `APPLE_CLIENT_SECRET` is a **JWT** you generate and periodically rotate (Apple documents a max lifetime around six months).

**How to obtain them**

1. Go to [Apple Developer](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles**.
2. **Identifiers** → **App IDs** — ensure your app has **Sign In with Apple** enabled (this matches `APPLE_BUNDLE_ID`).
3. **Identifiers** → **Services IDs** — create one for web (e.g. `app.mybreakpoint.boardify.web`). Enable **Sign In with Apple**, configure **Web** domain and **Return URLs**:
   - Same callback paths as Google but ending in `/api/auth/callback/apple`, e.g.  
     `http://127.0.0.1:8787/api/auth/callback/apple`  
     and your deployed API URLs.
4. **Keys** — create a key with **Sign In with Apple**, download the **`.p8`** once. Note **Key ID** and **Team ID**.
5. Build **`APPLE_CLIENT_SECRET`** as an ES256 JWT with claims documented by Apple:
   - [Creating a client secret](https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret)
   - [Configuring Sign in with Apple](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple)  
   Many teams use a small script or one-off tool to print the JWT string.

**Install**

```bash
npx wrangler secret put APPLE_CLIENT_ID --env dev
npx wrangler secret put APPLE_CLIENT_ID --env production

npx wrangler secret put APPLE_CLIENT_SECRET --env dev
npx wrangler secret put APPLE_CLIENT_SECRET --env production

npx wrangler secret put APPLE_BUNDLE_ID --env dev
npx wrangler secret put APPLE_BUNDLE_ID --env production
```

`APPLE_BUNDLE_ID` is often the **same** string in dev and prod (same app). `APPLE_CLIENT_SECRET` must be **regenerated** before expiry and re-set with `secret put`.

---

## 6. `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

**What they’re for:** Sending transactional email (verification, password reset, delete confirmation) via TCP SMTP from the Worker ([`cloudflare:sockets`](https://developers.cloudflare.com/workers/runtime-apis/tcp/)).

**How to obtain them**

1. Pick a provider ([Resend](https://resend.com/docs/send-with-smtp), SendGrid, Mailgun, Amazon SES, etc.).
2. Create SMTP credentials in that provider’s dashboard.
3. Note **host**, **port** (often **587** or **465** with TLS), **username**, **password** (or API key where the provider uses it as SMTP password).

**Install**

```bash
npx wrangler secret put SMTP_HOST --env dev
npx wrangler secret put SMTP_HOST --env production

npx wrangler secret put SMTP_PORT --env dev
npx wrangler secret put SMTP_PORT --env production

npx wrangler secret put SMTP_USER --env dev
npx wrangler secret put SMTP_USER --env production

npx wrangler secret put SMTP_PASS --env dev
npx wrangler secret put SMTP_PASS --env production
```

For `SMTP_PORT`, paste the numeric string only, e.g. `587`.

Using the **same** mailbox for dev and prod is fine; using **separate** credentials helps avoid test traffic in production reputation.

---

## 7. Optional: `EXPO_ACCESS_TOKEN`

**What it’s for:** Authenticated calls to the [Expo Push API](https://docs.expo.dev/push-notifications/sending-notifications/) from the Worker (`boardExpoPush.ts`). Pushes still work **without** this secret for typical volume; Expo recommends an access token for higher throughput and reliability.

**How to obtain it**

1. Sign in at [expo.dev](https://expo.dev).
2. Open **Account settings → Access tokens** (or your org’s token page).
3. Create a token with a descriptive name (e.g. `boardify-worker-push`).

**Install**

```bash
npx wrangler secret put EXPO_ACCESS_TOKEN --env dev
npx wrangler secret put EXPO_ACCESS_TOKEN --env production
```

---

## 8. Optional: `ALLOWED_ORIGINS` (not a secret)

**What it’s for:** Extra **CORS** origins beyond the defaults in [`src/http.ts`](src/http.ts).

**How to obtain it:** Comma-separated list of full origins, e.g. `https://custom.example,https://another.example`.

**Install:** Prefer **`wrangler.toml`** `[vars]` (or env-specific `vars`), not `secret put`, unless you have a reason to hide the list:

```toml
[vars]
ALLOWED_ORIGINS = "https://one.example,https://two.example"
```

---

## Suggested order (first-time setup)

1. `AUTH_SECRET` (dev + prod)  
2. `WEB_APP_URL` (dev + prod)  
3. `AUTH_URL` (dev + prod) — after you know worker URLs  
4. Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`  
5. Apple: `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `APPLE_BUNDLE_ID`  
6. SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`  
7. Optional: `EXPO_ACCESS_TOKEN` (Expo push from the Worker)

Then deploy and re-check OAuth redirect URIs match the live URLs.

---

## Same secrets for dev and production

If you want **one** value everywhere:

1. Obtain the value once (e.g. one `openssl rand -hex 32` for `AUTH_SECRET`).
2. Run `npx wrangler secret put NAME --env dev`, paste the value.
3. Run `npx wrangler secret put NAME --env production`, paste the **same** value.

Repeat for each name. Downsides: rotating production also affects dev; OAuth clients must allow **all** callback URLs on the same client if you share Google/Apple IDs.

---

## Related docs

- Main setup: [`README.md`](README.md)  
- Wrangler secrets: [Secrets · Cloudflare Workers](https://developers.cloudflare.com/workers/configuration/secrets/)
