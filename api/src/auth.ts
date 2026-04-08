import type { Env, AuthenticatedUser } from './bindings'
import { jsonResponse } from './http'
import { hashPassword, verifyPassword, validatePassword, validateEmail, formatPasswordHash } from './lib/auth/password'
import { sendEmail, passwordResetEmailHtml, accountDeletionEmailHtml, emailVerificationHtml, getIconAttachment, type SmtpConfig } from './lib/email'
import {
  generateSessionToken,
  createSession,
  deleteSessionByToken,
  calculateSessionExpiration,
} from './lib/auth/session'
import {
  setAuthCookie,
  clearAuthCookie,
  getAuthToken,
} from './lib/auth/cookies'
import { checkRateLimit } from './lib/auth/rate-limit'
import {
  generateOAuthState,
  getGoogleAuthUrl,
  exchangeGoogleCode,
  getGoogleUserFromIdToken,
} from './lib/auth/oauth/google'
import {
  getAppleAuthUrl,
  exchangeAppleCode,
  getAppleUserFromIdToken,
  validateAppleIdToken,
} from './lib/auth/oauth/apple'

export async function getCurrentUserFromSession(
  request: Request,
  env: Env
): Promise<AuthenticatedUser | null> {
  try {
    const token = getAuthToken(request)
    if (!token) {
      return null
    }

    const now = new Date().toISOString()
    const row = await env.DB
      .prepare(
        `SELECT u.id, u.email, u.username, u.mode, u.stat_profile, u.profile_picture_url,
                u.email_verified, u.birthdate, u.chat_disabled, u.parental_consent_at,
                u.subscription_status
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > ?
         LIMIT 1`
      )
      .bind(token, now)
      .first<{
        id: number
        email: string
        username: string | null
        mode: string | null
        stat_profile: string | null
        profile_picture_url: string | null
        email_verified: number
        birthdate: string | null
        chat_disabled: number
        parental_consent_at: string | null
        subscription_status: string | null
      }>()

    if (!row) {
      return null
    }

    return {
      id: String(row.id),
      email: row.email ?? null,
      username: row.username ?? null,
      mode: row.mode ?? null,
      statProfile: row.stat_profile ?? null,
      profilePictureUrl: row.profile_picture_url ?? null,
      emailVerified: row.email_verified === 1,
      birthdate: row.birthdate ?? null,
      chatDisabled: row.chat_disabled === 1,
      parentalConsentAt: row.parental_consent_at ?? null,
      subscriptionStatus: row.subscription_status ?? 'free',
    }
  } catch (error) {
    console.error('Session check error:', error)
    return null
  }
}

