import React, { useEffect } from 'react'
import { View, Text } from 'react-native'
import Animated, { 
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
  FadeOut
} from 'react-native-reanimated'
import type { CourtTheme } from '../utils/courtTheme'

export type BallType = 'serve' | 'return' | 'rally' | 'outcome'

interface BallMarkerProps {
  x: number
  y: number
  type: BallType
  isIn?: boolean
  shotIndex?: number
  size?: number
  theme?: CourtTheme['ball']
}

const defaultBallTheme: CourtTheme['ball'] = {
  serveIn: '#22c55e',
  serveInBorder: '#86efac',
  serveOut: '#ef4444',
  serveOutBorder: '#fca5a5',
  rallyIn: '#3b82f6',
  rallyInBorder: '#93c5fd',
  rallyOut: '#f97316',
  rallyOutBorder: '#fdba74',
  outcome: '#a855f7',
  outcomeBorder: '#d8b4fe',
  servePulseIn: '#22c55e',
  servePulseOut: '#ef4444',
}

export default function BallMarker({
  x,
  y,
  type,
  isIn = true,
  shotIndex,
  size,
  theme = defaultBallTheme,
}: BallMarkerProps) {
  let bgColor: string
  let borderColor: string
  let actualSize: number

  if (type === 'serve') {
    bgColor = isIn ? theme.serveIn : theme.serveOut
    borderColor = isIn ? theme.serveInBorder : theme.serveOutBorder
    actualSize = size || 20
  } else if (type === 'rally') {
    bgColor = isIn ? theme.rallyIn : theme.rallyOut
    borderColor = isIn ? theme.rallyInBorder : theme.rallyOutBorder
    actualSize = size || 16
  } else {
    bgColor = theme.outcome
    borderColor = theme.outcomeBorder
    actualSize = size || 24
  }

  const pulseColor = isIn ? theme.servePulseIn : theme.servePulseOut

  const pulseOpacity = useSharedValue(0.5)
  const pulseScale = useSharedValue(1)

  useEffect(() => {
    if (type === 'serve') {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 750 }),
          withTiming(0.5, { duration: 750 })
        ),
        -1,
        false
      )
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 750 }),
          withTiming(1, { duration: 750 })
        ),
        -1,
        false
      )
    } else {
      pulseOpacity.value = 0
      pulseScale.value = 1
    }
  }, [type, pulseOpacity, pulseScale])

  const servePulseStyle = useAnimatedStyle(() => {
    if (type === 'serve') {
      return {
        opacity: pulseOpacity.value,
        transform: [{ scale: pulseScale.value }]
      }
    }
    return { opacity: 0 }
  })

  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={{
        position: 'absolute',
        zIndex: 10,
        left: `${x}%`,
        top: `${y}%`,
        transform: [{ translateX: -actualSize / 2 }, { translateY: -actualSize / 2 }],
      }}
    >
      <View
        style={{
          width: actualSize,
          height: actualSize,
          borderRadius: actualSize / 2,
          borderWidth: 2,
          backgroundColor: bgColor,
          borderColor,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.3,
          shadowRadius: 2,
          elevation: 3,
        }}
      >
        {(type === 'serve' || type === 'rally') && shotIndex !== undefined && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '700', lineHeight: 10 }}>
              {shotIndex}
            </Text>
          </View>
        )}
      </View>
      
      {type === 'serve' && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: actualSize,
              height: actualSize,
              borderRadius: actualSize / 2,
              backgroundColor: pulseColor,
              left: 0,
              top: 0,
            },
            servePulseStyle,
          ]}
          pointerEvents="none"
        />
      )}
    </Animated.View>
  )
}
