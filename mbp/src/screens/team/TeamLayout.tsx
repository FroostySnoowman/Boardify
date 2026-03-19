import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { View, Text, ScrollView, Animated, PanResponder, TouchableOpacity, Pressable, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { syncChatParamsToUrl } from '../../utils/webUrlSync';
import { BlurView } from 'expo-blur';
import { useTeams } from '../../contexts/TeamsContext';
import { getTeam, Team } from '../../api/teams';
import { listConversations, Conversation, starConversation, unstarConversation } from '../../api/messages';
import { Skeleton } from '../../components/Skeleton';
import { Avatar } from '../../components/Avatar';
import { hapticLight } from '../../utils/haptics';
import { IPAD_TAB_CONTENT_TOP_PADDING } from '../../config/layout';
import { useChatAccess } from '../../components/ChatAccessGate';
import { useChatBlockedModal } from '../../contexts/ChatBlockedModalContext';
import { ContextMenu } from '../../components/ContextMenu';

const SIDEBAR_WIDTH = 240;
const BACKGROUND_COLOR = '#020617';
const MAX_TEAMS_VISIBLE = 4;

interface TeamLayoutContextType {
  openSidebar: () => void;
  closeSidebar: () => void;
  navOpen: boolean;
}

const TeamLayoutContext = createContext<TeamLayoutContextType>({
  openSidebar: () => {},
  closeSidebar: () => {},
  navOpen: false,
});

export const useTeamLayout = () => useContext(TeamLayoutContext);

interface TeamLayoutProps {
  children: React.ReactNode;
  onScreenChange?: (screen: 'chat' | 'calendar' | 'roster' | 'statistics') => void;
  currentScreen?: 'chat' | 'calendar' | 'roster' | 'statistics';
  hideFloatingHamburger?: boolean;
}

export default function TeamLayout({ children, onScreenChange, currentScreen = 'chat', hideFloatingHamburger = false }: TeamLayoutProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { teams, loading } = useTeams();
  const { canChat, reason } = useChatAccess();
  const { showChatBlocked } = useChatBlockedModal();

  const [navOpen, setNavOpen] = useState(false);
  const [teamsCollapsed, setTeamsCollapsed] = useState(false);
  const [chatsCollapsed, setChatsCollapsed] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);

  const [dragX, setDragX] = useState(-SIDEBAR_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const dragXAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isDraggingRef = useRef(false); // Use ref for immediate access in handlers

  // Get teamId from route params
  const teamId = (route.params as any)?.teamId;

  const visibleTeams = teams.slice(0, MAX_TEAMS_VISIBLE);
  const hasMoreTeams = teams.length > MAX_TEAMS_VISIBLE;

  const loadTeamData = useCallback(async () => {
    if (!teamId) return;
    setLoadingTeam(true);
    try {
      const [t, convs] = await Promise.all([
        getTeam(teamId),
        listConversations(teamId).catch((e: any) => { console.error('Failed to load conversations:', e); return [] as Conversation[]; })
      ]);
      setTeam(t);
      const group = convs.filter(c => c.type === 'group');
      group.sort((a, b) => {
        const aStarred = a.starred ? 1 : 0;
        const bStarred = b.starred ? 1 : 0;
        if (bStarred !== aStarred) return bStarred - aStarred;
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });
      setConversations(group);
    } catch (e: any) {
      console.error('Failed to load team:', e);
    } finally {
      setLoadingTeam(false);
    }
  }, [teamId]);

  const refreshConversations = useCallback(async () => {
    if (!teamId) return;
    try {
      const convs = await listConversations(teamId);
      const group = convs.filter(c => c.type === 'group');
      group.sort((a, b) => {
        const aStarred = a.starred ? 1 : 0;
        const bStarred = b.starred ? 1 : 0;
        if (bStarred !== aStarred) return bStarred - aStarred;
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      });
      setConversations(group);
    } catch (e) {
      console.error('Failed to refresh conversations:', e);
    }
  }, [teamId]);


  useEffect(() => {
    if (teamId) {
      loadTeamData();
    } else {
      setTeam(null);
      setConversations([]);
    }
  }, [teamId, loadTeamData]);

  // PanResponder for swipe navigation - with debug logging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        // Always track initial touch position (like web version)
        const touchX = evt.nativeEvent.pageX;
        const touchY = evt.nativeEvent.pageY;
        
        touchStartX.current = touchX;
        touchStartY.current = touchY;
        isDraggingRef.current = false;
        setIsDragging(false);
        
        return false; // Never capture on start, wait for movement
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Initialize if not already set
        if (touchStartX.current === null || touchStartY.current === null) {
          touchStartX.current = evt.nativeEvent.pageX;
          touchStartY.current = evt.nativeEvent.pageY;
        }
        
        const { dx, dy } = gestureState;
        const startX = touchStartX.current;
        const startY = touchStartY.current;
        const currentX = evt.nativeEvent.pageX;
        
        // If sidebar is open, don't capture touches within sidebar area (except for closing swipe)
        if (navOpen) {
          // If touch is within sidebar area (0 to SIDEBAR_WIDTH), only allow closing swipes
          if (currentX < SIDEBAR_WIDTH && dx >= 0) {
            return false;
          }
          // Allow closing swipe from anywhere
          if (dx < 0 && Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy) * 1.2) {
            isDraggingRef.current = true; // Set ref immediately
            setIsDragging(true);
            return true;
          }
          return false;
        }
        
        // Hamburger menu exclusion
        const hamburgerLeft = 16;
        const hamburgerRight = 56;
        const hamburgerTop = 16;
        const hamburgerBottom = 56;
        const isInHamburgerArea = 
          startX >= hamburgerLeft && 
          startX <= hamburgerRight && 
          startY >= hamburgerTop && 
          startY <= hamburgerBottom;
        
        // Match web version logic: check for horizontal swipe
        // For opening: swipe right from left edge (but not hamburger area)
        if (Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          if (dx > 0 && startX < 40 && !isInHamburgerArea) {
            // Opening: swipe right from left edge
            isDraggingRef.current = true; // Set ref immediately
            setIsDragging(true);
            return true;
          }
        }
        
        // If vertical scroll detected, cancel
        if (Math.abs(dy) > 20 && Math.abs(dy) > Math.abs(dx) * 2) {
          touchStartX.current = null;
          touchStartY.current = null;
          return false;
        }
        
        return false;
      },
      onPanResponderGrant: () => {
        // Gesture granted
      },
      onPanResponderMove: (evt, gestureState) => {
        // Use ref for immediate check instead of state
        if (touchStartX.current === null || touchStartY.current === null || !isDraggingRef.current) {
          return;
        }
        
        const { dx, dy } = gestureState;
        
        // If vertical movement becomes dominant, cancel the gesture
        if (Math.abs(dy) > Math.abs(dx) * 2 && Math.abs(dy) > 30) {
          isDraggingRef.current = false;
          setIsDragging(false);
          touchStartX.current = null;
          touchStartY.current = null;
          return;
        }
        
        // Calculate new position - match web version logic exactly
        let newX: number;
        if (navOpen) {
          // Starting from open (0), dragging left (negative dx)
          newX = dx;
          if (newX > 0) {
            // Dragging right past open - add resistance
            newX = newX * 0.25;
          }
        } else {
          // Starting from closed (-SIDEBAR_WIDTH), dragging right (positive dx)
          newX = -SIDEBAR_WIDTH + dx;
          if (newX < -SIDEBAR_WIDTH) {
            // Dragging left past closed - add resistance
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
        
        // Calculate final position based on current gesture state
        let finalX: number;
        if (navOpen) {
          // Starting from open (0), dragging left (negative dx)
          finalX = dx;
          if (finalX > 0) {
            // Dragging right past open - add resistance
            finalX = finalX * 0.25;
          }
        } else {
          // Starting from closed (-SIDEBAR_WIDTH), dragging right (positive dx)
          finalX = -SIDEBAR_WIDTH + dx;
          if (finalX < -SIDEBAR_WIDTH) {
            // Dragging left past closed - add resistance
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
        
        // Determine if should open or close based on final position (30% threshold like web)
        // Use the calculated finalX instead of dragX state
        if (clampedFinalX > -SIDEBAR_WIDTH * 0.3) {
          // Open
          setNavOpen(true);
          setDragX(0);
          Animated.spring(dragXAnim, {
            toValue: 0,
            useNativeDriver: false,
            tension: 65,
            friction: 11,
          }).start();
        } else {
          // Close
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

  return (
    <TeamLayoutContext.Provider value={{ openSidebar, closeSidebar, navOpen }}>
      <View
        className="flex-1"
        style={{
          backgroundColor: BACKGROUND_COLOR,
          paddingTop: Platform.OS === 'ios' && Platform.isPad ? IPAD_TAB_CONTENT_TOP_PADDING : 0,
        }}
      >
        {/* Main content - should not be affected by sidebar */}
        <View 
          className="flex-1" 
          style={{ backgroundColor: BACKGROUND_COLOR }}
          {...panResponder.panHandlers}
        >
          {children}
          {/* Floating hamburger menu - overlays content */}
          {!navOpen && !hideFloatingHamburger && (
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                openSidebar();
              }}
              className="absolute left-4 z-40 p-2 rounded-lg bg-black/80 backdrop-blur-sm border border-white/10"
              style={{
                top: 16,
                elevation: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
              }}
            >
              <Feather name="menu" size={20} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>

      {/* Backdrop overlay - positioned absolutely to overlay content, but below sidebar */}
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

      {/* Sidebar - positioned absolutely to overlay content */}
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

          {/* Teams section - no top margin */}
          <TouchableOpacity
            onPress={() => setTeamsCollapsed(!teamsCollapsed)}
            style={{ 
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              height: 36,
              marginTop: 0,
              marginRight: 40,
              paddingTop: 0,
            }}
          >
            {teamsCollapsed ? (
              <Feather name="chevron-right" size={16} color="#9ca3af" />
            ) : (
              <Feather name="chevron-down" size={16} color="#9ca3af" />
            )}
            <Text style={{ fontWeight: '600', fontSize: 14, color: 'white' }}>Teams</Text>
          </TouchableOpacity>

          {!teamsCollapsed && (
            <View style={{ marginBottom: 16 }}>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg mb-1" />
                ))
              ) : teams.length === 0 ? (
                <Text style={{ fontSize: 14, fontStyle: 'italic', color: '#9ca3af', paddingHorizontal: 16, paddingTop: 8 }}>No teams yet</Text>
              ) : (
                <>
                  {visibleTeams.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      onPress={() => {
                        closeSidebar();
                        if (t.id === teamId) {
                          // If clicking the already selected team, go back to dashboard
                          (navigation as any).navigate('TeamDashboard');
                        } else {
                          // Otherwise, navigate to the new team
                          (navigation as any).navigate('TeamDetail', { teamId: t.id });
                        }
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
                        backgroundColor: t.id === teamId ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      }}
                    >
                      <Avatar
                        src={t.imageUrl}
                        alt={t.name}
                        size="sm"
                        iconColorStart={t.iconColorStart}
                        iconColorEnd={t.iconColorEnd}
                      />
                      <Text
                        style={{
                          flex: 1,
                          fontWeight: '500',
                          fontSize: 14,
                          color: t.id === teamId ? 'white' : '#9ca3af',
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
                            currentTeamId: teamId,
                            returnPath: '/(tabs)/teams',
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
          )}

          {/* Team-specific sections */}
          {teamId && team && (
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
            <View className="flex-row items-center gap-2 px-2 mb-4">
              <Avatar
                src={team.imageUrl}
                alt={team.name}
                size="xs"
                iconColorStart={team.iconColorStart}
                iconColorEnd={team.iconColorEnd}
              />
              <Text className="flex-1 text-xs font-semibold text-white" numberOfLines={1}>
                {team.name}
              </Text>
            </View>

            {/* Chats section */}
            <TouchableOpacity
              onPress={() => setChatsCollapsed(!chatsCollapsed)}
              className="w-full flex-row items-center justify-between px-2 py-1.5 mb-2"
            >
              <Text className="text-xs text-gray-400 uppercase tracking-wider font-semibold">CHATS</Text>
              {chatsCollapsed ? (
                <Feather name="chevron-right" size={14} color="#6b7280" />
              ) : (
                <Feather name="chevron-down" size={14} color="#6b7280" />
              )}
            </TouchableOpacity>

            {!chatsCollapsed && (
              <View className="mb-4">
                {/* General chat - always shown at top */}
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    closeSidebar();
                    if (!canChat && reason) {
                      showChatBlocked(reason);
                      return;
                    }
                    const generalConv = conversations.find(c => c.name?.toLowerCase() === 'general');
                    if (generalConv) {
                      syncChatParamsToUrl(generalConv.id, 'general');
                      (navigation as any).navigate('ChatRoom', {
                        teamId,
                        convId: generalConv.id,
                        conversationName: 'general',
                      });
                    }
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 6,
                    paddingHorizontal: 8,
                    borderRadius: 6,
                    marginBottom: 2,
                    backgroundColor: (route.params as any)?.conversationName === 'general'
                      ? 'rgba(255,255,255,0.1)'
                      : (conversations.find(c => c.name?.toLowerCase() === 'general')?.unreadCount ?? 0) > 0
                        ? 'rgba(59,130,246,0.06)'
                        : 'transparent',
                  }}
                >
                  <Feather
                    name="message-circle"
                    size={14}
                    color={(route.params as any)?.conversationName === 'general' ? '#ffffff' :
                      (conversations.find(c => c.name?.toLowerCase() === 'general')?.unreadCount ?? 0) > 0 ? '#60a5fa' : '#9ca3af'}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontWeight: (conversations.find(c => c.name?.toLowerCase() === 'general')?.unreadCount ?? 0) > 0 ? '700' : '500',
                      fontSize: 12,
                      color: (route.params as any)?.conversationName === 'general' ? '#ffffff' :
                        (conversations.find(c => c.name?.toLowerCase() === 'general')?.unreadCount ?? 0) > 0 ? '#e2e8f0' : '#9ca3af',
                    }}
                  >
                    General
                  </Text>
                  {(() => {
                    const generalUnread = conversations.find(c => c.name?.toLowerCase() === 'general')?.unreadCount ?? 0;
                    if (generalUnread <= 0) return null;
                    return (
                      <View style={{
                        minWidth: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: '#3b82f6',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 5,
                      }}>
                        <Text style={{ fontSize: 10, color: '#ffffff', fontWeight: '800', lineHeight: 12 }}>
                          {generalUnread > 99 ? '99+' : generalUnread}
                        </Text>
                      </View>
                    );
                  })()}
                </TouchableOpacity>

                {/* Other group chats */}
                {loadingTeam ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full rounded-md mb-1" />
                  ))
                ) : conversations.length > 0 ? (
                  conversations
                    .filter(conv => conv.name?.toLowerCase() !== 'general')
                    .map(conv => {
                      const isActive = (route.params as any)?.convId === conv.id;
                      return (
                        <ContextMenu
                          key={conv.id}
                          activationMethod="longPress"
                          onSinglePress={() => {
                            hapticLight();
                            closeSidebar();
                            if (!canChat && reason) {
                              showChatBlocked(reason);
                              return;
                            }
                            syncChatParamsToUrl(conv.id, conv.name || 'general');
                            (navigation as any).navigate('ChatRoom', {
                              teamId,
                              convId: conv.id,
                              conversationName: conv.name || 'general',
                            });
                          }}
                          options={[
                            {
                              label: conv.starred ? 'Unstar' : 'Star',
                              value: 'star',
                              onPress: async () => {
                                hapticLight();
                                const nextStarred = !conv.starred;
                                setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, starred: nextStarred } : c).sort((a, b) => {
                                  const aStarred = a.starred ? 1 : 0;
                                  const bStarred = b.starred ? 1 : 0;
                                  if (bStarred !== aStarred) return bStarred - aStarred;
                                  return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
                                }));
                                try {
                                  if (nextStarred) await starConversation(conv.id);
                                  else await unstarConversation(conv.id);
                                } catch {
                                  setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, starred: !nextStarred } : c));
                                }
                              },
                            },
                          ]}
                          trigger={
                            <TouchableOpacity
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 8,
                                paddingVertical: 6,
                                paddingHorizontal: 8,
                                borderRadius: 6,
                                marginBottom: 2,
                                backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : (conv.unreadCount > 0 ? 'rgba(59,130,246,0.06)' : 'transparent'),
                              }}
                            >
                              <Feather name="message-circle" size={14} color={isActive ? '#ffffff' : conv.unreadCount > 0 ? '#60a5fa' : '#9ca3af'} />
                              {conv.starred && (
                                <Feather name="star" size={12} color="#fbbf24" fill="#fbbf24" />
                              )}
                              <Text
                                style={{
                                  flex: 1,
                                  fontWeight: conv.unreadCount > 0 ? '700' : '500',
                                  fontSize: 12,
                                  color: isActive ? '#ffffff' : conv.unreadCount > 0 ? '#e2e8f0' : '#9ca3af',
                                }}
                                numberOfLines={1}
                              >
                                {conv.name}
                              </Text>
                              {conv.unreadCount > 0 && (
                                <View style={{
                                  minWidth: 18,
                                  height: 18,
                                  borderRadius: 9,
                                  backgroundColor: '#3b82f6',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  paddingHorizontal: 5,
                                }}>
                                  <Text style={{ fontSize: 10, color: '#ffffff', fontWeight: '800', lineHeight: 12 }}>
                                    {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                  </Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          }
                        />
                      );
                    })
                ) : null}
                
                {/* Create Chat button */}
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    if (!canChat && reason) {
                      showChatBlocked(reason);
                      return;
                    }
                    router.push(`/create-group-chat?teamId=${teamId}`);
                  }}
                  className="w-full flex-row items-center gap-2 py-1.5 px-2 rounded-md mt-2"
                >
                  <Feather name="plus" size={14} color="#9ca3af" />
                  <Text className="font-medium text-xs text-gray-400">Create Chat</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Tools section */}
            <Text className="text-xs text-gray-400 uppercase tracking-wider font-semibold px-2 mb-2">TOOLS</Text>
            <View className="mb-4">
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  closeSidebar();
                  onScreenChange?.('calendar');
                }}
                className={`flex-row items-center gap-2 py-1.5 px-2 rounded-md mb-1 ${
                  currentScreen === 'calendar' ? 'bg-white/10' : ''
                }`}
              >
                <Feather 
                  name="calendar" 
                  size={14} 
                  color={currentScreen === 'calendar' ? '#ffffff' : '#9ca3af'} 
                />
                <Text className={`font-medium text-xs ${
                  currentScreen === 'calendar' ? 'text-white' : 'text-gray-400'
                }`}>
                  Calendar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  closeSidebar();
                  onScreenChange?.('roster');
                }}
                className={`flex-row items-center gap-2 py-1.5 px-2 rounded-md mb-1 ${
                  currentScreen === 'roster' ? 'bg-white/10' : ''
                }`}
              >
                <Feather 
                  name="users" 
                  size={14} 
                  color={currentScreen === 'roster' ? '#ffffff' : '#9ca3af'} 
                />
                <Text className={`font-medium text-xs ${
                  currentScreen === 'roster' ? 'text-white' : 'text-gray-400'
                }`}>
                  Roster
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  closeSidebar();
                  onScreenChange?.('statistics');
                }}
                className={`flex-row items-center gap-2 py-1.5 px-2 rounded-md mb-1 ${
                  currentScreen === 'statistics' ? 'bg-white/10' : ''
                }`}
              >
                <Feather 
                  name="bar-chart-2" 
                  size={14} 
                  color={currentScreen === 'statistics' ? '#ffffff' : '#9ca3af'} 
                />
                <Text className={`font-medium text-xs ${
                  currentScreen === 'statistics' ? 'text-white' : 'text-gray-400'
                }`}>
                  Statistics
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          )}

          {/* Create Team button */}
          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 16, marginTop: 16 }}>
            <TouchableOpacity
              onPress={() => {
                closeSidebar();
                router.push('/create-team');
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8 }}
            >
              <Feather name="plus" size={20} color="#9ca3af" />
              <Text style={{ fontWeight: '500', fontSize: 14, color: '#9ca3af' }}>Create Team</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)', marginVertical: 12 }} />
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              closeSidebar();
              router.push('/help-team');
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8 }}
          >
            <Feather name="help-circle" size={14} color="#9ca3af" />
            <Text style={{ fontWeight: '500', fontSize: 14, color: '#9ca3af' }}>Help</Text>
          </TouchableOpacity>
          </ScrollView>
        </View>
      </Animated.View>


      </View>
    </TeamLayoutContext.Provider>
  );
}