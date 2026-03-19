import React, { useState, useCallback } from 'react';
import { Stack, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { joinTeam, createJoinRequest } from '../src/api/teams';
import { useTeams } from '../src/contexts/TeamsContext';
import { hapticLight, hapticMedium } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { Feather } from '@expo/vector-icons';

const BACKGROUND_COLOR = '#020617';

export default function AccessCodeScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ teamId: string; teamName: string; requestToJoin?: string }>();
  const { refresh } = useTeams();
  const teamId = params.teamId;
  const teamName = params.teamName ? decodeURIComponent(params.teamName) : '';
  const requestToJoin = params.requestToJoin === 'true';

  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [sendingRequest, setSendingRequest] = useState(false);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setError(null);
        setJoining(false);
        setRequestSent(false);
        setRequestError(null);
        setSendingRequest(false);
      };
    }, [])
  );

  const handleJoinWithCode = async () => {
    if (!teamId || !accessCode.trim()) return;
    setError(null);
    setJoining(true);
    try {
      await joinTeam(teamId, accessCode.trim());
      hapticMedium();
      if (requestToJoin) {
        setRequestSent(false);
        setRequestError(null);
        setSendingRequest(true);
        try {
          await createJoinRequest(teamId, accessCode.trim());
          hapticMedium();
          await refresh();
          setRequestSent(true);
        } catch (e: any) {
          setRequestError(e.message || 'Failed to send request');
        } finally {
          setSendingRequest(false);
        }
      } else {
        await refresh();
        router.back();
      }
    } catch (e: any) {
      setError(e.message || 'Invalid access code');
    } finally {
      setJoining(false);
    }
  };

  const handleDone = () => {
    hapticLight();
    router.back();
  };

  if (!teamId) {
    router.back();
    return null;
  }

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Join Team
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
            <View className="p-6 rounded-2xl bg-white/5 border border-white/10 shadow-lg">
              {requestSent ? (
                <View style={{ alignItems: 'center' }}>
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: 'rgba(34, 197, 94, 0.2)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <Feather name="check" size={32} color="#22c55e" />
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff', marginBottom: 8, textAlign: 'center' }}>
                    Request sent
                  </Text>
                  <Text style={{ fontSize: 14, color: '#9ca3af', marginBottom: 24, textAlign: 'center' }}>
                    Your request to join "{teamName}" has been sent. You'll be notified when approved.
                  </Text>
                  <TouchableOpacity
                    onPress={handleDone}
                    activeOpacity={0.8}
                    style={{ overflow: 'hidden', borderRadius: 8 }}
                  >
                    <LinearGradient
                      colors={['#3b82f6', '#06b6d4']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        paddingHorizontal: 24,
                        paddingVertical: 12,
                        minHeight: 44,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#ffffff' }}>Done</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ gap: 24 }}>
                  <View style={{ alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#ffffff', textAlign: 'center' }}>
                      Join "{teamName}"
                    </Text>
                    <Text style={{ fontSize: 14, color: '#9ca3af', marginTop: 8, textAlign: 'center' }}>
                      This team is private. Enter the access code to join.
                    </Text>
                  </View>

                  <View style={{ gap: 8 }}>
                    <Text className="text-gray-300 font-medium text-lg">Access code</Text>
                    <TextInput
                      value={accessCode}
                      onChangeText={setAccessCode}
                      placeholder="Access code"
                      placeholderTextColor="#6b7280"
                      style={{
                        width: '100%',
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: 8,
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        color: '#ffffff',
                        fontSize: 16,
                        minHeight: 44,
                      }}
                      autoFocus
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  {(error || requestError) && (
                    <View className="p-3 rounded-lg bg-red-500/20 border border-red-500/30">
                      <Text className="text-red-400 text-sm">{error || requestError}</Text>
                    </View>
                  )}

                  <View className="flex-row justify-end gap-4 pt-4">
                    <TouchableOpacity
                      onPress={() => router.back()}
                      className="px-5 py-2.5 rounded-lg bg-white/10"
                      activeOpacity={0.7}
                    >
                      <Text className="text-gray-300 text-base">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleJoinWithCode}
                      disabled={!accessCode.trim() || joining}
                      activeOpacity={0.8}
                      style={{ overflow: 'hidden', borderRadius: 8, opacity: !accessCode.trim() || joining ? 0.5 : 1 }}
                    >
                      <LinearGradient
                        colors={['#3b82f6', '#06b6d4']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          paddingHorizontal: 20,
                          paddingVertical: 12,
                          minHeight: 44,
                          borderRadius: 8,
                        }}
                      >
                        {joining ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>Join</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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
    backgroundColor: BACKGROUND_COLOR,
  },
});
