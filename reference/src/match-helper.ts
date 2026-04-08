export interface MatchStats {
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
  serve_order: string[]
  lineScoreSetAtStart?: boolean
}

export interface InitialLineScorePayload {
  yourSets: number
  oppSets: number
  yourGames: number
  oppGames: number
  yourPoints: number
  oppPoints: number
}

export interface PlayerStats {
  serve: ServeStats
  return: ReturnStats
  rally: RallyStats
  other: OtherStats
  individualMatch: IndividualMatchStats
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
  tiebreakServePointsWon: number
  tiebreakServePointsPlayed: number
  deuceSidePointsWon: number
  deuceSidePointsPlayed: number
  adSidePointsWon: number
  adSidePointsPlayed: number
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
  tiebreakReturnPointsWon: number
  tiebreakReturnPointsPlayed: number
  deuceSidePointsWon: number
  deuceSidePointsPlayed: number
  adSidePointsWon: number
  adSidePointsPlayed: number
}

export interface RallyStats {
  winners: number
  unforcedErrors: number
  forcedErrors: number
  netPointsWon: number
  netPointsAttempted: number
  longestRallyLength: number
  totalRallyLength: number
  rallyCount: number
  forehandWinners: number
  forehandErrors: number
  backhandWinners: number
  backhandErrors: number
  volleyWinners: number
  volleyErrors: number
  overheadWinners: number
  overheadErrors: number
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
  setPointOpportunityOnServe: number
  setPointsWonOnServe: number
  setPointOpportunityOnReturn: number
  setPointsWonOnReturn: number
  matchPointOpportunityOnServe: number
  matchPointsWonOnServe: number
  matchPointOpportunityOnReturn: number
  matchPointsWonOnReturn: number
  setPointFacedOnServe: number
  setPointsSavedOnServe: number
  matchPointFacedOnServe: number
  matchPointsSavedOnServe: number
  loveGamesWon: number
  loveGamesLost: number
  longestPointStreak: number
  longestGameStreak: number
  rallyShortWon: number
  rallyShortPlayed: number
  rallyMediumWon: number
  rallyMediumPlayed: number
  rallyLongWon: number
  rallyLongPlayed: number
  rallyCounterUsed: boolean
}

