import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LiveActivity from 'expo-live-activity';
import { EventType, listAllEvents } from '../api/calendar';
import { getEventStartDate } from './notifications';
import { expandRecurringEventsForDateRange } from '../utils/expandRecurringEvents';
import { getLiveActivityPushTokenStatus, registerLiveActivityPushToken } from '../api/messages';
import { ENV } from '../config/env';

const STORAGE_KEY_ACTIVITY_ID = '@live_activity/activity_id';
const STORAGE_KEY_EVENT_ID = '@live_activity/event_id';
const STORAGE_KEY_TEMP_ACTIVITY_ID = '@live_activity/temp_activity_id';
const STORAGE_KEY_TEMP_ACTIVITY_STARTED_AT = '@live_activity/temp_activity_started_at';
const STORAGE_KEY_TEMP_ACTIVITY_LAST_ATTEMPT = '@live_activity/temp_activity_last_attempt';
const MAX_SCHEDULE_DAYS = 60;
const TEMP_ACTIVITY_MAX_AGE_MS = 20_000;
const TEMP_ACTIVITY_RETRY_COOLDOWN_MS = 6 * 60 * 60 * 1000;

let pendingTempActivityId: string | null = null;

const ENDED_STATE: LiveActivity.LiveActivityState = {
  title: 'MyBreakPoint',
  subtitle: 'Ended',
  progressBar: { date: Date.now() },
};

function tryStopActivity(activityId: string): void {
  try {
    LiveActivity.stopActivity(activityId, ENDED_STATE);
  } catch (_) {}
}

function stopPendingTempActivity(): void {
  if (Platform.OS !== 'ios') return;
  const activityId = pendingTempActivityId;
  if (!activityId) return;
  pendingTempActivityId = null;
  tryStopActivity(activityId);
  AsyncStorage.multiRemove([
    STORAGE_KEY_TEMP_ACTIVITY_ID,
    STORAGE_KEY_TEMP_ACTIVITY_STARTED_AT,
  ]).catch(() => {});
}

async function cleanupStaleTempActivity(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    const [staleId, startedAtRaw] = await AsyncStorage.multiGet([
      STORAGE_KEY_TEMP_ACTIVITY_ID,
      STORAGE_KEY_TEMP_ACTIVITY_STARTED_AT,
    ]).then((pairs) => [pairs[0]?.[1] ?? null, pairs[1]?.[1] ?? null]);
    if (!staleId) return;

    const startedAt = startedAtRaw ? Number(startedAtRaw) : NaN;
    const isDefinitelyStale =
      !Number.isFinite(startedAt) || Date.now() - startedAt >= TEMP_ACTIVITY_MAX_AGE_MS;
    if (isDefinitelyStale) {
      tryStopActivity(staleId);
      await AsyncStorage.multiRemove([
        STORAGE_KEY_TEMP_ACTIVITY_ID,
        STORAGE_KEY_TEMP_ACTIVITY_STARTED_AT,
      ]);
    }
  } catch (_) {}
}
const MATCH_OR_TOURNAMENT: EventType['type'][] = ['match', 'tournament'];

function isMatchOrTournament(event: EventType): boolean {
  return MATCH_OR_TOURNAMENT.includes(event.type);
}

async function getNextUpcomingMatchOrTournament(): Promise<EventType | null> {
  const rawEvents = await listAllEvents();
  if (rawEvents.length === 0) return null;

  const now = new Date();
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + MAX_SCHEDULE_DAYS);

  const expanded = expandRecurringEventsForDateRange(rawEvents, startDate, endDate);
  const nowMs = Date.now();

  const futureMatchOrTournament = expanded
    .filter(isMatchOrTournament)
    .map((e) => ({ event: e, startMs: getEventStartDate(e)?.getTime() ?? 0 }))
    .filter(({ startMs }) => startMs > nowMs)
    .sort((a, b) => a.startMs - b.startMs);

  if (futureMatchOrTournament.length === 0) return null;

  return futureMatchOrTournament[0].event;
}

function buildStateForEvent(event: EventType): LiveActivity.LiveActivityState {
  const startDate = getEventStartDate(event);
  const endTimeMs = startDate ? startDate.getTime() : Date.now() + 60 * 60 * 1000;

  const typeLabel = event.type === 'tournament' ? 'Tournament' : 'Match';
  const subtitle = event.location
    ? `${event.date} • ${event.location}`
    : event.date;

  return {
    title: event.title,
    subtitle: `${typeLabel} starts` + (subtitle ? ` • ${subtitle}` : ''),
    progressBar: { date: endTimeMs },
  };
}

function buildConfig(): LiveActivity.LiveActivityConfig {
  return {
    backgroundColor: '#020617',
    titleColor: '#f8fafc',
    subtitleColor: 'rgba(248, 250, 252, 0.8)',
    progressViewTint: '#a855f7',
    progressViewLabelColor: '#f8fafc',
    deepLinkUrl: '/(tabs)/calendar',
    timerType: 'digital',
    padding: { horizontal: 20, top: 16, bottom: 16 },
  };
}

export async function startEventLiveActivity(event: EventType): Promise<string | undefined> {
  if (Platform.OS !== 'ios') return undefined;

  try {
    const state = buildStateForEvent(event);
    const config = buildConfig();
    const activityId = LiveActivity.startActivity(state, config);
    if (activityId) {
      await AsyncStorage.multiSet([
        [STORAGE_KEY_ACTIVITY_ID, activityId],
        [STORAGE_KEY_EVENT_ID, String(event.id)],
      ]);
      return activityId;
    }
  } catch (e) {
    if (__DEV__) console.warn('[LiveActivity] start failed', e);
  }
  return undefined;
}

