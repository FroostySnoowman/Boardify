import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCurrentUser, logout as apiLogout, User } from '../api/auth';
import { getSession } from '../api/auth';
import { getStoredSessionToken } from '../api/session';

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
      // Only clear user on auth errors (e.g. session expired). Keep cached user on network errors (offline).
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

    // Check for existing session on mount
    const checkSession = async () => {
      try {
        // On web, check for token in URL parameters (OAuth callback)
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const token = urlParams.get('token') || urlParams.get('session_token');
          if (token) {
            // Store the token from URL
            const { storeSessionToken } = await import('../api/session');
            await storeSessionToken(token);
            // Clean up URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }
        }

        // First try to load from cache for fast startup
        const cached = await AsyncStorage.getItem(AUTH_USER_KEY);
        if (cached && mounted) {
          const parsed: User = JSON.parse(cached);
          setUser(parsed);
        }

        // Then verify with server (skip when offline so we keep cached user)
        const [session, token] = await Promise.all([getSession(), getStoredSessionToken()]);
        if (session?.session && mounted) {
          await refreshUser();
        } else if (mounted) {
          if (!cached || !token) {
            setUser(null);
            await AsyncStorage.removeItem(AUTH_USER_KEY);
          }
          // If we have cached user + token but no session, we're likely offline — keep cached user
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

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout, setUserContext }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
