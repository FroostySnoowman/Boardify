import React, { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useRouter } from 'expo-router';
import { useSubscription } from '../contexts/SubscriptionContext';
import AiPaywallScreen from '../screens/AiPaywallScreen';
import { armPaywallReopenAfterLegal, disarmPaywallReopenAfterLegal } from '../utils/paywallLegalFlow';

type LegalPath = '/terms' | '/privacy';

export function useRequirePremium() {
  const router = useRouter();
  const { isPremium, loading, refresh } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const pendingOnAllowedRef = useRef<(() => void) | null>(null);
  const pendingLegalPathRef = useRef<LegalPath | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      disarmPaywallReopenAfterLegal();
    };
  }, []);

  const handlePaywallClose = useCallback(() => {
    setShowPaywall(false);
    void refresh();
  }, [refresh]);

  const requirePremium = useCallback(
    (onAllowed: () => void) => {
      if (isPremium) {
        onAllowed();
        return;
      }
      if (loading) return;
      pendingOnAllowedRef.current = onAllowed;
      setShowPaywall(true);
    },
    [isPremium, loading]
  );

  useEffect(() => {
    if (showPaywall || !pendingOnAllowedRef.current) return;
    const fn = pendingOnAllowedRef.current;
    pendingOnAllowedRef.current = null;
    if (isPremium) fn();
  }, [showPaywall, isPremium]);

  const openLegalFromPaywall = useCallback(
    (path: LegalPath) => {
      armPaywallReopenAfterLegal(() => {
        requestAnimationFrame(() => {
          InteractionManager.runAfterInteractions(() => {
            if (mountedRef.current) setShowPaywall(true);
          });
        });
      });
      pendingLegalPathRef.current = path;
      setShowPaywall(false);
    },
    []
  );

  useEffect(() => {
    if (showPaywall) return;
    const path = pendingLegalPathRef.current;
    if (!path) return;
    pendingLegalPathRef.current = null;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const pushedRef = { current: false };

    const interactionTask = InteractionManager.runAfterInteractions(() => {
      timeoutId = setTimeout(() => {
        if (cancelled) {
          if (!pushedRef.current) {
            disarmPaywallReopenAfterLegal();
            if (mountedRef.current) setShowPaywall(true);
          }
          return;
        }
        try {
          const href = path === '/terms' ? '/terms?fromPaywall=1' : '/privacy?fromPaywall=1';
          router.push(href as '/terms?fromPaywall=1' | '/privacy?fromPaywall=1');
          pushedRef.current = true;
        } catch {
          disarmPaywallReopenAfterLegal();
          if (mountedRef.current) setShowPaywall(true);
        }
      }, 120);
    });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      interactionTask.cancel?.();
      if (!pushedRef.current) disarmPaywallReopenAfterLegal();
    };
  }, [showPaywall, router]);

  return {
    requirePremium,
    paywallElement: (
      <AiPaywallScreen
        visible={showPaywall}
        onClose={handlePaywallClose}
        onOpenLegalFromPaywall={openLegalFromPaywall}
      />
    ),
    isPremium,
    subscriptionLoading: loading,
  };
}

