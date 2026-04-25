# IAP Setup (Boardify AI)

This is the exact setup for the current codebase (`app` + `api`) to support:
- iOS subscriptions (App Store)
- Android subscriptions (Google Play)
- Web subscriptions (Stripe)

Product in app:
- **Monthly AI plan**: `$1.99/month`
- Product ID used in app/api: `app.mybreakpoint.boardify.ai.monthly`

---

## 1) App Store Connect (iOS)

1. Open [App Store Connect](https://appstoreconnect.apple.com/) -> your app (`app.mybreakpoint.boardify`).
2. Go to **Subscriptions** (or In-App Purchases -> Subscriptions).
3. Create a subscription group (ex: `Boardify AI`).
4. Create subscription product:
   - Product ID: `app.mybreakpoint.boardify.ai.monthly`
   - Price: `$1.99`
   - Duration: `1 month`
5. Fill required metadata (display name/description/localization/screenshot if required).
6. Make sure the subscription is approved/ready for sale.
7. Create App Store shared secret:
   - App -> **App Information** or **In-App Purchases** -> **App-Specific Shared Secret**
8. Copy that secret for API env var `APPLE_IAP_SHARED_SECRET`.

---

## 2) Google Play Console (Android)

1. Open [Google Play Console](https://play.google.com/console/) -> your app (`app.mybreakpoint.boardify`).
2. Go to **Monetize** -> **Products** -> **Subscriptions**.
3. Create subscription:
   - Product ID: `app.mybreakpoint.boardify.ai.monthly`
   - Billing period: `Monthly`
   - Price: `$1.99`
4. Activate/publish the subscription.
5. Create a Google Cloud service account with Android Publisher access:
   - Enable **Google Play Android Developer API**
   - Create service account key (JSON)
6. In Play Console -> API access, grant that service account access to the app.
7. From the JSON key, set API env vars:
   - `GOOGLE_PLAY_CLIENT_EMAIL`
   - `GOOGLE_PLAY_PRIVATE_KEY` (full private key, including BEGIN/END lines)
8. Set package name env var:
   - `GOOGLE_PLAY_PACKAGE_NAME=app.mybreakpoint.boardify`

---

## 3) Stripe (Web)

1. Open [Stripe Dashboard](https://dashboard.stripe.com/).
2. Create a **recurring monthly price** for Boardify AI:
   - Amount: `1.99`
   - Interval: `month`
3. Copy that Price ID (looks like `price_...`).
4. Set API env var:
   - `STRIPE_PREMIUM_PRICE_ID=<your price id>`
5. Copy your Stripe secret key:
   - `STRIPE_SECRET_KEY=<sk_...>`
6. Add webhook endpoint in Stripe:
   - URL: `https://<your-api-domain>/webhooks/stripe`
   - Events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
7. Copy webhook signing secret:
   - `STRIPE_WEBHOOK_SECRET=<whsec_...>`

---

## 4) API Environment Variables (required)

Set these in your Cloudflare Worker (`api` service):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PREMIUM_PRICE_ID`
- `APPLE_IAP_SHARED_SECRET`
- `GOOGLE_PLAY_CLIENT_EMAIL`
- `GOOGLE_PLAY_PRIVATE_KEY`
- `GOOGLE_PLAY_PACKAGE_NAME` (recommended: `app.mybreakpoint.boardify`)

Optional (recommended):
- `WEB_APP_URL` (used for Stripe checkout return URLs)

---

## 5) Deploy + Quick Test

1. Deploy API with new vars.
2. iOS test:
   - Use Sandbox Apple account.
   - Open AI feature -> paywall -> purchase.
   - Confirm AI endpoints stop returning 403.
3. Android test:
   - Use tester account in Play internal track.
   - Purchase subscription and verify AI access.
4. Web test:
   - Start checkout from paywall.
   - Complete Stripe checkout.
   - Confirm Stripe webhook fires and AI access unlocks.

If AI calls still fail, check API response:
- `403 Premium subscription required.` means entitlement did not sync yet.

---

## 6) D1 schema (subscriptions)

Subscription billing is part of the main schema: [`db/d1_schema.sql`](db/d1_schema.sql) (`subscriptions` table + indexes; `users.stripe_customer_id`; `users.subscription_status`). Apply the full file (idempotent):

```bash
cd api
npx wrangler d1 execute boardify-db-dev --remote --file=../db/d1_schema.sql
```

On first subscription API use, the Worker can also create missing `subscriptions` / `stripe_customer_id` for legacy databases (`ensureSubscriptionsSchema` in `api/src/subscriptions.ts`).