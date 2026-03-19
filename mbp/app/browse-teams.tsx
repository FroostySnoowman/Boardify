import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Stack, router, useFocusEffect } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { listPublicTeams, joinTeam, createJoinRequest, Team } from '../src/api/teams';
import { useTeams } from '../src/contexts/TeamsContext';
import { Avatar } from '../src/components/Avatar';
import { Skeleton } from '../src/components/Skeleton';
import { hapticLight, hapticMedium } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { ContextMenu } from '../src/components/ContextMenu';
import { PlatformBottomSheet } from '../src/components/PlatformBottomSheet';

const BACKGROUND_COLOR = '#020617';

type FilterType = 'all' | 'public' | 'request-required';

export default function BrowseTeamsScreen() {
  const insets = useSafeAreaInsets();
  const { teams: myTeams, refresh } = useTeams();
  const [publicTeams, setPublicTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [teamToJoin, setTeamToJoin] = useState<Team | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => {};
    }, [refresh])
  );

  useEffect(() => {
    setLoading(true);
    listPublicTeams()
      .then(setPublicTeams)
      .catch((err) => {
        console.error('Failed to load teams:', err);
        Alert.alert('Error', 'Failed to load teams. Please try again.');
      })
      .finally(() => setLoading(false));
  }, []);

  const teams = useMemo(() => {
    const byId = new Map(publicTeams.map((t) => [t.id, t]));
    myTeams.forEach((t) => {
      if (!byId.has(t.id)) byId.set(t.id, t);
    });
    return Array.from(byId.values());
  }, [publicTeams, myTeams]);

  const formatLabel = (val: string, labels?: Record<string, string>) => {
    if (labels && labels[val]) return labels[val];
    return val;
  };

  const createContextMenuOptions = (
    options: string[],
    currentValue: string,
    onValueChange: (value: any) => void,
    labels?: Record<string, string>
  ) => {
    return options.map(opt => ({
      label: formatLabel(opt, labels),
      value: opt,
      onPress: () => onValueChange(opt),
    }));
  };

  const joinedTeamIds = useMemo(() => new Set(myTeams.map(t => t.id)), [myTeams]);

  const filteredTeams = useMemo(() => teams.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    if (!matchesSearch) return false;
    switch (filter) {
      case 'public':
        return t.visibility === 'public' && !t.accessCode;
      case 'request-required':
        return t.requestToJoin === true;
      default:
        return true;
    }
  }), [teams, searchTerm, filter]);

  const isJoined = (teamId: string) => joinedTeamIds.has(teamId);

  const handleJoin = async (t: Team) => {
    hapticLight();
    setTeamToJoin(t);
    if (t.accessCode) {
      router.push({
        pathname: '/access-code',
        params: {
          teamId: t.id,
          teamName: encodeURIComponent(t.name),
          requestToJoin: t.requestToJoin ? 'true' : 'false',
        },
      });
    } else if (t.requestToJoin) {
      setRequestError(null);
      setRequestSuccess(false);
      setShowRequestModal(true);
    } else {
      setJoining(t.id);
      try {
        await joinTeam(t.id);
        hapticMedium();
        await refresh();
        router.back();
      } catch (e: any) {
        Alert.alert('Error', e.message || 'Failed to join team');
      } finally {
        setJoining(null);
      }
    }
  };

  const handleRequest = async () => {
    if (!teamToJoin) return;
    setRequestError(null);
    setJoining(teamToJoin.id);
    try {
      await createJoinRequest(teamToJoin.id);
      hapticMedium();
      await refresh();
      setRequestSuccess(true);
      setTimeout(() => {
        cancelRequestModal();
        router.back();
      }, 2000);
    } catch (e: any) {
      setRequestError(e.message || 'Failed to send request');
    } finally {
      setJoining(null);
    }
  };

  const cancelRequestModal = () => {
    hapticLight();
    setShowRequestModal(false);
    setTeamToJoin(null);
    setRequestError(null);
    setRequestSuccess(false);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Browse Teams
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
              <View className="gap-y-6">
                <View className="flex-row items-center">
                  <Feather name="users" size={24} color="#60a5fa" style={{ marginRight: 12 }} />
                  <Text className="text-2xl font-bold text-white">Public Teams</Text>
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
                    placeholder="Search teams..."
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
                  />
                </View>

                <View>
                  <Text className="text-gray-300 font-medium text-lg mb-2">Filter</Text>
                  <ContextMenu
                    options={createContextMenuOptions(['all', 'public', 'request-required'], filter, setFilter, {
                      'all': 'All Teams',
                      'public': 'Public Teams',
                      'request-required': 'Request Required',
                    })}
                    trigger={
                      <TouchableOpacity
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          minHeight: 44,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ color: '#ffffff', fontSize: 16 }}>
                          {formatLabel(filter, {
                            'all': 'All Teams',
                            'public': 'Public Teams',
                            'request-required': 'Request Required',
                          })}
                        </Text>
                        <Feather name="chevron-down" size={20} color="#9ca3af" />
                      </TouchableOpacity>
                    }
                  />
                </View>

                {loading ? (
                  <View style={{ gap: 12 }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-xl" />
                    ))}
                  </View>
                ) : filteredTeams.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                    <View style={{ 
                      width: 64, 
                      height: 64, 
                      borderRadius: 32, 
                      backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}>
                      <Feather name="search" size={32} color="#9ca3af" />
                    </View>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#d1d5db', marginBottom: 8 }}>
                      No teams found
                    </Text>
                    <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
                      Try a different search term or create a new team.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    {filteredTeams.map(t => (
                      <View 
                        key={t.id} 
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          padding: 16,
                          borderRadius: 12,
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                      >
                        <Avatar src={t.imageUrl} alt={t.name} size="md" iconColorStart={t.iconColorStart} iconColorEnd={t.iconColorEnd} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text 
                            style={{ 
                              fontSize: 16, 
                              fontWeight: '600', 
                              color: '#ffffff', 
                              marginBottom: 4,
                            }} 
                            numberOfLines={1}
                          >
                            {t.name}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Feather name="users" size={14} color="#9ca3af" />
                            <Text style={{ fontSize: 14, color: '#9ca3af' }}>
                              {t.memberCount} {t.memberCount === 1 ? 'Member' : 'Members'}
                            </Text>
                          </View>
                        </View>
                        {isJoined(t.id) ? (
                          <View
                            style={{
                              paddingHorizontal: 16,
                              paddingVertical: 10,
                              borderRadius: 8,
                              backgroundColor: 'rgba(34, 197, 94, 0.2)',
                              borderWidth: 1,
                              borderColor: 'rgba(34, 197, 94, 0.4)',
                              minHeight: 40,
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Feather name="check" size={16} color="#22c55e" />
                              <Text style={{ fontSize: 14, fontWeight: '600', color: '#22c55e' }}>
                                Joined
                              </Text>
                            </View>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleJoin(t)}
                            disabled={joining === t.id}
                            activeOpacity={0.7}
                            style={{
                              paddingHorizontal: 16,
                              paddingVertical: 10,
                              borderRadius: 8,
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              minHeight: 40,
                              justifyContent: 'center',
                              alignItems: 'center',
                              opacity: joining === t.id ? 0.5 : 1,
                            }}
                          >
                            {joining === t.id ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>
                                {t.requestToJoin ? 'Request' : 'Join'}
                              </Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          </View>
          <KeyboardSpacer extraOffset={40} />
        </View>
      </ScrollView>

      <PlatformBottomSheet
        isOpened={showRequestModal}
        onIsOpenedChange={(opened) => { if (!opened) cancelRequestModal(); }}
        presentationDetents={[0.35]}
        presentationDragIndicator="visible"
      >
        <View style={{ padding: 24, gap: 20, alignItems: 'center' }}>
          {requestSuccess ? (
            <>
              <View style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Feather name="check" size={28} color="#22c55e" />
              </View>
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff', textAlign: 'center' }}>
                  Request Sent
                </Text>
                <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center' }}>
                  The team captain will review your request to join "{teamToJoin?.name}".
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                backgroundColor: 'rgba(96, 165, 250, 0.12)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Feather name="user-plus" size={26} color="#60a5fa" />
              </View>
              <View style={{ alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff', textAlign: 'center' }}>
                  Request to Join
                </Text>
                <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center' }}>
                  Your request to join "{teamToJoin?.name}" will be sent to the team captain for approval.
                </Text>
              </View>
              {requestError && (
                <Text style={{ fontSize: 13, color: '#ef4444', textAlign: 'center' }}>
                  {requestError}
                </Text>
              )}
              <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                <TouchableOpacity
                  onPress={cancelRequestModal}
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
                  onPress={handleRequest}
                  disabled={joining === teamToJoin?.id}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    gap: 8,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: '#3b82f6',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 50,
                    opacity: joining === teamToJoin?.id ? 0.6 : 1,
                  }}
                  activeOpacity={0.7}
                >
                  {joining === teamToJoin?.id ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Feather name="send" size={16} color="#ffffff" />
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>Send Request</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </PlatformBottomSheet>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
});
