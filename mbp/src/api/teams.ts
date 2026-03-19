import { nativeFetch } from './http'

export interface Team {
  id: string
  name: string
  description?: string
  visibility: 'public' | 'private'
  accessCode?: string | null
  requestToJoin: boolean
  memberCount: number
  imageUrl?: string | null
  iconColorStart?: string | null
  iconColorEnd?: string | null
  statisticsVisibility?: 'coaches_only' | 'coaches_and_players' | 'everyone'
  joinedAt?: string
  role?: string
  createdAt: string
  updatedAt: string
}

export interface Member {
  id: string
  email: string
  username: string
  profilePictureUrl?: string | null
  role: string
  joinedAt: string
  chatEnabled: boolean
}

export interface Invite {
  id: string
  createdBy: string
  createdAt: string
  expiresAt: string | null
  maxUses: number
  uses: number
  role: string
}

export interface JoinRequest {
  userId: string
  email: string
  username: string
  createdAt: string
}

function buildQuery(params: Record<string, any> = {}): string {
  const qp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v != null) qp.set(k, String(v))
  })
  const qs = qp.toString()
  return qs ? `?${qs}` : ''
}

export async function listMyTeams(): Promise<Team[]> {
  const res = await nativeFetch('/teams', { method: 'GET', params: {} })
  return (res.data as any).teams
}

export async function listPublicTeams(): Promise<Team[]> {
  const res = await nativeFetch(
    `/teams${buildQuery({ visibility: 'public' })}`,
    { method: 'GET', params: {} }
  )
  return (res.data as any).teams
}

export async function joinTeam(teamId: string, code?: string): Promise<void> {
  const payload = code != null ? { code } : {}
  await nativeFetch(`/teams/${teamId}/join`, { method: 'POST', data: payload, params: {} })
}

export async function createJoinRequest(teamId: string, code?: string): Promise<void> {
  const payload = code != null ? { code } : {}
  await nativeFetch(`/teams/${teamId}/join`, { method: 'POST', data: payload, params: {} })
}

export async function createTeam(
  name: string,
  description?: string,
  visibility: 'public' | 'private' = 'private',
  accessCode?: string,
  requestToJoin?: boolean,
  iconColorStart?: string,
  iconColorEnd?: string
): Promise<Team> {
  const res = await nativeFetch('/teams', {
    method: 'POST',
    data: { name, description, visibility, accessCode, requestToJoin, iconColorStart, iconColorEnd },
    params: {}
  })
  return (res.data as any).team
}

export async function updateTeam(
  id: string,
  name: string,
  description: string,
  visibility: 'public' | 'private',
  accessCode?: string,
  requestToJoin?: boolean,
  iconColorStart?: string,
  iconColorEnd?: string
): Promise<Team> {
  const res = await nativeFetch(`/teams/${id}`, {
    method: 'PUT',
    data: { name, description, visibility, accessCode, requestToJoin, iconColorStart, iconColorEnd },
    params: {}
  })
  return (res.data as any).team
}

export async function deleteTeam(teamId: string): Promise<void> {
  await nativeFetch(`/teams/${teamId}`, { method: 'DELETE', params: {} })
}

export async function leaveTeam(teamId: string): Promise<void> {
  await nativeFetch(`/teams/${teamId}/leave`, { method: 'DELETE', params: {} })
}

export async function getTeam(teamId: string): Promise<Team> {
  const res = await nativeFetch(`/teams/${teamId}`, { method: 'GET', params: {} })
  return (res.data as any).team
}

export async function listMembers(teamId: string): Promise<Member[]> {
  const res = await nativeFetch(`/teams/${teamId}/members`, { method: 'GET', params: {} })
  return (res.data as any).members
}

export async function updateMemberRole(
  teamId: string,
  memberId: string,
  data: { role?: string; chatEnabled?: boolean }
): Promise<Member> {
  const res = await nativeFetch(
    `/teams/${teamId}/members/${memberId}`,
    { method: 'PUT', data, params: {} }
  )
  return (res.data as any).member
}

export async function removeMember(teamId: string, memberId: string): Promise<void> {
  await nativeFetch(`/teams/${teamId}/members/${memberId}`, { method: 'DELETE', params: {} })
}

export async function listInvites(teamId: string): Promise<Invite[]> {
  const res = await nativeFetch(`/teams/${teamId}/invites`, { method: 'GET', params: {} })
  return (res.data as any).invites
}

export async function createInvite(
  teamId: string,
  expiresInDays?: number,
  maxUses?: number,
  role?: string
): Promise<Invite> {
  const payload: any = {}
  if (expiresInDays != null) payload.expiresInDays = expiresInDays
  if (maxUses != null) payload.maxUses = maxUses
  if (role != null) payload.role = role
  const res = await nativeFetch(`/teams/${teamId}/invites`, {
    method: 'POST',
    data: payload,
    params: {}
  })
  return (res.data as any).invite
}

