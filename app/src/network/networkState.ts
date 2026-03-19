let isConnected = true;

export function getIsOnline(): boolean {
  return isConnected;
}

export function setNetworkConnected(connected: boolean): void {
  isConnected = connected;
}
