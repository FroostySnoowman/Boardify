import React, { useState, useEffect } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { listMyEvents, listTeamEvents, listAllEvents, EventType, listRsvps, rsvpEvent, RSVPResponse } from '../src/api/calendar';
import { useAuth } from '../src/contexts/AuthContext';
import { useTeams } from '../src/contexts/TeamsContext';
import { hapticLight } from '../src/utils/haptics';
import { parseLocalDate, formatTimeForDisplay } from '../src/utils/dateUtils';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

const BACKGROUND_COLOR = '#020617';

export default function DayEventsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date: string; teamId?: string }>();
  const { user } = useAuth();
  const { teams } = useTeams();
  const currentUserId = user ? parseInt(user.id) : 0;
  
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [rsvps, setRsvps] = useState<Record<number | string, { yes: string[]; no: string[] }>>({});
  const [rsvping, setRsvping] = useState<number | string | null>(null);

  const selectedDate = params.date ? parseLocalDate(params.date) : new Date();
  const selectedTeamId = params.teamId || '';

  useEffect(() => {
    const loadEvents = async () => {
      if (!params.date) {
        router.back();
        return;
      }

      try {
        setLoading(true);
        let allEvents: EventType[] = [];

        if (selectedTeamId === 'all') {
          allEvents = await listAllEvents();
        } else if (selectedTeamId) {
          allEvents = await listTeamEvents(selectedTeamId);
        } else {
          allEvents = await listMyEvents();
        }

        // Filter events for the selected date
        const dateStr = formatDate(selectedDate);
        const dayEvents = allEvents.filter(e => e.date === dateStr);
        setEvents(dayEvents);

        // Load RSVPs for all events
        if (dayEvents.length > 0) {
          const eventIds = dayEvents.map(e => {
            const originalEventId = (e as any).originalEventId || e.id;
            return typeof originalEventId === 'string' && originalEventId.includes('_')
              ? parseInt(originalEventId.split('_')[0], 10)
              : (typeof originalEventId === 'number' ? originalEventId : parseInt(String(originalEventId), 10));
          });
          
          const rsvpMap: Record<number | string, { yes: string[]; no: string[] }> = {};
          await Promise.all(
            eventIds.map(async (eventId) => {
              try {
                const rsvpData = await listRsvps(eventId);
                rsvpMap[eventId] = rsvpData;
              } catch (err) {
                rsvpMap[eventId] = { yes: [], no: [] };
              }
            })
          );
          setRsvps(rsvpMap);
        }
      } catch (err: any) {
        console.error('Failed to load events:', err);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, [params.date, selectedTeamId]);

  const handleRSVP = async (event: EventType, response: RSVPResponse) => {
    hapticLight();
    const originalEventId = (event as any).originalEventId || event.id;
    const actualEventId = typeof originalEventId === 'string' && originalEventId.includes('_')
      ? parseInt(originalEventId.split('_')[0], 10)
      : (typeof originalEventId === 'number' ? originalEventId : parseInt(String(originalEventId), 10));

    setRsvping(actualEventId);
    try {
      await rsvpEvent(actualEventId, response);
      
      // Reload RSVPs
      const rsvpData = await listRsvps(actualEventId);
      setRsvps(prev => ({ ...prev, [actualEventId]: rsvpData }));
    } catch (err: any) {
      console.error('Failed to update RSVP:', err);
    } finally {
      setRsvping(null);
    }
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen>
          <Stack.Header
            style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
           />
            <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
              Day Events
            </Stack.Screen.Title>
            <Stack.Toolbar placement="left">
              <Stack.Toolbar.Button 
                icon="xmark" 
                onPress={() => router.back()}
                tintColor="#ffffff"
              />
            </Stack.Toolbar>
        </Stack.Screen>
        <View style={{ paddingTop: insets.top + 60, paddingBottom: insets.bottom, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Day Events
          </Stack.Screen.Title>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button 
              icon="xmark" 
              onPress={() => router.back()}
              tintColor="#ffffff"
            />
          </Stack.Toolbar>
      </Stack.Screen>

      <LinearGradient
        colors={['rgba(96, 165, 250, 0.18)', 'rgba(34, 197, 94, 0.14)', 'rgba(2, 6, 23, 0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={{ maxWidth: 768, alignSelf: 'center', width: '100%' }}>
          <View style={{ gap: 24 }}>
            <View className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6 shadow-lg">
              <Text className="text-2xl font-bold text-white mb-2">{formatDisplayDate(selectedDate)}</Text>

              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  const dateStr = formatDate(selectedDate);
                  router.push(`/new-event?date=${dateStr}&teamId=${selectedTeamId}`);
                }}
                activeOpacity={0.8}
                style={{ alignSelf: 'center', overflow: 'hidden', borderRadius: 28 }}
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

              {events.length > 0 ? (
                <View className="gap-4">
                  {events.map(event => {
                    const originalEventId = (event as any).originalEventId || event.id;
                    const actualEventId = typeof originalEventId === 'string' && originalEventId.includes('_')
                      ? parseInt(originalEventId.split('_')[0], 10)
                      : (typeof originalEventId === 'number' ? originalEventId : parseInt(String(originalEventId), 10));
                    
                    const resp = rsvps[actualEventId] || { yes: [], no: [] };
                    const isGoing = resp.yes.includes(String(currentUserId));
                    const isNotGoing = resp.no.includes(String(currentUserId));

                    return (
                      <TouchableOpacity
                        key={event.id}
                        className="p-4 rounded-lg bg-white/5 border border-white/10"
                        onPress={() => {
                          hapticLight();
                          router.push({
                            pathname: '/event-detail',
                            params: {
                              eventId: actualEventId.toString(),
                              ...(selectedTeamId ? { teamId: selectedTeamId } : {}),
                            },
                          });
                        }}
                        activeOpacity={0.7}
                      >
                        <View className="flex-row items-center justify-between mb-2">
                          <Text className="font-semibold text-lg text-white">{event.title}</Text>
                          <Text className="text-sm text-gray-400">{formatTimeForDisplay(event.time)}</Text>
                        </View>
                        {event.location && (
                          <View className="flex-row items-center gap-4 mb-2">
                            <Feather name="map-pin" size={16} color="#9ca3af" />
                            <Text className="text-sm text-gray-300">{event.location}</Text>
                          </View>
                        )}
                        {event.editable && (
                          <View className="flex-row items-center justify-between gap-2">
                            <TouchableOpacity
                              style={{
                                flex: 1,
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 9999,
                                backgroundColor: isGoing ? '#15803d' : '#16a34a',
                                borderWidth: isGoing ? 2 : 0,
                                borderColor: isGoing ? '#4ade80' : 'transparent',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleRSVP(event, 'yes');
                              }}
                              disabled={rsvping === actualEventId}
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
                                backgroundColor: isNotGoing ? '#991b1b' : '#dc2626',
                                borderWidth: isNotGoing ? 2 : 0,
                                borderColor: isNotGoing ? '#f87171' : 'transparent',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleRSVP(event, 'no');
                              }}
                              disabled={rsvping === actualEventId}
                              activeOpacity={0.8}
                            >
                              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>No</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text className="text-center text-gray-400">No events for this day</Text>
              )}
            </View>
          </View>
        </View>
        <KeyboardSpacer extraOffset={40} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
});
