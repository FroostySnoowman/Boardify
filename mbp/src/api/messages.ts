import { nativeFetch } from './http';
import { ENV } from '../config/env';

export interface Participant {
  id: string;
  username?: string;
  avatarUrl?: string;
}

export interface Conversation {
  id: string;
  type: 'private' | 'group';
  name?: string;
  lastMessage: string;
  lastMessageType?: string;
  lastMessageSender?: string | null;
  createdAt?: string;
  updatedAt: string;
  unreadCount: number;
  participants: Participant[];
  lastSenderAvatar?: string;
  starred?: boolean;
}

export interface Reaction {
  emoji: string;
  count: number;
  userIds: number[];
}

export interface PollOptionData {
  id: string;
  label: string;
  position: number;
  voteCount: number;
  voters: { id: string; username: string; profilePictureUrl?: string | null }[];
}

export interface PollData {
  id: string;
  question: string;
  options: PollOptionData[];
  allowMultiple: boolean;
  anonymous: boolean;
  closesAt: number | null;
  totalVotes: number;
  myVotes: string[];
}

export interface Message {
  id: string;
  clientId?: string;
  senderId: string;
  senderName?: string;
  senderProfilePicture?: string | null;
  content: string;
  timestamp: string;
  isMine: boolean;
  sentAt: number;
  parentMessageId?: string | null;
  replyToMessageId?: string | null;
  replyToMessageContent?: string;
  replyToMessageSenderName?: string;
  replyToMessageSenderProfilePicture?: string | null;
  replies?: Message[];
  replyCount?: number;
  readCount?: number;
  attachments?: string[];
  uploading?: boolean;
  pending?: boolean;
  failed?: boolean;
  messageType?: 'text' | 'poll' | 'announcement' | 'voice' | 'gif';
  editedAt?: number | null;
  deleted?: boolean;
  deletedContent?: string;
  metadata?: any;
  reactions?: Reaction[];
}

export interface PinnedMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderProfilePicture: string | null;
  content: string;
  sentAt: number;
  timestamp: string;
  messageType: string;
  metadata: any;
  attachments: string[];
  pinnedBy: number;
  pinnedByName: string;
  pinnedAt: string;
  isMine: boolean;
}

export interface GifResult {
  id: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
}

export async function listConversations(teamId: string): Promise<Conversation[]> {
  const res = await nativeFetch(`/teams/${teamId}/conversations`, { method: 'GET' });
  const raw = (res.data as any).conversations as any[];
  return raw.map((c: any) => ({
    id: c.id,
    type: c.type,
    name: c.name,
    lastMessage: c.lastMessage,
    lastMessageType: c.lastMessageType,
    lastMessageSender: c.lastMessageSender,
    updatedAt: c.updatedAt,
    unreadCount: c.unreadCount,
    participants: c.participants ?? [],
    lastSenderAvatar: c.lastSenderAvatar,
    starred: Boolean(c.starred),
  }));
}

export async function createPrivateConversation(
  teamId: string,
  participantId: string
): Promise<string> {
  const res = await nativeFetch(`/teams/${teamId}/conversations`, {
    method: 'POST',
    data: { participantId },
  });
  return (res.data as any).id;
}

export async function createGroupChat(
  teamId: string,
  name: string,
  userIds: string[],
  roles: string[],
  accessType: string = 'everyone'
): Promise<string> {
  const res = await nativeFetch(`/teams/${teamId}/conversations`, {
    method: 'POST',
    data: { chatName: name, userIds, roles, accessType },
  });
  return (res.data as any).id;
}

export async function getMessages(
  conversationId: string,
  before?: number,
  limit = 50
): Promise<{ messages: Message[]; hasMore: boolean }> {
  const params: Record<string, any> = {};
  if (before) params.before = before;
  if (limit) params.limit = limit;

  const res = await nativeFetch(`/conversations/${conversationId}/messages`, {
    method: 'GET',
    params,
  });
  const data = res.data as any;

  const messages: Message[] = (data.messages as any[]).map(m => ({
    id: String(m.id),
    senderId: String(m.senderId),
    senderName: m.senderName,
    senderProfilePicture: m.senderProfilePicture ?? null,
    content: m.content,
    timestamp: m.timestamp,
    isMine: Boolean(m.isMine),
    sentAt: m.sentAt,
    parentMessageId: m.parentMessageId ?? null,
    replyToMessageId: m.replyToMessageId ?? null,
    replyToMessageContent: m.replyToMessageContent,
    replyToMessageSenderName: m.replyToMessageSenderName,
    replyToMessageSenderProfilePicture: m.replyToMessageSenderProfilePicture ?? null,
    replies: m.replies,
    replyCount: m.replyCount,
    readCount: m.readCount,
    attachments: m.attachments || [],
    messageType: m.messageType || 'text',
    editedAt: m.editedAt ?? null,
    deleted: Boolean(m.deleted),
    ...(m.deletedContent != null ? { deletedContent: m.deletedContent } : {}),
    metadata: m.metadata || {},
    reactions: m.reactions || [],
  }));

  return { messages, hasMore: Boolean(data.hasMore) };
}

