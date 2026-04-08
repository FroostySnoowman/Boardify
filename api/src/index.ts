import type { Env } from './bindings';
import { bindRequestEnv, emptyCorsResponse, jsonResponse } from './http';
import { handleAuth } from './auth';
import { handleUser } from './user';
import { handleImages } from './images';
import { handleBoards } from './boards';
import { handleBoardWebSocket } from './wsBoard';

export { BoardRoom } from './board-room-do';

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/** Strip /api prefix for internal routing (e.g. /api/images/x -> /images/x). */
function stripApiPrefix(pathname: string): string {
  if (pathname === '/api') return '/';
  if (pathname.startsWith('/api/')) {
    return pathname.slice(4) || '/';
  }
  return pathname;
}

async function routeRequest(request: Request, env: Env, pathname: string): Promise<Response> {
  pathname = normalizePath(pathname);

  if (pathname === '/health' && request.method === 'GET') {
    return jsonResponse(request, { ok: true, service: 'boardify-api' });
  }

  const forImages = stripApiPrefix(pathname);
  if (
    forImages.startsWith('/images/') ||
    forImages.startsWith('/upload/') ||
    forImages === '/upload/profile-picture'
  ) {
    const resp = await handleImages(request, env, forImages);
    if (resp) return resp;
  }

  if (pathname.startsWith('/auth/') || pathname.startsWith('/api/auth/')) {
    const resp = await handleAuth(request, env, pathname);
    if (resp) return resp;
  }

  if (pathname.startsWith('/user/')) {
    const resp = await handleUser(request, env, pathname);
    if (resp) return resp;
  }

  const wsBoardPath = stripApiPrefix(pathname);
  if (wsBoardPath.startsWith('/ws/boards/') && request.method === 'GET') {
    const rest = wsBoardPath.slice('/ws/boards/'.length);
    const boardId = rest.split('/')[0];
    if (boardId) {
      return handleBoardWebSocket(request, env, boardId);
    }
  }

  const boardPath = stripApiPrefix(pathname);
  const boardResp = await handleBoards(request, env, boardPath);
  if (boardResp) return boardResp;

  return jsonResponse(request, { error: 'Not found' }, { status: 404 });
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    if (request.method === 'OPTIONS') {
      bindRequestEnv(request, env);
      return emptyCorsResponse(request);
    }

    let session: ReturnType<D1Database['withSession']>;
    try {
      const bookmark = request.headers.get('x-d1-bookmark');
      session = env.DB.withSession(bookmark ?? 'first-unconstrained');
    } catch {
      session = env.DB.withSession('first-unconstrained');
    }
    const sessionEnv = { ...env, DB: session } as unknown as Env;
    bindRequestEnv(request, sessionEnv);

    const url = new URL(request.url);
    const response = await routeRequest(request, sessionEnv, url.pathname);

    if (response.status !== 101) {
      const out = new Response(response.body, response);
      out.headers.set('x-d1-bookmark', session.getBookmark() ?? '');
      return out;
    }
    return response;
  },
};
