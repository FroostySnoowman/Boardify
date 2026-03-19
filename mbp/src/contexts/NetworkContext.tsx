import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { setNetworkConnected } from '../network/networkState';
import { syncPendingOfflineMatches, getPendingSyncQueue } from '../utils/offlineMatchStorage';

interface NetworkContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;
  refreshPendingCount: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  isSyncing: false,
  pendingSyncCount: 0,
  refreshPendingCount: async () => {},
});

async function getPendingSyncCount(): Promise<number> {
  const queue = await getPendingSyncQueue();
  return queue.length;
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingSyncCount();
    setPendingSyncCount(count);
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = state.isConnected === true && state.isInternetReachable !== false;
      setNetworkConnected(connected);
      setIsOnline(connected);

      if (connected) {
        setIsSyncing(true);
        syncPendingOfflineMatches()
          .then(async () => {
            await refreshPendingCount();
          })
          .finally(() => setIsSyncing(false));
      }
    });

    NetInfo.fetch().then((state: NetInfoState) => {
      const connected = state.isConnected === true && state.isInternetReachable !== false;
      setNetworkConnected(connected);
      setIsOnline(connected);
    });

    if (Platform.OS !== 'web') {
      getPendingSyncCount().then(setPendingSyncCount);
    }

    return () => unsubscribe();
  }, [refreshPendingCount]);

  return (
    <NetworkContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingSyncCount,
        refreshPendingCount,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
