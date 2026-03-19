let owner: string | null = null;

export function claimAudioSession(nextOwner: string): boolean {
  if (!owner || owner === nextOwner) {
    owner = nextOwner;
    return true;
  }
  return false;
}

export function releaseAudioSession(currentOwner: string): void {
  if (owner === currentOwner) {
    owner = null;
  }
}

export function getAudioSessionOwner(): string | null {
  return owner;
}

export function isAudioSessionOwnedBy(currentOwner: string): boolean {
  return owner === currentOwner;
}
