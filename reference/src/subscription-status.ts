export type UserSubscriptionStatus = 'free' | 'plus' | 'plus_grace'

type SyncUserSubscriptionStatusOptions = {
  includeIosSandbox?: boolean
}

function buildSandboxFilter(options?: SyncUserSubscriptionStatusOptions): string {
  if (options?.includeIosSandbox) return ''
  return `AND (platform != 'ios' OR COALESCE(apple_environment, 'Production') != 'Sandbox')`
}

export async function computeUserSubscriptionStatus(
  db: D1Database,
  userId: number,
  options?: SyncUserSubscriptionStatusOptions
): Promise<UserSubscriptionStatus> {
  const active = await db
    .prepare(
      `SELECT status
       FROM subscriptions
       WHERE user_id = ?
         AND status IN ('active', 'grace_period')
         ${buildSandboxFilter(options)}
       ORDER BY
         CASE status WHEN 'active' THEN 0 ELSE 1 END,
         created_at DESC
       LIMIT 1`
    )
    .bind(userId)
    .first<{ status: 'active' | 'grace_period' }>()

  if (!active) return 'free'
  return active.status === 'active' ? 'plus' : 'plus_grace'
}

export async function syncUserSubscriptionStatus(
  db: D1Database,
  userId: number,
  nowIso: string,
  options?: SyncUserSubscriptionStatusOptions
): Promise<UserSubscriptionStatus> {
  const nextStatus = await computeUserSubscriptionStatus(db, userId, options)
  await db
    .prepare(
      `UPDATE users
       SET subscription_status = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(nextStatus, nowIso, userId)
    .run()
  return nextStatus
}
