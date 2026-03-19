import React, { useCallback, useState } from 'react'
import { View, StyleSheet, Image, LayoutChangeEvent, Pressable } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated'
import { COURT_BOUNDS, BallLocation, ServeSide, CourtSide } from '../utils/courtBounds'
import { touchToCourtPercent } from '../utils/gameLogic'
import { getCourtTheme } from '../utils/courtTheme'
import BallMarker from './BallMarker'
import PlayerMarker, { PlayerTeam } from './PlayerMarker'

// Import court images
const courtImages = {
  hard_1: require('../../../../assets/hard_1.png'),
  hard_2: require('../../../../assets/hard_2.png'),
  clay_court: require('../../../../assets/clay_court.png'),
  grass_court: require('../../../../assets/grass_court.png'),
} as const;

interface PlayerPosition {
  id: string
  name: string
  x: number
  y: number
  team: PlayerTeam
  isServer?: boolean
  playerKey: 'server' | 'receiver' | 'server-partner' | 'receiver-partner'
}

interface TennisCourtProps {
  ballLocations: BallLocation[]
  playerPositions: PlayerPosition[]
  currentStage: 'serve' | 'rally' | 'outcome'
  serveSide?: ServeSide
  serverIsBottom?: boolean
  isDoubles?: boolean
  showServiceBoxHighlight?: boolean
  showRallyHighlight?: boolean
  nextShotSide?: CourtSide | null
  onCourtTap?: (x: number, y: number) => void
  onPlayerDrag?: (playerKey: string, x: number, y: number) => void
  onPlayerTap?: (playerKey: string) => void
  disabled?: boolean
  courtStyle?: 'hard_1' | 'hard_2' | 'clay_court' | 'grass_court'
}

