import { nativeFetch } from './http';

export type UserApiKeyScope = 'all' | 'boards';

export type UserApiKeyListItem = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopeKind: UserApiKeyScope;
  boardIds: string[] | null;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

export async function listUserApiKeys(): Promise<{ keys: UserApiKeyListItem[] }> {
  const res = await nativeFetch('/user/api-keys', { method: 'GET' });
  return res.data as { keys: UserApiKeyListItem[] };
}

export async function createUserApiKey(body: {
  name: string;
  scopeKind: UserApiKeyScope;
  boardIds?: string[];
}): Promise<{ key: UserApiKeyListItem; secret: string }> {
  const res = await nativeFetch('/user/api-keys', {
    method: 'POST',
    data: body,
  });
  return res.data as { key: UserApiKeyListItem; secret: string };
}

export async function revokeUserApiKey(keyId: string): Promise<void> {
  await nativeFetch(`/user/api-keys/${encodeURIComponent(keyId)}`, {
    method: 'DELETE',
  });
}
