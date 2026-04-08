import type { Env } from './bindings'

export const ONE_HOUR_MS = 60 * 60 * 1000
export const WINDOW_MS = 5 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export interface EventInstance {
  eventId: number
  title: string
  type: string
  date: string
  time: string
  location: string
  startMs: number
  user_id: number | null
  team_id: number | null
}

export function getRecurrencePeriodMs(pattern: string): number | null {
  switch (pattern) {
    case 'daily':
      return DAY_MS
    case 'weekly':
      return 7 * DAY_MS
    case 'biweekly':
      return 14 * DAY_MS
    case 'monthly':
      return 30 * DAY_MS
    case 'yearly':
      return 365 * DAY_MS
    default:
      return null
  }
}

export function parseStartMs(dateStr: string, timeStr: string): number {
  const firstPart = (timeStr || '00:00').split(' - ')[0]?.trim() || '00:00'
  const upper = firstPart.toUpperCase()
  const match = firstPart.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i)
  let hours = 0
  const minutes = match ? parseInt(match[2], 10) || 0 : 0
  if (match) {
    hours = parseInt(match[1], 10) || 0
    if (upper.includes('PM') && hours !== 12) hours += 12
    if (upper.includes('AM') && hours === 12) hours = 0
  }
  const iso = `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00.000Z`
  return new Date(iso).getTime()
}

export function expandRecurringForWindow(events: any[], windowStart: Date, windowEnd: Date): any[] {
  const expanded: any[] = []
  for (const event of events) {
    const pattern = event.recurrence_pattern || event.recurrencePattern || 'never'
    if (pattern === 'never' || !pattern) {
      expanded.push(event)
      continue
    }
    const baseDate = new Date(event.date)
    const endDateRaw = event.recurrence_end_date || event.recurrenceEndDate
    const recurrenceEnd = endDateRaw ? new Date(endDateRaw) : null
    let current = new Date(baseDate)
    const maxDate = new Date(windowEnd)
    let count = 0
    while (current <= maxDate && count < 500) {
      if (current >= windowStart) {
        expanded.push({
          ...event,
          id: event.id,
          date: current.toISOString().slice(0, 10),
          originalEventId: event.id,
        })
        count++
      }
      switch (pattern) {
        case 'daily':
          current.setDate(current.getDate() + 1)
          break
        case 'weekly':
          current.setDate(current.getDate() + 7)
          break
        case 'biweekly':
          current.setDate(current.getDate() + 14)
          break
        case 'monthly':
          current.setMonth(current.getMonth() + 1)
          break
        case 'yearly':
          current.setFullYear(current.getFullYear() + 1)
          break
        default:
          current.setDate(current.getDate() + 1)
          break
      }
    }
  }
  return expanded
}

