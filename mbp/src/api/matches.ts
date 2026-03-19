import { nativeFetch } from './http'
import { getIsOnline } from '../network/networkState'
import { isGuestMatch, getGuestMatch, getGuestStats, updateGuestStats, clearGuestMatch, saveGuestMatch } from '../utils/guestMatchStorage'
import {
  isOfflineMatch,
  getOfflineActiveMatch,
  setOfflineActiveMatch,
  clearOfflineActiveMatch,
  addToPendingSync,
} from '../utils/offlineMatchStorage'
import {
  recordPoint,
  undoPoint as undoPointLocal,
  setServer as setServerLocal,
  MatchSettings,
  initStats,
} from '../utils/matchHelper'

export interface Match {
  id: string
  userId: string
  matchType: string
  yourPlayer1: string
  yourPlayer1Hand?: 'right' | 'left'
  yourPlayer1Backhand?: 'one-handed' | 'two-handed'
  yourPlayer2?: string
  yourPlayer2Hand?: 'right' | 'left'
  yourPlayer2Backhand?: 'one-handed' | 'two-handed'
  oppPlayer1: string
  oppPlayer1Hand?: 'right' | 'left'
  oppPlayer1Backhand?: 'one-handed' | 'two-handed'
  oppPlayer2?: string
  oppPlayer2Hand?: 'right' | 'left'
  oppPlayer2Backhand?: 'one-handed' | 'two-handed'
  server: string
  format: 'short' | 'normal' | 'pro'
  gamesTo: number
  bestOf: '1' | '3' | '5'
  tiebreak: '7-point' | '10-point' | 'None'
  scoringType: 'ad' | 'no-ad'
  returnerPicksSide: boolean
  showPlayerOptions: boolean
  showAdvanced: boolean
  tiebreakTrigger?: string
  earlySetsPoints?: string
  customEarlyPoints?: number
  finalSetPoints?: string
  customFinalPoints?: number
  matchTiebreakFinalOnly: boolean
  isPublic: boolean
  statMode?: 'basic' | 'intermediate' | 'advanced'
  customStats?: string[]
  customStatsTeams?: 'both' | 'your-team' | 'opponent-team'
  customStatsIndividual?: boolean
  trackForehandBackhand?: boolean
  startingCourtSide?: 'top' | 'bottom'
  courtStyle?: 'hard_1' | 'hard_2' | 'clay_court' | 'grass_court'
  courtSurface?: 'hard' | 'clay' | 'grass' | 'carpet'
  sideSwitchingFormat?: 'normal' | 'wtt'
  tiebreakFormat?: 'standard' | 'wtt'
  status: 'active' | 'completed'
  isPaused?: boolean
  pausedAt?: string | null
  totalPausedMs?: number
  timerStartedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface ServeStats {
  aces: number
  doubleFaults: number
  firstServeIn: number
  firstServeAttempted: number
  firstServePointsWon: number
  firstServePointsPlayed: number
  secondServeIn: number
  secondServeAttempted: number
  secondServePointsWon: number
  secondServePointsPlayed: number
  servicePointsWon: number
  servicePointsPlayed: number
  breakPointsSaved: number
  breakPointsFaced: number
  servesUnreturned: number
  tiebreakServePointsWon?: number
  tiebreakServePointsPlayed?: number
  deuceSidePointsWon?: number
  deuceSidePointsPlayed?: number
  adSidePointsWon?: number
  adSidePointsPlayed?: number
}

export interface ReturnStats {
  returnPointsWon: number
  returnPointsPlayed: number
  firstServeReturnMade: number
  firstServeReturnAttempted: number
  firstServeReturnPointsWon: number
  firstServeReturnPointsPlayed: number
  secondServeReturnMade: number
  secondServeReturnAttempted: number
  secondServeReturnPointsWon: number
  secondServeReturnPointsPlayed: number
  totalReturnMade: number
  returnForcedErrors: number
  returnUnforcedErrors: number
  returnWinners: number
  breakPointsConverted: number
  breakPointOpportunities: number
  tiebreakReturnPointsWon?: number
  tiebreakReturnPointsPlayed?: number
  deuceSidePointsWon?: number
  deuceSidePointsPlayed?: number
  adSidePointsWon?: number
  adSidePointsPlayed?: number
}

export interface RallyStats {
  winners: number
  unforcedErrors: number
  forcedErrors: number
  forcedErrorsDrawn: number
  netPointsWon: number
  netPointsAttempted: number
  longestRallyLength: number
  totalRallyLength: number
  rallyCount: number
  forehandWinners?: number
  forehandErrors?: number
  backhandWinners?: number
  backhandErrors?: number
  volleyWinners?: number
  volleyErrors?: number
  overheadWinners?: number
  overheadErrors?: number
}

export interface OtherStats {
  lets: number
  footFaults: number
  touchingNet: number
  ballHitsBody: number
  carry: number
  hitsFixture: number
  racquetDropped: number
  reachOverNet: number
  penalties: number
}

export interface IndividualMatchStats {
  pointsWon: number
  pointsPlayed: number
  serviceGamesWon: number
  serviceGamesPlayed: number
  returnGamesWon: number
  returnGamesPlayed: number
  breakPointsConverted: number
  breakPointOpportunities: number
  gamePointsWonOnServe: number
  gamePointsOpportunityOnServe: number
  gamePointsWonOnReturn: number
  gamePointsOpportunityOnReturn: number
  loveGamesWon: number
  loveGamesLost: number
  longestPointStreak: number
  longestGameStreak: number
  setPointOpportunityOnServe?: number
  setPointsWonOnServe?: number
  setPointOpportunityOnReturn?: number
  setPointsWonOnReturn?: number
  matchPointOpportunityOnServe?: number
  matchPointsWonOnServe?: number
  matchPointOpportunityOnReturn?: number
  matchPointsWonOnReturn?: number
  setPointFacedOnServe?: number
  setPointsSavedOnServe?: number
  matchPointFacedOnServe?: number
  matchPointsSavedOnServe?: number
  rallyShortWon?: number
  rallyShortPlayed?: number
  rallyMediumWon?: number
  rallyMediumPlayed?: number
  rallyLongWon?: number
  rallyLongPlayed?: number
  rallyCounterUsed?: boolean
}

export interface PlayerStats {
  serve: ServeStats
  return: ReturnStats
  rally: RallyStats
  individualMatch: IndividualMatchStats
  other: OtherStats
}

export interface MatchTotals {
  matchesPlayed: number
  matchesWon: number
  setsPlayed: number
  setsWon: number
  gamesPlayed: number
  gamesWon: number
  pointsPlayed: number
  pointsWon: number
  winners: number
  errors: number
  comebacksDown1Set: number
  comebacksDown2Sets: number
  lossesUp1Set: number
  lossesUp2Sets: number
  winsVsLefty: number
  lossesVsLefty: number
  winsVsRighty: number
  lossesVsRighty: number
}

export interface MomentumPoint {
  point: number
  streak: number
}

export interface AggregateStats {
  momentum: MomentumPoint[]
  pointsPlayedAfterHour: number
  pointsWonAfterHour: number
}

export interface CurrentGame {
  points: Record<string, number>
  serverPoints: number
  receiverPoints: number
  serverDisplay: string
  receiverDisplay: string
}

export interface CurrentSet {
  games: Record<string, number>
  tiebreak: Record<string, number> | null
}

export interface CompletedSet {
  games: Record<string, number>
  tiebreak: Record<string, number> | null
}

export interface Stats {
  matchId: number
  players: Record<string, PlayerStats>
  matchTotals: MatchTotals
  aggregate: AggregateStats
  history: PointEvent[]
  currentGame: CurrentGame
  currentSet: CurrentSet
  sets: CompletedSet[]
  matchWinner: string | null
  matchLoser: string | null
  server: string | null
  serve_order?: string[]
}

export type PointActionType =
  | 'ACE'
  | 'SECOND_SERVE_ACE'
  | 'DOUBLE FAULT'
  | 'FIRST_IN'
  | 'FIRST_SERVE_FAULT'
  | 'SECOND_IN'
  | 'WINNER'
  | 'UNFORCED ERROR'
  | 'FORCED ERROR'
  | 'RETURN_UNFORCED_ERROR'
  | 'RETURN_FORCED_ERROR'
  | 'LET'
  | 'FOOT_FAULT'
  | 'FOOT_FAULT_ERROR'
  | 'TOUCHING_NET_UE'
  | 'BALL_HITS_BODY_UE'
  | 'BALL_HITS_BODY_FE'
  | 'CARRY_UE'
  | 'CARRY_FE'
  | 'HITS_FIXTURE_UE'
  | 'HITS_FIXTURE_FE'
  | 'RACQUET_DROPPED_UE'
  | 'RACQUET_DROPPED_FE'
  | 'REACH_OVER_NET_UE'
  | 'REACH_OVER_NET_FE'
  | 'PENALTY_POINT_UE'
  | 'PENALTY_GAME_UE'
  | 'PENALTY_SET_UE'
  | 'PENALTY_MATCH_UE'

export interface PointAction {
  type: PointActionType
  actorId: string
}

export interface BallLocation {
  x: number
  y: number
  type: 'serve' | 'return' | 'rally' | 'outcome'
  playerId?: string
  strokeType?: 'forehand' | 'backhand' | 'volley' | 'overhead' | 'drop-shot' | 'lob' | 'serve' | 'return'
  isIn?: boolean
  servePlacement?: 'body' | 'wide' | 't'
  timestamp?: number
}

export interface PointEvent {
  pointWinnerId: string
  pointLoserId: string
  serverId: string
  receiverId: string
  netChoices: Record<string, boolean>
  rallyLength: number
  actions: PointAction[]
  ballLocations?: BallLocation[]
}

export interface CreateMatchPayload {
  type: string
  yourPlayer1: string
  oppPlayer1: string
  server?: string
  format: string
  gamesTo: number
  bestOf: string
  tiebreak: string
  scoringType: string
  returnerPicksSide?: boolean
  showPlayerOptions?: boolean
  showAdvanced?: boolean
  yourPlayer1Hand?: string
  yourPlayer1Backhand?: string
  yourPlayer2?: string
  yourPlayer2Hand?: string
  yourPlayer2Backhand?: string
  oppPlayer1Hand?: string
  oppPlayer1Backhand?: string
  oppPlayer2?: string
  oppPlayer2Hand?: string
  oppPlayer2Backhand?: string
  tiebreakTrigger?: string
  earlySetsPoints?: string
  customEarlyPoints?: number
  finalSetPoints?: string
  customFinalPoints?: number
  matchTiebreakFinalOnly?: boolean
  isPublic?: boolean
  statMode?: 'basic' | 'intermediate' | 'advanced'
  customStats?: string[]
  customStatsTeams?: 'both' | 'your-team' | 'opponent-team'
  customStatsIndividual?: boolean
  courtStyle?: 'hard_1' | 'hard_2' | 'clay_court' | 'grass_court'
  courtSurface?: 'hard' | 'clay' | 'grass' | 'carpet'
  sideSwitchingFormat?: 'normal' | 'wtt' | 'no-swap'
  tiebreakFormat?: 'standard' | 'wtt'
}

export interface AnalyticsKPIs {
  winRate: string;
  wins?: number;
  totalMatches: number;
  longestMatchStreak: number;
  setsWonPercent?: string;
  setsWon?: number;
  setsPlayed?: number;
  gamesWonPercent?: string;
  gamesWon?: number;
  gamesPlayed?: number;
  aces: number;
  winners: number;
  overallWinners?: number;
  doubleFaults: number;
  unforcedErrors: number;
  rallyUnforcedErrors?: number;
  winnersToUfeRatio?: number | null;
  serveWinnersToUfeRatio?: number | null;
  returnWinnersToUfeRatio?: number | null;
  rallyWinnersToUfeRatio?: number | null;
  firstServePercent: string;
  firstServeIn?: number;
  firstServeAttempted?: number;
  firstServeWonPercent: string;
  firstServePointsWon?: number;
  firstServePointsPlayed?: number;
  secondServeInPercent?: string;
  secondServeIn?: number;
  secondServeAttempted?: number;
  secondServeWonPercent: string;
  secondServePointsWon?: number;
  secondServePointsPlayed?: number;
  servicePointsWonPercent?: string;
  servicePointsWon?: number;
  servicePointsPlayed?: number;
  breakPointsSavedPercent: string;
  breakPointsSaved?: number;
  breakPointsFaced?: number;
  servesUnreturned?: number;
  servesUnreturnedPercent?: string;
  returnPointsWonPercent: string;
  returnPointsWon?: number;
  returnPointsPlayed?: number;
  returnInPercent?: string;
  returnMade?: number;
  returnAttempted?: number;
  firstServeReturnPercent?: string;
  firstServeReturnMade?: number;
  firstServeReturnAttempted?: number;
  firstServeReturnPtsWonPercent?: string;
  firstServeReturnPtsWon?: number;
  firstServeReturnPtsPlayed?: number;
  secondServeReturnPercent?: string;
  secondServeReturnMade?: number;
  secondServeReturnAttempted?: number;
  secondServeReturnPtsWonPercent?: string;
  secondServeReturnPtsWon?: number;
  secondServeReturnPtsPlayed?: number;
  returnUnforcedErrors?: number;
  returnForcedErrors?: number;
  returnWinners?: number;
  breakPointsConvertedPercent: string;
  breakPointsConverted?: number;
  breakPointOpportunities?: number;
  forcedErrors?: number;
  netPointsWonPercent?: string;
  netPointsWon?: number;
  netPointsAttempted?: number;
  netAttemptedPercent?: string;
  longestRallyLength?: number;
  rallyShortWonPercent?: string | null;
  rallyShortWon?: number;
  rallyShortPlayed?: number;
  rallyMediumWonPercent?: string | null;
  rallyMediumWon?: number;
  rallyMediumPlayed?: number;
  rallyLongWonPercent?: string | null;
  rallyLongWon?: number;
  rallyLongPlayed?: number;
  rallyCounterUsed?: boolean;
  pointsWonPercent?: string;
  pointsWon?: number;
  pointsPlayed?: number;
  serviceGamesWonPercent?: string;
  serviceGamesWon?: number;
  serviceGamesPlayed?: number;
  returnGamesWonPercent?: string;
  returnGamesWon?: number;
  returnGamesPlayed?: number;
  dominanceRatio?: number | null;
  gamePointsOnServePercent?: string;
  gamePointsOnServeWon?: number;
  gamePointsOnServeOpportunity?: number;
  gamePointsOnReturnPercent?: string;
  gamePointsOnReturnWon?: number;
  gamePointsOnReturnOpportunity?: number;
  loveGamesWon?: number;
  loveGamesLost?: number;
  longestPointStreak?: number;
  longestGameStreak?: number;
  longestSetStreak?: number;
  lets?: number;
  footFaults?: number;
  touchingNet?: number;
  penalties?: number;
  comebacksDown1Set?: number;
  comebacksDown2Sets?: number;
  lossesUp1Set?: number;
  lossesUp2Sets?: number;
  winsVsLefty?: number;
  lossesVsLefty?: number;
  winsVsRighty?: number;
  lossesVsRighty?: number;
  winsHard?: number;
  lossesHard?: number;
  hardCourtWinPercent?: string | null;
  winsClay?: number;
  lossesClay?: number;
  clayCourtWinPercent?: string | null;
  winsGrass?: number;
  lossesGrass?: number;
  grassCourtWinPercent?: string | null;
  winsCarpet?: number;
  lossesCarpet?: number;
  carpetCourtWinPercent?: string | null;
  setPointPercent?: string | null;
  setPointPercentServe?: string | null;
  setPointPercentReturn?: string | null;
  setPointsWonServe?: number;
  setPointOppServe?: number;
  setPointsWonReturn?: number;
  setPointOppReturn?: number;
  matchPointPercent?: string | null;
  matchPointPercentServe?: string | null;
  matchPointPercentReturn?: string | null;
  matchPointsWonServe?: number;
  matchPointOppServe?: number;
  matchPointsWonReturn?: number;
  matchPointOppReturn?: number;
  gamePointsSavedPercent?: string | null;
  setPointsSavedPercent?: string | null;
  setPointsSaved?: number;
  setPointsFaced?: number;
  matchPointsSavedPercent?: string | null;
  matchPointsSaved?: number;
  matchPointsFaced?: number;
  tiebreakServePointsWonPercent?: string | null;
  tiebreakServePointsWon?: number;
  tiebreakServePointsPlayed?: number;
  tiebreakReturnPointsWonPercent?: string | null;
  tiebreakReturnPointsWon?: number;
  tiebreakReturnPointsPlayed?: number;
  deuceSidePointsWonPercent?: string | null;
  deuceSidePointsLostPercent?: string | null;
  deuceSidePointsWon?: number;
  deuceSidePointsPlayed?: number;
  adSidePointsWonPercent?: string | null;
  adSidePointsLostPercent?: string | null;
  adSidePointsWon?: number;
  adSidePointsPlayed?: number;
  returnDeuceSidePointsWonPercent?: string | null;
  returnDeuceSidePointsWon?: number;
  returnDeuceSidePointsPlayed?: number;
  returnAdSidePointsWonPercent?: string | null;
  returnAdSidePointsWon?: number;
  returnAdSidePointsPlayed?: number;
  forehandWinners?: number;
  forehandErrors?: number;
  forehandRatio?: number | null;
  backhandWinners?: number;
  backhandErrors?: number;
  backhandRatio?: number | null;
  volleyWinners?: number;
  volleyErrors?: number;
  volleyRatio?: number | null;
  overheadWinners?: number;
  overheadErrors?: number;
  overheadRatio?: number | null;
  tiebreakPointsWonPercent?: string | null;
  tiebreakPointsWon?: number;
  tiebreakPointsPlayed?: number;
}

export interface HeatmapDataItem {
  date: string;
  result: 'win' | 'loss';
}

export interface ShotPerformanceItem {
  shot: string;
  value: number;
}

export type PerMatchTrendPoint = {
  date: string;
  winRate: number;
  totalMatches: number;
  aces: number;
  doubleFaults: number;
  winners: number;
  overallWinners: number;
  unforcedErrors: number;
  rallyUnforcedErrors: number;
  winnersToUfeRatio: number | null;
  serveWinnersToUfeRatio: number | null;
  returnWinnersToUfeRatio: number | null;
  rallyWinnersToUfeRatio: number | null;
  firstServePercent: number;
  firstServeWonPercent: number;
  secondServeInPercent: number;
  secondServeWonPercent: number;
  servicePointsWonPercent: number;
  breakPointsSavedPercent: number;
  returnPointsWonPercent: number;
  returnInPercent: number;
  firstServeReturnPercent: number;
  firstServeReturnPtsWonPercent: number;
  secondServeReturnPercent: number;
  secondServeReturnPtsWonPercent: number;
  breakPointsConvertedPercent: number;
  netPointsWonPercent: number;
  netAttemptedPercent: number;
  pointsWonPercent: number;
  serviceGamesWonPercent: number;
  returnGamesWonPercent: number;
  gamePointsOnServePercent: number;
  gamePointsOnReturnPercent: number;
  gamePointConversionPercent: number;
  setsWonPercent: number;
  gamesWonPercent: number;
  dominanceRatio: number | null;
  servesUnreturned: number;
  servesUnreturnedPercent: number;
  returnUnforcedErrors: number;
  returnForcedErrors: number;
  returnWinners: number;
  forcedErrors: number;
  netPointsWon: number;
  netPointsAttempted: number;
  pointsWon: number;
  pointsPlayed: number;
  loveGamesWon: number;
  loveGamesLost: number;
  longestPointStreak: number;
  longestGameStreak: number;
  longestSetStreak: number;
  longestRallyLength: number;
  rallyShortWonPercent: number;
  rallyMediumWonPercent: number;
  rallyLongWonPercent: number;
  comebacksDown1Set: number;
  comebacksDown2Sets: number;
  lossesUp1Set: number;
  lossesUp2Sets: number;
  winsVsLefty: number;
  lossesVsLefty: number;
  winsVsRighty: number;
  lossesVsRighty: number;
  setPointPercent: number;
  setPointPercentServe: number;
  setPointPercentReturn: number;
  matchPointPercent: number;
  matchPointPercentServe: number;
  matchPointPercentReturn: number;
  gamePointsSavedPercent: number;
  setPointsSavedPercent: number;
  matchPointsSavedPercent: number;
  tiebreakServePointsWonPercent: number;
  tiebreakReturnPointsWonPercent: number;
  deuceSidePointsWonPercent: number;
  deuceSidePointsLostPercent: number;
  adSidePointsWonPercent: number;
  adSidePointsLostPercent: number;
  returnDeuceSidePointsWonPercent: number;
  returnAdSidePointsWonPercent: number;
  tiebreakPointsWonPercent: number;
  forehandWinners: number;
  forehandErrors: number;
  forehandRatio: number;
  backhandWinners: number;
  backhandErrors: number;
  backhandRatio: number;
  volleyWinners: number;
  volleyErrors: number;
  volleyRatio: number;
  overheadWinners: number;
  overheadErrors: number;
  overheadRatio: number;
};

export interface AnalyticsData {
  kpis: AnalyticsKPIs;
  heatmapData: HeatmapDataItem[];
  shotPerformance: ShotPerformanceItem[];
  perMatchTrends?: PerMatchTrendPoint[];
}

export interface MatchHistoryItem {
  id: string;
  opponentNames: string;
  result: 'Won' | 'Lost' | 'Ongoing';
  score: string;
  date: string;
  status: 'active' | 'completed';
}

export interface Note {
  id: number;
  type: 'pre-match' | 'post-match' | 'training';
  matchId?: string;
  content: string;
  createdAt: number;
}

export interface PublicMatch extends Match {
    creatorUsername: string;
}

function mapMatch(raw: any): Match {
  return {
    id: raw.id,
    userId: raw.user_id,
    matchType: raw.match_type,
    yourPlayer1: raw.your_player1,
    yourPlayer1Hand: raw.your_player1_hand,
    yourPlayer1Backhand: raw.your_player1_backhand,
    yourPlayer2: raw.your_player2,
    yourPlayer2Hand: raw.your_player2_hand,
    yourPlayer2Backhand: raw.your_player2_backhand,
    oppPlayer1: raw.opp_player1,
    oppPlayer1Hand: raw.opp_player1_hand,
    oppPlayer1Backhand: raw.opp_player1_backhand,
    oppPlayer2: raw.opp_player2,
    oppPlayer2Hand: raw.opp_player2_hand,
    oppPlayer2Backhand: raw.opp_player2_backhand,
    server: raw.server,
    format: raw.format,
    gamesTo: raw.games_to,
    bestOf: raw.best_of,
    tiebreak: raw.tiebreak,
    scoringType: raw.scoring_type,
    returnerPicksSide: raw.returner_picks_side,
    showPlayerOptions: raw.show_player_options,
    showAdvanced: raw.show_advanced,
    tiebreakTrigger: raw.tiebreak_trigger,
    earlySetsPoints: raw.early_sets_points,
    customEarlyPoints: raw.custom_early_points,
    finalSetPoints: raw.final_set_points,
    customFinalPoints: raw.custom_final_points,
    matchTiebreakFinalOnly: raw.match_tiebreak_final_only,
    isPublic: raw.is_public,
    statMode: raw.stat_mode,
    customStats: raw.custom_stats,
    customStatsTeams: raw.custom_stats_teams,
    customStatsIndividual: raw.custom_stats_individual,
    trackForehandBackhand: raw.track_forehand_backhand,
    startingCourtSide: raw.starting_court_side,
    courtStyle: raw.court_style || 'hard_1',
    sideSwitchingFormat: raw.side_switching_format || 'normal',
    tiebreakFormat: raw.tiebreak_format || 'standard',
    status: raw.status,
    isPaused: !!(raw.is_paused),
    pausedAt: raw.paused_at || null,
    totalPausedMs: raw.total_paused_ms || 0,
    timerStartedAt: raw.timer_started_at || null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at
  }
}

function mapStats(raw: any): Stats {
  return raw as Stats
}

function buildMatchFromPayload(payload: CreateMatchPayload, matchId: string): Match {
  const now = new Date().toISOString()
  return {
    id: matchId,
    userId: 'offline',
    matchType: payload.type,
    yourPlayer1: payload.yourPlayer1,
    yourPlayer1Hand: payload.yourPlayer1Hand as Match['yourPlayer1Hand'],
    yourPlayer1Backhand: payload.yourPlayer1Backhand as Match['yourPlayer1Backhand'],
    yourPlayer2: payload.yourPlayer2,
    yourPlayer2Hand: payload.yourPlayer2Hand as Match['yourPlayer2Hand'],
    yourPlayer2Backhand: payload.yourPlayer2Backhand as Match['yourPlayer2Backhand'],
    oppPlayer1: payload.oppPlayer1,
    oppPlayer1Hand: payload.oppPlayer1Hand as Match['oppPlayer1Hand'],
    oppPlayer1Backhand: payload.oppPlayer1Backhand as Match['oppPlayer1Backhand'],
    oppPlayer2: payload.oppPlayer2,
    oppPlayer2Hand: payload.oppPlayer2Hand as Match['oppPlayer2Hand'],
    oppPlayer2Backhand: payload.oppPlayer2Backhand as Match['oppPlayer2Backhand'],
    server: undefined as any,
    format: payload.format as Match['format'],
    gamesTo: payload.gamesTo,
    bestOf: payload.bestOf as Match['bestOf'],
    tiebreak: payload.tiebreak as Match['tiebreak'],
    scoringType: payload.scoringType as Match['scoringType'],
    returnerPicksSide: payload.returnerPicksSide ?? false,
    showPlayerOptions: payload.showPlayerOptions ?? false,
    showAdvanced: payload.showAdvanced ?? false,
    tiebreakTrigger: payload.tiebreakTrigger,
    earlySetsPoints: payload.earlySetsPoints,
    customEarlyPoints: payload.customEarlyPoints,
    finalSetPoints: payload.finalSetPoints,
    customFinalPoints: payload.customFinalPoints,
    matchTiebreakFinalOnly: payload.matchTiebreakFinalOnly ?? false,
    isPublic: payload.isPublic ?? false,
    statMode: payload.statMode,
    customStats: payload.customStats,
    customStatsTeams: payload.customStatsTeams,
    customStatsIndividual: payload.customStatsIndividual,
    trackForehandBackhand: payload.statMode === 'advanced',
    startingCourtSide: undefined,
    courtStyle: (payload.courtStyle as Match['courtStyle']) ?? 'hard_1',
    courtSurface: (payload.courtSurface as Match['courtSurface']) ?? 'hard',
    sideSwitchingFormat: (payload.sideSwitchingFormat as Match['sideSwitchingFormat']) ?? 'normal',
    tiebreakFormat: (payload.tiebreakFormat as Match['tiebreakFormat']) ?? 'standard',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  }
}

export async function createMatch(data: CreateMatchPayload): Promise<string> {
  if (!getIsOnline()) {
    const matchId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    const match = buildMatchFromPayload(data, matchId)
    const stats = initStats(matchId)
    await setOfflineActiveMatch(match, stats, data)
    return matchId
  }
  const res = await nativeFetch('/matches', { method: 'POST', data })
  return (res.data as any).matchId
}

export async function getCurrentMatch(): Promise<Match> {
  const guestMatch = await getGuestMatch()
  if (guestMatch) return guestMatch
  if (!getIsOnline()) {
    const active = await getOfflineActiveMatch()
    if (active) return active.match
  }
  const res = await nativeFetch('/matches/current', { method: 'GET' })
  return mapMatch(res.data)
}

export async function getMatch(matchId: string): Promise<Match> {
  if (isGuestMatch(matchId)) {
    const match = await getGuestMatch()
    if (match) return match
    throw new Error('Guest match not found')
  }
  if (isOfflineMatch(matchId)) {
    const active = await getOfflineActiveMatch()
    if (active && active.match.id === matchId) return active.match
    throw new Error('Offline match not found')
  }
  const res = await nativeFetch(`/matches/${matchId}`, { method: 'GET' })
  return mapMatch(res.data)
}

export async function listPublicMatches(): Promise<PublicMatch[]> {
    const res = await nativeFetch('/teams/matches/public', { method: 'GET' });
    return (res.data as any).matches.map((m: any) => ({...mapMatch(m), creatorUsername: m.creator_username }))
}

export interface PublicMatchFull extends PublicMatch {
  stats: Stats | null;
  stream: any | null;
}

export async function listPublicMatchesFull(): Promise<PublicMatchFull[]> {
    const res = await nativeFetch('/teams/matches/public/full', { method: 'GET' });
    return (res.data as any).matches.map((m: any) => ({
      ...mapMatch(m),
      creatorUsername: m.creator_username,
      stats: m.stats ? mapStats(m.stats) : null,
      stream: m.stream ?? null,
    }))
}

export async function listMatchHistory(): Promise<MatchHistoryItem[]> {
  if (!getIsOnline()) return [];
  const res = await nativeFetch('/matches/history', { method: 'GET' });
  return res.data as MatchHistoryItem[];
}

/** Lightweight count of completed matches (no full history load). Use for slider max. */
export async function getMatchCount(): Promise<number> {
  if (!getIsOnline()) return 0;
  const res = await nativeFetch('/matches/history/count', { method: 'GET' });
  return (res.data as { count: number }).count ?? 0;
}

/** Oldest completed match date (ISO string or null). Use for Time Trends slider max. */
export async function getMatchHistoryRange(): Promise<{ oldestDate: string | null }> {
  if (!getIsOnline()) return { oldestDate: null };
  const res = await nativeFetch('/matches/history/range', { method: 'GET' });
  const data = res.data as { oldestDate?: string | null };
  return { oldestDate: data.oldestDate ?? null };
}

export async function endMatch(
  matchId: string,
  stats?: Stats | null,
  endedEarlyReason?: string | null
): Promise<void> {
  if (isGuestMatch(matchId)) {
    const match = await getGuestMatch()
    const guestStats = await getGuestStats()
    if (match) {
      const updatedMatch = { ...match, status: 'completed' as const }
      const statsToSave = stats ?? guestStats ?? undefined
      if (statsToSave) await saveGuestMatch(updatedMatch, statsToSave)
    }
    return
  }
  if (isOfflineMatch(matchId)) {
    const active = await getOfflineActiveMatch()
    if (active && active.match.id === matchId && stats) {
      await addToPendingSync(active.createPayload, stats)
      await clearOfflineActiveMatch()
    }
    return
  }
  const data: { stats?: Stats; endedEarlyReason?: string } = {}
  if (stats != null) data.stats = stats
  if (endedEarlyReason != null && endedEarlyReason !== '') data.endedEarlyReason = endedEarlyReason
  await nativeFetch(`/matches/${matchId}`, {
    method: 'DELETE',
    data: Object.keys(data).length ? data : undefined,
  })
}

export async function getStats(matchId: string): Promise<Stats> {
  if (isGuestMatch(matchId)) {
    const stats = await getGuestStats()
    if (stats) return stats
    throw new Error('Guest match stats not found')
  }
  if (isOfflineMatch(matchId)) {
    const active = await getOfflineActiveMatch()
    if (active && active.match.id === matchId) return active.stats
    throw new Error('Offline match stats not found')
  }
  const res = await nativeFetch(`/matches/${matchId}/stats`, { method: 'GET' })
  return mapStats(res.data)
}

function getSettingsFromMatch(match: Match): MatchSettings {
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
  }
}

