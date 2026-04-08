import type { Env } from './bindings'
import { jsonResponse } from './http'
import { getCurrentUserFromSession } from './auth'

function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function parseDateTimeStr(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [h, min] = (timeStr || '00:00').split(':').map(Number)
  return new Date(y, m - 1, d, h || 0, min || 0)
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const COLOR_MAP: Record<string, string> = {
  match: 'bg-red-500',
  practice: 'bg-blue-500',
  tournament: 'bg-purple-500',
  other: 'bg-gray-500'
}

function toIso(value: any): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  const d = new Date(value)
  if (!isNaN(d.getTime())) return d.toISOString()
  return String(value)
}

function parseIntOrNull(s: string | undefined | null): number | null {
  if (s == null) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

function validateDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (
    dt.getFullYear() !== y ||
    dt.getMonth() !== mo - 1 ||
    dt.getDate() !== d
  ) {
    return null
  }
  return `${m[1]}-${m[2]}-${m[3]}`
}

async function getRole(env: Env, teamId: number, userId: number): Promise<string | null> {
  const row = await env.DB
    .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
    .bind(teamId, userId)
    .first<{ role: string }>()
  return row ? row.role : null
}

function eventToDict(r: any) {
  const date =
    typeof r.date === 'string'
      ? r.date
      : r.date
      ? formatDateStr(new Date(r.date))
      : null

  const recurrenceEndDate =
    typeof r.recurrence_end_date === 'string'
      ? r.recurrence_end_date
      : r.recurrence_end_date
      ? formatDateStr(new Date(r.recurrence_end_date))
      : null

  return {
    id: String(r.id),
    userId: r.user_id != null ? String(r.user_id) : null,
    teamId: r.team_id != null ? String(r.team_id) : null,
    title: r.title,
    type: r.type,
    date,
    time: r.time,
    location: r.location,
    color: r.color,
    createdBy: r.created_by != null ? String(r.created_by) : null,
    editable: !!r.editable,
    courtNumber: r.court_number != null ? r.court_number : null,
    recurrencePattern: r.recurrence_pattern || 'never',
    recurrenceEndDate: recurrenceEndDate,
    startAt: r.start_at != null ? Number(r.start_at) : null,
    timezone: r.timezone || null,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at)
  }
}

function expandRecurringEvents(events: any[]): any[] {
  const expanded: any[] = []
  const now = new Date()
  const displayMaxDate = new Date()
  displayMaxDate.setFullYear(displayMaxDate.getFullYear() + 1)
  
  const MAX_INSTANCES = 500

  for (const event of events) {
    const baseDate = parseDateStr(event.date)
    const recurrencePattern = event.recurrencePattern || 'never'
    const recurrenceEndDate = event.recurrenceEndDate 
      ? parseDateStr(event.recurrenceEndDate)
      : null

    if (recurrencePattern === 'never' || !recurrencePattern) {
      expanded.push(event)
      continue
    }

    let currentDate = new Date(baseDate)
    const maxDate = new Date()
    maxDate.setFullYear(maxDate.getFullYear() + 5)
    const endDate = recurrenceEndDate && recurrenceEndDate < maxDate 
      ? (recurrenceEndDate < displayMaxDate ? recurrenceEndDate : displayMaxDate)
      : displayMaxDate

    let instanceCount = 0
    while (currentDate <= endDate && currentDate <= displayMaxDate && instanceCount < MAX_INSTANCES) {
      if (currentDate >= now || currentDate >= baseDate) {
        expanded.push({
          ...event,
          id: `${event.id}_${formatDateStr(currentDate)}`,
          date: formatDateStr(currentDate),
          originalEventId: event.id,
          isRecurringInstance: true
        })
        instanceCount++
      }

      switch (recurrencePattern) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + 1)
          break
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7)
          break
        case 'biweekly':
          currentDate.setDate(currentDate.getDate() + 14)
          break
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1)
          break
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + 1)
          break
        default:
          break
      }
    }
  }

  return expanded.sort((a, b) => {
    const dateA = parseDateTimeStr(a.date, a.time.split(' - ')[0] || '00:00')
    const dateB = parseDateTimeStr(b.date, b.time.split(' - ')[0] || '00:00')
    return dateA.getTime() - dateB.getTime()
  })
}

