import React, { useState, useEffect } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform, StyleSheet, Share } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { PlatformBottomSheet } from '../src/components/PlatformBottomSheet';
import { createInvite, listInvites, deleteInvite, Invite, listMembers, Member } from '../src/api/teams';
import { ENV } from '../src/config/env';
import { Skeleton } from '../src/components';
import { hapticLight, hapticMedium } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

const BACKGROUND_COLOR = '#020617';

const rolesData = [
  {
    role: 'Coach' as const,
    permissions: ['Manage roster', 'Create team events', 'Edit settings', 'Accept requests', 'Leave coach notes'],
    icon: 'zap' as keyof typeof Feather.glyphMap,
  },
  {
    role: 'Player' as const,
    permissions: ['View calendar', 'Chat', 'Log results', 'Access training'],
    icon: 'user' as keyof typeof Feather.glyphMap,
  },
  {
    role: 'Family' as const,
    permissions: ['View calendar', 'View family stats', 'Log family matches', 'View child broadcasts', 'Chat'],
    icon: 'users' as keyof typeof Feather.glyphMap,
  },
  {
    role: 'Spectator' as const,
    permissions: ['View calendar', 'Watch broadcasted matches'],
    icon: 'eye' as keyof typeof Feather.glyphMap,
  },
];

