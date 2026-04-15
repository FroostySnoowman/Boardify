import { Platform } from 'react-native';
import { ENV } from '../config/env';
import { getStoredSessionToken } from './session';

export type UploadedCardAttachment = {
  id: string;
  name: string;
  url: string;
  storageKey: string;
  size: number;
  mimeType: string;
};

export async function uploadCardAttachment(
  cardId: string,
  file: Blob,
  filename: string
): Promise<UploadedCardAttachment> {
  let base = ENV.API_BASE.replace(/\/$/, '');
  if (Platform.OS === 'android' && base.includes('localhost')) {
    base = base.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
  }
  const q = new URLSearchParams({
    cardId,
    filename: filename || 'file',
  });
  const url = `${base}/upload/card-attachment?${q.toString()}`;
  const token = await getStoredSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': file.type || 'application/octet-stream',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: file,
    credentials: Platform.OS === 'web' ? 'include' : 'omit',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      typeof data === 'object' && data && 'error' in data
        ? String((data as { error?: unknown }).error)
        : 'Upload failed';
    throw new Error(err);
  }
  const att = (data as { attachment?: UploadedCardAttachment }).attachment;
  if (!att?.id || !att.url || !att.storageKey) {
    throw new Error('Invalid upload response');
  }
  return att;
}