async function listPersonalEvents(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const res = await env.DB
    .prepare(
      'SELECT * FROM calendar_events WHERE user_id = ? ORDER BY date, time'
    )
    .bind(Number(user.id))
    .all<any>()

  const events = (res.results || []).map(eventToDict)
  return jsonResponse(request, { events }, { status: 200 })
}

async function createPersonalEvent(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const title = (data?.title ?? '').trim()
  const typ = (data?.type ?? '').trim()
  const dateRaw = data?.date as string | undefined
  const time = (data?.time ?? '00:00').trim()
  const location = (data?.location ?? '').trim()

  if (!(typ in COLOR_MAP)) {
    return jsonResponse(request, { error: 'Invalid event type' }, { status: 400 })
  }
  if (!(title && dateRaw && time)) {
    return jsonResponse(request, { error: 'Missing required fields' }, { status: 400 })
  }

  const date = validateDate(dateRaw)
  if (!date) {
    return jsonResponse(request, { error: 'Invalid date format' }, { status: 400 })
  }

  const color = COLOR_MAP[typ]
  const courtNumber = data?.courtNumber != null ? parseIntOrNull(String(data.courtNumber)) : null
  const recurrencePattern = (data?.recurrencePattern || 'never').trim()
  const recurrenceEndDateRaw = data?.recurrenceEndDate as string | undefined
  const recurrenceEndDate = recurrenceEndDateRaw && recurrencePattern !== 'never'
    ? validateDate(recurrenceEndDateRaw)
    : null
  const startAt = data?.startAt != null && Number.isFinite(Number(data.startAt)) ? Number(data.startAt) : null
  const timezone = typeof data?.timezone === 'string' ? data.timezone.trim() || null : null

  const res = await env.DB
    .prepare(
      `
      INSERT INTO calendar_events
        (user_id, title, type, date, time, location, color, created_by, editable, court_number, recurrence_pattern, recurrence_end_date, start_at, timezone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      RETURNING *
    `
    )
    .bind(
      Number(user.id),
      title,
      typ,
      date,
      time,
      location,
      color,
      Number(user.id),
      courtNumber,
      recurrencePattern,
      recurrenceEndDate,
      startAt,
      timezone
    )
    .all<any>()

  const rec = res.results?.[0]
  if (!rec) {
    return jsonResponse(request, { error: 'Could not create event' }, { status: 500 })
  }

  return jsonResponse(request, { event: eventToDict(rec) }, { status: 201 })
}

async function getEvent(request: Request, env: Env, eventId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const eventIdNum = parseIntOrNull(eventId)
  if (eventIdNum == null) {
    return jsonResponse(request, { error: 'Invalid event id' }, { status: 400 })
  }

  const rec = await env.DB
    .prepare('SELECT * FROM calendar_events WHERE id = ?')
    .bind(eventIdNum)
    .first<any>()

  if (!rec) {
    return jsonResponse(request, { error: 'Event not found' }, { status: 404 })
  }

  const userId = Number(user.id)

  if (rec.user_id === userId) {
  } else if (rec.team_id != null) {
    const role = await getRole(env, rec.team_id, userId)
    if (!role) {
      return jsonResponse(
        request,
        { error: 'Not authorized to view this event' },
        { status: 403 }
      )
    }
  } else {
    return jsonResponse(
      request,
      { error: 'Not authorized to view this event' },
      { status: 403 }
    )
  }

  return jsonResponse(request, { event: eventToDict(rec) }, { status: 200 })
}

