import type { Env } from './bindings'

interface Session {
  webSocket: WebSocket
  userId: number
  username: string
  identifier: string
}

export class MessageWebSocket {
  private state: DurableObjectState
  private env: Env
  private sessions: Set<Session>
  private typingTimers: Map<number, ReturnType<typeof setTimeout>>

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.sessions = new Set()
    this.typingTimers = new Map()
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      try {
        const message = await request.json()
        await this.broadcastMessage(message)
        return new Response('OK', { status: 200 })
      } catch (err) {
        return new Response('Error', { status: 500 })
      }
    }

    const userId = url.searchParams.get('userId')
    const username = url.searchParams.get('username') || 'Unknown'
    const identifier = url.searchParams.get('identifier')

    if (!userId || !identifier) {
      return new Response('Missing userId or identifier', { status: 400 })
    }

    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    await this.handleSession(server, parseInt(userId), username, identifier)

    return new Response(null, {
      status: 101,
      webSocket: client
    })
  }

  async handleSession(webSocket: WebSocket, userId: number, username: string, identifier: string) {
    webSocket.accept()

    const session: Session = {
      webSocket,
      userId,
      username,
      identifier
    }

    this.sessions.add(session)

    try {
      webSocket.addEventListener('message', async (msg) => {
        try {
          const data = JSON.parse(msg.data as string)
          if (data.type === 'ping') {
            webSocket.send(JSON.stringify({ type: 'pong' }))
            return
          }
          if (data.type === 'typing') {
            this.handleTyping(session)
            return
          }
          if (data.type === 'stop_typing') {
            this.clearTyping(session)
            return
          }
        } catch (err) {
        }
      })

      webSocket.addEventListener('close', () => {
        this.clearTyping(session)
        this.sessions.delete(session)
      })

      webSocket.addEventListener('error', () => {
        this.clearTyping(session)
        this.sessions.delete(session)
      })

    } catch (err) {
      webSocket.close(1011, 'Server error')
      this.sessions.delete(session)
    }
  }

  private handleTyping(session: Session) {
    const existing = this.typingTimers.get(session.userId)
    if (existing) clearTimeout(existing)

    this.broadcastMessage({
      type: 'typing',
      userId: session.userId,
      username: session.username,
      excludeUserId: session.userId,
    })

    this.typingTimers.set(session.userId, setTimeout(() => {
      this.typingTimers.delete(session.userId)
      this.broadcastMessage({
        type: 'stop_typing',
        userId: session.userId,
        excludeUserId: session.userId,
      })
    }, 5000))
  }

  private clearTyping(session: Session) {
    const timer = this.typingTimers.get(session.userId)
    if (timer) {
      clearTimeout(timer)
      this.typingTimers.delete(session.userId)
      this.broadcastMessage({
        type: 'stop_typing',
        userId: session.userId,
        excludeUserId: session.userId,
      })
    }
  }

  async broadcastMessage(message: any) {
    const msg = JSON.stringify(message)
    const staleConnections: Session[] = []

    for (const session of this.sessions) {
      if (message.excludeUserId && session.userId === message.excludeUserId) {
        continue
      }
      
      try {
        session.webSocket.send(msg)
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
