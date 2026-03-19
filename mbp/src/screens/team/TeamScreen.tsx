import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getTeam, listMembers, Team, Member } from '../../api/teams';
import { listConversations, Conversation } from '../../api/messages';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../contexts/AuthContext';
import { hapticLight } from '../../utils/haptics';
import ChatScreen from './ChatScreen';
import RosterScreen from './RosterScreen';
import TeamCalendarScreen from './TeamCalendarScreen';
import StatisticsScreen from './StatisticsScreen';
import TeamLayout, { useTeamLayout } from './TeamLayout';
import TeamContextBar, { ContextSection } from './components/TeamContextBar';
import { Skeleton } from '../../components/Skeleton';
import { TAB_HEADER_HEIGHT } from '../../config/layout';

type ScreenType = 'chat' | 'calendar' | 'roster' | 'statistics';

function TeamScreenContent({ currentScreen, onScreenChange }: { currentScreen: ScreenType; onScreenChange: (screen: ContextSection) => void }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { navOpen, openSidebar } = useTeamLayout();
  const teamId = (route.params as any)?.teamId;

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const loadTeam = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const [t, ms, convs] = await Promise.all([
        getTeam(teamId),
        listMembers(teamId),
        listConversations(teamId),
      ]);
      setTeam(t);
      setMembers(ms);
      setConversations(convs.filter(c => c.type === 'group').sort((a, b) => 
        new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      ));
    } catch (e: any) {
      console.error('Failed to load team:', e);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const currentUserRole = members.find((m) => m.id === user?.id)?.role.toLowerCase();
  const isOwner = currentUserRole === 'owner';
  const canManage = isOwner || currentUserRole === 'coach';

  const renderContent = () => {
    switch (currentScreen) {
      case 'chat':
        return <ChatScreen teamId={teamId} />;
      case 'calendar':
        return <TeamCalendarScreen teamId={teamId} />;
      case 'roster':
        return <RosterScreen teamId={teamId} />;
      case 'statistics':
        return <StatisticsScreen teamId={teamId} />;
      default:
        return <ChatScreen teamId={teamId} />;
    }
  };

  if (loading || !team) {
    const renderSkeletonContent = () => {
      switch (currentScreen) {
        case 'chat':
          return (
            <>
              <View className="border-b border-white/5 bg-[#020617] flex-row items-center gap-3 px-6 flex-shrink-0" style={{ height: TAB_HEADER_HEIGHT }}>
                <Skeleton className="flex-1 h-[44px] rounded-lg" />
                <Skeleton className="w-24 h-[44px] rounded-full" />
              </View>
              <View className="flex-1 p-4">
                <View className="gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <View key={i} className="flex-row items-center gap-3 p-3 rounded-lg bg-white/5 min-h-[72px]">
                      <Skeleton className="w-12 h-12 rounded-lg" />
                      <View className="flex-1 gap-2">
                        <View className="flex-row items-center justify-between">
                          <Skeleton className="h-4 w-32 rounded" />
                          <Skeleton className="h-3 w-12 rounded" />
                        </View>
                        <Skeleton className="h-3 w-48 rounded" />
                        <View className="flex-row items-center gap-3">
                          <Skeleton className="h-3 w-16 rounded" />
                          <Skeleton className="h-5 w-5 rounded-full" />
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </>
          );
        
        case 'calendar':
          return (
            <>
              <View className="border-b border-white/5 bg-[#020617] flex-row items-center gap-3 px-6 flex-shrink-0" style={{ height: TAB_HEADER_HEIGHT }}>
                <Skeleton className="w-10 h-10 rounded-lg" />
                <Skeleton className="flex-1 h-[44px] rounded-lg" />
                <Skeleton className="w-24 h-[44px] rounded-full" />
              </View>
              <View className="px-4 pt-3 pb-3">
                <Skeleton className="h-10 w-full rounded-lg" />
              </View>
              <View className="flex-1 p-4">
                <View className="gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </View>
              </View>
            </>
          );
        
        case 'roster':
          return (
            <>
              <View className="p-4 border-b border-white/5">
                <View className="flex-row items-center justify-between mb-4">
                  <Skeleton className="h-6 w-24 rounded" />
                  <Skeleton className="h-8 w-20 rounded-lg" />
                </View>
                <View className="flex-row gap-2 mb-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="flex-1 h-9 rounded-lg" />
                  ))}
                </View>
                <Skeleton className="w-full h-10 rounded-lg" />
              </View>
              <View className="flex-1 p-4">
                <View className="gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <View key={i} className="flex-row items-center gap-3 p-3 rounded-lg bg-white/5 min-h-[64px]">
                      <Skeleton className="w-12 h-12 rounded-full" />
                      <View className="flex-1 gap-2">
                        <View className="flex-row items-center gap-2">
                          <Skeleton className="h-4 w-32 rounded" />
                          <Skeleton className="w-4 h-4 rounded" />
                        </View>
                        <View className="flex-row items-center gap-2">
                          <Skeleton className="h-3 w-20 rounded" />
                          <Skeleton className="h-3 w-24 rounded" />
                        </View>
                      </View>
                      <Skeleton className="w-8 h-8 rounded-lg" />
                    </View>
                  ))}
                </View>
              </View>
            </>
          );
        
        case 'statistics':
          return (
            <>
              <View className="p-4 border-b border-white/5">
                <View className="flex-row items-center justify-between mb-4">
                  <Skeleton className="h-6 w-24 rounded" />
                  <Skeleton className="w-10 h-10 rounded-lg" />
                </View>
              </View>
              <View className="flex-1" style={{ padding: 16 }}>
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
              </View>
            </>
          );
        
        default:
          return (
            <View className="flex-1 p-4">
              <Skeleton className="h-8 w-full rounded-lg mb-4" />
              <Skeleton className="h-16 w-full rounded-lg mb-3" />
              <Skeleton className="h-16 w-full rounded-lg mb-3" />
              <Skeleton className="h-16 w-full rounded-lg mb-3" />
            </View>
          );
      }
    };

    return (
      <View className="flex-1 bg-[#020617]">
        <View className="border-b border-white/5 bg-[#020617] flex-row items-center gap-3 px-6 flex-shrink-0" style={{ height: TAB_HEADER_HEIGHT }}>
          {!navOpen && (
            <Skeleton className="w-10 h-10 rounded-lg" />
          )}
          <View className="flex-1 flex-row items-center justify-center">
            <Skeleton className="h-6 w-32 rounded" />
          </View>
          <View className="flex-row items-center gap-2">
            <Skeleton className="w-10 h-10 rounded-lg" />
            <Skeleton className="w-10 h-10 rounded-lg" />
          </View>
        </View>
        <View className="flex-row border-b border-white/5 bg-[#020617]">
          {['chat', 'calendar', 'roster', 'statistics'].map((_, i) => (
            <View key={i} className="flex-1 items-center justify-center py-3">
              <Skeleton className="h-4 w-20 rounded" />
            </View>
          ))}
        </View>
        {renderSkeletonContent()}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#020617]">
      <View className="border-b border-white/5 bg-[#020617] flex-row items-center gap-3 px-6 flex-shrink-0" style={{ height: TAB_HEADER_HEIGHT, paddingTop: 2, paddingBottom: 2 }}>
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
        <View className="flex-1 flex-row items-center justify-center relative">
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              (navigation as any).navigate('TeamDashboard');
            }}
            className="flex-row items-center"
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={20} color="#ffffff" style={{ flexShrink: 0 }} />
            <Text
              className="text-lg font-semibold text-white ml-3"
              numberOfLines={1}
              style={{ flexShrink: 1 }}
              ellipsizeMode="tail"
            >
              {team.name}
            </Text>
          </TouchableOpacity>
        </View>
        {canManage && (
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                router.push({
                  pathname: '/invite-members',
                  params: { teamId },
                });
              }}
              className="p-2 rounded-lg bg-white/10 min-w-[44px] min-h-[44px] items-center justify-center"
            >
              <Feather name="user-plus" size={20} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                router.push({
                  pathname: '/team-settings',
                  params: { teamId },
                });
              }}
              className="p-2 rounded-lg bg-white/10 min-w-[44px] min-h-[44px] items-center justify-center"
            >
              <Feather name="settings" size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
      <TeamContextBar
        activeSection={currentScreen}
        onSectionChange={onScreenChange}
        teamId={teamId}
      />
      <View className="flex-1 overflow-hidden">
        {renderContent()}
      </View>
    </View>
  );
}

export default function TeamScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const teamId = (route.params as any)?.teamId;
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('chat');

  useEffect(() => {
    const screenParam = (route.params as any)?.screen;
    if (screenParam && ['chat', 'calendar', 'roster', 'statistics'].includes(screenParam)) {
      setCurrentScreen(screenParam as ScreenType);
    }
  }, [route.params]);

  useEffect(() => {
    const convId = (route.params as any)?.convId;
    const conversationName = (route.params as any)?.conversationName;
    if (convId && teamId) {
      setCurrentScreen('chat');
      const timeoutId = setTimeout(() => {
        try {
          (navigation as any).navigate('ChatRoom', {
            teamId,
            convId,
            conversationName: conversationName || 'general',
          });
        } catch (err) {
          console.error('Failed to navigate to ChatRoom:', err);
        }
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [route.params, teamId, navigation]);

  const handleScreenChange = (screen: ContextSection) => {
    hapticLight();
    setCurrentScreen(screen);
  };

  return (
    <TeamLayout onScreenChange={handleScreenChange} currentScreen={currentScreen} hideFloatingHamburger={true}>
      <TeamScreenContent currentScreen={currentScreen} onScreenChange={handleScreenChange} />
    </TeamLayout>
  );
}