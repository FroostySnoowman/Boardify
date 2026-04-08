import type { Env } from './bindings'
import { jsonResponse } from './http'
import { getCurrentUserFromSession } from './auth'
import { syncUserSubscriptionStatus } from './subscription-status'

const PLUS_PRODUCT_ID = 'app.mybreakpoint.plus.monthly'
type AppleSubscriptionEnvironment = 'Sandbox' | 'Production'
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

function getWebAppUrl(request: Request, env: Env): string {
  const origin = request.headers.get('origin')
  if (origin) {
    try {
      const parsed = new URL(origin)
      const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
      if (isLocalhost && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
        return `${parsed.protocol}//${parsed.host}`
      }
    } catch {
      // ignore malformed Origin header and fall back to env/default behavior.
    }
  }

  if (env.WEB_APP_URL) {
    return env.WEB_APP_URL.replace(/\/$/, '')
  }

  const url = new URL(request.url)
  return url.origin.replace('api.', '')
}

export async function handleSubscriptions(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  await ensureSubscriptionsSchema(env)
  if (pathname === '/subscriptions/status' && request.method === 'GET') {
    return getSubscriptionStatus(request, env)
  }
  if (pathname === '/subscriptions/verify' && request.method === 'POST') {
    return verifyPurchase(request, env)
  }
  if (pathname === '/subscriptions/create-checkout' && request.method === 'POST') {
    return createCheckoutSession(request, env)
  }
  if (pathname === '/subscriptions/portal' && request.method === 'POST') {
    return createPortalSession(request, env)
  }
  if (pathname === '/subscriptions/reset-sandbox' && request.method === 'POST') {
    return resetSandboxSubscription(request, env)
  }
  return null
}

async function getSubscriptionStatus(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const includeSandbox = new URL(request.url).searchParams.get('includeSandbox') === '1'
  const iosEnvironmentParam = new URL(request.url).searchParams.get('iosEnvironment')
  const iosEnvironmentFilter: AppleSubscriptionEnvironment | null =
    iosEnvironmentParam === 'Sandbox' || iosEnvironmentParam === 'Production'
      ? iosEnvironmentParam
      : null
  let sub = await env.DB
    .prepare(
      `SELECT id, user_id, platform, status, current_period_end, product_id, apple_environment, original_transaction_id
       FROM subscriptions
       WHERE user_id = ? AND status IN ('active', 'grace_period')
         AND ((? = 1 OR ? IS NOT NULL) OR platform != 'ios' OR COALESCE(apple_environment, 'Production') != 'Sandbox')
         AND (? IS NULL OR platform != 'ios' OR COALESCE(apple_environment, 'Production') = ?)
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(Number(user.id), includeSandbox ? 1 : 0, iosEnvironmentFilter, iosEnvironmentFilter, iosEnvironmentFilter)
    .first<any>()

  if (sub?.platform === 'ios' && !sub.apple_environment && sub.original_transaction_id) {
    const resolvedEnv = await resolveAppleSubscriptionEnvironment(env, sub.original_transaction_id)
    if (resolvedEnv === 'Sandbox' || resolvedEnv === 'Production') {
      await env.DB.prepare(
        `UPDATE subscriptions SET apple_environment = ?, updated_at = ? WHERE id = ?`
      ).bind(resolvedEnv, new Date().toISOString(), sub.id).run()

      if (!includeSandbox && resolvedEnv === 'Sandbox') {
        sub = await env.DB
          .prepare(
            `SELECT id, user_id, platform, status, current_period_end, product_id, apple_environment, original_transaction_id
             FROM subscriptions
             WHERE user_id = ? AND status IN ('active', 'grace_period')
               AND ((? = 1 OR ? IS NOT NULL) OR platform != 'ios' OR COALESCE(apple_environment, 'Production') != 'Sandbox')
               AND (? IS NULL OR platform != 'ios' OR COALESCE(apple_environment, 'Production') = ?)
             ORDER BY created_at DESC LIMIT 1`
          )
          .bind(Number(user.id), includeSandbox ? 1 : 0, iosEnvironmentFilter, iosEnvironmentFilter, iosEnvironmentFilter)
          .first<any>()
      } else {
        sub.apple_environment = resolvedEnv
      }
    }
  }

  if (!sub) {
    return jsonResponse(request, {
      status: 'free',
      platform: null,
      expiresAt: null,
      environment: null,
    })
  }
  
  if (sub.status === 'active' && sub.current_period_end) {
    const expiryMs = new Date(sub.current_period_end).getTime()
    const bufferMs = 48 * 60 * 60 * 1000
    if (expiryMs + bufferMs < Date.now()) {
      const now = new Date().toISOString()
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE id = ?`
        ).bind(now, sub.id),
      ])
      await syncUserSubscriptionStatus(env.DB, Number(sub.user_id), now)
      return jsonResponse(request, {
        status: 'free',
        platform: null,
        expiresAt: null,
        environment: null,
      })
    }
  }

  return jsonResponse(request, {
    status: sub.status === 'active' ? 'plus' : 'plus_grace',
    platform: sub.platform,
    expiresAt: sub.current_period_end,
    environment: sub.apple_environment || null,
  })
}