export async function setServer(matchId: string, serverId: string): Promise<Stats> {
  if (isGuestMatch(matchId)) {
    const match = await getGuestMatch()
    const stats = await getGuestStats()
    if (!match || !stats) throw new Error('Guest match not found')
    const settings: MatchSettings = { ...getSettingsFromMatch(match), server: serverId }
    const updatedStats = setServerLocal(stats, serverId, settings)
    await updateGuestStats(updatedStats)
    await saveGuestMatch({ ...match, server: serverId }, updatedStats)
    return updatedStats
  }
  if (isOfflineMatch(matchId)) {
    const active = await getOfflineActiveMatch()
    if (!active || active.match.id !== matchId) throw new Error('Offline match not found')
    const settings: MatchSettings = { ...getSettingsFromMatch(active.match), server: serverId }
    const updatedStats = setServerLocal(active.stats, serverId, settings)
    await setOfflineActiveMatch({ ...active.match, server: serverId }, updatedStats, active.createPayload)
    return updatedStats
  }
  const res = await nativeFetch(`/matches/${matchId}/server`, { method: 'POST', data: { serverId } })
  return mapStats(res.data)
}

export async function setStartingCourtSide(matchId: string, courtSide: 'top' | 'bottom'): Promise<Match> {
  if (isGuestMatch(matchId)) {
    const match = await getGuestMatch()
    const stats = await getGuestStats()
    if (!match || !stats) throw new Error('Guest match not found')
    const updatedMatch = { ...match, startingCourtSide: courtSide }
    await saveGuestMatch(updatedMatch, stats)
    return updatedMatch
  }
  if (isOfflineMatch(matchId)) {
    const active = await getOfflineActiveMatch()
    if (!active || active.match.id !== matchId) throw new Error('Offline match not found')
    const updatedMatch = { ...active.match, startingCourtSide: courtSide }
    await setOfflineActiveMatch(updatedMatch, active.stats, active.createPayload)
    return updatedMatch
  }
  const res = await nativeFetch(`/matches/${matchId}/court-side`, { method: 'POST', data: { courtSide } })
  return mapMatch(res.data)
}

