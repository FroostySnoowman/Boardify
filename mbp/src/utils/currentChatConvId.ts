let current: string | null = null;

export function getCurrentChatConvId(): string | null {
  return current;
}

export function setCurrentChatConvId(convId: string | null): void {
  current = convId;
}
