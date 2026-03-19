import React, { useState, useEffect } from 'react';
import { Stack, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { listMembers, updateMemberRole, Member } from '../src/api/teams';
import { hapticLight, hapticMedium } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { useAuth } from '../src/contexts/AuthContext';
import { Avatar } from '../src/components/Avatar';
import { PlatformBottomSheet } from '../src/components/PlatformBottomSheet';

const BACKGROUND_COLOR = '#020617';

const roleOptions = ['Owner', 'Coach', 'Player', 'Family', 'Spectator'];

export default function EditMemberScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ teamId: string; memberId: string }>();
  const teamId = params.teamId;
  const memberId = params.memberId;

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showTransferSheet, setShowTransferSheet] = useState(false);

  // Load member data
  useEffect(() => {
    if (!teamId || !memberId) {
      router.back();
      return;
    }

    const loadMember = async () => {
      setLoading(true);
      try {
        const members = await listMembers(teamId);
        const foundMember = members.find(m => m.id === memberId);
        if (foundMember) {
          setMember(foundMember);
          const raw = (foundMember.role || '').trim();
          const role = roleOptions.includes(raw)
            ? raw
            : roleOptions.find(r => r.toLowerCase() === raw.toLowerCase()) ?? 'Spectator';
          setSelectedRole(role);
        } else {
          router.back();
        }
      } catch (e: any) {
        console.error('Failed to load member:', e);
        setError(e.message || 'Failed to load member');
      } finally {
        setLoading(false);
      }
    };

    loadMember();
  }, [teamId, memberId]);

  // Check if current user can assign owner role
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  useEffect(() => {
    if (!teamId || !user) return;
    listMembers(teamId)
      .then(members => {
        const currentMember = members.find(m => m.id === user.id);
        setCurrentUserRole(currentMember?.role.toLowerCase() || '');
      })
      .catch(() => {});
  }, [teamId, user]);

  const isOwner = currentUserRole === 'owner';
  const canAssignOwner = isOwner;
  const availableRoles = roleOptions.filter(r =>
    r === 'Owner' ? canAssignOwner : true
  );

  // Cleanup: Reset form state when screen loses focus
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setSaving(false);
        setError('');
      };
    }, [])
  );

  const handleSave = async () => {
    if (!teamId || !memberId || !selectedRole) return;

    if (selectedRole === 'Owner' && member?.role.toLowerCase() !== 'owner') {
      hapticMedium();
      setShowTransferSheet(true);
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    if (!teamId || !memberId || !selectedRole) return;

    setSaving(true);
    setError('');
    try {
      await updateMemberRole(teamId, memberId, { role: selectedRole });
      hapticLight();
      router.back();
    } catch (e: any) {
      console.error('Failed to save role:', e);
      setError(e.message || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !member) {
    return (
      <View style={styles.container}>
        <Stack.Screen>
          <Stack.Header
            style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
           />
            <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
              Member Details
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

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Member Details
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
              <View style={{ gap: 24 }}>
                <View style={{ alignItems: 'center', marginBottom: 8 }}>
                  <Avatar
                    src={member.profilePictureUrl}
                    alt={member.username}
                    size="xl"
                  />
                </View>

                <View style={{ gap: 8 }}>
                  <Text className="text-gray-300 font-medium text-lg">Username</Text>
                  <View
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      minHeight: 44,
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 16 }}>
                      {member.username}
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 8 }}>
                  <Text className="text-gray-300 font-medium text-lg">Role</Text>
                  <View style={{ gap: 8 }}>
                    {availableRoles.map(role => (
                      <TouchableOpacity
                        key={role}
                        onPress={() => {
                          hapticLight();
                          setSelectedRole(role);
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 12,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: selectedRole === role ? '#3b82f6' : 'rgba(255, 255, 255, 0.3)',
                          backgroundColor: selectedRole === role ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{
                          fontSize: 16,
                          color: selectedRole === role ? '#ffffff' : '#d1d5db',
                          fontWeight: selectedRole === role ? '500' : '400',
                        }}>
                          {role}
                        </Text>
                        {selectedRole === role && (
                          <Feather name="check" size={16} color="#ffffff" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {error ? (
                  <View className="p-3 rounded-lg bg-red-500/20 border border-red-500/30">
                    <Text className="text-red-400 text-sm">{error}</Text>
                  </View>
                ) : null}

                <View className="flex-row justify-end gap-4 pt-4">
                  <TouchableOpacity
                    onPress={() => router.back()}
                    className="px-5 py-2.5 rounded-lg"
                    activeOpacity={0.7}
                  >
                    <Text className="text-gray-400 text-base">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.8}
                    style={{ overflow: 'hidden', borderRadius: 8, opacity: saving ? 0.5 : 1 }}
                  >
                    <LinearGradient
                      colors={['#1e40af', '#1e3a8a']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 8,
                      }}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <Feather name="save" size={16} color="#ffffff" />
                          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Save</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
          <KeyboardSpacer extraOffset={40} />
        </View>
      </ScrollView>

      <PlatformBottomSheet
        isOpened={showTransferSheet}
        onIsOpenedChange={setShowTransferSheet}
        presentationDetents={[0.35]}
      >
        <View style={{ padding: 24, gap: 16 }}>
          <View style={{ alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: 'rgba(251, 146, 60, 0.15)',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Feather name="alert-triangle" size={28} color="#fb923c" />
            </View>
            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
              Transfer Ownership
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
              Are you sure you want to transfer ownership to{' '}
              <Text style={{ color: '#ffffff', fontWeight: '600' }}>{member?.username}</Text>?
              {'\n'}You will be demoted to Coach.
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            <TouchableOpacity
              onPress={() => {
                setShowTransferSheet(false);
                performSave();
              }}
              disabled={saving}
              activeOpacity={0.8}
              style={{
                backgroundColor: '#dc2626',
                paddingVertical: 14,
                borderRadius: 10,
                alignItems: 'center',
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                  Transfer Ownership
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowTransferSheet(false)}
              activeOpacity={0.7}
              style={{
                paddingVertical: 14,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <Text style={{ color: '#9ca3af', fontSize: 16, fontWeight: '500' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </PlatformBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
});
