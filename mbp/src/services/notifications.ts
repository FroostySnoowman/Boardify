import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { EventType, listAllEvents } from '../api/calendar';
import { expandRecurringEventsForDateRange } from '../utils/expandRecurringEvents';
import { registerDevice } from '../api/messages';
import { getCurrentChatConvId } from '../utils/currentChatConvId';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as { type?: string; convId?: string } | undefined;
    if (data?.type === 'chat' && typeof data.convId === 'string' && data.convId === getCurrentChatConvId()) {
      return {
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

const ANDROID_CHANNEL_CHAT = 'chat-messages';
const ANDROID_CHANNEL_EVENTS = 'event-reminders';

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice && !__DEV__) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_CHAT, {
      name: 'Chat Messages',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3b82f6',
    });
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_EVENTS, {
      name: 'Event Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22c55e',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const alreadyGranted =
    existing.granted ||
    (Platform.OS === 'ios' &&
      (existing.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
        existing.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL));

  if (alreadyGranted) return true;

  const { granted, ios } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });

  if (granted) return true;
  if (Platform.OS === 'ios' && ios?.status != null) {
    return (
      ios.status === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      ios.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  }
  return false;
}

export async function registerPushTokenWithBackend(): Promise<void> {
  const granted = await requestNotificationPermissions();
  if (!granted) {
    if (__DEV__) console.warn('[Notifications] Skipping push registration: permission not granted');
    return;
  }

  try {
    const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
    if (!projectId && __DEV__) {
      console.warn('[Notifications] extra.eas.projectId missing; push token may be invalid on iOS. Check app.config.js extra.eas.projectId.');
    }
    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
    const token = pushToken?.data;
    if (token) {
      await registerDevice(token);
    }
  } catch (e) {
    console.warn('Failed to register push token with backend', e);
  }
}

export async function dismissChatNotificationsForConversation(convId: string): Promise<void> {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    for (const n of presented) {
      const data = n.request.content?.data as { type?: string; convId?: string } | undefined;
      if (data?.type === 'chat' && data.convId === convId) {
        await Notifications.dismissNotificationAsync(n.request.identifier);
      }
    }
  } catch (e) {
    if (__DEV__) console.warn('[Notifications] dismissChatNotificationsForConversation failed', e);
  }
}

export async function showChatMessageNotification(params: {
  conversationName: string;
  senderName: string;
  content: string;
  convId: string;
  teamId: string;
}): Promise<void> {
  const { conversationName, senderName, content, convId, teamId } = params;
  const body = content && content.trim() ? content.trim().slice(0, 100) : 'New message';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${senderName} in ${conversationName}`,
      body,
      data: { type: 'chat', convId, teamId },
      ...(Platform.OS === 'android' && { channelId: ANDROID_CHANNEL_CHAT }),
    },
    trigger: null,
  });
}

const EVENT_NOTIFICATION_PREFIX = 'event-reminder-';

export function getEventStartDate(event: EventType): Date | null {
  if (event.startAt != null && Number.isFinite(event.startAt)) {
    const d = new Date(event.startAt);
    return isNaN(d.getTime()) ? null : d;
  }
  const [year, month, day] = event.date.split('-').map(Number);
  if (!year || !month || !day) return null;

  const timeStr = (event.time || '').split(' - ')[0]?.trim() || '00:00';
  const upper = timeStr.toUpperCase();
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (upper.includes('PM') && hours !== 12) hours += 12;
  if (upper.includes('AM') && hours === 12) hours = 0;

  const d = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

const REMINDER_OFFSETS = [
  { hours: 0.5, label: '30 minutes', suffix: '30m' },
] as const;

const MIN_TRIGGER_AHEAD_MS = 5_000;

function reminderIdentifier(eventId: string, suffix: string): string {
  return `${EVENT_NOTIFICATION_PREFIX}${eventId}-${suffix}`;
}

export async function scheduleEventReminders(event: EventType): Promise<string[]> {
  const startDate = getEventStartDate(event);
  const now = Date.now();
  if (!startDate || startDate.getTime() <= now) return [];

  const ids: string[] = [];
  const eventId = String(event.id);

  for (const { hours, label, suffix } of REMINDER_OFFSETS) {
    const triggerDate = new Date(startDate.getTime() - hours * 60 * 60 * 1000);
    if (triggerDate.getTime() <= now + MIN_TRIGGER_AHEAD_MS) continue;

    const id = await Notifications.scheduleNotificationAsync({
      identifier: reminderIdentifier(eventId, suffix),
      content: {
        title: 'Event Reminder',
        body: `${event.title} starts in ${label}${event.location ? ` • ${event.location}` : ''}`,
        data: {
          type: 'event',
          eventId,
          eventTitle: event.title,
          date: event.date,
          time: event.time,
          ...(event.teamId && { teamId: event.teamId }),
        },
        ...(Platform.OS === 'android' && { channelId: ANDROID_CHANNEL_EVENTS }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        ...(Platform.OS === 'android' && { channelId: ANDROID_CHANNEL_EVENTS }),
      },
    });
    ids.push(id);
  }

  return ids;
}

export async function cancelAllEventReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const req of scheduled) {
    if (req.content.data?.type === 'event' || req.identifier?.startsWith(EVENT_NOTIFICATION_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(req.identifier);
    }
  }
}

export async function cancelEventReminders(eventId: number | string): Promise<void> {
  const idStr = String(eventId);
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const req of scheduled) {
    const data = req.content.data as Record<string, unknown> | undefined;
    if (data?.type === 'event' && (data.eventId === idStr || data.eventId === eventId)) {
      await Notifications.cancelScheduledNotificationAsync(req.identifier);
    }
    if (req.identifier?.startsWith(EVENT_NOTIFICATION_PREFIX) && req.identifier.includes(idStr)) {
      await Notifications.cancelScheduledNotificationAsync(req.identifier);
    }
  }
}

const MAX_SCHEDULE_DAYS = 60;

let _syncRunning = false;

export async function refetchAndRescheduleEventReminders(): Promise<void> {
  if (_syncRunning) return;
  _syncRunning = true;
  try {
    const rawEvents = await listAllEvents();

    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(now);
    rangeEnd.setDate(rangeEnd.getDate() + MAX_SCHEDULE_DAYS);

    const expanded = rawEvents.length > 0
      ? expandRecurringEventsForDateRange(rawEvents, rangeStart, rangeEnd)
      : [];

    const nowMs = now.getTime();
    const maxFuture = MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000;
    const validIds = new Set<string>();

    for (const event of expanded) {
      const startDate = getEventStartDate(event);
      if (!startDate) continue;
      const t = startDate.getTime();
      if (t <= nowMs || t - nowMs > maxFuture) continue;
      const ids = await scheduleEventReminders(event);
      for (const id of ids) validIds.add(id);
    }

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const req of scheduled) {
      if (
        req.identifier?.startsWith(EVENT_NOTIFICATION_PREFIX) &&
        !validIds.has(req.identifier)
      ) {
        await Notifications.cancelScheduledNotificationAsync(req.identifier);
      }
    }
  } catch (e) {
    console.warn('Notifications: failed to sync event reminders', e);
  } finally {
    _syncRunning = false;
  }
}
