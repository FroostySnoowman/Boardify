import React, { useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createLadder, updateLadder } from '../src/api/teams';
import { hapticLight } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

const BACKGROUND_COLOR = '#020617';

// Helper to parse YYYY-MM-DD string to Date
const parseDate = (dateStr: string | undefined): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return isNaN(date.getTime()) ? null : date;
};

// Helper to format Date to YYYY-MM-DD string
const formatDateString = (date: Date | null): string => {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to format Date for display
const formatDateDisplay = (date: Date | null): string => {
  if (!date) return 'Not set';
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

export default function CreateSeasonScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const teamId = params.teamId as string;
  const ladderId = params.ladderId as string | undefined;
  const initialName = params.name as string | undefined;
  const initialDescription = params.description as string | undefined;
  const initialStartDate = params.startDate as string | undefined;
  const initialEndDate = params.endDate as string | undefined;

  const isEditing = !!ladderId;

  const [name, setName] = useState(initialName || '');
  const [description, setDescription] = useState(initialDescription || '');
  const [startDate, setStartDate] = useState<Date | null>(parseDate(initialStartDate));
  const [endDate, setEndDate] = useState<Date | null>(parseDate(initialEndDate));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Season name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (isEditing) {
        await updateLadder(teamId, ladderId!, {
          name: name.trim(),
          description: description.trim() || undefined,
          startDate: formatDateString(startDate) || null,
          endDate: formatDateString(endDate) || null,
        });
      } else {
        await createLadder(
          teamId,
          name.trim(),
          description.trim() || undefined,
          formatDateString(startDate) || null,
          formatDateString(endDate) || null
        );
      }
      hapticLight();
      router.back();
    } catch (e: any) {
      setError(e.message || 'Failed to save season');
    } finally {
      setSaving(false);
    }
  };

  const handleStartDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
    if (date) {
      setStartDate(date);
    }
  };

  const handleEndDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
    if (date) {
      setEndDate(date);
    }
  };

  const clearStartDate = () => {
    hapticLight();
    setStartDate(null);
    setShowStartPicker(false);
  };

  const clearEndDate = () => {
    hapticLight();
    setEndDate(null);
    setShowEndPicker(false);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            {isEditing ? 'Edit Season' : 'New Season'}
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
                <View>
                  <Text className="text-gray-300 font-medium text-lg mb-2">Season Name *</Text>
                  <TextInput
                    placeholder="e.g., Spring 2026"
                    placeholderTextColor="#9ca3af"
                    value={name}
                    onChangeText={setName}
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      color: '#ffffff',
                      fontSize: 16,
                      minHeight: 44,
                    }}
                  />
                </View>

                <View>
                  <Text className="text-gray-300 font-medium text-lg mb-2">Description</Text>
                  <TextInput
                    placeholder="Optional description..."
                    placeholderTextColor="#9ca3af"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.3)',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      color: '#ffffff',
                      fontSize: 16,
                      minHeight: 88,
                      textAlignVertical: 'top',
                    }}
                  />
                </View>

                <View>
                  <Text className="text-gray-300 font-medium text-lg mb-2">Date Range (Optional)</Text>
                  <Text className="text-gray-500 text-sm mb-3">
                    Set a start and/or end date for this season.
                  </Text>
                  
                  <View style={{ marginBottom: 12 }}>
                    <Text className="text-gray-400 text-sm mb-2">Start Date</Text>
                    <TouchableOpacity
                      onPress={() => {
                        hapticLight();
                        setShowStartPicker(!showStartPicker);
                        setShowEndPicker(false);
                      }}
                      style={{
                        width: '100%',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        minHeight: 44,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: startDate ? '#ffffff' : '#6b7280', fontSize: 16 }}>
                        {formatDateDisplay(startDate)}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {startDate && (
                          <TouchableOpacity onPress={clearStartDate} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Feather name="x-circle" size={18} color="#9ca3af" />
                          </TouchableOpacity>
                        )}
                        <Feather name="calendar" size={20} color="#9ca3af" />
                      </View>
                    </TouchableOpacity>
                    
                    {showStartPicker && Platform.OS === 'ios' && (
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
                          <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>Select Start Date</Text>
                          <TouchableOpacity
                            onPress={() => {
                              hapticLight();
                              setShowStartPicker(false);
                            }}
                            activeOpacity={0.7}
                            style={{ paddingVertical: 6, paddingHorizontal: 12 }}
                          >
                            <Text style={{ color: '#60a5fa', fontSize: 15, fontWeight: '600' }}>Done</Text>
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={startDate || new Date()}
                          mode="date"
                          display="spinner"
                          textColor="#ffffff"
                          onChange={handleStartDateChange}
                          style={{ backgroundColor: 'transparent', height: 180 }}
                        />
                      </View>
                    )}
                  </View>

                  <View>
                    <Text className="text-gray-400 text-sm mb-2">End Date</Text>
                    <TouchableOpacity
                      onPress={() => {
                        hapticLight();
                        setShowEndPicker(!showEndPicker);
                        setShowStartPicker(false);
                      }}
                      style={{
                        width: '100%',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        minHeight: 44,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: endDate ? '#ffffff' : '#6b7280', fontSize: 16 }}>
                        {formatDateDisplay(endDate)}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {endDate && (
                          <TouchableOpacity onPress={clearEndDate} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Feather name="x-circle" size={18} color="#9ca3af" />
                          </TouchableOpacity>
                        )}
                        <Feather name="calendar" size={20} color="#9ca3af" />
                      </View>
                    </TouchableOpacity>
                    
                    {showEndPicker && Platform.OS === 'ios' && (
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
                          <Text style={{ fontSize: 16, fontWeight: '600', color: '#ffffff' }}>Select End Date</Text>
                          <TouchableOpacity
                            onPress={() => {
                              hapticLight();
                              setShowEndPicker(false);
                            }}
                            activeOpacity={0.7}
                            style={{ paddingVertical: 6, paddingHorizontal: 12 }}
                          >
                            <Text style={{ color: '#60a5fa', fontSize: 15, fontWeight: '600' }}>Done</Text>
                          </TouchableOpacity>
                        </View>
                        <DateTimePicker
                          value={endDate || new Date()}
                          mode="date"
                          display="spinner"
                          textColor="#ffffff"
                          onChange={handleEndDateChange}
                          minimumDate={startDate || undefined}
                          style={{ backgroundColor: 'transparent', height: 180 }}
                        />
                      </View>
                    )}
                  </View>
                </View>

                {error ? (
                  <View className="p-3 rounded-lg bg-red-500/20 border border-red-500/30">
                    <Text className="text-red-400 text-sm">{error}</Text>
                  </View>
                ) : null}

                <View className="flex-row justify-end gap-4 pt-4">
                  <TouchableOpacity
                    onPress={() => router.back()}
                    className="px-5 py-2.5 rounded-lg"
                    activeOpacity={0.7}
                  >
                    <Text className="text-gray-400 text-base">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving || !name.trim()}
                    activeOpacity={0.8}
                    style={{ overflow: 'hidden', borderRadius: 8, opacity: saving || !name.trim() ? 0.5 : 1 }}
                  >
                    <LinearGradient
                      colors={['#1e40af', '#1e3a8a']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                        borderRadius: 8,
                        minHeight: 44,
                      }}
                    >
                      {saving ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <Feather name={isEditing ? 'check' : 'plus'} size={16} color="#ffffff" />
                          <Text className="text-white font-medium text-base">
                            {isEditing ? 'Save Changes' : 'Create Season'}
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
          <KeyboardSpacer extraOffset={40} />
        </View>
      </ScrollView>

      {showStartPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={startDate || new Date()}
          mode="date"
          display="default"
          onChange={handleStartDateChange}
        />
      )}
      {showEndPicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={endDate || new Date()}
          mode="date"
          display="default"
          onChange={handleEndDateChange}
          minimumDate={startDate || undefined}
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
