import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_BOARD_ID_KEY = '@account_default_board_id';
const ACCOUNT_UI_PREFS_KEY = '@account_ui_prefs_v1';

export type AccountUiPrefs = {
  notificationsEnabled: boolean;
  theme: 'system' | 'light' | 'dark';
};

const ACCOUNT_UI_DEFAULTS: AccountUiPrefs = {
  notificationsEnabled: true,
  theme: 'system',
};

export async function getStoredDefaultBoardId(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(DEFAULT_BOARD_ID_KEY);
    return v === '' || v == null ? null : v;
  } catch {
    return null;
  }
}

export async function setStoredDefaultBoardId(id: string | null): Promise<void> {
  try {
    if (id == null) {
      await AsyncStorage.removeItem(DEFAULT_BOARD_ID_KEY);
    } else {
      await AsyncStorage.setItem(DEFAULT_BOARD_ID_KEY, id);
    }
  } catch {
    // ignore
  }
}

export async function loadAccountUiPrefs(): Promise<AccountUiPrefs> {
  try {
    const raw = await AsyncStorage.getItem(ACCOUNT_UI_PREFS_KEY);
    if (!raw) return { ...ACCOUNT_UI_DEFAULTS };
    const p = JSON.parse(raw) as Partial<AccountUiPrefs>;
    return {
      notificationsEnabled:
        typeof p.notificationsEnabled === 'boolean'
          ? p.notificationsEnabled
          : ACCOUNT_UI_DEFAULTS.notificationsEnabled,
      theme:
        p.theme === 'light' || p.theme === 'dark' || p.theme === 'system'
          ? p.theme
          : ACCOUNT_UI_DEFAULTS.theme,
    };
  } catch {
    return { ...ACCOUNT_UI_DEFAULTS };
  }
}

export async function saveAccountUiPrefs(prefs: AccountUiPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(ACCOUNT_UI_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}
