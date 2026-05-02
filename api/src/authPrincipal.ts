import type { Env, AuthenticatedUser } from './bindings';
import { getCredentialToken } from './lib/auth/cookies';
import { getCurrentUserFromSession } from './auth';
import { API_KEY_PREFIX, hashApiKeySecret } from './apiKeySecret';

export type AuthPrincipal =
  | { kind: 'session'; userId: number; user: AuthenticatedUser }
  | {
      kind: 'api_key';
      userId: number;
      apiKeyId: string;
      scopeKind: 'all' | 'boards';
      allowedBoardIds: Set<string>;
    };

export function principalUserId(p: AuthPrincipal): number {
  return p.kind === 'session' ? Number(p.user.id) : p.userId;
}

export function sessionUser(p: AuthPrincipal | null): AuthenticatedUser | null {
  if (!p || p.kind !== 'session') return null;
  return p.user;
}

export async function resolveAuthPrincipal(request: Request, env: Env): Promise<AuthPrincipal | null> {
  const token = getCredentialToken(request);
  if (!token) {
    return null;
  }

  if (token.startsWith(API_KEY_PREFIX)) {
    const tokenHash = await hashApiKeySecret(token, env);
    const row = await env.DB.prepare(
      `SELECT id, user_id, scope_kind FROM user_api_keys
       WHERE token_hash = ? AND revoked_at IS NULL`
    )
      .bind(tokenHash)
      .first<{ id: string; user_id: number; scope_kind: string }>();
    if (!row) {
      return null;
    }

    const now = new Date().toISOString();
    await env.DB
      .prepare('UPDATE user_api_keys SET last_used_at = ? WHERE id = ?')
      .bind(now, row.id)
      .run()
      .catch((e: unknown) => console.error('api key last_used_at', e));

    let allowedBoardIds = new Set<string>();
    if (row.scope_kind === 'boards') {
      const { results } = await env.DB.prepare(
        'SELECT board_id FROM user_api_key_boards WHERE api_key_id = ?'
      )
        .bind(row.id)
        .all<{ board_id: string }>();
      allowedBoardIds = new Set((results ?? []).map((r) => r.board_id));
    }

    return {
      kind: 'api_key',
      userId: row.user_id,
      apiKeyId: row.id,
      scopeKind: row.scope_kind === 'boards' ? 'boards' : 'all',
      allowedBoardIds,
    };
  }

  const user = await getCurrentUserFromSession(request, env);
  if (!user) {
    return null;
  }
  return { kind: 'session', userId: Number(user.id), user };
}
