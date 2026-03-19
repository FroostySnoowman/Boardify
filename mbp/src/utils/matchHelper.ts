// Ported from api/src/match-helper.ts
// Client-side stat calculation for guest matches

import { Stats, PointEvent } from '../api/matches';

export interface MatchSettings {
  yourPlayer1: string;
  yourPlayer2?: string | null;
  oppPlayer1: string;
  oppPlayer2?: string | null;
  scoring_type: string;
  tiebreak: string;
  games_to: number;
  best_of: string;
  format: string;
  server?: string | null;
  matchType?: string;
  tiebreak_trigger?: string | null;
}

export function initStats(matchId: number | string): Stats {
  return {
    matchId: typeof matchId === 'string' ? parseInt(matchId.replace('guest-', '')) || 0 : matchId,
    players: {},
    matchTotals: {
      matchesPlayed: 0,
      matchesWon: 0,
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
      lossesVsRighty: 0,
    },
    aggregate: {
      momentum: [],
      pointsPlayedAfterHour: 0,
      pointsWonAfterHour: 0,
    },
    history: [],
    currentGame: {
      points: {},
      serverPoints: 0,
      receiverPoints: 0,
      serverDisplay: '0',
      receiverDisplay: '0',
    },
    currentSet: { games: {}, tiebreak: null },
    sets: [],
    matchWinner: null,
    matchLoser: null,
    server: null,
    serve_order: [],
  };
}

export function setServer(stats: Stats, serverId: string, settings: MatchSettings): Stats {
  stats.server = serverId;
  const isDoubles = settings.matchType === 'doubles';

  if (isDoubles) {
    if (!stats.serve_order) {
      stats.serve_order = [];
    }

    const serveOrder = stats.serve_order;

    if (!serveOrder.includes(serverId)) {
      serveOrder.push(serverId);
    }

    if (serveOrder.length === 2) {
      const p1So = serveOrder[0];
      const p2So = serveOrder[1];

      const yourP1 = settings.yourPlayer1;
      const yourP2 = settings.yourPlayer2;
      const oppP1 = settings.oppPlayer1;
      const oppP2 = settings.oppPlayer2;

      let p1Partner: string | null = null;
      let p2Partner: string | null = null;

      if (p1So === yourP1) p1Partner = yourP2 || null;
      else if (p1So === yourP2) p1Partner = yourP1;
      else if (p1So === oppP1) p1Partner = oppP2 || null;
      else if (p1So === oppP2) p1Partner = oppP1;

      if (p2So === yourP1) p2Partner = yourP2 || null;
      else if (p2So === yourP2) p2Partner = yourP1;
      else if (p2So === oppP1) p2Partner = oppP2 || null;
      else if (p2So === oppP2) p2Partner = oppP1;

      if (p1Partner && p2Partner) {
        stats.serve_order = [p1So, p2So, p1Partner, p2Partner];
      }
    }
  }

  return stats;
}

