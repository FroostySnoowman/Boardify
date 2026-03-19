import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { listTeamEvents, EventType } from '../../api/calendar';
import { listMembers } from '../../api/teams';
import { Skeleton } from '../../components/Skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { hapticLight } from '../../utils/haptics';
import { formatLocalDate } from '../../utils/dateUtils';
import MonthPage from '../calendar/MonthPage';
import WeekPage from '../calendar/WeekPage';
import DayPage from '../calendar/DayPage';

interface EventsScreenProps {
  teamId?: string;
}

type ViewType = 'month' | 'week' | 'day';

export default function EventsScreen({ teamId }: EventsScreenProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<EventType[]>([]);
  const [canManageEvents, setCanManageEvents] = useState(false);
  const [loading, setLoading] = useState(true);
  const shouldRefreshRef = useRef(true);

  const loadEvents = useCallback(async () => {
    if (!teamId) return;
    try {
      const ev = await listTeamEvents(teamId);
      setEvents(ev);
    } catch (e: any) {
      console.error('Failed to load events:', e);
    }
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);

    const membersPromise = user
      ? listMembers(teamId)
          .then(members => {
            const role = members.find(m => m.id === user.id)?.role.toLowerCase();
            setCanManageEvents(role === 'owner' || role === 'coach');
          })
          .catch((e: any) => {
            if (!/not authorized/i.test(e.message)) {
              console.error('Failed to load members:', e);
            }
            setCanManageEvents(false);
          })
      : Promise.resolve(setCanManageEvents(false));

    const eventsPromise = loadEvents();

    Promise.all([membersPromise, eventsPromise]).finally(() => setLoading(false));
  }, [teamId, user, loadEvents]);

  useFocusEffect(
    useCallback(() => {
      if (shouldRefreshRef.current) {
        shouldRefreshRef.current = false;
        loadEvents();
      }
    }, [loadEvents])
  );

  const renderCalendarView = () => {
    switch (currentView) {
      case 'month':
        return (
          <MonthPage
            currentDate={currentDate}
            events={events}
            onPrevMonth={() =>
              setCurrentDate(
                new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
              )
            }
            onNextMonth={() =>
              setCurrentDate(
                new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
              )
            }
            onOpenDay={() => {}}
            onEventClick={() => {}}
          />
        );
      case 'week':
        return (
          <WeekPage
            currentDate={currentDate}
            events={events}
            onPrevWeek={() =>
              setCurrentDate(new Date(currentDate.getTime() - 7 * 86400000))
            }
            onNextWeek={() =>
              setCurrentDate(new Date(currentDate.getTime() + 7 * 86400000))
            }
            onOpenDay={() => {}}
            onEventClick={() => {}}
          />
        );
      case 'day':
        return (
          <DayPage
            currentDate={currentDate}
            selectedDate={currentDate}
            eventsForDay={events.filter(e => {
              const [ey, em, ed] = e.date.split('-').map(Number);
              return (
                ey === currentDate.getFullYear() &&
                (em - 1) === currentDate.getMonth() &&
                ed === currentDate.getDate()
              );
            })}
            onPrevDay={() => {
              const nd = new Date(currentDate.getTime() - 86400000);
              setCurrentDate(nd);
            }}
            onNextDay={() => {
              const nd = new Date(currentDate.getTime() + 86400000);
              setCurrentDate(nd);
            }}
            onEventClick={() => {}}
            onAddEvent={() => {}}
          />
        );
    }
  };

  return (
    <View className="flex-1 flex-col" style={{ backgroundColor: '#020617' }}>
      {/* Header */}
      <View className="p-4 border-b border-white/5">
        <View className="flex-row flex-wrap items-center gap-4 mb-4">
          <View className="flex-row bg-white/5 rounded-lg p-1">
            {(['month', 'week', 'day'] as ViewType[]).map(view => (
              <TouchableOpacity
                key={view}
                onPress={() => {
                  hapticLight();
                  setCurrentView(view);
                }}
                className={`px-3 py-2 rounded-md ${currentView === view ? 'bg-white/10' : ''}`}
              >
                <Text className={`text-sm capitalize ${currentView === view ? 'text-white' : 'text-gray-400'}`}>
                  {view}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setCurrentDate(new Date());
            }}
            className="px-3 py-2 rounded-lg bg-white/10"
          >
            <Text className="text-sm text-gray-400">Today</Text>
          </TouchableOpacity>
          {canManageEvents && (
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                shouldRefreshRef.current = true;
                const dateStr = formatLocalDate(currentDate);
                router.push({
                  pathname: '/new-event',
                  params: { date: dateStr, teamId: teamId || '' },
                });
              }}
              className="flex-row items-center gap-2 px-4 py-2 rounded-lg bg-green-500"
            >
              <Feather name="plus" size={16} color="#ffffff" />
              <Text className="text-sm font-medium text-white">New Event</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Calendar View */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View className="p-4">
            <Skeleton className="h-[400px] w-full rounded-xl" />
          </View>
        ) : (
          renderCalendarView()
        )}
      </ScrollView>
    </View>
  );
}