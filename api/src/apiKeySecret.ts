import type { Env } from './bindings';
import { sha256TokenHex } from './boardInvitations';

export const API_KEY_PREFIX = 'bfk_';

function randomBase64Url(bytesLen: number): string {
  const bytes = new Uint8Array(bytesLen);
  crypto.getRandomValues(bytes);
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function generateApiKeySecret(): string {
  return `${API_KEY_PREFIX}${randomBase64Url(32)}`;
}

export function apiKeyTokenPrefix(secret: string): string {
  return secret.length <= 16 ? secret : secret.slice(0, 16);
}

export async function hashApiKeySecret(secret: string, env: Env): Promise<string> {
  const pepper = env.AUTH_SECRET ?? '';
  return sha256TokenHex(`${secret}\n${pepper}`);
}