export async function sendMessage(
  conversationId: string,
  content: string,
  parentMessageId?: string,
  replyToMessageId?: string,
  attachments?: string[],
  messageType?: string,
  metadata?: any
): Promise<{ id: string; sentAt: string; messageType?: string }> {
  const res = await nativeFetch(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    data: {
      content,
      parentMessageId,
      replyToMessageId,
      attachments,
      ...(messageType ? { messageType } : {}),
      ...(metadata ? { metadata } : {}),
    },
  });
  return res.data as { id: string; sentAt: string; messageType?: string };
}

export async function uploadMessageImages(files: File[] | Array<{ uri: string; type: string; name: string }>): Promise<string[]> {
  const formData = new FormData();

  files.forEach((file, index) => {
    if (file instanceof File) {
      formData.append(`image${index}`, file);
    } else {
      const uriObj = file as { uri: string; type: string; name: string };
      formData.append(`image${index}`, {
        uri: uriObj.uri,
        type: uriObj.type || 'image/jpeg',
        name: uriObj.name || `image${index}.jpg`,
      } as any);
    }
  });

  const API_BASE = ENV.API_BASE;
  const url = API_BASE.startsWith('http')
    ? `${API_BASE}/upload/message-images`
    : `${API_BASE}/upload/message-images`;

  const { getStoredSessionToken } = await import('./auth');
  const token = await getStoredSessionToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Failed to upload images');
  }

  const data = await res.json();
  return data.urls;
}

export async function markMessagesRead(conversationId: string): Promise<void> {
  await nativeFetch(`/conversations/${conversationId}/messages/read`, { method: 'POST' });
}

export async function getReadBy(messageId: string): Promise<Participant[]> {
  const res = await nativeFetch(`/messages/${messageId}/read_by`, { method: 'GET' });
  return res.data as Participant[];
}

export async function registerDevice(token: string): Promise<void> {
  await nativeFetch('/devices/register', {
    method: 'POST',
    data: { token },
  });
}

export async function registerLiveActivityPushToken(
  token: string,
  apnsEnvironment: 'sandbox' | 'production'
): Promise<void> {
  await nativeFetch('/live-activity-push-token', {
    method: 'POST',
    data: { token, apns_environment: apnsEnvironment },
  });
}

export async function getLiveActivityPushTokenStatus(): Promise<{
  hasToken: boolean;
  apnsEnvironment: 'sandbox' | 'production';
  updatedAt: string | null;
}> {
  const res = await nativeFetch('/live-activity-push-token', {
    method: 'GET',
  });
  return res.data as {
    hasToken: boolean;
    apnsEnvironment: 'sandbox' | 'production';
    updatedAt: string | null;
  };
}

export async function getRecentConversations(limit: number = 5): Promise<(Conversation & { teamId: string; teamName?: string; teamImageUrl?: string | null })[]> {
  const res = await nativeFetch(`/conversations/recent?limit=${limit}`, { method: 'GET' });
  const raw = (res.data as any).conversations as any[];
  return raw.map((c: any) => ({
    id: c.id,
    type: c.type,
    name: c.name,
    lastMessage: c.lastMessage,
    lastMessageType: c.lastMessageType,
    lastMessageSender: c.lastMessageSender,
    updatedAt: c.updatedAt,
    unreadCount: c.unreadCount,
    participants: c.participants ?? [],
    lastSenderAvatar: c.lastSenderAvatar,
    teamId: c.teamId,
    teamName: c.teamName,
    teamImageUrl: c.teamImageUrl,
    starred: Boolean(c.starred),
  }));
}

