import type { Env } from './bindings';
import { getCurrentUserFromSession } from './auth';
import { jsonResponse } from './http';
import { subscriptionRowToApiStatus, syncUserSubscriptionStatus } from './subscription-status';

const PREMIUM_MONTHLY_PRODUCT_ID = 'app.mybreakpoint.boardify.ai.monthly';
type AppleSubscriptionEnvironment = 'Sandbox' | 'Production';

let ensureSchemaPromise: Promise<void> | null = null;

async function ensureSubscriptionsSchema(env: Env): Promise<void> {
  if (ensureSchemaPromise) return ensureSchemaPromise;
  ensureSchemaPromise = (async () => {
    const usersInfo = await env.DB.prepare(`PRAGMA table_info(users)`).all<any>();
    const hasStripeCustomer = (usersInfo.results || []).some((col: any) => col?.name === 'stripe_customer_id');
    if (!hasStripeCustomer) {
      await env.DB.prepare(`ALTER TABLE users ADD COLUMN stripe_customer_id TEXT`).run();
    }

    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'stripe')),
        product_id TEXT,
        status TEXT NOT NULL CHECK (status IN ('active', 'grace_period', 'expired')),
        original_transaction_id TEXT,
        google_purchase_token TEXT,
        stripe_subscription_id TEXT,
        current_period_start TEXT,
        current_period_end TEXT,
        cancelled_at TEXT,
        apple_environment TEXT CHECK (apple_environment IN ('Sandbox', 'Production')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    ).run();

    await env.DB.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_original_tx ON subscriptions(original_transaction_id)'
    ).run();
    await env.DB.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_google_token ON subscriptions(google_purchase_token)'
    ).run();
    await env.DB.prepare(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id)'
    ).run();
    await env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status)'
    ).run();
  })().catch((error) => {
    ensureSchemaPromise = null;
    throw error;
  });
  return ensureSchemaPromise;
}

function getWebAppUrl(request: Request, env: Env): string {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const parsed = new URL(origin);
      const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      if (isLocalhost && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
        return `${parsed.protocol}//${parsed.host}`;
      }
    } catch {
      // ignore malformed Origin header
    }
  }

  if (env.WEB_APP_URL) return env.WEB_APP_URL.replace(/\/$/, '');
  const url = new URL(request.url);
  return url.origin.replace('api.', '');
}

function isJwsToken(value: string): boolean {
  const parts = value.split('.');
  return parts.length === 3 && value.startsWith('ey');
}

