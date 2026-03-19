import React, { useState, useEffect } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Match, getMatch, getStats } from '../../src/api/matches';
import { getPlayerDisplayName } from '../../src/screens/match/utils/matchUtils';

const BACKGROUND_COLOR = '#020617';

export default function MatchInfoScreen() {
  const insets = useSafeAreaInsets();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayDuration, setDisplayDuration] = useState('0:00');
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!matchId) return;
    setLoading(true);
    setError(null);
    getMatch(matchId)
      .then((m) => {
        setMatch(m);
        getStats(m.id).then(setStats).catch(() => {});
      })
      .catch((e) => setError(e?.message || 'Failed to load match'))
      .finally(() => setLoading(false));
  }, [matchId]);

  useEffect(() => {
    if (!match) return;
    const startTime = new Date(match.createdAt).getTime();
    const updateDuration = () => {
      const now = Date.now();
      const diff = Math.floor((now - startTime) / 1000);
      const minutes = Math.floor(diff / 60);
      const seconds = diff % 60;
      setDisplayDuration(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };
    updateDuration();
    const interval = setInterval(updateDuration, 1000);
    return () => clearInterval(interval);
  }, [match]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: BACKGROUND_COLOR }]}>
        <Stack.Screen>
          <Stack.Header
            style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
           />
            <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
              Match Information
            </Stack.Screen.Title>
            <Stack.Toolbar placement="left">
              <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} tintColor="#ffffff" />
            </Stack.Toolbar>
        </Stack.Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#60a5fa" />
        </View>
      </View>
    );
  }

  if (error || !match) {
    return (
      <View style={[styles.container, { backgroundColor: BACKGROUND_COLOR }]}>
        <Stack.Screen>
          <Stack.Header
            style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
           />
            <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
              Match Information
            </Stack.Screen.Title>
            <Stack.Toolbar placement="left">
              <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} tintColor="#ffffff" />
            </Stack.Toolbar>
        </Stack.Screen>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Match not found'}</Text>
        </View>
      </View>
    );
  }

  const yourTeamIds = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
  const oppTeamIds = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p);
  const isDoubles = yourTeamIds.length > 1;
  const yourTeamNames = yourTeamIds.map((name) => getPlayerDisplayName(name, isDoubles));
  const oppTeamNames = oppTeamIds.map((name) => getPlayerDisplayName(name, isDoubles));

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: BACKGROUND_COLOR } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Match Information
          </Stack.Screen.Title>
          <Stack.Toolbar placement="left">
            <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()} tintColor="#ffffff" />
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
        style={styles.scrollView}
      >
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Players</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Your Team</Text>
              <Text style={styles.value}>{yourTeamNames.join(' / ')}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Opponent</Text>
              <Text style={styles.value}>{oppTeamNames.join(' / ')}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Match Details</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Type</Text>
              <Text style={styles.value}>
                {match.matchType.charAt(0).toUpperCase() + match.matchType.slice(1)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Format</Text>
              <Text style={styles.value}>
                {match.format === 'pro' ? 'Pro' : match.format === 'normal' ? 'Standard' : 'Short'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Best of</Text>
              <Text style={styles.value}>
                {match.bestOf} {match.bestOf === '1' ? 'Set' : 'Sets'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Games to</Text>
              <Text style={styles.value}>{match.gamesTo}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Tiebreak</Text>
              <Text style={styles.value}>
                {match.tiebreak === 'None'
                  ? 'None'
                  : match.tiebreak === '7-point'
                    ? '7-Point'
                    : '10-Point'}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Scoring</Text>
              <Text style={styles.value}>
                {match.scoringType === 'ad' ? 'Advantage' : 'No-Ad'}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Duration</Text>
              <Text style={styles.value}>{displayDuration}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.value}>
                {match.status === 'active' ? 'Active' : 'Completed'}
              </Text>
            </View>
            {stats && (
              <View style={styles.row}>
                <Text style={styles.label}>Total Points</Text>
                <Text style={styles.value}>{stats.totalPoints ?? 0}</Text>
              </View>
            )}
          </View>

          {match.courtStyle && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Court</Text>
              <View style={styles.row}>
                <Text style={styles.label}>Surface</Text>
                <Text style={styles.value}>
                  {match.courtStyle === 'hard_1' || match.courtStyle === 'hard_2'
                    ? 'Hard Court'
                    : match.courtStyle === 'clay_court'
                      ? 'Clay Court'
                      : 'Grass Court'}
                </Text>
              </View>
            </View>
          )}
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
  scrollView: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#f87171',
    fontSize: 16,
  },
  content: {
    maxWidth: 768,
    alignSelf: 'center',
    width: '100%',
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  label: {
    fontSize: 14,
    color: '#9ca3af',
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
  },
});
