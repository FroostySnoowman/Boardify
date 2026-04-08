import type { Env } from './bindings';

const BASE_ALLOWED = new Set([
  'http://localhost',
  'http://127.0.0.1',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
  'https://boardify.mybreakpoint.app',
  'http://boardify.mybreakpoint.app',
  'https://api.boardify.mybreakpoint.app',
  'http://api.boardify.mybreakpoint.app',
]);

const ALLOW_METHODS = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
const ALLOW_HEADERS = [
  'Content-Type',
  'Authorization',
  'Cookie',
  'X-Requested-With',
  'Origin',
  'Accept',
  'x-d1-bookmark',
].join(', ');
const EXPOSE_HEADERS = [
  'Content-Type',
  'Set-Cookie',
  'Access-Control-Allow-Origin',
  'Access-Control-Allow-Credentials',
  'x-d1-bookmark',
].join(', ');

function parseAllowedOrigins(env: Env): Set<string> {
  const s = new Set(BASE_ALLOWED);
  const extra = env.ALLOWED_ORIGINS?.trim();
  if (extra) {
    for (const o of extra.split(',')) {
      const t = o.trim();
      if (t) s.add(t);
    }
  }
  return s;
}

export function bindRequestEnv(request: Request, env: Env): void {
  (request as unknown as { __boardifyEnv?: Env }).__boardifyEnv = env;
}

export function buildCorsHeaders(req: Request, env: Env): Headers {
  const origin = req.headers.get('Origin') || '';
  const headers = new Headers();
  const allowed = parseAllowedOrigins(env);

  if (origin && allowed.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }

  if (env.WEB_APP_URL) {
    try {
      const o = new URL(env.WEB_APP_URL).origin;
      if (origin === o) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Credentials', 'true');
      }
    } catch {
      /* ignore */
    }
  }

  headers.set('Access-Control-Allow-Methods', ALLOW_METHODS);
  headers.set('Access-Control-Allow-Headers', ALLOW_HEADERS);
  headers.set('Access-Control-Expose-Headers', EXPOSE_HEADERS);
  return headers;
}

export function jsonResponse(req: Request, body: unknown, init: ResponseInit = {}, env?: Env): Response {
  const e = env ?? (req as unknown as { __boardifyEnv?: Env }).__boardifyEnv;
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const cors = buildCorsHeaders(req, e as Env);
  cors.forEach((v, k) => headers.set(k, v));
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function emptyCorsResponse(req: Request, status = 204, env?: Env): Response {
  const e = env ?? (req as unknown as { __boardifyEnv?: Env }).__boardifyEnv;
  const headers = buildCorsHeaders(req, e as Env);
  return new Response(null, { status, headers });
}