async function updateEvent(request: Request, env: Env, eventId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const eventIdNum = parseIntOrNull(eventId)
  if (eventIdNum == null) {
    return jsonResponse(request, { error: 'Invalid event id' }, { status: 400 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const rec = await env.DB
    .prepare('SELECT * FROM calendar_events WHERE id = ?')
    .bind(eventIdNum)
    .first<any>()

  if (!rec) {
    return jsonResponse(request, { error: 'Event not found' }, { status: 404 })
  }

  if (!rec.editable) {
    return jsonResponse(
      request,
      { error: 'This event cannot be edited' },
      { status: 403 }
    )
  }

  const userId = Number(user.id)

  if (rec.user_id === userId) {
  } else if (rec.team_id != null) {
    const role = await getRole(env, rec.team_id, userId)
    if (!role || (role !== 'Owner' && role !== 'Coach')) {
      return jsonResponse(
        request,
        { error: 'Not authorized to edit this event' },
        { status: 403 }
      )
    }
  } else {
    return jsonResponse(
      request,
      { error: 'Not authorized to edit this event' },
      { status: 403 }
    )
  }

  const title = (data?.title ?? rec.title).trim()
  const typ = (data?.type ?? rec.type).trim()
  const dateRaw =
    data?.date ??
    (typeof rec.date === 'string'
      ? rec.date
      : rec.date
      ? formatDateStr(new Date(rec.date))
      : null)
  const time = (data?.time ?? rec.time).trim()
  const location = (data?.location ?? rec.location).trim()

  if (!(typ in COLOR_MAP)) {
    return jsonResponse(request, { error: 'Invalid event type' }, { status: 400 })
  }

  const date = validateDate(dateRaw)
  if (!date) {
    return jsonResponse(request, { error: 'Invalid date format' }, { status: 400 })
  }

  const color = COLOR_MAP[typ]
  const courtNumber = data?.courtNumber != null ? parseIntOrNull(String(data.courtNumber)) : null
  const recurrencePattern = (data?.recurrencePattern ?? 'never').trim()
  const recurrenceEndDateRaw = data?.recurrenceEndDate as string | undefined
  const recurrenceEndDate = recurrenceEndDateRaw && recurrencePattern !== 'never'
    ? validateDate(recurrenceEndDateRaw)
    : null
  const startAt = data?.startAt != null && Number.isFinite(Number(data.startAt)) ? Number(data.startAt) : null
  const timezone = typeof data?.timezone === 'string' ? data.timezone.trim() || null : null

  const res = await env.DB
    .prepare(
      `
      UPDATE calendar_events
      SET title = ?, type = ?, date = ?, time = ?,
          location = ?, color = ?, court_number = COALESCE(?, court_number), 
          recurrence_pattern = ?, recurrence_end_date = ?, start_at = ?, timezone = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING *
    `
    )
    .bind(title, typ, date, time, location, color, courtNumber, recurrencePattern, recurrenceEndDate, startAt, timezone, eventIdNum)
    .all<any>()

  const updated = res.results?.[0]
  if (!updated) {
    return jsonResponse(request, { error: 'Update failed' }, { status: 500 })
  }

  return jsonResponse(request, { event: eventToDict(updated) }, { status: 200 })
}

async function deleteEvent(request: Request, env: Env, eventId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const eventIdNum = parseIntOrNull(eventId)
  if (eventIdNum == null) {
    return jsonResponse(request, { error: 'Invalid event id' }, { status: 400 })
  }

  const rec = await env.DB
    .prepare(
      'SELECT user_id, team_id, editable FROM calendar_events WHERE id = ?'
    )
    .bind(eventIdNum)
    .first<any>()

  if (!rec) {
    return jsonResponse(request, { error: 'Event not found' }, { status: 404 })
  }

  if (!rec.editable) {
    return jsonResponse(
      request,
      { error: 'This event cannot be deleted' },
      { status: 403 }
    )
  }

  const userId = Number(user.id)

  if (rec.user_id === userId) {
  } else if (rec.team_id != null) {
    const role = await getRole(env, rec.team_id, userId)
    if (!role || (role !== 'Owner' && role !== 'Coach')) {
      return jsonResponse(
        request,
        { error: 'Not authorized to delete this event' },
        { status: 403 }
      )
    }
  } else {
    return jsonResponse(
      request,
      { error: 'Not authorized to delete this event' },
      { status: 403 }
    )
  }

  await env.DB
    .prepare('DELETE FROM calendar_events WHERE id = ?')
    .bind(eventIdNum)
    .run()

  return jsonResponse(request, { deleted: true }, { status: 200 })
}

async function rsvpEvent(request: Request, env: Env, eventId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const response = (data?.response ?? '').trim()

  if (response !== 'yes' && response !== 'no') {
    return jsonResponse(request, { error: 'Invalid RSVP response' }, { status: 400 })
  }

  const eventIdNum = parseIntOrNull(eventId)
  if (eventIdNum == null) {
    return jsonResponse(request, { error: 'Invalid event id' }, { status: 400 })
  }

  const rec = await env.DB
    .prepare('SELECT user_id, team_id FROM calendar_events WHERE id = ?')
    .bind(eventIdNum)
    .first<any>()

  if (!rec) {
    return jsonResponse(request, { error: 'Event not found' }, { status: 404 })
  }

  const userId = Number(user.id)

  if (rec.team_id != null) {
    const role = await getRole(env, rec.team_id, userId)
    if (!role) {
      return jsonResponse(
        request,
        { error: 'Not authorized to RSVP to this event' },
        { status: 403 }
      )
    }
  } else if (rec.user_id !== userId) {
    return jsonResponse(
      request,
      { error: 'Not authorized to RSVP to this event' },
      { status: 403 }
    )
  }

  await env.DB
    .prepare(
      `
      INSERT INTO calendar_event_rsvps (event_id, user_id, response)
      VALUES (?, ?, ?)
      ON CONFLICT(event_id, user_id) DO UPDATE
        SET response = excluded.response,
            updated_at = CURRENT_TIMESTAMP
    `
    )
    .bind(eventIdNum, userId, response)
    .run()

  return jsonResponse(request, { message: 'RSVP recorded' }, { status: 200 })
}

async function removeRsvp(request: Request, env: Env, eventId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const eventIdNum = parseIntOrNull(eventId)
  if (eventIdNum == null) {
    return jsonResponse(request, { error: 'Invalid event id' }, { status: 400 })
  }

  const exists = await env.DB
    .prepare('SELECT 1 AS ok FROM calendar_events WHERE id = ?')
    .bind(eventIdNum)
    .first<any>()

  if (!exists) {
    return jsonResponse(request, { error: 'Event not found' }, { status: 404 })
  }

  await env.DB
    .prepare(
      'DELETE FROM calendar_event_rsvps WHERE event_id = ? AND user_id = ?'
    )
    .bind(eventIdNum, Number(user.id))
    .run()

  return jsonResponse(request, { message: 'RSVP removed' }, { status: 200 })
}

async function listRsvps(request: Request, env: Env, eventId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const eventIdNum = parseIntOrNull(eventId)
  if (eventIdNum == null) {
    return jsonResponse(request, { error: 'Invalid event id' }, { status: 400 })
  }

  const rec = await env.DB
    .prepare('SELECT user_id, team_id FROM calendar_events WHERE id = ?')
    .bind(eventIdNum)
    .first<any>()

  if (!rec) {
    return jsonResponse(request, { error: 'Event not found' }, { status: 404 })
  }

  const userId = Number(user.id)

  if (rec.team_id != null) {
    const role = await getRole(env, rec.team_id, userId)
    if (!role) {
      return jsonResponse(
        request,
        { error: 'Not authorized to view RSVPs' },
        { status: 403 }
      )
    }
  } else if (rec.user_id !== userId) {
    return jsonResponse(
      request,
      { error: 'Not authorized to view RSVPs' },
      { status: 403 }
    )
  }

  const res = await env.DB
    .prepare(
      'SELECT user_id, response FROM calendar_event_rsvps WHERE event_id = ?'
    )
    .bind(eventIdNum)
    .all<any>()

  const rows = res.results || []
  const yes = rows
    .filter((r: any) => r.response === 'yes')
    .map((r: any) => String(r.user_id))
  const no = rows
    .filter((r: any) => r.response === 'no')
    .map((r: any) => String(r.user_id))

  return jsonResponse(request, { yes, no }, { status: 200 })
}

async function listRsvpsBulk(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const url = new URL(request.url)
  const eventIdsParam = url.searchParams.get('eventIds')
  if (!eventIdsParam) {
    return jsonResponse(request, { error: 'Missing eventIds parameter' }, { status: 400 })
  }

  let eventIds: number[]
  try {
    eventIds = JSON.parse(eventIdsParam).map((id: string | number) => parseInt(String(id), 10)).filter((id: number) => !isNaN(id))
  } catch {
    return jsonResponse(request, { error: 'Invalid eventIds format' }, { status: 400 })
  }

  if (eventIds.length === 0) {
    return jsonResponse(request, { rsvps: {} }, { status: 200 })
  }

  const placeholders = eventIds.map(() => '?').join(',')
  const res = await env.DB
    .prepare(
      `SELECT event_id, user_id, response FROM calendar_event_rsvps WHERE event_id IN (${placeholders})`
    )
    .bind(...eventIds)
    .all<any>()

  const rsvpsMap: Record<number, { yes: string[]; no: string[] }> = {}
  
  eventIds.forEach(id => {
    rsvpsMap[id] = { yes: [], no: [] }
  })

  const rows = res.results || []
  rows.forEach((r: any) => {
    const eventId = r.event_id
    if (!rsvpsMap[eventId]) {
      rsvpsMap[eventId] = { yes: [], no: [] }
    }
    const userId = String(r.user_id)
    if (r.response === 'yes') {
      rsvpsMap[eventId].yes.push(userId)
    } else if (r.response === 'no') {
      rsvpsMap[eventId].no.push(userId)
    }
  })

  return jsonResponse(request, { rsvps: rsvpsMap }, { status: 200 })
}

async function listAllEvents(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)

  const teamsRes = await env.DB
    .prepare(
      `SELECT DISTINCT tm.team_id 
       FROM team_members tm 
       WHERE tm.user_id = ?`
    )
    .bind(uid)
    .all<{ team_id: number }>()

  const teamIds = (teamsRes.results || []).map(t => t.team_id)

  const [personalRes, teamEventsRes] = await Promise.all([
    env.DB
      .prepare('SELECT * FROM calendar_events WHERE user_id = ? ORDER BY date, time')
      .bind(uid)
      .all<any>(),
    teamIds.length > 0
      ? env.DB
          .prepare(
            `SELECT * FROM calendar_events WHERE team_id IN (${teamIds.map(() => '?').join(',')}) ORDER BY date, time`
          )
          .bind(...teamIds)
          .all<any>()
      : Promise.resolve({ results: [] } as any)
  ])

  const personalEvents = (personalRes.results || []).map(eventToDict)
  const teamEvents = (teamEventsRes.results || []).map(eventToDict)

  const allEvents = [...personalEvents, ...teamEvents]
  allEvents.sort((a, b) => {
    const dateA = parseDateTimeStr(a.date, a.time.split(' - ')[0] || '00:00')
    const dateB = parseDateTimeStr(b.date, b.time.split(' - ')[0] || '00:00')
    return dateA.getTime() - dateB.getTime()
  })

  return jsonResponse(request, { events: allEvents }, { status: 200 })
}

async function listTeamEvents(
  request: Request,
  env: Env,
  teamId: string
): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  if (teamIdNum == null) {
    return jsonResponse(request, { error: 'Invalid team id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (!role) {
    return jsonResponse(
      request,
      { error: 'Not authorized to view team events' },
      { status: 403 }
    )
  }

  const res = await env.DB
    .prepare(
      'SELECT * FROM calendar_events WHERE team_id = ? ORDER BY date, time'
    )
    .bind(teamIdNum)
    .all<any>()

  const events = (res.results || []).map(eventToDict)
  return jsonResponse(request, { events }, { status: 200 })
}

async function createTeamEvent(
  request: Request,
  env: Env,
  teamId: string
): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  if (teamIdNum == null) {
    return jsonResponse(request, { error: 'Invalid team id' }, { status: 400 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const title = (data?.title ?? '').trim()
  const typ = (data?.type ?? '').trim()
  const dateRaw = data?.date as string | undefined
  const time = (data?.time ?? '00:00').trim()
  const location = (data?.location ?? '').trim()

  if (!(typ in COLOR_MAP)) {
    return jsonResponse(request, { error: 'Invalid event type' }, { status: 400 })
  }
  if (!(title && dateRaw && time)) {
    return jsonResponse(request, { error: 'Missing required fields' }, { status: 400 })
  }

  const date = validateDate(dateRaw)
  if (!date) {
    return jsonResponse(request, { error: 'Invalid date format' }, { status: 400 })
  }

  const color = COLOR_MAP[typ]
  const courtNumber = data?.courtNumber != null ? parseIntOrNull(String(data.courtNumber)) : null
  const recurrencePattern = (data?.recurrencePattern || 'never').trim()
  const recurrenceEndDateRaw = data?.recurrenceEndDate as string | undefined
  const recurrenceEndDate = recurrenceEndDateRaw && recurrencePattern !== 'never'
    ? validateDate(recurrenceEndDateRaw)
    : null
  const startAt = data?.startAt != null && Number.isFinite(Number(data.startAt)) ? Number(data.startAt) : null
  const timezone = typeof data?.timezone === 'string' ? data.timezone.trim() || null : null

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (!role || (role !== 'Owner' && role !== 'Coach')) {
    return jsonResponse(
      request,
      { error: 'Not authorized to create team events' },
      { status: 403 }
    )
  }

  const res = await env.DB
    .prepare(
      `
      INSERT INTO calendar_events
        (team_id, title, type, date, time, location, color, created_by, editable, court_number, recurrence_pattern, recurrence_end_date, start_at, timezone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
      RETURNING *
    `
    )
    .bind(
      teamIdNum,
      title,
      typ,
      date,
      time,
      location,
      color,
      Number(user.id),
      courtNumber,
      recurrencePattern,
      recurrenceEndDate,
      startAt,
      timezone
    )
    .all<any>()

  const rec = res.results?.[0]
  if (!rec) {
    return jsonResponse(request, { error: 'Could not create event' }, { status: 500 })
  }

  return jsonResponse(request, { event: eventToDict(rec) }, { status: 201 })
}

async function getTeamEvent(
  request: Request,
  env: Env,
  teamId: string,
  eventId: string
): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const eventIdNum = parseIntOrNull(eventId)
  if (teamIdNum == null || eventIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const [rec, role] = await Promise.all([
    env.DB.prepare('SELECT * FROM calendar_events WHERE id = ? AND team_id = ?')
      .bind(eventIdNum, teamIdNum).first<any>(),
    getRole(env, teamIdNum, Number(user.id)),
  ])

  if (!rec) {
    return jsonResponse(request, { error: 'Event not found' }, { status: 404 })
  }

  if (!role) {
    return jsonResponse(
      request,
      { error: 'Not authorized to view this event' },
      { status: 403 }
    )
  }

  return jsonResponse(request, { event: eventToDict(rec) }, { status: 200 })
}

async function updateTeamEvent(
  request: Request,
  env: Env,
  teamId: string,
  eventId: string
): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const eventIdNum = parseIntOrNull(eventId)
  if (teamIdNum == null || eventIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const [rec, role] = await Promise.all([
    env.DB.prepare('SELECT * FROM calendar_events WHERE id = ? AND team_id = ?')
      .bind(eventIdNum, teamIdNum).first<any>(),
    getRole(env, teamIdNum, Number(user.id)),
  ])

  if (!rec) {
    return jsonResponse(request, { error: 'Event not found' }, { status: 404 })
  }

  if (!rec.editable) {
    return jsonResponse(
      request,
      { error: 'This event cannot be edited' },
      { status: 403 }
    )
  }

  if (!role || (role !== 'Owner' && role !== 'Coach')) {
    return jsonResponse(
      request,
      { error: 'Not authorized to edit this event' },
      { status: 403 }
    )
  }

  const title = (data?.title ?? rec.title).trim()
  const typ = (data?.type ?? rec.type).trim()
  const dateRaw =
    data?.date ??
    (typeof rec.date === 'string'
      ? rec.date
      : rec.date
      ? formatDateStr(new Date(rec.date))
      : null)
  const time = (data?.time ?? rec.time).trim()
  const location = (data?.location ?? rec.location).trim()

  if (!(typ in COLOR_MAP)) {
    return jsonResponse(request, { error: 'Invalid event type' }, { status: 400 })
  }

  const date = validateDate(dateRaw)
  if (!date) {
    return jsonResponse(request, { error: 'Invalid date format' }, { status: 400 })
  }

  const color = COLOR_MAP[typ]

  const recurrencePattern = (data?.recurrencePattern ?? rec.recurrence_pattern ?? 'never').trim()
  const recurrenceEndDateRaw = data?.recurrenceEndDate as string | undefined
  const recurrenceEndDate = recurrenceEndDateRaw && recurrencePattern !== 'never'
    ? validateDate(recurrenceEndDateRaw)
    : (recurrencePattern !== 'never' && rec.recurrence_end_date
      ? validateDate(rec.recurrence_end_date)
      : null)
  const startAt = data?.startAt != null && Number.isFinite(Number(data.startAt)) ? Number(data.startAt) : null
  const timezone = typeof data?.timezone === 'string' ? data.timezone.trim() || null : null

  const res = await env.DB
    .prepare(
      `
      UPDATE calendar_events
      SET title = ?, type = ?, date = ?, time = ?,
          location = ?, color = ?, court_number = COALESCE(?, court_number), 
          recurrence_pattern = ?, recurrence_end_date = ?, start_at = ?, timezone = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND team_id = ?
      RETURNING *
    `
    )
    .bind(title, typ, date, time, location, color, data?.courtNumber != null ? parseIntOrNull(String(data.courtNumber)) : null, recurrencePattern, recurrenceEndDate, startAt, timezone, eventIdNum, teamIdNum)
    .all<any>()

  const updated = res.results?.[0]
  if (!updated) {
    return jsonResponse(request, { error: 'Update failed' }, { status: 500 })
  }

  return jsonResponse(request, { event: eventToDict(updated) }, { status: 200 })
}

async function deleteTeamEvent(
  request: Request,
  env: Env,
  teamId: string,
  eventId: string
): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const eventIdNum = parseIntOrNull(eventId)
  if (teamIdNum == null || eventIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const [rec, role] = await Promise.all([
    env.DB.prepare('SELECT editable FROM calendar_events WHERE id = ? AND team_id = ?')
      .bind(eventIdNum, teamIdNum).first<any>(),
    getRole(env, teamIdNum, Number(user.id)),
  ])

  if (!rec) {
    return jsonResponse(request, { error: 'Event not found' }, { status: 404 })
  }

  if (!rec.editable) {
    return jsonResponse(
      request,
      { error: 'This event cannot be deleted' },
      { status: 403 }
    )
  }

  if (!role || (role !== 'Owner' && role !== 'Coach')) {
    return jsonResponse(
      request,
      { error: 'Not authorized to delete this event' },
      { status: 403 }
    )
  }

  await env.DB
    .prepare('DELETE FROM calendar_events WHERE id = ? AND team_id = ?')
    .bind(eventIdNum, teamIdNum)
    .run()

  return jsonResponse(request, { deleted: true }, { status: 200 })
}

export async function handleEvents(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  const method = request.method
  const segments = pathname.split('/').filter(Boolean)

  if (pathname === '/events/all' && method === 'GET') {
    return await listAllEvents(request, env)
  }

  if (pathname === '/events/rsvps/bulk' && method === 'GET') {
    return await listRsvpsBulk(request, env)
  }

  if (pathname === '/events') {
    if (method === 'GET') return listPersonalEvents(request, env)
    if (method === 'POST') return createPersonalEvent(request, env)
    return null
  }

  if (segments[0] === 'events' && segments.length >= 2) {
    const eventId = segments[1]
    if (!eventId) return null

    if (segments.length === 2) {
      if (method === 'GET') return getEvent(request, env, eventId)
      if (method === 'PUT') return updateEvent(request, env, eventId)
      if (method === 'DELETE') return deleteEvent(request, env, eventId)
      return null
    }

    if (segments.length === 3 && segments[2] === 'rsvp') {
      if (method === 'POST') return rsvpEvent(request, env, eventId)
      if (method === 'DELETE') return removeRsvp(request, env, eventId)
      return null
    }

    if (segments.length === 3 && segments[2] === 'rsvps') {
      if (method === 'GET') return listRsvps(request, env, eventId)
      return null
    }

    return null
  }

  if (segments[0] === 'teams' && segments.length >= 3 && segments[2] === 'events') {
    const teamId = segments[1]
    if (!teamId) return null

    if (segments.length === 3) {
      if (method === 'GET') return listTeamEvents(request, env, teamId)
      if (method === 'POST') return createTeamEvent(request, env, teamId)
      return null
    }

    if (segments.length === 4) {
      const eventId = segments[3]
      if (method === 'GET') return getTeamEvent(request, env, teamId, eventId)
      if (method === 'PUT') return updateTeamEvent(request, env, teamId, eventId)
      if (method === 'DELETE') return deleteTeamEvent(request, env, teamId, eventId)
      return null
    }

    return null
  }

  return null
}