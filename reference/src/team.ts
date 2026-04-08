import type { Env } from './bindings'
import { jsonResponse } from './http'
import { getCurrentUserFromSession } from './auth'
import { containsProfanity } from './profanity-filter'
import { sendExpoPushToUserIds } from './expo-push'

const EXPO_PUSH_CHANNEL_TEAM = 'team-activity'

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

async function addUserToGroupChats(env: Env, teamId: number, userId: number, userRole: string): Promise<void> {
  const chats = await env.DB
    .prepare('SELECT id, access_type, allowed_roles FROM group_chats WHERE team_id = ?')
    .bind(teamId)
    .all<any>()

  const statements: ReturnType<Env['DB']['prepare']>[] = []
  for (const chat of chats.results || []) {
    let shouldHaveAccess = false

    if (userRole === 'Owner' || userRole === 'Coach') {
      shouldHaveAccess = true
    } else if (chat.access_type === 'everyone') {
      shouldHaveAccess = true
    } else if (chat.access_type === 'roles' && chat.allowed_roles) {
      try {
        const allowedRoles = JSON.parse(chat.allowed_roles)
        if (Array.isArray(allowedRoles) && allowedRoles.includes(userRole)) {
          shouldHaveAccess = true
        }
      } catch (e) {
        // invalid JSON, skip
      }
    } else if (chat.access_type === 'roles_and_users' && chat.allowed_roles) {
      try {
        const allowedRoles = JSON.parse(chat.allowed_roles)
        if (Array.isArray(allowedRoles) && allowedRoles.includes(userRole)) {
          shouldHaveAccess = true
        }
      } catch (e) {
        // invalid JSON, skip
      }
    }

    if (shouldHaveAccess) {
      statements.push(
        env.DB.prepare('INSERT INTO group_chat_users (group_chat_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING').bind(chat.id, userId)
      )
    }
  }
  if (statements.length > 0) {
    await env.DB.batch(statements)
  }
}

async function getRole(env: Env, teamId: number, userId: number): Promise<string | null> {
  const row = await env.DB
    .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
    .bind(teamId, userId)
    .first<{ role: string }>()
  return row ? row.role : null
}

function displayNameFromUser(user: { username?: string | null; email?: string | null }): string {
  const u = (user.username || '').trim()
  if (u) return u
  const e = (user.email || '').trim()
  if (e) return e
  return 'Someone'
}

async function notifyManagersOfJoinRequest(
  env: Env,
  teamId: number,
  requesterId: number,
  requesterName: string,
  teamName: string,
): Promise<void> {
  const mgrRes = await env.DB
    .prepare(
      `SELECT user_id FROM team_members WHERE team_id = ? AND role IN ('Owner', 'Coach')`,
    )
    .bind(teamId)
    .all<{ user_id: number }>()
  const managers = (mgrRes.results || [])
    .map((r) => r.user_id)
    .filter((id) => id !== requesterId)
  if (managers.length === 0) return

  await sendExpoPushToUserIds(
    env,
    managers,
    'Join request',
    `${requesterName} wants to join ${teamName}`,
    {
      type: 'team_join_request',
      teamId: String(teamId),
      teamName,
      requesterId: String(requesterId),
      requesterName,
    },
    EXPO_PUSH_CHANNEL_TEAM,
    '[TeamJoin]',
  )
}

async function listPublicMatches(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const res = await env.DB
    .prepare(
      `
      SELECT m.*, u.username AS creator_username
      FROM matches m
      JOIN users u ON m.user_id = u.id
      WHERE m.is_public = 1 AND m.status = 'active'
        AND (
          m.user_id = ?
          OR EXISTS (
            SELECT 1 FROM team_members tm1
            JOIN team_members tm2 ON tm1.team_id = tm2.team_id
            WHERE tm1.user_id = ? AND tm2.user_id = m.user_id
          )
        )
      ORDER BY m.created_at DESC
    `
    )
    .bind(uid, uid)
    .all<any>()

  const matches = (res.results || []).map((m: any) => ({
    ...m,
    id: String(m.id),
    user_id: String(m.user_id),
    created_at: toIso(m.created_at),
    updated_at: toIso(m.updated_at)
  }))

  return jsonResponse(request, { matches }, { status: 200 })
}

async function listPublicMatchesFull(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)

  const res = await env.DB
    .prepare(
      `
      SELECT
        m.*,
        u.username AS creator_username,
        ms.stats AS stats_json,
        s.stream_uid,
        s.live_input_uid,
        s.rtmp_url,
        s.stream_key,
        s.webrtc_url,
        s.webrtc_playback_url
      FROM matches m
      JOIN users u ON m.user_id = u.id
      LEFT JOIN match_stats ms ON ms.match_id = m.id
      LEFT JOIN match_streams s ON s.match_id = m.id
      WHERE m.is_public = 1 AND m.status = 'active'
        AND (
          m.user_id = ?
          OR EXISTS (
            SELECT 1 FROM team_members tm1
            JOIN team_members tm2 ON tm1.team_id = tm2.team_id
            WHERE tm1.user_id = ? AND tm2.user_id = m.user_id
          )
        )
      ORDER BY m.created_at DESC
      `
    )
    .bind(uid, uid)
    .all<any>()

  const matches = (res.results || []).map((m: any) => {
    let stats: any = null
    if (m.stats_json) {
      try { stats = JSON.parse(m.stats_json) } catch { stats = null }
    }

    let stream: any = null
    if (m.stream_uid) {
      const liveInputUid = m.live_input_uid || ''
      let hlsUrl: string | null = null
      const webRTCPlaybackUrl = m.webrtc_playback_url || ''
      if (webRTCPlaybackUrl && liveInputUid) {
        const urlMatch = webRTCPlaybackUrl.match(/https:\/\/(customer-[^\/]+)\.cloudflarestream\.com\//)
        if (urlMatch && urlMatch[1]) {
          hlsUrl = `https://${urlMatch[1]}.cloudflarestream.com/${liveInputUid}/manifest/video.m3u8`
        }
      }

      let thumbnail: string | null = null
      if (liveInputUid && webRTCPlaybackUrl) {
        const urlMatch = webRTCPlaybackUrl.match(/https:\/\/(customer-[^\/]+)\.cloudflarestream\.com\//)
        if (urlMatch && urlMatch[1]) {
          thumbnail = `https://${urlMatch[1]}.cloudflarestream.com/${liveInputUid}/thumbnails/thumbnail.jpg`
        }
      }

      stream = {
        uid: m.stream_uid,
        liveInputUid,
        rtmpUrl: m.rtmp_url || null,
        streamKey: m.stream_key || null,
        webRTCUrl: m.webrtc_url || null,
        webRTCPlaybackUrl: webRTCPlaybackUrl || null,
        hlsUrl,
        thumbnail,
        status: null,
      }
    }

    return {
      ...m,
      id: String(m.id),
      user_id: String(m.user_id),
      created_at: toIso(m.created_at),
      updated_at: toIso(m.updated_at),
      stats_json: undefined,
      stream_uid: undefined,
      live_input_uid: undefined,
      rtmp_url: undefined,
      stream_key: undefined,
      webrtc_url: undefined,
      webrtc_playback_url: undefined,
      stats,
      stream,
    }
  })

  return jsonResponse(request, { matches }, { status: 200 })
}

async function listTeams(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const visibility = url.searchParams.get('visibility')
  const user = await getCurrentUserFromSession(request, env)

  let rowsRes
  if (visibility) {
    rowsRes = await env.DB
      .prepare(
        `
        SELECT
          t.id,
          t.name,
          t.description,
          t.visibility,
          t.access_code,
          t.request_to_join,
          t.image_url,
          t.icon_color_start,
          t.icon_color_end,
          COUNT(tm_all.user_id) AS member_count,
          t.created_at,
          t.updated_at
        FROM teams t
        LEFT JOIN team_members tm_all ON tm_all.team_id = t.id
        WHERE t.visibility = ?
        GROUP BY t.id
      `
      )
      .bind(visibility)
      .all<any>()
  } else {
    if (!user) {
      return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
    }

    rowsRes = await env.DB
      .prepare(
        `
        SELECT
          t.id,
          t.name,
          t.description,
          t.visibility,
          t.access_code,
          t.request_to_join,
          t.image_url,
          t.icon_color_start,
          t.icon_color_end,
          COUNT(tm_all.user_id) AS member_count,
          tm_cur.joined_at,
          tm_cur.role,
          t.created_at,
          t.updated_at
        FROM teams t
        JOIN team_members tm_cur
          ON tm_cur.team_id = t.id
         AND tm_cur.user_id = ?
        LEFT JOIN team_members tm_all
          ON tm_all.team_id = t.id
        GROUP BY t.id
        ORDER BY tm_cur.joined_at DESC
      `
      )
      .bind(Number(user.id))
      .all<any>()
  }

  const rows = rowsRes.results || []
  const teams = rows.map((r: any) => ({
    id: String(r.id),
    name: r.name,
    description: r.description,
    visibility: r.visibility,
    accessCode: r.access_code,
    requestToJoin: !!r.request_to_join,
    imageUrl: r.image_url,
    iconColorStart: r.icon_color_start ?? null,
    iconColorEnd: r.icon_color_end ?? null,
    memberCount: r.member_count,
    joinedAt: toIso(r.joined_at),
    role: r.role,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at)
  }))

  return jsonResponse(request, { teams }, { status: 200 })
}