async function verifyPurchase(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json<{
    platform: 'ios' | 'android'
    receipt?: string
    purchaseToken?: string
    productId?: string
  }>()

  const { platform, receipt, purchaseToken, productId } = body
  const uid = Number(user.id)

  if (platform === 'ios') {
    return verifyApplePurchase(request, env, uid, receipt || '', productId || PLUS_PRODUCT_ID)
  } else if (platform === 'android') {
    return verifyGooglePurchase(request, env, uid, purchaseToken || '', productId || PLUS_PRODUCT_ID)
  }

  return jsonResponse(request, { error: 'Invalid platform' }, { status: 400 })
}

function isJwsToken(value: string): boolean {
  const parts = value.split('.')
  return parts.length === 3 && value.startsWith('ey')
}

function decodeJwsPayload(jws: string): any {
  const parts = jws.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWS format')
  const payload = parts[1]
  const padded = payload.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (payload.length % 4)) % 4)
  return JSON.parse(atob(padded))
}

function ownershipConflictResponse(request: Request): Response {
  return jsonResponse(
    request,
    { error: 'This subscription is already linked to another MyBreakPoint account.' },
    { status: 409 }
  )
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function verifyApplePurchase(
  request: Request, env: Env, userId: number, receipt: string, productId: string
): Promise<Response> {
  if (!receipt) {
    return jsonResponse(request, { error: 'Missing receipt' }, { status: 400 })
  }

  try {
    if (isJwsToken(receipt)) {
      return verifyAppleJwsPurchase(request, env, userId, receipt, productId)
    }

    const verifyUrl = 'https://buy.itunes.apple.com/verifyReceipt'
    const sandboxUrl = 'https://sandbox.itunes.apple.com/verifyReceipt'

    const payload = JSON.stringify({
      'receipt-data': receipt,
      password: env.APPLE_IAP_SHARED_SECRET || '',
      'exclude-old-transactions': true,
    })

    let res = await fetch(verifyUrl, { method: 'POST', body: payload })
    let data = await res.json<any>()

    if (data.status === 21007) {
      res = await fetch(sandboxUrl, { method: 'POST', body: payload })
      data = await res.json<any>()
    }

    if (data.status !== 0) {
      return jsonResponse(request, { error: 'Receipt validation failed', appleStatus: data.status }, { status: 400 })
    }

    const latestInfo = data.latest_receipt_info?.[0]
    if (!latestInfo) {
      return jsonResponse(request, { error: 'No subscription info found' }, { status: 400 })
    }

    const originalTransactionId = latestInfo.original_transaction_id
    const expiresMs = parseInt(latestInfo.expires_date_ms, 10)
    const isActive = expiresMs > Date.now()
    const appleEnvironment: AppleSubscriptionEnvironment =
      String(data.environment || '').toLowerCase() === 'sandbox' ? 'Sandbox' : 'Production'

    if (!isActive) {
      return jsonResponse(request, { error: 'Subscription has expired' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const periodEnd = new Date(expiresMs).toISOString()

    const existingOwner = await env.DB.prepare(
      'SELECT user_id FROM subscriptions WHERE original_transaction_id = ? LIMIT 1'
    ).bind(originalTransactionId).first<{ user_id: number }>()
    if (existingOwner && existingOwner.user_id !== userId) {
      return ownershipConflictResponse(request)
    }
    const existingSub = await env.DB.prepare(
      'SELECT id FROM subscriptions WHERE original_transaction_id = ? LIMIT 1'
    ).bind(originalTransactionId).first<{ id: string }>()
    const subId = existingSub?.id || `apple_${appleEnvironment.toLowerCase()}_${originalTransactionId}`

    await env.DB.prepare(
      `INSERT INTO subscriptions (id, user_id, platform, product_id, status, original_transaction_id, apple_environment, current_period_end, created_at, updated_at)
       VALUES (?, ?, 'ios', ?, 'active', ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = 'active', current_period_end = ?, apple_environment = ?, updated_at = ?`
    ).bind(subId, userId, productId, originalTransactionId, appleEnvironment, periodEnd, now, now, periodEnd, appleEnvironment, now).run()
    await syncUserSubscriptionStatus(env.DB, userId, now)

    return jsonResponse(request, { status: 'plus', expiresAt: periodEnd, environment: appleEnvironment })
  } catch (err) {
    console.error('[Subscriptions] Apple verify error:', err)
    return jsonResponse(request, { error: 'Verification failed' }, { status: 500 })
  }
}

async function verifyAppleJwsPurchase(
  request: Request, env: Env, userId: number, jws: string, productId: string
): Promise<Response> {
  let txn: any
  try {
    txn = decodeJwsPayload(jws)
  } catch {
    return jsonResponse(request, { error: 'Invalid JWS token' }, { status: 400 })
  }

  const originalTransactionId: string = txn.originalTransactionId || txn.transactionId
  if (!originalTransactionId) {
    return jsonResponse(request, { error: 'Missing transaction ID in JWS' }, { status: 400 })
  }

  const expiresMs = txn.expiresDate
  const appleEnvironment: AppleSubscriptionEnvironment =
    String(txn.environment || '').toLowerCase() === 'sandbox' ? 'Sandbox' : 'Production'
  if (!expiresMs || expiresMs < Date.now()) {
    const apiStatus = await verifyAppleSubscriptionStatus(env, originalTransactionId)
    if (apiStatus !== 'active' && apiStatus !== 'renewed') {
      return jsonResponse(request, { error: 'Subscription has expired' }, { status: 400 })
    }
  }

  const now = new Date().toISOString()
  const periodEnd = expiresMs ? new Date(expiresMs).toISOString() : now

  const existingOwner = await env.DB.prepare(
    'SELECT user_id FROM subscriptions WHERE original_transaction_id = ? LIMIT 1'
  ).bind(originalTransactionId).first<{ user_id: number }>()
  if (existingOwner && existingOwner.user_id !== userId) {
    return ownershipConflictResponse(request)
  }
  const existingSub = await env.DB.prepare(
    'SELECT id FROM subscriptions WHERE original_transaction_id = ? LIMIT 1'
  ).bind(originalTransactionId).first<{ id: string }>()
  const subId = existingSub?.id || `apple_${appleEnvironment.toLowerCase()}_${originalTransactionId}`

  await env.DB.prepare(
    `INSERT INTO subscriptions (id, user_id, platform, product_id, status, original_transaction_id, apple_environment, current_period_end, created_at, updated_at)
     VALUES (?, ?, 'ios', ?, 'active', ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET status = 'active', current_period_end = ?, apple_environment = ?, updated_at = ?`
  ).bind(subId, userId, productId, originalTransactionId, appleEnvironment, periodEnd, now, now, periodEnd, appleEnvironment, now).run()
  await syncUserSubscriptionStatus(env.DB, userId, now)

  return jsonResponse(request, { status: 'plus', expiresAt: periodEnd, environment: appleEnvironment })
}

async function resetSandboxSubscription(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const userId = Number(user.id)
  const now = new Date().toISOString()

  const sandboxRows = await env.DB.prepare(
    `SELECT id FROM subscriptions
     WHERE user_id = ?
       AND platform = 'ios'
       AND status IN ('active', 'grace_period')
       AND (apple_environment = 'Sandbox' OR apple_environment IS NULL)`
  ).bind(userId).all<{ id: string }>()

  const ids = (sandboxRows.results || []).map((row) => row.id)
  if (ids.length > 0) {
    const statements = ids.map((id) =>
      env.DB.prepare(
        `UPDATE subscriptions
         SET status = 'expired', cancelled_at = ?, updated_at = ?
         WHERE id = ?`
      ).bind(now, now, id)
    )
    await env.DB.batch(statements)
  }

  await syncUserSubscriptionStatus(env.DB, userId, now)
  return jsonResponse(request, { success: true, removedCount: ids.length })
}

async function verifyGooglePurchase(
  request: Request, env: Env, userId: number, purchaseToken: string, productId: string
): Promise<Response> {
  if (!purchaseToken) {
    return jsonResponse(request, { error: 'Missing purchaseToken' }, { status: 400 })
  }

  try {
    const accessToken = await getGoogleAccessToken(env)
    const packageName = 'app.mybreakpoint'
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[Subscriptions] Google verify error:', text)
      return jsonResponse(request, { error: 'Google verification failed' }, { status: 400 })
    }

    const data = await res.json<any>()
    const expiryTimeMs = parseInt(data.expiryTimeMillis, 10)
    const isActive = expiryTimeMs > Date.now()

    if (!isActive) {
      return jsonResponse(request, { error: 'Subscription has expired' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const periodEnd = new Date(expiryTimeMs).toISOString()
    const tokenHash = await sha256Hex(purchaseToken)
    const subId = `google_${tokenHash}`

    const existingOwner = await env.DB.prepare(
      'SELECT user_id FROM subscriptions WHERE google_purchase_token = ? LIMIT 1'
    ).bind(purchaseToken).first<{ user_id: number }>()
    if (existingOwner && existingOwner.user_id !== userId) {
      return ownershipConflictResponse(request)
    }

    await env.DB.prepare(
      `INSERT INTO subscriptions (id, user_id, platform, product_id, status, google_purchase_token, current_period_end, created_at, updated_at)
       VALUES (?, ?, 'android', ?, 'active', ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = 'active', current_period_end = ?, updated_at = ?`
    ).bind(subId, userId, productId, purchaseToken, periodEnd, now, now, periodEnd, now).run()
    await syncUserSubscriptionStatus(env.DB, userId, now)

    return jsonResponse(request, { status: 'plus', expiresAt: periodEnd })
  } catch (err) {
    console.error('[Subscriptions] Google verify error:', err)
    return jsonResponse(request, { error: 'Verification failed' }, { status: 500 })
  }
}

async function getGoogleAccessToken(env: Env): Promise<string> {
  const clientEmail = env.GOOGLE_PLAY_CLIENT_EMAIL
  const privateKey = env.GOOGLE_PLAY_PRIVATE_KEY
  if (!clientEmail || !privateKey) {
    throw new Error('Google Play credentials not configured')
  }

  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const claim = btoa(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))

  const pemBody = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  )

  const input = `${header}.${claim}`
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input))
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const jwt = `${header}.${claim}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const data = await res.json<{ access_token: string }>()
  return data.access_token
}

async function createCheckoutSession(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse(request, { error: 'Stripe not configured' }, { status: 500 })
  }

  let billing: 'monthly' | 'annual' = 'monthly'
  try {
    const body = (await request.json().catch(() => ({}))) as { billing?: string }
    if (body?.billing === 'annual') billing = 'annual'
  } catch {
    // ignore
  }

  const priceId =
    billing === 'annual' ? env.STRIPE_PLUS_ANNUAL_PRICE_ID : env.STRIPE_PLUS_PRICE_ID
  if (!priceId) {
    return jsonResponse(
      request,
      {
        error:
          billing === 'annual'
            ? 'Stripe annual price not configured'
            : 'Stripe monthly price not configured',
      },
      { status: 500 }
    )
  }

  const uid = Number(user.id)
  const appUrl = getWebAppUrl(request, env)

  let customerId: string | undefined
  const row = await env.DB.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').bind(uid).first<any>()
  customerId = row?.stripe_customer_id || undefined

  if (!customerId) {
    const custRes = await fetch('https://api.stripe.com/v1/customers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `email=${encodeURIComponent(user.email || '')}&metadata[user_id]=${uid}`,
    })
    const cust = await custRes.json<any>()
    if (!custRes.ok || !cust?.id) {
      return jsonResponse(
        request,
        {
          error: 'Failed to create Stripe customer',
          details: cust?.error?.message || 'Stripe customer API request failed',
        },
        { status: 502 }
      )
    }
    customerId = cust.id
    await env.DB.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').bind(customerId, uid).run()
  }
  if (!customerId) {
    return jsonResponse(request, { error: 'Stripe customer unavailable' }, { status: 500 })
  }

  const params = new URLSearchParams({
    mode: 'subscription',
    customer: customerId,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: `${appUrl}/settings?subscription=success`,
    cancel_url: `${appUrl}/settings?subscription=cancelled`,
    'metadata[user_id]': String(uid),
    'subscription_data[metadata][user_id]': String(uid),
    'subscription_data[metadata][billing]': billing,
  })

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const session = await res.json<any>()
  if (!res.ok || !session?.id || !session?.url) {
    return jsonResponse(
      request,
      {
        error: 'Failed to create Stripe checkout session',
        details: session?.error?.message || 'Stripe checkout API request failed',
      },
      { status: 502 }
    )
  }
  return jsonResponse(request, { url: session.url, sessionId: session.id })
}

async function createPortalSession(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  if (!env.STRIPE_SECRET_KEY) {
    return jsonResponse(request, { error: 'Stripe not configured' }, { status: 500 })
  }

  const uid = Number(user.id)
  const row = await env.DB.prepare('SELECT stripe_customer_id FROM users WHERE id = ?').bind(uid).first<any>()

  if (!row?.stripe_customer_id) {
    return jsonResponse(request, { error: 'No Stripe customer found' }, { status: 400 })
  }

  const appUrl = getWebAppUrl(request, env)

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `customer=${row.stripe_customer_id}&return_url=${encodeURIComponent(`${appUrl}/settings`)}`,
  })

  const session = await res.json<any>()
  if (!res.ok || !session?.url) {
    return jsonResponse(
      request,
      {
        error: 'Failed to create Stripe billing portal session',
        details: session?.error?.message || 'Stripe billing portal API request failed',
      },
      { status: 502 }
    )
  }
  return jsonResponse(request, { url: session.url })
}

export async function expireStaleSubscriptions(env: Env): Promise<number> {
  await ensureSubscriptionsSchema(env)
  const BUFFER_MS = 48 * 60 * 60 * 1000
  const cutoff = new Date(Date.now() - BUFFER_MS).toISOString()
  const now = new Date().toISOString()

  const stale = await env.DB
    .prepare(
      `SELECT id, user_id, platform, original_transaction_id FROM subscriptions
       WHERE status = 'active'
         AND current_period_end IS NOT NULL
         AND current_period_end < ?`
    )
    .bind(cutoff)
    .all<{ id: string; user_id: number; platform: string; original_transaction_id: string | null }>()

  const rows = stale.results || []
  if (rows.length === 0) return 0

  let expiredCount = 0

  for (const row of rows) {
    if (row.platform === 'ios' && row.original_transaction_id) {
      const appleStatus = await verifyAppleSubscriptionStatus(env, row.original_transaction_id)
      if (appleStatus === 'active') {
        await env.DB.prepare(
          `UPDATE subscriptions SET updated_at = ? WHERE id = ?`
        ).bind(now, row.id).run()
        continue
      }
      if (appleStatus === 'renewed') {
        await env.DB.prepare(
          `UPDATE subscriptions SET updated_at = ? WHERE id = ?`
        ).bind(now, row.id).run()
        continue
      }
    }

    await env.DB.prepare(
      `UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE id = ?`
    ).bind(now, row.id).run()
    await syncUserSubscriptionStatus(env.DB, row.user_id, now)
    expiredCount++
  }
  
  return expiredCount
}

async function verifyAppleSubscriptionStatus(
  env: Env,
  originalTransactionId: string
): Promise<'active' | 'renewed' | 'expired' | 'unknown'> {
  const keyId = env.APP_STORE_CONNECT_KEY_ID
  const issuerId = env.APP_STORE_CONNECT_ISSUER_ID
  const keyP8 = env.APP_STORE_CONNECT_KEY_P8
  const bundleId = env.APPLE_BUNDLE_ID

  if (!keyId || !issuerId || !keyP8 || !bundleId) return 'unknown'

  try {
    const jwt = await generateAppStoreJWT(keyId, issuerId, keyP8, bundleId)

    let res = await fetch(
      `https://api.storekit.itunes.apple.com/inApps/v1/subscriptions/${originalTransactionId}`,
      { headers: { Authorization: `Bearer ${jwt}` } }
    )
    if (res.status === 404) {
      res = await fetch(
        `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/subscriptions/${originalTransactionId}`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      )
    }
    if (!res.ok) return 'unknown'

    const data = await res.json<any>()
    const group = data?.data?.[0]
    const lastTx = group?.lastTransactions?.[0]
    if (!lastTx) return 'unknown'

    const status = lastTx.status
    if (status === 1) return 'active'
    if (status === 3 || status === 4) return 'active'
    return 'expired'
  } catch (err) {
    console.error('[Subscriptions] Apple Server API check failed:', err)
    return 'unknown'
  }
}

