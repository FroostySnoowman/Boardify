/**
 * Board-scoped notification prefs (stored in board_notification_settings.prefs_json).
 * Backward compatible with older clients that only set pushEnabled, dueSoon, emailDigest, quietHours.
 */

export type BoardNotificationPrefs = {
  pushEnabled: boolean;
  dueSoon: boolean;
  emailDigest: boolean;
  mentionYou: boolean;
  assignedCard: boolean;
  commentsFollowed: boolean;
  quietHours: boolean;
  quietFromMinutes: number;
  quietUntilMinutes: number;
  /** Per-channel deadline reminders (defaults derived from dueSoon + push/email patterns). */
  deadlineRemindPush: boolean;
  deadlineRemindEmail: boolean;
  deadlineRemindInApp: boolean;
  /** Daily AI digest channels (legacy `emailDigest` seeds email). */
  dailyDigestPush: boolean;
  dailyDigestEmail: boolean;
  dailyDigestInApp: boolean;
  /** Minutes from midnight local-server interpretation; v1 uses UTC for cron only as doc — optional for UI. */
  dailyDigestLocalMinutes?: number;
};

const DEF_QUIET_FROM = 22 * 60;
const DEF_QUIET_UNTIL = 8 * 60;

function clampDayMinutes(m: number): number {
  const x = Math.round(m);
  if (!Number.isFinite(x)) return 0;
  return ((x % 1440) + 1440) % 1440;
}

function bool(o: Record<string, unknown>, key: string, fallback: boolean): boolean {
  if (o[key] === false) return false;
  if (o[key] === true) return true;
  return fallback;
}

function num(o: Record<string, unknown>, key: string, fallback: number): number {
  const v = o[key];
  if (typeof v === 'number' && Number.isFinite(v)) return clampDayMinutes(v);
  return fallback;
}

export function parseBoardNotificationPrefs(raw: string | null | undefined): BoardNotificationPrefs {
  let o: Record<string, unknown> = {};
  if (raw) {
    try {
      o = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      o = {};
    }
  }
  const pushEnabled = bool(o, 'pushEnabled', true);
  const dueSoon = bool(o, 'dueSoon', true);
  const emailDigest = bool(o, 'emailDigest', false);

  const deadlineRemindPush =
    typeof o.deadlineRemindPush === 'boolean' ? (o.deadlineRemindPush as boolean) : dueSoon && pushEnabled;
  const deadlineRemindEmail =
    typeof o.deadlineRemindEmail === 'boolean' ? (o.deadlineRemindEmail as boolean) : false;
  const deadlineRemindInApp =
    typeof o.deadlineRemindInApp === 'boolean' ? (o.deadlineRemindInApp as boolean) : dueSoon;

  const dailyDigestPush =
    typeof o.dailyDigestPush === 'boolean' ? (o.dailyDigestPush as boolean) : pushEnabled;
  const dailyDigestEmail =
    typeof o.dailyDigestEmail === 'boolean' ? (o.dailyDigestEmail as boolean) : emailDigest;
  const dailyDigestInApp =
    typeof o.dailyDigestInApp === 'boolean' ? (o.dailyDigestInApp as boolean) : true;

  return {
    pushEnabled,
    dueSoon: bool(o, 'dueSoon', true),
    emailDigest,
    mentionYou: bool(o, 'mentionYou', true),
    assignedCard: bool(o, 'assignedCard', true),
    commentsFollowed: bool(o, 'commentsFollowed', false),
    quietHours: bool(o, 'quietHours', false),
    quietFromMinutes: num(o, 'quietFromMinutes', DEF_QUIET_FROM),
    quietUntilMinutes: num(o, 'quietUntilMinutes', DEF_QUIET_UNTIL),
    deadlineRemindPush,
    deadlineRemindEmail,
    deadlineRemindInApp,
    dailyDigestPush,
    dailyDigestEmail,
    dailyDigestInApp,
    dailyDigestLocalMinutes:
      typeof o.dailyDigestLocalMinutes === 'number' && Number.isFinite(o.dailyDigestLocalMinutes)
        ? clampDayMinutes(o.dailyDigestLocalMinutes as number)
        : undefined,
  };
}

/** Current UTC minutes from midnight (0–1439). */
export function utcMinutesNow(): number {
  const d = new Date();
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/**
 * If quiet hours wrap (e.g. 22:00–08:00), "quiet" when minutes >= from OR minutes < until.
 * Non-wrap: quiet when minutes >= from AND minutes < until.
 */
export function isQuietNowUtc(prefs: BoardNotificationPrefs): boolean {
  if (!prefs.quietHours) return false;
  const m = utcMinutesNow();
  const from = clampDayMinutes(prefs.quietFromMinutes);
  const until = clampDayMinutes(prefs.quietUntilMinutes);
  if (from === until) return false;
  if (from > until) {
    return m >= from || m < until;
  }
  return m >= from && m < until;
}

export function wantsDeadlinePush(prefs: BoardNotificationPrefs): boolean {
  return prefs.pushEnabled && prefs.dueSoon && prefs.deadlineRemindPush && !isQuietNowUtc(prefs);
}

export function wantsDeadlineEmail(prefs: BoardNotificationPrefs): boolean {
  return prefs.dueSoon && prefs.deadlineRemindEmail;
}

export function wantsDeadlineInApp(prefs: BoardNotificationPrefs): boolean {
  return prefs.dueSoon && prefs.deadlineRemindInApp;
}

export function wantsDigestPush(prefs: BoardNotificationPrefs): boolean {
  return prefs.pushEnabled && prefs.dailyDigestPush && !isQuietNowUtc(prefs);
}

export function wantsDigestEmail(prefs: BoardNotificationPrefs): boolean {
  return prefs.dailyDigestEmail;
}

export function wantsDigestInApp(prefs: BoardNotificationPrefs): boolean {
  return prefs.dailyDigestInApp;
}
