import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Alert, ActivityIndicator, Platform, Pressable, Animated, Easing, LayoutChangeEvent, Dimensions, PanResponder, GestureResponderEvent, PanResponderGestureState, StyleSheet, ActionSheetIOS, SectionList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import ListPage, { CalendarSection } from './calendar/ListPage';
import MonthPage from './calendar/MonthPage';
import WeekPage from './calendar/WeekPage';
import DayPage from './calendar/DayPage';
import CalendarLayout, { useCalendarLayout } from './calendar/CalendarLayout';
import { EventType, RSVPResponse, listMyEvents, listAllEvents, listTeamEvents, createEvent, createTeamEvent, updateEvent, updateTeamEvent, deleteEvent, deleteTeamEvent, rsvpEvent, listRsvps, listRsvpsBulk } from '../api/calendar';
import { expandRecurringEventsForDateRange } from '../utils/expandRecurringEvents';
import { listMyTeams, Team } from '../api/teams';
import { useAuth } from '../contexts/AuthContext';
import { useNetwork } from '../contexts/NetworkContext';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { isNetworkError } from '../utils/networkError';
import { formatTimeForDisplay } from '../utils/dateUtils';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ContextMenu } from '../components/ContextMenu';
import { TAB_HEADER_HEIGHT } from '../config/layout';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

