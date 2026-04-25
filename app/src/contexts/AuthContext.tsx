import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCurrentUser, logout as apiLogout, User } from '../api/auth';
import { clearSessionToken, getStoredSessionToken } from '../api/session';
import {
  syncPushRegistrationFromAccountPrefs,
  unregisterExpoPushFromApi,
} from '../notifications/expoPush';
import { clearInboxMemoryCache } from '../storage/messagesInboxCache';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  refreshUser: (opts?: { silent?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  setUserContext: (user: User) => void;
  invalidateLocalAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => { },
  logout: async () => { },
  setUserContext: () => { },
  invalidateLocalAuth: async () => { },
});

const AUTH_USER_KEY = 'authUser';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const invalidateLocalAuth = useCallback(async () => {
    clearInboxMemoryCache();
    await clearSessionToken();
    setUser(null);
    await AsyncStorage.removeItem(AUTH_USER_KEY);
  }, []);

  const refreshUser = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    try {
      const fetched = await fetchCurrentUser();
      setUser(fetched);
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(fetched));
    } catch (e: any) {
      const isAuthError =
        e?.status === 401 ||
        e?.status === 403 ||
        String(e?.message ?? '')
          .toLowerCase()
          .includes('unauthorized');
      if (isAuthError) {
        clearInboxMemoryCache();
        setUser(null);
        await AsyncStorage.removeItem(AUTH_USER_KEY);
        await clearSessionToken();
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const logout = async () => {
    setLoading(true);
    try {
      await apiLogout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      await unregisterExpoPushFromApi();
      clearInboxMemoryCache();
      setUser(null);
      await AsyncStorage.removeItem(AUTH_USER_KEY);
      setLoading(false);
    }
  };

  const setUserContext = async (u: User) => {
    setUser(u);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(u));
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const path = window.location.pathname.replace(/\/+$/, '') || '/';
          const isEmailVerificationRoute = path === '/verify-email' || path.endsWith('/verify-email');
          if (!isEmailVerificationRoute) {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token') || urlParams.get('session_token');
            if (token) {
              const { storeSessionToken } = await import('../api/session');
              await storeSessionToken(token);
              window.history.replaceState({}, '', window.location.pathname);
            }
          }
        }

        const token = await getStoredSessionToken();
        const cached = await AsyncStorage.getItem(AUTH_USER_KEY);
        if (cached && mounted) {
          try {
            setUser(JSON.parse(cached) as User);
          } catch {
            // ignore
          }
        }

        if (!token) {
          if (mounted) {
            clearInboxMemoryCache();
            setUser(null);
            await AsyncStorage.removeItem(AUTH_USER_KEY);
          }
          return;
        }

        await refreshUser({ silent: true });
      } catch {
        if (mounted) {
          clearInboxMemoryCache();
          setUser(null);
          await AsyncStorage.removeItem(AUTH_USER_KEY);
          await clearSessionToken();
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void checkSession();

    return () => {
      mounted = false;
    };
  }, [refreshUser]);

  useEffect(() => {
    if (!user || Platform.OS === 'web') return;
    void syncPushRegistrationFromAccountPrefs();
  }, [user?.id]);

  return (
    <AuthContext.Provider
      value={{ user, loading, refreshUser, logout, setUserContext, invalidateLocalAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
