import type { Env } from './bindings'
import { jsonResponse } from './http'
import { syncUserSubscriptionStatus } from './subscription-status'

let ensureSchemaPromise: Promise<void> | null = null

async function ensureSubscriptionsSchema(env: Env): Promise<void> {
  if (ensureSchemaPromise) return ensureSchemaPromise
  ensureSchemaPromise = (async () => {
    const tableInfo = await env.DB.prepare(`PRAGMA table_info(subscriptions)`).all<any>()
    const hasAppleEnvironment = (tableInfo.results || []).some((col: any) => col?.name === 'apple_environment')
    if (!hasAppleEnvironment) {
      await env.DB.prepare(
        `ALTER TABLE subscriptions ADD COLUMN apple_environment TEXT CHECK (apple_environment IN ('Sandbox', 'Production'))`
      ).run()
    }
  })().catch((error) => {
    ensureSchemaPromise = null
    throw error
  })
  return ensureSchemaPromise
}

export async function handleWebhooks(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  if (pathname === '/webhooks/stripe' && request.method === 'POST') {
    return handleStripeWebhook(request, env)
  }
  if (pathname === '/webhooks/apple' && request.method === 'POST') {
    return handleAppleWebhook(request, env)
  }
  if (pathname === '/webhooks/google' && request.method === 'POST') {
    return handleGoogleWebhook(request, env)
  }
  return null
}

function stripePriceIdFromSubscription(sub: any): string | undefined {
  const p = sub?.items?.data?.[0]?.price
  if (typeof p === 'string') return p
  if (p && typeof p.id === 'string') return p.id
  return undefined
}

function plusProductIdForStripePrice(env: Env, priceId: string | undefined): string {
  if (priceId && env.STRIPE_PLUS_ANNUAL_PRICE_ID && priceId === env.STRIPE_PLUS_ANNUAL_PRICE_ID) {
    return 'plus_annual'
  }
  return 'plus_monthly'
}

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Stripe not configured', { status: 500 })
  }

  const body = await request.text()
  const sigHeader = request.headers.get('stripe-signature') || ''

  const isValid = await verifyStripeSignature(body, sigHeader, env.STRIPE_WEBHOOK_SECRET)
  if (!isValid) {
    console.error('[Webhook] Stripe signature verification failed')
    return new Response('Invalid signature', { status: 400 })
  }

  const event = JSON.parse(body)
  const type = event.type as string

  // DB operations are NOT wrapped in try/catch -- if they throw, the Worker
  // returns 500 and Stripe will retry delivery (up to ~72 hours).
  if (type === 'checkout.session.completed') {
    const session = event.data.object
    const userId = parseInt(session.metadata?.user_id, 10)
    const stripeSubId = session.subscription as string
    const stripeCustomerId = session.customer as string | undefined

    if (userId && stripeSubId) {
      const existingSubOwner = await env.DB.prepare(
        'SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ? LIMIT 1'
      ).bind(stripeSubId).first<{ user_id: number }>()

      if (existingSubOwner && existingSubOwner.user_id !== userId) {
        console.error('[Webhook] Stripe ownership mismatch for subscription', {
          stripeSubId,
          existingUserId: existingSubOwner.user_id,
          incomingUserId: userId,
        })
        return new Response('OK', { status: 200 })
      }

      if (stripeCustomerId) {
        const existingCustomerOwner = await env.DB.prepare(
          'SELECT id FROM users WHERE stripe_customer_id = ? LIMIT 1'
        ).bind(stripeCustomerId).first<{ id: number }>()
        if (existingCustomerOwner && existingCustomerOwner.id !== userId) {
          console.error('[Webhook] Stripe ownership mismatch for customer', {
            stripeCustomerId,
            existingUserId: existingCustomerOwner.id,
            incomingUserId: userId,
          })
          return new Response('OK', { status: 200 })
        }
        await env.DB.prepare(
          'UPDATE users SET stripe_customer_id = COALESCE(stripe_customer_id, ?) WHERE id = ?'
        ).bind(stripeCustomerId, userId).run()
      }

      const sub = await fetchStripeSubscription(env, stripeSubId)
      const now = new Date().toISOString()
      const periodEnd = sub.current_period_end
        ? new Date(sub.current_period_end * 1000).toISOString()
        : null
      const periodStart = sub.current_period_start
        ? new Date(sub.current_period_start * 1000).toISOString()
        : null

      const stripePriceId = stripePriceIdFromSubscription(sub)
      const productId = plusProductIdForStripePrice(env, stripePriceId)

      const subId = `stripe_${stripeSubId}`
      await env.DB.prepare(
        `INSERT INTO subscriptions (id, user_id, platform, product_id, status, stripe_subscription_id, current_period_start, current_period_end, created_at, updated_at)
         VALUES (?, ?, 'stripe', ?, 'active', ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status = 'active',
           product_id = excluded.product_id,
           current_period_start = excluded.current_period_start,
           current_period_end = excluded.current_period_end,
           updated_at = excluded.updated_at`
      )
        .bind(subId, userId, productId, stripeSubId, periodStart, periodEnd, now, now)
        .run()
      await syncUserSubscriptionStatus(env.DB, userId, now)
    }
  }

  if (type === 'customer.subscription.updated') {
    await syncStripeSubscription(env, event.data.object)
  }

  if (type === 'customer.subscription.deleted') {
    const sub = event.data.object
    const stripeSubId = sub.id as string
    const now = new Date().toISOString()

    const row = await env.DB.prepare(
      'SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ?'
    ).bind(stripeSubId).first<{ user_id: number }>()

    if (row) {
      await env.DB.prepare(
        `UPDATE subscriptions SET status = 'expired', cancelled_at = ?, updated_at = ? WHERE stripe_subscription_id = ?`
      ).bind(now, now, stripeSubId).run()
      await syncUserSubscriptionStatus(env.DB, row.user_id, now)
    }
  }

  if (type === 'invoice.payment_failed') {
    const invoice = event.data.object
    const stripeSubId = invoice.subscription as string
    if (stripeSubId) {
      const now = new Date().toISOString()
      const row = await env.DB.prepare(
        'SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ?'
      ).bind(stripeSubId).first<{ user_id: number }>()

      if (row) {
        await env.DB.prepare(
          `UPDATE subscriptions SET status = 'grace_period', updated_at = ? WHERE stripe_subscription_id = ?`
        ).bind(now, stripeSubId).run()
        await syncUserSubscriptionStatus(env.DB, row.user_id, now)
      }
    }
  }

  return new Response('OK', { status: 200 })
}

