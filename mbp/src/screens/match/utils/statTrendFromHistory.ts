import type { Match, Stats, PointEvent } from '../../../api/matches';
import { applyHistory } from '../../../utils/matchHelper';
import type { MatchSettings } from '../../../utils/matchHelper';
import { getStatDefinition, getYourPlayerIds } from './statDefinitions';

function buildSettingsFromMatch(match: Match): MatchSettings {
  return {
    yourPlayer1: match.yourPlayer1,
    yourPlayer2: match.yourPlayer2 ?? null,
    oppPlayer1: match.oppPlayer1,
    oppPlayer2: match.oppPlayer2 ?? null,
    scoring_type: match.scoringType,
    tiebreak: match.tiebreak,
    games_to: match.gamesTo,
    best_of: match.bestOf,
    format: match.format,
    server: match.server ?? null,
    matchType: match.matchType,
    tiebreak_trigger: match.tiebreakTrigger ?? null,
  };
}

function getSetEndPointIndices(
  history: PointEvent[],
  matchId: string,
  settings: MatchSettings
): number[] {
  const endIndices: number[] = [];
  let previousSetsLength = 0;

  for (let i = 0; i < history.length; i++) {
    const partialHistory = history.slice(0, i + 1);
    const stats = applyHistory(matchId, partialHistory, settings);
    const currentSetsLength = stats.sets?.length ?? 0;
    if (currentSetsLength > previousSetsLength) {
      endIndices.push(i);
      previousSetsLength = currentSetsLength;
    }
  }

  return endIndices;
}

export interface StatTrendPoint {
  setIndex: number;
  value: number;
  setNumber: number;
}

export function getStatTrendBySet(
  match: Match,
  stats: Stats,
  statId: string
): StatTrendPoint[] {
  const history = stats.history ?? [];
  if (history.length === 0) return [];

  const def = getStatDefinition(statId);
  if (!def) return [];

  const settings = buildSettingsFromMatch(match);
  const yourIds = getYourPlayerIds(match);
  const setEndIndices = getSetEndPointIndices(history, match.id, settings);

  if (setEndIndices.length === 0) return [];

  const points: StatTrendPoint[] = [];
  for (let i = 0; i < setEndIndices.length; i++) {
    const endIdx = setEndIndices[i];
    const partialHistory = history.slice(0, endIdx + 1);
    const statsAtSet = applyHistory(match.id, partialHistory, settings);
    const value = def.resolve(statsAtSet, yourIds);
    points.push({ setIndex: i, setNumber: i + 1, value });
  }

  return points;
}

export function canShowStatTrend(stats: Stats): boolean {
  const setsCount = stats.sets?.length ?? 0;
  return setsCount >= 1 && (stats.history?.length ?? 0) > 0;
}
