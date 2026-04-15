import type { Env } from './bindings';
import { jsonResponse } from './http';
import { getCurrentUserFromSession } from './auth';

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
