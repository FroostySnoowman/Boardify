import type { Env } from './bindings';

export function auditNowIso(): string {
  return new Date().toISOString();
}

export async function insertBoardAuditLog(
  env: Env,
  boardId: string,
  kind: string,
  summary: string,
  actorUserId: number | null,
  metadata?: unknown
): Promise<void> {
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO board_audit_log (id, board_id, at_iso, kind, summary, actor_user_id, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      boardId,
      auditNowIso(),
      kind,
      summary,
      actorUserId,
      metadata != null ? JSON.stringify(metadata) : null
    )
    .run();
}
