import React, { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUserProfile, updateUserProfile, updateUserPreferences } from '../src/api/user';
import { useAuth } from '../src/contexts/AuthContext';
import { hapticLight, hapticMedium } from '../src/utils/haptics';
import { Skeleton } from '../src/components/Skeleton';
import ProfilePictureUpload from '../src/components/ProfilePictureUpload';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { setUserContext } = useAuth();
  const [user, setUser] = useState<any | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [mode, setMode] = useState<'tennis' | 'pickleball' | 'padel' | undefined>(undefined);
  const [statProfile, setStatProfile] = useState<'basic' | 'intermediate' | 'advanced' | undefined>(undefined);

  useEffect(() => {
    setLoadingUser(true);
    getUserProfile()
      .then(u => {
        setUser(u);
        setNewUsername(u.username || '');
        setMode(u.mode);
        setStatProfile(u.statProfile);
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

  async function handleModeChange(m: 'tennis' | 'pickleball' | 'padel') {
    hapticMedium();
    const newValue = mode === m ? undefined : m;
    setMode(newValue);
    await updateUserPreferences({ mode: newValue });
    if (user) setUserContext({ ...user, mode: newValue });
  }

  async function handleStatProfileChange(p: 'basic' | 'intermediate' | 'advanced') {
    hapticMedium();
    const newValue = statProfile === p ? undefined : p;
    setStatProfile(newValue);
    await updateUserPreferences({ statProfile: newValue });
    if (user) setUserContext({ ...user, statProfile: newValue });
  }

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Profile
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
          paddingBottom: insets.bottom + 32,
        }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={{ maxWidth: 768, alignSelf: 'center', width: '100%', paddingHorizontal: 16 }}>
          <View style={{ gap: 24 }}>
            <View className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6 shadow-lg">
              <View className="flex-row items-center">
                <Feather name="user" size={24} color="#60a5fa" className="mr-3" />
                <Text className="text-2xl font-bold text-white">Profile</Text>
              </View>
              {loadingUser ? (
                <View style={{ gap: 16 }}>
                  <View style={{ alignItems: 'center', marginTop: -12, marginBottom: 8 }}>
                    <Skeleton style={{ width: 100, height: 100, borderRadius: 50 }} />
                    <Skeleton style={{ width: 130, height: 36, borderRadius: 8, marginTop: 12 }} />
                  </View>
                  <View style={{ paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
                    <Skeleton style={{ width: 80, height: 16, borderRadius: 4, marginBottom: 8 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Skeleton style={{ width: 140, height: 20, borderRadius: 4 }} />
                      <Skeleton style={{ width: 32, height: 16, borderRadius: 4 }} />
                    </View>
                  </View>
                </View>
              ) : (
                <>
                  <View className="flex justify-center" style={{ marginTop: -12, marginBottom: 8 }}>
                    <ProfilePictureUpload
                      currentImageUrl={user?.profilePictureUrl}
                      onUploadSuccess={handleProfilePictureUpload}
                    />
                  </View>
                  
                  <View className="flex flex-col gap-3 pb-6 border-b border-white/10">
                    <Text className="text-gray-300 font-medium">Username</Text>
                    {editingUsername ? (
                      <View style={{ gap: 10 }}>
                        <TextInput
                          value={newUsername}
                          onChangeText={setNewUsername}
                          placeholder="Enter username"
                          placeholderTextColor="#9ca3af"
                          autoFocus
                          autoCapitalize="none"
                          autoCorrect={false}
                          maxLength={30}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            color: '#ffffff',
                            fontSize: 16,
                            fontWeight: '500',
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.15)',
                          }}
                        />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Pressable
                            onPress={handleSaveUsername}
                            disabled={!newUsername.trim() || newUsername.trim().length < 3}
                            style={({ pressed }) => ({
                              overflow: 'hidden',
                              borderRadius: 10,
                              opacity: (!newUsername.trim() || newUsername.trim().length < 3) ? 0.5 : pressed ? 0.85 : 1,
                            })}
                          >
                            <LinearGradient
                              colors={['#22c55e', '#10b981']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={{
                                paddingHorizontal: 24,
                                paddingVertical: 10,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 10,
                              }}
                            >
                              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>Save</Text>
                            </LinearGradient>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              setEditingUsername(false);
                              setNewUsername(user?.username || '');
                            }}
                            style={({ pressed }) => ({
                              opacity: pressed ? 0.6 : 1,
                            })}
                          >
                            <Text style={{ color: '#9ca3af', fontSize: 15, fontWeight: '500' }}>Cancel</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View className="flex-row items-center justify-between">
                        <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '500' }}>
                          {user?.username || user?.email?.split('@')[0] || 'Not set'}
                        </Text>
                        <Pressable
                          onPress={() => setEditingUsername(true)}
                          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                        >
                          <Text style={{ color: '#60a5fa', fontSize: 15, fontWeight: '600' }}>Edit</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </>
              )}
            </View>

            <View className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6 shadow-lg">
              <View className="flex-row items-center">
                <Feather name="settings" size={24} color="#4ade80" className="mr-3" />
                <Text className="text-2xl font-bold text-white">General</Text>
              </View>
              {loadingUser ? (
                <View style={{ gap: 20 }}>
                  <View>
                    <Skeleton style={{ width: 50, height: 16, borderRadius: 4, marginBottom: 12 }} />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Skeleton style={{ width: 90, height: 48, borderRadius: 12 }} />
                      <Skeleton style={{ width: 100, height: 48, borderRadius: 12 }} />
                      <Skeleton style={{ width: 80, height: 48, borderRadius: 12 }} />
                    </View>
                  </View>
                  <View>
                    <Skeleton style={{ width: 130, height: 16, borderRadius: 4, marginBottom: 12 }} />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Skeleton style={{ width: 80, height: 48, borderRadius: 12 }} />
                      <Skeleton style={{ width: 110, height: 48, borderRadius: 12 }} />
                      <Skeleton style={{ width: 100, height: 48, borderRadius: 12 }} />
                    </View>
                  </View>
                </View>
              ) : (
                <>
                  <View className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" style={{ marginBottom: 20 }}>
                    <Text className="text-gray-300 font-medium text-lg">Sport</Text>
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                      {(['tennis', 'pickleball', 'padel'] as const).map(option => (
                        <Pressable
                          key={option}
                          onPress={() => handleModeChange(option)}
                          style={({ pressed }) => ({
                            overflow: 'hidden',
                            borderRadius: 12,
                            opacity: pressed ? 0.9 : 1,
                          })}
                        >
                          {mode === option ? (
                            <LinearGradient
                              colors={['#22c55e', '#10b981']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={{
                                paddingHorizontal: 20,
                                paddingVertical: 12,
                                minHeight: 48,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 12,
                              }}
                            >
                              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                                {option === 'tennis' ? 'Tennis' : option === 'pickleball' ? 'Pickleball' : 'Padel'}
                              </Text>
                            </LinearGradient>
                          ) : (
                            <View
                              style={{
                                paddingHorizontal: 20,
                                paddingVertical: 12,
                                minHeight: 48,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.08)',
                              }}
                            >
                              <Text style={{ color: '#d1d5db', fontSize: 16, fontWeight: '600' }}>
                                {option === 'tennis' ? 'Tennis' : option === 'pickleball' ? 'Pickleball' : 'Padel'}
                              </Text>
                            </View>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <Text className="text-gray-300 font-medium text-lg">Stat Mode Defaults</Text>
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                      {(['basic', 'intermediate', 'advanced'] as const).map(option => (
                        <Pressable
                          key={option}
                          onPress={() => handleStatProfileChange(option)}
                          style={({ pressed }) => ({
                            overflow: 'hidden',
                            borderRadius: 12,
                            opacity: pressed ? 0.9 : 1,
                          })}
                        >
                          {statProfile === option ? (
                            <LinearGradient
                              colors={['#22c55e', '#10b981']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={{
                                paddingHorizontal: 20,
                                paddingVertical: 12,
                                minHeight: 48,
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 12,
                              }}
                            >
                              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                                {option === 'basic' ? 'Basic' : option === 'intermediate' ? 'Intermediate' : 'Advanced'}
                              </Text>
                            </LinearGradient>
                          ) : (
                            <View
                              style={{
                                paddingHorizontal: 20,
                                paddingVertical: 12,
                                minHeight: 48,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.08)',
                              }}
                            >
                              <Text style={{ color: '#d1d5db', fontSize: 16, fontWeight: '600' }}>
                                {option === 'basic' ? 'Basic' : option === 'intermediate' ? 'Intermediate' : 'Advanced'}
                              </Text>
                            </View>
                          )}
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </>
              )}
            </View>

            <Pressable
              onPress={() => router.push('/settings')}
              style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
            >
              <View className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4 shadow-lg">
                <View className="flex-row items-center">
                  <Feather name="sliders" size={22} color="#60a5fa" className="mr-3" />
                  <Text className="text-xl font-semibold text-white">More Settings</Text>
                </View>
                <Text className="text-gray-400 text-sm">
                  Open detailed preferences in a sheet above this one.
                </Text>
              </View>
            </Pressable>
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
