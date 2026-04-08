import type { Env } from './bindings';

/** Worker → DO broadcast uses AUTH_SECRET as X-Board-Sync-Secret. */
export function getBoardBroadcastAuthSecret(env: Env): string {
  return (env.AUTH_SECRET || '').trim();
}

export async function broadcastBoardEvent(
  env: Env,
  boardId: string,
  event: { type: string; [key: string]: unknown }
): Promise<void> {
  const secret = getBoardBroadcastAuthSecret(env);
  if (!secret) return;
  if (!env.BOARD_ROOM) {
    console.warn('[boardSync] BOARD_ROOM binding missing; skipping broadcast');
    return;
  }

  const id = env.BOARD_ROOM.idFromName(boardId);
  const stub = env.BOARD_ROOM.get(id);
  const body = JSON.stringify({
    v: 1,
    ts: new Date().toISOString(),
    boardId,
    ...event,
  });

  try {
    const res = await stub.fetch('https://board-room/internal/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Board-Sync-Secret': secret,
      },
      body,
    });
    if (!res.ok) {
      const t = await res.text();
      console.error('[boardSync] broadcast failed', res.status, t);
    }
  } catch (e) {
    console.error('[boardSync] broadcast error', e);
  }
}
