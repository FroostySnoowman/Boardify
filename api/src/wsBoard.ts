import type { Env } from './bindings';
import { resolveAuthPrincipal } from './authPrincipal';
import { requireBoardAccess } from './boardAccess';

export async function handleBoardWebSocket(
  request: Request,
  env: Env,
  boardId: string
): Promise<Response> {
  if (!env.BOARD_ROOM) {
    return new Response('WebSocket not configured', { status: 503 });
  }

  const principal = await resolveAuthPrincipal(request, env);
  if (!principal) {
    return new Response('Unauthorized', { status: 401 });
  }

  const access = await requireBoardAccess(request, env, boardId, principal);
  if (access instanceof Response) {
    return access;
  }

  const userRow = await env.DB.prepare('SELECT username FROM users WHERE id = ?')
    .bind(access.userId)
    .first<{ username: string | null }>();

  const headers = new Headers(request.headers);
  headers.set('X-Internal-User-Id', String(access.userId));
  headers.set('X-Internal-Username', encodeURIComponent(userRow?.username ?? ''));

  const id = env.BOARD_ROOM.idFromName(boardId);
  const stub = env.BOARD_ROOM.get(id);

  const doRequest = new Request(request, { headers });
  return stub.fetch(doRequest);
}
