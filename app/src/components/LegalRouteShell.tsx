import React, { useMemo } from 'react';
import { useGlobalSearchParams, useLocalSearchParams } from 'expo-router';
import LegalDocumentScreen, { type LegalDocumentVariant } from '../screens/LegalDocumentScreen';
import { completePaywallLegalFlow } from '../utils/paywallLegalFlow';

function normalizeParam(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Detects paywall-driven legal opens and wires `beforeRemove` on the same `Stack.Screen`
 * as the document (Expo Router), avoiding `useNavigation()` from `@react-navigation/native`
 * which can throw "Couldn't find a navigation object" when contexts are duplicated.
 */
export function LegalRouteShell({ variant }: { variant: LegalDocumentVariant }) {
  const localParams = useLocalSearchParams<{ fromPaywall?: string | string[] }>();
  const globalParams = useGlobalSearchParams<{ fromPaywall?: string | string[] }>();
  const fromPaywallFlow =
    normalizeParam(localParams.fromPaywall) === '1' ||
    normalizeParam(globalParams.fromPaywall) === '1';

  const paywallLeaveListeners = useMemo(
    () =>
      fromPaywallFlow
        ? {
            beforeRemove: () => {
              completePaywallLegalFlow();
            },
          }
        : undefined,
    [fromPaywallFlow]
  );

  return <LegalDocumentScreen variant={variant} paywallLeaveListeners={paywallLeaveListeners} />;
}
