import type { Env } from './bindings';
import { getAuthToken } from './lib/auth/cookies';
import { getSessionByToken } from './lib/auth/session';
import { getBoardMembership } from './boardAccess';

export async function handleBoardWebSocket(
  request: Request,
  env: Env,
  boardId: string
): Promise<Response> {
  if (!env.BOARD_ROOM) {
    return new Response('WebSocket not configured', { status: 503 });
  }

  const url = new URL(request.url);
  const token = getAuthToken(request) || url.searchParams.get('token');
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  const sess = await getSessionByToken(env.DB, token);
  if (!sess) {
    return new Response('Unauthorized', { status: 401 });
  }

  const member = await getBoardMembership(env, boardId, sess.user_id);
  if (!member) {
    return new Response('Forbidden', { status: 403 });
  }

  const userRow = await env.DB.prepare('SELECT username FROM users WHERE id = ?')
    .bind(sess.user_id)
    .first<{ username: string | null }>();

  const headers = new Headers(request.headers);
  headers.set('X-Internal-User-Id', String(sess.user_id));
  headers.set('X-Internal-Username', encodeURIComponent(userRow?.username ?? ''));

  const id = env.BOARD_ROOM.idFromName(boardId);
  const stub = env.BOARD_ROOM.get(id);

  const doRequest = new Request(request, { headers });
  return stub.fetch(doRequest);
}
