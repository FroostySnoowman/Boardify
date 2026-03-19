import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nativeFetch } from './http';
import { ENV } from '../config/env';
import { getStoredSessionToken } from './auth';
import { getIsOnline } from '../network/networkState';

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

export async function getUserProfile(): Promise<any> {
  const response = await nativeFetch('/user/profile', {
    method: 'GET',
    params: {},
  });
  return response.data;
}

export async function updateUserProfile(data: {
  username?: string;
  birthdate?: string | null;
  chatDisabled?: boolean;
  parentalPin?: string;
}): Promise<void> {
  await nativeFetch('/user/profile', {
    method: 'PATCH',
    data,
    params: {},
  });
}

export async function uploadProfilePicture(imageBlob: Blob): Promise<string> {
  const API_BASE = ENV.API_BASE;
  const url = API_BASE.startsWith('http')
    ? `${API_BASE}/upload/profile-picture`
    : `${API_BASE}/upload/profile-picture`;

  const token = await getStoredSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': imageBlob.type,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: imageBlob,
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to upload profile picture');
  }
  const data = await res.json();
  return data.url;
}

export async function removeProfilePicture(): Promise<void> {
  await nativeFetch('/user/profile-picture', {
    method: 'DELETE',
    params: {},
  });
}

export async function updateUserPreferences(data: {
  mode?: 'tennis' | 'pickleball' | 'padel';
  statProfile?: 'basic' | 'intermediate' | 'advanced';
}): Promise<void> {
  await nativeFetch('/user/preferences', {
    method: 'PATCH',
    data,
    params: {},
  });
}

export async function requestParentalConsent(parentEmail: string): Promise<void> {
  await nativeFetch('/user/parental-consent/request', {
    method: 'POST',
    data: { parentEmail: parentEmail.trim() },
    params: {},
  });
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  if (!getIsOnline()) {
    return true;
  }
  try {
    const response = await nativeFetch('/user/onboarding', {
      method: 'GET',
      params: {},
    });
    const completed = response.data?.completed === true;
    if (completed && Platform.OS !== 'web') {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
    }
    if (!completed && Platform.OS !== 'web') {
      try {
        const local = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        if (local === 'true') {
          await markOnboardingComplete();
          return true;
        }
      } catch {}
    }
    return completed;
  } catch {
    if (Platform.OS !== 'web') {
      try {
        const local = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
        if (local === 'true') {
          markOnboardingComplete().catch(() => {});
          return true;
        }
      } catch {}
    }
    return false;
  }
}

export async function markOnboardingComplete(): Promise<void> {
  // Always cache locally FIRST so onboarding never shows again,
  // even if the server call fails (e.g., 401 race condition).
  if (Platform.OS !== 'web') {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  }
  if (!getIsOnline()) return;
  try {
    await nativeFetch('/user/onboarding', {
      method: 'POST',
      params: {},
    });
  } catch (error) {
    // Don't throw — local flag is set, server will sync on next check.
    console.warn('Failed to sync onboarding complete with server:', error);
  }
}