import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Modal, Pressable, StatusBar } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Match, Stats, BallLocation as APIBallLocation, PointActionType } from '../../api/matches'
import type { StrokeType as APIStrokeType } from './utils/courtBounds'
import { 
  COURT_BOUNDS, 
  BallLocation, 
  ServeSide, 
  CourtSide, 
  UndoRestoreState,
  ServePlacement,
  StrokeType 
} from './utils/courtBounds'
import { isPlayerAtNet, isInBounds, getServePlacement, clampToCourtBounds } from './utils/gameLogic'
import { getPlayerDisplayName } from './utils/matchUtils'
import { hapticLight } from '../../utils/haptics'
import TennisCourt from './components/TennisCourt'
import ErrorTypeDialog from './components/ErrorTypeDialog'
import ShotTypeDialog from './components/ShotTypeDialog'
import VolleyTypeDialog from './components/VolleyTypeDialog'
import PlayerSelectorDialog from './components/PlayerSelectorDialog'
import UndoPointDialog from './components/UndoPointDialog'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

interface AdvancedModeTrackerProps {
  match: Match
  stats: Stats | null
  onPointWon: (
    winner: 'p1' | 'p2', 
    actionType: PointActionType, 
    rallyLength: number, 
    actorId?: string,
    ballLocations?: APIBallLocation[],
    servePlacement?: ServePlacement,
    shotTypes?: Record<string, string[]>,
    errorTypes?: Record<string, string[]>,
    winnerTypes?: Record<string, string[]>,
    netChoices?: Record<string, boolean>,
    faultCount?: number
  ) => void
  onUndo: () => void
  actionLoading: boolean
}

