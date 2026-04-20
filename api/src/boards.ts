import type { Env } from './bindings';
import { jsonResponse } from './http';
import { getAppUrl, getSmtp } from './auth';
import { requireBoardAccess } from './boardAccess';
import { resolveAuthPrincipal, sessionUser, principalUserId } from './authPrincipal';
import { insertBoardAuditLog } from './auditLog';
import {
  handleBoardAiPrioritize,
  handleBoardAiNextTask,
  handleBoardAiListInsights,
  handleCardAiSubtasks,
} from './aiAssist';
import { broadcastBoardEvent } from './boardSync';
import { notifyBoardDeletedExpoPush } from './boardExpoPush';
import { validateEmail } from './lib/auth/password';
import { sendEmail, boardInviteEmailHtml, emailLogoAbsoluteUrl } from './lib/email';
import {
  normalizeInviteEmail,
  sha256TokenHex,
  acceptBoardInviteForUser,
  inviteIsActionable,
  type BoardInviteRow,
} from './boardInvitations';

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

async function deleteOrphanedAttachmentObjects(
  env: Env,
  prevAttachments: unknown,
  nextAttachments: unknown
): Promise<void> {
  if (!env.IMAGES) return;
  const prev = Array.isArray(prevAttachments) ? prevAttachments : [];
  const next = Array.isArray(nextAttachments) ? nextAttachments : [];
  const nextKeys = new Set(
    next
      .filter(
        (x) => x && typeof x === 'object' && typeof (x as { storageKey?: unknown }).storageKey === 'string'
      )
      .map((x) => (x as { storageKey: string }).storageKey)
  );
  for (const item of prev) {
    if (!item || typeof item !== 'object') continue;
    const sk = (item as { storageKey?: string }).storageKey;
    if (typeof sk === 'string' && !nextKeys.has(sk)) {
      await env.IMAGES.delete(sk).catch((e: unknown) => console.error('R2 delete attachment', e));
    }
  }
}

const BOARD_SETTING_LABELS: Record<string, string> = {
  boardDisplayTitle: 'title on board',
  boardDescription: 'description',
  defaultView: 'default view',
  hapticsEnabled: 'haptics',
  confirmBeforeDestructive: 'destructive confirmations',
  weekStartsOn: 'week start',
  compactCardDensity: 'compact layout',
  showAssigneeAvatars: 'assignee avatars',
  dailyDigestReminder: 'daily digest',
  autoOpenCardDetails: 'open card details',
  focusModeByDefault: 'focus mode',
};

function summarizeBoardSettingsChange(prevJson: string | null, nextJsonStr: string): string[] {
  const prev = parseJson<Record<string, unknown>>(prevJson, {});
  let next: Record<string, unknown>;
  try {
    next = JSON.parse(nextJsonStr) as Record<string, unknown>;
  } catch {
    return ['settings'];
  }
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const out: string[] = [];
  for (const k of keys) {
    if (k === 'version') continue;
    const a = JSON.stringify(prev[k] ?? null);
    const b = JSON.stringify(next[k] ?? null);
    if (a !== b) {
      out.push(BOARD_SETTING_LABELS[k] ?? k.replace(/([A-Z])/g, ' $1').trim().toLowerCase());
    }
  }
  return out;
}

function buildBoardPatchSummary(prev: BoardRow, body: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof body.name === 'string' && body.name.trim() !== prev.name) {
    parts.push(`Renamed to “${body.name.trim()}”`);
  }
  if (body.color !== undefined && body.color !== prev.color) {
    parts.push('Accent color updated');
  }
  if (typeof body.sort_order === 'number' && body.sort_order !== prev.sort_order) {
    parts.push('Order in your board list changed');
  }
  if (body.archived_at !== undefined && body.archived_at !== prev.archived_at) {
    parts.push(body.archived_at ? 'Board archived' : 'Board unarchived');
  }
  if (body.settings_json !== undefined) {
    const nextStr =
      typeof body.settings_json === 'object'
        ? JSON.stringify(body.settings_json)
        : String(body.settings_json);
    const settingChanges = summarizeBoardSettingsChange(prev.settings_json, nextStr);
    if (settingChanges.length) {
      parts.push(`Settings: ${settingChanges.join(', ')}`);
    }
  }
  if (parts.length === 0) return 'Board updated';
  let s = parts.join(' · ');
  if (s.length > 280) s = `${s.slice(0, 277)}…`;
  return s;
}

