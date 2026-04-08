import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BoardViewMode } from '../types/board';

const STORAGE_PREFIX = 'bb_board_settings_v1_';

export type BoardSettings = {
  version: 1;
  boardDisplayTitle?: string;
  boardDescription: string;
  defaultView?: BoardViewMode;
  hapticsEnabled: boolean;
  confirmBeforeDestructive: boolean;
  weekStartsOn: 'monday' | 'sunday';
  compactCardDensity: boolean;
  showAssigneeAvatars: boolean;
  dailyDigestReminder: boolean;
  autoOpenCardDetails: boolean;
  focusModeByDefault: boolean;
};

export const BOARD_SETTINGS_DEFAULTS: BoardSettings = {
  version: 1,
  boardDescription: '',
  defaultView: undefined,
  hapticsEnabled: true,
  confirmBeforeDestructive: false,
  weekStartsOn: 'monday',
  compactCardDensity: false,
  showAssigneeAvatars: true,
  dailyDigestReminder: false,
  autoOpenCardDetails: false,
  focusModeByDefault: false,
};

function storageKey(boardName: string): string {
  const slug = boardName.trim().replace(/\s+/g, '_').slice(0, 80) || 'board';
  return `${STORAGE_PREFIX}${slug}`;
}

export async function loadBoardSettings(boardName: string): Promise<BoardSettings> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(boardName));
    if (!raw) return { ...BOARD_SETTINGS_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<BoardSettings>;
    return {
      ...BOARD_SETTINGS_DEFAULTS,
      ...parsed,
      version: 1,
    };
  } catch {
    return { ...BOARD_SETTINGS_DEFAULTS };
  }
}

export async function mergeBoardSettings(
  boardName: string,
  patch: Partial<BoardSettings>
): Promise<BoardSettings> {
  const cur = await loadBoardSettings(boardName);
  const next: BoardSettings = { ...cur, ...patch, version: 1 };
  await AsyncStorage.setItem(storageKey(boardName), JSON.stringify(next));
  return next;
}

export function resolveBoardDisplayTitle(routeBoardName: string, settings: BoardSettings): string {
  const custom = settings.boardDisplayTitle?.trim();
  if (custom) return custom;
  const route = routeBoardName.trim();
  return route || 'My Board';
}
