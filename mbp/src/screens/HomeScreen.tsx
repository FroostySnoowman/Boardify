import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, ActivityIndicator, RefreshControl, Platform, Animated, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useNetwork } from '../contexts/NetworkContext';
import { listAllEvents } from '../api/calendar';
import { listMatchHistory, listNotes, MatchHistoryItem, Note } from '../api/matches';
import { getRecentConversations, Conversation, starConversation, unstarConversation } from '../api/messages';
import { hapticLight } from '../utils/haptics';
import { parseLocalDateTime, parseLocalDate, formatTimeForDisplay } from '../utils/dateUtils';
import { ContextMenu } from '../components/ContextMenu';
import { Skeleton } from '../components/Skeleton';
import { Avatar } from '../components/Avatar';
import { GuestMatchWarning } from '../components/GuestMatchWarning';
import { IPAD_TAB_CONTENT_TOP_PADDING } from '../config/layout';
import { useChatAccess } from '../components/ChatAccessGate';
import { useChatBlockedModal } from '../contexts/ChatBlockedModalContext';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

type RecentActivityItem = {
  id: string;
  type: 'match' | 'note';
  title: string;
  subtitle: string;
  date: Date;
  matchId?: string;
  noteId?: number;
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();
  const { isOnline } = useNetwork();
  const router = useRouter();
  const { plusWelcome } = useLocalSearchParams<{ plusWelcome?: string | string[] }>();
  const { canChat, reason } = useChatAccess();
  const { showChatBlocked } = useChatBlockedModal();
  const [upcomingEvents, setUpcomingEvents] = useState<{ id: number; title: string; time: string; location?: string; originalDate?: string; originalTime?: string; type?: string }[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [loadingRecentActivity, setLoadingRecentActivity] = useState(true);
  const [recentMessages, setRecentMessages] = useState<(Conversation & { teamId: string; teamName?: string; teamImageUrl?: string | null })[]>([]);
  const [loadingRecentMessages, setLoadingRecentMessages] = useState(true);
  const [quickStats, setQuickStats] = useState<{ totalMatches: number; wins: number; losses: number; winRate: number; currentStreak: number; streakType: 'win' | 'loss' } | null>(null);
  const [loadingQuickStats, setLoadingQuickStats] = useState(true);
  const [statsPeriod, setStatsPeriod] = useState<'month' | 'season' | 'year' | 'ytd' | 'all'>('all');
  const [todaysEvent, setTodaysEvent] = useState<{ id: number; title: string; time: string; location?: string; startTime: Date } | null>(null);
  const [timeUntilEvent, setTimeUntilEvent] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const isNavigatingRef = useRef(false);
  const lastHomeFetchRef = useRef(0);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const [showGuestWarning, setShowGuestWarning] = useState(false);
  const [showPlusCelebration, setShowPlusCelebration] = useState(false);
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const isWeb = Platform.OS === 'web';
  const useLiquidGlassButtons = Platform.OS === 'ios' && isLiquidGlassAvailable();
  const isTabletOrWeb = windowWidth >= 768 || isWeb;
  const isWideViewport = windowWidth >= 768;
  const quickActionTextFlex = isWideViewport && !isWeb ? 0 : 1;
  const quickActionUseMobileStyle = isWeb || !isWideViewport;
  const celebrationScale = useRef(new Animated.Value(0.92)).current;
  const confettiProgress = useRef(Array.from({ length: 18 }, () => new Animated.Value(0))).current;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  const dismissPlusCelebration = React.useCallback(() => {
    hapticLight();
    setShowPlusCelebration(false);
    router.replace('/');
  }, [router]);

  const runPlusCelebration = React.useCallback(() => {
    setShowPlusCelebration(true);
    celebrationScale.setValue(0.92);
    confettiProgress.forEach((v) => v.setValue(0));

    Animated.spring(celebrationScale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start();

    confettiProgress.forEach((value, i) => {
      Animated.timing(value, {
        toValue: 1,
        duration: 1200 + i * 35,
        delay: Math.floor(i / 2) * 35,
        useNativeDriver: true,
      }).start();
    });
  }, [celebrationScale, confettiProgress]);


  useEffect(() => {
    const shouldCelebrate = Array.isArray(plusWelcome)
      ? plusWelcome.includes('1')
      : plusWelcome === '1';
    if (!shouldCelebrate) return;
    runPlusCelebration();
  }, [plusWelcome, runPlusCelebration]);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      (async () => {
        const pending = await AsyncStorage.getItem('plus_welcome_pending');
        if (!active || pending !== '1') return;
        await AsyncStorage.removeItem('plus_welcome_pending');
        runPlusCelebration();
      })().catch(() => {});

      return () => {
        active = false;
      };
    }, [runPlusCelebration])
  );

  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getEventTypeIcon = (type?: string): { name: keyof typeof Feather.glyphMap; color: string } => {
    const greenColor = '#4ade80';
    switch (type) {
      case 'practice':
        return { name: 'target', color: greenColor };
      case 'match':
        return { name: 'award', color: greenColor };
      case 'tournament':
        return { name: 'star', color: greenColor };
      case 'other':
      default:
        return { name: 'help-circle', color: greenColor };
    }
  };

  const fetchUpcomingEvents = async (silent = false) => {
    if (!user) {
      setUpcomingEvents([]);
      setLoadingUpcoming(false);
      return;
    }

    if (!silent) setLoadingUpcoming(true);
    try {
      const all = await listAllEvents();
      const now = new Date();
      const todayStr = formatDate(now);
      
      const future = all
        .filter(e => {
          const [start] = e.time.split(' - ');
          const eventDate = parseLocalDateTime(e.date, start || '00:00');
          return eventDate > now;
        })
        .sort((a, b) => {
          const aDate = parseLocalDateTime(a.date, a.time.split(' - ')[0] || '00:00');
          const bDate = parseLocalDateTime(b.date, b.time.split(' - ')[0] || '00:00');
          return aDate.getTime() - bDate.getTime();
        })
        .slice(0, 3)
        .map(e => {
          const eventDate = parseLocalDate(e.date);
          let displayDate;
          if (e.date === todayStr) {
            displayDate = 'Today';
          } else {
            displayDate = `${eventDate.getMonth() + 1}/${eventDate.getDate()}/${eventDate.getFullYear().toString().slice(-2)}`;
          }
          
          return {
            id: e.id,
            title: e.title,
            time: `${displayDate} at ${formatTimeForDisplay(e.time)}`,
            location: e.location,
            originalDate: e.date,
            originalTime: e.time,
            type: e.type
          };
        });
      setUpcomingEvents(future);
    } catch (err) {
      console.error('Failed to fetch upcoming events:', err);
      setUpcomingEvents([]);
    } finally {
      if (!silent) setLoadingUpcoming(false);
    }
  };

  const fetchRecentActivity = async (silent = false, preloadedMatches?: MatchHistoryItem[]) => {
    if (!user) {
      setRecentActivity([]);
      setLoadingRecentActivity(false);
      return;
    }

    if (!silent) setLoadingRecentActivity(true);
    try {
      const [matches, notes] = await Promise.all([
        preloadedMatches ? Promise.resolve(preloadedMatches) : listMatchHistory().catch(() => [] as MatchHistoryItem[]),
        listNotes().catch(() => [] as Note[])
      ]);

      const activityItems: RecentActivityItem[] = [
        ...matches.map((match): RecentActivityItem => {
          const isCompleted = match.status === 'completed' || match.result !== 'Ongoing'
          const hasMeaningfulScore = match.score && match.score !== '0-0' && match.score !== 'In Progress' && match.score !== '—'
          let subtitle: string
          if (isCompleted) {
            const resultLabel = match.result !== 'Ongoing' ? match.result : 'Completed'
            const scoreLabel = hasMeaningfulScore ? match.score : 'Final'
            subtitle = `${resultLabel} - ${scoreLabel}`
          } else {
            subtitle = hasMeaningfulScore ? `Live · ${match.score}` : 'In progress'
          }
          return {
            id: `match-${match.id}`,
            type: 'match',
            title: `Match vs ${match.opponentNames}`,
            subtitle,
            date: new Date(match.date),
            matchId: match.id,
          }
        }),
        ...notes.map((note): RecentActivityItem => {
          const noteTypeLabels: Record<string, string> = {
            'pre-match': 'Pre-Match Note',
            'post-match': 'Post-Match Note',
            'training': 'Practice Note',
          };
          return {
            id: `note-${note.id}`,
            type: 'note',
            title: noteTypeLabels[note.type] || 'Note',
            subtitle: note.content.length > 60 
              ? note.content.substring(0, 60) + '...'
              : note.content,
            date: new Date(note.createdAt),
            noteId: note.id,
            matchId: note.matchId,
          };
        }),
      ];

      activityItems.sort((a, b) => b.date.getTime() - a.date.getTime());

      setRecentActivity(activityItems.slice(0, 5));
    } catch (err) {
      console.error('Failed to fetch recent activity:', err);
      setRecentActivity([]);
    } finally {
      if (!silent) setLoadingRecentActivity(false);
    }
  };

  const fetchRecentMessages = async (silent = false) => {
    if (!user) {
      setRecentMessages([]);
      setLoadingRecentMessages(false);
      return;
    }

    if (!silent) setLoadingRecentMessages(true);
    try {
      const conversations = await getRecentConversations(5);
      const withActivity = conversations.filter(
        (c) => c.updatedAt != null || c.lastMessage != null
      );
      const byRecent = [...withActivity].sort((a, b) => {
        const aStarred = a.starred ? 1 : 0;
        const bStarred = b.starred ? 1 : 0;
        if (bStarred !== aStarred) return bStarred - aStarred;
        const ta = new Date(a.updatedAt || 0).getTime();
        const tb = new Date(b.updatedAt || 0).getTime();
        return tb - ta;
      });
      setRecentMessages(byRecent.slice(0, 5));
    } catch (err) {
      console.error('Failed to fetch recent messages:', err);
      setRecentMessages([]);
    } finally {
      if (!silent) setLoadingRecentMessages(false);
    }
  };

  const fetchQuickStats = async (silent = false, preloadedMatches?: MatchHistoryItem[]) => {
    if (!user) {
      setQuickStats(null);
      setLoadingQuickStats(false);
      return;
    }

    if (!silent) setLoadingQuickStats(true);
    try {
      const matches = preloadedMatches ?? await listMatchHistory();
      const completedMatches = matches.filter(m => m.status === 'completed' && m.result !== 'Ongoing');
      
      const now = new Date();
      let filteredMatches = completedMatches;
      
      if (statsPeriod !== 'all') {
        let startDate: Date;
        
        switch (statsPeriod) {
          case 'month': {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          }
          case 'season': {
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 3);
            break;
          }
          case 'year': {
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          }
          case 'ytd': {
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
          }
          default:
            startDate = new Date(0);
        }
        
        filteredMatches = completedMatches.filter(m => {
          const matchDate = new Date(m.date);
          return matchDate >= startDate;
        });
      }
      
      const wins = filteredMatches.filter(m => m.result === 'Won').length;
      const losses = filteredMatches.filter(m => m.result === 'Lost').length;
      const totalMatches = filteredMatches.length;
      const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

      let currentStreak = 0;
      let streakType: 'win' | 'loss' = 'win';
      if (filteredMatches.length > 0) {
        const sortedMatches = [...filteredMatches].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        const firstResult = sortedMatches[0].result;
        streakType = firstResult === 'Won' ? 'win' : 'loss';
        
        for (const match of sortedMatches) {
          if (match.result === firstResult) {
            currentStreak++;
          } else {
            break;
          }
        }
      }

      setQuickStats({
        totalMatches,
        wins,
        losses,
        winRate,
        currentStreak,
        streakType,
      });
    } catch (err) {
      console.error('Failed to fetch quick stats:', err);
      setQuickStats(null);
    } finally {
      if (!silent) setLoadingQuickStats(false);
    }
  };


  useEffect(() => {
    if (!loading) {
      (async () => {
        const matchData = await listMatchHistory().catch(() => [] as MatchHistoryItem[]);
        await Promise.all([
          fetchUpcomingEvents(),
          fetchRecentActivity(false, matchData),
          fetchRecentMessages(),
          fetchQuickStats(false, matchData),
        ]);
      })();
    }
  }, [user, loading, statsPeriod]);

  useEffect(() => {
    if (user && todaysEvent) {
      const shimmerAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
      shimmerAnimation.start();
      return () => shimmerAnimation.stop();
    }
  }, [user, todaysEvent, shimmerAnim]);

  useFocusEffect(
    React.useCallback(() => {
      isNavigatingRef.current = false;
      if (!loading && user) {
        fetchRecentMessages(true);
        const now = Date.now();
        if (now - lastHomeFetchRef.current < 30_000) return;
        lastHomeFetchRef.current = now;
        (async () => {
          const matchData = await listMatchHistory().catch(() => [] as MatchHistoryItem[]);
          await Promise.all([
            fetchUpcomingEvents(true),
            fetchRecentActivity(true, matchData),
            fetchQuickStats(true, matchData),
          ]);
        })();
      }
    }, [user, loading])
  );

  useEffect(() => {
    if (upcomingEvents.length === 0) {
      setTodaysEvent(null);
      return;
    }

    const now = new Date();
    const todayStr = formatDate(now);
    
    const todayEvents = upcomingEvents.filter(evt => 
      evt.originalDate === todayStr && 
      (evt.type === 'match' || evt.type === 'tournament')
    );

    if (todayEvents.length === 0) {
      setTodaysEvent(null);
      return;
    }

    const earliestEvent = todayEvents[0];
    
    if (!earliestEvent.originalTime || !earliestEvent.originalDate) {
      setTodaysEvent(null);
      return;
    }

    const startTimeStr = earliestEvent.originalTime.split(' - ')[0].trim();
    
    let hours: number, minutes: number;
    const time24Match = startTimeStr.match(/^(\d{1,2}):(\d{2})$/);
    
    if (time24Match) {
      hours = parseInt(time24Match[1], 10);
      minutes = parseInt(time24Match[2], 10);
    } else {
      const time12Match = startTimeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (time12Match) {
        hours = parseInt(time12Match[1], 10);
        minutes = parseInt(time12Match[2], 10);
        const isPM = time12Match[3].toUpperCase() === 'PM';
        if (isPM && hours !== 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;
      } else {
        setTodaysEvent(null);
        return;
      }
    }

    const [year, month, day] = earliestEvent.originalDate.split('-').map(Number);
    const startTime = new Date(year, month - 1, day, hours, minutes, 0, 0);
    
    if (startTime < now) {
      startTime.setDate(startTime.getDate() + 1);
    }

    setTodaysEvent({
      id: earliestEvent.id,
      title: earliestEvent.title,
      time: earliestEvent.time,
      location: earliestEvent.location,
      startTime,
    });
  }, [upcomingEvents]);

  useEffect(() => {
    if (!todaysEvent) {
      setTimeUntilEvent('');
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const diff = todaysEvent.startTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeUntilEvent('Starting now!');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 0) {
        setTimeUntilEvent(`In ${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''}`);
      } else if (minutes > 0) {
        setTimeUntilEvent(`Starts in ${minutes} minute${minutes !== 1 ? 's' : ''} ${seconds} second${seconds !== 1 ? 's' : ''}`);
      } else {
        setTimeUntilEvent(`Starts in ${seconds} second${seconds !== 1 ? 's' : ''}`);
      }
    };

    updateCountdown();
    
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);
    
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [todaysEvent]);

  const handleNavigate = (path: string) => {
    if (isNavigatingRef.current) {
      return;
    }

    if (path === '/log-match' && !user) {
      setShowGuestWarning(true);
      return;
    }
    
    isNavigatingRef.current = true;
    hapticLight();
    router.push(path);
    
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 1000);
  };

  const handleScheduleEvent = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    handleNavigate(`/new-event?date=${dateStr}`);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    hapticLight();
    try {
      const matchData = await listMatchHistory().catch(() => [] as MatchHistoryItem[]);
      await Promise.all([
        fetchUpcomingEvents(),
        fetchRecentActivity(false, matchData),
        fetchRecentMessages(),
        fetchQuickStats(false, matchData),
      ]);
    } catch (err) {
      console.error('Error refreshing home screen:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const isLoadingAll = loadingUpcoming || loadingRecentActivity || loadingRecentMessages || loadingQuickStats;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <View className="relative flex-1" style={{ backgroundColor: '#020617' }}>
      <LinearGradient
        colors={['rgba(0, 6, 42, 0.5)', 'rgba(0, 0, 0, 0.3)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      
      {refreshing && (
        <View
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#020617',
            zIndex: 1,
          }}
        >
          <ActivityIndicator size="small" color="#60a5fa" />
        </View>
      )}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        contentContainerStyle={{ 
          paddingTop:
            (isWeb ? 24 : Math.max(insets.top / 2, 12)) +
            (Platform.OS === 'ios' && Platform.isPad ? IPAD_TAB_CONTENT_TOP_PADDING : 0),
          paddingBottom: insets.bottom + 16, 
          paddingHorizontal: isWeb && isWideViewport ? 24 : 16,
          flexGrow: 1,
          maxWidth: isWeb ? 1200 : undefined,
          alignSelf: isWeb ? 'center' : undefined,
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
        bounces={Platform.OS === 'ios'}
        overScrollMode={Platform.OS === 'android' ? 'never' : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="transparent"
            colors={['#60a5fa']}
            progressViewOffset={Platform.OS === 'android' ? 60 : undefined}
          />
        }
      >
        {user && !isLoadingAll && todaysEvent && (
          <View className="mb-8">
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/calendar')}
              activeOpacity={0.8}
            >
              <View style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
                <LinearGradient
                  colors={['#ede5a6', '#806e2e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    padding: 20,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(128, 110, 46, 0.5)',
                  }}
                >
                  <Animated.View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      opacity: shimmerAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 0.3, 0],
                      }),
                      transform: [
                        {
                          translateX: shimmerAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-200, 200],
                          }),
                        },
                      ],
                    }}
                  >
                    <LinearGradient
                      colors={['transparent', 'rgba(255, 255, 255, 0.4)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        width: '100%',
                        height: '100%',
                        transform: [{ rotate: '25deg' }],
                      }}
                    />
                  </Animated.View>
                  
                  <View className="flex-row items-start gap-4" style={{ position: 'relative', zIndex: 1 }}>
                    <View className="mt-1">
                      <Feather name="calendar" size={24} color="#5a4a1f" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-medium mb-1 uppercase tracking-wider" style={{ color: '#5a4a1f' }}>
                        Today's Focus
                      </Text>
                      <Text className="font-bold text-xl mb-2" numberOfLines={2} style={{ color: '#2a2418' }}>
                        {todaysEvent.title}
                      </Text>
                      <View className="flex-row items-center gap-3 mb-2">
                        <View className="flex-row items-center gap-1.5">
                          <Feather name="clock" size={14} color="#5a4a1f" />
                          <Text className="text-sm" style={{ color: '#5a4a1f' }}>{todaysEvent.time}</Text>
                        </View>
                        {todaysEvent.location && (
                          <View className="flex-row items-center gap-1.5">
                            <Feather name="map-pin" size={14} color="#5a4a1f" />
                            <Text className="text-sm" style={{ color: '#5a4a1f' }} numberOfLines={1}>
                              {todaysEvent.location}
                            </Text>
                          </View>
                        )}
                      </View>
                      {timeUntilEvent && (
                        <View className="flex-row items-center gap-2 mt-2">
                          <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: 'rgba(90, 74, 31, 0.3)' }}>
                            <Text className="text-sm font-semibold" style={{ color: '#5a4a1f' }}>
                              {timeUntilEvent}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                    <Feather name="chevron-right" size={20} color="#5a4a1f" />
                  </View>
                </LinearGradient>
              </View>
            </TouchableOpacity>
          </View>
        )}

        <View className="mb-8">
          {isLoadingAll ? (
            <View style={{ gap: 16, flexDirection: isWideViewport ? 'row' : 'column' }}>
              <Skeleton className={`${isWideViewport ? 'flex-1' : 'w-full'} h-20 rounded-xl`} />
              <Skeleton className={`${isWideViewport ? 'flex-1' : 'w-full'} h-20 rounded-xl`} />
              <Skeleton className={`${isWideViewport ? 'flex-1' : 'w-full'} h-20 rounded-xl`} />
            </View>
          ) : (
            <View style={{ gap: 16, flexDirection: isWideViewport ? 'row' : 'column' }}>
              {user && (
                <TouchableOpacity 
                  onPress={handleScheduleEvent}
                  activeOpacity={0.8}
                  style={{ flex: isWideViewport ? 1 : undefined, width: isWideViewport ? undefined : '100%' }}
                >
                  <LinearGradient
                    colors={['rgba(34, 197, 94, 0.2)', 'rgba(16, 185, 129, 0.2)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      minHeight: quickActionUseMobileStyle ? 72 : 80, 
                      padding: quickActionUseMobileStyle ? 20 : 14, 
                      borderRadius: 12, 
                      borderWidth: 1, 
                      borderColor: 'rgba(34, 197, 94, 0.3)',
                      width: '100%',
                      justifyContent: (isWideViewport && !isWeb) ? 'center' : 'flex-start',
                    }}
                  >
                    <View style={{ marginRight: quickActionUseMobileStyle ? 16 : 12 }}>
                      <Feather name="calendar" size={quickActionUseMobileStyle ? 28 : 24} color="#4ade80" />
                    </View>
                    <View style={{ flex: quickActionTextFlex, minWidth: 0, alignItems: (isWideViewport && !isWeb) ? 'center' : 'flex-start' }}>
                      <Text className="font-semibold text-white" style={{ fontSize: quickActionUseMobileStyle ? 18 : 16 }} numberOfLines={isWideViewport && !isWeb ? 1 : 2}>
                        Schedule Event
                      </Text>
                      {quickActionUseMobileStyle && (
                        <Text className="text-sm text-gray-400" numberOfLines={1}>Plan your next session</Text>
                      )}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {user && (
                <TouchableOpacity 
                  onPress={() => handleNavigate('/(tabs)/team')}
                  activeOpacity={0.8}
                  style={{ flex: isWideViewport ? 1 : undefined, width: isWideViewport ? undefined : '100%' }}
                >
                  <LinearGradient
                    colors={['rgba(59, 130, 246, 0.2)', 'rgba(6, 182, 212, 0.2)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      minHeight: quickActionUseMobileStyle ? 72 : 80, 
                      padding: quickActionUseMobileStyle ? 20 : 14, 
                      borderRadius: 12, 
                      borderWidth: 1, 
                      borderColor: 'rgba(59, 130, 246, 0.3)',
                      width: '100%',
                      justifyContent: (isWideViewport && !isWeb) ? 'center' : 'flex-start',
                    }}
                  >
                    <View style={{ marginRight: quickActionUseMobileStyle ? 16 : 12 }}>
                      <Feather name="message-circle" size={quickActionUseMobileStyle ? 28 : 24} color="#06b6d4" />
                    </View>
                    <View style={{ flex: quickActionTextFlex, minWidth: 0, alignItems: (isWideViewport && !isWeb) ? 'center' : 'flex-start' }}>
                      <Text className="font-semibold text-white" style={{ fontSize: quickActionUseMobileStyle ? 18 : 16 }} numberOfLines={isWideViewport && !isWeb ? 1 : 2}>
                        Send Message
                      </Text>
                      {quickActionUseMobileStyle && (
                        <Text className="text-sm text-gray-400" numberOfLines={1}>Connect with your team</Text>
                      )}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                onPress={() => {
                  if (user) {
                    handleNavigate('/log-match');
                  } else {
                    setShowGuestWarning(true);
                  }
                }}
                activeOpacity={0.8}
                style={{ flex: isWideViewport ? 1 : undefined, width: isWideViewport ? undefined : '100%' }}
              >
                <LinearGradient
                  colors={['rgba(37, 99, 235, 0.2)', 'rgba(59, 130, 246, 0.2)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    minHeight: quickActionUseMobileStyle ? 72 : 80, 
                    padding: quickActionUseMobileStyle ? 20 : 14, 
                    borderRadius: 12, 
                    borderWidth: 1, 
                    borderColor: 'rgba(37, 99, 235, 0.3)',
                    width: '100%',
                    justifyContent: (isWideViewport && !isWeb) ? 'center' : 'flex-start',
                  }}
                >
                  <View style={{ marginRight: quickActionUseMobileStyle ? 16 : 12 }}>
                    <Feather name="plus-circle" size={quickActionUseMobileStyle ? 28 : 24} color="#2563eb" />
                  </View>
                  <View style={{ flex: quickActionTextFlex, minWidth: 0, alignItems: (isWideViewport && !isWeb) ? 'center' : 'flex-start' }}>
                    <Text className="font-semibold text-white" style={{ fontSize: quickActionUseMobileStyle ? 18 : 16 }} numberOfLines={isWideViewport && !isWeb ? 1 : 2}>
                      Log a Match
                    </Text>
                    {quickActionUseMobileStyle && (
                      <Text className="text-sm text-gray-400" numberOfLines={1}>Record your latest game</Text>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {user && (
          <TouchableOpacity
            onPress={() => {
              if (!isLoadingAll) {
                hapticLight();
                router.push('/(tabs)/matches?tab=analytics&statsMode=lastN');
              }
            }}
            activeOpacity={0.7}
            className="mb-8"
            disabled={isLoadingAll}
          >
            <View className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col shadow-lg relative">
              {isLoadingAll ? (
                <>
                  <View className="flex-row items-center mb-4">
                    <Skeleton className="h-5 w-24 rounded" />
                  </View>
                  <View className="flex-row gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="flex-1 h-20 rounded-lg" />
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <View className="absolute top-4 right-2 z-10">
                    <ContextMenu
                      options={[
                        { label: 'This Month', value: 'month', onPress: () => setStatsPeriod('month') },
                        { label: 'This Season', value: 'season', onPress: () => setStatsPeriod('season') },
                        { label: 'This Year', value: 'year', onPress: () => setStatsPeriod('year') },
                        { label: 'YTD', value: 'ytd', onPress: () => setStatsPeriod('ytd') },
                        { label: 'All Time', value: 'all', onPress: () => setStatsPeriod('all') },
                      ]}
                      onSelect={(value) => {
                        hapticLight();
                        setStatsPeriod(value as 'month' | 'season' | 'year' | 'ytd' | 'all');
                      }}
                      trigger={
                        <TouchableOpacity
                          className="flex-row items-center gap-1 rounded-lg bg-white/5 border border-white/10"
                          activeOpacity={0.7}
                          onPress={(e) => e.stopPropagation()}
                          style={{ 
                            paddingHorizontal: 8,
                            paddingVertical: 6,
                          }}
                        >
                          <Text className="text-gray-300 text-[10px] font-medium">
                            {statsPeriod === 'month' ? 'This Month' :
                             statsPeriod === 'season' ? 'This Season' :
                             statsPeriod === 'year' ? 'This Year' :
                             statsPeriod === 'ytd' ? 'YTD' : 'All Time'}
                          </Text>
                          <Feather name="chevron-down" size={12} color="#9ca3af" />
                        </TouchableOpacity>
                      }
                    />
                  </View>
                  <View className="flex-row items-center mb-4 pr-20">
                    <Feather name="activity" size={20} color="#ede5a6" />
                    <Text className="font-semibold text-white text-lg ml-2">
                      Quick Stats
                    </Text>
                  </View>
                  {!isOnline ? (
                    <View className="p-6 rounded-lg bg-white/5 border-2 border-dashed border-white/20 items-center justify-center min-h-[100px]">
                      <Feather name="wifi-off" size={32} color="#9ca3af" />
                      <Text className="font-semibold text-white text-base mb-1 mt-3 text-center">You're offline</Text>
                      <Text className="text-sm text-gray-500 text-center">Connect to internet to view stats</Text>
                    </View>
                  ) : quickStats && quickStats.totalMatches > 0 ? (
                  <View className="flex-row gap-4">
                      <View className="flex-1 p-4 rounded-lg bg-white/5 border border-white/10 items-center">
                        <View className="flex-row items-center justify-center gap-2 mb-2">
                          <Feather name="award" size={16} color="#2563eb" />
                          <Text className="text-gray-400 text-xs">Record</Text>
                        </View>
                        <Text className="text-white font-bold text-xl text-center">
                          {quickStats.wins}-{quickStats.losses}
                        </Text>
                      </View>

                      <View className="flex-1 p-4 rounded-lg bg-white/5 border border-white/10 items-center">
                        <View className="flex-row items-center justify-center gap-2 mb-2">
                          <Feather name="trending-up" size={16} color="#06b6d4" />
                          <Text className="text-gray-400 text-xs">Win %</Text>
                        </View>
                        <Text className="text-white font-bold text-xl text-center">
                          {quickStats.winRate}%
                        </Text>
                      </View>

                      <View className="flex-1 p-4 rounded-lg bg-white/5 border border-white/10 items-center">
                        <View className="flex-row items-center justify-center gap-2 mb-2">
                          <Feather 
                            name={quickStats.streakType === 'win' ? 'arrow-up' : 'arrow-down'} 
                            size={16} 
                            color={quickStats.streakType === 'win' ? '#4ade80' : '#ef4444'} 
                          />
                          <Text className="text-gray-400 text-xs">Streak</Text>
                        </View>
                        <Text 
                          className="font-bold text-xl text-center"
                          style={{ color: quickStats.streakType === 'win' ? '#4ade80' : '#ef4444' }}
                        >
                          {quickStats.currentStreak}
                        </Text>
                      </View>
                  </View>
                  ) : (
                    <View className="p-6 rounded-lg bg-white/5 border-2 border-dashed border-white/20 items-center justify-center min-h-[100px]">
                      <Feather name="activity" size={32} color="#9ca3af" />
                      <Text className="font-semibold text-white text-base mb-1 mt-3 text-center">No matches logged</Text>
                      <Text className="text-sm text-gray-500 text-center">Log your first match to see stats</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </TouchableOpacity>
        )}

        {user && (
          <View className="gap-6 mb-16">
            <View className="p-6 rounded-xl bg-white/5 border border-white/10 flex flex-col shadow-lg">
              <View className="flex-row items-center justify-between mb-5">
                <View className="flex-row items-center">
                  <Feather name="clock" size={20} color="#4ade80" />
                  <Text className="font-semibold text-white text-lg ml-2">
                    Upcoming Events
                  </Text>
                </View>
                {!isLoadingAll && (
                  <TouchableOpacity 
                    className="flex-row items-center"
                    onPress={() => router.push('/(tabs)/calendar')}
                    activeOpacity={0.7}
                  >
                    <Text className="text-sm font-medium mr-1" style={{ color: '#4ade80' }}>View All</Text>
                    <Feather name="arrow-right" size={16} color="#4ade80" />
                  </TouchableOpacity>
                )}
              </View>
              <View className="gap-3 flex-grow">
                {isLoadingAll ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))
                ) : upcomingEvents.length > 0 ? (
                  upcomingEvents.map(evt => {
                    const eventIcon = getEventTypeIcon(evt.type);
                    return (
                      <TouchableOpacity
                        key={evt.id}
                        className="p-4 rounded-lg bg-white/5 border border-white/10 min-h-[72px]"
                        activeOpacity={0.7}
                      >
                        <View className="flex-row items-start gap-3">
                          <View className="mt-0.5">
                            <Feather name={eventIcon.name} size={20} color={eventIcon.color} />
                          </View>
                          <View className="flex-1 min-w-0">
                            <Text className="text-white font-medium mb-2">{evt.title}</Text>
                            <View className="gap-1.5">
                              <View className="flex-row items-center gap-2">
                                <Feather name="clock" size={16} color="#9ca3af" />
                                <Text className="text-gray-400 text-sm">{evt.time}</Text>
                              </View>
                              {evt.location && (
                                <View className="flex-row items-center gap-2">
                                  <Feather name="map-pin" size={16} color="#9ca3af" />
                                  <Text className="text-gray-400 text-sm" numberOfLines={1}>{evt.location}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : !isOnline ? (
                  <View className="p-6 rounded-lg bg-white/5 border-2 border-dashed border-white/20 items-center justify-center min-h-[200px]">
                    <Feather name="wifi-off" size={40} color="#9ca3af" />
                    <Text className="font-semibold text-white text-lg mb-2 mt-3">You're offline</Text>
                    <Text className="text-sm text-gray-500 text-center">Connect to internet to view upcoming events</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleScheduleEvent}
                    className="p-6 rounded-lg bg-white/5 border-2 border-dashed border-white/20 items-center justify-center min-h-[200px]"
                    activeOpacity={0.7}
                  >
                    <Feather name="plus-circle" size={40} color="#9ca3af" />
                    <Text className="font-semibold text-white text-lg mb-2 mt-3">Schedule an Event</Text>
                    <Text className="text-sm text-gray-500 text-center">Get your first practice or match on the calendar.</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View className="p-6 rounded-xl bg-white/5 border border-white/10 flex flex-col shadow-lg">
              <View className="flex-row items-center justify-between mb-5">
                <View className="flex-row items-center">
                  <Feather name="message-circle" size={20} color="#06b6d4" />
                  <Text className="font-semibold text-white text-lg ml-2">
                    Recent Messages
                  </Text>
                </View>
                {!isLoadingAll && (
                  <TouchableOpacity 
                    className="flex-row items-center"
                    onPress={() => router.push('/(tabs)/team')}
                    activeOpacity={0.7}
                  >
                    <Text className="text-sm font-medium mr-1" style={{ color: '#06b6d4' }}>View All</Text>
                    <Feather name="arrow-right" size={16} color="#06b6d4" />
                  </TouchableOpacity>
                )}
              </View>
              <View className="gap-3 flex-grow">
                {isLoadingAll ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))
                ) : recentMessages.length > 0 ? (
                  recentMessages.map(conv => {
                    const updatedDate = new Date(conv.updatedAt || conv.createdAt || 0);
                    const chatTitle = conv.type === 'group' 
                      ? (conv.name || 'Group Chat')
                      : (conv.participants?.[0]?.username || 'Private Chat');
                    
                    let displayName: string;
                    if (conv.teamName) {
                      const maxTeamNameLength = 12;
                      const truncatedTeamName = conv.teamName.length > maxTeamNameLength
                        ? conv.teamName.substring(0, maxTeamNameLength) + '...'
                        : conv.teamName;
                      displayName = `${truncatedTeamName} - ${chatTitle}`;
                    } else {
                      displayName = chatTitle;
                    }
                    
                    const rawPreview = conv.lastMessage === 'Message was deleted' ? 'Message was deleted' :
                      conv.lastMessageType === 'gif' ? 'Sent a GIF' :
                      conv.lastMessageType === 'poll' ? 'Created a poll' :
                      conv.lastMessageType === 'voice' ? 'Sent a voice message' :
                      conv.lastMessageType === 'announcement' ? 'Made an announcement' :
                      conv.lastMessage || (conv.lastMessageSender ? 'Sent an attachment' : 'No messages yet');
                    const senderPrefix = conv.lastMessageSender ? `${conv.lastMessageSender}: ` : '';
                    const fullPreview = senderPrefix + rawPreview;
                    const lastMessagePreview = fullPreview.length > 60 
                      ? fullPreview.substring(0, 60) + '...'
                      : fullPreview;

                    const recentMessageItem = (
                      <View key={`${conv.teamId}-${conv.id}`} className="p-4 rounded-lg bg-white/5 border border-white/10 min-h-[72px] flex-row items-center gap-2">
                        <TouchableOpacity
                          className="flex-1 flex-row items-start gap-3 min-w-0"
                          activeOpacity={0.7}
                          onPress={() => {
                            hapticLight();
                            if (!canChat && reason) {
                              showChatBlocked(reason);
                              return;
                            }
                            router.push({
                              pathname: '/(tabs)/team',
                              params: { 
                                teamId: conv.teamId,
                                convId: conv.id,
                                conversationName: conv.type === 'group' ? (conv.name || 'general') : 'private',
                              },
                            });
                          }}
                        >
                          <View className="mt-0.5">
                            <Avatar src={conv.teamImageUrl} alt={conv.teamName || 'Team'} size="sm" />
                          </View>
                          <View className="flex-1 min-w-0">
                            <Text className="text-white font-medium mb-1" numberOfLines={1}>
                              {displayName}
                            </Text>
                            <Text className="text-gray-400 text-sm mb-1" numberOfLines={2}>
                              {lastMessagePreview}
                            </Text>
                            <Text className="text-gray-500 text-xs">
                              {updatedDate.toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: updatedDate.getFullYear() !== new Date().getFullYear() 
                                  ? 'numeric' 
                                  : undefined
                              })}
                            </Text>
                          </View>
                          {conv.unreadCount > 0 && (
                            <View className="bg-blue-500 rounded-full min-w-[20px] h-[20px] items-center justify-center px-1.5 self-center">
                              <Text className="text-[10px] text-white font-semibold">
                                {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={async () => {
                            hapticLight();
                            const nextStarred = !conv.starred;
                            setRecentMessages(prev => prev.map(c => 
                              c.id === conv.id && c.teamId === conv.teamId ? { ...c, starred: nextStarred } : c
                            ).sort((a, b) => {
                              const aStarred = a.starred ? 1 : 0;
                              const bStarred = b.starred ? 1 : 0;
                              if (bStarred !== aStarred) return bStarred - aStarred;
                              return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
                            }));
                            try {
                              if (nextStarred) await starConversation(conv.id);
                              else await unstarConversation(conv.id);
                            } catch {
                              setRecentMessages(prev => prev.map(c => 
                                c.id === conv.id && c.teamId === conv.teamId ? { ...c, starred: !nextStarred } : c
                              ));
                            }
                          }}
                          hitSlop={8}
                          className="p-2 justify-center"
                        >
                          <Feather
                            name="star"
                            size={20}
                            color={conv.starred ? '#fbbf24' : 'rgba(255,255,255,0.35)'}
                            fill={conv.starred ? '#fbbf24' : 'transparent'}
                          />
                        </TouchableOpacity>
                      </View>
                    );

                    return (
                      <ContextMenu
                        key={`${conv.teamId}-${conv.id}`}
                        activationMethod="longPress"
                        onSinglePress={() => {
                          hapticLight();
                          if (!canChat && reason) {
                            showChatBlocked(reason);
                            return;
                          }
                          router.push({
                            pathname: '/(tabs)/team',
                            params: { 
                              teamId: conv.teamId,
                              convId: conv.id,
                              conversationName: conv.type === 'group' ? (conv.name || 'general') : 'private',
                            },
                          });
                        }}
                        trigger={recentMessageItem}
                        options={[
                          { label: 'Open Chat', value: 'open', onPress: () => {
                            hapticLight();
                            if (!canChat && reason) { showChatBlocked(reason); return; }
                            router.push({
                              pathname: '/(tabs)/team',
                              params: { teamId: conv.teamId, convId: conv.id, conversationName: conv.type === 'group' ? (conv.name || 'general') : 'private' },
                            });
                          } },
                          { label: conv.starred ? 'Unstar' : 'Star', value: 'star', onPress: async () => {
                            hapticLight();
                            const nextStarred = !conv.starred;
                            setRecentMessages(prev => prev.map(c => 
                              c.id === conv.id && c.teamId === conv.teamId ? { ...c, starred: nextStarred } : c
                            ).sort((a, b) => {
                              const aStarred = a.starred ? 1 : 0;
                              const bStarred = b.starred ? 1 : 0;
                              if (bStarred !== aStarred) return bStarred - aStarred;
                              return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
                            }));
                            try {
                              if (nextStarred) await starConversation(conv.id);
                              else await unstarConversation(conv.id);
                            } catch {
                              setRecentMessages(prev => prev.map(c => 
                                c.id === conv.id && c.teamId === conv.teamId ? { ...c, starred: !nextStarred } : c
                              ));
                            }
                          } },
                        ]}
                      />
                    );
                  })
                ) : !isOnline ? (
                  <View className="p-6 rounded-lg bg-white/5 border-2 border-dashed border-white/20 items-center justify-center min-h-[200px]">
                    <Feather name="wifi-off" size={40} color="#9ca3af" />
                    <Text className="font-semibold text-white text-lg mb-2 mt-3">You're offline</Text>
                    <Text className="text-sm text-gray-500 text-center">Connect to internet to view recent messages</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    className="p-6 rounded-lg bg-white/5 border-2 border-dashed border-white/20 items-center justify-center min-h-[200px]"
                    activeOpacity={0.7}
                    onPress={() => handleNavigate('/(tabs)/team')}
                  >
                    <Feather name="message-circle" size={40} color="#9ca3af" />
                    <Text className="font-semibold text-white text-lg mb-2 mt-3">Send a Message</Text>
                    <Text className="text-sm text-gray-500 text-center">Start a conversation with your team.</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View className="p-6 rounded-xl bg-white/5 border border-white/10 flex flex-col shadow-lg">
              <View className="flex-row items-center justify-between mb-5">
                <View className="flex-row items-center">
                  <Feather name="clock" size={20} color="#1e40af" />
                  <Text className="font-semibold text-white text-lg ml-2">Recent Activity</Text>
                </View>
                {!isLoadingAll && (
                  <TouchableOpacity 
                    className="flex-row items-center"
                    onPress={() => router.push('/(tabs)/matches?tab=analytics&statsMode=single')}
                    activeOpacity={0.7}
                  >
                    <Text className="text-sm font-medium mr-1" style={{ color: '#2563eb' }}>View All</Text>
                    <Feather name="arrow-right" size={16} color="#2563eb" />
                  </TouchableOpacity>
                )}
              </View>
              <View className="gap-3 flex-grow">
                {isLoadingAll ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-lg" />
                  ))
                ) : recentActivity.length > 0 ? (
                  recentActivity.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      className="p-4 rounded-lg bg-white/5 border border-white/10 min-h-[72px]"
                      activeOpacity={0.7}
                      onPress={() => {
                        if (item.type === 'match' && item.matchId) {
                          hapticLight();
                          router.push({
                            pathname: '/match-detail',
                            params: { matchId: item.matchId },
                          });
                        } else if (item.type === 'note') {
                          handleNavigate('/(tabs)/matches?tab=notes');
                        }
                      }}
                    >
                      <View className="flex-row items-start gap-3">
                        <View className="mt-1">
                          {item.type === 'match' ? (
                            <Feather name="award" size={20} color="#2563eb" />
                          ) : (
                            <Feather name="file-text" size={20} color="#2563eb" />
                          )}
                        </View>
                        <View className="flex-1 min-w-0">
                          <Text className="text-white font-medium mb-1" numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text className="text-gray-400 text-sm mb-1" numberOfLines={2}>
                            {item.subtitle}
                          </Text>
                          <Text className="text-gray-500 text-xs">
                            {item.date.toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: item.date.getFullYear() !== new Date().getFullYear() 
                                ? 'numeric' 
                                : undefined
                            })}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : !isOnline ? (
                  <View className="p-6 rounded-lg bg-white/5 border-2 border-dashed border-white/20 items-center justify-center min-h-[200px]">
                    <Feather name="wifi-off" size={40} color="#9ca3af" />
                    <Text className="font-semibold text-white text-lg mb-2 mt-3">You're offline</Text>
                    <Text className="text-sm text-gray-500 text-center">Connect to internet to view recent activity</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    className="p-6 rounded-lg bg-white/5 border-2 border-dashed border-white/20 items-center justify-center min-h-[200px]"
                    activeOpacity={0.7}
                    onPress={() => {
                      if (user) {
                        handleNavigate('/log-match');
                      } else {
                        setShowGuestWarning(true);
                      }
                    }}
                  >
                    <Feather name="award" size={40} color="#9ca3af" />
                    <Text className="font-semibold text-white text-lg mb-2 mt-3">Log a Match</Text>
                    <Text className="text-sm text-gray-500 text-center">Track your stats to see your progress.</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}


        {!user && (
          <View className="flex-col items-center justify-center py-12 px-6 bg-white/5 rounded-xl border border-white/10 mb-16 shadow-lg">
            <Text className="text-3xl font-bold text-white mb-4 text-center">
              Stats & Activity
            </Text>
            <Text className="text-gray-400 mb-8 max-w-md text-lg text-center">
              Sign in to view your personalized stats, recent matches, and upcoming events.
            </Text>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                router.push('/login');
              }}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#22c55e', '#10b981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ 
                  paddingHorizontal: isWeb ? 20 : 32, 
                  paddingVertical: isWeb ? 8 : 16, 
                  borderRadius: 9999 
                }}
              >
                <Text className="text-white font-semibold" style={{ fontSize: isWeb ? 13 : 18 }}>Sign In</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <GuestMatchWarning
        isOpen={showGuestWarning}
        onClose={() => setShowGuestWarning(false)}
        onConfirm={() => {
          router.push('/log-match?guest=true');
        }}
      />

      {showPlusCelebration && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(2, 6, 23, 0.82)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 20000,
            elevation: 20000,
          }}
        >
          <Animated.View
            style={{
              transform: [{ scale: celebrationScale }],
              width: '88%',
              maxWidth: 420,
              borderRadius: 24,
              overflow: 'hidden',
            }}
          >
            <LinearGradient
              colors={['rgba(59,130,246,0.95)', 'rgba(6,182,212,0.92)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center' }}
            >
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                <Feather name="zap" size={34} color="#fff" />
              </View>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 6 }}>
                Welcome to Plus!
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, textAlign: 'center', marginBottom: 20 }}>
                You've unlocked the full MyBreakPoint experience
              </Text>

              <View style={{ width: '100%', gap: 10, marginBottom: 24 }}>
                {[
                  { icon: 'video' as const, label: 'Ad-free broadcasting' },
                  { icon: 'eye' as const, label: '2,000 minutes of stream viewing' },
                  { icon: 'radio' as const, label: 'Live radio commentary' },
                  { icon: 'bar-chart-2' as const, label: 'Historic stats without ads' },
                  //{ icon: 'film' as const, label: 'Video replay & highlights' },
                ].map((f) => (
                  <View key={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name={f.icon} size={15} color="#fff" />
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.95)', fontSize: 14, fontWeight: '500', flex: 1 }}>
                      {f.label}
                    </Text>
                    <Feather name="check" size={14} color="#bbf7d0" />
                  </View>
                ))}
              </View>

              {useLiquidGlassButtons ? (
                <GlassView
                  isInteractive
                  tintColor="rgba(217, 70, 239, 0.3)"
                  style={{
                    borderRadius: 14,
                    alignSelf: 'stretch',
                    minHeight: 58,
                  }}
                >
                  <TouchableOpacity
                    onPress={dismissPlusCelebration}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      paddingVertical: 18,
                      paddingHorizontal: 44,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 19, fontWeight: '800', letterSpacing: 0.5 }}>
                      Let's Go
                    </Text>
                  </TouchableOpacity>
                </GlassView>
              ) : (
                <Pressable
                  onPress={dismissPlusCelebration}
                  style={({ pressed }) => ({
                    width: '100%',
                    borderRadius: 14,
                    overflow: 'hidden',
                    transform: [{ scale: pressed ? 0.975 : 1 }],
                  })}
                >
                  <LinearGradient
                    colors={['rgba(147, 51, 234, 0.95)', 'rgba(79, 70, 229, 0.95)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      minHeight: 58,
                      paddingVertical: 18,
                      paddingHorizontal: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 14,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 19, fontWeight: '800', letterSpacing: 0.5 }}>
                      Let's Go
                    </Text>
                  </LinearGradient>
                </Pressable>
              )}
            </LinearGradient>
          </Animated.View>

          {confettiProgress.map((value, i) => {
            const screenW = Dimensions.get('window').width;
            const screenH = Dimensions.get('window').height;
            const startX = ((i * 41) % Math.round(screenW * 0.8)) - Math.round(screenW * 0.4);
            const endX = startX + ((i % 2 === 0 ? 1 : -1) * (30 + (i % 5) * 18));
            const rotate = `${(i % 6) * 60}deg`;
            return (
              <Animated.View
                key={`confetti-${i}`}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: '15%',
                  left: '50%',
                  width: i % 2 === 0 ? 10 : 8,
                  height: i % 2 === 0 ? 20 : 14,
                  borderRadius: 3,
                  backgroundColor: ['#60a5fa', '#22d3ee', '#a78bfa', '#facc15'][i % 4],
                  zIndex: 99999,
                  elevation: 99999,
                  opacity: value.interpolate({ inputRange: [0, 0.9, 1], outputRange: [0, 1, 0] }),
                  transform: [
                    { translateX: value.interpolate({ inputRange: [0, 1], outputRange: [startX, endX] }) },
                    { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [-60, screenH * 0.75] }) },
                    { rotate },
                  ],
                }}
              />
            );
          })}
        </Animated.View>
      )}
    </View>
  );
}
