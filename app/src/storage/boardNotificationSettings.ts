import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'bb_board_notifications_v1_';

export type BoardNotificationSettings = {
  version: 1;
  pushEnabled: boolean;
  emailDigest: boolean;
  mentionYou: boolean;
  assignedCard: boolean;
  dueSoon: boolean;
  commentsFollowed: boolean;
  quietHours: boolean;
  quietFromMinutes: number;
  quietUntilMinutes: number;
  deadlineRemindPush: boolean;
  deadlineRemindEmail: boolean;
  deadlineRemindInApp: boolean;
  dailyDigestPush: boolean;
  dailyDigestEmail: boolean;
  dailyDigestInApp: boolean;
  dailyDigestLocalMinutes?: number;
};

export const BOARD_NOTIFICATION_DEFAULTS: BoardNotificationSettings = {
  version: 1,
  pushEnabled: true,
  emailDigest: false,
  mentionYou: true,
  assignedCard: true,
  dueSoon: true,
  commentsFollowed: false,
  quietHours: false,
  quietFromMinutes: 22 * 60,
  quietUntilMinutes: 8 * 60,
  deadlineRemindPush: true,
  deadlineRemindEmail: false,
  deadlineRemindInApp: true,
  dailyDigestPush: true,
  dailyDigestEmail: false,
  dailyDigestInApp: true,
};

function storageKey(boardName: string): string {
  const slug = boardName.trim().replace(/\s+/g, '_').slice(0, 80) || 'board';
  return `${STORAGE_PREFIX}${slug}`;
}

export function clampDayMinutes(m: number): number {
  const x = Math.round(m);
  if (!Number.isFinite(x)) return 0;
  return ((x % 1440) + 1440) % 1440;
}

export function dateToNotificationMinutes(d: Date): number {
  return clampDayMinutes(d.getHours() * 60 + d.getMinutes());
}

export function notificationMinutesToDate(minutes: number): Date {
  const m = clampDayMinutes(minutes);
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

export async function loadBoardNotificationSettings(
  boardName: string
): Promise<BoardNotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(boardName));
    if (!raw) return { ...BOARD_NOTIFICATION_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<BoardNotificationSettings>;
    return {
      ...BOARD_NOTIFICATION_DEFAULTS,
      ...parsed,
      version: 1,
      deadlineRemindPush:
        typeof parsed.deadlineRemindPush === 'boolean'
          ? parsed.deadlineRemindPush
          : BOARD_NOTIFICATION_DEFAULTS.deadlineRemindPush,
      deadlineRemindEmail:
        typeof parsed.deadlineRemindEmail === 'boolean'
          ? parsed.deadlineRemindEmail
          : BOARD_NOTIFICATION_DEFAULTS.deadlineRemindEmail,
      deadlineRemindInApp:
        typeof parsed.deadlineRemindInApp === 'boolean'
          ? parsed.deadlineRemindInApp
          : BOARD_NOTIFICATION_DEFAULTS.deadlineRemindInApp,
      dailyDigestPush:
        typeof parsed.dailyDigestPush === 'boolean'
          ? parsed.dailyDigestPush
          : BOARD_NOTIFICATION_DEFAULTS.dailyDigestPush,
      dailyDigestEmail:
        typeof parsed.dailyDigestEmail === 'boolean'
          ? parsed.dailyDigestEmail
          : typeof parsed.emailDigest === 'boolean'
            ? parsed.emailDigest
            : BOARD_NOTIFICATION_DEFAULTS.dailyDigestEmail,
      dailyDigestInApp:
        typeof parsed.dailyDigestInApp === 'boolean'
          ? parsed.dailyDigestInApp
          : BOARD_NOTIFICATION_DEFAULTS.dailyDigestInApp,
      quietFromMinutes: clampDayMinutes(
        typeof parsed.quietFromMinutes === 'number'
          ? parsed.quietFromMinutes
          : BOARD_NOTIFICATION_DEFAULTS.quietFromMinutes
      ),
      quietUntilMinutes: clampDayMinutes(
        typeof parsed.quietUntilMinutes === 'number'
          ? parsed.quietUntilMinutes
          : BOARD_NOTIFICATION_DEFAULTS.quietUntilMinutes
      ),
    };
  } catch {
    return { ...BOARD_NOTIFICATION_DEFAULTS };
  }
}

export async function mergeBoardNotificationSettings(
  boardName: string,
  patch: Partial<Omit<BoardNotificationSettings, 'version'>>
): Promise<BoardNotificationSettings> {
  const cur = await loadBoardNotificationSettings(boardName);
  const next: BoardNotificationSettings = {
    ...cur,
    ...patch,
    version: 1,
  };
  if (patch.quietFromMinutes != null) {
    next.quietFromMinutes = clampDayMinutes(patch.quietFromMinutes);
  }
  if (patch.quietUntilMinutes != null) {
    next.quietUntilMinutes = clampDayMinutes(patch.quietUntilMinutes);
  }
  try {
    await AsyncStorage.setItem(storageKey(boardName), JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