export async function stopCurrentLiveActivity(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  try {
    const activityId = await AsyncStorage.getItem(STORAGE_KEY_ACTIVITY_ID);
    if (!activityId) return;

    const state: LiveActivity.LiveActivityState = {
      title: 'Event',
      subtitle: 'Ended',
      progressBar: { date: Date.now() },
    };
    LiveActivity.stopActivity(activityId, state);
    await AsyncStorage.multiRemove([STORAGE_KEY_ACTIVITY_ID, STORAGE_KEY_EVENT_ID]);
  } catch (e) {
    if (__DEV__) console.warn('[LiveActivity] stop failed', e);
  }
}

export async function refreshEventLiveActivity(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  try {
    const nextEvent = await getNextUpcomingMatchOrTournament();
    if (!nextEvent) {
      await stopCurrentLiveActivity();
      return;
    }
    const currentActivityId = await AsyncStorage.getItem(STORAGE_KEY_ACTIVITY_ID);
    const currentEventId = await AsyncStorage.getItem(STORAGE_KEY_EVENT_ID);
    const nextEventId = String(nextEvent.id);
    if (currentActivityId && currentEventId === nextEventId) {
      return;
    }
    await stopCurrentLiveActivity();
    await startEventLiveActivity(nextEvent);
  } catch (e) {
    if (__DEV__) console.warn('[LiveActivity] refresh failed', e);
  }
}

async function startTempActivityForToken(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_TEMP_ACTIVITY_LAST_ATTEMPT, String(Date.now()));
    const state: LiveActivity.LiveActivityState = {
      title: 'MyBreakPoint',
      subtitle: '',
      progressBar: { date: Date.now() + 3000 },
    };
    const config = buildConfig();
    const activityId = LiveActivity.startActivity(state, config);
    if (activityId) {
      pendingTempActivityId = activityId;
      await AsyncStorage.multiSet([
        [STORAGE_KEY_TEMP_ACTIVITY_ID, activityId],
        [STORAGE_KEY_TEMP_ACTIVITY_STARTED_AT, String(Date.now())],
      ]);
      setTimeout(() => {
        if (pendingTempActivityId === activityId) {
          pendingTempActivityId = null;
          tryStopActivity(activityId);
          AsyncStorage.multiRemove([
            STORAGE_KEY_TEMP_ACTIVITY_ID,
            STORAGE_KEY_TEMP_ACTIVITY_STARTED_AT,
          ]).catch(() => {});
        }
      }, 5000);
      setTimeout(() => {
        tryStopActivity(activityId);
        AsyncStorage.multiRemove([
          STORAGE_KEY_TEMP_ACTIVITY_ID,
          STORAGE_KEY_TEMP_ACTIVITY_STARTED_AT,
        ]).catch(() => {});
      }, TEMP_ACTIVITY_MAX_AGE_MS);
      await new Promise((r) => setTimeout(r, 2000));
      if (pendingTempActivityId === activityId) {
        pendingTempActivityId = null;
        tryStopActivity(activityId);
        await AsyncStorage.multiRemove([
          STORAGE_KEY_TEMP_ACTIVITY_ID,
          STORAGE_KEY_TEMP_ACTIVITY_STARTED_AT,
        ]);
      }
    }
  } catch (e) {
    if (__DEV__) console.warn('[LiveActivity] temp activity for token failed', e);
  }
}

export async function ensurePushToStartTokenRegistered(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  try {
    await cleanupStaleTempActivity();

    await refreshEventLiveActivity();
    const hasActivity = !!(await AsyncStorage.getItem(STORAGE_KEY_ACTIVITY_ID));
    if (!hasActivity) {
      const [{ hasToken }, lastAttemptRaw] = await Promise.all([
        getLiveActivityPushTokenStatus().catch(() => ({ hasToken: false })),
        AsyncStorage.getItem(STORAGE_KEY_TEMP_ACTIVITY_LAST_ATTEMPT),
      ]);
      const lastAttemptMs = lastAttemptRaw ? Number(lastAttemptRaw) : NaN;
      const shouldRetryTempStart =
        !Number.isFinite(lastAttemptMs) || Date.now() - lastAttemptMs >= TEMP_ACTIVITY_RETRY_COOLDOWN_MS;

      if (!hasToken && shouldRetryTempStart) {
        await startTempActivityForToken();
      }
    }
  } catch (e) {
    if (__DEV__) console.warn('[LiveActivity] ensure token failed', e);
  }
}

export function subscribePushToStartToken(callback?: () => void): (() => void) | undefined {
  if (Platform.OS !== 'ios') return undefined;

  const subscription = LiveActivity.addActivityPushToStartTokenListener(
    async ({ activityPushToStartToken }) => {
      stopPendingTempActivity();
      try {
        const apnsEnvironment = ENV.APNS_ENVIRONMENT;
        await registerLiveActivityPushToken(activityPushToStartToken, apnsEnvironment);
        callback?.();
      } catch (e) {
        if (__DEV__) console.warn('[LiveActivity] register push-to-start token failed', e);
      }
    }
  );

  return () => subscription?.remove();
}