export default function TennisCourt({
  ballLocations,
  playerPositions,
  currentStage,
  serveSide = 'deuce',
  serverIsBottom = true,
  isDoubles = false,
  showServiceBoxHighlight = false,
  showRallyHighlight = false,
  nextShotSide = null,
  onCourtTap,
  onPlayerDrag,
  onPlayerTap,
  disabled = false,
  courtStyle = 'hard_1',
}: TennisCourtProps) {
  const [courtDimensions, setCourtDimensions] = useState({ width: 0, height: 0 })
  const theme = getCourtTheme(courtStyle)

  const serviceBoxOverallOpacity = useSharedValue(0.4)
  const serviceBoxShadowRadius = useSharedValue(0)

  const rallyHighlightOpacity = useSharedValue(0.5)

  React.useEffect(() => {
    if (showServiceBoxHighlight) {
      serviceBoxOverallOpacity.value = withRepeat(
        withTiming(0.6, { 
          duration: 1500, 
          easing: Easing.inOut(Easing.ease) 
        }),
        -1,
        true
      )
      serviceBoxShadowRadius.value = withRepeat(
        withTiming(10, { 
          duration: 1500, 
          easing: Easing.inOut(Easing.ease) 
        }),
        -1,
        true
      )
    } else {
      serviceBoxOverallOpacity.value = 0
      serviceBoxShadowRadius.value = 0
    }
  }, [showServiceBoxHighlight, serviceBoxOverallOpacity, serviceBoxShadowRadius])

  React.useEffect(() => {
    if (showRallyHighlight && currentStage === 'rally') {
      rallyHighlightOpacity.value = 0.5
      rallyHighlightOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1000 }),
          withTiming(0.5, { duration: 1000 })
        ),
        -1,
        false
      )
    } else {
      rallyHighlightOpacity.value = 0
    }
  }, [showRallyHighlight, currentStage, rallyHighlightOpacity])

  const serviceBoxAnimatedStyle = useAnimatedStyle(() => ({
    opacity: serviceBoxOverallOpacity.value,
    shadowRadius: serviceBoxShadowRadius.value,
    shadowOpacity: serviceBoxShadowRadius.value > 0 ? 0.8 : 0,
  }))

  const rallyHighlightAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rallyHighlightOpacity.value,
  }))

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setCourtDimensions({ width, height })
  }, [])

  const handleCourtPress = useCallback((event: any) => {
    if (disabled || !onCourtTap) return
    
    const { locationX, locationY } = event.nativeEvent
    if (courtDimensions.width === 0 || courtDimensions.height === 0) return
    
    const { x, y } = touchToCourtPercent(
      locationX,
      locationY,
      courtDimensions.width,
      courtDimensions.height
    )
    
    onCourtTap(x, y)
  }, [courtDimensions, disabled, onCourtTap])

  // Calculate service box position for highlighting
  // Must match web version's targetBoxSide logic exactly
  const getServiceBoxStyle = (): { left: `${number}%`; top: `${number}%`; width: `${number}%`; height: `${number}%` } => {
    const receiverSide: CourtSide = serverIsBottom ? 'top' : 'bottom'
    // Match web version: actualServerIsBottom ? serveSide : (serveSide === 'ad' ? 'deuce' : 'ad')
    const highlightSide: ServeSide = serverIsBottom ? serveSide : (serveSide === 'ad' ? 'deuce' : 'ad')
    
    const serviceBox = receiverSide === 'bottom' 
      ? COURT_BOUNDS.bottomServiceBox[highlightSide]
      : COURT_BOUNDS.topServiceBox[highlightSide]

    return {
      left: `${serviceBox.x}%` as `${number}%`,
      top: `${serviceBox.y}%` as `${number}%`,
      width: `${serviceBox.width}%` as `${number}%`,
      height: `${serviceBox.height}%` as `${number}%`,
    }
  }

  // Calculate rally highlight area
  const getRallyHighlightStyle = (): { left: `${number}%`; top: `${number}%`; width: `${number}%`; height: `${number}%` } | null => {
    if (!nextShotSide) return null

    const bounds = isDoubles ? COURT_BOUNDS.doubles : COURT_BOUNDS.singles

    return {
      left: `${bounds.left}%` as `${number}%`,
      top: (nextShotSide === 'top' ? `${bounds.top}%` : `${COURT_BOUNDS.netY}%`) as `${number}%`,
      width: `${bounds.right - bounds.left}%` as `${number}%`,
      height: (nextShotSide === 'top' 
        ? `${COURT_BOUNDS.netY - bounds.top}%`
        : `${bounds.bottom - COURT_BOUNDS.netY}%`) as `${number}%`,
    }
  }

  const latestBallId = ballLocations.length > 0 
    ? ballLocations[ballLocations.length - 1].id 
    : null

  return (
    <GestureHandlerRootView style={styles.container}>
      <Pressable 
        onPress={handleCourtPress}
        disabled={disabled}
        style={styles.pressable}
      >
        <View 
          style={styles.courtContainer}
          onLayout={handleLayout}
        >
          {/* Court background image */}
          <Image
            source={courtImages[courtStyle]}
            style={styles.courtImage}
            resizeMode="cover"
          />

          {/* Service box highlight - matching web version exactly */}
          {showServiceBoxHighlight && currentStage === 'serve' && (
            <Animated.View
              pointerEvents="none"
              className="absolute z-10"
              style={[
                getServiceBoxStyle(),
              ]}
            >
              <Animated.View
                className="absolute inset-0 rounded-sm"
                style={[
                  {
                    borderWidth: 2,
                    borderColor: theme.serviceBox.border,
                    backgroundColor: theme.serviceBox.background,
                  },
                  serviceBoxAnimatedStyle,
                  {
                    shadowColor: theme.serviceBox.shadow,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 5,
                  }
                ]}
              />
            </Animated.View>
          )}

          {/* Rally highlight - matching web version exactly */}
          {showRallyHighlight && currentStage === 'rally' && nextShotSide && (() => {
            const rallyStyle = getRallyHighlightStyle()
            if (!rallyStyle) return null
            
            return (
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: 'absolute',
                    left: rallyStyle.left,
                    top: rallyStyle.top,
                    width: rallyStyle.width,
                    height: rallyStyle.height,
                    borderWidth: 2,
                    borderColor: theme.rally.border,
                    backgroundColor: theme.rally.background,
                    zIndex: 5,
                  },
                  rallyHighlightAnimatedStyle,
                ]}
              />
            )
          })()}

          {/* Ball markers */}
          {ballLocations.map((ball, index) => {
            // Calculate shotIndex exactly like web version
            let shotIndex: number | undefined
            if (ball.type === 'serve' && !ball.isIn) {
              // Fault doesn't count as a shot
              shotIndex = 0
            } else if (ball.type === 'serve' || ball.type === 'rally') {
              // Count only serves that are in, and all rally shots
              shotIndex = ballLocations.slice(0, index + 1).filter(b => {
                if (b.type === 'serve') {
                  return b.isIn === true
                }
                return b.type === 'rally'
              }).length
            }
            
            // Match web sizes: serve=20px (w-5 h-5), rally=16px (w-4 h-4), outcome=24px (w-6 h-6)
            const size = ball.type === 'serve' ? 20 : ball.type === 'outcome' ? 24 : 16
            return (
              <BallMarker
                key={ball.id}
                x={ball.x}
                y={ball.y}
                type={ball.type}
                isIn={ball.isIn}
                shotIndex={shotIndex}
                size={size}
                theme={theme.ball}
              />
            )
          })}

          {/* Player markers */}
          {playerPositions.map((player) => (
            <PlayerMarker
              key={player.playerKey}
              x={player.x}
              y={player.y}
              name={player.name}
              team={player.team}
              isServer={player.isServer}
              courtWidth={courtDimensions.width}
              courtHeight={courtDimensions.height}
              disabled={disabled}
              teamColors={theme.player}
              onDragEnd={(newX, newY) => {
                if (onPlayerDrag) {
                  onPlayerDrag(player.playerKey, newX, newY)
                }
              }}
              onTap={() => {
                if (onPlayerTap) {
                  onPlayerTap(player.playerKey)
                }
              }}
            />
          ))}
        </View>
      </Pressable>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  pressable: {
    width: '100%',
    maxWidth: 400,
  },
  courtContainer: {
    width: '100%',
    aspectRatio: 736 / 1539,
    position: 'relative',
  },
  courtImage: {
    width: '100%',
    height: '100%',
  },
})
