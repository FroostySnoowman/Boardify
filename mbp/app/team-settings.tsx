import React, { useState, useEffect } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Switch, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { getTeam, listMembers, Member, updateTeam, deleteTeam, leaveTeam, updateMemberRole, uploadTeamImage, deleteTeamImage } from '../src/api/teams';
import { useTeams } from '../src/contexts/TeamsContext';
import { useAuth } from '../src/contexts/AuthContext';
import { Skeleton } from '../src/components';
import TeamImageUpload from '../src/components/TeamImageUpload';
import { hapticLight, hapticMedium } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { GradientColorPicker } from '../src/components/GradientColorPicker';

const BACKGROUND_COLOR = '#020617';

const rolesData = [
  {
    role: 'Owner',
    permissions: [
      'Manage roster',
      'Create team events',
      'Edit settings',
      'Accept requests',
      'Leave coach notes',
      'Transfer ownership',
      'Delete team',
    ],
    colors: ['#3b82f6', '#06b6d4'],
    icon: 'award' as keyof typeof Feather.glyphMap,
  },
  {
    role: 'Coach',
    permissions: [
      'Manage roster',
      'Create team events',
      'Edit settings',
      'Accept requests',
      'Leave coach notes',
    ],
    colors: ['#22c55e', '#10b981'],
    icon: 'zap' as keyof typeof Feather.glyphMap,
  },
  {
    role: 'Player',
    permissions: [
      'View calendar',
      'Chat',
      'Log results',
      'Access training',
    ],
    colors: ['#3b82f6', '#06b6d4'],
    icon: 'user' as keyof typeof Feather.glyphMap,
  },
  {
    role: 'Family',
    permissions: [
      'View calendar',
      'View family stats',
      'Log family matches',
      'View child broadcasts',
      'Chat',
    ],
    colors: ['#22c55e', '#14b8a6'],
    icon: 'users' as keyof typeof Feather.glyphMap,
  },
  {
    role: 'Spectator',
    permissions: [
      'View calendar',
      'Watch broadcasted matches',
    ],
    colors: ['#6b7280', '#374151'],
    icon: 'eye' as keyof typeof Feather.glyphMap,
  },
];