async function resolveAppleSubscriptionEnvironment(
  env: Env,
  originalTransactionId: string
): Promise<AppleSubscriptionEnvironment | 'unknown'> {
  const keyId = env.APP_STORE_CONNECT_KEY_ID
  const issuerId = env.APP_STORE_CONNECT_ISSUER_ID
  const keyP8 = env.APP_STORE_CONNECT_KEY_P8
  const bundleId = env.APPLE_BUNDLE_ID

  if (!keyId || !issuerId || !keyP8 || !bundleId) return 'unknown'

  try {
    const jwt = await generateAppStoreJWT(keyId, issuerId, keyP8, bundleId)
    const prodRes = await fetch(
      `https://api.storekit.itunes.apple.com/inApps/v1/subscriptions/${originalTransactionId}`,
      { headers: { Authorization: `Bearer ${jwt}` } }
    )
    if (prodRes.ok) return 'Production'

    const sandboxRes = await fetch(
      `https://api.storekit-sandbox.itunes.apple.com/inApps/v1/subscriptions/${originalTransactionId}`,
      { headers: { Authorization: `Bearer ${jwt}` } }
    )
    if (sandboxRes.ok) return 'Sandbox'
  } catch (err) {
    console.error('[Subscriptions] Apple environment resolve failed:', err)
  }

  return 'unknown'
}

async function generateAppStoreJWT(
  keyId: string, issuerId: string, keyP8: string, bundleId: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const headerB64 = base64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }))
  const payloadB64 = base64url(JSON.stringify({
    iss: issuerId,
    iat: now,
    exp: now + 1200,
    aud: 'appstoreconnect-v1',
    bid: bundleId,
  }))

  const pemBody = keyP8
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))

  const key = await crypto.subtle.importKey(
    'pkcs8', keyData, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  )

  const input = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, input)

  return `${headerB64}.${payloadB64}.${base64url(sig)}`
}

function base64url(input: string | ArrayBuffer): string {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(input)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
