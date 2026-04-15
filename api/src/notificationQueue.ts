import type { Env } from './bindings';
import { insertBoardAuditLog } from './auditLog';
import { sendEmail } from './lib/email';
import { getSmtp } from './auth';
import { getAppUrlFromEnv } from './notificationEnv';
import { postExpoPushMessages, EXPO_ANDROID_CHANNEL_ID } from './boardExpoPush';
import {
  parseBoardNotificationPrefs,
  wantsDeadlineEmail,
  wantsDeadlineInApp,
  wantsDeadlinePush,
  wantsDigestEmail,
  wantsDigestInApp,
  wantsDigestPush,
} from './notificationPrefs';
import { AI_MODEL } from './aiAssist';

export type QueueJob =
  | {
      type: 'deadline_reminder';
      userId: number;
      boardId: string;
      boardName: string;
      cardId: string;
      cardTitle: string;
      dueIso: string;
    }
  | { type: 'daily_digest'; userId: number };

function decodeJob(body: unknown): QueueJob | null {
  try {
    const o = typeof body === 'string' ? JSON.parse(body) : body;
    if (!o || typeof o !== 'object') return null;
    const t = (o as { type?: string }).type;
    if (t === 'deadline_reminder') {
      const j = o as QueueJob & { type: 'deadline_reminder' };
      if (
        typeof j.userId === 'number' &&
        typeof j.boardId === 'string' &&
        typeof j.cardId === 'string' &&
        typeof j.dueIso === 'string'
      ) {
        return {
          type: 'deadline_reminder',
          userId: j.userId,
          boardId: j.boardId,
          boardName: typeof j.boardName === 'string' ? j.boardName : 'Board',
          cardId: j.cardId,
          cardTitle: typeof j.cardTitle === 'string' ? j.cardTitle : 'Card',
          dueIso: j.dueIso,
        };
      }
    }
    if (t === 'daily_digest' && typeof (o as { userId?: number }).userId === 'number') {
      return { type: 'daily_digest', userId: (o as { userId: number }).userId };
    }
  } catch {
    return null;
  }
  return null;
}

async function tryDedupe(env: Env, key: string): Promise<boolean> {
  const now = new Date().toISOString();
  const r = await env.DB.prepare('INSERT OR IGNORE INTO notification_dedupe (dedupe_key, sent_at_iso) VALUES (?, ?)')
    .bind(key, now)
    .run();
  return (r.meta?.changes ?? 0) > 0;
}

async function loadPrefs(env: Env, boardId: string, userId: number) {
  const row = await env.DB.prepare(
    'SELECT prefs_json FROM board_notification_settings WHERE board_id = ? AND user_id = ?'
  )
    .bind(boardId, userId)
    .first<{ prefs_json: string }>();
  return parseBoardNotificationPrefs(row?.prefs_json);
}

