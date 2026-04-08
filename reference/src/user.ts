import type { Env } from './bindings'
import { jsonResponse } from './http'
import { getCurrentUserFromSession } from './auth'
import { containsProfanity } from './profanity-filter'
import { hashPassword, verifyPassword, formatPasswordHash } from './lib/auth/password'
import { sendEmail, parentalConsentEmailHtml } from './lib/email'
import type { SmtpConfig } from './lib/email'

export async function handleUser(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  const currentUser = await getCurrentUserFromSession(request, env)
  if (!currentUser) {
    return jsonResponse(
      request,
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  if (pathname === '/user/profile' && request.method === 'GET') {
    const userId = Number(currentUser.id)
    const [row, oauthRow] = await Promise.all([
      env.DB
        .prepare(
          'SELECT id, email, username, profile_picture_url, mode, stat_profile, created_at, birthdate, chat_disabled, parental_consent_at, subscription_status FROM users WHERE id = ?'
        )
        .bind(userId)
        .first<any>(),
      env.DB
        .prepare(
          "SELECT provider_id FROM auth_accounts WHERE user_id = ? AND provider_id IN ('google', 'apple') LIMIT 1"
        )
        .bind(userId)
        .first<{ provider_id: string }>()
    ])

    if (!row) {
      return jsonResponse(
        request,
        { error: 'User not found' },
        { status: 404 }
      )
    }
    const authProvider = oauthRow?.provider_id ?? null

    return jsonResponse(
      request,
      {
        id: String(row.id),
        email: row.email,
        username: row.username,
        profilePictureUrl: row.profile_picture_url,
        mode: row.mode ?? null,
        statProfile: row.stat_profile ?? null,
        createdAt: row.created_at,
        authProvider,
        birthdate: row.birthdate ?? null,
        chatDisabled: row.chat_disabled === 1,
        parentalConsentAt: row.parental_consent_at ?? null,
        subscriptionStatus: row.subscription_status ?? 'free',
      },
      { status: 200 }
    )
  }

  if (pathname === '/user/profile' && request.method === 'PATCH') {
    let data: any = {}
    try {
      data = await request.json()
    } catch {
      data = {}
    }

    const username = data?.username as string | undefined
    const birthdate = data?.birthdate as string | null | undefined

    if (username !== undefined) {
      if (username.length > 30) {
        return jsonResponse(
          request,
          { error: 'Username too long (max 30 characters)' },
          { status: 400 }
        )
      }

      if (containsProfanity(username)) {
        return jsonResponse(
          request,
          { error: 'Username contains inappropriate language.' },
          { status: 400 }
        )
      }

      await env.DB
        .prepare('UPDATE users SET username = ? WHERE id = ?')
        .bind(username || null, Number(currentUser.id))
        .run()
    }

    if (birthdate !== undefined) {
      if (birthdate !== null && birthdate !== '') {
        const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(birthdate) ? birthdate : null
        if (!isoDate) {
          return jsonResponse(
            request,
            { error: 'Birthdate must be YYYY-MM-DD' },
            { status: 400 }
          )
        }
        const d = new Date(isoDate)
        if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== isoDate) {
          return jsonResponse(
            request,
            { error: 'Invalid birthdate' },
            { status: 400 }
          )
        }
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (d > today) {
          return jsonResponse(
            request,
            { error: 'Birthdate cannot be in the future' },
            { status: 400 }
          )
        }
        const minDate = new Date(today.getFullYear() - 120, 0, 1)
        if (d < minDate) {
          return jsonResponse(
            request,
            { error: 'Birthdate is not valid' },
            { status: 400 }
          )
        }
      }
      await env.DB
        .prepare('UPDATE users SET birthdate = ? WHERE id = ?')
        .bind(birthdate && birthdate !== '' ? birthdate : null, Number(currentUser.id))
        .run()
    }

    const chatDisabled = data?.chatDisabled as boolean | undefined
    const parentalPin = data?.parentalPin as string | undefined
    if (chatDisabled !== undefined) {
      const userId = Number(currentUser.id)
      const parentRow = await env.DB
        .prepare('SELECT parental_pin_hash FROM users WHERE id = ?')
        .bind(userId)
        .first<{ parental_pin_hash: string | null }>()
      const hasPin = !!parentRow?.parental_pin_hash

      if (chatDisabled === true) {
        if (!parentalPin || parentalPin.length < 4 || parentalPin.length > 6 || !/^\d+$/.test(parentalPin)) {
          return jsonResponse(
            request,
            { error: 'Parental PIN required (4-6 digits) to disable chat' },
            { status: 400 }
          )
        }
        if (!hasPin) {
          const { salt, iterations, hash } = await hashPassword(parentalPin)
          const stored = formatPasswordHash(salt, iterations, hash)
          await env.DB.prepare('UPDATE users SET parental_pin_hash = ?, chat_disabled = 1 WHERE id = ?').bind(stored, userId).run()
        } else {
          const valid = await verifyPassword(parentalPin, parentRow!.parental_pin_hash!)
          if (!valid) {
            return jsonResponse(request, { error: 'Incorrect parental PIN' }, { status: 403 })
          }
          await env.DB.prepare('UPDATE users SET chat_disabled = 1 WHERE id = ?').bind(userId).run()
        }
      } else {
        if (!hasPin || !parentalPin) {
          return jsonResponse(
            request,
            { error: 'Enter parental PIN to re-enable chat' },
            { status: 400 }
          )
        }
        const valid = await verifyPassword(parentalPin, parentRow!.parental_pin_hash!)
        if (!valid) {
          return jsonResponse(request, { error: 'Incorrect parental PIN' }, { status: 403 })
        }
        await env.DB.prepare('UPDATE users SET chat_disabled = 0 WHERE id = ?').bind(userId).run()
      }
    }

    return jsonResponse(
      request,
      { message: 'Profile updated' },
      { status: 200 }
    )
  }

  if (pathname === '/user/profile-picture' && request.method === 'DELETE') {
    const oldPicture = await env.DB
      .prepare('SELECT profile_picture_url FROM users WHERE id = ?')
      .bind(Number(currentUser.id))
      .first<{ profile_picture_url: string | null }>()

    const deleteOps: Promise<any>[] = [
      env.DB.prepare('UPDATE users SET profile_picture_url = NULL WHERE id = ?')
        .bind(Number(currentUser.id)).run(),
    ]

    if (oldPicture?.profile_picture_url && env.IMAGES) {
      const oldKey = oldPicture.profile_picture_url.split('/api/images/')[1]
      if (oldKey) {
        deleteOps.push(env.IMAGES.delete(oldKey).catch((e: any) => {
          console.error('Failed to delete old profile picture:', e)
        }))
      }
    }

    await Promise.all(deleteOps)

    return jsonResponse(
      request,
      { message: 'Profile picture removed' },
      { status: 200 }
    )
  }

  if (pathname === '/user/parental-consent/request' && request.method === 'POST') {
    const row = await env.DB
      .prepare('SELECT id, birthdate, parental_consent_at FROM users WHERE id = ?')
      .bind(Number(currentUser.id))
      .first<{ id: number; birthdate: string | null; parental_consent_at: string | null }>()
    if (!row || !row.birthdate) {
      return jsonResponse(request, { error: 'Birth date is required first' }, { status: 400 })
    }
    const birth = new Date(row.birthdate)
    const today = new Date()
    const age = today.getFullYear() - birth.getFullYear() - ((today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) ? 1 : 0)
    if (age >= 13) {
      return jsonResponse(request, { error: 'Parental consent is only for users under 13' }, { status: 400 })
    }
    if (row.parental_consent_at) {
      return jsonResponse(request, { message: 'Consent already given' }, { status: 200 })
    }
    let body: { parentEmail?: string } = {}
    try {
      body = await request.json()
    } catch {
      // ignore
    }
    const parentEmail = typeof body.parentEmail === 'string' ? body.parentEmail.trim() : ''
    if (!parentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
      return jsonResponse(request, { error: 'Valid parent or guardian email is required' }, { status: 400 })
    }
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await env.DB.prepare(
      'INSERT INTO parental_consent_requests (token, user_id, parent_email, expires_at) VALUES (?, ?, ?, ?)'
    )
      .bind(token, row.id, parentEmail, expiresAt)
      .run()
    const apiOrigin = new URL(request.url).origin
    const confirmUrl = `${apiOrigin}/parental-consent/confirm?token=${encodeURIComponent(token)}`
    const smtp: SmtpConfig | undefined = env.SMTP_HOST
      ? {
          host: env.SMTP_HOST,
          port: parseInt(env.SMTP_PORT || '25', 10),
          username: env.SMTP_USER || '',
          password: env.SMTP_PASS || '',
        }
      : undefined
    await sendEmail(
      {
        to: parentEmail,
        subject: 'MyBreakPoint - Parent or guardian consent',
        html: parentalConsentEmailHtml(confirmUrl),
      },
      smtp
    )
    return jsonResponse(request, { message: 'Email sent' }, { status: 200 })
  }

  if (pathname === '/user/onboarding' && request.method === 'GET') {
    const row = await env.DB
      .prepare('SELECT onboarding_completed FROM users WHERE id = ?')
      .bind(Number(currentUser.id))
      .first<{ onboarding_completed: number }>()

    if (!row) {
      return jsonResponse(
        request,
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return jsonResponse(
      request,
      {
        completed: row.onboarding_completed === 1
      },
      { status: 200 }
    )
  }

  if (pathname === '/user/onboarding' && request.method === 'POST') {
    await env.DB
      .prepare('UPDATE users SET onboarding_completed = 1 WHERE id = ?')
      .bind(Number(currentUser.id))
      .run()

    return jsonResponse(
      request,
      { message: 'Onboarding marked as complete' },
      { status: 200 }
    )
  }

  if (pathname === '/user/preferences') {
    if (request.method === 'GET') {
      const row = await env.DB
        .prepare(
          'SELECT mode, stat_profile FROM users WHERE id = ?'
        )
        .bind(Number(currentUser.id))
        .first<any>()

      if (!row) {
        return jsonResponse(
          request,
          { error: 'User not found' },
          { status: 404 }
        )
      }

      return jsonResponse(
        request,
        {
          mode: row.mode ?? null,
          statProfile: row.stat_profile ?? null
        },
        { status: 200 }
      )
    }

    if (request.method === 'PATCH') {
      let data: any = {}
      try {
        data = await request.json()
      } catch {
        data = {}
      }

      const mode = data?.mode as string | null | undefined
      const statProfile = data?.statProfile as
        | string
        | null
        | undefined

      if (mode !== null && mode !== undefined &&
          mode !== 'tennis' && mode !== 'pickleball' && mode !== 'padel') {
        return jsonResponse(
          request,
          { error: 'Invalid mode' },
          { status: 400 }
        )
      }

      if (
        statProfile !== null &&
        statProfile !== undefined &&
        statProfile !== 'basic' &&
        statProfile !== 'intermediate' &&
        statProfile !== 'advanced'
      ) {
        return jsonResponse(
          request,
          { error: 'Invalid stat profile' },
          { status: 400 }
        )
      }

      await env.DB
        .prepare(
          `
          UPDATE users
          SET mode = ?, stat_profile = ?
          WHERE id = ?
        `
        )
        .bind(
          mode ?? null,
          statProfile ?? null,
          Number(currentUser.id)
        )
        .run()

      return jsonResponse(
        request,
        { message: 'Preferences updated' },
        { status: 200 }
      )
    }
  }

  return null
}

export async function handleParentalConsentConfirm(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  if (!token) {
    return jsonResponse(request, { error: 'Missing token' }, { status: 400 })
  }
  const row = await env.DB.prepare(
    'SELECT user_id, expires_at FROM parental_consent_requests WHERE token = ?'
  )
    .bind(token)
    .first<{ user_id: number; expires_at: string }>()
  if (!row) {
    return jsonResponse(request, { error: 'Invalid or expired link' }, { status: 400 })
  }
  if (new Date(row.expires_at) < new Date()) {
    await env.DB.prepare('DELETE FROM parental_consent_requests WHERE token = ?').bind(token).run()
    return jsonResponse(request, { error: 'This link has expired' }, { status: 400 })
  }
  const now = new Date().toISOString()
  await env.DB.prepare('UPDATE users SET parental_consent_at = ? WHERE id = ?')
    .bind(now, row.user_id)
    .run()
  await env.DB.prepare('DELETE FROM parental_consent_requests WHERE token = ?').bind(token).run()
  const appUrl = (env.WEB_APP_URL || url.origin.replace('api.', '')).replace(/\/$/, '')
  const redirectUrl = `${appUrl}?parental_consent=success`
  return Response.redirect(redirectUrl, 302)
}