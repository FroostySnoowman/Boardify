import type { Env } from './bindings'
import { jsonResponse, emptyCorsResponse } from './http'
import { getCurrentUserFromSession } from './auth'
import { initStats, setServer, recordPoint, undoPoint, applyHistory, applyInitialLineScore } from './match-helper'
import type { MatchStats, MatchSettings, PointEvent, InitialLineScorePayload } from './match-helper'

function toIso(value: any): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  const d = new Date(value)
  if (!isNaN(d.getTime())) return d.toISOString()
  return String(value)
}

function rowToSettings(row: any): MatchSettings {
  return {
    yourPlayer1: row.your_player1,
    yourPlayer2: row.your_player2 || null,
    oppPlayer1: row.opp_player1,
    oppPlayer2: row.opp_player2 || null,
    scoring_type: row.scoring_type,
    tiebreak: row.tiebreak,
    games_to: row.games_to,
    best_of: row.best_of,
    format: row.format,
    server: row.server || null,
    matchType: row.match_type || null,
    tiebreak_trigger: row.tiebreak_trigger || null
  }
}

async function checkTeammates(env: Env, user1Id: number, user2Id: number): Promise<boolean> {
  const row = await env.DB
    .prepare(
      `
      SELECT 1 FROM team_members tm1
      JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = ? AND tm2.user_id = ?
      LIMIT 1
      `
    )
    .bind(user1Id, user2Id)
    .first<any>()
  return row !== null
}

async function authorizedToView(env: Env, viewerId: number, matchId: number): Promise<boolean> {
  const rec = await env.DB
    .prepare('SELECT user_id, is_public FROM matches WHERE id = ?')
    .bind(matchId)
    .first<any>()

  if (!rec) {
    return false
  }

  const isOwner = rec.user_id == viewerId
  if (isOwner) {
    return true
  }

  if (rec.is_public) {
    const areTeammates = await checkTeammates(env, viewerId, rec.user_id)
    if (areTeammates) {
      return true
    }
    return true
  }

  return false
}

async function getCurrentUserFromSessionOrToken(request: Request, env: Env): Promise<any | null> {
  const user = await getCurrentUserFromSession(request, env)
  if (user) return user

  const url = new URL(request.url)
  const token = url.searchParams.get('token')
  if (!token) return null

  const headers = new Headers(request.headers)
  headers.set('Authorization', `Bearer ${token}`)
  const tokenRequest = new Request(request, { headers })
  return getCurrentUserFromSession(tokenRequest, env)
}

async function createMatch(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const matchType = data.type || null
  const your1 = data.yourPlayer1 || null
  const opp1 = data.oppPlayer1 || null
  const server = data.server || null
  const fmt = data.format || null
  const gamesTo = data.gamesTo || null
  const bestOf = data.bestOf || null
  const tiebreak = data.tiebreak || null
  const scoring = data.scoringType || null
  const returnerSide = data.returnerPicksSide === true
  const showAdv = data.showAdvanced === true
  const tbTrigger = showAdv && data.tiebreakTrigger ? data.tiebreakTrigger : null
  const earlyPts = showAdv && data.earlySetsPoints ? data.earlySetsPoints : null
  const customEarly = showAdv && data.customEarlyPoints ? data.customEarlyPoints : null
  const finalPts = showAdv && data.finalSetPoints ? data.finalSetPoints : null
  const customFinal = showAdv && data.customFinalPoints ? data.customFinalPoints : null
  const matchTbOnly = showAdv && data.matchTiebreakFinalOnly === true
  const showPlayerOpts = data.showPlayerOptions === true
  const y1Hand = showPlayerOpts && data.yourPlayer1Hand ? data.yourPlayer1Hand : null
  const y1Bh = showPlayerOpts && data.yourPlayer1Backhand ? data.yourPlayer1Backhand : null
  const y2 = data.yourPlayer2 || null
  const y2Hand = showPlayerOpts && data.yourPlayer2Hand ? data.yourPlayer2Hand : null
  const y2Bh = showPlayerOpts && data.yourPlayer2Backhand ? data.yourPlayer2Backhand : null
  const o1Hand = showPlayerOpts && data.oppPlayer1Hand ? data.oppPlayer1Hand : null
  const o1Bh = showPlayerOpts && data.oppPlayer1Backhand ? data.oppPlayer1Backhand : null
  const o2 = data.oppPlayer2 || null
  const o2Hand = showPlayerOpts && data.oppPlayer2Hand ? data.oppPlayer2Hand : null
  const o2Bh = showPlayerOpts && data.oppPlayer2Backhand ? data.oppPlayer2Backhand : null
  const isPublic = data.isPublic !== false
  const statMode = data.statMode || 'intermediate'
  const customStats = JSON.stringify(data.customStats || [])
  const customStatsTeams = data.customStatsTeams || null
  const customStatsIndividual = data.customStatsIndividual !== false
  const trackForehandBackhand = statMode === 'advanced' && data.trackForehandBackhand === true
  const startingCourtSide = data.startingCourtSide || null
  const courtStyle = data.courtStyle || 'hard_1'
  const courtSurface = data.courtSurface || 'hard'
  const sideSwitchingFormat = data.sideSwitchingFormat || 'normal'
  const tiebreakFormat = data.tiebreakFormat || 'standard'

  await env.DB
    .prepare("UPDATE matches SET status = 'completed' WHERE user_id = ? AND status = 'active'")
    .bind(uid)
    .run()

  const rec = await env.DB
    .prepare(
      `
      INSERT INTO matches
        (user_id, match_type,
         your_player1, your_player1_hand, your_player1_backhand,
         your_player2, your_player2_hand, your_player2_backhand,
         opp_player1, opp_player1_hand, opp_player1_backhand,
         opp_player2, opp_player2_hand, opp_player2_backhand,
         server, format, games_to, best_of, tiebreak,
         scoring_type, returner_picks_side, show_player_options, show_advanced,
         tiebreak_trigger, early_sets_points, custom_early_points,
         final_set_points, custom_final_points, match_tiebreak_final_only,
         is_public, stat_mode, custom_stats, custom_stats_teams, custom_stats_individual, track_forehand_backhand, starting_court_side, court_style, court_surface, side_switching_format, tiebreak_format, status, created_at)
      VALUES
        (?, ?,
         ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?, ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
      RETURNING id
      `
    )
    .bind(
      uid, matchType,
      your1, y1Hand, y1Bh,
      y2, y2Hand, y2Bh,
      opp1, o1Hand, o1Bh,
      o2, o2Hand, o2Bh,
      server, fmt, gamesTo, bestOf, tiebreak,
      scoring, returnerSide, showPlayerOpts, showAdv,
      tbTrigger, earlyPts, customEarly,
      finalPts, customFinal, matchTbOnly,
      isPublic, statMode, customStats, customStatsTeams, customStatsIndividual, trackForehandBackhand, startingCourtSide, courtStyle, courtSurface, sideSwitchingFormat, tiebreakFormat
    )
    .first<any>()

  const matchId = rec.id
  const stats = initStats(matchId)

  await env.DB
    .prepare('INSERT INTO match_stats (match_id, stats) VALUES (?, ?)')
    .bind(matchId, JSON.stringify(stats))
    .run()

  await broadcastLiveMatchesList(env, 'match_created', matchId)

  return jsonResponse(request, { matchId: String(matchId) }, { status: 201 })
}

async function getCurrentMatch(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const rec = await env.DB
    .prepare(
      `
      SELECT *
      FROM matches
      WHERE user_id = ?
        AND status = 'active'
      ORDER BY created_at DESC
      LIMIT 1
      `
    )
    .bind(uid)
    .first<any>()

  if (!rec) {
    return jsonResponse(request, { error: 'No active match' }, { status: 404 })
  }

  const result = {
    ...rec,
    id: String(rec.id),
    trackForehandBackhand: rec.track_forehand_backhand === 1,
    startingCourtSide: rec.starting_court_side || null,
    courtStyle: rec.court_style || 'hard_1',
    courtSurface: rec.court_surface || 'hard',
    sideSwitchingFormat: rec.side_switching_format || 'normal',
    tiebreakFormat: rec.tiebreak_format || 'standard',
    is_paused: rec.is_paused || 0,
    paused_at: rec.paused_at || null,
    total_paused_ms: rec.total_paused_ms || 0,
    timer_started_at: rec.timer_started_at || null,
    created_at: toIso(rec.created_at),
    updated_at: toIso(rec.updated_at)
  }

  return jsonResponse(request, result, { status: 200 })
}

async function getMatchHistory(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const res = await env.DB
    .prepare(
      `
      SELECT m.id, m.your_player1, m.your_player2, m.opp_player1, m.opp_player2, m.created_at, m.status, m.exclude_from_analytics, s.stats
      FROM matches m
      LEFT JOIN match_stats s ON m.id = s.match_id
      WHERE m.user_id = ?
      ORDER BY m.created_at DESC
      `
    )
    .bind(uid)
    .all<any>()

  const rows = res.results || []
  const history = []

  for (const row of rows) {
    const stats = row.stats ? JSON.parse(row.stats) : {}
    const yourIds = [row.your_player1, row.your_player2].filter(Boolean)
    const oppIds = [row.opp_player1, row.opp_player2].filter(Boolean)

    const scoreParts = []

    for (const s of stats.sets || []) {
      const yourGames = yourIds.reduce((sum: number, pId: string) => sum + (s.games[pId] || 0), 0)
      const oppGames = oppIds.reduce((sum: number, pId: string) => sum + (s.games[pId] || 0), 0)
      scoreParts.push(`${yourGames}-${oppGames}`)
    }

    if (!stats.matchWinner) {
      const currentSet = stats.currentSet || {}
      const yourGamesCurrent = yourIds.reduce((sum: number, pId: string) => sum + ((currentSet.games || {})[pId] || 0), 0)
      const oppGamesCurrent = oppIds.reduce((sum: number, pId: string) => sum + ((currentSet.games || {})[pId] || 0), 0)
      scoreParts.push(`${yourGamesCurrent}-${oppGamesCurrent}`)
    }

    let result = 'Ongoing'
    if (stats.matchWinner) {
      const isWinner = yourIds.includes(stats.matchWinner)
      result = isWinner ? 'Won' : 'Lost'
    }

    const isCompleted = row.status === 'completed' || !!stats.matchWinner
    let scoreStr = scoreParts.length > 0 ? scoreParts.join(', ') : 'In Progress'
    if (isCompleted && (scoreStr === 'In Progress' || scoreStr === '0-0')) {
      scoreStr = '-'
    }

    const oppNames = [row.opp_player1, row.opp_player2].filter(Boolean)
    const excludeFromAnalytics = Number(row.exclude_from_analytics ?? 0) === 1
    history.push({
      id: String(row.id),
      opponentNames: oppNames.join(' / '),
      result,
      score: scoreStr,
      date: toIso(row.created_at),
      status: isCompleted ? 'completed' : row.status,
      excludeFromAnalytics
    })
  }

  return jsonResponse(request, history, { status: 200 })
}

async function getMatchHistoryCount(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const row = await env.DB
    .prepare(
      `SELECT COUNT(*) as count FROM matches WHERE user_id = ? AND status = 'completed' AND COALESCE(exclude_from_analytics, 0) = 0`
    )
    .bind(uid)
    .first<{ count: number }>()

  const count = row?.count ?? 0
  return jsonResponse(request, { count }, { status: 200 })
}

async function getMatchHistoryRange(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const row = await env.DB
    .prepare(
      `SELECT MIN(created_at) as oldest FROM matches WHERE user_id = ? AND status = 'completed' AND COALESCE(exclude_from_analytics, 0) = 0`
    )
    .bind(uid)
    .first<{ oldest: string | null }>()

  const oldestDate = row?.oldest ? toIso(row.oldest) : null
  return jsonResponse(request, { oldestDate }, { status: 200 })
}

