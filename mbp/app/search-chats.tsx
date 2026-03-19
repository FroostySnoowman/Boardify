import React, { useState, useEffect } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { listConversations, Conversation } from '../src/api/messages';
import { useAuth } from '../src/contexts/AuthContext';
import { hapticLight } from '../src/utils/haptics';
import { useChatAccess } from '../src/components/ChatAccessGate';
import { useChatBlockedModal } from '../src/contexts/ChatBlockedModalContext';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { Skeleton } from '../src/components/Skeleton';

const BACKGROUND_COLOR = '#020617';

export default function SearchChatsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ teamId: string }>();
  const teamId = params.teamId;
  const { user, loading: authLoading } = useAuth();
  const { canChat, reason } = useChatAccess();
  const { showChatBlocked } = useChatBlockedModal();
  const [searchTerm, setSearchTerm] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !teamId) return;
    loadConversations();
  }, [authLoading, teamId]);

  const loadConversations = async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const data = await listConversations(teamId);
      setConversations(data.filter(c => c.type === 'group'));
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const openChat = (conv: Conversation) => {
    hapticLight();
    if (!canChat && reason) {
      showChatBlocked(reason);
      return;
    }
    router.back();
    setTimeout(() => {
      router.push({
        pathname: '/(tabs)/team',
        params: {
          teamId,
          convId: conv.id,
          conversationName: conv.name || 'General',
        },
      });
    }, 300);
  };

  const filteredConversations = conversations
    .filter(c => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const name = (c.name || '').toLowerCase();
      const lastMsg = (c.lastMessage || '').toLowerCase();
      return name.includes(term) || lastMsg.includes(term);
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Search Chats
          </Stack.Screen.Title>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button
              icon="xmark"
              onPress={() => router.back()}
              tintColor="#ffffff"
            />
          </Stack.Toolbar>
      </Stack.Screen>

      <LinearGradient
        colors={['rgba(96, 165, 250, 0.18)', 'rgba(34, 197, 94, 0.14)', 'rgba(2, 6, 23, 0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={{ maxWidth: 768, alignSelf: 'center', width: '100%' }}>
          <View style={{ gap: 24 }}>
            <View style={{ padding: 24, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', gap: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="message-square" size={24} color="#3b82f6" style={{ marginRight: 12 }} />
                <Text style={{ fontSize: 24, fontWeight: '700', color: '#ffffff' }}>Search Chats</Text>
              </View>

              <View style={{ position: 'relative' }}>
                <Feather
                  name="search"
                  size={20}
                  color="#9ca3af"
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: [{ translateY: -10 }],
                    zIndex: 1,
                  }}
                />
                <TextInput
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholder="Search chats..."
                  placeholderTextColor="#6b7280"
                  style={{
                    width: '100%',
                    paddingLeft: 40,
                    paddingRight: 12,
                    paddingVertical: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    color: '#ffffff',
                    fontSize: 16,
                    minHeight: 44,
                  }}
                  autoFocus
                />
              </View>

              {loading ? (
                <View style={{ gap: 12 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <View
                      key={i}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        padding: 16,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      <Skeleton style={{ width: 40, height: 40, borderRadius: 10 }} />
                      <View style={{ flex: 1, gap: 6 }}>
                        <Skeleton style={{ height: 16, width: '60%', borderRadius: 4 }} />
                        <Skeleton style={{ height: 12, width: '80%', borderRadius: 4 }} />
                      </View>
                    </View>
                  ))}
                </View>
              ) : filteredConversations.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16
                  }}>
                    <Feather name="message-square" size={32} color="#6b7280" />
                  </View>
                  <Text style={{ color: '#9ca3af', fontSize: 16, textAlign: 'center' }}>
                    {searchTerm.trim() ? 'No chats found matching your search.' : 'No group chats found.'}
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {filteredConversations.map((conv) => (
                    <TouchableOpacity
                      key={conv.id}
                      onPress={() => openChat(conv)}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: 12,
                        padding: 16,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                        <View style={{
                          width: 40,
                          height: 40,
                          borderRadius: 10,
                          backgroundColor: 'rgba(59, 130, 246, 0.2)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Feather name="message-circle" size={20} color="#60a5fa" />
                        </View>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                            {conv.name || 'General'}
                          </Text>
                          {(conv.lastMessage || conv.lastMessageType) ? (
                            <Text style={{ color: '#9ca3af', fontSize: 14 }} numberOfLines={1}>
                              {conv.lastMessageSender ? (
                                <Text style={{ fontWeight: '600', color: '#94a3b8' }}>
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
                          ) : null}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <Feather name="users" size={14} color="#9ca3af" />
                            <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                              {conv.participants.length} participants
                            </Text>
                            {conv.unreadCount > 0 && (
                              <View style={{
                                backgroundColor: '#3b82f6',
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderRadius: 10,
                              }}>
                                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600' }}>
                                  {conv.unreadCount}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
        <KeyboardSpacer extraOffset={20} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
});
