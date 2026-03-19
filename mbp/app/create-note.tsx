import React, { useState, useRef, useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Platform, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { createNote, listMatchHistory, MatchHistoryItem } from '../src/api/matches';
import { hapticLight } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { ContextMenu } from '../src/components/ContextMenu';

const BACKGROUND_COLOR = '#020617';

type NoteType = 'pre-match' | 'post-match' | 'training';

const formatLabel = (val: string, labels?: Record<string, string>) => {
  if (labels && labels[val]) return labels[val];
  const defaultLabels: Record<string, string> = {
    'pre-match': 'Pre-Match',
    'post-match': 'Post-Match',
    'training': 'Training',
  };
  return defaultLabels[val] || val;
};

const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: MatchHistoryItem[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}) => {
  const selectedOption = options.find(opt => opt.id === value);

  const contextMenuOptions = [
    { label: 'None', value: '', onPress: () => onChange('') },
    ...options.map(opt => ({
      label: `${new Date(opt.date).toLocaleDateString()} vs ${opt.opponentNames}`,
      value: opt.id,
      onPress: () => onChange(opt.id),
    })),
  ];

  return (
    <ContextMenu
      options={contextMenuOptions}
      trigger={
        <TouchableOpacity
          className="w-full flex-row items-center justify-between bg-white/10 border border-white/30 rounded-md px-3 py-2"
          activeOpacity={0.7}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.3)',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            minHeight: 44,
          }}
        >
          <Text className={selectedOption ? 'text-white' : 'text-gray-400'} numberOfLines={1} style={{ color: selectedOption ? '#ffffff' : '#9ca3af', fontSize: 16 }}>
            {selectedOption
              ? `${new Date(selectedOption.date).toLocaleDateString()} vs ${selectedOption.opponentNames}`
              : placeholder}
          </Text>
          <Feather name="chevron-down" size={20} color="#9ca3af" />
        </TouchableOpacity>
      }
    />
  );
};

export default function CreateNoteScreen() {
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('pre-match');
  const [matchId, setMatchId] = useState('');
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

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
    const loadMatchHistory = async () => {
      try {
        const history = await listMatchHistory();
        setMatchHistory(history);
      } catch (error) {
        console.error('Failed to load match history:', error);
      }
    };
    loadMatchHistory();
  }, []);

  const canSubmit = content.trim() !== '';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setCreating(true);
    hapticLight();
    try {
      const linkedMatchId = noteType === 'training' || !matchId || matchId.trim() === '' ? undefined : matchId.trim();
      await createNote(noteType, content.trim(), linkedMatchId);
      router.back();
    } catch (error) {
      console.error('Failed to create note:', error);
    } finally {
      setCreating(false);
    }
  };

  const showMatchSelector = noteType === 'pre-match' || noteType === 'post-match';

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Create Note
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
                  <Text className="text-gray-300 font-medium text-lg mb-2">Note Type</Text>
                  <ContextMenu
                    options={createContextMenuOptions(['pre-match', 'post-match', 'training'], noteType, setNoteType, { 'pre-match': 'Pre-Match', 'post-match': 'Post-Match', 'training': 'Training' })}
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
                          {formatLabel(noteType, { 'pre-match': 'Pre-Match', 'post-match': 'Post-Match', 'training': 'Training' })}
                        </Text>
                        <Feather name="chevron-down" size={20} color="#9ca3af" />
                      </TouchableOpacity>
                    }
                  />
                </View>

                <View>
                  <Text className="text-gray-300 font-medium text-lg mb-2">Content</Text>
                  <TextInput
                    value={content}
                    onChangeText={setContent}
                    placeholder="What's on your mind?"
                    placeholderTextColor="#6b7280"
                    multiline
                    numberOfLines={5}
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
                      minHeight: 120,
                      textAlignVertical: 'top',
                    }}
                  />
                </View>

                {showMatchSelector && (
                  <View>
                    <Text className="text-gray-300 font-medium text-lg mb-2">Link to Match (optional)</Text>
                    <SearchableSelect
                      options={matchHistory}
                      value={matchId}
                      onChange={setMatchId}
                      placeholder="Select a match..."
                    />
                  </View>
                )}

                <View className="flex-row justify-end gap-4 pt-4">
                  <TouchableOpacity
                    onPress={() => {
                      hapticLight();
                      router.back();
                    }}
                    className="px-5 py-2.5 rounded-lg"
                    activeOpacity={0.7}
                  >
                    <Text className="text-gray-400 text-base">Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={creating || !canSubmit}
                    activeOpacity={0.8}
                    style={{ 
                      overflow: 'hidden', 
                      borderRadius: 8,
                      opacity: creating || !canSubmit ? 0.5 : 1,
                    }}
                  >
                    <LinearGradient
                      colors={['#1e40af', '#1e3a8a']}
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
                      {creating ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Feather name="save" size={20} color="#ffffff" />
                      )}
                      <Text className="text-white font-medium text-base">
                        {creating ? 'Creating...' : 'Create Note'}
                      </Text>
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