export async function getEventsInWindow(
  env: Env,
  windowStartMs: number,
  windowEndMs: number,
  typeFilter?: string[] | null,
): Promise<{ instance: EventInstance; userIds: number[] }[]> {
  const now = Date.now()
  const windowStart = new Date(windowStartMs)
  const windowEnd = new Date(windowEndMs)

  const startDate = new Date(windowStartMs - 365 * DAY_MS).toISOString().slice(0, 10)
  const endDate = new Date(windowEndMs).toISOString().slice(0, 10)

  let query: string
  let binds: any[]

  if (typeFilter && typeFilter.length > 0) {
    const placeholders = typeFilter.map(() => '?').join(',')
    query = `SELECT id, user_id, team_id, title, type, date, time, location, recurrence_pattern, recurrence_end_date, start_at, timezone
     FROM calendar_events
     WHERE type IN (${placeholders})
       AND (recurrence_pattern IS NOT NULL AND recurrence_pattern != 'never'
            OR date BETWEEN ? AND ?)`
    binds = [...typeFilter, startDate, endDate]
  } else {
    query = `SELECT id, user_id, team_id, title, type, date, time, location, recurrence_pattern, recurrence_end_date, start_at, timezone
     FROM calendar_events
     WHERE (recurrence_pattern IS NOT NULL AND recurrence_pattern != 'never'
            OR date BETWEEN ? AND ?)`
    binds = [startDate, endDate]
  }

  const allEventsRes = await env.DB.prepare(query).bind(...binds).all<any>()

  const rawEvents = (allEventsRes.results || []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    team_id: r.team_id,
    title: r.title,
    type: r.type,
    date: r.date,
    time: r.time,
    location: r.location,
    recurrence_pattern: r.recurrence_pattern,
    recurrence_end_date: r.recurrence_end_date,
    start_at: r.start_at != null ? Number(r.start_at) : null,
    timezone: r.timezone || null,
  }))

  const instances: EventInstance[] = []

  for (const e of rawEvents) {
    if (typeFilter && typeFilter.length > 0 && !typeFilter.includes(e.type)) continue
    const pattern = e.recurrence_pattern || 'never'

    if (pattern === 'never' || !pattern) {
      const startMs = e.start_at != null ? e.start_at : parseStartMs(e.date, e.time)
      if (startMs >= windowStartMs && startMs <= windowEndMs) {
        instances.push({
          eventId: Number(e.id),
          title: e.title,
          type: e.type,
          date: e.date,
          time: e.time,
          location: e.location,
          startMs,
          user_id: e.user_id ?? null,
          team_id: e.team_id ?? null,
        })
      }
      continue
    }

    if (e.start_at != null) {
      const periodMs = getRecurrencePeriodMs(pattern)
      if (periodMs == null) continue
      let instanceStartMs = e.start_at
      const recurrenceEnd = e.recurrence_end_date ? new Date(e.recurrence_end_date).getTime() : now + 365 * DAY_MS
      let count = 0
      while (instanceStartMs <= windowEndMs + periodMs && instanceStartMs <= recurrenceEnd && count < 500) {
        if (instanceStartMs >= windowStartMs && instanceStartMs <= windowEndMs) {
          const instanceDate = new Date(instanceStartMs)
          instances.push({
            eventId: Number(e.id),
            title: e.title,
            type: e.type,
            date: instanceDate.toISOString().slice(0, 10),
            time: e.time,
            location: e.location,
            startMs: instanceStartMs,
            user_id: e.user_id ?? null,
            team_id: e.team_id ?? null,
          })
        }
        instanceStartMs += periodMs
        count++
      }
      continue
    }

    const expanded = expandRecurringForWindow([e], windowStart, windowEnd)
    for (const ex of expanded) {
      const startMs = parseStartMs(ex.date, ex.time)
      if (startMs >= windowStartMs && startMs <= windowEndMs) {
        const eventIdNum = typeof ex.originalEventId === 'number' ? ex.originalEventId : Number(ex.id)
        if (!Number.isFinite(eventIdNum)) continue
        instances.push({
          eventId: eventIdNum,
          title: ex.title,
          type: ex.type,
          date: ex.date,
          time: ex.time,
          location: ex.location,
          startMs,
          user_id: ex.user_id ?? null,
          team_id: ex.team_id ?? null,
        })
      }
    }
  }

  const uniqueTeamIds = [...new Set(instances.filter(i => i.team_id != null).map(i => i.team_id!))]
  const teamMembersMap: Record<number, number[]> = {}

  if (uniqueTeamIds.length > 0) {
    const membersRes = await env.DB.prepare(
      `SELECT team_id, user_id FROM team_members WHERE team_id IN (${uniqueTeamIds.map(() => '?').join(',')})`
    )
      .bind(...uniqueTeamIds)
      .all<{ team_id: number; user_id: number }>()
    for (const row of membersRes.results || []) {
      if (!teamMembersMap[row.team_id]) teamMembersMap[row.team_id] = []
      teamMembersMap[row.team_id].push(row.user_id)
    }
  }

  const out: { instance: EventInstance; userIds: number[] }[] = []
  for (const inst of instances) {
    let userIds: number[]
    if (inst.user_id != null) {
      userIds = [inst.user_id]
    } else if (inst.team_id != null) {
      userIds = teamMembersMap[inst.team_id] || []
    } else {
      continue
    }
    out.push({ instance: inst, userIds })
  }
  return out
}
