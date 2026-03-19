import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, SectionList, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { listTeamEvents, EventType, listRsvps, RSVPResponse, rsvpEvent } from '../../api/calendar';
import { expandRecurringEventsForDateRange } from '../../utils/expandRecurringEvents';
import { Skeleton } from '../../components/Skeleton';
import ListPage, { CalendarSection } from '../calendar/ListPage';
import MonthPage from '../calendar/MonthPage';
import WeekPage from '../calendar/WeekPage';
import DayPage from '../calendar/DayPage';
import CalendarLayout, { useCalendarLayout } from '../calendar/CalendarLayout';
import { hapticLight } from '../../utils/haptics';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { listMembers } from '../../api/teams';
import { ContextMenu } from '../../components/ContextMenu';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

type ViewType = 'list' | 'month' | 'week' | 'day';

interface TeamCalendarScreenProps {
  teamId?: string;
}

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function TeamCalendarScreen({ teamId }: TeamCalendarScreenProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const currentUserId = user ? parseInt(user.id) : 0;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [rawEvents, setRawEvents] = useState<EventType[]>([]);
  const [events, setEvents] = useState<EventType[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [rsvps, setRsvps] = useState<Record<number | string, { yes: string[]; no: string[] }>>({});
  const [currentView, setCurrentView] = useState<ViewType>('list');
  const [loading, setLoading] = useState(true);
  const [canManageEvents, setCanManageEvents] = useState(false);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const listRef = useRef<SectionList<EventType, CalendarSection>>(null);
  const navPressInProgress = useRef(false);
  const LIST_CONTENT_PADDING_TOP = 16;
  const [showReturnButton, setShowReturnButton] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const lastListScrollRef = useRef({ scrollY: 0, contentHeight: 0 });

  const LIST_WINDOW_DAYS_INITIAL = 60;
  const LIST_WINDOW_DAYS_EXTEND = 30;
  const LIST_WINDOW_DAYS_MAX = 120;
  const getInitialListWindow = useCallback(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - Math.floor(LIST_WINDOW_DAYS_INITIAL / 2));
    const end = new Date(now);
    end.setDate(end.getDate() + Math.floor(LIST_WINDOW_DAYS_INITIAL / 2));
    return { start, end };
  }, []);
  const [listWindow, setListWindow] = useState<{ start: Date; end: Date }>(getInitialListWindow);
  const listLoadMoreInProgress = useRef(false);
  const listScrollPreserveRef = useRef<{ scrollY: number; contentHeight: number; extend: 'bottom' | 'top' } | null>(null);
  const prevViewRef = useRef<ViewType>(currentView);

  const listHadInitialScrollRef = useRef(false);
  useEffect(() => {
    if (prevViewRef.current !== 'list' && currentView === 'list') {
      setListWindow(getInitialListWindow());
      listHadInitialScrollRef.current = false;
    }
    prevViewRef.current = currentView;
  }, [currentView, getInitialListWindow]);
  const [enabledEventTypes, setEnabledEventTypes] = useState<Set<'practice' | 'match' | 'tournament' | 'other'>>(
    new Set(['practice', 'match', 'tournament', 'other'])
  );

  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      setPermissionsLoaded(true);
      return;
    }

    setPermissionsLoaded(false);
    if (!user) {
      setCanManageEvents(false);
      setPermissionsLoaded(true);
    } else {
      listMembers(teamId)
        .then(members => {
          const role = members.find(m => m.id === user.id)?.role.toLowerCase();
          setCanManageEvents(role === 'owner' || role === 'coach');
          setPermissionsLoaded(true);
        })
        .catch((e: any) => {
          if (!/not authorized/i.test(e.message)) {
            console.error('Failed to load members:', e);
          }
          setCanManageEvents(false);
          setPermissionsLoaded(true);
        });
    }

    loadEvents();
  }, [teamId, user]);

  const loadEvents = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const ev = await listTeamEvents(teamId);
      setRawEvents(ev);

      const rsvpPromises = ev.map(e =>
        listRsvps(e.id).then(rs => ({ id: e.id, rsvps: rs })).catch(() => ({ id: e.id, rsvps: { yes: [], no: [] } }))
      );
      const rsvpResults = await Promise.all(rsvpPromises);
      const rsvpMap: Record<number | string, { yes: string[]; no: string[] }> = {};
      rsvpResults.forEach(({ id, rsvps }) => {
        rsvpMap[id] = rsvps;
      });
      setRsvps(rsvpMap);
    } catch (err: any) {
      console.error('Failed to load team events:', err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents])
  );

  const handleEventTypeToggle = (type: 'practice' | 'match' | 'tournament' | 'other') => {
    setEnabledEventTypes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (rawEvents.length === 0) {
      setEvents([]);
      return;
    }

    let startDate: Date;
    let endDate: Date;

    if (currentView === 'month') {
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      startDate = new Date(monthStart);
      startDate.setMonth(startDate.getMonth() - 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      endDate = new Date(monthEnd);
      endDate.setMonth(endDate.getMonth() + 1);
    } else if (currentView === 'week') {
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay());
      startDate = weekStart;
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 21);
      endDate = weekEnd;
    } else if (currentView === 'day') {
      const dayStart = selectedDate ?? currentDate;
      startDate = new Date(dayStart);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(dayStart);
      endDate.setHours(23, 59, 59, 999);
    } else if (currentView === 'list') {
      startDate = new Date(listWindow.start);
      endDate = new Date(listWindow.end);
    } else {
      const now = new Date();
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 3);
      endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 6);
    }

    const expanded = expandRecurringEventsForDateRange(rawEvents, startDate, endDate);
    const filtered = expanded.filter(event => enabledEventTypes.has(event.type));
    setEvents(filtered);
  }, [rawEvents, currentDate, currentView, selectedDate, enabledEventTypes, listWindow]);

  const handleRSVP = async (eventId: number | string, response: RSVPResponse) => {
    hapticLight();
    try {
      const event = events.find(e => e.id === eventId);
      const eventIdForRsvp = event && (event as any).originalEventId ? (event as any).originalEventId : eventId;
      await rsvpEvent(eventIdForRsvp, response);
      const rs = await listRsvps(eventIdForRsvp);
      setRsvps(prev => ({ ...prev, [eventIdForRsvp]: rs }));
    } catch (err: any) {
      console.error('Failed to update RSVP:', err);
    }
  };

  const openEvent = (e: EventType) => {
    if (canManageEvents && e.editable) {
      hapticLight();
      router.push({
        pathname: '/edit-event',
        params: {
          eventId: e.id.toString(),
          teamId: teamId || ''
        },
      });
    }
  };

  const handleNewEvent = () => {
    if (!canManageEvents) return;
    hapticLight();
    router.push({
      pathname: '/new-event',
      params: {
        teamId: teamId || ''
      }
    });
  };

  const openDay = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(date);
  };

  if (!teamId) {
    return (
      <View className="flex-1 items-center justify-center bg-[#020617]">
        <Text className="text-gray-400">No team selected</Text>
      </View>
    );
  }

  const activeDate = selectedDate ?? currentDate;
  const eventsForDay = events.filter(e => e.date === formatDate(activeDate));

  return (
    <CalendarLayout
      currentView={currentView}
      onViewChange={setCurrentView}
      selectedTeamId={teamId}
      onTeamSelect={() => { }}
      enabledEventTypes={enabledEventTypes}
      onEventTypeToggle={handleEventTypeToggle}
    >
      <View className="relative flex-1" style={{ backgroundColor: '#020617' }}>
        <View className="h-16 border-b border-white/5 bg-[#020617] flex-row items-center gap-3 px-6 flex-shrink-0">
          <View style={{ flexShrink: 0 }}>
            <ContextMenu
              options={[
                { label: 'List', value: 'list', onPress: () => { hapticLight(); setCurrentView('list'); } },
                { label: 'Day', value: 'day', onPress: () => { hapticLight(); setCurrentView('day'); } },
                { label: 'Week', value: 'week', onPress: () => { hapticLight(); setCurrentView('week'); } },
                { label: 'Month', value: 'month', onPress: () => { hapticLight(); setCurrentView('month'); } },
              ]}
              trigger={
                <TouchableOpacity
                  className="p-2 rounded-lg"
                  activeOpacity={0.7}
                >
                  <Feather name="filter" size={24} color="#ffffff" />
                </TouchableOpacity>
              }
            />
          </View>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              if (navPressInProgress.current) return;
              navPressInProgress.current = true;
              router.push({
                pathname: '/search-events',
                params: { teamId: teamId || '' },
              });
              setTimeout(() => { navPressInProgress.current = false; }, 500);
            }}
            className="flex-1 px-5 py-2.5 rounded-lg bg-white/10 min-h-[44px] flex-row items-center justify-center gap-2"
            style={{ marginRight: canManageEvents ? 0 : 0 }}
          >
            <Feather name="search" size={16} color="#ffffff" />
            <Text className="text-sm font-semibold text-white">Search Events</Text>
          </TouchableOpacity>
          {permissionsLoaded && canManageEvents && (
            <TouchableOpacity
              onPress={handleNewEvent}
              activeOpacity={0.9}
              style={{ overflow: 'hidden', borderRadius: 9999, flexShrink: 0 }}
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
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>New Event</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>
        {currentView === 'list' && events.length > 0 && showReturnButton && (
          <View className="absolute top-16 left-0 right-0 z-50 items-center" style={{ paddingTop: 8 }}>
            <Pressable
              onPress={() => {
                if (listRef.current) {
                  hapticLight();
                  setShowReturnButton(false);
                  listRef.current.scrollToLocation({
                    sectionIndex: 0,
                    itemIndex: 0,
                    viewPosition: 0,
                    viewOffset: LIST_CONTENT_PADDING_TOP,
                    animated: true,
                  });
                }
              }}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.97 : 1 }],
                overflow: 'hidden',
                borderRadius: 9999,
                borderWidth: 1,
                borderColor: 'rgba(34, 197, 94, 0.3)',
              })}
            >
              {isLiquidGlassAvailable() ? (
                <GlassView
                  isInteractive
                  tintColor="rgba(34, 197, 94, 0.12)"
                  style={returnToEventGlassStyles.glass}
                >
                  <Text className="text-sm font-semibold text-white">Return to Next Event</Text>
                </GlassView>
              ) : (
                <View style={returnToEventGlassStyles.fallback}>
                  <Text className="text-sm font-semibold text-white">Return to Next Event</Text>
                </View>
              )}
            </Pressable>
          </View>
        )}

        {loading ? (
          <View className="flex-1 gap-3 px-4 pt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </View>
        ) : currentView === 'list' ? (
          <ListPage
            events={events}
            onEventClick={openEvent}
            currentUserId={currentUserId}
            rsvps={rsvps}
            onRSVP={handleRSVP}
            listRef={listRef}
            onEndReached={() => {
              if (listLoadMoreInProgress.current) return;
              listLoadMoreInProgress.current = true;
              listScrollPreserveRef.current = {
                scrollY: lastListScrollRef.current.scrollY,
                contentHeight: lastListScrollRef.current.contentHeight,
                extend: 'bottom',
              };
              setListWindow((prev) => {
                const windowMs = prev.end.getTime() - prev.start.getTime();
                const windowDays = windowMs / (24 * 60 * 60 * 1000);
                const end = new Date(prev.end);
                end.setDate(end.getDate() + LIST_WINDOW_DAYS_EXTEND);
                if (windowDays >= LIST_WINDOW_DAYS_MAX) {
                  const start = new Date(end);
                  start.setDate(start.getDate() - LIST_WINDOW_DAYS_MAX);
                  return { start, end };
                }
                return { start: prev.start, end };
              });
              setTimeout(() => { listLoadMoreInProgress.current = false; }, 600);
            }}
            onStartReached={() => {
              if (listLoadMoreInProgress.current) return;
              listLoadMoreInProgress.current = true;
              listScrollPreserveRef.current = {
                scrollY: lastListScrollRef.current.scrollY,
                contentHeight: lastListScrollRef.current.contentHeight,
                extend: 'top',
              };
              setListWindow((prev) => {
                const windowMs = prev.end.getTime() - prev.start.getTime();
                const windowDays = windowMs / (24 * 60 * 60 * 1000);
                const start = new Date(prev.start);
                start.setDate(start.getDate() - LIST_WINDOW_DAYS_EXTEND);
                if (windowDays >= LIST_WINDOW_DAYS_MAX) {
                  const end = new Date(start);
                  end.setDate(end.getDate() + LIST_WINDOW_DAYS_MAX);
                  return { start, end };
                }
                return { start, end: prev.end };
              });
              setTimeout(() => { listLoadMoreInProgress.current = false; }, 600);
            }}
            onNextEventSectionVisible={(visible) => setShowReturnButton(!visible)}
            onListReady={() => {
              if (Platform.OS === 'web') return;
              if (!listHadInitialScrollRef.current && listRef.current) {
                listHadInitialScrollRef.current = true;
                listRef.current.scrollToLocation({
                  sectionIndex: 0,
                  itemIndex: 0,
                  viewPosition: 0,
                  viewOffset: LIST_CONTENT_PADDING_TOP,
                  animated: false,
                });
              }
            }}
            onContentSizeChange={(_w, h) => {
              const preserve = listScrollPreserveRef.current;
              if (!preserve || !listRef.current) {
                listScrollPreserveRef.current = null;
                return;
              }
              const delta = h - preserve.contentHeight;
              listScrollPreserveRef.current = null;
              if (delta <= 0) return;
              if (preserve.extend === 'bottom') {
                (listRef.current as any).scrollToOffset?.({ offset: preserve.scrollY + delta, animated: false });
              }
            }}
            onScroll={(e) => {
              const { contentOffset, contentSize } = e.nativeEvent;
              lastListScrollRef.current = { scrollY: contentOffset.y, contentHeight: contentSize.height };
              setScrollY(contentOffset.y);
            }}
            contentContainerStyle={{
              paddingTop: 16,
              paddingBottom: insets.bottom + 120,
              paddingHorizontal: 16,
            }}
          />
        ) : (
          <>
            {currentView === 'month' && (
                <MonthPage
                  currentDate={currentDate}
                  events={events}
                  onPrevMonth={() =>
                    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
                  }
                  onNextMonth={() =>
                    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
                  }
                  onOpenDay={openDay}
                  onEventClick={openEvent}
                />
              )}
              {currentView === 'week' && (
                <WeekPage
                  currentDate={currentDate}
                  events={events}
                  onPrevWeek={() => setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000))}
                  onNextWeek={() => setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000))}
                  onOpenDay={openDay}
                  onEventClick={openEvent}
                />
              )}
              {currentView === 'day' && (
                <DayPage
                  currentDate={currentDate}
                  selectedDate={selectedDate}
                  eventsForDay={eventsForDay}
                  onPrevDay={() => {
                    const ref = selectedDate ?? currentDate;
                    const nd = new Date(ref.getTime() - 86400000);
                    setCurrentDate(nd);
                    setSelectedDate(nd);
                  }}
                  onNextDay={() => {
                    const ref = selectedDate ?? currentDate;
                    const nd = new Date(ref.getTime() + 86400000);
                    setCurrentDate(nd);
                    setSelectedDate(nd);
                  }}
                  onEventClick={openEvent}
                  onAddEvent={(date: Date) => {
                    if (!canManageEvents) return;
                    const dateStr = formatDate(date);
                    router.push({
                      pathname: '/new-event',
                      params: {
                        date: dateStr,
                        teamId: teamId || ''
                      }
                    });
                  }}
                />
              )}
            </>
        )}
      </View>
    </CalendarLayout>
  );
}

const returnToEventGlassStyles = StyleSheet.create({
  glass: {
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  fallback: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: 9999,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
});
