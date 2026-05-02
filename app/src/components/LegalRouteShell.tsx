import React, { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import LegalDocumentScreen, { type LegalDocumentVariant } from '../screens/LegalDocumentScreen';
import { completePaywallLegalFlow } from '../utils/paywallLegalFlow';

/**
 * Completes the paywall return when this sheet loses focus (swipe / pop). Safe for all
 * entry paths: `completePaywallLegalFlow` is a no-op unless the paywall armed a reopen.
 */
export function LegalRouteShell({ variant }: { variant: LegalDocumentVariant }) {
  const blurCompleteOkRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      blurCompleteOkRef.current = false;
      const timeoutId = setTimeout(() => {
        if (!cancelled) blurCompleteOkRef.current = true;
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
        if (blurCompleteOkRef.current) {
          completePaywallLegalFlow();
        }
      };
    }, [])
  );

  return <LegalDocumentScreen variant={variant} />;
}
