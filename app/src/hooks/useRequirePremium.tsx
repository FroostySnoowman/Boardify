import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSubscription } from '../contexts/SubscriptionContext';
import AiPaywallScreen from '../screens/AiPaywallScreen';

export function useRequirePremium() {
  const { isPremium, loading, refresh } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const pendingOnAllowedRef = useRef<(() => void) | null>(null);

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

  return {
    requirePremium,
    paywallElement: <AiPaywallScreen visible={showPaywall} onClose={handlePaywallClose} />,
    isPremium,
    subscriptionLoading: loading,
  };
}

