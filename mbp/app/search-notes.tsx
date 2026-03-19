import React, { useState, useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { listNotes, Note } from '../src/api/matches';
import { listMatchHistory, MatchHistoryItem } from '../src/api/matches';
import { useAuth } from '../src/contexts/AuthContext';
import { hapticLight } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

const BACKGROUND_COLOR = '#020617';

export default function SearchNotesScreen() {
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    loadData();
  }, [authLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [notesData, historyData] = await Promise.all([
        listNotes(),
        listMatchHistory(),
      ]);
      setNotes(notesData);
      setMatchHistory(historyData);
    } catch (err: any) {
      console.error('Failed to load notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredNotes = notes.filter(note => {
    const match = note.matchId ? matchHistory.find(m => m.id === note.matchId) : null;
    const searchText = searchTerm.toLowerCase();

    return (
      note.content.toLowerCase().includes(searchText) ||
      (match ? match.opponentNames.toLowerCase().includes(searchText) : false) ||
      note.type.replace('-', ' ').toLowerCase().includes(searchText)
    );
  });

  const openNote = (note: Note) => {
    hapticLight();
    router.back();
    setTimeout(() => {
      router.push(`/edit-note?noteId=${note.id}`);
    }, 300);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Search Notes
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
                placeholder="Search notes..."
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
                <Text style={{ color: '#9ca3af' }}>Loading...</Text>
              </View>
            ) : filteredNotes.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={{ color: '#9ca3af' }}>
                  {searchTerm ? 'No notes found matching your search.' : 'No notes found.'}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {filteredNotes.map(note => {
                  const match = note.matchId ? matchHistory.find(m => m.id === note.matchId) : null;
                  return (
                    <TouchableOpacity
                      key={note.id}
                      onPress={() => openNote(note)}
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        borderWidth: 1,
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600', flex: 1 }}>
                          {note.type.replace('-', ' ').charAt(0).toUpperCase() + note.type.replace('-', ' ').slice(1)} Note
                        </Text>
                        <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                          {new Date(note.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      {match && (
                        <Text style={{ color: '#60a5fa', fontSize: 14, marginBottom: 8 }}>
                          vs {match.opponentNames}
                        </Text>
                      )}
                      <Text style={{ color: '#d1d5db', fontSize: 14 }} numberOfLines={3}>
                        {note.content}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
        <KeyboardSpacer extraOffset={24} />
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