async function deadlineReminder(env: Env, job: Extract<QueueJob, { type: 'deadline_reminder' }>): Promise<void> {
  const prefs = await loadPrefs(env, job.boardId, job.userId);
  if (!prefs.dueSoon) return;

  const willPush = wantsDeadlinePush(prefs);
  const willEmail = wantsDeadlineEmail(prefs);
  const willInApp = wantsDeadlineInApp(prefs);
  if (!willPush && !willEmail && !willInApp) return;

  const day = job.dueIso.slice(0, 10);
  const dedupeKey = `deadline|${job.userId}|${job.cardId}|${day}`;
  if (!(await tryDedupe(env, dedupeKey))) return;

  const dry = (env as Env & { DIGEST_DRY_RUN?: string }).DIGEST_DRY_RUN === '1';

  const title = `Due soon: ${job.boardName}`;
  const body = `“${job.cardTitle.slice(0, 80)}${job.cardTitle.length > 80 ? '…' : ''}” · ${job.dueIso.slice(0, 16).replace('T', ' ')}`;

  if (willPush) {
    const tok = await env.DB.prepare('SELECT expo_push_token FROM user_expo_push_tokens WHERE user_id = ?')
      .bind(job.userId)
      .first<{ expo_push_token: string }>();
    const to = tok?.expo_push_token?.trim();
    if (
      to &&
      (to.startsWith('ExponentPushToken[') || to.startsWith('ExpoPushToken[')) &&
      !dry
    ) {
      await postExpoPushMessages(
        [
          {
            to,
            title,
            body,
            data: {
              boardId: job.boardId,
              boardName: job.boardName,
              cardId: job.cardId,
              eventType: 'deadline_reminder',
            },
            sound: 'default',
            priority: 'high',
            channelId: EXPO_ANDROID_CHANNEL_ID,
          },
        ],
        env.EXPO_ACCESS_TOKEN
      );
    }
  }

  if (willEmail) {
    const u = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(job.userId).first<{ email: string }>();
    const email = u?.email?.trim();
    if (email && !dry) {
      const appUrl = getAppUrlFromEnv(env);
      await sendEmail(
        {
          to: email,
          subject: title,
          text: `${body}\n\nOpen: ${appUrl}/board?id=${encodeURIComponent(job.boardId)}`,
          html: `<p>${escapeHtml(body)}</p><p><a href="${escapeAttr(`${appUrl}/board?id=${encodeURIComponent(job.boardId)}`)}">Open board</a></p>`,
        },
        getSmtp(env)
      ).catch((e: unknown) => console.error('[deadline] email', e));
    }
  }

  if (willInApp && !dry) {
    await insertBoardAuditLog(
      env,
      job.boardId,
      'deadline_reminder',
      `Reminder: “${job.cardTitle.slice(0, 120)}” is due soon`,
      null,
      { cardId: job.cardId, dueIso: job.dueIso, cardTitle: job.cardTitle, notifyUserId: job.userId }
    );
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

type DigestLine = { board: string; title: string; due: string | null; list: string };

async function loadDigestLines(env: Env, userId: number, max = 45): Promise<DigestLine[]> {
  const { results } = await env.DB.prepare(
    `SELECT c.title as title, c.due_date as due_date, b.name as board_name, l.title as list_title
     FROM cards c
     INNER JOIN lists l ON l.id = c.list_id
     INNER JOIN boards b ON b.id = l.board_id
     INNER JOIN board_members m ON m.board_id = b.id AND m.user_id = ?
     WHERE b.archived_at IS NULL AND l.archived_at IS NULL
     ORDER BY c.due_date IS NULL, c.due_date ASC, c.updated_at DESC
     LIMIT ?`
  )
    .bind(userId, max)
    .all<{ title: string; due_date: string | null; board_name: string; list_title: string }>();
  return (results ?? []).map((r) => ({
    board: r.board_name || 'Board',
    title: r.title || 'Card',
    due: r.due_date,
    list: r.list_title || '',
  }));
}

async function anyDigestChannel(env: Env, userId: number): Promise<{
  wants: boolean;
  boardIdForAudit: string | null;
}> {
  const { results } = await env.DB.prepare(
    `SELECT s.board_id as board_id, s.prefs_json as prefs_json
     FROM board_notification_settings s
     INNER JOIN board_members m ON m.board_id = s.board_id AND m.user_id = s.user_id
     INNER JOIN boards b ON b.id = s.board_id AND b.archived_at IS NULL
     WHERE s.user_id = ?`
  )
    .bind(userId)
    .all<{ board_id: string; prefs_json: string }>();

  let wants = false;
  let boardIdForAudit: string | null = null;

  for (const row of results ?? []) {
    const p = parseBoardNotificationPrefs(row.prefs_json);
    const any =
      (p.pushEnabled && p.dailyDigestPush) || p.dailyDigestEmail || p.dailyDigestInApp;
    if (any) {
      wants = true;
      if (p.dailyDigestInApp && (!boardIdForAudit || row.board_id < boardIdForAudit)) {
        boardIdForAudit = row.board_id;
      }
    }
  }
  return { wants, boardIdForAudit };
}

async function runDigestLlm(env: Env, lines: DigestLine[]): Promise<string> {
  const ai = env.AI;
  if (!ai) throw new Error('AI binding missing');
  const compact = lines.map((l) => ({
    board: l.board.slice(0, 40),
    list: l.list.slice(0, 36),
    title: l.title.slice(0, 80),
    due: l.due ? l.due.slice(0, 16) : null,
  }));
  const system =
    'You write a very short daily task digest (max 1200 characters plain text, no markdown). Be concrete; group by board; mention top due items first.';
  const user = `Tasks:\n${JSON.stringify(compact)}`;
  const raw = await ai.run(AI_MODEL as keyof AiModels, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_tokens: 500,
  } as Parameters<typeof ai.run>[1]);
  let text = '';
  if (raw != null && typeof raw === 'object' && 'response' in raw && typeof (raw as { response?: string }).response === 'string') {
    text = (raw as { response: string }).response;
  } else if (typeof raw === 'string') {
    text = raw;
  }
  const t = text.trim().slice(0, 1200);
  return t || 'No summary generated.';
}

async function dailyDigest(env: Env, job: Extract<QueueJob, { type: 'daily_digest' }>): Promise<void> {
  const { wants, boardIdForAudit } = await anyDigestChannel(env, job.userId);
  if (!wants) return;

  const { results: digestPrefRows } = await env.DB.prepare(
    `SELECT DISTINCT s.board_id, s.prefs_json
     FROM board_notification_settings s
     INNER JOIN board_members m ON m.board_id = s.board_id AND m.user_id = s.user_id
     WHERE s.user_id = ?`
  )
    .bind(job.userId)
    .all<{ board_id: string; prefs_json: string }>();

  let shouldSendDigestPush = false;
  let shouldSendDigestEmail = false;
  let shouldSendDigestInApp = false;
  for (const row of digestPrefRows ?? []) {
    const p = parseBoardNotificationPrefs(row.prefs_json);
    if (wantsDigestPush(p)) shouldSendDigestPush = true;
    if (wantsDigestEmail(p)) shouldSendDigestEmail = true;
    if (wantsDigestInApp(p)) shouldSendDigestInApp = true;
  }

  if (!shouldSendDigestPush && !shouldSendDigestEmail && !shouldSendDigestInApp) return;

  const utcDay = new Date().toISOString().slice(0, 10);
  const dedupeKey = `digest|${job.userId}|${utcDay}`;
  if (!(await tryDedupe(env, dedupeKey))) return;

  const lines = await loadDigestLines(env, job.userId);
  const dry = (env as Env & { DIGEST_DRY_RUN?: string }).DIGEST_DRY_RUN === '1';

  let summary = 'No open tasks with due dates right now — you are caught up on listed work.';
  if (lines.length > 0 && env.AI) {
    try {
      summary = await runDigestLlm(env, lines);
    } catch (e) {
      console.error('[digest] llm', e);
      summary = `You have ${lines.length} recent tasks across your boards. Open Boardify for details.`;
    }
  } else if (lines.length > 0) {
    summary = `You have ${lines.length} tasks on your boards. (AI summary unavailable.)`;
  }

  const u = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(job.userId).first<{ email: string }>();
  const appUrl = getAppUrlFromEnv(env);

  if (shouldSendDigestPush && !dry) {
    const tok = await env.DB.prepare('SELECT expo_push_token FROM user_expo_push_tokens WHERE user_id = ?')
      .bind(job.userId)
      .first<{ expo_push_token: string }>();
    const to = tok?.expo_push_token?.trim();
    if (to && (to.startsWith('ExponentPushToken[') || to.startsWith('ExpoPushToken['))) {
      const clipped = summary.slice(0, 160) + (summary.length > 160 ? '…' : '');
      await postExpoPushMessages(
        [
          {
            to,
            title: 'Daily summary',
            body: clipped,
            data: { eventType: 'daily_digest' },
            sound: 'default',
            priority: 'default',
            channelId: EXPO_ANDROID_CHANNEL_ID,
          },
        ],
        env.EXPO_ACCESS_TOKEN
      );
    }
  }

  if (shouldSendDigestEmail && u?.email && !dry) {
    await sendEmail(
      {
        to: u.email.trim(),
        subject: 'Your Boardify daily summary',
        text: `${summary}\n\n—\n${appUrl}`,
        html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5">${escapeHtml(summary).replace(/\n/g, '<br/>')}</div><p style="margin-top:16px"><a href="${escapeAttr(appUrl)}">Open Boardify</a></p>`,
      },
      getSmtp(env)
    ).catch((e: unknown) => console.error('[digest] email', e));
  }

  if (shouldSendDigestInApp && boardIdForAudit && !dry) {
    await insertBoardAuditLog(env, boardIdForAudit, 'daily_digest', summary.slice(0, 280), null, {
      summaryFull: summary.slice(0, 4000),
      digestUserId: job.userId,
    });
  }
}

export async function handleNotificationQueue(
  batch: MessageBatch<string>,
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      const job = decodeJob(msg.body);
      if (!job) {
        msg.ack();
        continue;
      }
      if (job.type === 'deadline_reminder') {
        await deadlineReminder(env, job);
      } else {
        await dailyDigest(env, job);
      }
      msg.ack();
    } catch (e) {
      console.error('[notificationQueue] job failed', e);
      msg.retry();
    }
  }
}
