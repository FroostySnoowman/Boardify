import { Linking } from 'react-native';
import type { Router } from 'expo-router';

/** Parse invite token from `https://host/invite/TOKEN`, `boardify://invite/TOKEN`, or Expo dev URLs containing `/invite/`. */
export function extractInviteTokenFromUrl(url: string): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol === 'boardify:' && u.hostname === 'invite') {
      const t = u.pathname.replace(/^\//, '');
      return t || null;
    }
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      const parts = u.pathname.split('/').filter(Boolean);
      const i = parts.indexOf('invite');
      if (i >= 0 && parts[i + 1]) {
        return decodeURIComponent(parts[i + 1]);
      }
    }
    const parts = u.pathname.split('/').filter(Boolean);
    const i = parts.indexOf('invite');
    if (i >= 0 && parts[i + 1]) {
      return decodeURIComponent(parts[i + 1]);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function registerInviteDeepLinks(router: Router): () => void {
  const open = (url: string | null) => {
    const token = url ? extractInviteTokenFromUrl(url) : null;
    if (!token) return;
    router.push({ pathname: '/invite/[token]', params: { token } });
  };

  void Linking.getInitialURL().then(open);
  const sub = Linking.addEventListener('url', ({ url }) => open(url));
  return () => sub.remove();
}
