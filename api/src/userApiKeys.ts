import type { Env } from './bindings';
import { jsonResponse } from './http';
import { getCurrentUserFromSession } from './auth';
import { generateApiKeySecret, apiKeyTokenPrefix, hashApiKeySecret } from './apiKeySecret';

function nowIso() {
  return new Date().toISOString();
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export async function handleUserApiKeys(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  pathname = normalizePath(pathname);
  if (!pathname.startsWith('/user/api-keys')) {
    return null;
  }

  const user = await getCurrentUserFromSession(request, env);
  if (!user) {
    return jsonResponse(request, { error: 'Unauthorized' }, { status: 401 });
  }
  const userId = Number(user.id);

  if (pathname === '/user/api-keys' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT k.id, k.name, k.token_prefix, k.scope_kind, k.created_at, k.revoked_at, k.last_used_at
       FROM user_api_keys k WHERE k.user_id = ? ORDER BY k.created_at DESC`
    )
      .bind(userId)
      .all<{
        id: string;
        name: string;
        token_prefix: string;
        scope_kind: string;
        created_at: string;
        revoked_at: string | null;
        last_used_at: string | null;
      }>();

    const keys = results ?? [];
    const boardRows: { api_key_id: string; board_id: string }[] = [];
    if (keys.length) {
      const ids = keys.map((k) => k.id);
      const ph = ids.map(() => '?').join(',');
      const { results: br } = await env.DB.prepare(
        `SELECT api_key_id, board_id FROM user_api_key_boards WHERE api_key_id IN (${ph})`
      )
        .bind(...ids)
        .all<{ api_key_id: string; board_id: string }>();
      boardRows.push(...(br ?? []));
    }
    const boardsByKey = new Map<string, string[]>();
    for (const r of boardRows) {
      const arr = boardsByKey.get(r.api_key_id) ?? [];
      arr.push(r.board_id);
      boardsByKey.set(r.api_key_id, arr);
    }

    return jsonResponse(
      request,
      {
        keys: keys.map((k) => ({
          id: k.id,
          name: k.name,
          tokenPrefix: k.token_prefix,
          scopeKind: k.scope_kind,
          boardIds: k.scope_kind === 'boards' ? (boardsByKey.get(k.id) ?? []) : null,
          createdAt: k.created_at,
          revokedAt: k.revoked_at,
          lastUsedAt: k.last_used_at,
        })),
      },
      { status: 200 }
    );
  }

  if (pathname === '/user/api-keys' && request.method === 'POST') {
    let body: {
      name?: string;
      scopeKind?: string;
      boardIds?: string[];
    } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 120) {
      return jsonResponse(request, { error: 'name is required (max 120 characters)' }, { status: 400 });
    }
    const scopeKind = body.scopeKind === 'boards' ? 'boards' : body.scopeKind === 'all' ? 'all' : '';
    if (scopeKind !== 'all' && scopeKind !== 'boards') {
      return jsonResponse(request, { error: 'scopeKind must be "all" or "boards"' }, { status: 400 });
    }
    let boardIds: string[] = [];
    if (scopeKind === 'boards') {
      if (!Array.isArray(body.boardIds) || body.boardIds.length === 0) {
        return jsonResponse(request, { error: 'boardIds is required when scopeKind is "boards"' }, { status: 400 });
      }
      boardIds = [...new Set(body.boardIds.filter((id) => typeof id === 'string' && id.length > 0))];
      if (boardIds.length === 0) {
        return jsonResponse(request, { error: 'boardIds must contain at least one board id' }, { status: 400 });
      }
      for (const bid of boardIds) {
        const m = await env.DB.prepare(
          'SELECT 1 FROM board_members WHERE board_id = ? AND user_id = ?'
        )
          .bind(bid, userId)
          .first<{ 1: number }>();
        if (!m) {
          return jsonResponse(request, { error: `You are not a member of board ${bid}` }, { status: 403 });
        }
      }
    }

    const secret = generateApiKeySecret();
    const tokenHash = await hashApiKeySecret(secret, env);
    const id = crypto.randomUUID();
    const t = nowIso();
    const prefix = apiKeyTokenPrefix(secret);

    const stmts: D1PreparedStatement[] = [
      env.DB.prepare(
        `INSERT INTO user_api_keys (id, user_id, name, token_hash, token_prefix, scope_kind, created_at, revoked_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      ).bind(id, userId, name, tokenHash, prefix, scopeKind, t),
    ];
    for (const bid of boardIds) {
      stmts.push(
        env.DB.prepare(
          'INSERT INTO user_api_key_boards (api_key_id, board_id) VALUES (?, ?)'
        ).bind(id, bid)
      );
    }
    await env.DB.batch(stmts);

    return jsonResponse(
      request,
      {
        key: {
          id,
          name,
          tokenPrefix: prefix,
          scopeKind,
          boardIds: scopeKind === 'boards' ? boardIds : null,
          createdAt: t,
        },
        secret,
      },
      { status: 201 }
    );
  }

  const delMatch = pathname.match(/^\/user\/api-keys\/([^/]+)$/);
  if (delMatch && request.method === 'DELETE') {
    const keyId = delMatch[1];
    if (!keyId) return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    const row = await env.DB.prepare('SELECT id FROM user_api_keys WHERE id = ? AND user_id = ?')
      .bind(keyId, userId)
      .first<{ id: string }>();
    if (!row) {
      return jsonResponse(request, { error: 'Not found' }, { status: 404 });
    }
    const t = nowIso();
    await env.DB.prepare('UPDATE user_api_keys SET revoked_at = ? WHERE id = ?').bind(t, keyId).run();
    return jsonResponse(request, { ok: true });
  }

  return null;
}
