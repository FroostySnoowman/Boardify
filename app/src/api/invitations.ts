import { nativeFetch } from './http';

export type AcceptByTokenResponse =
  | { ok: true; boardId: string; boardName: string }
  | { needsAuth: true; boardId?: string; boardName?: string };

export async function acceptInvitationByToken(token: string): Promise<AcceptByTokenResponse> {
  const res = await nativeFetch('/api/invitations/accept-by-token', {
    method: 'POST',
    data: { token },
  });
  const d = res.data as AcceptByTokenResponse & { error?: string };
  if (res.status === 200 && d && 'needsAuth' in d && d.needsAuth) return d;
  if (res.status === 200 && d && 'ok' in d && d.ok) return d as { ok: true; boardId: string; boardName: string };
  throw new Error((d as { error?: string }).error || `Request failed (${res.status})`);
}

export async function declineInvitationByToken(token: string): Promise<{ ok: true } | { needsAuth: true }> {
  const res = await nativeFetch('/api/invitations/decline-by-token', {
    method: 'POST',
    data: { token },
  });
  const d = res.data as { ok?: boolean; needsAuth?: boolean; error?: string };
  if (res.status === 200 && d?.needsAuth) return { needsAuth: true };
  if (res.status === 200 && d?.ok) return { ok: true };
  throw new Error(d.error || `Request failed (${res.status})`);
}
