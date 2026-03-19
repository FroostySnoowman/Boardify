import React, { useState, useEffect, useMemo } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getMatch, getStats, Match, Stats, PlayerStats } from '../src/api/matches';
import { getPlayerDisplayName, computeSetStreaks } from '../src/screens/match/utils/matchUtils';
import { hapticLight } from '../src/utils/haptics';
import { KeyboardSpacer } from '@/components/KeyboardSpacer';
import StatTrendChart from '../src/screens/match/components/StatTrendChart';
import { getStatTrendBySet, canShowStatTrend } from '../src/screens/match/utils/statTrendFromHistory';
import { CHARTABLE_STAT_DEFINITIONS, getStatDefinition } from '../src/screens/match/utils/statDefinitions';

const BACKGROUND_COLOR = '#020617';
const P1_COLOR = '#60a5fa';
const P2_COLOR = '#e2e8f0';
const BAR_BG = 'rgba(255,255,255,0.06)';

type DetailStatRow = { label: string; p1Val: number; p1Total: number; p2Val: number; p2Total: number; isPercent: boolean };

const DetailStatBar = ({ row }: { row: DetailStatRow }) => {
  const { label, p1Val, p1Total, p2Val, p2Total, isPercent } = row;
  let p1Pct: number, p2Pct: number;
  let p1Display: string, p2Display: string;

  if (isPercent) {
    p1Pct = p1Total > 0 ? (p1Val / p1Total) * 100 : 0;
    p2Pct = p2Total > 0 ? (p2Val / p2Total) * 100 : 0;
    p1Display = p1Total > 0 ? `${Math.round(p1Pct)}%` : '-';
    p2Display = p2Total > 0 ? `${Math.round(p2Pct)}%` : '-';
  } else {
    const total = p1Val + p2Val;
    p1Pct = total > 0 ? (p1Val / total) * 100 : 0;
    p2Pct = total > 0 ? (p2Val / total) * 100 : 0;
    p1Display = `${p1Val}`;
    p2Display = `${p2Val}`;
  }

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 6, letterSpacing: 0.3 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 22 }}>
        <Text style={{ color: P1_COLOR, fontSize: 13, fontWeight: '700', width: 44, textAlign: 'right', marginRight: 6 }}>{p1Display}</Text>
        <View style={{ flex: 1, flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: BAR_BG }}>
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
            <View style={{ width: `${Math.min(p1Pct, 100)}%`, backgroundColor: P1_COLOR, borderTopLeftRadius: 5, borderBottomLeftRadius: 5 }} />
          </View>
          <View style={{ width: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} />
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={{ width: `${Math.min(p2Pct, 100)}%`, backgroundColor: P2_COLOR, borderTopRightRadius: 5, borderBottomRightRadius: 5 }} />
          </View>
        </View>
        <Text style={{ color: P2_COLOR, fontSize: 13, fontWeight: '700', width: 44, textAlign: 'left', marginLeft: 6 }}>{p2Display}</Text>
      </View>
    </View>
  );
};

