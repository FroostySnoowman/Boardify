import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { createTeam, uploadTeamImage } from '../../api/teams';
import { useTeams } from '../../contexts/TeamsContext';
import TeamImageUpload from '../../components/TeamImageUpload';
import { hapticLight, hapticMedium } from '../../utils/haptics';

export default function CreateTeamScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { refresh } = useTeams();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [requestToJoin, setRequestToJoin] = useState(false);
  const [visibility, setVisibility] = useState<'public' | 'private'>('private');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [teamImageBlob, setTeamImageBlob] = useState<Blob | null>(null);

  const handleNameChange = (val: string) => {
    if (submitError) setSubmitError(null);
    const cleanVal = val.replace(/\r?\n/g, '');
    // Enforce strict 25 character limit
    const limitedVal = cleanVal.length > 25 ? cleanVal.slice(0, 25) : cleanVal;
    setName(limitedVal);
    
    // Check trimmed length for validation
    const trimmedVal = limitedVal.trim();
    if (trimmedVal.length > 25) {
      setNameError('Name cannot exceed 25 characters');
    } else if (limitedVal.length === 25 && trimmedVal.length < 25) {
      // Has trailing spaces that will be trimmed
      setNameError('Name cannot exceed 25 characters');
    } else {
      setNameError(null);
    }
  };

  const handleDescriptionChange = (val: string) => {
    if (submitError) setSubmitError(null);
    if (val.length > 150) {
      setDescription(val.slice(0, 150));
      setDescriptionError('Description cannot exceed 150 characters');
    } else {
      setDescription(val);
      setDescriptionError(null);
    }
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || nameError || descriptionError) return;
    if (trimmedName.length > 25) {
      setNameError('Name cannot exceed 25 characters');
      setLoading(false);
      return;
    }
    setSubmitError(null);
    setLoading(true);
    hapticMedium();
    try {
      const team = await createTeam(
        trimmedName,
        description.trim(),
        visibility,
        accessCode || undefined,
        requestToJoin
      );
      
      if (teamImageBlob && team.id) {
        try {
          await uploadTeamImage(team.id, teamImageBlob);
        } catch (e) {
          console.error('Failed to upload team image:', e);
        }
      }
      
      await refresh();
      (navigation as any).navigate('TeamDashboard');
    } catch (e: any) {
      console.error('Failed to create team:', e);
      const msg = e?.message ?? '';
      const isDuplicateName =
        typeof msg === 'string' &&
        (msg.includes('already exists') || msg.toLowerCase().includes('duplicate'));
      if (isDuplicateName) {
        setNameError('A team with this name already exists.');
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
    <View className="flex-1" style={{ backgroundColor: '#020617' }}>
      {/* Header */}
      <View className="h-16 border-b border-white/5 bg-[#020617] flex-row items-center justify-between px-6">
        <View className="flex-row items-center gap-4">
          <Feather name="users" size={24} color="#9ca3af" />
          <Text className="text-xl font-bold text-white">Create Team</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            navigation.goBack();
          }}
          className="p-2 rounded-lg"
        >
          <Feather name="x" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 24,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="max-w-2xl mx-auto" style={{ width: '100%' }}>
          {/* Team Image Upload */}
          <View className="items-center mb-6">
            <TeamImageUpload
              onImageSelect={handleImageSelect}
              disabled={loading}
            />
          </View>

          {/* Team Name */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-300 mb-2">Team Name</Text>
            <TextInput
              value={name.length > 25 ? name.slice(0, 25) : name}
              onChangeText={handleNameChange}
              placeholder="Enter team name"
              maxLength={25}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500"
              placeholderTextColor="#6b7280"
              style={{
                color: '#ffffff',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
              }}
            />
            {nameError && (
              <Text className="text-red-500 text-sm mt-1">{nameError}</Text>
            )}
          </View>

          {/* Description */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-300 mb-2">Description</Text>
            <TextInput
              value={description}
              onChangeText={handleDescriptionChange}
              placeholder="What's this team about?"
              maxLength={150}
              multiline
              numberOfLines={3}
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500"
              placeholderTextColor="#6b7280"
              style={{
                color: '#ffffff',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
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

          {/* Access Code */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-300 mb-2">Access Code (optional)</Text>
            <TextInput
              value={accessCode}
              onChangeText={setAccessCode}
              placeholder="Leave empty for no code"
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500"
              placeholderTextColor="#6b7280"
              style={{
                color: '#ffffff',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 16,
              }}
            />
            <Text className="text-xs text-gray-500 mt-1">Members will need this code to join</Text>
          </View>

          {/* Request to Join */}
          <View className="flex-row items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10 mb-6">
            <Switch
              value={requestToJoin}
              onValueChange={setRequestToJoin}
              trackColor={{ false: 'rgba(255, 255, 255, 0.2)', true: '#3b82f6' }}
              thumbColor="#ffffff"
            />
            <Text className="text-sm text-white flex-1">Require approval to join</Text>
          </View>

          {/* Visibility */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-300 mb-3">Visibility</Text>
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
            <View className="flex-row items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 mt-2">
              <Feather name="alert-circle" size={18} color="#f87171" />
              <Text className="text-red-400 text-sm flex-1">{submitError}</Text>
            </View>
          )}

          {/* Actions */}
          <View className="flex-row justify-end gap-4 pt-4">
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                navigation.goBack();
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
              style={{ overflow: 'hidden', borderRadius: 8 }}
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
                  paddingVertical: 10,
                  opacity: loading || !name || !!nameError || !!descriptionError ? 0.5 : 1,
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
      </ScrollView>
    </View>
  );
}