export default function TeamSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ teamId: string }>();
  const teamId = params.teamId;
  const { refresh } = useTeams();
  const { user } = useAuth();
  const [tab, setTab] = useState<'general' | 'roles'>('general');
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [requestToJoin, setRequestToJoin] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [teamImageUrl, setTeamImageUrl] = useState<string | null>(null);
  const [iconColorStart, setIconColorStart] = useState<string>('#3b82f6');
  const [iconColorEnd, setIconColorEnd] = useState<string>('#06b6d4');

  const gradientOptions = [
    { name: 'Blue', start: '#3b82f6', end: '#06b6d4' },
    { name: 'Green', start: '#22c55e', end: '#10b981' },
    { name: 'Purple', start: '#a855f7', end: '#8b5cf6' },
    { name: 'Pink', start: '#ec4899', end: '#db2777' },
    { name: 'Red', start: '#ef4444', end: '#dc2626' },
    { name: 'Orange', start: '#f97316', end: '#ea580c' },
    { name: 'Amber', start: '#f59e0b', end: '#d97706' },
    { name: 'Indigo', start: '#6366f1', end: '#4f46e5' },
    { name: 'Teal', start: '#14b8a6', end: '#0d9488' },
    { name: 'Rose', start: '#f43f5e', end: '#e11d48' },
    { name: 'Cyan', start: '#06b6d4', end: '#0891b2' },
    { name: 'Emerald', start: '#10b981', end: '#059669' },
  ];

  useEffect(() => {
    if (!teamId || !user) return;

    setLoadingTeam(true);
    setLoadingMembers(true);

    const fetchTeamData = getTeam(teamId);
    const fetchMembers = listMembers(teamId);

    Promise.all([fetchTeamData, fetchMembers])
      .then(([teamData, memberData]) => {
        setName(teamData.name);
        setDescription(teamData.description || '');
        setAccessCode(teamData.accessCode || '');
        setVisibility(teamData.visibility);
        setRequestToJoin(!!teamData.requestToJoin);
        setTeamImageUrl((teamData as any).imageUrl || null);
        setIconColorStart((teamData as any).iconColorStart || '#3b82f6');
        setIconColorEnd((teamData as any).iconColorEnd || '#06b6d4');
        setMembers(memberData);
      })
      .catch((e: any) => {
        Alert.alert('Error', e.message || 'Failed to load team data');
      })
      .finally(() => {
        setLoadingTeam(false);
        setLoadingMembers(false);
      });
  }, [teamId, user]);

  const handleImageUpload = async (blob: Blob) => {
    if (!teamId) return;
    try {
      const url = await uploadTeamImage(teamId, blob);
      setTeamImageUrl(url);
      await refresh();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to upload image');
    }
  };

  const handleImageRemove = async () => {
    if (!teamId) return;
    try {
      await deleteTeamImage(teamId);
      setTeamImageUrl(null);
      await refresh();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to remove image');
    }
  };

  const handleSave = async () => {
    if (!teamId) return;
    const trimmedName = name.trim();
    if (nameError || descriptionError) return;
    if (trimmedName.length > 25) {
      setNameError('Name cannot exceed 25 characters');
      setSaving(false);
      return;
    }
    setSaving(true);
    try {
      hapticMedium();
      await updateTeam(
        teamId,
        trimmedName,
        description.trim(),
        visibility,
        accessCode || undefined,
        requestToJoin,
        iconColorStart,
        iconColorEnd
      );
      refresh();
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleChat = async (memberId: string, currentStatus: boolean) => {
    if (!teamId) return;
    setMembers(prevMembers =>
      prevMembers.map(m =>
        m.id === memberId ? { ...m, chatEnabled: !currentStatus } : m
      )
    );

    try {
      hapticLight();
      await updateMemberRole(teamId, memberId, { chatEnabled: !currentStatus });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update chat setting');
      setMembers(prevMembers =>
        prevMembers.map(m =>
          m.id === memberId ? { ...m, chatEnabled: currentStatus } : m
        )
      );
    }
  };

  const confirmDelete = async () => {
    if (!teamId) return;
    hapticMedium();
    await deleteTeam(teamId);
    refresh();
    // Navigate to main teams page
    router.replace('/(tabs)/team');
  };

  const handleDeleteTeam = () => {
    hapticLight();
    Alert.alert(
      'Delete Team',
      'Are you sure you want to delete this team? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await confirmDelete();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete team');
            }
          },
        },
      ]
    );
  };

  const confirmLeave = async () => {
    if (!teamId) return;
    hapticMedium();
    await leaveTeam(teamId);
    refresh();
    // Navigate to main teams page
    router.replace('/(tabs)/team');
  };

  const handleLeaveTeam = () => {
    hapticLight();
    Alert.alert(
      'Leave Team',
      'Are you sure you want to leave this team?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await confirmLeave();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to leave team');
            }
          },
        },
      ]
    );
  };

  const currentUser = members.find(m => m.id === user?.id);
  const isOwner = currentUser?.role === 'Owner';
  const canManageTeam = isOwner || currentUser?.role === 'Coach';

  const rolesDataWithCounts = rolesData.map(rd => ({
    ...rd,
    count: members.filter(m => m.role === rd.role).length,
  }));

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Team Settings
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

      <View style={{ paddingTop: insets.top + 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 8 }}>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setTab('general');
            }}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: tab === 'general' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 16, color: tab === 'general' ? '#ffffff' : '#9ca3af', fontWeight: tab === 'general' ? '500' : '400' }}>
              General
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setTab('roles');
            }}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: tab === 'roles' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            }}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 16, color: tab === 'roles' ? '#ffffff' : '#9ca3af', fontWeight: tab === 'roles' ? '500' : '400' }}>
              Roles & Permissions
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingTop: 24,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {tab === 'general' ? (
          loadingTeam ? (
            <View style={{ gap: 16 }}>
              <Skeleton style={{ height: 40, width: '100%', borderRadius: 8, marginBottom: 16 }} />
              <Skeleton style={{ height: 80, width: '100%', borderRadius: 8, marginBottom: 16 }} />
              <Skeleton style={{ height: 40, width: '100%', borderRadius: 8 }} />
            </View>
          ) : (
            <View style={{ maxWidth: 768, alignSelf: 'center', width: '100%', gap: 24, position: 'relative' }}>
              {canManageTeam && (
                <View style={{ position: 'absolute', top: 0, right: 0, zIndex: 10 }}>
                  <GradientColorPicker
                    trigger={
                      <TouchableOpacity
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: 'rgba(0, 0, 0, 0.6)',
                          borderWidth: 2,
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        activeOpacity={0.7}
                      >
                        <LinearGradient
                          colors={[iconColorStart, iconColorEnd]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 14,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Feather name="droplet" size={16} color="#ffffff" />
                        </LinearGradient>
                      </TouchableOpacity>
                    }
                    gradients={gradientOptions}
                    selectedStart={iconColorStart}
                    selectedEnd={iconColorEnd}
                    onSelect={(start, end) => {
                      setIconColorStart(start);
                      setIconColorEnd(end);
                    }}
                  />
                </View>
              )}

              <View style={{ alignItems: 'center', marginBottom: 12, paddingTop: 8 }}>
                <TeamImageUpload
                  currentImageUrl={teamImageUrl}
                  onImageSelect={handleImageUpload}
                  onImageRemove={handleImageRemove}
                  disabled={!canManageTeam}
                  iconColorStart={iconColorStart}
                  iconColorEnd={iconColorEnd}
                />
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#d1d5db' }}>Team Name</Text>
                <TextInput
                  value={name.length > 25 ? name.slice(0, 25) : name}
                  onChangeText={(val) => {
                    const cleanVal = val.replace(/\r?\n/g, '');
                    const limitedVal = cleanVal.length > 25 ? cleanVal.slice(0, 25) : cleanVal;
                    setName(limitedVal);

                    const trimmedVal = limitedVal.trim();
                    if (trimmedVal.length > 25) {
                      setNameError('Name cannot exceed 25 characters');
                    } else if (limitedVal.length === 25 && trimmedVal.length < 25) {
                      setNameError('Name cannot exceed 25 characters');
                    } else {
                      setNameError(null);
                    }
                  }}
                  maxLength={25}
                  style={{
                    width: '100%',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    fontSize: 16,
                    minHeight: 44,
                  }}
                  placeholderTextColor="#6b7280"
                  editable={canManageTeam}
                />
                {nameError && <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{nameError}</Text>}
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#d1d5db' }}>Description</Text>
                <TextInput
                  value={description}
                  onChangeText={(val) => {
                    const cleanVal = val.replace(/\r?\n/g, '');
                    if (cleanVal.length > 150) {
                      setDescription(cleanVal.slice(0, 150));
                      setDescriptionError('Description cannot exceed 150 characters');
                    } else {
                      setDescription(cleanVal);
                      setDescriptionError(null);
                    }
                  }}
                  maxLength={150}
                  style={{
                    width: '100%',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    fontSize: 16,
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor="#6b7280"
                  editable={canManageTeam}
                />
                {descriptionError && <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>{descriptionError}</Text>}
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#d1d5db' }}>Access Code (optional)</Text>
                <TextInput
                  value={accessCode}
                  onChangeText={setAccessCode}
                  style={{
                    width: '100%',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 8,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    fontSize: 16,
                    minHeight: 44,
                  }}
                  placeholderTextColor="#6b7280"
                  editable={canManageTeam}
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <Switch
                  value={requestToJoin}
                  onValueChange={setRequestToJoin}
                  disabled={!canManageTeam}
                  trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: '#3b82f6' }}
                  thumbColor="#ffffff"
                />
                <Text style={{ fontSize: 14, color: '#ffffff' }}>Request to join</Text>
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#d1d5db' }}>Visibility</Text>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  {(['public', 'private'] as const).map(v => (
                    <TouchableOpacity
                      key={v}
                      onPress={() => {
                        hapticLight();
                        setVisibility(v);
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: visibility === v ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                        backgroundColor: visibility === v ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                      }}
                      activeOpacity={0.7}
                      disabled={!canManageTeam}
                    >
                      <Text style={{ fontSize: 16, color: visibility === v ? '#ffffff' : '#9ca3af', fontWeight: visibility === v ? '500' : '400' }}>
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 24, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
                <TouchableOpacity
                  onPress={isOwner ? handleDeleteTeam : handleLeaveTeam}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.5)' }}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={isOwner ? 'trash-2' : 'log-out'}
                    size={16}
                    color="#ef4444"
                  />
                  <Text style={{ fontSize: 14, color: '#ef4444' }}>
                    {isOwner ? 'Delete Team' : 'Leave Team'}
                  </Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <TouchableOpacity
                    onPress={() => router.back()}
                    disabled={saving}
                    style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 16, color: '#9ca3af' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving || !!nameError || !!descriptionError}
                    style={{ borderRadius: 8, overflow: 'hidden', minHeight: 44, opacity: (saving || !!nameError || !!descriptionError) ? 0.5 : 1 }}
                    activeOpacity={0.7}
                  >
                    {saving ? (
                      <View style={{ paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }}>
                        <ActivityIndicator size="small" color="#ffffff" />
                      </View>
                    ) : (
                      <LinearGradient
                        colors={['#3b82f6', '#06b6d4']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12 }}
                      >
                        <Feather name="save" size={16} color="#ffffff" />
                        <Text style={{ fontSize: 16, fontWeight: '500', color: '#ffffff' }}>Save</Text>
                      </LinearGradient>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )
        ) : (
          <View style={{ gap: 32 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 16, paddingBottom: 8 }}
            >
              {loadingMembers
                ? Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} style={{ width: 200, height: 192, borderRadius: 12, marginRight: 16 }} />
                ))
                : rolesDataWithCounts.map(rd => (
                  <View key={rd.role} style={{ width: 200, padding: 24, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                      <LinearGradient
                        colors={rd.colors as [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Feather name={rd.icon} size={28} color="#ffffff" />
                      </LinearGradient>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 4 }}>{rd.role}</Text>
                        <Text style={{ fontSize: 14, color: '#9ca3af' }}>
                          {rd.count} member{rd.count !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#9ca3af', marginBottom: 8 }}>Permissions:</Text>
                    <View style={{ gap: 8 }}>
                      {rd.permissions.map(p => (
                        <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' }} />
                          <Text style={{ fontSize: 14, color: '#d1d5db' }}>{p}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
            </ScrollView>

            <View style={{ gap: 16, paddingTop: 32, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.1)' }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#ffffff' }}>Manage Chat Settings</Text>
              <View style={{ gap: 16 }}>
                {loadingMembers
                  ? Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} style={{ height: 64, width: '100%', borderRadius: 12, marginBottom: 16 }} />
                  ))
                  : members.map(member => (
                    <View key={member.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 4 }}>{member.username}</Text>
                        <Text style={{ fontSize: 14, color: '#9ca3af' }}>{member.role}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <Text style={{ fontSize: 14, color: '#d1d5db' }}>Chat</Text>
                        <Switch
                          value={member.chatEnabled}
                          onValueChange={() => handleToggleChat(member.id, member.chatEnabled)}
                          disabled={!canManageTeam}
                          trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: '#3b82f6' }}
                          thumbColor="#ffffff"
                        />
                      </View>
                    </View>
                  ))}
              </View>
            </View>
          </View>
        )}

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
