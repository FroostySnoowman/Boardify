import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Match, Stats, CreateMatchPayload } from '../api/matches';

const OFFLINE_ACTIVE_MATCH_KEY = 'offline_active_match';
const OFFLINE_ACTIVE_STATS_KEY = 'offline_active_stats';
const OFFLINE_ACTIVE_PAYLOAD_KEY = 'offline_active_payload';
const OFFLINE_PENDING_QUEUE_KEY = 'offline_pending_sync_queue';

export type PendingSyncItem = { createPayload: CreateMatchPayload; stats: Stats };

function getStorage(): typeof AsyncStorage {
  return AsyncStorage;
}

export function isOfflineMatch(matchId: string): boolean {
  return typeof matchId === 'string' && matchId.startsWith('offline-');
}

/** Active offline match (one at a time). When user creates match offline we set this; when they end we push to queue and clear. */
export async function getOfflineActiveMatch(): Promise<{ match: Match; stats: Stats; createPayload: CreateMatchPayload } | null> {
  if (Platform.OS === 'web') return null;
  try {
    const [matchJson, statsJson, payloadJson] = await Promise.all([
      getStorage().getItem(OFFLINE_ACTIVE_MATCH_KEY),
      getStorage().getItem(OFFLINE_ACTIVE_STATS_KEY),
      getStorage().getItem(OFFLINE_ACTIVE_PAYLOAD_KEY),
    ]);
    if (!matchJson || !statsJson || !payloadJson) return null;
    return {
      match: JSON.parse(matchJson) as Match,
      stats: JSON.parse(statsJson) as Stats,
      createPayload: JSON.parse(payloadJson) as CreateMatchPayload,
    };
  } catch {
    return null;
  }
}

export async function setOfflineActiveMatch(
  match: Match,
  stats: Stats,
  createPayload: CreateMatchPayload
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Promise.all([
      getStorage().setItem(OFFLINE_ACTIVE_MATCH_KEY, JSON.stringify(match)),
      getStorage().setItem(OFFLINE_ACTIVE_STATS_KEY, JSON.stringify(stats)),
      getStorage().setItem(OFFLINE_ACTIVE_PAYLOAD_KEY, JSON.stringify(createPayload)),
    ]);
  } catch (e) {
    console.error('Failed to save offline match', e);
  }
}

export async function clearOfflineActiveMatch(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Promise.all([
      getStorage().removeItem(OFFLINE_ACTIVE_MATCH_KEY),
      getStorage().removeItem(OFFLINE_ACTIVE_STATS_KEY),
      getStorage().removeItem(OFFLINE_ACTIVE_PAYLOAD_KEY),
    ]);
  } catch (e) {
    console.error('Failed to clear offline match', e);
  }
}

export async function getPendingSyncQueue(): Promise<PendingSyncItem[]> {
  if (Platform.OS === 'web') return [];
  try {
    const raw = await getStorage().getItem(OFFLINE_PENDING_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function addToPendingSync(createPayload: CreateMatchPayload, stats: Stats): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const queue = await getPendingSyncQueue();
    queue.push({ createPayload, stats });
    await getStorage().setItem(OFFLINE_PENDING_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to add to pending sync', e);
  }
}

export async function setPendingSyncQueue(queue: PendingSyncItem[]): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await getStorage().setItem(OFFLINE_PENDING_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Failed to set pending sync queue', e);
  }
}

/**
 * Called when back online: create match then end with stats for each pending item.
 * Uses api/matches createMatch and endMatch to avoid circular dependency.
 */
export async function syncPendingOfflineMatches(): Promise<void> {
  if (Platform.OS === 'web') return;
  const { createMatch, endMatch } = await import('../api/matches');
  const queue = await getPendingSyncQueue();
  if (queue.length === 0) return;

  const remaining: PendingSyncItem[] = [];
  for (const item of queue) {
    try {
      const matchId = await createMatch(item.createPayload);
      await endMatch(matchId, item.stats);
    } catch (e) {
      console.warn('Offline sync failed for one match', e);
      remaining.push(item);
    }
  }
  await setPendingSyncQueue(remaining);
}
