import type { Env } from './bindings';
import type { AuthPrincipal } from './authPrincipal';
import { jsonResponse } from './http';

export async function getBoardMembership(
  env: Env,
  boardId: string,
  userId: number
): Promise<{ role: string } | null> {
  const row = await env.DB.prepare(
    'SELECT role FROM board_members WHERE board_id = ? AND user_id = ?'
  )
    .bind(boardId, userId)
    .first<{ role: string }>();
  return row ?? null;
}

export async function requireBoardAccess(
  request: Request,
  env: Env,
  boardId: string,
  principal: AuthPrincipal | null
): Promise<{ userId: number; role: string } | Response> {
  if (!principal) {
    return jsonResponse(request, { error: 'Unauthorized' }, { status: 401 });
  }
  if (
    principal.kind === 'api_key' &&
    principal.scopeKind === 'boards' &&
    !principal.allowedBoardIds.has(boardId)
  ) {
    return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
  }
  const userId = principal.kind === 'session' ? Number(principal.user.id) : principal.userId;
  const m = await getBoardMembership(env, boardId, userId);
  if (!m) {
    return jsonResponse(request, { error: 'Forbidden' }, { status: 403 });
  }
  return { userId, role: m.role };
}