function ensurePlayer(stats: Stats, pid: string): void {
  if (!stats.players[pid]) {
    stats.players[pid] = {
      serve: {
        aces: 0,
        doubleFaults: 0,
        firstServeIn: 0,
        firstServeAttempted: 0,
        firstServePointsWon: 0,
        firstServePointsPlayed: 0,
        secondServeIn: 0,
        secondServeAttempted: 0,
        secondServePointsWon: 0,
        secondServePointsPlayed: 0,
        servicePointsWon: 0,
        servicePointsPlayed: 0,
        breakPointsSaved: 0,
        breakPointsFaced: 0,
        servesUnreturned: 0,
        tiebreakServePointsWon: 0,
        tiebreakServePointsPlayed: 0,
        deuceSidePointsWon: 0,
        deuceSidePointsPlayed: 0,
        adSidePointsWon: 0,
        adSidePointsPlayed: 0,
      },
      return: {
        returnPointsWon: 0,
        returnPointsPlayed: 0,
        firstServeReturnMade: 0,
        firstServeReturnAttempted: 0,
        firstServeReturnPointsWon: 0,
        firstServeReturnPointsPlayed: 0,
        secondServeReturnMade: 0,
        secondServeReturnAttempted: 0,
        secondServeReturnPointsWon: 0,
        secondServeReturnPointsPlayed: 0,
        totalReturnMade: 0,
        returnForcedErrors: 0,
        returnUnforcedErrors: 0,
        returnWinners: 0,
        breakPointsConverted: 0,
        breakPointOpportunities: 0,
        tiebreakReturnPointsWon: 0,
        tiebreakReturnPointsPlayed: 0,
        deuceSidePointsWon: 0,
        deuceSidePointsPlayed: 0,
        adSidePointsWon: 0,
        adSidePointsPlayed: 0,
      },
      rally: {
        winners: 0,
        unforcedErrors: 0,
        forcedErrors: 0,
        forcedErrorsDrawn: 0,
        netPointsWon: 0,
        netPointsAttempted: 0,
        longestRallyLength: 0,
        totalRallyLength: 0,
        rallyCount: 0,
        forehandWinners: 0,
        forehandErrors: 0,
        backhandWinners: 0,
        backhandErrors: 0,
        volleyWinners: 0,
        volleyErrors: 0,
        overheadWinners: 0,
        overheadErrors: 0,
      },
      other: {
        lets: 0,
        footFaults: 0,
        touchingNet: 0,
        ballHitsBody: 0,
        carry: 0,
        hitsFixture: 0,
        racquetDropped: 0,
        reachOverNet: 0,
        penalties: 0,
      },
      individualMatch: {
        pointsWon: 0,
        pointsPlayed: 0,
        serviceGamesWon: 0,
        serviceGamesPlayed: 0,
        returnGamesWon: 0,
        returnGamesPlayed: 0,
        breakPointsConverted: 0,
        breakPointOpportunities: 0,
        gamePointsWonOnServe: 0,
        gamePointsOpportunityOnServe: 0,
        gamePointsWonOnReturn: 0,
        gamePointsOpportunityOnReturn: 0,
        loveGamesWon: 0,
        loveGamesLost: 0,
        longestPointStreak: 0,
        longestGameStreak: 0,
        setPointOpportunityOnServe: 0,
        setPointsWonOnServe: 0,
        setPointOpportunityOnReturn: 0,
        setPointsWonOnReturn: 0,
        matchPointOpportunityOnServe: 0,
        matchPointsWonOnServe: 0,
        matchPointOpportunityOnReturn: 0,
        matchPointsWonOnReturn: 0,
        setPointFacedOnServe: 0,
        setPointsSavedOnServe: 0,
        matchPointFacedOnServe: 0,
        matchPointsSavedOnServe: 0,
        rallyShortWon: 0,
        rallyShortPlayed: 0,
        rallyMediumWon: 0,
        rallyMediumPlayed: 0,
        rallyLongWon: 0,
        rallyLongPlayed: 0,
        rallyCounterUsed: false,
      },
    };
  }
}

function formatScore(sp: number, rp: number, ad: boolean, isTiebreak: boolean): [string, string] {
  if (isTiebreak) {
    return [String(sp), String(rp)];
  }
  const labels = ['0', '15', '30', '40'];
  if (sp >= 3 && rp >= 3) {
    if (sp === rp) {
      return ['40', '40'];
    } else if (sp > rp) {
      return ['Ad', ''];
    } else {
      return ['', 'Ad'];
    }
  }
  return [labels[Math.min(sp, 3)], labels[Math.min(rp, 3)]];
}

