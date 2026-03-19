import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { getSubscriptionStatus, verifyPurchase, SubscriptionStatus } from '../api/subscriptions';
import { getIapErrorDetails, isAlreadyOwnedPurchaseError, isUserCancelledPurchaseError } from '../utils/iap';
import { ENV } from '../config/env';

const PLUS_PRODUCT_ID = 'app.mybreakpoint.plus.monthly';
const REFRESH_DEBOUNCE_MS = 30_000;
const STORE_SYNC_DEBOUNCE_MS = 45_000;
const PLUS_WELCOME_ARMED_KEY = 'plus_welcome_armed';
const PAYWALL_PURCHASE_CANCELLED_KEY = 'paywall_purchase_cancelled';

function decodeJwsPayload(jws: string): any | null {
  try {
    const parts = jws.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (payload.length % 4)) % 4);
    if (typeof atob !== 'function') return null;
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

type SubscriptionContextType = {
  isPlus: boolean;
  subscriptionStatus: SubscriptionStatus['status'];
  platform: SubscriptionStatus['platform'];
  expiresAt: string | null;
  environment: SubscriptionStatus['environment'] | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  isPlus: false,
  subscriptionStatus: 'free',
  platform: null,
  expiresAt: null,
  environment: null,
  loading: true,
  refresh: async () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>({
    status: 'free',
    platform: null,
    expiresAt: null,
    environment: null,
  });
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);
  const lastRefreshRef = useRef(0);
  const lastStoreSyncRef = useRef(0);
  const storeSyncInFlightRef = useRef(false);
  const ownedRecoveryInFlightRef = useRef(false);
  const lastOwnedRecoveryAtRef = useRef(0);
  const expectedIosEnvironment = ENV.INCLUDE_SANDBOX_SUBSCRIPTIONS ? 'Sandbox' : 'Production';
  const iosEnvironmentRef = useRef<'Sandbox' | 'Production'>(expectedIosEnvironment);

  const refresh = useCallback(async () => {
    lastRefreshRef.current = Date.now();
    try {
      const data = await getSubscriptionStatus({
        ...(Platform.OS === 'ios' ? { iosEnvironment: iosEnvironmentRef.current } : {}),
      });
      setStatus(data);
    } catch {
      // keep current state on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || Platform.OS === 'web') return;

    let cancelled = false;

    const syncStoreSubscription = async (force = false) => {
      if (storeSyncInFlightRef.current) return;
      const now = Date.now();
      if (!force && now - lastStoreSyncRef.current < STORE_SYNC_DEBOUNCE_MS) return;
      lastStoreSyncRef.current = now;
      storeSyncInFlightRef.current = true;
      try {
        const RNIap = await import('react-native-iap');
        await RNIap.initConnection();
        const purchases = await RNIap.getAvailablePurchases();
        if (cancelled) return;
        const list = Array.isArray(purchases) ? purchases : [];
        const match = list.find((p: any) => p.productId === PLUS_PRODUCT_ID);
        const receipt = match?.purchaseToken;
        if (!receipt) {
          iosEnvironmentRef.current = expectedIosEnvironment;
          await refresh();
          return;
        }
        if (Platform.OS === 'ios') {
          const payload = decodeJwsPayload(String(receipt));
          const tokenEnv = String(payload?.environment || '').toLowerCase();
          if (tokenEnv === 'sandbox') iosEnvironmentRef.current = 'Sandbox';
          if (tokenEnv === 'production') iosEnvironmentRef.current = 'Production';
        }
        const verify = await verifyPurchase({
          platform: Platform.OS as 'ios' | 'android',
          ...(Platform.OS === 'ios' ? { receipt } : { purchaseToken: receipt }),
          productId: PLUS_PRODUCT_ID,
        });
        if (Platform.OS === 'ios' && verify.environment) {
          iosEnvironmentRef.current = verify.environment;
        }
        await refresh();
      } catch (error: any) {
        if (error?.status !== 409) {
          console.warn('[SubscriptionContext] automatic subscription sync failed:', getIapErrorDetails(error));
        }
      } finally {
        storeSyncInFlightRef.current = false;
      }
    };

    void syncStoreSubscription(true);
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void syncStoreSubscription();
      }
    });
    return () => {
      cancelled = true;
      appStateSub.remove();
    };
  }, [user, refresh]);

  useEffect(() => {
    if (user && !fetchedRef.current) {
      fetchedRef.current = true;
      refresh();
    }
    if (!user) {
      fetchedRef.current = false;
      setStatus({ status: 'free', platform: null, expiresAt: null, environment: null });
      setLoading(false);
    }
  }, [user, refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && user && Date.now() - lastRefreshRef.current > REFRESH_DEBOUNCE_MS) {
        refresh();
      }
    });
    return () => subscription.remove();
  }, [user, refresh]);

  useEffect(() => {
    if (!user || Platform.OS === 'web') return;

    let purchaseSub: { remove: () => void } | undefined;
    let errorSub: { remove: () => void } | undefined;
    let torn = false;

    (async () => {
      try {
        const RNIap = await import('react-native-iap');
        if (torn) return;

        await RNIap.initConnection();

        purchaseSub = RNIap.purchaseUpdatedListener(async (purchase: any) => {
          const normalized = Array.isArray(purchase) ? purchase[0] : purchase?.purchase ?? purchase;
          if (!normalized) return;

          const receipt = normalized.purchaseToken;

          if (receipt) {
            try {
              await verifyPurchase({
                platform: Platform.OS as 'ios' | 'android',
                ...(Platform.OS === 'ios' ? { receipt } : { purchaseToken: receipt }),
                productId: PLUS_PRODUCT_ID,
              });
              if (Platform.OS === 'ios') {
                const payload = decodeJwsPayload(String(receipt));
                const tokenEnv = String(payload?.environment || '').toLowerCase();
                if (tokenEnv === 'sandbox') iosEnvironmentRef.current = 'Sandbox';
                if (tokenEnv === 'production') iosEnvironmentRef.current = 'Production';
              }
              const armed = await AsyncStorage.getItem(PLUS_WELCOME_ARMED_KEY);
              const reasonText = String(
                normalized?.reasonStringRepresentationIOS ??
                normalized?.transactionReasonIOS ??
                normalized?.reasonIOS ??
                ''
              ).toLowerCase();
              const isRenewal = reasonText.includes('renewal');
              if (armed === '1' && !isRenewal) {
                await AsyncStorage.setItem('plus_welcome_pending', '1');
                await AsyncStorage.removeItem(PLUS_WELCOME_ARMED_KEY);
              }
            } catch { /* verification logged server-side */ }
          }

          try {
            await RNIap.finishTransaction({ purchase: normalized, isConsumable: false });
          } catch { /* idempotent -- PaywallScreen may finish first */ }

          refresh();
        });

        errorSub = RNIap.purchaseErrorListener((error: any) => {
          if (isUserCancelledPurchaseError(error)) {
            console.log('[SubscriptionContext] purchase cancelled by user:', getIapErrorDetails(error));
            AsyncStorage.setItem(PAYWALL_PURCHASE_CANCELLED_KEY, '1').catch(() => {});
            return;
          }
          if (isAlreadyOwnedPurchaseError(error)) {
            if (ownedRecoveryInFlightRef.current) return;
            const now = Date.now();
            if (now - lastOwnedRecoveryAtRef.current < 5_000) return;
            lastOwnedRecoveryAtRef.current = now;
            ownedRecoveryInFlightRef.current = true;
            (async () => {
              try {
                const purchases = await RNIap.getAvailablePurchases();
                const list = Array.isArray(purchases) ? purchases : [];
                const match = list.find((p: any) => p.productId === PLUS_PRODUCT_ID);
                const receipt = match?.purchaseToken;
                if (!receipt) {
                  await refresh();
                  return;
                }
                const verify = await verifyPurchase({
                  platform: Platform.OS as 'ios' | 'android',
                  ...(Platform.OS === 'ios' ? { receipt } : { purchaseToken: receipt }),
                  productId: PLUS_PRODUCT_ID,
                });
                if (Platform.OS === 'ios' && verify.environment) {
                  iosEnvironmentRef.current = verify.environment;
                }
                await refresh();
              } catch (recoveryError) {
                console.warn('[SubscriptionContext] already-owned recovery failed:', getIapErrorDetails(recoveryError));
              } finally {
                ownedRecoveryInFlightRef.current = false;
              }
            })();
            return;
          }
          console.warn('[SubscriptionContext] purchase listener error:', getIapErrorDetails(error));
        });
      } catch { /* react-native-iap not available on this platform */ }
    })();

    return () => {
      torn = true;
      purchaseSub?.remove();
      errorSub?.remove();
    };
  }, [user, refresh]);

  const effectiveStatus = (() => {
    if (
      (status.status === 'plus' || status.status === 'plus_grace') &&
      status.expiresAt &&
      new Date(status.expiresAt).getTime() < Date.now()
    ) {
      return 'free' as const;
    }
    return status.status;
  })();

  const isPlus = effectiveStatus === 'plus' || effectiveStatus === 'plus_grace';

  return (
    <SubscriptionContext.Provider
      value={{
        isPlus,
        subscriptionStatus: effectiveStatus,
        platform: status.platform,
        expiresAt: status.expiresAt,
        environment: status.environment ?? null,
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
