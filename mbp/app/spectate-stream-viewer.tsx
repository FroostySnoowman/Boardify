import React, { useState, useEffect, useRef } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Animated, Dimensions, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ScreenOrientation from 'expo-screen-orientation';
import { getStreamByMatch, Stream, isStreamActive } from '../src/api/streams';
import { listPublicMatches, getStats, PublicMatch, Stats } from '../src/api/matches';
import StreamPlayer from '../src/components/StreamPlayer';
import TennisScorecard from '../src/components/TennisScorecard';
import { hapticLight, hapticMedium } from '../src/utils/haptics';
import { getStoredSessionToken } from '../src/api/auth';
import { ENV } from '../src/config/env';

const BACKGROUND_COLOR = '#020617';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const LiveIndicator = () => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();
    glowAnimation.start();

    return () => {
      pulseAnimation.stop();
      glowAnimation.stop();
    };
  }, [pulseAnim, glowAnim]);

  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#ef4444',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 20,
          gap: 6,
          shadowColor: '#ef4444',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 20,
            backgroundColor: '#ef4444',
            opacity: glowAnim.interpolate({
              inputRange: [0.5, 1],
              outputRange: [0.2, 0.4],
            }),
            transform: [{ scale: pulseAnim }],
          }}
        />
        <Animated.View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: '#ffffff',
            transform: [{ scale: pulseAnim }],
          }}
        />
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff', letterSpacing: 0.5 }}>
          LIVE
        </Text>
      </View>
    </View>
  );
};

type LiveMatch = PublicMatch & { stats: Stats };

