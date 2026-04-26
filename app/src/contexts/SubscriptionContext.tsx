import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { getSubscriptionStatus, type SubscriptionStatus } from '../api/subscriptions';

type SubscriptionContextType = {
  isPremium: boolean;
  subscriptionStatus: SubscriptionStatus['status'];
  platform: SubscriptionStatus['platform'];
  expiresAt: string | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  isPremium: false,
  subscriptionStatus: 'free',
  platform: null,
  expiresAt: null,
  loading: true,
  refresh: async () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>({
    status: 'free',
    platform: null,
    expiresAt: null,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus({ status: 'free', platform: null, expiresAt: null });
      setLoading(false);
      return;
    }
    try {
      const next = await getSubscriptionStatus({
        includeSandbox: Platform.OS === 'ios',
      });
      setStatus(next);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => sub.remove();
  }, [user, refresh]);

  const isPremium = useMemo(() => {
    const premium = status.status === 'premium' || status.status === 'premium_grace';
    if (!premium) return false;
    if (!status.expiresAt) return true;
    return new Date(status.expiresAt).getTime() > Date.now();
  }, [status.expiresAt, status.status]);

  return (
    <SubscriptionContext.Provider
      value={{
        isPremium,
        subscriptionStatus: status.status,
        platform: status.platform,
        expiresAt: status.expiresAt,
        loading,
        refresh,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export function useCanPurchaseOnCurrentPlatform(): boolean {
  return Platform.OS === 'web' || Platform.OS === 'ios' || Platform.OS === 'android';
}

