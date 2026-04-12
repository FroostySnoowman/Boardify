import type { Env } from './bindings';
import { jsonResponse } from './http';
import { getCurrentUserFromSession } from './auth';
import { broadcastBoardEvent } from './boardSync';

export type BoardInviteRow = {
  id: string;
  board_id: string;
  inviter_user_id: number;
  invited_email_normalized: string;
  role: string;
  token_hash: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  declined_at: string | null;
};

export function normalizeInviteEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function sha256TokenHex(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0');
  }
  return hex;
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i)! ^ b.charCodeAt(i)!;
  }
  return out === 0;
}

export function publicWebAppOrigin(request: Request, env: Env): string {
  if (env.WEB_APP_URL) return env.WEB_APP_URL.replace(/\/$/, '');
  const url = new URL(request.url);
  return url.origin.replace('api.', '');
}

export async function findInviteByTokenHash(
  env: Env,
  tokenHash: string
): Promise<BoardInviteRow | null> {
  const row = await env.DB.prepare(
    `SELECT * FROM board_invitations WHERE token_hash = ?`
  )
    .bind(tokenHash)
    .first<BoardInviteRow>();
  return row ?? null;
}

export function inviteIsActionable(row: BoardInviteRow, now: string): boolean {
  if (row.accepted_at != null || row.declined_at != null) return false;
  return row.expires_at > now;
}

export type AcceptInviteResult =
  | { ok: true; boardId: string; boardName: string }
  | { ok: false; error: string; status: number };

export async function acceptBoardInviteForUser(
  env: Env,
  row: BoardInviteRow,
  userId: number,
  userEmailNormalized: string,
  now: string
): Promise<AcceptInviteResult> {
  if (!inviteIsActionable(row, now)) {
    return { ok: false, error: 'Invitation is no longer valid', status: 410 };
  }
  if (userEmailNormalized !== row.invited_email_normalized) {
    return {
      ok: false,
      error: 'Sign in with the email address this invitation was sent to.',
      status: 403,
    };
  }
  const board = await env.DB.prepare(
    `SELECT id, name, archived_at FROM boards WHERE id = ?`
  )
    .bind(row.board_id)
    .first<{ id: string; name: string; archived_at: string | null }>();
  if (!board || board.archived_at != null) {
    return { ok: false, error: 'Board not found', status: 404 };
  }
  const existing = await env.DB.prepare(
    `SELECT 1 FROM board_members WHERE board_id = ? AND user_id = ?`
  )
    .bind(row.board_id, userId)
    .first<{ 1: number }>();
  if (existing) {
    await env.DB.prepare(
      `UPDATE board_invitations SET accepted_at = ? WHERE id = ? AND accepted_at IS NULL`
    )
      .bind(now, row.id)
      .run();
    return { ok: true, boardId: board.id, boardName: board.name };
  }
  const role = row.role === 'admin' || row.role === 'owner' ? 'member' : row.role;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO board_members (board_id, user_id, role, created_at) VALUES (?, ?, ?, ?)`
    ).bind(row.board_id, userId, role, now),
    env.DB.prepare(`UPDATE board_invitations SET accepted_at = ? WHERE id = ?`).bind(now, row.id),
  ]);
  await broadcastBoardEvent(env, row.board_id, {
    type: 'board_updated',
    boardId: row.board_id,
    actorUserId: userId,
  });
  return { ok: true, boardId: board.id, boardName: board.name };
}

export async function handlePublicInvitationRoutes(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'invitations') return null;
  const method = request.method;
  const now = new Date().toISOString();

  if (segments[1] === 'accept-by-token' && method === 'POST') {
    let body: { token?: string } = {};
    try {
      body = (await request.json()) as { token?: string };
    } catch {
      body = {};
    }
    const raw = typeof body.token === 'string' ? body.token.trim() : '';
    if (!raw || raw.length < 32) {
      return jsonResponse(request, { error: 'Invalid token' }, { status: 400 });
    }
    const tokenHash = await sha256TokenHex(raw);
    const row = await findInviteByTokenHash(env, tokenHash);
    if (!row || !inviteIsActionable(row, now)) {
      return jsonResponse(request, { error: 'Invalid or expired invitation' }, { status: 404 });
    }
    const board = await env.DB.prepare(`SELECT name, archived_at FROM boards WHERE id = ?`)
      .bind(row.board_id)
      .first<{ name: string; archived_at: string | null }>();
    if (!board || board.archived_at != null) {
      return jsonResponse(request, { error: 'Board not found' }, { status: 404 });
    }
    const user = await getCurrentUserFromSession(request, env);
    if (!user?.email) {
      return jsonResponse(request, {
        needsAuth: true,
        boardId: row.board_id,
        boardName: board.name,
      });
    }
    const norm = normalizeInviteEmail(user.email);
    const result = await acceptBoardInviteForUser(env, row, Number(user.id), norm, now);
    if (!result.ok) {
      return jsonResponse(request, { error: result.error }, { status: result.status });
    }
    return jsonResponse(request, {
      ok: true,
      boardId: result.boardId,
      boardName: result.boardName,
    });
  }

  if (segments[1] === 'decline-by-token' && method === 'POST') {
    let body: { token?: string } = {};
    try {
      body = (await request.json()) as { token?: string };
    } catch {
      body = {};
    }
    const raw = typeof body.token === 'string' ? body.token.trim() : '';
    if (!raw || raw.length < 32) {
      return jsonResponse(request, { error: 'Invalid token' }, { status: 400 });
    }
    const tokenHash = await sha256TokenHex(raw);
    const row = await findInviteByTokenHash(env, tokenHash);
    if (!row || !inviteIsActionable(row, now)) {
      return jsonResponse(request, { error: 'Invalid or expired invitation' }, { status: 404 });
    }
    const user = await getCurrentUserFromSession(request, env);
    if (!user?.email) {
      return jsonResponse(request, { needsAuth: true, boardId: row.board_id });
    }
    const norm = normalizeInviteEmail(user.email);
    if (norm !== row.invited_email_normalized) {
      return jsonResponse(
        request,
        { error: 'Sign in with the email address this invitation was sent to.' },
        { status: 403 }
      );
    }
    await env.DB.prepare(`UPDATE board_invitations SET declined_at = ? WHERE id = ?`).bind(now, row.id).run();
    return jsonResponse(request, { ok: true });
  }

  return null;
}
