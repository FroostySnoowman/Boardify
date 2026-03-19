import React, { useState, useCallback } from 'react';

interface PlusGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PlusGate({ children, fallback }: PlusGateProps) {
  if (children) return <>{children}</>;
  if (fallback) return <>{fallback}</>;
  return null;
}

export function usePlusGate() {
  const [showPaywall, setShowPaywall] = useState(false);

  const requirePlus = useCallback((onGranted: () => void) => {
    onGranted();
  }, []);

  return { isPlus: true, requirePlus, showPaywall, setShowPaywall, paywallElement: null };
}
