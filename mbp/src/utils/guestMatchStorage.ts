import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Match, Stats } from '../api/matches';

const GUEST_MATCH_KEY = 'guest_match';
const GUEST_STATS_KEY = 'guest_stats';

// In-memory storage for React Native (primary)
let guestMatchMemory: Match | null = null;
let guestStatsMemory: Stats | null = null;

// Check if running on web
const isWeb = Platform.OS === 'web';

/**
 * Get sessionStorage (web) or return null (React Native)
 */
function getSessionStorage(): Storage | null {
  if (isWeb && typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage;
  }
  return null;
}

/**
 * Save guest match and stats
 */
export async function saveGuestMatch(match: Match, stats: Stats): Promise<void> {
  if (isWeb) {
    const sessionStorage = getSessionStorage();
    if (sessionStorage) {
      sessionStorage.setItem(GUEST_MATCH_KEY, JSON.stringify(match));
      sessionStorage.setItem(GUEST_STATS_KEY, JSON.stringify(stats));
    }
  } else {
    // React Native: store in memory and AsyncStorage as backup
    guestMatchMemory = match;
    guestStatsMemory = stats;
    try {
      await AsyncStorage.setItem(GUEST_MATCH_KEY, JSON.stringify(match));
      await AsyncStorage.setItem(GUEST_STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      console.error('Failed to save guest match to AsyncStorage:', error);
    }
  }
}

/**
 * Get guest match
 */
export async function getGuestMatch(): Promise<Match | null> {
  if (isWeb) {
    const sessionStorage = getSessionStorage();
    if (sessionStorage) {
      const data = sessionStorage.getItem(GUEST_MATCH_KEY);
      return data ? JSON.parse(data) : null;
    }
  } else {
    // React Native: check memory first, then AsyncStorage
    if (guestMatchMemory) {
      return guestMatchMemory;
    }
    try {
      const data = await AsyncStorage.getItem(GUEST_MATCH_KEY);
      if (data) {
        const match = JSON.parse(data);
        guestMatchMemory = match; // Cache in memory
        return match;
      }
    } catch (error) {
      console.error('Failed to get guest match from AsyncStorage:', error);
    }
  }
  return null;
}

/**
 * Get guest stats
 */
export async function getGuestStats(): Promise<Stats | null> {
  if (isWeb) {
    const sessionStorage = getSessionStorage();
    if (sessionStorage) {
      const data = sessionStorage.getItem(GUEST_STATS_KEY);
      return data ? JSON.parse(data) : null;
    }
  } else {
    // React Native: check memory first, then AsyncStorage
    if (guestStatsMemory) {
      return guestStatsMemory;
    }
    try {
      const data = await AsyncStorage.getItem(GUEST_STATS_KEY);
      if (data) {
        const stats = JSON.parse(data);
        guestStatsMemory = stats; // Cache in memory
        return stats;
      }
    } catch (error) {
      console.error('Failed to get guest stats from AsyncStorage:', error);
    }
  }
  return null;
}

/**
 * Update guest stats
 */
export async function updateGuestStats(stats: Stats): Promise<void> {
  if (isWeb) {
    const sessionStorage = getSessionStorage();
    if (sessionStorage) {
      sessionStorage.setItem(GUEST_STATS_KEY, JSON.stringify(stats));
    }
  } else {
    // React Native: update memory and AsyncStorage
    guestStatsMemory = stats;
    try {
      await AsyncStorage.setItem(GUEST_STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      console.error('Failed to update guest stats in AsyncStorage:', error);
    }
  }
}

/**
 * Clear guest match data
 */
export async function clearGuestMatch(): Promise<void> {
  if (isWeb) {
    const sessionStorage = getSessionStorage();
    if (sessionStorage) {
      sessionStorage.removeItem(GUEST_MATCH_KEY);
      sessionStorage.removeItem(GUEST_STATS_KEY);
    }
  } else {
    // React Native: clear memory and AsyncStorage
    guestMatchMemory = null;
    guestStatsMemory = null;
    try {
      await AsyncStorage.removeItem(GUEST_MATCH_KEY);
      await AsyncStorage.removeItem(GUEST_STATS_KEY);
    } catch (error) {
      console.error('Failed to clear guest match from AsyncStorage:', error);
    }
  }
}

/**
 * Check if a match ID is a guest match
 */
export function isGuestMatch(matchId: string): boolean {
  return matchId.startsWith('guest-');
}

/**
 * Check if there's an active guest match
 */
export async function hasGuestMatch(): Promise<boolean> {
  const match = await getGuestMatch();
  return match !== null;
}

/**
 * Initialize tab visibility listener for web
 * Clears guest match data when tab becomes hidden or closes
 */
export function initTabVisibilityListener(): () => void {
  if (!isWeb || typeof document === 'undefined') {
    return () => {}; // No-op for React Native
  }

  const handleVisibilityChange = () => {
    if (document.hidden) {
      // Tab is hidden, clear guest match data
      clearGuestMatch().catch(console.error);
    }
  };

  const handleBeforeUnload = () => {
    // Tab is closing, clear guest match data
    clearGuestMatch().catch(console.error);
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}