function buildCardUpdateSummary(
  card: Parameters<typeof cardRowToApi>[0] & { title: string },
  body: Record<string, unknown>,
  title: string,
  otherPayloadChanged: boolean
): string {
  const labels: string[] = [];
  if (typeof body.title === 'string' && body.title !== card.title) labels.push('title');
  if (body.subtitle !== undefined && body.subtitle !== card.subtitle) labels.push('subtitle');
  if (body.description !== undefined && body.description !== card.description) labels.push('description');
  if (body.labelColor !== undefined && body.labelColor !== card.label_color) labels.push('label color');
  if (body.startDate !== undefined && body.startDate !== card.start_date) labels.push('start date');
  if (body.dueDate !== undefined && body.dueDate !== card.due_date) labels.push('due date');
  if (typeof body.position === 'number' && body.position !== card.position) labels.push('position');
  if (body.workTimerAccumMs !== undefined && body.workTimerAccumMs !== card.work_timer_accum_ms) {
    labels.push('time tracked');
  }
  if (
    body.workTimerRunStartedAtMs !== undefined &&
    body.workTimerRunStartedAtMs !== card.work_timer_run_started_at_ms
  ) {
    labels.push('timer');
  }
  let base: string;
  if (labels.length > 0) {
    base = `Card “${title}” — ${labels.join(', ')}`;
    if (otherPayloadChanged) base += ', and more';
  } else if (otherPayloadChanged) {
    base = `Card “${title}” — updated nested fields (checklist, links, etc.)`;
  } else {
    base = `Card “${title}” updated`;
  }
  return base.length > 280 ? `${base.slice(0, 277)}…` : base;
}

