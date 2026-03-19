import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  Pressable,
  Platform,
  PanResponder,
  RefreshControl,
} from 'react-native';
import { IPAD_TAB_CONTENT_TOP_PADDING, TAB_HEADER_HEIGHT } from '../config/layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTeams } from '../contexts/TeamsContext';
import { useNetwork } from '../contexts/NetworkContext';
import { listMembers, Member } from '../api/teams';
import { Skeleton } from '../components/Skeleton';
import { Avatar } from '../components/Avatar';
import { hapticLight } from '../utils/haptics';
import ScorecardPage from './spectate/ScorecardPage';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { router } from 'expo-router';

const BACKGROUND_COLOR = '#020617';
const SIDEBAR_WIDTH = 240;
const MAX_VISIBLE_TEAMS = 4;
const SEARCH_AREA_HEIGHT = 72;

export default function SpectateScreen() {
  const insets = useSafeAreaInsets();
  const { teams, loading: teamsLoading, refresh } = useTeams();
  const { isOnline } = useNetwork();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [dragX, setDragX] = useState(-SIDEBAR_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const dragXAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const hasInitiallyScrolled = useRef(false);
  const navPressInProgress = useRef(false);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const [showStreamDialog, setShowStreamDialog] = useState(false);

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

  const visibleTeams = teams.slice(0, MAX_VISIBLE_TEAMS);
  const hasMoreTeams = teams.length > MAX_VISIBLE_TEAMS;

  const onRefresh = async () => {
    setRefreshing(true);
    hapticLight();
    try {
      await refresh();
      setRefreshTrigger(t => t + 1);
    } finally {
      setRefreshing(false);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        const touchX = evt.nativeEvent.pageX;
        const touchY = evt.nativeEvent.pageY;
        
        touchStartX.current = touchX;
        touchStartY.current = touchY;
        isDraggingRef.current = false;
        setIsDragging(false);
        
        return false;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (touchStartX.current === null || touchStartY.current === null) {
          touchStartX.current = evt.nativeEvent.pageX;
          touchStartY.current = evt.nativeEvent.pageY;
        }
        
        const { dx, dy } = gestureState;
        const startX = touchStartX.current;
        const startY = touchStartY.current;
        const currentX = evt.nativeEvent.pageX;
        
        if (navOpen) {
          if (currentX < SIDEBAR_WIDTH && dx >= 0) {
            return false;
          }
          if (dx < 0 && Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            isDraggingRef.current = true;
            setIsDragging(true);
            return true;
          }
          return false;
        }
        
        const hamburgerLeft = 16;
        const hamburgerRight = 56;
        const hamburgerTop = 16;
        const hamburgerBottom = 56;
        const isInHamburgerArea = 
          startX >= hamburgerLeft && 
          startX <= hamburgerRight && 
          startY >= hamburgerTop && 
          startY <= hamburgerBottom;
        
        if (Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          if (dx > 0 && startX < 40 && !isInHamburgerArea) {
            isDraggingRef.current = true;
            setIsDragging(true);
            return true;
          }
        }
        
        if (Math.abs(dy) > 20 && Math.abs(dy) > Math.abs(dx) * 2) {
          touchStartX.current = null;
          touchStartY.current = null;
          return false;
        }
        
        return false;
      },
      onPanResponderGrant: () => {},
      onPanResponderMove: (evt, gestureState) => {
        if (touchStartX.current === null || touchStartY.current === null || !isDraggingRef.current) {
          return;
        }
        
        const { dx, dy } = gestureState;
        
        if (Math.abs(dy) > Math.abs(dx) * 2 && Math.abs(dy) > 30) {
          isDraggingRef.current = false;
          setIsDragging(false);
          touchStartX.current = null;
          touchStartY.current = null;
          return;
        }
        
        let newX: number;
        if (navOpen) {
          newX = dx;
          if (newX > 0) {
            newX = newX * 0.25;
          }
        } else {
          newX = -SIDEBAR_WIDTH + dx;
          if (newX < -SIDEBAR_WIDTH) {
            const over = -SIDEBAR_WIDTH - newX;
            newX = -SIDEBAR_WIDTH - over * 0.25;
          }
        }
        
        const minX = -SIDEBAR_WIDTH;
        const maxX = 0;
        const clampedX = Math.max(minX, Math.min(maxX, newX));
        setDragX(clampedX);
        dragXAnim.setValue(clampedX);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { dx } = gestureState;
        
        let finalX: number;
        if (navOpen) {
          finalX = dx;
          if (finalX > 0) {
            finalX = finalX * 0.25;
          }
        } else {
          finalX = -SIDEBAR_WIDTH + dx;
          if (finalX < -SIDEBAR_WIDTH) {
            const over = -SIDEBAR_WIDTH - finalX;
            finalX = -SIDEBAR_WIDTH - over * 0.25;
          }
        }
        
        const minX = -SIDEBAR_WIDTH;
        const maxX = 0;
        const clampedFinalX = Math.max(minX, Math.min(maxX, finalX));
        
        if (touchStartX.current === null || touchStartY.current === null) {
          isDraggingRef.current = false;
          setIsDragging(false);
          return;
        }
        
        if (!isDraggingRef.current) {
          touchStartX.current = null;
          touchStartY.current = null;
          return;
        }
        
        isDraggingRef.current = false;
        setIsDragging(false);
        
        if (clampedFinalX > -SIDEBAR_WIDTH * 0.3) {
          setNavOpen(true);
          setDragX(0);
          Animated.spring(dragXAnim, {
            toValue: 0,
            useNativeDriver: false,
            tension: 65,
            friction: 11,
          }).start();
        } else {
          setNavOpen(false);
          setDragX(-SIDEBAR_WIDTH);
          Animated.spring(dragXAnim, {
            toValue: -SIDEBAR_WIDTH,
            useNativeDriver: false,
            tension: 65,
            friction: 11,
          }).start();
        }
        
        touchStartX.current = null;
        touchStartY.current = null;
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        setIsDragging(false);
        touchStartX.current = null;
        touchStartY.current = null;
      },
    })
  ).current;

  const openSidebar = () => {
    setNavOpen(true);
    Animated.spring(dragXAnim, {
      toValue: 0,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
    setDragX(0);
  };

  const closeSidebar = () => {
    setNavOpen(false);
    Animated.spring(dragXAnim, {
      toValue: -SIDEBAR_WIDTH,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
    setDragX(-SIDEBAR_WIDTH);
  };

  useEffect(() => {
    const loadMembers = async () => {
      if (!selectedTeamId || selectedTeamId === 'all' || selectedTeamId === '') {
        setMembers([]);
        return;
      }
      setLoadingMembers(true);
      try {
        const teamMembers = await listMembers(selectedTeamId);
        setMembers(teamMembers);
      } catch (err) {
        console.error('Failed to load team members:', err);
        setMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };
    loadMembers();
    setSelectedMemberFilter('all');
  }, [selectedTeamId]);


  const MemberFilterBar = () => {
    if (selectedTeamId !== 'all' && selectedTeamId !== '') {
      return null;
    }

    if (loadingMembers || members.length === 0) {
      return null;
    }

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 8 }}
        className="mb-6"
      >
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            setSelectedMemberFilter('all');
          }}
          className={`px-4 py-2 rounded-full ${
            selectedMemberFilter === 'all' ? 'bg-blue-500' : 'bg-white/10'
          }`}
          activeOpacity={0.7}
        >
          <Text
            className={`text-sm font-semibold ${
              selectedMemberFilter === 'all' ? 'text-white' : 'text-gray-300'
            }`}
          >
            All
          </Text>
        </TouchableOpacity>

        {members.map(member => (
          <TouchableOpacity
            key={member.id}
            onPress={() => {
              hapticLight();
              setSelectedMemberFilter(member.id);
            }}
            className={`px-4 py-2 rounded-full ${
              selectedMemberFilter === member.id ? 'bg-blue-500' : 'bg-white/10'
            }`}
            activeOpacity={0.7}
          >
            <Text
              className={`text-sm font-semibold ${
                selectedMemberFilter === member.id ? 'text-white' : 'text-gray-300'
              }`}
            >
              {member.username || 'Unknown'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: BACKGROUND_COLOR,
        paddingTop: Platform.OS === 'ios' && Platform.isPad ? IPAD_TAB_CONTENT_TOP_PADDING : 0,
      }}
    >
      <LinearGradient
        colors={['rgba(0, 6, 42, 0.5)', 'rgba(0, 0, 0, 0.3)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {navOpen && (
        <Pressable
          className="absolute inset-0"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 20,
            elevation: 20,
          }}
          onPress={closeSidebar}
        >
          <BlurView intensity={20} className="absolute inset-0" />
        </Pressable>
      )}

      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: SIDEBAR_WIDTH,
          transform: [{ translateX: dragXAnim }],
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          borderRightWidth: 1,
          borderRightColor: 'rgba(255, 255, 255, 0.05)',
          zIndex: 30,
          elevation: 30,
        }}
        pointerEvents={navOpen ? 'auto' : 'none'}
      >
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              closeSidebar();
            }}
            style={{ 
              position: 'absolute',
              right: 16,
              top: 8,
              padding: 8,
              zIndex: 50,
              elevation: 50,
            }}
            activeOpacity={0.7}
          >
            <Feather name="x" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingTop: 8,
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 16,
            }}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >

          <View style={{ marginTop: 0, marginRight: 40 }}>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setSelectedTeamId('all');
                closeSidebar();
              }}
              style={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 8,
                paddingHorizontal: 8,
                borderRadius: 8,
                marginBottom: 4,
                backgroundColor: selectedTeamId === 'all' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontWeight: '500',
                  fontSize: 14,
                  color: selectedTeamId === 'all' ? 'white' : '#9ca3af',
                }}
              >
                ALL
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setSelectedTeamId('');
                closeSidebar();
              }}
              style={{
                width: '100%',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 8,
                paddingHorizontal: 8,
                borderRadius: 8,
                marginBottom: 4,
                backgroundColor: selectedTeamId === '' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontWeight: '500',
                  fontSize: 14,
                  color: selectedTeamId === '' ? 'white' : '#9ca3af',
                }}
              >
                PERSONAL
              </Text>
            </TouchableOpacity>

            {teamsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg mb-1" />
              ))
            ) : teams.length === 0 ? (
              <Text style={{ fontSize: 14, fontStyle: 'italic', color: '#9ca3af', paddingHorizontal: 8, paddingTop: 8 }}>
                No teams yet
              </Text>
            ) : (
              <>
                {visibleTeams.map(t => (
                  <TouchableOpacity
                    key={t.id}
                    onPress={() => {
                      hapticLight();
                      setSelectedTeamId(t.id);
                      closeSidebar();
                    }}
                    style={{
                      width: '100%',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 8,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      marginBottom: 4,
                      backgroundColor: selectedTeamId === t.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    }}
                  >
                    <Avatar
                      src={t.imageUrl}
                      alt={t.name}
                      size="sm"
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontWeight: '500',
                        fontSize: 14,
                        color: selectedTeamId === t.id ? 'white' : '#9ca3af',
                      }}
                      numberOfLines={1}
                    >
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                {hasMoreTeams && (
                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      router.push({
                        pathname: '/all-teams',
                        params: {
                          currentTeamId: selectedTeamId,
                          returnPath: '/(tabs)/spectate',
                        },
                      });
                    }}
                    style={{
                      width: '100%',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 8,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      marginBottom: 4,
                    }}
                  >
                    <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18, color: '#9ca3af' }}>...</Text>
                    </View>
                    <Text style={{ flex: 1, fontWeight: '500', fontSize: 14, color: '#9ca3af' }}>More teams</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)', marginVertical: 12, marginRight: 40 }} />
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              closeSidebar();
              router.push('/help-spectate');
            }}
            style={{
              width: '100%',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 8,
              paddingHorizontal: 8,
              borderRadius: 8,
              marginBottom: 4,
              marginRight: 40,
            }}
            activeOpacity={0.7}
          >
            <Feather name="help-circle" size={14} color="#9ca3af" />
            <Text style={{ flex: 1, fontWeight: '500', fontSize: 14, color: '#9ca3af' }}>Help</Text>
          </TouchableOpacity>
          </ScrollView>
        </View>
      </Animated.View>

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
            router.push('/search-matches');
            setTimeout(() => { navPressInProgress.current = false; }, 500);
          }}
          className="flex-1 px-5 py-2.5 rounded-lg bg-white/10 min-h-[44px] flex-row items-center justify-center gap-2"
        >
          <Feather name="search" size={16} color="#ffffff" />
          <Text className="text-sm font-semibold text-white">Search Matches</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            hapticLight();
            setShowStreamDialog(true);
          }}
          activeOpacity={0.9}
          style={{ overflow: 'hidden', borderRadius: 9999, flexShrink: 0 }}
        >
          <LinearGradient
            colors={['#3730a3', '#2a2680']}
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
            <Feather name="video" size={16} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>New Stream</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 24,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 24,
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
        {...panResponder.panHandlers}
      >
        <MemberFilterBar />

        {!isOnline ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 24 }}>
            <View style={{ width: 80, height: 80, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Feather name="wifi-off" size={40} color="#9ca3af" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '600', color: '#d1d5db', marginBottom: 12, textAlign: 'center' }}>You're offline</Text>
            <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', maxWidth: 280 }}>Connect to internet to view live matches</Text>
          </View>
        ) : (
          <ScorecardPage 
            teamId={selectedTeamId} 
            selectedMemberFilter={selectedMemberFilter}
            refreshTrigger={refreshTrigger}
            showStreamDialog={showStreamDialog}
            setShowStreamDialog={setShowStreamDialog}
          />
        )}
        <KeyboardSpacer extraOffset={72} />
      </ScrollView>
    </View>
  );
}