async function patchMatch(request: Request, env: Env, matchId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const mid = Number(matchId)
  let body: { excludeFromAnalytics?: boolean } = {}
  try {
    body = (await request.json()) as { excludeFromAnalytics?: boolean }
  } catch {
    body = {}
  }
  if (typeof body.excludeFromAnalytics !== 'boolean') {
    return jsonResponse(request, { error: 'excludeFromAnalytics (boolean) is required' }, { status: 400 })
  }

  const rec = await env.DB
    .prepare('SELECT id, status FROM matches WHERE id = ? AND user_id = ?')
    .bind(mid, uid)
    .first<{ id: number; status: string }>()
  if (!rec) {
    return jsonResponse(request, { error: 'Not found' }, { status: 404 })
  }
  if (rec.status !== 'completed') {
    return jsonResponse(request, { error: 'Only completed matches can be updated' }, { status: 400 })
  }

  const val = body.excludeFromAnalytics ? 1 : 0
  await env.DB
    .prepare(
      'UPDATE matches SET exclude_from_analytics = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'
    )
    .bind(val, mid, uid)
    .run()

  return emptyCorsResponse(request, 204)
}

async function deleteCompletedMatchHistory(request: Request, env: Env, matchId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const mid = Number(matchId)

  const rec = await env.DB
    .prepare('SELECT id, status FROM matches WHERE id = ? AND user_id = ?')
    .bind(mid, uid)
    .first<{ id: number; status: string }>()
  if (!rec) {
    return jsonResponse(request, { error: 'Not found' }, { status: 404 })
  }
  if (rec.status !== 'completed') {
    return jsonResponse(request, { error: 'Only completed matches can be removed from history' }, { status: 400 })
  }

  const result = await env.DB
    .prepare('DELETE FROM matches WHERE id = ? AND user_id = ? AND status = ?')
    .bind(mid, uid, 'completed')
    .run()

  if (result.meta.changes === 0) {
    return jsonResponse(request, { error: 'Not found' }, { status: 404 })
  }

  return emptyCorsResponse(request, 204)
}

async function getMatch(request: Request, env: Env, matchId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const rec = await env.DB
    .prepare('SELECT * FROM matches WHERE id = ? AND user_id = ?')
    .bind(Number(matchId), uid)
    .first<any>()

  if (!rec) {
    return jsonResponse(request, { error: 'Not found' }, { status: 404 })
  }

  const result = {
    ...rec,
    id: String(rec.id),
    courtStyle: rec.court_style || 'hard_1',
    courtSurface: rec.court_surface || 'hard',
    sideSwitchingFormat: rec.side_switching_format || 'normal',
    tiebreakFormat: rec.tiebreak_format || 'standard',
    is_paused: rec.is_paused || 0,
    paused_at: rec.paused_at || null,
    total_paused_ms: rec.total_paused_ms || 0,
    timer_started_at: rec.timer_started_at || null,
    created_at: toIso(rec.created_at),
    updated_at: toIso(rec.updated_at)
  }

  return jsonResponse(request, result, { status: 200 })
}