async function getOrCreateUser(
  db: D1Database,
  email: string,
  username?: string,
  profilePictureUrl?: string
): Promise<number> {
  const existing = await db
    .prepare('SELECT id FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: number }>()

  if (existing) {
    if (username || profilePictureUrl) {
      const updates: string[] = []
      const values: unknown[] = []

      if (username) {
        updates.push('username = ?')
        values.push(username)
      }
      if (profilePictureUrl) {
        updates.push('profile_picture_url = ?')
        values.push(profilePictureUrl)
      }

      if (updates.length > 0) {
        updates.push('updated_at = ?')
        values.push(new Date().toISOString())
        values.push(existing.id)

        await db
          .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
          .bind(...values)
          .run()
      }
    }
    return existing.id
  }

  const now = new Date().toISOString()
  const result = await db
    .prepare(
      'INSERT INTO users (email, username, email_verified, created_at, updated_at, profile_picture_url) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(
      email,
      username || email.split('@')[0],
      1,
      now,
      now,
      profilePictureUrl || null
    )
    .run()

  return result.meta.last_row_id!
}

async function getOrCreateOAuthAccount(
  db: D1Database,
  userId: number,
  providerId: string,
  accountId: string,
  idToken?: string,
  accessToken?: string,
  refreshToken?: string
): Promise<void> {
  const existing = await db
    .prepare(
      'SELECT id FROM auth_accounts WHERE provider_id = ? AND account_id = ?'
    )
    .bind(providerId, accountId)
    .first<{ id: string }>()

  if (existing) {
    const updates: string[] = []
    const values: unknown[] = []

    if (idToken) {
      updates.push('id_token = ?')
      values.push(idToken)
    }
    if (accessToken) {
      updates.push('access_token = ?')
      values.push(accessToken)
    }
    if (refreshToken) {
      updates.push('refresh_token = ?')
      values.push(refreshToken)
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?')
      values.push(new Date().toISOString())
      values.push(existing.id)

      await db
        .prepare(`UPDATE auth_accounts SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run()
    }
    return
  }

  const now = new Date().toISOString()
  await db
    .prepare(
      'INSERT INTO auth_accounts (id, user_id, account_id, provider_id, id_token, access_token, refresh_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(
      crypto.randomUUID(),
      userId,
      accountId,
      providerId,
      idToken || null,
      accessToken || null,
      refreshToken || null,
      now,
      now
    )
    .run()
}

async function createAuthSession(
  request: Request,
  env: Env,
  userId: number,
  redirectUrl?: string
): Promise<Response> {
  const token = generateSessionToken()
  const expiresAt = calculateSessionExpiration(14)

  const url = new URL(request.url)
  const ipAddress = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For')?.split(',')[0] || null
  const userAgent = request.headers.get('User-Agent') || null

  await createSession(env.DB, userId, token, expiresAt, ipAddress, userAgent)

  const user = await getCurrentUserFromSession(
    new Request(request.url, {
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        Cookie: `auth_session=${token}`,
      },
    }),
    env
  )

  const response = jsonResponse(
    request,
    {
      data: {
        user: {
          id: user?.id,
          email: user?.email,
          name: user?.username,
          image: user?.profilePictureUrl,
        },
        session: {
          token,
          expiresAt,
        },
      },
    },
    { status: 200 }
  )

  const sessionResponse = setAuthCookie(response, token, url.origin)

  if (redirectUrl) {
    let location = redirectUrl
    try {
      const ru = new URL(redirectUrl)
      if (ru.protocol !== 'http:' && ru.protocol !== 'https:') {
        ru.searchParams.set('session_token', token)
        location = ru.toString()
      }
    } catch {
      // ignore
    }
    const redirectResponse = Response.redirect(location, 302)
    return setAuthCookie(redirectResponse, token, url.origin)
  }

  return sessionResponse
}

async function signUpEmail(request: Request, env: Env): Promise<Response> {
  const rateLimit = checkRateLimit(request, 'signUp')
  if (!rateLimit.allowed) {
    return jsonResponse(
      request,
      { error: { message: 'Too many sign-up attempts. Please try again later.' } },
      { status: 429 }
    )
  }

  try {
    const body = await request.json<{ email: string; password: string; name?: string }>()

    if (!validateEmail(body.email)) {
      return jsonResponse(
        request,
        { error: { message: 'Invalid email address' } },
        { status: 400 }
      )
    }

    const passwordValidation = validatePassword(body.password)
    if (!passwordValidation.isValid) {
      return jsonResponse(
        request,
        { error: { message: passwordValidation.error || 'Invalid password' } },
        { status: 400 }
      )
    }

    const existing = await env.DB
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(body.email)
      .first<{ id: number }>()

    if (existing) {
      return jsonResponse(
        request,
        { error: { message: 'An account with this email already exists. Please sign in instead.' } },
        { status: 409 }
      )
    }

    const { salt, iterations, hash } = await hashPassword(body.password)
    const passwordHash = formatPasswordHash(salt, iterations, hash)

    const now = new Date().toISOString()
    const result = await env.DB
      .prepare(
        'INSERT INTO users (email, username, password_hash, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(
        body.email,
        body.name || body.email.split('@')[0],
        passwordHash,
        0,
        now,
        now
      )
      .run()

    const userId = result.meta.last_row_id!

    await env.DB
      .prepare(
        'INSERT INTO auth_accounts (id, user_id, account_id, provider_id, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        crypto.randomUUID(),
        userId,
        body.email,
        'credential',
        passwordHash,
        now,
        now
      )
      .run()

    const verifyToken = crypto.randomUUID()
    const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const verifyId = crypto.randomUUID()
    await env.DB.batch([
      env.DB.prepare("DELETE FROM auth_verifications WHERE identifier = ?").bind(`email_verify:${userId}`),
      env.DB.prepare(
        'INSERT INTO auth_verifications (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(verifyId, `email_verify:${userId}`, verifyToken, verifyExpiresAt, now, now),
    ])
    const appUrl = getAppUrl(request, env)
    const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(verifyToken)}`
    await sendEmail({
      to: body.email,
      subject: 'Verify your email - MyBreakPoint',
      html: emailVerificationHtml(verifyUrl),
      text: `Verify your MyBreakPoint email by opening this link: ${verifyUrl}\n\nThis link expires in 24 hours.`,
      inlineAttachments: [await getIconAttachment()],
    }, getSmtp(env))

    return createAuthSession(request, env, userId)
  } catch (error) {
    console.error('Sign up error:', error)
    return jsonResponse(
      request,
      { error: { message: 'Sign up failed' } },
      { status: 500 }
    )
  }
}

async function signInEmail(request: Request, env: Env): Promise<Response> {
  const rateLimit = checkRateLimit(request, 'signIn')
  if (!rateLimit.allowed) {
    return jsonResponse(
      request,
      { error: { message: 'Too many sign-in attempts. Please try again later.' } },
      { status: 429 }
    )
  }

  try {
    const body = await request.json<{ email: string; password: string }>()

    if (!validateEmail(body.email)) {
      return jsonResponse(
        request,
        { error: { message: 'Invalid email or password' } },
        { status: 400 }
      )
    }

    const user = await env.DB
      .prepare('SELECT id, password_hash FROM users WHERE email = ?')
      .bind(body.email)
      .first<{ id: number; password_hash: string | null }>()

    if (!user || !user.password_hash) {
      return jsonResponse(
        request,
        { error: { message: 'Invalid email or password' } },
        { status: 400 }
      )
    }

    const isValid = await verifyPassword(body.password, user.password_hash)
    if (!isValid) {
      return jsonResponse(
        request,
        { error: { message: 'Invalid email or password' } },
        { status: 400 }
      )
    }

    return createAuthSession(request, env, user.id)
  } catch (error) {
    console.error('Sign in error:', error)
    return jsonResponse(
      request,
      { error: { message: 'Sign in failed' } },
      { status: 500 }
    )
  }
}

async function signInSocial(request: Request, env: Env): Promise<Response> {
  const rateLimit = checkRateLimit(request, 'oauth')
  if (!rateLimit.allowed) {
    return jsonResponse(
      request,
      { error: { message: 'Too many attempts. Please try again later.' } },
      { status: 429 }
    )
  }

  try {
    const body = await request.json<{
      provider: 'google' | 'apple'
      idToken: { token: string }
    }>()

    if (!body.provider || !body.idToken?.token) {
      return jsonResponse(
        request,
        { error: { message: 'Invalid request' } },
        { status: 400 }
      )
    }

    let userInfo: { id: string; email?: string; name?: string; picture?: string }

    if (body.provider === 'google') {
      userInfo = await getGoogleUserFromIdToken(body.idToken.token)
    } else if (body.provider === 'apple') {
      if (!env.APPLE_CLIENT_ID) {
        return jsonResponse(
          request,
          { error: { message: 'Apple OAuth not configured' } },
          { status: 500 }
        )
      }

      const validation = validateAppleIdToken(
        body.idToken.token,
        env.APPLE_CLIENT_ID,
        env.APPLE_BUNDLE_ID
      )

      if (!validation.isValid) {
        try {
          const parts = body.idToken.token.split('.')
          if (parts.length === 3) {
            const payload = JSON.parse(
              atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
            )
            console.error('Apple ID token validation failed:', {
              error: validation.error,
              tokenAud: payload.aud,
              expectedClientId: env.APPLE_CLIENT_ID,
              providedBundleId: env.APPLE_BUNDLE_ID,
            })
          }
        } catch (e) {
          console.error('Apple ID token validation failed:', validation.error)
        }

        return jsonResponse(
          request,
          {
            error: {
              message: 'Invalid Apple ID token',
              details: validation.error,
            },
          },
          { status: 400 }
        )
      }

      const appleUser = getAppleUserFromIdToken(body.idToken.token)
      userInfo = {
        id: appleUser.id,
        email: appleUser.email,
        name: appleUser.name
          ? `${appleUser.name.firstName || ''} ${appleUser.name.lastName || ''}`.trim()
          : undefined,
      }
    } else {
      return jsonResponse(
        request,
        { error: { message: 'Unsupported provider' } },
        { status: 400 }
      )
    }

    if (!userInfo.email) {
      return jsonResponse(
        request,
        { error: { message: 'Email not provided by provider' } },
        { status: 400 }
      )
    }

    const userId = await getOrCreateUser(
      env.DB,
      userInfo.email,
      userInfo.name,
      userInfo.picture
    )

    await getOrCreateOAuthAccount(
      env.DB,
      userId,
      body.provider,
      userInfo.id,
      body.idToken.token
    )

    return createAuthSession(request, env, userId)
  } catch (error) {
    console.error('Social sign in error:', error)
    return jsonResponse(
      request,
      { error: { message: 'Sign in failed' } },
      { status: 500 }
    )
  }
}

function encodeGoogleState(returnTo?: string): string {
  const nonce = generateOAuthState()
  const payload = returnTo ? { n: nonce, r: returnTo } : { n: nonce }
  return btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function decodeGoogleState(state: string | null): { returnTo?: string } | null {
  if (!state) return null
  try {
    const base64 = state.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (state.length % 4)) % 4)
    const payload = JSON.parse(atob(base64)) as { n?: string; r?: string }
    return payload?.r ? { returnTo: payload.r } : null
  } catch {
    return null
  }
}

function isAllowedRedirectUrl(returnTo: string, env: Env): boolean {
  try {
    const u = new URL(returnTo)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (env.WEB_APP_URL) {
      const appUrl = new URL(env.WEB_APP_URL)
      if (u.origin === appUrl.origin) return true
    }
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

function isAllowedAppleNativeReturnTo(returnTo: string): boolean {
  try {
    const u = new URL(returnTo)
    if (u.protocol === 'mybreakpoint:') {
      return u.hostname === 'auth' && u.pathname.replace(/\/$/, '') === '/apple-callback'
    }
    if (u.protocol === 'exp:') {
      return returnTo.includes('apple-callback')
    }
  } catch {
    return false
  }
  return false
}

function isAllowedAppleOAuthReturnTo(returnTo: string, env: Env): boolean {
  return isAllowedRedirectUrl(returnTo, env) || isAllowedAppleNativeReturnTo(returnTo)
}

async function signInGoogleRedirect(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID) {
    return jsonResponse(
      request,
      { error: { message: 'Google OAuth not configured' } },
      { status: 500 }
    )
  }

  const url = new URL(request.url)
  const baseUrl = env.AUTH_URL || url.origin
  const redirectUri = `${baseUrl}/api/auth/callback/google`
  const returnTo = url.searchParams.get('return_to') ?? undefined
  const state = encodeGoogleState(returnTo)

  const authUrl = getGoogleAuthUrl(env.GOOGLE_CLIENT_ID, redirectUri, state)

  return Response.redirect(authUrl, 302)
}

async function callbackGoogle(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return jsonResponse(
      request,
      { error: { message: 'Google OAuth not configured' } },
      { status: 500 }
    )
  }

  try {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error) {
      return jsonResponse(
        request,
        { error: { message: `OAuth error: ${error}` } },
        { status: 400 }
      )
    }

    if (!code) {
      return jsonResponse(
        request,
        { error: { message: 'Authorization code not provided' } },
        { status: 400 }
      )
    }

    const baseUrl = env.AUTH_URL || url.origin
    const redirectUri = `${baseUrl}/api/auth/callback/google`
    const { idToken } = await exchangeGoogleCode(
      code,
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      redirectUri
    )

    const userInfo = await getGoogleUserFromIdToken(idToken)

    if (!userInfo.email) {
      return jsonResponse(
        request,
        { error: { message: 'Email not provided by Google' } },
        { status: 400 }
      )
    }

    const userId = await getOrCreateUser(
      env.DB,
      userInfo.email,
      userInfo.name,
      userInfo.picture
    )

    await getOrCreateOAuthAccount(
      env.DB,
      userId,
      'google',
      userInfo.id,
      idToken
    )

    const decoded = decodeGoogleState(state)
    const redirectUrl =
      decoded?.returnTo && isAllowedRedirectUrl(decoded.returnTo, env)
        ? decoded.returnTo
        : env.WEB_APP_URL || `${url.origin.replace('api.', '')}/login`
    return createAuthSession(request, env, userId, redirectUrl)
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    return jsonResponse(
      request,
      { error: { message: 'Authentication failed' } },
      { status: 500 }
    )
  }
}

async function signInAppleRedirect(request: Request, env: Env): Promise<Response> {
  if (!env.APPLE_CLIENT_ID) {
    return jsonResponse(
      request,
      { error: { message: 'Apple OAuth not configured' } },
      { status: 500 }
    )
  }

  const url = new URL(request.url)
  const baseUrl = env.AUTH_URL || url.origin
  const redirectUri = `${baseUrl}/api/auth/callback/apple`
  const returnTo = url.searchParams.get('return_to') ?? undefined
  const state = encodeGoogleState(returnTo)

  const authUrl = getAppleAuthUrl(env.APPLE_CLIENT_ID, redirectUri, state)

  return Response.redirect(authUrl, 302)
}

async function callbackApple(request: Request, env: Env): Promise<Response> {
  if (!env.APPLE_CLIENT_ID || !env.APPLE_CLIENT_SECRET) {
    return jsonResponse(
      request,
      { error: { message: 'Apple OAuth not configured' } },
      { status: 500 }
    )
  }

  try {
    const formData = await request.formData()
    const code = formData.get('code') as string | null
    const idToken = formData.get('id_token') as string | null
    const state = formData.get('state') as string | null
    const error = formData.get('error') as string | null

    if (error) {
      return jsonResponse(
        request,
        { error: { message: `OAuth error: ${error}` } },
        { status: 400 }
      )
    }

    let finalIdToken = idToken

    if (code && !idToken) {
      const url = new URL(request.url)
      const baseUrl = env.AUTH_URL || url.origin
      const redirectUri = `${baseUrl}/api/auth/callback/apple`
      const result = await exchangeAppleCode(
        code,
        env.APPLE_CLIENT_ID,
        env.APPLE_CLIENT_SECRET,
        redirectUri
      )
      finalIdToken = result.idToken
    }

    if (!finalIdToken) {
      return jsonResponse(
        request,
        { error: { message: 'ID token not provided' } },
        { status: 400 }
      )
    }

    const validation = validateAppleIdToken(
      finalIdToken,
      env.APPLE_CLIENT_ID,
      env.APPLE_BUNDLE_ID
    )

    if (!validation.isValid) {
      console.error('Apple ID token validation failed:', validation.error)
      return jsonResponse(
        request,
        {
          error: {
            message: 'Invalid Apple ID token',
            details: validation.error,
          },
        },
        { status: 400 }
      )
    }

    const appleUser = getAppleUserFromIdToken(finalIdToken)

    if (!appleUser.email) {
      return jsonResponse(
        request,
        { error: { message: 'Email not provided by Apple' } },
        { status: 400 }
      )
    }

    const name = appleUser.name
      ? `${appleUser.name.firstName || ''} ${appleUser.name.lastName || ''}`.trim()
      : undefined
    const userId = await getOrCreateUser(env.DB, appleUser.email, name)

    await getOrCreateOAuthAccount(
      env.DB,
      userId,
      'apple',
      appleUser.id,
      finalIdToken
    )

    const url = new URL(request.url)
    const decoded = decodeGoogleState(state)
    const fallbackWeb = env.WEB_APP_URL || `${url.origin.replace('api.', '')}/login`
    const redirectUrl =
      decoded?.returnTo && isAllowedAppleOAuthReturnTo(decoded.returnTo, env)
        ? decoded.returnTo
        : fallbackWeb
    return createAuthSession(request, env, userId, redirectUrl)
  } catch (error) {
    console.error('Apple OAuth callback error:', error)
    return jsonResponse(
      request,
      { error: { message: 'Authentication failed' } },
      { status: 500 }
    )
  }
}

async function signOut(request: Request, env: Env): Promise<Response> {
  try {
    const token = getAuthToken(request)
    if (token) {
      await deleteSessionByToken(env.DB, token)
    }

    const response = jsonResponse(request, { data: { success: true } }, { status: 200 })
    const url = new URL(request.url)
    return clearAuthCookie(response, url.origin)
  } catch (error) {
    console.error('Sign out error:', error)
    return jsonResponse(
      request,
      { error: { message: 'Sign out failed' } },
      { status: 500 }
    )
  }
}

async function getSession(request: Request, env: Env): Promise<Response> {
  try {
    const user = await getCurrentUserFromSession(request, env)
    if (!user) {
      return jsonResponse(
        request,
        { data: { session: null, user: null } },
        { status: 200 }
      )
    }

    return jsonResponse(
      request,
      {
        data: {
          session: {
            user: {
              id: user.id,
              email: user.email,
              name: user.username,
              image: user.profilePictureUrl,
            },
          },
          user: {
            id: user.id,
            email: user.email,
            name: user.username,
            image: user.profilePictureUrl,
          },
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Get session error:', error)
    return jsonResponse(
      request,
      { error: { message: 'Failed to get session' } },
      { status: 500 }
    )
  }
}

async function me(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }
  return jsonResponse(request, { user }, { status: 200 })
}

function getSmtp(env: Env): SmtpConfig | undefined {
  if (!env.SMTP_HOST) return undefined
  return {
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT || '25', 10),
    username: env.SMTP_USER || '',
    password: env.SMTP_PASS || '',
  }
}

function getAppUrl(request: Request, env: Env): string {
  if (env.WEB_APP_URL) return env.WEB_APP_URL.replace(/\/$/, '')
  const url = new URL(request.url)
  return url.origin.replace('api.', '')
}

async function forgotPassword(request: Request, env: Env): Promise<Response> {
  const rateLimit = checkRateLimit(request, 'signIn')
  if (!rateLimit.allowed) {
    return jsonResponse(request, { error: { message: 'Too many attempts. Please try again later.' } }, { status: 429 })
  }

  try {
    const { email } = await request.json<{ email: string }>()
    if (!email || !validateEmail(email)) {
      return jsonResponse(request, { error: { message: 'Invalid email address' } }, { status: 400 })
    }

    const user = await env.DB
      .prepare('SELECT id, password_hash FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: number; password_hash: string | null }>()

    if (user && user.password_hash) {
      const code = String(Math.floor(100000 + Math.random() * 900000))
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      const id = crypto.randomUUID()
      const now = new Date().toISOString()

      await env.DB.batch([
        env.DB.prepare("DELETE FROM auth_verifications WHERE identifier = ?").bind(`pw_reset:${email}`),
        env.DB.prepare(
          'INSERT INTO auth_verifications (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, `pw_reset:${email}`, code, expiresAt, now, now),
      ])

      await sendEmail({
        to: email,
        subject: 'Reset Your MyBreakPoint Password',
        html: passwordResetEmailHtml(code),
        text: `Your MyBreakPoint password reset code is: ${code}\n\nThis code expires in 15 minutes.`,
        inlineAttachments: [await getIconAttachment()],
      }, getSmtp(env))
    }

    return jsonResponse(request, { message: 'If an account exists with that email, a reset code has been sent.' })
  } catch (error) {
    console.error('Forgot password error:', error)
    return jsonResponse(request, { error: { message: 'Something went wrong' } }, { status: 500 })
  }
}

async function verifyResetCode(request: Request, env: Env): Promise<Response> {
  try {
    const { email, code } = await request.json<{ email: string; code: string }>()
    if (!email || !code) {
      return jsonResponse(request, { error: { message: 'Email and code are required' } }, { status: 400 })
    }

    const row = await env.DB.prepare(
      "SELECT id, value, expires_at FROM auth_verifications WHERE identifier = ?"
    ).bind(`pw_reset:${email}`).first<{ id: string; value: string; expires_at: string }>()

    if (!row || row.value !== code) {
      return jsonResponse(request, { error: { message: 'Invalid code' } }, { status: 400 })
    }

    if (new Date(row.expires_at) < new Date()) {
      await env.DB.prepare("DELETE FROM auth_verifications WHERE id = ?").bind(row.id).run()
      return jsonResponse(request, { error: { message: 'Code has expired. Please request a new one.' } }, { status: 400 })
    }

    const resetToken = crypto.randomUUID()
    const tokenExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    await env.DB.prepare(
      'UPDATE auth_verifications SET identifier = ?, value = ?, expires_at = ?, updated_at = ? WHERE id = ?'
    ).bind(`pw_token:${email}`, resetToken, tokenExpires, new Date().toISOString(), row.id).run()

    return jsonResponse(request, { resetToken })
  } catch (error) {
    console.error('Verify reset code error:', error)
    return jsonResponse(request, { error: { message: 'Something went wrong' } }, { status: 500 })
  }
}

async function resetPassword(request: Request, env: Env): Promise<Response> {
  try {
    const { resetToken, password } = await request.json<{ resetToken: string; password: string }>()
    if (!resetToken || !password) {
      return jsonResponse(request, { error: { message: 'Token and password are required' } }, { status: 400 })
    }

    const validation = validatePassword(password)
    if (!validation.isValid) {
      return jsonResponse(request, { error: { message: validation.error || 'Invalid password' } }, { status: 400 })
    }

    const row = await env.DB.prepare(
      "SELECT id, identifier, expires_at FROM auth_verifications WHERE value = ?"
    ).bind(resetToken).first<{ id: string; identifier: string; expires_at: string }>()

    if (!row || !row.identifier.startsWith('pw_token:')) {
      return jsonResponse(request, { error: { message: 'Invalid or expired reset token' } }, { status: 400 })
    }

    if (new Date(row.expires_at) < new Date()) {
      await env.DB.prepare("DELETE FROM auth_verifications WHERE id = ?").bind(row.id).run()
      return jsonResponse(request, { error: { message: 'Reset token has expired' } }, { status: 400 })
    }

    const email = row.identifier.replace('pw_token:', '')
    const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: number }>()

    if (!user) {
      return jsonResponse(request, { error: { message: 'User not found' } }, { status: 404 })
    }

    const { salt, iterations, hash } = await hashPassword(password)
    const passwordHash = formatPasswordHash(salt, iterations, hash)

    await env.DB.batch([
      env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
        .bind(passwordHash, new Date().toISOString(), user.id),
      env.DB.prepare("UPDATE auth_accounts SET password = ?, updated_at = ? WHERE user_id = ? AND provider_id = 'credential'")
        .bind(passwordHash, new Date().toISOString(), user.id),
      env.DB.prepare('DELETE FROM auth_verifications WHERE id = ?').bind(row.id),
      env.DB.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(user.id),
    ])

    return jsonResponse(request, { message: 'Password has been reset. Please sign in with your new password.' })
  } catch (error) {
    console.error('Reset password error:', error)
    return jsonResponse(request, { error: { message: 'Something went wrong' } }, { status: 500 })
  }
}

async function requestDeleteAccount(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: { message: 'Unauthorized' } }, { status: 401 })
  }

  try {
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    await env.DB.batch([
      env.DB.prepare("DELETE FROM auth_verifications WHERE identifier = ?").bind(`acct_delete:${user.id}`),
      env.DB.prepare(
        'INSERT INTO auth_verifications (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(id, `acct_delete:${user.id}`, token, expiresAt, now, now),
    ])

    const appUrl = getAppUrl(request, env)
    const deleteUrl = `${appUrl}/delete-account/${token}`

    await sendEmail({
      to: user.email!,
      subject: 'Confirm Account Deletion - MyBreakPoint',
      html: accountDeletionEmailHtml(deleteUrl),
      text: `You requested to delete your MyBreakPoint account. Click this link to confirm: ${deleteUrl}\n\nThis link expires in 1 hour.`,
      inlineAttachments: [await getIconAttachment()],
    }, getSmtp(env))

    return jsonResponse(request, { message: 'A confirmation email has been sent.' })
  } catch (error) {
    console.error('Request delete account error:', error)
    return jsonResponse(request, { error: { message: 'Something went wrong' } }, { status: 500 })
  }
}

async function confirmDeleteAccount(request: Request, env: Env, token: string): Promise<Response> {
  try {
    const row = await env.DB.prepare(
      "SELECT id, identifier, expires_at FROM auth_verifications WHERE value = ?"
    ).bind(token).first<{ id: string; identifier: string; expires_at: string }>()

    if (!row || !row.identifier.startsWith('acct_delete:')) {
      return jsonResponse(request, { error: { message: 'Invalid or expired deletion link' } }, { status: 400 })
    }

    if (new Date(row.expires_at) < new Date()) {
      await env.DB.prepare("DELETE FROM auth_verifications WHERE id = ?").bind(row.id).run()
      return jsonResponse(request, { error: { message: 'Deletion link has expired. Please request a new one.' } }, { status: 400 })
    }

    const userId = parseInt(row.identifier.replace('acct_delete:', ''), 10)

    const { results: ownedTeams } = await env.DB.prepare(
      "SELECT team_id FROM team_members WHERE user_id = ? AND role = 'owner'"
    ).bind(userId).all<{ team_id: number }>()

    const stmts: D1PreparedStatement[] = []

    stmts.push(env.DB.prepare('DELETE FROM auth_verifications WHERE id = ?').bind(row.id))
    stmts.push(env.DB.prepare("DELETE FROM auth_verifications WHERE identifier LIKE ?").bind(`%:${userId}`))

    for (const t of ownedTeams || []) {
      stmts.push(env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(t.team_id))
    }

    stmts.push(env.DB.prepare('DELETE FROM matches WHERE user_id = ?').bind(userId))
    stmts.push(env.DB.prepare('DELETE FROM notes WHERE user_id = ?').bind(userId))
    stmts.push(env.DB.prepare('DELETE FROM calendar_events WHERE user_id = ?').bind(userId))

    stmts.push(env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId))

    await env.DB.batch(stmts)

    return jsonResponse(request, { message: 'Your account and all associated data have been permanently deleted.' })
  } catch (error) {
    console.error('Confirm delete account error:', error)
    return jsonResponse(request, { error: { message: 'Something went wrong' } }, { status: 500 })
  }
}

