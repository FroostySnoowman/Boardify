import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { getStoredSessionToken } from '../api/session';
import {
  registerExpoPushToken as registerExpoPushTokenApi,
  unregisterExpoPushToken as unregisterExpoPushTokenApi,
} from '../api/user';
import { loadAccountUiPrefs } from '../storage/accountPrefs';
import { ensureAndroidPushChannel } from './notificationDeepLink';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getEasProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

/**
 * Registers or clears the Expo push token on the Worker based on Account → Notifications toggle.
 */
export async function syncPushRegistrationFromAccountPrefs(): Promise<void> {
  const sessionToken = await getStoredSessionToken();
  if (!sessionToken || Platform.OS === 'web') return;

  const prefs = await loadAccountUiPrefs();
  if (prefs.notificationsEnabled) {
    await registerExpoPushWithApi();
  } else {
    try {
      await unregisterExpoPushTokenApi();
    } catch {
      /* offline / unauthorized */
    }
  }
}

export async function registerExpoPushWithApi(): Promise<void> {
  if (Platform.OS === 'web') return;
  const sessionToken = await getStoredSessionToken();
  if (!sessionToken) return;

  const projectId = getEasProjectId();
  if (!projectId) {
    if (__DEV__) {
      console.warn('[expoPush] Missing extra.eas.projectId — cannot obtain Expo push token');
    }
    return;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return;

  await ensureAndroidPushChannel();

  const push = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = push.data;
  if (!token) return;

  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  await registerExpoPushTokenApi({ token, platform });
}

export async function unregisterExpoPushFromApi(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await unregisterExpoPushTokenApi();
  } catch {
    /* ignore */
  }
}