export function numericAssigneeUserIds(assignees: unknown): number[] {
  if (!Array.isArray(assignees)) return [];
  const out: number[] = [];
  for (const m of assignees) {
    if (!m || typeof m !== 'object') continue;
    const id = (m as { id?: unknown }).id;
    if (typeof id === 'string' && /^\d+$/.test(id.trim())) out.push(parseInt(id.trim(), 10));
    else if (typeof id === 'number' && Number.isFinite(id) && id > 0) out.push(Math.floor(id));
  }
  return out;
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
  const principal = await resolveAuthPrincipal(request, env);

  if (segments.length === 1 && segments[0] === 'boards' && method === 'GET') {
    if (!principal) return jsonResponse(request, { error: 'Unauthorized' }, { status: 401 });
    const uid = principalUserId(principal);
    if (principal.kind === 'api_key' && principal.scopeKind === 'boards') {
      if (principal.allowedBoardIds.size === 0) {
        return jsonResponse(request, { boards: [] });
      }
      const ids = [...principal.allowedBoardIds];
      const ph = ids.map(() => '?').join(',');
      const { results } = await env.DB.prepare(
        `SELECT b.id, b.owner_user_id, b.name, b.color, b.settings_json, b.sort_order, b.archived_at, b.created_at, b.updated_at
         FROM boards b
         INNER JOIN board_members m ON m.board_id = b.id AND m.user_id = ?
         WHERE b.archived_at IS NULL AND b.id IN (${ph})
         ORDER BY b.sort_order ASC, b.updated_at DESC`
      )
        .bind(uid, ...ids)
        .all<BoardRow>();
      return jsonResponse(request, { boards: results ?? [] });
    }
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
    if (!principal) return jsonResponse(request, { error: 'Unauthorized' }, { status: 401 });
    if (principal.kind === 'api_key' && principal.scopeKind === 'boards') {
      return jsonResponse(
        request,
        { error: 'Creating a board requires an API key scoped to all boards, not a fixed set of boards' },
        { status: 403 }
      );
    }
    const uid = principalUserId(principal);
    let body: { name?: string; color?: string; settings_json?: string | Record<string, unknown> } = {};
    try {
      body = await request.json();
    } catch {
      // ignore
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
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO boards (id, owner_user_id, name, color, settings_json, sort_order, archived_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)`
      ).bind(id, uid, name, body.color ?? null, settings, t, t),
      env.DB.prepare(
        `INSERT INTO board_members (board_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)`
      ).bind(id, uid, t),
    ]);
    await insertBoardAuditLog(env, id, 'board_created', `Board “${name}” created`, uid, { boardId: id });
    await broadcastBoardEvent(env, id, { type: 'board_created', boardId: id, actorUserId: uid });
    const row = await env.DB.prepare('SELECT * FROM boards WHERE id = ?').bind(id).first<BoardRow>();
    return jsonResponse(request, { board: row }, { status: 201 });
  }

  if (segments[0] === 'boards') {
    const boardId = segments[1];
    if (!boardId) {
      return null;
    }

  if (segments.length === 2 && method === 'GET') {
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    const row = await env.DB.prepare('SELECT * FROM boards WHERE id = ?').bind(boardId).first<BoardRow>();
    if (!row) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    return jsonResponse(request, { board: row });
  }

  if (segments.length === 2 && method === 'PATCH') {
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'admin')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    const prev = await env.DB.prepare('SELECT * FROM boards WHERE id = ?').bind(boardId).first<BoardRow>();
    if (!prev) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // ignore
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
    const auditSummary = buildBoardPatchSummary(prev, body);
    await insertBoardAuditLog(env, boardId, 'board_updated', auditSummary, r.userId, { boardId });
    await broadcastBoardEvent(env, boardId, { type: 'board_updated', boardId, actorUserId: r.userId });
    const row = await env.DB.prepare('SELECT * FROM boards WHERE id = ?').bind(boardId).first<BoardRow>();
    return jsonResponse(request, { board: row });
  }

  if (segments.length === 2 && method === 'DELETE') {
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'owner')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    await notifyBoardDeletedExpoPush(env, boardId, r.userId);
    await env.DB.prepare('DELETE FROM boards WHERE id = ?').bind(boardId).run();
    await broadcastBoardEvent(env, boardId, { type: 'board_deleted', boardId, actorUserId: r.userId });
    return jsonResponse(request, { ok: true });
  }

  if (segments.length === 3 && segments[2] === 'members' && method === 'GET') {
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    const { results } = await env.DB.prepare(
      `SELECT m.user_id AS user_id, m.role AS role, m.created_at AS joined_at,
              u.username AS username, u.email AS email
       FROM board_members m
       INNER JOIN users u ON u.id = m.user_id
       WHERE m.board_id = ?
       ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
                lower(COALESCE(NULLIF(TRIM(u.username), ''), u.email))`
    )
      .bind(boardId)
      .all<{
        user_id: number;
        role: string;
        joined_at: string;
        username: string | null;
        email: string;
      }>();
    const members = (results ?? []).map((row) => ({
      userId: row.user_id,
      role: row.role,
      username: row.username?.trim() || null,
      email: row.email,
      joinedAt: row.joined_at,
    }));
    return jsonResponse(request, { members });
  }

  const INVITE_ROLE = 'member';
  const INVITE_DAYS = 14;

  if (segments.length === 3 && segments[2] === 'invitations' && method === 'GET') {
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'admin')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    const { results } = await env.DB.prepare(
      `SELECT id, board_id, inviter_user_id, invited_email_normalized, role, created_at, expires_at, accepted_at, declined_at
       FROM board_invitations WHERE board_id = ? ORDER BY created_at DESC`
    )
      .bind(boardId)
      .all<{
        id: string;
        board_id: string;
        inviter_user_id: number;
        invited_email_normalized: string;
        role: string;
        created_at: string;
        expires_at: string;
        accepted_at: string | null;
        declined_at: string | null;
      }>();
    return jsonResponse(request, { invitations: results ?? [] });
  }

  if (segments.length === 3 && segments[2] === 'invitations' && method === 'POST') {
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'admin')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    const board = await env.DB.prepare('SELECT * FROM boards WHERE id = ?').bind(boardId).first<BoardRow>();
    if (!board || board.archived_at != null) {
      return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    }
    let body: { email?: string } = {};
    try {
      body = (await request.json()) as { email?: string };
    } catch {
      body = {};
    }
    const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
    if (!rawEmail || !validateEmail(rawEmail)) {
      return jsonResponse(request, { error: 'Valid email is required' }, { status: 400 });
    }
    const invitedNorm = normalizeInviteEmail(rawEmail);
    const inviterRow = await env.DB.prepare('SELECT email FROM users WHERE id = ?')
      .bind(r.userId)
      .first<{ email: string }>();
    if (inviterRow && normalizeInviteEmail(inviterRow.email) === invitedNorm) {
      return jsonResponse(request, { error: 'You cannot invite yourself' }, { status: 400 });
    }
    const existingMember = await env.DB.prepare(
      `SELECT 1 FROM board_members m JOIN users u ON u.id = m.user_id
       WHERE m.board_id = ? AND lower(trim(u.email)) = ?`
    )
      .bind(boardId, invitedNorm)
      .first<{ 1: number }>();
    if (existingMember) {
      return jsonResponse(request, { error: 'That person is already on this board' }, { status: 409 });
    }
    const rawTokenBytes = new Uint8Array(32);
    crypto.getRandomValues(rawTokenBytes);
    const rawToken = [...rawTokenBytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    const tokenHash = await sha256TokenHex(rawToken);
    const t = nowIso();
    const exp = new Date(Date.now() + INVITE_DAYS * 864e5).toISOString();
    const inviteId = crypto.randomUUID();
    try {
      await env.DB.prepare(
        `INSERT INTO board_invitations (id, board_id, inviter_user_id, invited_email_normalized, role, token_hash, created_at, expires_at, accepted_at, declined_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
        .bind(inviteId, boardId, r.userId, invitedNorm, INVITE_ROLE, tokenHash, t, exp)
        .run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/UNIQUE|constraint|unique/i.test(msg)) {
        return jsonResponse(
          request,
          { error: 'An invitation is already pending for that email' },
          { status: 409 }
        );
      }
      throw e;
    }
    const inviterName =
      (
        await env.DB.prepare('SELECT username, email FROM users WHERE id = ?')
          .bind(r.userId)
          .first<{ username: string | null; email: string }>()
      )?.username?.trim() ||
      inviterRow?.email?.split('@')[0] ||
      'Someone';
    const appOrigin = getAppUrl(request, env);
    const acceptHttpsUrl = `${appOrigin}/invite/${encodeURIComponent(rawToken)}`;
    const boardifyDeepLink = `boardify://invite/${rawToken}`;
    const logoUrl = emailLogoAbsoluteUrl(appOrigin);
    const html = boardInviteEmailHtml(inviterName, board.name, acceptHttpsUrl, boardifyDeepLink, logoUrl);
    const smtp = getSmtp(env);
    const emailResult = await sendEmail(
      {
        to: rawEmail,
        subject: `${inviterName} invited you to “${board.name}” on Boardify`,
        text: `You're invited to collaborate on "${board.name}" on Boardify.\n\nOpen: ${acceptHttpsUrl}\n\nOr in the app: ${boardifyDeepLink}\n`,
        html,
      },
      smtp
    );
    await insertBoardAuditLog(env, boardId, 'board_invite_sent', `Invited ${invitedNorm} to the board`, r.userId, {
      boardId,
      invitationId: inviteId,
    });
    return jsonResponse(
      request,
      {
        invitation: {
          id: inviteId,
          boardId,
          invitedEmailNormalized: invitedNorm,
          createdAt: t,
          expiresAt: exp,
        },
        emailSent: emailResult.success,
        emailError: emailResult.success ? undefined : emailResult.error,
      },
      { status: 201 }
    );
  }

  if (
    segments.length === 5 &&
    segments[2] === 'invitations' &&
    segments[4] === 'accept' &&
    method === 'POST'
  ) {
    const invitationId = segments[3];
    if (!invitationId) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    if (principal?.kind === 'api_key') {
      return jsonResponse(
        request,
        { error: 'Accepting invitations requires a signed-in session, not an API key' },
        { status: 403 }
      );
    }
    const user = sessionUser(principal);
    if (!user?.email) return jsonResponse(request, { error: 'Unauthorized' }, { status: 401 });
    const row = await env.DB.prepare(
      `SELECT * FROM board_invitations WHERE id = ? AND board_id = ?`
    )
      .bind(invitationId, boardId)
      .first<BoardInviteRow>();
    if (!row) return jsonResponse(request, { error: 'Invitation not found' }, { status: 404 });
    const now = nowIso();
    const result = await acceptBoardInviteForUser(
      env,
      row,
      Number(user.id),
      normalizeInviteEmail(user.email),
      now
    );
    if (!result.ok) {
      return jsonResponse(request, { error: result.error }, { status: result.status });
    }
    return jsonResponse(request, { ok: true, boardId: result.boardId, boardName: result.boardName });
  }

  if (
    segments.length === 5 &&
    segments[2] === 'invitations' &&
    segments[4] === 'decline' &&
    method === 'POST'
  ) {
    const invitationId = segments[3];
    if (!invitationId) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    if (principal?.kind === 'api_key') {
      return jsonResponse(
        request,
        { error: 'Declining invitations requires a signed-in session, not an API key' },
        { status: 403 }
      );
    }
    const user = sessionUser(principal);
    if (!user?.email) return jsonResponse(request, { error: 'Unauthorized' }, { status: 401 });
    const row = await env.DB.prepare(
      `SELECT * FROM board_invitations WHERE id = ? AND board_id = ?`
    )
      .bind(invitationId, boardId)
      .first<BoardInviteRow>();
    if (!row) return jsonResponse(request, { error: 'Invitation not found' }, { status: 404 });
    const now = nowIso();
    if (!inviteIsActionable(row, now)) {
      return jsonResponse(request, { error: 'Invitation is no longer valid' }, { status: 410 });
    }
    if (normalizeInviteEmail(user.email) !== row.invited_email_normalized) {
      return jsonResponse(
        request,
        { error: 'This invitation was sent to a different email address' },
        { status: 403 }
      );
    }
    await env.DB.prepare(`UPDATE board_invitations SET declined_at = ? WHERE id = ?`).bind(now, row.id).run();
    return jsonResponse(request, { ok: true });
  }

  if (segments.length === 3 && segments[2] === 'full' && method === 'GET') {
    const r = await requireBoardAccess(request, env, boardId, principal);
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
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    const { results } = await env.DB.prepare(
      'SELECT * FROM lists WHERE board_id = ? AND archived_at IS NULL ORDER BY position ASC'
    )
      .bind(boardId)
      .all();
    return jsonResponse(request, { lists: results ?? [] });
  }

  if (segments.length === 3 && segments[2] === 'lists' && method === 'POST') {
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: { title?: string; position?: number } = {};
    try {
      body = await request.json();
    } catch {
      // ignore
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
    await insertBoardAuditLog(env, boardId, 'list_added', `List “${title}” added`, r.userId, { listId: id });
    await broadcastBoardEvent(env, boardId, { type: 'list_created', boardId, listId: id, actorUserId: r.userId });
    const list = await env.DB.prepare('SELECT * FROM lists WHERE id = ?').bind(id).first();
    return jsonResponse(request, { list }, { status: 201 });
  }

  if (segments.length === 4 && segments[2] === 'lists' && segments[3] === 'reorder' && method === 'POST') {
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: { orderedIds?: string[] } = {};
    try {
      body = await request.json();
    } catch {
      // ignore
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
    await broadcastBoardEvent(env, boardId, { type: 'lists_reordered', boardId, orderedIds: ids, actorUserId: r.userId });
    return jsonResponse(request, { ok: true });
  }

  if (segments.length === 3 && segments[2] === 'archive' && method === 'GET') {
    const r = await requireBoardAccess(request, env, boardId, principal);
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
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: { cardId?: string; sourceListTitle?: string } = {};
    try {
      body = await request.json();
    } catch {
      // ignore
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
    const archPayload = parseJson<Record<string, unknown>>(String(card.payload_json ?? ''), {});
    await deleteOrphanedAttachmentObjects(env, archPayload.attachments, []);
    await env.DB.prepare('DELETE FROM cards WHERE id = ?').bind(cardId).run();
    await insertBoardAuditLog(env, boardId, 'card_archived', `Card “${String(card.title || 'Card')}” archived`, r.userId, {
      cardId,
      archiveId,
    });
    await broadcastBoardEvent(env, boardId, {
      type: 'card_archived',
      boardId,
      cardId,
      archiveId,
      actorUserId: r.userId,
    });
    return jsonResponse(request, { archiveId }, { status: 201 });
  }

  if (segments.length === 4 && segments[2] === 'archive' && segments[3] === 'lists' && method === 'POST') {
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: { listId?: string } = {};
    try {
      body = await request.json();
    } catch {
      // ignore
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
    for (const c of cardRows ?? []) {
      const p = parseJson<Record<string, unknown>>(c.payload_json, {});
      await deleteOrphanedAttachmentObjects(env, p.attachments, []);
    }
    await env.DB.prepare('DELETE FROM cards WHERE list_id = ?').bind(listId).run();
    await env.DB.prepare('DELETE FROM lists WHERE id = ?').bind(listId).run();
    await insertBoardAuditLog(env, boardId, 'list_archived', `List “${list.title}” archived`, r.userId, {
      listId,
      archiveId,
    });
    await broadcastBoardEvent(env, boardId, {
      type: 'list_archived',
      boardId,
      listId,
      archiveId,
      actorUserId: r.userId,
    });
    return jsonResponse(request, { archiveId }, { status: 201 });
  }

  if (segments.length === 3 && segments[2] === 'restore' && method === 'POST') {
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: { type?: string; archiveId?: string; targetListId?: string } = {};
    try {
      body = await request.json();
    } catch {
      // ignore
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
      await insertBoardAuditLog(env, boardId, 'card_restored', `Card restored`, r.userId, { cardId });
      await broadcastBoardEvent(env, boardId, {
        type: 'card_restored',
        boardId,
        cardId,
        listId: targetListId,
        actorUserId: r.userId,
      });
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
      await insertBoardAuditLog(env, boardId, 'list_restored', `List “${listTitle}” restored`, r.userId, { listId });
      await broadcastBoardEvent(env, boardId, { type: 'list_restored', boardId, listId, actorUserId: r.userId });
      return jsonResponse(request, { listId });
    }
    return jsonResponse(request, { error: 'Invalid restore body' }, { status: 400 });
  }

  if (segments.length === 3 && segments[2] === 'audit' && method === 'GET') {
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10));
    const { results } = await env.DB.prepare(
      `SELECT a.id, a.board_id, a.at_iso, a.kind, a.summary, a.actor_user_id, a.metadata_json,
              u.username AS actor_username, u.email AS actor_email, u.profile_picture_url AS actor_profile_picture_url
       FROM board_audit_log a
       LEFT JOIN users u ON u.id = a.actor_user_id
       WHERE a.board_id = ?
       ORDER BY a.at_iso DESC
       LIMIT ? OFFSET ?`
    )
      .bind(boardId, limit, offset)
      .all();
    return jsonResponse(request, { entries: results ?? [] });
  }

  if (segments.length === 4 && segments[2] === 'dashboard' && segments[3] === 'tiles' && method === 'GET') {
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    const { results } = await env.DB.prepare(
      'SELECT * FROM board_dashboard_tiles WHERE board_id = ? ORDER BY position ASC'
    )
      .bind(boardId)
      .all();
    return jsonResponse(request, { tiles: results ?? [] });
  }

  if (segments.length === 4 && segments[2] === 'dashboard' && segments[3] === 'tiles' && method === 'PUT') {
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: { tiles?: { kind: string; dimension: string; lineTimeframe?: string }[] } = {};
    try {
      body = await request.json();
    } catch {
      // ignore
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
    await broadcastBoardEvent(env, boardId, { type: 'dashboard_updated', boardId, actorUserId: r.userId });
    return jsonResponse(request, { ok: true });
  }

  if (segments.length === 3 && segments[2] === 'notification-settings' && method === 'GET') {
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    const row = await env.DB.prepare(
      'SELECT prefs_json FROM board_notification_settings WHERE board_id = ? AND user_id = ?'
    )
      .bind(boardId, r.userId)
      .first<{ prefs_json: string }>();
    return jsonResponse(request, { prefs: row ? parseJson(row.prefs_json, {}) : null });
  }

  if (segments.length === 3 && segments[2] === 'notification-settings' && method === 'PATCH') {
    const r = await requireBoardAccess(request, env, boardId, principal);
    if (r instanceof Response) return r;
    let patch: Record<string, unknown> = {};
    try {
      patch = await request.json();
    } catch {
      // ignore
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
      actorUserId: r.userId,
    });
    return jsonResponse(request, { prefs: merged });
  }

  if (segments.length === 4 && segments[2] === 'ai' && segments[3] === 'prioritize' && method === 'POST') {
    const resp = await handleBoardAiPrioritize(request, env, boardId, principal);
    if (resp) return resp;
  }

  if (segments.length === 4 && segments[2] === 'ai' && segments[3] === 'next-task' && method === 'POST') {
    const resp = await handleBoardAiNextTask(request, env, boardId, principal);
    if (resp) return resp;
  }

  if (segments.length === 4 && segments[2] === 'ai' && segments[3] === 'list-insights' && method === 'POST') {
    const resp = await handleBoardAiListInsights(request, env, boardId, principal);
    if (resp) return resp;
  }

  }

  if (segments.length === 4 && segments[0] === 'cards' && segments[2] === 'ai' && segments[3] === 'subtasks' && method === 'POST') {
    const cardId = segments[1];
    const resp = await handleCardAiSubtasks(request, env, cardId, principal);
    if (resp) return resp;
  }

  if (segments.length === 2 && segments[0] === 'lists' && method === 'PATCH') {
    const listId = segments[1];
    const list = await env.DB.prepare('SELECT board_id FROM lists WHERE id = ?').bind(listId).first<{ board_id: string }>();
    if (!list) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    const r = await requireBoardAccess(request, env, list.board_id, principal);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: { title?: string; position?: number } = {};
    try {
      body = await request.json();
    } catch {
      // ignore
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
    await broadcastBoardEvent(env, list.board_id, {
      type: 'list_updated',
      boardId: list.board_id,
      listId,
      actorUserId: r.userId,
    });
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
    const r = await requireBoardAccess(request, env, list.board_id, principal);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'admin')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    const { results: cardsToDrop } = await env.DB.prepare('SELECT payload_json FROM cards WHERE list_id = ?')
      .bind(listId)
      .all<{ payload_json: string }>();
    for (const row of cardsToDrop ?? []) {
      const p = parseJson<Record<string, unknown>>(row.payload_json, {});
      await deleteOrphanedAttachmentObjects(env, p.attachments, []);
    }
    await env.DB.prepare('DELETE FROM cards WHERE list_id = ?').bind(listId).run();
    await env.DB.prepare('DELETE FROM lists WHERE id = ?').bind(listId).run();
    await insertBoardAuditLog(env, list.board_id, 'list_archived', `List “${list.title}” deleted`, r.userId, { listId });
    await broadcastBoardEvent(env, list.board_id, {
      type: 'list_deleted',
      boardId: list.board_id,
      listId,
      actorUserId: r.userId,
    });
    return jsonResponse(request, { ok: true });
  }

  if (segments.length === 3 && segments[0] === 'lists' && segments[2] === 'cards' && method === 'GET') {
    const listId = segments[1];
    const list = await env.DB.prepare('SELECT board_id FROM lists WHERE id = ?').bind(listId).first<{ board_id: string }>();
    if (!list) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    const r = await requireBoardAccess(request, env, list.board_id, principal);
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
    const r = await requireBoardAccess(request, env, list.board_id, principal);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // ignore
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
    await insertBoardAuditLog(env, list.board_id, 'card_added', `Card “${title}” added`, r.userId, { cardId: id, listId });
    await broadcastBoardEvent(env, list.board_id, {
      type: 'card_created',
      boardId: list.board_id,
      listId,
      cardId: id,
      actorUserId: r.userId,
    });
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
    const r = await requireBoardAccess(request, env, card.board_id, principal);
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
    const r = await requireBoardAccess(request, env, card.board_id, principal);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {
      // ignore
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

    await deleteOrphanedAttachmentObjects(env, curPayload.attachments, nextPayload.attachments);

    const prevAssignees = numericAssigneeUserIds(curPayload.assignees);
    const nextAssignees =
      body.assignees !== undefined ? numericAssigneeUserIds(body.assignees) : prevAssignees;
    const addedAssignees = nextAssignees.filter((id) => !prevAssignees.includes(id));
    for (const assigneeId of addedAssignees) {
      if (assigneeId === r.userId) continue;
      const u = await env.DB
        .prepare('SELECT username, email FROM users WHERE id = ?')
        .bind(assigneeId)
        .first<{ username: string | null; email: string }>();
      const assigneeName = u?.username?.trim() || u?.email?.split('@')[0] || 'Teammate';
      await insertBoardAuditLog(
        env,
        card.board_id,
        'user_assigned_to_card',
        `Assigned ${assigneeName} to “${title}”`,
        r.userId,
        { cardId, assigneeUserId: assigneeId, cardTitle: title }
      );
    }

    const prevAct = Array.isArray(curPayload.activity) ? curPayload.activity.length : 0;
    const nextActivityRaw = body.activity !== undefined ? body.activity : curPayload.activity;
    const nextAct = Array.isArray(nextActivityRaw) ? nextActivityRaw.length : prevAct;
    const commentAdded = nextAct > prevAct;

    const coreChanged =
      (typeof body.title === 'string' && body.title !== card.title) ||
      (body.subtitle !== undefined && body.subtitle !== card.subtitle) ||
      (body.description !== undefined && body.description !== card.description) ||
      (body.labelColor !== undefined && body.labelColor !== card.label_color) ||
      (body.startDate !== undefined && body.startDate !== card.start_date) ||
      (body.dueDate !== undefined && body.dueDate !== card.due_date) ||
      (typeof body.position === 'number' && body.position !== card.position) ||
      (body.workTimerAccumMs !== undefined && body.workTimerAccumMs !== card.work_timer_accum_ms) ||
      (body.workTimerRunStartedAtMs !== undefined &&
        body.workTimerRunStartedAtMs !== card.work_timer_run_started_at_ms);

    const payloadNoActAssignCur = { ...curPayload } as Record<string, unknown>;
    delete payloadNoActAssignCur.activity;
    delete payloadNoActAssignCur.assignees;
    const payloadNoActAssignNext = { ...nextPayload } as Record<string, unknown>;
    delete payloadNoActAssignNext.activity;
    delete payloadNoActAssignNext.assignees;
    const otherPayloadChanged =
      JSON.stringify(payloadNoActAssignCur) !== JSON.stringify(payloadNoActAssignNext);

    const assigneesChanged = JSON.stringify(curPayload.assignees) !== JSON.stringify(nextPayload.assignees);
    const onlyAssignees =
      assigneesChanged && !coreChanged && !otherPayloadChanged && !commentAdded;

    if (commentAdded && Array.isArray(nextActivityRaw)) {
      const last = nextActivityRaw[nextAct - 1] as { text?: string };
      const snippet = typeof last?.text === 'string' ? last.text.trim() : 'New note';
      const clipped = snippet.slice(0, 200);
      await insertBoardAuditLog(env, card.board_id, 'card_comment', clipped, r.userId, {
        cardId,
        cardTitle: title,
        snippet: snippet.slice(0, 500),
      });
    }

    const structuralForUpdated = coreChanged || otherPayloadChanged;
    if (structuralForUpdated && !onlyAssignees) {
      const cardUpdateSummary = buildCardUpdateSummary(card, body, title, otherPayloadChanged);
      await insertBoardAuditLog(env, card.board_id, 'card_updated', cardUpdateSummary, r.userId, { cardId });
    }

    await broadcastBoardEvent(env, card.board_id, {
      type: 'card_updated',
      boardId: card.board_id,
      cardId,
      actorUserId: r.userId,
    });
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
    const r = await requireBoardAccess(request, env, card.board_id, principal);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    const delPayload = parseJson<Record<string, unknown>>(card.payload_json, {});
    await deleteOrphanedAttachmentObjects(env, delPayload.attachments, []);
    await env.DB.prepare('DELETE FROM cards WHERE id = ?').bind(cardId).run();
    await insertBoardAuditLog(env, card.board_id, 'card_archived', `Card “${String(card.title || 'Card')}” removed`, r.userId, {
      cardId,
    });
    await broadcastBoardEvent(env, card.board_id, {
      type: 'card_deleted',
      boardId: card.board_id,
      cardId,
      actorUserId: r.userId,
    });
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
    const r = await requireBoardAccess(request, env, card.board_id, principal);
    if (r instanceof Response) return r;
    if (!roleAtLeast(r.role, 'member')) {
      return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
    }
    let body: { listId?: string; position?: number } = {};
    try {
      body = await request.json();
    } catch {
      // ignore
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
    const toList = await env.DB.prepare('SELECT title FROM lists WHERE id = ?')
      .bind(newListId)
      .first<{ title: string }>();
    await insertBoardAuditLog(env, card.board_id, 'card_moved', `Card “${card.title}” moved`, r.userId, {
      cardId,
      listId: newListId,
      listTitle: toList?.title ?? '',
    });
    await broadcastBoardEvent(env, card.board_id, {
      type: 'card_moved',
      boardId: card.board_id,
      cardId,
      listId: newListId,
      position,
      actorUserId: r.userId,
    });
    const updated = await env.DB.prepare('SELECT * FROM cards WHERE id = ?').bind(cardId).first<Parameters<typeof cardRowToApi>[0]>();
    return jsonResponse(request, { card: updated ? cardRowToApi(updated) : null });
  }

  return null;
}