export interface MatchTotals {
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

export interface HeatmapData {
  serves: Array<{ x: number; y: number; playerId: string; placement?: 'body' | 'wide' | 't'; isIn: boolean }>
  returns: Array<{ x: number; y: number; playerId: string; strokeType?: string; isIn: boolean }>
  rally: Array<{ x: number; y: number; playerId: string; strokeType?: string; isIn: boolean }>
  byStrokeType: {
    forehand: Array<{ x: number; y: number; playerId: string; isIn: boolean }>
    backhand: Array<{ x: number; y: number; playerId: string; isIn: boolean }>
    volley: Array<{ x: number; y: number; playerId: string; isIn: boolean }>
    overhead: Array<{ x: number; y: number; playerId: string; isIn: boolean }>
    'drop-shot': Array<{ x: number; y: number; playerId: string; isIn: boolean }>
    lob: Array<{ x: number; y: number; playerId: string; isIn: boolean }>
    serve: Array<{ x: number; y: number; playerId: string; placement?: 'body' | 'wide' | 't'; isIn: boolean }>
    return: Array<{ x: number; y: number; playerId: string; strokeType?: string; isIn: boolean }>
  }
}

export interface ServePlacementStats {
  body: { attempted: number; in: number }
  wide: { attempted: number; in: number }
  t: { attempted: number; in: number }
}

export interface AggregateStats {
  momentum: any[]
  pointsPlayedAfterHour: number
  pointsWonAfterHour: number
  heatmaps: HeatmapData
  servePlacements: Record<string, ServePlacementStats>
  shotTypeCounts: Record<string, Record<string, number>>
  errorTypeCounts: Record<string, Record<string, number>>
  winnerTypeCounts: Record<string, Record<string, number>>
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
  pointLoserId?: string
  serverId?: string
  receiverId?: string
  netChoices?: Record<string, boolean>
  rallyLength?: number
  actions: Action[]
  ballLocations?: BallLocation[]
  servePlacement?: 'body' | 'wide' | 't'
  shotTypes?: Record<string, string[]>
  errorTypes?: Record<string, string[]>
  winnerTypes?: Record<string, string[]>
}

export interface Action {
  actorId: string
  type: string
}

export interface MatchSettings {
  yourPlayer1: string
  yourPlayer2?: string | null
  oppPlayer1: string
  oppPlayer2?: string | null
  scoring_type: string
  tiebreak: string
  games_to: number
  best_of: string
  format: string
  server?: string | null
  matchType?: string
  tiebreak_trigger?: string | null
}

export function initStats(matchId: number): MatchStats {
  return {
    matchId,
    players: {},
    matchTotals: {
      setsPlayed: 0,
      setsWon: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      pointsPlayed: 0,
      pointsWon: 0,
      winners: 0,
      errors: 0,
      comebacksDown1Set: 0,
      comebacksDown2Sets: 0,
      lossesUp1Set: 0,
      lossesUp2Sets: 0,
      winsVsLefty: 0,
      lossesVsLefty: 0,
      winsVsRighty: 0,
      lossesVsRighty: 0
    },
    aggregate: {
      momentum: [],
      pointsPlayedAfterHour: 0,
      pointsWonAfterHour: 0,
      heatmaps: {
        serves: [],
        returns: [],
        rally: [],
        byStrokeType: {
          forehand: [],
          backhand: [],
          volley: [],
          overhead: [],
          'drop-shot': [],
          lob: [],
          serve: [],
          return: []
        }
      },
      servePlacements: {},
      shotTypeCounts: {},
      errorTypeCounts: {},
      winnerTypeCounts: {}
    },
    history: [],
    currentGame: {
      points: {},
      serverPoints: 0,
      receiverPoints: 0,
      serverDisplay: '0',
      receiverDisplay: '0'
    },
    currentSet: { games: {}, tiebreak: null },
    sets: [],
    matchWinner: null,
    matchLoser: null,
    server: null,
    serve_order: []
  }
}

export function setServer(stats: MatchStats, serverId: string, settings: MatchSettings): MatchStats {
  stats.server = serverId
  const isDoubles = settings.matchType === 'doubles'
  
  if (isDoubles) {
    if (!stats.serve_order) {
      stats.serve_order = []
    }
    
    const serveOrder = stats.serve_order
    
    if (!serveOrder.includes(serverId)) {
      serveOrder.push(serverId)
    }

    if (serveOrder.length === 2) {
      const p1So = serveOrder[0]
      const p2So = serveOrder[1]
      
      const yourP1 = settings.yourPlayer1
      const yourP2 = settings.yourPlayer2
      const oppP1 = settings.oppPlayer1
      const oppP2 = settings.oppPlayer2

      let p1Partner: string | null = null
      let p2Partner: string | null = null

      if (p1So === yourP1) p1Partner = yourP2 || null
      else if (p1So === yourP2) p1Partner = yourP1
      else if (p1So === oppP1) p1Partner = oppP2 || null
      else if (p1So === oppP2) p1Partner = oppP1

      if (p2So === yourP1) p2Partner = yourP2 || null
      else if (p2So === yourP2) p2Partner = yourP1
      else if (p2So === oppP1) p2Partner = oppP2 || null
      else if (p2So === oppP2) p2Partner = oppP1

      if (p1Partner && p2Partner) {
        stats.serve_order = [p1So, p2So, p1Partner, p2Partner]
      }
    }
  }
  
  return stats
}

function ensurePlayer(stats: MatchStats, pid: string): void {
  if (!stats.players[pid]) {
    stats.players[pid] = {
      serve: {
        aces: 0, doubleFaults: 0,
        firstServeIn: 0, firstServeAttempted: 0,
        firstServePointsWon: 0, firstServePointsPlayed: 0,
        secondServeIn: 0, secondServeAttempted: 0,
        secondServePointsWon: 0, secondServePointsPlayed: 0,
        servicePointsWon: 0, servicePointsPlayed: 0,
        breakPointsSaved: 0, breakPointsFaced: 0,
        servesUnreturned: 0,
        tiebreakServePointsWon: 0, tiebreakServePointsPlayed: 0,
        deuceSidePointsWon: 0, deuceSidePointsPlayed: 0,
        adSidePointsWon: 0, adSidePointsPlayed: 0
      },
      return: {
        returnPointsWon: 0, returnPointsPlayed: 0,
        firstServeReturnMade: 0, firstServeReturnAttempted: 0,
        firstServeReturnPointsWon: 0, firstServeReturnPointsPlayed: 0,
        secondServeReturnMade: 0, secondServeReturnAttempted: 0,
        secondServeReturnPointsWon: 0, secondServeReturnPointsPlayed: 0,
        totalReturnMade: 0, returnForcedErrors: 0,
        returnUnforcedErrors: 0, returnWinners: 0,
        breakPointsConverted: 0, breakPointOpportunities: 0,
        tiebreakReturnPointsWon: 0, tiebreakReturnPointsPlayed: 0,
        deuceSidePointsWon: 0, deuceSidePointsPlayed: 0,
        adSidePointsWon: 0, adSidePointsPlayed: 0
      },
      rally: {
        winners: 0, unforcedErrors: 0,
        forcedErrors: 0,
        netPointsWon: 0, netPointsAttempted: 0,
        longestRallyLength: 0, totalRallyLength: 0,
        rallyCount: 0,
        forehandWinners: 0, forehandErrors: 0,
        backhandWinners: 0, backhandErrors: 0,
        volleyWinners: 0, volleyErrors: 0,
        overheadWinners: 0, overheadErrors: 0
      },
      other: {
        lets: 0, footFaults: 0, touchingNet: 0,
        ballHitsBody: 0, carry: 0, hitsFixture: 0,
        racquetDropped: 0, reachOverNet: 0, penalties: 0
      },
      individualMatch: {
        pointsWon: 0, pointsPlayed: 0,
        serviceGamesWon: 0, serviceGamesPlayed: 0,
        returnGamesWon: 0, returnGamesPlayed: 0,
        breakPointsConverted: 0, breakPointOpportunities: 0,
        gamePointsWonOnServe: 0, gamePointsOpportunityOnServe: 0,
        setPointOpportunityOnServe: 0, setPointsWonOnServe: 0,
        setPointOpportunityOnReturn: 0, setPointsWonOnReturn: 0,
        matchPointOpportunityOnServe: 0, matchPointsWonOnServe: 0,
        matchPointOpportunityOnReturn: 0, matchPointsWonOnReturn: 0,
        setPointFacedOnServe: 0, setPointsSavedOnServe: 0,
        matchPointFacedOnServe: 0, matchPointsSavedOnServe: 0,
        loveGamesWon: 0, loveGamesLost: 0,
        longestPointStreak: 0, longestGameStreak: 0,
        rallyShortWon: 0, rallyShortPlayed: 0,
        rallyMediumWon: 0, rallyMediumPlayed: 0,
        rallyLongWon: 0, rallyLongPlayed: 0,
        rallyCounterUsed: false
      }
    }
  }
}

function formatScore(sp: number, rp: number, ad: boolean, isTiebreak: boolean): [string, string] {
  if (isTiebreak) {
    return [String(sp), String(rp)]
  }
  const labels = ['0', '15', '30', '40']
  if (sp >= 3 && rp >= 3) {
    if (sp === rp) {
      return ['40', '40']
    } else if (sp > rp) {
      return ['Ad', '']
    } else {
      return ['', 'Ad']
    }
  }
  return [labels[Math.min(sp, 3)], labels[Math.min(rp, 3)]]
}

function winPointGame(stats: MatchStats, winner: string, loser: string, server: string, receiver: string, settings: MatchSettings): boolean {
  const isTiebreak = stats.currentSet.tiebreak !== null
  
  const p1TeamIds = [settings.yourPlayer1]
  if (settings.yourPlayer2) {
    p1TeamIds.push(settings.yourPlayer2)
  }
  
  const p2TeamIds = [settings.oppPlayer1]
  if (settings.oppPlayer2) {
    p2TeamIds.push(settings.oppPlayer2)
  }

  if (isTiebreak) {
    const tbScores = stats.currentSet.tiebreak!
    tbScores[winner] = (tbScores[winner] || 0) + 1
    const totalPoints = Object.values(tbScores).reduce((a, b) => a + b, 0)
    
    const serveOrder = stats.serve_order || []
    const isDoubles = settings.matchType === 'doubles'
    if (totalPoints === 1 || (totalPoints > 1 && (totalPoints - 1) % 2 === 0)) {
      if (isDoubles && serveOrder.length === 4) {
        try {
          const currentServerOfGame = server
          const currentIdx = serveOrder.indexOf(currentServerOfGame)
          const nextIdx = (currentIdx + 1) % 4
          stats.server = serveOrder[nextIdx]
        } catch {
          stats.server = receiver
        }
      } else {
        stats.server = receiver
      }
    }
    
    const serverTeamIds = p1TeamIds.includes(stats.server!) ? p1TeamIds : p2TeamIds
    const sp = serverTeamIds.filter(pid => pid).reduce((sum, pid) => sum + (tbScores[pid] || 0), 0)
    const rp = Object.values(tbScores).reduce((a, b) => a + b, 0) - sp
    
    const [sd, rd] = formatScore(sp, rp, false, true)
    stats.currentGame.serverDisplay = sd
    stats.currentGame.receiverDisplay = rd
    return false
  }

  const gp = stats.currentGame.points
  
  const serverTeamKeys = p1TeamIds.includes(server) ? p1TeamIds : p2TeamIds
  const receiverTeamKeys = p1TeamIds.includes(server) ? p2TeamIds : p1TeamIds
  
  const spBefore = serverTeamKeys.filter(k => k).reduce((sum, k) => sum + (gp[k] || 0), 0)
  const rpBefore = receiverTeamKeys.filter(k => k).reduce((sum, k) => sum + (gp[k] || 0), 0)

  gp[winner] = (gp[winner] || 0) + 1
  
  const spAfter = serverTeamKeys.filter(k => k).reduce((sum, k) => sum + (gp[k] || 0), 0)
  const rpAfter = receiverTeamKeys.filter(k => k).reduce((sum, k) => sum + (gp[k] || 0), 0)

  const ad = settings.scoring_type === 'ad'
  const [sd, rd] = formatScore(spAfter, rpAfter, ad, false)
  stats.currentGame.serverPoints = spAfter
  stats.currentGame.receiverPoints = rpAfter
  stats.currentGame.serverDisplay = sd
  stats.currentGame.receiverDisplay = rd

  const isGameOver = (spAfter >= 4 || rpAfter >= 4) && Math.abs(spAfter - rpAfter) >= (ad ? 2 : 1)

  if (isGameOver) {
    const win = spAfter > rpAfter ? server : receiver
    
    const winningTeamIds = p1TeamIds.includes(win) ? p1TeamIds : p2TeamIds
    
    ensurePlayer(stats, server)
    stats.players[server].individualMatch.serviceGamesPlayed += 1
    if (receiver) {
      ensurePlayer(stats, receiver)
      stats.players[receiver].individualMatch.returnGamesPlayed += 1
    }
    
    if (serverTeamKeys.includes(win)) {
      stats.players[server].individualMatch.serviceGamesWon += 1
    } else {
      if (receiver) {
        stats.players[receiver].individualMatch.returnGamesWon += 1
      }
    }

    const gs = stats.currentSet.games
    const gameWinnerRepr = win
    gs[gameWinnerRepr] = (gs[gameWinnerRepr] || 0) + 1
    
    stats.matchTotals.gamesPlayed += 1
    if (p1TeamIds.includes(win)) {
      stats.matchTotals.gamesWon += 1
    }
    
    if (rpBefore === 0 && win === server) {
      for (const pid of winningTeamIds) {
        if (pid) stats.players[pid].individualMatch.loveGamesWon += 1
      }
      const losingTeamIds = p1TeamIds.includes(win) ? p2TeamIds : p1TeamIds
      for (const pid of losingTeamIds) {
        if (pid) stats.players[pid].individualMatch.loveGamesLost += 1
      }
    }
    
    stats.currentGame = {
      points: {},
      serverPoints: 0,
      receiverPoints: 0,
      serverDisplay: '0',
      receiverDisplay: '0'
    }
    
    const currentServer = server
    const isDoubles = settings.matchType === 'doubles'

    if (!isDoubles) {
      stats.server = receiver
    } else {
      const serveOrder = stats.serve_order || []
      
      if (serveOrder.length === 4) {
        try {
          const currentIdx = serveOrder.indexOf(currentServer)
          const nextIdx = (currentIdx + 1) % 4
          stats.server = serveOrder[nextIdx]
        } catch {
          stats.server = null
        }
      } else {
        stats.server = null
      }
    }

    return true
  }
  return false
}

function winSet(stats: MatchStats, settings: MatchSettings): boolean {
  const gs = stats.currentSet.games
  
  const p1TeamIds = [settings.yourPlayer1]
  if (settings.yourPlayer2) {
    p1TeamIds.push(settings.yourPlayer2)
  }

  const p2TeamIds = [settings.oppPlayer1]
  if (settings.oppPlayer2) {
    p2TeamIds.push(settings.oppPlayer2)
  }

  const g1 = p1TeamIds.filter(pid => pid).reduce((sum, pid) => sum + (gs[pid] || 0), 0)
  const g2 = p2TeamIds.filter(pid => pid).reduce((sum, pid) => sum + (gs[pid] || 0), 0)

  const t = settings.tiebreak
  const fmt = settings.format || 'normal'
  const gamesMap: Record<string, number> = { short: 4, normal: 6, pro: 8 }
  const winScore = gamesMap[fmt] || 6

  let tiebreakScore = winScore
  const tiebreakTriggerStr = settings.tiebreak_trigger
  if (tiebreakTriggerStr && tiebreakTriggerStr !== 'None') {
    try {
      tiebreakScore = parseInt(tiebreakTriggerStr.split('-')[0])
    } catch {
    }
  }

  let isSetOver = false

  if ((g1 >= winScore || g2 >= winScore) && Math.abs(g1 - g2) >= 2) {
    isSetOver = true
  } else if (t !== 'None' && g1 === tiebreakScore && g2 === tiebreakScore) {
    if (stats.currentSet.tiebreak !== null) {
      const tb = stats.currentSet.tiebreak
      const p1TbScore = p1TeamIds.filter(pid => pid).reduce((sum, pid) => sum + (tb[pid] || 0), 0)
      const p2TbScore = p2TeamIds.filter(pid => pid).reduce((sum, pid) => sum + (tb[pid] || 0), 0)
      const tiebreakTo = settings.tiebreak === '10-point' ? 10 : 7
      if ((p1TbScore >= tiebreakTo || p2TbScore >= tiebreakTo) && Math.abs(p1TbScore - p2TbScore) >= 2) {
        isSetOver = true
      }
    } else {
      const allPlayers = [...p1TeamIds, ...p2TeamIds].filter(p => p)
      const tiebreakInit: Record<string, number> = {}
      for (const pid of allPlayers) {
        tiebreakInit[pid] = 0
      }
      stats.currentSet.tiebreak = tiebreakInit
    }
  }

  if (!isSetOver) {
    return false
  }

  stats.sets.push({
    games: { ...gs },
    tiebreak: stats.currentSet.tiebreak ? { ...stats.currentSet.tiebreak } : null
  })
  stats.currentSet = { games: {}, tiebreak: null }

  if (settings.matchType === 'doubles' && !stats.matchWinner) {
    stats.serve_order = []
    stats.server = null
  }

  return true
}

function checkMatchEnd(stats: MatchStats, settings: MatchSettings): void {
  if (stats.matchWinner) {
    return
  }

  const bestOf = parseInt(settings.best_of || '3')
  const setsToWin = Math.floor(bestOf / 2) + 1

  const p1TeamIds = [settings.yourPlayer1]
  if (settings.yourPlayer2) {
    p1TeamIds.push(settings.yourPlayer2)
  }
  
  const p2TeamIds = [settings.oppPlayer1]
  if (settings.oppPlayer2) {
    p2TeamIds.push(settings.oppPlayer2)
  }
  
  let p1SetsWon = 0
  let p2SetsWon = 0

  for (const s of stats.sets || []) {
    const g1 = p1TeamIds.filter(pid => pid).reduce((sum, pid) => sum + (s.games[pid] || 0), 0)
    const g2 = p2TeamIds.filter(pid => pid).reduce((sum, pid) => sum + (s.games[pid] || 0), 0)
    
    let winnerFoundInSet = false
    if (g1 > g2) {
      p1SetsWon += 1
      winnerFoundInSet = true
    } else if (g2 > g1) {
      p2SetsWon += 1
      winnerFoundInSet = true
    }
    
    if (!winnerFoundInSet && s.tiebreak) {
      const tb1 = p1TeamIds.filter(pid => pid).reduce((sum, pid) => sum + (s.tiebreak![pid] || 0), 0)
      const tb2 = p2TeamIds.filter(pid => pid).reduce((sum, pid) => sum + (s.tiebreak![pid] || 0), 0)
      if (tb1 > tb2) {
        p1SetsWon += 1
      } else if (tb2 > tb1) {
        p2SetsWon += 1
      }
    }
  }
  
  let winner: string | null = null
  if (p1SetsWon >= setsToWin) {
    winner = settings.yourPlayer1
  } else if (p2SetsWon >= setsToWin) {
    winner = settings.oppPlayer1
  }
  
  if (winner) {
    stats.matchWinner = winner
    stats.matchLoser = winner === settings.yourPlayer1 ? settings.oppPlayer1 : settings.yourPlayer1
  }
}

function getWinScoreFromSettings(settings: MatchSettings): number {
  const fmt = settings.format || 'normal'
  const gamesMap: Record<string, number> = { short: 4, normal: 6, pro: 8 }
  return gamesMap[fmt] || 6
}

function buildCompletedSetSnapshot(wonByYourTeam: boolean, settings: MatchSettings): CompletedSet {
  const winScore = getWinScoreFromSettings(settings)
  const gs: Record<string, number> = {}
  if (wonByYourTeam) {
    gs[settings.yourPlayer1] = winScore
    gs[settings.oppPlayer1] = 0
    if (settings.yourPlayer2) gs[settings.yourPlayer2] = 0
    if (settings.oppPlayer2) gs[settings.oppPlayer2] = 0
  } else {
    gs[settings.yourPlayer1] = 0
    gs[settings.oppPlayer1] = winScore
    if (settings.yourPlayer2) gs[settings.yourPlayer2] = 0
    if (settings.oppPlayer2) gs[settings.oppPlayer2] = 0
  }
  return { games: gs, tiebreak: null }
}

function buildCompletedSetOrder(yourSets: number, oppSets: number): boolean[] {
  const seq: boolean[] = []
  let y = yourSets
  let o = oppSets
  while (y > 0 && o > 0) {
    seq.push(true)
    y--
    seq.push(false)
    o--
  }
  while (y > 0) {
    seq.push(true)
    y--
  }
  while (o > 0) {
    seq.push(false)
    o--
  }
  return seq
}

function isCurrentGameOver(yourPts: number, oppPts: number, ad: boolean): boolean {
  return (yourPts >= 4 || oppPts >= 4) && Math.abs(yourPts - oppPts) >= (ad ? 2 : 1)
}

export function applyInitialLineScore(
  stats: MatchStats,
  settings: MatchSettings,
  payload: InitialLineScorePayload
): { ok: true } | { ok: false; error: string } {
  if (stats.history && stats.history.length > 0) {
    return { ok: false, error: 'Cannot set line score after points have been recorded' }
  }

  const {
    yourSets,
    oppSets,
    yourGames,
    oppGames,
    yourPoints: ypIn,
    oppPoints: opIn,
  } = payload

  const nums = [yourSets, oppSets, yourGames, oppGames, ypIn, opIn]
  if (nums.some((n) => !Number.isFinite(n) || n < 0 || !Number.isInteger(n))) {
    return { ok: false, error: 'All scores must be non-negative integers' }
  }

  if (yourSets + oppSets + yourGames + oppGames + ypIn + opIn === 0) {
    return { ok: true }
  }

  const bestOf = parseInt(settings.best_of || '3')
  const setsToWin = Math.floor(bestOf / 2) + 1
  if (yourSets >= setsToWin || oppSets >= setsToWin) {
    return { ok: false, error: 'Match would already be finished at this set score' }
  }
  if (yourSets + oppSets >= bestOf) {
    return { ok: false, error: 'Invalid completed set count for this format' }
  }

  const winScore = getWinScoreFromSettings(settings)
  if (yourGames >= winScore && oppGames >= winScore) {
    return {
      ok: false,
      error: '6-6 tiebreak is not supported in quick setup - start this game at 0-0 and log points, or adjust games',
    }
  }
  if (
    (yourGames >= winScore || oppGames >= winScore) &&
    Math.abs(yourGames - oppGames) >= 2
  ) {
    return {
      ok: false,
      error: 'This set looks complete - add it under set score instead of current games',
    }
  }

  const ad = settings.scoring_type === 'ad'
  if (isCurrentGameOver(ypIn, opIn, ad)) {
    return { ok: false, error: 'Current game looks finished - adjust points or start the next game' }
  }

  const server = stats.server
  if (!server) {
    return { ok: false, error: 'Server must be chosen before setting line score' }
  }

  const p1TeamIds = [settings.yourPlayer1, settings.yourPlayer2].filter(Boolean) as string[]
  const p2TeamIds = [settings.oppPlayer1, settings.oppPlayer2].filter(Boolean) as string[]
  const serverOnYourTeam = p1TeamIds.includes(server)
  const receiver = serverOnYourTeam ? p2TeamIds[0] : p1TeamIds[0]
  if (!receiver) {
    return { ok: false, error: 'Could not resolve receiver' }
  }

  let spAfter: number
  let rpAfter: number
  if (serverOnYourTeam) {
    spAfter = ypIn
    rpAfter = opIn
  } else {
    spAfter = opIn
    rpAfter = ypIn
  }

  const [sd, rd] = formatScore(spAfter, rpAfter, ad, false)

  stats.sets = buildCompletedSetOrder(yourSets, oppSets).map((yourWin) =>
    buildCompletedSetSnapshot(yourWin, settings)
  )

  stats.currentSet = { games: {}, tiebreak: null }
  stats.currentSet.games[settings.yourPlayer1] = yourGames
  stats.currentSet.games[settings.oppPlayer1] = oppGames
  if (settings.yourPlayer2) stats.currentSet.games[settings.yourPlayer2] = 0
  if (settings.oppPlayer2) stats.currentSet.games[settings.oppPlayer2] = 0

  stats.currentGame = {
    points: {},
    serverPoints: spAfter,
    receiverPoints: rpAfter,
    serverDisplay: sd,
    receiverDisplay: rd,
  }
  stats.currentGame.points[server] = spAfter
  stats.currentGame.points[receiver] = rpAfter

  let gamesPlayed = yourGames + oppGames
  for (const s of stats.sets) {
    const g1 = p1TeamIds.reduce((sum, pid) => sum + (s.games[pid] || 0), 0)
    const g2 = p2TeamIds.reduce((sum, pid) => sum + (s.games[pid] || 0), 0)
    gamesPlayed += g1 + g2
  }
  stats.matchTotals.gamesPlayed = gamesPlayed

  stats.lineScoreSetAtStart = true

  checkMatchEnd(stats, settings)
  if (stats.matchWinner) {
    return { ok: false, error: 'This line score would end the match - check set counts' }
  }

  return { ok: true }
}

export function applyHistory(matchId: number, history: PointEvent[], settings: MatchSettings): MatchStats {
  const stats = initStats(matchId)
  
  let lastPointWinnerTeam: string | null = null
  const currentPointStreaks = { p1: 0, p2: 0 }
  let lastGameWinnerTeam: string | null = null
  const currentGameStreaks = { p1: 0, p2: 0 }

  const p1TeamIds = [settings.yourPlayer1, settings.yourPlayer2]
  const p2TeamIds = [settings.oppPlayer1, settings.oppPlayer2]

  const infractionMap: Record<string, keyof OtherStats> = {
    'TOUCHING_NET': 'touchingNet',
    'BALL_HITS_BODY': 'ballHitsBody',
    'CARRY': 'carry',
    'HITS_FIXTURE': 'hitsFixture',
    'RACQUET_DROPPED': 'racquetDropped',
    'REACH_OVER_NET': 'reachOverNet'
  }

  for (let idx = 0; idx < history.length; idx++) {
    const event = history[idx]
    const winner = event.pointWinnerId
    const loser = event.pointLoserId
    const server = event.serverId
    const receiver = event.receiverId
    const netChoices = event.netChoices || {}
    const rallyLength = event.rallyLength || 1
    const ballLocations = event.ballLocations || []
    const servePlacement = event.servePlacement
    const shotTypes = event.shotTypes || {}
    const errorTypes = event.errorTypes || {}
    const winnerTypes = event.winnerTypes || {}
    
    stats.server = server || null
    
    const isDoubles = settings.matchType === 'doubles'
    if (isDoubles) {
      const serveOrder = stats.serve_order || []
      if (server && !serveOrder.includes(server)) {
        serveOrder.push(server)
        if (serveOrder.length === 2) {
          const p1So = serveOrder[0]
          const p2So = serveOrder[1]
          const yourP1 = settings.yourPlayer1
          const yourP2 = settings.yourPlayer2
          const oppP1 = settings.oppPlayer1
          const oppP2 = settings.oppPlayer2
          let p1Partner: string | null = null
          let p2Partner: string | null = null
          if (p1So === yourP1) p1Partner = yourP2 || null
          else if (p1So === yourP2) p1Partner = yourP1
          else if (p1So === oppP1) p1Partner = oppP2 || null
          else if (p1So === oppP2) p1Partner = oppP1
          if (p2So === yourP1) p2Partner = yourP2 || null
          else if (p2So === yourP2) p2Partner = yourP1
          else if (p2So === oppP1) p2Partner = oppP2 || null
          else if (p2So === oppP2) p2Partner = oppP1
          if (p1Partner && p2Partner) {
            stats.serve_order = [p1So, p2So, p1Partner, p2Partner]
          }
        }
      }
    }

    const playerIdsInEvent = new Set([winner, loser, server, receiver, ...Object.keys(netChoices)])
    for (const pid of playerIdsInEvent) {
      if (pid) {
        ensurePlayer(stats, pid)
      }
    }
    
    const winningTeamIsP1 = p1TeamIds.includes(winner)
    const serverTeamIds = server && p1TeamIds.includes(server) ? p1TeamIds : p2TeamIds
    const receiverTeamIds = server && p1TeamIds.includes(server) ? p2TeamIds : p1TeamIds

    let isBreakPoint = false
    let isGamePoint = false
    if (!stats.currentSet.tiebreak) {
      const gp = stats.currentGame.points
      
      const sp = serverTeamIds.filter(k => k).reduce((sum, k) => sum + (gp[k!] || 0), 0)
      const rp = receiverTeamIds.filter(k => k).reduce((sum, k) => sum + (gp[k!] || 0), 0)
      
      const ad = settings.scoring_type === 'ad'
      
      if ((ad && rp >= 3 && rp >= sp) || (!ad && rp >= 3)) {
        if ((ad && rp > sp) || (!ad && rp >= 3)) {
          isBreakPoint = true
          if (server) stats.players[server].serve.breakPointsFaced += 1
          if (receiver) stats.players[receiver].return.breakPointOpportunities += 1
        }
      }

      if ((ad && sp >= 3 && sp > rp) || (!ad && sp >= 3 && rp < 3)) {
        isGamePoint = true
        if (server) stats.players[server].individualMatch.gamePointsOpportunityOnServe += 1
      }
    }
    
    if (isBreakPoint && server && serverTeamIds.includes(winner)) {
      stats.players[server].serve.breakPointsSaved += 1
    }
    if (isBreakPoint && receiver && receiverTeamIds.includes(winner)) {
      stats.players[receiver].return.breakPointsConverted += 1
    }
    if (isGamePoint && server && serverTeamIds.includes(winner)) {
      stats.players[server].individualMatch.gamePointsWonOnServe += 1
    }

    const fmt = settings.format || 'normal'
    const gamesMap: Record<string, number> = { short: 4, normal: 6, pro: 8 }
    const winScore = gamesMap[fmt] || 6
    let setPointForServer = false
    let setPointForReceiver = false
    if (!stats.currentSet.tiebreak) {
      const gs = stats.currentSet.games
      const serverTeamGames = serverTeamIds.filter(k => k).reduce((sum, k) => sum + (gs[k!] || 0), 0)
      const receiverTeamGames = receiverTeamIds.filter(k => k).reduce((sum, k) => sum + (gs[k!] || 0), 0)
      setPointForServer = (serverTeamGames >= winScore - 1 && serverTeamGames > receiverTeamGames) && isGamePoint
      setPointForReceiver = (receiverTeamGames >= winScore - 1 && receiverTeamGames > serverTeamGames) && isBreakPoint
    } else {
      const tb = stats.currentSet.tiebreak
      const serverTeamTb = serverTeamIds.filter(k => k).reduce((sum, k) => sum + (tb[k!] || 0), 0)
      const receiverTeamTb = receiverTeamIds.filter(k => k).reduce((sum, k) => sum + (tb[k!] || 0), 0)
      const tiebreakTo = settings.tiebreak === '10-point' ? 10 : 7
      setPointForServer = serverTeamTb >= tiebreakTo - 1 && serverTeamTb > receiverTeamTb
      setPointForReceiver = receiverTeamTb >= tiebreakTo - 1 && receiverTeamTb > serverTeamTb
    }
    let p1SetsWon = 0
    let p2SetsWon = 0
    for (const s of stats.sets || []) {
      const g1 = p1TeamIds.filter(pid => pid).reduce((sum, pid) => sum + (s.games[pid!] || 0), 0)
      const g2 = p2TeamIds.filter(pid => pid).reduce((sum, pid) => sum + (s.games[pid!] || 0), 0)
      if (g1 > g2) p1SetsWon += 1
      else if (g2 > g1) p2SetsWon += 1
      else if (s.tiebreak) {
        const tb1 = p1TeamIds.filter(pid => pid).reduce((sum, pid) => sum + (s.tiebreak![pid!] || 0), 0)
        const tb2 = p2TeamIds.filter(pid => pid).reduce((sum, pid) => sum + (s.tiebreak![pid!] || 0), 0)
        if (tb1 > tb2) p1SetsWon += 1
        else if (tb2 > tb1) p2SetsWon += 1
      }
    }
    const bestOf = parseInt(settings.best_of || '3')
    const setsToWin = Math.floor(bestOf / 2) + 1
    const serverTeamSetsWon = serverTeamIds[0] && p1TeamIds.includes(serverTeamIds[0]) ? p1SetsWon : p2SetsWon
    const receiverTeamSetsWon = receiverTeamIds[0] && p1TeamIds.includes(receiverTeamIds[0]) ? p1SetsWon : p2SetsWon
    const matchPointForServer = setPointForServer && serverTeamSetsWon >= setsToWin - 1
    const matchPointForReceiver = setPointForReceiver && receiverTeamSetsWon >= setsToWin - 1

    if (setPointForServer && server) {
      stats.players[server].individualMatch.setPointOpportunityOnServe += 1
      if (serverTeamIds.includes(winner)) stats.players[server].individualMatch.setPointsWonOnServe += 1
    }
    if (setPointForReceiver && receiver) {
      stats.players[receiver].individualMatch.setPointOpportunityOnReturn += 1
      if (receiverTeamIds.includes(winner)) stats.players[receiver].individualMatch.setPointsWonOnReturn += 1
    }
    if (matchPointForServer && server) {
      stats.players[server].individualMatch.matchPointOpportunityOnServe += 1
      if (serverTeamIds.includes(winner)) stats.players[server].individualMatch.matchPointsWonOnServe += 1
    }
    if (matchPointForReceiver && receiver) {
      stats.players[receiver].individualMatch.matchPointOpportunityOnReturn += 1
      if (receiverTeamIds.includes(winner)) stats.players[receiver].individualMatch.matchPointsWonOnReturn += 1
    }
    if (setPointForReceiver && server) {
      stats.players[server].individualMatch.setPointFacedOnServe += 1
      if (serverTeamIds.includes(winner)) stats.players[server].individualMatch.setPointsSavedOnServe += 1
    }
    if (matchPointForReceiver && server) {
      stats.players[server].individualMatch.matchPointFacedOnServe += 1
      if (serverTeamIds.includes(winner)) stats.players[server].individualMatch.matchPointsSavedOnServe += 1
    }
    if (stats.currentSet.tiebreak !== null) {
      if (server) {
        stats.players[server].serve.tiebreakServePointsPlayed += 1
        if (serverTeamIds.includes(winner)) stats.players[server].serve.tiebreakServePointsWon += 1
      }
      if (receiver) {
        stats.players[receiver].return.tiebreakReturnPointsPlayed += 1
        if (receiverTeamIds.includes(winner)) stats.players[receiver].return.tiebreakReturnPointsWon += 1
      }
    }
    const serveSide: 'deuce' | 'ad' = (() => {
      if (!stats.currentSet.tiebreak) {
        const gp = stats.currentGame.points
        const total = Object.values(gp).reduce((a, b) => a + b, 0)
        return total % 2 === 0 ? 'ad' : 'deuce'
      }
      const tb = stats.currentSet.tiebreak
      const total = Object.values(tb).reduce((a, b) => a + b, 0)
      return total % 2 === 0 ? 'deuce' : 'ad'
    })()
    if (server) {
      if (serveSide === 'deuce') {
        stats.players[server].serve.deuceSidePointsPlayed += 1
        if (serverTeamIds.includes(winner)) stats.players[server].serve.deuceSidePointsWon += 1
      } else {
        stats.players[server].serve.adSidePointsPlayed += 1
        if (serverTeamIds.includes(winner)) stats.players[server].serve.adSidePointsWon += 1
      }
    }

    const allPids = [...p1TeamIds, ...p2TeamIds].filter((p): p is string => !!p)
    for (const pid of allPids) {
      ensurePlayer(stats, pid)
      stats.players[pid].individualMatch.pointsPlayed += 1
    }
    if (winner) {
      stats.players[winner].individualMatch.pointsWon += 1
    }
    
    stats.matchTotals.pointsPlayed += 1
    if (p1TeamIds.includes(winner)) {
      stats.matchTotals.pointsWon += 1
    }

    const actionTypes = event.actions.map(act => act.type.toUpperCase())
    const isServingTeamWinner = server ? serverTeamIds.includes(winner) : false
    const isFirstServePoint = actionTypes.includes('FIRST_IN') || (actionTypes.includes('ACE') && !actionTypes.includes('SECOND_SERVE_ACE'))
    const isSecondServePoint = actionTypes.includes('SECOND_IN') || actionTypes.includes('SECOND_SERVE_ACE') || actionTypes.includes('DOUBLE FAULT') || actionTypes.includes('FOOT_FAULT_ERROR')
    const isReturnError = actionTypes.some(t => t.startsWith('RETURN'))

    if (server) {
      const sv = stats.players[server].serve
      sv.servicePointsPlayed += 1
      if (isServingTeamWinner) {
        sv.servicePointsWon += 1
      }

      const sStats = stats.players[server].serve
      if (isFirstServePoint) {
        sStats.firstServePointsPlayed += 1
        if (isServingTeamWinner) {
          sStats.firstServePointsWon += 1
        }
      } else if (isSecondServePoint) {
        sStats.secondServePointsPlayed += 1
        if (isServingTeamWinner) {
          sStats.secondServePointsWon += 1
        }
      }
    }
    
    if (receiver) {
      const rv = stats.players[receiver].return
      rv.returnPointsPlayed += 1
      if (!isServingTeamWinner) {
        rv.returnPointsWon += 1
      }

      if (serveSide === 'deuce') {
        rv.deuceSidePointsPlayed += 1
        if (!isServingTeamWinner) rv.deuceSidePointsWon += 1
      } else {
        rv.adSidePointsPlayed += 1
        if (!isServingTeamWinner) rv.adSidePointsWon += 1
      }
      
      const rStats = stats.players[receiver].return
      if (isFirstServePoint) {
        rStats.firstServeReturnAttempted += 1
        rStats.firstServeReturnPointsPlayed += 1
        if (!isReturnError) {
          rStats.firstServeReturnMade += 1
          rStats.totalReturnMade += 1
        }
        if (!isServingTeamWinner) {
          rStats.firstServeReturnPointsWon += 1
        }
      } else if (isSecondServePoint) {
        rStats.secondServeReturnAttempted += 1
        rStats.secondServeReturnPointsPlayed += 1
        if (!isReturnError) {
          rStats.secondServeReturnMade += 1
          rStats.totalReturnMade += 1
        }
        if (!isServingTeamWinner) {
          rStats.secondServeReturnPointsWon += 1
        }
      }
    }

    for (const [playerId, wasAtNet] of Object.entries(netChoices)) {
      if (wasAtNet) {
        ensurePlayer(stats, playerId)
        stats.players[playerId].rally.netPointsAttempted += 1

        const isPlayerOnWinningTeam = (p1TeamIds.includes(winner) && p1TeamIds.includes(playerId)) ||
                                      (p2TeamIds.includes(winner) && p2TeamIds.includes(playerId))

        if (isPlayerOnWinningTeam) {
          stats.players[playerId].rally.netPointsWon += 1
        }
      }
    }

    for (const act of event.actions) {
      const pid = act.actorId
      const typ = act.type.toUpperCase()
      ensurePlayer(stats, pid)
      const sStats = stats.players[pid].serve
      const rStats = stats.players[pid].rally
      const oStats = stats.players[pid].other
      
      if (typ === 'ACE') {
        if (!actionTypes.includes('SECOND_SERVE_ACE')) {
          sStats.aces += 1
          sStats.firstServeIn += 1
          sStats.firstServeAttempted += 1
          if (p1TeamIds.includes(pid)) stats.matchTotals.winners += 1
        }
      } else if (typ === 'SECOND_SERVE_ACE') {
        sStats.aces += 1
        sStats.secondServeIn += 1
        sStats.secondServeAttempted += 1
        if (p1TeamIds.includes(pid)) stats.matchTotals.winners += 1
      } else if (typ === 'DOUBLE FAULT') {
        sStats.doubleFaults += 1
        sStats.secondServeAttempted += 1
        if (p1TeamIds.includes(pid)) stats.matchTotals.errors += 1
      } else if (typ === 'FIRST_SERVE_FAULT') {
        sStats.firstServeAttempted += 1
      } else if (typ === 'FIRST_IN') {
        sStats.firstServeIn += 1
        sStats.firstServeAttempted += 1
      } else if (typ === 'SECOND_IN') {
        sStats.secondServeIn += 1
        sStats.secondServeAttempted += 1
      } else if (typ === 'WINNER') {
        rStats.winners += 1
        if (p1TeamIds.includes(pid)) stats.matchTotals.winners += 1
      } else if (typ === 'UNFORCED ERROR') {
        rStats.unforcedErrors += 1
        if (p1TeamIds.includes(pid)) stats.matchTotals.errors += 1
      } else if (typ === 'FORCED ERROR') {
        rStats.forcedErrors += 1
        if (p2TeamIds.includes(pid)) stats.matchTotals.winners += 1
      } else if (typ === 'RETURN_UNFORCED_ERROR') {
        stats.players[pid].return.returnUnforcedErrors += 1
        rStats.unforcedErrors += 1
        if (p1TeamIds.includes(pid)) stats.matchTotals.errors += 1
        if (server) stats.players[server].serve.servesUnreturned += 1
      } else if (typ === 'RETURN_FORCED_ERROR') {
        stats.players[pid].return.returnForcedErrors += 1
        if (p2TeamIds.includes(pid)) stats.matchTotals.winners += 1
        if (server) stats.players[server].serve.servesUnreturned += 1
      } else if (typ === 'LET') {
        oStats.lets += 1
      } else if (typ === 'FOOT_FAULT') {
        oStats.footFaults += 1
        sStats.firstServeAttempted += 1
      } else if (typ === 'FOOT_FAULT_ERROR') {
        oStats.footFaults += 1
        sStats.doubleFaults += 1
        rStats.unforcedErrors += 1
        sStats.secondServeAttempted += 1
        if (p1TeamIds.includes(pid)) stats.matchTotals.errors += 1
      } else if (typ.startsWith('PENALTY_')) {
        oStats.penalties += 1
        rStats.unforcedErrors += 1
        const penaltyWinnerTeamIds = p1TeamIds.includes(pid) ? p2TeamIds : p1TeamIds
        const penaltyWinner = penaltyWinnerTeamIds[0]
        if (typ === 'PENALTY_GAME_UE' && penaltyWinner) {
          stats.currentGame.points = { [penaltyWinner]: 4 }
        } else if (typ === 'PENALTY_SET_UE' && penaltyWinner) {
          const winScore = ({ short: 4, normal: 6, pro: 8 } as any)[settings.format || 'normal'] || 6
          stats.currentSet.games = { [penaltyWinner]: winScore }
          stats.currentGame.points = {}
        } else if (typ === 'PENALTY_MATCH_UE') {
          stats.matchWinner = penaltyWinner || null
          stats.matchLoser = pid
        }
      } else {
        for (const [baseType, statKey] of Object.entries(infractionMap)) {
          if (typ.startsWith(baseType)) {
            oStats[statKey] += 1
            if (typ.endsWith('_UE')) {
              rStats.unforcedErrors += 1
              if (p1TeamIds.includes(pid)) stats.matchTotals.errors += 1
            } else if (typ.endsWith('_FE')) {
              rStats.forcedErrors += 1
              if (p2TeamIds.includes(pid)) stats.matchTotals.winners += 1
            }
            break
          }
        }
      }
    }
    
    for (const location of ballLocations) {
      if (!location.x || !location.y) continue
      
      const locPlayerId = location.playerId || server || receiver
      if (!locPlayerId) continue
      
      const heatmapEntry = {
        x: location.x,
        y: location.y,
        playerId: locPlayerId,
        isIn: location.isIn !== false
      }
      
      if (location.type === 'serve') {
        stats.aggregate.heatmaps.serves.push({
          ...heatmapEntry,
          placement: location.servePlacement || servePlacement
        })
        stats.aggregate.heatmaps.byStrokeType.serve.push({
          ...heatmapEntry,
          placement: location.servePlacement || servePlacement
        })
        
        if (locPlayerId && (location.servePlacement || servePlacement)) {
          const placement = location.servePlacement || servePlacement
          if (placement && (placement === 'body' || placement === 'wide' || placement === 't')) {
            if (!stats.aggregate.servePlacements[locPlayerId]) {
              stats.aggregate.servePlacements[locPlayerId] = {
                body: { attempted: 0, in: 0 },
                wide: { attempted: 0, in: 0 },
                t: { attempted: 0, in: 0 }
              }
            }
            stats.aggregate.servePlacements[locPlayerId][placement].attempted += 1
            if (location.isIn !== false) {
              stats.aggregate.servePlacements[locPlayerId][placement].in += 1
            }
          }
        }
      } else if (location.type === 'return') {
        const returnEntry = {
          ...heatmapEntry,
          strokeType: location.strokeType
        }
        stats.aggregate.heatmaps.returns.push(returnEntry)
        stats.aggregate.heatmaps.byStrokeType.return.push(returnEntry)
        if (location.strokeType && stats.aggregate.heatmaps.byStrokeType[location.strokeType]) {
          stats.aggregate.heatmaps.byStrokeType[location.strokeType].push(heatmapEntry)
        }
      } else if (location.type === 'rally') {
        const rallyEntry = {
          ...heatmapEntry,
          strokeType: location.strokeType
        }
        stats.aggregate.heatmaps.rally.push(rallyEntry)
        if (location.strokeType && stats.aggregate.heatmaps.byStrokeType[location.strokeType]) {
          stats.aggregate.heatmaps.byStrokeType[location.strokeType].push(heatmapEntry)
        }
      }
    }
    
    for (const [playerId, shots] of Object.entries(shotTypes)) {
      if (!stats.aggregate.shotTypeCounts[playerId]) {
        stats.aggregate.shotTypeCounts[playerId] = {}
      }
      for (const shotType of shots) {
        stats.aggregate.shotTypeCounts[playerId][shotType] = 
          (stats.aggregate.shotTypeCounts[playerId][shotType] || 0) + 1
      }
    }
    
    for (const [playerId, errors] of Object.entries(errorTypes)) {
      if (!stats.aggregate.errorTypeCounts[playerId]) {
        stats.aggregate.errorTypeCounts[playerId] = {}
      }
      for (const errorType of errors) {
        stats.aggregate.errorTypeCounts[playerId][errorType] = 
          (stats.aggregate.errorTypeCounts[playerId][errorType] || 0) + 1
      }
    }
    
    for (const [playerId, winners] of Object.entries(winnerTypes)) {
      if (!stats.aggregate.winnerTypeCounts[playerId]) {
        stats.aggregate.winnerTypeCounts[playerId] = {}
      }
      for (const winnerType of winners) {
        stats.aggregate.winnerTypeCounts[playerId][winnerType] = 
          (stats.aggregate.winnerTypeCounts[playerId][winnerType] || 0) + 1
      }
      if (winner && receiver && playerId === winner && winner === receiver && winners.includes('return')) {
        stats.players[winner].return.returnWinners += 1
      }
    }
    
    const shotTypeErrorMap: Record<string, 'forehandErrors' | 'backhandErrors' | 'volleyErrors' | 'overheadErrors'> = {
      forehand: 'forehandErrors', backhand: 'backhandErrors', volley: 'volleyErrors', overhead: 'overheadErrors'
    }
    const shotTypeWinnerMap: Record<string, 'forehandWinners' | 'backhandWinners' | 'volleyWinners' | 'overheadWinners'> = {
      forehand: 'forehandWinners', backhand: 'backhandWinners', volley: 'volleyWinners', overhead: 'overheadWinners'
    }
    for (const [playerId, errors] of Object.entries(errorTypes)) {
      if (errors.length > 0 && shotTypes[playerId] && shotTypes[playerId].length > 0) {
        const lastShot = shotTypes[playerId][shotTypes[playerId].length - 1]
        const field = shotTypeErrorMap[lastShot]
        if (field && stats.players[playerId]) {
          stats.players[playerId].rally[field] += 1
        }
      }
    }
    for (const [playerId, wins] of Object.entries(winnerTypes)) {
      if (wins.length > 0 && shotTypes[playerId] && shotTypes[playerId].length > 0) {
        const lastShot = shotTypes[playerId][shotTypes[playerId].length - 1]
        const field = shotTypeWinnerMap[lastShot]
        if (field && stats.players[playerId]) {
          stats.players[playerId].rally[field] += 1
        }
      }
    }

    if (winner) {
      stats.players[winner].rally.totalRallyLength += rallyLength
      stats.players[winner].rally.rallyCount += 1
      
      const allPidsInMatch = [...p1TeamIds, ...p2TeamIds].filter(p => p)
      for (const pid of allPidsInMatch) {
        if (pid) {
          if (rallyLength > stats.players[pid].rally.longestRallyLength) {
            stats.players[pid].rally.longestRallyLength = rallyLength
          }
          if (event.rallyLength != null && event.rallyLength !== 2) {
            stats.players[pid].individualMatch.rallyCounterUsed = true
          }
          if (rallyLength <= 4) {
            stats.players[pid].individualMatch.rallyShortPlayed += 1
            if (pid === winner || (p1TeamIds.includes(winner) && p1TeamIds.includes(pid)) || (p2TeamIds.includes(winner) && p2TeamIds.includes(pid))) {
              stats.players[pid].individualMatch.rallyShortWon += 1
            }
          } else if (rallyLength <= 8) {
            stats.players[pid].individualMatch.rallyMediumPlayed += 1
            if (pid === winner || (p1TeamIds.includes(winner) && p1TeamIds.includes(pid)) || (p2TeamIds.includes(winner) && p2TeamIds.includes(pid))) {
              stats.players[pid].individualMatch.rallyMediumWon += 1
            }
          } else {
            stats.players[pid].individualMatch.rallyLongPlayed += 1
            if (pid === winner || (p1TeamIds.includes(winner) && p1TeamIds.includes(pid)) || (p2TeamIds.includes(winner) && p2TeamIds.includes(pid))) {
              stats.players[pid].individualMatch.rallyLongWon += 1
            }
          }
        }
      }
    }
    
    if (winner) {
      const winnerTeam = p1TeamIds.includes(winner) ? 'p1' : 'p2'
      if (lastPointWinnerTeam === winnerTeam) {
        currentPointStreaks[winnerTeam] += 1
      } else {
        if (lastPointWinnerTeam) {
          currentPointStreaks[lastPointWinnerTeam as 'p1' | 'p2'] = 0
        }
        currentPointStreaks[winnerTeam] = 1
      }
      lastPointWinnerTeam = winnerTeam

      const teamIdsToUpdate = winnerTeam === 'p1' ? p1TeamIds : p2TeamIds
      const streak = currentPointStreaks[winnerTeam]
      for (const pid of teamIdsToUpdate) {
        if (pid && stats.players[pid].individualMatch.longestPointStreak < streak) {
          stats.players[pid].individualMatch.longestPointStreak = streak
        }
      }
    }
    
    const gameWasWon = winPointGame(stats, winner, loser || '', server || '', receiver || '', settings)

    if (gameWasWon) {
      const gameWinnerTeam = p1TeamIds.includes(winner) ? 'p1' : 'p2'
      if (lastGameWinnerTeam === gameWinnerTeam) {
        currentGameStreaks[gameWinnerTeam] += 1
      } else {
        if (lastGameWinnerTeam) {
          currentGameStreaks[lastGameWinnerTeam as 'p1' | 'p2'] = 0
        }
        currentGameStreaks[gameWinnerTeam] = 1
      }
      lastGameWinnerTeam = gameWinnerTeam

      const teamIdsToUpdate = gameWinnerTeam === 'p1' ? p1TeamIds : p2TeamIds
      const streak = currentGameStreaks[gameWinnerTeam]
      for (const pid of teamIdsToUpdate) {
        if (pid && stats.players[pid].individualMatch.longestGameStreak < streak) {
          stats.players[pid].individualMatch.longestGameStreak = streak
        }
      }
    }
    
    if (gameWasWon && winSet(stats, settings)) {
      checkMatchEnd(stats, settings)
    }
  }
  
  if (history.length === 0) {
    stats.server = null
  }

  stats.history = JSON.parse(JSON.stringify(history))
  return stats
}

export function recordPoint(matchId: number, oldStats: MatchStats, event: PointEvent, settings: MatchSettings): MatchStats {
  if (oldStats.matchWinner) {
    return oldStats
  }
  const history = oldStats.history || []
  history.push(event)
  return applyHistory(matchId, history, settings)
}

export function undoPoint(matchId: number, oldStats: MatchStats, settings: MatchSettings): MatchStats {
  const history = [...(oldStats.history || [])]
  const hadPoints = history.length > 0
  if (history.length > 0) {
    history.pop()
  }
  let newStats = applyHistory(matchId, history, settings)
  if (hadPoints && history.length === 0 && settings.server) {
    newStats = setServer(newStats, settings.server, settings)
  }
  return newStats
}