export default function InviteMembersScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ teamId: string }>();
  const teamId = params.teamId;
  const [members, setMembers] = useState<Member[]>([]);
  const [mode, setMode] = useState<'create' | 'list'>('create');
  const [expires, setExpires] = useState('');
  const [uses, setUses] = useState('');
  const [newCode, setNewCode] = useState<string | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [selectedRole, setSelectedRole] = useState<'Coach' | 'Player' | 'Family' | 'Spectator'>('Spectator');

  const base = ENV.APP_URL || 'https://mybreakpoint.app';

  useEffect(() => {
    if (teamId) {
      listMembers(teamId).then(setMembers).catch(console.error);
    }
  }, [teamId]);

  useEffect(() => {
    if (mode === 'list') {
      loadInvites();
    }
  }, [mode]);

  const loadInvites = async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const list = await listInvites(teamId);
      setInvites(list);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load invites');
    } finally {
      setLoading(false);
    }
  };

  const makeInvite = async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      hapticMedium();
      const d = expires ? parseInt(expires) : undefined;
      const u = uses ? parseInt(uses) : undefined;
      const { id } = await createInvite(teamId, d, u, selectedRole);
      setNewCode(id);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create invite');
    } finally {
      setLoading(false);
    }
  };

  const copy = async (url: string) => {
    hapticLight();
    await Clipboard.setStringAsync(url);
    Alert.alert('Copied', 'Invite link copied to clipboard');
  };

  const share = async (url: string) => {
    try {
      hapticLight();
      const msg = `Join my team on MyBreakPoint!\n${url}`;
      await Share.share({
        message: msg,
        title: 'Join my team on MyBreakPoint!',
      });
    } catch (e: any) {
      if (e?.code !== 'ERR_CANCELED' && e?.message !== 'User did not share') {
        console.error('Failed to share:', e);
      }
    }
  };

  const askDelete = (id: string) => {
    hapticLight();
    setDeleting(id);
  };

  const cancelDelete = () => {
    hapticLight();
    setDeleting(null);
  };

  const confirmDelete = async () => {
    if (!deleting || !teamId) return;
    setLoading(true);
    try {
      hapticMedium();
      await deleteInvite(teamId, deleting);
      await loadInvites();
      setNotice('Invite deleted');
      setTimeout(() => setNotice(''), 2000);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to delete invite');
    } finally {
      setLoading(false);
      setDeleting(null);
    }
  };

  const url = newCode ? `${base.replace(/\/$/, '')}/invites/${newCode}/accept` : '';

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Invite Members
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
        {mode === 'create' && !newCode && (
          <View style={{ gap: 16 }}>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setMode('list');
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}
              activeOpacity={0.7}
            >
              <Feather name="eye" size={16} color="#9ca3af" />
              <Text style={{ fontSize: 14, color: '#9ca3af' }}>View Invites</Text>
            </TouchableOpacity>

            <View className="p-6 rounded-2xl bg-white/5 border border-white/10 shadow-lg" style={{ gap: 20 }}>
              <View style={{ gap: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#d1d5db' }}>Role</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {rolesData.map(r => {
                    const isSelected = selectedRole === r.role;
                    return (
                      <TouchableOpacity
                        key={r.role}
                        onPress={() => {
                          hapticLight();
                          setSelectedRole(r.role);
                        }}
                        style={{
                          flex: 1,
                          minWidth: '22%',
                          alignItems: 'center',
                          padding: 12,
                          borderRadius: 8,
                          borderWidth: 1,
                          gap: 4,
                          borderColor: isSelected ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                        }}
                        activeOpacity={0.7}
                      >
                        <Feather
                          name={r.icon}
                          size={20}
                          color={isSelected ? '#3b82f6' : '#9ca3af'}
                        />
                        <Text style={{ fontSize: 12, color: isSelected ? '#60a5fa' : '#9ca3af', fontWeight: isSelected ? '500' : '400' }}>
                          {r.role}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#d1d5db' }}>Valid for (days)</Text>
                <TextInput
                  value={expires}
                  onChangeText={setExpires}
                  placeholder="Permanent"
                  placeholderTextColor="#6b7280"
                  keyboardType="numeric"
                  style={{
                    width: '100%',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    fontSize: 16,
                    minHeight: 44,
                  }}
                />
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#d1d5db' }}>Max uses</Text>
                <TextInput
                  value={uses}
                  onChangeText={setUses}
                  placeholder="Infinite"
                  placeholderTextColor="#6b7280"
                  keyboardType="numeric"
                  style={{
                    width: '100%',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    fontSize: 16,
                    minHeight: 44,
                  }}
                />
              </View>

              <TouchableOpacity
                onPress={makeInvite}
                disabled={loading}
                style={{ minHeight: 48, opacity: loading ? 0.5 : 1 }}
                activeOpacity={0.7}
              >
                {loading ? (
                  <View style={{ paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#2563eb' }}>
                    <ActivityIndicator size="small" color="#ffffff" />
                  </View>
                ) : (
                  <LinearGradient
                    colors={['#3b82f6', '#06b6d4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>Generate Invite</Text>
                  </LinearGradient>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {newCode && mode === 'create' && (
          <View style={{ gap: 16 }}>
            <Text style={{ fontSize: 14, color: '#9ca3af' }}>Share this link:</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 14, color: '#ffffff' }} numberOfLines={1}>
                {url}
              </Text>
              <TouchableOpacity
                onPress={() => copy(url)}
                style={{ padding: 8 }}
                activeOpacity={0.7}
              >
                <Feather name="clipboard" size={20} color="#9ca3af" />
              </TouchableOpacity>
            </View>
            <View style={{ alignItems: 'center', padding: 16, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
              <QRCode value={url} size={200} backgroundColor="transparent" color="#ffffff" />
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => share(url)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}
                activeOpacity={0.7}
              >
                <Feather name="share-2" size={20} color="#9ca3af" />
                <Text style={{ fontSize: 12, color: '#9ca3af' }}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  setNewCode(null);
                }}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}
                activeOpacity={0.7}
              >
                <Feather name="arrow-left" size={20} color="#9ca3af" />
                <Text style={{ fontSize: 12, color: '#9ca3af' }}>Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {mode === 'list' && (
          <View style={{ gap: 16 }}>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setMode('create');
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={16} color="#9ca3af" />
              <Text style={{ fontSize: 14, color: '#9ca3af' }}>Back</Text>
            </TouchableOpacity>
            {notice ? (
              <Text style={{ fontSize: 14, color: '#22c55e', marginBottom: 8 }}>{notice}</Text>
            ) : null}
            {loading ? (
              <View style={{ gap: 12 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} style={{ height: 48, width: '100%', borderRadius: 8 }} />
                ))}
              </View>
            ) : (
              <ScrollView
                style={{ maxHeight: 256 }}
                contentContainerStyle={{ gap: 12 }}
                nestedScrollEnabled
              >
                {invites.length > 0 ? (
                  invites.map(inv => {
                    const link = `${base.replace(/\/$/, '')}/invites/${inv.id}/accept`;
                    return (
                      <View key={inv.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', gap: 12 }}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={{ fontSize: 14, color: '#ffffff', marginBottom: 4 }} numberOfLines={2}>
                            {link}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#9ca3af' }}>
                            Role: {inv.role} | Expires: {inv.expiresAt ?? 'Never'} | Uses: {inv.uses}/{inv.maxUses ?? '∞'}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => copy(link)}
                            style={{ padding: 8, borderRadius: 8 }}
                            activeOpacity={0.7}
                          >
                            <Feather name="clipboard" size={16} color="#9ca3af" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => share(link)}
                            style={{ padding: 8, borderRadius: 8 }}
                            activeOpacity={0.7}
                          >
                            <Feather name="share-2" size={16} color="#9ca3af" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => askDelete(inv.id)}
                            style={{ padding: 8, borderRadius: 8 }}
                            activeOpacity={0.7}
                          >
                            <Feather name="trash-2" size={16} color="#3b82f6" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={{ textAlign: 'center', color: '#6b7280', paddingVertical: 32 }}>No invites yet.</Text>
                )}
              </ScrollView>
            )}
          </View>
        )}

        <PlatformBottomSheet
          isOpened={!!deleting}
          onIsOpenedChange={(opened) => { if (!opened) cancelDelete(); }}
          presentationDetents={[0.28]}
          presentationDragIndicator="visible"
        >
          <View style={{ padding: 24, gap: 20, alignItems: 'center' }}>
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Feather name="trash-2" size={26} color="#f87171" />
            </View>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff', textAlign: 'center' }}>
                Delete Invite
              </Text>
              <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center' }}>
                This invite link will stop working immediately.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                onPress={cancelDelete}
                disabled={loading}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 50,
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 16, fontWeight: '500', color: '#ffffff' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDelete}
                disabled={loading}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  gap: 8,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: '#ef4444',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 50,
                  opacity: loading ? 0.6 : 1,
                }}
                activeOpacity={0.7}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Feather name="trash-2" size={16} color="#ffffff" />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>Delete</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </PlatformBottomSheet>

        <KeyboardSpacer extraOffset={20} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
});
