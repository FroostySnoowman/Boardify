import React, { useState, useEffect } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { listMembers, Member } from '../src/api/teams';
import { createGroupChat } from '../src/api/messages';
import { hapticLight, hapticMedium } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { useChatAccess, ChatBlockScreen } from '../src/components/ChatAccessGate';

const ROLE_OPTIONS = ['Owner', 'Coach', 'Player', 'Family', 'Spectator'];

export default function CreateGroupChatScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ teamId: string }>();
  const teamId = params.teamId;
  const { canChat, reason } = useChatAccess();

  const [chatName, setChatName] = useState('');
  const [accessType, setAccessType] = useState<'everyone' | 'roles' | 'users' | 'roles_and_users'>('everyone');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (teamId) {
      loadMembers();
    }
  }, [teamId]);

  const loadMembers = async () => {
    if (!teamId) return;
    try {
      const data = await listMembers(teamId);
      setMembers(data);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  const handleSubmit = async () => {
    if (!chatName.trim() || !teamId) return;

    const chatNameLower = chatName.trim().toLowerCase();

    const isDisabled =
      loading ||
      !chatName.trim() ||
      (accessType === 'roles' && selectedRoles.length === 0) ||
      (accessType === 'users' && selectedUserIds.length === 0) ||
      (accessType === 'roles_and_users' && selectedRoles.length === 0 && selectedUserIds.length === 0);

    if (isDisabled) return;

    setLoading(true);
    hapticMedium();
    try {
      let finalUserIds = [...selectedUserIds];
      let finalRoles = [...selectedRoles];
      
      // If creating "fans" chat, automatically include all parents (Family role)
      if (chatNameLower === 'fans') {
        if (!finalRoles.includes('Family')) {
          finalRoles.push('Family');
        }
        // Also add all users with Family role to userIds
        const familyMembers = members.filter(m => m.role === 'Family');
        familyMembers.forEach(m => {
          if (!finalUserIds.includes(String(m.id))) {
            finalUserIds.push(String(m.id));
          }
        });
      }
      
      await createGroupChat(teamId, chatName.trim(), finalUserIds, finalRoles, accessType);
      router.back();
    } catch (err: any) {
      console.error('Failed to create group chat:', err);
      Alert.alert('Error', err.message || 'Failed to create group chat');
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (role: string) => {
    hapticLight();
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const toggleUser = (userId: string) => {
    hapticLight();
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const filteredMembers = members.filter(m =>
    m.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isDisabled =
    loading ||
    !chatName.trim() ||
    (accessType === 'roles' && selectedRoles.length === 0) ||
    (accessType === 'users' && selectedUserIds.length === 0) ||
    (accessType === 'roles_and_users' && selectedRoles.length === 0 && selectedUserIds.length === 0);

  if (!canChat && reason) {
    return (
      <View style={styles.container}>
        <Stack.Screen>
          <Stack.Header
            style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
           />
            <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>Create Group Chat</Stack.Screen.Title>
            <Stack.Toolbar placement="left">
              <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} tintColor="#ffffff" />
            </Stack.Toolbar>
        </Stack.Screen>
        <ChatBlockScreen reason={reason} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Create Group Chat
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
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={{ maxWidth: 768, alignSelf: 'center', width: '100%' }}>
          <View style={{ gap: 24 }}>
            <View className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6 shadow-lg">
              <View className="flex-row items-center">
                <Feather name="message-circle" size={24} color="#60a5fa" className="mr-3" />
                <Text className="text-2xl font-bold text-white">Create Group Chat</Text>
              </View>

              <View>
                <Text className="text-gray-300 font-medium text-lg mb-2">Chat Name *</Text>
                <TextInput
                  value={chatName}
                  onChangeText={setChatName}
                  placeholder="e.g., Tournament Planning, Practice Updates"
                  maxLength={50}
                  placeholderTextColor="#6b7280"
                  style={{
                    color: '#ffffff',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: 16,
                    minHeight: 44,
                  }}
                  autoFocus
                />
                <Text className="text-xs text-gray-500 mt-1">
                  {chatName.length}/50 characters
                </Text>
                {chatName.trim().toLowerCase() === 'fans' && (
                  <Text className="text-xs text-blue-400 mt-1">
                    Note: "fans" chat will automatically include all parents
                  </Text>
                )}
              </View>

              <View>
                <Text className="text-gray-300 font-medium text-lg mb-3">Who can access this chat? *</Text>
                <View className="gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      setAccessType('everyone');
                    }}
                    className={`w-full p-4 rounded-lg border-2 min-h-[60px] ${
                      accessType === 'everyone' ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5'
                    }`}
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-start gap-3">
                      <View className={`w-5 h-5 rounded-full border-2 items-center justify-center mt-0.5 flex-shrink-0 ${
                        accessType === 'everyone' ? 'border-blue-500 bg-blue-500' : 'border-white/30'
                      }`}>
                        {accessType === 'everyone' && (
                          <Feather name="check" size={12} color="#ffffff" />
                        )}
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-1">
                          <Feather name="users" size={16} color="#ffffff" />
                          <Text className="font-medium text-white text-base">Everyone on the team</Text>
                        </View>
                        <Text className="text-xs text-gray-400 mt-1">
                          All current and future team members can access this chat
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      setAccessType('roles');
                    }}
                    className={`w-full p-4 rounded-lg border-2 min-h-[60px] ${
                      accessType === 'roles' ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5'
                    }`}
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-start gap-3">
                      <View className={`w-5 h-5 rounded-full border-2 items-center justify-center mt-0.5 flex-shrink-0 ${
                        accessType === 'roles' ? 'border-blue-500 bg-blue-500' : 'border-white/30'
                      }`}>
                        {accessType === 'roles' && (
                          <Feather name="check" size={12} color="#ffffff" />
                        )}
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-1">
                          <Feather name="shield" size={16} color="#ffffff" />
                          <Text className="font-medium text-white text-base">Specific roles only</Text>
                        </View>
                        <Text className="text-xs text-gray-400 mt-1">
                          Only members with selected roles can access
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      setAccessType('users');
                    }}
                    className={`w-full p-4 rounded-lg border-2 min-h-[60px] ${
                      accessType === 'users' ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5'
                    }`}
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-start gap-3">
                      <View className={`w-5 h-5 rounded-full border-2 items-center justify-center mt-0.5 flex-shrink-0 ${
                        accessType === 'users' ? 'border-blue-500 bg-blue-500' : 'border-white/30'
                      }`}>
                        {accessType === 'users' && (
                          <Feather name="check" size={12} color="#ffffff" />
                        )}
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-1">
                          <Feather name="user" size={16} color="#ffffff" />
                          <Text className="font-medium text-white text-base">Specific users only</Text>
                        </View>
                        <Text className="text-xs text-gray-400 mt-1">
                          Only selected users can access
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      setAccessType('roles_and_users');
                    }}
                    className={`w-full p-4 rounded-lg border-2 min-h-[60px] ${
                      accessType === 'roles_and_users' ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5'
                    }`}
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-start gap-3">
                      <View className={`w-5 h-5 rounded-full border-2 items-center justify-center mt-0.5 flex-shrink-0 ${
                        accessType === 'roles_and_users' ? 'border-blue-500 bg-blue-500' : 'border-white/30'
                      }`}>
                        {accessType === 'roles_and_users' && (
                          <Feather name="check" size={12} color="#ffffff" />
                        )}
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2 mb-1">
                          <Feather name="shield" size={16} color="#ffffff" />
                          <Feather name="user" size={16} color="#ffffff" style={{ marginLeft: 4 }} />
                          <Text className="font-medium text-white text-base">Roles and specific users</Text>
                        </View>
                        <Text className="text-xs text-gray-400 mt-1">
                          Members with selected roles OR selected users
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {(accessType === 'roles' || accessType === 'roles_and_users') && (
                <View>
                  <Text className="text-gray-300 font-medium text-lg mb-2">Select Roles *</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {ROLE_OPTIONS.map(role => (
                      <TouchableOpacity
                        key={role}
                        onPress={() => toggleRole(role)}
                        className={`flex-row items-center gap-2 p-3 rounded-lg border flex-1 min-w-[45%] min-h-[48px] ${
                          selectedRoles.includes(role) ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5'
                        }`}
                        activeOpacity={0.7}
                      >
                        <View className={`w-4 h-4 rounded border items-center justify-center ${
                          selectedRoles.includes(role) ? 'border-blue-500 bg-blue-500' : 'border-white/30'
                        }`}>
                          {selectedRoles.includes(role) && (
                            <Feather name="check" size={12} color="#ffffff" />
                          )}
                        </View>
                        <Text className={`text-sm font-medium ${
                          selectedRoles.includes(role) ? 'text-white' : 'text-gray-300'
                        }`}>
                          {role}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {selectedRoles.length === 0 && (
                    <Text className="text-xs text-red-500 mt-2">Please select at least one role</Text>
                  )}
                </View>
              )}

              {(accessType === 'users' || accessType === 'roles_and_users') && (
                <View>
                  <Text className="text-gray-300 font-medium text-lg mb-2">
                    Select Users {accessType === 'users' && '*'}
                  </Text>
                  <TextInput
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    placeholder="Search members..."
                    placeholderTextColor="#6b7280"
                    style={{
                      color: '#ffffff',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: 8,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      fontSize: 16,
                      minHeight: 44,
                      marginBottom: 12,
                    }}
                  />
                  <ScrollView
                    className="max-h-48 border border-white/10 rounded-lg bg-black/20 p-2"
                    contentContainerStyle={{ gap: 6 }}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                  >
                    {filteredMembers.length > 0 ? (
                      filteredMembers.map(member => (
                        <TouchableOpacity
                          key={member.id}
                          onPress={() => toggleUser(String(member.id))}
                          className={`flex-row items-center gap-3 p-3 rounded-lg border min-h-[56px] ${
                            selectedUserIds.includes(String(member.id)) ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-white/5'
                          }`}
                          activeOpacity={0.7}
                        >
                          <View className={`w-4 h-4 rounded border items-center justify-center ${
                            selectedUserIds.includes(String(member.id)) ? 'border-blue-500 bg-blue-500' : 'border-white/30'
                          }`}>
                            {selectedUserIds.includes(String(member.id)) && (
                              <Feather name="check" size={12} color="#ffffff" />
                            )}
                          </View>
                          <View className="flex-1">
                            <Text className="text-sm font-medium text-white mb-0.5">
                              {member.username || 'Unknown'}
                            </Text>
                            <Text className="text-xs text-gray-400">{member.role}</Text>
                          </View>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text className="text-sm text-gray-400 text-center py-4">No members found</Text>
                    )}
                  </ScrollView>
                  {accessType === 'users' && selectedUserIds.length === 0 && (
                    <Text className="text-xs text-red-500 mt-2">Please select at least one user</Text>
                  )}
                </View>
              )}

              <View className="flex-row justify-end gap-4 pt-4">
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    router.back();
                  }}
                  className="px-5 py-2.5 rounded-lg"
                  disabled={loading}
                >
                  <Text className="text-gray-400 text-base">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={isDisabled}
                  activeOpacity={0.8}
                  style={{ 
                    overflow: 'hidden', 
                    borderRadius: 8,
                    opacity: isDisabled ? 0.5 : 1,
                  }}
                >
                  <LinearGradient
                    colors={['#3b82f6', '#06b6d4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingHorizontal: 24,
                      paddingVertical: 12,
                      minHeight: 44,
                    }}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Feather name="message-circle" size={20} color="#ffffff" />
                    )}
                    <Text className="text-white font-medium text-base">
                      {loading ? 'Creating...' : 'Create Chat'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <KeyboardSpacer extraOffset={40} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
});
