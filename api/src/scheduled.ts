import type { Env } from './bindings';
import { numericAssigneeUserIds } from './boards';
import type { QueueJob } from './notificationQueue';

function parsePayload(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function scanDeadlines(env: Env): Promise<void> {
  const q = env.NOTIFICATION_QUEUE;
  if (!q) return;
  const now = new Date();
  const start = now.toISOString();
  const end = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.title, c.due_date, c.payload_json, l.board_id, b.name as board_name
     FROM cards c
     INNER JOIN lists l ON l.id = c.list_id
     INNER JOIN boards b ON b.id = l.board_id
     WHERE b.archived_at IS NULL AND l.archived_at IS NULL
       AND c.due_date IS NOT NULL AND c.due_date >= ? AND c.due_date <= ?`
  )
    .bind(start, end)
    .all<{
      id: string;
      title: string;
      due_date: string;
      payload_json: string;
      board_id: string;
      board_name: string;
    }>();

  const jobs: { body: string }[] = [];
  for (const row of results ?? []) {
    const p = parsePayload(row.payload_json);
    const assignees = numericAssigneeUserIds(p.assignees);
    if (!assignees.length) continue;
    for (const userId of assignees) {
      const job: QueueJob = {
        type: 'deadline_reminder',
        userId,
        boardId: row.board_id,
        boardName: row.board_name || 'Board',
        cardId: row.id,
        cardTitle: row.title || 'Card',
        dueIso: row.due_date,
      };
      jobs.push({ body: JSON.stringify(job) });
    }
  }
  for (let i = 0; i < jobs.length; i += 100) {
    await q.sendBatch(jobs.slice(i, i + 100));
  }
}

async function enqueueDigestUsers(env: Env): Promise<void> {
  const q = env.NOTIFICATION_QUEUE;
  if (!q) return;
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT m.user_id as user_id
     FROM board_members m
     INNER JOIN boards b ON b.id = m.board_id AND b.archived_at IS NULL`
  ).all<{ user_id: number }>();
  const jobs: { body: string }[] = (results ?? []).map((r) => ({
    body: JSON.stringify({ type: 'daily_digest', userId: r.user_id } satisfies QueueJob),
  }));
  for (let i = 0; i < jobs.length; i += 100) {
    await q.sendBatch(jobs.slice(i, i + 100));
  }
}

export async function handleScheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  if (!env.NOTIFICATION_QUEUE) {
    console.warn('[scheduled] NOTIFICATION_QUEUE not bound');
    return;
  }
  const cron = event.cron;
  if (cron === '*/20 * * * *') {
    ctx.waitUntil(scanDeadlines(env));
  } else if (cron === '10 14 * * *') {
    ctx.waitUntil(enqueueDigestUsers(env));
  }
}