const FinalScorecard = ({ match, stats }: { match: Match; stats: Stats }) => {
  const yourTeamIds = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
  const oppTeamIds = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p);
  const isDoubles = yourTeamIds.length > 1;
  const yourTeamNames = yourTeamIds.map(name => getPlayerDisplayName(name, isDoubles)).join(' / ');
  const oppTeamNames = oppTeamIds.map(name => getPlayerDisplayName(name, isDoubles)).join(' / ');
  const p1IsWinner = stats.matchWinner ? yourTeamIds.includes(stats.matchWinner) : false;
  const p2IsWinner = stats.matchWinner ? oppTeamIds.includes(stats.matchWinner) : false;
  const getTeamGames = (gameScores: Record<string, number>, teamIds: string[]) =>
    teamIds.reduce((acc, id) => acc + (gameScores[id] || 0), 0);

  let p1GameScore: string | number = '';
  let p2GameScore: string | number = '';

  const isFinished = match.status === 'completed' && !!stats.matchWinner;
  if (!isFinished) {
    const serverIsOnYourTeam = stats.server && yourTeamIds.includes(stats.server);
    p1GameScore = serverIsOnYourTeam ? stats.currentGame.serverDisplay : stats.currentGame.receiverDisplay;
    p2GameScore = serverIsOnYourTeam ? stats.currentGame.receiverDisplay : stats.currentGame.serverDisplay;
  }

  const totalSetsInMatch = stats.sets.length + (isFinished ? 0 : 1);
  const maxSetsToDisplay = Math.max(totalSetsInMatch, match.bestOf === '1' ? 1 : 3);

  const renderSetScores = (teamIds: string[]) => {
    return Array.from({ length: maxSetsToDisplay }).map((_, i) => {
      let setScore = null;
      if (i < stats.sets.length) {
        const set = stats.sets[i];
        setScore = {
          mainScore: getTeamGames(set.games, teamIds),
          tiebreakScore: set.tiebreak ? getTeamGames(set.tiebreak, teamIds) : undefined,
        };
      } else if (i === stats.sets.length && !isFinished) {
        const set = stats.currentSet;
        setScore = {
          mainScore: getTeamGames(set.games, teamIds),
          tiebreakScore: set.tiebreak ? getTeamGames(set.tiebreak, teamIds) : undefined,
        };
      }

      return (
        <View key={i} className="flex-1 items-center">
          {setScore ? (
            <View className="flex-row items-center">
              <Text className="font-bold text-lg text-white">{setScore.mainScore}</Text>
              {setScore.tiebreakScore !== undefined && (
                <Text className="font-normal text-xs ml-0.5 text-gray-400">{setScore.tiebreakScore}</Text>
              )}
            </View>
          ) : (
            <Text className="font-bold text-lg text-white"> </Text>
          )}
        </View>
      );
    });
  };

  return (
    <View>
      <View className="flex-row items-center pb-3 mb-3 border-b border-white/10">
        <View className="w-1/3" />
        <View className="flex-1 flex-row justify-center">
          {Array.from({ length: maxSetsToDisplay }).map((_, i) => (
            <Text key={i} className="flex-1 text-center text-xs text-gray-400 font-medium">
              SET {i + 1}
            </Text>
          ))}
        </View>
        <View className="w-16 text-center ml-4">
          <Text className="text-xs text-gray-400 font-medium">GAME</Text>
        </View>
      </View>
      <View className="flex-row items-center py-3 border-b border-white/10">
        <Text className={`w-1/3 font-semibold text-base ${p1IsWinner ? 'text-blue-400' : 'text-white'}`} numberOfLines={1}>
          {yourTeamNames}
        </Text>
        <View className="flex-1 flex-row justify-center">
          {renderSetScores(yourTeamIds)}
        </View>
        <Text className="w-16 text-center ml-4 font-bold text-lg text-white">{p1GameScore}</Text>
      </View>
      <View className="flex-row items-center py-3">
        <Text className={`w-1/3 font-semibold text-base ${p2IsWinner ? 'text-blue-400' : 'text-white'}`} numberOfLines={1}>
          {oppTeamNames}
        </Text>
        <View className="flex-1 flex-row justify-center">
          {renderSetScores(oppTeamIds)}
        </View>
        <Text className="w-16 text-center ml-4 font-bold text-lg text-white">{p2GameScore}</Text>
      </View>
    </View>
  );
};

