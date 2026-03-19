import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Animated,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getStoredSessionToken } from '../../api/auth';
import { ENV } from '../../config/env';
import { listPublicMatchesFull, PublicMatchFull, PublicMatch, Stats, Match, PlayerStats } from '../../api/matches';
import { getStreamByMatch, Stream, isStreamActive } from '../../api/streams';
import { listMembers } from '../../api/teams';
import { useAuth } from '../../contexts/AuthContext';
import { Skeleton } from '../../components/Skeleton';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import SpectateLayout from './SpectateLayout';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import { LinearGradient } from 'expo-linear-gradient';
import StartStreamDialog from './components/StartStreamDialog';
import LiveMatchScorecard from '@/components/LiveMatchScorecard';

interface LiveIndicatorProps {
  size?: 'small' | 'large';
}

const LiveIndicator = ({ size = 'small' }: LiveIndicatorProps) => {
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

  const isLarge = size === 'large';

  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#ef4444',
          paddingHorizontal: isLarge ? 14 : 10,
          paddingVertical: isLarge ? 8 : 6,
          borderRadius: 20,
          gap: isLarge ? 8 : 6,
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
            width: isLarge ? 10 : 8,
            height: isLarge ? 10 : 8,
            borderRadius: isLarge ? 5 : 4,
            backgroundColor: '#ffffff',
            transform: [{ scale: pulseAnim }],
          }}
        />
        <Text
          style={{
            fontSize: isLarge ? 14 : 12,
            fontWeight: '700',
            color: '#ffffff',
            letterSpacing: 0.5,
          }}
        >
          LIVE
        </Text>
      </View>
    </View>
  );
};

interface LiveStreamPreviewProps {
  matchId: string;
  initialThumbnail?: string;
  onPress: () => void;
  playerNames?: string;
}

const LiveStreamPreview = ({ matchId, initialThumbnail, onPress, playerNames }: LiveStreamPreviewProps) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(initialThumbnail || null);
  const [imageKey, setImageKey] = useState(0);
  const [viewerCount] = useState(Math.floor(Math.random() * 50) + 1);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  useEffect(() => {
    if (!matchId) {
      return;
    }

    const fetchThumbnail = async () => {
      try {
        const streamData = await getStreamByMatch(matchId);

        if (streamData?.stream?.thumbnail) {
          const newUrl = streamData.stream.thumbnail;
          if (newUrl !== thumbnailUrl) {
            setThumbnailUrl(newUrl);
            setImageKey(prev => prev + 1);
          }
        }
      } catch (error: any) {
        console.warn(`[LIVE PREVIEW] Failed to fetch stream thumbnail for match ${matchId}:`, error?.message || error);
      }
    };

    fetchThumbnail();

    const interval = setInterval(fetchThumbnail, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [matchId, thumbnailUrl]);

  if (!thumbnailUrl) {
    return null;
  }

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
        marginBottom: 12,
      }}
    >
      <TouchableOpacity
        onPress={() => {
          hapticMedium();
          onPress();
        }}
        activeOpacity={0.95}
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: '#000',
          borderWidth: 2,
          borderColor: 'rgba(239, 68, 68, 0.5)',
          shadowColor: '#ef4444',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <View style={{ aspectRatio: 16 / 9 }}>
          <ExpoImage
            key={imageKey}
            source={{ uri: thumbnailUrl }}
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            cachePolicy="memory-disk"
            transition={300}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '50%',
            }}
          />

          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: 'rgba(239, 68, 68, 0.95)',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 3,
                borderColor: 'rgba(255, 255, 255, 0.3)',
                shadowColor: '#ef4444',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.5,
                shadowRadius: 16,
              }}
            >
              <Feather name="play" size={32} color="#ffffff" style={{ marginLeft: 4 }} />
            </View>
          </View>

          <View
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              right: 12,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <LiveIndicator size="small" />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 20,
                gap: 6,
              }}
            >
              <Feather name="eye" size={14} color="#ffffff" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#ffffff' }}>
                {viewerCount}
              </Text>
            </View>
          </View>

          <View
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              right: 12,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: '#ffffff',
                marginBottom: 4,
                textShadowColor: 'rgba(0, 0, 0, 0.8)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 4,
              }}
              numberOfLines={1}
            >
              {playerNames || 'Live Tennis Match'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: 'rgba(255, 255, 255, 0.8)',
                  textShadowColor: 'rgba(0, 0, 0, 0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 4,
                }}
              >
                Tap to watch
              </Text>
              <Feather name="chevron-right" size={14} color="rgba(255, 255, 255, 0.8)" />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

