import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_BOARD_ID_KEY = '@account_default_board_id';

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
