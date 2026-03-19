import React, { useState, useEffect, useRef } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { listPublicMatches, getStats, PublicMatch, Stats } from '../src/api/matches';
import { hapticLight } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import AllStatsDisplay from '../src/screens/match/components/AllStatsDisplay';

type LiveMatch = PublicMatch & { stats: Stats };

const BACKGROUND_COLOR = '#020617';

// Tennis ball icon component
const TennisBallIcon = () => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(-180)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 150,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(rotateAnim, {
        toValue: 0,
        tension: 150,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        marginLeft: 8,
        transform: [
          { scale: scaleAnim },
          {
            rotate: rotateAnim.interpolate({
              inputRange: [-180, 0],
              outputRange: ['-180deg', '0deg'],
            }),
          },
        ],
      }}
    >
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: '#60a5fa',
          borderWidth: 1,
          borderColor: '#3b82f6',
        }}
      />
    </Animated.View>
  );
};

export default function SpectateScorecardDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ matchId: string }>();
  const matchId = params.matchId;

  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [elapsed, setElapsed] = useState('0:00');

  useEffect(() => {
    if (!matchId) {
      router.back();
      return;
    }

    const loadMatch = async () => {
      setLoading(true);
      try {
        const [matches, stats] = await Promise.all([listPublicMatches(), getStats(matchId)]);
        const foundMatch = matches.find(m => m.id === matchId);
        if (foundMatch) {
          setMatch({ ...foundMatch, stats });
        } else {
          router.back();
        }
      } catch (error) {
        console.error('Failed to load match', error);
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadMatch();
  }, [matchId]);

  useEffect(() => {
    if (!match || match.stats.matchWinner) return;
    const update = () => {
      const diff = Date.now() - new Date(match.createdAt).getTime();
      const total = Math.max(0, Math.floor(diff / 1000));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      setElapsed(
        h > 0
          ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
          : `${m}:${s.toString().padStart(2, '0')}`
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [match]);

  if (loading || !match) {
    return (
      <View style={styles.container}>
        <Stack.Screen>
          <Stack.Header
            style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
           />
            <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
              Live Match Stats
            </Stack.Screen.Title>
            <Stack.Toolbar placement="left">
              <Stack.Toolbar.Button 
                icon="xmark" 
                onPress={() => router.back()}
                tintColor="#ffffff"
              />
            </Stack.Toolbar>
        </Stack.Screen>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
      </View>
    );
  }

  const { stats } = match;
  const yourTeamIds = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
  const oppTeamIds = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p);

  const serverName = stats.matchWinner ? undefined : stats.server;
  const serverIsOnYourTeam = !!(serverName && yourTeamIds.includes(serverName));
  const serverIsOnOppTeam = !!(serverName && oppTeamIds.includes(serverName));

  const yourSets = stats.sets.map((set: any) => ({
    player: yourTeamIds.reduce((sum, id) => sum + (set.games[id] || 0), 0),
    opponent: oppTeamIds.reduce((sum, id) => sum + (set.games[id] || 0), 0)
  }));
  if (!stats.matchWinner) {
    yourSets.push({
      player: yourTeamIds.reduce((sum, id) => sum + (stats.currentSet.games[id] || 0), 0),
      opponent: oppTeamIds.reduce((sum, id) => sum + (stats.currentSet.games[id] || 0), 0)
    });
  }

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Live Match Stats
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
                <View className="flex-row items-center">
                  <Feather name="activity" size={24} color="#60a5fa" style={{ marginRight: 12 }} />
                  <Text className="text-2xl font-bold text-white">Live Match Stats</Text>
                </View>

                <View>
                  <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center gap-2">
                      <View style={{ position: 'relative', width: 10, height: 10 }}>
                        <View style={{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#f87171', opacity: 0.75 }} />
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' }} />
                      </View>
                      <Text className="text-xs font-semibold text-blue-400 uppercase">Live Match</Text>
                    </View>
                    <Text className="text-sm text-gray-400 font-medium">{elapsed}</Text>
                  </View>

                  <View className="flex-row items-center py-3 border-b border-white/10">
                    <View className="flex-row items-center w-2/5">
                      <Text className={`text-xl font-semibold ${serverIsOnYourTeam ? 'text-blue-400' : 'text-white'}`} numberOfLines={1}>
                        {yourTeamIds.join(' / ')}
                      </Text>
                      {serverIsOnYourTeam && <TennisBallIcon />}
                    </View>
                    <View className="flex-1 flex-row justify-center gap-2">
                      {yourSets.map((set: any, i: number) => (
                        <Text key={i} className="text-xl font-light text-white text-center" style={{ minWidth: 24 }}>
                          {set.player}
                        </Text>
                      ))}
                    </View>
                    <View className="ml-4 px-4 py-2 bg-white/10 border border-white/20 rounded-lg">
                      <Text className="text-xl font-bold text-white">
                        {serverIsOnYourTeam ? stats.currentGame.serverDisplay : stats.currentGame.receiverDisplay}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center py-3">
                    <View className="flex-row items-center w-2/5">
                      <Text className={`text-xl ${serverIsOnOppTeam ? 'text-blue-400 font-semibold' : 'text-white'}`} numberOfLines={1}>
                        {oppTeamIds.join(' / ')}
                      </Text>
                      {serverIsOnOppTeam && <TennisBallIcon />}
                    </View>
                    <View className="flex-1 flex-row justify-center gap-2">
                      {yourSets.map((set: any, i: number) => (
                        <Text key={i} className="text-xl font-light text-white text-center" style={{ minWidth: 24 }}>
                          {set.opponent}
                        </Text>
                      ))}
                    </View>
                    <View className="ml-4 px-4 py-2 bg-white/10 border border-white/20 rounded-lg">
                      <Text className="text-xl font-bold text-white">
                        {!serverIsOnYourTeam ? stats.currentGame.serverDisplay : stats.currentGame.receiverDisplay}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    setShowStats(s => !s);
                  }}
                  className={`px-4 py-3 rounded-lg border ${showStats ? 'bg-white border-white/10' : 'bg-white/5 border-white/10'}`}
                  activeOpacity={0.7}
                >
                  <Text className={`text-base font-medium ${showStats ? 'text-black' : 'text-white'}`}>
                    {showStats ? 'Hide Live Stats' : 'Show Live Stats'}
                  </Text>
                </TouchableOpacity>

                {showStats && (
                  <View className="mt-4">
                    <AllStatsDisplay stats={stats} match={match} />
                  </View>
                )}
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
