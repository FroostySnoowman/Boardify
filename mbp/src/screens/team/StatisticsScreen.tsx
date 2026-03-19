import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { listMembers, Member, getTeam, Team, updateTeamStatisticsVisibility } from '../../api/teams';
import { Skeleton } from '../../components/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { hapticLight } from '../../utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

interface StatisticsScreenProps {
  teamId?: string;
}

type StatisticsVisibility = 'coaches_only' | 'coaches_and_players' | 'everyone';

export default function StatisticsScreen({ teamId }: StatisticsScreenProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [statisticsVisibility, setStatisticsVisibility] = useState<StatisticsVisibility>('coaches_only');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    loadData();
  }, [teamId]);

  const loadData = async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const [teamData, membersData] = await Promise.all([
        getTeam(teamId),
        listMembers(teamId),
      ]);
      setTeam(teamData);
      setMembers(membersData);
      if (teamData.statisticsVisibility) {
        setStatisticsVisibility(teamData.statisticsVisibility);
      }
    } catch (err: any) {
      console.error('Failed to load statistics data:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentUserRole = members.find(m => m.id === user?.id)?.role.toLowerCase();
  const isOwner = currentUserRole === 'owner';
  const canManage = isOwner || currentUserRole === 'coach';
  const canViewStats = 
    canManage || 
    (statisticsVisibility === 'coaches_and_players' && currentUserRole === 'player') ||
    statisticsVisibility === 'everyone';

  const handleUpdateVisibility = async (visibility: StatisticsVisibility) => {
    if (!teamId) return;
    try {
      await updateTeamStatisticsVisibility(teamId, visibility);
      setStatisticsVisibility(visibility);
      hapticLight();
      setShowSettings(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update statistics visibility');
    }
  };

  const visibilityOptions: { value: StatisticsVisibility; label: string; description: string }[] = [
    { 
      value: 'coaches_only', 
      label: 'Only Coaches', 
      description: 'Only coaches and owners can view statistics' 
    },
    { 
      value: 'coaches_and_players', 
      label: 'Coaches and Players', 
      description: 'Coaches, owners, and players can view statistics' 
    },
    { 
      value: 'everyone', 
      label: 'Anyone', 
      description: 'All team members can view statistics' 
    },
  ];

  if (loading) {
    return (
      <View className="flex-1 bg-[#020617]">
        <View className="p-4 border-b border-white/5">
          <View className="flex-row items-center justify-between mb-4">
            <Skeleton className="h-6 w-24 rounded" />
            <Skeleton className="w-10 h-10 rounded-lg" />
          </View>
        </View>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-6">
            <Skeleton className="h-5 w-36 rounded mb-3" />
            <View className="p-4 rounded-lg bg-white/5 border border-white/10">
              <View className="flex-row items-center justify-between mb-3">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-6 w-12 rounded" />
              </View>
              <View className="flex-row items-center justify-between mb-3">
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-6 w-12 rounded" />
              </View>
              <View className="flex-row items-center justify-between">
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-6 w-12 rounded" />
              </View>
            </View>
          </View>
          <View>
            <Skeleton className="h-5 w-36 rounded mb-3" />
            <View className="gap-3">
              {[1, 2, 3].map((i) => (
                <View key={i} className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <Skeleton className="h-4 w-32 rounded mb-3" />
                  <View className="gap-2">
                    <View className="flex-row items-center justify-between">
                      <Skeleton className="h-3 w-28 rounded" />
                      <Skeleton className="h-3 w-8 rounded" />
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Skeleton className="h-3 w-20 rounded" />
                      <Skeleton className="h-3 w-10 rounded" />
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Skeleton className="h-3 w-24 rounded" />
                      <Skeleton className="h-3 w-8 rounded" />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (!canViewStats) {
    return (
      <View className="flex-1 bg-[#020617] items-center justify-center p-4">
        <Feather name="lock" size={48} color="#9ca3af" />
        <Text className="text-gray-400 mt-4 text-center">
          Statistics are only visible to coaches
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 flex-col" style={{ backgroundColor: '#020617' }}>
      {/* Header */}
      <View className="p-4 border-b border-white/5">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-lg font-semibold text-white">Statistics</Text>
          {canManage && (
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setShowSettings(!showSettings);
              }}
              className="p-2 rounded-lg bg-white/10"
            >
              <Feather name="settings" size={20} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
        
        {showSettings && canManage && (
          <View className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
            <Text className="text-sm font-medium text-white mb-3">Statistics Visibility</Text>
            <View className="gap-2">
              {visibilityOptions.map(option => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => handleUpdateVisibility(option.value)}
                  className={`p-3 rounded-lg border ${
                    statisticsVisibility === option.value
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-white/10 bg-white/5'
                  }`}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center gap-3 mb-1">
                    <View className={`w-4 h-4 rounded-full border-2 items-center justify-center ${
                      statisticsVisibility === option.value
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-white/30'
                    }`}>
                      {statisticsVisibility === option.value && (
                        <Feather name="check" size={10} color="#ffffff" />
                      )}
                    </View>
                    <Text className={`font-medium ${
                      statisticsVisibility === option.value ? 'text-white' : 'text-gray-300'
                    }`}>
                      {option.label}
                    </Text>
                  </View>
                  <Text className="text-xs text-gray-400 ml-7">
                    {option.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Statistics Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Team Statistics */}
        <View className="mb-6">
          <Text className="text-base font-semibold text-white mb-3">Team Statistics</Text>
          <View className="p-4 rounded-lg bg-white/5 border border-white/10">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm text-gray-400">Total Matches</Text>
              <Text className="text-lg font-bold text-white">0</Text>
            </View>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm text-gray-400">Wins</Text>
              <Text className="text-lg font-bold text-green-400">0</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-gray-400">Losses</Text>
              <Text className="text-lg font-bold text-red-400">0</Text>
            </View>
          </View>
        </View>

        {/* Player Statistics */}
        <View>
          <Text className="text-base font-semibold text-white mb-3">Player Statistics</Text>
          <View className="gap-3">
            {members.filter(m => m.role.toLowerCase() === 'player').map(player => (
              <View key={player.id} className="p-4 rounded-lg bg-white/5 border border-white/10">
                <Text className="text-white font-medium mb-3">{player.username}</Text>
                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-gray-400">Matches Played</Text>
                    <Text className="text-sm font-medium text-white">0</Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-gray-400">Win Rate</Text>
                    <Text className="text-sm font-medium text-white">0%</Text>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm text-gray-400">Total Points</Text>
                    <Text className="text-sm font-medium text-white">0</Text>
                  </View>
                </View>
              </View>
            ))}
            {members.filter(m => m.role.toLowerCase() === 'player').length === 0 && (
              <View className="p-8 items-center">
                <Feather name="user" size={32} color="#9ca3af" />
                <Text className="text-gray-400 mt-2">No players found</Text>
              </View>
            )}
          </View>
        </View>
        
        <KeyboardSpacer extraOffset={72} />
      </ScrollView>
    </View>
  );
}
