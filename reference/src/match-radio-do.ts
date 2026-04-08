import type { Env } from './bindings'
import { initStats } from './match-helper'

const CLIP_SECTION_DIRS: Record<string, string> = {
  A1: 'A_shared/A1_player_placeholders',
  A2: 'A_shared/A2_score_callouts',
  A3: 'A_shared/A3_score_numbers',
  A4: 'A_shared/A4_match_structure',
  A5: 'A_shared/A5_point_results',
  A6: 'A_shared/A6_serving_state',
  A7: 'A_shared/A7_score_context',
  A8: 'A_shared/A8_pressure_situations',
  A9: 'A_shared/A9_connectors',
  B1: 'B_intermediate/B1_point_outcomes',
  B2: 'B_intermediate/B2_rally_length',
  B3: 'B_intermediate/B3_net_play',
  C1: 'C_advanced/C1_shot_types',
  C2: 'C_advanced/C2_shot_modifiers',
  C3: 'C_advanced/C3_serve_placement',
  C4: 'C_advanced/C4_court_position',
  C5: 'C_advanced/C5_shot_outcome_combos',
  C6: 'C_advanced/C6_defense_movement',
  C7: 'C_advanced/C7_energy_emotion',
  C8: 'C_advanced/C8_infractions',
  D: 'D_doubles',
  E: 'E_lifecycle',
  F: 'F_alphabet',
}

function getClipMediaPath(clipId: string): string | null {
  if (clipId.startsWith('TTS:')) return null
  const sub = clipId.match(/^([A-Z]\d?)/)?.[1]
  const dir = (sub && CLIP_SECTION_DIRS[sub]) || CLIP_SECTION_DIRS[clipId.charAt(0)]
  if (!dir) return null
  return `/images/radio-clips/${dir}/${clipId}.wav`
}

