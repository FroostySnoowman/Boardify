import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { GlassView } from 'expo-glass-effect';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { attachmentPickerEvents } from '../utils/attachmentPickerEvents';
import { Message, sendMessage, uploadMessageImages, GifResult } from '../api/messages';
import { compressMessageImages } from '../utils/imageCompression';
import { GifPicker } from './GifPicker';
import { PollCreator } from './PollCreator';
import { VoiceMessageRecorder } from './VoiceMessageRecorder';
import { Avatar } from './Avatar';

interface ChatInputSheetProps {
  convId: string;
  conversationName?: string;
  user: any;
  replyingTo: Message | null;
  viewingThread: Message | null;
  onMessageSent?: (message: Message) => void;
  onReplyingToChange?: (msg: Message | null) => void;
  onTyping?: () => void;
  onStopTyping?: () => void;
  teamId?: string;
  isPrivileged?: boolean;
  teamMembers?: { id: string; username: string; profilePictureUrl?: string | null; role?: string }[];
}

const styles = StyleSheet.create({
  glassInput: {
    borderRadius: 20,
  },
});

export const ChatInputSheet = React.forwardRef<TextInput, ChatInputSheetProps>(({
  convId,
  conversationName = 'general',
  user,
  replyingTo,
  viewingThread,
  onMessageSent,
  onReplyingToChange,
  onTyping,
  onStopTyping,
  teamId,
  isPrivileged = false,
  teamMembers = [],
}, ref) => {
  const [newMsg, setNewMsg] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [pollCreatorOpen, setPollCreatorOpen] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // @mention autocomplete
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<typeof teamMembers>([]);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const unsubscribe = attachmentPickerEvents.subscribe((uris) => {
      setSelectedImages(prev => [...prev, ...uris].slice(0, 5));
      setShowExtras(false);
    });
    return unsubscribe;
  }, []);

  const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTextChange = useCallback((text: string) => {
    setNewMsg(text);

    if (text.length > 0) {
      onTyping?.();
      if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
      stopTypingTimerRef.current = setTimeout(() => {
        onStopTyping?.();
      }, 4000);
    } else {
      onStopTyping?.();
      if (stopTypingTimerRef.current) {
        clearTimeout(stopTypingTimerRef.current);
        stopTypingTimerRef.current = null;
      }
    }

    // Detect @mention
    const lastAt = text.lastIndexOf('@');
    if (lastAt >= 0) {
      const afterAt = text.slice(lastAt + 1);
      const spaceIdx = afterAt.indexOf(' ');
      if (spaceIdx === -1 && afterAt.length > 0) {
        setMentionQuery(afterAt.toLowerCase());
        const filtered = teamMembers.filter(m =>
          m.username?.toLowerCase().includes(afterAt.toLowerCase()) &&
          String(m.id) !== String(user?.id)
        ).slice(0, 5);
        setMentionResults(filtered);
        return;
      }
    }
    setMentionQuery(null);
    setMentionResults([]);
  }, [teamMembers, user?.id, onTyping, onStopTyping]);

  const insertMention = useCallback((username: string) => {
    hapticLight();
    const lastAt = newMsg.lastIndexOf('@');
    if (lastAt >= 0) {
      setNewMsg(newMsg.slice(0, lastAt) + `@${username} `);
    }
    setMentionQuery(null);
    setMentionResults([]);
    inputRef.current?.focus();
  }, [newMsg]);

  const openAttachmentPicker = () => {
    hapticLight();
    router.push('/attachment-picker');
  };

  const handleSend = async (messageType?: string, metadata?: any) => {
    if ((!newMsg.trim() && selectedImages.length === 0 && !messageType) || !convId) return;

    onStopTyping?.();
    if (stopTypingTimerRef.current) {
      clearTimeout(stopTypingTimerRef.current);
      stopTypingTimerRef.current = null;
    }

    hapticMedium();

    const now = Date.now();
    const clientId = `local-${now}-${Math.random().toString(36).slice(2, 8)}`;
    const content = newMsg;
    const parentId = undefined;
    const replyId = replyingTo?.id;

    let attachments: string[] = [];
    const hasAttachments = selectedImages.length > 0;

    setNewMsg('');
    onReplyingToChange?.(null);
    setMentionQuery(null);
    setMentionResults([]);

    const baseMessage: Message = {
      id: clientId,
      clientId,
      senderId: user?.id || '',
      senderName: user?.username || user?.email?.split('@')[0] || 'User',
      senderProfilePicture: user?.profilePictureUrl || null,
      content,
      timestamp: new Date(now).toISOString(),
      isMine: true,
      sentAt: now,
      parentMessageId: parentId ?? null,
      replyToMessageId: replyId ?? null,
      replyToMessageContent: replyingTo?.content,
      replyToMessageSenderName: replyingTo?.senderName,
      replyToMessageSenderProfilePicture: replyingTo?.senderProfilePicture ?? null,
      attachments: [],
      pending: true,
      messageType: (messageType as any) || 'text',
      metadata: metadata || {},
    };

    const optimisticMessage: Message = hasAttachments
      ? { ...baseMessage, attachments: [''], uploading: true }
      : baseMessage;

    onMessageSent?.(optimisticMessage);

    if (hasAttachments) {
      const imagesToUpload = selectedImages;
      setUploadingImages(true);
      setSelectedImages([]);

      try {
        const compressed = await compressMessageImages(imagesToUpload);
        attachments = await uploadMessageImages(compressed);
      } catch (error: any) {
        const msg = error.message || 'Failed to upload media';
        const isModeration = /rejected|safety filters/i.test(msg);
        Alert.alert(isModeration ? 'Image not allowed' : 'Error', msg);
        onMessageSent?.({ ...baseMessage, failed: true });
        setUploadingImages(false);
        return;
      } finally {
        setUploadingImages(false);
      }
    }

    try {
      const saved = await sendMessage(convId, content.trim(), parentId, replyId, attachments, messageType, metadata);
      const serverTs = typeof saved.sentAt === 'number'
        ? saved.sentAt < 1e12
          ? saved.sentAt * 1000
          : saved.sentAt
        : new Date(saved.sentAt).getTime();

      const finalMessage: Message = {
        ...baseMessage,
        id: saved.id,
        clientId,
        sentAt: serverTs,
        timestamp: saved.sentAt,
        attachments,
        uploading: false,
        pending: false,
      };

      onMessageSent?.(finalMessage);
      hapticLight();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send message');
      onMessageSent?.({ ...baseMessage, failed: true });
    }
  };

  const handleSelectGif = async (gif: GifResult) => {
    if (!convId) return;
    hapticMedium();

    const now = Date.now();
    const clientId = `local-${now}-${Math.random().toString(36).slice(2, 8)}`;

    const optimistic: Message = {
      id: clientId,
      clientId,
      senderId: user?.id || '',
      senderName: user?.username || user?.email?.split('@')[0] || 'User',
      senderProfilePicture: user?.profilePictureUrl || null,
      content: '',
      timestamp: new Date(now).toISOString(),
      isMine: true,
      sentAt: now,
      attachments: [],
      pending: true,
      messageType: 'gif',
      metadata: { gifUrl: gif.url, previewUrl: gif.previewUrl, width: gif.width, height: gif.height },
    };

    onMessageSent?.(optimistic);

    try {
      const saved = await sendMessage(convId, '', undefined, undefined, undefined, 'gif', {
        gifUrl: gif.url,
        previewUrl: gif.previewUrl,
        width: gif.width,
        height: gif.height,
      });

      const serverTs = typeof saved.sentAt === 'number'
        ? saved.sentAt < 1e12 ? saved.sentAt * 1000 : saved.sentAt
        : new Date(saved.sentAt).getTime();

      onMessageSent?.({
        ...optimistic,
        id: saved.id,
        sentAt: serverTs,
        timestamp: saved.sentAt,
        pending: false,
      });
    } catch (e: any) {
      onMessageSent?.({ ...optimistic, failed: true });
    }
  };

  const handleSendAnnouncement = () => {
    if (!newMsg.trim()) {
      Alert.alert('Error', 'Please type a message first');
      return;
    }
    handleSend('announcement');
    setShowExtras(false);
  };

  const paddingBottom = 8;
  const hasText = newMsg.trim().length > 0 || selectedImages.length > 0;

  const renderInputRow = () => (
    <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
      {selectedImages.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {selectedImages.map((uri, idx) => (
            <View key={uri + idx} style={{ width: 56, height: 56 }}>
              <ExpoImage
                source={{ uri }}
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                cachePolicy="memory-disk"
                transition={150}
                style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.3)' }}
                contentFit="cover"
              />
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  setSelectedImages(prev => prev.filter((_, i) => i !== idx));
                }}
                style={{
                  position: 'absolute',
                  top: 3,
                  right: 3,
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="x" size={10} color="#ffffff" />
              </TouchableOpacity>
            </View>
          ))}
          {selectedImages.length < 5 && (
            <TouchableOpacity
              onPress={openAttachmentPicker}
              style={{
                width: 56,
                height: 56,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.12)',
                borderStyle: 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="plus" size={18} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      )}
      <View className="flex-row items-center gap-2">
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            setShowExtras(!showExtras);
          }}
          disabled={uploadingImages || isRecording}
          className="w-10 h-10 rounded-full bg-white/10 items-center justify-center"
        >
          <Feather name={showExtras ? 'x' : 'plus'} size={22} color="#9ca3af" />
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          value={newMsg}
          onChangeText={handleTextChange}
          placeholder={`Message ${conversationName}`}
          placeholderTextColor="#999999"
          className="flex-1 text-white text-base"
          style={{ maxHeight: 100, marginVertical: 0, padding: 0 }}
          multiline
          maxLength={2000}
          textContentType="none"
          autoCorrect={true}
          autoCapitalize="sentences"
          returnKeyType="default"
          blurOnSubmit={false}
          enablesReturnKeyAutomatically={true}
        />

        {hasText ? (
          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={(!newMsg.trim() && selectedImages.length === 0) || uploadingImages}
            className="p-2"
          >
            {uploadingImages ? (
              <ActivityIndicator size="small" color="#9ca3af" />
            ) : (
              <Feather
                name="send"
                size={22}
                color={(!newMsg.trim() && selectedImages.length === 0) ? '#6b7280' : '#06b6d4'}
              />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setIsRecording(true);
            }}
            className="w-10 h-10 rounded-full bg-white/10 items-center justify-center"
          >
            <Feather name="mic" size={20} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={{ paddingHorizontal: 12, paddingBottom }}>
      <GifPicker
        isOpened={gifPickerOpen}
        onClose={() => setGifPickerOpen(false)}
        onSelectGif={handleSelectGif}
      />

      <PollCreator
        isOpened={pollCreatorOpen}
        onClose={() => setPollCreatorOpen(false)}
        conversationId={convId}
        onPollCreated={(result) => {
          const now = Date.now();
          const pollOptions = result.options.map((label, i) => ({
            id: `opt-${i}`,
            label,
            position: i,
            voteCount: 0,
            voters: [],
          }));
          const pollMsg: Message = {
            id: result.id,
            senderId: user?.id || '',
            senderName: user?.username || user?.email?.split('@')[0] || 'User',
            senderProfilePicture: user?.profilePictureUrl || null,
            content: result.question,
            timestamp: result.sentAt,
            isMine: true,
            sentAt: now,
            attachments: [],
            messageType: 'poll',
            metadata: {
              pollId: result.pollId,
              poll: {
                id: result.pollId,
                question: result.question,
                options: pollOptions,
                allowMultiple: result.allowMultiple,
                anonymous: result.anonymous,
                closesAt: null,
                totalVotes: 0,
                myVotes: [],
              },
            },
          };
          onMessageSent?.(pollMsg);
        }}
      />

      {mentionQuery !== null && mentionResults.length > 0 && (
        <View className="bg-[#0f172a] rounded-xl border border-white/10 mb-2 overflow-hidden">
          {mentionResults.map((member) => (
            <TouchableOpacity
              key={member.id}
              onPress={() => insertMention(member.username)}
              className="flex-row items-center gap-3 px-4 py-2.5 border-b border-white/5"
            >
              <Avatar src={member.profilePictureUrl} alt={member.username} size="sm" />
              <View>
                <Text className="text-white text-sm font-medium">{member.username}</Text>
                {member.role && (
                  <Text className="text-gray-500 text-xs">{member.role}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showExtras && !isRecording && selectedImages.length === 0 && (
        <View className="flex-row items-center gap-3 px-3 py-2 mb-1">
          <TouchableOpacity
            onPress={openAttachmentPicker}
            className="items-center gap-1"
          >
            <View className="w-11 h-11 rounded-full bg-white/10 items-center justify-center">
              <Feather name="image" size={20} color="#60a5fa" />
            </View>
            <Text className="text-[10px] text-gray-400">Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setGifPickerOpen(true);
              setShowExtras(false);
            }}
            className="items-center gap-1"
          >
            <View className="w-11 h-11 rounded-full bg-white/10 items-center justify-center">
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#34d399' }}>GIF</Text>
            </View>
            <Text className="text-[10px] text-gray-400">GIF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setPollCreatorOpen(true);
              setShowExtras(false);
            }}
            className="items-center gap-1"
          >
            <View className="w-11 h-11 rounded-full bg-white/10 items-center justify-center">
              <Feather name="bar-chart-2" size={20} color="#a855f7" />
            </View>
            <Text className="text-[10px] text-gray-400">Poll</Text>
          </TouchableOpacity>
          {isPrivileged && (
            <TouchableOpacity
              onPress={handleSendAnnouncement}
              className="items-center gap-1"
            >
              <View className="w-11 h-11 rounded-full bg-white/10 items-center justify-center">
                <Feather name="volume-2" size={20} color="#f59e0b" />
              </View>
              <Text className="text-[10px] text-gray-400">Announce</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isRecording ? (
        Platform.OS === 'ios' ? (
          <GlassView style={styles.glassInput} isInteractive>
            <VoiceMessageRecorder
              conversationId={convId}
              onRecordingStateChange={setIsRecording}
              onMessageSent={onMessageSent}
              autoStart
              user={user}
            />
          </GlassView>
        ) : (
          <View style={[styles.glassInput, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
            <VoiceMessageRecorder
              conversationId={convId}
              onRecordingStateChange={setIsRecording}
              onMessageSent={onMessageSent}
              autoStart
              user={user}
            />
          </View>
        )
      ) : Platform.OS === 'ios' ? (
        <GlassView style={styles.glassInput} isInteractive>
          {renderInputRow()}
        </GlassView>
      ) : (
        <View style={[styles.glassInput, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
          {renderInputRow()}
        </View>
      )}
    </View>
  );
});

ChatInputSheet.displayName = 'ChatInputSheet';
