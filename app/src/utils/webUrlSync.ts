import { Platform } from 'react-native';

export function syncChatParamsToUrl(convId: string, conversationName: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('convId', convId);
  url.searchParams.set('conversationName', conversationName);
  window.history.replaceState(null, '', url.toString());
}

export function clearChatParamsFromUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete('convId');
  url.searchParams.delete('conversationName');
  window.history.replaceState(null, '', url.toString());
}
