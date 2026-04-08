import type { Env } from './bindings'
import { jsonResponse, emptyCorsResponse } from './http'
import { handleAuth } from './auth'
import { handleUser, handleParentalConsentConfirm } from './user'
import { handleCrm } from './crm'
import { handleTeams } from './team'
import { handleEvents } from './events'
import { handleMatches, handleRadioMatch, handleLiveMatchesListWs } from './match'
import { handleMessages } from './messages'
import { handleImages } from './images'

import { handleStreams } from './streams'
import { getLiveActivityPushTokenStatus, registerLiveActivityPushToken, sendLiveActivityPushesAtOneHour, testLiveActivityPush, triggerLiveActivityCron } from './live-activity'
import { sendEventReminderPushes } from './event-reminders'
import { handleFeedbackBug, handleFeedbackSuggestion } from './feedback'
import { handleSubscriptions, expireStaleSubscriptions } from './subscriptions'
import { handleWebhooks } from './webhooks'
import { MatchSpectate } from './match-spectate-do'
import { MatchRadio } from './match-radio-do'
import { MessageWebSocket } from './message-ws-do'

export class LiveMatchesList {
  private state: DurableObjectState
  private env: Env
  private sessions: Set<{ webSocket: WebSocket }>

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.sessions = new Set()
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/broadcast' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { type: string; matchId: string }
        const { type, matchId } = body
        if (type && matchId) {
          await this.broadcast(JSON.stringify({ type, matchId: String(matchId) }))
        }
        return new Response('OK', { status: 200 })
      } catch (err) {
        return new Response('Error', { status: 500 })
      }
    }

    const upgradeHeader = request.headers.get('Upgrade')
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    this.handleSession(server)

    return new Response(null, {
      status: 101,
      webSocket: client
    })
  }

  private handleSession(webSocket: WebSocket) {
    webSocket.accept()

    const session = { webSocket }
    this.sessions.add(session)

    webSocket.addEventListener('message', async (msg) => {
      try {
        const data = JSON.parse(msg.data as string)
        if (data.type === 'ping') {
          webSocket.send(JSON.stringify({ type: 'pong' }))
        }
      } catch {
        // ignore
      }
    })

    webSocket.addEventListener('close', () => {
      this.sessions.delete(session)
    })

    webSocket.addEventListener('error', () => {
      this.sessions.delete(session)
    })
  }

  private async broadcast(message: string) {
    const stale: { webSocket: WebSocket }[] = []
    for (const session of this.sessions) {
      try {
        session.webSocket.send(message)
      } catch {
        stale.push(session)
      }
    }
    for (const s of stale) {
      this.sessions.delete(s)
    }
  }

  async alarm() {
    // no-op
  }
}

export { MatchSpectate, MatchRadio, MessageWebSocket }