async function pauseMatch(request: Request, env: Env, matchId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const mid = Number(matchId)

  const rec = await env.DB
    .prepare('SELECT id, is_paused, total_paused_ms, timer_started_at FROM matches WHERE id = ? AND user_id = ? AND status = ?')
    .bind(mid, uid, 'active')
    .first<any>()
  if (!rec) {
    return jsonResponse(request, { error: 'Not found or not active' }, { status: 404 })
  }
  if (rec.is_paused) {
    return jsonResponse(request, { error: 'Already paused' }, { status: 409 })
  }

  let data: any = {}
  try { data = await request.json() } catch { data = {} }
  const reason = data.reason || null

  const now = new Date().toISOString()
  await env.DB
    .prepare(
      `UPDATE matches SET is_paused = 1, paused_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
    .bind(now, mid)
    .run()

  return jsonResponse(request, { isPaused: true, pausedAt: now, totalPausedMs: rec.total_paused_ms || 0, timerStartedAt: rec.timer_started_at }, { status: 200 })
}

async function resumeMatch(request: Request, env: Env, matchId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const mid = Number(matchId)

  const rec = await env.DB
    .prepare('SELECT id, is_paused, paused_at, total_paused_ms FROM matches WHERE id = ? AND user_id = ? AND status = ?')
    .bind(mid, uid, 'active')
    .first<any>()
  if (!rec) {
    return jsonResponse(request, { error: 'Not found or not active' }, { status: 404 })
  }
  if (!rec.is_paused) {
    return jsonResponse(request, { error: 'Not paused' }, { status: 409 })
  }

  const pausedAt = rec.paused_at ? new Date(rec.paused_at).getTime() : Date.now()
  const additionalPausedMs = Date.now() - pausedAt
  const newTotalPausedMs = (rec.total_paused_ms || 0) + additionalPausedMs

  await env.DB
    .prepare(
      `UPDATE matches SET is_paused = 0, paused_at = NULL, total_paused_ms = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
    .bind(newTotalPausedMs, mid)
    .run()

  return jsonResponse(request, { isPaused: false, pausedAt: null, totalPausedMs: newTotalPausedMs }, { status: 200 })
}

async function startTimer(request: Request, env: Env, matchId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const mid = Number(matchId)

  const rec = await env.DB
    .prepare('SELECT id FROM matches WHERE id = ? AND user_id = ? AND status = ?')
    .bind(mid, uid, 'active')
    .first<any>()
  if (!rec) {
    return jsonResponse(request, { error: 'Not found or not active' }, { status: 404 })
  }

  const now = new Date().toISOString()
  await env.DB
    .prepare(
      `UPDATE matches SET timer_started_at = ?, total_paused_ms = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
    .bind(now, mid)
    .run()

  return jsonResponse(request, { timerStartedAt: now }, { status: 200 })
}

async function endMatch(
  request: Request,
  env: Env,
  matchId: string,
  ctx?: ExecutionContext
): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const matchIdNum = Number(matchId)

  const rec = await env.DB
    .prepare('SELECT id FROM matches WHERE id = ? AND user_id = ? AND status = ?')
    .bind(matchIdNum, uid, 'active')
    .first<any>()
  if (!rec) {
    return jsonResponse(request, { error: 'Not found or already completed' }, { status: 404 })
  }

  let body: { stats?: unknown; endedEarlyReason?: string } = {}
  try {
    const raw = (await request.json()) as Record<string, unknown> | null
    if (raw && typeof raw === 'object') {
      if ('stats' in raw && raw.stats !== undefined) body.stats = raw.stats
      if ('endedEarlyReason' in raw && typeof raw.endedEarlyReason === 'string') body.endedEarlyReason = raw.endedEarlyReason
    }
  } catch {
    // no body or invalid JSON
  }
  const endedReason = body.endedEarlyReason || null
  const endMatchPromises: Promise<any>[] = [
    env.DB.prepare(
      "UPDATE matches SET status = 'completed', ended_early_reason = ? WHERE id = ? AND user_id = ? AND status = 'active'"
    ).bind(endedReason, matchIdNum, uid).run(),
  ]
  if (body.stats != null && typeof body.stats === 'object') {
    endMatchPromises.push(
      env.DB.prepare(
        `INSERT INTO match_stats (match_id, stats)
         VALUES (?, ?)
         ON CONFLICT (match_id) DO UPDATE SET stats = excluded.stats`
      ).bind(matchIdNum, JSON.stringify(body.stats)).run()
    )
  }
  const [result] = await Promise.all(endMatchPromises)

  if (result.meta.changes === 0) {
    return jsonResponse(request, { error: 'Not found or already completed' }, { status: 404 })
  }

  const fanOut = Promise.all([
    broadcastLiveMatchesList(env, 'match_ended', matchIdNum),
    broadcastToSpectators(env, matchIdNum, {
      type: 'stream_status',
      event: 'stream_ended',
      reason: 'match_ended',
      stream: {
        status: {
          state: 'ended',
        },
      },
    }),
  ]).catch(() => {})
  if (ctx) {
    ctx.waitUntil(fanOut)
  } else {
    await fanOut
  }

  return emptyCorsResponse(request, 204)
}

async function setServerRoute(request: Request, env: Env, matchId: string): Promise<Response> {
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

  const serverId = data.serverId
  if (!serverId) {
    return jsonResponse(request, { error: 'serverId is required' }, { status: 400 })
  }

  const [recMatch, recStats] = await Promise.all([
    env.DB.prepare('SELECT * FROM matches WHERE id = ? AND user_id = ?').bind(Number(matchId), Number(user.id)).first<any>(),
    env.DB.prepare('SELECT stats FROM match_stats WHERE match_id = ?').bind(Number(matchId)).first<any>(),
  ])

  if (!recMatch) {
    return jsonResponse(request, { error: 'Match not found' }, { status: 404 })
  }

  let stats: any = recStats ? JSON.parse(recStats.stats) : initStats(Number(matchId))

  const settings = rowToSettings(recMatch)
  settings.server = serverId
  const updatedStats = setServer(stats, serverId, settings)

  await Promise.all([
    env.DB.prepare('UPDATE matches SET server = ? WHERE id = ?').bind(serverId, Number(matchId)).run(),
    env.DB.prepare('UPDATE match_stats SET stats = ? WHERE match_id = ?').bind(JSON.stringify(updatedStats), Number(matchId)).run(),
  ])

  await broadcastToSpectators(env, Number(matchId), updatedStats)

  return jsonResponse(request, updatedStats, { status: 200 })
}

async function initialLineScoreRoute(request: Request, env: Env, matchId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const [recMatch, recStats] = await Promise.all([
    env.DB.prepare('SELECT * FROM matches WHERE id = ? AND user_id = ?').bind(Number(matchId), Number(user.id)).first<any>(),
    env.DB.prepare('SELECT stats FROM match_stats WHERE match_id = ?').bind(Number(matchId)).first<any>(),
  ])

  if (!recMatch) {
    return jsonResponse(request, { error: 'Match not found' }, { status: 404 })
  }
  if (recMatch.status !== 'active') {
    return jsonResponse(request, { error: 'Match not active' }, { status: 400 })
  }
  if (recMatch.timer_started_at) {
    return jsonResponse(request, { error: 'Timer already started' }, { status: 400 })
  }

  let stats: any = recStats ? JSON.parse(recStats.stats) : initStats(Number(matchId))
  if (stats.history && stats.history.length > 0) {
    return jsonResponse(request, { error: 'Points already recorded' }, { status: 400 })
  }

  const serverId = recMatch.server || stats.server
  if (!serverId) {
    return jsonResponse(request, { error: 'Set server first' }, { status: 400 })
  }

  const settings = rowToSettings(recMatch)
  stats = setServer(stats, serverId, settings)

  const payload: InitialLineScorePayload = {
    yourSets: Number(body.yourSets) || 0,
    oppSets: Number(body.oppSets) || 0,
    yourGames: Number(body.yourGames) || 0,
    oppGames: Number(body.oppGames) || 0,
    yourPoints: Number(body.yourPoints) || 0,
    oppPoints: Number(body.oppPoints) || 0,
  }

  const result = applyInitialLineScore(stats, settings, payload)
  if (!result.ok) {
    return jsonResponse(request, { error: result.error }, { status: 400 })
  }

  await env.DB
    .prepare('UPDATE match_stats SET stats = ? WHERE match_id = ?')
    .bind(JSON.stringify(stats), Number(matchId))
    .run()

  await broadcastToSpectators(env, Number(matchId), stats)

  return jsonResponse(request, stats, { status: 200 })
}

async function setStartingCourtSideRoute(request: Request, env: Env, matchId: string): Promise<Response> {
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

  const courtSide = data.courtSide
  if (!courtSide || (courtSide !== 'top' && courtSide !== 'bottom')) {
    return jsonResponse(request, { error: 'courtSide must be "top" or "bottom"' }, { status: 400 })
  }

  const recMatch = await env.DB
    .prepare('SELECT * FROM matches WHERE id = ? AND user_id = ?')
    .bind(Number(matchId), Number(user.id))
    .first<any>()

  if (!recMatch) {
    return jsonResponse(request, { error: 'Match not found' }, { status: 404 })
  }

  await env.DB
    .prepare('UPDATE matches SET starting_court_side = ? WHERE id = ?')
    .bind(courtSide, Number(matchId))
    .run()

  const result = {
    ...recMatch,
    id: String(recMatch.id),
    starting_court_side: courtSide,
    trackForehandBackhand: recMatch.track_forehand_backhand === 1,
    startingCourtSide: courtSide,
    courtStyle: recMatch.court_style || 'hard_1',
    courtSurface: recMatch.court_surface || 'hard',
    created_at: toIso(recMatch.created_at),
    updated_at: toIso(recMatch.updated_at)
  }

  return jsonResponse(request, result, { status: 200 })
}

async function getStats(request: Request, env: Env, matchId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const [recMatch, rec] = await Promise.all([
    env.DB.prepare('SELECT user_id, is_public, server FROM matches WHERE id = ?').bind(Number(matchId)).first<any>(),
    env.DB.prepare('SELECT stats FROM match_stats WHERE match_id = ?').bind(Number(matchId)).first<any>(),
  ])

  if (!recMatch) {
    return jsonResponse(request, { error: 'Match not found' }, { status: 404 })
  }

  const isOwner = recMatch.user_id === uid
  const isPublic = recMatch.is_public
  let isTeammate = false
  if (isPublic && !isOwner) {
    isTeammate = await checkTeammates(env, uid, recMatch.user_id)
  }

  if (!isOwner && !isTeammate) {
    return jsonResponse(request, { error: 'Not authorized' }, { status: 403 })
  }

  let stats: any
  if (!rec || !rec.stats) {
    stats = initStats(Number(matchId))
    stats.server = recMatch.server || null
    await env.DB
      .prepare(
        `INSERT INTO match_stats (match_id, stats)
         VALUES (?, ?)
         ON CONFLICT (match_id) DO UPDATE SET stats = excluded.stats`
      )
      .bind(Number(matchId), JSON.stringify(stats))
      .run()
  } else {
    stats = JSON.parse(rec.stats)
  }

  return jsonResponse(request, stats, { status: 200 })
}

async function logPoint(
  request: Request,
  env: Env,
  matchId: string,
  ctx?: ExecutionContext
): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  let event: any = {}
  try {
    event = await request.json()
  } catch {
    event = {}
  }

  if (!event || !event.pointWinnerId) {
    return jsonResponse(request, { error: 'Invalid payload' }, { status: 400 })
  }

  const [recStats, recMatch] = await Promise.all([
    env.DB.prepare('SELECT stats FROM match_stats WHERE match_id = ?').bind(Number(matchId)).first<any>(),
    env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(Number(matchId)).first<any>(),
  ])

  if (!recMatch) {
    return jsonResponse(request, { error: 'Match not found' }, { status: 404 })
  }

  const oldStats = recStats ? JSON.parse(recStats.stats) : initStats(Number(matchId))
  const settings = rowToSettings(recMatch)
  const newStats = recordPoint(Number(matchId), oldStats, event, settings)

  const logPointOps: Promise<any>[] = [
    env.DB.prepare(
      `INSERT INTO match_stats (match_id, stats)
       VALUES (?, ?)
       ON CONFLICT (match_id) DO UPDATE SET stats = excluded.stats`
    ).bind(Number(matchId), JSON.stringify(newStats)).run(),
  ]
  if (newStats.matchWinner) {
    logPointOps.push(
      env.DB.prepare("UPDATE matches SET status = 'completed' WHERE id = ?")
        .bind(Number(matchId)).run()
    )
  }
  await Promise.all(logPointOps)

  const spectateFanOut = broadcastToSpectators(env, Number(matchId), newStats).catch(() => {})
  if (ctx) {
    ctx.waitUntil(spectateFanOut)
  } else {
    await spectateFanOut
  }

  return jsonResponse(request, newStats, { status: 200 })
}

async function undoLast(request: Request, env: Env, matchId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const [recStats, recMatch] = await Promise.all([
    env.DB.prepare('SELECT stats FROM match_stats WHERE match_id = ?').bind(Number(matchId)).first<any>(),
    env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(Number(matchId)).first<any>(),
  ])

  if (!recStats) {
    return jsonResponse(request, { error: 'Nothing to undo' }, { status: 400 })
  }
  if (!recMatch) {
    return jsonResponse(request, { error: 'Match not found' }, { status: 404 })
  }
  if (Number(recMatch.user_id) !== Number(user.id)) {
    return jsonResponse(request, { error: 'Match not found' }, { status: 404 })
  }

  const oldStats = JSON.parse(recStats.stats)
  const hadHistoryBefore = (oldStats.history || []).length > 0
  const settings = rowToSettings(recMatch)
  const newStats = undoPoint(Number(matchId), oldStats, settings)

  const undoOps: Promise<any>[] = [
    env.DB.prepare('UPDATE match_stats SET stats = ? WHERE match_id = ?')
      .bind(JSON.stringify(newStats), Number(matchId)).run(),
  ]
  if (oldStats.matchWinner && !newStats.matchWinner) {
    undoOps.push(
      env.DB.prepare("UPDATE matches SET status = 'active' WHERE id = ?")
        .bind(Number(matchId)).run()
    )
  }
  if (!hadHistoryBefore) {
    undoOps.push(
      env.DB
        .prepare(
          `UPDATE matches SET server = NULL, timer_started_at = NULL, total_paused_ms = 0, is_paused = 0, paused_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`
        )
        .bind(Number(matchId), Number(user.id))
        .run()
    )
  }
  await Promise.all(undoOps)

  await broadcastToSpectators(env, Number(matchId), newStats)

  return jsonResponse(request, newStats, { status: 200 })
}

async function getAnalytics(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const url = new URL(request.url)
  const period = url.searchParams.get('period') || 'all'
  const limitParam = url.searchParams.get('limit')
  const limit = limitParam != null ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 10)) : null

  const now = new Date()
  let startDate: Date | null = null
  if (limit == null && period === '7d') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  else if (limit == null && period === '14d') startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
  else if (limit == null && period === '30d') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  else if (limit == null && period === '90d') startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
  else if (limit == null && period === '365d') startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  else if (limit == null && /^\d+d$/.test(period)) {
    const n = Math.min(3650, Math.max(1, parseInt(period.slice(0, -1), 10) || 1))
    startDate = new Date(now.getTime() - n * 24 * 60 * 60 * 1000)
  }

  let query = `
    SELECT m.id, m.your_player1, m.your_player2, m.created_at, m.court_surface, s.stats
    FROM matches m
    JOIN match_stats s ON m.id = s.match_id
    WHERE m.user_id = ? AND m.status = 'completed' AND COALESCE(m.exclude_from_analytics, 0) = 0
  `
  const params: any[] = [uid]
  if (limit == null && startDate) {
    query += ' AND m.created_at >= ?'
    params.push(startDate.toISOString())
  }
  query += ' ORDER BY m.created_at DESC'
  if (limit != null) {
    query += ' LIMIT ?'
    params.push(limit)
  }

  const res = await env.DB.prepare(query).bind(...params).all<any>()
  const rows = res.results || []

  const kpis = {
    matches_played: rows.length,
    wins: 0,
    total_aces: 0,
    total_winners: 0,
    total_double_faults: 0,
    total_unforced_errors: 0,
    rally_unforced_errors: 0,
    first_serves_in: 0,
    first_serves_attempted: 0,
    first_serve_pts_won: 0,
    first_serve_pts_played: 0,
    second_serves_in: 0,
    second_serves_attempted: 0,
    second_serve_pts_won: 0,
    second_serve_pts_played: 0,
    service_pts_won: 0,
    service_pts_played: 0,
    break_pts_saved: 0,
    break_pts_faced: 0,
    serves_unreturned: 0,
    return_pts_won: 0,
    return_pts_played: 0,
    first_serve_return_made: 0,
    first_serve_return_attempted: 0,
    first_serve_return_pts_won: 0,
    first_serve_return_pts_played: 0,
    second_serve_return_made: 0,
    second_serve_return_attempted: 0,
    second_serve_return_pts_won: 0,
    second_serve_return_pts_played: 0,
    return_unforced_errors: 0,
    return_forced_errors: 0,
    return_winners: 0,
    break_pts_converted: 0,
    break_pt_opportunities: 0,
    forced_errors: 0,
    net_pts_won: 0,
    net_pts_attempted: 0,
    longest_rally_length: 0,
    total_rally_length: 0,
    rally_count: 0,
    rally_short_won: 0,
    rally_short_played: 0,
    rally_medium_won: 0,
    rally_medium_played: 0,
    rally_long_won: 0,
    rally_long_played: 0,
    rally_counter_used: false,
    points_won: 0,
    points_played: 0,
    service_games_won: 0,
    service_games_played: 0,
    return_games_won: 0,
    return_games_played: 0,
    game_pts_won_serve: 0,
    game_pts_opportunity_serve: 0,
    game_pts_won_return: 0,
    game_pts_opportunity_return: 0,
    set_pt_opp_serve: 0,
    set_pts_won_serve: 0,
    set_pt_opp_return: 0,
    set_pts_won_return: 0,
    match_pt_opp_serve: 0,
    match_pts_won_serve: 0,
    match_pt_opp_return: 0,
    match_pts_won_return: 0,
    set_pt_faced_serve: 0,
    set_pts_saved_serve: 0,
    match_pt_faced_serve: 0,
    match_pts_saved_serve: 0,
    tiebreak_serve_pts_won: 0,
    tiebreak_serve_pts_played: 0,
    tiebreak_return_pts_won: 0,
    tiebreak_return_pts_played: 0,
    deuce_side_pts_won: 0,
    deuce_side_pts_played: 0,
    ad_side_pts_won: 0,
    ad_side_pts_played: 0,
    return_deuce_side_pts_won: 0,
    return_deuce_side_pts_played: 0,
    return_ad_side_pts_won: 0,
    return_ad_side_pts_played: 0,
    forehand_winners: 0,
    forehand_errors: 0,
    backhand_winners: 0,
    backhand_errors: 0,
    volley_winners: 0,
    volley_errors: 0,
    overhead_winners: 0,
    overhead_errors: 0,
    love_games_won: 0,
    love_games_lost: 0,
    longest_point_streak: 0,
    longest_game_streak: 0,
    longest_set_streak: 0,
    lets: 0,
    foot_faults: 0,
    touching_net: 0,
    penalties: 0,
    sets_played: 0,
    sets_won: 0,
    comebacks_down_1_set: 0,
    comebacks_down_2_sets: 0,
    losses_up_1_set: 0,
    losses_up_2_sets: 0,
    wins_vs_lefty: 0,
    losses_vs_lefty: 0,
    wins_vs_righty: 0,
    losses_vs_righty: 0,
    wins_hard: 0,
    losses_hard: 0,
    wins_clay: 0,
    losses_clay: 0,
    wins_grass: 0,
    losses_grass: 0,
    wins_carpet: 0,
    losses_carpet: 0,
  }

  const heatmapData = []
  const perMatchTrends: Array<{ date: string; [key: string]: number | string | null }> = []
  const safePct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0)
  let currentMatchStreak = 0
  let longestMatchStreak = 0

  for (const row of rows) {
    const stats = JSON.parse(row.stats)
    const yourIds = [row.your_player1, row.your_player2].filter(Boolean)
    const isWinner = yourIds.includes(stats.matchWinner)
    if (isWinner) {
      kpis.wins += 1
      currentMatchStreak += 1
      if (currentMatchStreak > longestMatchStreak) {
        longestMatchStreak = currentMatchStreak
      }
    } else {
      currentMatchStreak = 0
    }

    const rowKpis = { ...kpis, matches_played: 1, wins: isWinner ? 1 : 0 }
    rowKpis.total_aces = 0
    rowKpis.total_double_faults = 0
    rowKpis.total_winners = 0
    rowKpis.total_unforced_errors = 0
    rowKpis.rally_unforced_errors = 0
    rowKpis.first_serves_in = 0
    rowKpis.first_serves_attempted = 0
    rowKpis.first_serve_pts_won = 0
    rowKpis.first_serve_pts_played = 0
    rowKpis.second_serves_in = 0
    rowKpis.second_serves_attempted = 0
    rowKpis.second_serve_pts_won = 0
    rowKpis.second_serve_pts_played = 0
    rowKpis.service_pts_won = 0
    rowKpis.service_pts_played = 0
    rowKpis.break_pts_saved = 0
    rowKpis.break_pts_faced = 0
    rowKpis.serves_unreturned = 0
    rowKpis.return_pts_won = 0
    rowKpis.return_pts_played = 0
    rowKpis.first_serve_return_made = 0
    rowKpis.first_serve_return_attempted = 0
    rowKpis.first_serve_return_pts_won = 0
    rowKpis.first_serve_return_pts_played = 0
    rowKpis.second_serve_return_made = 0
    rowKpis.second_serve_return_attempted = 0
    rowKpis.second_serve_return_pts_won = 0
    rowKpis.second_serve_return_pts_played = 0
    rowKpis.return_unforced_errors = 0
    rowKpis.return_forced_errors = 0
    rowKpis.return_winners = 0
    rowKpis.break_pts_converted = 0
    rowKpis.break_pt_opportunities = 0
    rowKpis.forced_errors = 0
    rowKpis.net_pts_won = 0
    rowKpis.net_pts_attempted = 0
    rowKpis.longest_rally_length = 0
    rowKpis.total_rally_length = 0
    rowKpis.rally_count = 0
    rowKpis.rally_short_won = 0
    rowKpis.rally_short_played = 0
    rowKpis.rally_medium_won = 0
    rowKpis.rally_medium_played = 0
    rowKpis.rally_long_won = 0
    rowKpis.rally_long_played = 0
    rowKpis.rally_counter_used = false
    rowKpis.points_won = 0
    rowKpis.points_played = 0
    rowKpis.service_games_won = 0
    rowKpis.service_games_played = 0
    rowKpis.return_games_won = 0
    rowKpis.return_games_played = 0
    rowKpis.game_pts_won_serve = 0
    rowKpis.game_pts_opportunity_serve = 0
    rowKpis.game_pts_won_return = 0
    rowKpis.game_pts_opportunity_return = 0
    rowKpis.set_pt_opp_serve = 0
    rowKpis.set_pts_won_serve = 0
    rowKpis.set_pt_opp_return = 0
    rowKpis.set_pts_won_return = 0
    rowKpis.match_pt_opp_serve = 0
    rowKpis.match_pts_won_serve = 0
    rowKpis.match_pt_opp_return = 0
    rowKpis.match_pts_won_return = 0
    rowKpis.set_pt_faced_serve = 0
    rowKpis.set_pts_saved_serve = 0
    rowKpis.match_pt_faced_serve = 0
    rowKpis.match_pts_saved_serve = 0
    rowKpis.tiebreak_serve_pts_won = 0
    rowKpis.tiebreak_serve_pts_played = 0
    rowKpis.tiebreak_return_pts_won = 0
    rowKpis.tiebreak_return_pts_played = 0
    rowKpis.deuce_side_pts_won = 0
    rowKpis.deuce_side_pts_played = 0
    rowKpis.ad_side_pts_won = 0
    rowKpis.ad_side_pts_played = 0
    rowKpis.return_deuce_side_pts_won = 0
    rowKpis.return_deuce_side_pts_played = 0
    rowKpis.return_ad_side_pts_won = 0
    rowKpis.return_ad_side_pts_played = 0
    rowKpis.forehand_winners = 0
    rowKpis.forehand_errors = 0
    rowKpis.backhand_winners = 0
    rowKpis.backhand_errors = 0
    rowKpis.volley_winners = 0
    rowKpis.volley_errors = 0
    rowKpis.overhead_winners = 0
    rowKpis.overhead_errors = 0
    rowKpis.love_games_won = 0
    rowKpis.love_games_lost = 0
    rowKpis.longest_point_streak = 0
    rowKpis.longest_game_streak = 0
    rowKpis.longest_set_streak = 0
    rowKpis.lets = 0
    rowKpis.foot_faults = 0
    rowKpis.touching_net = 0
    rowKpis.penalties = 0
    rowKpis.sets_played = 0
    rowKpis.sets_won = 0
    rowKpis.comebacks_down_1_set = 0
    rowKpis.comebacks_down_2_sets = 0
    rowKpis.losses_up_1_set = 0
    rowKpis.losses_up_2_sets = 0
    rowKpis.wins_vs_lefty = 0
    rowKpis.losses_vs_lefty = 0
    rowKpis.wins_vs_righty = 0
    rowKpis.losses_vs_righty = 0

    const playerStats = stats.players || {}
    for (const [pid, pStats] of Object.entries(playerStats) as any) {
      if (yourIds.includes(pid)) {
        const serve = pStats.serve || {}
        const rally = pStats.rally || {}
        const returnStats = pStats.return || {}
        const ind = pStats.individualMatch || {}
        const other = pStats.other || {}

        const add = (target: typeof kpis) => {
          target.total_aces += serve.aces || 0
          target.total_double_faults += serve.doubleFaults || 0
          target.total_winners += rally.winners || 0
          target.total_unforced_errors += (rally.unforcedErrors || 0) + (returnStats.returnUnforcedErrors || 0) + (serve.doubleFaults || 0)
          target.rally_unforced_errors += rally.unforcedErrors || 0
          target.first_serves_in += serve.firstServeIn || 0
          target.first_serves_attempted += serve.firstServeAttempted || 0
          target.first_serve_pts_won += serve.firstServePointsWon || 0
          target.first_serve_pts_played += serve.firstServePointsPlayed || 0
          target.second_serves_in += serve.secondServeIn || 0
          target.second_serves_attempted += serve.secondServeAttempted || 0
          target.second_serve_pts_won += serve.secondServePointsWon || 0
          target.second_serve_pts_played += serve.secondServePointsPlayed || 0
          target.service_pts_won += serve.servicePointsWon || 0
          target.service_pts_played += serve.servicePointsPlayed || 0
          target.break_pts_saved += serve.breakPointsSaved || 0
          target.break_pts_faced += serve.breakPointsFaced || 0
          target.tiebreak_serve_pts_won += serve.tiebreakServePointsWon || 0
          target.tiebreak_serve_pts_played += serve.tiebreakServePointsPlayed || 0
          target.deuce_side_pts_won += serve.deuceSidePointsWon || 0
          target.deuce_side_pts_played += serve.deuceSidePointsPlayed || 0
          target.ad_side_pts_won += serve.adSidePointsWon || 0
          target.ad_side_pts_played += serve.adSidePointsPlayed || 0
          target.serves_unreturned += serve.servesUnreturned || 0
          target.return_pts_won += returnStats.returnPointsWon || 0
          target.return_pts_played += returnStats.returnPointsPlayed || 0
          target.first_serve_return_made += returnStats.firstServeReturnMade || 0
          target.first_serve_return_attempted += returnStats.firstServeReturnAttempted || 0
          target.first_serve_return_pts_won += returnStats.firstServeReturnPointsWon || 0
          target.first_serve_return_pts_played += returnStats.firstServeReturnPointsPlayed || 0
          target.second_serve_return_made += returnStats.secondServeReturnMade || 0
          target.second_serve_return_attempted += returnStats.secondServeReturnAttempted || 0
          target.second_serve_return_pts_won += returnStats.secondServeReturnPointsWon || 0
          target.second_serve_return_pts_played += returnStats.secondServeReturnPointsPlayed || 0
          target.return_unforced_errors += returnStats.returnUnforcedErrors || 0
          target.return_forced_errors += returnStats.returnForcedErrors || 0
          target.return_winners += returnStats.returnWinners || 0
          target.break_pts_converted += returnStats.breakPointsConverted || 0
          target.break_pt_opportunities += returnStats.breakPointOpportunities || 0
          target.tiebreak_return_pts_won += returnStats.tiebreakReturnPointsWon || 0
          target.tiebreak_return_pts_played += returnStats.tiebreakReturnPointsPlayed || 0
          target.return_deuce_side_pts_won += returnStats.deuceSidePointsWon || 0
          target.return_deuce_side_pts_played += returnStats.deuceSidePointsPlayed || 0
          target.return_ad_side_pts_won += returnStats.adSidePointsWon || 0
          target.return_ad_side_pts_played += returnStats.adSidePointsPlayed || 0
          target.forced_errors += rally.forcedErrors || 0
          target.forehand_winners += rally.forehandWinners || 0
          target.forehand_errors += rally.forehandErrors || 0
          target.backhand_winners += rally.backhandWinners || 0
          target.backhand_errors += rally.backhandErrors || 0
          target.volley_winners += rally.volleyWinners || 0
          target.volley_errors += rally.volleyErrors || 0
          target.overhead_winners += rally.overheadWinners || 0
          target.overhead_errors += rally.overheadErrors || 0
          target.net_pts_won += rally.netPointsWon || 0
          target.net_pts_attempted += rally.netPointsAttempted || 0
          if ((rally.longestRallyLength || 0) > target.longest_rally_length) {
            target.longest_rally_length = rally.longestRallyLength || 0
          }
          target.total_rally_length += rally.totalRallyLength || 0
          target.rally_count += rally.rallyCount || 0
          target.points_won += ind.pointsWon || 0
          target.points_played += ind.pointsPlayed || 0
          target.service_games_won += ind.serviceGamesWon || 0
          target.service_games_played += ind.serviceGamesPlayed || 0
          target.return_games_won += ind.returnGamesWon || 0
          target.return_games_played += ind.returnGamesPlayed || 0
          target.game_pts_won_serve += ind.gamePointsWonOnServe || 0
          target.game_pts_opportunity_serve += ind.gamePointsOpportunityOnServe || 0
          target.game_pts_won_return += ind.gamePointsWonOnReturn || 0
          target.game_pts_opportunity_return += ind.gamePointsOpportunityOnReturn || 0
          target.set_pt_opp_serve += ind.setPointOpportunityOnServe || 0
          target.set_pts_won_serve += ind.setPointsWonOnServe || 0
          target.set_pt_opp_return += ind.setPointOpportunityOnReturn || 0
          target.set_pts_won_return += ind.setPointsWonOnReturn || 0
          target.match_pt_opp_serve += ind.matchPointOpportunityOnServe || 0
          target.match_pts_won_serve += ind.matchPointsWonOnServe || 0
          target.match_pt_opp_return += ind.matchPointOpportunityOnReturn || 0
          target.match_pts_won_return += ind.matchPointsWonOnReturn || 0
          target.set_pt_faced_serve += ind.setPointFacedOnServe || 0
          target.set_pts_saved_serve += ind.setPointsSavedOnServe || 0
          target.match_pt_faced_serve += ind.matchPointFacedOnServe || 0
          target.match_pts_saved_serve += ind.matchPointsSavedOnServe || 0
          target.love_games_won += ind.loveGamesWon || 0
          target.love_games_lost += ind.loveGamesLost || 0
          if ((ind.longestPointStreak || 0) > target.longest_point_streak) {
            target.longest_point_streak = ind.longestPointStreak || 0
          }
          if ((ind.longestGameStreak || 0) > target.longest_game_streak) {
            target.longest_game_streak = ind.longestGameStreak || 0
          }
          target.rally_short_won += ind.rallyShortWon || 0
          target.rally_short_played += ind.rallyShortPlayed || 0
          target.rally_medium_won += ind.rallyMediumWon || 0
          target.rally_medium_played += ind.rallyMediumPlayed || 0
          target.rally_long_won += ind.rallyLongWon || 0
          target.rally_long_played += ind.rallyLongPlayed || 0
          if (ind.rallyCounterUsed) target.rally_counter_used = true
          target.lets += other.lets || 0
          target.foot_faults += other.footFaults || 0
          target.touching_net += other.touchingNet || 0
          target.penalties += other.penalties || 0
        }
        add(kpis)
        add(rowKpis)
      }
    }

    const mt = stats.matchTotals || {}
    kpis.sets_played += mt.setsPlayed || 0
    kpis.sets_won += mt.setsWon || 0
    rowKpis.sets_played = mt.setsPlayed || 0
    rowKpis.sets_won = mt.setsWon || 0
    kpis.comebacks_down_1_set += mt.comebacksDown1Set || 0
    kpis.comebacks_down_2_sets += mt.comebacksDown2Sets || 0
    kpis.losses_up_1_set += mt.lossesUp1Set || 0
    kpis.losses_up_2_sets += mt.lossesUp2Sets || 0
    kpis.wins_vs_lefty += mt.winsVsLefty || 0
    kpis.losses_vs_lefty += mt.lossesVsLefty || 0
    kpis.wins_vs_righty += mt.winsVsRighty || 0
    kpis.losses_vs_righty += mt.lossesVsRighty || 0
    rowKpis.comebacks_down_1_set = mt.comebacksDown1Set || 0
    rowKpis.comebacks_down_2_sets = mt.comebacksDown2Sets || 0
    rowKpis.losses_up_1_set = mt.lossesUp1Set || 0
    rowKpis.losses_up_2_sets = mt.lossesUp2Sets || 0
    rowKpis.wins_vs_lefty = mt.winsVsLefty || 0
    rowKpis.losses_vs_lefty = mt.lossesVsLefty || 0
    rowKpis.wins_vs_righty = mt.winsVsRighty || 0
    rowKpis.losses_vs_righty = mt.lossesVsRighty || 0

    const completedSets: Array<{ games: Record<string, number> }> = stats.sets || []
    const oppIds = [row.opp_player1, row.opp_player2].filter(Boolean)
    let matchSetStreak = 0, curSetStreak = 0
    for (const set of completedSets) {
      const p1Games = yourIds.reduce((sum: number, id: string) => sum + (set.games[id] || 0), 0)
      const p2Games = oppIds.reduce((sum: number, id: string) => sum + (set.games[id] || 0), 0)
      if (p1Games > p2Games) {
        curSetStreak += 1
        if (curSetStreak > matchSetStreak) matchSetStreak = curSetStreak
      } else {
        curSetStreak = 0
      }
    }
    if (matchSetStreak > kpis.longest_set_streak) kpis.longest_set_streak = matchSetStreak
    rowKpis.longest_set_streak = matchSetStreak

    const courtSurface = row.court_surface || 'hard'
    if (courtSurface === 'hard') {
      if (isWinner) { kpis.wins_hard += 1 } else { kpis.losses_hard += 1 }
    } else if (courtSurface === 'clay') {
      if (isWinner) { kpis.wins_clay += 1 } else { kpis.losses_clay += 1 }
    } else if (courtSurface === 'grass') {
      if (isWinner) { kpis.wins_grass += 1 } else { kpis.losses_grass += 1 }
    } else if (courtSurface === 'carpet') {
      if (isWinner) { kpis.wins_carpet += 1 } else { kpis.losses_carpet += 1 }
    }

    const matchDate = new Date(row.created_at).toISOString().split('T')[0]
    heatmapData.push({ date: matchDate, result: isWinner ? 'win' : 'loss' })
    const r = rowKpis
    const totalRet = r.first_serve_return_made + r.second_serve_return_made
    const totalRetAtt = r.first_serve_return_attempted + r.second_serve_return_attempted
    perMatchTrends.push({
      date: matchDate,
      winRate: safePct(r.wins, r.matches_played),
      totalMatches: 1,
      aces: r.total_aces,
      doubleFaults: r.total_double_faults,
      winners: r.total_winners,
      overallWinners: r.total_aces + r.total_winners + r.return_winners,
      unforcedErrors: r.total_unforced_errors,
      rallyUnforcedErrors: r.rally_unforced_errors,
      winnersToUfeRatio: (() => { const ow = r.total_aces + r.total_winners + r.return_winners; return r.total_unforced_errors > 0 ? Math.round((ow / r.total_unforced_errors) * 100) / 100 : null; })(),
      serveWinnersToUfeRatio: r.total_double_faults > 0 ? Math.round((r.total_aces / r.total_double_faults) * 100) / 100 : null,
      returnWinnersToUfeRatio: r.return_unforced_errors > 0 ? Math.round((r.return_winners / r.return_unforced_errors) * 100) / 100 : null,
      rallyWinnersToUfeRatio: r.rally_unforced_errors > 0 ? Math.round((r.total_winners / r.rally_unforced_errors) * 100) / 100 : null,
      firstServePercent: safePct(r.first_serves_in, r.first_serves_attempted),
      firstServeWonPercent: safePct(r.first_serve_pts_won, r.first_serve_pts_played),
      secondServeInPercent: safePct(r.second_serves_in, r.second_serves_attempted),
      secondServeWonPercent: safePct(r.second_serve_pts_won, r.second_serve_pts_played),
      servicePointsWonPercent: safePct(r.service_pts_won, r.service_pts_played),
      breakPointsSavedPercent: safePct(r.break_pts_saved, r.break_pts_faced),
      returnPointsWonPercent: safePct(r.return_pts_won, r.return_pts_played),
      returnInPercent: safePct(totalRet, totalRetAtt),
      firstServeReturnPercent: safePct(r.first_serve_return_made, r.first_serve_return_attempted),
      firstServeReturnPtsWonPercent: safePct(r.first_serve_return_pts_won, r.first_serve_return_pts_played),
      secondServeReturnPercent: safePct(r.second_serve_return_made, r.second_serve_return_attempted),
      secondServeReturnPtsWonPercent: safePct(r.second_serve_return_pts_won, r.second_serve_return_pts_played),
      breakPointsConvertedPercent: safePct(r.break_pts_converted, r.break_pt_opportunities),
      netPointsWonPercent: safePct(r.net_pts_won, r.net_pts_attempted),
      netAttemptedPercent: safePct(r.net_pts_attempted, r.points_played),
      pointsWonPercent: safePct(r.points_won, r.points_played),
      serviceGamesWonPercent: safePct(r.service_games_won, r.service_games_played),
      returnGamesWonPercent: safePct(r.return_games_won, r.return_games_played),
      gamePointsOnServePercent: safePct(r.game_pts_won_serve, r.game_pts_opportunity_serve),
      gamePointsOnReturnPercent: safePct(r.game_pts_won_return, r.game_pts_opportunity_return),
      gamePointConversionPercent: (r.game_pts_opportunity_serve + r.game_pts_opportunity_return) > 0 ? safePct(r.game_pts_won_serve + r.game_pts_won_return, r.game_pts_opportunity_serve + r.game_pts_opportunity_return) : 0,
      setsWonPercent: safePct(r.sets_won, r.sets_played),
      gamesWonPercent: safePct(r.service_games_won + r.return_games_won, r.service_games_played + r.return_games_played),
      dominanceRatio: (r.service_pts_played - r.service_pts_won) > 0 ? Math.round((r.return_pts_won / (r.service_pts_played - r.service_pts_won)) * 100) / 100 : null,
      setPointPercent: (r.set_pt_opp_serve + r.set_pt_opp_return) > 0 ? safePct(r.set_pts_won_serve + r.set_pts_won_return, r.set_pt_opp_serve + r.set_pt_opp_return) : 0,
      setPointPercentServe: r.set_pt_opp_serve > 0 ? safePct(r.set_pts_won_serve, r.set_pt_opp_serve) : 0,
      setPointPercentReturn: r.set_pt_opp_return > 0 ? safePct(r.set_pts_won_return, r.set_pt_opp_return) : 0,
      matchPointPercent: (r.match_pt_opp_serve + r.match_pt_opp_return) > 0 ? safePct(r.match_pts_won_serve + r.match_pts_won_return, r.match_pt_opp_serve + r.match_pt_opp_return) : 0,
      matchPointPercentServe: r.match_pt_opp_serve > 0 ? safePct(r.match_pts_won_serve, r.match_pt_opp_serve) : 0,
      matchPointPercentReturn: r.match_pt_opp_return > 0 ? safePct(r.match_pts_won_return, r.match_pt_opp_return) : 0,
      gamePointsSavedPercent: safePct(r.break_pts_saved, r.break_pts_faced),
      setPointsSavedPercent: r.set_pt_faced_serve > 0 ? safePct(r.set_pts_saved_serve, r.set_pt_faced_serve) : 0,
      matchPointsSavedPercent: r.match_pt_faced_serve > 0 ? safePct(r.match_pts_saved_serve, r.match_pt_faced_serve) : 0,
      tiebreakServePointsWonPercent: r.tiebreak_serve_pts_played > 0 ? safePct(r.tiebreak_serve_pts_won, r.tiebreak_serve_pts_played) : 0,
      tiebreakReturnPointsWonPercent: r.tiebreak_return_pts_played > 0 ? safePct(r.tiebreak_return_pts_won, r.tiebreak_return_pts_played) : 0,
      tiebreakPointsWonPercent: (r.tiebreak_serve_pts_played + r.tiebreak_return_pts_played) > 0
        ? safePct(r.tiebreak_serve_pts_won + r.tiebreak_return_pts_won, r.tiebreak_serve_pts_played + r.tiebreak_return_pts_played) : 0,
      forehandWinners: r.forehand_winners,
      forehandErrors: r.forehand_errors,
      forehandRatio: r.forehand_errors > 0 ? Math.round((r.forehand_winners / r.forehand_errors) * 100) / 100 : 0,
      backhandWinners: r.backhand_winners,
      backhandErrors: r.backhand_errors,
      backhandRatio: r.backhand_errors > 0 ? Math.round((r.backhand_winners / r.backhand_errors) * 100) / 100 : 0,
      volleyWinners: r.volley_winners,
      volleyErrors: r.volley_errors,
      volleyRatio: r.volley_errors > 0 ? Math.round((r.volley_winners / r.volley_errors) * 100) / 100 : 0,
      overheadWinners: r.overhead_winners,
      overheadErrors: r.overhead_errors,
      overheadRatio: r.overhead_errors > 0 ? Math.round((r.overhead_winners / r.overhead_errors) * 100) / 100 : 0,
      deuceSidePointsWonPercent: r.deuce_side_pts_played > 0 ? safePct(r.deuce_side_pts_won, r.deuce_side_pts_played) : 0,
      deuceSidePointsLostPercent: r.deuce_side_pts_played > 0 ? safePct(r.deuce_side_pts_played - r.deuce_side_pts_won, r.deuce_side_pts_played) : 0,
      adSidePointsWonPercent: r.ad_side_pts_played > 0 ? safePct(r.ad_side_pts_won, r.ad_side_pts_played) : 0,
      adSidePointsLostPercent: r.ad_side_pts_played > 0 ? safePct(r.ad_side_pts_played - r.ad_side_pts_won, r.ad_side_pts_played) : 0,
      returnDeuceSidePointsWonPercent: r.return_deuce_side_pts_played > 0 ? safePct(r.return_deuce_side_pts_won, r.return_deuce_side_pts_played) : 0,
      returnAdSidePointsWonPercent: r.return_ad_side_pts_played > 0 ? safePct(r.return_ad_side_pts_won, r.return_ad_side_pts_played) : 0,
      servesUnreturned: r.serves_unreturned,
      servesUnreturnedPercent: safePct(r.serves_unreturned, r.service_pts_played),
      returnUnforcedErrors: r.return_unforced_errors,
      returnWinners: r.return_winners,
      returnForcedErrors: r.return_forced_errors,
      forcedErrors: r.forced_errors,
      netPointsWon: r.net_pts_won,
      netPointsAttempted: r.net_pts_attempted,
      pointsWon: r.points_won,
      pointsPlayed: r.points_played,
      loveGamesWon: r.love_games_won,
      loveGamesLost: r.love_games_lost,
      longestPointStreak: r.longest_point_streak,
      longestGameStreak: r.longest_game_streak,
      longestSetStreak: r.longest_set_streak,
      longestRallyLength: r.longest_rally_length,
      rallyShortWonPercent: r.rally_short_played > 0 ? safePct(r.rally_short_won, r.rally_short_played) : 0,
      rallyMediumWonPercent: r.rally_medium_played > 0 ? safePct(r.rally_medium_won, r.rally_medium_played) : 0,
      rallyLongWonPercent: r.rally_long_played > 0 ? safePct(r.rally_long_won, r.rally_long_played) : 0,
      comebacksDown1Set: r.comebacks_down_1_set,
      comebacksDown2Sets: r.comebacks_down_2_sets,
      lossesUp1Set: r.losses_up_1_set,
      lossesUp2Sets: r.losses_up_2_sets,
      winsVsLefty: r.wins_vs_lefty,
      lossesVsLefty: r.losses_vs_lefty,
      winsVsRighty: r.wins_vs_righty,
      lossesVsRighty: r.losses_vs_righty,
    })
  }

  perMatchTrends.reverse()

  const safePercent = (num: number, den: number): number => {
    return den > 0 ? (num / den) * 100 : 0
  }

  const totalReturnMade = kpis.first_serve_return_made + kpis.second_serve_return_made
  const totalReturnAttempted = kpis.first_serve_return_attempted + kpis.second_serve_return_attempted

  const totalGamesWon = kpis.service_games_won + kpis.return_games_won
  const totalGamesPlayed = kpis.service_games_played + kpis.return_games_played

  const servicePointsLost = kpis.service_pts_played - kpis.service_pts_won
  const dominanceRatio = servicePointsLost > 0
    ? Math.round((kpis.return_pts_won / servicePointsLost) * 100) / 100
    : null

  const overallWinners = kpis.total_aces + kpis.total_winners + kpis.return_winners
  const winnersToUfeRatio = kpis.total_unforced_errors > 0
    ? Math.round((overallWinners / kpis.total_unforced_errors) * 100) / 100
    : null
  const serveWinnersToUfeRatio = kpis.total_double_faults > 0
    ? Math.round((kpis.total_aces / kpis.total_double_faults) * 100) / 100
    : null
  const returnWinnersToUfeRatio = kpis.return_unforced_errors > 0
    ? Math.round((kpis.return_winners / kpis.return_unforced_errors) * 100) / 100
    : null
  const rallyWinnersToUfeRatio = kpis.rally_unforced_errors > 0
    ? Math.round((kpis.total_winners / kpis.rally_unforced_errors) * 100) / 100
    : null

  const setPointOppTotal = kpis.set_pt_opp_serve + kpis.set_pt_opp_return
  const setPointsWonTotal = kpis.set_pts_won_serve + kpis.set_pts_won_return
  const matchPointOppTotal = kpis.match_pt_opp_serve + kpis.match_pt_opp_return
  const matchPointsWonTotal = kpis.match_pts_won_serve + kpis.match_pts_won_return

  const finalKpis = {
    winRate: `${safePercent(kpis.wins, kpis.matches_played).toFixed(0)}%`,
    wins: kpis.wins,
    totalMatches: kpis.matches_played,
    longestMatchStreak,
    setsWonPercent: `${safePercent(kpis.sets_won, kpis.sets_played).toFixed(0)}%`,
    setsWon: kpis.sets_won,
    setsPlayed: kpis.sets_played,
    gamesWonPercent: `${safePercent(totalGamesWon, totalGamesPlayed).toFixed(0)}%`,
    gamesWon: totalGamesWon,
    gamesPlayed: totalGamesPlayed,
    aces: kpis.total_aces,
    winners: kpis.total_winners,
    overallWinners,
    doubleFaults: kpis.total_double_faults,
    unforcedErrors: kpis.total_unforced_errors,
    rallyUnforcedErrors: kpis.rally_unforced_errors,
    winnersToUfeRatio,
    serveWinnersToUfeRatio,
    returnWinnersToUfeRatio,
    rallyWinnersToUfeRatio,
    firstServePercent: `${safePercent(kpis.first_serves_in, kpis.first_serves_attempted).toFixed(0)}%`,
    firstServeIn: kpis.first_serves_in,
    firstServeAttempted: kpis.first_serves_attempted,
    firstServeWonPercent: `${safePercent(kpis.first_serve_pts_won, kpis.first_serve_pts_played).toFixed(0)}%`,
    firstServePointsWon: kpis.first_serve_pts_won,
    firstServePointsPlayed: kpis.first_serve_pts_played,
    secondServeInPercent: `${safePercent(kpis.second_serves_in, kpis.second_serves_attempted).toFixed(0)}%`,
    secondServeIn: kpis.second_serves_in,
    secondServeAttempted: kpis.second_serves_attempted,
    secondServeWonPercent: `${safePercent(kpis.second_serve_pts_won, kpis.second_serve_pts_played).toFixed(0)}%`,
    secondServePointsWon: kpis.second_serve_pts_won,
    secondServePointsPlayed: kpis.second_serve_pts_played,
    servicePointsWonPercent: `${safePercent(kpis.service_pts_won, kpis.service_pts_played).toFixed(0)}%`,
    servicePointsWon: kpis.service_pts_won,
    servicePointsPlayed: kpis.service_pts_played,
    breakPointsSavedPercent: `${safePercent(kpis.break_pts_saved, kpis.break_pts_faced).toFixed(0)}%`,
    breakPointsSaved: kpis.break_pts_saved,
    breakPointsFaced: kpis.break_pts_faced,
    gamePointsSavedPercent: `${safePercent(kpis.break_pts_saved, kpis.break_pts_faced).toFixed(0)}%`,
    setPointsSavedPercent: kpis.set_pt_faced_serve > 0 ? `${Math.round((kpis.set_pts_saved_serve / kpis.set_pt_faced_serve) * 100)}%` : null,
    setPointsSaved: kpis.set_pts_saved_serve,
    setPointsFaced: kpis.set_pt_faced_serve,
    matchPointsSavedPercent: kpis.match_pt_faced_serve > 0 ? `${Math.round((kpis.match_pts_saved_serve / kpis.match_pt_faced_serve) * 100)}%` : null,
    matchPointsSaved: kpis.match_pts_saved_serve,
    matchPointsFaced: kpis.match_pt_faced_serve,
    servesUnreturned: kpis.serves_unreturned,
    servesUnreturnedPercent: `${safePercent(kpis.serves_unreturned, kpis.service_pts_played).toFixed(0)}%`,
    deuceSidePointsWonPercent: kpis.deuce_side_pts_played > 0 ? `${Math.round((kpis.deuce_side_pts_won / kpis.deuce_side_pts_played) * 100)}%` : null,
    deuceSidePointsLostPercent: kpis.deuce_side_pts_played > 0 ? `${Math.round(((kpis.deuce_side_pts_played - kpis.deuce_side_pts_won) / kpis.deuce_side_pts_played) * 100)}%` : null,
    deuceSidePointsWon: kpis.deuce_side_pts_won,
    deuceSidePointsPlayed: kpis.deuce_side_pts_played,
    adSidePointsWonPercent: kpis.ad_side_pts_played > 0 ? `${Math.round((kpis.ad_side_pts_won / kpis.ad_side_pts_played) * 100)}%` : null,
    adSidePointsLostPercent: kpis.ad_side_pts_played > 0 ? `${Math.round(((kpis.ad_side_pts_played - kpis.ad_side_pts_won) / kpis.ad_side_pts_played) * 100)}%` : null,
    adSidePointsWon: kpis.ad_side_pts_won,
    adSidePointsPlayed: kpis.ad_side_pts_played,
    returnDeuceSidePointsWonPercent: kpis.return_deuce_side_pts_played > 0 ? `${Math.round((kpis.return_deuce_side_pts_won / kpis.return_deuce_side_pts_played) * 100)}%` : null,
    returnDeuceSidePointsWon: kpis.return_deuce_side_pts_won,
    returnDeuceSidePointsPlayed: kpis.return_deuce_side_pts_played,
    returnAdSidePointsWonPercent: kpis.return_ad_side_pts_played > 0 ? `${Math.round((kpis.return_ad_side_pts_won / kpis.return_ad_side_pts_played) * 100)}%` : null,
    returnAdSidePointsWon: kpis.return_ad_side_pts_won,
    returnAdSidePointsPlayed: kpis.return_ad_side_pts_played,
    returnPointsWonPercent: `${safePercent(kpis.return_pts_won, kpis.return_pts_played).toFixed(0)}%`,
    returnPointsWon: kpis.return_pts_won,
    returnPointsPlayed: kpis.return_pts_played,
    returnInPercent: `${safePercent(totalReturnMade, totalReturnAttempted).toFixed(0)}%`,
    returnMade: totalReturnMade,
    returnAttempted: totalReturnAttempted,
    firstServeReturnPercent: `${safePercent(kpis.first_serve_return_made, kpis.first_serve_return_attempted).toFixed(0)}%`,
    firstServeReturnMade: kpis.first_serve_return_made,
    firstServeReturnAttempted: kpis.first_serve_return_attempted,
    firstServeReturnPtsWonPercent: `${safePercent(kpis.first_serve_return_pts_won, kpis.first_serve_return_pts_played).toFixed(0)}%`,
    firstServeReturnPtsWon: kpis.first_serve_return_pts_won,
    firstServeReturnPtsPlayed: kpis.first_serve_return_pts_played,
    secondServeReturnPercent: `${safePercent(kpis.second_serve_return_made, kpis.second_serve_return_attempted).toFixed(0)}%`,
    secondServeReturnMade: kpis.second_serve_return_made,
    secondServeReturnAttempted: kpis.second_serve_return_attempted,
    secondServeReturnPtsWonPercent: `${safePercent(kpis.second_serve_return_pts_won, kpis.second_serve_return_pts_played).toFixed(0)}%`,
    secondServeReturnPtsWon: kpis.second_serve_return_pts_won,
    secondServeReturnPtsPlayed: kpis.second_serve_return_pts_played,
    returnUnforcedErrors: kpis.return_unforced_errors,
    returnForcedErrors: kpis.return_forced_errors,
    returnWinners: kpis.return_winners,
    breakPointsConvertedPercent: `${safePercent(kpis.break_pts_converted, kpis.break_pt_opportunities).toFixed(0)}%`,
    breakPointsConverted: kpis.break_pts_converted,
    breakPointOpportunities: kpis.break_pt_opportunities,
    forcedErrors: kpis.forced_errors,
    netPointsWonPercent: `${safePercent(kpis.net_pts_won, kpis.net_pts_attempted).toFixed(0)}%`,
    netPointsWon: kpis.net_pts_won,
    netPointsAttempted: kpis.net_pts_attempted,
    netAttemptedPercent: `${safePercent(kpis.net_pts_attempted, kpis.points_played).toFixed(0)}%`,
    forehandWinners: kpis.forehand_winners,
    forehandErrors: kpis.forehand_errors,
    forehandRatio: kpis.forehand_errors > 0 ? Math.round((kpis.forehand_winners / kpis.forehand_errors) * 100) / 100 : null,
    backhandWinners: kpis.backhand_winners,
    backhandErrors: kpis.backhand_errors,
    backhandRatio: kpis.backhand_errors > 0 ? Math.round((kpis.backhand_winners / kpis.backhand_errors) * 100) / 100 : null,
    volleyWinners: kpis.volley_winners,
    volleyErrors: kpis.volley_errors,
    volleyRatio: kpis.volley_errors > 0 ? Math.round((kpis.volley_winners / kpis.volley_errors) * 100) / 100 : null,
    overheadWinners: kpis.overhead_winners,
    overheadErrors: kpis.overhead_errors,
    overheadRatio: kpis.overhead_errors > 0 ? Math.round((kpis.overhead_winners / kpis.overhead_errors) * 100) / 100 : null,
    longestRallyLength: kpis.longest_rally_length,
    rallyShortWonPercent: kpis.rally_counter_used && kpis.rally_short_played > 0 ? `${Math.round((kpis.rally_short_won / kpis.rally_short_played) * 100)}%` : null,
    rallyShortWon: kpis.rally_short_won,
    rallyShortPlayed: kpis.rally_short_played,
    rallyMediumWonPercent: kpis.rally_counter_used && kpis.rally_medium_played > 0 ? `${Math.round((kpis.rally_medium_won / kpis.rally_medium_played) * 100)}%` : null,
    rallyMediumWon: kpis.rally_medium_won,
    rallyMediumPlayed: kpis.rally_medium_played,
    rallyLongWonPercent: kpis.rally_counter_used && kpis.rally_long_played > 0 ? `${Math.round((kpis.rally_long_won / kpis.rally_long_played) * 100)}%` : null,
    rallyLongWon: kpis.rally_long_won,
    rallyLongPlayed: kpis.rally_long_played,
    rallyCounterUsed: kpis.rally_counter_used,
    pointsWonPercent: `${safePercent(kpis.points_won, kpis.points_played).toFixed(0)}%`,
    pointsWon: kpis.points_won,
    pointsPlayed: kpis.points_played,
    serviceGamesWonPercent: `${safePercent(kpis.service_games_won, kpis.service_games_played).toFixed(0)}%`,
    serviceGamesWon: kpis.service_games_won,
    serviceGamesPlayed: kpis.service_games_played,
    returnGamesWonPercent: `${safePercent(kpis.return_games_won, kpis.return_games_played).toFixed(0)}%`,
    returnGamesWon: kpis.return_games_won,
    returnGamesPlayed: kpis.return_games_played,
    setPointPercent: setPointOppTotal > 0 ? `${Math.round((setPointsWonTotal / setPointOppTotal) * 100)}%` : null,
    setPointPercentServe: kpis.set_pt_opp_serve > 0 ? `${Math.round((kpis.set_pts_won_serve / kpis.set_pt_opp_serve) * 100)}%` : null,
    setPointPercentReturn: kpis.set_pt_opp_return > 0 ? `${Math.round((kpis.set_pts_won_return / kpis.set_pt_opp_return) * 100)}%` : null,
    setPointsWonServe: kpis.set_pts_won_serve,
    setPointOppServe: kpis.set_pt_opp_serve,
    setPointsWonReturn: kpis.set_pts_won_return,
    setPointOppReturn: kpis.set_pt_opp_return,
    matchPointPercent: matchPointOppTotal > 0 ? `${Math.round((matchPointsWonTotal / matchPointOppTotal) * 100)}%` : null,
    matchPointPercentServe: kpis.match_pt_opp_serve > 0 ? `${Math.round((kpis.match_pts_won_serve / kpis.match_pt_opp_serve) * 100)}%` : null,
    matchPointPercentReturn: kpis.match_pt_opp_return > 0 ? `${Math.round((kpis.match_pts_won_return / kpis.match_pt_opp_return) * 100)}%` : null,
    matchPointsWonServe: kpis.match_pts_won_serve,
    matchPointOppServe: kpis.match_pt_opp_serve,
    matchPointsWonReturn: kpis.match_pts_won_return,
    matchPointOppReturn: kpis.match_pt_opp_return,
    dominanceRatio,
    gamePointsOnServePercent: `${safePercent(kpis.game_pts_won_serve, kpis.game_pts_opportunity_serve).toFixed(0)}%`,
    gamePointsOnServeWon: kpis.game_pts_won_serve,
    gamePointsOnServeOpportunity: kpis.game_pts_opportunity_serve,
    gamePointsOnReturnPercent: `${safePercent(kpis.game_pts_won_return, kpis.game_pts_opportunity_return).toFixed(0)}%`,
    gamePointsOnReturnWon: kpis.game_pts_won_return,
    gamePointsOnReturnOpportunity: kpis.game_pts_opportunity_return,
    loveGamesWon: kpis.love_games_won,
    loveGamesLost: kpis.love_games_lost,
    longestPointStreak: kpis.longest_point_streak,
    longestGameStreak: kpis.longest_game_streak,
    longestSetStreak: kpis.longest_set_streak,
    lets: kpis.lets,
    footFaults: kpis.foot_faults,
    touchingNet: kpis.touching_net,
    penalties: kpis.penalties,
    comebacksDown1Set: kpis.comebacks_down_1_set,
    comebacksDown2Sets: kpis.comebacks_down_2_sets,
    lossesUp1Set: kpis.losses_up_1_set,
    lossesUp2Sets: kpis.losses_up_2_sets,
    winsVsLefty: kpis.wins_vs_lefty,
    lossesVsLefty: kpis.losses_vs_lefty,
    winsVsRighty: kpis.wins_vs_righty,
    lossesVsRighty: kpis.losses_vs_righty,
    winsHard: kpis.wins_hard,
    lossesHard: kpis.losses_hard,
    hardCourtWinPercent: (kpis.wins_hard + kpis.losses_hard) > 0 ? `${Math.round((kpis.wins_hard / (kpis.wins_hard + kpis.losses_hard)) * 100)}%` : null,
    winsClay: kpis.wins_clay,
    lossesClay: kpis.losses_clay,
    clayCourtWinPercent: (kpis.wins_clay + kpis.losses_clay) > 0 ? `${Math.round((kpis.wins_clay / (kpis.wins_clay + kpis.losses_clay)) * 100)}%` : null,
    winsGrass: kpis.wins_grass,
    lossesGrass: kpis.losses_grass,
    grassCourtWinPercent: (kpis.wins_grass + kpis.losses_grass) > 0 ? `${Math.round((kpis.wins_grass / (kpis.wins_grass + kpis.losses_grass)) * 100)}%` : null,
    winsCarpet: kpis.wins_carpet,
    lossesCarpet: kpis.losses_carpet,
    carpetCourtWinPercent: (kpis.wins_carpet + kpis.losses_carpet) > 0 ? `${Math.round((kpis.wins_carpet / (kpis.wins_carpet + kpis.losses_carpet)) * 100)}%` : null,
    tiebreakServePointsWonPercent: kpis.tiebreak_serve_pts_played > 0 ? `${Math.round((kpis.tiebreak_serve_pts_won / kpis.tiebreak_serve_pts_played) * 100)}%` : null,
    tiebreakServePointsWon: kpis.tiebreak_serve_pts_won,
    tiebreakServePointsPlayed: kpis.tiebreak_serve_pts_played,
    tiebreakReturnPointsWonPercent: kpis.tiebreak_return_pts_played > 0 ? `${Math.round((kpis.tiebreak_return_pts_won / kpis.tiebreak_return_pts_played) * 100)}%` : null,
    tiebreakReturnPointsWon: kpis.tiebreak_return_pts_won,
    tiebreakReturnPointsPlayed: kpis.tiebreak_return_pts_played,
    tiebreakPointsWonPercent: (kpis.tiebreak_serve_pts_played + kpis.tiebreak_return_pts_played) > 0
      ? `${Math.round(((kpis.tiebreak_serve_pts_won + kpis.tiebreak_return_pts_won) / (kpis.tiebreak_serve_pts_played + kpis.tiebreak_return_pts_played)) * 100)}%`
      : null,
    tiebreakPointsWon: kpis.tiebreak_serve_pts_won + kpis.tiebreak_return_pts_won,
    tiebreakPointsPlayed: kpis.tiebreak_serve_pts_played + kpis.tiebreak_return_pts_played,
  }

  const serveScore = Math.max(0, kpis.total_aces * 2 - kpis.total_double_faults)
  const rallyScore = Math.max(0, kpis.total_winners - kpis.total_unforced_errors)
  const returnScore = safePercent(kpis.return_pts_won, kpis.return_pts_played)

  const shotPerformanceRaw = [
    { shot: 'Serve', value: serveScore },
    { shot: 'Rally', value: rallyScore },
    { shot: 'Return', value: returnScore }
  ]

  const maxVal = Math.max(...shotPerformanceRaw.map(d => d.value))
  const shotPerformanceNormalized = shotPerformanceRaw.map(s => ({
    shot: s.shot,
    value: maxVal > 0 ? (s.value / maxVal) * 100 : 0
  }))

  return jsonResponse(request, {
    kpis: finalKpis,
    heatmapData,
    shotPerformance: shotPerformanceNormalized,
    perMatchTrends,
  }, { status: 200 })
}

async function getNotes(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const res = await env.DB
    .prepare('SELECT id, match_id, type, content, created_at FROM notes WHERE user_id = ? ORDER BY created_at DESC')
    .bind(uid)
    .all<any>()

  const rows = res.results || []
  const notes = rows.map(r => ({
    id: r.id,
    matchId: r.match_id ? String(r.match_id) : null,
    type: r.type,
    content: r.content,
    createdAt: new Date(r.created_at).getTime()
  }))

  return jsonResponse(request, notes, { status: 200 })
}

async function createNote(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const noteType = data.type
  const content = data.content
  const matchId = data.matchId

  if (!content || !noteType) {
    return jsonResponse(request, { error: 'Missing required fields' }, { status: 400 })
  }

  const rec = await env.DB
    .prepare(
      `
      INSERT INTO notes (user_id, match_id, type, content)
      VALUES (?, ?, ?, ?)
      RETURNING id, match_id, type, content, created_at
      `
    )
    .bind(uid, matchId ? Number(matchId) : null, noteType, content)
    .first<any>()

  return jsonResponse(request, {
    id: rec.id,
    matchId: rec.match_id ? String(rec.match_id) : null,
    type: rec.type,
    content: rec.content,
    createdAt: new Date(rec.created_at).getTime()
  }, { status: 201 })
}

async function updateNote(request: Request, env: Env, noteId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  let data: any = {}
  try {
    data = await request.json()
  } catch {
    data = {}
  }

  const noteType = data.type
  const content = data.content
  const matchId = data.matchId

  if (!content || !noteType) {
    return jsonResponse(request, { error: 'Missing required fields' }, { status: 400 })
  }

  const rec = await env.DB
    .prepare(
      `
      UPDATE notes
      SET type = ?, content = ?, match_id = ?
      WHERE id = ? AND user_id = ?
      RETURNING id, match_id, type, content, created_at
      `
    )
    .bind(noteType, content, matchId ? Number(matchId) : null, Number(noteId), uid)
    .first<any>()

  if (!rec) {
    return jsonResponse(request, { error: 'Note not found or not authorized' }, { status: 404 })
  }

  return jsonResponse(request, {
    id: rec.id,
    matchId: rec.match_id ? String(rec.match_id) : null,
    type: rec.type,
    content: rec.content,
    createdAt: new Date(rec.created_at).getTime()
  }, { status: 200 })
}

async function deleteNote(request: Request, env: Env, noteId: string): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const uid = Number(user.id)
  const result = await env.DB
    .prepare('DELETE FROM notes WHERE id = ? AND user_id = ?')
    .bind(Number(noteId), uid)
    .run()

  if (result.meta.changes === 0) {
    return jsonResponse(request, { error: 'Note not found or not authorized' }, { status: 404 })
  }

  return emptyCorsResponse(request, 204)
}

async function broadcastLiveMatchesList(env: Env, type: 'match_created' | 'match_ended', matchId: number): Promise<void> {
  try {
    const id = env.LIVE_MATCHES_LIST.idFromName('live-matches-list')
    const stub = env.LIVE_MATCHES_LIST.get(id)
    await stub.fetch(new Request('https://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify({ type, matchId: String(matchId) })
    }))
  } catch (err) {
    // ignore
  }
}

async function broadcastToSpectators(env: Env, matchId: number, stats: any): Promise<void> {
  try {
    const id = env.MATCH_SPECTATE.idFromName(`match:${matchId}`)
    const stub = env.MATCH_SPECTATE.get(id)
    await stub.fetch(new Request('https://internal/broadcast', {
      method: 'POST',
      body: JSON.stringify(stats)
    }))
  } catch (err) {
  }

  if (stats?.type === 'stream_status' && stats?.event === 'stream_ended') {
    return
  }

  try {
    const radioId = env.MATCH_RADIO.idFromName(`match:${matchId}`)
    const radioStub = env.MATCH_RADIO.get(radioId)

    const [matchRec, prevStatsRec] = await Promise.all([
      env.DB.prepare('SELECT * FROM matches WHERE id = ?').bind(matchId).first<any>(),
      env.DB.prepare('SELECT stats FROM match_stats WHERE match_id = ?').bind(matchId).first<any>(),
    ])

    if (matchRec) {
      const prevStats = prevStatsRec?.stats ? JSON.parse(prevStatsRec.stats) : null

      const match = {
        matchType: matchRec.match_type,
        yourPlayer1: matchRec.your_player1,
        yourPlayer2: matchRec.your_player2,
        oppPlayer1: matchRec.opp_player1,
        oppPlayer2: matchRec.opp_player2,
        server: matchRec.server,
        status: matchRec.status,
        statMode: matchRec.stat_mode || 'basic'
      }

      await radioStub.fetch(new Request('https://internal/commentary', {
        method: 'POST',
        body: JSON.stringify({ stats, match, oldStats: prevStats })
      }))
    }
  } catch (err) {
  }
}

export async function handleLiveMatchesListWs(request: Request, env: Env): Promise<Response | null> {
  const upgradeHeader = request.headers.get('Upgrade')
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 })
  }

  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return new Response('Not authenticated', { status: 401 })
  }

  const id = env.LIVE_MATCHES_LIST.idFromName('live-matches-list')
  const stub = env.LIVE_MATCHES_LIST.get(id)
  return stub.fetch(request)
}

async function spectateMatch(request: Request, env: Env, matchId: string): Promise<Response> {
  const upgradeHeader = request.headers.get('Upgrade')
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 })
  }

  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  let user = await getCurrentUserFromSession(request, env)

  if (!user) {
    return new Response('Not authenticated', { status: 401 })
  }

  const uid = Number(user.id)
  const mid = Number(matchId)

  const authorized = await authorizedToView(env, uid, mid)
  if (!authorized) {
    return new Response('Not authorized', { status: 403 })
  }

  const id = env.MATCH_SPECTATE.idFromName(`match:${mid}`)
  const stub = env.MATCH_SPECTATE.get(id)

  url.searchParams.set('matchId', matchId)
  url.searchParams.set('userId', user.id)

  return stub.fetch(new Request(url.toString(), {
    headers: request.headers
  }))
}

async function getRadioManifest(request: Request, env: Env, matchId: string): Promise<Response> {
  const user = await getCurrentUserFromSessionOrToken(request, env)
  if (!user) {
    return new Response('Not authenticated', { status: 401 })
  }

  const uid = Number(user.id)
  const mid = Number(matchId)
  const authorized = await authorizedToView(env, uid, mid)
  if (!authorized) {
    return new Response('Not authorized', { status: 403 })
  }

  const incoming = new URL(request.url)
  const token = incoming.searchParams.get('token') || ''
  const id = env.MATCH_RADIO.idFromName(`match:${mid}`)
  const stub = env.MATCH_RADIO.get(id)
  const doUrl = new URL('https://internal/manifest.m3u8')
  doUrl.searchParams.set('matchId', String(mid))
  if (token) doUrl.searchParams.set('token', token)
  const doResponse = await stub.fetch(new Request(doUrl.toString(), { method: 'GET' }))

  const headers = new Headers(doResponse.headers)
  headers.set('Content-Type', 'application/vnd.apple.mpegurl')
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return new Response(doResponse.body, { status: doResponse.status, headers })
}

async function getRadioSegment(request: Request, env: Env, matchId: string, segmentName: string): Promise<Response> {
  const user = await getCurrentUserFromSessionOrToken(request, env)
  if (!user) {
    return new Response('Not authenticated', { status: 401 })
  }

  const uid = Number(user.id)
  const mid = Number(matchId)
  const authorized = await authorizedToView(env, uid, mid)
  if (!authorized) {
    return new Response('Not authorized', { status: 403 })
  }

  const safeSegment = segmentName.replace(/[^0-9a-zA-Z._-]/g, '')
  const id = env.MATCH_RADIO.idFromName(`match:${mid}`)
  const stub = env.MATCH_RADIO.get(id)
  const doUrl = new URL(`https://internal/segments/${safeSegment}`)
  const doResponse = await stub.fetch(new Request(doUrl.toString(), { method: 'GET' }))
  const headers = new Headers(doResponse.headers)
  const location = headers.get('Location')
  if (location) {
    if (location.startsWith('/api/images/')) {
      headers.set('Location', location.replace('/api/images/', '/images/'))
    } else if (location.startsWith('images/')) {
      headers.set('Location', `/${location}`)
    }
  }
  if (!headers.get('Cache-Control')) {
    headers.set('Cache-Control', 'public, max-age=10')
  }
  if (!headers.get('Content-Type')) {
    const ext = safeSegment.split('.').pop()?.toLowerCase() || ''
    if (ext === 'aac') headers.set('Content-Type', 'audio/aac')
    else if (ext === 'm4a') headers.set('Content-Type', 'audio/mp4')
    else if (ext === 'mp3') headers.set('Content-Type', 'audio/mpeg')
    else if (ext === 'ts') headers.set('Content-Type', 'video/mp2t')
    else headers.set('Content-Type', 'audio/wav')
  }
  return new Response(doResponse.body, { status: doResponse.status, headers })
}

async function getRadioEvents(request: Request, env: Env, matchId: string): Promise<Response> {
  const user = await getCurrentUserFromSessionOrToken(request, env)
  if (!user) {
    return new Response('Not authenticated', { status: 401 })
  }

  const uid = Number(user.id)
  const mid = Number(matchId)
  const authorized = await authorizedToView(env, uid, mid)
  if (!authorized) {
    return new Response('Not authorized', { status: 403 })
  }

  const incoming = new URL(request.url)
  const sinceSeq = incoming.searchParams.get('sinceSeq') || '0'
  const limit = incoming.searchParams.get('limit') || '100'
  const id = env.MATCH_RADIO.idFromName(`match:${mid}`)
  const stub = env.MATCH_RADIO.get(id)
  const doUrl = new URL('https://internal/events')
  doUrl.searchParams.set('sinceSeq', sinceSeq)
  doUrl.searchParams.set('limit', limit)
  const doResponse = await stub.fetch(new Request(doUrl.toString(), { method: 'GET' }))

  const headers = new Headers(doResponse.headers)
  headers.set('Content-Type', 'application/json')
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return new Response(doResponse.body, { status: doResponse.status, headers })
}

export async function handleMatches(
  request: Request,
  env: Env,
  pathname: string,
  ctx?: ExecutionContext
): Promise<Response | null> {
  const segments = pathname.split('/').filter(Boolean)
  const method = request.method

  if (pathname === '/matches' && method === 'POST') {
    return await createMatch(request, env)
  }

  if (pathname === '/matches/current' && method === 'GET') {
    return await getCurrentMatch(request, env)
  }

  if (pathname === '/matches/history/range' && method === 'GET') {
    return await getMatchHistoryRange(request, env)
  }

  if (pathname === '/matches/history/count' && method === 'GET') {
    return await getMatchHistoryCount(request, env)
  }

  if (pathname === '/matches/history' && method === 'GET') {
    return await getMatchHistory(request, env)
  }

  if (segments[0] === 'matches' && segments.length === 3 && segments[2] === 'history' && method === 'DELETE') {
    return await deleteCompletedMatchHistory(request, env, segments[1])
  }

  if (segments[0] === 'matches' && segments.length === 2 && method === 'PATCH') {
    return await patchMatch(request, env, segments[1])
  }

  if (segments[0] === 'matches' && segments.length === 2 && method === 'GET') {
    return await getMatch(request, env, segments[1])
  }

  if (segments[0] === 'matches' && segments.length === 2 && method === 'DELETE') {
    return await endMatch(request, env, segments[1], ctx)
  }

  if (segments[0] === 'matches' && segments[2] === 'server' && method === 'POST') {
    return await setServerRoute(request, env, segments[1])
  }

  if (segments[0] === 'matches' && segments[2] === 'initial-line-score' && method === 'POST') {
    return await initialLineScoreRoute(request, env, segments[1])
  }

  if (segments[0] === 'matches' && segments[2] === 'court-side' && method === 'POST') {
    return await setStartingCourtSideRoute(request, env, segments[1])
  }

  if (segments[0] === 'matches' && segments[2] === 'pause' && method === 'POST') {
    return await pauseMatch(request, env, segments[1])
  }

  if (segments[0] === 'matches' && segments[2] === 'resume' && method === 'POST') {
    return await resumeMatch(request, env, segments[1])
  }

  if (segments[0] === 'matches' && segments[2] === 'start-timer' && method === 'POST') {
    return await startTimer(request, env, segments[1])
  }

  if (segments[0] === 'matches' && segments[2] === 'stats' && method === 'GET') {
    return await getStats(request, env, segments[1])
  }

  if (segments[0] === 'matches' && segments[2] === 'point' && method === 'POST') {
    return await logPoint(request, env, segments[1], ctx)
  }

  if (segments[0] === 'matches' && segments[2] === 'undo' && method === 'POST') {
    return await undoLast(request, env, segments[1])
  }

  if (pathname === '/analytics' && method === 'GET') {
    return await getAnalytics(request, env)
  }

  if (pathname === '/notes' && method === 'GET') {
    return await getNotes(request, env)
  }

  if (pathname === '/notes' && method === 'POST') {
    return await createNote(request, env)
  }

  if (segments[0] === 'notes' && segments.length === 2 && method === 'PUT') {
    return await updateNote(request, env, segments[1])
  }

  if (segments[0] === 'notes' && segments.length === 2 && method === 'DELETE') {
    return await deleteNote(request, env, segments[1])
  }

  if (segments[0] === 'matches' && segments[2] === 'spectate' && request.headers.get('Upgrade') === 'websocket') {
    return await spectateMatch(request, env, segments[1])
  }

  if (segments[0] === 'matches' && segments[2] === 'radio' && segments[3] === 'manifest.m3u8' && method === 'GET') {
    return await getRadioManifest(request, env, segments[1])
  }

  if (segments[0] === 'matches' && segments[2] === 'radio' && segments[3] === 'segments' && segments[4] && method === 'GET') {
    return await getRadioSegment(request, env, segments[1], segments[4])
  }

  if (segments[0] === 'matches' && segments[2] === 'radio' && segments[3] === 'events' && method === 'GET') {
    return await getRadioEvents(request, env, segments[1])
  }

  return null
}

export async function handleRadioMatch(request: Request, env: Env, matchId: string): Promise<Response> {
  const upgradeHeader = request.headers.get('Upgrade')
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected WebSocket', { status: 426 })
  }

  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  const user = await getCurrentUserFromSessionOrToken(request, env)

  if (!user) {
    return new Response('Not authenticated', { status: 401 })
  }

  const uid = Number(user.id)
  const mid = Number(matchId)

  const authorized = await authorizedToView(env, uid, mid)
  if (!authorized) {
    console.error(`[handleRadioMatch] Authorization failed for user ${uid} on match ${mid}`)
    return new Response('Not authorized', { status: 403 })
  }

  const id = env.MATCH_RADIO.idFromName(`match:${mid}`)
  const stub = env.MATCH_RADIO.get(id)

  const doUrl = new URL('https://internal/radio')
  doUrl.searchParams.set('matchId', matchId)
  doUrl.searchParams.set('userId', String(uid))

  const doResponse = await stub.fetch(new Request(doUrl.toString(), {
    headers: request.headers
  }))
  return doResponse
}