export async function acceptInvite(inviteId: string, role?: string): Promise<void> {
  const params: any = {}
  if (role != null) params.role = role
  await nativeFetch(`/invites/${inviteId}/accept`, { method: 'POST', params })
}

export async function deleteInvite(teamId: string, inviteId: string): Promise<void> {
  await nativeFetch(`/teams/${teamId}/invites/${inviteId}`, { method: 'DELETE', params: {} })
}

export async function listJoinRequests(teamId: string): Promise<JoinRequest[]> {
  const res = await nativeFetch(`/teams/${teamId}/requests`, { method: 'GET', params: {} })
  return (res.data as any).requests
}

export async function approveJoinRequest(teamId: string, userId: string): Promise<void> {
  await nativeFetch(`/teams/${teamId}/requests/${userId}/approve`, { method: 'POST', params: {} })
}

export async function denyJoinRequest(teamId: string, userId: string): Promise<void> {
  await nativeFetch(`/teams/${teamId}/requests/${userId}`, { method: 'DELETE', params: {} })
}

export async function uploadTeamImage(teamId: string, imageBlob: Blob): Promise<string> {
  const { ENV } = await import('../config/env');
  const { getStoredSessionToken } = await import('./auth');
  const API_BASE = ENV.API_BASE;
  const url = API_BASE.startsWith('http')
    ? `${API_BASE}/teams/${teamId}/upload-image`
    : `${API_BASE}/teams/${teamId}/upload-image`;

  const token = await getStoredSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': imageBlob.type,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: imageBlob,
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to upload team image');
  }
  const data = await res.json();
  return data.url;
}

export async function deleteTeamImage(teamId: string): Promise<void> {
  const { ENV } = await import('../config/env');
  const { getStoredSessionToken } = await import('./auth');
  const API_BASE = ENV.API_BASE;
  const url = API_BASE.startsWith('http')
    ? `${API_BASE}/teams/${teamId}/delete-image`
    : `${API_BASE}/teams/${teamId}/delete-image`;

  const token = await getStoredSessionToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to delete team image');
  }
}

export type LadderFormat = 'singles' | 'doubles' | 'mixed';

