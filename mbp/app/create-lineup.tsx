import React, { useState, useEffect } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { createLineup, updateLineup, listLadders, Ladder } from '../src/api/teams';
import { hapticLight } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

const BACKGROUND_COLOR = '#020617';

export default function CreateLineupScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const teamId = params.teamId as string;
  const lineupId = params.lineupId as string | undefined;
  const initialName = params.name as string | undefined;
  const initialDescription = params.description as string | undefined;

  const isEditing = !!lineupId;

  const [name, setName] = useState(initialName || '');
  const [description, setDescription] = useState(initialDescription || '');
  const [sourceLadderId, setSourceLadderId] = useState<string | null>(null);
  const [ladders, setLadders] = useState<Ladder[]>([]);
  const [laddersLoading, setLaddersLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadLadders = async () => {
      if (!teamId) return;
      setLaddersLoading(true);
      try {
        const result = await listLadders(teamId);
        setLadders(result);
      } catch (e) {
        console.error('Failed to load ladders:', e);
      } finally {
        setLaddersLoading(false);
      }
    };
    loadLadders();
  }, [teamId]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Lineup name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (isEditing) {
        await updateLineup(teamId, lineupId!, {
          name: name.trim(),
          description: description.trim() || undefined,
        });
      } else {
        await createLineup(
          teamId,
          name.trim(),
          description.trim() || undefined,
          undefined,
          sourceLadderId || undefined
        );
      }
      hapticLight();
      router.back();
    } catch (e: any) {
      setError(e.message || 'Failed to save lineup');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            {isEditing ? 'Edit Lineup' : 'New Lineup'}
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
                  <Text className="text-gray-300 font-medium text-lg mb-2">Lineup Name *</Text>
                  <TextInput
                    placeholder="e.g., State Tournament 2026"
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

                {!isEditing && (
                  <View>
                    <Text className="text-gray-300 font-medium text-lg mb-2">Copy from Ladder</Text>
                    <Text className="text-gray-500 text-sm mb-3">
                      Optionally copy players from an existing ladder to start this lineup.
                    </Text>
                    
                    {laddersLoading ? (
                      <View className="py-4 items-center">
                        <ActivityIndicator color="#9ca3af" size="small" />
                        <Text className="text-gray-500 text-sm mt-2">Loading ladders...</Text>
                      </View>
                    ) : (
                      <View className="gap-2">
                        <TouchableOpacity
                          onPress={() => {
                            hapticLight();
                            setSourceLadderId(null);
                          }}
                          style={{
                            padding: 14,
                            borderRadius: 10,
                            backgroundColor: sourceLadderId === null ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            borderWidth: 1.5,
                            borderColor: sourceLadderId === null ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.1)',
                          }}
                          activeOpacity={0.7}
                        >
                          <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-3">
                              <View style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                backgroundColor: sourceLadderId === null ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                <Feather 
                                  name="plus" 
                                  size={18} 
                                  color={sourceLadderId === null ? '#60a5fa' : '#9ca3af'} 
                                />
                              </View>
                              <View>
                                <Text style={{ 
                                  color: sourceLadderId === null ? '#60a5fa' : '#ffffff', 
                                  fontWeight: '500',
                                  fontSize: 15,
                                }}>
                                  Start with empty lineup
                                </Text>
                                <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
                                  Add players manually
                                </Text>
                              </View>
                            </View>
                            {sourceLadderId === null && (
                              <View style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                backgroundColor: '#3b82f6',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}>
                                <Feather name="check" size={14} color="#ffffff" />
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>

                        {ladders.map(ladder => (
                          <TouchableOpacity
                            key={ladder.id}
                            onPress={() => {
                              hapticLight();
                              setSourceLadderId(ladder.id);
                            }}
                            style={{
                              padding: 14,
                              borderRadius: 10,
                              backgroundColor: sourceLadderId === ladder.id ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                              borderWidth: 1.5,
                              borderColor: sourceLadderId === ladder.id ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.1)',
                            }}
                            activeOpacity={0.7}
                          >
                            <View className="flex-row items-center justify-between">
                              <View className="flex-row items-center gap-3">
                                <View style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 18,
                                  backgroundColor: sourceLadderId === ladder.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  <Feather 
                                    name="trending-up" 
                                    size={18} 
                                    color={sourceLadderId === ladder.id ? '#60a5fa' : '#9ca3af'} 
                                  />
                                </View>
                                <View>
                                  <Text style={{ 
                                    color: sourceLadderId === ladder.id ? '#60a5fa' : '#ffffff', 
                                    fontWeight: '500',
                                    fontSize: 15,
                                  }}>
                                    {ladder.name}
                                  </Text>
                                  <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>
                                    {ladder.entryCount} player{ladder.entryCount !== 1 ? 's' : ''}
                                  </Text>
                                </View>
                              </View>
                              {sourceLadderId === ladder.id && (
                                <View style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 11,
                                  backgroundColor: '#3b82f6',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}>
                                  <Feather name="check" size={14} color="#ffffff" />
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        ))}

                        {ladders.length === 0 && (
                          <View className="py-4 px-3 rounded-lg bg-white/[0.02] border border-white/5">
                            <Text className="text-gray-500 text-sm text-center">
                              No ladders available. Create a ladder first to copy players from it.
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}

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
                            {isEditing ? 'Save Changes' : 'Create Lineup'}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
});