async function createTeam(request: Request, env: Env): Promise<Response> {
  try {
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

    const name = (data?.name ?? '').trim()
    const description = (data?.description ?? '').trim()

    if (!name) {
      return jsonResponse(request, { error: 'Name required' }, { status: 400 })
    }
    if (name.length > 25) {
      return jsonResponse(request, { error: 'Name too long' }, { status: 400 })
    }
    if (description.length > 150) {
      return jsonResponse(request, { error: 'Description too long' }, { status: 400 })
    }

    try {
      if (containsProfanity(name)) {
        return jsonResponse(request, { error: 'Team name contains inappropriate language.' }, { status: 400 })
      }
      if (containsProfanity(description)) {
        return jsonResponse(request, { error: 'Team description contains inappropriate language.' }, { status: 400 })
      }
    } catch (err) {
      console.error('Error checking profanity:', err)
    }

    const visibility = data?.visibility ?? 'private'
    const accessCode = data?.accessCode ?? null
    const requestToJoin = !!data?.requestToJoin
    const iconColorStart = data?.iconColorStart ?? null
    const iconColorEnd = data?.iconColorEnd ?? null

    let res: any
    try {
      res = await env.DB
        .prepare(
          `
          INSERT INTO teams
            (name, description, visibility, access_code, request_to_join, icon_color_start, icon_color_end)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          RETURNING
            id, name, description, visibility,
            access_code, request_to_join,
            icon_color_start, icon_color_end,
            created_at, updated_at
        `
        )
        .bind(name, description, visibility, accessCode, requestToJoin ? 1 : 0, iconColorStart, iconColorEnd)
        .all<any>()
    } catch (dbErr: any) {
      const dbErrorMessage = dbErr?.message || dbErr?.toString() || String(dbErr)
      const dbErrorString = dbErrorMessage.toLowerCase()

      if (
        (dbErrorString.includes('unique constraint') || dbErrorString.includes('sqlite_constraint')) &&
        dbErrorString.includes('teams.name')
      ) {
        return jsonResponse(
          request,
          { error: 'A team with this name already exists. Please choose a different name.' },
          { status: 409 }
        )
      }
      throw dbErr
    }

    const team = res.results?.[0]
    if (!team) {
      return jsonResponse(request, { error: 'Could not create team' }, { status: 500 })
    }

    const generalChatId = crypto.randomUUID()
    const now = new Date().toISOString()

    await env.DB.batch([
      env.DB.prepare(`INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'Owner')`).bind(team.id, Number(user.id)),
      env.DB.prepare(`INSERT INTO group_chats (id, team_id, name, created_by, access_type, allowed_roles, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(generalChatId, team.id, 'General', Number(user.id), 'everyone', null, now, now),
      env.DB.prepare('INSERT INTO group_chat_users (group_chat_id, user_id) VALUES (?, ?)').bind(generalChatId, Number(user.id)),
    ])

    return jsonResponse(
      request,
      {
        team: {
          id: String(team.id),
          name: team.name,
          description: team.description,
          visibility: team.visibility,
          accessCode: team.access_code,
          requestToJoin: !!team.request_to_join,
          iconColorStart: team.icon_color_start ?? null,
          iconColorEnd: team.icon_color_end ?? null,
          createdAt: toIso(team.created_at),
          updatedAt: toIso(team.updated_at)
        }
      },
      { status: 201 }
    )
  } catch (err: any) {
    console.error('Error creating team:', err)

    const errorMessage = err?.message || err?.toString() || String(err)
    const errorString = errorMessage.toLowerCase()

    if (
      (errorString.includes('unique constraint') || errorString.includes('sqlite_constraint')) &&
      errorString.includes('teams.name')
    ) {
      return jsonResponse(
        request,
        { error: 'A team with this name already exists. Please choose a different name.' },
        { status: 409 }
      )
    }

    return jsonResponse(
      request,
      { error: err?.message || 'Failed to create team' },
      { status: 500 }
    )
  }
}

async function getTeam(request: Request, env: Env, teamId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  if (teamIdNum == null) {
    return jsonResponse(request, { error: 'Invalid team id' }, { status: 400 })
  }

  const [rec, member] = await Promise.all([
    env.DB.prepare(
      `
      SELECT
        id,
        name,
        description,
        visibility,
        access_code,
        request_to_join,
        image_url,
        icon_color_start,
        icon_color_end,
        statistics_visibility,
        created_at,
        updated_at
      FROM teams
      WHERE id = ?
    `
    )
      .bind(teamIdNum)
      .first<any>(),
    env.DB.prepare('SELECT 1 AS ok FROM team_members WHERE team_id = ? AND user_id = ?')
      .bind(teamIdNum, Number(user.id))
      .first<any>()
  ])

  if (!rec) {
    return jsonResponse(request, { error: 'Not found' }, { status: 404 })
  }

  if (!member) {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  return jsonResponse(
    request,
    {
      team: {
        id: String(rec.id),
        name: rec.name,
        description: rec.description,
        visibility: rec.visibility,
        accessCode: rec.access_code,
        requestToJoin: !!rec.request_to_join,
        imageUrl: rec.image_url,
        iconColorStart: rec.icon_color_start ?? null,
        iconColorEnd: rec.icon_color_end ?? null,
        statisticsVisibility: rec.statistics_visibility || 'coaches_only',
        createdAt: toIso(rec.created_at),
        updatedAt: toIso(rec.updated_at)
      }
    },
    { status: 200 }
  )
}

async function joinTeam(request: Request, env: Env, teamId: string): Promise<Response> {
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
  const code = (data?.code ?? '').trim()

  const rec = await env.DB
    .prepare('SELECT access_code, request_to_join, name FROM teams WHERE id = ?')
    .bind(teamIdNum)
    .first<{ access_code: string | null; request_to_join: any; name: string | null }>()

  if (!rec) {
    return jsonResponse(request, { error: 'Team not found' }, { status: 404 })
  }

  const hasAccessCode = !!rec.access_code
  const requiresRequest = !!rec.request_to_join

  if (hasAccessCode && requiresRequest) {
    if (!code) {
      return jsonResponse(request, { error: 'Code required' }, { status: 400 })
    }
    if (rec.access_code !== code) {
      return jsonResponse(request, { error: 'Invalid code' }, { status: 403 })
    }

    const insertReq = await env.DB
      .prepare(
        `
        INSERT OR IGNORE INTO team_join_requests (team_id, user_id)
        VALUES (?, ?)
      `
      )
      .bind(teamIdNum, Number(user.id))
      .run()

    if (insertReq.meta.changes > 0) {
      const teamName = (rec.name || 'Team').trim() || 'Team'
      void notifyManagersOfJoinRequest(
        env,
        teamIdNum,
        Number(user.id),
        displayNameFromUser(user as any),
        teamName,
      )
    }

    return jsonResponse(request, { message: 'Request submitted' }, { status: 200 })
  }

  if (hasAccessCode) {
    if (!code) {
      return jsonResponse(request, { error: 'Code required' }, { status: 400 })
    }
    if (rec.access_code !== code) {
      return jsonResponse(request, { error: 'Invalid code' }, { status: 403 })
    }

    await env.DB
      .prepare(
        `
        INSERT OR IGNORE INTO team_members (team_id, user_id)
        VALUES (?, ?)
      `
      )
      .bind(teamIdNum, Number(user.id))
      .run()

    await addUserToGroupChats(env, teamIdNum, Number(user.id), 'spectator')

    return jsonResponse(request, { message: 'Joined' }, { status: 200 })
  }

  if (requiresRequest) {
    const insertReq2 = await env.DB
      .prepare(
        `
        INSERT OR IGNORE INTO team_join_requests (team_id, user_id)
        VALUES (?, ?)
      `
      )
      .bind(teamIdNum, Number(user.id))
      .run()

    if (insertReq2.meta.changes > 0) {
      const teamName = (rec.name || 'Team').trim() || 'Team'
      void notifyManagersOfJoinRequest(
        env,
        teamIdNum,
        Number(user.id),
        displayNameFromUser(user as any),
        teamName,
      )
    }

    return jsonResponse(request, { message: 'Request submitted' }, { status: 200 })
  }

  await env.DB
    .prepare(
      `
      INSERT OR IGNORE INTO team_members (team_id, user_id)
      VALUES (?, ?)
    `
    )
    .bind(teamIdNum, Number(user.id))
    .run()

  await addUserToGroupChats(env, teamIdNum, Number(user.id), 'spectator')

  return jsonResponse(request, { message: 'Joined' }, { status: 200 })
}

async function listJoinRequests(request: Request, env: Env, teamId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  if (teamIdNum == null) {
    return jsonResponse(request, { error: 'Invalid team id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  const res = await env.DB
    .prepare(
      `
      SELECT
        jr.user_id,
        u.email,
        u.username,
        jr.created_at
      FROM team_join_requests jr
      JOIN users u ON u.id = jr.user_id
      WHERE jr.team_id = ?
      ORDER BY jr.created_at
    `
    )
    .bind(teamIdNum)
    .all<any>()

  const rows = res.results || []
  const requests = rows.map((r: any) => ({
    userId: String(r.user_id),
    email: r.email,
    username: r.username,
    createdAt: toIso(r.created_at)
  }))

  return jsonResponse(request, { requests }, { status: 200 })
}

async function approveJoinRequest(
  request: Request,
  env: Env,
  teamId: string,
  userId: string
): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const targetUserId = parseIntOrNull(userId)
  if (teamIdNum == null || targetUserId == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  await env.DB
    .prepare(
      `
      INSERT OR IGNORE INTO team_members (team_id, user_id)
      VALUES (?, ?)
    `
    )
    .bind(teamIdNum, targetUserId)
    .run()

  await addUserToGroupChats(env, teamIdNum, targetUserId, 'spectator')

  await env.DB
    .prepare(
      `
      DELETE FROM team_join_requests
      WHERE team_id = ? AND user_id = ?
    `
    )
    .bind(teamIdNum, targetUserId)
    .run()

  const teamRow = await env.DB
    .prepare('SELECT name FROM teams WHERE id = ?')
    .bind(teamIdNum)
    .first<{ name: string | null }>()
  const teamName = ((teamRow?.name || 'Team').trim() || 'Team')
  void sendExpoPushToUserIds(
    env,
    [targetUserId],
    'Request approved',
    `You're now a member of ${teamName}`,
    {
      type: 'team_join_approved',
      teamId: String(teamIdNum),
      teamName,
    },
    EXPO_PUSH_CHANNEL_TEAM,
    '[TeamJoin]',
  )

  return jsonResponse(request, { message: 'Approved' }, { status: 200 })
}

async function denyJoinRequest(
  request: Request,
  env: Env,
  teamId: string,
  userId: string
): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const targetUserId = parseIntOrNull(userId)
  if (teamIdNum == null || targetUserId == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  const delRes = await env.DB
    .prepare(
      `
      DELETE FROM team_join_requests
      WHERE team_id = ? AND user_id = ?
    `
    )
    .bind(teamIdNum, targetUserId)
    .run()

  if (delRes.meta.changes > 0) {
    const teamRow = await env.DB
      .prepare('SELECT name FROM teams WHERE id = ?')
      .bind(teamIdNum)
      .first<{ name: string | null }>()
    const teamName = ((teamRow?.name || 'Team').trim() || 'Team')
    void sendExpoPushToUserIds(
      env,
      [targetUserId],
      'Request not approved',
      `Your request to join ${teamName} was declined`,
      {
        type: 'team_join_denied',
        teamId: String(teamIdNum),
        teamName,
      },
      EXPO_PUSH_CHANNEL_TEAM,
      '[TeamJoin]',
    )
  }

  return jsonResponse(request, { message: 'Denied' }, { status: 200 })
}

async function updateTeam(request: Request, env: Env, teamId: string): Promise<Response> {
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

  const name = (data?.name ?? '').trim()
  const description = (data?.description ?? '').trim()

  if (name && name.length > 25) {
    return jsonResponse(request, { error: 'Name too long' }, { status: 400 })
  }
  if (description.length > 150) {
    return jsonResponse(request, { error: 'Description too long' }, { status: 400 })
  }

  if (name && containsProfanity(name)) {
    return jsonResponse(request, { error: 'Team name contains inappropriate language.' }, { status: 400 })
  }
  if (description && containsProfanity(description)) {
    return jsonResponse(request, { error: 'Team description contains inappropriate language.' }, { status: 400 })
  }

  const visibility = data?.visibility ?? null
  const accessCode = data?.accessCode ?? null
  const requestToJoin = !!data?.requestToJoin
  const iconColorStart = data?.iconColorStart ?? null
  const iconColorEnd = data?.iconColorEnd ?? null

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  const res = await env.DB
    .prepare(
      `
      UPDATE teams
      SET
        name = ?,
        description = ?,
        visibility = ?,
        access_code = ?,
        request_to_join = ?,
        icon_color_start = ?,
        icon_color_end = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      RETURNING
        id,
        name,
        description,
        visibility,
        access_code,
        request_to_join,
        icon_color_start,
        icon_color_end,
        created_at,
        updated_at
    `
    )
    .bind(name, description, visibility, accessCode, requestToJoin ? 1 : 0, iconColorStart, iconColorEnd, teamIdNum)
    .all<any>()

  const rec = res.results?.[0]
  if (!rec) {
    return jsonResponse(request, { error: 'Not found' }, { status: 404 })
  }

  return jsonResponse(
    request,
    {
      team: {
        id: String(rec.id),
        name: rec.name,
        description: rec.description,
        visibility: rec.visibility,
        accessCode: rec.access_code,
        requestToJoin: !!rec.request_to_join,
        iconColorStart: rec.icon_color_start ?? null,
        iconColorEnd: rec.icon_color_end ?? null,
        statisticsVisibility: rec.statistics_visibility || 'coaches_only',
        createdAt: toIso(rec.created_at),
        updatedAt: toIso(rec.updated_at)
      }
    },
    { status: 200 }
  )
}

async function deleteTeam(request: Request, env: Env, teamId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  if (teamIdNum == null) {
    return jsonResponse(request, { error: 'Invalid team id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM team_join_requests WHERE team_id = ?').bind(teamIdNum),
    env.DB.prepare('DELETE FROM invite_links WHERE team_id = ?').bind(teamIdNum),
    env.DB.prepare('DELETE FROM team_members WHERE team_id = ?').bind(teamIdNum),
    env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(teamIdNum),
  ])

  return jsonResponse(request, { deleted: true }, { status: 200 })
}

async function leaveTeam(request: Request, env: Env, teamId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  if (teamIdNum == null) {
    return jsonResponse(request, { error: 'Invalid team id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role === 'Owner') {
    return jsonResponse(
      request,
      { error: 'Owners must transfer ownership or delete the team before leaving' },
      { status: 403 }
    )
  }

  const userId = Number(user.id)
  await env.DB.batch([
    env.DB.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?')
      .bind(teamIdNum, userId),
    env.DB.prepare(
      `DELETE FROM group_chat_users
       WHERE user_id = ?
       AND group_chat_id IN (SELECT id FROM group_chats WHERE team_id = ?)`
    ).bind(userId, teamIdNum),
    env.DB.prepare(
      `DELETE FROM conversation_participants
       WHERE user_id = ?
       AND conversation_id IN (SELECT id FROM private_conversations WHERE team_id = ?)`
    ).bind(userId, teamIdNum),
  ])

  return jsonResponse(request, { message: 'Left team' }, { status: 200 })
}

async function listMembers(request: Request, env: Env, teamId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  if (teamIdNum == null) {
    return jsonResponse(request, { error: 'Invalid team id' }, { status: 400 })
  }

  const res = await env.DB
    .prepare(
      `
      SELECT
        u.id,
        u.email,
        u.username,
        u.profile_picture_url,
        tm.role,
        tm.chat_enabled,
        tm.joined_at
      FROM team_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = ?
    `
    )
    .bind(teamIdNum)
    .all<any>()

  const rows = res.results || []
  const callerIsMember = rows.some((r: any) => r.id === Number(user.id))
  if (!callerIsMember) {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  const members = rows.map((r: any) => ({
    id: String(r.id),
    email: r.email,
    username: r.username,
    profilePictureUrl: r.profile_picture_url || null,
    role: r.role,
    chatEnabled: !!r.chat_enabled,
    joinedAt: toIso(r.joined_at)
  }))

  return jsonResponse(request, { members }, { status: 200 })
}

async function updateMemberRole(
  request: Request,
  env: Env,
  teamId: string,
  memberId: string
): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const memberIdNum = parseIntOrNull(memberId)
  if (teamIdNum == null || memberIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const newRole = data?.role as string | undefined
  const chatEnabled = data?.chatEnabled as boolean | undefined

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  const targetMember = await env.DB
    .prepare('SELECT role, chat_enabled FROM team_members WHERE team_id = ? AND user_id = ?')
    .bind(teamIdNum, memberIdNum)
    .first<{ role: string; chat_enabled: any }>()

  if (!targetMember) {
    return jsonResponse(request, { error: 'Not found' }, { status: 404 })
  }

  const finalRole = newRole != null ? newRole : targetMember.role
  const finalChatEnabled =
    chatEnabled != null ? chatEnabled : !!targetMember.chat_enabled

  if (finalRole === 'Owner' && role !== 'Owner') {
    return jsonResponse(
      request,
      { error: 'Not authorized to make someone an Owner' },
      { status: 403 }
    )
  }

  if (memberIdNum === Number(user.id) && finalChatEnabled === false) {
    return jsonResponse(
      request,
      { error: 'You cannot disable your own chat' },
      { status: 403 }
    )
  }

  if (finalRole === 'Owner' && memberIdNum !== Number(user.id)) {
    await env.DB
      .prepare(
        `UPDATE team_members SET role = 'Coach', updated_at = CURRENT_TIMESTAMP
         WHERE team_id = ? AND user_id = ?`
      )
      .bind(teamIdNum, Number(user.id))
      .run()

    await env.DB
      .prepare(
        `DELETE FROM group_chat_users
         WHERE user_id = ?
         AND group_chat_id IN (SELECT id FROM group_chats WHERE team_id = ?)`
      )
      .bind(Number(user.id), teamIdNum)
      .run()
    await addUserToGroupChats(env, teamIdNum, Number(user.id), 'Coach')
  }

  const res = await env.DB
    .prepare(
      `
      UPDATE team_members
      SET role = ?, chat_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE team_id = ? AND user_id = ?
      RETURNING role, chat_enabled, joined_at
    `
    )
    .bind(finalRole, finalChatEnabled ? 1 : 0, teamIdNum, memberIdNum)
    .all<any>()

  const rec = res.results?.[0]
  if (!rec) {
    return jsonResponse(request, { error: 'Update failed' }, { status: 500 })
  }

  if (newRole != null && newRole !== targetMember.role) {
    const wasPrivileged = targetMember.role === 'Owner' || targetMember.role === 'Coach'
    const isNowPrivileged = finalRole === 'Owner' || finalRole === 'Coach'

    if (wasPrivileged || isNowPrivileged) {
      await env.DB
        .prepare(
          `DELETE FROM group_chat_users 
           WHERE user_id = ? 
           AND group_chat_id IN (
             SELECT id FROM group_chats WHERE team_id = ?
           )`
        )
        .bind(memberIdNum, teamIdNum)
        .run()
    } else {
      await env.DB
        .prepare(
          `DELETE FROM group_chat_users 
           WHERE user_id = ? 
           AND group_chat_id IN (
             SELECT id FROM group_chats 
             WHERE team_id = ? 
             AND access_type IN ('roles', 'roles_and_users')
           )`
        )
        .bind(memberIdNum, teamIdNum)
        .run()
    }

    await addUserToGroupChats(env, teamIdNum, memberIdNum, finalRole)
  }

  const userRec = await env.DB
    .prepare('SELECT email, username FROM users WHERE id = ?')
    .bind(memberIdNum)
    .first<{ email: string; username: string }>()

  return jsonResponse(
    request,
    {
      member: {
        id: String(memberIdNum),
        email: userRec?.email ?? null,
        username: userRec?.username ?? null,
        role: rec.role,
        chatEnabled: !!rec.chat_enabled,
        joinedAt: toIso(rec.joined_at)
      }
    },
    { status: 200 }
  )
}

async function removeMember(
  request: Request,
  env: Env,
  teamId: string,
  memberId: string
): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const memberIdNum = parseIntOrNull(memberId)
  if (teamIdNum == null || memberIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM team_members WHERE team_id = ? AND user_id = ?')
      .bind(teamIdNum, memberIdNum),
    env.DB.prepare(
      `DELETE FROM group_chat_users
       WHERE user_id = ?
       AND group_chat_id IN (SELECT id FROM group_chats WHERE team_id = ?)`
    ).bind(memberIdNum, teamIdNum),
    env.DB.prepare(
      `DELETE FROM conversation_participants
       WHERE user_id = ?
       AND conversation_id IN (SELECT id FROM private_conversations WHERE team_id = ?)`
    ).bind(memberIdNum, teamIdNum),
  ])

  return jsonResponse(request, { message: 'Member removed' }, { status: 200 })
}

async function listInvites(request: Request, env: Env, teamId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  if (teamIdNum == null) {
    return jsonResponse(request, { error: 'Invalid team id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  const res = await env.DB
    .prepare(
      `
      SELECT
        id,
        created_by,
        created_at,
        expires_at,
        max_uses,
        uses,
        role
      FROM invite_links
      WHERE team_id = ?
    `
    )
    .bind(teamIdNum)
    .all<any>()

  const rows = res.results || []
  const invites = rows.map((r: any) => ({
    id: String(r.id),
    createdBy: r.created_by,
    createdAt: toIso(r.created_at),
    expiresAt: r.expires_at ? toIso(r.expires_at) : null,
    maxUses: r.max_uses,
    uses: r.uses,
    role: r.role
  }))

  return jsonResponse(request, { invites }, { status: 200 })
}

async function createInvite(request: Request, env: Env, teamId: string): Promise<Response> {
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

  const expiresIn = data?.expiresInDays
  const maxUses = data?.maxUses != null ? Number(data.maxUses) : null
  const role = ((data?.role as string | undefined) ?? 'Spectator').trim()

  if (!['Coach', 'Player', 'Family', 'Spectator'].includes(role)) {
    return jsonResponse(request, { error: 'Invalid role' }, { status: 400 })
  }

  let expiresAt: string | null = null
  if (expiresIn) {
    const ms = Number(expiresIn) * 24 * 60 * 60 * 1000
    const d = new Date(Date.now() + ms)
    expiresAt = d.toISOString()
  }

  const roleCheck = await getRole(env, teamIdNum, Number(user.id))
  if (roleCheck !== 'Owner' && roleCheck !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  const inviteId = crypto.randomUUID()
  const res = await env.DB
    .prepare(
      `
      INSERT INTO invite_links (id, team_id, created_by, expires_at, max_uses, role)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id, created_at, expires_at, max_uses, uses, role
    `
    )
    .bind(inviteId, teamIdNum, Number(user.id), expiresAt, maxUses, role)
    .all<any>()

  const rec = res.results?.[0]
  if (!rec) {
    return jsonResponse(request, { error: 'Could not create invite' }, { status: 500 })
  }

  return jsonResponse(
    request,
    {
      invite: {
        id: String(rec.id),
        createdAt: toIso(rec.created_at),
        expiresAt: rec.expires_at ? toIso(rec.expires_at) : null,
        maxUses: rec.max_uses,
        uses: rec.uses,
        role: rec.role
      }
    },
    { status: 201 }
  )
}

async function deleteInvite(
  request: Request,
  env: Env,
  teamId: string,
  inviteId: string
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
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  await env.DB
    .prepare('DELETE FROM invite_links WHERE team_id = ? AND id = ?')
    .bind(teamIdNum, inviteId)
    .run()

  return jsonResponse(request, { deleted: true }, { status: 200 })
}

async function acceptInvite(
  request: Request,
  env: Env,
  inviteId: string
): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const rec = await env.DB
    .prepare(
      `
      SELECT
        id,
        team_id,
        expires_at,
        max_uses,
        uses,
        role
      FROM invite_links
      WHERE id = ?
    `
    )
    .bind(inviteId)
    .first<any>()

  if (!rec) {
    return jsonResponse(request, { error: 'Invalid invite' }, { status: 404 })
  }

  const now = new Date()
  if (rec.expires_at) {
    const exp = new Date(rec.expires_at)
    if (!isNaN(exp.getTime()) && exp.getTime() < now.getTime()) {
      return jsonResponse(request, { error: 'Invite expired' }, { status: 400 })
    }
  }

  if (rec.max_uses != null && rec.uses >= rec.max_uses) {
    return jsonResponse(request, { error: 'Invite max uses reached' }, { status: 400 })
  }

  await env.DB
    .prepare(
      `
      INSERT OR IGNORE INTO team_members (team_id, user_id, role)
      VALUES (?, ?, ?)
    `
    )
    .bind(rec.team_id, Number(user.id), rec.role)
    .run()

  await Promise.all([
    addUserToGroupChats(env, rec.team_id, Number(user.id), rec.role),
    env.DB.prepare('UPDATE invite_links SET uses = uses + 1 WHERE id = ?').bind(inviteId).run()
  ])

  return jsonResponse(request, { message: 'Joined team' }, { status: 200 })
}

async function updateTeamSettings(request: Request, env: Env, teamId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  if (teamIdNum == null) {
    return jsonResponse(request, { error: 'Invalid team id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const statisticsVisibility = data?.statisticsVisibility
  if (statisticsVisibility && !['coaches_only', 'coaches_and_players', 'everyone'].includes(statisticsVisibility)) {
    return jsonResponse(request, { error: 'Invalid statistics visibility' }, { status: 400 })
  }

  const updates: string[] = []
  const bindings: any[] = []

  if (statisticsVisibility) {
    updates.push('statistics_visibility = ?')
    bindings.push(statisticsVisibility)
  }

  if (updates.length === 0) {
    return jsonResponse(request, { error: 'No updates provided' }, { status: 400 })
  }

  updates.push('updated_at = CURRENT_TIMESTAMP')
  bindings.push(teamIdNum)

  await env.DB
    .prepare(`UPDATE teams SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...bindings)
    .run()

  return jsonResponse(request, { message: 'Settings updated' }, { status: 200 })
}

async function listLadders(request: Request, env: Env, teamId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  if (teamIdNum == null) {
    return jsonResponse(request, { error: 'Invalid team id' }, { status: 400 })
  }

  const res = await env.DB
    .prepare('SELECT * FROM team_ladders WHERE team_id = ? ORDER BY created_at DESC')
    .bind(teamIdNum)
    .all<any>()

  const ladderIds = (res.results || []).map((l: any) => l.id)
  const entryCounts: Record<number, number> = {}

  if (ladderIds.length > 0) {
    const placeholders = ladderIds.map(() => '?').join(',')
    const countRes = await env.DB
      .prepare(`SELECT ladder_id, COUNT(*) as count FROM team_ladder_entries WHERE ladder_id IN (${placeholders}) GROUP BY ladder_id`)
      .bind(...ladderIds)
      .all<any>()
    for (const row of countRes.results || []) {
      entryCounts[row.ladder_id] = row.count
    }
  }

  const ladders = (res.results || []).map((l: any) => ({
    id: String(l.id),
    teamId: String(l.team_id),
    name: l.name,
    description: l.description,
    startDate: l.start_date || null,
    endDate: l.end_date || null,
    isActive: l.is_active == null ? true : !!l.is_active,
    entryCount: entryCounts[l.id] || 0,
    createdAt: toIso(l.created_at),
    updatedAt: toIso(l.updated_at)
  }))

  return jsonResponse(request, { ladders }, { status: 200 })
}

async function createLadder(request: Request, env: Env, teamId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  if (teamIdNum == null) {
    return jsonResponse(request, { error: 'Invalid team id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const name = (data?.name ?? '').trim()
  const description = (data?.description ?? '').trim()
  const startDate = data?.startDate || null
  const endDate = data?.endDate || null

  if (!name) {
    return jsonResponse(request, { error: 'Name is required' }, { status: 400 })
  }

  if (containsProfanity(name) || containsProfanity(description)) {
    return jsonResponse(request, { error: 'Content contains inappropriate language.' }, { status: 400 })
  }

  const res = await env.DB
    .prepare('INSERT INTO team_ladders (team_id, name, description, start_date, end_date, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING *')
    .bind(teamIdNum, name, description || null, startDate, endDate, Number(user.id))
    .first<any>()

  return jsonResponse(request, {
    ladder: {
      id: String(res.id),
      teamId: String(res.team_id),
      name: res.name,
      description: res.description,
      startDate: res.start_date || null,
      endDate: res.end_date || null,
      isActive: res.is_active == null ? true : !!res.is_active,
      entryCount: 0,
      createdAt: toIso(res.created_at),
      updatedAt: toIso(res.updated_at)
    }
  }, { status: 201 })
}

async function getLadder(request: Request, env: Env, teamId: string, ladderId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const ladderIdNum = parseIntOrNull(ladderId)
  if (teamIdNum == null || ladderIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const [res, countRes] = await Promise.all([
    env.DB.prepare('SELECT * FROM team_ladders WHERE id = ? AND team_id = ?')
      .bind(ladderIdNum, teamIdNum)
      .first<any>(),
    env.DB.prepare('SELECT COUNT(*) as count FROM team_ladder_entries WHERE ladder_id = ?')
      .bind(ladderIdNum)
      .first<any>()
  ])

  if (!res) {
    return jsonResponse(request, { error: 'Not found' }, { status: 404 })
  }

  return jsonResponse(request, {
    ladder: {
      id: String(res.id),
      teamId: String(res.team_id),
      name: res.name,
      description: res.description,
      startDate: res.start_date || null,
      endDate: res.end_date || null,
      isActive: res.is_active == null ? true : !!res.is_active,
      entryCount: countRes?.count || 0,
      createdAt: toIso(res.created_at),
      updatedAt: toIso(res.updated_at)
    }
  }, { status: 200 })
}

async function updateLadder(request: Request, env: Env, teamId: string, ladderId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const ladderIdNum = parseIntOrNull(ladderId)
  if (teamIdNum == null || ladderIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const name = (data?.name ?? '').trim()
  const description = (data?.description ?? '').trim()
  const startDate = data?.startDate !== undefined ? (data.startDate || null) : undefined
  const endDate = data?.endDate !== undefined ? (data.endDate || null) : undefined
  const isActive = data?.isActive !== undefined ? (data.isActive ? 1 : 0) : undefined

  if (name && containsProfanity(name)) {
    return jsonResponse(request, { error: 'Name contains inappropriate language.' }, { status: 400 })
  }
  if (description && containsProfanity(description)) {
    return jsonResponse(request, { error: 'Description contains inappropriate language.' }, { status: 400 })
  }

  const updates: string[] = []
  const binds: any[] = []

  if (name) {
    updates.push('name = ?')
    binds.push(name)
  }
  if (description) {
    updates.push('description = ?')
    binds.push(description)
  }
  if (startDate !== undefined) {
    updates.push('start_date = ?')
    binds.push(startDate)
  }
  if (endDate !== undefined) {
    updates.push('end_date = ?')
    binds.push(endDate)
  }
  if (isActive !== undefined) {
    updates.push('is_active = ?')
    binds.push(isActive)
  }

  updates.push('updated_at = CURRENT_TIMESTAMP')
  binds.push(ladderIdNum, teamIdNum)

  const res = await env.DB
    .prepare(`UPDATE team_ladders SET ${updates.join(', ')} WHERE id = ? AND team_id = ? RETURNING *`)
    .bind(...binds)
    .first<any>()

  if (!res) {
    return jsonResponse(request, { error: 'Not found' }, { status: 404 })
  }

  const countRes = await env.DB
    .prepare('SELECT COUNT(*) as count FROM team_ladder_entries WHERE ladder_id = ?')
    .bind(ladderIdNum)
    .first<any>()

  return jsonResponse(request, {
    ladder: {
      id: String(res.id),
      teamId: String(res.team_id),
      name: res.name,
      description: res.description,
      startDate: res.start_date || null,
      endDate: res.end_date || null,
      isActive: res.is_active == null ? true : !!res.is_active,
      entryCount: countRes?.count || 0,
      createdAt: toIso(res.created_at),
      updatedAt: toIso(res.updated_at)
    }
  }, { status: 200 })
}

async function deleteLadder(request: Request, env: Env, teamId: string, ladderId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const ladderIdNum = parseIntOrNull(ladderId)
  if (teamIdNum == null || ladderIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  await env.DB
    .prepare('DELETE FROM team_ladders WHERE id = ? AND team_id = ?')
    .bind(ladderIdNum, teamIdNum)
    .run()

  return jsonResponse(request, { deleted: true }, { status: 200 })
}

async function listLadderEntries(request: Request, env: Env, teamId: string, ladderId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const ladderIdNum = parseIntOrNull(ladderId)
  if (teamIdNum == null || ladderIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const url = new URL(request.url)
  const format = url.searchParams.get('format')

  const [ladder, res] = await Promise.all([
    env.DB.prepare('SELECT id FROM team_ladders WHERE id = ? AND team_id = ?')
      .bind(ladderIdNum, teamIdNum)
      .first<any>(),
    format && ['singles', 'doubles', 'mixed'].includes(format)
      ? env.DB.prepare(`
          SELECT e.id, e.ladder_id, e.user_id, e.partner_id, e.format, e.position, e.created_at, e.updated_at,
                 u.username, u.profile_picture_url,
                 p.username as partner_username, p.profile_picture_url as partner_profile_picture_url
          FROM team_ladder_entries e
          JOIN users u ON e.user_id = u.id
          LEFT JOIN users p ON e.partner_id = p.id
          WHERE e.ladder_id = ? AND e.format = ?
          ORDER BY e.position ASC
        `).bind(ladderIdNum, format).all<any>()
      : env.DB.prepare(`
          SELECT e.id, e.ladder_id, e.user_id, e.partner_id, e.format, e.position, e.created_at, e.updated_at,
                 u.username, u.profile_picture_url,
                 p.username as partner_username, p.profile_picture_url as partner_profile_picture_url
          FROM team_ladder_entries e
          JOIN users u ON e.user_id = u.id
          LEFT JOIN users p ON e.partner_id = p.id
          WHERE e.ladder_id = ?
          ORDER BY e.format, e.position ASC
        `).bind(ladderIdNum).all<any>()
  ])

  if (!ladder) {
    return jsonResponse(request, { error: 'Ladder not found' }, { status: 404 })
  }

  const entries = (res.results || []).map((e: any) => ({
    id: String(e.id),
    ladderId: String(e.ladder_id),
    userId: String(e.user_id),
    partnerId: e.partner_id ? String(e.partner_id) : null,
    format: e.format,
    position: e.position,
    user: {
      id: String(e.user_id),
      username: e.username,
      profileImageUrl: e.profile_picture_url
    },
    partner: e.partner_id ? {
      id: String(e.partner_id),
      username: e.partner_username,
      profileImageUrl: e.partner_profile_picture_url
    } : null,
    createdAt: toIso(e.created_at),
    updatedAt: toIso(e.updated_at)
  }))

  return jsonResponse(request, { entries }, { status: 200 })
}

async function addLadderEntry(request: Request, env: Env, teamId: string, ladderId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const ladderIdNum = parseIntOrNull(ladderId)
  if (teamIdNum == null || ladderIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const userIdToAdd = parseIntOrNull(data?.userId)
  if (userIdToAdd == null) {
    return jsonResponse(request, { error: 'userId is required' }, { status: 400 })
  }

  const format = data?.format || 'singles'
  if (!['singles', 'doubles', 'mixed'].includes(format)) {
    return jsonResponse(request, { error: 'Invalid format. Must be singles, doubles, or mixed.' }, { status: 400 })
  }

  const partnerIdToAdd = parseIntOrNull(data?.partnerId)

  const member = await env.DB
    .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
    .bind(teamIdNum, userIdToAdd)
    .first<any>()

  const playableRoles = ['Player', 'Coach', 'Owner']
  if (!member || !playableRoles.includes(member.role)) {
    return jsonResponse(request, { error: 'User must be a Player, Coach, or Owner on this team' }, { status: 400 })
  }

  if (partnerIdToAdd != null) {
    if (format === 'singles') {
      return jsonResponse(request, { error: 'Partner is not allowed for singles format' }, { status: 400 })
    }
    if (partnerIdToAdd === userIdToAdd) {
      return jsonResponse(request, { error: 'Partner cannot be the same as the player' }, { status: 400 })
    }
    const partnerMember = await env.DB
      .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
      .bind(teamIdNum, partnerIdToAdd)
      .first<any>()
    if (!partnerMember || !playableRoles.includes(partnerMember.role)) {
      return jsonResponse(request, { error: 'Partner must be a Player, Coach, or Owner on this team' }, { status: 400 })
    }
  }

  const ladder = await env.DB
    .prepare('SELECT id FROM team_ladders WHERE id = ? AND team_id = ?')
    .bind(ladderIdNum, teamIdNum)
    .first<any>()

  if (!ladder) {
    return jsonResponse(request, { error: 'Ladder not found' }, { status: 404 })
  }

  const existing = await env.DB
    .prepare('SELECT id FROM team_ladder_entries WHERE ladder_id = ? AND user_id = ? AND format = ?')
    .bind(ladderIdNum, userIdToAdd, format)
    .first<any>()

  if (existing) {
    return jsonResponse(request, { error: `Player is already on this ladder for ${format}` }, { status: 400 })
  }

  const maxPos = await env.DB
    .prepare('SELECT MAX(position) as max_pos FROM team_ladder_entries WHERE ladder_id = ? AND format = ?')
    .bind(ladderIdNum, format)
    .first<any>()

  const newPosition = (maxPos?.max_pos ?? 0) + 1

  const res = await env.DB
    .prepare('INSERT INTO team_ladder_entries (ladder_id, user_id, partner_id, format, position) VALUES (?, ?, ?, ?, ?) RETURNING *')
    .bind(ladderIdNum, userIdToAdd, partnerIdToAdd, format, newPosition)
    .first<any>()

  const [userInfo, partnerInfo] = await Promise.all([
    env.DB.prepare('SELECT username, profile_picture_url FROM users WHERE id = ?').bind(userIdToAdd).first<any>(),
    partnerIdToAdd
      ? env.DB.prepare('SELECT username, profile_picture_url FROM users WHERE id = ?').bind(partnerIdToAdd).first<any>()
      : Promise.resolve(null),
  ])

  return jsonResponse(request, {
    entry: {
      id: String(res.id),
      ladderId: String(res.ladder_id),
      userId: String(res.user_id),
      partnerId: res.partner_id ? String(res.partner_id) : null,
      format: res.format,
      position: res.position,
      user: {
        id: String(userIdToAdd),
        username: userInfo?.username,
        profileImageUrl: userInfo?.profile_picture_url
      },
      partner: partnerInfo ? {
        id: String(partnerIdToAdd),
        username: partnerInfo.username,
        profileImageUrl: partnerInfo.profile_picture_url
      } : null,
      createdAt: toIso(res.created_at),
      updatedAt: toIso(res.updated_at)
    }
  }, { status: 201 })
}

async function removeLadderEntry(request: Request, env: Env, teamId: string, ladderId: string, entryId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const ladderIdNum = parseIntOrNull(ladderId)
  const entryIdNum = parseIntOrNull(entryId)
  if (teamIdNum == null || ladderIdNum == null || entryIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  const ladder = await env.DB
    .prepare('SELECT id FROM team_ladders WHERE id = ? AND team_id = ?')
    .bind(ladderIdNum, teamIdNum)
    .first<any>()

  if (!ladder) {
    return jsonResponse(request, { error: 'Ladder not found' }, { status: 404 })
  }

  const entry = await env.DB
    .prepare('SELECT position, format FROM team_ladder_entries WHERE id = ? AND ladder_id = ?')
    .bind(entryIdNum, ladderIdNum)
    .first<any>()

  if (!entry) {
    return jsonResponse(request, { error: 'Entry not found' }, { status: 404 })
  }

  await env.DB
    .prepare('DELETE FROM team_ladder_entries WHERE id = ?')
    .bind(entryIdNum)
    .run()

  await env.DB
    .prepare('UPDATE team_ladder_entries SET position = position - 1, updated_at = CURRENT_TIMESTAMP WHERE ladder_id = ? AND format = ? AND position > ?')
    .bind(ladderIdNum, entry.format, entry.position)
    .run()

  return jsonResponse(request, { deleted: true }, { status: 200 })
}

async function reorderLadderEntries(request: Request, env: Env, teamId: string, ladderId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const ladderIdNum = parseIntOrNull(ladderId)
  if (teamIdNum == null || ladderIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const order = data?.order
  const format = data?.format || 'singles'
  
  if (!Array.isArray(order)) {
    return jsonResponse(request, { error: 'order array is required' }, { status: 400 })
  }
  
  if (!['singles', 'doubles', 'mixed'].includes(format)) {
    return jsonResponse(request, { error: 'Invalid format' }, { status: 400 })
  }

  const ladder = await env.DB
    .prepare('SELECT id FROM team_ladders WHERE id = ? AND team_id = ?')
    .bind(ladderIdNum, teamIdNum)
    .first<any>()

  if (!ladder) {
    return jsonResponse(request, { error: 'Ladder not found' }, { status: 404 })
  }

  const statements: ReturnType<Env['DB']['prepare']>[] = []
  for (let i = 0; i < order.length; i++) {
    const entryIdNum = parseIntOrNull(order[i])
    if (entryIdNum != null) {
      statements.push(
        env.DB.prepare('UPDATE team_ladder_entries SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND ladder_id = ? AND format = ?').bind(i + 1, entryIdNum, ladderIdNum, format)
      )
    }
  }
  if (statements.length > 0) {
    await env.DB.batch(statements)
  }

  return listLadderEntries(request, env, teamId, ladderId)
}

async function listLineupRosters(request: Request, env: Env, teamId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  if (teamIdNum == null) {
    return jsonResponse(request, { error: 'Invalid team id' }, { status: 400 })
  }

  const res = await env.DB
    .prepare('SELECT * FROM lineup_rosters WHERE team_id = ? ORDER BY created_at DESC')
    .bind(teamIdNum)
    .all<any>()

  const rosterIds = (res.results || []).map((r: any) => r.id)
  const eventIds = (res.results || []).map((r: any) => r.event_id).filter(Boolean)
  const ladderIds = (res.results || []).map((r: any) => r.source_ladder_id).filter(Boolean)

  const [countResults, eventResults, ladderResults] = await Promise.all([
    rosterIds.length > 0
      ? env.DB.prepare(`SELECT lineup_id, COUNT(*) as count FROM lineup_roster_entries WHERE lineup_id IN (${rosterIds.map(() => '?').join(',')}) GROUP BY lineup_id`).bind(...rosterIds).all<any>()
      : Promise.resolve({ results: [] as any[] }),
    eventIds.length > 0
      ? env.DB.prepare(`SELECT id, title FROM calendar_events WHERE id IN (${eventIds.map(() => '?').join(',')})`).bind(...eventIds).all<any>()
      : Promise.resolve({ results: [] as any[] }),
    ladderIds.length > 0
      ? env.DB.prepare(`SELECT id, name FROM team_ladders WHERE id IN (${ladderIds.map(() => '?').join(',')})`).bind(...ladderIds).all<any>()
      : Promise.resolve({ results: [] as any[] }),
  ])

  const entryCounts: Record<number, number> = {}
  for (const row of countResults.results || []) entryCounts[row.lineup_id] = row.count
  const eventNames: Record<number, string> = {}
  for (const row of eventResults.results || []) eventNames[row.id] = row.title
  const ladderNames: Record<number, string> = {}
  for (const row of ladderResults.results || []) ladderNames[row.id] = row.name

  const rosters = (res.results || []).map((r: any) => ({
    id: String(r.id),
    teamId: String(r.team_id),
    name: r.name,
    description: r.description,
    eventId: r.event_id ? String(r.event_id) : null,
    eventName: r.event_id ? eventNames[r.event_id] : null,
    sourceLadderId: r.source_ladder_id ? String(r.source_ladder_id) : null,
    sourceLadderName: r.source_ladder_id ? ladderNames[r.source_ladder_id] : null,
    entryCount: entryCounts[r.id] || 0,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at)
  }))

  return jsonResponse(request, { rosters }, { status: 200 })
}

async function getLineupRoster(request: Request, env: Env, teamId: string, rosterId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const rosterIdNum = parseIntOrNull(rosterId)
  if (teamIdNum == null || rosterIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const roster = await env.DB
    .prepare('SELECT * FROM lineup_rosters WHERE id = ? AND team_id = ?')
    .bind(rosterIdNum, teamIdNum)
    .first<any>()

  if (!roster) {
    return jsonResponse(request, { error: 'Roster not found' }, { status: 404 })
  }

  const [countRes, eventRes, ladderRes] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as count FROM lineup_roster_entries WHERE lineup_id = ?')
      .bind(rosterIdNum)
      .first<any>(),
    roster.event_id
      ? env.DB.prepare('SELECT title FROM calendar_events WHERE id = ?').bind(roster.event_id).first<any>()
      : Promise.resolve(null),
    roster.source_ladder_id
      ? env.DB.prepare('SELECT name FROM team_ladders WHERE id = ?').bind(roster.source_ladder_id).first<any>()
      : Promise.resolve(null)
  ])

  const eventName = eventRes?.title ?? null
  const ladderName = ladderRes?.name ?? null

  return jsonResponse(request, {
    roster: {
      id: String(roster.id),
      teamId: String(roster.team_id),
      name: roster.name,
      description: roster.description,
      eventId: roster.event_id ? String(roster.event_id) : null,
      eventName,
      sourceLadderId: roster.source_ladder_id ? String(roster.source_ladder_id) : null,
      sourceLadderName: ladderName,
      entryCount: countRes?.count || 0,
      createdAt: toIso(roster.created_at),
      updatedAt: toIso(roster.updated_at)
    }
  }, { status: 200 })
}

async function createLineupRoster(request: Request, env: Env, teamId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  if (teamIdNum == null) {
    return jsonResponse(request, { error: 'Invalid team id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const name = data?.name?.trim()
  if (!name) {
    return jsonResponse(request, { error: 'Name is required' }, { status: 400 })
  }

  const description = data?.description?.trim() || null
  const eventId = parseIntOrNull(data?.eventId)
  const sourceLadderId = parseIntOrNull(data?.sourceLadderId)
  const sourceFormat = data?.sourceFormat || null

  const res = await env.DB
    .prepare('INSERT INTO lineup_rosters (team_id, name, description, event_id, source_ladder_id, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING *')
    .bind(teamIdNum, name, description, eventId, sourceLadderId, Number(user.id))
    .first<any>()

  if (sourceLadderId && res?.id) {
    const query = sourceFormat 
      ? 'SELECT user_id, format, position FROM team_ladder_entries WHERE ladder_id = ? AND format = ? ORDER BY position ASC'
      : 'SELECT user_id, format, position FROM team_ladder_entries WHERE ladder_id = ? ORDER BY format, position ASC'
    
    const ladderEntries = sourceFormat
      ? await env.DB.prepare(query).bind(sourceLadderId, sourceFormat).all<any>()
      : await env.DB.prepare(query).bind(sourceLadderId).all<any>()

    const entryStmts = (ladderEntries.results || []).map((entry: any) =>
      env.DB.prepare('INSERT INTO lineup_roster_entries (lineup_id, user_id, format, position) VALUES (?, ?, ?, ?)')
        .bind(res.id, entry.user_id, entry.format, entry.position)
    )
    if (entryStmts.length > 0) await env.DB.batch(entryStmts)
  }

  const countRes = await env.DB
    .prepare('SELECT COUNT(*) as count FROM lineup_roster_entries WHERE lineup_id = ?')
    .bind(res.id)
    .first<any>()

  return jsonResponse(request, {
    roster: {
      id: String(res.id),
      teamId: String(res.team_id),
      name: res.name,
      description: res.description,
      eventId: res.event_id ? String(res.event_id) : null,
      sourceLadderId: res.source_ladder_id ? String(res.source_ladder_id) : null,
      entryCount: countRes?.count || 0,
      createdAt: toIso(res.created_at),
      updatedAt: toIso(res.updated_at)
    }
  }, { status: 201 })
}

async function updateLineupRoster(request: Request, env: Env, teamId: string, rosterId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const rosterIdNum = parseIntOrNull(rosterId)
  if (teamIdNum == null || rosterIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  const roster = await env.DB
    .prepare('SELECT id FROM lineup_rosters WHERE id = ? AND team_id = ?')
    .bind(rosterIdNum, teamIdNum)
    .first<any>()

  if (!roster) {
    return jsonResponse(request, { error: 'Roster not found' }, { status: 404 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const updates: string[] = []
  const bindings: any[] = []

  if (data?.name !== undefined) {
    updates.push('name = ?')
    bindings.push(data.name?.trim() || '')
  }
  if (data?.description !== undefined) {
    updates.push('description = ?')
    bindings.push(data.description?.trim() || null)
  }
  if (data?.eventId !== undefined) {
    updates.push('event_id = ?')
    bindings.push(parseIntOrNull(data.eventId))
  }

  if (updates.length === 0) {
    return getLineupRoster(request, env, teamId, rosterId)
  }

  updates.push('updated_at = CURRENT_TIMESTAMP')
  bindings.push(rosterIdNum, teamIdNum)

  await env.DB
    .prepare(`UPDATE lineup_rosters SET ${updates.join(', ')} WHERE id = ? AND team_id = ?`)
    .bind(...bindings)
    .run()

  return getLineupRoster(request, env, teamId, rosterId)
}

async function deleteLineupRoster(request: Request, env: Env, teamId: string, rosterId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const rosterIdNum = parseIntOrNull(rosterId)
  if (teamIdNum == null || rosterIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  await env.DB
    .prepare('DELETE FROM lineup_rosters WHERE id = ? AND team_id = ?')
    .bind(rosterIdNum, teamIdNum)
    .run()

  return jsonResponse(request, { success: true }, { status: 200 })
}

async function listLineupRosterEntries(request: Request, env: Env, teamId: string, rosterId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const rosterIdNum = parseIntOrNull(rosterId)
  if (teamIdNum == null || rosterIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const url = new URL(request.url)
  const format = url.searchParams.get('format')

  const [roster, res] = await Promise.all([
    env.DB.prepare('SELECT id FROM lineup_rosters WHERE id = ? AND team_id = ?')
      .bind(rosterIdNum, teamIdNum)
      .first<any>(),
    format && ['singles', 'doubles', 'mixed'].includes(format)
      ? env.DB.prepare(`
          SELECT e.id, e.lineup_id, e.user_id, e.partner_id, e.format, e.position, e.created_at, e.updated_at,
                 u.username, u.profile_picture_url,
                 p.username as partner_username, p.profile_picture_url as partner_profile_picture_url
          FROM lineup_roster_entries e
          JOIN users u ON e.user_id = u.id
          LEFT JOIN users p ON e.partner_id = p.id
          WHERE e.lineup_id = ? AND e.format = ?
          ORDER BY e.position ASC
        `).bind(rosterIdNum, format).all<any>()
      : env.DB.prepare(`
          SELECT e.id, e.lineup_id, e.user_id, e.partner_id, e.format, e.position, e.created_at, e.updated_at,
                 u.username, u.profile_picture_url,
                 p.username as partner_username, p.profile_picture_url as partner_profile_picture_url
          FROM lineup_roster_entries e
          JOIN users u ON e.user_id = u.id
          LEFT JOIN users p ON e.partner_id = p.id
          WHERE e.lineup_id = ?
          ORDER BY e.format, e.position ASC
        `).bind(rosterIdNum).all<any>()
  ])

  if (!roster) {
    return jsonResponse(request, { error: 'Roster not found' }, { status: 404 })
  }

  const entries = (res.results || []).map((e: any) => ({
    id: String(e.id),
    lineupId: String(e.lineup_id),
    userId: String(e.user_id),
    partnerId: e.partner_id ? String(e.partner_id) : null,
    format: e.format,
    position: e.position,
    user: {
      id: String(e.user_id),
      username: e.username,
      profileImageUrl: e.profile_picture_url
    },
    partner: e.partner_id ? {
      id: String(e.partner_id),
      username: e.partner_username,
      profileImageUrl: e.partner_profile_picture_url
    } : null,
    createdAt: toIso(e.created_at),
    updatedAt: toIso(e.updated_at)
  }))

  return jsonResponse(request, { entries }, { status: 200 })
}

async function addLineupRosterEntry(request: Request, env: Env, teamId: string, rosterId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const rosterIdNum = parseIntOrNull(rosterId)
  if (teamIdNum == null || rosterIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const userIdToAdd = parseIntOrNull(data?.userId)
  if (userIdToAdd == null) {
    return jsonResponse(request, { error: 'userId is required' }, { status: 400 })
  }

  const format = data?.format || 'singles'
  if (!['singles', 'doubles', 'mixed'].includes(format)) {
    return jsonResponse(request, { error: 'Invalid format. Must be singles, doubles, or mixed.' }, { status: 400 })
  }

  const partnerIdToAdd = parseIntOrNull(data?.partnerId)

  const member = await env.DB
    .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
    .bind(teamIdNum, userIdToAdd)
    .first<any>()

  const playableRoles = ['Player', 'Coach', 'Owner']
  if (!member || !playableRoles.includes(member.role)) {
    return jsonResponse(request, { error: 'User must be a Player, Coach, or Owner on this team' }, { status: 400 })
  }

  if (partnerIdToAdd != null) {
    if (format === 'singles') {
      return jsonResponse(request, { error: 'Partner is not allowed for singles format' }, { status: 400 })
    }
    if (partnerIdToAdd === userIdToAdd) {
      return jsonResponse(request, { error: 'Partner cannot be the same as the player' }, { status: 400 })
    }
    const partnerMember = await env.DB
      .prepare('SELECT role FROM team_members WHERE team_id = ? AND user_id = ?')
      .bind(teamIdNum, partnerIdToAdd)
      .first<any>()
    if (!partnerMember || !playableRoles.includes(partnerMember.role)) {
      return jsonResponse(request, { error: 'Partner must be a Player, Coach, or Owner on this team' }, { status: 400 })
    }
  }

  const roster = await env.DB
    .prepare('SELECT id FROM lineup_rosters WHERE id = ? AND team_id = ?')
    .bind(rosterIdNum, teamIdNum)
    .first<any>()

  if (!roster) {
    return jsonResponse(request, { error: 'Roster not found' }, { status: 404 })
  }

  const existing = await env.DB
    .prepare('SELECT id FROM lineup_roster_entries WHERE lineup_id = ? AND user_id = ? AND format = ?')
    .bind(rosterIdNum, userIdToAdd, format)
    .first<any>()

  if (existing) {
    return jsonResponse(request, { error: `Player is already in this lineup for ${format}` }, { status: 400 })
  }

  const maxPos = await env.DB
    .prepare('SELECT MAX(position) as max_pos FROM lineup_roster_entries WHERE lineup_id = ? AND format = ?')
    .bind(rosterIdNum, format)
    .first<any>()

  const newPosition = (maxPos?.max_pos ?? 0) + 1

  const res = await env.DB
    .prepare('INSERT INTO lineup_roster_entries (lineup_id, user_id, partner_id, format, position) VALUES (?, ?, ?, ?, ?) RETURNING *')
    .bind(rosterIdNum, userIdToAdd, partnerIdToAdd, format, newPosition)
    .first<any>()

  const [userInfo, partnerInfo] = await Promise.all([
    env.DB.prepare('SELECT username, profile_picture_url FROM users WHERE id = ?').bind(userIdToAdd).first<any>(),
    partnerIdToAdd
      ? env.DB.prepare('SELECT username, profile_picture_url FROM users WHERE id = ?').bind(partnerIdToAdd).first<any>()
      : Promise.resolve(null),
  ])

  return jsonResponse(request, {
    entry: {
      id: String(res.id),
      lineupId: String(res.lineup_id),
      userId: String(res.user_id),
      partnerId: res.partner_id ? String(res.partner_id) : null,
      format: res.format,
      position: res.position,
      user: {
        id: String(userIdToAdd),
        username: userInfo?.username,
        profileImageUrl: userInfo?.profile_picture_url
      },
      partner: partnerInfo ? {
        id: String(partnerIdToAdd),
        username: partnerInfo.username,
        profileImageUrl: partnerInfo.profile_picture_url
      } : null,
      createdAt: toIso(res.created_at),
      updatedAt: toIso(res.updated_at)
    }
  }, { status: 201 })
}

async function removeLineupRosterEntry(request: Request, env: Env, teamId: string, rosterId: string, entryId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const rosterIdNum = parseIntOrNull(rosterId)
  const entryIdNum = parseIntOrNull(entryId)
  if (teamIdNum == null || rosterIdNum == null || entryIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  const entry = await env.DB
    .prepare('SELECT position, format FROM lineup_roster_entries WHERE id = ? AND lineup_id = ?')
    .bind(entryIdNum, rosterIdNum)
    .first<any>()

  if (!entry) {
    return jsonResponse(request, { error: 'Entry not found' }, { status: 404 })
  }

  await env.DB
    .prepare('DELETE FROM lineup_roster_entries WHERE id = ? AND lineup_id = ?')
    .bind(entryIdNum, rosterIdNum)
    .run()

  await env.DB
    .prepare('UPDATE lineup_roster_entries SET position = position - 1 WHERE lineup_id = ? AND format = ? AND position > ?')
    .bind(rosterIdNum, entry.format, entry.position)
    .run()

  return jsonResponse(request, { success: true }, { status: 200 })
}

async function reorderLineupRosterEntries(request: Request, env: Env, teamId: string, rosterId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const teamIdNum = parseIntOrNull(teamId)
  const rosterIdNum = parseIntOrNull(rosterId)
  if (teamIdNum == null || rosterIdNum == null) {
    return jsonResponse(request, { error: 'Invalid id' }, { status: 400 })
  }

  const role = await getRole(env, teamIdNum, Number(user.id))
  if (role !== 'Owner' && role !== 'Coach') {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const order = data?.order
  const format = data?.format || 'singles'
  
  if (!Array.isArray(order)) {
    return jsonResponse(request, { error: 'order array is required' }, { status: 400 })
  }
  
  if (!['singles', 'doubles', 'mixed'].includes(format)) {
    return jsonResponse(request, { error: 'Invalid format' }, { status: 400 })
  }

  const roster = await env.DB
    .prepare('SELECT id FROM lineup_rosters WHERE id = ? AND team_id = ?')
    .bind(rosterIdNum, teamIdNum)
    .first<any>()

  if (!roster) {
    return jsonResponse(request, { error: 'Roster not found' }, { status: 404 })
  }

  const statements: ReturnType<Env['DB']['prepare']>[] = []
  for (let i = 0; i < order.length; i++) {
    const entryIdNum = parseIntOrNull(order[i])
    if (entryIdNum != null) {
      statements.push(
        env.DB.prepare('UPDATE lineup_roster_entries SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND lineup_id = ? AND format = ?').bind(i + 1, entryIdNum, rosterIdNum, format)
      )
    }
  }
  if (statements.length > 0) {
    await env.DB.batch(statements)
  }

  return listLineupRosterEntries(request, env, teamId, rosterId)
}

export async function handleTeams(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  const method = request.method

  if (pathname === '/teams/matches/public' && method === 'GET') {
    return listPublicMatches(request, env)
  }

  if (pathname === '/teams/matches/public/full' && method === 'GET') {
    return listPublicMatchesFull(request, env)
  }

  if (pathname === '/teams' && method === 'GET') {
    return listTeams(request, env)
  }

  if (pathname === '/teams' && method === 'POST') {
    return createTeam(request, env)
  }

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null

  if (segments[0] === 'teams') {
    const teamId = segments[1]
    if (!teamId) return null

    if (segments.length === 2) {
      if (method === 'GET') return getTeam(request, env, teamId)
      if (method === 'PUT') return updateTeam(request, env, teamId)
      if (method === 'DELETE') return deleteTeam(request, env, teamId)
    }

    if (segments[2] === 'join' && segments.length === 3 && method === 'POST') {
      return joinTeam(request, env, teamId)
    }

    if (segments[2] === 'requests') {
      if (segments.length === 3 && method === 'GET') {
        return listJoinRequests(request, env, teamId)
      }
      if (segments.length === 5 && segments[4] === 'approve' && method === 'POST') {
        const userId = segments[3]
        return approveJoinRequest(request, env, teamId, userId)
      }
      if (segments.length === 4 && method === 'DELETE') {
        const userId = segments[3]
        return denyJoinRequest(request, env, teamId, userId)
      }
    }

    if (segments[2] === 'leave' && segments.length === 3 && method === 'DELETE') {
      return leaveTeam(request, env, teamId)
    }

    if (segments[2] === 'members') {
      if (segments.length === 3 && method === 'GET') {
        return listMembers(request, env, teamId)
      }
      if (segments.length === 4) {
        const memberId = segments[3]
        if (method === 'PUT') return updateMemberRole(request, env, teamId, memberId)
        if (method === 'DELETE') return removeMember(request, env, teamId, memberId)
      }
    }

    if (segments[2] === 'invites') {
      if (segments.length === 3) {
        if (method === 'GET') return listInvites(request, env, teamId)
        if (method === 'POST') return createInvite(request, env, teamId)
      }
      if (segments.length === 4) {
        const inviteId = segments[3]
        if (method === 'DELETE') return deleteInvite(request, env, teamId, inviteId)
      }
    }
  }

  if (segments[0] === 'invites' && segments.length === 3 && segments[2] === 'accept') {
    const inviteId = segments[1]
    if (method === 'POST') {
      return acceptInvite(request, env, inviteId)
    }
  }

  if (segments[0] === 'teams') {
    const teamId = segments[1]
    if (!teamId) return null

    if (segments.length === 2) {
      if (method === 'GET') return getTeam(request, env, teamId)
      if (method === 'PUT') return updateTeam(request, env, teamId)
      if (method === 'DELETE') return deleteTeam(request, env, teamId)
    }

    if (segments[2] === 'join' && segments.length === 3 && method === 'POST') {
      return joinTeam(request, env, teamId)
    }

    if (segments[2] === 'requests') {
      if (segments.length === 3 && method === 'GET') {
        return listJoinRequests(request, env, teamId)
      }
      if (segments.length === 5 && segments[4] === 'approve' && method === 'POST') {
        const userId = segments[3]
        return approveJoinRequest(request, env, teamId, userId)
      }
      if (segments.length === 4 && method === 'DELETE') {
        const userId = segments[3]
        return denyJoinRequest(request, env, teamId, userId)
      }
    }

    if (segments[2] === 'leave' && segments.length === 3 && method === 'DELETE') {
      return leaveTeam(request, env, teamId)
    }

    if (segments[2] === 'members') {
      if (segments.length === 3 && method === 'GET') {
        return listMembers(request, env, teamId)
      }
      if (segments.length === 4) {
        const memberId = segments[3]
        if (method === 'PUT') return updateMemberRole(request, env, teamId, memberId)
        if (method === 'DELETE') return removeMember(request, env, teamId, memberId)
      }
    }

    if (segments[2] === 'invites') {
      if (segments.length === 3) {
        if (method === 'GET') return listInvites(request, env, teamId)
        if (method === 'POST') return createInvite(request, env, teamId)
      }
      if (segments.length === 4) {
        const inviteId = segments[3]
        if (method === 'DELETE') return deleteInvite(request, env, teamId, inviteId)
      }
    }

    if (segments[2] === 'settings' && segments.length === 3 && method === 'PUT') {
      return updateTeamSettings(request, env, teamId)
    }

    if (segments[2] === 'ladders') {
      if (segments.length === 3) {
        if (method === 'GET') return listLadders(request, env, teamId)
        if (method === 'POST') return createLadder(request, env, teamId)
      }
      if (segments.length === 4) {
        const ladderId = segments[3]
        if (method === 'GET') return getLadder(request, env, teamId, ladderId)
        if (method === 'PUT') return updateLadder(request, env, teamId, ladderId)
        if (method === 'DELETE') return deleteLadder(request, env, teamId, ladderId)
      }
      if (segments.length === 5 && segments[4] === 'entries') {
        const ladderId = segments[3]
        if (method === 'GET') return listLadderEntries(request, env, teamId, ladderId)
        if (method === 'POST') return addLadderEntry(request, env, teamId, ladderId)
      }
      if (segments.length === 6 && segments[4] === 'entries') {
        const ladderId = segments[3]
        const entryId = segments[5]
        if (entryId === 'reorder' && method === 'POST') {
          return reorderLadderEntries(request, env, teamId, ladderId)
        }
        if (method === 'DELETE') return removeLadderEntry(request, env, teamId, ladderId, entryId)
      }
    }

    if (segments[2] === 'lineups') {
      if (segments.length === 3) {
        if (method === 'GET') return listLineupRosters(request, env, teamId)
        if (method === 'POST') return createLineupRoster(request, env, teamId)
      }
      if (segments.length === 4) {
        const lineupId = segments[3]
        if (method === 'GET') return getLineupRoster(request, env, teamId, lineupId)
        if (method === 'PUT') return updateLineupRoster(request, env, teamId, lineupId)
        if (method === 'DELETE') return deleteLineupRoster(request, env, teamId, lineupId)
      }
      if (segments.length === 5 && segments[4] === 'entries') {
        const lineupId = segments[3]
        if (method === 'GET') return listLineupRosterEntries(request, env, teamId, lineupId)
        if (method === 'POST') return addLineupRosterEntry(request, env, teamId, lineupId)
      }
      if (segments.length === 6 && segments[4] === 'entries') {
        const lineupId = segments[3]
        const entryId = segments[5]
        if (entryId === 'reorder' && method === 'POST') {
          return reorderLineupRosterEntries(request, env, teamId, lineupId)
        }
        if (method === 'DELETE') return removeLineupRosterEntry(request, env, teamId, lineupId, entryId)
      }
    }
  }

  return null
}