function winPointGame(
  stats: Stats,
  winner: string,
  loser: string,
  server: string,
  receiver: string,
  settings: MatchSettings
): boolean {
  const isTiebreak = stats.currentSet.tiebreak !== null;

  const p1TeamIds = [settings.yourPlayer1];
  if (settings.yourPlayer2) {
    p1TeamIds.push(settings.yourPlayer2);
  }

  const p2TeamIds = [settings.oppPlayer1];
  if (settings.oppPlayer2) {
    p2TeamIds.push(settings.oppPlayer2);
  }

  if (isTiebreak) {
    const tbScores = stats.currentSet.tiebreak!;
    tbScores[winner] = (tbScores[winner] || 0) + 1;
    const totalPoints = Object.values(tbScores).reduce((a, b) => a + b, 0);

    const serveOrder = stats.serve_order || [];
    const isDoubles = settings.matchType === 'doubles';
    if (totalPoints === 1 || (totalPoints > 1 && (totalPoints - 1) % 2 === 0)) {
      if (isDoubles && serveOrder.length === 4) {
        try {
          const currentServerOfGame = server;
          const currentIdx = serveOrder.indexOf(currentServerOfGame);
          const nextIdx = (currentIdx + 1) % 4;
          stats.server = serveOrder[nextIdx];
        } catch {
          stats.server = receiver;
        }
      } else {
        stats.server = receiver;
      }
    }

    const serverTeamIds = p1TeamIds.includes(stats.server!) ? p1TeamIds : p2TeamIds;
    const sp = serverTeamIds.filter((pid) => pid).reduce((sum, pid) => sum + (tbScores[pid] || 0), 0);
    const rp = Object.values(tbScores).reduce((a, b) => a + b, 0) - sp;

    const [sd, rd] = formatScore(sp, rp, false, true);
    stats.currentGame.serverDisplay = sd;
    stats.currentGame.receiverDisplay = rd;
    return false;
  }

  const gp = stats.currentGame.points;

  const serverTeamKeys = p1TeamIds.includes(server) ? p1TeamIds : p2TeamIds;
  const receiverTeamKeys = p1TeamIds.includes(server) ? p2TeamIds : p1TeamIds;

  const spBefore = serverTeamKeys.filter((k) => k).reduce((sum, k) => sum + (gp[k] || 0), 0);
  const rpBefore = receiverTeamKeys.filter((k) => k).reduce((sum, k) => sum + (gp[k] || 0), 0);

  gp[winner] = (gp[winner] || 0) + 1;

  const spAfter = serverTeamKeys.filter((k) => k).reduce((sum, k) => sum + (gp[k] || 0), 0);
  const rpAfter = receiverTeamKeys.filter((k) => k).reduce((sum, k) => sum + (gp[k] || 0), 0);

  const ad = settings.scoring_type === 'ad';
  const [sd, rd] = formatScore(spAfter, rpAfter, ad, false);
  stats.currentGame.serverPoints = spAfter;
  stats.currentGame.receiverPoints = rpAfter;
  stats.currentGame.serverDisplay = sd;
  stats.currentGame.receiverDisplay = rd;

  const isGameOver = (spAfter >= 4 || rpAfter >= 4) && Math.abs(spAfter - rpAfter) >= (ad ? 2 : 1);

  if (isGameOver) {
    const win = spAfter > rpAfter ? server : receiver;

    const winningTeamIds = p1TeamIds.includes(win) ? p1TeamIds : p2TeamIds;

    ensurePlayer(stats, server);
    stats.players[server].individualMatch.serviceGamesPlayed += 1;
    if (receiver) {
      ensurePlayer(stats, receiver);
      stats.players[receiver].individualMatch.returnGamesPlayed += 1;
    }

    if (serverTeamKeys.includes(win)) {
      stats.players[server].individualMatch.serviceGamesWon += 1;
    } else {
      if (receiver) {
        stats.players[receiver].individualMatch.returnGamesWon += 1;
      }
    }

    const gs = stats.currentSet.games;
    const gameWinnerRepr = win;
    gs[gameWinnerRepr] = (gs[gameWinnerRepr] || 0) + 1;

    stats.matchTotals.gamesPlayed += 1;
    if (p1TeamIds.includes(win)) {
      stats.matchTotals.gamesWon += 1;
    }

    if (rpBefore === 0 && win === server) {
      for (const pid of winningTeamIds) {
        if (pid) stats.players[pid].individualMatch.loveGamesWon += 1;
      }
      const losingTeamIds = p1TeamIds.includes(win) ? p2TeamIds : p1TeamIds;
      for (const pid of losingTeamIds) {
        if (pid) stats.players[pid].individualMatch.loveGamesLost += 1;
      }
    }

    stats.currentGame = {
      points: {},
      serverPoints: 0,
      receiverPoints: 0,
      serverDisplay: '0',
      receiverDisplay: '0',
    };

    const currentServer = server;
    const isDoubles = settings.matchType === 'doubles';

    if (!isDoubles) {
      stats.server = receiver;
    } else {
      const serveOrder = stats.serve_order || [];

      if (serveOrder.length === 4) {
        try {
          const currentIdx = serveOrder.indexOf(currentServer);
          const nextIdx = (currentIdx + 1) % 4;
          stats.server = serveOrder[nextIdx];
        } catch {
          stats.server = null;
        }
      } else {
        stats.server = null;
      }
    }

    return true;
  }
  return false;
}