export default function AdvancedModeTracker({
  match,
  stats,
  onPointWon,
  onUndo,
  actionLoading
}: AdvancedModeTrackerProps) {
  const insets = useSafeAreaInsets()
  // Ball and court state
  const [ballLocations, setBallLocations] = useState<BallLocation[]>([])
  const [currentStage, setCurrentStage] = useState<'serve' | 'rally' | 'outcome'>('serve')
  const [faultCount, setFaultCount] = useState(0)
  const [rallyLength, setRallyLength] = useState(0)
  const [lastServeLocation, setLastServeLocation] = useState<{ x: number; y: number } | null>(null)
  const [playerPositions, setPlayerPositions] = useState<Record<string, { x: number; y: number }>>({})
  
  // Dialog states
  const [showErrorTypeDialog, setShowErrorTypeDialog] = useState(false)
  const [pendingErrorLocation, setPendingErrorLocation] = useState<{ 
    location: BallLocation; 
    hitterId: string; 
    winner: 'p1' | 'p2' 
  } | null>(null)
  const [showErrorShotTypeDialog, setShowErrorShotTypeDialog] = useState(false)
  const [pendingErrorShotData, setPendingErrorShotData] = useState<{ 
    location: BallLocation; 
    hitterId: string; 
    winner: 'p1' | 'p2'; 
    errorType: 'UNFORCED ERROR' | 'FORCED ERROR' 
  } | null>(null)
  const [showWinnerShotTypeDialog, setShowWinnerShotTypeDialog] = useState(false)
  const [pendingWinnerShotData, setPendingWinnerShotData] = useState<{ 
    location: BallLocation; 
    hitterId: string; 
    winner: 'p1' | 'p2' 
  } | null>(null)
  const [showPlayerSelector, setShowPlayerSelector] = useState(false)
  const [pendingPlayerLocation, setPendingPlayerLocation] = useState<BallLocation | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showVolleyTypeDialog, setShowVolleyTypeDialog] = useState(false)

  // Hide/show status bar when fullscreen changes
  useEffect(() => {
    StatusBar.setHidden(isFullscreen, 'fade')
    return () => {
      StatusBar.setHidden(false, 'fade')
    }
  }, [isFullscreen])
  const [volleyTypeContext, setVolleyTypeContext] = useState<'click' | 'error' | 'winner' | null>(null)
  const [volleyTypeData, setVolleyTypeData] = useState<{ 
    location: BallLocation; 
    hitterId: string; 
    winner: 'p1' | 'p2'; 
    errorType?: 'UNFORCED ERROR' | 'FORCED ERROR' 
  } | null>(null)
  const [showUndoPointDialog, setShowUndoPointDialog] = useState(false)
  const [showStrokeTypeDialog, setShowStrokeTypeDialog] = useState(false)
  const [pendingStrokeLocation, setPendingStrokeLocation] = useState<BallLocation | null>(null)
  
  // Refs for undo functionality
  const lastCompletedPointRef = useRef<BallLocation[] | null>(null)
  const pendingUndoRestoreRef = useRef<UndoRestoreState | null>(null)
  const [pointsPlayedInGame, setPointsPlayedInGame] = useState(0)
  const prevPointsPlayedRef = useRef(0)

  // Team IDs
  const yourTeamIds = useMemo(() => 
    [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p),
    [match.yourPlayer1, match.yourPlayer2]
  )
  const oppTeamIds = useMemo(() => 
    [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p),
    [match.oppPlayer1, match.oppPlayer2]
  )
  const isDoubles = yourTeamIds.length > 1

  const serverId = match.server
  const serverIsOnYourTeam = yourTeamIds.includes(serverId || '')

  // Calculate if server is on bottom of court
  const isServerBottom = useMemo(() => {
    if (!stats) return true
    
    const yourCurrentGames = yourTeamIds.reduce((sum, id) => sum + (stats.currentSet.games[id] || 0), 0)
    const oppCurrentGames = oppTeamIds.reduce((sum, id) => sum + (stats.currentSet.games[id] || 0), 0)
    const totalGamesInCurrentSet = yourCurrentGames + oppCurrentGames
    
    let totalGamesFromCompletedSets = 0
    stats.sets.forEach(set => {
      const yourGames = yourTeamIds.reduce((sum, id) => sum + (set.games[id] || 0), 0)
      const oppGames = oppTeamIds.reduce((sum, id) => sum + (set.games[id] || 0), 0)
      totalGamesFromCompletedSets += yourGames + oppGames
    })
    
    const totalGameScore = totalGamesFromCompletedSets + totalGamesInCurrentSet
    const numberOfSwitches = Math.ceil(totalGameScore / 2)
    return (numberOfSwitches + totalGameScore) % 2 === 0
  }, [stats, yourTeamIds, oppTeamIds])

  // Calculate actual server position considering starting court side
  const actualServerIsBottom = useMemo(() => {
    if (!match.startingCourtSide) {
      return isServerBottom
    }
    
    let completedGames = 0
    if (stats) {
      const yourCurrentGames = yourTeamIds.reduce((sum, id) => sum + (stats.currentSet.games[id] || 0), 0)
      const oppCurrentGames = oppTeamIds.reduce((sum, id) => sum + (stats.currentSet.games[id] || 0), 0)
      const completedGamesInCurrentSet = yourCurrentGames + oppCurrentGames
      
      let completedGamesFromCompletedSets = 0
      stats.sets.forEach(set => {
        const yourGames = yourTeamIds.reduce((sum, id) => sum + (set.games[id] || 0), 0)
        const oppGames = oppTeamIds.reduce((sum, id) => sum + (set.games[id] || 0), 0)
        completedGamesFromCompletedSets += yourGames + oppGames
      })
      
      completedGames = completedGamesFromCompletedSets + completedGamesInCurrentSet
    }
    
    const isOnOppositeSide = completedGames > 0 && Math.floor((completedGames - 1) / 2) % 2 === 0

    if (match.startingCourtSide === 'top') {  
      const basePositionWhenYourTeamServes = false 
      const basePositionWhenOppServes = true 
      const basePosition = serverIsOnYourTeam ? basePositionWhenYourTeamServes : basePositionWhenOppServes
      return isOnOppositeSide ? !basePosition : basePosition
    } else {
      const basePositionWhenYourTeamServes = true 
      const basePositionWhenOppServes = false
      const basePosition = serverIsOnYourTeam ? basePositionWhenYourTeamServes : basePositionWhenOppServes    
      return isOnOppositeSide ? !basePosition : basePosition
    }
  }, [match.startingCourtSide, serverIsOnYourTeam, yourTeamIds, stats, oppTeamIds, isServerBottom])

  // Sync pointsPlayedInGame with stats (matches web version)
  useEffect(() => {
    if (stats?.currentGame) {
      const totalPoints = (stats.currentGame.serverPoints || 0) + (stats.currentGame.receiverPoints || 0)
      const prevPoints = prevPointsPlayedRef.current
      
      if (totalPoints < prevPoints) {
        // Points decreased (undo) - restore state if available
        if (pendingUndoRestoreRef.current) {
          const restoreState = pendingUndoRestoreRef.current
          pendingUndoRestoreRef.current = null
          lastCompletedPointRef.current = null

          setBallLocations(restoreState.locations)
          setFaultCount(restoreState.faultCount)
          setRallyLength(restoreState.rallyLength)
          setCurrentStage(restoreState.stage)
          setLastServeLocation(restoreState.lastServeLocation)
          setShowStrokeTypeDialog(false)
          setPendingStrokeLocation(null)
          setShowPlayerSelector(false)
          setPendingPlayerLocation(null)
          setShowErrorTypeDialog(false)
          setPendingErrorLocation(null)
          setShowErrorShotTypeDialog(false)
          setPendingErrorShotData(null)
          setShowWinnerShotTypeDialog(false)
          setPendingWinnerShotData(null)
          setPlayerPositions({})
          setPointsPlayedInGame(totalPoints)
        } else {
          // Reset point state
          setBallLocations([])
          setCurrentStage('serve')
          setFaultCount(0)
          setRallyLength(0)
          setLastServeLocation(null)
          setShowStrokeTypeDialog(false)
          setPendingStrokeLocation(null)
          setShowPlayerSelector(false)
          setPendingPlayerLocation(null)
          setShowErrorTypeDialog(false)
          setPendingErrorLocation(null)
          setShowErrorShotTypeDialog(false)
          setPendingErrorShotData(null)
          setShowWinnerShotTypeDialog(false)
          setPendingWinnerShotData(null)
          setPlayerPositions({})
          setPointsPlayedInGame(totalPoints)
        }
      } else if (totalPoints > prevPoints) {
        // Points increased - update counter
        setPointsPlayedInGame(totalPoints)
      } else if (totalPoints === 0 && prevPoints > 0) {
        // New game started
        setPointsPlayedInGame(0)
        setBallLocations([])
        setCurrentStage('serve')
        setFaultCount(0)
        setRallyLength(0)
        setLastServeLocation(null)
        setPlayerPositions({})
      }
      
      prevPointsPlayedRef.current = totalPoints
    }
  }, [stats?.currentGame])

  // Get current serve side (deuce or ad)
  // Matches web version: first serve (points = 0) is from ad side (left), serving to right
  // Then alternates: ad (0), deuce (1), ad (2), deuce (3)...
  const getCurrentServeSide = useCallback((): ServeSide => {
    if (!stats?.currentGame) return 'ad'
    const totalPoints = (stats.currentGame.serverPoints || 0) + (stats.currentGame.receiverPoints || 0)
    // First serve (points = 0) is ad (left), then alternates
    return totalPoints % 2 === 0 ? 'ad' : 'deuce'
  }, [stats?.currentGame])

  // Check if position is in service box
  const isInServiceBox = useCallback((x: number, y: number, side: CourtSide, serveSide: ServeSide): boolean => {
    const serviceBox = side === 'top'
      ? COURT_BOUNDS.topServiceBox[serveSide]
      : COURT_BOUNDS.bottomServiceBox[serveSide]
    
    return (
      x >= serviceBox.x &&
      x <= serviceBox.x + serviceBox.width &&
      y >= serviceBox.y &&
      y <= serviceBox.y + serviceBox.height
    )
  }, [])

  // Get local serve placement
  const getLocalServePlacement = useCallback((x: number, y: number, serveSide: ServeSide): ServePlacement | undefined => {
    const receiverSide: CourtSide = actualServerIsBottom ? 'top' : 'bottom'
    const serviceBox = receiverSide === 'bottom'
      ? COURT_BOUNDS.bottomServiceBox[serveSide]
      : COURT_BOUNDS.topServiceBox[serveSide]
    
    const centerX = serviceBox.x + serviceBox.width / 2
    
    if (Math.abs(x - COURT_BOUNDS.centerServiceLine.x) < 5) {
      return 't'
    }
    
    const distanceFromCenter = Math.abs(x - centerX)
    if (distanceFromCenter > 15) {
      return 'wide'
    }
    
    return 'body'
  }, [actualServerIsBottom])

  // Reset point state
  const resetPoint = useCallback(() => {
    setBallLocations([])
    setCurrentStage('serve')
    setFaultCount(0)
    setRallyLength(0)
    setLastServeLocation(null)
    setPlayerPositions({})
    setShowErrorTypeDialog(false)
    setPendingErrorLocation(null)
    setShowErrorShotTypeDialog(false)
    setPendingErrorShotData(null)
    setShowWinnerShotTypeDialog(false)
    setPendingWinnerShotData(null)
    setShowPlayerSelector(false)
    setPendingPlayerLocation(null)
    setShowVolleyTypeDialog(false)
    setVolleyTypeContext(null)
    setVolleyTypeData(null)
    setShowStrokeTypeDialog(false)
    setPendingStrokeLocation(null)
  }, [])

  // Finish point and call API
  const finishPoint = useCallback((selectedOutcome?: string) => {
    if (!stats || !serverId) return

    const serveLocations = ballLocations.filter(b => b.type === 'serve')
    const rallyLocations = ballLocations.filter(b => b.type === 'rally')
    const outcomeLocation = ballLocations.find(b => b.type === 'outcome')
    
    const receiverId = serverIsOnYourTeam ? (oppTeamIds[0] || '') : (yourTeamIds[0] || '')
    
    let winner: 'p1' | 'p2' = 'p1'
    let actionType: PointActionType = selectedOutcome as PointActionType || 'WINNER'
    let actorId = serverId

    const finalOutcome = selectedOutcome || outcomeLocation?.outcome

    // Determine winner and action type based on game state
    if (serveLocations.length > 0 && rallyLocations.length === 0) {
      // Ace or serve winner
      if (finalOutcome === 'ACE' || finalOutcome === 'WINNER') {
        winner = serverIsOnYourTeam ? 'p1' : 'p2'
        actionType = 'ACE'
        actorId = serverId
      }
    }

    // Build API ball locations
    const apiBallLocations: APIBallLocation[] = ballLocations.map(loc => ({
      x: loc.x,
      y: loc.y,
      type: loc.type,
      playerId: loc.playerId,
      strokeType: loc.strokeType,
      isIn: loc.isIn,
      servePlacement: loc.servePlacement
    }))

    // Build net choices
    const netChoices: Record<string, boolean> = {}
    const allPlayerKeys = ['server', 'receiver', ...(isDoubles ? ['server-partner', 'receiver-partner'] : [])]
    
    for (const playerKey of allPlayerKeys) {
      const pos = playerPositions[playerKey]
      if (!pos) continue

      let playerId: string | undefined
      if (playerKey === 'server') playerId = serverId
      else if (playerKey === 'receiver') playerId = receiverId
      else if (playerKey === 'server-partner') playerId = serverIsOnYourTeam ? yourTeamIds[1] : oppTeamIds[1]
      else if (playerKey === 'receiver-partner') playerId = !serverIsOnYourTeam ? yourTeamIds[1] : oppTeamIds[1]
      
      if (!playerId) continue

      if (isPlayerAtNet(pos.y)) {
        netChoices[playerId] = true
      }
    }

    // Get serve placement
    const firstServeIn = serveLocations.find(s => s.isIn && s.servePlacement)
    const finalServePlacement = firstServeIn?.servePlacement

    // Store completed point for undo (matches web version)
    lastCompletedPointRef.current = ballLocations.map(loc => ({ ...loc }))

    setPointsPlayedInGame(prev => prev + 1)
    onPointWon(
      winner, 
      actionType, 
      rallyLength, 
      actorId,
      apiBallLocations,
      finalServePlacement,
      {},
      {},
      {},
      netChoices,
      faultCount
    )

    resetPoint()
  }, [stats, serverId, ballLocations, serverIsOnYourTeam, oppTeamIds, yourTeamIds, isDoubles, playerPositions, rallyLength, faultCount, onPointWon, resetPoint])

  // Handle court tap
  const handleCourtTap = useCallback((x: number, y: number) => {
    if (actionLoading) return

    const { x: clampedX, y: clampedY } = clampToCourtBounds(x, y)
    const serveSide = getCurrentServeSide()
    const serverSide: CourtSide = actualServerIsBottom ? 'bottom' : 'top'
    const receiverSide: CourtSide = serverSide === 'bottom' ? 'top' : 'bottom'
    // Match web version's targetBoxSide calculation exactly
    const targetBoxSide: ServeSide = actualServerIsBottom ? serveSide : (serveSide === 'ad' ? 'deuce' : 'ad')

    hapticLight()

    if (currentStage === 'serve') {
      // Check if we need to reset
      const hasOutcome = ballLocations.some(b => b.type === 'outcome')
      const hasRallyShots = ballLocations.some(b => b.type === 'rally')
      const hasServeIn = ballLocations.some(b => b.type === 'serve' && b.isIn)
      
      if (hasOutcome || hasRallyShots || hasServeIn) {
        resetPoint()
      }
      
      const isIn = isInServiceBox(clampedX, clampedY, receiverSide, targetBoxSide)
      const placement = isIn ? getLocalServePlacement(clampedX, clampedY, targetBoxSide) : undefined

      const newLocation: BallLocation = {
        id: `ball-${Date.now()}`,
        x: clampedX,
        y: clampedY,
        timestamp: Date.now(),
        type: 'serve',
        playerId: serverId,
        isIn,
        servePlacement: placement
      }

      if (!isIn) {
        // Fault
        setFaultCount(prev => prev + 1)
        if (faultCount === 0) {
          setBallLocations(prev => [...prev, newLocation])
          return
        } else {
          // Double fault
          const completedLocations = [...ballLocations, newLocation]
          lastCompletedPointRef.current = completedLocations.map(loc => ({ ...loc }))
          const winner: 'p1' | 'p2' = serverIsOnYourTeam ? 'p2' : 'p1'
          
          const apiBallLocations: APIBallLocation[] = ballLocations.map(loc => ({
            x: loc.x,
            y: loc.y,
            type: loc.type,
            playerId: loc.playerId,
            strokeType: loc.strokeType,
            isIn: loc.isIn,
            servePlacement: loc.servePlacement
          }))
          
          const errorTypes: Record<string, string[]> = {}
          if (serverId) {
            errorTypes[serverId] = ['DOUBLE FAULT']
          }
          
          setPointsPlayedInGame(prev => prev + 1)
          onPointWon(winner, 'DOUBLE FAULT', 0, serverId, apiBallLocations, undefined, {}, errorTypes, {}, undefined, faultCount)
          resetPoint()
          return
        }
      } else {
        // Serve in
        setLastServeLocation({ x: clampedX, y: clampedY })
        setBallLocations(prev => [...prev, newLocation])
        setCurrentStage('rally')
        setRallyLength(1)
      }
    } else if (currentStage === 'rally') {
      // Rally shot
      const isIn = isInBounds(clampedX, clampedY, isDoubles)
      const shotSide: CourtSide = clampedY < COURT_BOUNDS.netY ? 'top' : 'bottom'
      
      const allShots = ballLocations.filter(b => b.type === 'serve' || b.type === 'rally')
      const lastShot = allShots[allShots.length - 1]
      const lastShotSide: CourtSide | null = lastShot && lastShot.isIn
        ? (lastShot.y < COURT_BOUNDS.netY ? 'top' : 'bottom')
        : null
      
      const lastShotWasIn = lastShot ? (lastShot.isIn === true) : false
      const sameSideDoubleBounce = lastShotSide !== null && lastShotSide === shotSide && lastShotWasIn

      // Determine hitter
      const hitterIsServer = rallyLength % 2 === 0
      const receiverId = serverIsOnYourTeam ? (oppTeamIds[0] || '') : (yourTeamIds[0] || '')
      let hitterId = hitterIsServer ? serverId : receiverId

      const newLocation: BallLocation = {
        id: `ball-${Date.now()}`,
        x: clampedX,
        y: clampedY,
        timestamp: Date.now(),
        type: 'rally',
        isIn,
        playerId: hitterId,
        sameSideError: sameSideDoubleBounce && isIn
      }

      // Check for winner/error on same side double bounce
      if (sameSideDoubleBounce && lastShot) {
        const firstBounceY = lastShot.y
        const secondBounceY = clampedY
        const isBottomHalf = firstBounceY > COURT_BOUNDS.netY
        
        let isWinner = false
        let isError = false
        
        if (isBottomHalf) {
          isWinner = secondBounceY > firstBounceY
          isError = isIn && secondBounceY < firstBounceY
        } else {
          isWinner = secondBounceY < firstBounceY
          isError = isIn && secondBounceY > firstBounceY
        }

        const bounceSide: CourtSide = shotSide 
        const serverSide: CourtSide = actualServerIsBottom ? 'bottom' : 'top'
        const receiverSide: CourtSide = serverSide === 'bottom' ? 'top' : 'bottom'
        const existingRallyShots = ballLocations.filter(b => b.type === 'rally').length
        const currentRallyShotNumber = existingRallyShots + 1
        const shotHitterIsServer = currentRallyShotNumber % 2 === 0
        
        // Check if serve bounced twice on returner's side - this is an ACE
        if (lastShot.type === 'serve' && lastShot.isIn && bounceSide === receiverSide && isWinner) {
          // Serve bounced twice on returner's side = ACE
          // Don't add the second bounce to ballLocations - only include the serve that's in (exclude faults)
          const winner: 'p1' | 'p2' = serverIsOnYourTeam ? 'p1' : 'p2'
          
          // Only include the serve that's in, exclude any faults
          const serveIn = ballLocations.find(s => s.type === 'serve' && s.isIn && s.servePlacement)
          const apiBallLocations: APIBallLocation[] = serveIn ? [{
            x: serveIn.x,
            y: serveIn.y,
            type: serveIn.type,
            playerId: serveIn.playerId,
            strokeType: serveIn.strokeType,
            isIn: serveIn.isIn,
            servePlacement: serveIn.servePlacement
          }] : []
          
          const finalServePlacement = serveIn?.servePlacement
          
          // Store completed point for undo (only the serve, not the second bounce)
          lastCompletedPointRef.current = ballLocations.map(loc => ({ ...loc }))
          
          setPointsPlayedInGame(prev => prev + 1)
          onPointWon(winner, 'ACE', 0, serverId, apiBallLocations, finalServePlacement, {}, {}, {}, {}, faultCount)
          resetPoint()
          return
        }
        
        if (isWinner) {
          const hitterSide: CourtSide = bounceSide === 'top' ? 'bottom' : 'top'
          const hitterIsOnYourTeam = (hitterSide === serverSide && serverIsOnYourTeam) ||
                                     (hitterSide !== serverSide && !serverIsOnYourTeam)
          const hitterTeamIds = hitterIsOnYourTeam ? yourTeamIds : oppTeamIds
          let winnerHitterId = shotHitterIsServer ? serverId : receiverId
          
          if (!hitterTeamIds.includes(winnerHitterId || '')) {
            winnerHitterId = hitterTeamIds[0]
          }
          
          newLocation.playerId = winnerHitterId

          // Check if player is at net for volley dialog
          let playerIsAtNet = false
          for (const playerKey of ['server', 'receiver', 'server-partner', 'receiver-partner'] as const) {
            let playerId: string | undefined
            if (playerKey === 'server') playerId = serverId
            else if (playerKey === 'receiver') playerId = receiverId
            else if (playerKey === 'server-partner') playerId = serverIsOnYourTeam ? yourTeamIds[1] : oppTeamIds[1]
            else if (playerKey === 'receiver-partner') playerId = !serverIsOnYourTeam ? yourTeamIds[1] : oppTeamIds[1]
            
            if (playerId === winnerHitterId) {
              const pos = playerPositions[playerKey]
              if (pos) {
                playerIsAtNet = isPlayerAtNet(pos.y)
              }
              break
            }
          }

          const winner: 'p1' | 'p2' = hitterIsOnYourTeam ? 'p1' : 'p2'
          setBallLocations(prev => [...prev, newLocation])
          setPendingWinnerShotData({ location: newLocation, hitterId: winnerHitterId || '', winner })
          
          if (playerIsAtNet) {
            setVolleyTypeContext('winner')
            setVolleyTypeData({ location: newLocation, hitterId: winnerHitterId || '', winner })
            setShowVolleyTypeDialog(true)
          } else {
            setShowWinnerShotTypeDialog(true)
          }
          return
        } else if (isError) {
          const errorHitterIsOnYourTeam = (bounceSide === serverSide && serverIsOnYourTeam) ||
                                         (bounceSide !== serverSide && !serverIsOnYourTeam)
          const errorHitterTeamIds = errorHitterIsOnYourTeam ? yourTeamIds : oppTeamIds
          let errorHitterId = (bounceSide === serverSide) ? serverId : receiverId
          
          if (!errorHitterTeamIds.includes(errorHitterId || '')) {
            errorHitterId = errorHitterTeamIds[0]
          }
          
          newLocation.playerId = errorHitterId
          const winner: 'p1' | 'p2' = errorHitterIsOnYourTeam ? 'p2' : 'p1'
          
          setBallLocations(prev => [...prev, newLocation])
          setPendingErrorLocation({ location: newLocation, hitterId: errorHitterId || '', winner })
          setShowErrorTypeDialog(true)
          return
        }
      }

      // Handle out ball (error)
      if (!isIn) {
        const hitterIsOnYourTeam = yourTeamIds.includes(hitterId || '')
        const winner: 'p1' | 'p2' = hitterIsOnYourTeam ? 'p2' : 'p1'
        
        setPendingErrorLocation({ location: newLocation, hitterId: hitterId || '', winner })
        setShowErrorTypeDialog(true)
        return
      }

      // Normal rally shot - check for stroke type tracking
      if (match.trackForehandBackhand === true) {
        setPendingStrokeLocation(newLocation)
        setShowStrokeTypeDialog(true)
        return
      }

      setBallLocations(prev => [...prev, newLocation])
      setRallyLength(prev => prev + 1)
    }
  }, [
    actionLoading, getCurrentServeSide, actualServerIsBottom, currentStage, ballLocations,
    isInServiceBox, getLocalServePlacement, serverId, faultCount, resetPoint, serverIsOnYourTeam,
    onPointWon, isDoubles, rallyLength, oppTeamIds, yourTeamIds, playerPositions, match.trackForehandBackhand
  ])

  // Handle player drag
  const handlePlayerDrag = useCallback((playerKey: string, newX: number, newY: number) => {
    setPlayerPositions(prev => ({
      ...prev,
      [playerKey]: { x: newX, y: newY }
    }))
  }, [])

  // Handle player tap (toggle to net)
  const handlePlayerTap = useCallback((playerKey: string) => {
    hapticLight()
    
    const currentPos = playerPositions[playerKey]
    const isTopPlayer = actualServerIsBottom ? 
      (playerKey === 'receiver' || playerKey === 'receiver-partner') :
      (playerKey === 'server' || playerKey === 'server-partner')
    
    const baselineY = isTopPlayer ? COURT_BOUNDS.topBaseline.y : COURT_BOUNDS.bottomBaseline.y
    const netY = isTopPlayer ? 
      (COURT_BOUNDS.topServiceBox.deuce.y + COURT_BOUNDS.topServiceBox.deuce.height / 2) :
      (COURT_BOUNDS.bottomServiceBox.deuce.y + COURT_BOUNDS.bottomServiceBox.deuce.height / 2)
    
    const currentY = currentPos?.y ?? baselineY
    const isCurrentlyAtNet = isPlayerAtNet(currentY)
    
    setPlayerPositions(prev => ({
      ...prev,
      [playerKey]: {
        x: currentPos?.x ?? 50,
        y: isCurrentlyAtNet ? baselineY : netY
      }
    }))
  }, [playerPositions, actualServerIsBottom])

  // Handle error type selected
  const handleErrorTypeSelected = useCallback((errorType: 'UNFORCED ERROR' | 'FORCED ERROR') => {
    if (!pendingErrorLocation) return
    
    const { location, hitterId, winner } = pendingErrorLocation

    // Check if player is at net
    let playerIsAtNet = false
    for (const playerKey of ['server', 'receiver', 'server-partner', 'receiver-partner'] as const) {
      let playerId: string | undefined
      const receiverId = serverIsOnYourTeam ? (oppTeamIds[0] || '') : (yourTeamIds[0] || '')
      
      if (playerKey === 'server') playerId = serverId
      else if (playerKey === 'receiver') playerId = receiverId
      else if (playerKey === 'server-partner') playerId = serverIsOnYourTeam ? yourTeamIds[1] : oppTeamIds[1]
      else if (playerKey === 'receiver-partner') playerId = !serverIsOnYourTeam ? yourTeamIds[1] : oppTeamIds[1]
      
      if (playerId === hitterId) {
        const pos = playerPositions[playerKey]
        if (pos) {
          playerIsAtNet = isPlayerAtNet(pos.y)
        }
        break
      }
    }
    
    setPendingErrorShotData({ location, hitterId, winner, errorType })
    setShowErrorTypeDialog(false)
    setPendingErrorLocation(null)
    
    if (playerIsAtNet) {
      setVolleyTypeContext('error')
      setVolleyTypeData({ location, hitterId, winner, errorType })
      setShowVolleyTypeDialog(true)
    } else {
      setShowErrorShotTypeDialog(true)
    }
  }, [pendingErrorLocation, serverId, serverIsOnYourTeam, oppTeamIds, yourTeamIds, playerPositions])

  // Handle shot type selected for winner
  const handleWinnerShotTypeSelected = useCallback((shotType: StrokeType) => {
    if (!pendingWinnerShotData) return
    
    const { location, hitterId, winner } = pendingWinnerShotData

    // Update ball location with stroke type
    const updatedLocation = { ...location, strokeType: shotType }
    setBallLocations(prev => 
      prev.map(loc => loc.id === location.id ? updatedLocation : loc)
    )

    // Build API ball locations
    const apiBallLocations: APIBallLocation[] = ballLocations.map(loc => {
      if (loc.id === location.id) {
        return {
          x: loc.x,
          y: loc.y,
          type: loc.type,
          playerId: loc.playerId,
          strokeType: shotType,
          isIn: loc.isIn,
          servePlacement: loc.servePlacement
        }
      }
      return {
        x: loc.x,
        y: loc.y,
        type: loc.type,
        playerId: loc.playerId,
        strokeType: loc.strokeType,
        isIn: loc.isIn,
        servePlacement: loc.servePlacement
      }
    })

    const winnerTypes: Record<string, string[]> = {}
    if (hitterId) {
      winnerTypes[hitterId] = ['WINNER']
    }

    // Store completed point for undo
    lastCompletedPointRef.current = ballLocations.map(loc => ({ ...loc }))

    setPointsPlayedInGame(prev => prev + 1)
    onPointWon(winner, 'WINNER', rallyLength, hitterId, apiBallLocations, undefined, {}, {}, winnerTypes, {}, faultCount)

    setShowWinnerShotTypeDialog(false)
    setShowVolleyTypeDialog(false)
    setVolleyTypeContext(null)
    setVolleyTypeData(null)
    setPendingWinnerShotData(null)
    resetPoint()
  }, [pendingWinnerShotData, ballLocations, rallyLength, faultCount, onPointWon, resetPoint])

  // Handle shot type selected for error
  const handleErrorShotTypeSelected = useCallback((shotType: StrokeType) => {
    if (!pendingErrorShotData) return
    
    const { location, hitterId, winner, errorType } = pendingErrorShotData

    // Build API ball locations
    const apiBallLocations: APIBallLocation[] = ballLocations.map(loc => {
      if (loc.id === location.id) {
        return {
          x: loc.x,
          y: loc.y,
          type: loc.type,
          playerId: loc.playerId,
          strokeType: shotType,
          isIn: loc.isIn,
          servePlacement: loc.servePlacement
        }
      }
      return {
        x: loc.x,
        y: loc.y,
        type: loc.type,
        playerId: loc.playerId,
        strokeType: loc.strokeType,
        isIn: loc.isIn,
        servePlacement: loc.servePlacement
      }
    })

    const errorTypes: Record<string, string[]> = {}
    if (hitterId) {
      errorTypes[hitterId] = [errorType]
    }

    // Store completed point for undo
    lastCompletedPointRef.current = ballLocations.map(loc => ({ ...loc }))

    setPointsPlayedInGame(prev => prev + 1)
    onPointWon(winner, errorType, rallyLength, hitterId, apiBallLocations, undefined, {}, errorTypes, {}, {}, faultCount)

    setShowErrorShotTypeDialog(false)
    setShowVolleyTypeDialog(false)
    setVolleyTypeContext(null)
    setVolleyTypeData(null)
    setPendingErrorShotData(null)
    resetPoint()
  }, [pendingErrorShotData, ballLocations, rallyLength, faultCount, onPointWon, resetPoint])

  // Handle stroke type selected for normal rally
  const handleStrokeTypeSelected = useCallback((shotType: StrokeType) => {
    if (!pendingStrokeLocation) return
    
    const updatedLocation = { ...pendingStrokeLocation, strokeType: shotType }
    setBallLocations(prev => [...prev, updatedLocation])
    setRallyLength(prev => prev + 1)
    setShowStrokeTypeDialog(false)
    setPendingStrokeLocation(null)
  }, [pendingStrokeLocation])

  // Build undo restore state (matches web version exactly)
  const buildUndoRestoreState = useCallback((locations: BallLocation[]): UndoRestoreState => {
    if (locations.length === 0) {
      return {
        locations: [],
        faultCount: 0,
        rallyLength: 0,
        stage: 'serve',
        lastServeLocation: null
      }
    }

    let updated = locations
    const lastLocation = updated[updated.length - 1]

    if (lastLocation.type === 'outcome') {
      updated = updated.slice(0, -1)
      if (updated.length > 0) {
        updated = updated.slice(0, -1)
      }
    } else {
      updated = updated.slice(0, -1)
    }

    const faultCount = updated.filter(b => b.type === 'serve' && !b.isIn).length
    const hasServeIn = updated.some(b => b.type === 'serve' && b.isIn)
    const rallyShots = updated.filter(b => b.type === 'rally' && !b.sameSideError)
    const rallyLength = (hasServeIn ? 1 : 0) + rallyShots.length
    const stage: 'serve' | 'rally' = rallyShots.length > 0 || hasServeIn ? 'rally' : 'serve'
    const lastServe = [...updated].reverse().find(b => b.type === 'serve' && b.isIn)
    const lastServeLocation = lastServe ? { x: lastServe.x, y: lastServe.y } : null

    return {
      locations: updated,
      faultCount,
      rallyLength,
      stage,
      lastServeLocation
    }
  }, [])

  // Handle undo
  const handleUndo = useCallback(() => {
    hapticLight()
    
    if (ballLocations.length === 0 && currentStage === 'serve') {
      // Undo previous point
      if (lastCompletedPointRef.current && lastCompletedPointRef.current.length > 0) {
        pendingUndoRestoreRef.current = buildUndoRestoreState(lastCompletedPointRef.current)
        onUndo()
        return
      }
      onUndo()
      return
    }
    
    if (ballLocations.length === 0) {
      return
    }
    
    const lastLocation = ballLocations[ballLocations.length - 1]
    
    if (lastLocation.type === 'outcome') {
      setBallLocations(prev => {
        let updated = prev.slice(0, -1)
        
        if (updated.length > 0) {
          const lastShot = updated[updated.length - 1]
          if (lastShot.type === 'rally' && !lastShot.sameSideError) {
            setRallyLength(prev => Math.max(0, prev - 1))
          }
          
          if (lastShot.type === 'serve' && !lastShot.isIn) {
            setFaultCount(prev => Math.max(0, prev - 1))
          }
          
          updated = updated.slice(0, -1)
        }
        
        const hasRallyShots = updated.some(b => b.type === 'rally')
        const hasServeIn = updated.some(b => b.type === 'serve' && b.isIn)
        
        if (hasRallyShots || hasServeIn) {
          setCurrentStage('rally')
        } else {
          setCurrentStage('serve')
        }
        return updated
      })
      return
    }
    
    if (lastLocation.type === 'serve' && !lastLocation.isIn) {
      setFaultCount(prev => Math.max(0, prev - 1))
    }

    if (lastLocation.type === 'rally' && !lastLocation.sameSideError) {
      setRallyLength(prev => Math.max(0, prev - 1))
    }

    if (lastLocation.type === 'serve' && lastLocation.isIn) {
      setCurrentStage('serve')
    } else if (lastLocation.type === 'rally') {
      setCurrentStage('rally')
    }

    setBallLocations(prev => prev.slice(0, -1))
  }, [ballLocations, currentStage, buildUndoRestoreState, onUndo])

  // Handle undo point confirmation
  const handleUndoPointConfirm = useCallback(() => {
    setShowUndoPointDialog(false)
    
    if (lastCompletedPointRef.current && lastCompletedPointRef.current.length > 0) {
      pendingUndoRestoreRef.current = buildUndoRestoreState(lastCompletedPointRef.current)
    }
    
    onUndo()
  }, [onUndo, buildUndoRestoreState])

  // Build player positions for court
  const courtPlayerPositions = useMemo(() => {
    const positions: Array<{
      id: string
      name: string
      x: number
      y: number
      team: 'your' | 'opponent'
      isServer?: boolean
      playerKey: 'server' | 'receiver' | 'server-partner' | 'receiver-partner'
    }> = []

    const receiverId = serverIsOnYourTeam ? (oppTeamIds[0] || '') : (yourTeamIds[0] || '')
    const serveSide = getCurrentServeSide()

    // Calculate center X positions for ad and deuce sides
    // ad service box is on the left (x: 21.82), deuce is on the right (x: 49.55)
    const adCenterX = COURT_BOUNDS.topServiceBox.ad.x + COURT_BOUNDS.topServiceBox.ad.width / 2
    const deuceCenterX = COURT_BOUNDS.topServiceBox.deuce.x + COURT_BOUNDS.topServiceBox.deuce.width / 2

    // Server X position - alternates based on serveSide (matches web version exactly)
    // In tennis, server alternates sides after each point
    // Bottom server: when serving to ad (left), they stand on deuce (right); when serving to deuce (right), they stand on ad (left)
    // Top server: when serving to ad (left), they stand on ad (left); when serving to deuce (right), they stand on deuce (right)
    const serverX = actualServerIsBottom
      ? (serveSide === 'ad' ? deuceCenterX : adCenterX)  // Bottom: ad serve → deuce position, deuce serve → ad position
      : (serveSide === 'ad' ? adCenterX : deuceCenterX)  // Top: ad serve → ad position, deuce serve → deuce position

    // Receiver X position - diagonal from server (opposite X)
    const receiverX = actualServerIsBottom
      ? (serveSide === 'ad' ? adCenterX : deuceCenterX)  // Bottom server: ad serve → top ad, deuce serve → top deuce
      : (serveSide === 'ad' ? deuceCenterX : adCenterX)  // Top server: ad serve → bottom deuce, deuce serve → bottom ad

    // Server position
    const defaultServerPos = {
      x: serverX,
      y: actualServerIsBottom ? 86.92 : 12.13
    }
    const serverPos = playerPositions['server'] || defaultServerPos
    positions.push({
      id: serverId || '',
      name: getPlayerDisplayName(serverId || '', isDoubles),
      x: serverPos.x,
      y: serverPos.y,
      team: serverIsOnYourTeam ? 'your' : 'opponent',
      isServer: true,
      playerKey: 'server'
    })

    // Receiver position - diagonal from server
    const defaultReceiverPos = {
      x: receiverX,
      y: actualServerIsBottom ? 10.46 : 88.39
    }
    const receiverPos = playerPositions['receiver'] || defaultReceiverPos
    positions.push({
      id: receiverId,
      name: getPlayerDisplayName(receiverId, isDoubles),
      x: receiverPos.x,
      y: receiverPos.y,
      team: serverIsOnYourTeam ? 'opponent' : 'your',
      isServer: false,
      playerKey: 'receiver'
    })

    // Doubles partners
    if (isDoubles) {
      const serverPartnerId = serverIsOnYourTeam ? yourTeamIds[1] : oppTeamIds[1]
      const receiverPartnerId = !serverIsOnYourTeam ? yourTeamIds[1] : oppTeamIds[1]
      
      // Partner positions with offset from main player
      const defaultServerPartnerPos = {
        x: defaultServerPos.x + (serverIsOnYourTeam ? 10 : -10),
        y: defaultServerPos.y
      }
      const defaultReceiverPartnerPos = {
        x: defaultReceiverPos.x + (!serverIsOnYourTeam ? 10 : -10),
        y: defaultReceiverPos.y
      }
      
      if (serverPartnerId) {
        const serverPartnerPos = playerPositions['server-partner'] || defaultServerPartnerPos
        positions.push({
          id: serverPartnerId,
          name: getPlayerDisplayName(serverPartnerId, isDoubles),
          x: serverPartnerPos.x,
          y: serverPartnerPos.y,
          team: serverIsOnYourTeam ? 'your' : 'opponent',
          isServer: false,
          playerKey: 'server-partner'
        })
      }
      
      if (receiverPartnerId) {
        const receiverPartnerPos = playerPositions['receiver-partner'] || defaultReceiverPartnerPos
        positions.push({
          id: receiverPartnerId,
          name: getPlayerDisplayName(receiverPartnerId, isDoubles),
          x: receiverPartnerPos.x,
          y: receiverPartnerPos.y,
          team: !serverIsOnYourTeam ? 'your' : 'opponent',
          isServer: false,
          playerKey: 'receiver-partner'
        })
      }
    }

    return positions
  }, [serverId, serverIsOnYourTeam, yourTeamIds, oppTeamIds, isDoubles, playerPositions, getCurrentServeSide, actualServerIsBottom])

  // Calculate next shot side for rally highlight
  const nextShotSide = useMemo((): CourtSide | null => {
    if (currentStage !== 'rally') return null
    
    const allShots = ballLocations.filter(b => b.type === 'serve' || b.type === 'rally')
    const lastShot = allShots[allShots.length - 1]
    
    if (!lastShot || !lastShot.isIn) return null
    
    const lastShotSide: CourtSide = lastShot.y < COURT_BOUNDS.netY ? 'top' : 'bottom'
    return lastShotSide === 'top' ? 'bottom' : 'top'
  }, [currentStage, ballLocations])

  // Toggle player to net position
  const togglePlayerToNet = useCallback((playerKey: 'server' | 'receiver' | 'server-partner' | 'receiver-partner') => {
    handlePlayerTap(playerKey)
  }, [handlePlayerTap])

  // Get player info for net buttons
  const receiverId = serverIsOnYourTeam ? (oppTeamIds[0] || '') : (yourTeamIds[0] || '')
  const serverPartnerId = serverIsOnYourTeam ? yourTeamIds[1] : oppTeamIds[1]
  const receiverPartnerId = !serverIsOnYourTeam ? yourTeamIds[1] : oppTeamIds[1]

  // Calculate max court size for fullscreen (65% of screen height, respecting aspect ratio)
  const maxCourtHeight = SCREEN_HEIGHT * 0.65
  const courtAspectRatio = 440 / 956
  const maxCourtWidth = maxCourtHeight * courtAspectRatio
  const constrainedCourtWidth = Math.min(SCREEN_WIDTH - 24, maxCourtWidth)

  // Calculate score for fullscreen display
  const getScoreData = useMemo(() => {
    if (!stats || yourTeamIds.length === 0 || oppTeamIds.length === 0) return null
    
    const getTeamGames = (gameScores: Record<string, number>, teamIds: string[]) =>
      teamIds.reduce((sum, id) => sum + (gameScores[id] || 0), 0)
    
    const yourTeamNames = yourTeamIds.map(name => getPlayerDisplayName(name, isDoubles)).join(' / ')
    const oppTeamNames = oppTeamIds.map(name => getPlayerDisplayName(name, isDoubles)).join(' / ')
    
    const player1Sets: Array<{ mainScore: number; tiebreakScore?: number } | string> = []
    const player2Sets: Array<{ mainScore: number; tiebreakScore?: number } | string> = []
    
    stats.sets.forEach(set => {
      player1Sets.push({
        mainScore: getTeamGames(set.games, yourTeamIds),
        tiebreakScore: set.tiebreak ? getTeamGames(set.tiebreak, yourTeamIds) : undefined,
      })
      player2Sets.push({
        mainScore: getTeamGames(set.games, oppTeamIds),
        tiebreakScore: set.tiebreak ? getTeamGames(set.tiebreak, oppTeamIds) : undefined,
      })
    })
    
    if (!stats.matchWinner) {
      player1Sets.push({
        mainScore: getTeamGames(stats.currentSet.games, yourTeamIds),
        tiebreakScore: stats.currentSet.tiebreak ? getTeamGames(stats.currentSet.tiebreak, yourTeamIds) : undefined,
      })
      player2Sets.push({
        mainScore: getTeamGames(stats.currentSet.games, oppTeamIds),
        tiebreakScore: stats.currentSet.tiebreak ? getTeamGames(stats.currentSet.tiebreak, oppTeamIds) : undefined,
      })
    }
    
    const serverIsOnYourTeam = yourTeamIds.includes(serverId || '')
    const player1GameScore = serverIsOnYourTeam ? stats.currentGame.serverDisplay : stats.currentGame.receiverDisplay
    const player2GameScore = serverIsOnYourTeam ? stats.currentGame.receiverDisplay : stats.currentGame.serverDisplay
    
    return {
      yourTeamNames,
      oppTeamNames,
      player1Sets,
      player2Sets,
      player1GameScore,
      player2GameScore,
      player1Serving: serverIsOnYourTeam,
      player2Serving: !serverIsOnYourTeam,
    }
  }, [stats, yourTeamIds, oppTeamIds, isDoubles, serverId])

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Advanced Stats Tracker</Text>
          <Text style={styles.headerSubtitle}>
            Tap court to track shots. Server: {actualServerIsBottom ? 'Bottom' : 'Top'} ({getCurrentServeSide()})
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => {
              hapticLight();
              setIsFullscreen(true);
            }}
            activeOpacity={0.7}
          >
            <Feather name="maximize-2" size={18} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleUndo}
            disabled={actionLoading}
            activeOpacity={0.7}
          >
            <Feather name="rotate-ccw" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Court */}
      <View style={styles.courtWrapper}>
        <TennisCourt
          ballLocations={ballLocations}
          playerPositions={courtPlayerPositions}
          currentStage={currentStage}
          serveSide={getCurrentServeSide()}
          serverIsBottom={actualServerIsBottom}
          isDoubles={isDoubles}
          showServiceBoxHighlight={
            currentStage === 'serve' && 
            !ballLocations.some(b => b.type === 'serve' && b.isIn) &&
            !!match.server &&
            (match.startingCourtSide === 'top' || match.startingCourtSide === 'bottom')
          }
          showRallyHighlight={currentStage === 'rally'}
          nextShotSide={nextShotSide}
          onCourtTap={handleCourtTap}
          onPlayerDrag={handlePlayerDrag}
          onPlayerTap={handlePlayerTap}
          disabled={actionLoading}
          courtStyle={match.courtStyle || 'hard_1'}
        />
      </View>

      {/* Doubles Net Toggle Buttons - Mobile */}
      {isDoubles && (
        <View style={styles.netButtonsContainer}>
          <View style={styles.netButtonRow}>
            <TouchableOpacity
              style={[styles.netButton, actualServerIsBottom ? styles.netButtonBottom : styles.netButtonTop]}
              onPress={() => togglePlayerToNet('server')}
              activeOpacity={0.7}
            >
              <Text style={styles.netButtonName} numberOfLines={1}>
                {getPlayerDisplayName(serverId || '', isDoubles)}
              </Text>
              <Text style={styles.netButtonLabel}>To Net</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.netButton, actualServerIsBottom ? styles.netButtonBottom : styles.netButtonTop]}
              onPress={() => togglePlayerToNet('server-partner')}
              activeOpacity={0.7}
            >
              <Text style={styles.netButtonName} numberOfLines={1}>
                {getPlayerDisplayName(serverPartnerId || '', isDoubles)}
              </Text>
              <Text style={styles.netButtonLabel}>To Net</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.netButtonRow}>
            <TouchableOpacity
              style={[styles.netButton, actualServerIsBottom ? styles.netButtonTop : styles.netButtonBottom]}
              onPress={() => togglePlayerToNet('receiver')}
              activeOpacity={0.7}
            >
              <Text style={styles.netButtonName} numberOfLines={1}>
                {getPlayerDisplayName(receiverId, isDoubles)}
              </Text>
              <Text style={styles.netButtonLabel}>To Net</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.netButton, actualServerIsBottom ? styles.netButtonTop : styles.netButtonBottom]}
              onPress={() => togglePlayerToNet('receiver-partner')}
              activeOpacity={0.7}
            >
              <Text style={styles.netButtonName} numberOfLines={1}>
                {getPlayerDisplayName(receiverPartnerId || '', isDoubles)}
              </Text>
              <Text style={styles.netButtonLabel}>To Net</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Status bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Stage</Text>
          <Text style={styles.statusValue}>{currentStage.toUpperCase()}</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Rally</Text>
          <Text style={styles.statusValue}>{rallyLength}</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Faults</Text>
          <Text style={styles.statusValue}>{faultCount}</Text>
        </View>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Side</Text>
          <Text style={styles.statusValue}>{getCurrentServeSide().toUpperCase()}</Text>
        </View>
      </View>

      {/* Undo button - for singles (doubles has it in header) */}
      {!isDoubles && (
        <TouchableOpacity
          style={[styles.undoButton, actionLoading && styles.disabledButton]}
          onPress={handleUndo}
          disabled={actionLoading}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['rgba(239, 68, 68, 0.2)', 'rgba(220, 38, 38, 0.2)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.undoButtonGradient}
          >
            <Feather name="rotate-ccw" size={20} color="#ffffff" />
            <Text style={styles.undoButtonText}>UNDO</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Dialogs - only render outside Modal when NOT in fullscreen */}
      {!isFullscreen && (
        <>
          <ErrorTypeDialog
            visible={showErrorTypeDialog}
            onClose={() => {
              if (pendingErrorLocation) {
                setBallLocations(prev => prev.filter(loc => loc.id !== pendingErrorLocation.location.id))
              }
              setShowErrorTypeDialog(false)
              setPendingErrorLocation(null)
            }}
            onSelect={handleErrorTypeSelected}
          />

          <ShotTypeDialog
            visible={showErrorShotTypeDialog}
            title="Shot Type"
            subtitle="What type of shot was missed?"
            onClose={() => {
              if (pendingErrorShotData) {
                setBallLocations(prev => prev.filter(loc => loc.id !== pendingErrorShotData.location.id))
              }
              setShowErrorShotTypeDialog(false)
              setPendingErrorShotData(null)
            }}
            onSelect={handleErrorShotTypeSelected}
          />

          <ShotTypeDialog
            visible={showWinnerShotTypeDialog}
            title="Shot Type"
            subtitle="What type of shot was the winner?"
            onClose={() => {
              if (pendingWinnerShotData) {
                setBallLocations(prev => prev.filter(loc => loc.id !== pendingWinnerShotData.location.id))
              }
              setShowWinnerShotTypeDialog(false)
              setPendingWinnerShotData(null)
            }}
            onSelect={handleWinnerShotTypeSelected}
          />

          <ShotTypeDialog
            visible={showStrokeTypeDialog}
            title="Shot Type"
            subtitle="What type of shot was hit?"
            onClose={() => {
              setShowStrokeTypeDialog(false)
              setPendingStrokeLocation(null)
            }}
            onSelect={handleStrokeTypeSelected}
          />

          <VolleyTypeDialog
            visible={showVolleyTypeDialog}
            context={volleyTypeContext}
            onClose={() => {
              if (volleyTypeData) {
                setBallLocations(prev => prev.filter(loc => loc.id !== volleyTypeData.location.id))
              }
              setShowVolleyTypeDialog(false)
              setVolleyTypeContext(null)
              setVolleyTypeData(null)
            }}
            onSelect={(shotType: StrokeType) => {
              if (volleyTypeContext === 'error') {
                handleErrorShotTypeSelected(shotType)
              } else if (volleyTypeContext === 'winner') {
                handleWinnerShotTypeSelected(shotType)
              }
            }}
          />

          <PlayerSelectorDialog
            visible={showPlayerSelector}
            players={isDoubles ? 
              (serverIsOnYourTeam ? oppTeamIds : yourTeamIds).map(id => ({
                id,
                name: getPlayerDisplayName(id, isDoubles),
                team: serverIsOnYourTeam ? 'opponent' : 'your'
              })) : []
            }
            onClose={() => {
              setShowPlayerSelector(false)
              setPendingPlayerLocation(null)
            }}
            onSelect={(playerId: string) => {
              if (pendingPlayerLocation) {
                const updatedLocation = { ...pendingPlayerLocation, playerId }
                setBallLocations(prev => [...prev, updatedLocation])
                setRallyLength(prev => prev + 1)
              }
              setShowPlayerSelector(false)
              setPendingPlayerLocation(null)
            }}
          />

          <UndoPointDialog
            visible={showUndoPointDialog}
            onClose={() => setShowUndoPointDialog(false)}
            onConfirm={handleUndoPointConfirm}
            loading={actionLoading}
          />
        </>
      )}

      {/* Fullscreen Court Modal */}
      <Modal
        visible={isFullscreen}
        transparent={false}
        animationType="fade"
        onRequestClose={() => {
          hapticLight();
          setIsFullscreen(false);
        }}
        statusBarTranslucent
      >
        <View style={styles.fullscreenContainer}>
          {/* Header */}
          <View style={[styles.fullscreenHeader, { paddingTop: Math.max(insets.top, 8) + 12 }]}>
            <View style={styles.fullscreenHeaderLeft}>
              <Text style={styles.fullscreenTitle} numberOfLines={1}>Court View</Text>
              <Text style={styles.fullscreenSubtitle} numberOfLines={1}>
                Server: {actualServerIsBottom ? 'Bottom' : 'Top'} ({getCurrentServeSide()})
              </Text>
            </View>
            <View style={styles.fullscreenHeaderButtons}>
              <TouchableOpacity
                style={styles.fullscreenExitButton}
                onPress={() => {
                  hapticLight();
                  setIsFullscreen(false);
                }}
                activeOpacity={0.7}
              >
                <Feather name="x" size={20} color="#ffffff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.fullscreenHeaderButton}
                onPress={handleUndo}
                disabled={actionLoading}
                activeOpacity={0.7}
              >
                <Feather name="rotate-ccw" size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Score Display */}
          {getScoreData ? (
            <View style={styles.fullscreenScoreContainer}>
              <View style={styles.fullscreenScoreRow}>
                <View style={styles.fullscreenScoreTeam}>
                  <Text style={styles.fullscreenScoreTeamName} numberOfLines={1}>
                    {getScoreData.yourTeamNames}
                  </Text>
                  <View style={styles.fullscreenScoreSets}>
                    {getScoreData.player1Sets.slice(0, 3).map((set, i) => (
                      <View key={i} style={styles.fullscreenScoreSet}>
                        {typeof set === 'object' && set ? (
                          <>
                            <Text style={styles.fullscreenScoreSetValue}>{set.mainScore}</Text>
                            {set.tiebreakScore !== undefined && (
                              <Text style={styles.fullscreenScoreTiebreak}>{set.tiebreakScore}</Text>
                            )}
                          </>
                        ) : (
                          <Text style={styles.fullscreenScoreSetValue}>-</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
                <View style={styles.fullscreenScoreGame}>
                  <LinearGradient
                    colors={getScoreData.player1Serving 
                      ? ['rgba(34, 197, 94, 0.4)', 'rgba(16, 185, 129, 0.4)']
                      : ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.fullscreenScoreGameBox}
                  >
                    <Text style={styles.fullscreenScoreGameValue}>{getScoreData.player1GameScore}</Text>
                  </LinearGradient>
                </View>
              </View>
              <View style={[styles.fullscreenScoreRow, { marginBottom: 0 }]}>
                <View style={styles.fullscreenScoreTeam}>
                  <Text style={styles.fullscreenScoreTeamName} numberOfLines={1}>
                    {getScoreData.oppTeamNames}
                  </Text>
                  <View style={styles.fullscreenScoreSets}>
                    {getScoreData.player2Sets.slice(0, 3).map((set, i) => (
                      <View key={i} style={styles.fullscreenScoreSet}>
                        {typeof set === 'object' && set ? (
                          <>
                            <Text style={styles.fullscreenScoreSetValue}>{set.mainScore}</Text>
                            {set.tiebreakScore !== undefined && (
                              <Text style={styles.fullscreenScoreTiebreak}>{set.tiebreakScore}</Text>
                            )}
                          </>
                        ) : (
                          <Text style={styles.fullscreenScoreSetValue}>-</Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
                <View style={styles.fullscreenScoreGame}>
                  <LinearGradient
                    colors={getScoreData.player2Serving 
                      ? ['rgba(34, 197, 94, 0.4)', 'rgba(16, 185, 129, 0.4)']
                      : ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.fullscreenScoreGameBox}
                  >
                    <Text style={styles.fullscreenScoreGameValue}>{getScoreData.player2GameScore}</Text>
                  </LinearGradient>
                </View>
              </View>
            </View>
          ) : null}
          
          {/* Court - smaller, centered */}
          <View style={styles.fullscreenCourtWrapper}>
            <View style={[styles.fullscreenCourtInner, { width: constrainedCourtWidth, maxWidth: constrainedCourtWidth }]}>
              <TennisCourt
                ballLocations={ballLocations}
                playerPositions={courtPlayerPositions}
                currentStage={currentStage}
                serveSide={getCurrentServeSide()}
                serverIsBottom={actualServerIsBottom}
                isDoubles={isDoubles}
                showServiceBoxHighlight={
                  currentStage === 'serve' && 
                  !ballLocations.some(b => b.type === 'serve' && b.isIn) &&
                  !!match.server &&
                  (match.startingCourtSide === 'top' || match.startingCourtSide === 'bottom')
                }
                showRallyHighlight={currentStage === 'rally'}
                nextShotSide={nextShotSide}
                onCourtTap={handleCourtTap}
                onPlayerDrag={handlePlayerDrag}
                onPlayerTap={handlePlayerTap}
                disabled={actionLoading}
                courtStyle={match.courtStyle || 'hard_1'}
              />
            </View>
          </View>

          {/* Net Buttons for Doubles */}
          {isDoubles && (
            <View style={styles.fullscreenNetButtonsContainer}>
              <View style={styles.netButtonRow}>
                <TouchableOpacity
                  style={[styles.netButton, actualServerIsBottom ? styles.netButtonBottom : styles.netButtonTop]}
                  onPress={() => togglePlayerToNet('server')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.netButtonName} numberOfLines={1}>
                    {getPlayerDisplayName(serverId || '', isDoubles)}
                  </Text>
                  <Text style={styles.netButtonLabel}>To Net</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.netButton, actualServerIsBottom ? styles.netButtonBottom : styles.netButtonTop]}
                  onPress={() => togglePlayerToNet('server-partner')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.netButtonName} numberOfLines={1}>
                    {getPlayerDisplayName(serverPartnerId || '', isDoubles)}
                  </Text>
                  <Text style={styles.netButtonLabel}>To Net</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.netButtonRow}>
                <TouchableOpacity
                  style={[styles.netButton, actualServerIsBottom ? styles.netButtonTop : styles.netButtonBottom]}
                  onPress={() => togglePlayerToNet('receiver')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.netButtonName} numberOfLines={1}>
                    {getPlayerDisplayName(receiverId, isDoubles)}
                  </Text>
                  <Text style={styles.netButtonLabel}>To Net</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.netButton, actualServerIsBottom ? styles.netButtonTop : styles.netButtonBottom]}
                  onPress={() => togglePlayerToNet('receiver-partner')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.netButtonName} numberOfLines={1}>
                    {getPlayerDisplayName(receiverPartnerId || '', isDoubles)}
                  </Text>
                  <Text style={styles.netButtonLabel}>To Net</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Status Bar at Bottom */}
          <View style={[styles.fullscreenStatusBar, { paddingBottom: Math.max(insets.bottom, 8) + 12 }]}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel} numberOfLines={1}>Stage</Text>
              <Text style={styles.statusValue} numberOfLines={1}>{currentStage.toUpperCase()}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel} numberOfLines={1}>Rally</Text>
              <Text style={styles.statusValue} numberOfLines={1}>{rallyLength}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel} numberOfLines={1}>Faults</Text>
              <Text style={styles.statusValue} numberOfLines={1}>{faultCount}</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel} numberOfLines={1}>Side</Text>
              <Text style={styles.statusValue} numberOfLines={1}>{getCurrentServeSide().toUpperCase()}</Text>
            </View>
          </View>

          {/* Dialogs - rendered inside Modal to appear above fullscreen court */}
          <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} pointerEvents="box-none">
            <ErrorTypeDialog
              visible={showErrorTypeDialog}
              onClose={() => {
                if (pendingErrorLocation) {
                  setBallLocations(prev => prev.filter(loc => loc.id !== pendingErrorLocation.location.id))
                }
                setShowErrorTypeDialog(false)
                setPendingErrorLocation(null)
              }}
              onSelect={handleErrorTypeSelected}
            />

            <ShotTypeDialog
              visible={showErrorShotTypeDialog}
              title="Shot Type"
              subtitle="What type of shot was missed?"
              onClose={() => {
                if (pendingErrorShotData) {
                  setBallLocations(prev => prev.filter(loc => loc.id !== pendingErrorShotData.location.id))
                }
                setShowErrorShotTypeDialog(false)
                setPendingErrorShotData(null)
              }}
              onSelect={handleErrorShotTypeSelected}
            />

            <ShotTypeDialog
              visible={showWinnerShotTypeDialog}
              title="Shot Type"
              subtitle="What type of shot was the winner?"
              onClose={() => {
                if (pendingWinnerShotData) {
                  setBallLocations(prev => prev.filter(loc => loc.id !== pendingWinnerShotData.location.id))
                }
                setShowWinnerShotTypeDialog(false)
                setPendingWinnerShotData(null)
              }}
              onSelect={handleWinnerShotTypeSelected}
            />

            <ShotTypeDialog
              visible={showStrokeTypeDialog}
              title="Shot Type"
              subtitle="What type of shot was hit?"
              onClose={() => {
                setShowStrokeTypeDialog(false)
                setPendingStrokeLocation(null)
              }}
              onSelect={handleStrokeTypeSelected}
            />

            <VolleyTypeDialog
              visible={showVolleyTypeDialog}
              context={volleyTypeContext}
              onClose={() => {
                if (volleyTypeData) {
                  setBallLocations(prev => prev.filter(loc => loc.id !== volleyTypeData.location.id))
                }
                setShowVolleyTypeDialog(false)
                setVolleyTypeContext(null)
                setVolleyTypeData(null)
              }}
              onSelect={(shotType: StrokeType) => {
                if (volleyTypeContext === 'error') {
                  handleErrorShotTypeSelected(shotType)
                } else if (volleyTypeContext === 'winner') {
                  handleWinnerShotTypeSelected(shotType)
                }
              }}
            />

            <PlayerSelectorDialog
              visible={showPlayerSelector}
              players={isDoubles ? 
                (serverIsOnYourTeam ? oppTeamIds : yourTeamIds).map(id => ({
                  id,
                  name: getPlayerDisplayName(id, isDoubles),
                  team: serverIsOnYourTeam ? 'opponent' : 'your'
                })) : []
              }
              onClose={() => {
                setShowPlayerSelector(false)
                setPendingPlayerLocation(null)
              }}
              onSelect={(playerId: string) => {
                if (pendingPlayerLocation) {
                  const updatedLocation = { ...pendingPlayerLocation, playerId }
                  setBallLocations(prev => [...prev, updatedLocation])
                  setRallyLength(prev => prev + 1)
                }
                setShowPlayerSelector(false)
                setPendingPlayerLocation(null)
              }}
            />

            <UndoPointDialog
              visible={showUndoPointDialog}
              onClose={() => setShowUndoPointDialog(false)}
              onConfirm={handleUndoPointConfirm}
              loading={actionLoading}
            />
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  courtWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#020617',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  fullscreenHeaderLeft: {
    flex: 1,
  },
  fullscreenTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  fullscreenSubtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  fullscreenHeaderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  fullscreenHeaderButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenExitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  fullscreenCourtWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 0,
  },
  fullscreenCourtInner: {
    maxHeight: SCREEN_HEIGHT * 0.65, // 65% of screen height
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenScoreContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  fullscreenScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fullscreenScoreTeam: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  fullscreenScoreTeamName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    minWidth: 70,
    maxWidth: 70,
  },
  fullscreenScoreSets: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  fullscreenScoreSet: {
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenScoreSetValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  fullscreenScoreTiebreak: {
    fontSize: 9,
    fontWeight: '600',
    color: '#9ca3af',
    marginTop: -1,
  },
  fullscreenScoreGame: {
    marginLeft: 8,
  },
  fullscreenScoreGameBox: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenScoreGameValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  fullscreenScoreLoading: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 8,
  },
  fullscreenNetButtonsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  fullscreenStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
  },
  statusItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  statusLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  undoButton: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  undoButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    gap: 8,
  },
  undoButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  disabledButton: {
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  netButtonsContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  netButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  netButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  netButtonTop: {
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
  },
  netButtonBottom: {
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
  },
  netButtonName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  netButtonLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 9,
    marginTop: 2,
  },
})
