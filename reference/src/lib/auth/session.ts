const SESSION_TOKEN_LENGTH = 32;

export function generateSessionToken(): string {
  const bytes = new Uint8Array(SESSION_TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  return arrayBufferToBase64Url(bytes);
}

export async function createSession(
  db: D1Database,
  userId: number,
  token: string,
  expiresAt: string,
  ipAddress?: string | null,
  userAgent?: string | null
): Promise<string> {
  const sessionId = generateSessionToken();
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO auth_sessions (id, user_id, token, expires_at, ip_address, user_agent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(sessionId, userId, token, expiresAt, ipAddress || null, userAgent || null, now, now)
    .run();

  return sessionId;
}

export async function getSessionByToken(
  db: D1Database,
  token: string
): Promise<{
  id: string;
  user_id: number;
  token: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
} | null> {
  const now = new Date().toISOString();

  const result = await db
    .prepare(
      `SELECT id, user_id, token, expires_at, ip_address, user_agent
       FROM auth_sessions
       WHERE token = ? AND expires_at > ?
       LIMIT 1`
    )
    .bind(token, now)
    .first<{
      id: string;
      user_id: number;
      token: string;
      expires_at: string;
      ip_address: string | null;
      user_agent: string | null;
    }>();

  return result || null;
}

export async function deleteSessionByToken(db: D1Database, token: string): Promise<void> {
  await db.prepare(`DELETE FROM auth_sessions WHERE token = ?`).bind(token).run();
}

export async function deleteAllUserSessions(db: D1Database, userId: number): Promise<void> {
  await db.prepare(`DELETE FROM auth_sessions WHERE user_id = ?`).bind(userId).run();
}

export async function cleanupExpiredSessions(db: D1Database): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`DELETE FROM auth_sessions WHERE expires_at <= ?`).bind(now).run();
}

export async function updateSessionExpiration(
  db: D1Database,
  token: string,
  expiresAt: string
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(`UPDATE auth_sessions SET expires_at = ?, updated_at = ? WHERE token = ?`)
    .bind(expiresAt, now, token)
    .run();
}

export function calculateSessionExpiration(days: number = 14): string {
  const expiration = new Date();
  expiration.setDate(expiration.getDate() + days);
  return expiration.toISOString();
}

function arrayBufferToBase64Url(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
