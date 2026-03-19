import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Match, Stats, PlayerStats } from '../../../api/matches';
import { getPlayerDisplayName, computeSetStreaks } from '../utils/matchUtils';
import { hapticLight } from '../../../utils/haptics';


const P1_COLOR = '#60a5fa';
const P2_COLOR = '#e2e8f0';
const BAR_BG = 'rgba(255,255,255,0.06)';

interface LiveStatsProps {
  match: Match;
  stats: Stats;
}

type StatRow = { label: string; p1Val: number; p1Total: number; p2Val: number; p2Total: number; isPercent: boolean };

const StatBar = ({ row }: { row: StatRow }) => {
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

const ALL_STATS_TABS: Array<'Serve' | 'Return' | 'Rally' | 'Overall' | 'Other'> = ['Serve', 'Return', 'Rally', 'Overall', 'Other'];

const LiveStats = ({ match, stats }: LiveStatsProps) => {
  const insets = useSafeAreaInsets();
  const [showAllStatsModal, setShowAllStatsModal] = useState(false);
  const [allStatsTab, setAllStatsTab] = useState<'Serve' | 'Return' | 'Rally' | 'Overall' | 'Other'>('Serve');
  const p1Ids = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
  const p2Ids = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p);
  const isLiveDoubles = p1Ids.length > 1;

  const s = (ids: string[], accessor: (playerStats: any) => number) =>
    ids.reduce((sum, id) => sum + (stats.players[id] ? accessor(stats.players[id]) : 0), 0);
  const mx = (ids: string[], accessor: (p: PlayerStats) => number) =>
    Math.max(0, ...ids.map(id => stats.players[id] ? accessor(stats.players[id]) : 0));

  const p1Name = p1Ids.map(name => getPlayerDisplayName(name, isLiveDoubles)).join('/');
  const p2Name = p2Ids.map(name => getPlayerDisplayName(name, isLiveDoubles)).join('/');

  const rows: StatRow[] = [
    { label: 'Aces', p1Val: s(p1Ids, p => p.serve.aces), p1Total: 0, p2Val: s(p2Ids, p => p.serve.aces), p2Total: 0, isPercent: false },
    { label: 'Double Faults', p1Val: s(p1Ids, p => p.serve.doubleFaults), p1Total: 0, p2Val: s(p2Ids, p => p.serve.doubleFaults), p2Total: 0, isPercent: false },
    { label: '1st Serve %', p1Val: s(p1Ids, p => p.serve.firstServeIn), p1Total: s(p1Ids, p => p.serve.firstServeAttempted), p2Val: s(p2Ids, p => p.serve.firstServeIn), p2Total: s(p2Ids, p => p.serve.firstServeAttempted), isPercent: true },
    { label: '1st Serve Points Won', p1Val: s(p1Ids, p => p.serve.firstServePointsWon), p1Total: s(p1Ids, p => p.serve.firstServePointsPlayed), p2Val: s(p2Ids, p => p.serve.firstServePointsWon), p2Total: s(p2Ids, p => p.serve.firstServePointsPlayed), isPercent: true },
    { label: '2nd Serve Points Won', p1Val: s(p1Ids, p => p.serve.secondServePointsWon), p1Total: s(p1Ids, p => p.serve.secondServePointsPlayed), p2Val: s(p2Ids, p => p.serve.secondServePointsWon), p2Total: s(p2Ids, p => p.serve.secondServePointsPlayed), isPercent: true },
    { label: 'Break Points Won', p1Val: s(p1Ids, p => p.return.breakPointsConverted), p1Total: s(p1Ids, p => p.return.breakPointOpportunities), p2Val: s(p2Ids, p => p.return.breakPointsConverted), p2Total: s(p2Ids, p => p.return.breakPointOpportunities), isPercent: true },
    { label: 'Net Points Won', p1Val: s(p1Ids, p => p.rally.netPointsWon), p1Total: s(p1Ids, p => p.rally.netPointsAttempted), p2Val: s(p2Ids, p => p.rally.netPointsWon), p2Total: s(p2Ids, p => p.rally.netPointsAttempted), isPercent: true },
    { label: 'Winners', p1Val: s(p1Ids, p => p.rally.winners), p1Total: 0, p2Val: s(p2Ids, p => p.rally.winners), p2Total: 0, isPercent: false },
    { label: 'Unforced Errors', p1Val: s(p1Ids, p => p.rally.unforcedErrors), p1Total: 0, p2Val: s(p2Ids, p => p.rally.unforcedErrors), p2Total: 0, isPercent: false },
    { label: 'Total Points Won', p1Val: s(p1Ids, p => p.individualMatch.pointsWon), p1Total: 0, p2Val: s(p2Ids, p => p.individualMatch.pointsWon), p2Total: 0, isPercent: false },
  ];

  const setStreaks = useMemo(() => computeSetStreaks(stats.sets, p1Ids, p2Ids), [stats.sets, p1Ids, p2Ids]);

  const allStatsCategories = useMemo((): Record<string, StatRow[]> => {
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
  }, [match, stats]);

  return (
    <View>
      <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Live Statistics</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: P1_COLOR }} />
          <Text style={{ color: P1_COLOR, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{p1Name}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: P2_COLOR, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{p2Name}</Text>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: P2_COLOR }} />
        </View>
      </View>
      {rows.map((row) => <StatBar key={row.label} row={row} />)}

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

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: P1_COLOR }} />
              <Text style={{ color: P1_COLOR, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{p1Name}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: P2_COLOR, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{p2Name}</Text>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: P2_COLOR }} />
            </View>
          </View>

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
              <StatBar key={row.label} row={row} />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

export default LiveStats;

