import type { Env } from './bindings';
import { jsonResponse } from './http';
import { getCurrentUserFromSession } from './auth';
import { getBoardMembership } from './boardAccess';
import { broadcastBoardEvent } from './boardSync';

type BoardRow = {
  id: string;
  owner_user_id: number;
  name: string;
  color: string | null;
  settings_json: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function requireBoardAccess(
  request: Request,
  env: Env,
  boardId: string
): Promise<{ userId: number; role: string } | Response> {
  const user = await getCurrentUserFromSession(request, env);
  if (!user) {
    return jsonResponse(request, { error: 'Unauthorized' }, { status: 401 });
  }
  const userId = Number(user.id);
  const m = await getBoardMembership(env, boardId, userId);
  if (!m) {
    return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
  }
  return { userId, role: m.role };
}

function roleAtLeast(role: string, min: 'member' | 'admin' | 'owner'): boolean {
  const order = { member: 0, admin: 1, owner: 2 };
  return order[role as keyof typeof order] >= order[min];
}

function cardRowToApi(row: {
  id: string;
  list_id: string;
  position: number;
  title: string;
  subtitle: string | null;
  description: string | null;
  label_color: string | null;
  start_date: string | null;
  due_date: string | null;
  created_at_iso: string | null;
  work_timer_accum_ms: number | null;
  work_timer_run_started_at_ms: number | null;
  payload_json: string;
  created_at: string;
  updated_at: string;
}) {
  const payload = parseJson<Record<string, unknown>>(row.payload_json, {});
  return {
    id: row.id,
    listId: row.list_id,
    position: row.position,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    description: row.description ?? undefined,
    labelColor: row.label_color ?? undefined,
    startDate: row.start_date ?? undefined,
    dueDate: row.due_date ?? undefined,
    createdAtIso: row.created_at_iso ?? row.created_at,
    workTimerAccumMs: row.work_timer_accum_ms ?? undefined,
    workTimerRunStartedAtMs: row.work_timer_run_started_at_ms ?? undefined,
    ...payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function appendAudit(
  env: Env,
  boardId: string,
  kind: string,
  summary: string,
  actorUserId: number | null,
  metadata?: unknown
) {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO board_audit_log (id, board_id, at_iso, kind, summary, actor_user_id, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      boardId,
      nowIso(),
      kind,
      summary,
      actorUserId,
      metadata != null ? JSON.stringify(metadata) : null
    )
    .run();
}

export async function handleBoards(request: Request, env: Env, pathname: string): Promise<Response | null> {
  if (
    !pathname.startsWith('/boards') &&
    !pathname.startsWith('/lists') &&
    !pathname.startsWith('/cards')
  ) {
    return null;
  }

  const method = request.method;
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 1 && segments[0] === 'boards' && method === 'GET') {
    const user = await getCurrentUserFromSession(request, env);
    if (!user) return jsonResponse(request, { error: 'Unauthorized' }, { status: 401 });
    const uid = Number(user.id);
    const { results } = await env.DB.prepare(
      `SELECT b.id, b.owner_user_id, b.name, b.color, b.settings_json, b.sort_order, b.archived_at, b.created_at, b.updated_at
       FROM boards b
       INNER JOIN board_members m ON m.board_id = b.id AND m.user_id = ?
       WHERE b.archived_at IS NULL
       ORDER BY b.sort_order ASC, b.updated_at DESC`
    )
      .bind(uid)
      .all<BoardRow>();
    return jsonResponse(request, { boards: results ?? [] });
  }

  if (segments.length === 1 && segments[0] === 'boards' && method === 'POST') {
    const user = await getCurrentUserFromSession(request, env);
    if (!user) return jsonResponse(request, { error: 'Unauthorized' }, { status: 401 });
    let body: { name?: string; color?: string; settings_json?: string | Record<string, unknown> } = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return jsonResponse(request, { error: 'name is required' }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const t = nowIso();
    const settings =
      typeof body.settings_json === 'object' && body.settings_json != null
        ? JSON.stringify(body.settings_json)
        : typeof body.settings_json === 'string'
          ? body.settings_json
          : null;
    const uid = Number(user.id);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO boards (id, owner_user_id, name, color, settings_json, sort_order, archived_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)`
      ).bind(id, uid, name, body.color ?? null, settings, t, t),
      env.DB.prepare(
        `INSERT INTO board_members (board_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)`
      ).bind(id, uid, t),
    ]);
    await appendAudit(env, id, 'board_created', `Board “${name}” created`, uid, { boardId: id });
    await broadcastBoardEvent(env, id, { type: 'board_created', boardId: id });
    const row = await env.DB.prepare('SELECT * FROM boards WHERE id = ?').bind(id).first<BoardRow>();
    return jsonResponse(request, { board: row }, { status: 201 });
  }

  if (segments[0] === 'boards') {
    const boardId = segments[1];
    if (!boardId) {
      return null;
    }

  if (segments.length === 2 && method === 'GET') {
    const r = await requireBoardAccess(request, env, boardId);
    if (r instanceof Response) return r;
    const row = await env.DB.prepare('SELECT * FROM boards WHERE id = ?').bind(boardId).first<BoardRow>();
    if (!row) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    return jsonResponse(request, { board: row });
  }

  if (segments.length === 2 && method === 'PATCH') {
    const r = await requireBoardAccess(request, env, boardId);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'admin')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }
    const updates: string[] = [];
    const vals: unknown[] = [];
    if (typeof body.name === 'string') {
      updates.push('name = ?');
      vals.push(body.name.trim());
    }
    if (body.color !== undefined) {
      updates.push('color = ?');
      vals.push(body.color as string | null);
    }
    if (body.settings_json !== undefined) {
      updates.push('settings_json = ?');
      vals.push(
        typeof body.settings_json === 'object'
          ? JSON.stringify(body.settings_json)
          : String(body.settings_json)
      );
    }
    if (typeof body.sort_order === 'number') {
      updates.push('sort_order = ?');
      vals.push(body.sort_order);
    }
    if (body.archived_at !== undefined) {
      updates.push('archived_at = ?');
      vals.push(body.archived_at);
    }
    if (updates.length === 0) {
      return jsonResponse(request, { error: 'No updates' }, { status: 400 });
    }
    updates.push('updated_at = ?');
    vals.push(nowIso());
    vals.push(boardId);
    await env.DB.prepare(`UPDATE boards SET ${updates.join(', ')} WHERE id = ?`).bind(...vals).run();
    await broadcastBoardEvent(env, boardId, { type: 'board_updated', boardId });
    const row = await env.DB.prepare('SELECT * FROM boards WHERE id = ?').bind(boardId).first<BoardRow>();
    return jsonResponse(request, { board: row });
  }

  if (segments.length === 2 && method === 'DELETE') {
    const r = await requireBoardAccess(request, env, boardId);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'owner')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    await env.DB.prepare('DELETE FROM boards WHERE id = ?').bind(boardId).run();
    await broadcastBoardEvent(env, boardId, { type: 'board_deleted', boardId });
    return jsonResponse(request, { ok: true });
  }

  if (segments.length === 3 && segments[2] === 'full' && method === 'GET') {
    const r = await requireBoardAccess(request, env, boardId);
    if (r instanceof Response) return r;
    const board = await env.DB.prepare('SELECT * FROM boards WHERE id = ?').bind(boardId).first<BoardRow>();
    if (!board) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    const { results: lists } = await env.DB.prepare(
      'SELECT * FROM lists WHERE board_id = ? AND archived_at IS NULL ORDER BY position ASC, created_at ASC'
    )
      .bind(boardId)
      .all<{
        id: string;
        board_id: string;
        title: string;
        position: number;
        archived_at: string | null;
        created_at: string;
        updated_at: string;
      }>();
    const listIds = (lists ?? []).map((l) => l.id);
    const cardsByList = new Map<string, ReturnType<typeof cardRowToApi>[]>();
    for (const lid of listIds) {
      const { results: cards } = await env.DB.prepare(
        'SELECT * FROM cards WHERE list_id = ? ORDER BY position ASC, created_at ASC'
      )
        .bind(lid)
        .all<Parameters<typeof cardRowToApi>[0]>();
      cardsByList.set(
        lid,
        (cards ?? []).map((c) => cardRowToApi(c))
      );
    }
    const columns = (lists ?? []).map((l) => ({
      id: l.id,
      title: l.title,
      position: l.position,
      cards: cardsByList.get(l.id) ?? [],
    }));
    return jsonResponse(request, { board, columns });
  }

  if (segments.length === 3 && segments[2] === 'lists' && method === 'GET') {
    const r = await requireBoardAccess(request, env, boardId);
    if (r instanceof Response) return r;
    const { results } = await env.DB.prepare(
      'SELECT * FROM lists WHERE board_id = ? AND archived_at IS NULL ORDER BY position ASC'
    )
      .bind(boardId)
      .all();
    return jsonResponse(request, { lists: results ?? [] });
  }

  if (segments.length === 3 && segments[2] === 'lists' && method === 'POST') {
    const r = await requireBoardAccess(request, env, boardId);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: { title?: string; position?: number } = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return jsonResponse(request, { error: 'title is required' }, { status: 400 });
    let position = body.position;
    if (position == null) {
      const row = await env.DB.prepare(
        'SELECT MAX(position) as m FROM lists WHERE board_id = ? AND archived_at IS NULL'
      )
        .bind(boardId)
        .first<{ m: number | null }>();
      position = (row?.m ?? 0) + 1;
    }
    const id = crypto.randomUUID();
    const t = nowIso();
    await env.DB.prepare(
      `INSERT INTO lists (id, board_id, title, position, archived_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, NULL, ?, ?)`
    )
      .bind(id, boardId, title, position, t, t)
      .run();
    await appendAudit(env, boardId, 'list_added', `List “${title}” added`, r.userId, { listId: id });
    await broadcastBoardEvent(env, boardId, { type: 'list_created', boardId, listId: id });
    const list = await env.DB.prepare('SELECT * FROM lists WHERE id = ?').bind(id).first();
    return jsonResponse(request, { list }, { status: 201 });
  }

  if (segments.length === 4 && segments[2] === 'lists' && segments[3] === 'reorder' && method === 'POST') {
    const r = await requireBoardAccess(request, env, boardId);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: { orderedIds?: string[] } = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }
    const ids = body.orderedIds;
    if (!Array.isArray(ids)) {
      return jsonResponse(request, { error: 'orderedIds array required' }, { status: 400 });
    }
    const stmts: D1PreparedStatement[] = [];
    ids.forEach((listId, i) => {
      stmts.push(
        env.DB.prepare(
          'UPDATE lists SET position = ?, updated_at = ? WHERE id = ? AND board_id = ?'
        ).bind(i, nowIso(), listId, boardId)
      );
    });
    await env.DB.batch(stmts);
    await broadcastBoardEvent(env, boardId, { type: 'lists_reordered', boardId, orderedIds: ids });
    return jsonResponse(request, { ok: true });
  }

  if (segments.length === 3 && segments[2] === 'archive' && method === 'GET') {
    const r = await requireBoardAccess(request, env, boardId);
    if (r instanceof Response) return r;
    const { results: cards } = await env.DB.prepare(
      'SELECT * FROM archived_cards WHERE board_id = ? ORDER BY archived_at DESC'
    )
      .bind(boardId)
      .all();
    const { results: lists } = await env.DB.prepare(
      'SELECT * FROM archived_lists WHERE board_id = ? ORDER BY archived_at DESC'
    )
      .bind(boardId)
      .all();
    return jsonResponse(request, { archivedCards: cards ?? [], archivedLists: lists ?? [] });
  }

  if (segments.length === 4 && segments[2] === 'archive' && segments[3] === 'cards' && method === 'POST') {
    const r = await requireBoardAccess(request, env, boardId);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: { cardId?: string; sourceListTitle?: string } = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }
    const cardId = body.cardId;
    if (!cardId) return jsonResponse(request, { error: 'cardId required' }, { status: 400 });
    const card = await env.DB.prepare(
      `SELECT c.*, l.title as list_title, l.board_id
       FROM cards c JOIN lists l ON l.id = c.list_id WHERE c.id = ?`
    )
      .bind(cardId)
      .first<Record<string, unknown>>();
    if (!card || String(card.board_id) !== boardId) {
      return jsonResponse(request, { error: 'Card not found' }, { status: 404 });
    }
    const api = cardRowToApi(card as Parameters<typeof cardRowToApi>[0]);
    const archiveId = crypto.randomUUID();
    const sourceTitle =
      typeof body.sourceListTitle === 'string' ? body.sourceListTitle : String(card.list_title ?? '');
    await env.DB.prepare(
      `INSERT INTO archived_cards (id, board_id, archived_at, archived_by_user_id, source_list_title, card_snapshot_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(archiveId, boardId, nowIso(), r.userId, sourceTitle, JSON.stringify(api))
      .run();
    await env.DB.prepare('DELETE FROM cards WHERE id = ?').bind(cardId).run();
    await appendAudit(env, boardId, 'card_archived', `Card archived`, r.userId, { cardId, archiveId });
    await broadcastBoardEvent(env, boardId, { type: 'card_archived', boardId, cardId, archiveId });
    return jsonResponse(request, { archiveId }, { status: 201 });
  }

  if (segments.length === 4 && segments[2] === 'archive' && segments[3] === 'lists' && method === 'POST') {
    const r = await requireBoardAccess(request, env, boardId);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: { listId?: string } = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }
    const listId = body.listId;
    if (!listId) return jsonResponse(request, { error: 'listId required' }, { status: 400 });
    const list = await env.DB.prepare('SELECT * FROM lists WHERE id = ? AND board_id = ?').bind(listId, boardId).first<{
      id: string;
      title: string;
    }>();
    if (!list) return jsonResponse(request, { error: 'List not found' }, { status: 404 });
    const { results: cardRows } = await env.DB.prepare('SELECT * FROM cards WHERE list_id = ? ORDER BY position ASC')
      .bind(listId)
      .all<Parameters<typeof cardRowToApi>[0]>();
    const columnSnapshot = {
      id: list.id,
      title: list.title,
      cards: (cardRows ?? []).map((c) => cardRowToApi(c)),
    };
    const archiveId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO archived_lists (id, board_id, archived_at, archived_by_user_id, column_snapshot_json)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(archiveId, boardId, nowIso(), r.userId, JSON.stringify(columnSnapshot))
      .run();
    await env.DB.prepare('DELETE FROM cards WHERE list_id = ?').bind(listId).run();
    await env.DB.prepare('DELETE FROM lists WHERE id = ?').bind(listId).run();
    await appendAudit(env, boardId, 'list_archived', `List “${list.title}” archived`, r.userId, {
      listId,
      archiveId,
    });
    await broadcastBoardEvent(env, boardId, { type: 'list_archived', boardId, listId, archiveId });
    return jsonResponse(request, { archiveId }, { status: 201 });
  }

  if (segments.length === 3 && segments[2] === 'restore' && method === 'POST') {
    const r = await requireBoardAccess(request, env, boardId);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: { type?: string; archiveId?: string; targetListId?: string } = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }
    if (body.type === 'card' && body.archiveId) {
      const ar = await env.DB.prepare('SELECT * FROM archived_cards WHERE id = ? AND board_id = ?')
        .bind(body.archiveId, boardId)
        .first<{ card_snapshot_json: string }>();
      if (!ar) return jsonResponse(request, { error: 'Archive not found' }, { status: 404 });
      const snap = parseJson<Record<string, unknown>>(ar.card_snapshot_json, {});
      const targetListId =
        typeof body.targetListId === 'string'
          ? body.targetListId
          : typeof snap.listId === 'string'
            ? snap.listId
            : null;
      if (!targetListId) {
        return jsonResponse(request, { error: 'targetListId required' }, { status: 400 });
      }
      const list = await env.DB.prepare('SELECT id FROM lists WHERE id = ? AND board_id = ?')
        .bind(targetListId, boardId)
        .first();
      if (!list) return jsonResponse(request, { error: 'Target list not found' }, { status: 404 });
      const cardId = typeof snap.id === 'string' ? snap.id : crypto.randomUUID();
      const row = await env.DB.prepare(
        'SELECT MAX(position) as m FROM cards WHERE list_id = ?'
      )
        .bind(targetListId)
        .first<{ m: number | null }>();
      const position = (row?.m ?? 0) + 1;
      const t = nowIso();
      const payload = { ...snap };
      delete payload.id;
      delete payload.listId;
      delete payload.position;
      delete payload.title;
      delete payload.createdAt;
      delete payload.updatedAt;
      const title = typeof snap.title === 'string' ? snap.title : 'Card';
      await env.DB.prepare(
        `INSERT INTO cards (id, list_id, position, title, subtitle, description, label_color, start_date, due_date,
          created_at_iso, work_timer_accum_ms, work_timer_run_started_at_ms, payload_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          cardId,
          targetListId,
          position,
          title,
          (snap.subtitle as string) ?? null,
          (snap.description as string) ?? null,
          (snap.labelColor as string) ?? null,
          (snap.startDate as string) ?? null,
          (snap.dueDate as string) ?? null,
          (snap.createdAtIso as string) ?? t,
          typeof snap.workTimerAccumMs === 'number' ? snap.workTimerAccumMs : null,
          typeof snap.workTimerRunStartedAtMs === 'number' ? snap.workTimerRunStartedAtMs : null,
          JSON.stringify(payload),
          t,
          t
        )
        .run();
      await env.DB.prepare('DELETE FROM archived_cards WHERE id = ?').bind(body.archiveId).run();
      await appendAudit(env, boardId, 'card_restored', `Card restored`, r.userId, { cardId });
      await broadcastBoardEvent(env, boardId, { type: 'card_restored', boardId, cardId, listId: targetListId });
      return jsonResponse(request, { cardId });
    }
    if (body.type === 'list' && body.archiveId) {
      const ar = await env.DB.prepare('SELECT * FROM archived_lists WHERE id = ? AND board_id = ?')
        .bind(body.archiveId, boardId)
        .first<{ column_snapshot_json: string }>();
      if (!ar) return jsonResponse(request, { error: 'Archive not found' }, { status: 404 });
      const col = parseJson<{ id?: string; title?: string; cards?: Record<string, unknown>[] }>(
        ar.column_snapshot_json,
        {}
      );
      const listId = typeof col.id === 'string' ? col.id : crypto.randomUUID();
      const listTitle = typeof col.title === 'string' ? col.title : 'List';
      const t = nowIso();
      const posRow = await env.DB.prepare(
        'SELECT MAX(position) as m FROM lists WHERE board_id = ? AND archived_at IS NULL'
      )
        .bind(boardId)
        .first<{ m: number | null }>();
      const listPosition = (posRow?.m ?? 0) + 1;
      await env.DB.prepare(
        `INSERT INTO lists (id, board_id, title, position, archived_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`
      )
        .bind(listId, boardId, listTitle, listPosition, t, t)
        .run();
      const cards = Array.isArray(col.cards) ? col.cards : [];
      let p = 0;
      for (const c of cards) {
        const cardId = typeof c.id === 'string' ? c.id : crypto.randomUUID();
        const title = typeof c.title === 'string' ? c.title : 'Card';
        const snap = { ...c };
        delete snap.id;
        delete snap.listId;
        await env.DB.prepare(
          `INSERT INTO cards (id, list_id, position, title, subtitle, description, label_color, start_date, due_date,
            created_at_iso, work_timer_accum_ms, work_timer_run_started_at_ms, payload_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            cardId,
            listId,
            p++,
            title,
            (c.subtitle as string) ?? null,
            (c.description as string) ?? null,
            (c.labelColor as string) ?? null,
            (c.startDate as string) ?? null,
            (c.dueDate as string) ?? null,
            (c.createdAtIso as string) ?? t,
            typeof c.workTimerAccumMs === 'number' ? c.workTimerAccumMs : null,
            typeof c.workTimerRunStartedAtMs === 'number' ? c.workTimerRunStartedAtMs : null,
            JSON.stringify(snap),
            t,
            t
          )
          .run();
      }
      await env.DB.prepare('DELETE FROM archived_lists WHERE id = ?').bind(body.archiveId).run();
      await appendAudit(env, boardId, 'list_restored', `List “${listTitle}” restored`, r.userId, { listId });
      await broadcastBoardEvent(env, boardId, { type: 'list_restored', boardId, listId });
      return jsonResponse(request, { listId });
    }
    return jsonResponse(request, { error: 'Invalid restore body' }, { status: 400 });
  }

  if (segments.length === 3 && segments[2] === 'audit' && method === 'GET') {
    const r = await requireBoardAccess(request, env, boardId);
    if (r instanceof Response) return r;
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10));
    const { results } = await env.DB.prepare(
      'SELECT * FROM board_audit_log WHERE board_id = ? ORDER BY at_iso DESC LIMIT ? OFFSET ?'
    )
      .bind(boardId, limit, offset)
      .all();
    return jsonResponse(request, { entries: results ?? [] });
  }

  if (segments.length === 4 && segments[2] === 'dashboard' && segments[3] === 'tiles' && method === 'GET') {
    const r = await requireBoardAccess(request, env, boardId);
    if (r instanceof Response) return r;
    const { results } = await env.DB.prepare(
      'SELECT * FROM board_dashboard_tiles WHERE board_id = ? ORDER BY position ASC'
    )
      .bind(boardId)
      .all();
    return jsonResponse(request, { tiles: results ?? [] });
  }

  if (segments.length === 4 && segments[2] === 'dashboard' && segments[3] === 'tiles' && method === 'PUT') {
    const r = await requireBoardAccess(request, env, boardId);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: { tiles?: { kind: string; dimension: string; lineTimeframe?: string }[] } = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }
    const tiles = body.tiles;
    if (!Array.isArray(tiles)) {
      return jsonResponse(request, { error: 'tiles array required' }, { status: 400 });
    }
    await env.DB.prepare('DELETE FROM board_dashboard_tiles WHERE board_id = ?').bind(boardId).run();
    const stmts: D1PreparedStatement[] = [];
    tiles.forEach((tile, i) => {
      const id = crypto.randomUUID();
      const lf = tile.lineTimeframe ?? '';
      stmts.push(
        env.DB.prepare(
          `INSERT INTO board_dashboard_tiles (id, board_id, kind, dimension, line_timeframe, position)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(id, boardId, tile.kind, tile.dimension, lf, i)
      );
    });
    if (stmts.length) await env.DB.batch(stmts);
    await broadcastBoardEvent(env, boardId, { type: 'dashboard_updated', boardId });
    return jsonResponse(request, { ok: true });
  }

  if (segments.length === 3 && segments[2] === 'notification-settings' && method === 'GET') {
    const r = await requireBoardAccess(request, env, boardId);
    if (r instanceof Response) return r;
    const row = await env.DB.prepare(
      'SELECT prefs_json FROM board_notification_settings WHERE board_id = ? AND user_id = ?'
    )
      .bind(boardId, r.userId)
      .first<{ prefs_json: string }>();
    return jsonResponse(request, { prefs: row ? parseJson(row.prefs_json, {}) : null });
  }

  if (segments.length === 3 && segments[2] === 'notification-settings' && method === 'PATCH') {
    const r = await requireBoardAccess(request, env, boardId);
    if (r instanceof Response) return r;
    let patch: Record<string, unknown> = {};
    try {
      patch = await request.json();
    } catch {
      /* empty */
    }
    const existing = await env.DB.prepare(
      'SELECT prefs_json FROM board_notification_settings WHERE board_id = ? AND user_id = ?'
    )
      .bind(boardId, r.userId)
      .first<{ prefs_json: string }>();
    const merged = { ...(existing ? parseJson<Record<string, unknown>>(existing.prefs_json, {}) : {}), ...patch };
    const t = nowIso();
    await env.DB.prepare(
      `INSERT INTO board_notification_settings (board_id, user_id, prefs_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (board_id, user_id) DO UPDATE SET prefs_json = excluded.prefs_json, updated_at = excluded.updated_at`
    )
      .bind(boardId, r.userId, JSON.stringify(merged), t)
      .run();
    await broadcastBoardEvent(env, boardId, {
      type: 'notification_settings_updated',
      boardId,
      userId: r.userId,
    });
    return jsonResponse(request, { prefs: merged });
  }

  }

  if (segments.length === 2 && segments[0] === 'lists' && method === 'PATCH') {
    const listId = segments[1];
    const list = await env.DB.prepare('SELECT board_id FROM lists WHERE id = ?').bind(listId).first<{ board_id: string }>();
    if (!list) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    const r = await requireBoardAccess(request, env, list.board_id);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: { title?: string; position?: number } = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }
    const updates: string[] = [];
    const vals: unknown[] = [];
    if (typeof body.title === 'string') {
      updates.push('title = ?');
      vals.push(body.title.trim());
    }
    if (typeof body.position === 'number') {
      updates.push('position = ?');
      vals.push(body.position);
    }
    if (!updates.length) return jsonResponse(request, { error: 'No updates' }, { status: 400 });
    updates.push('updated_at = ?');
    vals.push(nowIso());
    vals.push(listId);
    await env.DB.prepare(`UPDATE lists SET ${updates.join(', ')} WHERE id = ?`).bind(...vals).run();
    await broadcastBoardEvent(env, list.board_id, { type: 'list_updated', boardId: list.board_id, listId });
    const row = await env.DB.prepare('SELECT * FROM lists WHERE id = ?').bind(listId).first();
    return jsonResponse(request, { list: row });
  }

  if (segments.length === 2 && segments[0] === 'lists' && method === 'DELETE') {
    const listId = segments[1];
    const list = await env.DB.prepare('SELECT board_id, title FROM lists WHERE id = ?').bind(listId).first<{
      board_id: string;
      title: string;
    }>();
    if (!list) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    const r = await requireBoardAccess(request, env, list.board_id);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'admin')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    await env.DB.prepare('DELETE FROM cards WHERE list_id = ?').bind(listId).run();
    await env.DB.prepare('DELETE FROM lists WHERE id = ?').bind(listId).run();
    await appendAudit(env, list.board_id, 'list_archived', `List “${list.title}” deleted`, r.userId, { listId });
    await broadcastBoardEvent(env, list.board_id, { type: 'list_deleted', boardId: list.board_id, listId });
    return jsonResponse(request, { ok: true });
  }

  if (segments.length === 3 && segments[0] === 'lists' && segments[2] === 'cards' && method === 'GET') {
    const listId = segments[1];
    const list = await env.DB.prepare('SELECT board_id FROM lists WHERE id = ?').bind(listId).first<{ board_id: string }>();
    if (!list) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    const r = await requireBoardAccess(request, env, list.board_id);
    if (r instanceof Response) return r;
    const { results } = await env.DB.prepare(
      'SELECT * FROM cards WHERE list_id = ? ORDER BY position ASC'
    )
      .bind(listId)
      .all<Parameters<typeof cardRowToApi>[0]>();
    return jsonResponse(request, { cards: (results ?? []).map((c) => cardRowToApi(c)) });
  }

  if (segments.length === 3 && segments[0] === 'lists' && segments[2] === 'cards' && method === 'POST') {
    const listId = segments[1];
    const list = await env.DB.prepare('SELECT board_id FROM lists WHERE id = ?').bind(listId).first<{ board_id: string }>();
    if (!list) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    const r = await requireBoardAccess(request, env, list.board_id);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return jsonResponse(request, { error: 'title is required' }, { status: 400 });
    let position = body.position as number | undefined;
    if (position == null) {
      const row = await env.DB.prepare('SELECT MAX(position) as m FROM cards WHERE list_id = ?')
        .bind(listId)
        .first<{ m: number | null }>();
      position = (row?.m ?? 0) + 1;
    }
    const id = crypto.randomUUID();
    const t = nowIso();
    const payload = { ...body };
    delete payload.title;
    delete payload.position;
    await env.DB.prepare(
      `INSERT INTO cards (id, list_id, position, title, subtitle, description, label_color, start_date, due_date,
        created_at_iso, work_timer_accum_ms, work_timer_run_started_at_ms, payload_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        listId,
        position,
        title,
        (body.subtitle as string) ?? null,
        (body.description as string) ?? null,
        (body.labelColor as string) ?? null,
        (body.startDate as string) ?? null,
        (body.dueDate as string) ?? null,
        (body.createdAtIso as string) ?? t,
        typeof body.workTimerAccumMs === 'number' ? body.workTimerAccumMs : null,
        typeof body.workTimerRunStartedAtMs === 'number' ? body.workTimerRunStartedAtMs : null,
        JSON.stringify(payload),
        t,
        t
      )
      .run();
    await appendAudit(env, list.board_id, 'card_added', `Card “${title}” added`, r.userId, { cardId: id, listId });
    await broadcastBoardEvent(env, list.board_id, { type: 'card_created', boardId: list.board_id, listId, cardId: id });
    const card = await env.DB.prepare('SELECT * FROM cards WHERE id = ?').bind(id).first<Parameters<typeof cardRowToApi>[0]>();
    return jsonResponse(request, { card: card ? cardRowToApi(card) : null }, { status: 201 });
  }

  if (segments.length === 2 && segments[0] === 'cards' && method === 'GET') {
    const cardId = segments[1];
    const card = await env.DB.prepare(
      `SELECT c.*, l.board_id FROM cards c JOIN lists l ON l.id = c.list_id WHERE c.id = ?`
    )
      .bind(cardId)
      .first<Parameters<typeof cardRowToApi>[0] & { board_id: string }>();
    if (!card) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    const r = await requireBoardAccess(request, env, card.board_id);
    if (r instanceof Response) return r;
    const { board_id: _b, ...c } = card;
    return jsonResponse(request, { card: cardRowToApi(c) });
  }

  if (segments.length === 2 && segments[0] === 'cards' && method === 'PATCH') {
    const cardId = segments[1];
    const card = await env.DB.prepare(
      `SELECT c.*, l.board_id FROM cards c JOIN lists l ON l.id = c.list_id WHERE c.id = ?`
    )
      .bind(cardId)
      .first<Parameters<typeof cardRowToApi>[0] & { board_id: string }>();
    if (!card) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    const r = await requireBoardAccess(request, env, card.board_id);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }
    const curPayload = parseJson<Record<string, unknown>>(card.payload_json, {});
    const nextPayload = { ...curPayload, ...body };
    delete nextPayload.title;
    delete nextPayload.subtitle;
    delete nextPayload.description;
    delete nextPayload.labelColor;
    delete nextPayload.startDate;
    delete nextPayload.dueDate;
    delete nextPayload.position;
    delete nextPayload.listId;
    const title = typeof body.title === 'string' ? body.title : card.title;
    const subtitle = body.subtitle !== undefined ? (body.subtitle as string | null) : card.subtitle;
    const description = body.description !== undefined ? (body.description as string | null) : card.description;
    const label_color = body.labelColor !== undefined ? (body.labelColor as string | null) : card.label_color;
    const start_date = body.startDate !== undefined ? (body.startDate as string | null) : card.start_date;
    const due_date = body.dueDate !== undefined ? (body.dueDate as string | null) : card.due_date;
    const position = typeof body.position === 'number' ? body.position : card.position;
    const t = nowIso();
    await env.DB.prepare(
      `UPDATE cards SET title = ?, subtitle = ?, description = ?, label_color = ?, start_date = ?, due_date = ?,
        position = ?, work_timer_accum_ms = ?, work_timer_run_started_at_ms = ?, payload_json = ?, updated_at = ?
        WHERE id = ?`
    )
      .bind(
        title,
        subtitle,
        description,
        label_color,
        start_date,
        due_date,
        position,
        typeof body.workTimerAccumMs === 'number' ? body.workTimerAccumMs : card.work_timer_accum_ms,
        typeof body.workTimerRunStartedAtMs === 'number'
          ? body.workTimerRunStartedAtMs
          : card.work_timer_run_started_at_ms,
        JSON.stringify(nextPayload),
        t,
        cardId
      )
      .run();
    await appendAudit(env, card.board_id, 'card_updated', `Card updated`, r.userId, { cardId });
    await broadcastBoardEvent(env, card.board_id, { type: 'card_updated', boardId: card.board_id, cardId });
    const updated = await env.DB.prepare('SELECT * FROM cards WHERE id = ?').bind(cardId).first<Parameters<typeof cardRowToApi>[0]>();
    return jsonResponse(request, { card: updated ? cardRowToApi(updated) : null });
  }

  if (segments.length === 2 && segments[0] === 'cards' && method === 'DELETE') {
    const cardId = segments[1];
    const card = await env.DB.prepare(
      `SELECT c.*, l.board_id FROM cards c JOIN lists l ON l.id = c.list_id WHERE c.id = ?`
    )
      .bind(cardId)
      .first<Parameters<typeof cardRowToApi>[0] & { board_id: string }>();
    if (!card) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    const r = await requireBoardAccess(request, env, card.board_id);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    await env.DB.prepare('DELETE FROM cards WHERE id = ?').bind(cardId).run();
    await appendAudit(env, card.board_id, 'card_archived', `Card removed`, r.userId, { cardId });
    await broadcastBoardEvent(env, card.board_id, { type: 'card_deleted', boardId: card.board_id, cardId });
    return jsonResponse(request, { ok: true });
  }

  if (segments.length === 3 && segments[0] === 'cards' && segments[2] === 'move' && method === 'POST') {
    const cardId = segments[1];
    const card = await env.DB.prepare(
      `SELECT c.*, l.board_id FROM cards c JOIN lists l ON l.id = c.list_id WHERE c.id = ?`
    )
      .bind(cardId)
      .first<Parameters<typeof cardRowToApi>[0] & { board_id: string }>();
    if (!card) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    const r = await requireBoardAccess(request, env, card.board_id);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: { listId?: string; position?: number } = {};
    try {
      body = await request.json();
    } catch {
      /* empty */
    }
    const newListId = body.listId;
    if (!newListId) return jsonResponse(request, { error: 'listId required' }, { status: 400 });
    const targetList = await env.DB.prepare('SELECT board_id FROM lists WHERE id = ?')
      .bind(newListId)
      .first<{ board_id: string }>();
    if (!targetList || targetList.board_id !== card.board_id) {
      return jsonResponse(request, { error: 'Invalid target list' }, { status: 400 });
    }
    let position = body.position;
    if (position == null) {
      const row = await env.DB.prepare('SELECT MAX(position) as m FROM cards WHERE list_id = ?')
        .bind(newListId)
        .first<{ m: number | null }>();
      position = (row?.m ?? 0) + 1;
    }
    await env.DB.prepare(
      'UPDATE cards SET list_id = ?, position = ?, updated_at = ? WHERE id = ?'
    )
      .bind(newListId, position, nowIso(), cardId)
      .run();
    await broadcastBoardEvent(env, card.board_id, {
      type: 'card_moved',
      boardId: card.board_id,
      cardId,
      listId: newListId,
      position,
    });
    const updated = await env.DB.prepare('SELECT * FROM cards WHERE id = ?').bind(cardId).first<Parameters<typeof cardRowToApi>[0]>();
    return jsonResponse(request, { card: updated ? cardRowToApi(updated) : null });
  }

  return null;
}
