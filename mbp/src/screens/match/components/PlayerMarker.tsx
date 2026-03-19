import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated'
import type { CourtTheme } from '../utils/courtTheme'

export type PlayerTeam = 'your' | 'opponent'

interface PlayerMarkerProps {
  x: number
  y: number
  name: string
  team: PlayerTeam
  isServer?: boolean
  onDragEnd?: (newX: number, newY: number) => void
  onTap?: () => void
  courtWidth: number
  courtHeight: number
  disabled?: boolean
  teamColors?: CourtTheme['player']
}

export default function PlayerMarker({
  x,
  y,
  name,
  team,
  isServer = false,
  onDragEnd,
  onTap,
  courtWidth,
  courtHeight,
  disabled = false,
  teamColors,
}: PlayerMarkerProps) {
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const scale = useSharedValue(1)
  const isDragging = useSharedValue(false)

  // Convert percentage to pixels
  const pixelX = (x / 100) * courtWidth
  const pixelY = (y / 100) * courtHeight

  const yourColor = teamColors?.your ?? '#22c55e'
  const oppColor = teamColors?.opponent ?? '#3b82f6'
  const serverColor = teamColors?.server ?? '#fbbf24'

  const backgroundColor = team === 'your' ? yourColor : oppColor
  const borderColor = isServer ? serverColor : 'rgba(255, 255, 255, 0.5)'

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .onStart(() => {
      isDragging.value = true
      scale.value = withSpring(1.2, { damping: 15 })
    })
    .onUpdate((event) => {
      translateX.value = event.translationX
      translateY.value = event.translationY
    })
    .onEnd(() => {
      isDragging.value = false
      scale.value = withSpring(1, { damping: 15 })
      
      if (onDragEnd) {
        // Calculate new percentage position
        const newPixelX = pixelX + translateX.value
        const newPixelY = pixelY + translateY.value
        const newPercentX = (newPixelX / courtWidth) * 100
        const newPercentY = (newPixelY / courtHeight) * 100
        
        // Clamp to bounds
        const clampedX = Math.max(0, Math.min(100, newPercentX))
        const clampedY = Math.max(0, Math.min(100, newPercentY))
        
        runOnJS(onDragEnd)(clampedX, clampedY)
      }
      
      translateX.value = withSpring(0)
      translateY.value = withSpring(0)
    })

  const tapGesture = Gesture.Tap()
    .enabled(!disabled)
    .onEnd(() => {
      if (onTap) {
        runOnJS(onTap)()
      }
    })

  const composedGesture = Gesture.Simultaneous(panGesture, tapGesture)

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    }
  })

  // Get initials from name
  const initials = name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        style={[
          styles.container,
          {
            left: `${x}%`,
            top: `${y}%`,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.marker,
            {
              backgroundColor,
              borderColor,
              borderWidth: isServer ? 3 : 2,
            },
            animatedStyle,
          ]}
        >
          <Text style={styles.initials}>{initials}</Text>
        </Animated.View>
        {isServer && (
          <View style={[styles.serverIndicator, { backgroundColor: serverColor }]}>
            <Text style={styles.serverText}>S</Text>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -20,
    marginTop: -20,
    zIndex: 30,
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  initials: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  serverIndicator: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  serverText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 10,
  },
})
