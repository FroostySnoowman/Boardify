export type UserSubscriptionStatus = 'free' | 'premium' | 'premium_grace';

const PREMIUM_PRODUCT_IDS = new Set([
  'app.mybreakpoint.boardify.ai.monthly',
  'boardify_ai_monthly',
  'premium_monthly',
]);

export function subscriptionProductTier(productId: string | null | undefined): 'premium' {
  if (productId && PREMIUM_PRODUCT_IDS.has(productId)) return 'premium';
  return 'premium';
}

export function subscriptionRowToApiStatus(row: {
  status: 'active' | 'grace_period';
  product_id: string | null;
}): 'premium' | 'premium_grace' {
  const _isPremium = subscriptionProductTier(row.product_id) === 'premium';
  if (_isPremium && row.status === 'active') return 'premium';
  return 'premium_grace';
}

function buildSandboxFilter(options?: { includeIosSandbox?: boolean }): string {
  if (options?.includeIosSandbox) return '';
  return `AND (platform != 'ios' OR COALESCE(apple_environment, 'Production') != 'Sandbox')`;
}

export async function computeUserSubscriptionStatus(
  db: D1Database,
  userId: number,
  options?: { includeIosSandbox?: boolean }
): Promise<UserSubscriptionStatus> {
  const active = await db
    .prepare(
      `SELECT status, product_id
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
    .first<{ status: 'active' | 'grace_period'; product_id: string | null }>();

  if (!active) return 'free';
  return subscriptionRowToApiStatus(active);
}

export async function syncUserSubscriptionStatus(
  db: D1Database,
  userId: number,
  nowIso: string,
  options?: { includeIosSandbox?: boolean }
): Promise<UserSubscriptionStatus> {
  const nextStatus = await computeUserSubscriptionStatus(db, userId, options);
  await db
    .prepare(
      `UPDATE users
       SET subscription_status = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(nextStatus, nowIso, userId)
    .run();
  return nextStatus;
}