export async function updateConversation(
  conversationId: string,
  data: { name?: string; accessType?: string; roles?: string[]; userIds?: string[] }
): Promise<void> {
  await nativeFetch(`/conversations/${conversationId}`, {
    method: 'PUT',
    data,
  });
}

export async function deleteConversation(conversationId: string): Promise<void> {
  await nativeFetch(`/conversations/${conversationId}`, {
    method: 'DELETE',
  });
}

export async function starConversation(conversationId: string): Promise<void> {
  await nativeFetch(`/conversations/${conversationId}/star`, {
    method: 'POST',
  });
}

export async function unstarConversation(conversationId: string): Promise<void> {
  await nativeFetch(`/conversations/${conversationId}/star`, {
    method: 'DELETE',
  });
}

export async function addReaction(conversationId: string, messageId: string, emoji: string): Promise<void> {
  await nativeFetch(`/conversations/${conversationId}/messages/${messageId}/reactions`, {
    method: 'POST',
    data: { emoji },
  });
}

export async function removeReaction(conversationId: string, messageId: string, emoji: string): Promise<void> {
  await nativeFetch(`/conversations/${conversationId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, {
    method: 'DELETE',
  });
}

export async function editMessage(conversationId: string, messageId: string, content: string): Promise<{ editedAt: number }> {
  const res = await nativeFetch(`/conversations/${conversationId}/messages/${messageId}`, {
    method: 'PUT',
    data: { content },
  });
  return res.data as { editedAt: number };
}

export async function deleteMessage(conversationId: string, messageId: string): Promise<void> {
  await nativeFetch(`/conversations/${conversationId}/messages/${messageId}`, {
    method: 'DELETE',
  });
}

export async function createPoll(
  conversationId: string,
  question: string,
  options: string[],
  allowMultiple = false,
  anonymous = false,
  closesAt?: number
): Promise<{ id: string; pollId: string; sentAt: string }> {
  const res = await nativeFetch(`/conversations/${conversationId}/polls`, {
    method: 'POST',
    data: { question, options, allowMultiple, anonymous, closesAt },
  });
  return res.data as { id: string; pollId: string; sentAt: string };
}

export async function getPoll(pollId: string): Promise<PollData & { conversationId: string; messageId: string; createdBy: number; createdAt: string }> {
  const res = await nativeFetch(`/polls/${pollId}`, { method: 'GET' });
  return res.data as any;
}

export async function votePoll(pollId: string, optionId: string): Promise<void> {
  await nativeFetch(`/polls/${pollId}/vote`, {
    method: 'POST',
    data: { optionId },
  });
}

export async function removePollVote(pollId: string, optionId: string): Promise<void> {
  await nativeFetch(`/polls/${pollId}/vote/${optionId}`, {
    method: 'DELETE',
  });
}

export async function pinMessage(conversationId: string, messageId: string): Promise<void> {
  await nativeFetch(`/conversations/${conversationId}/messages/${messageId}/pin`, {
    method: 'POST',
  });
}

export async function unpinMessage(conversationId: string, messageId: string): Promise<void> {
  await nativeFetch(`/conversations/${conversationId}/messages/${messageId}/pin`, {
    method: 'DELETE',
  });
}

export async function getPinnedMessages(conversationId: string): Promise<PinnedMessage[]> {
  const res = await nativeFetch(`/conversations/${conversationId}/pinned`, { method: 'GET' });
  return (res.data as any).pinned || [];
}

export async function searchGifs(query: string, limit = 20): Promise<GifResult[]> {
  const params: Record<string, any> = { limit };
  if (query) params.q = query;
  const res = await nativeFetch('/gifs/search', { method: 'GET', params });
  return (res.data as any).results || [];
}

export async function getTrendingGifs(limit = 20): Promise<GifResult[]> {
  const res = await nativeFetch(`/gifs/trending?limit=${limit}`, { method: 'GET' });
  return (res.data as any).results || [];
}

export async function uploadVoiceMessage(uri: string, mimeType = 'audio/m4a'): Promise<string> {
  const API_BASE = ENV.API_BASE;
  const url = `${API_BASE}/upload/voice-message`;

  const { getStoredSessionToken } = await import('./auth');
  const token = await getStoredSessionToken();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: await fetch(uri).then(r => r.blob()),
  });

  if (!res.ok) {
    let message = 'Failed to upload voice message';
    try {
      const error = await res.json();
      if (error?.error) message = error.error;
    } catch (_) {}
    throw new Error(message);
  }

  const data = await res.json();
  return data.voiceUrl;
}
