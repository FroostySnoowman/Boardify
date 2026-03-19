import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const RADIO_PLAYBACK_CHANNEL_ID = 'radio-playback';
const RADIO_UPDATES_CHANNEL_ID = 'radio-updates';
const RADIO_PLAYBACK_NOTIFICATION_ID = 'radio-playback-ongoing';

let playbackNotificationRequestId: string | null = null;
let channelsReady = false;

async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android' || channelsReady) return;
  await Notifications.setNotificationChannelAsync(RADIO_PLAYBACK_CHANNEL_ID, {
    name: 'Radio Playback',
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: [0],
    sound: null,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  await Notifications.setNotificationChannelAsync(RADIO_UPDATES_CHANNEL_ID, {
    name: 'Radio Updates',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#60a5fa',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  channelsReady = true;
}

export async function showRadioPlaybackNotification(matchId: string, body: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await ensureAndroidChannels();
  if (playbackNotificationRequestId) {
    await Notifications.dismissNotificationAsync(playbackNotificationRequestId).catch(() => {});
    playbackNotificationRequestId = null;
  }
  const requestId = await Notifications.scheduleNotificationAsync({
    identifier: RADIO_PLAYBACK_NOTIFICATION_ID,
    content: {
      title: 'MyBreakPoint Radio',
      body,
      data: { type: 'radio', matchId },
      autoDismiss: false,
      sticky: true,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
      channelId: RADIO_PLAYBACK_CHANNEL_ID,
    } as any,
    trigger: null,
  });
  playbackNotificationRequestId = requestId;
}

export async function dismissRadioPlaybackNotification(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (playbackNotificationRequestId) {
    await Notifications.dismissNotificationAsync(playbackNotificationRequestId).catch(() => {});
    playbackNotificationRequestId = null;
  }
}

export async function showRadioUpdateNotification(matchId: string, body: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await ensureAndroidChannels();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Radio update',
      body,
      data: { type: 'radio', matchId },
      ...(Platform.OS === 'android' ? { channelId: RADIO_UPDATES_CHANNEL_ID } : {}),
    },
    trigger: null,
  });
}
