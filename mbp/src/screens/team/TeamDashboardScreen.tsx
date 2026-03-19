import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTeams } from '../../contexts/TeamsContext';
import { useNetwork } from '../../contexts/NetworkContext';
import { Skeleton } from '../../components/Skeleton';
import { Avatar } from '../../components/Avatar';
import { ContextMenu } from '../../components/ContextMenu';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import TeamLayout, { useTeamLayout } from './TeamLayout';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { leaveTeam, deleteTeam } from '../../api/teams';
import { TAB_HEADER_HEIGHT } from '../../config/layout';

export default function TeamDashboardScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  
  useEffect(() => {
    const teamId = (route.params as any)?.teamId;
    const convId = (route.params as any)?.convId;
    const conversationName = (route.params as any)?.conversationName;
    
    if (teamId) {
      setTimeout(() => {
        (navigation as any).navigate('TeamDetail', {
          teamId,
          convId,
          conversationName,
        });
      }, 200);
    }
  }, [route.params, navigation]);

  return (
    <TeamLayout hideFloatingHamburger={true}>
      <TeamDashboardContent />
    </TeamLayout>
  );
}

const SEARCH_AREA_HEIGHT = 72;

function TeamDashboardContent() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { teams, loading: teamsLoading, refresh } = useTeams();
  const { isOnline } = useNetwork();
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { openSidebar, navOpen } = useTeamLayout();
  const scrollRef = useRef<ScrollView>(null);
  const hasInitiallyScrolled = useRef(false);
  const navPressInProgress = useRef(false);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);

  useEffect(() => {
    if (scrollViewHeight > 0 && !hasInitiallyScrolled.current) {
      hasInitiallyScrolled.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ y: SEARCH_AREA_HEIGHT, animated: false });
        });
      });
    }
  }, [scrollViewHeight]);

  const onRefresh = async () => {
    setRefreshing(true);
    hapticLight();
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const loading = teamsLoading;
  const filteredTeams = useMemo(
    () =>
      teams.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          (t.description?.toLowerCase().includes(search.toLowerCase()) ?? false)
      ),
    [teams, search]
  );

  const isOwner = (t: (typeof teams)[0]) => (t.role?.toLowerCase() ?? '') === 'owner';

  const confirmLeaveTeam = (teamId: string) => {
    Alert.alert(
      'Leave team',
      'Are you sure you want to leave this team? You can rejoin later if the team is public or you have an invite.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticMedium();
              await leaveTeam(teamId);
              refresh();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to leave team');
            }
          },
        },
      ]
    );
  };

  const confirmDeleteTeam = (t: (typeof teams)[0]) => {
    Alert.alert(
      'Delete Team',
      'Are you sure you want to delete this team? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              hapticMedium();
              await deleteTeam(t.id);
              refresh();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete team');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#020617' }}>
      <View
        style={{
          height: TAB_HEADER_HEIGHT,
          backgroundColor: '#020617',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.05)',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 24,
          paddingTop: 2,
          paddingBottom: 2,
        }}
      >
        {!navOpen && (
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              openSidebar();
            }}
            className="p-2 rounded-lg"
          >
            <Feather name="menu" size={24} color="#ffffff" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            if (navPressInProgress.current) return;
            navPressInProgress.current = true;
            router.push('/browse-teams');
            setTimeout(() => { navPressInProgress.current = false; }, 500);
          }}
          className="flex-1 px-5 py-2.5 rounded-lg bg-white/10 min-h-[44px] flex-row items-center justify-center gap-2"
        >
          <Feather name="users" size={16} color="#ffffff" />
          <Text className="text-sm font-semibold text-white">Browse Teams</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            router.push('/create-team');
          }}
          activeOpacity={0.9}
          style={{ overflow: 'hidden', borderRadius: 9999 }}
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
            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>New Team</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 24,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 24,
          minHeight: (scrollViewHeight || 2000) + SEARCH_AREA_HEIGHT,
        }}
        contentOffset={{ x: 0, y: SEARCH_AREA_HEIGHT }}
        onLayout={(e) => {
          if (scrollViewHeight === 0) {
            setScrollViewHeight(e.nativeEvent.layout.height);
          }
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#60a5fa"
            colors={['#60a5fa']}
            progressViewOffset={TAB_HEADER_HEIGHT}
          />
        }
      >
        <View className="relative mb-6">
          <Feather name="search" size={20} color="#9ca3af" className="absolute left-4" style={{ top: '50%', transform: [{ translateY: -10 }] }} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search your teams..."
            placeholderTextColor="#6b7280"
            className="w-full pl-12 pr-4 py-3.5 rounded-lg bg-white/5 border border-white/10 text-white min-h-[48px]"
          />
        </View>

        {!isOnline ? (
          <View className="flex-col items-center justify-center py-24 px-4">
            <View className="w-20 h-20 bg-white/5 rounded-full items-center justify-center mb-6">
              <Feather name="wifi-off" size={40} color="#9ca3af" />
            </View>
            <Text className="text-xl font-semibold text-gray-300 mb-3">You're offline</Text>
            <Text className="text-sm text-gray-500 mb-8 text-center max-w-md">
              Connect to internet to view your teams
            </Text>
          </View>
        ) : loading ? (
          <View className="flex-col gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </View>
        ) : filteredTeams.length === 0 ? (
          <View className="flex-col items-center justify-center py-24 px-4">
            <View className="w-20 h-20 bg-white/5 rounded-full items-center justify-center mb-6">
              <Feather name="users" size={40} color="#9ca3af" />
            </View>
            <Text className="text-xl font-semibold text-gray-300 mb-3">No teams found</Text>
            <Text className="text-sm text-gray-500 mb-8 text-center max-w-md">
              {search ? 'Try a different search term' : 'Create your first team to get started'}
            </Text>
            {!search && (
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  router.push('/create-team');
                }}
                activeOpacity={0.9}
                style={{ overflow: 'hidden', borderRadius: 8 }}
              >
                <LinearGradient
                  colors={['#3b82f6', '#06b6d4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 32,
                    paddingVertical: 16,
                    minHeight: 52,
                  }}
                >
                  <Feather name="plus" size={20} color="#ffffff" />
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Create Your First Team</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className="flex-col gap-4">
            {filteredTeams.map((t) => {
              const teamCard = (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => {
                    hapticLight();
                    (navigation as any).navigate('TeamDetail', { teamId: t.id });
                  }}
                  activeOpacity={0.9}
                  className="flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-5 w-full"
                  style={{ minHeight: 140 }}
                >
                  <View className="flex-row items-start gap-4">
                    <Avatar src={t.imageUrl} alt={t.name} size="lg" iconColorStart={t.iconColorStart} iconColorEnd={t.iconColorEnd} />
                    <View className="flex-1">
                      <Text
                        className="text-lg font-semibold text-white mb-1"
                        style={{ minHeight: 24 }}
                      >
                        {t.name}
                      </Text>
                      {t.description ? (
                        <Text
                          className="text-sm text-gray-400"
                          style={{ minHeight: 36 }}
                        >
                          {t.description}
                        </Text>
                      ) : (
                        <View style={{ minHeight: 36 }} />
                      )}
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between pt-3 border-t border-white/5">
                    <View className="flex-row items-center gap-2">
                      <Feather name="users" size={16} color="#9ca3af" />
                      <Text className="text-sm text-gray-400">
                        {t.memberCount} member{t.memberCount !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Feather name="trending-up" size={16} color="#9ca3af" />
                  </View>
                </TouchableOpacity>
              );
              return (
                <ContextMenu
                  key={t.id}
                  activationMethod="longPress"
                  onSinglePress={() => {
                    hapticLight();
                    (navigation as any).navigate('TeamDetail', { teamId: t.id });
                  }}
                  trigger={teamCard}
                  options={[
                    { label: 'Open', value: 'open', onPress: () => (navigation as any).navigate('TeamDetail', { teamId: t.id }) },
                    { label: 'Edit Team', value: 'edit', onPress: () => router.push({ pathname: '/team-settings', params: { teamId: t.id } }) },
                    ...(isOwner(t)
                      ? [{ label: 'Delete Team', value: 'delete', onPress: () => confirmDeleteTeam(t) }]
                      : [{ label: 'Leave Team', value: 'leave', onPress: () => confirmLeaveTeam(t.id) }]),
                  ]}
                />
              );
            })}
          </View>
        )}
        <KeyboardSpacer extraOffset={72} />
      </ScrollView>
    </View>
  );
}
