import type { Env } from './bindings'
import { initStats } from './match-helper'

interface Session {
  webSocket: WebSocket
  userId: number
  matchId: number
}

export class MatchSpectate {
  private state: DurableObjectState
  private env: Env
  private sessions: Set<Session>
  private matchId: number | null

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.sessions = new Set()
    this.matchId = null
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      try {
        const stats = await request.json()
        await this.broadcastStats(stats)
        return new Response('OK', { status: 200 })
      } catch (err) {
        return new Response('Error', { status: 500 })
      }
    }

    const matchId = url.searchParams.get('matchId')
    const userId = url.searchParams.get('userId')

    if (!matchId || !userId) {
      return new Response('Missing matchId or userId', { status: 400 })
    }

    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    await this.handleSession(server, parseInt(matchId), parseInt(userId))

    return new Response(null, {
      status: 101,
      webSocket: client
    })
  }

  async handleSession(webSocket: WebSocket, matchId: number, userId: number) {
    webSocket.accept()

    const session: Session = {
      webSocket,
      userId,
      matchId
    }

    this.sessions.add(session)
    this.matchId = matchId

    try {
      const currentStats = await this.getCurrentStats(matchId)
      if (currentStats) {
        webSocket.send(JSON.stringify(currentStats))
      }

      webSocket.addEventListener('message', async (msg) => {
        try {
          const data = JSON.parse(msg.data as string)
          if (data.type === 'ping') {
            webSocket.send(JSON.stringify({ type: 'pong' }))
          }
        } catch (err) {
        }
      })

      webSocket.addEventListener('close', () => {
        this.sessions.delete(session)
      })

      webSocket.addEventListener('error', () => {
        this.sessions.delete(session)
      })

    } catch (err) {
      console.error(`Spectate DO: Error in handleSession:`, err)
      webSocket.close(1011, 'Server error')
      this.sessions.delete(session)
    }
  }

  async checkAuthorization(userId: number, matchId: number): Promise<boolean> {
    try {
      const rec = await this.env.DB
        .prepare('SELECT user_id, is_public FROM matches WHERE id = ?')
        .bind(matchId)
        .first<any>()
      
      if (!rec) return false
      
      const isOwner = rec.user_id == userId
      if (isOwner) return true
      
      if (rec.is_public) {
        const row = await this.env.DB
          .prepare(
            `
            SELECT 1 FROM team_members tm1
            JOIN team_members tm2 ON tm1.team_id = tm2.team_id
            WHERE tm1.user_id = ? AND tm2.user_id = ?
            LIMIT 1
            `
          )
          .bind(userId, rec.user_id)
          .first<any>()
        return row !== null
      }
      
      return false
    } catch (err) {
      return false
    }
  }

  async getCurrentStats(matchId: number): Promise<any> {
    try {
      const rec = await this.env.DB
        .prepare('SELECT stats FROM match_stats WHERE match_id = ?')
        .bind(matchId)
        .first<any>()

      if (!rec || !rec.stats) {
        const stats = initStats(matchId)
        const server = await this.env.DB
          .prepare('SELECT server FROM matches WHERE id = ?')
          .bind(matchId)
          .first<any>()
        stats.server = server?.server || null
        return stats
      }

      return JSON.parse(rec.stats)
    } catch (err) {
      return null
    }
  }

  async broadcastStats(stats: any) {
    const message = JSON.stringify(stats)
    const staleConnections: Session[] = []

    for (const session of this.sessions) {
      try {
        session.webSocket.send(message)
      } catch (err) {
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
