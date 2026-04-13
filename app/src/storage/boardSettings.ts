import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BoardViewMode, TaskLabel } from '../types/board';

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
  boardLabels: TaskLabel[];
  boardPriorities: TaskLabel[];
};

export const DEFAULT_BOARD_LABELS: TaskLabel[] = [
  { id: 'lp-1', name: 'Design', color: '#F3D9B1' },
  { id: 'lp-2', name: 'Engineering', color: '#a5d6a5' },
  { id: 'lp-3', name: 'Bug', color: '#fca5a5' },
  { id: 'lp-4', name: 'Docs', color: '#b8c5ff' },
  { id: 'lp-5', name: 'Urgent', color: '#fbbf24' },
];

export const DEFAULT_BOARD_PRIORITIES: TaskLabel[] = [
  { id: 'pp-1', name: 'Low', color: '#c7d2fe' },
  { id: 'pp-2', name: 'Medium', color: '#fde68a' },
  { id: 'pp-3', name: 'High', color: '#fdba74' },
  { id: 'pp-4', name: 'Critical', color: '#fca5a5' },
];

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
  boardLabels: DEFAULT_BOARD_LABELS,
  boardPriorities: DEFAULT_BOARD_PRIORITIES,
};

function storageKey(boardName: string): string {
  const slug = boardName.trim().replace(/\s+/g, '_').slice(0, 80) || 'board';
  return `${STORAGE_PREFIX}${slug}`;
}

function normalizeTaskLabels(input: unknown, fallback: TaskLabel[]): TaskLabel[] {
  if (!Array.isArray(input)) return fallback.map((x) => ({ ...x }));
  const out: TaskLabel[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const id = typeof (item as { id?: unknown }).id === 'string' ? (item as { id: string }).id : '';
    const name =
      typeof (item as { name?: unknown }).name === 'string' ? (item as { name: string }).name.trim() : '';
    const color =
      typeof (item as { color?: unknown }).color === 'string' ? (item as { color: string }).color : '';
    if (!id || !name || !color) continue;
    out.push({ id, name, color });
  }
  if (out.length === 0) return fallback.map((x) => ({ ...x }));
  return out;
}

function withNormalizedBoardSettings(input: Partial<BoardSettings>): BoardSettings {
  return {
    ...BOARD_SETTINGS_DEFAULTS,
    ...input,
    boardLabels: normalizeTaskLabels(input.boardLabels, DEFAULT_BOARD_LABELS),
    boardPriorities: normalizeTaskLabels(input.boardPriorities, DEFAULT_BOARD_PRIORITIES),
    version: 1,
  };
}

export async function loadBoardSettings(boardName: string): Promise<BoardSettings> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(boardName));
    if (!raw) return { ...BOARD_SETTINGS_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<BoardSettings>;
    return withNormalizedBoardSettings(parsed);
  } catch {
    return withNormalizedBoardSettings({});
  }
}

export async function mergeBoardSettings(
  boardName: string,
  patch: Partial<BoardSettings>
): Promise<BoardSettings> {
  const cur = await loadBoardSettings(boardName);
  const next: BoardSettings = withNormalizedBoardSettings({ ...cur, ...patch });
  await AsyncStorage.setItem(storageKey(boardName), JSON.stringify(next));
  return next;
}

export function resolveBoardDisplayTitle(routeBoardName: string, settings: BoardSettings): string {
  const custom = settings.boardDisplayTitle?.trim();
  if (custom) return custom;
  const route = routeBoardName.trim();
  return route || 'My Board';
}

export function mergeBoardSettingsFromRemoteJson(settingsJson: string | null | undefined): BoardSettings {
  if (settingsJson == null || settingsJson === '') {
    return withNormalizedBoardSettings({});
  }
  try {
    const parsed =
      typeof settingsJson === 'string' ? (JSON.parse(settingsJson) as Partial<BoardSettings>) : settingsJson;
    return withNormalizedBoardSettings(parsed);
  } catch {
    return withNormalizedBoardSettings({});
  }
}
