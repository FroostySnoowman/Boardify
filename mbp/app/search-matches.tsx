import React, { useState, useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { listPublicMatches, PublicMatch } from '../src/api/matches';
import { useAuth } from '../src/contexts/AuthContext';
import { hapticLight } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

const BACKGROUND_COLOR = '#020617';

function matchLabel(match: PublicMatch): string {
  const your = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p).join(' / ');
  const opp = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p).join(' / ');
  return `${your} vs ${opp}`;
}

export default function SearchMatchesScreen() {
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [matches, setMatches] = useState<PublicMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    loadMatches();
  }, [authLoading]);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const data = await listPublicMatches();
      setMatches(data);
    } catch (err: any) {
      console.error('Failed to load matches:', err);
    } finally {
      setLoading(false);
    }
  };

  const openMatch = (match: PublicMatch) => {
    hapticLight();
    router.back();

    setTimeout(() => {
      router.push({
        pathname: '/spectate-scorecard-detail',
        params: { matchId: match.id },
      });
    }, 300);
  };

  const filteredMatches = matches
    .filter(m => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const label = matchLabel(m).toLowerCase();
      const creator = (m.creatorUsername || '').toLowerCase();
      return label.includes(term) || creator.includes(term);
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Search Matches
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
        colors={['rgba(139, 92, 246, 0.18)', 'rgba(34, 197, 94, 0.14)', 'rgba(2, 6, 23, 0.95)']}
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
            <View style={{ padding: 24, borderRadius: 16, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)', gap: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="radio" size={24} color="#8b5cf6" style={{ marginRight: 12 }} />
                <Text style={{ fontSize: 24, fontWeight: '700', color: '#ffffff' }}>Search Matches</Text>
              </View>

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
                  placeholder="Search matches..."
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
                  <Text style={{ color: '#9ca3af', fontSize: 16 }}>Loading matches...</Text>
                </View>
              ) : filteredMatches.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <View style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16
                  }}>
                    <Feather name="radio" size={32} color="#6b7280" />
                  </View>
                  <Text style={{ color: '#9ca3af', fontSize: 16, textAlign: 'center' }}>
                    {searchTerm.trim() ? 'No matches found matching your search.' : 'No public matches found.'}
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {filteredMatches.map((match) => {
                    const label = matchLabel(match);
                    const isLive = match.status === 'active';

                    return (
                      <TouchableOpacity
                        key={match.id}
                        onPress={() => openMatch(match)}
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: 12,
                          padding: 16,
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.1)',
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                          <View style={{
                            width: 4,
                            borderRadius: 2,
                            backgroundColor: isLive ? '#22c55e' : '#6b7280',
                            flexShrink: 0,
                            height: '100%',
                            minHeight: 40,
                          }} />
                          <View style={{ flex: 1, gap: 4 }}>
                            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }} numberOfLines={2}>
                              {label}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                              <Feather name="user" size={14} color="#9ca3af" />
                              <Text style={{ color: '#9ca3af', fontSize: 14 }}>
                                {match.creatorUsername || 'Unknown'}
                              </Text>
                              <View style={{
                                backgroundColor: isLive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 6,
                              }}>
                                <Text style={{
                                  color: isLive ? '#22c55e' : '#9ca3af',
                                  fontSize: 12,
                                  fontWeight: '500',
                                  textTransform: 'capitalize'
                                }}>
                                  {match.status}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </View>
        <KeyboardSpacer extraOffset={20} />
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
