import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, Platform, useColorScheme as useRNColorScheme } from 'react-native';
import {
  loadAccountUiPrefs,
  saveAccountUiPrefs,
  type AccountUiPrefs,
} from '../storage/accountPrefs';
import { getThemeColors, type ResolvedScheme, type ThemeColors } from './colors';

export type ThemePreference = AccountUiPrefs['theme'];

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedScheme: ResolvedScheme;
  colors: ThemeColors;
  setThemePreference: (next: ThemePreference) => Promise<void>;
  /** Re-read AsyncStorage (e.g. after external writes) */
  refreshThemeFromStorage: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(
  preference: ThemePreference,
  system: ResolvedScheme | null | undefined
): ResolvedScheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useRNColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');

  const refreshThemeFromStorage = useCallback(async () => {
    const p = await loadAccountUiPrefs();
    setPreference(p.theme);
  }, []);

  useEffect(() => {
    void refreshThemeFromStorage();
  }, [refreshThemeFromStorage]);

  const [appearanceTick, setAppearanceTick] = useState(0);
  useEffect(() => {
    const sub = Appearance.addChangeListener(() => setAppearanceTick((t) => t + 1));
    return () => sub.remove();
  }, []);

  const resolvedScheme = useMemo(() => {
    void appearanceTick;
    const sys = (systemScheme === 'dark' ? 'dark' : 'light') as ResolvedScheme;
    return resolveScheme(preference, sys);
  }, [preference, systemScheme, appearanceTick]);

  const colors = useMemo(() => getThemeColors(resolvedScheme), [resolvedScheme]);

  const setThemePreference = useCallback(async (next: ThemePreference) => {
    const current = await loadAccountUiPrefs();
    await saveAccountUiPrefs({ ...current, theme: next });
    setPreference(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedScheme,
      colors,
      setThemePreference,
      refreshThemeFromStorage,
    }),
    [preference, resolvedScheme, colors, setThemePreference, refreshThemeFromStorage]
  );

  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    // Native tabs host (react-native-screens) uses UIColor.systemBackgroundColor for its
    // container until nativeContainerStyle is wired through expo-router. Align the window
    // trait collection with the user's theme preference so system surfaces match the app.
    if (preference === 'system') {
      Appearance.setColorScheme('unspecified');
    } else if (preference === 'dark') {
      Appearance.setColorScheme('dark');
    } else {
      Appearance.setColorScheme('light');
    }
  }, [preference]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('dark', resolvedScheme === 'dark');
    root.style.backgroundColor = colors.canvas;
    if (document.body) document.body.style.backgroundColor = colors.canvas;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', colors.canvas);
  }, [resolvedScheme, colors.canvas]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

/** Safe when provider is optional (e.g. tests); returns light tokens. */
export function useThemeOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
