import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, ListRenderItemInfo, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { getPinnedMessages, unpinMessage, PinnedMessage } from '../api/messages';
import { PlatformBottomSheet } from './PlatformBottomSheet';

interface PinnedMessageBannerProps {
  conversationId: string;
  refreshKey?: number;
  isPrivileged?: boolean;
  onUnpin?: () => void;
}

export function PinnedMessageBanner({ conversationId, refreshKey, isPrivileged = false, onUnpin }: PinnedMessageBannerProps) {
  const [pinned, setPinned] = useState<PinnedMessage[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [unpinningId, setUnpinningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getPinnedMessages(conversationId);
      setPinned(data);
    } catch (e) {
      console.warn('Failed to load pinned messages:', e);
    }
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const handleUnpin = useCallback(async (messageId: string) => {
    hapticLight();
    setUnpinningId(messageId);
    try {
      await unpinMessage(conversationId, messageId);
      await load();
      onUnpin?.();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to unpin message');
    } finally {
      setUnpinningId(null);
    }
  }, [conversationId, load, onUnpin]);

  if (pinned.length === 0) return null;

  const latest = pinned[0];

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          hapticLight();
          setExpanded(true);
        }}
        style={s.banner}
        activeOpacity={0.7}
      >
        <Feather name="bookmark" size={14} color="#a855f7" />
        <View style={s.bannerContent}>
          <Text style={s.pinnedByText} numberOfLines={1}>
            Pinned by {latest.pinnedByName}
          </Text>
          <Text style={s.pinnedContentText} numberOfLines={1}>
            {latest.content || (latest.messageType === 'poll' ? 'Poll' : 'Message')}
          </Text>
        </View>
        {pinned.length > 1 && (
          <View style={s.countBadge}>
            <Text style={s.countText}>{pinned.length}</Text>
          </View>
        )}
        <Feather name="chevron-right" size={16} color="#a855f7" style={{ marginLeft: 4 }} />
      </TouchableOpacity>

      <PlatformBottomSheet
        isOpened={expanded}
        onIsOpenedChange={(opened) => !opened && setExpanded(false)}
        presentationDetents={[0.6]}
        presentationDragIndicator="visible"
      >
        <View style={s.sheetHeader}>
          <Feather name="bookmark" size={16} color="#a855f7" />
          <Text style={s.sheetTitle}>Pinned Messages ({pinned.length})</Text>
        </View>

        <FlatList<PinnedMessage>
          data={pinned}
          keyExtractor={(item: PinnedMessage) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: ListRenderItemInfo<PinnedMessage>) => (
            <View style={s.pinnedItem}>
              <View style={s.pinnedItemHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.pinnedItemSender}>{item.senderName}</Text>
                  <Text style={s.pinnedItemDate}>
                    {new Date(item.sentAt * 1000).toLocaleDateString()}
                  </Text>
                </View>
                {isPrivileged && (
                  <TouchableOpacity
                    onPress={() => handleUnpin(item.id)}
                    disabled={unpinningId === item.id}
                    style={s.unpinButton}
                    activeOpacity={0.7}
                  >
                    {unpinningId === item.id ? (
                      <ActivityIndicator size="small" color="#f87171" />
                    ) : (
                      <Feather name="x" size={16} color="#f87171" />
                    )}
                  </TouchableOpacity>
                )}
              </View>
              <Text style={s.pinnedItemContent} numberOfLines={3}>
                {item.content || `[${item.messageType}]`}
              </Text>
              <Text style={s.pinnedItemMeta}>
                Pinned by {item.pinnedByName}
              </Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </PlatformBottomSheet>
    </>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.08)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(168, 85, 247, 0.2)',
  },
  bannerContent: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  pinnedByText: {
    color: '#c084fc',
    fontSize: 12,
    fontWeight: '500',
  },
  pinnedContentText: {
    color: '#e2e8f0',
    fontSize: 14,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: {
    color: '#c084fc',
    fontSize: 12,
    fontWeight: '600',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sheetTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  pinnedItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  pinnedItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  unpinButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
  },
  pinnedItemSender: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  pinnedItemDate: {
    color: '#6b7280',
    fontSize: 12,
  },
  pinnedItemContent: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  pinnedItemMeta: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 6,
  },
});
