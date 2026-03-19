import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, TouchableOpacity, ActivityIndicator, Animated, StyleSheet, Dimensions, Platform } from 'react-native';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PlatformBottomSheet } from '../../components/PlatformBottomSheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCurrentMatch,
  endMatch,
  getStats,
  setServer,
  setStartingCourtSide,
  logPoint,
  undoPoint,
  pauseMatch as apiPauseMatch,
  resumeMatch as apiResumeMatch,
  startMatchTimer,
  Match,
  Stats,
  PointEvent,
  PointActionType,
  PointAction,
} from '../../api/matches';
import { deleteStream, getStreamByMatch } from '../../api/streams';
import BasicModeTracker, { CustomStatCounters } from './BasicModeTracker';
import AdvancedModeTracker from './AdvancedModeTracker';
import { Skeleton } from '../../components/Skeleton';
import Scorecard from './components/Scorecard';
import ServerSelectionDialog from './components/ServerSelectionDialog';
import CourtSideSelectionDialog from './components/CourtSideSelectionDialog';
import MatchEndStats from './components/MatchEndStats';
import LiveStats from './components/LiveStats';
import MomentumChart from './components/MomentumChart';
import MatchInfo from './components/MatchInfo';
import { Player, SetScore } from './utils/types';
import { getPlayerDisplayName, hapticImpactLight } from './utils/matchUtils';
import { hapticLight } from '../../utils/haptics';
import { router } from 'expo-router';
import { isGuestMatch } from '../../utils/guestMatchStorage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_START = SCREEN_HEIGHT;
const BACKGROUND_COLOR = '#020617';

const SCORECARD_BLUE_GRADIENT: [string, string] = ['rgba(30, 64, 175, 0.4)', 'rgba(30, 58, 138, 0.4)'];
const SCORECARD_BLUE_BORDER = 'rgba(30, 64, 175, 0.5)';
const SCORECARD_BLUE_GRADIENT_SELECTED: [string, string] = ['rgba(30, 64, 175, 0.5)', 'rgba(30, 58, 138, 0.5)'];
const SCORECARD_BLUE_BORDER_SELECTED = 'rgba(30, 64, 175, 0.6)';
const YOUR_TEAM_LIGHT_BLUE_GRADIENT: [string, string] = ['rgba(96, 165, 250, 0.4)', 'rgba(59, 130, 246, 0.4)'];
const YOUR_TEAM_LIGHT_BLUE_BORDER = 'rgba(96, 165, 250, 0.5)';

function CloseButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={styles.closeButtonCircle}>
        <Text style={styles.closeButtonX}>✕</Text>
      </View>
    </Pressable>
  );
}

interface MatchPageProps {
  refreshKey?: number;
  onMatchEnd?: () => void;
  onMatchChange?: (match: Match | null) => void;
  /** When incremented by parent, opens the Confirm End Match dialog */
  triggerEndMatchRequest?: number;
}

