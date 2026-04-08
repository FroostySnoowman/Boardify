import type { Env } from './bindings'
import { jsonResponse } from './http'
import { getCurrentUserFromSession } from './auth'

const MAX_TEXT_LENGTH = 2000

async function postToDiscord(webhookUrl: string, content: string): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: content.slice(0, MAX_TEXT_LENGTH) }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Discord webhook failed: ${res.status} ${err}`)
  }
}

export async function handleFeedbackBug(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const webhookUrl = env.BUG_REPORT_WEBHOOK_URL
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    return jsonResponse(request, { error: 'Bug report not configured' }, { status: 503 })
  }

  let body: { text?: string } = {}
  try {
    const raw = (await request.json()) as Record<string, unknown> | null
    if (raw && typeof raw === 'object' && 'text' in raw && typeof raw.text === 'string') {
      body = { text: raw.text.trim() }
    }
  } catch {
    return jsonResponse(request, { error: 'Invalid payload' }, { status: 400 })
  }
  if (!body.text) {
    return jsonResponse(request, { error: 'Text is required' }, { status: 400 })
  }

  const by = user.email || user.username || `user ${user.id}`
  const content = `**Bug Report**\n${body.text}\n\n- ${by}`
  try {
    await postToDiscord(webhookUrl, content)
  } catch (e) {
    console.error('Bug report webhook error:', e)
    return jsonResponse(request, { error: 'Failed to submit' }, { status: 502 })
  }
  return jsonResponse(request, { ok: true }, { status: 200 })
}

export async function handleFeedbackSuggestion(request: Request, env: Env): Promise<Response> {
  const user = await getCurrentUserFromSession(request, env)
  if (!user) {
    return jsonResponse(request, { error: 'Not authenticated' }, { status: 401 })
  }

  const webhookUrl = env.SUGGESTIONS_WEBHOOK_URL
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    return jsonResponse(request, { error: 'Suggestions not configured' }, { status: 503 })
  }

  let body: { text?: string } = {}
  try {
    const raw = (await request.json()) as Record<string, unknown> | null
    if (raw && typeof raw === 'object' && 'text' in raw && typeof raw.text === 'string') {
      body = { text: raw.text.trim() }
    }
  } catch {
    return jsonResponse(request, { error: 'Invalid payload' }, { status: 400 })
  }
  if (!body.text) {
    return jsonResponse(request, { error: 'Text is required' }, { status: 400 })
  }

  const by = user.email || user.username || `user ${user.id}`
  const content = `**Feature Suggestion**\n${body.text}\n\n- ${by}`
  try {
    await postToDiscord(webhookUrl, content)
  } catch (e) {
    console.error('Suggestions webhook error:', e)
    return jsonResponse(request, { error: 'Failed to submit' }, { status: 502 })
  }
  return jsonResponse(request, { ok: true }, { status: 200 })
}
