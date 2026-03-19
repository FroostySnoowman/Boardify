import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listConversations, Conversation, createGroupChat, deleteConversation, starConversation, unstarConversation } from '../../api/messages';
import { getTeam, Team, listMembers, Member } from '../../api/teams';
import { getStoredSessionToken } from '../../api/session';
import { ENV } from '../../config/env';
import { Skeleton } from '../../components/Skeleton';
import { ContextMenu } from '../../components/ContextMenu';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { useTeamLayout } from './TeamLayout';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';
import { useChatAccess } from '../../components/ChatAccessGate';
import { useChatBlockedModal } from '../../contexts/ChatBlockedModalContext';
import { syncChatParamsToUrl } from '../../utils/webUrlSync';

const CHAT_SAFETY_WARNING_KEY = 'hasSeenChatSafetyWarning';

interface ChatScreenProps {
  teamId?: string;
}

export default function ChatScreen({ teamId }: ChatScreenProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { openSidebar, navOpen } = useTeamLayout();
  const { user } = useAuth();
  const { canChat, reason } = useChatAccess();
  const { showChatBlocked } = useChatBlockedModal();
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'android') {
      AsyncStorage.getItem(CHAT_SAFETY_WARNING_KEY).then(hasSeen => {
        if (!hasSeen) {
          Alert.alert(
            'Safety Reminder',
            'Be careful when sharing personal information online. Always be aware of the real-world risks of online interactions and never agree to meet someone in person without adult permission and supervision.',
            [{ text: 'OK', onPress: () => AsyncStorage.setItem(CHAT_SAFETY_WARNING_KEY, 'true') }]
          );
        }
      });
    }
  }, []);

  const reload = React.useCallback(async (): Promise<Conversation[]> => {
    if (!teamId) return [];
    setLoading(true);
    try {
      const data = await listConversations(teamId);
      const group = data.filter(c => c.type === 'group');
      group.sort((a, b) => {
        const aStarred = a.starred ? 1 : 0;
        const bStarred = b.starred ? 1 : 0;
        if (bStarred !== aStarred) return bStarred - aStarred;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      setConversations(group);
      return group;
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const loadTeam = async () => {
    if (!teamId) return;
    try {
      const teamData = await getTeam(teamId);
      setTeam(teamData);
    } catch (err: any) {
      console.error('Failed to load team:', err);
    }
  };

  const loadMembers = async () => {
    if (!teamId) {
      setPermissionsLoaded(true);
      return;
    }
    try {
      const membersData = await listMembers(teamId);
      setMembers(membersData);
      setPermissionsLoaded(true);
    } catch (err: any) {
      console.error('Failed to load members:', err);
      setPermissionsLoaded(true);
    }
  };

  const ensureGeneralChat = async (loadedConversations: Conversation[]) => {
    if (!teamId) return;
    try {
      const generalChat = loadedConversations.find(c => c.type === 'group' && c.name?.toLowerCase() === 'general');
      if (!generalChat) {
        try {
          await createGroupChat(teamId, 'General', [], [], 'everyone');
          await reload();
        } catch (err: any) {
          console.error('Failed to create general chat:', err);
        }
      }
    } catch (err: any) {
      console.error('Failed to check for general chat:', err);
    }
  };

  useEffect(() => {
    setPermissionsLoaded(false);
    Promise.all([loadTeam(), loadMembers()]);
  }, [teamId]);

  useFocusEffect(
    React.useCallback(() => {
      reload().then(convs => ensureGeneralChat(convs));
    }, [reload, teamId])
  );

  useEffect(() => {
    if (!teamId || !user) return;
    let ws: WebSocket | null = null;
    let isMounted = true;

    const connectTeamWS = async () => {
      try {
        const token = await getStoredSessionToken();
        if (!token || !isMounted) return;
        const apiBase = ENV.API_BASE;
        if (!apiBase) return;
        let origin: string;
        if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) origin = apiBase;
        else if (apiBase.startsWith('/')) origin = (ENV.APP_URL || 'https://mybreakpoint.app').replace(/\/$/, '') + apiBase;
        else origin = `https://${apiBase}`;
        const host = origin.replace(/^https?:\/\//, '');
        const proto = origin.startsWith('https:') ? 'wss' : 'ws';

        ws = new WebSocket(`${proto}://${host}/ws/teams/${teamId}/conversations?token=${token}`);

        ws.onmessage = (e) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'conversation_update' || data.conversationId) {
              reload();
            }
          } catch {}
        };
        ws.onclose = () => {
          if (isMounted) setTimeout(connectTeamWS, 5000);
        };
      } catch {}
    };

    connectTeamWS();

    return () => {
      isMounted = false;
      if (ws) ws.close(1001);
    };
  }, [teamId, user, reload]);

  const currentUserRole = members.find(m => m.id === user?.id)?.role?.toLowerCase();
  const isOwner = currentUserRole === 'owner';
  const canManage = permissionsLoaded && (isOwner || currentUserRole === 'coach');

  const handleEditChat = (conv: Conversation) => {
    hapticLight();
    if (!teamId) return;
    router.push({
      pathname: '/edit-chat',
      params: {
        conversationId: conv.id,
        teamId,
        name: conv.name || '',
      },
    });
  };

  const handleDeleteChat = (conv: Conversation) => {
    hapticMedium();
    Alert.alert(
      'Delete Chat',
      `Are you sure you want to delete "${conv.name}"? All messages will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConversation(conv.id);
              await reload();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete chat');
            }
          },
        },
      ]
    );
  };

  const handleNewChat = () => {
    if (!canManage) {
      Alert.alert('Permission Denied', 'Only coaches can create new chats.');
      return;
    }
    hapticLight();
    if (!canChat && reason) {
      showChatBlocked(reason);
      return;
    }
    router.push(`/create-group-chat?teamId=${teamId}`);
  };

  const filtered = conversations
    .filter(c => {
      const label = (c.name || '').toLowerCase();
      return (
        label.includes(search.toLowerCase()) ||
        c.lastMessage.toLowerCase().includes(search.toLowerCase())
      );
    })
    .sort((a, b) => {
      const aStarred = a.starred ? 1 : 0;
      const bStarred = b.starred ? 1 : 0;
      if (bStarred !== aStarred) return bStarred - aStarred;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  return (
    <View className="flex-1 flex-col" style={{ backgroundColor: '#020617' }}>
      {/* Search Section */}
      <View className="h-16 border-b border-white/5 bg-[#020617] flex-row items-center gap-3 px-6 flex-shrink-0">
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            if (!canChat && reason) {
              showChatBlocked(reason);
              return;
            }
            if (teamId) {
              router.push({ pathname: '/search-chats', params: { teamId } });
            }
          }}
          className="flex-1 px-5 py-2.5 rounded-lg bg-white/10 min-h-[44px] flex-row items-center justify-center gap-2"
        >
          <Feather name="search" size={16} color="#ffffff" />
          <Text className="text-sm font-semibold text-white">Search Chats</Text>
        </TouchableOpacity>
        {permissionsLoaded && canManage && (
          <TouchableOpacity
            onPress={handleNewChat}
            activeOpacity={0.9}
            style={{ overflow: 'hidden', borderRadius: 9999, flexShrink: 0 }}
          >
            <LinearGradient
              colors={['#3b82f6', '#06b6d4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 16,
                paddingVertical: 8,
                minHeight: 44,
              }}
            >
              <Feather name="plus" size={16} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>New Chat</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>

      {/* Chats List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {loading ? (
          <View className="gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </View>
        ) : filtered.length > 0 ? (
          <View className="gap-2">
            {filtered.map(conv => {
              const hasUnread = conv.unreadCount > 0;
              const chatItem = (
                <View key={conv.id} className="w-full flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      if (!canChat && reason) {
                        showChatBlocked(reason);
                        return;
                      }
                      syncChatParamsToUrl(conv.id, conv.name || 'general');
                      (navigation as any).navigate('ChatRoom', {
                        teamId,
                        convId: conv.id,
                        conversationName: conv.name || 'general',
                      });
                    }}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: hasUnread ? 'rgba(59, 130, 246, 0.06)' : 'rgba(255, 255, 255, 0.03)',
                      minHeight: 72,
                      borderLeftWidth: hasUnread ? 3 : 0,
                      borderLeftColor: '#3b82f6',
                    }}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={['#3b82f6', '#06b6d4']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Feather name="message-circle" size={20} color="#ffffff" />
                    </LinearGradient>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{
                        color: hasUnread ? '#ffffff' : '#cbd5e1',
                        fontWeight: hasUnread ? '700' : '500',
                        fontSize: 15,
                        marginBottom: 2,
                      }} numberOfLines={1}>
                        {conv.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Text style={{
                          fontSize: 13,
                          color: hasUnread ? '#94a3b8' : '#475569',
                          fontWeight: hasUnread ? '500' : '400',
                          flex: 1,
                        }} numberOfLines={1}>
                          {conv.lastMessageSender ? (
                            <Text style={{ fontWeight: '600', color: hasUnread ? '#cbd5e1' : '#64748b' }}>
                              {conv.lastMessageSender}:{' '}
                            </Text>
                          ) : null}
                          {conv.lastMessage === 'Message was deleted' ? 'Message was deleted' :
                           conv.lastMessageType === 'gif' ? 'Sent a GIF' :
                           conv.lastMessageType === 'poll' ? 'Created a poll' :
                           conv.lastMessageType === 'voice' ? 'Sent a voice message' :
                           conv.lastMessageType === 'announcement' ? 'Made an announcement' :
                           conv.lastMessage || (conv.lastMessageSender ? 'Sent an attachment' : 'No messages yet')}
                        </Text>
                        {hasUnread && (
                          <View style={{
                            minWidth: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: '#3b82f6',
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingHorizontal: 6,
                          }}>
                            <Text style={{
                              fontSize: 11,
                              color: '#ffffff',
                              fontWeight: '800',
                              lineHeight: 13,
                            }}>{conv.unreadCount > 99 ? '99+' : conv.unreadCount}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{
                        fontSize: 12,
                        color: hasUnread ? '#60a5fa' : '#64748b',
                        fontWeight: hasUnread ? '600' : '400',
                      }}>
                        {new Date(conv.updatedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={async () => {
                        hapticLight();
                        const nextStarred = !conv.starred;
                        setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, starred: nextStarred } : c).sort((a, b) => {
                          const aStarred = a.starred ? 1 : 0;
                          const bStarred = b.starred ? 1 : 0;
                          if (bStarred !== aStarred) return bStarred - aStarred;
                          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                        }));
                        try {
                          if (nextStarred) await starConversation(conv.id);
                          else await unstarConversation(conv.id);
                        } catch {
                          setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, starred: !nextStarred } : c));
                        }
                      }}
                      hitSlop={8}
                      style={{ padding: 8, justifyContent: 'center' }}
                    >
                      <Feather
                        name="star"
                        size={18}
                        color={conv.starred ? '#fbbf24' : 'rgba(255,255,255,0.2)'}
                        fill={conv.starred ? '#fbbf24' : 'transparent'}
                      />
                    </TouchableOpacity>
                </TouchableOpacity>
              </View>
              );

              const contextOptions: Array<{ label: string; value: string; onPress: () => void }> = [
                { label: 'Open Chat', value: 'open', onPress: () => { hapticLight(); if (!canChat && reason) { showChatBlocked(reason); return; } syncChatParamsToUrl(conv.id, conv.name || 'general'); (navigation as any).navigate('ChatRoom', { teamId, convId: conv.id, conversationName: conv.name || 'general' }); } },
                { label: conv.starred ? 'Unstar' : 'Star', value: 'star', onPress: async () => {
                  hapticLight();
                  const nextStarred = !conv.starred;
                  setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, starred: nextStarred } : c).sort((a, b) => {
                    const aStarred = a.starred ? 1 : 0;
                    const bStarred = b.starred ? 1 : 0;
                    if (bStarred !== aStarred) return bStarred - aStarred;
                    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
                  }));
                  try {
                    if (nextStarred) await starConversation(conv.id);
                    else await unstarConversation(conv.id);
                  } catch {
                    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, starred: !nextStarred } : c));
                  }
                } },
              ];
              if (canManage) {
                contextOptions.push(
                  { label: 'Edit Chat', value: 'edit', onPress: () => handleEditChat(conv) },
                  { label: 'Delete Chat', value: 'delete', onPress: () => handleDeleteChat(conv) },
                );
              }

              return (
                <ContextMenu
                  key={conv.id}
                  activationMethod="longPress"
                  onSinglePress={() => {
                    hapticLight();
                    if (!canChat && reason) {
                      showChatBlocked(reason);
                      return;
                    }
                    syncChatParamsToUrl(conv.id, conv.name || 'general');
                    (navigation as any).navigate('ChatRoom', {
                      teamId,
                      convId: conv.id,
                      conversationName: conv.name || 'general',
                    });
                  }}
                  trigger={chatItem}
                  options={contextOptions}
                />
              );
            })}
          </View>
        ) : (
          <View className="flex-col items-center justify-center py-16 px-4">
            <Feather name="message-square" size={48} color="#9ca3af" />
            <Text className="text-gray-400 mb-2 mt-4">No group chats found</Text>
            <Text className="text-sm text-gray-500 text-center">
              {search ? 'Try a different search term' : 'Create a new chat to get started'}
            </Text>
          </View>
        )}
        <KeyboardSpacer extraOffset={72} />
      </ScrollView>

    </View>
  );
}