export async function pauseMatch(matchId: string, reason?: string): Promise<{ isPaused: boolean; pausedAt: string; totalPausedMs: number; timerStartedAt: string | null }> {
  const res = await nativeFetch(`/matches/${matchId}/pause`, { method: 'POST', data: { reason } })
  return res.data as any
}

export async function resumeMatch(matchId: string): Promise<{ isPaused: boolean; pausedAt: null; totalPausedMs: number }> {
  const res = await nativeFetch(`/matches/${matchId}/resume`, { method: 'POST' })
  return res.data as any
}

export async function startMatchTimer(matchId: string): Promise<{ timerStartedAt: string }> {
  const res = await nativeFetch(`/matches/${matchId}/start-timer`, { method: 'POST' })
  return res.data as any
}

export async function logPoint(matchId: string, event: PointEvent): Promise<Stats> {
  if (isGuestMatch(matchId)) {
    const match = await getGuestMatch()
    const stats = await getGuestStats()
    if (!match || !stats) throw new Error('Guest match not found')
    const settings = getSettingsFromMatch(match)
    const updatedStats = recordPoint(matchId, stats, event, settings)
    await updateGuestStats(updatedStats)
    if (updatedStats.matchWinner && match.status === 'active') {
      await saveGuestMatch({ ...match, status: 'completed' }, updatedStats)
    }
    return updatedStats
  }
  if (isOfflineMatch(matchId)) {
    const active = await getOfflineActiveMatch()
    if (!active || active.match.id !== matchId) throw new Error('Offline match not found')
    const settings = getSettingsFromMatch(active.match)
    const updatedStats = recordPoint(matchId, active.stats, event, settings)
    const updatedMatch =
      updatedStats.matchWinner && active.match.status === 'active'
        ? { ...active.match, status: 'completed' as const }
        : active.match
    await setOfflineActiveMatch(updatedMatch, updatedStats, active.createPayload)
    return updatedStats
  }
  const res = await nativeFetch(`/matches/${matchId}/point`, { method: 'POST', data: event })
  return mapStats(res.data)
}

