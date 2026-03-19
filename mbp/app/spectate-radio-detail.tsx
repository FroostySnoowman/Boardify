import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { listPublicMatches, getStats, PublicMatch, Stats } from '../src/api/matches';

type LiveMatch = PublicMatch & { stats: Stats };
import { hapticLight } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import AllStatsDisplay from '../src/screens/match/components/AllStatsDisplay';
import { ENV } from '../src/config/env';
import { getStoredSessionToken } from '../src/api/auth';
import { useRadioPlayback } from '../src/contexts/RadioPlaybackContext';

const BACKGROUND_COLOR = '#020617';

interface LogEntry {
  id: number;
  text: string;
  time: Date;
}

const RadioPlayer = ({ matchId, onCommentary, onDebug }: { matchId: string; onCommentary?: (text: string) => void; onDebug?: (line: string) => void }) => {
  const { state, start, pause, resume, jumpToLive } = useRadioPlayback();
  const lastCommentaryVersionRef = useRef(0);
  const lastDebugCountRef = useRef(0);

  const isCurrentMatch = state.currentMatchId === matchId;
  const enabled = isCurrentMatch && state.enabled;
  const connected = enabled && state.connected;
  const isPlaying = enabled && state.isPlaying;
  const paused = enabled && state.paused;
  const hasPendingLive = enabled && state.hasPendingLive;
  const lastCommentary = enabled ? state.lastCommentary : null;

  useEffect(() => {
    if (!isCurrentMatch || !onCommentary) return;
    if (state.commentaryVersion !== lastCommentaryVersionRef.current && state.lastCommentary) {
      lastCommentaryVersionRef.current = state.commentaryVersion;
      onCommentary(state.lastCommentary);
    }
  }, [isCurrentMatch, state.commentaryVersion, state.lastCommentary, onCommentary]);

  useEffect(() => {
    if (!isCurrentMatch || !onDebug) return;
    const currentLength = state.debugLines.length;
    if (currentLength < lastDebugCountRef.current) {
      lastDebugCountRef.current = 0;
    }
    for (let i = lastDebugCountRef.current; i < currentLength; i++) {
      onDebug(state.debugLines[i]);
    }
    lastDebugCountRef.current = currentLength;
  }, [isCurrentMatch, state.debugLines, onDebug]);

  const handleToggle = () => {
    hapticLight();
    onDebug?.(
      `UI:toggle pressed match=${matchId} enabled=${enabled} connected=${connected} isPlaying=${isPlaying} paused=${paused} pendingLive=${hasPendingLive}`
    );
    if (!enabled) {
      start(matchId);
      return;
    }
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  const handleJumpToLive = () => {
    hapticLight();
    onDebug?.(
      `UI:jumpToLive pressed match=${matchId} enabled=${enabled} connected=${connected} isPlaying=${isPlaying} paused=${paused} pendingLive=${hasPendingLive}`
    );
    jumpToLive();
  };

  const showLiveBadge = paused && hasPendingLive;

  return (
    <View className="flex-row items-center gap-3 flex-1">
      <TouchableOpacity
        onPress={handleToggle}
        className={`w-10 h-10 rounded-full items-center justify-center ${enabled && connected ? 'bg-blue-500' : 'bg-white/15'}`}
        activeOpacity={0.7}
      >
        <Feather
          name={isPlaying ? 'pause' : 'play'}
          size={20}
          color="#ffffff"
        />
      </TouchableOpacity>
      <View className="flex-1">
        <Text className="text-white text-sm font-medium">
          {connected ? (isPlaying ? 'Live Radio' : (paused ? 'Paused' : 'Live Radio')) : (enabled ? 'Connecting...' : 'Radio')}
        </Text>
        <Text className="text-gray-400 text-xs" numberOfLines={2}>
          {!enabled
            ? 'Tap play to listen'
            : !connected
              ? 'Connecting...'
              : isPlaying && lastCommentary
                ? lastCommentary
                : paused
                  ? 'Tap play to resume'
                  : 'Waiting for commentary...'}
        </Text>
      </View>
      {showLiveBadge && (
        <TouchableOpacity
          onPress={handleJumpToLive}
          className="flex-row items-center gap-1 px-3 py-1.5 rounded-full bg-red-500/90"
          activeOpacity={0.7}
        >
          <View className="w-1.5 h-1.5 rounded-full bg-white" />
          <Text className="text-white text-xs font-bold">LIVE</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default function SpectateRadioDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ matchId: string }>();
  const matchId = params.matchId;

  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const logIdRef = useRef(0);
  const logScrollRef = useRef<ScrollView>(null);
  const debugScrollRef = useRef<ScrollView>(null);

  const handleCommentary = useCallback((text: string) => {
    setLogEntries(prev => {
      const entry: LogEntry = { id: ++logIdRef.current, text, time: new Date() };
      const next = [...prev, entry];
      if (next.length > 200) return next.slice(-200);
      return next;
    });
    setTimeout(() => logScrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const handleDebug = useCallback((line: string) => {
    setDebugLines(prev => {
      const next = [...prev, line];
      if (next.length > 150) return next.slice(-150);
      return next;
    });
    setTimeout(() => debugScrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, []);

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
    if (!matchId || !match || loading) return;

    let ws: WebSocket | null = null;
    let closed = false;

    (async () => {
      try {
        const token = await getStoredSessionToken();
        if (!token || closed) return;

        let apiBase = ENV.API_BASE || '';
        if (Platform.OS === 'android' && apiBase.includes('localhost')) {
          apiBase = apiBase.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
        }
        const host = apiBase.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const proto = apiBase.startsWith('https:') ? 'wss' : 'ws';
        const url = `${proto}://${host}/ws/matches/${matchId}/spectate?token=${encodeURIComponent(token)}`;

        ws = new WebSocket(url);
        ws.onmessage = (ev) => {
          try {
            const newStats = JSON.parse(ev.data as string) as Stats;
            if (!newStats?.currentGame) return;
            setMatch(prev => {
              if (!prev) return null;
              const prevPoints = prev.stats?.matchTotals?.pointsPlayed || 0;
              const newPoints = newStats.matchTotals?.pointsPlayed || 0;
              if (newPoints > prevPoints || newStats.matchWinner) {
                return { ...prev, stats: newStats };
              }
              return prev;
            });
          } catch { }
        };
        ws.onerror = () => { };
        ws.onclose = () => { ws = null; };
      } catch { }
    })();

    return () => {
      closed = true;
      if (ws) { try { ws.close(); } catch { } }
    };
  }, [matchId, match, loading]);

  if (loading || !match) {
    return (
      <View style={styles.container}>
        <Stack.Screen>
          <Stack.Header
            style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
           />
            <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
              Live Radio
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

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Live Radio
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
                  <Feather name="radio" size={24} color="#60a5fa" style={{ marginRight: 12 }} />
                  <Text className="text-2xl font-bold text-white">Live Radio</Text>
                </View>

                <View style={{ height: 50, justifyContent: 'center' }}>
                  <RadioPlayer matchId={match.id} onCommentary={handleCommentary} onDebug={handleDebug} />
                </View>

                <TouchableOpacity
                  onPress={() => {
                    hapticLight();
                    setShowLog(s => !s);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Feather name="message-square" size={16} color="#94a3b8" />
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#cbd5e1' }}>Commentary Log</Text>
                    {logEntries.length > 0 && (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: 'rgba(59,130,246,0.2)' }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#60a5fa' }}>{logEntries.length}</Text>
                      </View>
                    )}
                  </View>
                  <Feather name={showLog ? 'chevron-up' : 'chevron-down'} size={16} color="#94a3b8" />
                </TouchableOpacity>

                {showLog && (
                  <View style={{ maxHeight: 280, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                    {logEntries.length === 0 ? (
                      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                        <Text style={{ fontSize: 14, color: '#64748b' }}>No commentary yet</Text>
                      </View>
                    ) : (
                      <ScrollView
                        ref={logScrollRef}
                        style={{ maxHeight: 280 }}
                        contentContainerStyle={{ padding: 16, gap: 12 }}
                        showsVerticalScrollIndicator
                        nestedScrollEnabled
                      >
                        {logEntries.map(entry => (
                          <View key={entry.id} style={{ flexDirection: 'row', gap: 12 }}>
                            <Text style={{ color: '#94a3b8', fontSize: 11, width: 52, fontVariant: ['tabular-nums'] }}>
                              {entry.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </Text>
                            <Text style={{ color: '#e2e8f0', fontSize: 12, flex: 1, lineHeight: 18 }}>{entry.text}</Text>
                          </View>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => setShowDebug(s => !s)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(234,179,8,0.08)', borderWidth: 1, borderColor: 'rgba(234,179,8,0.25)' }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Feather name="terminal" size={16} color="#eab308" />
                    <Text style={{ fontSize: 14, fontWeight: '500', color: '#eab308' }}>Audio Debug</Text>
                    {debugLines.length > 0 && (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: 'rgba(234,179,8,0.2)' }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#eab308' }}>{debugLines.length}</Text>
                      </View>
                    )}
                  </View>
                  <Feather name={showDebug ? 'chevron-up' : 'chevron-down'} size={16} color="#eab308" />
                </TouchableOpacity>

                {showDebug && (
                  <View style={{ maxHeight: 400, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderWidth: 1, borderColor: 'rgba(234,179,8,0.25)' }}>
                    {debugLines.length === 0 ? (
                      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                        <Text style={{ fontSize: 14, color: '#eab308' }}>No debug output yet -- enable radio to start</Text>
                      </View>
                    ) : (
                      <ScrollView
                        ref={debugScrollRef}
                        style={{ maxHeight: 400 }}
                        contentContainerStyle={{ padding: 12, gap: 2 }}
                        showsVerticalScrollIndicator
                        nestedScrollEnabled
                      >
                        {debugLines.map((line, i) => (
                          <Text key={i} style={{ color: line.includes('FAIL') || line.includes('ERROR') ? '#f87171' : line.includes('OK') ? '#4ade80' : '#fde68a', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 15 }}>
                            {line}
                          </Text>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}

                {match && match.stats && (
                  <View className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <View className="flex-row items-center gap-2 mb-3">
                      <View style={{ position: 'relative', width: 10, height: 10 }}>
                        <View style={{ position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#f87171', opacity: 0.75 }} />
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' }} />
                      </View>
                      <Text className="text-xs font-semibold text-blue-400 uppercase">Live Match</Text>
                    </View>

                    {(() => {
                      const yourTeamIds = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
                      const oppTeamIds = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p);
                      const serverName = match.stats.matchWinner ? undefined : match.stats.server;
                      const serverIsOnYourTeam = !!(serverName && yourTeamIds.includes(serverName));

                      const yourSets = match.stats.sets.map(set => ({
                        player: yourTeamIds.reduce((sum, id) => sum + (set.games[id] || 0), 0),
                        opponent: oppTeamIds.reduce((sum, id) => sum + (set.games[id] || 0), 0)
                      }));
                      if (!match.stats.matchWinner) {
                        yourSets.push({
                          player: yourTeamIds.reduce((sum, id) => sum + (match.stats.currentSet.games[id] || 0), 0),
                          opponent: oppTeamIds.reduce((sum, id) => sum + (match.stats.currentSet.games[id] || 0), 0)
                        });
                      }

                      return (
                        <>
                          <View className="flex-row items-center py-3 border-b border-white/10">
                            <View className="flex-row items-center w-2/5">
                              <Text className={`text-lg font-semibold ${serverIsOnYourTeam ? 'text-blue-400' : 'text-white'}`} numberOfLines={1}>
                                {yourTeamIds.join(' / ')}
                              </Text>
                              {serverIsOnYourTeam && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#60a5fa', marginLeft: 6 }} />}
                            </View>
                            <View className="flex-1 flex-row justify-center gap-2">
                              {yourSets.map((set: any, i: number) => (
                                <Text key={i} className="text-lg font-light text-white text-center" style={{ minWidth: 24 }}>
                                  {set.player}
                                </Text>
                              ))}
                            </View>
                            <View className="ml-4 px-4 py-2 bg-white/10 border border-white/20 rounded-lg">
                              <Text className="text-lg font-bold text-white">
                                {serverIsOnYourTeam ? match.stats.currentGame.serverDisplay : match.stats.currentGame.receiverDisplay}
                              </Text>
                            </View>
                          </View>

                          <View className="flex-row items-center py-3">
                            <View className="flex-row items-center w-2/5">
                              <Text className={`text-lg font-semibold ${!serverIsOnYourTeam ? 'text-blue-400' : 'text-white'}`} numberOfLines={1}>
                                {oppTeamIds.join(' / ')}
                              </Text>
                              {!serverIsOnYourTeam && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#60a5fa', marginLeft: 6 }} />}
                            </View>
                            <View className="flex-1 flex-row justify-center gap-2">
                              {yourSets.map((set: any, i: number) => (
                                <Text key={i} className="text-lg font-light text-white text-center" style={{ minWidth: 24 }}>
                                  {set.opponent}
                                </Text>
                              ))}
                            </View>
                            <View className="ml-4 px-4 py-2 bg-white/10 border border-white/20 rounded-lg">
                              <Text className="text-lg font-bold text-white">
                                {!serverIsOnYourTeam ? match.stats.currentGame.serverDisplay : match.stats.currentGame.receiverDisplay}
                              </Text>
                            </View>
                          </View>
                        </>
                      );
                    })()}
                  </View>
                )}

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
                    <AllStatsDisplay stats={match.stats} match={match} />
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