export interface Ladder {
  id: string;
  teamId: string;
  name: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LadderEntryUser {
  id: string;
  username?: string;
  profileImageUrl?: string | null;
}

export interface LadderEntry {
  id: string;
  ladderId: string;
  userId: string;
  partnerId: string | null;
  format: LadderFormat;
  position: number;
  user: LadderEntryUser;
  partner: LadderEntryUser | null;
  createdAt: string;
  updatedAt: string;
}

export async function listLadders(teamId: string): Promise<Ladder[]> {
  const res = await nativeFetch(`/teams/${teamId}/ladders`, { method: 'GET', params: {} });
  return (res.data as any).ladders;
}

export async function getLadder(teamId: string, ladderId: string): Promise<Ladder> {
  const res = await nativeFetch(`/teams/${teamId}/ladders/${ladderId}`, { method: 'GET', params: {} });
  return (res.data as any).ladder;
}

export async function createLadder(
  teamId: string,
  name: string,
  description?: string,
  startDate?: string | null,
  endDate?: string | null
): Promise<Ladder> {
  const res = await nativeFetch(`/teams/${teamId}/ladders`, {
    method: 'POST',
    data: { name, description, startDate, endDate },
    params: {}
  });
  return (res.data as any).ladder;
}

export async function updateLadder(
  teamId: string,
  ladderId: string,
  data: {
    name?: string;
    description?: string;
    startDate?: string | null;
    endDate?: string | null;
    isActive?: boolean;
  }
): Promise<Ladder> {
  const res = await nativeFetch(`/teams/${teamId}/ladders/${ladderId}`, {
    method: 'PUT',
    data,
    params: {}
  });
  return (res.data as any).ladder;
}

export async function deleteLadder(teamId: string, ladderId: string): Promise<void> {
  await nativeFetch(`/teams/${teamId}/ladders/${ladderId}`, { method: 'DELETE', params: {} });
}

export async function listLadderEntries(teamId: string, ladderId: string, format?: LadderFormat): Promise<LadderEntry[]> {
  const url = format 
    ? `/teams/${teamId}/ladders/${ladderId}/entries?format=${format}`
    : `/teams/${teamId}/ladders/${ladderId}/entries`;
  const res = await nativeFetch(url, { method: 'GET', params: {} });
  return (res.data as any).entries;
}

export async function addLadderEntry(teamId: string, ladderId: string, userId: string, format: LadderFormat = 'singles', partnerId?: string): Promise<LadderEntry> {
  const data: any = { userId, format };
  if (partnerId) data.partnerId = partnerId;
  const res = await nativeFetch(`/teams/${teamId}/ladders/${ladderId}/entries`, {
    method: 'POST',
    data,
    params: {}
  });
  return (res.data as any).entry;
}

export async function removeLadderEntry(teamId: string, ladderId: string, entryId: string): Promise<void> {
  await nativeFetch(`/teams/${teamId}/ladders/${ladderId}/entries/${entryId}`, { method: 'DELETE', params: {} });
}

export async function reorderLadderEntries(teamId: string, ladderId: string, order: string[], format: LadderFormat = 'singles'): Promise<LadderEntry[]> {
  const res = await nativeFetch(`/teams/${teamId}/ladders/${ladderId}/entries/reorder`, {
    method: 'POST',
    data: { order, format },
    params: {}
  });
  return (res.data as any).entries;
}

export type StatisticsVisibility = 'coaches_only' | 'coaches_and_players' | 'everyone';

export async function updateTeamStatisticsVisibility(teamId: string, visibility: StatisticsVisibility): Promise<void> {
  await nativeFetch(`/teams/${teamId}/settings`, {
    method: 'PUT',
    data: { statisticsVisibility: visibility },
    params: {}
  });
}

export type LineupFormat = 'singles' | 'doubles' | 'mixed';

export interface Lineup {
  id: string;
  teamId: string;
  name: string;
  description?: string | null;
  eventId?: string | null;
  eventName?: string | null;
  sourceLadderId?: string | null;
  sourceLadderName?: string | null;
  entryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LineupEntryUser {
  id: string;
  username?: string;
  profileImageUrl?: string | null;
}

export interface LineupEntry {
  id: string;
  lineupId: string;
  userId: string;
  partnerId: string | null;
  format: LineupFormat;
  position: number;
  user: LineupEntryUser;
  partner: LineupEntryUser | null;
  createdAt: string;
  updatedAt: string;
}

export async function listLineups(teamId: string): Promise<Lineup[]> {
  const res = await nativeFetch(`/teams/${teamId}/lineups`, { method: 'GET', params: {} });
  return (res.data as any).rosters;
}

export async function getLineup(teamId: string, lineupId: string): Promise<Lineup> {
  const res = await nativeFetch(`/teams/${teamId}/lineups/${lineupId}`, { method: 'GET', params: {} });
  return (res.data as any).roster;
}

export async function createLineup(
  teamId: string,
  name: string,
  description?: string,
  eventId?: string | null,
  sourceLadderId?: string | null,
  sourceFormat?: LadderFormat
): Promise<Lineup> {
  const res = await nativeFetch(`/teams/${teamId}/lineups`, {
    method: 'POST',
    data: { name, description, eventId, sourceLadderId, sourceFormat },
    params: {}
  });
  return (res.data as any).roster;
}

export async function updateLineup(
  teamId: string,
  lineupId: string,
  data: {
    name?: string;
    description?: string;
    eventId?: string | null;
  }
): Promise<Lineup> {
  const res = await nativeFetch(`/teams/${teamId}/lineups/${lineupId}`, {
    method: 'PUT',
    data,
    params: {}
  });
  return (res.data as any).roster;
}

export async function deleteLineup(teamId: string, lineupId: string): Promise<void> {
  await nativeFetch(`/teams/${teamId}/lineups/${lineupId}`, { method: 'DELETE', params: {} });
}

export async function listLineupEntries(teamId: string, lineupId: string, format?: LineupFormat): Promise<LineupEntry[]> {
  const url = format 
    ? `/teams/${teamId}/lineups/${lineupId}/entries?format=${format}`
    : `/teams/${teamId}/lineups/${lineupId}/entries`;
  const res = await nativeFetch(url, { method: 'GET', params: {} });
  return (res.data as any).entries;
}

export async function addLineupEntry(teamId: string, lineupId: string, userId: string, format: LineupFormat = 'singles', partnerId?: string): Promise<LineupEntry> {
  const data: any = { userId, format };
  if (partnerId) data.partnerId = partnerId;
  const res = await nativeFetch(`/teams/${teamId}/lineups/${lineupId}/entries`, {
    method: 'POST',
    data,
    params: {}
  });
  return (res.data as any).entry;
}

export async function removeLineupEntry(teamId: string, lineupId: string, entryId: string): Promise<void> {
  await nativeFetch(`/teams/${teamId}/lineups/${lineupId}/entries/${entryId}`, { method: 'DELETE', params: {} });
}

export async function reorderLineupEntries(teamId: string, lineupId: string, order: string[], format: LineupFormat = 'singles'): Promise<LineupEntry[]> {
  const res = await nativeFetch(`/teams/${teamId}/lineups/${lineupId}/entries/reorder`, {
    method: 'POST',
    data: { order, format },
    params: {}
  });
  return (res.data as any).entries;
}