function normalizeSegmentLocation(url: string): string {
  if (!url) return '/images/radio-clips/A_shared/A9_connectors/A9_AND.wav'
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/api/images/')) return url.replace('/api/images/', '/images/')
  if (url.startsWith('api/images/')) return '/' + url.replace(/^api\/images\//, 'images/')
  if (url.startsWith('images/')) return '/' + url
  if (url.startsWith('/images/')) return url
  return url.startsWith('/') ? url : `/${url}`
}

function clipsToAudioItems(clips: CommentaryClip[]): Array<{ url?: string; text: string; tts?: boolean }> {
  return clips.filter(c => c.clipId !== SENTENCE_BREAK).map(c => {
    const mediaPath = getClipMediaPath(c.clipId)
    if (mediaPath) {
      return { url: mediaPath, text: c.text }
    }
    return { text: c.text, tts: true }
  })
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

interface CommentaryClip {
  clipId: string
  text: string
}

const CLIP_TEXT: Record<string, string> = {
  A2_LOVE: 'love', A2_FIFTEEN: 'fifteen', A2_THIRTY: 'thirty', A2_FORTY: 'forty',
  A2_LOVE_ALL: 'love all', A2_FIFTEEN_ALL: 'fifteen all', A2_THIRTY_ALL: 'thirty all',
  A2_DEUCE: 'deuce', A2_ADVANTAGE: 'advantage',
  A2_ADVANTAGE_SERVER: 'advantage server', A2_ADVANTAGE_RETURNER: 'advantage returner',
  A2_TO: 'to',

  A3_ZERO: 'zero', A3_ONE: 'one', A3_TWO: 'two', A3_THREE: 'three',
  A3_FOUR: 'four', A3_FIVE: 'five', A3_SIX: 'six', A3_SEVEN: 'seven',
  A3_EIGHT: 'eight', A3_NINE: 'nine', A3_TEN: 'ten', A3_ELEVEN: 'eleven',
  A3_TWELVE: 'twelve', A3_THIRTEEN: 'thirteen', A3_FOURTEEN: 'fourteen',
  A3_FIFTEEN: 'fifteen', A3_SIXTEEN: 'sixteen', A3_SEVENTEEN: 'seventeen',
  A3_EIGHTEEN: 'eighteen', A3_NINETEEN: 'nineteen', A3_TWENTY: 'twenty',
  A3_TWENTY_ONE: 'twenty one', A3_TWENTY_TWO: 'twenty two', A3_TWENTY_THREE: 'twenty three',
  A3_TWENTY_FOUR: 'twenty four', A3_TWENTY_FIVE: 'twenty five', A3_TWENTY_SIX: 'twenty six',
  A3_TWENTY_SEVEN: 'twenty seven', A3_TWENTY_EIGHT: 'twenty eight', A3_TWENTY_NINE: 'twenty nine',
  A3_THIRTY: 'thirty', A3_THIRTY_ONE: 'thirty one', A3_THIRTY_TWO: 'thirty two',
  A3_THIRTY_THREE: 'thirty three', A3_THIRTY_FOUR: 'thirty four', A3_THIRTY_FIVE: 'thirty five',
  A3_THIRTY_SIX: 'thirty six', A3_THIRTY_SEVEN: 'thirty seven', A3_THIRTY_EIGHT: 'thirty eight',
  A3_THIRTY_NINE: 'thirty nine', A3_FORTY: 'forty', A3_FORTY_ONE: 'forty one',
  A3_FORTY_TWO: 'forty two', A3_FORTY_THREE: 'forty three', A3_FORTY_FOUR: 'forty four',
  A3_FORTY_FIVE: 'forty five', A3_FORTY_SIX: 'forty six', A3_FORTY_SEVEN: 'forty seven',
  A3_FORTY_EIGHT: 'forty eight', A3_FORTY_NINE: 'forty nine', A3_FIFTY: 'fifty',

  A4_TIEBREAK: 'tiebreak', A4_SUPER_TIEBREAK: 'super tiebreak',

  A5_WINS_THE_POINT: 'wins the point', A5_WINS_THE_GAME: 'wins the game',
  A5_WINS_THE_SET: 'wins the set', A5_WINS_THE_MATCH: 'wins the match',
  A5_HOLDS_SERVE: 'holds serve', A5_BREAKS_SERVE: 'breaks serve',
  A5_THATS_A_NEW_SET: "That's a new set", A5_MATCH_OVER: 'Match over',

  A6_IS_SERVING_TO: 'is serving to', A6_IS_SERVING: 'is serving',

  A7_THE_GAME_SCORE_IS: 'The game score is',
  A7_THE_GAME_SCORE_IS_NOW: 'The game score is now',
  A7_THE_MATCH_SCORE_IS: 'The match score is',
  A7_THE_SET_SCORES_ARE: 'The set scores are',
  A7_THE_CURRENT_GAME_SCORE_IS: 'The current game score is',
  A7_SETS_TO: 'sets to',
  A7_SET_ONE_COLON: 'Set one', A7_SET_TWO_COLON: 'Set two',
  A7_SET_THREE_COLON: 'Set three', A7_SET_FOUR_COLON: 'Set four',
  A7_SET_FIVE_COLON: 'Set five',

  B1_ACE_EXCL: 'Ace!', B1_DOUBLE_FAULT: 'Double fault',
  B1_WON_WITH_A_WINNER: 'Won with a winner',
  B1_LOST_UNFORCED_ERROR: 'Lost on an unforced error',
  B1_LOST_FORCED_ERROR: 'Lost on a forced error',
  B1_LOST_RETURN_ERROR: 'Lost on a return error',

  B2_ACE_OR_SERVICE_WINNER: 'It was an ace or service winner',
  B2_SHORT_RALLY_TWO_SHOTS: 'It was a short rally, just two shots',
  B2_IT_WAS_A_QUICK: 'It was a quick', B2_IT_WAS_A: 'It was a',
  B2_SHOT_RALLY: 'shot rally',

  C5_FH_WINNER: 'Forehand winner', C5_BH_WINNER: 'Backhand winner',
  C5_FH_UNFORCED_ERROR: 'Forehand unforced error', C5_BH_UNFORCED_ERROR: 'Backhand unforced error',
  C5_FH_FORCED_ERROR: 'Forehand forced error', C5_BH_FORCED_ERROR: 'Backhand forced error',
  C5_VOLLEY_WINNER: 'Volley winner', C5_VOLLEY_ERROR: 'Volley error',
  C5_OVERHEAD_WINNER: 'Overhead winner', C5_OVERHEAD_ERROR: 'Overhead error',
  C5_DROP_SHOT_WINNER: 'Drop shot winner', C5_DROP_SHOT_ERROR: 'Drop shot error',
  C5_LOB_WINNER: 'Lob winner', C5_PASSING_SHOT_WINNER: 'Passing shot winner',

  C3_ACE_DOWN_THE_T: 'Ace down the T', C3_ACE_OUT_WIDE: 'Ace out wide',
  C3_ACE_INTO_THE_BODY: 'Ace into the body',
  C3_DOWN_THE_T: 'down the T', C3_OUT_WIDE: 'out wide', C3_INTO_THE_BODY: 'into the body',

  C8_FOOT_FAULT: 'Foot fault', C8_LET_FIRST_SERVE: 'Let, first serve',
  C8_LET_SECOND_SERVE: 'Let, second serve', C8_TOUCHING_THE_NET: 'Touching the net',
  C8_BALL_HITS_BODY: 'Ball hits body', C8_CARRY: 'Carry',
  C8_HITS_THE_FIXTURE: 'Hits the fixture', C8_RACQUET_DROPPED: 'Racquet dropped',
  C8_REACHED_OVER_THE_NET: 'Reached over the net',
  C8_PENALTY_POINT: 'Penalty point', C8_PENALTY_GAME: 'Penalty game',
  C8_PENALTY_SET: 'Penalty set',

  E_WELCOME: 'Welcome to the live match commentary',
  E_ABOUT_TO_BEGIN: 'The match is about to begin',
}

function clip(id: string): CommentaryClip {
  return { clipId: id, text: CLIP_TEXT[id] || id }
}

function ttsClip(text: string): CommentaryClip {
  return { clipId: `TTS:${text}`, text }
}

const SENTENCE_BREAK = '_BREAK'
function sentenceBreak(): CommentaryClip {
  return { clipId: SENTENCE_BREAK, text: '' }
}

const NUMBER_CLIP_IDS = [
  'A3_ZERO', 'A3_ONE', 'A3_TWO', 'A3_THREE', 'A3_FOUR', 'A3_FIVE',
  'A3_SIX', 'A3_SEVEN', 'A3_EIGHT', 'A3_NINE', 'A3_TEN', 'A3_ELEVEN',
  'A3_TWELVE', 'A3_THIRTEEN', 'A3_FOURTEEN', 'A3_FIFTEEN', 'A3_SIXTEEN',
  'A3_SEVENTEEN', 'A3_EIGHTEEN', 'A3_NINETEEN', 'A3_TWENTY',
  'A3_TWENTY_ONE', 'A3_TWENTY_TWO', 'A3_TWENTY_THREE', 'A3_TWENTY_FOUR',
  'A3_TWENTY_FIVE', 'A3_TWENTY_SIX', 'A3_TWENTY_SEVEN', 'A3_TWENTY_EIGHT',
  'A3_TWENTY_NINE', 'A3_THIRTY', 'A3_THIRTY_ONE', 'A3_THIRTY_TWO',
  'A3_THIRTY_THREE', 'A3_THIRTY_FOUR', 'A3_THIRTY_FIVE', 'A3_THIRTY_SIX',
  'A3_THIRTY_SEVEN', 'A3_THIRTY_EIGHT', 'A3_THIRTY_NINE', 'A3_FORTY',
  'A3_FORTY_ONE', 'A3_FORTY_TWO', 'A3_FORTY_THREE', 'A3_FORTY_FOUR',
  'A3_FORTY_FIVE', 'A3_FORTY_SIX', 'A3_FORTY_SEVEN', 'A3_FORTY_EIGHT',
  'A3_FORTY_NINE', 'A3_FIFTY',
]

function numberClip(n: number): CommentaryClip {
  if (n >= 0 && n <= 50) return clip(NUMBER_CLIP_IDS[n])
  return ttsClip(String(n))
}

const SET_LABEL_CLIPS = [
  'A7_SET_ONE_COLON', 'A7_SET_TWO_COLON', 'A7_SET_THREE_COLON',
  'A7_SET_FOUR_COLON', 'A7_SET_FIVE_COLON',
]

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function clipsToText(clips: CommentaryClip[]): string {
  const sentences: string[] = []
  let current = ''
  for (const c of clips) {
    if (c.clipId === SENTENCE_BREAK) {
      const trimmed = current.trim()
      if (trimmed) sentences.push(trimmed)
      current = ''
    } else {
      current += (current ? ' ' : '') + c.text
    }
  }
  const trimmed = current.trim()
  if (trimmed) sentences.push(trimmed)
  return sentences.map(s => {
    const capped = capitalize(s)
    return /[.!?]$/.test(capped) ? capped : capped + '.'
  }).join(' ')
}

function gameScoreClips(serverDisplay: string, receiverDisplay: string): CommentaryClip[] {
  const s = serverDisplay
  const r = receiverDisplay
  if (s === 'Ad' && r === '') return [clip('A2_ADVANTAGE_SERVER')]
  if (s === '' && r === 'Ad') return [clip('A2_ADVANTAGE_RETURNER')]
  if (s === '40' && r === '40') return [clip('A2_DEUCE')]

  const scoreMap: Record<string, string> = {
    '0': 'A2_LOVE', '15': 'A2_FIFTEEN', '30': 'A2_THIRTY', '40': 'A2_FORTY',
  }
  if (s === r) {
    const allMap: Record<string, string> = {
      '0': 'A2_LOVE_ALL', '15': 'A2_FIFTEEN_ALL', '30': 'A2_THIRTY_ALL',
    }
    if (allMap[s]) return [clip(allMap[s])]
  }
  const clips: CommentaryClip[] = []
  clips.push(scoreMap[s] ? clip(scoreMap[s]) : ttsClip(s))
  clips.push(clip('A2_TO'))
  clips.push(scoreMap[r] ? clip(scoreMap[r]) : ttsClip(r))
  return clips
}

interface RadioSession {
  webSocket: WebSocket
  userId: number
  matchId: number
}

interface RollingRadioSegment {
  seq: number
  url: string
  extension: 'wav' | 'm4a' | 'aac' | 'mp3' | 'ts'
  contentType: string
  text: string
  durationSec: number
  createdAtMs: number
}

interface RadioEventPayload {
  type: 'radio'
  seq: number
  clips: Array<{ id: string; text: string }>
  audio: Array<{ url?: string; text: string; tts?: boolean }>
  text: string
  createdAtMs: number
}

export class MatchRadio {
  private state: DurableObjectState
  private env: Env
  private sessions: Set<RadioSession>
  private matchId: number | null
  private lastCommentaryText: string | null
  private spectateStub: any | null
  private lastStats: any | null
  private rollingSegments: RollingRadioSegment[]
  private nextSegmentSeq: number
  private readonly maxRollingSegments: number
  private recentEvents: RadioEventPayload[]
  private nextEventSeq: number
  private readonly maxRecentEvents: number

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.sessions = new Set()
    this.matchId = null
    this.lastCommentaryText = null
    this.spectateStub = null
    this.lastStats = null
    this.rollingSegments = []
    this.nextSegmentSeq = 1
    this.maxRollingSegments = 80
    this.recentEvents = []
    this.nextEventSeq = 1
    this.maxRecentEvents = 200
  }

  private getSegmentFormat(url: string): { extension: 'wav' | 'm4a' | 'aac' | 'mp3' | 'ts'; contentType: string } {
    const match = url.toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/)
    const ext = match?.[1]
    switch (ext) {
      case 'aac':
        return { extension: 'aac', contentType: 'audio/aac' }
      case 'm4a':
        return { extension: 'm4a', contentType: 'audio/mp4' }
      case 'mp3':
        return { extension: 'mp3', contentType: 'audio/mpeg' }
      case 'ts':
        return { extension: 'ts', contentType: 'video/mp2t' }
      default:
        return { extension: 'wav', contentType: 'audio/wav' }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/manifest.m3u8' && request.method === 'GET') {
      const matchIdParam = url.searchParams.get('matchId')
      const requestedMatchId = matchIdParam ? Number(matchIdParam) : this.matchId
      const token = url.searchParams.get('token') || ''
      return this.getLiveManifest(requestedMatchId, token)
    }

    if (url.pathname.startsWith('/segments/') && request.method === 'GET') {
      const segMatch = url.pathname.match(/^\/segments\/(\d+)\.(wav|m4a|aac|mp3|ts)$/)
      if (!segMatch) {
        return new Response('Invalid segment path', { status: 400 })
      }
      const seq = Number(segMatch[1])
      return this.getSegmentResponse(seq)
    }

    if (url.pathname === '/events' && request.method === 'GET') {
      const sinceSeqRaw = url.searchParams.get('sinceSeq')
      const limitRaw = url.searchParams.get('limit')
      const sinceSeq = sinceSeqRaw ? Number(sinceSeqRaw) : 0
      const limit = limitRaw ? Number(limitRaw) : 100
      return this.getEventsSince(sinceSeq, limit)
    }
    
    if (url.pathname === '/commentary' && request.method === 'POST') {
      try {
        const data = await request.json() as { stats: any; match: any; oldStats?: any }
        const oldStats = this.lastStats
        await this.broadcastCommentary(data.stats, data.match)
        return new Response('OK', { status: 200 })
      } catch (err) {
        return new Response('Error', { status: 500 })
      }
    }

    const matchId = url.searchParams.get('matchId')
    const userId = url.searchParams.get('userId')

    if (!matchId || !userId) {
      console.error(`Radio DO: Missing matchId or userId`)
      return new Response('Missing matchId or userId', { status: 400 })
    }

    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    
    this.handleSession(server, parseInt(matchId), parseInt(userId)).catch((err) => {
      console.error(`Radio DO: Error in handleSession:`, err)
      try {
        server.close(1011, `Error: ${err instanceof Error ? err.message : 'Unknown'}`)
      } catch {}
    })

    return new Response(null, {
      status: 101,
      webSocket: client
    })
  }

  private pushRollingAudio(audio: Array<{ url?: string; text: string; tts?: boolean }>): void {
    const now = Date.now()
    for (const item of audio) {
      if (!item?.url || item.tts) continue
      const format = this.getSegmentFormat(item.url)
      const seg: RollingRadioSegment = {
        seq: this.nextSegmentSeq++,
        url: item.url,
        extension: format.extension,
        contentType: format.contentType,
        text: item.text || '',
        durationSec: 2,
        createdAtMs: now,
      }
      this.rollingSegments.push(seg)
    }
    if (this.rollingSegments.length > this.maxRollingSegments) {
      this.rollingSegments = this.rollingSegments.slice(-this.maxRollingSegments)
    }
  }

  private async getLiveManifest(matchId: number | null, token: string): Promise<Response> {
    if (matchId && Number.isFinite(matchId)) {
      this.matchId = matchId
      if (this.rollingSegments.length === 0) {
        await this.seedRollingSegments(matchId)
      }
    }

    const resolvedMatchId = this.matchId
    if (!resolvedMatchId) {
      return new Response('#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:0\n', {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      })
    }

    const window = this.rollingSegments.slice(-24)
    const firstSeq = window.length > 0 ? window[0].seq : Math.max(0, this.nextSegmentSeq - 1)
    const q = token ? `?token=${encodeURIComponent(token)}` : ''
    const lines: string[] = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:2',
      `#EXT-X-MEDIA-SEQUENCE:${firstSeq}`,
      '#EXT-X-ALLOW-CACHE:NO',
      '#EXT-X-PLAYLIST-TYPE:EVENT',
    ]

    for (const seg of window) {
      lines.push(`#EXTINF:${seg.durationSec.toFixed(3)},${seg.text.replace(/,/g, ' ')}`)
      lines.push(`segments/${seg.seq}.${seg.extension}${q}`)
    }

    if (window.length === 0) {
      lines.push('#EXTINF:0.500,bootstrap')
      lines.push(`segments/0.wav${q}`)
    }

    return new Response(`${lines.join('\n')}\n`, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  }

  private async seedRollingSegments(matchId: number): Promise<void> {
    try {
      const matchRec = await this.env.DB
        .prepare('SELECT * FROM matches WHERE id = ?')
        .bind(matchId)
        .first<any>()
      if (!matchRec) return

      const statsRec = await this.env.DB
        .prepare('SELECT stats FROM match_stats WHERE match_id = ?')
        .bind(matchId)
        .first<any>()

      const stats = statsRec?.stats ? JSON.parse(statsRec.stats) : null
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

      const clips = this.generateCommentaryClips(stats, match, null)
      const audioItems = clipsToAudioItems(clips)
      if (audioItems.length > 0) {
        this.pushRollingAudio(audioItems)
        this.lastCommentaryText = clipsToText(clips)
        this.lastStats = stats
      }
    } catch (err) {
      console.error(`Radio: Error seeding manifest for match ${matchId}:`, err)
    }
  }

  private getEventsSince(sinceSeq: number, limit: number): Response {
    const normalizedSince = Number.isFinite(sinceSeq) && sinceSeq > 0 ? Math.floor(sinceSeq) : 0
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 100
    const events = this.recentEvents.filter(event => event.seq > normalizedSince).slice(-normalizedLimit)
    const latestSeq = this.recentEvents.length > 0 ? this.recentEvents[this.recentEvents.length - 1].seq : 0
    return new Response(
      JSON.stringify({ events, latestSeq }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    )
  }

  private pushEvent(payload: Omit<RadioEventPayload, 'seq' | 'createdAtMs'>): RadioEventPayload {
    const event: RadioEventPayload = {
      ...payload,
      seq: this.nextEventSeq++,
      createdAtMs: Date.now(),
    }
    this.recentEvents.push(event)
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents = this.recentEvents.slice(-this.maxRecentEvents)
    }
    return event
  }

  private getSegmentResponse(seq: number): Response {
    if (seq === 0) {
      const bootstrapLocation = '/images/radio-clips/A_shared/A9_connectors/A9_AND.wav'
      return new Response('', {
        status: 307,
        headers: {
          Location: bootstrapLocation,
          'Content-Type': 'audio/wav',
          'Cache-Control': 'public, max-age=2',
        },
      })
    }

    const seg = this.rollingSegments.find(s => s.seq === seq)
    if (!seg) {
      return new Response('Segment not found', { status: 404 })
    }

    const location = normalizeSegmentLocation(seg.url)

    return new Response(null, {
      status: 307,
      headers: {
        Location: location,
        'Content-Type': seg.contentType,
        'Cache-Control': 'public, max-age=10',
      },
    })
  }

  async handleSession(webSocket: WebSocket, matchId: number, userId: number) {
    const session: RadioSession = {
      webSocket,
      userId,
      matchId
    }

    try {
      webSocket.accept()

      this.sessions.add(session)
      this.matchId = matchId

      try {
        const confirmMsg = JSON.stringify({ type: 'connected', message: 'Radio connected' })
        webSocket.send(confirmMsg)
      } catch (err) {
        console.error(`Radio: Error sending connection confirmation:`, err)
        try {
          webSocket.close(1011, 'Failed to send confirmation')
        } catch {}
        this.sessions.delete(session)
        return
      }

      setTimeout(() => {
        this.sendInitialCommentary(matchId).catch((err) => {
          console.error(`Radio: Error in sendInitialCommentary:`, err)
        })
      }, 100)

      webSocket.addEventListener('message', async (msg) => {
        try {
          const data = JSON.parse(msg.data as string)
          if (data.type === 'ping') {
            webSocket.send(JSON.stringify({ type: 'pong' }))
          }
        } catch (err) {
        }
      })

      webSocket.addEventListener('close', (event) => {
        this.sessions.delete(session)
        if (this.sessions.size === 0) {
          this.spectateStub = null
        }
      })

      webSocket.addEventListener('error', (event) => {
        console.error(`Radio: WebSocket error for user ${userId} on match ${matchId}:`, event)
        this.sessions.delete(session)
        if (this.sessions.size === 0) {
          this.spectateStub = null
        }
      })

    } catch (err) {
      console.error(`Radio: Error in handleSession for user ${userId} on match ${matchId}:`, err)
      try {
        if (webSocket.readyState === WebSocket.READY_STATE_OPEN || webSocket.readyState === WebSocket.READY_STATE_CONNECTING) {
          webSocket.close(1011, `Server error: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      } catch (closeErr) {
        console.error(`Radio: Error closing WebSocket:`, closeErr)
      }
      this.sessions.delete(session)
    }
  }

  async checkAuthorization(userId: number, matchId: number): Promise<boolean> {
    try {
      const rec = await this.env.DB
        .prepare('SELECT user_id, is_public FROM matches WHERE id = ?')
        .bind(matchId)
        .first<any>()
      
      if (!rec) {
        return false
      }
      
      const isOwner = rec.user_id == userId
      if (isOwner) {
        return true
      }
      
      if (rec.is_public) {
        const areTeammates = await checkTeammates(this.env, userId, rec.user_id)
        if (areTeammates) {
          return true
        }
        return true
      }
      
      return false
    } catch (err) {
      console.error(`Radio: Authorization check error:`, err)
      return false
    }
  }

  async sendInitialCommentary(matchId: number) {
    try {
      const matchRec = await this.env.DB
        .prepare('SELECT * FROM matches WHERE id = ?')
        .bind(matchId)
        .first<any>()
      
      if (!matchRec) {
        console.error(`Radio: Match ${matchId} not found in database`)
        return
      }

      const statsRec = await this.env.DB
        .prepare('SELECT stats FROM match_stats WHERE match_id = ?')
        .bind(matchId)
        .first<any>()

      const stats = statsRec?.stats ? JSON.parse(statsRec.stats) : null
      
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
      
      this.lastCommentaryText = null
      this.lastStats = null
      
      const clips = this.generateCommentaryClips(stats, match, null)
      const commentaryText = clipsToText(clips)
      
      const audioItems = clipsToAudioItems(clips)
      this.pushRollingAudio(audioItems)

      const payload = this.pushEvent({
        type: 'radio',
        clips: clips.map(c => ({ id: c.clipId, text: c.text })),
        audio: audioItems,
        text: commentaryText,
      })
      const message = JSON.stringify(payload)

      
      if (this.sessions.size === 0) {
        return
      }

      const staleConnections: RadioSession[] = []
      for (const session of this.sessions) {
        try {
          const READY_STATE_OPEN = 1
          if (session.webSocket.readyState === READY_STATE_OPEN) {
            session.webSocket.send(message)
          } else {
            staleConnections.push(session)
          }
        } catch (err) {
          console.error(`Radio: Error sending initial commentary to session ${session.userId}:`, err)
          staleConnections.push(session)
        }
      }

      for (const session of staleConnections) {
        this.sessions.delete(session)
      }
      
      this.lastCommentaryText = commentaryText
      this.lastStats = stats
    } catch (err) {
      console.error(`Radio: Error sending initial commentary for match ${matchId}:`, err)
    }
  }

  generateCommentaryClips(newStats: any, match: any, oldStats: any | null = null): CommentaryClip[] {
    if (!newStats) {
      return [clip('E_WELCOME'), sentenceBreak(), clip('E_ABOUT_TO_BEGIN')]
    }

    const statMode = match.statMode || 'basic'
    const currentGame = newStats.currentGame || {}
    const serverDisplay = currentGame.serverDisplay || '0'
    const receiverDisplay = currentGame.receiverDisplay || '0'

    const yourTeam = match.matchType === 'singles'
      ? match.yourPlayer1
      : `${match.yourPlayer1}${match.yourPlayer2 ? ` and ${match.yourPlayer2}` : ''}`
    const oppTeam = match.matchType === 'singles'
      ? match.oppPlayer1
      : `${match.oppPlayer1}${match.oppPlayer2 ? ` and ${match.oppPlayer2}` : ''}`

    const currentServer = newStats.server || match.server || ''
    const isYourTeamServing = currentServer.includes('your') ||
                              currentServer === match.yourPlayer1 ||
                              currentServer === match.yourPlayer2
    const servingTeam = isYourTeamServing ? yourTeam : oppTeam
    const receivingTeam = isYourTeamServing ? oppTeam : yourTeam

    const pointJustWon = oldStats && newStats.history && oldStats.history &&
                         newStats.history.length > oldStats.history.length

    const lastPointEvent = pointJustWon && newStats.history ?
      newStats.history[newStats.history.length - 1] : null

    const yourTeamIds = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p)
    const oppTeamIds = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p)

    const getTeamGames = (gameScores: Record<string, number>, teamIds: string[]) =>
      teamIds.reduce((acc, id) => acc + (gameScores[id] || 0), 0)

    let yourSetsWon = 0
    let oppSetsWon = 0
    for (const set of newStats.sets || []) {
      const yourGames = getTeamGames(set.games, yourTeamIds)
      const oppGames = getTeamGames(set.games, oppTeamIds)
      if (yourGames > oppGames) yourSetsWon++
      else if (oppGames > yourGames) oppSetsWon++
    }

    const scoreClips = gameScoreClips(serverDisplay, receiverDisplay)

    const buildMatchOverClips = (): CommentaryClip[] => {
      const winner = yourTeamIds.includes(newStats.matchWinner) ? yourTeam : oppTeam
      const winnerSets = yourTeamIds.includes(newStats.matchWinner) ? yourSetsWon : oppSetsWon
      const loserSets = yourTeamIds.includes(newStats.matchWinner) ? oppSetsWon : yourSetsWon
      return [
        clip('A5_MATCH_OVER'), sentenceBreak(),
        ttsClip(winner), clip('A5_WINS_THE_MATCH'),
        numberClip(winnerSets), clip('A7_SETS_TO'), numberClip(loserSets),
      ]
    }

    const buildMatchScoreClips = (): CommentaryClip[] => {
      return [clip('A7_THE_MATCH_SCORE_IS'), numberClip(yourSetsWon), clip('A7_SETS_TO'), numberClip(oppSetsWon)]
    }

    const buildGameWonClips = (): CommentaryClip[] => {
      const oldGame = oldStats?.currentGame || {}
      const oldServerPoints = oldGame.serverPoints || 0
      const oldReceiverPoints = oldGame.receiverPoints || 0
      const newServerPoints = currentGame.serverPoints || 0
      const newReceiverPoints = currentGame.receiverPoints || 0

      if ((newServerPoints >= 4 || newReceiverPoints >= 4) &&
          (oldServerPoints < 4 && oldReceiverPoints < 4)) {
        const gameWinner = newServerPoints > newReceiverPoints ? servingTeam : receivingTeam
        return [ttsClip(gameWinner), clip('A5_WINS_THE_GAME')]
      }
      return []
    }

    const buildNewSetClips = (): CommentaryClip[] => {
      const oldSets = oldStats?.sets || []
      if (newStats.sets && newStats.sets.length > oldSets.length) {
        return [clip('A5_THATS_A_NEW_SET')]
      }
      return []
    }

    if (statMode === 'basic') {
      if (pointJustWon && lastPointEvent) {
        const winnerId = lastPointEvent.pointWinnerId
        const winnerName = yourTeamIds.includes(winnerId) ? yourTeam : oppTeam

        const out: CommentaryClip[] = [
          ttsClip(winnerName), clip('A5_WINS_THE_POINT'),
          sentenceBreak(),
          clip('A7_THE_GAME_SCORE_IS_NOW'), ...scoreClips,
        ]

        const gwc = buildGameWonClips()
        if (gwc.length) out.push(sentenceBreak(), ...gwc)
        const nsc = buildNewSetClips()
        if (nsc.length) out.push(sentenceBreak(), ...nsc)

        if (newStats.matchWinner) {
          out.push(sentenceBreak(), ...buildMatchOverClips())
        } else {
          out.push(sentenceBreak(), ...buildMatchScoreClips())
        }
        return out
      }

      return [
        ttsClip(servingTeam), clip('A6_IS_SERVING_TO'), ttsClip(receivingTeam),
        sentenceBreak(),
        clip('A7_THE_GAME_SCORE_IS'), ...scoreClips,
        sentenceBreak(),
        ...buildMatchScoreClips(),
      ]
    }

    if (statMode === 'intermediate') {
      if (pointJustWon && lastPointEvent) {
        const winnerId = lastPointEvent.pointWinnerId
        const winnerName = yourTeamIds.includes(winnerId) ? yourTeam : oppTeam

        const rallyLength = lastPointEvent.rallyLength || 1
        const actions = lastPointEvent.actions || []
        const actionTypes = actions.map((a: any) => a.type?.toUpperCase() || '').filter(Boolean)

        const out: CommentaryClip[] = [ttsClip(winnerName), clip('A5_WINS_THE_POINT'), sentenceBreak()]

        if (rallyLength === 1) {
          out.push(clip('B2_ACE_OR_SERVICE_WINNER'))
        } else if (rallyLength === 2) {
          out.push(clip('B2_SHORT_RALLY_TWO_SHOTS'))
        } else if (rallyLength <= 4) {
          out.push(clip('B2_IT_WAS_A_QUICK'), numberClip(rallyLength), clip('B2_SHOT_RALLY'))
        } else {
          out.push(clip('B2_IT_WAS_A'), numberClip(rallyLength), clip('B2_SHOT_RALLY'))
        }

        if (actionTypes.includes('ACE')) {
          out.push(sentenceBreak(), clip('B1_ACE_EXCL'))
        } else if (actionTypes.includes('DOUBLE_FAULT') || actionTypes.includes('DOUBLE FAULT')) {
          out.push(sentenceBreak(), clip('B1_DOUBLE_FAULT'))
        } else if (actionTypes.some((t: string) => t.includes('WINNER'))) {
          out.push(sentenceBreak(), clip('B1_WON_WITH_A_WINNER'))
        } else if (actionTypes.some((t: string) => t.includes('UNFORCED_ERROR') || t.includes('UNFORCED ERROR'))) {
          out.push(sentenceBreak(), clip('B1_LOST_UNFORCED_ERROR'))
        } else if (actionTypes.some((t: string) => t.includes('FORCED_ERROR') || t.includes('FORCED ERROR'))) {
          out.push(sentenceBreak(), clip('B1_LOST_FORCED_ERROR'))
        } else if (actionTypes.some((t: string) => t.includes('RETURN'))) {
          out.push(sentenceBreak(), clip('B1_LOST_RETURN_ERROR'))
        }

        out.push(sentenceBreak(), clip('A7_THE_GAME_SCORE_IS_NOW'), ...scoreClips)
        const gwc = buildGameWonClips()
        if (gwc.length) out.push(sentenceBreak(), ...gwc)
        const nsc = buildNewSetClips()
        if (nsc.length) out.push(sentenceBreak(), ...nsc)

        if (newStats.matchWinner) {
          out.push(sentenceBreak(), ...buildMatchOverClips())
        } else {
          out.push(sentenceBreak(), ...buildMatchScoreClips())
        }
        return out
      }

      return [
        ttsClip(servingTeam), clip('A6_IS_SERVING_TO'), ttsClip(receivingTeam),
        sentenceBreak(),
        clip('A7_THE_GAME_SCORE_IS'), ...scoreClips,
        sentenceBreak(),
        ...buildMatchScoreClips(),
      ]
    }

    // Advanced mode
    const out: CommentaryClip[] = [
      ttsClip(servingTeam), clip('A6_IS_SERVING_TO'), ttsClip(receivingTeam),
      sentenceBreak(),
    ]

    if (newStats.sets && newStats.sets.length > 0) {
      out.push(clip('A7_THE_SET_SCORES_ARE'))
      newStats.sets.forEach((set: any, idx: number) => {
        const yg = getTeamGames(set.games, yourTeamIds)
        const og = getTeamGames(set.games, oppTeamIds)
        if (idx < SET_LABEL_CLIPS.length) {
          out.push(clip(SET_LABEL_CLIPS[idx]))
        }
        out.push(numberClip(yg), clip('A2_TO'), numberClip(og))
      })
      out.push(sentenceBreak())
    }

    out.push(clip('A7_THE_CURRENT_GAME_SCORE_IS'), ...scoreClips, sentenceBreak())

    if (match.status === 'completed' || newStats.matchWinner) {
      out.push(...buildMatchOverClips())
    } else {
      out.push(...buildMatchScoreClips())
    }

    return out
  }

  generateCommentary(newStats: any, match: any, oldStats: any | null = null): string {
    return clipsToText(this.generateCommentaryClips(newStats, match, oldStats))
  }

  async broadcastCommentary(stats: any, match: any) {
    const oldStats = this.lastStats
    const clips = this.generateCommentaryClips(stats, match, oldStats)
    const commentaryText = clipsToText(clips)
    
    if (commentaryText === this.lastCommentaryText && this.lastCommentaryText !== null) {
      this.lastStats = stats
      return
    }
    
    this.lastCommentaryText = commentaryText
    this.lastStats = stats

    const audioItems = clipsToAudioItems(clips)
    this.pushRollingAudio(audioItems)

    const payload = this.pushEvent({
      type: 'radio',
      clips: clips.map(c => ({ id: c.clipId, text: c.text })),
      audio: audioItems,
      text: commentaryText,
    })
    const message = JSON.stringify(payload)

    if (this.sessions.size === 0) {
      return
    }

    const staleConnections: RadioSession[] = []

    for (const session of this.sessions) {
      try {
        const READY_STATE_OPEN = 1
        if (session.webSocket.readyState === READY_STATE_OPEN) {
          session.webSocket.send(message)
        } else {
          staleConnections.push(session)
        }
      } catch (err) {
        console.error(`Radio: Error sending to session ${session.userId}:`, err)
        staleConnections.push(session)
      }
    }

    for (const session of staleConnections) {
      this.sessions.delete(session)
    }
  }

  async alarm() {
  }
}