async function syncStripeSubscription(env: Env, sub: any): Promise<void> {
  const stripeSubId = sub.id as string
  const status = sub.status as string
  const now = new Date().toISOString()

  const row = await env.DB.prepare(
    'SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ?'
  ).bind(stripeSubId).first<{ user_id: number }>()

  if (!row) return

  let dbStatus = 'active'
  let shouldSyncUser = true
  if (status === 'past_due') {
    dbStatus = 'grace_period'
  } else if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    dbStatus = 'expired'
  } else if (status !== 'active' && status !== 'trialing') {
    shouldSyncUser = false
  }

  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null

  const stripePriceId = stripePriceIdFromSubscription(sub)
  if (stripePriceId) {
    const productId = plusProductIdForStripePrice(env, stripePriceId)
    await env.DB.prepare(
      `UPDATE subscriptions SET status = ?, current_period_end = ?, product_id = ?, updated_at = ? WHERE stripe_subscription_id = ?`
    )
      .bind(dbStatus, periodEnd, productId, now, stripeSubId)
      .run()
  } else {
    await env.DB.prepare(
      `UPDATE subscriptions SET status = ?, current_period_end = ?, updated_at = ? WHERE stripe_subscription_id = ?`
    )
      .bind(dbStatus, periodEnd, now, stripeSubId)
      .run()
  }
  if (shouldSyncUser) {
    await syncUserSubscriptionStatus(env.DB, row.user_id, now)
  }
}

async function fetchStripeSubscription(env: Env, subId: string): Promise<any> {
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  })
  return res.json()
}

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  try {
    const parts = sigHeader.split(',').reduce((acc, part) => {
      const [key, val] = part.split('=')
      acc[key.trim()] = val
      return acc
    }, {} as Record<string, string>)

    const timestamp = parts['t']
    const v1Sig = parts['v1']
    if (!timestamp || !v1Sig) return false

    const signedPayload = `${timestamp}.${payload}`
    const keyData = new TextEncoder().encode(secret)
    const key = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload))
    const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')

    return expectedSig === v1Sig
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Apple
// ---------------------------------------------------------------------------

