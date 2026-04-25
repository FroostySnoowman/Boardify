import type { Env } from './bindings';
import { syncUserSubscriptionStatus } from './subscription-status';

function stripePriceIdFromSubscription(sub: any): string | undefined {
  const p = sub?.items?.data?.[0]?.price;
  if (typeof p === 'string') return p;
  if (p && typeof p.id === 'string') return p.id;
  return undefined;
}

function internalProductIdForStripePrice(env: Env, priceId: string | undefined): string {
  if (priceId && env.STRIPE_PREMIUM_PRICE_ID && priceId === env.STRIPE_PREMIUM_PRICE_ID) {
    return 'premium_monthly';
  }
  return 'premium_monthly';
}

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  try {
    const parts = sigHeader.split(',').reduce((acc, part) => {
      const [key, val] = part.split('=');
      acc[key.trim()] = val;
      return acc;
    }, {} as Record<string, string>);

    const timestamp = parts.t;
    const v1Sig = parts.v1;
    if (!timestamp || !v1Sig) return false;
    const signedPayload = `${timestamp}.${payload}`;
    const keyData = new TextEncoder().encode(secret);
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const expectedSig = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return expectedSig === v1Sig;
  } catch {
    return false;
  }
}

async function fetchStripeSubscription(env: Env, subId: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  return res.json();
}

async function syncStripeSubscription(env: Env, sub: any): Promise<void> {
  const stripeSubId = sub.id as string;
  const status = sub.status as string;
  const now = new Date().toISOString();

  const row = await env.DB
    .prepare('SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ?')
    .bind(stripeSubId)
    .first<{ user_id: number }>();
  if (!row) return;

  let dbStatus: 'active' | 'grace_period' | 'expired' = 'active';
  if (status === 'past_due') dbStatus = 'grace_period';
  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') dbStatus = 'expired';

  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
  const stripePriceId = stripePriceIdFromSubscription(sub);
  const productId = internalProductIdForStripePrice(env, stripePriceId);
  await env.DB
    .prepare(
      `UPDATE subscriptions
       SET status = ?, current_period_end = ?, product_id = ?, updated_at = ?
       WHERE stripe_subscription_id = ?`
    )
    .bind(dbStatus, periodEnd, productId, now, stripeSubId)
    .run();
  await syncUserSubscriptionStatus(env.DB, row.user_id, now);
}

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Stripe not configured', { status: 500 });
  }
  const body = await request.text();
  const sigHeader = request.headers.get('stripe-signature') || '';
  const isValid = await verifyStripeSignature(body, sigHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!isValid) return new Response('Invalid signature', { status: 400 });

  const event = JSON.parse(body);
  const type = event.type as string;

  if (type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = parseInt(session.metadata?.user_id, 10);
    const stripeSubId = session.subscription as string;
    const stripeCustomerId = session.customer as string | undefined;

    if (userId && stripeSubId) {
      if (stripeCustomerId) {
        await env.DB
          .prepare('UPDATE users SET stripe_customer_id = COALESCE(stripe_customer_id, ?) WHERE id = ?')
          .bind(stripeCustomerId, userId)
          .run();
      }
      const sub = await fetchStripeSubscription(env, stripeSubId);
      const now = new Date().toISOString();
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
      const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null;
      const stripePriceId = stripePriceIdFromSubscription(sub);
      const productId = internalProductIdForStripePrice(env, stripePriceId);
      const subId = `stripe_${stripeSubId}`;
      await env.DB
        .prepare(
          `INSERT INTO subscriptions
            (id, user_id, platform, product_id, status, stripe_subscription_id, current_period_start, current_period_end, created_at, updated_at)
           VALUES (?, ?, 'stripe', ?, 'active', ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             status = 'active',
             product_id = excluded.product_id,
             current_period_start = excluded.current_period_start,
             current_period_end = excluded.current_period_end,
             updated_at = excluded.updated_at`
        )
        .bind(subId, userId, productId, stripeSubId, periodStart, periodEnd, now, now)
        .run();
      await syncUserSubscriptionStatus(env.DB, userId, now);
    }
  }

  if (type === 'customer.subscription.updated') {
    await syncStripeSubscription(env, event.data.object);
  }

  if (type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const stripeSubId = sub.id as string;
    const now = new Date().toISOString();
    const row = await env.DB
      .prepare('SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ?')
      .bind(stripeSubId)
      .first<{ user_id: number }>();
    if (row) {
      await env.DB
        .prepare(`UPDATE subscriptions SET status = 'expired', cancelled_at = ?, updated_at = ? WHERE stripe_subscription_id = ?`)
        .bind(now, now, stripeSubId)
        .run();
      await syncUserSubscriptionStatus(env.DB, row.user_id, now);
    }
  }

  return new Response('OK', { status: 200 });
}

export async function handleWebhooks(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  if (pathname === '/webhooks/stripe' && request.method === 'POST') {
    return handleStripeWebhook(request, env);
  }
  return null;
}

