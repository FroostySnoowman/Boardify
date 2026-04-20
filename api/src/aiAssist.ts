import type { Env } from './bindings';
import type { AuthPrincipal } from './authPrincipal';
import { jsonResponse } from './http';
import { requireBoardAccess } from './boardAccess';

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8-fast';
const AI_DAILY_LIMIT = 40;

function roleAtLeast(role: string, min: 'member' | 'admin' | 'owner'): boolean {
  const order = { member: 0, admin: 1, owner: 2 };
  return order[role as keyof typeof order] >= order[min];
}

function extractLlmText(result: unknown): string {
  if (result == null) return '';
  if (typeof result === 'string') return result;
  if (typeof result === 'object' && result !== null && 'response' in result) {
    const r = (result as { response?: unknown }).response;
    if (typeof r === 'string') return r;
  }
  return JSON.stringify(result);
}

function stripJsonFence(s: string): string {
  const t = s.trim();
  if (t.startsWith('```')) {
    return t
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }
  return t;
}

async function tryConsumeAiSlot(env: Env, userId: number): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const row = await env.DB.prepare('SELECT count FROM ai_usage_daily WHERE user_id = ? AND day = ?')
    .bind(userId, day)
    .first<{ count: number }>();
  if ((row?.count ?? 0) >= AI_DAILY_LIMIT) return false;
  await env.DB.prepare(
    `INSERT INTO ai_usage_daily (user_id, day, count) VALUES (?, ?, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET count = ai_usage_daily.count + 1`
  )
    .bind(userId, day)
    .run();
  return true;
}

async function runLlmJson(env: Env, system: string, user: string, maxTokens: number): Promise<unknown> {
  const ai = env.AI;
  if (!ai) {
    throw new Error('Workers AI binding missing');
  }
  const raw = await ai.run(AI_MODEL as keyof AiModels, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: maxTokens,
  } as Parameters<typeof ai.run>[1]);
  const text = stripJsonFence(extractLlmText(raw));
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('Model did not return valid JSON');
  }
}

type CardRow = {
  id: string;
  title: string;
  due_date: string | null;
  payload_json: string;
  list_title: string;
};

async function loadBoardCards(env: Env, boardId: string, listIds: string[] | undefined, max: number): Promise<CardRow[]> {
  let q = `SELECT c.id, c.title, c.due_date, c.payload_json, l.title as list_title
     FROM cards c
     INNER JOIN lists l ON l.id = c.list_id
     WHERE l.board_id = ? AND l.archived_at IS NULL`;
  const binds: unknown[] = [boardId];
  if (listIds && listIds.length > 0) {
    const ph = listIds.map(() => '?').join(',');
    q += ` AND l.id IN (${ph})`;
    binds.push(...listIds);
  }
  q += ' ORDER BY c.position ASC LIMIT ?';
  binds.push(max);
  const { results } = await env.DB.prepare(q).bind(...binds).all<CardRow>();
  return results ?? [];
}

function compactCardLine(c: CardRow): Record<string, unknown> {
  const p = parseJson<Record<string, unknown>>(c.payload_json, {});
  const priorities = Array.isArray(p.priorities) ? p.priorities : [];
  const pri = priorities
    .slice(0, 3)
    .map((x) => (x && typeof x === 'object' && 'name' in x ? String((x as { name?: string }).name ?? '') : ''))
    .filter(Boolean)
    .join(',');
  return {
    id: c.id,
    title: c.title.slice(0, 120),
    due: c.due_date,
    list: (c.list_title || '').slice(0, 60),
    priorities: pri || undefined,
  };
}

