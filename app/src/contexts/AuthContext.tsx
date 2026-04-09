import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCurrentUser, logout as apiLogout, User } from '../api/auth';
import { getSession } from '../api/auth';
import { getStoredSessionToken } from '../api/session';
import {
  syncPushRegistrationFromAccountPrefs,
  unregisterExpoPushFromApi,
} from '../notifications/expoPush';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  setUserContext: (user: User) => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => { },
  logout: async () => { },
  setUserContext: () => { },
});

const AUTH_USER_KEY = 'authUser';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    setLoading(true);
    try {
      const fetched = await fetchCurrentUser();
      setUser(fetched);
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(fetched));
    } catch (e: any) {
      const isAuthError = e?.status === 401 || e?.status === 403 || e?.message?.toLowerCase().includes('unauthorized');
      if (isAuthError) {
        setUser(null);
        await AsyncStorage.removeItem(AUTH_USER_KEY);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await apiLogout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      await unregisterExpoPushFromApi();
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
          const urlParams = new URLSearchParams(window.location.search);
          const token = urlParams.get('token') || urlParams.get('session_token');
          if (token) {
            const { storeSessionToken } = await import('../api/session');
            await storeSessionToken(token);
            window.history.replaceState({}, '', window.location.pathname);
          }
        }

        const cached = await AsyncStorage.getItem(AUTH_USER_KEY);
        if (cached && mounted) {
          const parsed: User = JSON.parse(cached);
          setUser(parsed);
        }

        const [session, token] = await Promise.all([getSession(), getStoredSessionToken()]);
        if (session?.session && mounted) {
          await refreshUser();
        } else if (mounted) {
          if (!cached || !token) {
            setUser(null);
            await AsyncStorage.removeItem(AUTH_USER_KEY);
          }
        }
      } catch (e) {
        if (mounted) {
          setUser(null);
          await AsyncStorage.removeItem(AUTH_USER_KEY);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user || Platform.OS === 'web') return;
    void syncPushRegistrationFromAccountPrefs();
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout, setUserContext }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
