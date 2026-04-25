export type UserSubscriptionStatus =
  | 'free'
  | 'plus'
  | 'plus_grace'
  | 'premium'
  | 'premium_grace';

const STATUSES: ReadonlySet<UserSubscriptionStatus> = new Set([
  'free',
  'plus',
  'plus_grace',
  'premium',
  'premium_grace',
]);

export function parseUserSubscriptionStatus(raw: string | null | undefined): UserSubscriptionStatus {
  if (raw && STATUSES.has(raw as UserSubscriptionStatus)) {
    return raw as UserSubscriptionStatus;
  }
  return 'free';
}

export function hasPremiumEntitlement(status: UserSubscriptionStatus): boolean {
  return status === 'premium' || status === 'premium_grace';
}