async function verifyEmail(request: Request, env: Env, token: string): Promise<Response> {
  try {
    const row = await env.DB.prepare(
      "SELECT id, identifier, expires_at FROM auth_verifications WHERE value = ?"
    ).bind(token).first<{ id: string; identifier: string; expires_at: string }>()

    if (!row || !row.identifier.startsWith('email_verify:')) {
      return jsonResponse(request, { error: { message: 'Invalid or expired verification link' } }, { status: 400 })
    }

    if (new Date(row.expires_at) < new Date()) {
      await env.DB.prepare("DELETE FROM auth_verifications WHERE id = ?").bind(row.id).run()
      return jsonResponse(request, { error: { message: 'Verification link has expired. Please request a new one.' } }, { status: 400 })
    }

    const userId = parseInt(row.identifier.replace('email_verify:', ''), 10)
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?')
        .bind(new Date().toISOString(), userId),
      env.DB.prepare('DELETE FROM auth_verifications WHERE id = ?').bind(row.id),
    ])

    return jsonResponse(request, { message: 'Your email has been verified. You can now use the app.' })
  } catch (error) {
    console.error('Verify email error:', error)
    return jsonResponse(request, { error: { message: 'Something went wrong' } }, { status: 500 })
  }
}

async function resendVerificationEmail(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: { message: 'Unauthorized' } }, { status: 401 })
  }
  if (user.emailVerified) {
    return jsonResponse(request, { message: 'Email is already verified.' })
  }

  try {
    const userId = Number(user.id)
    const verifyToken = crypto.randomUUID()
    const verifyExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const verifyId = crypto.randomUUID()
    const now = new Date().toISOString()

    await env.DB.batch([
      env.DB.prepare("DELETE FROM auth_verifications WHERE identifier = ?").bind(`email_verify:${userId}`),
      env.DB.prepare(
        'INSERT INTO auth_verifications (id, identifier, value, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(verifyId, `email_verify:${userId}`, verifyToken, verifyExpiresAt, now, now),
    ])

    const appUrl = getAppUrl(request, env)
    const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(verifyToken)}`
    await sendEmail({
      to: user.email!,
      subject: 'Verify your email - MyBreakPoint',
      html: emailVerificationHtml(verifyUrl),
      text: `Verify your MyBreakPoint email by opening this link: ${verifyUrl}\n\nThis link expires in 24 hours.`,
      inlineAttachments: [await getIconAttachment()],
    }, getSmtp(env))

    return jsonResponse(request, { message: 'Verification email sent. Check your inbox.' })
  } catch (error) {
    console.error('Resend verification error:', error)
    return jsonResponse(request, { error: { message: 'Something went wrong' } }, { status: 500 })
  }
}

async function deleteUnverifiedAccount(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: { message: 'Unauthorized' } }, { status: 401 })
  }
  if (user.emailVerified) {
    return jsonResponse(request, { error: { message: 'Only unverified accounts can be deleted this way. Use Settings to delete your account.' } }, { status: 400 })
  }

  const userId = Number(user.id)
  const credentialAccount = await env.DB.prepare(
    "SELECT id FROM auth_accounts WHERE user_id = ? AND provider_id = 'credential'"
  ).bind(userId).first<{ id: string }>()
  if (!credentialAccount) {
    return jsonResponse(request, { error: { message: 'This action is only for email/password accounts.' } }, { status: 400 })
  }

  try {
    await env.DB.prepare("DELETE FROM auth_verifications WHERE identifier LIKE ?").bind(`%:${userId}`).run()
    const { results: ownedTeams } = await env.DB.prepare(
      "SELECT team_id FROM team_members WHERE user_id = ? AND role = 'owner'"
    ).bind(userId).all<{ team_id: number }>()

    const stmts: D1PreparedStatement[] = []
    for (const t of ownedTeams || []) {
      stmts.push(env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(t.team_id))
    }
    stmts.push(env.DB.prepare('DELETE FROM matches WHERE user_id = ?').bind(userId))
    stmts.push(env.DB.prepare('DELETE FROM notes WHERE user_id = ?').bind(userId))
    stmts.push(env.DB.prepare('DELETE FROM calendar_events WHERE user_id = ?').bind(userId))
    stmts.push(env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId))
    await env.DB.batch(stmts)

    const token = getAuthToken(request)
    if (token) {
      await deleteSessionByToken(env.DB, token)
    }
    const response = jsonResponse(request, { message: 'Account deleted. You can sign up again with a different email.' })
    const url = new URL(request.url)
    return clearAuthCookie(response, url.origin)
  } catch (error) {
    console.error('Delete unverified account error:', error)
    return jsonResponse(request, { error: { message: 'Something went wrong' } }, { status: 500 })
  }
}

export async function handleAuth(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  const normalizedPath = pathname.startsWith('/api/auth')
    ? pathname.replace('/api', '')
    : pathname

  if (normalizedPath === '/auth/me' && request.method === 'GET') {
    return me(request, env)
  }

  if (normalizedPath === '/auth/sign-up/email' && request.method === 'POST') {
    return signUpEmail(request, env)
  }

  if (normalizedPath === '/auth/sign-in/email' && request.method === 'POST') {
    return signInEmail(request, env)
  }

  if (normalizedPath === '/auth/sign-in/social' && request.method === 'POST') {
    return signInSocial(request, env)
  }

  if (normalizedPath === '/auth/sign-in/google' && request.method === 'GET') {
    return signInGoogleRedirect(request, env)
  }

  if (normalizedPath === '/auth/callback/google' && request.method === 'GET') {
    return callbackGoogle(request, env)
  }

  if (normalizedPath === '/auth/sign-in/apple' && request.method === 'GET') {
    return signInAppleRedirect(request, env)
  }

  if (normalizedPath === '/auth/callback/apple' && (request.method === 'GET' || request.method === 'POST')) {
    return callbackApple(request, env)
  }

  if (normalizedPath === '/auth/sign-out' && request.method === 'POST') {
    return signOut(request, env)
  }

  if ((normalizedPath === '/auth/session' || normalizedPath === '/auth/get-session') && request.method === 'GET') {
    return getSession(request, env)
  }

  if (normalizedPath === '/auth/forgot-password' && request.method === 'POST') {
    return forgotPassword(request, env)
  }
  if (normalizedPath === '/auth/verify-reset-code' && request.method === 'POST') {
    return verifyResetCode(request, env)
  }
  if (normalizedPath === '/auth/reset-password' && request.method === 'POST') {
    return resetPassword(request, env)
  }

  if (normalizedPath === '/auth/request-delete-account' && request.method === 'POST') {
    return requestDeleteAccount(request, env)
  }
  if (normalizedPath.startsWith('/auth/confirm-delete-account/') && request.method === 'POST') {
    const token = normalizedPath.split('/').pop()!
    return confirmDeleteAccount(request, env, token)
  }

  if (normalizedPath === '/auth/verify-email' && (request.method === 'GET' || request.method === 'POST')) {
    const url = new URL(request.url)
    let token = url.searchParams.get('token')
    if (!token && request.method === 'POST') {
      try {
        const body = (await request.json()) as { token?: string }
        token = body?.token ?? null
      } catch {
        token = null
      }
    }
    if (!token) {
      return jsonResponse(request, { error: { message: 'Verification token is required' } }, { status: 400 })
    }
    return verifyEmail(request, env, token)
  }
  if (normalizedPath === '/auth/resend-verification-email' && request.method === 'POST') {
    return resendVerificationEmail(request, env)
  }
  if (normalizedPath === '/auth/delete-unverified-account' && request.method === 'POST') {
    return deleteUnverifiedAccount(request, env)
  }

  return null
}