async function routeRequest(
  request: Request,
  env: Env,
  pathname: string,
  ctx?: ExecutionContext
): Promise<Response> {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1)
  }

  if (pathname === '/assets/icon_circle.png' && request.method === 'GET') {
    const { EMAIL_ICON_BASE64 } = await import('./lib/email-assets')
    const binary = Uint8Array.from(atob(EMAIL_ICON_BASE64), c => c.charCodeAt(0))
    return new Response(binary, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  if (pathname === '/health' && request.method === 'GET') {
    return jsonResponse(request, {
      ok: true,
      token: 'HEALTHY:mbp',
      version: '2025.09.24'
    })
  }

  const segments = pathname.split('/').filter(Boolean)

  if (pathname === '/upload/voice-message' && request.method === 'POST') {
    const resp = await handleMessages(request, env, pathname)
    if (resp) return resp
  }

  if (pathname.startsWith('/images/') || pathname.startsWith('/upload/') || (segments[0] === 'teams' && (segments[2] === 'upload-image' || segments[2] === 'delete-image'))) {
    const resp = await handleImages(request, env, pathname)
    if (resp) return resp
  }

  if (pathname === '/events' || segments[0] === 'events') {
    const resp = await handleEvents(request, env, pathname)
    if (resp) return resp
  }

  if (segments[0] === 'teams' && segments[2] === 'events') {
    const resp = await handleEvents(request, env, pathname)
    if (resp) return resp
  }

  if (pathname.startsWith('/auth/') || pathname.startsWith('/api/auth/')) {
    const resp = await handleAuth(request, env, pathname)
    if (resp) return resp
  }

  if (pathname === '/parental-consent/confirm' && request.method === 'GET') {
    return await handleParentalConsentConfirm(request, env)
  }

  if (pathname.startsWith('/user/')) {
    const resp = await handleUser(request, env, pathname)
    if (resp) return resp
  }

  if (pathname.startsWith('/crm/')) {
    const resp = await handleCrm(request, env, pathname)
    if (resp) return resp
  }

  if (segments[0] === 'teams' || segments[0] === 'invites') {
    const resp = await handleTeams(request, env, pathname)
    if (resp) return resp
  }

  if (segments[0] === 'ws' && segments[1] === 'live-matches-list') {
    const resp = await handleLiveMatchesListWs(request, env)
    if (resp) return resp
  }

  if (segments[0] === 'ws' && segments[1] === 'matches' && segments[3] === 'spectate') {
    const resp = await handleMatches(request, env, `/matches/${segments[2]}/spectate`, ctx)
    if (resp) return resp
  }

  if (segments[0] === 'ws' && segments[1] === 'matches' && segments[3] === 'radio') {
    const resp = await handleRadioMatch(request, env, segments[2])
    if (resp) {
      return resp
    }
  }

  if (segments[0] === 'matches' || pathname === '/analytics' || segments[0] === 'notes') {
    const resp = await handleMatches(request, env, pathname, ctx)
    if (resp) return resp
  }

  if (pathname === '/live-activity-push-token' && request.method === 'POST') {
    return await registerLiveActivityPushToken(request, env)
  }
  if (pathname === '/live-activity-push-token' && request.method === 'GET') {
    return await getLiveActivityPushTokenStatus(request, env)
  }
  if (pathname === '/live-activity-push-token/test' && request.method === 'POST') {
    return await testLiveActivityPush(request, env)
  }
  if (pathname === '/live-activity-push-token/cron' && request.method === 'POST') {
    return await triggerLiveActivityCron(request, env)
  }

  if (pathname === '/feedback/bug' && request.method === 'POST') {
    return await handleFeedbackBug(request, env)
  }
  if (pathname === '/feedback/suggestion' && request.method === 'POST') {
    return await handleFeedbackSuggestion(request, env)
  }

  if (pathname === '/devices/register' || segments[0] === 'conversations' || segments[0] === 'messages' || segments[0] === 'gifs' || segments[0] === 'polls' || (segments[0] === 'teams' && segments[2] === 'conversations') || (segments[0] === 'ws' && (segments[1] === 'conversations' || segments[1] === 'teams'))) {
    const resp = await handleMessages(request, env, pathname)
    if (resp) return resp
  }

  if (pathname.startsWith('/streams') || (segments[0] === 'matches' && segments[2] === 'stream')) {
    const resp = await handleStreams(request, env, pathname)
    if (resp) return resp
  }

  if (pathname.startsWith('/subscriptions/')) {
    const resp = await handleSubscriptions(request, env, pathname)
    if (resp) return resp
  }

  if (pathname.startsWith('/webhooks/')) {
    const resp = await handleWebhooks(request, env, pathname)
    if (resp) return resp
  }

  return jsonResponse(request, { error: 'Not found' }, { status: 404 })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const { pathname } = url

    if (request.method === 'OPTIONS') {
      return emptyCorsResponse(request)
    }

    let session: ReturnType<D1Database['withSession']>
    try {
      const clientBookmark = request.headers.get('x-d1-bookmark')
      session = env.DB.withSession(clientBookmark ?? 'first-unconstrained')
    } catch {
      session = env.DB.withSession('first-unconstrained')
    }
    const sessionEnv = { ...env, DB: session } as unknown as Env

    const response = await routeRequest(request, sessionEnv, pathname, ctx)

    if (response.status !== 101) {
      const newResp = new Response(response.body, response)
      newResp.headers.set('x-d1-bookmark', session.getBookmark() ?? '')
      return newResp
    }

    return response
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      await sendLiveActivityPushesAtOneHour(env)
    } catch (e) {
      console.error('[LiveActivity] cron failed', e)
    }
    try {
      await sendEventReminderPushes(env)
    } catch (e) {
      console.error('[EventReminders] cron failed', e)
    }
    try {
      await expireStaleSubscriptions(env)
    } catch (e) {
      console.error('[Subscriptions] stale expiry sweep failed', e)
    }
  },
}