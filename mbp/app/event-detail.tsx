import React, { useState, useEffect } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getEvent, EventType, listRsvps, rsvpEvent, RSVPResponse } from '../src/api/calendar';
import { useAuth } from '../src/contexts/AuthContext';
import { hapticLight } from '../src/utils/haptics';
import { formatTimeForDisplay } from '../src/utils/dateUtils';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

const BACKGROUND_COLOR = '#020617';

export default function EventDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ eventId: string; teamId?: string }>();
  const { user } = useAuth();
  const currentUserId = user ? parseInt(user.id) : 0;

  // Determine if accessed from team calendar (has teamId) or calendar tab (no teamId)
  const isFromTeamCalendar = params.teamId && params.teamId !== '';

  // Color scheme: green for calendar tab, blue for team calendar
  const editButtonGradient = isFromTeamCalendar ? ['#3b82f6', '#06b6d4'] : ['#22c55e', '#10b981'];

  const [event, setEvent] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvps, setRsvps] = useState<{ yes: string[]; no: string[] }>({ yes: [], no: [] });
  const [rsvping, setRsvping] = useState(false);

  useEffect(() => {
    const loadEvent = async () => {
      if (!params.eventId) {
        router.back();
        return;
      }

      try {
        setLoading(true);
        const eventId = parseInt(params.eventId, 10);
        const eventData = await getEvent(eventId);
        setEvent(eventData);

        // Load RSVPs
        try {
          const rsvpData = await listRsvps(eventId);
          setRsvps(rsvpData);
        } catch (err) {
          console.error('Failed to load RSVPs:', err);
          setRsvps({ yes: [], no: [] });
        }
      } catch (err: any) {
        console.error('Failed to load event:', err);
        Alert.alert('Error', err.message || 'Failed to load event.');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [params.eventId]);

  const handleRSVP = async (response: RSVPResponse) => {
    if (!event) return;

    hapticLight();
    setRsvping(true);
    try {
      // Get original event ID if this is a recurring instance
      const originalEventId = (event as any).originalEventId || event.id;
      const actualEventId = typeof originalEventId === 'string' && originalEventId.includes('_')
        ? parseInt(originalEventId.split('_')[0], 10)
        : (typeof originalEventId === 'number' ? originalEventId : parseInt(String(originalEventId), 10));

      await rsvpEvent(actualEventId, response);

      // Reload RSVPs
      const rsvpData = await listRsvps(actualEventId);
      setRsvps(rsvpData);
    } catch (err: any) {
      console.error('Failed to update RSVP:', err);
      Alert.alert('Error', err.message || 'Failed to update RSVP.');
    } finally {
      setRsvping(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
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
              Event Details
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

  if (!event) {
    return (
      <View style={styles.container}>
        <Stack.Screen>
          <Stack.Header
            style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
           />
            <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
              Event Details
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
          <Text className="text-center text-red-400 text-base">Event not found</Text>
        </View>
      </View>
    );
  }

  const isGoing = rsvps.yes.includes(String(currentUserId));
  const isNotGoing = rsvps.no.includes(String(currentUserId));

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Event Details
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
              <Text className="text-2xl font-bold text-white mb-2">{event.title}</Text>

              <View>
                <View style={[styles.typeBadge, { backgroundColor: event.color || '#3b82f6' }]}>
                  <Text style={styles.typeText}>
                    {event.type.charAt(0).toUpperCase() + event.type.slice(1)}
                  </Text>
                </View>
              </View>

              <View className="gap-3">
                <View className="flex-row items-center gap-3">
                  <Feather name="calendar" size={20} color="#9ca3af" />
                  <Text className="text-white text-base">{formatDate(event.date)}</Text>
                </View>
                <View className="flex-row items-center gap-3">
                  <Feather name="clock" size={20} color="#9ca3af" />
                  <Text className="text-white text-base">{formatTimeForDisplay(event.time)}</Text>
                </View>
                {event.location && (
                  <View className="flex-row items-center gap-3">
                    <Feather name="map-pin" size={20} color="#9ca3af" />
                    <Text className="text-white text-base">{event.location}</Text>
                  </View>
                )}
              </View>

              {event.editable && (
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
                        backgroundColor: isGoing ? '#16a34a' : 'rgba(255, 255, 255, 0.05)',
                        borderWidth: isGoing ? 2 : 0,
                        borderColor: isGoing ? '#4ade80' : 'transparent',
                      }}
                      onPress={() => handleRSVP('yes')}
                      disabled={rsvping}
                      activeOpacity={0.8}
                    >
                      <Feather
                        name="check-circle"
                        size={16}
                        color={isGoing ? '#ffffff' : '#d1d5db'}
                      />
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '500',
                        color: isGoing ? '#ffffff' : '#d1d5db',
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
                        backgroundColor: isNotGoing ? '#dc2626' : 'rgba(255, 255, 255, 0.05)',
                        borderWidth: isNotGoing ? 2 : 0,
                        borderColor: isNotGoing ? '#f87171' : 'transparent',
                      }}
                      onPress={() => handleRSVP('no')}
                      disabled={rsvping}
                      activeOpacity={0.8}
                    >
                      <Feather
                        name="x-circle"
                        size={16}
                        color={isNotGoing ? '#ffffff' : '#d1d5db'}
                      />
                      <Text style={{
                        fontSize: 14,
                        fontWeight: '500',
                        color: isNotGoing ? '#ffffff' : '#d1d5db',
                      }}>
                        Not Going
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {(rsvps.yes.length > 0 || rsvps.no.length > 0) && (
                    <View className="pt-2 border-t border-white/10">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm text-gray-400">Responses:</Text>
                        <View className="flex-row items-center gap-3">
                          <Text className="text-sm text-green-400">
                            {rsvps.yes.length} Going
                          </Text>
                          <Text className="text-sm text-blue-400">
                            {rsvps.no.length} Not Going
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {event.editable && (
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    const originalEventId = (event as any).originalEventId || event.id;
                    const actualEventId = typeof originalEventId === 'string' && originalEventId.includes('_')
                      ? parseInt(originalEventId.split('_')[0], 10)
                      : (typeof originalEventId === 'number' ? originalEventId : parseInt(String(originalEventId), 10));

                    router.push({
                      pathname: '/edit-event',
                      params: {
                        eventId: actualEventId.toString(),
                        ...(params.teamId ? { teamId: params.teamId } : {}),
                      },
                    });
                  }}
                  activeOpacity={0.9}
                  style={{ overflow: 'hidden', borderRadius: 8, marginTop: 8 }}
                >
                  <LinearGradient
                    colors={editButtonGradient as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      minHeight: 48,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Feather name="edit" size={16} color="#ffffff" />
                    <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Edit Event</Text>
                  </LinearGradient>
                </TouchableOpacity>
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
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