async function handleAppleWebhook(request: Request, env: Env): Promise<Response> {
  await ensureSubscriptionsSchema(env)
  // --- Step 1: Decode the JWS payload (validation errors → 200/400) --------
  let notificationType: string
  let originalTransactionId: string
  let expiresDate: number | undefined
  let txPayload: any
  let appleEnvironment: 'Sandbox' | 'Production' | undefined

  try {
    const body = await request.json<{ signedPayload?: string }>()
    if (!body.signedPayload) {
      return new Response('Missing signedPayload', { status: 400 })
    }

    const parts = body.signedPayload.split('.')
    if (parts.length !== 3) {
      return new Response('Invalid JWS', { status: 400 })
    }

    const payloadJson = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    notificationType = payloadJson.notificationType as string
    appleEnvironment = String(payloadJson.environment || '').toLowerCase() === 'sandbox' ? 'Sandbox' : 'Production'
    const transactionInfo = payloadJson.data?.signedTransactionInfo

    if (!transactionInfo) {
      return new Response('OK', { status: 200 })
    }

    const txParts = transactionInfo.split('.')
    txPayload = JSON.parse(atob(txParts[1].replace(/-/g, '+').replace(/_/g, '/')))
    originalTransactionId = txPayload.originalTransactionId as string
    expiresDate = txPayload.expiresDate as number | undefined
  } catch (err) {
    console.error('[Webhook] Apple: failed to decode payload:', err)
    return new Response('Bad payload', { status: 400 })
  }

  // --- Step 2: Look up subscription (unknown txn → 200, nothing to do) -----
  const row = await env.DB.prepare(
    `SELECT user_id FROM subscriptions
     WHERE original_transaction_id = ?
       AND (apple_environment = ? OR apple_environment IS NULL)
     LIMIT 1`
  ).bind(originalTransactionId, appleEnvironment || 'Production').first<{ user_id: number }>()

  if (!row) {
    console.warn('[Webhook] Apple: no subscription found for txn', originalTransactionId)
    return new Response('OK', { status: 200 })
  }

  // --- Step 3: Process (DB errors propagate as 500 → Apple retries) --------
  const now = new Date().toISOString()
  const periodEnd = expiresDate ? new Date(expiresDate).toISOString() : null

  if (notificationType === 'DID_RENEW' || notificationType === 'SUBSCRIBED') {
    await env.DB.prepare(
      `UPDATE subscriptions
       SET status = 'active', current_period_end = ?, apple_environment = ?, updated_at = ?
       WHERE original_transaction_id = ? AND (apple_environment = ? OR apple_environment IS NULL)`
    ).bind(periodEnd, appleEnvironment || 'Production', now, originalTransactionId, appleEnvironment || 'Production').run()
    await syncUserSubscriptionStatus(env.DB, row.user_id, now)
  } else if (notificationType === 'EXPIRED' || notificationType === 'REVOKE') {
    await env.DB.prepare(
      `UPDATE subscriptions
       SET status = 'expired', cancelled_at = ?, apple_environment = ?, updated_at = ?
       WHERE original_transaction_id = ? AND (apple_environment = ? OR apple_environment IS NULL)`
    ).bind(now, appleEnvironment || 'Production', now, originalTransactionId, appleEnvironment || 'Production').run()
    await syncUserSubscriptionStatus(env.DB, row.user_id, now)
  } else if (notificationType === 'DID_CHANGE_RENEWAL_STATUS') {
    const autoRenewEnabled = txPayload.autoRenewStatus === 1
    if (!autoRenewEnabled) {
      await env.DB.prepare(
        `UPDATE subscriptions
         SET cancelled_at = ?, apple_environment = ?, updated_at = ?
         WHERE original_transaction_id = ? AND (apple_environment = ? OR apple_environment IS NULL)`
      ).bind(now, appleEnvironment || 'Production', now, originalTransactionId, appleEnvironment || 'Production').run()
    } else {
      await env.DB.prepare(
        `UPDATE subscriptions
         SET cancelled_at = NULL, apple_environment = ?, updated_at = ?
         WHERE original_transaction_id = ? AND (apple_environment = ? OR apple_environment IS NULL)`
      ).bind(appleEnvironment || 'Production', now, originalTransactionId, appleEnvironment || 'Production').run()
    }
    await syncUserSubscriptionStatus(env.DB, row.user_id, now)
  } else if (notificationType === 'DID_FAIL_TO_RENEW') {
    await env.DB.prepare(
      `UPDATE subscriptions
       SET status = 'grace_period', current_period_end = ?, apple_environment = ?, updated_at = ?
       WHERE original_transaction_id = ? AND (apple_environment = ? OR apple_environment IS NULL)`
    ).bind(periodEnd, appleEnvironment || 'Production', now, originalTransactionId, appleEnvironment || 'Production').run()
    await syncUserSubscriptionStatus(env.DB, row.user_id, now)
  } else if (notificationType === 'GRACE_PERIOD_EXPIRES') {
    await env.DB.prepare(
      `UPDATE subscriptions
       SET status = 'expired', apple_environment = ?, updated_at = ?
       WHERE original_transaction_id = ? AND (apple_environment = ? OR apple_environment IS NULL)`
    ).bind(appleEnvironment || 'Production', now, originalTransactionId, appleEnvironment || 'Production').run()
    await syncUserSubscriptionStatus(env.DB, row.user_id, now)
  } else if (notificationType === 'REFUND') {
    await env.DB.prepare(
      `UPDATE subscriptions
       SET status = 'expired', cancelled_at = ?, apple_environment = ?, updated_at = ?
       WHERE original_transaction_id = ? AND (apple_environment = ? OR apple_environment IS NULL)`
    ).bind(now, appleEnvironment || 'Production', now, originalTransactionId, appleEnvironment || 'Production').run()
    await syncUserSubscriptionStatus(env.DB, row.user_id, now)
  } else if (notificationType === 'REFUND_REVERSED') {
    await env.DB.prepare(
      `UPDATE subscriptions
       SET status = 'active', cancelled_at = NULL, current_period_end = ?, apple_environment = ?, updated_at = ?
       WHERE original_transaction_id = ? AND (apple_environment = ? OR apple_environment IS NULL)`
    ).bind(periodEnd, appleEnvironment || 'Production', now, originalTransactionId, appleEnvironment || 'Production').run()
    await syncUserSubscriptionStatus(env.DB, row.user_id, now)
  }

  return new Response('OK', { status: 200 })
}

