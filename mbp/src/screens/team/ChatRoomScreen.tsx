import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Modal,
  Dimensions,
  Alert,
  FlatList,
  ListRenderItemInfo,
  StyleSheet,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import Animated, { useAnimatedStyle, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import { clearChatParamsFromUrl } from '../../utils/webUrlSync';
import { Feather } from '@expo/vector-icons';
import {
  getMessages,
  sendMessage,
  markMessagesRead,
  Message,
  getReadBy,
  Participant,
  uploadMessageImages,
  addReaction,
  removeReaction,
  editMessage as apiEditMessage,
  deleteMessage as apiDeleteMessage,
  Reaction,
} from '../../api/messages';
import TeamLayout from './TeamLayout';
import { Skeleton } from '../../components/Skeleton';
import { Avatar } from '../../components/Avatar';
import { ChatInputSheet } from '../../components/ChatInputSheet';
import { useAuth } from '../../contexts/AuthContext';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import { KLIPY_ATTRIBUTION_ENABLED } from '../../config/attribution';
import MediaAttachment from '../../components/MediaAttachment';
import { compressMessageImages } from '../../utils/imageCompression';
import { getImageUrl } from '../../utils/imageUrl';
import { getStoredSessionToken } from '../../api/auth';
import { ENV } from '../../config/env';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { setCurrentChatConvId } from '../../utils/currentChatConvId';
import { dismissChatNotificationsForConversation } from '../../services/notifications';
import { useGradualAnimation } from '../../hooks/useGradualAnimation';
import { MessageActionSheet } from '../../components/MessageActionSheet';
import { PollMessage } from '../../components/PollMessage';
import { AnnouncementMessage } from '../../components/AnnouncementMessage';
import { VoiceMessagePlayer } from '../../components/VoiceMessagePlayer';
import { PinnedMessageBanner } from '../../components/PinnedMessageBanner';
import { PlatformBottomSheet } from '../../components/PlatformBottomSheet';
import { useChatAccess, ChatBlockScreen } from '../../components/ChatAccessGate';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const TIME_THRESHOLD = 30 * 60 * 1000;

const normalizeSentAt = (v: number | string) =>
  typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : new Date(v).getTime();

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const dayKey = (ts: number) => {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const formatMessageDate = (timestamp: number) => {
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
};

function renderMessageContent(content: string) {
  const parts = content.split(/(@[^\s@]+)/g);
  if (parts.length === 1) {
    return <Text className="text-[15px] text-gray-100 leading-relaxed break-words">{content}</Text>;
  }
  return (
    <Text className="text-[15px] text-gray-100 leading-relaxed break-words">
      {parts.map((part, i) =>
        part.startsWith('@') && part.length > 1
          ? <Text key={i} className="text-blue-400 font-semibold">{part}</Text>
          : <Text key={i}>{part}</Text>
      )}
    </Text>
  );
}

const MessageGroup = memo(function MessageGroup({
  group,
  showTimestamp,
  onReply,
  onShowReplies,
  onShowReadBy,
  onImageClick,
  uploadingMessage,
  onLongPress,
  onReactionToggle,
  onToggleRevealDeleted,
  userId,
  isPrivileged,
  revealedDeletedIds,
  pollRefreshKey,
}: {
  group: {
    messages: Message[];
    isMine: boolean;
    senderProfilePicture?: string | null;
    senderName: string;
    senderId: string;
  };
  showTimestamp: boolean;
  onReply: (message: Message) => void;
  onShowReplies: (message: Message) => void;
  onShowReadBy: (messageId: string) => void;
  onImageClick: (images: string[], index: number) => void;
  uploadingMessage?: boolean;
  onLongPress?: (message: Message) => void;
  onReactionToggle?: (messageId: string, emoji: string, hasReacted: boolean) => void;
  onToggleRevealDeleted?: (messageId: string) => void;
  userId?: string;
  isPrivileged?: boolean;
  revealedDeletedIds?: Set<string>;
  pollRefreshKey?: number;
}) {
  const firstMessage = group.messages[0];
  const lastMessage = group.messages[group.messages.length - 1];

  const hasReply = firstMessage.replyToMessageId && !firstMessage.deleted;

  return (
    <View className="px-4 py-0.5">
      {hasReply && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingLeft: 4 }}>
          <View style={{ width: 36, height: 16, position: 'relative' }}>
            <View style={{
              position: 'absolute',
              left: 16,
              top: 0,
              width: 20,
              height: 16,
              borderLeftWidth: 2,
              borderTopWidth: 2,
              borderColor: 'rgba(148,163,184,0.35)',
              borderTopLeftRadius: 8,
            }} />
          </View>
          <Avatar
            src={firstMessage.replyToMessageSenderProfilePicture}
            alt={firstMessage.replyToMessageSenderName || '?'}
            size="xs"
          />
          <Text style={{ marginLeft: 6, fontSize: 12, color: '#94a3b8', flex: 1 }} numberOfLines={1}>
            <Text style={{ fontWeight: '600', color: '#cbd5e1' }}>
              {firstMessage.replyToMessageSenderName}
            </Text>
            {'  '}
            {firstMessage.replyToMessageContent || ''}
          </Text>
        </View>
      )}

      <View className="flex-row gap-3 py-0.5">
        <View className="flex-shrink-0 mt-0.5">
          <Avatar src={group.senderProfilePicture} alt={group.senderName} size="md" />
        </View>
        <View className="flex-1 min-w-0">
          <View className="flex-row items-baseline gap-2 mb-0.5">
            <Text className="font-semibold text-white text-[15px]">{group.senderName}</Text>
            {showTimestamp && (
              <Text className="text-[11px] text-gray-500 font-medium">
                {new Date(firstMessage.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </Text>
            )}
          </View>

          <View className="gap-0.5">
            {group.messages.map((m, idx) => {
              const isLastMessage = idx === group.messages.length - 1;
              const messageType = m.messageType || 'text';
              const isDeleted = m.deleted;

              return (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.8}
                  onLongPress={() => {
                    if (!isDeleted && !m.uploading && !m.pending) {
                      hapticMedium();
                      onLongPress?.(m);
                    }
                  }}
                  delayLongPress={300}
                >

                  {isDeleted ? (
                    <View className="flex-row items-center gap-2 py-1">
                      <View className="flex-row items-center gap-1.5 flex-1 opacity-50">
                        <Feather name="slash" size={14} color="#6b7280" />
                        <Text className="text-sm text-gray-500 italic flex-1">
                          {revealedDeletedIds?.has(m.id) && m.deletedContent
                            ? m.deletedContent
                            : 'This message was deleted'}
                        </Text>
                      </View>
                      {isPrivileged && m.deletedContent && (
                        <TouchableOpacity
                          onPress={() => onToggleRevealDeleted?.(m.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          className="p-1"
                        >
                          <Feather
                            name={revealedDeletedIds?.has(m.id) ? 'eye-off' : 'eye'}
                            size={16}
                            color="#9ca3af"
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : messageType === 'announcement' ? (
                    <AnnouncementMessage content={m.content} senderName={group.senderName} />
                  ) : messageType === 'poll' && m.metadata?.pollId ? (
                    <PollMessage
                      pollId={m.metadata.pollId}
                      question={m.content}
                      isMine={m.isMine}
                      initialPollData={m.metadata?.poll}
                      refreshKey={pollRefreshKey}
                    />
                  ) : messageType === 'voice' && m.metadata?.voiceUrl ? (
                    <VoiceMessagePlayer
                      voiceUrl={m.metadata.voiceUrl}
                      durationMs={m.metadata.durationMs}
                      waveform={m.metadata.waveform}
                      onLongPress={() => onLongPress?.(m)}
                    />
                  ) : messageType === 'gif' && m.metadata?.gifUrl ? (
                    <TouchableOpacity
                      onPress={() => onImageClick([m.metadata.gifUrl], 0)}
                      onLongPress={() => {
                        if (!isDeleted && !m.uploading && !m.pending) {
                          hapticMedium();
                          onLongPress?.(m);
                        }
                      }}
                      delayLongPress={300}
                      className="my-1"
                      activeOpacity={0.9}
                    >
                      <ExpoImage
                        source={{ uri: m.metadata.gifUrl }}
                        placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                        cachePolicy="memory-disk"
                        transition={200}
                        style={{
                          width: Math.min(m.metadata.width || 250, 280),
                          height: Math.min(
                            ((m.metadata.width || 250) / (m.metadata.width || 250)) * (m.metadata.height || 200),
                            280
                          ),
                          borderRadius: 12,
                        }}
                        contentFit="cover"
                      />
                      <View className="absolute bottom-2 right-2 bg-black/50 rounded px-1.5 py-0.5">
                        <Text className="text-[9px] text-white font-semibold">
                          {KLIPY_ATTRIBUTION_ENABLED ? 'KLIPY' : 'GIF'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View>
                      <View className="flex-row items-start gap-2">
                        <View className="flex-1 min-w-0">
                          {m.content ? renderMessageContent(m.content) : null}

                          {m.editedAt && (
                            <Text className="text-[10px] text-gray-500 mt-0.5">(edited)</Text>
                          )}

                          {m.attachments && m.attachments.length > 0 && (
                            <View
                              className={`gap-2 ${m.content ? 'mt-2' : ''} ${m.attachments.length === 1 ? 'max-w-md' : 'max-w-lg'}`}
                              style={{
                                flexDirection: m.attachments.length > 1 ? 'row' : 'column',
                                flexWrap: m.attachments.length > 1 ? 'wrap' : 'nowrap',
                              }}
                            >
                              {m.attachments.map((url, aIdx) => (
                                <MediaAttachment
                                  key={aIdx}
                                  url={url}
                                  index={aIdx}
                                  total={m.attachments!.length}
                                  onImageClick={onImageClick}
                                  allAttachments={m.attachments!}
                                  uploading={m.uploading || uploadingMessage}
                                  onMessageLongPress={
                                    !isDeleted && !m.uploading && !m.pending
                                      ? () => {
                                          hapticMedium();
                                          onLongPress?.(m);
                                        }
                                      : undefined
                                  }
                                />
                              ))}
                            </View>
                          )}

                          {m.uploading && m.attachments && m.attachments.length === 0 && (
                            <View className={`gap-2 ${m.content ? 'mt-2' : ''} max-w-md`}>
                              <MediaAttachment
                                key="uploading"
                                url=""
                                index={0}
                                total={1}
                                onImageClick={onImageClick}
                                allAttachments={[]}
                                uploading={true}
                              />
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  )}

                  {!isDeleted && m.reactions && m.reactions.length > 0 && (
                    <View className="flex-row flex-wrap gap-1 mt-1.5">
                      {m.reactions.map((r: Reaction) => {
                        const hasReacted = userId ? r.userIds.includes(Number(userId)) : false;
                        return (
                          <TouchableOpacity
                            key={r.emoji}
                            onPress={() => {
                              hapticLight();
                              onReactionToggle?.(m.id, r.emoji, hasReacted);
                            }}
                            className={`flex-row items-center gap-1 px-2 py-1 rounded-full border ${
                              hasReacted ? 'bg-purple-500/20 border-purple-500/40' : 'bg-white/5 border-white/10'
                            }`}
                          >
                            <Text style={{ fontSize: 14 }}>{r.emoji}</Text>
                            <Text className={`text-xs ${hasReacted ? 'text-purple-300' : 'text-gray-400'}`}>
                              {r.count}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {!isDeleted && (m.replyCount ?? 0) > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        hapticLight();
                        onShowReplies(m);
                      }}
                      className="flex-row items-center gap-1 py-1 mt-1"
                    >
                      <Feather name="message-square" size={14} color="#60a5fa" />
                      <Text className="text-xs text-blue-400 font-medium">
                        {m.replyCount} {m.replyCount === 1 ? 'reply' : 'replies'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
});

type Group = {
  messages: Message[];
  senderId: string;
  isMine: boolean;
  senderProfilePicture?: string | null;
  senderName: string;
};

type RenderItem =
  | { type: 'skeleton'; key: string }
  | { type: 'date'; key: string; ts: number }
  | { type: 'group'; key: string; group: Group; showTimestamp: boolean };

export default function ChatRoomScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { convId, teamId } = (route.params as any) || {};

  const [conversationName, setConversationName] = useState<string>('general');

  const composerBase = Platform.OS === 'ios'
    ? Math.max(insets.bottom, 0)
    : 8;
  const { keyboardHeight, progress: keyboardProgress } = useGradualAnimation(composerBase);
  const composerHeight = useSharedValue(0);

  const bottomInset = useDerivedValue(() => {
    const height = Math.max(0, keyboardHeight.value);
    const progress = Math.min(1, Math.max(0, keyboardProgress.value));
    return height + composerBase * (1 - progress);
  }, [composerBase]);

  const composerTranslateStyle = useAnimatedStyle(() => {
    const inset = bottomInset.value;
    return { transform: [{ translateY: -(inset - composerBase) }] };
  }, [composerBase, bottomInset]);

  const listSpacerStyle = useAnimatedStyle(() => {
    return { height: composerHeight.value + bottomInset.value };
  }, [bottomInset]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newMsg, setNewMsg] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [readBy, setReadBy] = useState<Participant[]>([]);
  const [readByModalOpen, setReadByModalOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [attachmentPickerKey, setAttachmentPickerKey] = useState(0);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [actionSheetMessage, setActionSheetMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editContent, setEditContent] = useState('');
  const [pinnedRefreshKey, setPinnedRefreshKey] = useState(0);
  const [pollRefreshKey, setPollRefreshKey] = useState(0);
  const [pinnedMessageIds, setPinnedMessageIds] = useState<Set<string>>(new Set());
  const [userRole, setUserRole] = useState<string | null>(null);
  const [revealedDeletedIds, setRevealedDeletedIds] = useState<Set<string>>(new Set());
  const [teamMembersForMention, setTeamMembersForMention] = useState<{ id: string; username: string; profilePictureUrl?: string | null; role?: string }[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<number, string>>(new Map());
  const typingTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const { canChat, reason } = useChatAccess();
  const listRef = useRef<ScrollView>(null);
  const mainInputRef = useRef<TextInput>(null);
  const lastTsRef = useRef(0);
  const wsRef = useRef<WebSocket | null>(null);
  const atBottomRef = useRef(true);
  const conversationNameRef = useRef(conversationName);
  conversationNameRef.current = conversationName;
  const initialScrollDoneRef = useRef(false);
  const scrollYRef = useRef(0);
  const contentHeightRef = useRef(0);
  const adjustScrollAfterLoadOlderRef = useRef(false);
  const savedScrollYRef = useRef(0);
  const savedContentHeightRef = useRef(0);
  const loadOlderTriggeredRef = useRef(false);

  const scrollToBottom = useCallback((animated: boolean = true) => {
    const doScroll = () => {
      if (!listRef.current) return;
      (listRef.current as any).scrollToEnd?.({ animated }) ||
        (listRef.current as any).scrollTo?.({ y: 99999, animated });
    };
    setTimeout(doScroll, 50);
    setTimeout(doScroll, 300);
  }, []);

  const topLevelMessages = useMemo(() => messages.filter(m => !m.parentMessageId), [messages]);

  useEffect(() => {
    if ((route.params as any)?.conversationName) {
      setConversationName((route.params as any).conversationName);
    }
  }, [route.params]);

  useEffect(() => {
    if (convId) {
      setCurrentChatConvId(convId);
      dismissChatNotificationsForConversation(convId);
    }
    return () => setCurrentChatConvId(null);
  }, [convId]);

  const renderItems = useMemo<RenderItem[]>(() => {
    if (loading) {
      return Array.from({ length: 12 }).map((_, i) => ({ type: 'skeleton', key: `sk-${i}` }));
    }

    const sorted = [...topLevelMessages].sort((a, b) => b.sentAt - a.sentAt);

    const groupsDesc: Group[] = [];
    let curr: {
      messagesDesc: Message[];
      senderId: string;
      isMine: boolean;
      senderProfilePicture?: string | null;
      senderName: string;
    } | null = null;

    const canMerge = (a: Message, b: Message) => {
      if (a.senderId !== b.senderId) return false;
      if (a.replyToMessageId || b.replyToMessageId) return false;
      if (a.sentAt - b.sentAt > TIME_THRESHOLD) return false;
      return true;
    };

    for (const m of sorted) {
      if (!curr) {
        curr = {
          messagesDesc: [m],
          senderId: m.senderId,
          isMine: m.isMine,
          senderProfilePicture: m.senderProfilePicture,
          senderName: m.senderName || 'Unknown',
        };
        continue;
      }

      const oldestSoFar = curr.messagesDesc[curr.messagesDesc.length - 1];
      const ok = canMerge(oldestSoFar, m);

      if (ok) {
        curr.messagesDesc.push(m);
      } else {
        groupsDesc.push({
          messages: [...curr.messagesDesc].reverse(),
          senderId: curr.senderId,
          isMine: curr.isMine,
          senderProfilePicture: curr.senderProfilePicture,
          senderName: curr.senderName,
        });
        curr = {
          messagesDesc: [m],
          senderId: m.senderId,
          isMine: m.isMine,
          senderProfilePicture: m.senderProfilePicture,
          senderName: m.senderName || 'Unknown',
        };
      }
    }

    if (curr) {
      groupsDesc.push({
        messages: [...curr.messagesDesc].reverse(),
        senderId: curr.senderId,
        isMine: curr.isMine,
        senderProfilePicture: curr.senderProfilePicture,
        senderName: curr.senderName,
      });
    }

    const items: RenderItem[] = [];
    let prevNewerGroup: Group | null = null;
    let prevNewerDay: string | null = null;

    for (const g of groupsDesc) {
      const newestInGroup = g.messages[g.messages.length - 1];
      const dKey = dayKey(newestInGroup.sentAt);

      if (prevNewerDay && dKey !== prevNewerDay) {
        items.push({ type: 'date', key: `date-${dKey}-${newestInGroup.id}`, ts: newestInGroup.sentAt });
      }

      const showTimestamp =
        !prevNewerGroup || prevNewerGroup.messages[0].sentAt - newestInGroup.sentAt > TIME_THRESHOLD;

      items.push({
        type: 'group',
        key: `group-${newestInGroup.id}-${g.senderId}`,
        group: g,
        showTimestamp,
      });

      prevNewerGroup = g;
      prevNewerDay = dKey;
    }

    return items;
  }, [loading, topLevelMessages]);

  const isEmptyChatWeb = Platform.OS === 'web' && !loading && messages.length === 0;

  useEffect(() => {
    if (!loading && messages.length > 0 && !initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      scrollToBottom(false);
    }
  }, [loading, messages.length, scrollToBottom]);

  const loadOlder = useCallback(async () => {
    if (!convId || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    loadOlderTriggeredRef.current = true;
    try {
      const earliest = messages.reduce((min, m) => Math.min(min, m.sentAt), Date.now());
      const { messages: olderRaw, hasMore: more } = await getMessages(convId, Math.floor(earliest / 1000));
      const newMessages = olderRaw.map(m => ({ ...m, sentAt: normalizeSentAt(m.sentAt) }));
      savedScrollYRef.current = scrollYRef.current;
      savedContentHeightRef.current = contentHeightRef.current;
      adjustScrollAfterLoadOlderRef.current = true;
      setMessages(prev => [...newMessages, ...prev]);
      setHasMore(more);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load older messages');
    } finally {
      setLoadingOlder(false);
    }
  }, [convId, loadingOlder, hasMore, messages]);

  useEffect(() => {
    if (!convId) return;

    let ws: WebSocket | null = null;
    let isMounted = true;

    const connect = async () => {
      if (!isMounted) return;

      setLoading(true);
      try {
        const [{ messages: raw, hasMore: more }, pinned, token] = await Promise.all([
          getMessages(convId, undefined, 50),
          import('../../api/messages').then(({ getPinnedMessages }) => getPinnedMessages(convId)),
          getStoredSessionToken(),
        ]);
        markMessagesRead(convId).catch(() => {});
        const norm = raw.map(m => ({ ...m, sentAt: normalizeSentAt(m.sentAt) }));
        setMessages(norm);
        setHasMore(more);
        setPinnedMessageIds(new Set(pinned.map(p => p.id)));
        lastTsRef.current = norm.length ? Math.max(...norm.map(m => m.sentAt)) : lastTsRef.current;

        if (!token || !isMounted) throw new Error('User not authenticated.');

        const apiBase = ENV.API_BASE;
        if (!apiBase) throw new Error('API_BASE is not set.');

        let origin: string;
        if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
          origin = apiBase;
        } else if (apiBase.startsWith('/')) {
          const appUrl = ENV.APP_URL || 'https://mybreakpoint.app';
          origin = appUrl.replace(/\/$/, '') + apiBase;
        } else {
          origin = `https://${apiBase}`;
        }

        const host = origin.replace(/^https?:\/\//, '');
        const proto = origin.startsWith('https:') ? 'wss' : 'ws';
        const wsUrl = `${proto}://${host}/ws/conversations/${convId}/messages?token=${token}`;

        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = e => {
          if (!isMounted) return;
          try {
            const rawMsg = JSON.parse(e.data) as any;

            if (rawMsg.type === 'reaction') {
              setMessages(prev => prev.map(m => {
                if (m.id !== rawMsg.messageId) return m;
                const reactions = [...(m.reactions || [])];
                const existing = reactions.findIndex(r => r.emoji === rawMsg.emoji);
                if (rawMsg.action === 'add') {
                  if (existing >= 0) {
                    if (!reactions[existing].userIds.includes(rawMsg.userId)) {
                      reactions[existing] = { ...reactions[existing], count: reactions[existing].count + 1, userIds: [...reactions[existing].userIds, rawMsg.userId] };
                    }
                  } else {
                    reactions.push({ emoji: rawMsg.emoji, count: 1, userIds: [rawMsg.userId] });
                  }
                } else if (rawMsg.action === 'remove' && existing >= 0) {
                  const newUserIds = reactions[existing].userIds.filter((id: number) => id !== rawMsg.userId);
                  if (newUserIds.length === 0) {
                    reactions.splice(existing, 1);
                  } else {
                    reactions[existing] = { ...reactions[existing], count: newUserIds.length, userIds: newUserIds };
                  }
                }
                return { ...m, reactions };
              }));
              return;
            }

            if (rawMsg.type === 'message_edited') {
              setMessages(prev => prev.map(m =>
                m.id === rawMsg.messageId ? { ...m, content: rawMsg.content, editedAt: rawMsg.editedAt } : m
              ));
              return;
            }

            if (rawMsg.type === 'message_deleted') {
              setMessages(prev => prev.map(m =>
                m.id === rawMsg.messageId ? { ...m, deleted: true, content: '', attachments: [] } : m
              ));
              return;
            }

            if (rawMsg.type === 'message_pinned') {
              setPinnedRefreshKey(k => k + 1);
              setPinnedMessageIds(prev => new Set([...prev, rawMsg.messageId]));
              return;
            }
            if (rawMsg.type === 'message_unpinned') {
              setPinnedRefreshKey(k => k + 1);
              setPinnedMessageIds(prev => {
                const next = new Set(prev);
                next.delete(rawMsg.messageId);
                return next;
              });
              return;
            }

            if (rawMsg.type === 'poll_vote') {
              setPollRefreshKey(k => k + 1);
              return;
            }

            if (rawMsg.type === 'typing') {
              setTypingUsers(prev => {
                const next = new Map(prev);
                next.set(rawMsg.userId, rawMsg.username);
                return next;
              });
              const existing = typingTimeoutsRef.current.get(rawMsg.userId);
              if (existing) clearTimeout(existing);
              typingTimeoutsRef.current.set(rawMsg.userId, setTimeout(() => {
                setTypingUsers(prev => {
                  const next = new Map(prev);
                  next.delete(rawMsg.userId);
                  return next;
                });
                typingTimeoutsRef.current.delete(rawMsg.userId);
              }, 6000));
              return;
            }

            if (rawMsg.type === 'stop_typing') {
              setTypingUsers(prev => {
                const next = new Map(prev);
                next.delete(rawMsg.userId);
                return next;
              });
              const existing = typingTimeoutsRef.current.get(rawMsg.userId);
              if (existing) {
                clearTimeout(existing);
                typingTimeoutsRef.current.delete(rawMsg.userId);
              }
              return;
            }

            if (rawMsg.type === 'read_receipt') {
              setMessages(prev => prev.map(m => {
                if (rawMsg.messageIds.includes(m.id)) {
                  return { ...m, readCount: (m.readCount || 0) + 1 };
                }
                return m;
              }));
              return;
            }

            const msg: Message = {
              id: String(rawMsg.id),
              senderId: String(rawMsg.senderId),
              senderName: rawMsg.senderName,
              senderProfilePicture: rawMsg.senderProfilePicture ?? null,
              content: rawMsg.content || '',
              timestamp: rawMsg.timestamp,
              isMine: Boolean(rawMsg.isMine),
              sentAt: normalizeSentAt(rawMsg.sentAt),
              parentMessageId: rawMsg.parentMessageId ?? null,
              replyToMessageId: rawMsg.replyToMessageId ?? null,
              replyToMessageContent: rawMsg.replyToMessageContent,
              replyToMessageSenderName: rawMsg.replyToMessageSenderName,
              replyToMessageSenderProfilePicture: rawMsg.replyToMessageSenderProfilePicture ?? null,
              replies: rawMsg.replies,
              replyCount: rawMsg.replyCount,
              readCount: rawMsg.readCount,
              attachments: rawMsg.attachments || [],
              messageType: rawMsg.messageType || 'text',
              editedAt: rawMsg.editedAt ?? null,
              deleted: false,
              metadata: rawMsg.metadata || {},
              reactions: rawMsg.reactions || [],
            };

            setMessages(prev => (prev.find(m => m.id === msg.id) ? prev : [...prev, msg]));
            if (atBottomRef.current) scrollToBottom(true);
            if (!msg.isMine) hapticMedium();
          } catch (e) {
            console.warn('Failed to parse message:', e);
          }
        };

        ws.onclose = (e) => {
          wsRef.current = null;
          if (isMounted && e.code !== 1001) {
            setTimeout(() => {
              if (isMounted && !wsRef.current) connect();
            }, 3000);
          }
        };
      } catch (e) {
        console.error('💬 Failed to connect WebSocket:', e);
        if (isMounted) {
          setLoading(false);
          setTimeout(() => {
            if (isMounted && !wsRef.current) connect();
          }, 5000);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    connect();

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);

    return () => {
      isMounted = false;
      clearInterval(pingInterval);
      if (ws) ws.close(1001, 'Component unmounting');
      wsRef.current = null;
      typingTimeoutsRef.current.forEach(t => clearTimeout(t));
      typingTimeoutsRef.current.clear();
    };
  }, [convId, scrollToBottom]);

  const handleSend = useCallback(async () => {
    if ((!newMsg.trim() && selectedImages.length === 0) || !convId) return;

    hapticMedium();

    const now = Date.now();
    const parentId = undefined;
    const replyId = replyingTo?.id;

    let attachments: string[] = [];
    let uploadingTempMessage: Message | undefined;
    const hasAttachments = selectedImages.length > 0;

    if (hasAttachments) {
      const imagesToUpload = selectedImages;
      setUploadingImages(true);
      setSelectedImages([]);
      setAttachmentPickerKey(k => k + 1);

      const uploadingTemp: Message = {
        id: `uploading-${now}`,
        senderId: user?.id || '',
        senderName: user?.username || user?.email?.split('@')[0] || 'User',
        senderProfilePicture: user?.profilePictureUrl || null,
        content: newMsg,
        timestamp: new Date(now).toISOString(),
        isMine: true,
        sentAt: now,
        parentMessageId: parentId ?? null,
        replyToMessageId: replyId ?? null,
        replyToMessageContent: replyingTo?.content,
        replyToMessageSenderName: replyingTo?.senderName,
        replyToMessageSenderProfilePicture: replyingTo?.senderProfilePicture ?? null,
        attachments: [''],
        uploading: true,
      };

      uploadingTempMessage = uploadingTemp;
      setMessages(prev => [...prev, uploadingTemp]);
      setNewMsg('');
      setReplyingTo(null);
      scrollToBottom(true);

      try {
        const compressed = await compressMessageImages(imagesToUpload);
        attachments = await uploadMessageImages(compressed);
      } catch (error: any) {
        const msg = error.message || 'Failed to upload media';
        const isModeration = /rejected|safety filters/i.test(msg);
        Alert.alert(isModeration ? 'Image not allowed' : 'Error', msg);
        setMessages(prev => prev.filter(m => m.id !== uploadingTemp.id));
        setUploadingImages(false);
        return;
      } finally {
        setUploadingImages(false);
      }
    }

    const temp: Message = uploadingTempMessage
      ? {
        id: `local-${now}`,
        senderId: uploadingTempMessage.senderId,
        senderName: uploadingTempMessage.senderName,
        senderProfilePicture: uploadingTempMessage.senderProfilePicture,
        content: uploadingTempMessage.content,
        timestamp: uploadingTempMessage.timestamp,
        isMine: true,
        sentAt: now,
        parentMessageId: parentId ?? null,
        replyToMessageId: replyId ?? null,
        replyToMessageContent: uploadingTempMessage.replyToMessageContent,
        replyToMessageSenderName: uploadingTempMessage.replyToMessageSenderName,
        attachments,
        uploading: false,
      }
      : {
        id: `local-${now}`,
        senderId: user?.id || '',
        senderName: user?.username || user?.email?.split('@')[0] || 'User',
        senderProfilePicture: user?.profilePictureUrl || null,
        content: newMsg,
        timestamp: new Date(now).toISOString(),
        isMine: true,
        sentAt: now,
        parentMessageId: parentId ?? null,
        replyToMessageId: replyId ?? null,
        replyToMessageContent: replyingTo?.content,
        replyToMessageSenderName: replyingTo?.senderName,
        replyToMessageSenderProfilePicture: replyingTo?.senderProfilePicture ?? null,
        attachments,
      };

    setMessages(prev => {
      const filtered = uploadingTempMessage ? prev.filter(m => m.id !== uploadingTempMessage!.id) : prev;
      const next = [...filtered, temp];
      if (parentId) {
        return next.map(m => (m.id === parentId ? { ...m, replyCount: (m.replyCount || 0) + 1 } : m));
      }
      return next;
    });

    if (!uploadingTempMessage) {
      setNewMsg('');
      setReplyingTo(null);
      scrollToBottom(true);
    }

    try {
      const saved = await sendMessage(convId, newMsg.trim(), parentId, replyId, attachments);
      const serverTs = normalizeSentAt(saved.sentAt);
      lastTsRef.current = serverTs;
      setMessages(prev => {
        const mapped = prev.map(m =>
          m.id === temp.id ? { ...temp, id: saved.id, sentAt: serverTs, timestamp: saved.sentAt } : m,
        );
        return mapped.filter((m, i, a) => a.findIndex(x => x.id === m.id) === i);
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== temp.id));
    }
  }, [newMsg, selectedImages, convId, replyingTo, user, scrollToBottom]);

  const handleShowReadBy = async (messageId: string) => {
    try {
      const users = await getReadBy(messageId);
      setReadBy(users);
      setReadByModalOpen(true);
    } catch {
      Alert.alert('Error', 'Could not fetch read receipts.');
    }
  };

  const handleImageClick = useCallback((images: string[], index: number) => {
    const processedImages = images.map(url => getImageUrl(url)).filter((url): url is string => url !== null);
    setGalleryImages(processedImages);
    setGalleryIndex(index);
    setGalleryOpen(true);
  }, []);

  const lastTypingSentRef = useRef(0);
  const sendTypingEvent = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 3000) return;
    lastTypingSentRef.current = now;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing' }));
    }
  }, []);

  const sendStopTyping = useCallback(() => {
    lastTypingSentRef.current = 0;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_typing' }));
    }
  }, []);

  const handleReply = (message: Message) => {
    setReplyingTo(message);
    setTimeout(() => mainInputRef.current?.focus(), 0);
    if (atBottomRef.current) scrollToBottom(true);
  };

  const handleShowReplies = (_message: Message) => {
  };

  useEffect(() => {
    if (!teamId || !user?.id) return;
    (async () => {
      try {
        const { nativeFetch } = await import('../../api/http');
        const res = await nativeFetch(`/teams/${teamId}/members`, { method: 'GET' });
        const members = (res.data as any)?.members || [];
        const me = members.find((m: any) => String(m.id) === String(user.id));
        if (me) setUserRole(me.role);
        setTeamMembersForMention(members.map((m: any) => ({
          id: String(m.id),
          username: m.username || 'Unknown',
          profilePictureUrl: m.profilePictureUrl || null,
          role: m.role,
        })));
      } catch {}
    })();
  }, [teamId, user?.id]);

  const isPrivileged =
    userRole != null &&
    (userRole.toLowerCase() === 'owner' || userRole.toLowerCase() === 'coach');

  const toggleRevealDeleted = useCallback((messageId: string) => {
    hapticLight();
    setRevealedDeletedIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }, []);

  const handleLongPress = useCallback((message: Message) => {
    setActionSheetMessage(message);
  }, []);

  const handleReactionToggle = useCallback(async (messageId: string, emoji: string, hasReacted: boolean) => {
    if (!convId) return;
    try {
      if (hasReacted) {
        await removeReaction(convId, messageId, emoji);
        setMessages(prev => prev.map(m => {
          if (m.id !== messageId) return m;
          const reactions = (m.reactions || []).map(r => {
            if (r.emoji !== emoji) return r;
            const userIds = r.userIds.filter(id => id !== Number(user?.id));
            return { ...r, count: userIds.length, userIds };
          }).filter(r => r.count > 0);
          return { ...m, reactions };
        }));
      } else {
        await addReaction(convId, messageId, emoji);
        setMessages(prev => prev.map(m => {
          if (m.id !== messageId) return m;
          const reactions = [...(m.reactions || [])];
          const existing = reactions.findIndex(r => r.emoji === emoji);
          if (existing >= 0) {
            reactions[existing] = {
              ...reactions[existing],
              count: reactions[existing].count + 1,
              userIds: [...reactions[existing].userIds, Number(user?.id)]
            };
          } else {
            reactions.push({ emoji, count: 1, userIds: [Number(user?.id)] });
          }
          return { ...m, reactions };
        }));
      }
    } catch (e) {
      console.warn('Reaction failed:', e);
    }
  }, [convId, user?.id]);

  const handleQuickReaction = useCallback(async (emoji: string) => {
    if (!actionSheetMessage || !convId) return;
    const msgId = actionSheetMessage.id;
    const uid = Number(user?.id);
    const hasReacted = (actionSheetMessage.reactions || []).some(r => r.emoji === emoji && r.userIds.includes(uid));
    await handleReactionToggle(msgId, emoji, hasReacted);
  }, [actionSheetMessage, convId, user?.id, handleReactionToggle]);

  const handleEditMessage = useCallback(async () => {
    if (!editingMessage || !convId || !editContent.trim()) return;
    try {
      const result = await apiEditMessage(convId, editingMessage.id, editContent.trim());
      setMessages(prev => prev.map(m =>
        m.id === editingMessage.id ? { ...m, content: editContent.trim(), editedAt: result.editedAt } : m
      ));
      setEditingMessage(null);
      setEditContent('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to edit message');
    }
  }, [editingMessage, convId, editContent]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!convId) return;
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiDeleteMessage(convId, messageId);
            setMessages(prev => prev.map(m =>
              m.id === messageId ? { ...m, deleted: true, content: '', attachments: [] } : m
            ));
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to delete message');
          }
        }
      }
    ]);
  }, [convId]);

  const handlePinMessage = useCallback(async (messageId: string) => {
    if (!convId) return;
    try {
      const { pinMessage } = await import('../../api/messages');
      await pinMessage(convId, messageId);
      setPinnedRefreshKey(k => k + 1);
      setPinnedMessageIds(prev => new Set([...prev, messageId]));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to pin message');
    }
  }, [convId]);

  const handleUnpinMessage = useCallback(async (messageId: string) => {
    if (!convId) return;
    try {
      const { unpinMessage } = await import('../../api/messages');
      await unpinMessage(convId, messageId);
      setPinnedRefreshKey(k => k + 1);
      setPinnedMessageIds(prev => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to unpin message');
    }
  }, [convId]);

  const listHeader = useMemo(() => {
    if (loading) return null;

    return (
      <View>
        {loadingOlder && (
          <View className="mb-2">
            {[0, 1, 2].map((i) => (
              <View key={`older-sk-${i}`} className="px-4 py-2">
                <View className="flex-row gap-3">
                  <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                  <View className="flex-1 gap-2">
                    <View className="flex-row items-center gap-2">
                      <Skeleton className="w-24 h-4 rounded" />
                      <Skeleton className="w-12 h-3 rounded" />
                    </View>
                    <Skeleton className="h-5 rounded w-full" />
                    <Skeleton className="w-2/3 h-5 rounded" />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
        {hasMore && !loadingOlder && (
          <View className="items-center my-2">
            <TouchableOpacity onPress={loadOlder} className="px-3 py-1.5 rounded-full bg-white/10">
              <Text className="text-sm text-purple-400">Load more</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }, [loading, loadingOlder, hasMore, loadOlder]);

  if (!canChat && reason) {
    return (
      <TeamLayout hideFloatingHamburger={true}>
        <View className="flex-1" style={{ backgroundColor: '#020617' }}>
          <ChatBlockScreen reason={reason} />
        </View>
      </TeamLayout>
    );
  }

  return (
    <TeamLayout hideFloatingHamburger={true}>
      <View className="flex-1" style={{ backgroundColor: '#020617' }}>
        <View
          className="flex-row items-center px-4 border-b border-white/5 bg-[#020617]"
          style={{
            paddingTop: 8,
            paddingBottom: 12,
            minHeight: 44,
            zIndex: 10,
            elevation: 10,
            backgroundColor: '#020617',
          }}
        >
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              clearChatParamsFromUrl();
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else if (teamId) {
                router.push({ pathname: '/(tabs)/team', params: { teamId } });
              } else {
                router.push('/(tabs)/team');
              }
            }}
            className="flex-row items-center flex-1"
            activeOpacity={0.7}
          >
            <View className="p-2 rounded-lg mr-3">
              <Feather name="arrow-left" size={24} color="#ffffff" />
            </View>
            <Text
              className="text-lg font-semibold text-white flex-1"
              numberOfLines={1}
            >
              {conversationName || 'Chat'}
            </Text>
          </TouchableOpacity>
        </View>

        {convId && (
          <PinnedMessageBanner 
            conversationId={convId} 
            refreshKey={pinnedRefreshKey}
            isPrivileged={isPrivileged}
            onUnpin={() => {
              import('../../api/messages').then(({ getPinnedMessages }) => {
                getPinnedMessages(convId).then(pinned => {
                  setPinnedMessageIds(new Set(pinned.map(p => p.id)));
                }).catch(() => {});
              });
            }}
          />
        )}

        <Animated.View style={isEmptyChatWeb ? { flex: 0, height: 0, overflow: 'hidden' } : { flex: 1, zIndex: 0 }}>
          <ScrollView
            ref={listRef as any}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}
            onScroll={(e) => {
              const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
              scrollYRef.current = contentOffset.y;
              contentHeightRef.current = contentSize.height;
              const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
              atBottomRef.current = isAtBottom;
              if (contentOffset.y >= 80) {
                loadOlderTriggeredRef.current = false;
              } else if (hasMore && !loadingOlder && !loadOlderTriggeredRef.current) {
                loadOlderTriggeredRef.current = true;
                loadOlder();
              }
            }}
            scrollEventThrottle={16}
            onContentSizeChange={(w, h) => {
              if (adjustScrollAfterLoadOlderRef.current && savedContentHeightRef.current > 0) {
                const delta = h - savedContentHeightRef.current;
                if (delta > 0) {
                  (listRef.current as any)?.scrollTo?.({ y: savedScrollYRef.current + delta, animated: false });
                }
                adjustScrollAfterLoadOlderRef.current = false;
                savedContentHeightRef.current = 0;
              } else if (atBottomRef.current) {
                (listRef.current as any)?.scrollToEnd?.({ animated: false });
              }
              contentHeightRef.current = h;
            }}
          >
            {listHeader}
            {[...renderItems].reverse().map((item) => {
              if (item.type === 'skeleton') {
                return (
                  <View key={item.key} className="px-4 py-2">
                    <View className="flex-row gap-3">
                      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                      <View className="flex-1 gap-2">
                        <View className="flex-row items-center gap-2">
                          <Skeleton className="w-24 h-4 rounded" />
                          <Skeleton className="w-12 h-3 rounded" />
                        </View>
                        <Skeleton className="h-5 rounded w-full" />
                        <Skeleton className="w-2/3 h-5 rounded" />
                      </View>
                    </View>
                  </View>
                );
              }

              if (item.type === 'date') {
                return (
                  <View key={item.key} className="items-center my-4">
                    <Text className="text-xs text-gray-400 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
                      {formatMessageDate(item.ts)}
                    </Text>
                  </View>
                );
              }

              return (
                <View key={item.key}>
                  <MessageGroup
                    group={{
                      ...item.group,
                    }}
                    showTimestamp={item.showTimestamp}
                    onReply={handleReply}
                    onShowReplies={handleShowReplies}
                    onShowReadBy={handleShowReadBy}
                    onImageClick={handleImageClick}
                    uploadingMessage={false}
                    onLongPress={handleLongPress}
                    onReactionToggle={handleReactionToggle}
                    onToggleRevealDeleted={toggleRevealDeleted}
                    userId={user?.id}
                    isPrivileged={isPrivileged}
                    revealedDeletedIds={revealedDeletedIds}
                    pollRefreshKey={pollRefreshKey}
                  />
                </View>
              );
            })}
            <Animated.View pointerEvents="none" style={listSpacerStyle} />
          </ScrollView>
        </Animated.View>

        <Animated.View
          pointerEvents="box-none"
          style={
            isEmptyChatWeb
              ? { flex: 1, justifyContent: 'center', zIndex: 20 }
              : [
                  { position: 'absolute', left: 0, right: 0, zIndex: 20, bottom: composerBase },
                  composerTranslateStyle,
                ]
          }
        >
          <View
            onLayout={(event) => {
              const nextHeight = event.nativeEvent.layout.height;
              if (Math.abs(composerHeight.value - nextHeight) > 1) {
                composerHeight.value = nextHeight;
              }
            }}
          >
            {typingUsers.size > 0 && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 2 }}>
                <Text style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic' }}>
                  {(() => {
                    const names = Array.from(typingUsers.values());
                    if (names.length === 1) return `${names[0]} is typing...`;
                    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
                    return `${names[0]} and ${names.length - 1} others are typing...`;
                  })()}
                </Text>
              </View>
            )}
            <View style={{ paddingHorizontal: 12, paddingTop: 8, backgroundColor: 'transparent' }}>
              {replyingTo && (
                <View className="bg-white/10 px-3 py-2 rounded-t-xl flex-row items-center justify-between mb-0.5">
                  <Text className="text-xs text-gray-300 flex-1 mr-2" numberOfLines={1}>
                    Replying to <Text className="font-semibold">{replyingTo.senderName}</Text>: {replyingTo.content}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      setReplyingTo(null);
                    }}
                    className="flex-shrink-0 p-1 min-w-[28px] min-h-[28px] items-center justify-center"
                  >
                    <Feather name="x" size={16} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <ChatInputSheet
              convId={convId}
              conversationName={conversationName}
              user={user}
              replyingTo={replyingTo}
              viewingThread={null}
              teamId={teamId}
              isPrivileged={isPrivileged}
              teamMembers={teamMembersForMention}
              onTyping={sendTypingEvent}
              onStopTyping={sendStopTyping}
              onMessageSent={(msg: Message) => {
                setMessages(prev => {
                  if (msg.failed) {
                    if (msg.clientId) {
                      return prev.filter(m => m.id !== msg.clientId && m.clientId !== msg.clientId);
                    }
                    return prev.filter(m => m.id !== msg.id);
                  }

                  let next = [...prev];
                  let updated = false;

                  if (msg.clientId) {
                    const idx = next.findIndex(m => m.id === msg.clientId || m.clientId === msg.clientId);
                    if (idx !== -1) {
                      next[idx] = { ...next[idx], ...msg };
                      updated = true;
                    }
                  }

                  if (!updated) {
                    const idx = next.findIndex(m => m.id === msg.id);
                    if (idx !== -1) {
                      next[idx] = { ...next[idx], ...msg };
                      updated = true;
                    }
                  }

                  if (!updated) {
                    next.push(msg);
                  }

                  if (msg.clientId && msg.pending === false) {
                    next = next.filter(m => m.id !== msg.clientId);
                  }

                  const deduped: Message[] = [];
                  const seen = new Set<string>();

                  for (let i = next.length - 1; i >= 0; i -= 1) {
                    const item = next[i];
                    if (!seen.has(item.id)) {
                      seen.add(item.id);
                      deduped.unshift(item);
                    }
                  }

                  return deduped;
                });
                scrollToBottom(true);
              }}
              onReplyingToChange={setReplyingTo}
            />
          </View>
        </Animated.View>
      </View>


      <Modal
        visible={readByModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => {
          hapticLight();
          setReadByModalOpen(false);
        }}
      >
        <View className="flex-1 bg-black/70 items-center justify-center p-4">
          <View className="w-full max-w-sm bg-[#020617] rounded-xl border border-white/10" style={{ maxHeight: '60%' }}>
            <View className="flex-row items-center justify-between p-4 border-b border-white/10">
              <Text className="text-lg font-bold text-white">Read By</Text>
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  setReadByModalOpen(false);
                }}
                className="p-2 min-w-[40px] min-h-[40px] items-center justify-center"
              >
                <Feather name="x" size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <FlatList<Participant>
              data={readBy}
              keyExtractor={(u: Participant) => u.id}
              renderItem={({ item }: ListRenderItemInfo<Participant>) => (
                <View className="py-2 px-3 bg-white/5 rounded-lg mb-2">
                  <Text className="text-white text-sm">{item.username}</Text>
                </View>
              )}
              contentContainerStyle={{ padding: 16 }}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={galleryOpen} animationType="fade" transparent onRequestClose={() => setGalleryOpen(false)}>
        <View className="flex-1 bg-black/95">
          <TouchableOpacity className="absolute top-12 right-5 z-10 p-3 bg-black/50 rounded-full" onPress={() => setGalleryOpen(false)}>
            <Feather name="x" size={24} color="#ffffff" />
          </TouchableOpacity>
          <FlatList<string>
            data={galleryImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(u: string, i: number) => `${u}-${i}`}
            initialScrollIndex={galleryIndex}
            getItemLayout={(_: any, index: number) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
            renderItem={({ item }: ListRenderItemInfo<string>) => (
              <ExpoImage source={{ uri: item }} placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} cachePolicy="memory-disk" transition={200} style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} contentFit="contain" />
            )}
          />
        </View>
      </Modal>

      <MessageActionSheet
        visible={!!actionSheetMessage}
        onClose={() => setActionSheetMessage(null)}
        onQuickReaction={handleQuickReaction}
        actions={[
          {
            icon: 'corner-down-right',
            label: 'Reply',
            onPress: () => {
              if (actionSheetMessage) handleReply(actionSheetMessage);
            },
          },
          {
            icon: 'bookmark',
            label: pinnedMessageIds.has(actionSheetMessage?.id || '') ? 'Unpin Message' : 'Pin Message',
            onPress: () => {
              if (actionSheetMessage) {
                if (pinnedMessageIds.has(actionSheetMessage.id)) {
                  handleUnpinMessage(actionSheetMessage.id);
                } else {
                  handlePinMessage(actionSheetMessage.id);
                }
              }
            },
            visible: isPrivileged,
          },
          {
            icon: 'copy',
            label: 'Copy Text',
            onPress: () => {
              if (actionSheetMessage?.content) {
                Clipboard.setStringAsync(actionSheetMessage.content);
              }
            },
            visible: !!actionSheetMessage?.content,
          },
          {
            icon: 'edit-2',
            label: 'Edit Message',
            onPress: () => {
              if (actionSheetMessage) {
                setEditingMessage(actionSheetMessage);
                setEditContent(actionSheetMessage.content);
              }
            },
            visible: actionSheetMessage?.isMine === true && actionSheetMessage?.messageType !== 'poll',
          },
          {
            icon: 'trash-2',
            label: 'Delete Message',
            onPress: () => {
              if (actionSheetMessage) handleDeleteMessage(actionSheetMessage.id);
            },
            destructive: true,
            visible: actionSheetMessage?.isMine === true || isPrivileged,
          },
        ]}
      />

      <PlatformBottomSheet
        isOpened={!!editingMessage}
        onIsOpenedChange={(opened) => {
          if (!opened) {
            setEditingMessage(null);
            setEditContent('');
          }
        }}
        presentationDetents={[0.35]}
        presentationDragIndicator="visible"
      >
        <View style={{ alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
          <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '600' }}>Edit Message</Text>
        </View>
        <View style={{ padding: 20 }}>
          <TextInput
            value={editContent}
            onChangeText={setEditContent}
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 14,
              color: '#ffffff',
              fontSize: 16,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(255,255,255,0.1)',
              minHeight: 80,
              maxHeight: 200,
              textAlignVertical: 'top',
            }}
            multiline
            maxLength={2000}
            autoFocus
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setEditingMessage(null);
                setEditContent('');
              }}
              style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' }}
            >
              <Text style={{ color: '#cbd5e1', fontWeight: '500', fontSize: 15 }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                hapticMedium();
                handleEditMessage();
              }}
              disabled={!editContent.trim()}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: editContent.trim() ? '#a855f7' : 'rgba(168, 85, 247, 0.25)',
              }}
            >
              <Text style={{ fontWeight: '600', fontSize: 15, color: editContent.trim() ? '#ffffff' : 'rgba(255,255,255,0.4)' }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </PlatformBottomSheet>
    </TeamLayout>
  );
}