function winSet(stats: Stats, settings: MatchSettings): boolean {
  const gs = stats.currentSet.games;

  const p1TeamIds = [settings.yourPlayer1];
  if (settings.yourPlayer2) {
    p1TeamIds.push(settings.yourPlayer2);
  }

  const p2TeamIds = [settings.oppPlayer1];
  if (settings.oppPlayer2) {
    p2TeamIds.push(settings.oppPlayer2);
  }

  const g1 = p1TeamIds.filter((pid) => pid).reduce((sum, pid) => sum + (gs[pid] || 0), 0);
  const g2 = p2TeamIds.filter((pid) => pid).reduce((sum, pid) => sum + (gs[pid] || 0), 0);

  const t = settings.tiebreak;
  const fmt = settings.format || 'normal';
  const gamesMap: Record<string, number> = { short: 4, normal: 6, pro: 8 };
  const winScore = gamesMap[fmt] || 6;

  let tiebreakScore = winScore;
  const tiebreakTriggerStr = settings.tiebreak_trigger;
  if (tiebreakTriggerStr && tiebreakTriggerStr !== 'None') {
    try {
      tiebreakScore = parseInt(tiebreakTriggerStr.split('-')[0]);
    } catch {
      // Keep default
    }
  }

  let isSetOver = false;

  if ((g1 >= winScore || g2 >= winScore) && Math.abs(g1 - g2) >= 2) {
    isSetOver = true;
  } else if (t !== 'None' && g1 === tiebreakScore && g2 === tiebreakScore) {
    if (stats.currentSet.tiebreak !== null) {
      const tb = stats.currentSet.tiebreak;
      const p1TbScore = p1TeamIds.filter((pid) => pid).reduce((sum, pid) => sum + (tb[pid] || 0), 0);
      const p2TbScore = p2TeamIds.filter((pid) => pid).reduce((sum, pid) => sum + (tb[pid] || 0), 0);
      const tiebreakTo = settings.tiebreak === '10-point' ? 10 : 7;
      if ((p1TbScore >= tiebreakTo || p2TbScore >= tiebreakTo) && Math.abs(p1TbScore - p2TbScore) >= 2) {
        isSetOver = true;
      }
    } else {
      const allPlayers = [...p1TeamIds, ...p2TeamIds].filter((p) => p);
      const tiebreakInit: Record<string, number> = {};
      for (const pid of allPlayers) {
        tiebreakInit[pid] = 0;
      }
      stats.currentSet.tiebreak = tiebreakInit;
    }
  }

  if (!isSetOver) {
    return false;
  }

  stats.sets.push({
    games: { ...gs },
    tiebreak: stats.currentSet.tiebreak ? { ...stats.currentSet.tiebreak } : null,
  });
  stats.currentSet = { games: {}, tiebreak: null };

  if (settings.matchType === 'doubles' && !stats.matchWinner) {
    stats.serve_order = [];
    stats.server = null;
  }

  return true;
}

function checkMatchEnd(stats: Stats, settings: MatchSettings): void {
  if (stats.matchWinner) {
    return;
  }

  const bestOf = parseInt(settings.best_of || '3');
  const setsToWin = Math.floor(bestOf / 2) + 1;

  const p1TeamIds = [settings.yourPlayer1];
  if (settings.yourPlayer2) {
    p1TeamIds.push(settings.yourPlayer2);
  }

  const p2TeamIds = [settings.oppPlayer1];
  if (settings.oppPlayer2) {
    p2TeamIds.push(settings.oppPlayer2);
  }

  let p1SetsWon = 0;
  let p2SetsWon = 0;

  for (const s of stats.sets || []) {
    const g1 = p1TeamIds.filter((pid) => pid).reduce((sum, pid) => sum + (s.games[pid] || 0), 0);
    const g2 = p2TeamIds.filter((pid) => pid).reduce((sum, pid) => sum + (s.games[pid] || 0), 0);

    let winnerFoundInSet = false;
    if (g1 > g2) {
      p1SetsWon += 1;
      winnerFoundInSet = true;
    } else if (g2 > g1) {
      p2SetsWon += 1;
      winnerFoundInSet = true;
    }

    if (!winnerFoundInSet && s.tiebreak) {
      const tb1 = p1TeamIds.filter((pid) => pid).reduce((sum, pid) => sum + (s.tiebreak![pid] || 0), 0);
      const tb2 = p2TeamIds.filter((pid) => pid).reduce((sum, pid) => sum + (s.tiebreak![pid] || 0), 0);
      if (tb1 > tb2) {
        p1SetsWon += 1;
      } else if (tb2 > tb1) {
        p2SetsWon += 1;
      }
    }
  }

  let winner: string | null = null;
  if (p1SetsWon >= setsToWin) {
    winner = settings.yourPlayer1;
  } else if (p2SetsWon >= setsToWin) {
    winner = settings.oppPlayer1;
  }

  if (winner) {
    stats.matchWinner = winner;
    stats.matchLoser = winner === settings.yourPlayer1 ? settings.oppPlayer1 : settings.yourPlayer1;
  }
}