// ---------------------------------------------------------------------------
// Google
// ---------------------------------------------------------------------------

async function handleGoogleWebhook(request: Request, env: Env): Promise<Response> {
  // --- Step 1: Decode (bad payload → 200, nothing useful to retry) ----------
  let purchaseToken: string
  let notificationType: number

  try {
    const body = await request.json<{ message?: { data?: string } }>()
    const data = body.message?.data
    if (!data) return new Response('OK', { status: 200 })

    const decoded = JSON.parse(atob(data))
    const notification = decoded.subscriptionNotification
    if (!notification) return new Response('OK', { status: 200 })

    purchaseToken = notification.purchaseToken as string
    notificationType = notification.notificationType as number
  } catch (err) {
    console.error('[Webhook] Google: failed to decode payload:', err)
    return new Response('Bad payload', { status: 400 })
  }

  // --- Step 2: Look up subscription ----------------------------------------
  const row = await env.DB.prepare(
    'SELECT id, user_id FROM subscriptions WHERE google_purchase_token = ?'
  ).bind(purchaseToken).first<{ id: string; user_id: number }>()

  if (!row) {
    console.warn('[Webhook] Google: no subscription found for token')
    return new Response('OK', { status: 200 })
  }

  // --- Step 3: Process (DB errors propagate as 500 → Google retries) -------
  const now = new Date().toISOString()

  // 2=RENEWED, 3=CANCELED, 4=PURCHASED, 12=EXPIRED, 13=EXPIRED_FROM_BILLING_RETRY
  if (notificationType === 2 || notificationType === 4) {
    await env.DB.prepare(
      `UPDATE subscriptions SET status = 'active', updated_at = ? WHERE id = ?`
    ).bind(now, row.id).run()
    await syncUserSubscriptionStatus(env.DB, row.user_id, now)
  } else if (notificationType === 3) {
    await env.DB.prepare(
      `UPDATE subscriptions SET cancelled_at = ?, updated_at = ? WHERE id = ?`
    ).bind(now, now, row.id).run()
  } else if (notificationType === 12 || notificationType === 13) {
    await env.DB.prepare(
      `UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE id = ?`
    ).bind(now, row.id).run()
    await syncUserSubscriptionStatus(env.DB, row.user_id, now)
  }

  return new Response('OK', { status: 200 })
}
