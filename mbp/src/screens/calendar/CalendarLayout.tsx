import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { View, Text, ScrollView, Animated, PanResponder, TouchableOpacity, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTeams } from '../../contexts/TeamsContext';
import { Team } from '../../api/teams';
import { Skeleton } from '../../components/Skeleton';
import { Avatar } from '../../components/Avatar';
import { hapticLight } from '../../utils/haptics';
import { router } from 'expo-router';
import { IPAD_TAB_CONTENT_TOP_PADDING } from '../../config/layout';

const SIDEBAR_WIDTH = 240;
const BACKGROUND_COLOR = '#020617';
const MAX_TEAMS_VISIBLE = 4;

type ViewType = 'list' | 'day' | 'week' | 'month';

interface CalendarLayoutContextType {
  openSidebar: () => void;
  closeSidebar: () => void;
  navOpen: boolean;
}

const CalendarLayoutContext = createContext<CalendarLayoutContextType>({
  openSidebar: () => {},
  closeSidebar: () => {},
  navOpen: false,
});

export const useCalendarLayout = () => useContext(CalendarLayoutContext);

interface CalendarLayoutProps {
  children: React.ReactNode;
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  selectedTeamId: string;
  onTeamSelect: (teamId: string) => void;
  enabledEventTypes: Set<'practice' | 'match' | 'tournament' | 'other'>;
  onEventTypeToggle: (type: 'practice' | 'match' | 'tournament' | 'other') => void;
}

export default function CalendarLayout({ 
  children, 
  currentView, 
  onViewChange, 
  selectedTeamId, 
  onTeamSelect,
  enabledEventTypes,
  onEventTypeToggle
}: CalendarLayoutProps) {
  const insets = useSafeAreaInsets();
  const { teams, loading } = useTeams();
  
  const [navOpen, setNavOpen] = useState(false);

  const [dragX, setDragX] = useState(-SIDEBAR_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const dragXAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const visibleTeams = teams.slice(0, MAX_TEAMS_VISIBLE);
  const hasMoreTeams = teams.length > MAX_TEAMS_VISIBLE;

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
        const hamburgerTop = insets.top + 16;
        const hamburgerBottom = insets.top + 56;
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

  const viewOptions: { label: string; view: ViewType }[] = [
    { label: 'List', view: 'list' },
    { label: 'Day', view: 'day' },
    { label: 'Week', view: 'week' },
    { label: 'Month', view: 'month' },
  ];

  return (
    <CalendarLayoutContext.Provider value={{ openSidebar, closeSidebar, navOpen }}>
      <View
        className="flex-1"
        style={{
          backgroundColor: BACKGROUND_COLOR,
          paddingTop: Platform.OS === 'ios' && Platform.isPad ? IPAD_TAB_CONTENT_TOP_PADDING : 0,
        }}
      >
        {/* Main content */}
        <View 
          className="flex-1" 
          style={{ backgroundColor: BACKGROUND_COLOR }}
          {...panResponder.panHandlers}
        >
          {children}
        </View>

        {/* Backdrop overlay */}
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

        {/* Sidebar */}
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
            {/* Close button */}
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

            {/* View Options Section */}
            <View style={{ marginTop: 0, marginRight: 40 }}>
              {viewOptions.map(({ label, view }) => (
                <TouchableOpacity
                  key={view}
                  onPress={() => {
                    hapticLight();
                    onViewChange(view);
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
                    backgroundColor: currentView === view ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontWeight: '500',
                      fontSize: 14,
                      color: currentView === view ? 'white' : '#9ca3af',
                    }}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Horizontal Line */}
            <View style={{ 
              height: 1, 
              backgroundColor: 'rgba(255, 255, 255, 0.05)', 
              marginVertical: 16,
              marginRight: 40,
            }} />

            {/* Calendar Selection Section */}
            <View style={{ marginRight: 40 }}>
              {/* ALL */}
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  onTeamSelect('all');
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

              {/* PERSONAL */}
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  onTeamSelect('');
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

              {/* Teams */}
              {loading ? (
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
                        onTeamSelect(t.id.toString());
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
                        backgroundColor: selectedTeamId === t.id.toString() ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
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
                          color: selectedTeamId === t.id.toString() ? 'white' : '#9ca3af',
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
                            returnPath: '/(tabs)/calendar',
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

            {/* Horizontal Line */}
            <View style={{ 
              height: 1, 
              backgroundColor: 'rgba(255, 255, 255, 0.05)', 
              marginVertical: 16,
              marginRight: 40,
            }} />

            {/* Event Types Section */}
            <View style={{ marginRight: 40 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 8,
                  paddingHorizontal: 8,
                }}
              >
                Event Types
              </Text>
              
              {[
                { label: 'Practice', value: 'practice' as const, color: '#3b82f6' },
                { label: 'Match', value: 'match' as const, color: '#22c55e' },
                { label: 'Tournament', value: 'tournament' as const, color: '#fde047' },
                { label: 'Other', value: 'other' as const, color: '#6b7280' },
              ].map(({ label, value, color }) => {
                const isEnabled = enabledEventTypes.has(value);
                return (
                  <TouchableOpacity
                    key={value}
                    onPress={() => {
                      hapticLight();
                      onEventTypeToggle(value);
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
                    activeOpacity={0.7}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        borderWidth: 1.5,
                        borderColor: isEnabled ? color : 'rgba(255, 255, 255, 0.3)',
                        backgroundColor: isEnabled ? color : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isEnabled && (
                        <Feather name="check" size={12} color="#ffffff" />
                      )}
                    </View>
                    <Text
                      style={{
                        flex: 1,
                        fontWeight: '500',
                        fontSize: 14,
                        color: isEnabled ? 'white' : '#9ca3af',
                      }}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)', marginVertical: 12, marginRight: 40 }} />
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                closeSidebar();
                router.push('/help-calendar');
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

      </View>
    </CalendarLayoutContext.Provider>
  );
}
