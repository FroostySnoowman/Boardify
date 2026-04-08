import type { Env } from './bindings'
import { sendExpoPush } from './expo-push'
import { WINDOW_MS, getEventsInWindow, type EventInstance } from './event-utils'

const REMINDER_OFFSETS = [
  { ms: 24 * 60 * 60 * 1000, label: '24 hours', suffix: '24h' },
  { ms: 12 * 60 * 60 * 1000, label: '12 hours', suffix: '12h' },
  { ms: 60 * 60 * 1000, label: '1 hour', suffix: '1h' },
  { ms: 30 * 60 * 1000, label: '30 minutes', suffix: '30m' },
] as const

function reminderKey(eventId: number, startMs: number, suffix: string): string {
  return `${eventId}_${startMs}_${suffix}`
}

export async function sendEventReminderPushes(env: Env): Promise<void> {
  try {
    await env.DB.batch([
      env.DB.prepare(
        `CREATE TABLE IF NOT EXISTS event_reminder_sent (
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          reminder_key TEXT NOT NULL,
          sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, reminder_key)
        )`
      ),
      env.DB.prepare(
        `DELETE FROM event_reminder_sent WHERE sent_at < datetime('now', '-7 days')`
      ),
    ])
  } catch (e: any) {
    console.error('[EventReminders] DB setup failed', e?.message ?? String(e))
    return
  }

  for (const offset of REMINDER_OFFSETS) {
    const now = Date.now()
    const windowStartMs = now + offset.ms - WINDOW_MS
    const windowEndMs = now + offset.ms + WINDOW_MS

    let list: { instance: EventInstance; userIds: number[] }[]
    try {
      list = await getEventsInWindow(env, windowStartMs, windowEndMs)
    } catch (e: any) {
      console.error(`[EventReminders] getEventsInWindow (${offset.suffix}) failed`, e?.message ?? String(e))
      continue
    }

    for (const { instance, userIds } of list) {
      if (userIds.length === 0) continue

      const key = reminderKey(instance.eventId, instance.startMs, offset.suffix)

      // Exclude users who RSVP'd "no" for team events
      let excludedUserIds = new Set<number>()
      if (instance.team_id != null) {
        try {
          const rsvpRes = await env.DB.prepare(
            `SELECT user_id FROM calendar_event_rsvps WHERE event_id = ? AND response = 'no'`
          ).bind(instance.eventId).all<{ user_id: number }>()
          for (const r of rsvpRes.results || []) excludedUserIds.add(r.user_id)
        } catch (_) {}
      }

      const targetUserIds = userIds.filter(uid => !excludedUserIds.has(uid))
      if (targetUserIds.length === 0) continue

      const tokensRes = await env.DB.prepare(
        `SELECT user_id, token FROM device_tokens WHERE user_id IN (${targetUserIds.map(() => '?').join(',')})`
      )
        .bind(...targetUserIds)
        .all<{ user_id: number; token: string }>()

      const rows = tokensRes.results || []
      if (rows.length === 0) continue

      const rowUserIds = [...new Set(rows.map(r => r.user_id))]
      const alreadySentSet = new Set<number>()
      if (rowUserIds.length > 0) {
        const sentRes = await env.DB.prepare(
          `SELECT user_id FROM event_reminder_sent WHERE reminder_key = ? AND user_id IN (${rowUserIds.map(() => '?').join(',')})`
        ).bind(key, ...rowUserIds).all<{ user_id: number }>()
        for (const r of sentRes.results || []) alreadySentSet.add(r.user_id)
      }

      const insertStmts: D1PreparedStatement[] = []

      for (const row of rows) {
        if (alreadySentSet.has(row.user_id)) continue

        const body = `${instance.title} starts in ${offset.label}${instance.location ? ` \u2022 ${instance.location}` : ''}`
        const data: Record<string, unknown> = {
          type: 'event',
          eventId: String(instance.eventId),
          eventTitle: instance.title,
          date: instance.date,
          time: instance.time,
        }
        if (instance.team_id != null) data.teamId = String(instance.team_id)

        const ok = await sendExpoPush(env, row.token, 'Event Reminder', body, data, 'event-reminders', '[EventReminders]')

        if (ok) {
          alreadySentSet.add(row.user_id)
          insertStmts.push(
            env.DB.prepare(
              `INSERT INTO event_reminder_sent (user_id, reminder_key, sent_at) VALUES (?, ?, datetime('now'))
               ON CONFLICT (user_id, reminder_key) DO NOTHING`
            ).bind(row.user_id, key)
          )
        }
      }

      if (insertStmts.length > 0) {
        try {
          await env.DB.batch(insertStmts)
        } catch (_) {}
      }
    }
  }
}
