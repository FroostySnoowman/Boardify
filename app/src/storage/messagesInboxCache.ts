import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserMessages, type ApiInboxMessage } from '../api/user';

const STORAGE_PREFIX = 'boardify_inbox_messages_v1';

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}:${userId}`;
}

const memoryByUserId: Record<string, ApiInboxMessage[]> = {};

const prefetchInflight = new Map<string, Promise<void>>();

export function getMemoryInboxMessages(userId: string): ApiInboxMessage[] {
  return memoryByUserId[userId] ?? [];
}

export function setMemoryInboxMessages(userId: string, messages: ApiInboxMessage[]): void {
  memoryByUserId[userId] = messages;
}

export function clearInboxMemoryCache(): void {
  for (const k of Object.keys(memoryByUserId)) {
    delete memoryByUserId[k];
  }
  prefetchInflight.clear();
}

export async function loadPersistedInboxMessages(userId: string): Promise<ApiInboxMessage[] | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed as ApiInboxMessage[];
  } catch {
    return null;
  }
}

export async function persistInboxMessages(userId: string, messages: ApiInboxMessage[]): Promise<void> {
  setMemoryInboxMessages(userId, messages);
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(messages));
  } catch {
    // non-fatal
  }
}

/** Fetches inbox and writes memory + disk. Safe to call on app launch; duplicates for the same user share one flight. */
export function prefetchInboxMessagesForUser(userId: string): Promise<void> {
  const existing = prefetchInflight.get(userId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const { messages } = await getUserMessages({ limit: 80 });
      await persistInboxMessages(userId, messages);
    } catch {
      // non-fatal — Messages screen will retry
    } finally {
      prefetchInflight.delete(userId);
    }
  })();
  prefetchInflight.set(userId, p);
  return p;
}