interface LiveStreamButtonProps {
  onPress: () => void;
}

const LiveStreamButton = ({ onPress }: LiveStreamButtonProps) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerAnimation.start();
    return () => shimmerAnimation.stop();
  }, [shimmerAnim]);

  return (
    <TouchableOpacity
      onPress={() => {
        hapticMedium();
        onPress();
      }}
      activeOpacity={0.9}
      style={{ flex: 1, overflow: 'hidden', borderRadius: 12 }}
    >
      <View style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
        <LinearGradient
          colors={['#ede5a6', '#806e2e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: 'rgba(128, 110, 46, 0.5)',
          }}
        >
          <Animated.View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: shimmerAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.4, 0],
              }),
              transform: [
                {
                  translateX: shimmerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-150, 150],
                  }),
                },
              ],
            }}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255, 255, 255, 0.5)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                width: '100%',
                height: '100%',
                transform: [{ rotate: '25deg' }],
              }}
            />
          </Animated.View>

          <View style={{ position: 'relative', zIndex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Feather name="play-circle" size={18} color="#2a2418" />
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#2a2418' }}>Watch Live</Text>
          </View>
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
};

const getPlayerDisplayName = (name: string, isDoubles: boolean): string => {
  if (!name) return '';
  const nameParts = name.trim().split(' ');
  const lastName = nameParts[nameParts.length - 1];
  if (isDoubles) {
    return lastName.substring(0, 3).toUpperCase();
  }
  return name;
};

const formatFractionAndPercent = (numerator: number, denominator: number): string => {
  if (denominator === 0 || isNaN(numerator) || isNaN(denominator)) {
    return '-';
  }
  const fraction = `${numerator}/${denominator}`;
  const percentage = `(${Math.round((numerator / denominator) * 100)}%)`;
  return `${fraction} ${percentage}`;
};

interface AllStatsDisplayProps {
  stats: Stats;
  match: Match;
}

const AllStatsDisplay = ({ stats, match }: AllStatsDisplayProps) => {
  const [selectedPlayers, setSelectedPlayers] = useState<{ p1: string; p2: string }>({ p1: 'team', p2: 'team' });

  const p1Ids = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
  const p2Ids = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p);
  const isDoubles = p1Ids.length > 1;

  const getStat = (ids: string | string[], accessor: (s: PlayerStats) => number) => {
    const playerIds = Array.isArray(ids) ? ids : [ids];
    return playerIds.reduce((sum, id) => {
      const playerStats = stats.players?.[id];
      return sum + (playerStats ? accessor(playerStats) : 0);
    }, 0);
  };

  const getMaxStat = (ids: string | string[], accessor: (s: PlayerStats) => number) => {
    const playerIds = Array.isArray(ids) ? ids : [ids];
    return Math.max(
      0,
      ...playerIds.map(id => {
        const playerStats = stats.players?.[id];
        return playerStats ? accessor(playerStats) : 0;
      })
    );
  };

  const p1IdOrTeam = selectedPlayers.p1 === 'team' ? p1Ids : selectedPlayers.p1;
  const p2IdOrTeam = selectedPlayers.p2 === 'team' ? p2Ids : selectedPlayers.p2;
  const p1Name = p1Ids.map(name => getPlayerDisplayName(name, isDoubles)).join('/');
  const p2Name = p2Ids.map(name => getPlayerDisplayName(name, isDoubles)).join('/');
  const p1Header = selectedPlayers.p1 === 'team' ? p1Name : getPlayerDisplayName(selectedPlayers.p1, true);
  const p2Header = selectedPlayers.p2 === 'team' ? p2Name : getPlayerDisplayName(selectedPlayers.p2, true);

  const allStatsData = {
    Serve: [
      {
        label: 'Service Pts Won',
        p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.serve.servicePointsWon), getStat(p1IdOrTeam, p => p.serve.servicePointsPlayed)),
        p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.serve.servicePointsWon), getStat(p2IdOrTeam, p => p.serve.servicePointsPlayed))
      },
      { label: 'Aces', p1: getStat(p1IdOrTeam, p => p.serve.aces), p2: getStat(p2IdOrTeam, p => p.serve.aces) },
      { label: 'Double Faults', p1: getStat(p1IdOrTeam, p => p.serve.doubleFaults), p2: getStat(p2IdOrTeam, p => p.serve.doubleFaults) },
      {
        label: '1st Serves',
        p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.serve.firstServeIn), getStat(p1IdOrTeam, p => p.serve.firstServeAttempted)),
        p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.serve.firstServeIn), getStat(p2IdOrTeam, p => p.serve.firstServeAttempted))
      },
      {
        label: '1st Srv Pts Won',
        p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.serve.firstServePointsWon), getStat(p1IdOrTeam, p => p.serve.firstServePointsPlayed)),
        p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.serve.firstServePointsWon), getStat(p2IdOrTeam, p => p.serve.firstServePointsPlayed))
      },
      {
        label: '2nd Serves',
        p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.serve.secondServeIn), getStat(p1IdOrTeam, p => p.serve.secondServeAttempted)),
        p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.serve.secondServeIn), getStat(p2IdOrTeam, p => p.serve.secondServeAttempted))
      },
      {
        label: '2nd Srv Pts Won',
        p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.serve.secondServePointsWon), getStat(p1IdOrTeam, p => p.serve.secondServePointsPlayed)),
        p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.serve.secondServePointsWon), getStat(p2IdOrTeam, p => p.serve.secondServePointsPlayed))
      },
      {
        label: 'Break Pts Saved',
        p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.serve.breakPointsSaved), getStat(p1IdOrTeam, p => p.serve.breakPointsFaced)),
        p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.serve.breakPointsSaved), getStat(p2IdOrTeam, p => p.serve.breakPointsFaced))
      },
      {
        label: 'Unreturned Serves',
        p1: getStat(p1IdOrTeam, p => p.serve.servesUnreturned),
        p2: getStat(p2IdOrTeam, p => p.serve.servesUnreturned)
      }
    ],
    Return: [
      {
        label: 'Return Pts Won',
        p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.return.returnPointsWon), getStat(p1IdOrTeam, p => p.return.returnPointsPlayed)),
        p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.return.returnPointsWon), getStat(p2IdOrTeam, p => p.return.returnPointsPlayed))
      },
      {
        label: '1st Srv Rets',
        p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.return.firstServeReturnMade), getStat(p1IdOrTeam, p => p.return.firstServeReturnAttempted)),
        p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.return.firstServeReturnMade), getStat(p2IdOrTeam, p => p.return.firstServeReturnAttempted))
      },
      {
        label: '1st Srv Ret Pts Won',
        p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.return.firstServeReturnPointsWon), getStat(p1IdOrTeam, p => p.return.firstServeReturnPointsPlayed)),
        p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.return.firstServeReturnPointsWon), getStat(p2IdOrTeam, p => p.return.firstServeReturnPointsPlayed))
      },
      {
        label: '2nd Srv Rets',
        p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.return.secondServeReturnMade), getStat(p1IdOrTeam, p => p.return.secondServeReturnAttempted)),
        p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.return.secondServeReturnMade), getStat(p2IdOrTeam, p => p.return.secondServeReturnAttempted))
      },
      {
        label: '2nd Srv Ret Pts Won',
        p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.return.secondServeReturnPointsWon), getStat(p1IdOrTeam, p => p.return.secondServeReturnPointsPlayed)),
        p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.return.secondServeReturnPointsWon), getStat(p2IdOrTeam, p => p.return.secondServeReturnPointsPlayed))
      },
      {
        label: 'Ret Unforced Err',
        p1: getStat(p1IdOrTeam, p => p.return.returnUnforcedErrors),
        p2: getStat(p2IdOrTeam, p => p.return.returnUnforcedErrors)
      },
      {
        label: 'Ret Forced Err',
        p1: getStat(p1IdOrTeam, p => p.return.returnForcedErrors),
        p2: getStat(p2IdOrTeam, p => p.return.returnForcedErrors)
      },
      {
        label: 'Break Pts Won',
        p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.return.breakPointsConverted), getStat(p1IdOrTeam, p => p.return.breakPointOpportunities)),
        p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.return.breakPointsConverted), getStat(p2IdOrTeam, p => p.return.breakPointOpportunities))
      }
    ],
    Rally: [
      { label: 'Winners', p1: getStat(p1IdOrTeam, p => p.rally.winners), p2: getStat(p2IdOrTeam, p => p.rally.winners) },
      { label: 'Unforced Err', p1: getStat(p1IdOrTeam, p => p.rally.unforcedErrors), p2: getStat(p2IdOrTeam, p => p.rally.unforcedErrors) },
      { label: 'Forced Err', p1: getStat(p1IdOrTeam, p => p.rally.forcedErrors), p2: getStat(p2IdOrTeam, p => p.rally.forcedErrors) },
      {
        label: 'Net Pts Won',
        p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.rally.netPointsWon), getStat(p1IdOrTeam, p => p.rally.netPointsAttempted)),
        p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.rally.netPointsWon), getStat(p2IdOrTeam, p => p.rally.netPointsAttempted))
      },
      {
        label: 'Longest Rally',
        p1: getMaxStat(p1IdOrTeam, p => p.rally.longestRallyLength),
        p2: getMaxStat(p2IdOrTeam, p => p.rally.longestRallyLength)
      }
    ],
    Other: [
      { label: 'Lets', p1: getStat(p1IdOrTeam, p => (p as any).other?.lets ?? 0), p2: getStat(p2IdOrTeam, p => (p as any).other?.lets ?? 0) },
      { label: 'Foot Faults', p1: getStat(p1IdOrTeam, p => (p as any).other?.footFaults ?? 0), p2: getStat(p2IdOrTeam, p => (p as any).other?.footFaults ?? 0) },
      { label: 'Net Touches', p1: getStat(p1IdOrTeam, p => (p as any).other?.touchingNet ?? 0), p2: getStat(p2IdOrTeam, p => (p as any).other?.touchingNet ?? 0) },
      { label: 'Ball Hits Body', p1: getStat(p1IdOrTeam, p => (p as any).other?.ballHitsBody ?? 0), p2: getStat(p2IdOrTeam, p => (p as any).other?.ballHitsBody ?? 0) },
      { label: 'Carries/Double Hits', p1: getStat(p1IdOrTeam, p => (p as any).other?.carry ?? 0), p2: getStat(p2IdOrTeam, p => (p as any).other?.carry ?? 0) },
      { label: 'Fixture Hits', p1: getStat(p1IdOrTeam, p => (p as any).other?.hitsFixture ?? 0), p2: getStat(p2IdOrTeam, p => (p as any).other?.hitsFixture ?? 0) },
      { label: 'Racquet Drops', p1: getStat(p1IdOrTeam, p => (p as any).other?.racquetDropped ?? 0), p2: getStat(p2IdOrTeam, p => (p as any).other?.racquetDropped ?? 0) },
      { label: 'Reach Over Net', p1: getStat(p1IdOrTeam, p => (p as any).other?.reachOverNet ?? 0), p2: getStat(p2IdOrTeam, p => (p as any).other?.reachOverNet ?? 0) },
      { label: 'Penalties', p1: getStat(p1IdOrTeam, p => (p as any).other?.penalties ?? 0), p2: getStat(p2IdOrTeam, p => (p as any).other?.penalties ?? 0) }
    ],
    Overall: [
      { label: 'Total Points Won', p1: getStat(p1IdOrTeam, p => p.individualMatch.pointsWon), p2: getStat(p2IdOrTeam, p => p.individualMatch.pointsWon) },
      {
        label: 'Service Games Won',
        p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.individualMatch.serviceGamesWon), getStat(p1IdOrTeam, p => p.individualMatch.serviceGamesPlayed)),
        p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.individualMatch.serviceGamesWon), getStat(p2IdOrTeam, p => p.individualMatch.serviceGamesPlayed))
      },
      {
        label: 'Return Games Won',
        p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.individualMatch.returnGamesWon), getStat(p1IdOrTeam, p => p.individualMatch.returnGamesPlayed)),
        p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.individualMatch.returnGamesWon), getStat(p2IdOrTeam, p => p.individualMatch.returnGamesPlayed))
      },
      { label: 'Love Games Won', p1: getStat(p1IdOrTeam, p => p.individualMatch.loveGamesWon), p2: getStat(p2IdOrTeam, p => p.individualMatch.loveGamesWon) },
      {
        label: 'Game Pts on Srv',
        p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.individualMatch.gamePointsWonOnServe), getStat(p1IdOrTeam, p => p.individualMatch.gamePointsOpportunityOnServe)),
        p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.individualMatch.gamePointsWonOnServe), getStat(p2IdOrTeam, p => p.individualMatch.gamePointsOpportunityOnServe))
      },
      { label: 'Longest Pt Streak', p1: getMaxStat(p1IdOrTeam, p => p.individualMatch.longestPointStreak), p2: getMaxStat(p2IdOrTeam, p => p.individualMatch.longestPointStreak) },
      { label: 'Longest Gm Streak', p1: getMaxStat(p1IdOrTeam, p => p.individualMatch.longestGameStreak), p2: getMaxStat(p2IdOrTeam, p => p.individualMatch.longestGameStreak) }
    ]
  };

  const PlayerButton = ({ id, side }: { id: string; side: 'p1' | 'p2' }) => (
    <TouchableOpacity
      onPress={() => setSelectedPlayers(s => ({ ...s, [side]: id }))}
      className={`px-3 py-1 rounded-full ${selectedPlayers[side] === id ? 'bg-blue-500' : 'bg-white/10'
        }`}
    >
      <Text className={`text-xs font-semibold ${selectedPlayers[side] === id ? 'text-white' : 'text-gray-300'}`}>
        {id === 'team' ? 'Team' : getPlayerDisplayName(id, true)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View className="mt-4 gap-4">
      {isDoubles && (
        <View className="flex-row justify-between items-center px-1 pb-4">
          <View className="flex-row gap-2">
            <PlayerButton id="team" side="p1" />
            {p1Ids.map(id => (<PlayerButton key={id} id={id} side="p1" />))}
          </View>
          <View className="flex-row gap-2">
            {p2Ids.map(id => (<PlayerButton key={id} id={id} side="p2" />))}
            <PlayerButton id="team" side="p2" />
          </View>
        </View>
      )}
      <View className="flex-row justify-between items-center px-1 pb-2 mb-2 border-t-2 border-white/10">
        <Text className="font-bold text-white text-xs w-1/3 text-left" numberOfLines={1}>{p1Header}</Text>
        <View className="w-1/2" />
        <Text className="font-bold text-white text-xs w-1/3 text-right" numberOfLines={1}>{p2Header}</Text>
      </View>
      {Object.entries(allStatsData).map(([category, statsList]) => (
        <View key={category}>
          <Text className="font-bold text-white text-center text-xs uppercase tracking-wider py-2 border-t border-b border-white/10">{`${category} Stats`}</Text>
          <View className="gap-3 mt-2">
            {statsList.map(({ label, p1, p2 }) => (
              <View key={label} className="flex-row justify-between items-center">
                <Text className="font-semibold text-white w-1/3 text-left text-sm">{p1}</Text>
                <Text className="text-gray-400 w-1/3 text-center text-xs">{label}</Text>
                <Text className="font-semibold text-white w-1/3 text-right text-sm">{p2}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
};

interface LiveMatch extends PublicMatch {
  stats: Stats;
  stream: Stream | null;
}


interface ScorecardPageProps {
  teamId: string;
  selectedMemberFilter?: string;
  refreshTrigger?: number;
  showStreamDialog?: boolean;
  setShowStreamDialog?: (open: boolean) => void;
}

export default function ScorecardPage({ teamId, selectedMemberFilter = 'all', refreshTrigger = 0, showStreamDialog: showStreamDialogProp, setShowStreamDialog: setShowStreamDialogProp }: ScorecardPageProps) {
  const { user } = useAuth();
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [internalShowStreamDialog, setInternalShowStreamDialog] = useState(false);
  const isStreamDialogControlled = showStreamDialogProp !== undefined && setShowStreamDialogProp !== undefined;
  const showStreamDialog = isStreamDialogControlled ? showStreamDialogProp : internalShowStreamDialog;
  const setShowStreamDialog = isStreamDialogControlled ? setShowStreamDialogProp! : setInternalShowStreamDialog;
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const fetchIdRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const formatElapsed = (createdAt: string) => {
    const diff = now - new Date(createdAt).getTime();
    const total = Math.max(0, Math.floor(diff / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!teamId || teamId === 'all' || teamId === '') {
      setTeamMemberIds([]);
      return;
    }
    let cancelled = false;
    listMembers(teamId)
      .then(members => {
        if (!cancelled) setTeamMemberIds(members.map(m => m.id));
      })
      .catch(() => {
        if (!cancelled) setTeamMemberIds([]);
      });
    return () => { cancelled = true; };
  }, [teamId]);

  const fetchMatches = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const thisFetch = ++fetchIdRef.current;
    try {
      const matches = await listPublicMatchesFull();
      const valid = matches.filter((m): m is PublicMatchFull & { stats: Stats } => m.stats !== null);

      // Show list immediately; stream status may still be null and will fill in below.
      setLiveMatches(valid as unknown as LiveMatch[]);
      if (!silent) setLoading(false);
      if (thisFetch !== fetchIdRef.current) return;

      // Second phase: load stream status in the background and merge into state as each resolves.
      const withStreamIds = valid.filter(m => m.stream?.uid);
      if (withStreamIds.length === 0) return;

      const statusChecks = await Promise.all(
        withStreamIds.map(m =>
          getStreamByMatch(m.id as unknown as string)
            .then(res => ({ matchId: m.id, stream: res?.stream ?? null }))
            .catch(() => ({ matchId: m.id, stream: null }))
        )
      );
      if (thisFetch !== fetchIdRef.current) return;
      const statusMap = new Map(statusChecks.map(s => [s.matchId, s.stream]));
      setLiveMatches(prev =>
        prev.map(m => ({ ...m, stream: statusMap.get(m.id) ?? m.stream }))
      );
    } catch (e) {
      console.error('[FETCH MATCHES] Failed to load live matches:', e);
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load and when user pulls to refresh (refreshTrigger)
  useEffect(() => {
    fetchMatches();
  }, [refreshTrigger, fetchMatches]);

  // WebSocket for list updates: when a match is created or ended, server pushes so we refetch once.
  useEffect(() => {
    let listWs: WebSocket | null = null;
    let cancelled = false;

    const connect = async () => {
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
        const wsUrl = `${proto}://${host}/ws/live-matches-list?token=${encodeURIComponent(token)}`;

        listWs = new WebSocket(wsUrl);
        listWs.onmessage = () => {
          if (!cancelled) fetchMatches(true);
        };
        listWs.onerror = () => {};
        listWs.onclose = () => {};
      } catch (_) {}
    };

    connect();
    return () => {
      cancelled = true;
      listWs?.close();
    };
  }, [fetchMatches]);

  useEffect(() => {
    const sockets: WebSocket[] = [];
    let isCleaningUp = false;

    const connectToMatch = async (matchId: string) => {
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
        ws.onmessage = event => {
          try {
            const payload = JSON.parse(event.data);
            if (payload?.type === 'stream_status') {
              const eventType = typeof payload.event === 'string' ? payload.event : '';
              const state = payload.stream?.status?.state;
              const streamEnded =
                eventType === 'stream_ended' ||
                eventType === 'stream_deleted' ||
                eventType === 'stream_stopped' ||
                (typeof state === 'string' && !isStreamActive({ status: { state } } as Stream));

              if (streamEnded) {
                setLiveMatches(prevMatches =>
                  prevMatches.map(m => (m.id === matchId ? { ...m, stream: null } : m))
                );
              } else if (payload.stream) {
                setLiveMatches(prevMatches =>
                  prevMatches.map(m =>
                    m.id === matchId ? { ...m, stream: { ...(m.stream || {}), ...payload.stream } } : m
                  )
                );
              }
              return;
            }

            const newStats = payload;
            setLiveMatches(prevMatches =>
              prevMatches.map(m => (m.id === matchId ? { ...m, stats: newStats } : m))
            );
          } catch { }
        };
        ws.onerror = () => { };
        ws.onclose = () => { };
        sockets.push(ws);
      } catch { }
    };

    liveMatches.forEach(match => connectToMatch(match.id));

    return () => {
      isCleaningUp = true;
      sockets.forEach(ws => ws.close());
    };
  }, [liveMatches.map(m => m.id).join(',')]);

  const filteredMatches = liveMatches.filter(match => {
    const searchTerm = search.toLowerCase();
    const searchableText = [
      match.yourPlayer1,
      match.yourPlayer2,
      match.oppPlayer1,
      match.oppPlayer2,
      match.creatorUsername
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesSearch = searchableText.includes(searchTerm);

    let matchesTeamFilter: boolean;
    if (teamId === 'all') {
      matchesTeamFilter = true;
    } else if (teamId === '') {
      matchesTeamFilter = !!user?.id && match.userId === user.id;
    } else {
      matchesTeamFilter =
        teamMemberIds.length === 0 ? true : teamMemberIds.includes(match.userId);
    }

    if (selectedMemberFilter === 'all') {
      return matchesSearch && matchesTeamFilter;
    }

    const matchPlayers = [
      match.yourPlayer1,
      match.yourPlayer2,
      match.oppPlayer1,
      match.oppPlayer2
    ].filter(Boolean);

    const matchesMember = matchPlayers.includes(selectedMemberFilter);
    return matchesSearch && matchesTeamFilter && matchesMember;
  });

  return (
    <View className="gap-6">
      <View>
        <View className="flex-row items-center">
          <View className="relative flex-1">
            <Feather
              name="search"
              size={20}
              color="#9ca3af"
              style={{ position: 'absolute', left: 16, top: '50%', transform: [{ translateY: -10 }], zIndex: 1 }}
            />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by player or creator..."
              placeholderTextColor="#6b7280"
              className="w-full pl-12 pr-4 py-3.5 rounded-lg bg-white/5 border border-white/10 text-white min-h-[48px]"
            />
          </View>
        </View>
      </View>

      {loading && (
        <View className="gap-4">
          {[1, 2, 3].map(i => (
            <View key={i} className="p-4 rounded-2xl bg-white/5 border border-white/10 gap-3">
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center gap-2">
                  <Skeleton className="h-2.5 w-2.5 rounded-full" />
                  <Skeleton className="h-3 w-10 rounded-full" />
                </View>
                <Skeleton className="h-3 w-24 rounded-full" />
              </View>
              <View className="gap-2">
                <View className="flex-row items-center">
                  <Skeleton className="h-4 w-32 rounded-full mr-2" />
                  <View className="flex-1 flex-row gap-2">
                    {[0, 1, 2, 3, 4].map(j => (
                      <Skeleton key={j} className="h-4 flex-1 rounded" />
                    ))}
                  </View>
                  <Skeleton className="h-5 w-8 rounded-md ml-3" />
                </View>
                <View className="flex-row items-center">
                  <Skeleton className="h-4 w-32 rounded-full mr-2" />
                  <View className="flex-1 flex-row gap-2">
                    {[0, 1, 2, 3, 4].map(j => (
                      <Skeleton key={j} className="h-4 flex-1 rounded" />
                    ))}
                  </View>
                  <Skeleton className="h-5 w-8 rounded-md ml-3" />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {!loading && filteredMatches.length === 0 && (
        <View className="items-center justify-center py-20">
          <View className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-white/10 to-white/5 items-center justify-center border border-white/20">
            <Feather name="activity" size={48} color="#9ca3af" />
          </View>
          <Text className="text-2xl font-bold text-white mb-3">
            {search ? 'No Matches Found' : 'No Live Matches'}
          </Text>
          <Text className="text-gray-400 text-lg text-center">
            {search
              ? 'Try adjusting your search terms'
              : 'Live matches will appear here when available'}
          </Text>
        </View>
      )}

      {!loading && filteredMatches.length > 0 && (
        <View className="gap-4">
          {filteredMatches.map(match => {
            if (!match.stats) return null;

            const { stats } = match;
            const yourTeamIds = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
            const oppTeamIds = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p);

            const serverName = stats.matchWinner ? undefined : stats.server;
            const serverIsOnYourTeam = !!(serverName && yourTeamIds.includes(serverName));
            const serverIsOnOppTeam = !!(serverName && oppTeamIds.includes(serverName));

            const yourSets = (stats.sets || []).map(set => ({
              player: yourTeamIds.reduce((sum, id) => sum + ((set.games || {})[id] || 0), 0),
              opponent: oppTeamIds.reduce((sum, id) => sum + ((set.games || {})[id] || 0), 0)
            }));
            if (!stats.matchWinner && stats.currentSet) {
              yourSets.push({
                player: yourTeamIds.reduce((sum, id) => sum + ((stats.currentSet.games || {})[id] || 0), 0),
                opponent: oppTeamIds.reduce((sum, id) => sum + ((stats.currentSet.games || {})[id] || 0), 0)
              });
            }

            const streamActive = isStreamActive(match.stream);

            const player1Sets = yourSets.map(s => s.player);
            const player2Sets = yourSets.map(s => s.opponent);
            const p1GameScore = serverIsOnYourTeam
              ? (stats.currentGame?.serverDisplay ?? '-')
              : (stats.currentGame?.receiverDisplay ?? '-');
            const p2GameScore = !serverIsOnYourTeam
              ? (stats.currentGame?.serverDisplay ?? '-')
              : (stats.currentGame?.receiverDisplay ?? '-');

            return (
              <View
                key={match.id}
                className="p-4 rounded-2xl bg-white/5 border border-white/10"
              >
                <LiveMatchScorecard
                  title={formatElapsed(match.createdAt)}
                  isLive
                  useRedLiveIndicator={streamActive}
                  headerRight={`${formatElapsed(match.createdAt)} · ${match.creatorUsername}`}
                  player1Names={yourTeamIds}
                  player1Sets={player1Sets}
                  player2Names={oppTeamIds}
                  player2Sets={player2Sets}
                  player1Serving={serverIsOnYourTeam}
                  player2Serving={serverIsOnOppTeam}
                  player1IsWinner={!!stats.matchWinner && yourTeamIds.includes(stats.matchWinner)}
                  player2IsWinner={!!stats.matchWinner && oppTeamIds.includes(stats.matchWinner)}
                  player1GameScore={p1GameScore}
                  player2GameScore={p2GameScore}
                  onPress={() => {
                    hapticLight();
                    router.push({
                      pathname: '/spectate-scorecard-detail',
                      params: { matchId: match.id },
                    });
                  }}
                />

                <View className="mt-4">
                  {(() => {
                    const previewActive = isStreamActive(match.stream);
                    return previewActive ? (
                      <LiveStreamPreview
                        matchId={match.id}
                        initialThumbnail={match.stream?.thumbnail || undefined}
                        playerNames={`${yourTeamIds.join(' / ')} vs ${oppTeamIds.join(' / ')}`}
                        onPress={() => {
                          hapticMedium();
                          router.push({
                            pathname: '/spectate-stream-viewer',
                            params: { matchId: match.id },
                          });
                        }}
                      />
                    ) : null;
                  })()}

                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      onPress={() => {
                        hapticLight();
                        router.push({
                          pathname: '/spectate-radio-detail',
                          params: { matchId: match.id },
                        });
                      }}
                      className="flex-1 flex-row items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500/20 border border-blue-500/30"
                      activeOpacity={0.7}
                    >
                      <Feather name="radio" size={18} color="#60a5fa" />
                      <Text className="text-sm font-semibold text-blue-400">Listen</Text>
                    </TouchableOpacity>

                    {(() => {
                      const buttonActive = isStreamActive(match.stream);
                      return buttonActive ? (
                        <LiveStreamButton
                          onPress={() => {
                            hapticMedium();
                            router.push({
                              pathname: '/spectate-stream-viewer',
                              params: { matchId: match.id },
                            });
                          }}
                        />
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            hapticLight();
                            setShowStreamDialog(true);
                          }}
                          className="flex-1 flex-row items-center justify-center gap-2 px-4 py-3 rounded-xl"
                          style={{ backgroundColor: 'rgba(55, 48, 163, 0.3)', borderWidth: 1, borderColor: 'rgba(55, 48, 163, 0.5)', borderRadius: 12 }}
                          activeOpacity={0.7}
                        >
                          <Feather name="video" size={18} color="#818cf8" />
                          <Text className="text-sm font-semibold" style={{ color: '#818cf8' }}>Stream</Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <KeyboardSpacer extraOffset={24} />

      <StartStreamDialog
        isOpen={showStreamDialog}
        onClose={() => setShowStreamDialog(false)}
      />
    </View>
  );
}
