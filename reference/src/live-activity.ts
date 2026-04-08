import type { Env } from './bindings'
import { jsonResponse } from './http'
import { getCurrentUserFromSession } from './auth'
import { ONE_HOUR_MS, WINDOW_MS, getEventsInWindow, type EventInstance } from './event-utils'

const MATCH_TYPES = ['match', 'tournament']

export async function testLiveActivityPush(request: Request, env: Env): Promise<Response> {
  const testSecret = request.headers.get('X-Test-Secret')
  const allowed =
    (env.LIVE_ACTIVITY_TEST_SECRET && testSecret === env.LIVE_ACTIVITY_TEST_SECRET) ||
    (await getCurrentUserFromSession(request, env)) != null
  if (!allowed) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }
  let data: { token?: string } = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }
  const token = typeof data.token === 'string' ? data.token.trim() : ''
  const result = await sendTestLiveActivityPush(env, token)
  return jsonResponse(request, result, { status: result.ok ? 200 : 400 })
}

export async function registerLiveActivityPushToken(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  let data: { token?: string; apns_environment?: string } = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const token = typeof data.token === 'string' ? data.token.trim() : ''
  if (!token) {
    return jsonResponse(request, { error: 'Missing token' }, { status: 400 })
  }

  const apnsEnv = data.apns_environment === 'sandbox' ? 'sandbox' : 'production'

  await env.DB.prepare(
    `INSERT INTO live_activity_push_tokens (user_id, token, apns_environment, updated_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT (user_id) DO UPDATE SET token = excluded.token, apns_environment = excluded.apns_environment, updated_at = datetime('now')`
  )
    .bind(Number(user.id), token, apnsEnv)
    .run()

  return jsonResponse(request, {}, { status: 200 })
}

export async function getLiveActivityPushTokenStatus(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const row = await env.DB
    .prepare(
      `SELECT token, apns_environment, updated_at
       FROM live_activity_push_tokens
       WHERE user_id = ?
       LIMIT 1`
    )
    .bind(Number(user.id))
    .first<{ token: string; apns_environment: string | null; updated_at: string | null }>()

  return jsonResponse(request, {
    hasToken: !!row?.token,
    apnsEnvironment: row?.apns_environment === 'sandbox' ? 'sandbox' : 'production',
    updatedAt: row?.updated_at ?? null,
  }, { status: 200 })
}

export function isStartInOneHourWindow(startMs: number): boolean {
  const now = Date.now()
  const windowStartMs = now + ONE_HOUR_MS - WINDOW_MS
  const windowEndMs = now + ONE_HOUR_MS + WINDOW_MS
  return startMs >= windowStartMs && startMs <= windowEndMs
}

async function getEventsStartingInOneHour(env: Env): Promise<{ instance: EventInstance; userIds: number[] }[]> {
  const now = Date.now()
  const windowStartMs = now + ONE_HOUR_MS - WINDOW_MS
  const windowEndMs = now + ONE_HOUR_MS + WINDOW_MS
  return getEventsInWindow(env, windowStartMs, windowEndMs, MATCH_TYPES)
}

function hexColor(css: string): string {
  const s = (css || '').replace(/^#/, '').trim()
  return s.length === 6 ? s : '020617'
}

function buildLiveActivityPayload(instance: EventInstance): object {
  const typeLabel = instance.type === 'tournament' ? 'Tournament' : 'Match'
  const subtitle = instance.location
    ? `${instance.date} • ${instance.location}`
    : instance.date
  const contentSubtitle = `${typeLabel} starts` + (subtitle ? ` • ${subtitle}` : '')
  const timestamp = Date.now()

  return {
    aps: {
      event: 'start',
      'content-state': {
        title: instance.title,
        subtitle: contentSubtitle,
        timerEndDateInMilliseconds: instance.startMs,
      },
      timestamp,
      'attributes-type': 'LiveActivityAttributes',
      attributes: {
        name: instance.title || 'Event',
        backgroundColor: hexColor('#020617'),
        titleColor: hexColor('#f8fafc'),
        subtitleColor: 'FFFFFFCC',
        progressViewTint: hexColor('#a855f7'),
        progressViewLabelColor: hexColor('#f8fafc'),
        deepLinkUrl: '/(tabs)/calendar',
        timerType: 'digital',
        padding: 24,
      },
      alert: { title: '', body: '', sound: 'default' },
    },
  }
}

async function signApnsJwt(env: Env): Promise<string> {
  const keyId = env.APNS_KEY_ID
  const teamId = env.APNS_TEAM_ID
  const p8Raw = env.APNS_KEY_P8
  if (!keyId || !teamId || !p8Raw) return ''

  const pem = p8Raw.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')
  const binary = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binary,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const header = { alg: 'ES256', kid: keyId }
  const payload = { iss: teamId, iat: Math.floor(Date.now() / 1000) }
  const encoder = new TextEncoder()
  const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const headerB64 = b64(encoder.encode(JSON.stringify(header)))
  const payloadB64 = b64(encoder.encode(JSON.stringify(payload)))
  const signingInput = headerB64 + '.' + payloadB64

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(signingInput)
  )

  const sigB64 = b64(new Uint8Array(sig))
  return signingInput + '.' + sigB64
}

