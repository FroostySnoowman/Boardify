export const PREMIUM_MONTHLY_PRODUCT_ID = 'app.mybreakpoint.boardify.ai.monthly';
export const PREMIUM_MONTHLY_PAYWALL_PRICE_DISPLAY = '$1.99';

export const PREMIUM_SUBSCRIPTION_PRODUCT_IDS = [PREMIUM_MONTHLY_PRODUCT_ID] as const;

export type PremiumSubscriptionProductId = (typeof PREMIUM_SUBSCRIPTION_PRODUCT_IDS)[number];

export function isPremiumSubscriptionProductId(id: string | undefined | null): id is PremiumSubscriptionProductId {
  return !!id && (PREMIUM_SUBSCRIPTION_PRODUCT_IDS as readonly string[]).includes(id);
}

