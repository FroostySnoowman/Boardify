import React, { useState, useEffect, useMemo } from 'react';
import { Stack, router } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { listMatchHistory, listNotes, MatchHistoryItem, Note } from '../src/api/matches';
import { useAuth } from '../src/contexts/AuthContext';
import { hapticLight } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

const BACKGROUND_COLOR = '#020617';

export default function SearchAllScreen() {
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    loadData();
  }, [authLoading]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [matchesData, notesData] = await Promise.all([
        listMatchHistory(),
        listNotes(),
      ]);
      setMatches(matchesData);
      setNotes(notesData);
    } catch (err: any) {
      console.error('Failed to load search data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMatches = useMemo(() => {
    const searchText = searchTerm.toLowerCase();
    return matches.filter(match => (
      match.opponentNames.toLowerCase().includes(searchText) ||
      new Date(match.date).toLocaleDateString().includes(searchText) ||
      match.score.toLowerCase().includes(searchText) ||
      (match.result && match.result.toLowerCase().includes(searchText))
    ));
  }, [matches, searchTerm]);

  const filteredNotes = useMemo(() => {
    const searchText = searchTerm.toLowerCase();
    return notes.filter(note => {
      const match = note.matchId ? matches.find(m => m.id === note.matchId) : null;
      return (
        note.content.toLowerCase().includes(searchText) ||
        (match ? match.opponentNames.toLowerCase().includes(searchText) : false) ||
        note.type.replace('-', ' ').toLowerCase().includes(searchText)
      );
    });
  }, [notes, matches, searchTerm]);

  const openMatch = (matchId: string) => {
    hapticLight();
    router.back();
    setTimeout(() => {
      router.push({
        pathname: '/match-detail',
        params: { matchId },
      });
    }, 300);
  };

  const openNote = (note: Note) => {
    hapticLight();
    router.back();
    setTimeout(() => {
      router.push(`/edit-note?noteId=${note.id}`);
    }, 300);
  };

  const hasResults = filteredMatches.length > 0 || filteredNotes.length > 0;
  const hasSearchTerm = searchTerm.trim().length > 0;

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Search
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
                placeholder="Search matches, notes & statistics..."
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
            ) : !hasResults && !hasSearchTerm ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={{ color: '#9ca3af' }}>No matches or notes found.</Text>
              </View>
            ) : !hasResults ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={{ color: '#9ca3af' }}>No matches or notes found matching your search.</Text>
              </View>
            ) : (
              <View style={{ gap: 24 }}>
                <View style={{ gap: 12 }}>
                  <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Matches</Text>
                  {filteredMatches.length === 0 ? (
                    <Text style={{ color: '#9ca3af', fontSize: 14 }}>No matches found.</Text>
                  ) : (
                    filteredMatches.map(match => {
                      const barColor =
                        match.result === 'Won'
                          ? '#22c55e'
                          : match.result === 'Lost'
                          ? '#3b82f6'
                          : '#22c55e';

                      return (
                        <TouchableOpacity
                          key={match.id}
                          onPress={() => openMatch(match.id)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 16,
                            borderRadius: 12,
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            borderWidth: 1,
                            borderColor: 'rgba(255, 255, 255, 0.1)',
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={{ width: 4, height: 40, borderRadius: 2, backgroundColor: barColor, marginRight: 12 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
                              vs {match.opponentNames}
                            </Text>
                            <Text style={{ color: '#9ca3af', fontSize: 14 }}>{match.score}</Text>
                          </View>
                          <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                            {new Date(match.date).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>

                <View style={{ gap: 12 }}>
                  <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Notes</Text>
                  {filteredNotes.length === 0 ? (
                    <Text style={{ color: '#9ca3af', fontSize: 14 }}>No notes found.</Text>
                  ) : (
                    filteredNotes.map(note => {
                      const match = note.matchId ? matches.find(m => m.id === note.matchId) : null;
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
                    })
                  )}
                </View>
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
