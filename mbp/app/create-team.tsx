import React, { useState } from 'react';
import { Stack, router } from 'expo-router';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Switch, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { createTeam, uploadTeamImage } from '../src/api/teams';
import { useTeams } from '../src/contexts/TeamsContext';
import TeamImageUpload from '../src/components/TeamImageUpload';
import { hapticLight, hapticMedium } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { GradientColorPicker } from '../src/components/GradientColorPicker';

export default function CreateTeamScreen() {
  const insets = useSafeAreaInsets();
  const { refresh } = useTeams();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [requestToJoin, setRequestToJoin] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [loading, setLoading] = useState(false);
  const [teamImageBlob, setTeamImageBlob] = useState<Blob | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [iconColorStart, setIconColorStart] = useState<string>('#3b82f6');
  const [iconColorEnd, setIconColorEnd] = useState<string>('#06b6d4');
  
  const gradientOptions = [
    { name: 'Blue', start: '#3b82f6', end: '#06b6d4' },
    { name: 'Green', start: '#22c55e', end: '#10b981' },
    { name: 'Purple', start: '#a855f7', end: '#8b5cf6' },
    { name: 'Pink', start: '#ec4899', end: '#db2777' },
    { name: 'Red', start: '#ef4444', end: '#dc2626' },
    { name: 'Orange', start: '#f97316', end: '#ea580c' },
    { name: 'Amber', start: '#f59e0b', end: '#d97706' },
    { name: 'Indigo', start: '#6366f1', end: '#4f46e5' },
    { name: 'Teal', start: '#14b8a6', end: '#0d9488' },
    { name: 'Rose', start: '#f43f5e', end: '#e11d48' },
    { name: 'Cyan', start: '#06b6d4', end: '#0891b2' },
    { name: 'Emerald', start: '#10b981', end: '#059669' },
  ];

  const duplicateNameMessage = 'A team with this name already exists. Please choose a different name.';

  const handleNameChange = (val: string) => {
    const cleanVal = val.replace(/\r?\n/g, '');
    if (cleanVal.length > 25) {
      setName(cleanVal.slice(0, 25));
      setNameError('Name cannot exceed 25 characters');
    } else {
      setName(cleanVal);
      setNameError(null);
    }
    if (submitError) setSubmitError(null);
  };

  const handleDescriptionChange = (val: string) => {
    if (val.length > 150) {
      setDescription(val.slice(0, 150));
      setDescriptionError('Description cannot exceed 150 characters');
    } else {
      setDescription(val);
      setDescriptionError(null);
    }
  };

  const handleSubmit = async () => {
    if (!name || nameError || descriptionError) return;
    setLoading(true);
    setSubmitError(null);
    hapticMedium();
    try {
      const team = await createTeam(
        name,
        description,
        visibility,
        accessCode || undefined,
        requestToJoin,
        iconColorStart,
        iconColorEnd
      );
      
      if (teamImageBlob && team.id) {
        try {
          await uploadTeamImage(team.id, teamImageBlob);
        } catch (e) {
          console.error('Failed to upload team image:', e);
        }
      }
      
      await refresh();
      router.back();
    } catch (e: any) {
      console.error('Failed to create team:', e);
      const msg = e?.message ?? '';
      const isDuplicateName =
        typeof msg === 'string' &&
        (msg.includes('already exists') || msg.toLowerCase().includes('duplicate'));
      if (isDuplicateName) {
        setNameError(duplicateNameMessage);
        setSubmitError(null);
      } else {
        setNameError(null);
        setSubmitError(msg || 'Failed to create team. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = async (blob: Blob): Promise<void> => {
    setTeamImageBlob(blob);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Create Team
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
          paddingBottom: Math.max(insets.bottom + 40, 60),
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={{ maxWidth: 768, alignSelf: 'center', width: '100%' }}>
          <View style={{ gap: 24 }}>
            <View className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6 shadow-lg" style={{ position: 'relative' }}>
              <View className="flex-row items-center">
                <Feather name="users" size={24} color="#60a5fa" className="mr-3" />
                <Text className="text-2xl font-bold text-white">Team Details</Text>
              </View>

              <View style={{ position: 'absolute', top: 24, right: 24 }}>
                <GradientColorPicker
                  trigger={
                    <TouchableOpacity
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        borderWidth: 2,
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={[iconColorStart, iconColorEnd]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Feather name="droplet" size={16} color="#ffffff" />
                      </LinearGradient>
                    </TouchableOpacity>
                  }
                  gradients={gradientOptions}
                  selectedStart={iconColorStart}
                  selectedEnd={iconColorEnd}
                  onSelect={(start, end) => {
                    setIconColorStart(start);
                    setIconColorEnd(end);
                  }}
                />
              </View>

              <View className="items-center" style={{ paddingTop: 8, paddingBottom: 8, marginBottom: 8 }}>
                <TeamImageUpload
                  onImageSelect={handleImageSelect}
                  disabled={loading}
                  iconColorStart={iconColorStart}
                  iconColorEnd={iconColorEnd}
                />
              </View>

              <View>
                <Text className="text-gray-300 font-medium text-lg mb-2">Team Name</Text>
                <TextInput
                  value={name.length > 25 ? name.slice(0, 25) : name}
                  onChangeText={handleNameChange}
                  placeholder="Enter team name"
                  maxLength={25}
                  placeholderTextColor="#6b7280"
                  style={[
                    {
                      color: '#ffffff',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderWidth: 1,
                      borderRadius: 8,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      fontSize: 16,
                      minHeight: 44,
                    },
                    nameError
                      ? { borderColor: 'rgba(239, 68, 68, 0.6)' }
                      : { borderColor: 'rgba(255, 255, 255, 0.2)' },
                  ]}
                />
                {nameError && (
                  <Text className="text-red-400 text-sm mt-1.5">{nameError}</Text>
                )}
              </View>

              <View>
                <Text className="text-gray-300 font-medium text-lg mb-2">Description</Text>
                <TextInput
                  value={description}
                  onChangeText={handleDescriptionChange}
                  placeholder="What's this team about?"
                  maxLength={150}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor="#6b7280"
                  style={{
                    color: '#ffffff',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: 16,
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }}
                />
                {descriptionError && (
                  <Text className="text-red-500 text-sm mt-1">{descriptionError}</Text>
                )}
              </View>

              <View>
                <Text className="text-gray-300 font-medium text-lg mb-2">Access Code (optional)</Text>
                <TextInput
                  value={accessCode}
                  onChangeText={setAccessCode}
                  placeholder="Leave empty for no code"
                  placeholderTextColor="#6b7280"
                  style={{
                    color: '#ffffff',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: 16,
                    minHeight: 44,
                  }}
                />
                <Text className="text-xs text-gray-500 mt-1">Members will need this code to join</Text>
              </View>

              <View className="flex-row items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10">
                <Switch
                  value={requestToJoin}
                  onValueChange={setRequestToJoin}
                  trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: '#3b82f6' }}
                  thumbColor="#ffffff"
                />
                <Text className="text-sm text-white flex-1">Require approval to join</Text>
              </View>

              <View>
                <Text className="text-gray-300 font-medium text-lg mb-3">Visibility</Text>
                <View className="flex-row gap-4">
                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      setVisibility('public');
                    }}
                    className={`flex-1 flex-row items-center gap-3 p-4 rounded-lg border ${
                      visibility === 'public'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name="globe"
                      size={20}
                      color={visibility === 'public' ? '#60a5fa' : '#9ca3af'}
                    />
                    <View className="flex-1">
                      <Text
                        className={`font-medium ${
                          visibility === 'public' ? 'text-white' : 'text-gray-400'
                        }`}
                      >
                        Public
                      </Text>
                      <Text className="text-xs text-gray-500">Discoverable by everyone</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      setVisibility('private');
                    }}
                    className={`flex-1 flex-row items-center gap-3 p-4 rounded-lg border ${
                      visibility === 'private'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name="lock"
                      size={20}
                      color={visibility === 'private' ? '#60a5fa' : '#9ca3af'}
                    />
                    <View className="flex-1">
                      <Text
                        className={`font-medium ${
                          visibility === 'private' ? 'text-white' : 'text-gray-400'
                        }`}
                      >
                        Private
                      </Text>
                      <Text className="text-xs text-gray-500">Invite only</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>

              {submitError && (
                <View className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex-row items-center gap-2">
                  <Feather name="alert-circle" size={16} color="#f87171" />
                  <Text className="text-red-400 text-sm flex-1">{submitError}</Text>
                </View>
              )}

              <View className="flex-row justify-end gap-4 pt-4">
                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    router.back();
                  }}
                  className="px-5 py-2.5 rounded-lg"
                  disabled={loading}
                >
                  <Text className="text-gray-400 text-base">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={loading || !name || !!nameError || !!descriptionError}
                  activeOpacity={0.8}
                  style={{ 
                    overflow: 'hidden', 
                    borderRadius: 8,
                    opacity: loading || !name || !!nameError || !!descriptionError ? 0.5 : 1,
                  }}
                >
                  <LinearGradient
                    colors={['#3b82f6', '#06b6d4']}
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
                    {loading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Feather name="save" size={20} color="#ffffff" />
                    )}
                    <Text className="text-white font-medium text-base">
                      {loading ? 'Creating...' : 'Create Team'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <KeyboardSpacer extraOffset={40} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
});