async function sendApnsLiveActivity(
  deviceToken: string,
  payload: object,
  env: Env,
  production: boolean
): Promise<boolean> {
  const result = await sendApnsLiveActivityWithResponse(deviceToken, payload, env, production)
  return result.ok
}

export async function sendApnsLiveActivityWithResponse(
  deviceToken: string,
  payload: object,
  env: Env,
  production: boolean
): Promise<{ ok: boolean; status: number; apnsReason?: string; body?: string }> {
  const bundleId = env.APNS_BUNDLE_ID
  if (!bundleId) {
    return { ok: false, status: 0, apnsReason: 'Missing APNS_BUNDLE_ID' }
  }

  const jwt = await signApnsJwt(env)
  if (!jwt) {
    return { ok: false, status: 0, apnsReason: 'Failed to sign JWT (check APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_P8)' }
  }

  const url = production
    ? `https://api.push.apple.com/3/device/${deviceToken}`
    : `https://api.sandbox.push.apple.com/3/device/${deviceToken}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'authorization': `bearer ${jwt}`,
      'apns-topic': `${bundleId}.push-type.liveactivity`,
      'apns-push-type': 'liveactivity',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const apnsReason = res.headers.get('apns-id') ? undefined : (res.headers.get('apns-error-reason') ?? undefined)
  const body = await res.text()
  let parsed: { reason?: string } | null = null
  if (body) {
    try {
      parsed = JSON.parse(body) as { reason?: string }
    } catch {
      parsed = null
    }
  }
  return {
    ok: res.ok,
    status: res.status,
    apnsReason: apnsReason ?? parsed?.reason,
    body: body || undefined,
  }
}

function isInvalidTokenResponse(result: { ok: boolean; status: number; apnsReason?: string }): boolean {
  if (result.ok) return false
  const reason = (result.apnsReason ?? '').toLowerCase()
  return (
    reason === 'baddevicetoken' ||
    reason === 'unregistered' ||
    result.status === 410
  )
}

const EVENT_INSTANCE_KEY = (eventId: number, startMs: number) => `${eventId}_${startMs}`

export interface LiveActivityCronReport {
  ok: boolean
  apnsConfigured: boolean
  apnsEnvironment: 'production' | 'sandbox'
  eventsInWindow: number
  tokensFound: number
  pushesSent: number
  errors: string[]
}

export async function runLiveActivityCronWithReport(env: Env): Promise<LiveActivityCronReport> {
  const production = env.APNS_PRODUCTION !== '0' && env.APNS_PRODUCTION !== 'false'
  const report: LiveActivityCronReport = {
    ok: true,
    apnsConfigured: !!(env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_BUNDLE_ID && env.APNS_KEY_P8),
    apnsEnvironment: production ? 'production' : 'sandbox',
    eventsInWindow: 0,
    tokensFound: 0,
    pushesSent: 0,
    errors: [],
  }

  if (!report.apnsConfigured) {
    report.errors.push('APNs not configured (APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_KEY_P8)')
    report.ok = false
    await postCronReportToDiscord(env, report)
    return report
  }

  try {
    await env.DB.batch([
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS live_activity_sent (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          event_instance_key TEXT NOT NULL,
          sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, event_instance_key)
        )`
      ),
      env.DB.prepare(
        `DELETE FROM live_activity_sent WHERE sent_at < datetime('now', '-7 days')`
      ),
    ])
  } catch (e: any) {
    report.errors.push(`DB setup: ${e?.message ?? String(e)}`)
    report.ok = false
    return report
  }

  const list = await getEventsStartingInOneHour(env)
  report.eventsInWindow = list.length

  const eventInstanceKey = (inst: EventInstance) => EVENT_INSTANCE_KEY(inst.eventId, inst.startMs)

  for (const { instance, userIds } of list) {
    if (userIds.length === 0) continue

    const key = eventInstanceKey(instance)
    const tokensRes = await env.DB.prepare(
      `SELECT t.user_id, t.token, t.apns_environment FROM live_activity_push_tokens t
       WHERE t.user_id IN (${userIds.map(() => '?').join(',')})`
    )
      .bind(...userIds)
      .all<{ user_id: number; token: string; apns_environment: string | null }>()

    const rows = tokensRes.results || []
    report.tokensFound += rows.length
    const payload = buildLiveActivityPayload(instance)

    const rowUserIds = rows.map(r => r.user_id)
    const alreadySentSet = new Set<number>()
    if (rowUserIds.length > 0) {
      const sentRes = await env.DB.prepare(
        `SELECT user_id FROM live_activity_sent WHERE event_instance_key = ? AND user_id IN (${rowUserIds.map(() => '?').join(',')})`
      ).bind(key, ...rowUserIds).all<{ user_id: number }>()
      for (const r of sentRes.results || []) alreadySentSet.add(r.user_id)
    }

    const insertStmts: D1PreparedStatement[] = []
    const deleteStmts: D1PreparedStatement[] = []
    for (const row of rows) {
      if (alreadySentSet.has(row.user_id)) continue
      try {
        const tokenProduction = row.apns_environment !== 'sandbox'
        const result = await sendApnsLiveActivityWithResponse(row.token, payload, env, tokenProduction)
        if (result.ok) {
          report.pushesSent += 1
          insertStmts.push(
            env.DB.prepare(
              `INSERT INTO live_activity_sent (user_id, event_instance_key, sent_at) VALUES (?, ?, datetime('now'))
               ON CONFLICT (user_id, event_instance_key) DO NOTHING`
            ).bind(row.user_id, key)
          )
        } else {
          report.errors.push(
            `APNs user ${row.user_id} event ${instance.eventId}: ${result.apnsReason ?? result.body ?? result.status}`
          )
          if (isInvalidTokenResponse(result)) {
            deleteStmts.push(
              env.DB.prepare('DELETE FROM live_activity_push_tokens WHERE user_id = ? AND token = ?')
                .bind(row.user_id, row.token)
            )
          }
        }
      } catch (e: any) {
        report.errors.push(`Send user ${row.user_id}: ${e?.message ?? String(e)}`)
      }
    }
    const batchStmts = [...insertStmts, ...deleteStmts]
    if (batchStmts.length > 0) await env.DB.batch(batchStmts)
  }

  if (report.errors.length > 0) report.ok = false

  await postCronReportToDiscord(env, report)
  return report
}

