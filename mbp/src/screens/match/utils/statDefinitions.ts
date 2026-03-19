import type { Match, Stats, PlayerStats } from '../../../api/matches';

export type StatCategory = 'Overview' | 'Serve' | 'Return' | 'Rally' | 'Other' | 'Overall';

export interface StatDefinition {
  id: string;
  label: string;
  category: StatCategory;
  resolve: (stats: Stats, yourPlayerIds: string[]) => number;
  format: 'number' | 'percent';
}

function sumStat(
  stats: Stats,
  playerIds: string[],
  accessor: (p: PlayerStats) => number
): number {
  return playerIds.reduce((sum, id) => {
    const p = stats.players[id];
    return sum + (p ? accessor(p) : 0);
  }, 0);
}

function safePercent(num: number, den: number): number {
  return den > 0 ? (num / den) * 100 : 0;
}

export const CHARTABLE_STAT_DEFINITIONS: StatDefinition[] = [
  {
    id: 'aces',
    label: 'Aces',
    category: 'Serve',
    format: 'number',
    resolve: (stats, ids) => sumStat(stats, ids, p => p.serve.aces),
  },
  {
    id: 'doubleFaults',
    label: 'Double Faults',
    category: 'Serve',
    format: 'number',
    resolve: (stats, ids) => sumStat(stats, ids, p => p.serve.doubleFaults),
  },
  {
    id: 'firstServePercent',
    label: '1st Serve %',
    category: 'Serve',
    format: 'percent',
    resolve: (stats, ids) => {
      const in_ = sumStat(stats, ids, p => p.serve.firstServeIn);
      const attempted = sumStat(stats, ids, p => p.serve.firstServeAttempted);
      return safePercent(in_, attempted);
    },
  },
  {
    id: 'firstServeWonPercent',
    label: '1st Srv Pts Won %',
    category: 'Serve',
    format: 'percent',
    resolve: (stats, ids) => {
      const won = sumStat(stats, ids, p => p.serve.firstServePointsWon);
      const played = sumStat(stats, ids, p => p.serve.firstServePointsPlayed);
      return safePercent(won, played);
    },
  },
  {
    id: 'secondServeWonPercent',
    label: '2nd Srv Pts Won %',
    category: 'Serve',
    format: 'percent',
    resolve: (stats, ids) => {
      const won = sumStat(stats, ids, p => p.serve.secondServePointsWon);
      const played = sumStat(stats, ids, p => p.serve.secondServePointsPlayed);
      return safePercent(won, played);
    },
  },
  {
    id: 'breakPointsSavedPercent',
    label: 'Break Pts Saved %',
    category: 'Serve',
    format: 'percent',
    resolve: (stats, ids) => {
      const saved = sumStat(stats, ids, p => p.serve.breakPointsSaved);
      const faced = sumStat(stats, ids, p => p.serve.breakPointsFaced);
      return safePercent(saved, faced);
    },
  },
  {
    id: 'returnPointsWonPercent',
    label: 'Return Pts Won %',
    category: 'Return',
    format: 'percent',
    resolve: (stats, ids) => {
      const won = sumStat(stats, ids, p => p.return.returnPointsWon);
      const played = sumStat(stats, ids, p => p.return.returnPointsPlayed);
      return safePercent(won, played);
    },
  },
  {
    id: 'breakPointsConvertedPercent',
    label: 'Break Pts Won %',
    category: 'Return',
    format: 'percent',
    resolve: (stats, ids) => {
      const converted = sumStat(stats, ids, p => p.return.breakPointsConverted);
      const opportunities = sumStat(stats, ids, p => p.return.breakPointOpportunities);
      return safePercent(converted, opportunities);
    },
  },
  {
    id: 'winners',
    label: 'Winners',
    category: 'Rally',
    format: 'number',
    resolve: (stats, ids) => sumStat(stats, ids, p => p.rally.winners),
  },
  {
    id: 'unforcedErrors',
    label: 'Unforced Errors',
    category: 'Rally',
    format: 'number',
    resolve: (stats, ids) =>
      sumStat(stats, ids, p => p.rally.unforcedErrors) +
      sumStat(stats, ids, p => p.return.returnUnforcedErrors),
  },
  {
    id: 'netPointsWonPercent',
    label: 'Net Pts Won %',
    category: 'Rally',
    format: 'percent',
    resolve: (stats, ids) => {
      const won = sumStat(stats, ids, p => p.rally.netPointsWon);
      const attempted = sumStat(stats, ids, p => p.rally.netPointsAttempted);
      return safePercent(won, attempted);
    },
  },
  {
    id: 'longestRally',
    label: 'Longest Rally',
    category: 'Rally',
    format: 'number',
    resolve: (stats, ids) =>
      Math.max(0, ...ids.map(id => stats.players[id]?.rally.longestRallyLength ?? 0)),
  },
  {
    id: 'pointsWon',
    label: 'Points Won',
    category: 'Overall',
    format: 'number',
    resolve: (stats, ids) => sumStat(stats, ids, p => p.individualMatch.pointsWon),
  },
  {
    id: 'pointsWonPercent',
    label: 'Points Won %',
    category: 'Overall',
    format: 'percent',
    resolve: (stats, ids) => {
      const won = sumStat(stats, ids, p => p.individualMatch.pointsWon);
      const played = sumStat(stats, ids, p => p.individualMatch.pointsPlayed);
      return safePercent(won, played);
    },
  },
];

export function getStatDefinitionsByCategory(): Record<StatCategory, StatDefinition[]> {
  const byCategory: Record<StatCategory, StatDefinition[]> = {
    Overview: [],
    Serve: [],
    Return: [],
    Rally: [],
    Other: [],
    Overall: [],
  };
  for (const def of CHARTABLE_STAT_DEFINITIONS) {
    byCategory[def.category].push(def);
  }
  return byCategory;
}

export function getStatDefinition(id: string): StatDefinition | undefined {
  return CHARTABLE_STAT_DEFINITIONS.find(d => d.id === id);
}

export function getYourPlayerIds(match: Match): string[] {
  return [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
}
