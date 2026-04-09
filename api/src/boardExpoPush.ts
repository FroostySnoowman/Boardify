import type { Env } from './bindings';

/** Matches app Android channel id in `expoPush.ts`. */
export const EXPO_ANDROID_CHANNEL_ID = 'boardify-updates';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Noisy or self-only events — no remote push. */
const NO_PUSH_EVENT_TYPES = new Set([
  'board_created',
  'lists_reordered',
  'dashboard_updated',
  'notification_settings_updated',
]);

type Prefs = {
  pushEnabled: boolean;
};

const DEFAULT_PREFS: Prefs = { pushEnabled: true };

function parsePrefs(raw: string | null): Prefs {
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const pushEnabled = o.pushEnabled === false ? false : true;
    return { pushEnabled };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
};

function buildCopy(
  boardName: string,
  event: Record<string, unknown>
): { title: string; body: string } {
  const type = String(event.type ?? '');
  const name = boardName.trim() || 'Board';

  switch (type) {
    case 'board_updated':
      return { title: name, body: 'Board details were updated.' };
    case 'board_deleted':
      return { title: name, body: 'This board was deleted.' };
    case 'list_created':
      return { title: name, body: 'A new list was added.' };
    case 'list_updated':
      return { title: name, body: 'A list was updated.' };
    case 'list_deleted':
      return { title: name, body: 'A list was removed.' };
    case 'list_archived':
      return { title: name, body: 'A list was archived.' };
    case 'list_restored':
      return { title: name, body: 'A list was restored.' };
    case 'card_created':
      return { title: name, body: 'A new card was added.' };
    case 'card_updated':
      return { title: name, body: 'A card was updated.' };
    case 'card_deleted':
      return { title: name, body: 'A card was removed.' };
    case 'card_archived':
      return { title: name, body: 'A card was archived.' };
    case 'card_restored':
      return { title: name, body: 'A card was restored.' };
    case 'card_moved':
      return { title: name, body: 'A card was moved.' };
    default:
      return { title: name, body: 'Something changed on this board.' };
  }
}

async function postExpoBatches(messages: ExpoPushMessage[], accessToken: string | undefined): Promise<void> {
  if (!messages.length) return;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const token = accessToken?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  const chunkSize = 100;
  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ messages: chunk }),
      });
      if (!res.ok) {
        const t = await res.text();
        console.error('[boardExpoPush] Expo push HTTP error', res.status, t);
      }
    } catch (e) {
      console.error('[boardExpoPush] Expo push fetch failed', e);
    }
  }
}

export async function notifyBoardMembersExpoPush(
  env: Env,
  boardId: string,
  event: Record<string, unknown>
): Promise<void> {
  const type = String(event.type ?? '');
  if (NO_PUSH_EVENT_TYPES.has(type)) return;

  const actorRaw = event.actorUserId;
  const actorUserId =
    typeof actorRaw === 'number' && Number.isFinite(actorRaw) ? actorRaw : null;

  const board = await env.DB.prepare('SELECT name FROM boards WHERE id = ?')
    .bind(boardId)
    .first<{ name: string }>();
  if (!board) return;

  const { results: rows } = await env.DB.prepare(
    `SELECT bm.user_id as user_id, t.expo_push_token as token, n.prefs_json as prefs_json
     FROM board_members bm
     INNER JOIN user_expo_push_tokens t ON t.user_id = bm.user_id
     LEFT JOIN board_notification_settings n ON n.board_id = bm.board_id AND n.user_id = bm.user_id
     WHERE bm.board_id = ?`
  )
    .bind(boardId)
    .all<{ user_id: number; token: string; prefs_json: string | null }>();

  const { title, body } = buildCopy(board.name, event);
  const data: Record<string, unknown> = {
    boardId,
    boardName: board.name,
    eventType: type,
    ...(typeof event.cardId === 'string' ? { cardId: event.cardId } : {}),
    ...(typeof event.listId === 'string' ? { listId: event.listId } : {}),
  };

  const messages: ExpoPushMessage[] = [];
  for (const row of rows ?? []) {
    if (actorUserId != null && row.user_id === actorUserId) continue;
    const prefs = parsePrefs(row.prefs_json);
    if (!prefs.pushEnabled) continue;
    const to = row.token?.trim();
    if (!to || (!to.startsWith('ExponentPushToken[') && !to.startsWith('ExpoPushToken['))) continue;

    messages.push({
      to,
      title,
      body,
      data,
      sound: 'default',
      priority: 'high',
      channelId: EXPO_ANDROID_CHANNEL_ID,
    });
  }

  await postExpoBatches(messages, env.EXPO_ACCESS_TOKEN);
}

/** Call before `DELETE FROM boards` so members and prefs still exist. */
export async function notifyBoardDeletedExpoPush(
  env: Env,
  boardId: string,
  actorUserId: number
): Promise<void> {
  const board = await env.DB.prepare('SELECT name FROM boards WHERE id = ?')
    .bind(boardId)
    .first<{ name: string }>();
  if (!board) return;

  const event = { type: 'board_deleted', boardId, actorUserId };
  const { results: rows } = await env.DB.prepare(
    `SELECT bm.user_id as user_id, t.expo_push_token as token, n.prefs_json as prefs_json
     FROM board_members bm
     INNER JOIN user_expo_push_tokens t ON t.user_id = bm.user_id
     LEFT JOIN board_notification_settings n ON n.board_id = bm.board_id AND n.user_id = bm.user_id
     WHERE bm.board_id = ?`
  )
    .bind(boardId)
    .all<{ user_id: number; token: string; prefs_json: string | null }>();

  const { title, body } = buildCopy(board.name, event);
  const data: Record<string, unknown> = {
    boardId,
    boardName: board.name,
    eventType: 'board_deleted',
  };

  const messages: ExpoPushMessage[] = [];
  for (const row of rows ?? []) {
    if (row.user_id === actorUserId) continue;
    const prefs = parsePrefs(row.prefs_json);
    if (!prefs.pushEnabled) continue;
    const to = row.token?.trim();
    if (!to || (!to.startsWith('ExponentPushToken[') && !to.startsWith('ExpoPushToken['))) continue;

    messages.push({
      to,
      title,
      body,
      data,
      sound: 'default',
      priority: 'high',
      channelId: EXPO_ANDROID_CHANNEL_ID,
    });
  }

  await postExpoBatches(messages, env.EXPO_ACCESS_TOKEN);
}