// This is a simplified version - the full applyHistory is very complex
// For guest matches, we'll use recordPoint which calls applyHistory
export function applyHistory(matchId: number | string, history: PointEvent[], settings: MatchSettings): Stats {
  const stats = initStats(matchId);

  // This is a simplified version - the full implementation is in the backend
  // For now, we'll rebuild stats from history by replaying each point
  // This matches the backend logic but is simplified for client-side use

  let lastPointWinnerTeam: string | null = null;
  const currentPointStreaks = { p1: 0, p2: 0 };
  let lastGameWinnerTeam: string | null = null;
  const currentGameStreaks = { p1: 0, p2: 0 };

  const p1TeamIds = [settings.yourPlayer1, settings.yourPlayer2].filter((p) => p);
  const p2TeamIds = [settings.oppPlayer1, settings.oppPlayer2].filter((p) => p);

  const infractionMap: Record<string, keyof typeof stats.players[string]['other']> = {
    TOUCHING_NET: 'touchingNet',
    BALL_HITS_BODY: 'ballHitsBody',
    CARRY: 'carry',
    HITS_FIXTURE: 'hitsFixture',
    RACQUET_DROPPED: 'racquetDropped',
    REACH_OVER_NET: 'reachOverNet',
  };

  for (let idx = 0; idx < history.length; idx++) {
    const event = history[idx];
    const winner = event.pointWinnerId;
    const loser = event.pointLoserId || '';
    const server = event.serverId || '';
    const receiver = event.receiverId || '';
    const netChoices = event.netChoices || {};
    const rallyLength = event.rallyLength || 1;

    stats.server = server || null;

    const isDoubles = settings.matchType === 'doubles';
    if (isDoubles) {
      const serveOrder = stats.serve_order || [];
      if (server && !serveOrder.includes(server)) {
        serveOrder.push(server);
        if (serveOrder.length === 2) {
          const p1So = serveOrder[0];
          const p2So = serveOrder[1];
          const yourP1 = settings.yourPlayer1;
          const yourP2 = settings.yourPlayer2;
          const oppP1 = settings.oppPlayer1;
          const oppP2 = settings.oppPlayer2;
          let p1Partner: string | null = null;
          let p2Partner: string | null = null;
          if (p1So === yourP1) p1Partner = yourP2 || null;
          else if (p1So === yourP2) p1Partner = yourP1;
          else if (p1So === oppP1) p1Partner = oppP2 || null;
          else if (p1So === oppP2) p1Partner = oppP1;
          if (p2So === yourP1) p2Partner = yourP2 || null;
          else if (p2So === yourP2) p2Partner = yourP1;
          else if (p2So === oppP1) p2Partner = oppP2 || null;
          else if (p2So === oppP2) p2Partner = oppP1;
          if (p1Partner && p2Partner) {
            stats.serve_order = [p1So, p2So, p1Partner, p2Partner];
          }
        }
      }
    }

    const playerIdsInEvent = new Set([winner, loser, server, receiver, ...Object.keys(netChoices)]);
    for (const pid of playerIdsInEvent) {
      if (pid) {
        ensurePlayer(stats, pid);
      }
    }

    const winningTeamIsP1 = p1TeamIds.includes(winner);
    const serverTeamIds = server && p1TeamIds.includes(server) ? p1TeamIds : p2TeamIds;
    const receiverTeamIds = server && p1TeamIds.includes(server) ? p2TeamIds : p1TeamIds;

    let isBreakPoint = false;
    let isGamePoint = false;
    if (!stats.currentSet.tiebreak) {
      const gp = stats.currentGame.points;

      const sp = serverTeamIds.filter((k) => k).reduce((sum, k) => sum + (gp[k!] || 0), 0);
      const rp = receiverTeamIds.filter((k) => k).reduce((sum, k) => sum + (gp[k!] || 0), 0);

      const ad = settings.scoring_type === 'ad';

      if ((ad && rp >= 3 && rp >= sp) || (!ad && rp >= 3)) {
        if ((ad && rp > sp) || (!ad && rp >= 3)) {
          isBreakPoint = true;
          if (server) stats.players[server].serve.breakPointsFaced += 1;
          if (receiver) stats.players[receiver].return.breakPointOpportunities += 1;
        }
      }

      if ((ad && sp >= 3 && sp > rp) || (!ad && sp >= 3 && rp < 3)) {
        isGamePoint = true;
        if (server) stats.players[server].individualMatch.gamePointsOpportunityOnServe += 1;
      }
    }

    if (isBreakPoint && server && serverTeamIds.includes(winner)) {
      stats.players[server].serve.breakPointsSaved += 1;
    }
    if (isBreakPoint && receiver && receiverTeamIds.includes(winner)) {
      stats.players[receiver].return.breakPointsConverted += 1;
    }
    if (isGamePoint && server && serverTeamIds.includes(winner)) {
      stats.players[server].individualMatch.gamePointsWonOnServe += 1;
    }

    const allPids = [...p1TeamIds, ...p2TeamIds].filter((p): p is string => !!p);
    for (const pid of allPids) {
      ensurePlayer(stats, pid);
      stats.players[pid].individualMatch.pointsPlayed += 1;
    }
    if (winner) {
      stats.players[winner].individualMatch.pointsWon += 1;
    }

    stats.matchTotals.pointsPlayed += 1;
    if (p1TeamIds.includes(winner)) {
      stats.matchTotals.pointsWon += 1;
    }

    const actionTypes = event.actions.map((act) => act.type.toUpperCase());
    const isServingTeamWinner = server ? serverTeamIds.includes(winner) : false;
    const isFirstServePoint =
      actionTypes.includes('FIRST_IN') || (actionTypes.includes('ACE') && !actionTypes.includes('SECOND_SERVE_ACE'));
    const isSecondServePoint =
      actionTypes.includes('SECOND_IN') ||
      actionTypes.includes('SECOND_SERVE_ACE') ||
      actionTypes.includes('DOUBLE FAULT') ||
      actionTypes.includes('FOOT_FAULT_ERROR');
    const isReturnError = actionTypes.some((t) => t.startsWith('RETURN'));

    if (server) {
      const sv = stats.players[server].serve;
      sv.servicePointsPlayed += 1;
      if (isServingTeamWinner) {
        sv.servicePointsWon += 1;
      }

      const sStats = stats.players[server].serve;
      if (isFirstServePoint) {
        sStats.firstServePointsPlayed += 1;
        if (isServingTeamWinner) {
          sStats.firstServePointsWon += 1;
        }
      } else if (isSecondServePoint) {
        sStats.secondServePointsPlayed += 1;
        if (isServingTeamWinner) {
          sStats.secondServePointsWon += 1;
        }
      }
    }

    if (receiver) {
      const rv = stats.players[receiver].return;
      rv.returnPointsPlayed += 1;
      if (!isServingTeamWinner) {
        rv.returnPointsWon += 1;
      }

      const rStats = stats.players[receiver].return;
      if (isFirstServePoint) {
        rStats.firstServeReturnAttempted += 1;
        rStats.firstServeReturnPointsPlayed += 1;
        if (!isReturnError) {
          rStats.firstServeReturnMade += 1;
          rStats.totalReturnMade += 1;
        }
        if (!isServingTeamWinner) {
          rStats.firstServeReturnPointsWon += 1;
        }
      } else if (isSecondServePoint) {
        rStats.secondServeReturnAttempted += 1;
        rStats.secondServeReturnPointsPlayed += 1;
        if (!isReturnError) {
          rStats.secondServeReturnMade += 1;
          rStats.totalReturnMade += 1;
        }
        if (!isServingTeamWinner) {
          rStats.secondServeReturnPointsWon += 1;
        }
      }
    }

    for (const [playerId, wasAtNet] of Object.entries(netChoices)) {
      if (wasAtNet) {
        ensurePlayer(stats, playerId);
        stats.players[playerId].rally.netPointsAttempted += 1;

        const isPlayerOnWinningTeam =
          (p1TeamIds.includes(winner) && p1TeamIds.includes(playerId)) ||
          (p2TeamIds.includes(winner) && p2TeamIds.includes(playerId));

        if (isPlayerOnWinningTeam) {
          stats.players[playerId].rally.netPointsWon += 1;
        }
      }
    }

    for (const act of event.actions) {
      const pid = act.actorId;
      const typ = act.type.toUpperCase();
      ensurePlayer(stats, pid);
      const sStats = stats.players[pid].serve;
      const rStats = stats.players[pid].rally;
      const oStats = stats.players[pid].other;

      if (typ === 'ACE') {
        if (!actionTypes.includes('SECOND_SERVE_ACE')) {
          sStats.aces += 1;
          sStats.firstServeIn += 1;
          sStats.firstServeAttempted += 1;
          if (p1TeamIds.includes(pid)) stats.matchTotals.winners += 1;
        }
      } else if (typ === 'SECOND_SERVE_ACE') {
        sStats.aces += 1;
        sStats.secondServeIn += 1;
        sStats.secondServeAttempted += 1;
        if (p1TeamIds.includes(pid)) stats.matchTotals.winners += 1;
      } else if (typ === 'DOUBLE FAULT') {
        sStats.doubleFaults += 1;
        sStats.secondServeAttempted += 1;
        if (p1TeamIds.includes(pid)) stats.matchTotals.errors += 1;
      } else if (typ === 'FIRST_SERVE_FAULT') {
        sStats.firstServeAttempted += 1;
      } else if (typ === 'FIRST_IN') {
        sStats.firstServeIn += 1;
        sStats.firstServeAttempted += 1;
      } else if (typ === 'SECOND_IN') {
        sStats.secondServeIn += 1;
        sStats.secondServeAttempted += 1;
      } else if (typ === 'WINNER') {
        rStats.winners += 1;
        if (p1TeamIds.includes(pid)) stats.matchTotals.winners += 1;
      } else if (typ === 'UNFORCED ERROR') {
        rStats.unforcedErrors += 1;
        if (p1TeamIds.includes(pid)) stats.matchTotals.errors += 1;
      } else if (typ === 'FORCED ERROR') {
        rStats.forcedErrors += 1;
        if (p2TeamIds.includes(pid)) stats.matchTotals.winners += 1;
      } else if (typ === 'RETURN_UNFORCED_ERROR') {
        stats.players[pid].return.returnUnforcedErrors += 1;
        rStats.unforcedErrors += 1;
        if (p1TeamIds.includes(pid)) stats.matchTotals.errors += 1;
        if (server) stats.players[server].serve.servesUnreturned += 1;
      } else if (typ === 'RETURN_FORCED_ERROR') {
        stats.players[pid].return.returnForcedErrors += 1;
        if (p2TeamIds.includes(pid)) stats.matchTotals.winners += 1;
        if (server) stats.players[server].serve.servesUnreturned += 1;
      } else if (typ === 'LET') {
        oStats.lets += 1;
      } else if (typ === 'FOOT_FAULT') {
        oStats.footFaults += 1;
        sStats.firstServeAttempted += 1;
      } else if (typ === 'FOOT_FAULT_ERROR') {
        oStats.footFaults += 1;
        sStats.doubleFaults += 1;
        rStats.unforcedErrors += 1;
        sStats.secondServeAttempted += 1;
        if (p1TeamIds.includes(pid)) stats.matchTotals.errors += 1;
      } else if (typ.startsWith('PENALTY_')) {
        oStats.penalties += 1;
        rStats.unforcedErrors += 1;
        const penaltyWinnerTeamIds = p1TeamIds.includes(pid) ? p2TeamIds : p1TeamIds;
        const penaltyWinner = penaltyWinnerTeamIds[0];
        if (typ === 'PENALTY_GAME_UE' && penaltyWinner) {
          stats.currentGame.points = { [penaltyWinner]: 4 };
        } else if (typ === 'PENALTY_SET_UE' && penaltyWinner) {
          const winScore = ({ short: 4, normal: 6, pro: 8 } as any)[settings.format || 'normal'] || 6;
          stats.currentSet.games = { [penaltyWinner]: winScore };
          stats.currentGame.points = {};
        } else if (typ === 'PENALTY_MATCH_UE') {
          stats.matchWinner = penaltyWinner || null;
          stats.matchLoser = pid;
        }
      } else {
        for (const [baseType, statKey] of Object.entries(infractionMap)) {
          if (typ.startsWith(baseType)) {
            oStats[statKey] += 1;
            if (typ.endsWith('_UE')) {
              rStats.unforcedErrors += 1;
              if (p1TeamIds.includes(pid)) stats.matchTotals.errors += 1;
            } else if (typ.endsWith('_FE')) {
              rStats.forcedErrors += 1;
              if (p2TeamIds.includes(pid)) stats.matchTotals.winners += 1;
            }
            break;
          }
        }
      }
    }

    const winnerTypes = (event as { winnerTypes?: Record<string, string[]> }).winnerTypes;
    if (winner && receiver && winner === receiver && winnerTypes?.[winner]?.includes('return')) {
      stats.players[winner].return.returnWinners += 1;
    }

    if (winner) {
      stats.players[winner].rally.totalRallyLength += rallyLength;
      stats.players[winner].rally.rallyCount += 1;

      const allPidsInMatch = [...p1TeamIds, ...p2TeamIds].filter((p) => p);
      for (const pid of allPidsInMatch) {
        if (pid) {
          if (rallyLength > stats.players[pid].rally.longestRallyLength) {
            stats.players[pid].rally.longestRallyLength = rallyLength;
          }
        }
      }
    }

    if (winner) {
      const winnerTeam = p1TeamIds.includes(winner) ? 'p1' : 'p2';
      if (lastPointWinnerTeam === winnerTeam) {
        currentPointStreaks[winnerTeam] += 1;
      } else {
        if (lastPointWinnerTeam) {
          currentPointStreaks[lastPointWinnerTeam as 'p1' | 'p2'] = 0;
        }
        currentPointStreaks[winnerTeam] = 1;
      }
      lastPointWinnerTeam = winnerTeam;

      const teamIdsToUpdate = winnerTeam === 'p1' ? p1TeamIds : p2TeamIds;
      const streak = currentPointStreaks[winnerTeam];
      for (const pid of teamIdsToUpdate) {
        if (pid && stats.players[pid].individualMatch.longestPointStreak < streak) {
          stats.players[pid].individualMatch.longestPointStreak = streak;
        }
      }
    }

    const gameWasWon = winPointGame(stats, winner, loser, server, receiver, settings);

    if (gameWasWon) {
      const gameWinnerTeam = p1TeamIds.includes(winner) ? 'p1' : 'p2';
      if (lastGameWinnerTeam === gameWinnerTeam) {
        currentGameStreaks[gameWinnerTeam] += 1;
      } else {
        if (lastGameWinnerTeam) {
          currentGameStreaks[lastGameWinnerTeam as 'p1' | 'p2'] = 0;
        }
        currentGameStreaks[gameWinnerTeam] = 1;
      }
      lastGameWinnerTeam = gameWinnerTeam;

      const teamIdsToUpdate = gameWinnerTeam === 'p1' ? p1TeamIds : p2TeamIds;
      const streak = currentGameStreaks[gameWinnerTeam];
      for (const pid of teamIdsToUpdate) {
        if (pid && stats.players[pid].individualMatch.longestGameStreak < streak) {
          stats.players[pid].individualMatch.longestGameStreak = streak;
        }
      }
    }

    if (gameWasWon && winSet(stats, settings)) {
      checkMatchEnd(stats, settings);
    }
  }

  if (history.length === 0) {
    stats.server = null;
  }

  stats.history = JSON.parse(JSON.stringify(history));
  return stats;
}

export function recordPoint(
  matchId: number | string,
  oldStats: Stats,
  event: PointEvent,
  settings: MatchSettings
): Stats {
  if (oldStats.matchWinner) {
    return oldStats;
  }
  const history = oldStats.history || [];
  history.push(event);
  return applyHistory(matchId, history, settings);
}

export function undoPoint(matchId: number | string, oldStats: Stats, settings: MatchSettings): Stats {
  const history = oldStats.history || [];
  if (history.length > 0) {
    history.pop();
  }
  return applyHistory(matchId, history, settings);
}
