/**
 * Synchronous network state for use outside React (e.g. in API layer).
 * Updated by NetworkProvider via NetInfo listener.
 */
let isConnected = true;

export function getIsOnline(): boolean {
  return isConnected;
}

export function setNetworkConnected(connected: boolean): void {
  isConnected = connected;
}