export default function SpectateStreamViewerScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ matchId: string }>();
  const matchId = params.matchId;

  const [match, setMatch] = useState<LiveMatch | null>(null);
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [viewerCount, setViewerCount] = useState(1);
  const [matchStartTime] = useState<Date>(new Date());

  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => { });
    };
  }, []);

  useEffect(() => {
    if (isTheaterMode) {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }

      if (showControls) {
        controlsTimeout.current = setTimeout(() => {
          Animated.timing(controlsOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setShowControls(false));
        }, 3000);
      }
    } else {
      Animated.timing(controlsOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, [isTheaterMode, showControls, controlsOpacity]);

  const toggleControls = () => {
    if (isTheaterMode) {
      if (showControls) {
        Animated.timing(controlsOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      } else {
        setShowControls(true);
        Animated.timing(controlsOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  const enterTheaterMode = async () => {
    hapticMedium();
    setIsTheaterMode(true);
    setShowControls(true);
    StatusBar.setHidden(true, 'fade');
    try {
      await ScreenOrientation.unlockAsync();
    } catch (e) {
      console.warn('Failed to unlock orientation:', e);
    }
  };

  const exitTheaterMode = async () => {
    hapticLight();
    setIsTheaterMode(false);
    setShowControls(true);
    StatusBar.setHidden(false, 'fade');
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch (e) {
      console.warn('Failed to unlock orientation:', e);
    }
  };

  useEffect(() => {
    if (!matchId) {
      router.back();
      return;
    }

    const loadStream = async () => {
      setLoading(true);
      setError(null);
      try {
        const [matches, stats, streamData] = await Promise.all([
          listPublicMatches(),
          getStats(matchId).catch(() => null),
          getStreamByMatch(matchId).catch(() => null),
        ]);

        const foundMatch = matches.find(m => m.id === matchId);
        if (!foundMatch) {
          setError('Match not found');
          return;
        }

        if (!stats) {
          setError('Match stats not available');
          return;
        }

        setMatch({ ...foundMatch, stats });

        if (streamData?.stream) {
          setStream(streamData.stream);
        } else {
          setError('No stream available for this match');
        }
      } catch (err: any) {
        console.error('Failed to load stream', err);
        setError(err.message || 'Failed to load stream');
      } finally {
        setLoading(false);
      }
    };

    loadStream();
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;

    const connectWebSocket = async () => {
      const token = await getStoredSessionToken();
      if (!token) return;

      try {
        const apiBase = ENV.API_BASE;
        if (Platform.OS !== 'web' && !apiBase) return;

        let base = apiBase || '';
        if (Platform.OS === 'android' && base.includes('localhost')) {
          base = base.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
        }

        const host = base.replace(/^https?:\/\//, '');
        const proto = base.startsWith('https:') ? 'wss' : 'ws';
        const wsUrl = `${proto}://${host}/ws/matches/${matchId}/spectate?token=${encodeURIComponent(token)}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'stream_status') {
              const eventType = typeof data.event === 'string' ? data.event : '';
              const nextState = data.stream?.status?.state;
              const isTerminalEvent =
                eventType === 'stream_ended' ||
                eventType === 'stream_deleted' ||
                eventType === 'stream_stopped' ||
                (typeof nextState === 'string' && !isStreamActive({ status: { state: nextState } } as Stream));

              if (isTerminalEvent) {
                setStream(null);
                setError('This live stream has ended.');
                return;
              }

              if (data.event === 'stream_created' && data.stream) {
                setError(null);
                setStream(prev => (prev ? { ...prev, ...data.stream } : data.stream));
              }

              if (typeof matchId === 'string' && matchId) {
                getStreamByMatch(matchId)
                  .then((res) => {
                    const refreshed = res?.stream ?? null;
                    if (!isStreamActive(refreshed)) {
                      setStream(null);
                      setError('This live stream has ended.');
                      return;
                    }
                    setError(null);
                    setStream(refreshed);
                  })
                  .catch(() => {});
              }
            }
            else if (data.currentGame !== undefined || data.currentSet !== undefined) {
              setMatch(prev => prev ? { ...prev, stats: data } : null);
            }
            if (data.viewerCount !== undefined) {
              setViewerCount(data.viewerCount);
            }
          } catch (e) {
            console.warn('📡 Failed to parse WebSocket message:', e);
          }
        };

        ws.onerror = (error) => {
          console.error('📡 WebSocket error:', error);
        };
      } catch (e) {
        console.warn('Failed to connect WebSocket:', e);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [matchId]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen
          options={{
            title: 'Live Stream',
            headerStyle: { backgroundColor: BACKGROUND_COLOR },
            headerTintColor: '#ffffff',
            headerShadowVisible: false,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#60a5fa" />
          <Text style={styles.loadingText}>Loading stream...</Text>
        </View>
      </View>
    );
  }

  if (error || !stream || !match) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen
          options={{
            title: 'Live Stream',
            headerStyle: { backgroundColor: BACKGROUND_COLOR },
            headerTintColor: '#ffffff',
            headerShadowVisible: false,
          }}
        />
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Stream Unavailable</Text>
          <Text style={styles.errorText}>{error || 'No stream found for this match'}</Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const yourTeamIds = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
  const oppTeamIds = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p);
  const yourTeamDisplay = yourTeamIds.join(' / ');
  const oppTeamDisplay = oppTeamIds.join(' / ');

  const hlsUrl = stream.playback?.hls;
  const webRTCPlaybackUrl = stream.liveInput?.webRTCPlaybackUrl;
  const isLive = stream.status?.state === 'connected' || stream.status?.state === 'live';
  const hasPlaybackUrl = !!hlsUrl || !!webRTCPlaybackUrl;

  const getCurrentScore = () => {
    if (!match.stats) return '';
    const scores = match.stats.sets.map((set, i) => {
      const yourGames = yourTeamIds.reduce((sum, id) => sum + (set.games[id] || 0), 0);
      const oppGames = oppTeamIds.reduce((sum, id) => sum + (set.games[id] || 0), 0);
      return `${yourGames}-${oppGames}`;
    });
    if (!match.stats.matchWinner) {
      const currentYourGames = yourTeamIds.reduce((sum, id) => sum + (match.stats.currentSet.games[id] || 0), 0);
      const currentOppGames = oppTeamIds.reduce((sum, id) => sum + (match.stats.currentSet.games[id] || 0), 0);
      scores.push(`${currentYourGames}-${currentOppGames}`);
    }
    return scores.join('  ');
  };

  return (
    <View style={isTheaterMode ? styles.theaterContainer : styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BACKGROUND_COLOR} />
      {isTheaterMode ? (
        <Stack.Screen options={{ headerShown: false }} />
      ) : (
        <Stack.Screen>
          <Stack.Header
            style={{ backgroundColor: BACKGROUND_COLOR }}
          />
            <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
              Live Stream
            </Stack.Screen.Title>
            <Stack.Toolbar placement="left">
              <Stack.Toolbar.Button
                icon="chevron.left"
                onPress={() => {
                  hapticLight();
                  router.back();
                }}
                tintColor="#ffffff"
              />
            </Stack.Toolbar>
        </Stack.Screen>
      )}

      <TouchableOpacity
        style={isTheaterMode ? styles.theaterVideoContainer : styles.inlineVideoContainer}
        activeOpacity={isTheaterMode ? 1 : 0.95}
        onPress={isTheaterMode ? toggleControls : enterTheaterMode}
      >
        <View style={isTheaterMode ? styles.theaterStreamFrame : styles.streamContainer}>
          {hasPlaybackUrl ? (
            <>
              <StreamPlayer
                hlsUrl={hlsUrl}
                webRTCPlaybackUrl={webRTCPlaybackUrl}
                isLive={isLive}
                onError={(err) => {
                  console.error('Stream playback error:', err);
                  setError('Stream playback error');
                }}
                showControls={!isTheaterMode}
                fillContainer={isTheaterMode}
              />
              {!isTheaterMode && (
                <View style={styles.fullscreenHint}>
                  <View style={styles.fullscreenHintBadge}>
                    <Feather name="maximize" size={14} color="#ffffff" />
                    <Text style={styles.fullscreenHintText}>Tap for fullscreen</Text>
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={styles.placeholderContainer}>
              <Feather name="video-off" size={48} color="#6b7280" />
              <Text style={styles.placeholderText}>Stream not available</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {isTheaterMode ? (
        <>
          {match.stats && (
            <TennisScorecard
              player1Names={yourTeamIds}
              player2Names={oppTeamIds}
              stats={match.stats}
              isLive={isLive}
              viewerCount={viewerCount}
              showViewerCount={true}
              position="topLeft"
            />
          )}
          <View style={[styles.theaterCloseContainer, { top: insets.top + 12 }]} pointerEvents="box-none">
            <TouchableOpacity
              onPress={exitTheaterMode}
              style={styles.theaterCloseButton}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <View style={styles.theaterCloseButtonBg}>
                <Feather name="x" size={24} color="#ffffff" />
              </View>
            </TouchableOpacity>
          </View>
          <Animated.View
            style={[
              styles.theaterOverlay,
              { opacity: controlsOpacity }
            ]}
            pointerEvents={showControls ? 'auto' : 'none'}
          >
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={styles.theaterBottomGradient}
            >
              <View style={styles.theaterActions}>
                <TouchableOpacity
                  onPress={() => {
                    exitTheaterMode();
                    router.push({
                      pathname: '/spectate-scorecard-detail',
                      params: { matchId: match.id },
                    });
                  }}
                  style={styles.theaterActionButton}
                >
                  <Feather name="bar-chart-2" size={20} color="#ffffff" />
                  <Text style={styles.theaterActionText}>Stats</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    exitTheaterMode();
                    router.push({
                      pathname: '/spectate-radio-detail',
                      params: { matchId: match.id },
                    });
                  }}
                  style={styles.theaterActionButton}
                >
                  <Feather name="radio" size={20} color="#ffffff" />
                  <Text style={styles.theaterActionText}>Radio</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        </>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.matchInfoContainer}>
            <View style={styles.matchHeader}>
              <LiveIndicator />
              <View style={styles.viewerBadge}>
                <Feather name="eye" size={14} color="#9ca3af" />
                <Text style={styles.viewerText}>{viewerCount} watching</Text>
              </View>
            </View>

            <View style={styles.teamsContainer}>
              <View style={styles.teamCard}>
                <Text style={styles.teamLabel}>Team 1</Text>
                <Text style={styles.teamName}>{yourTeamDisplay}</Text>
              </View>
              <View style={styles.vsContainer}>
                <LinearGradient
                  colors={['#ef4444', '#dc2626']}
                  style={styles.vsBadge}
                >
                  <Text style={styles.vsText}>VS</Text>
                </LinearGradient>
              </View>
              <View style={styles.teamCard}>
                <Text style={styles.teamLabel}>Team 2</Text>
                <Text style={styles.teamName}>{oppTeamDisplay}</Text>
              </View>
            </View>

            {match.stats && (
              <View style={styles.scoreContainer}>
                <Text style={styles.scoreLabel}>CURRENT SCORE</Text>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreValue}>{getCurrentScore()}</Text>
                </View>
                <View style={styles.gameScoreRow}>
                  <Text style={styles.gameScoreLabel}>Game:</Text>
                  <Text style={styles.gameScoreValue}>
                    {match.stats.currentGame.serverDisplay} - {match.stats.currentGame.receiverDisplay}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.creatorText}>
              <Feather name="user" size={12} color="#6b7280" /> Broadcast by {match.creatorUsername}
            </Text>
          </View>

          <View style={styles.actionsContainer}>
            <TouchableOpacity
              onPress={enterTheaterMode}
              style={styles.primaryActionButton}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#ef4444', '#dc2626']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryActionGradient}
              >
                <Feather name="maximize" size={20} color="#ffffff" />
                <Text style={styles.primaryActionText}>Watch Fullscreen</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.secondaryActionsRow}>
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  router.push({
                    pathname: '/spectate-scorecard-detail',
                    params: { matchId: match.id },
                  });
                }}
                style={styles.secondaryActionButton}
                activeOpacity={0.7}
              >
                <Feather name="bar-chart-2" size={20} color="#60a5fa" />
                <Text style={styles.secondaryActionText}>Scorecard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  router.push({
                    pathname: '/spectate-radio-detail',
                    params: { matchId: match.id },
                  });
                }}
                style={styles.secondaryActionButton}
                activeOpacity={0.7}
              >
                <Feather name="radio" size={20} color="#22c55e" />
                <Text style={[styles.secondaryActionText, { color: '#22c55e' }]}>Radio</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}
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
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  inlineVideoContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  errorTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  errorText: {
    color: '#9ca3af',
    fontSize: 16,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  backButtonText: {
    color: '#60a5fa',
    fontSize: 16,
    fontWeight: '600',
  },
  streamContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  fullscreenHint: {
    position: 'absolute',
    bottom: 12,
    right: 12,
  },
  fullscreenHintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  fullscreenHintText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  placeholderContainer: {
    aspectRatio: 16 / 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    gap: 16,
  },
  placeholderText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  matchInfoContainer: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 16,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewerText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '500',
  },
  creatorText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  teamCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  teamLabel: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  teamName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  vsContainer: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  vsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scoreContainer: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  scoreLabel: {
    color: '#6b7280',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  scoreBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  scoreValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
  },
  gameScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gameScoreLabel: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '500',
  },
  gameScoreValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  actionsContainer: {
    gap: 12,
  },
  primaryActionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  secondaryActionText: {
    color: '#60a5fa',
    fontSize: 15,
    fontWeight: '600',
  },
  theaterContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  theaterVideoContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
    elevation: 0,
  },
  theaterStreamFrame: {
    ...StyleSheet.absoluteFillObject,
  },
  theaterOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    zIndex: 200,
    elevation: 200,
  },
  theaterTopGradient: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  theaterTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  theaterCloseContainer: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 300,
    elevation: 300,
  },
  theaterCloseButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  theaterCloseButtonBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  theaterTopCenter: {
    flex: 1,
    alignItems: 'center',
  },
  theaterViewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  theaterViewerText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  theaterBottomGradient: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  theaterBottomContent: {
    gap: 16,
  },
  theaterMatchInfo: {
    alignItems: 'center',
    gap: 8,
  },
  theaterMatchTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  theaterMatchScore: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 4,
  },
  theaterActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  theaterActionButton: {
    alignItems: 'center',
    gap: 6,
    padding: 12,
    minWidth: 80,
  },
  theaterActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