function decodeJwsPayload(jws: string): any {
  const parts = jws.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWS format');
  const payload = parts[1];
  const padded = payload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (payload.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function ownershipConflictResponse(request: Request): Response {
  return jsonResponse(
    request,
    { error: 'This subscription is already linked to another Boardify account.' },
    { status: 409 }
  );
}

async function getSubscriptionStatus(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env);
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 });

  const includeSandbox = new URL(request.url).searchParams.get('includeSandbox') === '1';
  const sub = await env.DB
    .prepare(
      `SELECT status, platform, current_period_end, product_id, apple_environment
       FROM subscriptions
       WHERE user_id = ? AND status IN ('active', 'grace_period')
         AND (? = 1 OR platform != 'ios' OR COALESCE(apple_environment, 'Production') != 'Sandbox')
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(Number(user.id), includeSandbox ? 1 : 0)
    .first<{
      status: 'active' | 'grace_period';
      platform: 'ios' | 'android' | 'stripe';
      current_period_end: string | null;
      product_id: string | null;
      apple_environment: AppleSubscriptionEnvironment | null;
    }>();

  if (!sub) {
    return jsonResponse(request, {
      status: 'free',
      platform: null,
      expiresAt: null,
      environment: null,
    });
  }

  return jsonResponse(request, {
    status: subscriptionRowToApiStatus({
      status: sub.status,
      product_id: sub.product_id,
    }),
    platform: sub.platform,
    expiresAt: sub.current_period_end,
    environment: sub.apple_environment ?? null,
  });
}

async function verifyApplePurchase(
  request: Request,
  env: Env,
  userId: number,
  receipt: string,
  productId: string
): Promise<Response> {
  if (!receipt) {
    return jsonResponse(request, { error: 'Missing receipt' }, { status: 400 });
  }

  try {
    let originalTransactionId = '';
    let expiresMs = 0;
    let appleEnvironment: AppleSubscriptionEnvironment = 'Production';

    if (isJwsToken(receipt)) {
      const txn = decodeJwsPayload(receipt);
      originalTransactionId = txn.originalTransactionId || txn.transactionId;
      expiresMs = Number(txn.expiresDate || 0);
      appleEnvironment = String(txn.environment || '').toLowerCase() === 'sandbox' ? 'Sandbox' : 'Production';
    } else {
      const verifyUrl = 'https://buy.itunes.apple.com/verifyReceipt';
      const sandboxUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';
      const payload = JSON.stringify({
        'receipt-data': receipt,
        password: env.APPLE_IAP_SHARED_SECRET || '',
        'exclude-old-transactions': true,
      });
      let res = await fetch(verifyUrl, { method: 'POST', body: payload });
      let data = await res.json<any>();
      if (data.status === 21007) {
        res = await fetch(sandboxUrl, { method: 'POST', body: payload });
        data = await res.json<any>();
      }
      if (data.status !== 0) {
        return jsonResponse(request, { error: 'Receipt validation failed', appleStatus: data.status }, { status: 400 });
      }
      const latestInfo = data.latest_receipt_info?.[0];
      if (!latestInfo) {
        return jsonResponse(request, { error: 'No subscription info found' }, { status: 400 });
      }
      originalTransactionId = latestInfo.original_transaction_id;
      expiresMs = parseInt(latestInfo.expires_date_ms, 10);
      appleEnvironment = String(data.environment || '').toLowerCase() === 'sandbox' ? 'Sandbox' : 'Production';
    }

    if (!originalTransactionId || !Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
      return jsonResponse(request, { error: 'Subscription has expired' }, { status: 400 });
    }

    const existingOwner = await env.DB
      .prepare('SELECT user_id FROM subscriptions WHERE original_transaction_id = ? LIMIT 1')
      .bind(originalTransactionId)
      .first<{ user_id: number }>();
    if (existingOwner && existingOwner.user_id !== userId) return ownershipConflictResponse(request);

    const now = new Date().toISOString();
    const periodEnd = new Date(expiresMs).toISOString();
    const subId = `apple_${appleEnvironment.toLowerCase()}_${originalTransactionId}`;

    await env.DB
      .prepare(
        `INSERT INTO subscriptions
          (id, user_id, platform, product_id, status, original_transaction_id, apple_environment, current_period_end, created_at, updated_at)
         VALUES (?, ?, 'ios', ?, 'active', ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = 'active',
           product_id = excluded.product_id,
           current_period_end = excluded.current_period_end,
           apple_environment = excluded.apple_environment,
           updated_at = excluded.updated_at`
      )
      .bind(subId, userId, productId, originalTransactionId, appleEnvironment, periodEnd, now, now)
      .run();

    await syncUserSubscriptionStatus(env.DB, userId, now, { includeIosSandbox: true });
    return jsonResponse(request, {
      status: 'premium',
      expiresAt: periodEnd,
      environment: appleEnvironment,
    });
  } catch (err) {
    console.error('[Subscriptions] Apple verify error:', err);
    return jsonResponse(request, { error: 'Verification failed' }, { status: 500 });
  }
}

async function getGoogleAccessToken(env: Env): Promise<string> {
  const clientEmail = env.GOOGLE_PLAY_CLIENT_EMAIL;
  const privateKey = env.GOOGLE_PLAY_PRIVATE_KEY;
  if (!clientEmail || !privateKey) throw new Error('Google Play credentials not configured');

  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claim = btoa(
    JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const pemBody = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const input = `${header}.${claim}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const jwt = `${header}.${claim}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json<{ access_token: string }>();
  return data.access_token;
}

async function verifyGooglePurchase(
  request: Request,
  env: Env,
  userId: number,
  purchaseToken: string,
  productId: string
): Promise<Response> {
  if (!purchaseToken) {
    return jsonResponse(request, { error: 'Missing purchaseToken' }, { status: 400 });
  }

  try {
    const accessToken = await getGoogleAccessToken(env);
    const packageName = env.GOOGLE_PLAY_PACKAGE_NAME || 'app.mybreakpoint.boardify';
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const text = await res.text();
      console.error('[Subscriptions] Google verify error:', text);
      return jsonResponse(request, { error: 'Google verification failed' }, { status: 400 });
    }

    const data = await res.json<any>();
    const expiryTimeMs = parseInt(data.expiryTimeMillis, 10);
    if (!Number.isFinite(expiryTimeMs) || expiryTimeMs <= Date.now()) {
      return jsonResponse(request, { error: 'Subscription has expired' }, { status: 400 });
    }

    const tokenHash = await sha256Hex(purchaseToken);
    const subId = `google_${tokenHash}`;
    const existingOwner = await env.DB
      .prepare('SELECT user_id FROM subscriptions WHERE google_purchase_token = ? LIMIT 1')
      .bind(purchaseToken)
      .first<{ user_id: number }>();
    if (existingOwner && existingOwner.user_id !== userId) return ownershipConflictResponse(request);

    const now = new Date().toISOString();
    const periodEnd = new Date(expiryTimeMs).toISOString();
    await env.DB
      .prepare(
        `INSERT INTO subscriptions
          (id, user_id, platform, product_id, status, google_purchase_token, current_period_end, created_at, updated_at)
         VALUES (?, ?, 'android', ?, 'active', ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = 'active',
           product_id = excluded.product_id,
           current_period_end = excluded.current_period_end,
           updated_at = excluded.updated_at`
      )
      .bind(subId, userId, productId, purchaseToken, periodEnd, now, now)
      .run();

    await syncUserSubscriptionStatus(env.DB, userId, now);
    return jsonResponse(request, { status: 'premium', expiresAt: periodEnd });
  } catch (err) {
    console.error('[Subscriptions] Google verify error:', err);
    return jsonResponse(request, { error: 'Verification failed' }, { status: 500 });
  }
}

async function verifyPurchase(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env);
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 });

  const body = await request.json<{
    platform: 'ios' | 'android';
    receipt?: string;
    purchaseToken?: string;
    productId?: string;
  }>();
  const platform = body.platform;
  const productId = body.productId || PREMIUM_MONTHLY_PRODUCT_ID;
  const uid = Number(user.id);

  if (platform === 'ios') {
    return verifyApplePurchase(request, env, uid, body.receipt || '', productId);
  }
  if (platform === 'android') {
    return verifyGooglePurchase(request, env, uid, body.purchaseToken || '', productId);
  }
  return jsonResponse(request, { error: 'Invalid platform' }, { status: 400 });
}

async function createCheckoutSession(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env);
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 });
  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse(request, { error: 'Stripe not configured' }, { status: 500 });
  }
  if (!env.STRIPE_PREMIUM_PRICE_ID) {
    return jsonResponse(request, { error: 'Stripe premium monthly price not configured' }, { status: 500 });
  }

  const uid = Number(user.id);
  const appUrl = getWebAppUrl(request, env);

  let customerId: string | undefined;
  const row = await env.DB.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').bind(uid).first<any>();
  customerId = row?.stripe_customer_id || undefined;

  if (!customerId) {
    const custRes = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `email=${encodeURIComponent(user.email || '')}&metadata[user_id]=${uid}`,
    });
    const cust = await custRes.json<any>();
    if (!custRes.ok || !cust?.id) {
      return jsonResponse(request, { error: 'Failed to create Stripe customer' }, { status: 502 });
    }
    customerId = cust.id;
    await env.DB.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').bind(customerId, uid).run();
  }
  if (!customerId) {
    return jsonResponse(request, { error: 'Stripe customer unavailable' }, { status: 500 });
  }

  const params = new URLSearchParams({
    mode: 'subscription',
    customer: customerId,
    'line_items[0][price]': env.STRIPE_PREMIUM_PRICE_ID,
    'line_items[0][quantity]': '1',
    success_url: `${appUrl}/?subscription=success`,
    cancel_url: `${appUrl}/?subscription=cancelled`,
    'metadata[user_id]': String(uid),
    'subscription_data[metadata][user_id]': String(uid),
    'subscription_data[metadata][tier]': 'premium',
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const session = await res.json<any>();
  if (!res.ok || !session?.url || !session?.id) {
    return jsonResponse(request, { error: 'Failed to create Stripe checkout session' }, { status: 502 });
  }
  return jsonResponse(request, { url: session.url, sessionId: session.id });
}

async function createPortalSession(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env);
  if (!user) return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 });
  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse(request, { error: 'Stripe not configured' }, { status: 500 });
  }

  const uid = Number(user.id);
  const row = await env.DB.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').bind(uid).first<any>();
  if (!row?.stripe_customer_id) {
    return jsonResponse(request, { error: 'No Stripe customer found' }, { status: 400 });
  }
  const appUrl = getWebAppUrl(request, env);

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `customer=${row.stripe_customer_id}&return_url=${encodeURIComponent(`${appUrl}/`)}`,
  });
  const session = await res.json<any>();
  if (!res.ok || !session?.url) {
    return jsonResponse(request, { error: 'Failed to create Stripe billing portal session' }, { status: 502 });
  }
  return jsonResponse(request, { url: session.url });
}

export async function handleSubscriptions(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  await ensureSubscriptionsSchema(env);
  if (pathname === '/subscriptions/status' && request.method === 'GET') {
    return getSubscriptionStatus(request, env);
  }
  if (pathname === '/subscriptions/verify' && request.method === 'POST') {
    return verifyPurchase(request, env);
  }
  if (pathname === '/subscriptions/create-checkout' && request.method === 'POST') {
    return createCheckoutSession(request, env);
  }
  if (pathname === '/subscriptions/portal' && request.method === 'POST') {
    return createPortalSession(request, env);
  }
  return null;
}

