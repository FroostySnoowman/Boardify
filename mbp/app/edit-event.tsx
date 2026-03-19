import React, { useState, useRef, useEffect } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Platform, Pressable, Alert, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getEvent, updateEvent, updateTeamEvent, deleteEvent, deleteTeamEvent, listTeamEvents, listMyEvents, createEvent, createTeamEvent, EventType } from '../src/api/calendar';
import { useTeams } from '../src/contexts/TeamsContext';
import { refetchAndRescheduleEventReminders, scheduleEventReminders } from '../src/services/notifications';
import { parseLocalDate } from '../src/utils/dateUtils';
import { hapticLight } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { ContextMenu } from '../src/components/ContextMenu';

const BACKGROUND_COLOR = '#020617';

const formatLabel = (val: string, labels?: Record<string, string>) => {
  if (labels && labels[val]) return labels[val];
  const defaultLabels: Record<string, string> = {
    'practice': 'Practice',
    'match': 'Match',
    'tournament': 'Tournament',
    'other': 'Other',
  };
  return defaultLabels[val] || val;
};

export default function EditEventScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ eventId: string; teamId?: string }>();
  const eventId = parseInt(params.eventId || '0', 10);
  const initialTeamId = params.teamId || '';
  const { teams } = useTeams();
  const isFromTeamCalendar = initialTeamId && initialTeamId !== '' && teams.some(t => String(t.id) === initialTeamId);
  const calendarIconColor = isFromTeamCalendar ? '#3b82f6' : '#22c55e';
  const saveButtonGradient = isFromTeamCalendar ? ['#3b82f6', '#06b6d4'] : ['#22c55e', '#10b981'];
  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialTeamId);
  const [type, setType] = useState<'practice' | 'match' | 'tournament' | 'other'>('practice');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedStartTime, setSelectedStartTime] = useState<Date>(new Date());
  const [selectedEndTime, setSelectedEndTime] = useState<Date>(new Date());
  const [recurring, setRecurring] = useState<'never' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'>('never');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [originalEvent, setOriginalEvent] = useState<EventType | null>(null);

  const createContextMenuOptions = (
    options: string[],
    currentValue: string,
    onValueChange: (value: any) => void,
    labels?: Record<string, string>
  ) => {
    return options.map(opt => ({
      label: formatLabel(opt, labels),
      value: opt,
      onPress: () => onValueChange(opt),
    }));
  };

  useEffect(() => {
    if (!eventId) {
      router.back();
      return;
    }

    const loadEvent = async () => {
      setLoading(true);
      try {
        const event = await getEvent(eventId);
        setOriginalEvent(event);
        setTitle(event.title);
        setType(event.type);
        setLocation(event.location);

        let eventTeamId = initialTeamId;
        if (!eventTeamId || eventTeamId === '') {
          if ((event as any).teamId) {
            eventTeamId = String((event as any).teamId);
          }
        }
        setSelectedTeamId(eventTeamId || '');
        if (event.startAt != null && Number.isFinite(event.startAt)) {
          const startDate = new Date(event.startAt);
          setSelectedDate(startDate);
          setSelectedStartTime(new Date(event.startAt));
          const parts = event.time.split(' - ');
          if (parts[1]) {
            const [eh, em] = parts[1].split(':').map(Number);
            const endDate = new Date(startDate);
            endDate.setHours(eh ?? 10, em ?? 0, 0, 0);
            setSelectedEndTime(endDate);
          } else {
            const endDate = new Date(event.startAt);
            endDate.setHours(endDate.getHours() + 1, endDate.getMinutes(), 0, 0);
            setSelectedEndTime(endDate);
          }
        } else {
          const dateParts = event.date.split('-').map(Number);
          const eventDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
          setSelectedDate(eventDate);

          const parts = event.time.split(' - ');
          if (parts[0]) {
            const [hours, minutes] = parts[0].split(':').map(Number);
            const startTimeDate = new Date(eventDate);
            startTimeDate.setHours(hours ?? 9, minutes ?? 0, 0, 0);
            setSelectedStartTime(startTimeDate);
          }
          if (parts[1]) {
            const [hours, minutes] = parts[1].split(':').map(Number);
            const endTimeDate = new Date(eventDate);
            endTimeDate.setHours(hours ?? 10, minutes ?? 0, 0, 0);
            setSelectedEndTime(endTimeDate);
          }
        }

        if (event.recurrencePattern) {
          setRecurring(event.recurrencePattern);
        }
      } catch (error) {
        console.error('Failed to load event:', error);
        Alert.alert('Error', 'Failed to load event. Please try again.');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  const formatDate = (date: Date): string => {
    const normalizedDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    const year = normalizedDate.getFullYear();
    const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
    const day = String(normalizedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatTime = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    // Validate end time is after start time
    const startTimeMs = selectedStartTime.getTime();
    const endTimeMs = selectedEndTime.getTime();
    if (endTimeMs <= startTimeMs) {
      Alert.alert('Invalid Time', 'End time must be after start time.');
      return;
    }

    hapticLight();
    setSaving(true);

    const startTimeStr = formatTime(selectedStartTime);
    const endTimeStr = formatTime(selectedEndTime);
    const timeRange = `${startTimeStr} - ${endTimeStr}`;
    const dateStr = formatDate(selectedDate);

    const startAt = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      selectedStartTime.getHours(),
      selectedStartTime.getMinutes(),
      0,
      0
    ).getTime();
    const timezone = Intl.DateTimeFormat?.().resolvedOptions?.().timeZone ?? undefined;

    // Calculate recurrence end date (5 years from start date)
    const recurrenceEndDate = recurring !== 'never'
      ? (() => {
        const endDate = new Date(selectedDate);
        endDate.setFullYear(endDate.getFullYear() + 5);
        return formatDate(endDate);
      })()
      : null;

    try {
      const eventData: EventType = {
        id: eventId,
        title: title.trim(),
        type,
        date: dateStr,
        time: timeRange,
        location: location.trim(),
        color: '',
        createdBy: 0,
        editable: true,
        recurrencePattern: recurring,
        recurrenceEndDate: recurrenceEndDate,
        startAt,
        timezone: timezone ?? null,
      };

      const isValidTeamId = selectedTeamId &&
        selectedTeamId !== '' &&
        selectedTeamId !== 'all' &&
        teams.some(t => String(t.id) === selectedTeamId);

      if (isValidTeamId) {
        await updateTeamEvent(selectedTeamId, eventData);
      } else {
        await updateEvent(eventData);
      }

      await scheduleEventReminders(eventData).catch(() => {});
      refetchAndRescheduleEventReminders().catch(() => {});
      if (isValidTeamId) {
        router.back();
      } else {
        if (router.canGoBack()) {
          router.back();
          setTimeout(() => {
            if (router.canGoBack()) {
              router.back();
            }
          }, 100);
        } else {
          router.replace('/(tabs)/calendar');
        }
      }
    } catch (error: any) {
      console.error('Failed to update event:', error);
      Alert.alert('Error', error?.message || 'Failed to update event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    hapticLight();

    // Check if there are future recurring events with the same title, time, and location
    // Use original event data to detect recurring series (not the potentially edited form state)
    let futureRecurringEvents: EventType[] = [];
    if (originalEvent) {
      try {
        const isValidTeamId = selectedTeamId &&
          selectedTeamId !== '' &&
          selectedTeamId !== 'all' &&
          teams.some(t => String(t.id) === selectedTeamId);

        // Get all events to check for recurring series
        let allEvents: EventType[] = [];
        if (isValidTeamId) {
          allEvents = await listTeamEvents(selectedTeamId);
        } else {
          allEvents = await listMyEvents();
        }

        // Find future recurring event instances
        // If the original event has a recurrence pattern, we need to check for expanded instances
        const currentEventDate = parseLocalDate(originalEvent.date);
        futureRecurringEvents = allEvents.filter(e => {
          if (e.id === eventId) return false;
          if (e.originalEventId === eventId || (e.isRecurringInstance && e.originalEventId === eventId)) {
            const eventDate = parseLocalDate(e.date);
            return eventDate > currentEventDate;
          }
          const eventDate = parseLocalDate(e.date);
          return (
            e.title.trim() === originalEvent.title.trim() &&
            e.time === originalEvent.time &&
            e.location.trim() === originalEvent.location.trim() &&
            e.type === originalEvent.type &&
            eventDate > currentEventDate &&
            !e.isRecurringInstance
          );
        });
      } catch (error) {
        console.error('Failed to check for recurring events:', error);
      }
    }

    // If there are future recurring events, show options
    if (futureRecurringEvents.length > 0) {
      Alert.alert(
        'Delete Recurring Event',
        `This event is part of a recurring series. Would you like to delete only this event or all future events?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'This Event Only',
            style: 'default',
            onPress: async () => {
              await performDelete(false, futureRecurringEvents);
            },
          },
          {
            text: 'All Future Events',
            style: 'destructive',
            onPress: async () => {
              await performDelete(true, futureRecurringEvents);
            },
          },
        ]
      );
    } else {
      // No recurring events, show standard delete confirmation
      Alert.alert(
        'Delete Event',
        'Are you sure you want to delete this event? This action cannot be undone.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await performDelete(false, []);
            },
          },
        ]
      );
    }
  };

  const performDelete = async (deleteAllFuture: boolean, futureEvents: EventType[]) => {
    setDeleting(true);
    try {
      const isValidTeamId = selectedTeamId &&
        selectedTeamId !== '' &&
        selectedTeamId !== 'all' &&
        teams.some(t => String(t.id) === selectedTeamId);

      // Delete the current event
      if (isValidTeamId) {
        await deleteTeamEvent(selectedTeamId, eventId);
      } else {
        await deleteEvent(eventId);
      }

      // If deleting all future events, delete them too
      if (deleteAllFuture && futureEvents.length > 0) {
        for (const futureEvent of futureEvents) {
          try {
            // Try to determine if this is a team event by checking if it exists in any team's events
            // For efficiency, we'll try deleting as the same type as the current event first
            if (isValidTeamId) {
              try {
                await deleteTeamEvent(selectedTeamId, futureEvent.id);
              } catch (error) {
                // If team delete fails, try as personal event
                await deleteEvent(futureEvent.id);
              }
            } else {
              try {
                await deleteEvent(futureEvent.id);
              } catch (error) {
                // If personal delete fails, try to find which team it belongs to and delete as team event
                let found = false;
                for (const team of teams) {
                  try {
                    const teamEvents = await listTeamEvents(team.id.toString());
                    if (teamEvents.some(te => te.id === futureEvent.id)) {
                      await deleteTeamEvent(team.id.toString(), futureEvent.id);
                      found = true;
                      break;
                    }
                  } catch (err) {
                    // Continue checking other teams
                  }
                }
                if (!found) {
                  throw error; // Re-throw if we couldn't delete it
                }
              }
            }
          } catch (error) {
            console.error(`Failed to delete future event ${futureEvent.id}:`, error);
            // Continue deleting other events even if one fails
          }
        }
      }

      // Close both the edit screen and event detail screen
      // First back closes edit-event screen, second back closes event-detail screen
      router.back();
      setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        }
      }, 100);
    } catch (error: any) {
      console.error('Failed to delete event:', error);
      Alert.alert('Error', error?.message || 'Failed to delete event. Please try again.');
    } finally {
      setDeleting(false);
    }
  };


  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen>
          <Stack.Header
            style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
           />
            <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
              Edit Event
            </Stack.Screen.Title>
            <Stack.Toolbar placement="left">
              <Stack.Toolbar.Button
                icon="xmark"
                onPress={() => router.back()}
                tintColor="#ffffff"
              />
            </Stack.Toolbar>
        </Stack.Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
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
            Edit Event
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
              <View className="gap-y-6">
                <View className="flex-row items-center justify-center">
                  <Feather name="calendar" size={24} color={calendarIconColor} style={{ marginRight: 12 }} />
                  <Text className="text-2xl font-bold text-white">Event Details</Text>
                </View>

                <View>
                  <Text className="text-gray-300 font-medium text-lg mb-2">Calendar</Text>
                  <ContextMenu
                    options={[
                      { label: 'Personal', value: 'personal', onPress: () => setSelectedTeamId('') },
                      ...teams.map(team => ({
                        label: team.name,
                        value: String(team.id),
                        onPress: () => setSelectedTeamId(String(team.id)),
                      })),
                    ]}
                    trigger={
                      <TouchableOpacity
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          minHeight: 44,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
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
                </View>

                <View>
                  <Text className="text-gray-300 font-medium text-lg mb-2">Type</Text>
                  <ContextMenu
                    options={createContextMenuOptions(['practice', 'match', 'tournament', 'other'], type, setType, { 'practice': 'Practice', 'match': 'Match', 'tournament': 'Tournament', 'other': 'Other' })}
                    trigger={
                      <TouchableOpacity
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          minHeight: 44,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ color: '#ffffff', fontSize: 16 }}>
                          {formatLabel(type, { 'practice': 'Practice', 'match': 'Match', 'tournament': 'Tournament', 'other': 'Other' })}
                        </Text>
                        <Feather name="chevron-down" size={20} color="#9ca3af" />
                      </TouchableOpacity>
                    }
                  />
                </View>

                <View>
                  <Text className="text-gray-300 font-medium text-lg mb-2">Title</Text>
                  <TextInput
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      color: '#ffffff',
                      fontSize: 16,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      minHeight: 44,
                    }}
                    placeholder="Event title"
                    placeholderTextColor="#6b7280"
                    value={title}
                    onChangeText={setTitle}
                  />
                </View>

                <View>
                  <Text className="text-gray-300 font-medium text-lg mb-2">Date & Time</Text>
                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      setShowDatePicker(!showDatePicker);
                      setShowStartTimePicker(false);
                      setShowEndTimePicker(false);
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      minHeight: 44,
                      marginBottom: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: '#ffffff', fontSize: 16 }}>
                      {selectedDate.toLocaleDateString('en-US', {
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
                        value={selectedDate}
                        mode="date"
                        display="spinner"
                        textColor="#ffffff"
                        onChange={(event, date) => {
                          if (date) {
                            const normalizedDate = new Date(
                              date.getFullYear(),
                              date.getMonth(),
                              date.getDate()
                            );
                            setSelectedDate(normalizedDate);
                            const newStart = new Date(
                              date.getFullYear(),
                              date.getMonth(),
                              date.getDate(),
                              selectedStartTime.getHours(),
                              selectedStartTime.getMinutes()
                            );
                            setSelectedStartTime(newStart);
                            const newEnd = new Date(
                              date.getFullYear(),
                              date.getMonth(),
                              date.getDate(),
                              selectedEndTime.getHours(),
                              selectedEndTime.getMinutes()
                            );
                            setSelectedEndTime(newEnd);
                          }
                        }}
                        style={{ backgroundColor: 'transparent', height: 180 }}
                      />
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      setShowStartTimePicker(!showStartTimePicker);
                      setShowDatePicker(false);
                      setShowEndTimePicker(false);
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      minHeight: 44,
                      marginBottom: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
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
                            // Ensure end time is after start time
                            const startTimeMs = date.getTime();
                            const endTimeMs = selectedEndTime.getTime();
                            if (endTimeMs <= startTimeMs) {
                              // Set end time to 1 hour after start time
                              const newEndTime = new Date(date);
                              newEndTime.setHours(newEndTime.getHours() + 1);
                              setSelectedEndTime(newEndTime);
                            }
                          }
                        }}
                        style={{ backgroundColor: 'transparent', height: 180 }}
                      />
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      setShowEndTimePicker(!showEndTimePicker);
                      setShowDatePicker(false);
                      setShowStartTimePicker(false);
                    }}
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      minHeight: 44,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
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
                            // Ensure end time is after start time
                            const startTimeMs = selectedStartTime.getTime();
                            const endTimeMs = date.getTime();
                            if (endTimeMs <= startTimeMs) {
                              // If end time is before or equal to start time, set it to 1 hour after start
                              const newEndTime = new Date(selectedStartTime);
                              newEndTime.setHours(newEndTime.getHours() + 1);
                              setSelectedEndTime(newEndTime);
                              Alert.alert('Invalid Time', 'End time must be after start time. End time has been adjusted.');
                            } else {
                              setSelectedEndTime(date);
                            }
                          }
                        }}
                        style={{ backgroundColor: 'transparent', height: 180 }}
                      />
                    </View>
                  )}
                </View>

                <View>
                  <Text className="text-gray-300 font-medium text-lg mb-2">Location</Text>
                  <TextInput
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      color: '#ffffff',
                      fontSize: 16,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      minHeight: 44,
                    }}
                    placeholder="Location"
                    placeholderTextColor="#6b7280"
                    value={location}
                    onChangeText={setLocation}
                  />
                </View>

                <View>
                  <Text className="text-gray-300 font-medium text-lg mb-2">Repeat</Text>
                  <ContextMenu
                    options={[
                      { label: 'Never', value: 'never', onPress: () => setRecurring('never') },
                      { label: 'Every Day', value: 'daily', onPress: () => setRecurring('daily') },
                      { label: 'Every Week', value: 'weekly', onPress: () => setRecurring('weekly') },
                      { label: 'Every 2 Weeks', value: 'biweekly', onPress: () => setRecurring('biweekly') },
                      { label: 'Every Month', value: 'monthly', onPress: () => setRecurring('monthly') },
                      { label: 'Every Year', value: 'yearly', onPress: () => setRecurring('yearly') },
                    ]}
                    trigger={
                      <TouchableOpacity
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.1)',
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.3)',
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          minHeight: 44,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ color: '#ffffff', fontSize: 16 }}>
                          {recurring === 'never' ? 'Never' :
                            recurring === 'daily' ? 'Every Day' :
                              recurring === 'weekly' ? 'Every Week' :
                                recurring === 'biweekly' ? 'Every 2 Weeks' :
                                  recurring === 'monthly' ? 'Every Month' :
                                    'Every Year'}
                        </Text>
                        <Feather name="chevron-down" size={20} color="#9ca3af" />
                      </TouchableOpacity>
                    }
                  />
                </View>

                <View className="flex-row justify-between gap-4 pt-4">
                  <TouchableOpacity
                    onPress={handleDelete}
                    disabled={deleting}
                    activeOpacity={0.8}
                    style={{
                      overflow: 'hidden',
                      borderRadius: 8,
                      opacity: deleting ? 0.5 : 1,
                    }}
                  >
                    <LinearGradient
                      colors={['#ef4444', '#dc2626']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                        minHeight: 44,
                      }}
                    >
                      {deleting ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Feather name="trash-2" size={20} color="#ffffff" />
                      )}
                      <Text className="text-white font-medium text-base">
                        {deleting ? 'Deleting...' : 'Delete'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <View className="flex-row gap-2" style={{ flex: 1, justifyContent: 'center' }}>
                    <TouchableOpacity
                      onPress={() => {
                        hapticLight();
                        router.back();
                      }}
                      className="px-5 rounded-lg"
                      activeOpacity={0.7}
                      style={{
                        flexShrink: 0,
                        paddingVertical: 12,
                        minHeight: 44,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text className="text-gray-400 text-base">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSave}
                      disabled={saving || !title.trim()}
                      activeOpacity={0.8}
                      style={{
                        overflow: 'hidden',
                        borderRadius: 8,
                        opacity: saving || !title.trim() ? 0.5 : 1,
                        flex: 1,
                        minWidth: 140,
                      }}
                    >
                      <LinearGradient
                        colors={saveButtonGradient as [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                          paddingHorizontal: 20,
                          paddingVertical: 12,
                          minHeight: 44,
                          justifyContent: 'center',
                        }}
                      >
                        {saving ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Feather name="save" size={20} color="#ffffff" />
                        )}
                        <Text className="text-white font-medium text-base" numberOfLines={1}>
                          {saving ? 'Saving...' : 'Save Event'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>
          <KeyboardSpacer extraOffset={40} />
        </View>
      </ScrollView>

      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date && event.type !== 'dismissed') {
              const normalizedDate = new Date(
                date.getFullYear(),
                date.getMonth(),
                date.getDate()
              );
              setSelectedDate(normalizedDate);
              const newStart = new Date(
                date.getFullYear(),
                date.getMonth(),
                date.getDate(),
                selectedStartTime.getHours(),
                selectedStartTime.getMinutes()
              );
              setSelectedStartTime(newStart);
              const newEnd = new Date(
                date.getFullYear(),
                date.getMonth(),
                date.getDate(),
                selectedEndTime.getHours(),
                selectedEndTime.getMinutes()
              );
              setSelectedEndTime(newEnd);
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
              // Ensure end time is after start time
              const startTimeMs = date.getTime();
              const endTimeMs = selectedEndTime.getTime();
              if (endTimeMs <= startTimeMs) {
                // Set end time to 1 hour after start time
                const newEndTime = new Date(date);
                newEndTime.setHours(newEndTime.getHours() + 1);
                setSelectedEndTime(newEndTime);
              }
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
              // Ensure end time is after start time
              const startTimeMs = selectedStartTime.getTime();
              const endTimeMs = date.getTime();
              if (endTimeMs <= startTimeMs) {
                // If end time is before or equal to start time, set it to 1 hour after start
                const newEndTime = new Date(selectedStartTime);
                newEndTime.setHours(newEndTime.getHours() + 1);
                setSelectedEndTime(newEndTime);
                Alert.alert('Invalid Time', 'End time must be after start time. End time has been adjusted.');
              } else {
                setSelectedEndTime(date);
              }
            }
          }}
        />
      )}


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
});
