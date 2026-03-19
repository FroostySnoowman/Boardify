import { nativeFetch } from './http';

export interface SubscriptionStatus {
  status: 'free' | 'plus' | 'plus_grace';
  platform: 'ios' | 'android' | 'stripe' | null;
  expiresAt: string | null;
  environment?: 'Sandbox' | 'Production' | null;
}

export async function getSubscriptionStatus(options?: {
  includeSandbox?: boolean;
  iosEnvironment?: 'Sandbox' | 'Production';
}): Promise<SubscriptionStatus> {
  const res = await nativeFetch('/subscriptions/status', {
    method: 'GET',
    params: {
      ...(options?.includeSandbox ? { includeSandbox: 1 } : {}),
      ...(options?.iosEnvironment ? { iosEnvironment: options.iosEnvironment } : {}),
    },
  });
  return (res.data || { status: 'free', platform: null, expiresAt: null, environment: null }) as SubscriptionStatus;
}

export async function verifyPurchase(params: {
  platform: 'ios' | 'android';
  receipt?: string;
  purchaseToken?: string;
  productId?: string;
}): Promise<{ status: string; expiresAt?: string; environment?: 'Sandbox' | 'Production' }> {
  const res = await nativeFetch('/subscriptions/verify', {
    method: 'POST',
    data: params,
  });
  return res.data;
}

export async function createCheckoutSession(): Promise<{ url: string; sessionId: string }> {
  const res = await nativeFetch('/subscriptions/create-checkout', {
    method: 'POST',
  });
  return res.data;
}

export async function createPortalSession(): Promise<{ url: string }> {
  const res = await nativeFetch('/subscriptions/portal', {
    method: 'POST',
  });
  return res.data;
}

export async function resetSandboxSubscription(): Promise<{ success: boolean; removedCount: number }> {
  const res = await nativeFetch('/subscriptions/reset-sandbox', {
    method: 'POST',
  });
  return res.data;
}
