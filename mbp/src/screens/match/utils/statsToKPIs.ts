import type { Match, Stats, PlayerStats } from '../../../api/matches';
import { formatPercent } from './matchUtils';

export interface MatchKPI {
  aces: number;
  doubleFaults: number;
  winners: number;
  unforcedErrors: number;
  firstServePercent: string;
  firstServeWonPercent: string;
  secondServeWonPercent: string;
  returnPointsWonPercent: string;
  breakPointsConvertedPercent: string;
  breakPointsSavedPercent: string;
  firstServeIn: number;
  firstServeAttempted: number;
  firstServePointsWon: number;
  firstServePointsPlayed: number;
  secondServePointsWon: number;
  secondServePointsPlayed: number;
  returnPointsWon: number;
  returnPointsPlayed: number;
  breakPointsConverted: number;
  breakPointOpportunities: number;
  breakPointsSaved: number;
  breakPointsFaced: number;
  wonMatch: boolean;
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

/**
 * Derive "your team" KPIs from one match's Stats for display and comparison.
 */
export function statsToMatchKPIs(match: Match, stats: Stats): MatchKPI {
  const yourIds = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);

  const aces = sumStat(stats, yourIds, p => p.serve.aces);
  const doubleFaults = sumStat(stats, yourIds, p => p.serve.doubleFaults);
  const winners = sumStat(stats, yourIds, p => p.rally.winners);
  const unforcedErrors = sumStat(stats, yourIds, p => p.rally.unforcedErrors)
    + sumStat(stats, yourIds, p => p.return.returnUnforcedErrors);

  const firstServeIn = sumStat(stats, yourIds, p => p.serve.firstServeIn);
  const firstServeAttempted = sumStat(stats, yourIds, p => p.serve.firstServeAttempted);
  const firstServePointsWon = sumStat(stats, yourIds, p => p.serve.firstServePointsWon);
  const firstServePointsPlayed = sumStat(stats, yourIds, p => p.serve.firstServePointsPlayed);
  const secondServePointsWon = sumStat(stats, yourIds, p => p.serve.secondServePointsWon);
  const secondServePointsPlayed = sumStat(stats, yourIds, p => p.serve.secondServePointsPlayed);

  const returnPointsWon = sumStat(stats, yourIds, p => p.return.returnPointsWon);
  const returnPointsPlayed = sumStat(stats, yourIds, p => p.return.returnPointsPlayed);
  const breakPointsConverted = sumStat(stats, yourIds, p => p.return.breakPointsConverted);
  const breakPointOpportunities = sumStat(stats, yourIds, p => p.return.breakPointOpportunities);
  const breakPointsSaved = sumStat(stats, yourIds, p => p.serve.breakPointsSaved);
  const breakPointsFaced = sumStat(stats, yourIds, p => p.serve.breakPointsFaced);

  const yourTeamIds = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
  const wonMatch = !!stats.matchWinner && yourTeamIds.includes(stats.matchWinner);

  return {
    aces,
    doubleFaults,
    winners,
    unforcedErrors,
    firstServePercent: formatPercent(firstServeIn, firstServeAttempted),
    firstServeWonPercent: formatPercent(firstServePointsWon, firstServePointsPlayed),
    secondServeWonPercent: formatPercent(secondServePointsWon, secondServePointsPlayed),
    returnPointsWonPercent: formatPercent(returnPointsWon, returnPointsPlayed),
    breakPointsConvertedPercent: formatPercent(breakPointsConverted, breakPointOpportunities),
    breakPointsSavedPercent: formatPercent(breakPointsSaved, breakPointsFaced),
    firstServeIn,
    firstServeAttempted,
    firstServePointsWon,
    firstServePointsPlayed,
    secondServePointsWon,
    secondServePointsPlayed,
    returnPointsWon,
    returnPointsPlayed,
    breakPointsConverted,
    breakPointOpportunities,
    breakPointsSaved,
    breakPointsFaced,
    wonMatch,
  };
}
