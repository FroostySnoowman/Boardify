import React, { useState, useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { listMatchHistory, MatchHistoryItem } from '../src/api/matches';
import { useAuth } from '../src/contexts/AuthContext';
import { hapticLight } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

const BACKGROUND_COLOR = '#020617';

export default function SearchStatisticsScreen() {
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    loadMatches();
  }, [authLoading]);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const matchesData = await listMatchHistory();
      setMatches(matchesData);
    } catch (err: any) {
      console.error('Failed to load match history:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMatches = matches.filter(match => {
    const searchText = searchTerm.toLowerCase();
    return (
      match.opponentNames.toLowerCase().includes(searchText) ||
      new Date(match.date).toLocaleDateString().includes(searchText) ||
      match.score.toLowerCase().includes(searchText) ||
      match.result.toLowerCase().includes(searchText)
    );
  });

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

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Search Statistics
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
                placeholder="Search by opponent, date, score, or result..."
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
            ) : filteredMatches.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                <Text style={{ color: '#9ca3af' }}>
                  {searchTerm ? 'No matches found matching your search.' : 'No matches found.'}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {filteredMatches.map(match => {
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
                        <Text style={{ color: '#9ca3af', fontSize: 14, marginBottom: 2 }}>{match.score}</Text>
                        <Text style={{ color: barColor, fontSize: 12, fontWeight: '500' }}>
                          {match.result}
                        </Text>
                      </View>
                      <Text style={{ color: '#9ca3af', fontSize: 12 }}>
                        {new Date(match.date).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
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
