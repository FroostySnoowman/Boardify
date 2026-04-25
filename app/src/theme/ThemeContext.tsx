import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Appearance, Platform, useColorScheme as useRNColorScheme } from 'react-native';
import {
  loadAccountUiPrefs,
  saveAccountUiPrefs,
  type AccountUiPrefs,
} from '../storage/accountPrefs';
import { getThemeColors, type ResolvedScheme, type ThemeColors } from './colors';
import * as SystemUI from 'expo-system-ui';

export type ThemePreference = AccountUiPrefs['theme'];

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedScheme: ResolvedScheme;
  colors: ThemeColors;
  setThemePreference: (next: ThemePreference) => Promise<void>;
  refreshThemeFromStorage: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(
  preference: ThemePreference,
  system: ResolvedScheme | null | undefined
): ResolvedScheme {
  if (preference === 'light' || preference === 'dark') return preference;
  const s =
    system === 'dark' || system === 'light'
      ? system
      : ((Appearance.getColorScheme() === 'dark' ? 'dark' : 'light') as ResolvedScheme);
  return s;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useRNColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const prevPreferenceRef = useRef<ThemePreference | null>(null);

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
    const fromHook =
      systemScheme === 'dark' || systemScheme === 'light'
        ? (systemScheme as ResolvedScheme)
        : null;
    return resolveScheme(preference, fromHook);
  }, [preference, systemScheme, appearanceTick]);

  const colors = useMemo(() => getThemeColors(resolvedScheme), [resolvedScheme]);

  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    void SystemUI.setBackgroundColorAsync(colors.canvas);
  }, [colors.canvas]);

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
    const prev = prevPreferenceRef.current;
    prevPreferenceRef.current = preference;

    if (preference === 'system') {
      if (prev === 'light' || prev === 'dark') {
        Appearance.setColorScheme('unspecified');
      }
      return;
    }
    if (preference === 'dark') {
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

export function useThemeOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
