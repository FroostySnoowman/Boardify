import { nativeFetch } from './http';
import { ENV } from '../config/env';
import { getStoredSessionToken } from './auth';

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