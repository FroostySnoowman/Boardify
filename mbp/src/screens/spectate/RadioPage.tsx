import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getStoredSessionToken } from '../../api/auth';
import { ENV } from '../../config/env';
import { listPublicMatches, getStats, PublicMatch, Stats, Match, PlayerStats } from '../../api/matches';
import { nativeFetch } from '../../api/http';
import { Skeleton } from '../../components/Skeleton';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import { useRadioPlayback } from '../../contexts/RadioPlaybackContext';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';

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
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: '#4ade80',
        }}
      />
    </Animated.View>
  );
};

const getPlayerDisplayName = (name: string, isDoubles: boolean): string => {
  if (!name) return '';
  const parts = name.trim().split(' ');
  const last = parts[parts.length - 1];
  if (isDoubles) return last.substring(0, 3).toUpperCase();
  return name;
};

const formatFractionAndPercent = (n: number, d: number): string => {
  if (d === 0 || isNaN(n) || isNaN(d)) return '-';
  const f = `${n}/${d}`;
  const p = `(${Math.round((n / d) * 100)}%)`;
  return `${f} ${p}`;
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

  const getStat = (ids: string | string[], acc: (s: PlayerStats) => number) => {
    const list = Array.isArray(ids) ? ids : [ids];
    return list.reduce((sum, id) => {
      const ps = stats.players[id];
      return sum + (ps ? acc(ps) : 0);
    }, 0);
  };

  const getMaxStat = (ids: string | string[], acc: (s: PlayerStats) => number) => {
    const list = Array.isArray(ids) ? ids : [ids];
    return Math.max(0, ...list.map(id => {
      const ps = stats.players[id];
      return ps ? acc(ps) : 0;
    }));
  };

  const p1IdOrTeam = selectedPlayers.p1 === 'team' ? p1Ids : selectedPlayers.p1;
  const p2IdOrTeam = selectedPlayers.p2 === 'team' ? p2Ids : selectedPlayers.p2;
  const p1Name = p1Ids.map(n => getPlayerDisplayName(n, isDoubles)).join('/');
  const p2Name = p2Ids.map(n => getPlayerDisplayName(n, isDoubles)).join('/');
  const p1Header = selectedPlayers.p1 === 'team' ? p1Name : getPlayerDisplayName(selectedPlayers.p1, true);
  const p2Header = selectedPlayers.p2 === 'team' ? p2Name : getPlayerDisplayName(selectedPlayers.p2, true);

  const data = {
    Serve: [
      { label: 'Service Pts Won', p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.serve.servicePointsWon), getStat(p1IdOrTeam, p => p.serve.servicePointsPlayed)), p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.serve.servicePointsWon), getStat(p2IdOrTeam, p => p.serve.servicePointsPlayed)) },
      { label: 'Aces', p1: getStat(p1IdOrTeam, p => p.serve.aces), p2: getStat(p2IdOrTeam, p => p.serve.aces) },
      { label: 'Double Faults', p1: getStat(p1IdOrTeam, p => p.serve.doubleFaults), p2: getStat(p2IdOrTeam, p => p.serve.doubleFaults) },
      { label: '1st Serves', p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.serve.firstServeIn), getStat(p1IdOrTeam, p => p.serve.firstServeAttempted)), p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.serve.firstServeIn), getStat(p2IdOrTeam, p => p.serve.firstServeAttempted)) },
      { label: '1st Srv Pts Won', p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.serve.firstServePointsWon), getStat(p1IdOrTeam, p => p.serve.firstServePointsPlayed)), p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.serve.firstServePointsWon), getStat(p2IdOrTeam, p => p.serve.firstServePointsPlayed)) },
      { label: '2nd Serves', p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.serve.secondServeIn), getStat(p1IdOrTeam, p => p.serve.secondServeAttempted)), p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.serve.secondServeIn), getStat(p2IdOrTeam, p => p.serve.secondServeAttempted)) },
      { label: '2nd Srv Pts Won', p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.serve.secondServePointsWon), getStat(p1IdOrTeam, p => p.serve.secondServePointsPlayed)), p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.serve.secondServePointsWon), getStat(p2IdOrTeam, p => p.serve.secondServePointsPlayed)) },
      { label: 'Break Pts Saved', p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.serve.breakPointsSaved), getStat(p1IdOrTeam, p => p.serve.breakPointsFaced)), p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.serve.breakPointsSaved), getStat(p2IdOrTeam, p => p.serve.breakPointsFaced)) },
      { label: 'Unreturned Serves', p1: getStat(p1IdOrTeam, p => p.serve.servesUnreturned), p2: getStat(p2IdOrTeam, p => p.serve.servesUnreturned) }
    ],
    Return: [
      { label: 'Return Pts Won', p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.return.returnPointsWon), getStat(p1IdOrTeam, p => p.return.returnPointsPlayed)), p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.return.returnPointsWon), getStat(p2IdOrTeam, p => p.return.returnPointsPlayed)) },
      { label: '1st Srv Rets', p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.return.firstServeReturnMade), getStat(p1IdOrTeam, p => p.return.firstServeReturnAttempted)), p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.return.firstServeReturnMade), getStat(p2IdOrTeam, p => p.return.firstServeReturnAttempted)) },
      { label: '1st Srv Ret Pts Won', p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.return.firstServeReturnPointsWon), getStat(p1IdOrTeam, p => p.return.firstServeReturnPointsPlayed)), p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.return.firstServeReturnPointsWon), getStat(p2IdOrTeam, p => p.return.firstServeReturnPointsPlayed)) },
      { label: '2nd Srv Rets', p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.return.secondServeReturnMade), getStat(p1IdOrTeam, p => p.return.secondServeReturnAttempted)), p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.return.secondServeReturnMade), getStat(p2IdOrTeam, p => p.return.secondServeReturnAttempted)) },
      { label: '2nd Srv Ret Pts Won', p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.return.secondServeReturnPointsWon), getStat(p1IdOrTeam, p => p.return.secondServeReturnPointsPlayed)), p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.return.secondServeReturnPointsWon), getStat(p2IdOrTeam, p => p.return.secondServeReturnPointsPlayed)) },
      { label: 'Ret Unforced Err', p1: getStat(p1IdOrTeam, p => p.return.returnUnforcedErrors), p2: getStat(p2IdOrTeam, p => p.return.returnUnforcedErrors) },
      { label: 'Ret Forced Err', p1: getStat(p1IdOrTeam, p => p.return.returnForcedErrors), p2: getStat(p2IdOrTeam, p => p.return.returnForcedErrors) },
      { label: 'Break Pts Won', p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.return.breakPointsConverted), getStat(p1IdOrTeam, p => p.return.breakPointOpportunities)), p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.return.breakPointsConverted), getStat(p2IdOrTeam, p => p.return.breakPointOpportunities)) }
    ],
    Rally: [
      { label: 'Winners', p1: getStat(p1IdOrTeam, p => p.rally.winners), p2: getStat(p2IdOrTeam, p => p.rally.winners) },
      { label: 'Unforced Err', p1: getStat(p1IdOrTeam, p => p.rally.unforcedErrors), p2: getStat(p2IdOrTeam, p => p.rally.unforcedErrors) },
      { label: 'Forced Err', p1: getStat(p1IdOrTeam, p => p.rally.forcedErrors), p2: getStat(p2IdOrTeam, p => p.rally.forcedErrors) },
      { label: 'Net Pts Won', p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.rally.netPointsWon), getStat(p1IdOrTeam, p => p.rally.netPointsAttempted)), p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.rally.netPointsWon), getStat(p2IdOrTeam, p => p.rally.netPointsAttempted)) },
      { label: 'Longest Rally', p1: getMaxStat(p1IdOrTeam, p => p.rally.longestRallyLength), p2: getMaxStat(p2IdOrTeam, p => p.rally.longestRallyLength) }
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
      { label: 'Service Games Won', p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.individualMatch.serviceGamesWon), getStat(p1IdOrTeam, p => p.individualMatch.serviceGamesPlayed)), p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.individualMatch.serviceGamesWon), getStat(p2IdOrTeam, p => p.individualMatch.serviceGamesPlayed)) },
      { label: 'Return Games Won', p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.individualMatch.returnGamesWon), getStat(p1IdOrTeam, p => p.individualMatch.returnGamesPlayed)), p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.individualMatch.returnGamesWon), getStat(p2IdOrTeam, p => p.individualMatch.returnGamesPlayed)) },
      { label: 'Love Games Won', p1: getStat(p1IdOrTeam, p => p.individualMatch.loveGamesWon), p2: getStat(p2IdOrTeam, p => p.individualMatch.loveGamesWon) },
      { label: 'Game Pts on Srv', p1: formatFractionAndPercent(getStat(p1IdOrTeam, p => p.individualMatch.gamePointsWonOnServe), getStat(p1IdOrTeam, p => p.individualMatch.gamePointsOpportunityOnServe)), p2: formatFractionAndPercent(getStat(p2IdOrTeam, p => p.individualMatch.gamePointsWonOnServe), getStat(p2IdOrTeam, p => p.individualMatch.gamePointsOpportunityOnServe)) },
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
      {p1Ids.length > 1 && (
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
      {Object.entries(data).map(([category, list]) => (
        <View key={category}>
          <Text className="font-bold text-white text-center text-xs uppercase tracking-wider py-2 border-t border-b border-white/10">{`${category} Stats`}</Text>
          <View className="gap-3 mt-2">
            {list.map(({ label, p1, p2 }) => (
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

type LiveMatch = PublicMatch & { stats: Stats };

const RadioPlayer = ({ matchId }: { matchId: string }) => {
  const { state, start, pause, resume, jumpToLive } = useRadioPlayback();
  const isCurrentMatch = state.currentMatchId === matchId;
  const enabled = isCurrentMatch && state.enabled;
  const connected = enabled && state.connected;
  const isPlaying = enabled && state.isPlaying;
  const paused = enabled && state.paused;
  const hasPendingLive = enabled && state.hasPendingLive;
  const lastCommentary = enabled ? state.lastCommentary : null;

  const handleToggle = () => {
    hapticLight();
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
    jumpToLive();
  };

  const showLiveBadge = paused && hasPendingLive;

  return (
    <View
      className="flex-row items-center gap-3 flex-1"
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => false}
    >
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
            : lastCommentary
              ? lastCommentary.substring(0, 60) + (lastCommentary.length > 60 ? '...' : '')
              : (isPlaying ? 'Playing...' : 'Waiting for commentary...')}
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


const CourtView = ({ match, stats }: { match: LiveMatch; stats: Stats }) => {
  if (!stats || !stats.currentGame || !stats.currentSet) {
    return (
      <View className="bg-white/5 rounded-xl p-3 border border-white/10">
        <Text className="text-gray-400 text-sm">Loading score...</Text>
      </View>
    );
  }

  const yourTeamIds = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
  const oppTeamIds = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p);

  const serverName = stats.matchWinner ? undefined : stats.server;
  const serverIsOnYourTeam = !!(serverName && yourTeamIds.includes(serverName));
  const serverIsOnOppTeam = !!(serverName && oppTeamIds.includes(serverName));

  const yourSets = (stats.sets || []).map(set => ({
    player: yourTeamIds.reduce((sum, id) => sum + (set.games[id] || 0), 0),
    opponent: oppTeamIds.reduce((sum, id) => sum + (set.games[id] || 0), 0)
  }));
  if (!stats.matchWinner && stats.currentSet) {
    yourSets.push({
      player: yourTeamIds.reduce((sum, id) => sum + ((stats.currentSet.games[id] || 0)), 0),
      opponent: oppTeamIds.reduce((sum, id) => sum + ((stats.currentSet.games[id] || 0)), 0)
    });
  }

  const serverDisplay = stats.currentGame.serverDisplay || '0';
  const receiverDisplay = stats.currentGame.receiverDisplay || '0';

  return (
    <View className="bg-white/5 rounded-xl p-3 border border-white/10">
      {/* Player 1 Row */}
      <View className="flex-row items-center py-2 border-b border-white/10">
        <View className="flex-row items-center flex-1">
          <Text className={`text-sm font-semibold ${serverIsOnYourTeam ? 'text-green-400' : 'text-white'}`} numberOfLines={1}>
            {yourTeamIds.join(' / ')}
          </Text>
          {serverIsOnYourTeam && <TennisBallIcon />}
        </View>
        <View className="flex-row gap-2">
          {yourSets.map((set, i) => (
            <Text key={i} className="text-sm font-light text-white text-center" style={{ minWidth: 16 }}>
              {set.player}
            </Text>
          ))}
        </View>
        <View className="ml-2 px-2 py-1 bg-white/10 border border-white/20 rounded">
          <Text className="text-sm font-bold text-white">
            {serverIsOnYourTeam ? serverDisplay : receiverDisplay}
          </Text>
        </View>
      </View>

      {/* Player 2 Row */}
      <View className="flex-row items-center py-2">
        <View className="flex-row items-center flex-1">
          <Text className={`text-sm ${serverIsOnOppTeam ? 'text-green-400 font-semibold' : 'text-white'}`} numberOfLines={1}>
            {oppTeamIds.join(' / ')}
          </Text>
          {serverIsOnOppTeam && <TennisBallIcon />}
        </View>
        <View className="flex-row gap-2">
          {yourSets.map((set, i) => (
            <Text key={i} className="text-sm font-light text-white text-center" style={{ minWidth: 16 }}>
              {set.opponent}
            </Text>
          ))}
        </View>
        <View className="ml-2 px-2 py-1 bg-white/10 border border-white/20 rounded">
          <Text className="text-sm font-bold text-white">
            {!serverIsOnYourTeam ? serverDisplay : receiverDisplay}
          </Text>
        </View>
      </View>
    </View>
  );
};

interface RadioPageProps {
  teamId: string;
}

export default function RadioPage({ teamId }: RadioPageProps) {
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const connectionsRef = useRef<Record<string, WebSocket>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const matches = await listPublicMatches();
        const withStats = await Promise.all(matches.map(async m => {
          try {
            const s = await getStats(m.id);
            if (s && s.currentGame && s.currentSet) {
              return { ...m, stats: s };
            }
            return null;
          } catch {
            return null;
          }
        }));
        const validMatches = withStats.filter((x): x is LiveMatch => x !== null);
        setLiveMatches(validMatches);
      } catch {
        console.error('Failed to load live matches');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const ids = useMemo(() => liveMatches.map(m => m.id).join(','), [liveMatches]);

  useEffect(() => {
    if (loading || liveMatches.length === 0) return;

    let closed = false;
    const connectAll = async () => {
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

        liveMatches.forEach(m => {
          if (connectionsRef.current[m.id]) return;
          const url = `${proto}://${host}/ws/matches/${m.id}/spectate?token=${encodeURIComponent(token)}`;
          const ws = new WebSocket(url);
          ws.onmessage = ev => {
            try {
              const next = JSON.parse(ev.data) as Stats;
              setLiveMatches(prev => prev.map(mm => {
                if (mm.id !== m.id) return mm;

                if (!next || !next.currentGame || !next.currentSet) {
                  return mm;
                }

                const prevPoints = mm.stats?.matchTotals?.pointsPlayed || 0;
                const newPoints = next.matchTotals?.pointsPlayed || 0;
                const prevSetsCount = mm.stats?.sets?.length || 0;
                const newSetsCount = next.sets?.length || 0;

                if (newPoints > prevPoints ||
                  next.matchWinner ||
                  newSetsCount > prevSetsCount ||
                  (newPoints >= prevPoints &&
                    next.currentGame.serverPoints !== undefined &&
                    (next.currentGame.serverPoints !== mm.stats?.currentGame?.serverPoints ||
                      next.currentGame.receiverPoints !== mm.stats?.currentGame?.receiverPoints))) {
                  return { ...mm, stats: next };
                }

                return mm;
              }));
            } catch { }
          };
          ws.onclose = () => {
            if (!closed) delete connectionsRef.current[m.id];
          };
          ws.onerror = () => { };
          connectionsRef.current[m.id] = ws;
        });
      } catch { }
    };

    const timeoutId = setTimeout(() => {
      connectAll();
    }, 1000);

    return () => {
      closed = true;
      clearTimeout(timeoutId);
      Object.values(connectionsRef.current).forEach(ws => { try { ws.close(); } catch { } });
      connectionsRef.current = {};
    };
  }, [ids, loading]);

  const filtered = liveMatches.filter(m => {
    const term = search.toLowerCase();
    const text = [m.yourPlayer1, m.yourPlayer2, m.oppPlayer1, m.oppPlayer2, m.creatorUsername].filter(Boolean).join(' ').toLowerCase();
    return text.includes(term);
  });

  return (
    <View className="gap-6">
      {/* Header */}
      <View>
        <Text className="text-3xl font-bold text-white">Radio</Text>
        <View className="relative w-full mt-4">
          <Feather
            name="search"
            size={20}
            color="#9ca3af"
            style={{ position: 'absolute', left: 14, top: '50%', transform: [{ translateY: -10 }], zIndex: 1 }}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by player or creator..."
            placeholderTextColor="#6b7280"
            className="w-full pl-11 pr-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white"
          />
        </View>
      </View>

      {/* Loading State */}
      {loading && (
        <View className="gap-4">
          {[1, 2, 3].map(i => (
            <View key={i} className="p-4 rounded-2xl bg-white/5 border border-white/10 gap-3">
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center gap-2">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-3 w-10 rounded-full" />
                </View>
                <Skeleton className="h-3 w-24 rounded-full" />
              </View>
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-full" />
            </View>
          ))}
        </View>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <View className="items-center justify-center py-10">
          <Text className="text-gray-400">
            {search ? 'No matches found for your search.' : 'There are no live matches right now.'}
          </Text>
        </View>
      )}

      {/* Match Cards */}
      {!loading && filtered.length > 0 && (
        <View className="gap-4">
          {filtered.map(match => (
            <TouchableOpacity
              key={match.id}
              onPress={() => {
                hapticLight();
                router.push({
                  pathname: '/spectate-radio-detail',
                  params: { matchId: match.id },
                });
              }}
              className="p-4 rounded-2xl bg-white/5 border border-white/10 gap-3"
              activeOpacity={0.7}
            >
              {/* Header */}
              <View className="flex-row justify-between items-center mb-2">
                <View className="flex-row items-center gap-2">
                  <View style={{ position: 'relative', width: 8, height: 8 }}>
                    <View style={{ position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#f87171', opacity: 0.75 }} />
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' }} />
                  </View>
                  <Text className="text-xs font-semibold text-blue-400">LIVE</Text>
                </View>
                <Text className="text-sm text-gray-400" numberOfLines={1}>{match.creatorUsername}</Text>
              </View>

              {/* Court View */}
              <CourtView match={match} stats={match.stats} />

              {/* Radio Player - wrapped to stop event propagation */}
              <View
                className="flex-row items-center justify-between gap-3"
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => false}
                onResponderTerminationRequest={() => false}
              >
                <RadioPlayer matchId={match.id} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <KeyboardSpacer extraOffset={24} />
    </View>
  );
}