export async function handleBoardAiPrioritize(
  request: Request,
  env: Env,
  boardId: string,
  principal: AuthPrincipal | null
): Promise<Response | null> {
  if (request.method !== 'POST') return null;
  const r = await requireBoardAccess(request, env, boardId, principal);
  if (r instanceof Response) return r;
  if (!roleAtLeast(r.role, 'member')) {
    return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
  }
  if (!(await tryConsumeAiSlot(env, r.userId))) {
    return jsonResponse(request, { error: 'Daily AI limit reached' }, { status: 429 });
  }
  let body: { listIds?: string[]; maxCards?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const maxCards = Math.min(50, Math.max(5, typeof body.maxCards === 'number' ? body.maxCards : 30));
  const cards = await loadBoardCards(env, boardId, body.listIds, maxCards);
  if (!cards.length) {
    return jsonResponse(request, { order: [], notes: {} });
  }
  const compact = cards.map(compactCardLine);
  const system =
    'You prioritize tasks for one person. Reply with ONLY compact JSON: {"order":["cardId",...],"notes":{"cardId":"one short reason"}}. ' +
    'Put most urgent first using due dates and titles. Same number of ids as input; every input id appears exactly once in order.';
  const user = JSON.stringify({ cards: compact });
  try {
    const out = (await runLlmJson(env, system, user, 512)) as {
      order?: string[];
      notes?: Record<string, string>;
    };
    const order = Array.isArray(out.order) ? out.order.filter((id) => typeof id === 'string') : [];
    const notes =
      out.notes && typeof out.notes === 'object'
        ? Object.fromEntries(
            Object.entries(out.notes).filter(([k, v]) => typeof k === 'string' && typeof v === 'string')
          )
        : {};
    return jsonResponse(request, { order, notes });
  } catch (e) {
    return jsonResponse(
      request,
      { error: e instanceof Error ? e.message : 'AI failed' },
      { status: 502 }
    );
  }
}

export async function handleBoardAiNextTask(
  request: Request,
  env: Env,
  boardId: string,
  principal: AuthPrincipal | null
): Promise<Response | null> {
  if (request.method !== 'POST') return null;
  const r = await requireBoardAccess(request, env, boardId, principal);
  if (r instanceof Response) return r;
  if (!roleAtLeast(r.role, 'member')) {
    return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
  }
  if (!(await tryConsumeAiSlot(env, r.userId))) {
    return jsonResponse(request, { error: 'Daily AI limit reached' }, { status: 429 });
  }
  let body: { listIds?: string[]; maxCards?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const maxCards = Math.min(50, Math.max(5, typeof body.maxCards === 'number' ? body.maxCards : 35));
  const cards = await loadBoardCards(env, boardId, body.listIds, maxCards);
  if (!cards.length) {
    return jsonResponse(request, { cardId: null, reason: 'No tasks on this board.' });
  }
  const compact = cards.map(compactCardLine);
  const system =
    'Pick ONE task id the user should do next. Reply ONLY JSON: {"cardId":"…"|null,"reason":"short string","subtasks":["..."]}. ' +
    'Prefer nearest due dates and small urgent-looking titles. If there is enough information, include 3-6 concrete subtasks.';
  const user = JSON.stringify({ cards: compact, viewerUserId: r.userId });
  try {
    const out = (await runLlmJson(env, system, user, 420)) as {
      cardId?: string | null;
      reason?: string;
      subtasks?: string[];
    };
    const cardId = typeof out.cardId === 'string' ? out.cardId : null;
    const reason = typeof out.reason === 'string' ? out.reason.slice(0, 280) : '';
    const subtasks = Array.isArray(out.subtasks)
      ? out.subtasks
          .filter((s) => typeof s === 'string')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];
    return jsonResponse(request, { cardId, reason, subtasks });
  } catch (e) {
    return jsonResponse(
      request,
      { error: e instanceof Error ? e.message : 'AI failed' },
      { status: 502 }
    );
  }
}

export async function handleBoardAiListInsights(
  request: Request,
  env: Env,
  boardId: string,
  principal: AuthPrincipal | null
): Promise<Response | null> {
  if (request.method !== 'POST') return null;
  const r = await requireBoardAccess(request, env, boardId, principal);
  if (r instanceof Response) return r;
  if (!roleAtLeast(r.role, 'member')) {
    return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
  }
  if (!(await tryConsumeAiSlot(env, r.userId))) {
    return jsonResponse(request, { error: 'Daily AI limit reached' }, { status: 429 });
  }
  let body: { listIds?: string[]; maxCards?: number } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const maxCards = Math.min(80, Math.max(8, typeof body.maxCards === 'number' ? body.maxCards : 40));
  const cards = await loadBoardCards(env, boardId, body.listIds, maxCards);
  if (!cards.length) {
    return jsonResponse(request, {
      summary: 'No cards to analyze yet.',
      wins: [],
      risks: [],
      suggestions: [],
    });
  }
  const compact = cards.map(compactCardLine);
  const system =
    'You analyze board list health for one person. Reply ONLY JSON: ' +
    '{"summary":"short","wins":["..."],"risks":["..."],"suggestions":["..."]}. ' +
    'Use 2-4 concise bullets per array. Keep each bullet under 110 chars and highly actionable.';
  const user = JSON.stringify({ cards: compact, viewerUserId: r.userId });
  try {
    const out = (await runLlmJson(env, system, user, 600)) as {
      summary?: string;
      wins?: string[];
      risks?: string[];
      suggestions?: string[];
    };
    const clean = (x: unknown) =>
      Array.isArray(x)
        ? x
            .filter((v) => typeof v === 'string')
            .map((v) => v.trim().slice(0, 120))
            .filter(Boolean)
            .slice(0, 6)
        : [];
    const summary = typeof out.summary === 'string' ? out.summary.trim().slice(0, 220) : '';
    return jsonResponse(request, {
      summary: summary || 'AI analyzed your current list state.',
      wins: clean(out.wins),
      risks: clean(out.risks),
      suggestions: clean(out.suggestions),
    });
  } catch (e) {
    return jsonResponse(
      request,
      { error: e instanceof Error ? e.message : 'AI failed' },
      { status: 502 }
    );
  }
}

export async function handleCardAiSubtasks(
  request: Request,
  env: Env,
  cardId: string,
  principal: AuthPrincipal | null
): Promise<Response | null> {
  if (request.method !== 'POST') return null;
  const card = await env.DB.prepare(
    `SELECT c.*, l.board_id FROM cards c JOIN lists l ON l.id = c.list_id WHERE c.id = ?`
  )
    .bind(cardId)
    .first<{ title: string; description: string | null; payload_json: string; board_id: string }>();
  if (!card) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
  const r = await requireBoardAccess(request, env, card.board_id, principal);
  if (r instanceof Response) return r;
  if (!roleAtLeast(r.role, 'member')) {
    return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
  }
  if (!(await tryConsumeAiSlot(env, r.userId))) {
    return jsonResponse(request, { error: 'Daily AI limit reached' }, { status: 429 });
  }
  const desc = (card.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 800);
  const system =
    'Suggest concise checklist subtasks. Reply ONLY JSON: {"subtasks":["…","…"]} with 3–8 short strings, actionable, no numbering prefix.';
  const user = JSON.stringify({ title: card.title.slice(0, 200), description: desc || undefined });
  try {
    const out = (await runLlmJson(env, system, user, 400)) as { subtasks?: string[] };
    const subtasks = Array.isArray(out.subtasks)
      ? out.subtasks.filter((s) => typeof s === 'string').map((s) => s.trim().slice(0, 200))
      : [];
    return jsonResponse(request, { subtasks });
  } catch (e) {
    return jsonResponse(
      request,
      { error: e instanceof Error ? e.message : 'AI failed' },
      { status: 502 }
    );
  }
}
