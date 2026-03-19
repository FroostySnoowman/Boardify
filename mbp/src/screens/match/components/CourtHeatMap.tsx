import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native'
import Svg, { Circle, Rect, G, Text as SvgText } from 'react-native-svg'
import { Feather } from '@expo/vector-icons'
import { COURT_BOUNDS } from '../utils/courtBounds'
import { HeatMapType, ServeType } from './HeatMapOptionsDialog'
import { Stats } from '../../../api/matches'

// Import court image
const courtImage = require('../../../../assets/hard_1.png')

interface HeatMapPoint {
  x: number
  y: number
  type: string
  isIn?: boolean
  playerId?: string
  strokeType?: string
  isWinner?: boolean
  isError?: boolean
  serveCount?: number
}

interface ZoneStats {
  total: number
  won: number
}

interface CourtHeatMapProps {
  stats: Stats | null
  heatMapType: HeatMapType
  heatMapPlayer: string | 'all'
  heatMapServeType: ServeType
  yourTeamIds: string[]
  oppTeamIds: string[]
  isDoubles: boolean
  serverIsBottom: boolean
  onOptionsPress: () => void
  onClose: () => void
}

export default function CourtHeatMap({
  stats,
  heatMapType,
  heatMapPlayer,
  heatMapServeType,
  yourTeamIds,
  oppTeamIds,
  isDoubles,
  serverIsBottom,
  onOptionsPress,
  onClose,
}: CourtHeatMapProps) {
  // Calculate heat map data from stats
  const heatMapData = useMemo(() => {
    if (!stats?.history) return { points: [], zones: null }

    const allPoints: HeatMapPoint[] = []

    for (const pointEvent of stats.history) {
      const serverId = pointEvent.serverId
      const receiverId = pointEvent.receiverId
      const pointWonByServer = pointEvent.pointWinnerId === serverId
      const finalAction = pointEvent.actions[pointEvent.actions.length - 1]
      const isWinner = finalAction?.type === 'WINNER' || finalAction?.type === 'ACE'
      const isError = finalAction?.type.includes('ERROR')

      // Process serves
      const serves = pointEvent.ballLocations?.filter(b => b.type === 'serve') || []
      let serveCount = 0
      for (const serve of serves) {
        serveCount++
        allPoints.push({
          x: serve.x,
          y: serve.y,
          type: 'serve',
          isIn: serve.isIn,
          playerId: serverId,
          serveCount,
        })
      }

      // Process returns
      const returns = pointEvent.ballLocations?.filter(b => b.type === 'return') || []
      for (const ret of returns) {
        allPoints.push({
          x: ret.x,
          y: ret.y,
          type: 'return',
          isIn: ret.isIn,
          playerId: receiverId,
          strokeType: ret.strokeType,
        })
      }

      // Process rally shots
      const rally = pointEvent.ballLocations?.filter(b => b.type === 'rally') || []
      for (const shot of rally) {
        allPoints.push({
          x: shot.x,
          y: shot.y,
          type: 'rally',
          isIn: shot.isIn,
          playerId: shot.playerId,
          strokeType: shot.strokeType,
          isWinner: isWinner && shot === rally[rally.length - 1],
          isError: isError && shot === rally[rally.length - 1],
        })
      }
    }

    // Filter points based on heat map type
    let filteredPoints = allPoints

    if (heatMapType === 'serve-placement') {
      filteredPoints = allPoints.filter(p => p.type === 'serve' && p.isIn)
    } else if (heatMapType === 'return-placement') {
      filteredPoints = allPoints.filter(p => p.type === 'return' && p.isIn)
    } else if (heatMapType === 'rally-shots') {
      filteredPoints = allPoints.filter(p => p.type === 'rally' && p.isIn)
    } else if (heatMapType === 'winners') {
      filteredPoints = allPoints.filter(p => p.isWinner)
    } else if (heatMapType === 'errors') {
      filteredPoints = allPoints.filter(p => p.isError)
    } else if (heatMapType === 'forehand') {
      filteredPoints = allPoints.filter(p => p.strokeType === 'forehand' && p.isIn)
    } else if (heatMapType === 'backhand') {
      filteredPoints = allPoints.filter(p => p.strokeType === 'backhand' && p.isIn)
    } else if (heatMapType === 'volley') {
      filteredPoints = allPoints.filter(p => p.strokeType === 'volley' && p.isIn)
    } else if (heatMapType === 'overhead') {
      filteredPoints = allPoints.filter(p => p.strokeType === 'overhead' && p.isIn)
    }

    // Filter by player
    if (heatMapPlayer !== 'all') {
      filteredPoints = filteredPoints.filter(p => p.playerId === heatMapPlayer)
    }

    // Filter by serve type
    if (heatMapType === 'serve-placement' && heatMapServeType !== 'all') {
      filteredPoints = filteredPoints.filter(p => 
        (heatMapServeType === 'first' && p.serveCount === 1) ||
        (heatMapServeType === 'second' && (p.serveCount || 0) > 1)
      )
    }

    return { points: filteredPoints, zones: null }
  }, [stats, heatMapType, heatMapPlayer, heatMapServeType])

  // Get point color based on type
  const getPointColor = (point: HeatMapPoint): string => {
    if (heatMapType === 'winners') return '#22c55e'
    if (heatMapType === 'errors') return '#ef4444'
    if (point.isWinner) return '#22c55e'
    if (point.isError) return '#ef4444'
    if (!point.isIn) return '#f97316'
    return '#3b82f6'
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.closeButton} 
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Feather name="x" size={20} color="#ffffff" />
        </TouchableOpacity>
        
        <Text style={styles.title}>Heat Map</Text>
        
        <TouchableOpacity 
          style={styles.optionsButton} 
          onPress={onOptionsPress}
          activeOpacity={0.7}
        >
          <Feather name="settings" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Type indicator */}
      <View style={styles.typeIndicator}>
        <Text style={styles.typeText}>
          {heatMapType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
        </Text>
        <Text style={styles.countText}>
          {heatMapData.points.length} shots
        </Text>
      </View>

      {/* Court with heat map overlay */}
      <View style={styles.courtContainer}>
        <Image
          source={courtImage}
          style={styles.courtImage}
          resizeMode="cover"
        />
        
        {/* Heat map points overlay */}
        <View style={styles.pointsOverlay}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            {heatMapData.points.map((point, index) => (
              <Circle
                key={index}
                cx={point.x}
                cy={point.y}
                r={1.5}
                fill={getPointColor(point)}
                opacity={0.7}
              />
            ))}
          </Svg>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {heatMapType === 'winners' || heatMapType === 'errors' ? (
          <>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#22c55e' }]} />
              <Text style={styles.legendText}>Winner</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
              <Text style={styles.legendText}>Error</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
              <Text style={styles.legendText}>In</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
              <Text style={styles.legendText}>Out</Text>
            </View>
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  optionsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  typeText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  countText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
  },
  courtContainer: {
    flex: 1,
    position: 'relative',
    margin: 16,
  },
  courtImage: {
    width: '100%',
    height: '100%',
  },
  pointsOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
})
