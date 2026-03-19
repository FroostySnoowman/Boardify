import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Match, Stats, PlayerStats } from '../../../api/matches';
import { getPlayerDisplayName } from '../utils/matchUtils';
import AllStatsDisplay from './AllStatsDisplay';
import { CustomStatCounters } from '../BasicModeTracker';
import { isGuestMatch } from '../../../utils/guestMatchStorage';
import { Feather } from '@expo/vector-icons';

const P1_COLOR = '#60a5fa';
const P2_COLOR = '#e2e8f0';
const BAR_BG = 'rgba(255,255,255,0.06)';

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

interface MatchEndStatsProps {
  match: Match;
  stats: Stats;
  displayDuration: string;
  customStatTotals?: CustomStatCounters;
}

const getCustomStatsFromSource = (source: any): string[] => {
  if (!source) return [];

  let raw: any =
    source.customStats ??
    source.custom_stats ??
    source.custom_stats_config ??
    null;

  if (!raw) return [];

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      raw = parsed;
    } catch {
      raw = trimmed
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
  }

  if (Array.isArray(raw)) {
    return raw
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          if (typeof item.label === 'string') return item.label;
          if (typeof item.name === 'string') return item.name;
        }
        return null;
      })
      .filter((s: any) => typeof s === 'string' && s.trim().length > 0) as string[];
  }

  if (typeof raw === 'object') {
    return Object.values(raw)
      .map(v => (typeof v === 'string' ? v : null))
      .filter((s: any) => typeof s === 'string' && s.trim().length > 0) as string[];
  }

  return [];
};

const MatchEndStats = ({
  match,
  stats,
  displayDuration,
  customStatTotals = {},
}: MatchEndStatsProps) => {
  const p1Ids = [match.yourPlayer1, match.yourPlayer2].filter(
    (p): p is string => !!p
  );
  const p2Ids = [match.oppPlayer1, match.oppPlayer2].filter(
    (p): p is string => !!p
  );
  const isDoubles = p1Ids.length > 1;

  const getTeamStat = (ids: string[], accessor: (playerStats: PlayerStats) => number) =>
    ids.reduce((sum, id) => {
      const playerStats = stats.players[id];
      return sum + (playerStats ? accessor(playerStats) : 0);
    }, 0);

  const p1Name = p1Ids.map(name => getPlayerDisplayName(name, isDoubles)).join('/');
  const p2Name = p2Ids.map(name => getPlayerDisplayName(name, isDoubles)).join('/');

  if (match.statMode === 'basic') {
    const customStats = getCustomStatsFromSource(match);

    if (customStats.length === 0) {
      return null;
    }

    const isGuest = isGuestMatch(match.id);

    const customRows: StatRow[] = customStats.map(statName => {
      const p1V = p1Ids.reduce((sum, id) => sum + (customStatTotals[id]?.[statName] || 0), 0);
      const p2V = p2Ids.reduce((sum, id) => sum + (customStatTotals[id]?.[statName] || 0), 0);
      return { label: statName, p1Val: p1V, p1Total: 0, p2Val: p2V, p2Total: 0, isPercent: false };
    });

    return (
      <View
        className="p-6 rounded-2xl bg-white/5 border border-white/10"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>
          Final Match Stats
        </Text>
        <Text style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, marginBottom: 16 }}>
          Match Time: {displayDuration}
        </Text>

        {isGuest && (
          <View className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex-row items-center gap-2">
            <Feather name="alert-triangle" size={16} color="#f59e0b" />
            <Text className="text-amber-400 text-sm flex-1">
              This match was not saved. All data will be lost when you close the app.
            </Text>
          </View>
        )}

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

        {customRows.length > 0 ? (
          customRows.map((row) => <StatBar key={row.label} row={row} />)
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={{ color: '#9ca3af', fontSize: 14 }}>
              No custom stats were tracked during this match
            </Text>
          </View>
        )}
      </View>
    );
  }

  const rows: StatRow[] = [
    { label: 'Aces', p1Val: getTeamStat(p1Ids, p => p.serve.aces), p1Total: 0, p2Val: getTeamStat(p2Ids, p => p.serve.aces), p2Total: 0, isPercent: false },
    { label: 'Double Faults', p1Val: getTeamStat(p1Ids, p => p.serve.doubleFaults), p1Total: 0, p2Val: getTeamStat(p2Ids, p => p.serve.doubleFaults), p2Total: 0, isPercent: false },
    { label: '1st Serve %', p1Val: getTeamStat(p1Ids, p => p.serve.firstServeIn), p1Total: getTeamStat(p1Ids, p => p.serve.firstServeAttempted), p2Val: getTeamStat(p2Ids, p => p.serve.firstServeIn), p2Total: getTeamStat(p2Ids, p => p.serve.firstServeAttempted), isPercent: true },
    { label: 'Winners', p1Val: getTeamStat(p1Ids, p => p.rally.winners), p1Total: 0, p2Val: getTeamStat(p2Ids, p => p.rally.winners), p2Total: 0, isPercent: false },
    { label: 'Unforced Errors', p1Val: getTeamStat(p1Ids, p => p.rally.unforcedErrors), p1Total: 0, p2Val: getTeamStat(p2Ids, p => p.rally.unforcedErrors), p2Total: 0, isPercent: false },
    { label: 'Break Points Won', p1Val: getTeamStat(p1Ids, p => p.return.breakPointsConverted), p1Total: getTeamStat(p1Ids, p => p.return.breakPointOpportunities), p2Val: getTeamStat(p2Ids, p => p.return.breakPointsConverted), p2Total: getTeamStat(p2Ids, p => p.return.breakPointOpportunities), isPercent: true },
    { label: 'Net Points Won', p1Val: getTeamStat(p1Ids, p => p.rally.netPointsWon), p1Total: getTeamStat(p1Ids, p => p.rally.netPointsAttempted), p2Val: getTeamStat(p2Ids, p => p.rally.netPointsWon), p2Total: getTeamStat(p2Ids, p => p.rally.netPointsAttempted), isPercent: true },
    { label: 'Total Points Won', p1Val: getTeamStat(p1Ids, p => p.individualMatch.pointsWon), p1Total: stats.matchTotals.pointsPlayed, p2Val: getTeamStat(p2Ids, p => p.individualMatch.pointsWon), p2Total: stats.matchTotals.pointsPlayed, isPercent: true },
  ];

  const isGuest = isGuestMatch(match.id);

  return (
    <View
      className="p-6 rounded-2xl bg-white/5 border border-white/10"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
      }}
    >
      <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 4 }}>
        Final Match Stats
      </Text>
      <Text style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, marginBottom: 16 }}>
        Match Time: {displayDuration}
      </Text>

      {isGuest && (
        <View className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex-row items-center gap-2">
          <Feather name="alert-triangle" size={16} color="#f59e0b" />
          <Text className="text-amber-400 text-sm flex-1">
            This match was not saved. All data will be lost when you close the app.
          </Text>
        </View>
      )}

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

      {match.statMode === 'advanced' && (
        <View style={{ marginTop: 8 }}>
          <AllStatsDisplay stats={stats} match={match} />
        </View>
      )}
    </View>
  );
};

export default MatchEndStats;

