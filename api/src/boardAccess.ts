import type { Env } from './bindings';

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