export default function MatchPage({ refreshKey, onMatchEnd, onMatchChange, triggerEndMatchRequest = 0 }: MatchPageProps = {}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [otherDialogOpen, setOtherDialogOpen] = useState(false);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [showEndReasonSheet, setShowEndReasonSheet] = useState(false);
  const [showOtherWinnerSheet, setShowOtherWinnerSheet] = useState(false);
  const [showMatchEndConfirmation, setShowMatchEndConfirmation] = useState(false);
  const [pendingFinalStats, setPendingFinalStats] = useState<Stats | null>(null);
  const [forcefullyEnded, setForcefullyEnded] = useState(false);
  const [stage, setStage] = useState<'initial' | 'returnError' | 'ballReturned' | 'pointWinner'>('initial');
  const [faultCount, setFaultCount] = useState(0);
  const [netChoices, setNetChoices] = useState<Record<string, boolean>>({});
  const [elapsed, setElapsed] = useState('0:00');
  const [showReadyDialog, setShowReadyDialog] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showPauseReasonDialog, setShowPauseReasonDialog] = useState(false);
  const matchTimerStart = useRef<number | null>(null);
  const pauseStartRef = useRef<number>(0);
  const totalPausedMsRef = useRef<number>(0);
  const [rallyCount, setRallyCount] = useState(1);
  const [pointOutcome, setPointOutcome] = useState<PointActionType | ''>('');
  const [showServerSelection, setShowServerSelection] = useState(false);
  const [serverSelectionTeam, setServerSelectionTeam] = useState<'all' | 'your' | 'opp'>('all');
  const [showCourtSideSelection, setShowCourtSideSelection] = useState(false);
  const courtSideDialogShownRef = useRef(false);
  const [customStatTotals, setCustomStatTotals] = useState<CustomStatCounters>({});
  const [otherAction, setOtherAction] = useState<string | null>(null);
  const [otherSubStage, setOtherSubStage] = useState<'who' | 'errorType' | 'penaltyType' | null>(null);
  const [otherActorId, setOtherActorId] = useState<string | null>(null);
  const [letsInPoint, setLetsInPoint] = useState(0);
  const [isFootFault, setIsFootFault] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({
      y: 0,
      animated: true,
    });
  };

  const endMatchWithStreamCleanup = React.useCallback(
    async (matchId: string, finalStats: Stats, endedReason: string) => {
      const streamForMatch = await getStreamByMatch(matchId).catch(() => null);
      await endMatch(matchId, finalStats, endedReason);

      const streamUid = streamForMatch?.stream?.uid;
      if (streamUid) {
        await deleteStream(streamUid).catch((error) => {
          console.warn('Failed to delete stream while ending match:', error);
        });
      }
    },
    []
  );

  const resetPointState = () => {
    setStage('initial');
    setFaultCount(0);
    setNetChoices({});
    setRallyCount(1);
    setPointOutcome('');
    setLetsInPoint(0);
    setIsFootFault(false);
  };

  const hasLoadedOnce = useRef(false);

  const loadMatch = React.useCallback(async (silent = false) => {
    if (!silent && !hasLoadedOnce.current) {
      setLoading(true);
    }
    
    const maxRetries = 3;
    let retryCount = 0;
    
    const attemptLoad = async (): Promise<void> => {
      try {
        const m = await getCurrentMatch();
        if (m.status === 'active') {
          setForcefullyEnded(false);
          setShowMatchEndConfirmation(false);
          setPendingFinalStats(null);
          setCurrentMatch(m);
          const s = await getStats(m.id);
          setStats(s);
          if (s.server) {
            setCurrentMatch(match => (match ? { ...match, server: s.server! } : null));

            const timerOrigin = m.timerStartedAt
              ? new Date(m.timerStartedAt).getTime()
              : new Date(m.createdAt).getTime();
            matchTimerStart.current = timerOrigin;
            totalPausedMsRef.current = m.totalPausedMs || 0;

            if (m.isPaused) {
              setIsPaused(true);
              pauseStartRef.current = m.pausedAt ? new Date(m.pausedAt).getTime() : Date.now();
            } else {
              setIsPaused(false);
              pauseStartRef.current = 0;
            }
          } else if (!s.matchWinner) {
            courtSideDialogShownRef.current = false;
            const hasCourtSide = m.startingCourtSide === 'top' || m.startingCourtSide === 'bottom';
            const isAdvancedMode = m.statMode === 'advanced';
            if (!hasCourtSide && isAdvancedMode && !courtSideDialogShownRef.current) {
              courtSideDialogShownRef.current = true;
              setShowCourtSideSelection(true);
            } else {
              setServerSelectionTeam('all');
              setShowServerSelection(true);
            }
          }
        } else {
          setCurrentMatch(null);
        }
        hasLoadedOnce.current = true;
        setLoading(false);
      } catch (error: any) {
        const errorMessage = error?.message || '';
        const isNoMatchError = errorMessage.includes('No active match') || errorMessage.includes('404');
        
        if (isNoMatchError && retryCount < maxRetries) {
          retryCount++;
          const delay = 100 * Math.pow(2, retryCount - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          return attemptLoad();
        } else {
          setCurrentMatch(null);
          hasLoadedOnce.current = true;
          setLoading(false);
        }
      }
    };
    
    await attemptLoad();
  }, []);

  useEffect(() => {
    loadMatch(hasLoadedOnce.current);
  }, [loadMatch, refreshKey]);

  useEffect(() => {
    if (!currentMatch || stats?.matchWinner || forcefullyEnded) return;
    if (!matchTimerStart.current) return;
    const update = () => {
      let pausedMs = totalPausedMsRef.current;
      if (isPaused && pauseStartRef.current) {
        pausedMs += Date.now() - pauseStartRef.current;
      }
      const diff = Date.now() - matchTimerStart.current! - pausedMs;
      const total = Math.max(0, Math.floor(diff / 1000));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = total % 60;
      setElapsed(
        h > 0
          ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
          : `${m}:${s.toString().padStart(2, '0')}`
      );
    };
    update();
    if (!isPaused) {
      const id = setInterval(update, 1000);
      return () => clearInterval(id);
    }
  }, [currentMatch, stats?.matchWinner, forcefullyEnded, isPaused]);

  const isMatchFinished = !!stats?.matchWinner || forcefullyEnded;
  useEffect(() => {
    if (onMatchChange) {
      onMatchChange(isMatchFinished ? null : currentMatch);
    }
  }, [currentMatch, isMatchFinished, onMatchChange]);

  const lastEndMatchRequestHandled = useRef(0);
  useEffect(() => {
    if (triggerEndMatchRequest > lastEndMatchRequestHandled.current && currentMatch) {
      lastEndMatchRequestHandled.current = triggerEndMatchRequest;
      setConfirmEndOpen(true);
    }
  }, [triggerEndMatchRequest, currentMatch]);

  const handleServerSelection = async (serverId: string) => {
    if (!currentMatch) return;
    hapticImpactLight();
    setActionLoading(true);
    setShowServerSelection(false);
    try {
      const newStats = await setServer(currentMatch.id, serverId);
      setStats(newStats);
      if (newStats.server) {
        setCurrentMatch(match => (match ? { ...match, server: newStats.server! } : null));
      }
      setShowReadyDialog(true);
    } catch (error) {
      console.error('Failed to set server:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReadyToStart = async () => {
    hapticImpactLight();
    const now = Date.now();
    matchTimerStart.current = now;
    totalPausedMsRef.current = 0;
    setShowReadyDialog(false);
    if (currentMatch && !isGuestMatch(currentMatch.id)) {
      try {
        await startMatchTimer(currentMatch.id);
      } catch (e) {
        console.error('Failed to persist timer start:', e);
      }
    }
  };

  const handlePauseMatch = async (reason: string) => {
    hapticImpactLight();
    const now = Date.now();
    setIsPaused(true);
    pauseStartRef.current = now;
    setShowPauseReasonDialog(false);
    if (currentMatch && !isGuestMatch(currentMatch.id)) {
      try {
        await apiPauseMatch(currentMatch.id, reason);
      } catch (e) {
        console.error('Failed to persist pause:', e);
      }
    }
  };

  const handleResumeMatch = async () => {
    hapticImpactLight();
    totalPausedMsRef.current += Date.now() - pauseStartRef.current;
    pauseStartRef.current = 0;
    setIsPaused(false);
    if (currentMatch && !isGuestMatch(currentMatch.id)) {
      try {
        const result = await apiResumeMatch(currentMatch.id);
        totalPausedMsRef.current = result.totalPausedMs;
      } catch (e) {
        console.error('Failed to persist resume:', e);
      }
    }
  };

  const handleCourtSideSelection = async (courtSide: 'top' | 'bottom') => {
    if (!currentMatch) return;
    hapticImpactLight();
    setActionLoading(true);
    setShowCourtSideSelection(false);
    try {
      const updatedMatch = await setStartingCourtSide(currentMatch.id, courtSide);
      setCurrentMatch(prev => prev ? { ...prev, startingCourtSide: courtSide } : updatedMatch);
      if (stats && !stats.server && !stats.matchWinner) {
        setServerSelectionTeam('all');
        setShowServerSelection(true);
      }
    } catch (error) {
      console.error('Failed to set court side:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const logAndReset = async (
    winner: Player,
    finalActionType: PointActionType,
    rallyLen?: number,
    pointActorId?: string,
    extraActions: PointAction[] = []
  ) => {
    if (!currentMatch || !stats) return;
    setActionLoading(true);

    const yourTeamIds = [currentMatch.yourPlayer1, currentMatch.yourPlayer2].filter((p): p is string => !!p);
    const oppTeamIds = [currentMatch.oppPlayer1, currentMatch.oppPlayer2].filter((p): p is string => !!p);

    if (yourTeamIds.length === 0 || oppTeamIds.length === 0) {
      console.error('Incomplete team data, cannot log point.');
      setActionLoading(false);
      return;
    }

    const serverId = currentMatch.server;
    if (!serverId) {
      console.error('Server not set, cannot log point.');
      setActionLoading(false);
      return;
    }
    const serverIsOnYourTeam = yourTeamIds.includes(serverId);
    const receiverId = serverIsOnYourTeam ? oppTeamIds[0] : yourTeamIds[0];

    let pointWinnerId: string;
    let pointLoserId: string;

    if (finalActionType === 'ACE' || finalActionType.startsWith('RETURN') || finalActionType === ('FOOT_FAULT_ERROR' as any)) {
      pointWinnerId = serverId;
      pointLoserId = receiverId;
    } else if (finalActionType === 'DOUBLE FAULT') {
      pointWinnerId = receiverId;
      pointLoserId = serverId;
    } else {
      const p1Won = winner === 'p1';
      const winnerTeam = p1Won ? yourTeamIds : oppTeamIds;
      const loserTeam = p1Won ? oppTeamIds : yourTeamIds;
      pointWinnerId = winnerTeam[0];
      pointLoserId = loserTeam[0];
    }

    let actorIdForFinalAction: string;
    if (finalActionType === 'ACE' || finalActionType === 'DOUBLE FAULT' || finalActionType === ('FOOT_FAULT_ERROR' as any)) {
      actorIdForFinalAction = serverId;
    } else if (finalActionType.startsWith('RETURN')) {
      actorIdForFinalAction = receiverId;
    } else if (pointActorId) {
      actorIdForFinalAction = pointActorId;
    } else if (finalActionType === 'UNFORCED ERROR' || finalActionType === 'FORCED ERROR') {
      actorIdForFinalAction = pointLoserId;
    } else {
      actorIdForFinalAction = pointWinnerId;
    }

    const actions: PointAction[] = [...extraActions];
    let outcomeAction: PointAction = { type: finalActionType, actorId: actorIdForFinalAction };

    const letActions: PointAction[] = Array.from({ length: letsInPoint }).map(() => ({ type: 'LET' as any, actorId: serverId }));
    actions.push(...letActions);

    if (faultCount === 0) {
      if (!['ACE', 'DOUBLE FAULT'].includes(finalActionType)) {
        actions.push({ type: 'FIRST_IN', actorId: serverId });
      }
    } else {
      actions.push({ type: (isFootFault ? 'FOOT_FAULT' : 'FIRST_SERVE_FAULT') as any, actorId: serverId });
      if (finalActionType === 'ACE') {
        outcomeAction = { type: 'SECOND_SERVE_ACE', actorId: serverId };
      } else if (finalActionType !== 'DOUBLE FAULT' && finalActionType !== ('FOOT_FAULT_ERROR' as any)) {
        actions.push({ type: 'SECOND_IN', actorId: serverId });
      }
    }

    actions.push(outcomeAction);

    const ev: PointEvent = {
      pointWinnerId,
      pointLoserId,
      serverId,
      receiverId,
      netChoices,
      rallyLength: rallyLen ?? rallyCount,
      actions: actions,
    };

    const lastServer = currentMatch.server;
    const wasMatchFinished = !!stats.matchWinner;
    const s = await logPoint(currentMatch.id, ev);
    const isNowMatchFinished = !!s.matchWinner;

    if (!wasMatchFinished && isNowMatchFinished) {
      setPendingFinalStats(s);
      setShowMatchEndConfirmation(true);
      setActionLoading(false);
      setTimeout(() => {
        scrollToTop();
        onMatchEnd?.();
      }, 300);
      return;
    }

    setStats(s);

    if (s.server) {
      setCurrentMatch(match => (match ? { ...match, server: s.server! } : null));
    } else if (!s.matchWinner) {
      const lastServerIsOnYourTeam = yourTeamIds.includes(lastServer!);
      setServerSelectionTeam(lastServerIsOnYourTeam ? 'opp' : 'your');
      setShowServerSelection(true);
    }

    resetPointState();
    setActionLoading(false);
  };

  const doUndo = async () => {
    if (!currentMatch) return;
    setActionLoading(true);

    const s = await undoPoint(currentMatch.id);
    setStats(s);

    if (s.server) {
      setCurrentMatch(match => (match ? { ...match, server: s.server! } : null));
    } else if (!s.matchWinner) {
      if (s.history.length === 0) {
        setServerSelectionTeam('all');
      } else {
        const lastEvent = s.history[s.history.length - 1];
        const lastServerId = lastEvent.serverId;
        const yourTeamIds = [currentMatch.yourPlayer1, currentMatch.yourPlayer2].filter(Boolean);
        const lastServerWasOnYourTeam = yourTeamIds.includes(lastServerId!);
        setServerSelectionTeam(lastServerWasOnYourTeam ? 'opp' : 'your');
      }
      setShowServerSelection(true);
    }

    setActionLoading(false);
    resetPointState();
  };

  const faultLabel = faultCount === 0 ? 'FAULT' : 'DOUBLE FAULT';

  const handleInitial = (action: string) => {
    hapticImpactLight();
    if (!currentMatch || !currentMatch.server) return;

    if (action === 'UNDO') {
      if (faultCount > 0) {
        setFaultCount(0);
        setIsFootFault(false);
      } else {
        doUndo();
      }
      return;
    }

    const yourTeamIds = [currentMatch.yourPlayer1, currentMatch.yourPlayer2].filter((p): p is string => !!p);
    const serverIsOnYourTeam = yourTeamIds.includes(currentMatch.server);
    const serverAsPlayer: Player = serverIsOnYourTeam ? 'p1' : 'p2';
    const receiverAsPlayer: Player = serverIsOnYourTeam ? 'p2' : 'p1';

    if (action === 'ACE') {
      logAndReset(serverAsPlayer, 'ACE', 1);
    } else if (action === faultLabel) {
      if (faultCount === 0) {
        setFaultCount(1);
      } else {
        logAndReset(receiverAsPlayer, 'DOUBLE FAULT', 1);
      }
    } else if (action === 'RETURN ERROR') {
      setStage('returnError');
    } else if (action === 'BALL RETURNED') {
      setStage('ballReturned');
      setRallyCount(2);
    } else if (action === 'OTHER') {
      setOtherDialogOpen(true);
    }
  };

  const handleReturnError = (type: string) => {
    hapticImpactLight();
    if (!currentMatch || !currentMatch.server) return;
    if (type === 'UNDO') {
      setStage('initial');
      return;
    }

    const yourTeamIds = [currentMatch.yourPlayer1, currentMatch.yourPlayer2].filter((p): p is string => !!p);
    const serverIsOnYourTeam = yourTeamIds.includes(currentMatch.server);
    const serverAsPlayer: Player = serverIsOnYourTeam ? 'p1' : 'p2';
    const actionType = `RETURN_${type.replace(' ', '_')}` as PointActionType;
    logAndReset(serverAsPlayer, actionType, 1);
  };

  const handleBallReturned = (action: string) => {
    hapticImpactLight();
    if (action === 'UNDO') {
      setStage('initial');
      setFaultCount(0);
      setNetChoices({});
      setRallyCount(1);
      return;
    }
    if (action === 'RALLY COUNTER') {
      setRallyCount(c => c + 1);
      return;
    }
    if (action === 'OTHER') {
      setOtherDialogOpen(true);
      return;
    }
    setPointOutcome(action as PointActionType);
    setStage('pointWinner');
  };

  const handlePointWinner = (actorId: string) => {
    hapticImpactLight();
    if (!currentMatch || !pointOutcome) return;

    const yourTeamIds = [currentMatch.yourPlayer1, currentMatch.yourPlayer2].filter((p): p is string => !!p);
    const isError = pointOutcome === 'FORCED ERROR' || pointOutcome === 'UNFORCED ERROR';
    const actorIsOnYourTeam = yourTeamIds.includes(actorId);
    const winningTeam: Player = isError ? (actorIsOnYourTeam ? 'p2' : 'p1') : actorIsOnYourTeam ? 'p1' : 'p2';

    logAndReset(winningTeam, pointOutcome, rallyCount, actorId);
  };

  const resetOtherDialog = () => {
    setOtherDialogOpen(false);
    setTimeout(() => {
      setOtherAction(null);
      setOtherSubStage(null);
      setOtherActorId(null);
    }, 200);
  };

  const handleInfraction = (
    infractionType: string,
    actorId: string,
    errorType: 'UNFORCED ERROR' | 'FORCED ERROR'
  ) => {
    if (!currentMatch) return;
    const yourTeamIds = [currentMatch.yourPlayer1, currentMatch.yourPlayer2].filter(Boolean);
    const actorIsOnYourTeam = yourTeamIds.includes(actorId);
    const pointWinner: Player = actorIsOnYourTeam ? 'p2' : 'p1';

    const actionMap: { [key: string]: string } = {
      'Touching net': 'TOUCHING_NET',
      'Ball hits body': 'BALL_HITS_BODY',
      'Carry/double-hit': 'CARRY',
      'Hits fixture': 'HITS_FIXTURE',
      'Racquet dropped': 'RACQUET_DROPPED',
      'Reach over net': 'REACH_OVER_NET',
    };

    const baseAction = actionMap[infractionType] || 'UNKNOWN_INFRACTION';
    const finalAction = `${baseAction}_${errorType === 'UNFORCED ERROR' ? 'UE' : 'FE'}` as any;

    logAndReset(pointWinner, finalAction, 0, actorId);
    resetOtherDialog();
  };

  const handlePenalty = (penaltyType: 'POINT' | 'GAME' | 'SET' | 'MATCH') => {
    if (!currentMatch || !otherActorId) return;
    const yourTeamIds = [currentMatch.yourPlayer1, currentMatch.yourPlayer2].filter(Boolean);
    const actorIsOnYourTeam = yourTeamIds.includes(otherActorId);
    const pointWinner: Player = actorIsOnYourTeam ? 'p2' : 'p1';

    const finalAction = `PENALTY_${penaltyType}_UE` as any;

    logAndReset(pointWinner, finalAction, 0, otherActorId);
    resetOtherDialog();
  };

  if (loading) {
    return (
      <View className="gap-y-6">
        <View className="p-4 rounded-2xl bg-[#1A1A1A] border border-white/10">
          <View className="flex-row justify-between items-center mb-3">
            <Skeleton className="h-6 w-1/3 bg-gray-700" />
            <Skeleton className="h-4 w-1/4 bg-gray-600" />
          </View>
          <View className="w-full">
            <View className="flex-row items-center py-2 border-b border-white/10">
              <Skeleton className="w-2/5 h-5 bg-gray-700" />
              <View className="flex-1 flex-row justify-center gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-6 rounded bg-gray-600" />
                ))}
              </View>
            </View>
            <View className="flex-row items-center py-2">
              <Skeleton className="w-2/5 h-5 bg-gray-700" />
              <View className="flex-1 flex-row justify-center gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-6 rounded bg-gray-600" />
                ))}
              </View>
            </View>
          </View>
        </View>
        <View className="p-6 rounded-2xl bg-white/5 border border-white/10">
          <Skeleton className="h-6 w-1/3 mb-4 mx-auto bg-gray-700" />
          <View className="flex-row flex-wrap gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 flex-1 min-w-[45%] rounded-xl bg-gray-600" />
            ))}
          </View>
        </View>
      </View>
    );
  }

  const needsServer = !stats?.server && !isMatchFinished;

  const displayDuration = (() => {
    if (!elapsed) return '0m';
    const parts = elapsed.split(':').map(n => parseInt(n, 10));
    if (parts.length === 3) {
      const [h, m] = parts;
      return `${h}h ${m}m`;
    } else if (parts.length === 2) {
      const [m] = parts;
      return `${m}m`;
    }
    return '0m';
  })();

  const player1Sets: SetScore[] = [];
  const player2Sets: SetScore[] = [];
  let player1GameScore: string | number = '';
  let player2GameScore: string | number = '';

  if (currentMatch && stats) {
    const yourTeamIds = [currentMatch.yourPlayer1, currentMatch.yourPlayer2].filter((p): p is string => !!p);
    const oppTeamIds = [currentMatch.oppPlayer1, currentMatch.oppPlayer2].filter((p): p is string => !!p);

    const getTeamGames = (gameScores: Record<string, number>, teamIds: string[]) =>
      teamIds.reduce((acc, id) => acc + (gameScores[id] || 0), 0);

    for (const set of stats.sets) {
      player1Sets.push({
        mainScore: getTeamGames(set.games, yourTeamIds),
        tiebreakScore: set.tiebreak ? getTeamGames(set.tiebreak, yourTeamIds) : undefined,
      });
      player2Sets.push({
        mainScore: getTeamGames(set.games, oppTeamIds),
        tiebreakScore: set.tiebreak ? getTeamGames(set.tiebreak, oppTeamIds) : undefined,
      });
    }

    player1Sets.push({
      mainScore: getTeamGames(stats.currentSet.games, yourTeamIds),
      tiebreakScore: stats.currentSet.tiebreak ? getTeamGames(stats.currentSet.tiebreak, yourTeamIds) : undefined,
    });
    player2Sets.push({
      mainScore: getTeamGames(stats.currentSet.games, oppTeamIds),
      tiebreakScore: stats.currentSet.tiebreak ? getTeamGames(stats.currentSet.tiebreak, oppTeamIds) : undefined,
    });

    const serverIsOnYourTeam = yourTeamIds.includes(currentMatch.server);
    player1GameScore = serverIsOnYourTeam ? stats.currentGame.serverDisplay : stats.currentGame.receiverDisplay;
    player2GameScore = serverIsOnYourTeam ? stats.currentGame.receiverDisplay : stats.currentGame.serverDisplay;
  }

  const yourTeamIds = [currentMatch?.yourPlayer1, currentMatch?.yourPlayer2].filter((p): p is string => !!p);
  const oppTeamIds = [currentMatch?.oppPlayer1, currentMatch?.oppPlayer2].filter((p): p is string => !!p);
  const isDoubles = yourTeamIds.length > 1;

  const yourTeamNames = [currentMatch?.yourPlayer1, currentMatch?.yourPlayer2].filter(Boolean) as string[];
  const oppTeamNames = [currentMatch?.oppPlayer1, currentMatch?.oppPlayer2].filter(Boolean) as string[];

  const serverName = isMatchFinished ? undefined : currentMatch?.server;
  const serverIsOnYourTeam = !!(currentMatch?.server && yourTeamIds.includes(currentMatch.server));
  const serverIsOnOppTeam = !!(currentMatch?.server && oppTeamIds.includes(currentMatch.server));

  const renderStageContent = () => {
    if (needsServer) {
      return (
        <View className="items-center">
          <ActivityIndicator size="large" color="#ffffff" />
          <Text className="text-white mt-2">Waiting for server selection...</Text>
        </View>
      );
    }

    if (stage === 'initial') {
      return (
        <View className="flex-row flex-wrap gap-4">
          {['ACE', faultLabel, 'RETURN ERROR', 'BALL RETURNED', 'OTHER', 'UNDO'].map((label, i) => {
            const isUndo = label === 'UNDO';
            const isOther = label === 'OTHER';
            const gradientColors: [string, string] = isUndo
              ? ['rgba(239, 68, 68, 0.2)', 'rgba(220, 38, 38, 0.2)']
              : isOther
                ? ['rgba(156, 163, 175, 0.2)', 'rgba(107, 114, 128, 0.2)']
                : SCORECARD_BLUE_GRADIENT;
            const borderColor = isUndo
              ? 'rgba(239, 68, 68, 0.3)'
              : isOther
                ? 'rgba(156, 163, 175, 0.3)'
                : SCORECARD_BLUE_BORDER;
            return (
              <Pressable
                key={i}
                onPress={() => handleInitial(label)}
                disabled={actionLoading}
                className={`h-20 flex-1 min-w-[45%] rounded-xl overflow-hidden ${
                  actionLoading ? 'opacity-50' : ''
                }`}
              >
                {({ pressed }) => (
                  <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor,
                      borderRadius: 12,
                      paddingHorizontal: 24,
                      opacity: pressed ? 0.7 : 1,
                    }}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text className="text-white font-semibold text-xl text-center">{label}</Text>
                    )}
                  </LinearGradient>
                )}
              </Pressable>
            );
          })}
        </View>
      );
    }

    if (stage === 'returnError') {
      return (
        <View className="flex-row flex-wrap gap-4">
          {['FORCED ERROR', 'UNFORCED ERROR', 'OTHER', 'UNDO'].map((label, i) => {
            const isUndo = label === 'UNDO';
            const isOther = label === 'OTHER';
            const gradientColors: [string, string] = isUndo
              ? ['rgba(239, 68, 68, 0.2)', 'rgba(220, 38, 38, 0.2)']
              : isOther
                ? ['rgba(156, 163, 175, 0.2)', 'rgba(107, 114, 128, 0.2)']
                : SCORECARD_BLUE_GRADIENT;
            const borderColor = isUndo
              ? 'rgba(239, 68, 68, 0.3)'
              : isOther
                ? 'rgba(156, 163, 175, 0.3)'
                : SCORECARD_BLUE_BORDER;
            return (
              <Pressable
                key={i}
                onPress={() => handleReturnError(label)}
                disabled={actionLoading}
                className={`h-20 flex-1 min-w-[45%] rounded-xl overflow-hidden ${
                  actionLoading ? 'opacity-50' : ''
                }`}
              >
                {({ pressed }) => (
                  <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor,
                      borderRadius: 12,
                      paddingHorizontal: 24,
                      opacity: pressed ? 0.7 : 1,
                    }}
                  >
                    {actionLoading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text className="text-white font-semibold text-xl text-center">{label}</Text>
                    )}
                  </LinearGradient>
                )}
              </Pressable>
            );
          })}
        </View>
      );
    }

    if (stage === 'ballReturned') {
      const players = [
        currentMatch?.yourPlayer1,
        currentMatch?.yourPlayer2,
        currentMatch?.oppPlayer1,
        currentMatch?.oppPlayer2,
      ].filter((p): p is string => !!p);
      const isDoublesMatch = players.length > 2;

      return (
        <View className="gap-y-4">
          <View className="p-4 rounded-2xl" style={{ backgroundColor: 'rgba(30, 64, 175, 0.1)', borderWidth: 1, borderColor: SCORECARD_BLUE_BORDER }}>
            <View className={`flex-row flex-wrap gap-3 ${isDoublesMatch ? '' : ''}`}>
              {players.map(playerId => {
                const isSelected = !!netChoices[playerId];
                return (
                  <Pressable
                    key={playerId}
                    onPress={() => {
                      hapticImpactLight();
                      setNetChoices(c => ({ ...c, [playerId]: !c[playerId] }));
                    }}
                    className={`h-12 flex-1 min-w-[45%] rounded-xl overflow-hidden px-2`}
                  >
                    {({ pressed }) => (
                      <LinearGradient
                        colors={
                          isSelected
                            ? SCORECARD_BLUE_GRADIENT_SELECTED
                            : ['rgba(30, 64, 175, 0.15)', 'rgba(30, 58, 138, 0.15)']
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          flex: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: isSelected ? SCORECARD_BLUE_BORDER_SELECTED : 'rgba(255, 255, 255, 0.2)',
                          borderRadius: 12,
                          opacity: pressed ? 0.7 : 1,
                        }}
                      >
                        <Text
                          className={`text-center font-semibold text-sm`}
                          style={{ color: isSelected ? '#ffffff' : '#e5e7eb' }}
                        >
                          {`${getPlayerDisplayName(playerId, isDoublesMatch)} at Net`}
                        </Text>
                      </LinearGradient>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View className="flex-row flex-wrap gap-4">
            {['WINNER', 'FORCED ERROR', 'UNFORCED ERROR', 'RALLY COUNTER', 'OTHER', 'UNDO'].map((label, i) => {
              if (label === 'RALLY COUNTER') {
                return (
                  <Pressable
                    key={i}
                    onPress={() => setRallyCount(c => c + 1)}
                    className="h-20 flex-1 min-w-[45%] rounded-xl overflow-hidden"
                  >
                    {({ pressed }) => (
                      <LinearGradient
                        colors={SCORECARD_BLUE_GRADIENT}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          flex: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 1,
                          borderColor: SCORECARD_BLUE_BORDER,
                          borderRadius: 12,
                          paddingHorizontal: 24,
                          opacity: pressed ? 0.7 : 1,
                        }}
                      >
                        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                          <Text className="text-white font-semibold text-xl text-center">Counter</Text>
                          <Text className="text-white font-semibold text-xl text-center">{rallyCount}</Text>
                        </View>
                      </LinearGradient>
                    )}
                  </Pressable>
                );
              }

              const isUndo = label === 'UNDO';
              const isOther = label === 'OTHER';
              const gradientColors: [string, string] = isUndo
                ? ['rgba(239, 68, 68, 0.2)', 'rgba(220, 38, 38, 0.2)']
                : isOther
                  ? ['rgba(156, 163, 175, 0.2)', 'rgba(107, 114, 128, 0.2)']
                  : SCORECARD_BLUE_GRADIENT;
              const borderColor = isUndo
                ? 'rgba(239, 68, 68, 0.3)'
                : isOther
                  ? 'rgba(156, 163, 175, 0.3)'
                  : SCORECARD_BLUE_BORDER;
              return (
                <Pressable
                  key={i}
                  onPress={() => handleBallReturned(label)}
                  disabled={actionLoading}
                  className={`h-20 flex-1 min-w-[45%] rounded-xl overflow-hidden ${
                    actionLoading ? 'opacity-50' : ''
                  }`}
                >
                  {({ pressed }) => (
                    <LinearGradient
                      colors={gradientColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor,
                        borderRadius: 12,
                        paddingHorizontal: 24,
                        opacity: pressed ? 0.7 : 1,
                      }}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text className="text-white font-semibold text-xl text-center">{label}</Text>
                      )}
                    </LinearGradient>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    if (stage === 'pointWinner') {
      return (
        <View className="gap-y-4">
          <View className="relative items-center mb-4">
            <Pressable
              onPress={() => {
                setStage('ballReturned');
                setPointOutcome('');
              }}
              className="absolute left-0 top-1/2 -translate-y-1/2 p-2"
              style={{ transform: [{ translateY: -12 }] }}
            >
              {({ pressed }) => (
                <View style={{ opacity: pressed ? 0.7 : 1 }}>
                  <Feather name="arrow-left" size={24} color="#9ca3af" />
                </View>
              )}
            </Pressable>
            <Text className="text-xl font-bold text-white">
              {pointOutcome === 'WINNER' ? 'Who hit the winner?' : 'Who made the error?'}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-4">
            {[...yourTeamIds, ...oppTeamIds].map(playerId => {
              const isYourTeam = yourTeamIds.includes(playerId);
              return (
                <Pressable
                  key={playerId}
                  onPress={() => handlePointWinner(playerId)}
                  disabled={actionLoading}
                  className={`h-20 flex-1 min-w-[45%] rounded-xl overflow-hidden px-4 ${
                    actionLoading ? 'opacity-50' : ''
                  }`}
                >
                  {({ pressed }) => (
                    <LinearGradient
                      colors={isYourTeam ? YOUR_TEAM_LIGHT_BLUE_GRADIENT : SCORECARD_BLUE_GRADIENT}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: isYourTeam ? YOUR_TEAM_LIGHT_BLUE_BORDER : SCORECARD_BLUE_BORDER,
                        borderRadius: 12,
                        opacity: pressed ? 0.7 : 1,
                      }}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text className="text-white font-semibold text-lg text-center">
                          {getPlayerDisplayName(playerId, isDoubles)}
                        </Text>
                      )}
                    </LinearGradient>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      );
    }

    return (
      <View className="flex-row flex-wrap gap-4">
        {['ACE', faultLabel, 'RETURN ERROR', 'BALL RETURNED', 'OTHER', 'UNDO'].map((label, i) => {
          const isUndo = label === 'UNDO';
          const isOther = label === 'OTHER';
          const gradientColors: [string, string] = isUndo
            ? ['rgba(239, 68, 68, 0.2)', 'rgba(220, 38, 38, 0.2)']
            : isOther
              ? ['rgba(156, 163, 175, 0.2)', 'rgba(107, 114, 128, 0.2)']
              : SCORECARD_BLUE_GRADIENT;
          const borderColor = isUndo
            ? 'rgba(239, 68, 68, 0.3)'
            : isOther
              ? 'rgba(156, 163, 175, 0.3)'
              : SCORECARD_BLUE_BORDER;
          return (
            <Pressable
              key={i}
              onPress={() => handleInitial(label)}
              disabled={actionLoading}
              className={`h-20 flex-1 min-w-[45%] rounded-xl overflow-hidden ${
                actionLoading ? 'opacity-50' : ''
              }`}
            >
              {({ pressed }) => (
                <LinearGradient
                  colors={gradientColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor,
                    borderRadius: 12,
                    paddingHorizontal: 24,
                    opacity: pressed ? 0.7 : 1,
                  }}
                >
                  {actionLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text className="text-white font-semibold text-xl text-center">{label}</Text>
                  )}
                </LinearGradient>
              )}
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      className="flex-1"
      style={{ backgroundColor: 'transparent' }}
      contentContainerStyle={{
        paddingBottom: insets.bottom + 80,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-y-6" style={{ backgroundColor: 'transparent' }}>
        {!currentMatch ? (
        <>
          <View className="p-6 rounded-2xl bg-white/5 border border-white/10 min-h-[300px] items-center justify-center">
            <Text className="text-white text-lg mb-4">No Match is Active</Text>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                router.push('/log-match');
              }}
              activeOpacity={0.9}
              style={{ overflow: 'hidden', borderRadius: 9999, flexShrink: 0 }}
            >
              <LinearGradient
                colors={['#1e40af', '#1e3a8a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  minHeight: 44,
                }}
              >
                <Feather name="plus" size={16} color="#ffffff" />
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>New Match</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View className="gap-y-6">
          {isGuestMatch(currentMatch.id) && (
            <View className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex-row items-center gap-2">
              <Feather name="alert-triangle" size={16} color="#f59e0b" />
              <Text className="text-amber-400 text-sm flex-1">
                Guest match - not saved. Data will be lost when you close the app.
              </Text>
            </View>
          )}
          <View>
            <Scorecard
              title={isMatchFinished ? 'Final Score' : isPaused ? `${elapsed} · Paused` : elapsed}
              status={isMatchFinished ? 'Completed' : isPaused ? 'Paused' : 'In Progress'}
              isLive={!isMatchFinished}
              player1Names={yourTeamNames}
              player1Sets={player1Sets}
              player1Serving={!isMatchFinished && serverIsOnYourTeam}
              player2Serving={!isMatchFinished && serverIsOnOppTeam}
              player1IsWinner={stats?.matchWinner ? yourTeamIds.includes(stats.matchWinner) : false}
              player2Names={oppTeamNames}
              player2Sets={player2Sets}
              player2IsWinner={stats?.matchWinner ? oppTeamIds.includes(stats.matchWinner) : false}
              serverName={serverName}
              player1GameScore={player1GameScore}
              player2GameScore={player2GameScore}
            />
          </View>

          {isMatchFinished && stats ? (
            <View className="gap-y-6">
              <MatchEndStats
                match={currentMatch}
                stats={stats}
                displayDuration={displayDuration}
                customStatTotals={customStatTotals}
              />
              <View className="items-center mt-6">
                <Pressable
                  onPress={async () => {
                    if (currentMatch) {
                      try {
                        const key = `bp_basic_custom_stats_${currentMatch.id}`;
                        await AsyncStorage.removeItem(key);
                      } catch (_) {}
                    }
                    setCustomStatTotals({});
                    setStats(null);
                    setCurrentMatch(null);
                    setForcefullyEnded(false);
                  }}
                  className="px-4 py-2 rounded-full overflow-hidden"
                >
                  {({ pressed }) => (
                    <LinearGradient
                      colors={SCORECARD_BLUE_GRADIENT}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderWidth: 1,
                        borderColor: SCORECARD_BLUE_BORDER,
                        borderRadius: 9999,
                        opacity: pressed ? 0.7 : 1,
                      }}
                    >
                      <Feather name="plus" size={16} color="#ffffff" />
                      <Text className="text-white font-medium">Start New Match</Text>
                    </LinearGradient>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="gap-y-4">
              {currentMatch.statMode === 'basic' ? (
                stats ? (
                  <BasicModeTracker
                    match={currentMatch}
                    onPointWon={(winner, customCounters) => {
                      if (customCounters) {
                        setCustomStatTotals(customCounters);
                        try {
                          const key = `bp_basic_custom_stats_${currentMatch.id}`;
                          AsyncStorage.setItem(key, JSON.stringify(customCounters));
                        } catch (_) {}
                      }
                      const serverId = currentMatch.server;
                      if (!serverId) return;
                      logAndReset(winner, 'WINNER', rallyCount, undefined, []);
                    }}
                    onUndo={doUndo}
                    actionLoading={actionLoading}
                  />
                ) : (
                  <View className="p-6 rounded-2xl bg-white/5 border border-white/10 items-center justify-center min-h-[200px]">
                    <ActivityIndicator size="large" color="#ffffff" />
                  </View>
                )
              ) : currentMatch.statMode === 'advanced' ? (
                stats ? (
                  <AdvancedModeTracker
                    match={currentMatch}
                    stats={stats}
                    onPointWon={(winner, actionType, rallLen, actorId, ballLocs, servePlacement, shotTypes, errorTypes, winnerTypes, netChoices, faultCnt) => {
                      const yourTeamIds = [currentMatch.yourPlayer1, currentMatch.yourPlayer2].filter(Boolean) as string[];
                      const oppTeamIds = [currentMatch.oppPlayer1, currentMatch.oppPlayer2].filter(Boolean) as string[];
                      const serverId = currentMatch.server;
                      if (!serverId) return;
                      
                      const serverIsOnYourTeam = yourTeamIds.includes(serverId);
                      const receiverId = serverIsOnYourTeam ? oppTeamIds[0] : yourTeamIds[0];
                      
                      const p1Won = winner === 'p1';
                      const pointWinnerId = p1Won ? yourTeamIds[0] : oppTeamIds[0];
                      const pointLoserId = p1Won ? oppTeamIds[0] : yourTeamIds[0];
                      
                      const actions: PointAction[] = [];
                      
                      if (faultCnt && faultCnt > 0) {
                        actions.push({ type: 'FIRST_SERVE_FAULT' as any, actorId: serverId });
                        if (actionType !== 'DOUBLE FAULT') {
                          actions.push({ type: 'SECOND_IN', actorId: serverId });
                        }
                      } else if (actionType !== 'DOUBLE FAULT' && actionType !== 'ACE') {
                        actions.push({ type: 'FIRST_IN', actorId: serverId });
                      }
                      
                      actions.push({ type: actionType, actorId: actorId || pointWinnerId });
                      
                      const ev: PointEvent = {
                        pointWinnerId,
                        pointLoserId,
                        serverId,
                        receiverId,
                        netChoices: netChoices || {},
                        rallyLength: rallLen,
                        actions,
                        ballLocations: ballLocs,
                      };
                      
                      setActionLoading(true);
                      logPoint(currentMatch.id, ev).then(s => {
                        setStats(s);
                        if (s.server) {
                          setCurrentMatch(match => (match ? { ...match, server: s.server! } : null));
                        }
                        resetPointState();
                        setActionLoading(false);
                      }).catch(err => {
                        console.error('Failed to log point:', err);
                        setActionLoading(false);
                      });
                    }}
                    onUndo={doUndo}
                    actionLoading={actionLoading}
                  />
                ) : (
                  <View className="p-6 rounded-2xl bg-white/5 border border-white/10 items-center justify-center min-h-[200px]">
                    <ActivityIndicator size="large" color="#ffffff" />
                  </View>
                )
              ) : stats ? (
                <View className="p-6 rounded-2xl bg-white/5 border border-white/10 min-h-[300px] justify-center">
                  {renderStageContent()}
                </View>
              ) : (
                <View className="p-6 rounded-2xl bg-white/5 border border-white/10 items-center justify-center min-h-[200px]">
                  <ActivityIndicator size="large" color="#ffffff" />
                </View>
              )}

              {!isMatchFinished && (
                <View style={{ gap: 6 }}>
                  {isPaused ? (
                    <Pressable
                      onPress={handleResumeMatch}
                      className="w-full rounded-xl overflow-hidden"
                    >
                      {({ pressed }) => (
                        <LinearGradient
                          colors={['rgba(30, 64, 175, 0.5)', 'rgba(30, 58, 138, 0.5)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            borderRadius: 12,
                            paddingVertical: 16,
                            borderWidth: 1,
                            borderColor: 'rgba(30, 64, 175, 0.6)',
                            opacity: pressed ? 0.7 : 1,
                          }}
                        >
                          <Feather name="play" size={16} color="#ffffff" />
                          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>Resume Match</Text>
                        </LinearGradient>
                      )}
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        setShowPauseReasonDialog(true);
                      }}
                      className="w-full rounded-xl overflow-hidden"
                    >
                      {({ pressed }) => (
                        <LinearGradient
                          colors={['rgba(156, 163, 175, 0.6)', 'rgba(107, 114, 128, 0.6)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            borderRadius: 12,
                            paddingVertical: 16,
                            borderWidth: 1,
                            borderColor: 'rgba(156, 163, 175, 0.5)',
                            opacity: pressed ? 0.7 : 1,
                          }}
                        >
                          <Feather name="pause" size={16} color="#ffffff" />
                          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>Pause Match</Text>
                        </LinearGradient>
                      )}
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setConfirmEndOpen(true);
                    }}
                    className="w-full rounded-xl overflow-hidden"
                  >
                    {({ pressed }) => (
                      <LinearGradient
                        colors={['#ef4444', '#dc2626']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          borderRadius: 12,
                          paddingVertical: 16,
                          opacity: pressed ? 0.85 : 1,
                        }}
                      >
                        <Feather name="flag" size={16} color="#ffffff" />
                        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>End Match</Text>
                      </LinearGradient>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          )}

          <View className="gap-y-4">
            <View className="p-6 rounded-2xl bg-white/5 border border-white/10">
              {stats && currentMatch && (
                currentMatch.statMode === 'basic' ? (
                  <MomentumChart match={currentMatch} stats={stats} />
                ) : (
                  !isMatchFinished && <LiveStats match={currentMatch} stats={stats} />
                )
              )}
            </View>
            <MatchInfo
              match={currentMatch}
              displayDuration={displayDuration}
              isMatchFinished={isMatchFinished}
              onEndMatch={() => setConfirmEndOpen(true)}
            />
          </View>
        </View>
      )}
      </View>

      {/* Server Selection Dialog */}
      {currentMatch && (
        <ServerSelectionDialog
          open={showServerSelection}
          onClose={() => {}}
          onSelect={handleServerSelection}
          match={currentMatch}
          team={serverSelectionTeam}
        />
      )}

      {/* Court Side Selection Dialog - for Advanced Mode */}
      {currentMatch && (
        <CourtSideSelectionDialog
          visible={showCourtSideSelection && !currentMatch.startingCourtSide && currentMatch.statMode === 'advanced'}
          onClose={() => {
            setShowCourtSideSelection(false);
            courtSideDialogShownRef.current = true;
          }}
          onSelect={handleCourtSideSelection}
          yourTeamName={[currentMatch.yourPlayer1, currentMatch.yourPlayer2].filter(Boolean).map(id => getPlayerDisplayName(id as string, !!currentMatch.yourPlayer2)).join(' / ')}
        />
      )}

      {/* Ready to Start Dialog */}
      <PlatformBottomSheet
        isOpened={showReadyDialog}
        presentationDragIndicator="visible"
        presentationDetents={[0.28]}
        onIsOpenedChange={() => {}}
      >
        <View style={[styles.endMatchContent, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.endMatchTitle}>Ready to Start Match?</Text>
          <Text style={[styles.endMatchSubtitle, { marginBottom: 24 }]}>
            The match timer will begin once you tap start.
          </Text>
          <TouchableOpacity
            onPress={handleReadyToStart}
            activeOpacity={0.7}
            style={{ borderRadius: 14, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={['rgba(30, 64, 175, 0.5)', 'rgba(30, 58, 138, 0.5)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 16, borderWidth: 1, borderColor: 'rgba(30, 64, 175, 0.6)', borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
            >
              <Feather name="play" size={18} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>Start Match</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </PlatformBottomSheet>

      {/* Pause Reason Dialog */}
      <PlatformBottomSheet
        isOpened={showPauseReasonDialog}
        presentationDragIndicator="visible"
        presentationDetents={[0.45]}
        onIsOpenedChange={(opened) => !opened && setShowPauseReasonDialog(false)}
      >
        <View style={[styles.endMatchContent, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.endMatchTitle}>Why are you pausing the match?</Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            {['Injury', 'Weather Delay', 'Equipment Malfunction', 'Restroom', 'Other'].map((reason) => (
              <TouchableOpacity
                key={reason}
                onPress={() => handlePauseMatch(reason)}
                activeOpacity={0.7}
                style={styles.otherActionsButton}
              >
                <Text style={styles.otherActionsButtonText}>{reason}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </PlatformBottomSheet>

      {/* Other Actions Dialog */}
      <PlatformBottomSheet
        isOpened={otherDialogOpen}
        presentationDragIndicator="visible"
        presentationDetents={[0.5, 0.7]}
        onIsOpenedChange={(opened) => !opened && resetOtherDialog()}
      >
        <View style={styles.scrollViewContainer}>
          <ScrollView
            style={[styles.settingsContent, { paddingTop: 16 }]}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20, paddingTop: 8 }}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
          >
        {!otherAction ? (
          <View style={{ paddingTop: 8 }}>
            <Text style={styles.otherActionsTitle}>Other Actions</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {[
                'Let',
                'Foot fault',
                'Touching net',
                'Ball hits body',
                'Carry/double-hit',
                'Hits fixture',
                'Racquet dropped',
                'Reach over net',
                'Penalty',
                ].map(label => (
                <TouchableOpacity
                  key={label}
                  onPress={() => {
                    hapticImpactLight();
                    if (label === 'Let') {
                      setLetsInPoint(c => c + 1);
                      resetOtherDialog();
                      return;
                    }
                    if (label === 'Foot fault') {
                      if (faultCount === 0) {
                        setFaultCount(1);
                        setIsFootFault(true);
                        resetOtherDialog();
                      } else {
                        const serverIsOnYourTeam = yourTeamIds.includes(currentMatch!.server!);
                        const receiverAsPlayer: Player = serverIsOnYourTeam ? 'p2' : 'p1';
                        logAndReset(
                          receiverAsPlayer,
                          'FOOT_FAULT_ERROR' as any,
                          1,
                          currentMatch!.server!
                        );
                        resetOtherDialog();
                      }
                      return;
                    }
                    setOtherAction(label);
                    setOtherSubStage('who');
                  }}
                  style={[styles.otherActionsButton, { flex: 1, minWidth: '45%' }]}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.otherActionsButtonText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : otherSubStage === 'who' ? (
          <View style={{ paddingTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity
                onPress={() => setOtherAction(null)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="arrow-left" size={24} color="#9ca3af" />
              </TouchableOpacity>
              <Text style={[styles.otherActionsTitle, { marginBottom: 0, flex: 1 }]}>Who committed the action?</Text>
              <View style={{ width: 24 }} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
              {[...yourTeamIds, ...oppTeamIds].map(player => {
                const isSelected = otherActorId === player;
                return (
                  <TouchableOpacity
                    key={player}
                    onPress={() => {
                      hapticImpactLight();
                      setOtherActorId(player);
                      const actionsNeedingErrorType = [
                        'Ball hits body',
                        'Carry/double-hit',
                        'Hits fixture',
                        'Racquet dropped',
                        'Reach over net',
                      ];
                      if (otherAction === 'Touching net') {
                        handleInfraction(otherAction, player, 'UNFORCED ERROR');
                      } else if (otherAction === 'Penalty') {
                        setOtherSubStage('penaltyType');
                      } else if (actionsNeedingErrorType.includes(otherAction!)) {
                        setOtherSubStage('errorType');
                      }
                    }}
                    style={[
                      styles.otherActionsButton,
                      {
                        backgroundColor: isSelected ? '#1e40af' : 'rgba(255, 255, 255, 0.1)',
                        borderColor: isSelected ? '#1e40af' : 'rgba(255, 255, 255, 0.2)',
                        paddingVertical: 14,
                        paddingHorizontal: 20,
                        minHeight: undefined,
                      },
                    ]}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text style={[styles.otherActionsButtonText, { color: isSelected ? '#ffffff' : '#d1d5db', fontSize: 15 }]} numberOfLines={1}>
                      {player}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : otherSubStage === 'errorType' && otherActorId ? (
          <View style={{ paddingTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity
                onPress={() => setOtherSubStage('who')}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="arrow-left" size={24} color="#9ca3af" />
              </TouchableOpacity>
              <Text style={[styles.otherActionsTitle, { marginBottom: 0, flex: 1 }]}>Error Type</Text>
              <View style={{ width: 24 }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
              <TouchableOpacity
                onPress={() => handleInfraction(otherAction!, otherActorId, 'FORCED ERROR')}
                style={[styles.otherActionsButton, { flex: 1 }]}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.otherActionsButtonText}>Forced</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleInfraction(otherAction!, otherActorId, 'UNFORCED ERROR')}
                style={[styles.otherActionsButton, { flex: 1 }]}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.otherActionsButtonText}>Unforced</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : otherSubStage === 'penaltyType' && otherActorId ? (
          <View style={{ paddingTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity
                onPress={() => setOtherSubStage('who')}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Feather name="arrow-left" size={24} color="#9ca3af" />
              </TouchableOpacity>
              <Text style={[styles.otherActionsTitle, { marginBottom: 0, flex: 1 }]}>Penalty Type</Text>
              <View style={{ width: 24 }} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {(['Point', 'Game', 'Set', 'Match'] as const).map(pType => (
                <TouchableOpacity
                  key={pType}
                  onPress={() => handlePenalty(pType.toUpperCase() as any)}
                  style={[styles.otherActionsButton, { flex: 1, minWidth: '45%' }]}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Text style={styles.otherActionsButtonText}>{pType}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
          </ScrollView>
        </View>
      </PlatformBottomSheet>

      {/* Confirm End Match Dialog */}
      <PlatformBottomSheet
        isOpened={confirmEndOpen}
        presentationDragIndicator="visible"
        presentationDetents={[0.35]}
        onIsOpenedChange={(opened) => !opened && setConfirmEndOpen(false)}
      >
        <View style={[styles.endMatchContent, { paddingBottom: insets.bottom + 20 }]}>
                  <Text style={styles.endMatchTitle}>End Match?</Text>
                  <Text style={styles.endMatchSubtitle}>
                    Are you sure you want to end this match? This action cannot be undone.
                  </Text>

                  <View style={styles.endMatchButtonRow}>
                    <TouchableOpacity
                      onPress={() => setConfirmEndOpen(false)}
                      style={styles.endMatchCancelButton}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <View style={styles.endMatchCancelButtonInner}>
                        <Text style={styles.endMatchCancelButtonText}>Cancel</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setConfirmEndOpen(false);
                        setShowEndReasonSheet(true);
                      }}
                      style={styles.endMatchConfirmButton}
                      activeOpacity={0.7}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <LinearGradient
                        colors={['#ef4444', '#dc2626']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.endMatchConfirmButtonGradient}
                      >
                        <Text style={styles.endMatchConfirmButtonText}>End Match</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
      </PlatformBottomSheet>

      {/* How did the match end? (early end reasons) */}
      <PlatformBottomSheet
        isOpened={showEndReasonSheet}
        presentationDragIndicator="visible"
        presentationDetents={[0.6]}
        onIsOpenedChange={(opened) => !opened && setShowEndReasonSheet(false)}
      >
        <View style={[styles.endMatchContent, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.endMatchTitle}>How did the match end?</Text>
          <Text style={[styles.endMatchSubtitle, { marginBottom: 20 }]}>
            Choose the reason the match ended early.
          </Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
            {[
              { value: 'retired_opponent', label: 'Opponent retired' },
              { value: 'retired_me', label: 'I retired' },
              { value: 'walkover', label: 'Walkover (opponent didn\'t show)' },
              { value: 'default', label: 'Default (opponent withdrew)' },
              { value: 'injury_opponent', label: 'Opponent injury' },
              { value: 'injury_me', label: 'Injury (mine)' },
              { value: 'other', label: 'Other' },
            ].map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                onPress={async () => {
                  hapticImpactLight();
                  if (!currentMatch || !stats) return;
                  const m = currentMatch;
                  const yourFirst = m.yourPlayer1;
                  const oppFirst = m.oppPlayer1;
                  let matchWinner: string;
                  let matchLoser: string;
                  if (value === 'other') {
                    setShowEndReasonSheet(false);
                    setShowOtherWinnerSheet(true);
                    return;
                  }
                  const iWon = ['retired_opponent', 'walkover', 'default', 'injury_opponent'].includes(value);
                  matchWinner = iWon ? yourFirst : oppFirst;
                  matchLoser = iWon ? oppFirst : yourFirst;
                  const finalStats: Stats = {
                    ...stats,
                    matchWinner,
                    matchLoser,
                  };
                  setActionLoading(true);
                  try {
                    await endMatchWithStreamCleanup(m.id, finalStats, value);
                    setForcefullyEnded(true);
                    setShowEndReasonSheet(false);
                    setTimeout(() => {
                      scrollToTop();
                      onMatchEnd?.();
                    }, 300);
                  } finally {
                    setActionLoading(false);
                  }
                }}
                style={[styles.otherActionsButton, { marginBottom: 8 }]}
                activeOpacity={0.7}
              >
                <Text style={styles.otherActionsButtonText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </PlatformBottomSheet>

      {/* Who won? (for Other) */}
      <PlatformBottomSheet
        isOpened={showOtherWinnerSheet}
        presentationDragIndicator="visible"
        presentationDetents={[0.3]}
        onIsOpenedChange={(opened) => !opened && setShowOtherWinnerSheet(false)}
      >
        <View style={[styles.endMatchContent, { paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.endMatchTitle}>Who won?</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              onPress={async () => {
                hapticImpactLight();
                if (!currentMatch || !stats) return;
                const m = currentMatch;
                const finalStats: Stats = {
                  ...stats,
                  matchWinner: m.yourPlayer1,
                  matchLoser: m.oppPlayer1,
                };
                setActionLoading(true);
                try {
                  await endMatchWithStreamCleanup(m.id, finalStats, 'other');
                  setForcefullyEnded(true);
                  setShowOtherWinnerSheet(false);
                  setTimeout(() => {
                    scrollToTop();
                    onMatchEnd?.();
                  }, 300);
                } finally {
                  setActionLoading(false);
                }
              }}
              style={[styles.otherActionsButton, { flex: 1 }]}
              activeOpacity={0.7}
            >
              <Text style={styles.otherActionsButtonText}>Me</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => {
                hapticImpactLight();
                if (!currentMatch || !stats) return;
                const m = currentMatch;
                const finalStats: Stats = {
                  ...stats,
                  matchWinner: m.oppPlayer1,
                  matchLoser: m.yourPlayer1,
                };
                setActionLoading(true);
                try {
                  await endMatchWithStreamCleanup(m.id, finalStats, 'other');
                  setForcefullyEnded(true);
                  setShowOtherWinnerSheet(false);
                  setTimeout(() => {
                    scrollToTop();
                    onMatchEnd?.();
                  }, 300);
                } finally {
                  setActionLoading(false);
                }
              }}
              style={[styles.otherActionsButton, { flex: 1 }]}
              activeOpacity={0.7}
            >
              <Text style={styles.otherActionsButtonText}>Opponent</Text>
            </TouchableOpacity>
          </View>
        </View>
      </PlatformBottomSheet>

      {/* Match End Confirmation Dialog */}
      <PlatformBottomSheet
        isOpened={showMatchEndConfirmation}
        presentationDragIndicator="visible"
        presentationDetents={[0.3]}
        onIsOpenedChange={() => {}}
      >
        <View style={[styles.settingsContent, { paddingTop: 20, paddingBottom: insets.bottom + 20 }]}>
                    <Text className="text-xl font-bold text-white text-center mb-2">Match Point!</Text>
                    <Text className="text-gray-300 text-center mb-6">
                      Confirm the final point or undo if it was a mistake.
                    </Text>
                    <View className="flex-row justify-center gap-4">
                      <TouchableOpacity
                        onPress={async () => {
                          hapticImpactLight();
                          setShowMatchEndConfirmation(false);
                          setPendingFinalStats(null);
                          await doUndo();
                        }}
                        className="px-6 py-3 rounded-full border font-medium bg-white/10 border-white/30"
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text className="text-gray-200">Undo Point</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          hapticImpactLight();
                          if (pendingFinalStats) {
                            setStats(pendingFinalStats);
                          }
                          setShowMatchEndConfirmation(false);
                          setPendingFinalStats(null);
                          resetPointState();
                          setTimeout(() => {
                            scrollToTop();
                            onMatchEnd?.();
                          }, 300);
                        }}
                        className="px-6 py-3 rounded-full font-medium bg-green-500 border border-green-500"
                        activeOpacity={0.7}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text className="text-white">End Match</Text>
                      </TouchableOpacity>
                    </View>
                </View>
      </PlatformBottomSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  handleBarContainer: {
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  closeButtonContainer: {
    position: 'absolute',
    right: 20,
    top: 20,
    width: 30,
    height: 30,
    zIndex: 999,
    elevation: 999,
  },
  closeButtonCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeButtonX: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 15,
    fontWeight: '600',
    marginTop: -1,
  },
  settingsContent: {
    flex: 1,
    overflow: 'hidden',
    paddingTop: 60,
    paddingHorizontal: 24,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#020617',
  },
  scrollViewContainer: {
    flex: 1,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#020617',
  },
  endMatchContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#020617',
    flex: 1,
  },
  endMatchTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  endMatchSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  endMatchButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  endMatchCancelButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  endMatchCancelButtonInner: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endMatchCancelButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  endMatchConfirmButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  endMatchConfirmButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endMatchConfirmButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  otherActionsTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  otherActionsButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  otherActionsButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
});