export async function undoPoint(matchId: string): Promise<Stats> {
  if (isGuestMatch(matchId)) {
    const match = await getGuestMatch()
    const stats = await getGuestStats()
    if (!match || !stats) throw new Error('Guest match not found')
    const settings = getSettingsFromMatch(match)
    const updatedStats = undoPointLocal(matchId, stats, settings)
    await updateGuestStats(updatedStats)
    if (stats.matchWinner && !updatedStats.matchWinner && match.status === 'completed') {
      await saveGuestMatch({ ...match, status: 'active' }, updatedStats)
    }
    return updatedStats
  }
  if (isOfflineMatch(matchId)) {
    const active = await getOfflineActiveMatch()
    if (!active || active.match.id !== matchId) throw new Error('Offline match not found')
    const settings = getSettingsFromMatch(active.match)
    const updatedStats = undoPointLocal(matchId, active.stats, settings)
    const updatedMatch =
      active.stats.matchWinner && !updatedStats.matchWinner && active.match.status === 'completed'
        ? { ...active.match, status: 'active' as const }
        : active.match
    await setOfflineActiveMatch(updatedMatch, updatedStats, active.createPayload)
    return updatedStats
  }
  const res = await nativeFetch(`/matches/${matchId}/undo`, { method: 'POST' })
  return mapStats(res.data)
}

export async function getAnalyticsData(period: string, limit?: number): Promise<AnalyticsData> {
  const params = new URLSearchParams({ period });
  if (limit != null) params.set('limit', String(limit));
  const res = await nativeFetch(`/analytics?${params.toString()}`, { method: 'GET' });
  return res.data as AnalyticsData;
}

export async function listNotes(): Promise<Note[]> {
  const res = await nativeFetch('/notes', { method: 'GET' });
  return res.data as Note[];
}

export async function getNote(noteId: number): Promise<Note> {
  const notes = await listNotes();
  const note = notes.find(n => n.id === noteId);
  if (!note) {
    throw new Error('Note not found');
  }
  return note;
}

export async function createNote(type: string, content: string, matchId?: string): Promise<Note> {
  const res = await nativeFetch('/notes', { method: 'POST', data: { type, content, matchId } });
  return res.data as Note;
}

export async function updateNote(noteId: number, data: { type: string, content: string, matchId?: string }): Promise<Note> {
  const res = await nativeFetch(`/notes/${noteId}`, { method: 'PUT', data });
  return res.data as Note;
}

export async function deleteNote(noteId: number): Promise<void> {
  await nativeFetch(`/notes/${noteId}`, { method: 'DELETE' });
}