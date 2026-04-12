import type { Env } from './bindings';
import { jsonResponse } from './http';
import { getCurrentUserFromSession } from './auth';
import { hashPassword, verifyPassword, formatPasswordHash } from './lib/auth/password';
import { auditRowToInboxItem, type AuditRow } from './inboxMap';
import { normalizeInviteEmail } from './boardInvitations';

export async function handleUser(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response | null> {
  const currentUser = await getCurrentUserFromSession(request, env);
  if (!currentUser) {
    return jsonResponse(request, { error: 'Unauthorized' }, { status: 401 });
  }

  if (pathname === '/user/profile' && request.method === 'GET') {
    const userId = Number(currentUser.id);
    const [row, oauthRow] = await Promise.all([
      env.DB.prepare(
        `SELECT id, email, username, profile_picture_url, mode, stat_profile, created_at, birthdate, chat_disabled, parental_consent_at, subscription_status
         FROM users WHERE id = ?`
      )
        .bind(userId)
        .first<{
          id: number;
          email: string;
          username: string | null;
          profile_picture_url: string | null;
          mode: string | null;
          stat_profile: string | null;
          created_at: string;
          birthdate: string | null;
          chat_disabled: number;
          parental_consent_at: string | null;
          subscription_status: string | null;
        }>(),
      env.DB.prepare(
        "SELECT provider_id FROM auth_accounts WHERE user_id = ? AND provider_id IN ('google', 'apple') LIMIT 1"
      )
        .bind(userId)
        .first<{ provider_id: string }>(),
    ]);

    if (!row) {
      return jsonResponse(request, { error: 'User not found' }, { status: 404 });
    }

    return jsonResponse(request, {
      id: String(row.id),
      email: row.email,
      username: row.username,
      profilePictureUrl: row.profile_picture_url,
      mode: row.mode ?? null,
      statProfile: row.stat_profile ?? null,
      createdAt: row.created_at,
      authProvider: oauthRow?.provider_id ?? null,
      birthdate: row.birthdate ?? null,
      chatDisabled: row.chat_disabled === 1,
      parentalConsentAt: row.parental_consent_at ?? null,
      subscriptionStatus: row.subscription_status ?? 'free',
    });
  }

  if (pathname === '/user/profile' && request.method === 'PATCH') {
    let data: Record<string, unknown> = {};
    try {
      data = (await request.json()) as Record<string, unknown>;
    } catch {
      data = {};
    }

    const username = data.username as string | undefined;
    const birthdate = data.birthdate as string | null | undefined;

    if (username !== undefined) {
      if (username.length > 30) {
        return jsonResponse(request, { error: 'Username too long (max 30 characters)' }, { status: 400 });
      }
      await env.DB
        .prepare('UPDATE users SET username = ?, updated_at = ? WHERE id = ?')
        .bind(username || null, new Date().toISOString(), Number(currentUser.id))
        .run();
    }

    if (birthdate !== undefined) {
      if (birthdate !== null && birthdate !== '') {
        const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(birthdate) ? birthdate : null;
        if (!isoDate) {
          return jsonResponse(request, { error: 'Birthdate must be YYYY-MM-DD' }, { status: 400 });
        }
        const d = new Date(isoDate);
        if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== isoDate) {
          return jsonResponse(request, { error: 'Invalid birthdate' }, { status: 400 });
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (d > today) {
          return jsonResponse(request, { error: 'Birthdate cannot be in the future' }, { status: 400 });
        }
        const minDate = new Date(today.getFullYear() - 120, 0, 1);
        if (d < minDate) {
          return jsonResponse(request, { error: 'Birthdate is not valid' }, { status: 400 });
        }
      }
      await env.DB
        .prepare('UPDATE users SET birthdate = ?, updated_at = ? WHERE id = ?')
        .bind(birthdate && birthdate !== '' ? birthdate : null, new Date().toISOString(), Number(currentUser.id))
        .run();
    }

    const chatDisabled = data.chatDisabled as boolean | undefined;
    const parentalPin = data.parentalPin as string | undefined;
    if (chatDisabled !== undefined) {
      const userId = Number(currentUser.id);
      const parentRow = await env.DB
        .prepare('SELECT parental_pin_hash FROM users WHERE id = ?')
        .bind(userId)
        .first<{ parental_pin_hash: string | null }>();
      const hasPin = !!parentRow?.parental_pin_hash;

      if (chatDisabled === true) {
        if (!parentalPin || parentalPin.length < 4 || parentalPin.length > 6 || !/^\d+$/.test(parentalPin)) {
          return jsonResponse(
            request,
            { error: 'Parental PIN required (4-6 digits) to disable chat' },
            { status: 400 }
          );
        }
        if (!hasPin) {
          const { salt, iterations, hash } = await hashPassword(parentalPin);
          const stored = formatPasswordHash(salt, iterations, hash);
          await env.DB
            .prepare('UPDATE users SET parental_pin_hash = ?, chat_disabled = 1, updated_at = ? WHERE id = ?')
            .bind(stored, new Date().toISOString(), userId)
            .run();
        } else {
          const valid = await verifyPassword(parentalPin, parentRow!.parental_pin_hash!);
          if (!valid) {
            return jsonResponse(request, { error: 'Incorrect parental PIN' }, { status: 403 });
          }
          await env.DB
            .prepare('UPDATE users SET chat_disabled = 1, updated_at = ? WHERE id = ?')
            .bind(new Date().toISOString(), userId)
            .run();
        }
      } else {
        if (!hasPin || !parentalPin) {
          return jsonResponse(request, { error: 'Enter parental PIN to re-enable chat' }, { status: 400 });
        }
        const valid = await verifyPassword(parentalPin, parentRow!.parental_pin_hash!);
        if (!valid) {
          return jsonResponse(request, { error: 'Incorrect parental PIN' }, { status: 403 });
        }
        await env.DB
          .prepare('UPDATE users SET chat_disabled = 0, updated_at = ? WHERE id = ?')
          .bind(new Date().toISOString(), userId)
          .run();
      }
    }

    return jsonResponse(request, { message: 'Profile updated' }, { status: 200 });
  }

  if (pathname === '/user/profile-picture' && request.method === 'DELETE') {
    const oldPicture = await env.DB
      .prepare('SELECT profile_picture_url FROM users WHERE id = ?')
      .bind(Number(currentUser.id))
      .first<{ profile_picture_url: string | null }>();

    const deleteOps: Promise<unknown>[] = [
      env.DB
        .prepare('UPDATE users SET profile_picture_url = NULL, updated_at = ? WHERE id = ?')
        .bind(new Date().toISOString(), Number(currentUser.id))
        .run(),
    ];

    if (oldPicture?.profile_picture_url && env.IMAGES) {
      const oldKey = oldPicture.profile_picture_url.split('/api/images/')[1];
      if (oldKey) {
        deleteOps.push(
          env.IMAGES.delete(oldKey).catch((e: unknown) => {
            console.error('Failed to delete old profile picture:', e);
          })
        );
      }
    }

    await Promise.all(deleteOps);
    return jsonResponse(request, { message: 'Profile picture removed' }, { status: 200 });
  }

  if (pathname === '/user/expo-push-token' && request.method === 'POST') {
    let body: { token?: string; platform?: string } = {};
    try {
      body = (await request.json()) as { token?: string; platform?: string };
    } catch {
      body = {};
    }
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (token.length < 20 || token.length > 512) {
      return jsonResponse(request, { error: 'Invalid push token' }, { status: 400 });
    }
    const platform =
      body.platform === 'ios' || body.platform === 'android' || body.platform === 'web'
        ? body.platform
        : 'unknown';
    const userId = Number(currentUser.id);
    const t = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO user_expo_push_tokens (user_id, expo_push_token, platform, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         expo_push_token = excluded.expo_push_token,
         platform = excluded.platform,
         updated_at = excluded.updated_at`
    )
      .bind(userId, token, platform, t)
      .run();
    return jsonResponse(request, { ok: true });
  }

  if (pathname === '/user/expo-push-token' && request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM user_expo_push_tokens WHERE user_id = ?')
      .bind(Number(currentUser.id))
      .run();
    return jsonResponse(request, { ok: true });
  }

  if (pathname === '/user/messages' && request.method === 'GET') {
    const userId = Number(currentUser.id);
    const url = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') ?? '50', 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') ?? '0', 10));

    const fetchCap = Math.min(500, offset + limit + 80);
    const { results } = await env.DB.prepare(
      `SELECT a.id, a.board_id, a.at_iso, a.kind, a.summary, a.actor_user_id, a.metadata_json,
              b.name as board_name, u.username as actor_username, u.email as actor_email
       FROM board_audit_log a
       INNER JOIN board_members m ON m.board_id = a.board_id AND m.user_id = ?
       INNER JOIN boards b ON b.id = a.board_id AND b.archived_at IS NULL
       LEFT JOIN users u ON u.id = a.actor_user_id
       WHERE (a.actor_user_id IS NULL OR a.actor_user_id != ?)
       ORDER BY a.at_iso DESC
       LIMIT ? OFFSET 0`
    )
      .bind(userId, userId, fetchCap)
      .all<AuditRow>();

    const auditMessages = (results ?? [])
      .map((row) => auditRowToInboxItem(row, userId))
      .filter((item): item is NonNullable<typeof item> => item != null);

    const emailNorm = currentUser.email ? normalizeInviteEmail(currentUser.email) : '';
    type InboxOut = NonNullable<ReturnType<typeof auditRowToInboxItem>>;
    let inviteMessages: InboxOut[] = [];
    if (emailNorm) {
      const nowIso = new Date().toISOString();
      const { results: invRows } = await env.DB.prepare(
        `SELECT i.id, i.board_id, i.created_at as at_iso, b.name as board_name,
                u.username as inviter_username, u.email as inviter_email
         FROM board_invitations i
         JOIN boards b ON b.id = i.board_id AND b.archived_at IS NULL
         JOIN users u ON u.id = i.inviter_user_id
         WHERE i.invited_email_normalized = ?
           AND i.expires_at > ?
           AND i.accepted_at IS NULL AND i.declined_at IS NULL`
      )
        .bind(emailNorm, nowIso)
        .all<{
          id: string;
          board_id: string;
          at_iso: string;
          board_name: string;
          inviter_username: string | null;
          inviter_email: string;
        }>();
      inviteMessages = (invRows ?? []).map((row) => {
        const u = row.inviter_username?.trim();
        const actorName =
          u ||
          (row.inviter_email?.includes('@')
            ? row.inviter_email.split('@')[0]!
            : row.inviter_email) ||
          'Someone';
        const boardName = row.board_name.trim() || 'Board';
        return {
          id: `inv_${row.id}`,
          boardId: row.board_id,
          boardName,
          cardId: null,
          atIso: row.at_iso,
          actorName,
          messageKind: 'invite' as const,
          headline: 'invited you to a board',
          detail: boardName,
          accentColor: '#86efac',
          invitationId: row.id,
        };
      });
    }

    const merged = [...auditMessages, ...inviteMessages].sort((a, b) =>
      a.atIso < b.atIso ? 1 : a.atIso > b.atIso ? -1 : 0
    );
    const messages = merged.slice(offset, offset + limit);

    return jsonResponse(request, { messages });
  }

  return null;
}
