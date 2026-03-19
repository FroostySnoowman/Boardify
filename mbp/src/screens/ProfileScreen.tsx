import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { getUserProfile, updateUserProfile } from '../api/user';
import { hapticLight } from '../utils/haptics';
import { Skeleton } from '../components/Skeleton';
import ProfilePictureUpload from '../components/ProfilePictureUpload';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { setUserContext } = useAuth();
  const [user, setUser] = useState<any | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  useEffect(() => {
    setLoadingUser(true);
    getUserProfile()
      .then(u => {
        setUser(u);
        setNewUsername(u.username || '');
      })
      .catch(() => {})
      .finally(() => setLoadingUser(false));
  }, []);

  async function handleSaveUsername() {
    hapticLight();
    try {
      await updateUserProfile({ username: newUsername || undefined });
      setUser((prev: any) => prev && { ...prev, username: newUsername });
      setEditingUsername(false);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update username');
    }
  }

  function handleProfilePictureUpload(url: string) {
    if (user) {
      const updatedUser = { ...user, profilePictureUrl: url };
      setUser(updatedUser);
      setUserContext(updatedUser);
    }
  }

  return (
    <View className="pb-8 relative flex-1 bg-background" style={{ paddingBottom: 32 }}>
      <ScrollView
        contentContainerStyle={{ 
          paddingBottom: insets.bottom + 24,
          paddingTop: 0,
        }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={{ maxWidth: 768, alignSelf: 'center', width: '100%', paddingHorizontal: 16 }}>
          <View style={{ gap: 24 }}>
            {/* Profile Section */}
            <View className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6 shadow-lg">
              <View className="flex-row items-center">
                <Feather name="user" size={24} color="#60a5fa" className="mr-3" />
                <Text className="text-2xl font-bold text-white">Profile</Text>
              </View>
              {loadingUser ? (
                <View className="space-y-6">
                  <View className="flex justify-center">
                    <Skeleton className="h-32 w-32 rounded-full" />
                  </View>
                  <Skeleton className="h-6 w-1/3 rounded-lg mx-auto" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </View>
              ) : (
                <>
                  <View className="flex justify-center">
                    <ProfilePictureUpload
                      currentImageUrl={user?.profilePictureUrl}
                      onUploadSuccess={handleProfilePictureUpload}
                    />
                  </View>
                  
                  <View className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-6 border-b border-white/10">
                    <Text className="text-gray-300 font-medium">Username</Text>
                    {editingUsername ? (
                      <View style={{ flexDirection: 'column', gap: 8 }}>
                        <TextInput
                          value={newUsername}
                          onChangeText={setNewUsername}
                          placeholder="Enter username"
                          placeholderTextColor="#9ca3af"
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            color: '#ffffff',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            borderRadius: 8,
                            minHeight: 44,
                          }}
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            onPress={handleSaveUsername}
                            activeOpacity={0.9}
                            style={{ flex: 1, overflow: 'hidden', borderRadius: 8 }}
                          >
                            <LinearGradient
                              colors={['#22c55e', '#10b981']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={{
                                paddingHorizontal: 20,
                                paddingVertical: 10,
                                minHeight: 44,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Save</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setEditingUsername(false);
                              setNewUsername(user?.username || '');
                            }}
                            activeOpacity={0.8}
                            style={{
                              flex: 1,
                              paddingHorizontal: 20,
                              paddingVertical: 10,
                              minHeight: 44,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              borderRadius: 8,
                            }}
                          >
                            <Text style={{ color: '#9ca3af', fontSize: 16, fontWeight: '500' }}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View className="flex-row items-center justify-between sm:justify-end gap-4">
                        <Text className="text-white">
                          {user?.username || user?.email?.split('@')[0] || 'Not set'}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setEditingUsername(true)}
                          activeOpacity={0.8}
                        >
                          <Text className="text-blue-400 font-medium">Edit</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>
          </View>
          <KeyboardSpacer extraOffset={40} />
        </View>
      </ScrollView>
    </View>
  );
}
