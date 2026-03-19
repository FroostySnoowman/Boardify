import React, { useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createEvent, createTeamEvent } from '../src/api/calendar';
import { listMyTeams } from '../src/api/teams';
import { refetchAndRescheduleEventReminders, scheduleEventReminders } from '../src/services/notifications';
import { useTeams } from '../src/contexts/TeamsContext';
import { hapticLight } from '../src/utils/haptics';
import { parseLocalDate } from '../src/utils/dateUtils';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { ContextMenu } from '../src/components/ContextMenu';

export default function NewEventScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string; teamId?: string }>();
  const { teams } = useTeams();
  const [selectedTeamId, setSelectedTeamId] = useState<string>(params.teamId || '');
  const [type, setType] = useState<'practice' | 'match' | 'tournament' | 'other'>('practice');
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const getNextHalfHour = () => {
    const now = new Date();
    const currentMinutes = now.getMinutes();
    const currentHours = now.getHours();
    
    let nextHours = currentHours;
    let nextMinutes = 0;
    
    if (currentMinutes < 30) {
      nextMinutes = 30;
    } else {
      nextHours = currentHours + 1;
      nextMinutes = 0;
    }
    
    const time = new Date();
    time.setHours(nextHours, nextMinutes, 0, 0);
    return time;
  };

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (params.date) {
      const dateParts = params.date.split('-');
      if (dateParts.length === 3) {
        const year = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);
        return new Date(year, month, day);
      }
      return parseLocalDate(params.date);
    }
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  });

  const [selectedStartTime, setSelectedStartTime] = useState<Date>(() => {
    return getNextHalfHour();
  });

  const [selectedEndTime, setSelectedEndTime] = useState<Date>(() => {
    const startTime = getNextHalfHour();
    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);
    return endTime;
  });
  const [recurring, setRecurring] = useState<'never' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'>('never');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

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
      const isValidTeamId = selectedTeamId && 
                            selectedTeamId !== '' && 
                            selectedTeamId !== 'all' &&
                            teams.some(t => String(t.id) === selectedTeamId);
      
      let created;
      if (isValidTeamId) {
        created = await createTeamEvent(
          selectedTeamId,
          title,
          type,
          dateStr,
          timeRange,
          location,
          '',
          undefined,
          recurring,
          recurrenceEndDate,
          startAt,
          timezone
        );
      } else {
        created = await createEvent(
          title,
          type,
          dateStr,
          timeRange,
          location,
          '',
          undefined,
          recurring,
          recurrenceEndDate,
          startAt,
          timezone
        );
      }

      await scheduleEventReminders(created).catch(() => {});
      refetchAndRescheduleEventReminders().catch(() => {});
      router.back();
    } catch (error: any) {
      console.error('Failed to create event:', error);
      Alert.alert('Error', error?.message || 'Failed to create event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const calendarOptions = [
    {
      label: 'Personal',
      value: '',
      onPress: () => setSelectedTeamId(''),
    },
    ...teams.map(team => ({
      label: team.name,
      value: String(team.id),
      onPress: () => setSelectedTeamId(String(team.id)),
    })),
  ];

  const typeOptions = [
    { label: 'Practice', value: 'practice', onPress: () => setType('practice') },
    { label: 'Match', value: 'match', onPress: () => setType('match') },
    { label: 'Tournament', value: 'tournament', onPress: () => setType('tournament') },
    { label: 'Other', value: 'other', onPress: () => setType('other') },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Create Event
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
              <View className="flex-row items-center">
                <Feather name="calendar" size={24} color="#60a5fa" className="mr-3" />
                <Text className="text-2xl font-bold text-white">Event Details</Text>
              </View>

              <View>
                <Text className="text-gray-300 font-medium text-lg mb-2">Calendar</Text>
                <ContextMenu
                  options={calendarOptions}
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
              </View>

              <View>
                <Text className="text-gray-300 font-medium text-lg mb-2">Type</Text>
                <ContextMenu
                  options={typeOptions}
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
                        {type.charAt(0).toUpperCase() + type.slice(1)}
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
                    paddingVertical: 12,
                    color: '#ffffff',
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
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
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
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
                    // Close other pickers
                    setShowDatePicker(false);
                    setShowEndTimePicker(false);
                  }}
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
                    // Close other pickers
                    setShowDatePicker(false);
                    setShowStartTimePicker(false);
                  }}
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
                    paddingVertical: 12,
                    color: '#ffffff',
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
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

              <View className="flex-row gap-2 pt-4">
                <TouchableOpacity
                  onPress={() => router.back()}
                  className="px-5 py-2.5 rounded-lg"
                  activeOpacity={0.7}
                >
                  <Text className="text-gray-400 text-base">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={saving || !title.trim()}
                  activeOpacity={0.9}
                  style={{ 
                    flex: 1, 
                    overflow: 'hidden', 
                    borderRadius: 8, 
                    opacity: saving || !title.trim() ? 0.5 : 1 
                  }}
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
                    {saving ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '500' }}>Save Event</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
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

