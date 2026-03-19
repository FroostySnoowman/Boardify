import React, { useState, useEffect } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { listMyEvents, listAllEvents, listTeamEvents, EventType } from '../src/api/calendar';
import { listMyTeams } from '../src/api/teams';
import { useAuth } from '../src/contexts/AuthContext';
import { hapticLight } from '../src/utils/haptics';
import { formatTimeForDisplay } from '../src/utils/dateUtils';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

const BACKGROUND_COLOR = '#020617';

// Helper function to parse YYYY-MM-DD date strings as local dates (not UTC)
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Helper function to parse date and time string as local datetime
const parseLocalDateTime = (dateStr: string, timeStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = (timeStr || '00:00').split(':').map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0);
};

export default function SearchEventsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ teamId?: string }>();
  const teamId = params.teamId;
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    loadEvents();
  }, [authLoading, teamId]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      if (teamId && teamId !== 'all') {
        const ev = await listTeamEvents(teamId);
        setEvents(ev);
      } else {
        // Use the optimized endpoint to fetch all events in one request
        const allEvents = await listAllEvents();
        setEvents(allEvents);
      }
    } catch (err: any) {
      console.error('Failed to load events:', err);
    } finally {
      setLoading(false);
    }
  };

  const openEvent = async (event: EventType) => {
    hapticLight();
    router.back();
    
    // Small delay to allow modal to close
    setTimeout(async () => {
      if (event.editable) {
        // Determine which team this event belongs to if not provided
        let eventTeamId = teamId || '';
        if (!eventTeamId || eventTeamId === 'all') {
          try {
            const teams = await listMyTeams();
            for (const team of teams) {
              const teamEvents = await listTeamEvents(team.id.toString());
              if (teamEvents.some(te => te.id === event.id)) {
                eventTeamId = team.id.toString();
                break;
              }
            }
          } catch (error) {
            console.error('Failed to check team events:', error);
          }
        }
        
        router.push({
          pathname: '/edit-event',
          params: {
            eventId: event.id.toString(),
            ...(eventTeamId && eventTeamId !== 'all' ? { teamId: eventTeamId } : {}),
          },
        });
      } else {
        // For non-editable events, we might need a detail view
        // For now, just navigate to edit-event if it exists
        router.push({
          pathname: '/edit-event',
          params: {
            eventId: event.id.toString(),
            ...(teamId && teamId !== 'all' ? { teamId } : {}),
          },
        });
      }
    }, 300);
  };

  const filteredEvents = events.filter(e => {
    if (!searchTerm.trim()) return true;
    return e.title.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a, b) => {
    // Sort by date, most recent first
    const timeA = a.time.split(' - ')[0] || '00:00';
    const timeB = b.time.split(' - ')[0] || '00:00';
    const dateA = parseLocalDateTime(a.date, timeA);
    const dateB = parseLocalDateTime(b.date, timeB);
    return dateB.getTime() - dateA.getTime();
  });

  const typeColors: Record<string, string> = {
    practice: '#3b82f6',
    match: '#ef4444',
    tournament: '#f59e0b',
    other: '#8b5cf6',
  };

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Search Events
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={{ maxWidth: 768, alignSelf: 'center', width: '100%' }}>
          <View style={{ gap: 24 }}>
            <View style={{ padding: 24, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', gap: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="calendar" size={24} color={teamId && teamId !== 'all' ? '#3b82f6' : '#22c55e'} style={{ marginRight: 12 }} />
                <Text style={{ fontSize: 24, fontWeight: '700', color: '#ffffff' }}>Search Events</Text>
              </View>

              <View style={{ position: 'relative' }}>
                <Feather 
                  name="search" 
                  size={20} 
                  color="#9ca3af" 
                  style={{ 
                    position: 'absolute', 
                    left: 12, 
                    top: '50%', 
                    transform: [{ translateY: -10 }],
                    zIndex: 1,
                  }} 
                />
                <TextInput
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholder="Search events..."
                  placeholderTextColor="#6b7280"
                  style={{
                    width: '100%',
                    paddingLeft: 40,
                    paddingRight: 12,
                    paddingVertical: 12,
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    color: '#ffffff',
                    fontSize: 16,
                    minHeight: 44,
                  }}
                  autoFocus
                />
              </View>

              {loading ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <Text style={{ color: '#9ca3af', fontSize: 16 }}>Loading events...</Text>
                </View>
              ) : filteredEvents.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <View style={{ 
                    width: 64, 
                    height: 64, 
                    borderRadius: 32, 
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16
                  }}>
                    <Feather name="calendar" size={32} color="#6b7280" />
                  </View>
                  <Text style={{ color: '#9ca3af', fontSize: 16, textAlign: 'center' }}>
                    {searchTerm.trim() ? 'No events found matching your search.' : 'No events found.'}
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {filteredEvents.map((event) => {
                    const eventDate = parseLocalDate(event.date);
                    const now = new Date();
                    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const isPast = eventDate < today;
                    const eventColor = event.color || typeColors[event.type] || '#6b7280';
                    // Type label text: always use a visible color (never black/dark from API or theme)
                    const typeLabelColor = typeColors[event.type] ?? '#60a5fa';

                    return (
                      <TouchableOpacity
                        key={event.id}
                        onPress={() => openEvent(event)}
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: 12,
                          padding: 16,
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                          <View style={{
                            width: 4,
                            borderRadius: 2,
                            backgroundColor: eventColor,
                            flexShrink: 0,
                            height: '100%',
                            minHeight: 40,
                          }} />
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                              {event.title}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                              <Feather name="calendar" size={14} color="#9ca3af" />
                              <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                                {eventDate.toLocaleDateString(undefined, { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}
                              </Text>
                              {event.time && (
                                <>
                                  <Feather name="clock" size={14} color="#9ca3af" style={{ marginLeft: 8 }} />
                                  <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                                    {formatTimeForDisplay(event.time)}
                                  </Text>
                                </>
                              )}
                            </View>
                            {event.location && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                <Feather name="map-pin" size={14} color="#9ca3af" />
                                <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                                  {event.location}
                                </Text>
                              </View>
                            )}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <View style={{
                                backgroundColor: `${typeLabelColor}30`,
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                                minHeight: 24,
                                justifyContent: 'center',
                              }}>
                                <Text style={{
                                  color: typeLabelColor,
                                  fontSize: 12,
                                  fontWeight: '600',
                                  textTransform: 'capitalize',
                                }}>
                                  {event.type}
                                </Text>
                              </View>
                              {isPast && (
                                <View style={{
                                  backgroundColor: 'rgba(107, 114, 128, 0.25)',
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  borderRadius: 6,
                                  minHeight: 24,
                                  justifyContent: 'center',
                                }}>
                                  <Text style={{ color: '#d1d5db', fontSize: 12, fontWeight: '600' }}>
                                    Past
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </View>
        <KeyboardSpacer extraOffset={20} />
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