type ViewType = 'list' | 'month' | 'week' | 'day';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function CalendarHeader({ 
  insets, 
  selectedTeamId, 
  setCurrentDate, 
  setSelectedDate, 
  formatDate,
  router,
  onSearchPress,
  onNewEventPress
}: { 
  insets: any; 
  selectedTeamId: string; 
  setCurrentDate: (date: Date) => void; 
  setSelectedDate: (date: Date) => void; 
  formatDate: (date: Date) => string; 
  router: any;
  onSearchPress: () => void;
  onNewEventPress: () => void;
}) {
  const { navOpen, openSidebar } = useCalendarLayout();
  
  return (
    <View 
      className="border-b border-white/5 bg-[#020617] flex-row items-center gap-3 px-6 flex-shrink-0"
      style={{ height: TAB_HEADER_HEIGHT, paddingTop: 2, paddingBottom: 2 }}
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
          onSearchPress();
        }}
        className="flex-1 px-5 py-2.5 rounded-lg bg-white/10 min-h-[44px] flex-row items-center justify-center gap-2"
      >
        <Feather name="search" size={16} color="#ffffff" />
        <Text className="text-sm font-semibold text-white">Search Events</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onNewEventPress}
        activeOpacity={0.9}
        style={{ overflow: 'hidden', borderRadius: 9999 }}
      >
        <LinearGradient
          colors={['#22c55e', '#10b981']}
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
    </View>
  );
}
const SHEET_START = SCREEN_HEIGHT + 160;
const BACKGROUND_COLOR = '#020617';

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={styles.closeButtonCircle}>
        <Text style={styles.closeButtonX}>✕</Text>
      </View>
    </Pressable>
  );
}

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ selectedTeamId?: string }>();
  const { user, loading: authLoading } = useAuth();
  const { isOnline } = useNetwork();
  const currentUserId = user ? parseInt(user.id) : 1;
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const lastSelectedTeamIdRef = React.useRef<string | undefined>(undefined);
  useEffect(() => {
    if (params.selectedTeamId && params.selectedTeamId !== lastSelectedTeamIdRef.current) {
      lastSelectedTeamIdRef.current = params.selectedTeamId;
      setSelectedTeamId(params.selectedTeamId);
    }
  }, [params.selectedTeamId]);
 
  const [currentDate, setCurrentDate] = useState(new Date());
  const [rawEvents, setRawEvents] = useState<EventType[]>([]);
  const [events, setEvents] = useState<EventType[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [draftEvent, setDraftEvent] = useState<EventType | null>(null);
  const [isNewEvent, setIsNewEvent] = useState(false);
  const [rsvps, setRsvps] = useState<Record<number | string, { yes: string[]; no: string[] }>>({});
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('10:00');
  const [isDatePickerFocused, setIsDatePickerFocused] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [currentView, setCurrentView] = useState<ViewType>('list');
  const [enabledEventTypes, setEnabledEventTypes] = useState<Set<'practice' | 'match' | 'tournament' | 'other'>>(
    new Set(['practice', 'match', 'tournament', 'other'])
  );
  const shouldReopenDetailModal = useRef(false);

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
  const shouldRefreshRef = React.useRef(true);
  const lastCalendarFetchRef = useRef(0);
  const isOpeningEventRef = useRef(false);
  const isAddingEventRef = useRef(false);
  const isNavigatingToNewEventRef = useRef(false);
  const navPressInProgress = useRef(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [selectedDateValue, setSelectedDateValue] = useState(new Date());
  const [selectedStartTime, setSelectedStartTime] = useState(new Date());
  const [selectedEndTime, setSelectedEndTime] = useState(new Date());
  const detailSlideAnim = useRef(new Animated.Value(SHEET_START)).current;
  const detailOpacity = useRef(new Animated.Value(0)).current;
  const detailPanY = useRef(new Animated.Value(0)).current;
  const daySlideAnim = useRef(new Animated.Value(SHEET_START)).current;
  const dayOpacity = useRef(new Animated.Value(0)).current;
  const dayPanY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (authLoading) {
      return;
    }
    
    const fetchTeams = async () => {
      try {
        setTeamsLoading(true);
        const teamsData = await listMyTeams();
        setTeams(teamsData);
      } catch (err: any) {
        if (!authLoading && err.message !== 'Not authenticated' && !isNetworkError(err)) {
          Alert.alert('Error', err.message || 'Failed to load teams.');
        }
      } finally {
        setTeamsLoading(false);
      }
    };
    fetchTeams();
  }, [authLoading]);

  const fetchAllEvents = React.useCallback(async () => {
    if (authLoading) {
      return;
    }
    
    try {
      if (selectedTeamId === 'all') {
        const allEvents = await listAllEvents();
        setRawEvents(allEvents);
        
        const eventIds = allEvents.map(e => e.id);
        if (eventIds.length > 0) {
          try {
            const rsvpsMap = await listRsvpsBulk(eventIds);
            const rsvpsMapCompat: Record<number | string, { yes: string[]; no: string[] }> = {};
            Object.keys(rsvpsMap).forEach(key => {
              rsvpsMapCompat[key] = rsvpsMap[parseInt(key, 10)];
            });
            setRsvps(rsvpsMapCompat);
          } catch (err) {
            console.error('Failed to fetch RSVPs:', err);
            const emptyRsvps: Record<number, { yes: string[]; no: string[] }> = {};
            eventIds.forEach(id => {
              emptyRsvps[id] = { yes: [], no: [] };
            });
            setRsvps(emptyRsvps);
          }
        } else {
          setRsvps({});
        }
      } else if (selectedTeamId) {
        const ev = await listTeamEvents(selectedTeamId);
        setRawEvents(ev);
        
        const eventIds = ev.map(e => e.id);
        if (eventIds.length > 0) {
          try {
            const rsvpsMap = await listRsvpsBulk(eventIds);
            const rsvpsMapCompat: Record<number | string, { yes: string[]; no: string[] }> = {};
            Object.keys(rsvpsMap).forEach(key => {
              rsvpsMapCompat[key] = rsvpsMap[parseInt(key, 10)];
            });
            setRsvps(rsvpsMapCompat);
          } catch (err) {
            console.error('Failed to fetch RSVPs:', err);
            const emptyRsvps: Record<number, { yes: string[]; no: string[] }> = {};
            eventIds.forEach(id => {
              emptyRsvps[id] = { yes: [], no: [] };
            });
            setRsvps(emptyRsvps);
          }
        } else {
          setRsvps({});
        }
      } else {
        const ev = await listMyEvents();
        setRawEvents(ev);
        
        const eventIds = ev.map(e => e.id);
        if (eventIds.length > 0) {
          try {
            const rsvpsMap = await listRsvpsBulk(eventIds);
            const rsvpsMapCompat: Record<number | string, { yes: string[]; no: string[] }> = {};
            Object.keys(rsvpsMap).forEach(key => {
              rsvpsMapCompat[key] = rsvpsMap[parseInt(key, 10)];
            });
            setRsvps(rsvpsMapCompat);
          } catch (err) {
            console.error('Failed to fetch RSVPs:', err);
            const emptyRsvps: Record<number, { yes: string[]; no: string[] }> = {};
            eventIds.forEach(id => {
              emptyRsvps[id] = { yes: [], no: [] };
            });
            setRsvps(emptyRsvps);
          }
        } else {
          setRsvps({});
        }
      }
    } catch (err: any) {
      if (!authLoading && err.message !== 'Not authenticated' && !isNetworkError(err)) {
        Alert.alert('Error', err.message || 'Failed to load events.');
      }
    }
  }, [selectedTeamId, authLoading]);

  useEffect(() => {
    fetchAllEvents();
  }, [fetchAllEvents]);

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

  const prevViewRef = useRef<ViewType>(currentView);
  const listHadInitialScrollRef = useRef(false);
  useEffect(() => {
    if (prevViewRef.current !== 'list' && currentView === 'list') {
      setListWindow(getInitialListWindow());
      listHadInitialScrollRef.current = false;
    }
    prevViewRef.current = currentView;
  }, [currentView, getInitialListWindow]);

  useEffect(() => {
    if (rawEvents.length === 0) {
      setEvents([]);
      return;
    }

    let startDate: Date;
    let endDate: Date;

    if (currentView === 'month') {
      startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0);
    } else if (currentView === 'week') {
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay() - 7);
      startDate = weekStart;
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 21);
      endDate = weekEnd;
    } else if (currentView === 'list') {
      startDate = new Date(listWindow.start);
      endDate = new Date(listWindow.end);
    } else if (currentView === 'day') {
      const dayRef = selectedDate ?? currentDate;
      startDate = new Date(dayRef);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(dayRef);
      endDate.setHours(23, 59, 59, 999);
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
  }, [rawEvents, currentDate, currentView, enabledEventTypes, listWindow, selectedDate]);


  useFocusEffect(
    React.useCallback(() => {
      if (!authLoading) {
        const now = Date.now();
        const stale = now - lastCalendarFetchRef.current >= 30_000;
        if (shouldRefreshRef.current || stale) {
          shouldRefreshRef.current = false;
          lastCalendarFetchRef.current = now;
          fetchAllEvents();
        }
      }
    }, [authLoading, fetchAllEvents])
  );

  function formatDate(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const handleNewEventPress = () => {
    if (isNavigatingToNewEventRef.current) {
      return;
    }
    isNavigatingToNewEventRef.current = true;
    
    hapticLight();
    shouldRefreshRef.current = true;
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
    const dateStr = formatDate(now);
    router.push(`/new-event?date=${dateStr}&teamId=${selectedTeamId}`);
    
    setTimeout(() => {
      isNavigatingToNewEventRef.current = false;
    }, 1000);
  };

  function openDay(dayOrDate: number | Date) {
    let date: Date;
    if (dayOrDate instanceof Date) {
      date = dayOrDate;
    } else {
      date = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayOrDate);
    }
    setSelectedDate(date);
    hapticLight();
    const dateStr = formatDate(date);
    router.push({
      pathname: '/day-events',
      params: {
        date: dateStr,
        ...(selectedTeamId && selectedTeamId !== 'all' ? { teamId: selectedTeamId } : {}),
      },
    });
  }

  function addEvent(dateOverride?: Date) {
    if (isAddingEventRef.current) {
      return;
    }
    isAddingEventRef.current = true;
    
    const baseDate = dateOverride || selectedDate || new Date();
    const dateStr = formatDate(baseDate);
    const now = new Date();
    const startTimeDate = new Date(now);
    startTimeDate.setHours(9, 0, 0, 0);
    const endTimeDate = new Date(now);
    endTimeDate.setHours(10, 0, 0, 0);
    
    setDraftEvent({
      id: 0,
      title: '',
      type: 'practice',
      date: dateStr,
      time: '',
      location: '',
      color: '',
      createdBy: currentUserId,
      editable: true
    });
    setStartTime('09:00');
    setEndTime('10:00');
    setSelectedDateValue(new Date(baseDate));
    setSelectedStartTime(startTimeDate);
    setSelectedEndTime(endTimeDate);
    setIsNewEvent(true);
    setDetailOpen(true);
    requestAnimationFrame(() => {
      detailPanY.setValue(0);
      animateDetailIn();
    });
    setTimeout(() => {
      isAddingEventRef.current = false;
    }, 500);
  }

  function openEvent(e: EventType) {
    if (isOpeningEventRef.current) {
      return;
    }
    isOpeningEventRef.current = true;
    
    const originalEventId = (e as any).originalEventId || e.id;
    const actualEventId = typeof originalEventId === 'string' && originalEventId.includes('_') 
      ? parseInt(originalEventId.split('_')[0], 10)
      : (typeof originalEventId === 'number' ? originalEventId : parseInt(String(originalEventId), 10));
    
    let eventTeamId = e.teamId || (selectedTeamId !== 'all' && selectedTeamId !== '' ? selectedTeamId : '');
    if (!eventTeamId) {
      const originalEvent = rawEvents.find(re => re.id === actualEventId);
      if (originalEvent && originalEvent.teamId) {
        eventTeamId = originalEvent.teamId;
      }
    }
    
    hapticLight();
    shouldRefreshRef.current = true;
    router.push({
      pathname: '/event-detail',
      params: {
        eventId: actualEventId.toString(),
        ...(eventTeamId ? { teamId: eventTeamId } : {}),
      },
    });
    setTimeout(() => {
      isOpeningEventRef.current = false;
    }, 1000);
  }

  function updateDraft(field: keyof EventType, value: string | number) {
    if (!draftEvent) return;
    setDraftEvent({ ...draftEvent, [field]: value });
  }

  async function handleSave() {
    if (!draftEvent) return;
    hapticLight();
    setSavingEvent(true);
    const timeRange = startTime && endTime
      ? `${startTime} - ${endTime}`
      : draftEvent.time;
    draftEvent.time = timeRange;
    try {
      if (isNewEvent) {
        const isValidTeamId = selectedTeamId !== 'all' && 
                              selectedTeamId !== '' && 
                              teams.some(t => String(t.id) === selectedTeamId);
        
        let created: EventType;
        if (isValidTeamId) {
          created = await createTeamEvent(
            selectedTeamId,
            draftEvent.title,
            draftEvent.type,
            draftEvent.date,
            draftEvent.time,
            draftEvent.location,
            draftEvent.color
          );
        } else {
          created = await createEvent(
            draftEvent.title,
            draftEvent.type,
            draftEvent.date,
            draftEvent.time,
            draftEvent.location,
            draftEvent.color
          );
        }
        setRawEvents(prev => [...prev, created]);
        hideDetail();
        refreshEventsInBackground();
      } else {
        const updated = selectedTeamId !== 'all' && selectedTeamId !== ''
          ? await updateTeamEvent(selectedTeamId, draftEvent)
          : await updateEvent(draftEvent);
        setRawEvents(prev => prev.map(e => e.id === draftEvent.id ? updated : e));
        hideDetail();
        refreshEventsInBackground();
      }
    } catch (err: any) {
      if (!isNetworkError(err)) {
        Alert.alert('Error', err.message || 'An unexpected error occurred while saving the event.');
      }
    } finally {
      setSavingEvent(false);
    }
  }

  function refreshEventsInBackground() {
    (async () => {
      try {
        let refreshed: EventType[];
        if (selectedTeamId === 'all') {
          refreshed = await listAllEvents();
        } else if (selectedTeamId) {
          refreshed = await listTeamEvents(selectedTeamId);
        } else {
          refreshed = await listMyEvents();
        }
        setRawEvents(refreshed);
        const eventIds = refreshed.map(e => e.id);
        if (eventIds.length > 0) {
          try {
            const rsvpsMap = await listRsvpsBulk(eventIds);
            const rsvpsMapCompat: Record<number | string, { yes: string[]; no: string[] }> = {};
            Object.keys(rsvpsMap).forEach(key => {
              rsvpsMapCompat[key] = rsvpsMap[parseInt(key, 10)];
            });
            setRsvps(rsvpsMapCompat);
          } catch (err) {
            console.error('Failed to fetch RSVPs:', err);
          }
        }
      } catch (err) {
        console.error('Background event refresh failed:', err);
      }
    })();
  }

  async function handleDelete(e: EventType) {
    try {
      if (selectedTeamId !== 'all' && selectedTeamId !== '') {
        await deleteTeamEvent(selectedTeamId, e.id);
      } else {
        await deleteEvent(e.id);
      }
      setEvents(ev => ev.filter(x => x.id !== e.id));
      setDetailOpen(false);
      setDraftEvent(null);
    } catch (err: any) {
      if (!isNetworkError(err)) {
        Alert.alert('Error', err.message || 'Failed to delete the event.');
      }
    }
  }

  async function handleRSVP(eventId: number | string, response: RSVPResponse) {
    hapticLight();
    try {
      const event = events.find(e => e.id === eventId);
      const eventIdForRsvp = event && (event as any).originalEventId ? (event as any).originalEventId : eventId;
      await rsvpEvent(eventIdForRsvp, response);
      const rs = await listRsvps(eventIdForRsvp);
      setRsvps(prev => ({ ...prev, [eventIdForRsvp]: rs }));
    } catch (err: any) {
      if (!isNetworkError(err)) {
        Alert.alert('Error', err.message || 'Failed to update RSVP.');
      }
    }
  }

  const activeDate = selectedDate ?? currentDate;
  const eventsForDay = events.filter(e => e.date === formatDate(activeDate));

  const animateDetailIn = React.useCallback(() => {
    Animated.parallel([
      Animated.timing(detailSlideAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(detailOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [detailSlideAnim, detailOpacity]);

  const hideDetail = React.useCallback(() => {
    detailPanY.setValue(0);
    Animated.parallel([
      Animated.timing(detailSlideAnim, {
        toValue: SHEET_START,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(detailOpacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDetailOpen(false);
      setDraftEvent(null);
    });
  }, [detailSlideAnim, detailOpacity, detailPanY]);

  const animateDayIn = React.useCallback(() => {
    Animated.parallel([
      Animated.timing(daySlideAnim, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dayOpacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [daySlideAnim, dayOpacity]);

  const hideDay = React.useCallback(() => {
    dayPanY.setValue(0);
    Animated.parallel([
      Animated.timing(daySlideAnim, {
        toValue: SHEET_START,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dayOpacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalOpen(false);
    });
  }, [daySlideAnim, dayOpacity, dayPanY]);

  const detailPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) =>
        Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        detailPanY.setValue(0);
      },
      onPanResponderMove: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
        if (gesture.dy > 0) {
          detailPanY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
        if (gesture.dy > 45 || gesture.vy > 0.22) {
          hideDetail();
        } else {
          Animated.spring(detailPanY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    })
  ).current;

  const dayPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) =>
        Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        dayPanY.setValue(0);
      },
      onPanResponderMove: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
        if (gesture.dy > 0) {
          dayPanY.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
        if (gesture.dy > 45 || gesture.vy > 0.22) {
          hideDay();
        } else {
          Animated.spring(dayPanY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    })
  ).current;

  const LIST_CONTENT_PADDING_TOP = 16;
  const listRef = useRef<SectionList<EventType, CalendarSection>>(null);
  const [showReturnButton, setShowReturnButton] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const lastListScrollRef = useRef({ scrollY: 0, contentHeight: 0 });

  return (
    <>
    <CalendarLayout
      currentView={currentView}
      onViewChange={setCurrentView}
      selectedTeamId={selectedTeamId}
      onTeamSelect={setSelectedTeamId}
      enabledEventTypes={enabledEventTypes}
      onEventTypeToggle={handleEventTypeToggle}
    >
      <CalendarHeader 
        insets={insets}
        selectedTeamId={selectedTeamId}
        setCurrentDate={setCurrentDate}
        setSelectedDate={setSelectedDate}
        formatDate={formatDate}
        router={router}
        onSearchPress={() => {
          hapticLight();
          if (navPressInProgress.current) return;
          navPressInProgress.current = true;
          router.push({
            pathname: '/search-events',
            params: { teamId: selectedTeamId },
          });
          setTimeout(() => { navPressInProgress.current = false; }, 500);
        }}
        onNewEventPress={handleNewEventPress}
      />
      
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
                style={styles.returnToEventGlass}
              >
                <Text className="text-sm font-semibold text-white">Return to Next Event</Text>
              </GlassView>
            ) : (
              <View style={styles.returnToEventGlassFallback}>
                <Text className="text-sm font-semibold text-white">Return to Next Event</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}
      
      <View className="relative flex-1" style={{ backgroundColor: '#020617' }}>
        <LinearGradient
          colors={['rgba(0, 6, 42, 0.5)', 'rgba(0, 0, 0, 0.3)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="absolute inset-0"
        />

        {!isOnline ? (
          <View className="flex-1 items-center justify-center px-6">
            <View className="w-20 h-20 bg-white/5 rounded-full items-center justify-center mb-6">
              <Feather name="wifi-off" size={40} color="#9ca3af" />
            </View>
            <Text className="text-xl font-semibold text-gray-300 mb-3 text-center">You're offline</Text>
            <Text className="text-sm text-gray-500 text-center max-w-xs">Connect to internet to view upcoming events</Text>
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
                  return { start, end: prev.end };
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
        ) : currentView === 'month' ? (
          <View className="flex-1">
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
          </View>
        ) : currentView === 'week' ? (
          <View className="flex-1">
            <WeekPage
              currentDate={currentDate}
              events={events}
              onPrevWeek={() => setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000))}
              onNextWeek={() => setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000))}
              onOpenDay={openDay}
              onEventClick={openEvent}
            />
          </View>
        ) : currentView === 'day' ? (
          <View className="flex-1">
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
                const dateStr = formatDate(date);
                router.push(`/new-event?date=${dateStr}&teamId=${selectedTeamId}`);
              }}
            />
          </View>
        ) : null}
      </View>
    </CalendarLayout>

      <Modal
        visible={modalOpen}
        transparent
        animationType="none"
        onRequestClose={hideDay}
        statusBarTranslucent
      >
        <Animated.View
          style={[
            styles.sheetOverlay,
            {
              opacity: dayOpacity,
            },
          ]}
        >
          <Pressable 
            style={StyleSheet.absoluteFill}
            onPress={hideDay}
          />
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                transform: [{ translateY: Animated.add(daySlideAnim, dayPanY) }],
              },
            ]}
          >
            <View style={styles.closeButtonContainer}>
              <CloseButton onPress={hideDay} />
            </View>
            <View style={styles.handleBarContainer}>
              <View style={styles.handleBar} />
            </View>
            <View style={styles.settingsContent}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ 
                paddingHorizontal: 24, 
                paddingBottom: Math.max(40, insets.bottom + 20)
              }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ marginBottom: 16 }}>
                <Text className="text-2xl font-bold text-center text-white">
                  {selectedDate?.toDateString()}
                </Text>
              </View>
              <TouchableOpacity
                className="items-center mb-6"
                onPress={() => {
                  if (isNavigatingToNewEventRef.current) {
                    return;
                  }
                  isNavigatingToNewEventRef.current = true;
                  
                  hapticLight();
                  const dateStr = formatDate(selectedDate || new Date());
                  router.push(`/new-event?date=${dateStr}&teamId=${selectedTeamId}`);
                  
                  setTimeout(() => {
                    isNavigatingToNewEventRef.current = false;
                  }, 1000);
                }}
                activeOpacity={0.8}
                style={{ overflow: 'hidden', borderRadius: 9999 }}
              >
                <LinearGradient
                  colors={['#22c55e', '#10b981']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather name="plus" size={24} color="#ffffff" />
                </LinearGradient>
              </TouchableOpacity>
              <View>
                {eventsForDay.length > 0 ? (
                  eventsForDay.map(e => {
                    const originalEventId = (e as any).originalEventId || e.id;
                    const resp = rsvps[originalEventId] || { yes: [], no: [] };
                    return (
                      <TouchableOpacity
                        key={e.id}
                        className="p-4 rounded-lg bg-white/5 border border-white/10 mb-4"
                        onPress={() => openEvent(e)}
                        activeOpacity={0.7}
                      >
                        <View className="flex-row items-center justify-between mb-2">
                          <Text className="font-semibold text-lg text-white">{e.title}</Text>
                          <Text className="text-sm text-gray-400">{formatTimeForDisplay(e.time)}</Text>
                        </View>
                        <View className="flex-row items-center gap-4 mb-2">
                          <Feather name="map-pin" size={20} color="#9ca3af" />
                          <Text className="text-sm text-gray-300">{e.location}</Text>
                        </View>
                        <View className="flex-row items-center justify-between gap-2">
                          <TouchableOpacity
                            style={{
                              flex: 1,
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 9999,
                              backgroundColor: resp.yes.includes(String(currentUserId)) ? '#15803d' : '#16a34a',
                              borderWidth: resp.yes.includes(String(currentUserId)) ? 2 : 0,
                              borderColor: resp.yes.includes(String(currentUserId)) ? '#4ade80' : 'transparent',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onPress={(ev) => {
                              ev.stopPropagation();
                              handleRSVP(e.id, 'yes');
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>Yes</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{
                              flex: 1,
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 9999,
                              backgroundColor: resp.no.includes(String(currentUserId)) ? '#991b1b' : '#dc2626',
                              borderWidth: resp.no.includes(String(currentUserId)) ? 2 : 0,
                              borderColor: resp.no.includes(String(currentUserId)) ? '#f87171' : 'transparent',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onPress={(ev) => {
                              ev.stopPropagation();
                              handleRSVP(e.id, 'no');
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>No</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text className="text-center text-gray-400">No events</Text>
                )}
              </View>
            </ScrollView>
          </View>
          <View
            style={styles.dragZone}
            {...dayPanResponder.panHandlers}
          />
        </Animated.View>
      </Animated.View>
      </Modal>

      <Modal
        visible={detailOpen}
        transparent
        animationType="none"
        onRequestClose={hideDetail}
        statusBarTranslucent
      >
        <Animated.View
          style={[
            styles.sheetOverlay,
            {
              opacity: detailOpacity,
            },
          ]}
        >
          <Pressable 
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!isDatePickerFocused) {
                hideDetail();
              }
            }}
          />
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                transform: [{ translateY: Animated.add(detailSlideAnim, detailPanY) }],
              },
            ]}
          >
            <View style={styles.closeButtonContainer}>
              <CloseButton onPress={hideDetail} />
            </View>
            <View style={styles.handleBarContainer}>
              <View style={styles.handleBar} />
            </View>
            <View style={styles.settingsContent}>
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ 
                  paddingHorizontal: 24, 
                  paddingBottom: 16,
                }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              >
                <View className="gap-4">
                  {draftEvent && (
                    <View className="gap-4">
                      <View style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        marginBottom: 16,
                      }}>
                        <Text className="text-2xl font-bold text-white" style={{ flex: 1 }}>
                          {isNewEvent ? 'Create Event' : 'Event Details'}
                        </Text>
                      </View>

                    {!isNewEvent && draftEvent.editable && (
                      <View className="bg-white/5 rounded-lg p-4 gap-3">
                        <Text className="text-sm text-gray-400">Respond to this event:</Text>
                        <View className="flex-row gap-2">
                          <TouchableOpacity
                            style={{
                              flex: 1,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                              paddingHorizontal: 16,
                              paddingVertical: 10,
                              borderRadius: 8,
                              minHeight: 44,
                              backgroundColor: rsvps[draftEvent.id]?.yes.includes(String(currentUserId))
                                ? '#16a34a'
                                : 'rgba(255, 255, 255, 0.05)',
                              borderWidth: rsvps[draftEvent.id]?.yes.includes(String(currentUserId)) ? 2 : 0,
                              borderColor: rsvps[draftEvent.id]?.yes.includes(String(currentUserId)) ? '#4ade80' : 'transparent',
                            }}
                            onPress={() => handleRSVP(draftEvent.id, 'yes')}
                            activeOpacity={0.8}
                          >
                            <Feather
                              name="check-circle"
                              size={16}
                              color={rsvps[draftEvent.id]?.yes.includes(String(currentUserId)) ? '#ffffff' : '#d1d5db'}
                            />
                            <Text style={{
                              fontSize: 14,
                              fontWeight: '500',
                              color: rsvps[draftEvent.id]?.yes.includes(String(currentUserId)) ? '#ffffff' : '#d1d5db',
                            }}>
                              Going
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{
                              flex: 1,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                              paddingHorizontal: 16,
                              paddingVertical: 10,
                              borderRadius: 8,
                              minHeight: 44,
                              backgroundColor: rsvps[draftEvent.id]?.no.includes(String(currentUserId))
                                ? '#dc2626'
                                : 'rgba(255, 255, 255, 0.05)',
                              borderWidth: rsvps[draftEvent.id]?.no.includes(String(currentUserId)) ? 2 : 0,
                              borderColor: rsvps[draftEvent.id]?.no.includes(String(currentUserId)) ? '#f87171' : 'transparent',
                            }}
                            onPress={() => handleRSVP(draftEvent.id, 'no')}
                            activeOpacity={0.8}
                          >
                            <Feather
                              name="x-circle"
                              size={16}
                              color={rsvps[draftEvent.id]?.no.includes(String(currentUserId)) ? '#ffffff' : '#d1d5db'}
                            />
                            <Text style={{
                              fontSize: 14,
                              fontWeight: '500',
                              color: rsvps[draftEvent.id]?.no.includes(String(currentUserId)) ? '#ffffff' : '#d1d5db',
                            }}>
                              Not Going
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {rsvps[draftEvent.id] && (rsvps[draftEvent.id].yes.length > 0 || rsvps[draftEvent.id].no.length > 0) && (
                          <View className="pt-2 border-t border-white/10">
                            <View className="flex-row items-center justify-between">
                              <Text className="text-sm text-gray-400">Responses:</Text>
                              <View className="flex-row items-center gap-3">
                                <Text className="text-sm text-green-400">
                                  {rsvps[draftEvent.id].yes.length} Going
                                </Text>
                                <Text className="text-sm text-blue-400">
                                  {rsvps[draftEvent.id].no.length} Not Going
                                </Text>
                              </View>
                            </View>
                          </View>
                        )}
                      </View>
                    )}

                    <View className="gap-3">
                      <View>
                        <Text className="block text-gray-300 text-sm mb-2">Calendar</Text>
                        {isNewEvent ? (
                          <ContextMenu
                            options={[
                              { label: 'Personal', value: '', onPress: () => setSelectedTeamId('') },
                              ...teams.map(team => ({
                                label: team.name,
                                value: String(team.id),
                                onPress: () => setSelectedTeamId(String(team.id)),
                              })),
                            ]}
                            trigger={
                              <TouchableOpacity
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                  borderRadius: 8,
                                  paddingHorizontal: 12,
                                  paddingVertical: 12,
                                  minHeight: 44,
                                  borderWidth: 1,
                                  borderColor: 'rgba(255, 255, 255, 0.2)',
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={{ fontSize: 16, color: '#ffffff' }}>
                                  {selectedTeamId === '' ? 'Personal' : teams.find(t => String(t.id) === selectedTeamId)?.name || 'Personal'}
                                </Text>
                                <Feather name="chevron-down" size={20} color="#9ca3af" />
                              </TouchableOpacity>
                            }
                          />
                        ) : (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              borderRadius: 8,
                              paddingHorizontal: 12,
                              paddingVertical: 12,
                              minHeight: 44,
                              borderWidth: 1,
                              borderColor: 'rgba(255, 255, 255, 0.2)',
                              opacity: 0.5,
                            }}
                          >
                            <Text style={{ fontSize: 16, color: '#6b7280' }}>
                              {selectedTeamId === '' ? 'Personal' : teams.find(t => String(t.id) === selectedTeamId)?.name || 'Personal'}
                            </Text>
                            <Feather name="chevron-down" size={20} color="#6b7280" />
                          </View>
                        )}
                      </View>

                      <View>
                        <Text className="block text-gray-300 text-sm mb-2">Type</Text>
                        {isNewEvent ? (
                          <ContextMenu
                            options={[
                              { label: 'Practice', value: 'practice', onPress: () => updateDraft('type', 'practice') },
                              { label: 'Match', value: 'match', onPress: () => updateDraft('type', 'match') },
                              { label: 'Tournament', value: 'tournament', onPress: () => updateDraft('type', 'tournament') },
                              { label: 'Other', value: 'other', onPress: () => updateDraft('type', 'other') },
                            ]}
                            trigger={
                              <TouchableOpacity
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                  borderRadius: 8,
                                  paddingHorizontal: 12,
                                  paddingVertical: 12,
                                  minHeight: 44,
                                  borderWidth: 1,
                                  borderColor: 'rgba(255, 255, 255, 0.2)',
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={{ fontSize: 16, color: '#ffffff' }}>
                                  {draftEvent.type.charAt(0).toUpperCase() + draftEvent.type.slice(1)}
                                </Text>
                                <Feather name="chevron-down" size={20} color="#9ca3af" />
                              </TouchableOpacity>
                            }
                          />
                        ) : (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              borderRadius: 8,
                              paddingHorizontal: 12,
                              paddingVertical: 12,
                              minHeight: 44,
                              borderWidth: 1,
                              borderColor: 'rgba(255, 255, 255, 0.2)',
                              opacity: 0.5,
                            }}
                          >
                            <Text style={{ fontSize: 16, color: '#6b7280' }}>
                              {draftEvent.type.charAt(0).toUpperCase() + draftEvent.type.slice(1)}
                            </Text>
                            <Feather name="chevron-down" size={20} color="#6b7280" />
                          </View>
                        )}
                      </View>

                      <View>
                        <Text className="block text-gray-300 text-sm mb-2">Title</Text>
                        <TextInput
                          style={{
                            width: '100%',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 12,
                            color: '#ffffff',
                            fontSize: 16,
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            minHeight: 44,
                          }}
                          placeholder="Event title"
                          placeholderTextColor="#6b7280"
                          value={draftEvent.title}
                          onChangeText={(value) => updateDraft('title', value)}
                        />
                      </View>

                      <View>
                        <Text className="block text-gray-300 text-sm mb-2">Date & Time</Text>
                        <TouchableOpacity
                          style={{
                            width: '100%',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 12,
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            minHeight: 44,
                            marginBottom: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                          onPress={() => {
                            hapticLight();
                            setShowDatePicker(!showDatePicker);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: '#ffffff', fontSize: 16 }}>
                            {selectedDateValue.toLocaleDateString('en-US', { 
                              weekday: 'short', 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </Text>
                          <Feather name="calendar" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                        {showDatePicker && Platform.OS === 'ios' && (
                          <View style={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                            borderRadius: 8, 
                            padding: 12, 
                            marginTop: 8,
                            marginBottom: 8
                          }}>
                            <View style={{ 
                              flexDirection: 'row', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              marginBottom: 12 
                            }}>
                              <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>Select Date</Text>
                              <TouchableOpacity
                                onPress={() => {
                                  hapticLight();
                                  setShowDatePicker(false);
                                }}
                                activeOpacity={0.7}
                                style={{ paddingVertical: 6, paddingHorizontal: 12 }}
                              >
                                <Text style={{ color: '#60a5fa', fontSize: 15, fontWeight: '600' }}>Done</Text>
                              </TouchableOpacity>
                            </View>
                            <DateTimePicker
                              value={selectedDateValue}
                              mode="date"
                              display="spinner"
                              textColor="#ffffff"
                              onChange={(event, date) => {
                                if (date) {
                                  setSelectedDateValue(date);
                                  const dateStr = formatDate(date);
                                  updateDraft('date', dateStr);
                                }
                              }}
                              style={{ backgroundColor: 'transparent', height: 180 }}
                            />
                          </View>
                        )}
                        <TouchableOpacity
                          style={{
                            width: '100%',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 12,
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            minHeight: 44,
                            marginBottom: 8,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                          onPress={() => {
                            hapticLight();
                            setShowStartTimePicker(!showStartTimePicker);
                            setShowDatePicker(false);
                            setShowEndTimePicker(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: '#ffffff', fontSize: 16 }}>
                            Start: {selectedStartTime.toLocaleTimeString(undefined, { 
                              hour: '2-digit', 
                              minute: '2-digit'
                            })}
                          </Text>
                          <Feather name="clock" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                        {showStartTimePicker && Platform.OS === 'ios' && (
                          <View style={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                            borderRadius: 8, 
                            padding: 12, 
                            marginTop: 8,
                            marginBottom: 8
                          }}>
                            <View style={{ 
                              flexDirection: 'row', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              marginBottom: 12 
                            }}>
                              <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>Select Start Time</Text>
                              <TouchableOpacity
                                onPress={() => {
                                  hapticLight();
                                  setShowStartTimePicker(false);
                                }}
                                activeOpacity={0.7}
                                style={{ paddingVertical: 6, paddingHorizontal: 12 }}
                              >
                                <Text style={{ color: '#60a5fa', fontSize: 15, fontWeight: '600' }}>Done</Text>
                              </TouchableOpacity>
                            </View>
                            <DateTimePicker
                              value={selectedStartTime}
                              mode="time"
                              display="spinner"
                              textColor="#ffffff"
                              onChange={(event, date) => {
                                if (date) {
                                  setSelectedStartTime(date);
                                  setStartTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
                                }
                              }}
                              style={{ backgroundColor: 'transparent', height: 180 }}
                            />
                          </View>
                        )}
                        <TouchableOpacity
                          style={{
                            width: '100%',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 12,
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            minHeight: 44,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                          onPress={() => {
                            hapticLight();
                            setShowEndTimePicker(!showEndTimePicker);
                            setShowDatePicker(false);
                            setShowStartTimePicker(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: '#ffffff', fontSize: 16 }}>
                            End: {selectedEndTime.toLocaleTimeString(undefined, { 
                              hour: '2-digit', 
                              minute: '2-digit'
                            })}
                          </Text>
                          <Feather name="clock" size={20} color="#9ca3af" />
                        </TouchableOpacity>
                        {showEndTimePicker && Platform.OS === 'ios' && (
                          <View style={{ 
                            backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                            borderRadius: 8, 
                            padding: 12, 
                            marginTop: 8
                          }}>
                            <View style={{ 
                              flexDirection: 'row', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              marginBottom: 12 
                            }}>
                              <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>Select End Time</Text>
                              <TouchableOpacity
                                onPress={() => {
                                  hapticLight();
                                  setShowEndTimePicker(false);
                                }}
                                activeOpacity={0.7}
                                style={{ paddingVertical: 6, paddingHorizontal: 12 }}
                              >
                                <Text style={{ color: '#60a5fa', fontSize: 15, fontWeight: '600' }}>Done</Text>
                              </TouchableOpacity>
                            </View>
                            <DateTimePicker
                              value={selectedEndTime}
                              mode="time"
                              display="spinner"
                              textColor="#ffffff"
                              onChange={(event, date) => {
                                if (date) {
                                  setSelectedEndTime(date);
                                  setEndTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
                                }
                              }}
                              style={{ backgroundColor: 'transparent', height: 180 }}
                            />
                          </View>
                        )}
                      </View>

                      <View>
                        <Text className="block text-gray-300 text-sm mb-2">Location</Text>
                        <TextInput
                          style={{
                            width: '100%',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: 8,
                            paddingHorizontal: 12,
                            paddingVertical: 12,
                            color: '#ffffff',
                            fontSize: 16,
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.2)',
                            minHeight: 44,
                          }}
                          placeholder="Location"
                          placeholderTextColor="#6b7280"
                          value={draftEvent.location}
                          onChangeText={(value) => updateDraft('location', value)}
                        />
                      </View>
                    </View>

                    <View className="flex-row gap-2 mt-6 pt-4 border-t border-white/10">
                      <TouchableOpacity
                        onPress={handleSave}
                        disabled={savingEvent}
                        activeOpacity={0.9}
                        style={{ flex: 1, overflow: 'hidden', borderRadius: 8, opacity: savingEvent ? 0.5 : 1 }}
                      >
                        <LinearGradient
                          colors={['#22c55e', '#10b981']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{
                            paddingHorizontal: 20,
                            paddingVertical: 12,
                            minHeight: 48,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {savingEvent ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Save Event</Text>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                      {!isNewEvent && draftEvent.editable && (
                        <TouchableOpacity
                          onPress={() => {
                            hapticMedium();
                            draftEvent && handleDelete(draftEvent);
                          }}
                          activeOpacity={0.9}
                          style={{
                            paddingHorizontal: 24,
                            paddingVertical: 12,
                            minHeight: 48,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#dc2626',
                            borderRadius: 8,
                          }}
                        >
                          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
                </View>
                <KeyboardSpacer baseHeight={Math.max(40, insets.bottom + 20)} />
              </ScrollView>
          </View>
          <View
            style={styles.dragZone}
            {...detailPanResponder.panHandlers}
          />
        </Animated.View>
      </Animated.View>
      </Modal>



      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={selectedDateValue}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date && event.type !== 'dismissed') {
              setSelectedDateValue(date);
              const dateStr = formatDate(date);
              updateDraft('date', dateStr);
            }
          }}
        />
      )}

      {showStartTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={selectedStartTime}
          mode="time"
          display="default"
          onChange={(event, date) => {
            setShowStartTimePicker(false);
            if (date && event.type !== 'dismissed') {
              setSelectedStartTime(date);
              setStartTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
            }
          }}
        />
      )}

      {showEndTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={selectedEndTime}
          mode="time"
          display="default"
          onChange={(event, date) => {
            setShowEndTimePicker(false);
            if (date && event.type !== 'dismissed') {
              setSelectedEndTime(date);
              setEndTime(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
            }
          }}
        />
      )}

    </>
  );
}

const styles = StyleSheet.create({
  returnToEventGlass: {
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  returnToEventGlassFallback: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: 9999,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BACKGROUND_COLOR,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    height: SCREEN_HEIGHT * 0.95,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 12,
  },
  handleBarContainer: {
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  dragZone: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    zIndex: 10,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  closeButtonContainer: {
    position: 'absolute',
    left: 20,
    top: 20,
    width: 30,
    height: 30,
    zIndex: 999,
    elevation: 999,
  },
  closeButtonCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeButtonX: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 15,
    fontWeight: '600',
    marginTop: -1,
  },
  settingsContent: {
    flex: 1,
    overflow: 'hidden',
    paddingTop: 60,
  },
});