export default function MatchDetailScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ matchId: string }>();
  const matchId = params.matchId;

  const [match, setMatch] = useState<Match | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllStatsModal, setShowAllStatsModal] = useState(false);
  const [allStatsTab, setAllStatsTab] = useState<'Serve' | 'Return' | 'Rally' | 'Overall' | 'Other'>('Serve');
  const [trendStatId, setTrendStatId] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) {
      router.back();
      return;
    }

    const loadMatchData = async () => {
      setLoading(true);
      try {
        const [matchData, statsData] = await Promise.all([getMatch(matchId), getStats(matchId)]);
        setMatch(matchData);
        setStats(statsData);
      } catch (error) {
        console.error('Failed to load match details', error);
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadMatchData();
  }, [matchId]);

  const matchDetails = useMemo(() => {
    if (!match) return null;

    const opponentNames = [match.oppPlayer1, match.oppPlayer2].filter(Boolean).join(' / ');
    const durationMs = new Date(match.updatedAt).getTime() - new Date(match.createdAt).getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const duration = `${hours}h ${minutes}m`;
    const formattedFormat = match.format.charAt(0).toUpperCase() + match.format.slice(1);
    const p1Ids = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
    const p2Ids = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p);
    const isDoubles = p1Ids.length > 1;
    const p1Name = p1Ids.map(name => getPlayerDisplayName(name, isDoubles)).join('/');
    const p2Name = p2Ids.map(name => getPlayerDisplayName(name, isDoubles)).join('/');

    return { opponentNames, duration, formattedFormat, p1Name, p2Name, p1Ids, p2Ids };
  }, [match]);

  type SummaryStatRow = { label: string; p1Val: number; p1Total: number; p2Val: number; p2Total: number; isPercent: boolean };

  const summaryStatsData = useMemo((): SummaryStatRow[] => {
    if (!match || !stats || !matchDetails) return [];
    const s = (ids: string[], accessor: (p: PlayerStats) => number) =>
      ids.reduce((sum, id) => sum + (stats.players[id] ? accessor(stats.players[id]) : 0), 0);
    const { p1Ids, p2Ids } = matchDetails;

    return [
      { label: 'Aces', p1Val: s(p1Ids, p => p.serve.aces), p1Total: 0, p2Val: s(p2Ids, p => p.serve.aces), p2Total: 0, isPercent: false },
      { label: 'Double Faults', p1Val: s(p1Ids, p => p.serve.doubleFaults), p1Total: 0, p2Val: s(p2Ids, p => p.serve.doubleFaults), p2Total: 0, isPercent: false },
      { label: '1st Serve %', p1Val: s(p1Ids, p => p.serve.firstServeIn), p1Total: s(p1Ids, p => p.serve.firstServeAttempted), p2Val: s(p2Ids, p => p.serve.firstServeIn), p2Total: s(p2Ids, p => p.serve.firstServeAttempted), isPercent: true },
      { label: '1st Serve Points Won', p1Val: s(p1Ids, p => p.serve.firstServePointsWon), p1Total: s(p1Ids, p => p.serve.firstServePointsPlayed), p2Val: s(p2Ids, p => p.serve.firstServePointsWon), p2Total: s(p2Ids, p => p.serve.firstServePointsPlayed), isPercent: true },
      { label: '2nd Serve Points Won', p1Val: s(p1Ids, p => p.serve.secondServePointsWon), p1Total: s(p1Ids, p => p.serve.secondServePointsPlayed), p2Val: s(p2Ids, p => p.serve.secondServePointsWon), p2Total: s(p2Ids, p => p.serve.secondServePointsPlayed), isPercent: true },
      { label: 'Service Games Won', p1Val: s(p1Ids, p => p.individualMatch.serviceGamesWon), p1Total: s(p1Ids, p => p.individualMatch.serviceGamesPlayed), p2Val: s(p2Ids, p => p.individualMatch.serviceGamesWon), p2Total: s(p2Ids, p => p.individualMatch.serviceGamesPlayed), isPercent: true },
      { label: 'Return Points Won', p1Val: s(p1Ids, p => p.return.returnPointsWon), p1Total: s(p1Ids, p => p.return.returnPointsPlayed), p2Val: s(p2Ids, p => p.return.returnPointsWon), p2Total: s(p2Ids, p => p.return.returnPointsPlayed), isPercent: true },
      { label: 'Returns In', p1Val: s(p1Ids, p => p.return.totalReturnMade), p1Total: s(p1Ids, p => p.return.firstServeReturnAttempted + p.return.secondServeReturnAttempted), p2Val: s(p2Ids, p => p.return.totalReturnMade), p2Total: s(p2Ids, p => p.return.firstServeReturnAttempted + p.return.secondServeReturnAttempted), isPercent: true },
      { label: 'Break Points Won', p1Val: s(p1Ids, p => p.return.breakPointsConverted), p1Total: s(p1Ids, p => p.return.breakPointOpportunities), p2Val: s(p2Ids, p => p.return.breakPointsConverted), p2Total: s(p2Ids, p => p.return.breakPointOpportunities), isPercent: true },
      { label: 'Net Points Won', p1Val: s(p1Ids, p => p.rally.netPointsWon), p1Total: s(p1Ids, p => p.rally.netPointsAttempted), p2Val: s(p2Ids, p => p.rally.netPointsWon), p2Total: s(p2Ids, p => p.rally.netPointsAttempted), isPercent: true },
      { label: 'Winners', p1Val: s(p1Ids, p => p.rally.winners), p1Total: 0, p2Val: s(p2Ids, p => p.rally.winners), p2Total: 0, isPercent: false },
      { label: 'Unforced Errors', p1Val: s(p1Ids, p => p.rally.unforcedErrors), p1Total: 0, p2Val: s(p2Ids, p => p.rally.unforcedErrors), p2Total: 0, isPercent: false },
      { label: 'Forced Errors', p1Val: s(p1Ids, p => p.rally.forcedErrors), p1Total: 0, p2Val: s(p2Ids, p => p.rally.forcedErrors), p2Total: 0, isPercent: false },
      { label: 'Total Points Won', p1Val: s(p1Ids, p => p.individualMatch.pointsWon), p1Total: 0, p2Val: s(p2Ids, p => p.individualMatch.pointsWon), p2Total: 0, isPercent: false },
    ];
  }, [match, stats, matchDetails]);

  const setStreaks = useMemo(() => {
    if (!stats || !matchDetails) return { p1: 0, p2: 0 };
    return computeSetStreaks(stats.sets, matchDetails.p1Ids, matchDetails.p2Ids);
  }, [stats, matchDetails]);

  const allStatsCategories = useMemo((): Record<string, SummaryStatRow[]> => {
    if (!match || !stats || !matchDetails) return {};
    const s = (ids: string[], accessor: (p: PlayerStats) => number) =>
      ids.reduce((sum, id) => sum + (stats.players[id] ? accessor(stats.players[id]) : 0), 0);
    const mx = (ids: string[], accessor: (p: PlayerStats) => number) =>
      Math.max(0, ...ids.map(id => stats.players[id] ? accessor(stats.players[id]) : 0));
    const { p1Ids, p2Ids } = matchDetails;
    return {
      Serve: [
        { label: 'Service Points Won', p1Val: s(p1Ids, p => p.serve.servicePointsWon), p1Total: s(p1Ids, p => p.serve.servicePointsPlayed), p2Val: s(p2Ids, p => p.serve.servicePointsWon), p2Total: s(p2Ids, p => p.serve.servicePointsPlayed), isPercent: true },
        { label: 'Aces', p1Val: s(p1Ids, p => p.serve.aces), p1Total: 0, p2Val: s(p2Ids, p => p.serve.aces), p2Total: 0, isPercent: false },
        { label: 'Double Faults', p1Val: s(p1Ids, p => p.serve.doubleFaults), p1Total: 0, p2Val: s(p2Ids, p => p.serve.doubleFaults), p2Total: 0, isPercent: false },
        { label: '1st Serves', p1Val: s(p1Ids, p => p.serve.firstServeIn), p1Total: s(p1Ids, p => p.serve.firstServeAttempted), p2Val: s(p2Ids, p => p.serve.firstServeIn), p2Total: s(p2Ids, p => p.serve.firstServeAttempted), isPercent: true },
        { label: '1st Serve Points Won', p1Val: s(p1Ids, p => p.serve.firstServePointsWon), p1Total: s(p1Ids, p => p.serve.firstServePointsPlayed), p2Val: s(p2Ids, p => p.serve.firstServePointsWon), p2Total: s(p2Ids, p => p.serve.firstServePointsPlayed), isPercent: true },
        { label: '2nd Serves', p1Val: s(p1Ids, p => p.serve.secondServeIn), p1Total: s(p1Ids, p => p.serve.secondServeAttempted), p2Val: s(p2Ids, p => p.serve.secondServeIn), p2Total: s(p2Ids, p => p.serve.secondServeAttempted), isPercent: true },
        { label: '2nd Serve Points Won', p1Val: s(p1Ids, p => p.serve.secondServePointsWon), p1Total: s(p1Ids, p => p.serve.secondServePointsPlayed), p2Val: s(p2Ids, p => p.serve.secondServePointsWon), p2Total: s(p2Ids, p => p.serve.secondServePointsPlayed), isPercent: true },
        { label: 'Break Points Saved', p1Val: s(p1Ids, p => p.serve.breakPointsSaved), p1Total: s(p1Ids, p => p.serve.breakPointsFaced), p2Val: s(p2Ids, p => p.serve.breakPointsSaved), p2Total: s(p2Ids, p => p.serve.breakPointsFaced), isPercent: true },
        { label: 'Unreturned Serves', p1Val: s(p1Ids, p => p.serve.servesUnreturned), p1Total: 0, p2Val: s(p2Ids, p => p.serve.servesUnreturned), p2Total: 0, isPercent: false },
      ],
      Return: [
        { label: 'Return Points Won', p1Val: s(p1Ids, p => p.return.returnPointsWon), p1Total: s(p1Ids, p => p.return.returnPointsPlayed), p2Val: s(p2Ids, p => p.return.returnPointsWon), p2Total: s(p2Ids, p => p.return.returnPointsPlayed), isPercent: true },
        { label: '1st Serve Returns', p1Val: s(p1Ids, p => p.return.firstServeReturnMade), p1Total: s(p1Ids, p => p.return.firstServeReturnAttempted), p2Val: s(p2Ids, p => p.return.firstServeReturnMade), p2Total: s(p2Ids, p => p.return.firstServeReturnAttempted), isPercent: true },
        { label: '1st Serve Return Points Won', p1Val: s(p1Ids, p => p.return.firstServeReturnPointsWon), p1Total: s(p1Ids, p => p.return.firstServeReturnPointsPlayed), p2Val: s(p2Ids, p => p.return.firstServeReturnPointsWon), p2Total: s(p2Ids, p => p.return.firstServeReturnPointsPlayed), isPercent: true },
        { label: '2nd Serve Returns', p1Val: s(p1Ids, p => p.return.secondServeReturnMade), p1Total: s(p1Ids, p => p.return.secondServeReturnAttempted), p2Val: s(p2Ids, p => p.return.secondServeReturnMade), p2Total: s(p2Ids, p => p.return.secondServeReturnAttempted), isPercent: true },
        { label: '2nd Serve Return Points Won', p1Val: s(p1Ids, p => p.return.secondServeReturnPointsWon), p1Total: s(p1Ids, p => p.return.secondServeReturnPointsPlayed), p2Val: s(p2Ids, p => p.return.secondServeReturnPointsWon), p2Total: s(p2Ids, p => p.return.secondServeReturnPointsPlayed), isPercent: true },
        { label: 'Return Unforced Errors', p1Val: s(p1Ids, p => p.return.returnUnforcedErrors), p1Total: 0, p2Val: s(p2Ids, p => p.return.returnUnforcedErrors), p2Total: 0, isPercent: false },
        { label: 'Return Forced Errors', p1Val: s(p1Ids, p => p.return.returnForcedErrors), p1Total: 0, p2Val: s(p2Ids, p => p.return.returnForcedErrors), p2Total: 0, isPercent: false },
        { label: 'Break Points Won', p1Val: s(p1Ids, p => p.return.breakPointsConverted), p1Total: s(p1Ids, p => p.return.breakPointOpportunities), p2Val: s(p2Ids, p => p.return.breakPointsConverted), p2Total: s(p2Ids, p => p.return.breakPointOpportunities), isPercent: true },
      ],
      Rally: [
        { label: 'Winners', p1Val: s(p1Ids, p => p.rally.winners), p1Total: 0, p2Val: s(p2Ids, p => p.rally.winners), p2Total: 0, isPercent: false },
        { label: 'Unforced Errors', p1Val: s(p1Ids, p => p.rally.unforcedErrors), p1Total: 0, p2Val: s(p2Ids, p => p.rally.unforcedErrors), p2Total: 0, isPercent: false },
        { label: 'Forced Errors', p1Val: s(p1Ids, p => p.rally.forcedErrors), p1Total: 0, p2Val: s(p2Ids, p => p.rally.forcedErrors), p2Total: 0, isPercent: false },
        { label: 'Net Points Won', p1Val: s(p1Ids, p => p.rally.netPointsWon), p1Total: s(p1Ids, p => p.rally.netPointsAttempted), p2Val: s(p2Ids, p => p.rally.netPointsWon), p2Total: s(p2Ids, p => p.rally.netPointsAttempted), isPercent: true },
        { label: 'Longest Rally', p1Val: mx(p1Ids, p => p.rally.longestRallyLength), p1Total: 0, p2Val: mx(p2Ids, p => p.rally.longestRallyLength), p2Total: 0, isPercent: false },
      ],
      Overall: [
        { label: 'Total Points Won', p1Val: s(p1Ids, p => p.individualMatch.pointsWon), p1Total: 0, p2Val: s(p2Ids, p => p.individualMatch.pointsWon), p2Total: 0, isPercent: false },
        { label: 'Service Games Won', p1Val: s(p1Ids, p => p.individualMatch.serviceGamesWon), p1Total: s(p1Ids, p => p.individualMatch.serviceGamesPlayed), p2Val: s(p2Ids, p => p.individualMatch.serviceGamesWon), p2Total: s(p2Ids, p => p.individualMatch.serviceGamesPlayed), isPercent: true },
        { label: 'Return Games Won', p1Val: s(p1Ids, p => p.individualMatch.returnGamesWon), p1Total: s(p1Ids, p => p.individualMatch.returnGamesPlayed), p2Val: s(p2Ids, p => p.individualMatch.returnGamesWon), p2Total: s(p2Ids, p => p.individualMatch.returnGamesPlayed), isPercent: true },
        { label: 'Love Games Won', p1Val: s(p1Ids, p => p.individualMatch.loveGamesWon), p1Total: 0, p2Val: s(p2Ids, p => p.individualMatch.loveGamesWon), p2Total: 0, isPercent: false },
        { label: 'Game Points on Serve', p1Val: s(p1Ids, p => p.individualMatch.gamePointsWonOnServe), p1Total: s(p1Ids, p => p.individualMatch.gamePointsOpportunityOnServe), p2Val: s(p2Ids, p => p.individualMatch.gamePointsWonOnServe), p2Total: s(p2Ids, p => p.individualMatch.gamePointsOpportunityOnServe), isPercent: true },
        { label: 'Winner / UE Ratio', p1Val: (() => { const w = s(p1Ids, p => p.rally.winners); const ue = s(p1Ids, p => p.rally.unforcedErrors); return ue > 0 ? parseFloat((w / ue).toFixed(2)) : 0; })(), p1Total: 0, p2Val: (() => { const w = s(p2Ids, p => p.rally.winners); const ue = s(p2Ids, p => p.rally.unforcedErrors); return ue > 0 ? parseFloat((w / ue).toFixed(2)) : 0; })(), p2Total: 0, isPercent: false },
        { label: 'Dominance Ratio', p1Val: (() => { const rp = s(p1Ids, p => p.return.returnPointsWon); const srvLost = s(p2Ids, p => p.serve.servicePointsPlayed) - s(p2Ids, p => p.serve.servicePointsWon); return srvLost > 0 ? parseFloat((rp / srvLost).toFixed(2)) : 0; })(), p1Total: 0, p2Val: (() => { const rp = s(p2Ids, p => p.return.returnPointsWon); const srvLost = s(p1Ids, p => p.serve.servicePointsPlayed) - s(p1Ids, p => p.serve.servicePointsWon); return srvLost > 0 ? parseFloat((rp / srvLost).toFixed(2)) : 0; })(), p2Total: 0, isPercent: false },
        { label: 'Longest Point Streak', p1Val: mx(p1Ids, p => p.individualMatch.longestPointStreak), p1Total: 0, p2Val: mx(p2Ids, p => p.individualMatch.longestPointStreak), p2Total: 0, isPercent: false },
        { label: 'Longest Game Streak', p1Val: mx(p1Ids, p => p.individualMatch.longestGameStreak), p1Total: 0, p2Val: mx(p2Ids, p => p.individualMatch.longestGameStreak), p2Total: 0, isPercent: false },
        { label: 'Longest Set Streak', p1Val: setStreaks.p1, p1Total: 0, p2Val: setStreaks.p2, p2Total: 0, isPercent: false },
      ],
      Other: [
        { label: 'Lets', p1Val: s(p1Ids, p => (p as any).other?.lets ?? 0), p1Total: 0, p2Val: s(p2Ids, p => (p as any).other?.lets ?? 0), p2Total: 0, isPercent: false },
        { label: 'Foot Faults', p1Val: s(p1Ids, p => (p as any).other?.footFaults ?? 0), p1Total: 0, p2Val: s(p2Ids, p => (p as any).other?.footFaults ?? 0), p2Total: 0, isPercent: false },
        { label: 'Net Touches', p1Val: s(p1Ids, p => (p as any).other?.touchingNet ?? 0), p1Total: 0, p2Val: s(p2Ids, p => (p as any).other?.touchingNet ?? 0), p2Total: 0, isPercent: false },
        { label: 'Ball Hits Body', p1Val: s(p1Ids, p => (p as any).other?.ballHitsBody ?? 0), p1Total: 0, p2Val: s(p2Ids, p => (p as any).other?.ballHitsBody ?? 0), p2Total: 0, isPercent: false },
        { label: 'Carries/Double Hits', p1Val: s(p1Ids, p => (p as any).other?.carry ?? 0), p1Total: 0, p2Val: s(p2Ids, p => (p as any).other?.carry ?? 0), p2Total: 0, isPercent: false },
        { label: 'Fixture Hits', p1Val: s(p1Ids, p => (p as any).other?.hitsFixture ?? 0), p1Total: 0, p2Val: s(p2Ids, p => (p as any).other?.hitsFixture ?? 0), p2Total: 0, isPercent: false },
        { label: 'Racquet Drops', p1Val: s(p1Ids, p => (p as any).other?.racquetDropped ?? 0), p1Total: 0, p2Val: s(p2Ids, p => (p as any).other?.racquetDropped ?? 0), p2Total: 0, isPercent: false },
        { label: 'Reach Over Net', p1Val: s(p1Ids, p => (p as any).other?.reachOverNet ?? 0), p1Total: 0, p2Val: s(p2Ids, p => (p as any).other?.reachOverNet ?? 0), p2Total: 0, isPercent: false },
        { label: 'Penalties', p1Val: s(p1Ids, p => (p as any).other?.penalties ?? 0), p1Total: 0, p2Val: s(p2Ids, p => (p as any).other?.penalties ?? 0), p2Total: 0, isPercent: false },
      ],
    };
  }, [match, stats, matchDetails]);

  const ALL_STATS_TABS: Array<'Serve' | 'Return' | 'Rally' | 'Overall' | 'Other'> = ['Serve', 'Return', 'Rally', 'Overall', 'Other'];

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={(Platform.OS === 'android' || Platform.OS === 'web') ? { backgroundColor: '#020617' } : undefined}
         />
          <Stack.Screen.Title style={{ fontWeight: '800', color: '#ffffff' }}>
            Match Recap
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
              {loading || !match || !stats || !matchDetails ? (
                <View className="items-center justify-center h-96">
                  <ActivityIndicator size="large" color="#ffffff" />
                </View>
              ) : (
                <View className="gap-y-6">
                  <View className="items-center">
                    <Text className="text-2xl font-bold text-white">Match Recap</Text>
                    {(() => {
                      const isCompleted = match.status === 'completed';
                      const statusText = isCompleted ? 'Completed' : 'In Progress';
                      return (
                        <View className="mt-2 px-3 py-1 rounded-full bg-blue-500/20">
                          <Text className="text-sm font-semibold text-blue-300">{statusText}</Text>
                        </View>
                      );
                    })()}
                  </View>

                  <View>
                    <FinalScorecard match={match} stats={stats} />
                  </View>

                  <View>
                    <View className="flex-row items-center mb-4">
                      <Feather name="bar-chart-2" size={24} color="#60a5fa" style={{ marginRight: 12 }} />
                      <Text className="text-2xl font-bold text-white">Match Summary</Text>
                    </View>
                    {summaryStatsData.length > 0 ? (
                      <>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: P1_COLOR }} />
                            <Text style={{ color: P1_COLOR, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{matchDetails.p1Name}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ color: P2_COLOR, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{matchDetails.p2Name}</Text>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: P2_COLOR }} />
                          </View>
                        </View>
                        <View>
                          {summaryStatsData.map((row) => (
                            <DetailStatBar key={row.label} row={row} />
                          ))}
                        </View>
                        {(match.statMode === 'advanced' || match.statMode === 'intermediate') && (
                          <>
                            <TouchableOpacity
                              onPress={() => {
                                hapticLight();
                                setAllStatsTab('Serve');
                                setShowAllStatsModal(true);
                              }}
                              style={{ marginTop: 20, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
                              activeOpacity={0.7}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Feather name="bar-chart-2" size={16} color="#60A5FA" />
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#60A5FA' }}>View All Stats</Text>
                              </View>
                            </TouchableOpacity>
                            {canShowStatTrend(stats) && (
                              <View className="mt-6 pt-4 border-t border-white/10">
                                <Text className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                                  Trend by set
                                </Text>
                                <Text className="text-xs text-gray-500 mb-3">
                                  Tap a stat to see how it changed across sets
                                </Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                  {CHARTABLE_STAT_DEFINITIONS.map((def) => (
                                    <TouchableOpacity
                                      key={def.id}
                                      onPress={() => {
                                        hapticLight();
                                        setTrendStatId(def.id);
                                      }}
                                      className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 flex-row items-center gap-2"
                                      activeOpacity={0.7}
                                    >
                                      <Feather name="trending-up" size={14} color="#60A5FA" />
                                      <Text className="text-sm font-medium text-white">{def.label}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              </View>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <Text className="text-gray-400 text-center py-4">No stats available</Text>
                    )}
                  </View>

                  <View className="pt-4 border-t border-white/10">
                    <View className="flex-row items-center mb-4">
                      <Feather name="info" size={24} color="#60a5fa" style={{ marginRight: 12 }} />
                      <Text className="text-2xl font-bold text-white">Match Details</Text>
                    </View>
                    <View style={{ gap: 16 }}>
                      <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center" style={{ gap: 8 }}>
                          <Feather name="users" size={18} color="#9ca3af" />
                          <Text className="text-gray-300 font-medium text-base">Opponent</Text>
                        </View>
                        <Text className="font-medium text-white text-base text-right flex-1 pl-4" numberOfLines={1}>
                          {matchDetails.opponentNames}
                        </Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center" style={{ gap: 8 }}>
                          <Feather name="calendar" size={18} color="#9ca3af" />
                          <Text className="text-gray-300 font-medium text-base">Date</Text>
                        </View>
                        <Text className="font-medium text-white text-base">
                          {new Date(match.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center" style={{ gap: 8 }}>
                          <Feather name="clock" size={18} color="#9ca3af" />
                          <Text className="text-gray-300 font-medium text-base">Duration</Text>
                        </View>
                        <Text className="font-medium text-white text-base">{matchDetails.duration}</Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <View className="flex-row items-center" style={{ gap: 8 }}>
                          <Feather name="bar-chart-2" size={18} color="#9ca3af" />
                          <Text className="text-gray-300 font-medium text-base">Format</Text>
                        </View>
                        <Text className="font-medium text-white text-base">{matchDetails.formattedFormat}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
          <KeyboardSpacer extraOffset={40} />
        </View>
      </ScrollView>

      <Modal
        visible={!!trendStatId}
        transparent
        animationType="fade"
        onRequestClose={() => setTrendStatId(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setTrendStatId(null)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {trendStatId && match && stats && (() => {
              const stat = getStatDefinition(trendStatId);
              const trendData = getStatTrendBySet(match, stats, trendStatId);
              if (!stat) return null;
              return (
                <>
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-lg font-bold text-white">{stat.label} by set</Text>
                    <TouchableOpacity
                      onPress={() => { hapticLight(); setTrendStatId(null); }}
                      className="p-2 rounded-full bg-white/10"
                      activeOpacity={0.7}
                    >
                      <Feather name="x" size={22} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                  <StatTrendChart stat={stat} data={trendData} />
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showAllStatsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAllStatsModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#020617' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
            <TouchableOpacity onPress={() => { hapticLight(); setShowAllStatsModal(false); }} style={{ padding: 4, marginRight: 12 }} activeOpacity={0.7}>
              <Feather name="arrow-left" size={22} color="#ffffff" />
            </TouchableOpacity>
            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700', flex: 1 }}>All Statistics</Text>
          </View>

          {matchDetails && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: P1_COLOR }} />
                <Text style={{ color: P1_COLOR, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{matchDetails.p1Name}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: P2_COLOR, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{matchDetails.p2Name}</Text>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: P2_COLOR }} />
              </View>
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
            {ALL_STATS_TABS.map((tab) => {
              const isActive = allStatsTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => { hapticLight(); setAllStatsTab(tab); }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                    backgroundColor: isActive ? '#3b82f6' : 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: isActive ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? '#ffffff' : '#9ca3af' }}>{tab}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
            {(allStatsCategories[allStatsTab] ?? []).map((row) => (
              <DetailStatBar key={row.label} row={row} />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
  },
});
