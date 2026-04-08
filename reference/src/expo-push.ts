import type { Env } from './bindings'

export function stringifyPushData(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue
    out[k] = typeof v === 'string' ? v : String(v)
  }
  return out
}

export async function sendExpoPush(
  env: Env,
  token: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  channelId: string,
  logPrefix = '[ExpoPush]',
): Promise<boolean> {
  const payload = {
    to: token,
    title,
    body: body || 'Notification',
    data: stringifyPushData(data),
    sound: 'default' as const,
    priority: 'high' as const,
    channelId,
  }
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    if (!res.ok) {
      console.warn(`${logPrefix} Expo push failed`, res.status, text)
      return false
    }
    const json = JSON.parse(text) as {
      data?: { status: string; message?: string; details?: { error?: string } }[]
      errors?: { code: string; message: string }[]
    }
    if (json.errors?.length) {
      console.warn(`${logPrefix} Expo push request errors:`, JSON.stringify(json.errors))
    }
    if (json.data?.length) {
      for (const ticket of json.data) {
        if (ticket.status === 'error') {
          console.warn(`${logPrefix} Expo push ticket error:`, ticket.message, ticket.details)
          if (ticket.details?.error === 'DeviceNotRegistered') {
            try {
              await env.DB.prepare('DELETE FROM device_tokens WHERE token = ?').bind(token).run()
            } catch (_) {}
          }
          return false
        }
      }
    }
    return true
  } catch (e) {
    console.warn(`${logPrefix} Expo push exception`, e)
    return false
  }
}

export async function sendExpoPushToUserIds(
  env: Env,
  userIds: number[],
  title: string,
  body: string,
  data: Record<string, unknown>,
  channelId: string,
  logPrefix = '[ExpoPush]',
): Promise<void> {
  const unique = [...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0))]
  if (unique.length === 0) return

  const tokensRes = await env.DB
    .prepare(
      `SELECT user_id, token FROM device_tokens WHERE user_id IN (${unique.map(() => '?').join(',')})`,
    )
    .bind(...unique)
    .all<{ user_id: number; token: string }>()

  const rows = tokensRes.results || []
  const seenTokens = new Set<string>()
  for (const row of rows) {
    if (!row.token || seenTokens.has(row.token)) continue
    seenTokens.add(row.token)
    await sendExpoPush(env, row.token, title, body, data, channelId, logPrefix).catch(() => {})
  }
}