async function postCronReportToDiscord(env: Env, report: LiveActivityCronReport): Promise<void> {
  const webhook = env.LIVE_ACTIVITY_LOG_WEBHOOK
  if (!webhook || !webhook.startsWith('https://')) return
  try {
    const ts = new Date().toISOString()
    const errText = report.errors.length ? report.errors.join('; ') : 'none'
    const body = [
      `**Live Activity cron** ${ts}`,
      `APNs configured: **${report.apnsConfigured}**`,
      `Server APNS_PRODUCTION: **${report.apnsEnvironment}** (cron sends to each token's env: sandbox + production)`,
      `Events in 55-65min window: **${report.eventsInWindow}**`,
      `Tokens found: **${report.tokensFound}**`,
      `Pushes sent: **${report.pushesSent}**`,
      `Errors: ${errText}`,
    ].join('\n')
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: body.slice(0, 2000) }),
    })
  } catch (_) {
    // ignore webhook failures
  }
}

export async function sendLiveActivityPushesAtOneHour(env: Env): Promise<void> {
  await runLiveActivityCronWithReport(env)
}

function buildTestInstance(): EventInstance {
  const startMs = Date.now() + ONE_HOUR_MS
  const d = new Date(startMs)
  return {
    eventId: 0,
    title: 'Test Match',
    type: 'match',
    date: d.toISOString().slice(0, 10),
    time: '14:00 - 15:00',
    location: 'Test Court',
    startMs,
    user_id: null,
    team_id: null,
  }
}

export async function triggerLiveActivityCron(request: Request, env: Env): Promise<Response> {
  const testSecret = request.headers.get('X-Test-Secret')
  if (!env.LIVE_ACTIVITY_TEST_SECRET || testSecret !== env.LIVE_ACTIVITY_TEST_SECRET) {
    return jsonResponse(request, { error: 'Unauthorized. Set LIVE_ACTIVITY_TEST_SECRET and use X-Test-Secret header.' }, { status: 401 })
  }
  const report = await runLiveActivityCronWithReport(env)
  return jsonResponse(request, report, { status: report.ok ? 200 : 500 })
}

export async function sendTestLiveActivityPush(
  env: Env,
  token: string
): Promise<{ ok: boolean; status: number; apnsReason?: string; body?: string; message?: string; apnsEnvironment?: string }> {
  if (!token || !token.trim()) {
    return { ok: false, status: 0, message: 'Missing token' }
  }
  if (!env.APNS_KEY_ID || !env.APNS_TEAM_ID || !env.APNS_BUNDLE_ID || !env.APNS_KEY_P8) {
    return {
      ok: false,
      status: 0,
      message: 'APNs not configured. Set APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_KEY_P8.',
    }
  }
  const production = env.APNS_PRODUCTION !== '0' && env.APNS_PRODUCTION !== 'false'
  const instance = buildTestInstance()
  const payload = buildLiveActivityPayload(instance)
  try {
    const result = await sendApnsLiveActivityWithResponse(token.trim(), payload, env, production)
    return { ...result, apnsEnvironment: production ? 'production' : 'sandbox' }
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      message: e?.message ?? String(e),
    }
  }
}
