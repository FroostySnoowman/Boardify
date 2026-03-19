import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Match, Stats, PlayerStats } from '../../../api/matches';
import { getPlayerDisplayName, hapticImpactLight, computeSetStreaks } from '../utils/matchUtils';

const P1_COLOR = '#60a5fa';
const P2_COLOR = '#e2e8f0';
const BAR_BG = 'rgba(255,255,255,0.06)';

type BarRow = { label: string; p1Val: number; p1Total: number; p2Val: number; p2Total: number; isPercent: boolean };

const StatBar = ({ row }: { row: BarRow }) => {
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
    <View style={{ marginBottom: 14 }}>
      <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', textAlign: 'center', marginBottom: 5, letterSpacing: 0.3 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 20 }}>
        <Text style={{ color: P1_COLOR, fontSize: 12, fontWeight: '700', width: 40, textAlign: 'right', marginRight: 5 }}>{p1Display}</Text>
        <View style={{ flex: 1, flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: BAR_BG }}>
          <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end' }}>
            <View style={{ width: `${Math.min(p1Pct, 100)}%`, backgroundColor: P1_COLOR, borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }} />
          </View>
          <View style={{ width: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} />
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={{ width: `${Math.min(p2Pct, 100)}%`, backgroundColor: P2_COLOR, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
          </View>
        </View>
        <Text style={{ color: P2_COLOR, fontSize: 12, fontWeight: '700', width: 40, textAlign: 'left', marginLeft: 5 }}>{p2Display}</Text>
      </View>
    </View>
  );
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
  const setStreaks = computeSetStreaks(stats.sets, p1Ids, p2Ids);

  const getStat = (ids: string | string[], accessor: (s: PlayerStats) => number) => {
    const playerIds = Array.isArray(ids) ? ids : [ids];
    return playerIds.reduce((sum, id) => {
      const playerStats = stats.players[id];
      return sum + (playerStats ? accessor(playerStats) : 0);
    }, 0);
  };

  const getMaxStat = (ids: string | string[], accessor: (s: PlayerStats) => number) => {
    const playerIds = Array.isArray(ids) ? ids : [ids];
    return Math.max(
      0,
      ...playerIds.map(id => {
        const playerStats = stats.players[id];
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

  const allStatsData: Record<string, BarRow[]> = {
    Serve: [
      { label: 'Service Points Won', p1Val: getStat(p1IdOrTeam, p => p.serve.servicePointsWon), p1Total: getStat(p1IdOrTeam, p => p.serve.servicePointsPlayed), p2Val: getStat(p2IdOrTeam, p => p.serve.servicePointsWon), p2Total: getStat(p2IdOrTeam, p => p.serve.servicePointsPlayed), isPercent: true },
      { label: 'Aces', p1Val: getStat(p1IdOrTeam, p => p.serve.aces), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => p.serve.aces), p2Total: 0, isPercent: false },
      { label: 'Double Faults', p1Val: getStat(p1IdOrTeam, p => p.serve.doubleFaults), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => p.serve.doubleFaults), p2Total: 0, isPercent: false },
      { label: '1st Serves', p1Val: getStat(p1IdOrTeam, p => p.serve.firstServeIn), p1Total: getStat(p1IdOrTeam, p => p.serve.firstServeAttempted), p2Val: getStat(p2IdOrTeam, p => p.serve.firstServeIn), p2Total: getStat(p2IdOrTeam, p => p.serve.firstServeAttempted), isPercent: true },
      { label: '1st Serve Points Won', p1Val: getStat(p1IdOrTeam, p => p.serve.firstServePointsWon), p1Total: getStat(p1IdOrTeam, p => p.serve.firstServePointsPlayed), p2Val: getStat(p2IdOrTeam, p => p.serve.firstServePointsWon), p2Total: getStat(p2IdOrTeam, p => p.serve.firstServePointsPlayed), isPercent: true },
      { label: '2nd Serves', p1Val: getStat(p1IdOrTeam, p => p.serve.secondServeIn), p1Total: getStat(p1IdOrTeam, p => p.serve.secondServeAttempted), p2Val: getStat(p2IdOrTeam, p => p.serve.secondServeIn), p2Total: getStat(p2IdOrTeam, p => p.serve.secondServeAttempted), isPercent: true },
      { label: '2nd Serve Points Won', p1Val: getStat(p1IdOrTeam, p => p.serve.secondServePointsWon), p1Total: getStat(p1IdOrTeam, p => p.serve.secondServePointsPlayed), p2Val: getStat(p2IdOrTeam, p => p.serve.secondServePointsWon), p2Total: getStat(p2IdOrTeam, p => p.serve.secondServePointsPlayed), isPercent: true },
      { label: 'Break Points Saved', p1Val: getStat(p1IdOrTeam, p => p.serve.breakPointsSaved), p1Total: getStat(p1IdOrTeam, p => p.serve.breakPointsFaced), p2Val: getStat(p2IdOrTeam, p => p.serve.breakPointsSaved), p2Total: getStat(p2IdOrTeam, p => p.serve.breakPointsFaced), isPercent: true },
      { label: 'Unreturned Serves', p1Val: getStat(p1IdOrTeam, p => p.serve.servesUnreturned), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => p.serve.servesUnreturned), p2Total: 0, isPercent: false },
    ],
    Return: [
      { label: 'Return Points Won', p1Val: getStat(p1IdOrTeam, p => p.return.returnPointsWon), p1Total: getStat(p1IdOrTeam, p => p.return.returnPointsPlayed), p2Val: getStat(p2IdOrTeam, p => p.return.returnPointsWon), p2Total: getStat(p2IdOrTeam, p => p.return.returnPointsPlayed), isPercent: true },
      { label: '1st Serve Returns', p1Val: getStat(p1IdOrTeam, p => p.return.firstServeReturnMade), p1Total: getStat(p1IdOrTeam, p => p.return.firstServeReturnAttempted), p2Val: getStat(p2IdOrTeam, p => p.return.firstServeReturnMade), p2Total: getStat(p2IdOrTeam, p => p.return.firstServeReturnAttempted), isPercent: true },
      { label: '1st Serve Return Points Won', p1Val: getStat(p1IdOrTeam, p => p.return.firstServeReturnPointsWon), p1Total: getStat(p1IdOrTeam, p => p.return.firstServeReturnPointsPlayed), p2Val: getStat(p2IdOrTeam, p => p.return.firstServeReturnPointsWon), p2Total: getStat(p2IdOrTeam, p => p.return.firstServeReturnPointsPlayed), isPercent: true },
      { label: '2nd Serve Returns', p1Val: getStat(p1IdOrTeam, p => p.return.secondServeReturnMade), p1Total: getStat(p1IdOrTeam, p => p.return.secondServeReturnAttempted), p2Val: getStat(p2IdOrTeam, p => p.return.secondServeReturnMade), p2Total: getStat(p2IdOrTeam, p => p.return.secondServeReturnAttempted), isPercent: true },
      { label: '2nd Serve Return Points Won', p1Val: getStat(p1IdOrTeam, p => p.return.secondServeReturnPointsWon), p1Total: getStat(p1IdOrTeam, p => p.return.secondServeReturnPointsPlayed), p2Val: getStat(p2IdOrTeam, p => p.return.secondServeReturnPointsWon), p2Total: getStat(p2IdOrTeam, p => p.return.secondServeReturnPointsPlayed), isPercent: true },
      { label: 'Return Unforced Errors', p1Val: getStat(p1IdOrTeam, p => p.return.returnUnforcedErrors), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => p.return.returnUnforcedErrors), p2Total: 0, isPercent: false },
      { label: 'Return Forced Errors', p1Val: getStat(p1IdOrTeam, p => p.return.returnForcedErrors), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => p.return.returnForcedErrors), p2Total: 0, isPercent: false },
      { label: 'Break Points Won', p1Val: getStat(p1IdOrTeam, p => p.return.breakPointsConverted), p1Total: getStat(p1IdOrTeam, p => p.return.breakPointOpportunities), p2Val: getStat(p2IdOrTeam, p => p.return.breakPointsConverted), p2Total: getStat(p2IdOrTeam, p => p.return.breakPointOpportunities), isPercent: true },
    ],
    Rally: [
      { label: 'Winners', p1Val: getStat(p1IdOrTeam, p => p.rally.winners), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => p.rally.winners), p2Total: 0, isPercent: false },
      { label: 'Unforced Errors', p1Val: getStat(p1IdOrTeam, p => p.rally.unforcedErrors), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => p.rally.unforcedErrors), p2Total: 0, isPercent: false },
      { label: 'Forced Errors', p1Val: getStat(p1IdOrTeam, p => p.rally.forcedErrors), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => p.rally.forcedErrors), p2Total: 0, isPercent: false },
      { label: 'Net Points Won', p1Val: getStat(p1IdOrTeam, p => p.rally.netPointsWon), p1Total: getStat(p1IdOrTeam, p => p.rally.netPointsAttempted), p2Val: getStat(p2IdOrTeam, p => p.rally.netPointsWon), p2Total: getStat(p2IdOrTeam, p => p.rally.netPointsAttempted), isPercent: true },
      { label: 'Longest Rally', p1Val: getMaxStat(p1IdOrTeam, p => p.rally.longestRallyLength), p1Total: 0, p2Val: getMaxStat(p2IdOrTeam, p => p.rally.longestRallyLength), p2Total: 0, isPercent: false },
    ],
    Other: [
      { label: 'Lets', p1Val: getStat(p1IdOrTeam, p => (p as any).other?.lets ?? 0), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => (p as any).other?.lets ?? 0), p2Total: 0, isPercent: false },
      { label: 'Foot Faults', p1Val: getStat(p1IdOrTeam, p => (p as any).other?.footFaults ?? 0), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => (p as any).other?.footFaults ?? 0), p2Total: 0, isPercent: false },
      { label: 'Net Touches', p1Val: getStat(p1IdOrTeam, p => (p as any).other?.touchingNet ?? 0), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => (p as any).other?.touchingNet ?? 0), p2Total: 0, isPercent: false },
      { label: 'Ball Hits Body', p1Val: getStat(p1IdOrTeam, p => (p as any).other?.ballHitsBody ?? 0), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => (p as any).other?.ballHitsBody ?? 0), p2Total: 0, isPercent: false },
      { label: 'Carries/Double Hits', p1Val: getStat(p1IdOrTeam, p => (p as any).other?.carry ?? 0), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => (p as any).other?.carry ?? 0), p2Total: 0, isPercent: false },
      { label: 'Fixture Hits', p1Val: getStat(p1IdOrTeam, p => (p as any).other?.hitsFixture ?? 0), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => (p as any).other?.hitsFixture ?? 0), p2Total: 0, isPercent: false },
      { label: 'Racquet Drops', p1Val: getStat(p1IdOrTeam, p => (p as any).other?.racquetDropped ?? 0), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => (p as any).other?.racquetDropped ?? 0), p2Total: 0, isPercent: false },
      { label: 'Reach Over Net', p1Val: getStat(p1IdOrTeam, p => (p as any).other?.reachOverNet ?? 0), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => (p as any).other?.reachOverNet ?? 0), p2Total: 0, isPercent: false },
      { label: 'Penalties', p1Val: getStat(p1IdOrTeam, p => (p as any).other?.penalties ?? 0), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => (p as any).other?.penalties ?? 0), p2Total: 0, isPercent: false },
    ],
    Overall: [
      { label: 'Total Points Won', p1Val: getStat(p1IdOrTeam, p => p.individualMatch.pointsWon), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => p.individualMatch.pointsWon), p2Total: 0, isPercent: false },
      { label: 'Service Games Won', p1Val: getStat(p1IdOrTeam, p => p.individualMatch.serviceGamesWon), p1Total: getStat(p1IdOrTeam, p => p.individualMatch.serviceGamesPlayed), p2Val: getStat(p2IdOrTeam, p => p.individualMatch.serviceGamesWon), p2Total: getStat(p2IdOrTeam, p => p.individualMatch.serviceGamesPlayed), isPercent: true },
      { label: 'Return Games Won', p1Val: getStat(p1IdOrTeam, p => p.individualMatch.returnGamesWon), p1Total: getStat(p1IdOrTeam, p => p.individualMatch.returnGamesPlayed), p2Val: getStat(p2IdOrTeam, p => p.individualMatch.returnGamesWon), p2Total: getStat(p2IdOrTeam, p => p.individualMatch.returnGamesPlayed), isPercent: true },
      { label: 'Love Games Won', p1Val: getStat(p1IdOrTeam, p => p.individualMatch.loveGamesWon), p1Total: 0, p2Val: getStat(p2IdOrTeam, p => p.individualMatch.loveGamesWon), p2Total: 0, isPercent: false },
      { label: 'Game Points on Serve', p1Val: getStat(p1IdOrTeam, p => p.individualMatch.gamePointsWonOnServe), p1Total: getStat(p1IdOrTeam, p => p.individualMatch.gamePointsOpportunityOnServe), p2Val: getStat(p2IdOrTeam, p => p.individualMatch.gamePointsWonOnServe), p2Total: getStat(p2IdOrTeam, p => p.individualMatch.gamePointsOpportunityOnServe), isPercent: true },
      { label: 'Winner / UE Ratio', p1Val: (() => { const w = getStat(p1IdOrTeam, p => p.rally.winners); const ue = getStat(p1IdOrTeam, p => p.rally.unforcedErrors); return ue > 0 ? parseFloat((w / ue).toFixed(2)) : 0; })(), p1Total: 0, p2Val: (() => { const w = getStat(p2IdOrTeam, p => p.rally.winners); const ue = getStat(p2IdOrTeam, p => p.rally.unforcedErrors); return ue > 0 ? parseFloat((w / ue).toFixed(2)) : 0; })(), p2Total: 0, isPercent: false },
      { label: 'Dominance Ratio', p1Val: (() => { const rp = getStat(p1IdOrTeam, p => p.return.returnPointsWon); const srvLost = getStat(p2IdOrTeam, p => p.serve.servicePointsPlayed) - getStat(p2IdOrTeam, p => p.serve.servicePointsWon); return srvLost > 0 ? parseFloat((rp / srvLost).toFixed(2)) : 0; })(), p1Total: 0, p2Val: (() => { const rp = getStat(p2IdOrTeam, p => p.return.returnPointsWon); const srvLost = getStat(p1IdOrTeam, p => p.serve.servicePointsPlayed) - getStat(p1IdOrTeam, p => p.serve.servicePointsWon); return srvLost > 0 ? parseFloat((rp / srvLost).toFixed(2)) : 0; })(), p2Total: 0, isPercent: false },
      { label: 'Longest Point Streak', p1Val: getMaxStat(p1IdOrTeam, p => p.individualMatch.longestPointStreak), p1Total: 0, p2Val: getMaxStat(p2IdOrTeam, p => p.individualMatch.longestPointStreak), p2Total: 0, isPercent: false },
      { label: 'Longest Game Streak', p1Val: getMaxStat(p1IdOrTeam, p => p.individualMatch.longestGameStreak), p1Total: 0, p2Val: getMaxStat(p2IdOrTeam, p => p.individualMatch.longestGameStreak), p2Total: 0, isPercent: false },
      { label: 'Longest Set Streak', p1Val: setStreaks.p1, p1Total: 0, p2Val: setStreaks.p2, p2Total: 0, isPercent: false },
    ],
  };

  const PlayerButton = ({ id, side }: { id: string; side: 'p1' | 'p2' }) => {
    const isSelected = selectedPlayers[side] === id;
    return (
      <TouchableOpacity
        onPress={() => {
          hapticImpactLight();
          setSelectedPlayers(s => ({ ...s, [side]: id }));
        }}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: isSelected ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
        }}
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 12, fontWeight: '600', color: isSelected ? '#ffffff' : '#d1d5db' }}>
          {id === 'team' ? 'Team' : getPlayerDisplayName(id, true)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={{ marginTop: 16 }} showsVerticalScrollIndicator={false}>
      {isDoubles && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PlayerButton id="team" side="p1" />
            {p1Ids.map(id => (
              <PlayerButton key={id} id={id} side="p1" />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {p2Ids.map(id => (
              <PlayerButton key={id} id={id} side="p2" />
            ))}
            <PlayerButton id="team" side="p2" />
          </View>
        </View>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingBottom: 8, borderTopWidth: 2, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: P1_COLOR }} />
          <Text style={{ color: P1_COLOR, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>{p1Header}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: P2_COLOR, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>{p2Header}</Text>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: P2_COLOR }} />
        </View>
      </View>
      {Object.entries(allStatsData).map(([category, statsList]) => (
        <View key={category} style={{ marginBottom: 12 }}>
          <Text style={{ color: '#ffffff', fontWeight: '700', textAlign: 'center', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            {category} Stats
          </Text>
          <View style={{ marginTop: 10 }}>
            {statsList.map((row) => (
              <StatBar key={row.label} row={row} />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

export default AllStatsDisplay;

