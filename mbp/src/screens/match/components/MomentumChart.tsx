import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Match, Stats } from '../../../api/matches';
import { getPlayerDisplayName } from '../utils/matchUtils';
import { hapticLight } from '../../../utils/haptics';
import Svg, { Polyline, Line, Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const POINT_WIDTH = 40; // Width per point
const CHART_HEIGHT = 300; // Base chart height
const MOMENTUM_SCALE = 25; // Pixels per point difference (increased for steeper lines)
const CENTER_Y = CHART_HEIGHT / 2;
const LEFT_PADDING = 20; // Padding to prevent first point from being cut off

interface MomentumChartProps {
  match: Match;
  stats: Stats;
}

type ViewMode = 'match' | 'set';

interface MomentumPoint {
  x: number;
  y: number;
  pointIndex: number;
  winnerId: string;
  loserId: string;
}

export default function MomentumChart({ match, stats }: MomentumChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('match');
  const [selectedSet, setSelectedSet] = useState<number>(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollViewWidthRef = useRef<number>(SCREEN_WIDTH - 80);

  const yourTeamIds = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
  const oppTeamIds = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p);
  const isDoubles = yourTeamIds.length > 1;
  const yourTeamName = yourTeamIds.map(id => getPlayerDisplayName(id, isDoubles)).join('/');
  const oppTeamName = oppTeamIds.map(id => getPlayerDisplayName(id, isDoubles)).join('/');

  // Calculate momentum points from history
  const momentumData = useMemo(() => {
    if (!stats.history || stats.history.length === 0) {
      return { points: [], gameBoundaries: [], totalWidth: POINT_WIDTH * 10 };
    }

    const points: MomentumPoint[] = [];
    const gameBoundaries: number[] = [];
    let currentMomentum = 0;
    let lastServerId: string | null = null;

    // Calculate total games completed from all sets
    const getTotalGamesCompleted = () => {
      let total = 0;
      stats.sets.forEach((set) => {
        const yourTeamGames = yourTeamIds.reduce((sum, id) => sum + (set.games[id] || 0), 0);
        const oppTeamGames = oppTeamIds.reduce((sum, id) => sum + (set.games[id] || 0), 0);
        total += yourTeamGames + oppTeamGames;
      });
      if (stats.currentSet) {
        const yourTeamGames = yourTeamIds.reduce((sum, id) => sum + (stats.currentSet.games[id] || 0), 0);
        const oppTeamGames = oppTeamIds.reduce((sum, id) => sum + (stats.currentSet.games[id] || 0), 0);
        total += yourTeamGames + oppTeamGames;
      }
      return total;
    };

    const totalGamesCompleted = getTotalGamesCompleted();

    // Start with initial point at center (0 momentum) with left padding
    points.push({
      x: LEFT_PADDING,
      y: CENTER_Y,
      pointIndex: -1,
      winnerId: '',
      loserId: '',
    });

    // Track games completed as we process points
    // We'll use server changes to detect game boundaries, but check immediately when server changes
    let gamesCompletedSoFar = 0;

    // Process actual point history
    stats.history.forEach((event, idx) => {
      const yourTeamWon = yourTeamIds.includes(event.pointWinnerId);
      // Update momentum: positive = your team winning (goes up), negative = opponent winning (goes down)
      currentMomentum += yourTeamWon ? 1 : -1;

      // Detect game boundaries: server changes indicate a new game started
      // Check if the server changed from the PREVIOUS point to THIS point
      // This means the previous point ended the game
      const prevEvent = idx > 0 ? stats.history[idx - 1] : null;
      const isGameEnd = prevEvent && 
                       prevEvent.serverId !== event.serverId;

      if (isGameEnd && idx > 0) {
        // Store the index of the previous point (the game-ending point)
        // The boundary will be placed at this point where the game was won/lost
        gameBoundaries.push(idx - 1);
        gamesCompletedSoFar++;
      }

      // X position: LEFT_PADDING + (idx + 1) * POINT_WIDTH (starting after initial point)
      // Y position: centerY - (momentum * scale) so positive momentum goes up (towards your team at top)
      points.push({
        x: LEFT_PADDING + (idx + 1) * POINT_WIDTH,
        y: CENTER_Y - (currentMomentum * MOMENTUM_SCALE),
        pointIndex: idx,
        winnerId: event.pointWinnerId,
        loserId: event.pointLoserId,
      });

      lastServerId = event.serverId;
    });

    // Check if the last point ended a game by comparing total games completed
    // This handles the case where a game just ended but we haven't seen the next point yet
    if (stats.history.length > 0 && gamesCompletedSoFar < totalGamesCompleted) {
      // A game was just completed - mark the last point as a boundary
      const lastPointIdx = stats.history.length - 1;
      if (!gameBoundaries.includes(lastPointIdx)) {
        gameBoundaries.push(lastPointIdx);
      }
    }

    // Refine game boundaries using set data
    const refinedBoundaries: number[] = [];
    let pointIdx = 0;

    // Process completed sets
    stats.sets.forEach((set) => {
      const yourTeamGames = yourTeamIds.reduce((sum, id) => sum + (set.games[id] || 0), 0);
      const oppTeamGames = oppTeamIds.reduce((sum, id) => sum + (set.games[id] || 0), 0);
      const totalGames = yourTeamGames + oppTeamGames;
      
      if (totalGames === 0) return;

      const pointsInSet = Math.min(
        stats.history.length - pointIdx,
        totalGames * 6 // Estimate
      );

      const setStartPoint = pointIdx;
      const setEndPoint = Math.min(pointIdx + pointsInSet, stats.history.length);
      
      const boundariesInSet = gameBoundaries.filter(
        b => b >= setStartPoint && b < setEndPoint
      );

      if (boundariesInSet.length > 0) {
        refinedBoundaries.push(...boundariesInSet);
      } else if (totalGames > 1) {
        const pointsPerGame = pointsInSet / totalGames;
        for (let g = 1; g < totalGames; g++) {
          refinedBoundaries.push(setStartPoint + Math.floor(g * pointsPerGame));
        }
      }

      pointIdx = setEndPoint;
    });

    // Add boundaries for current set
    if (stats.currentSet && pointIdx < stats.history.length) {
      const yourTeamGames = yourTeamIds.reduce((sum, id) => sum + (stats.currentSet.games[id] || 0), 0);
      const oppTeamGames = oppTeamIds.reduce((sum, id) => sum + (stats.currentSet.games[id] || 0), 0);
      const totalGames = yourTeamGames + oppTeamGames;
      
      const remainingPoints = stats.history.length - pointIdx;
      const boundariesInCurrentSet = gameBoundaries.filter(b => b >= pointIdx);
      
      if (boundariesInCurrentSet.length > 0) {
        refinedBoundaries.push(...boundariesInCurrentSet);
      } else if (totalGames > 1 && remainingPoints > 0) {
        const pointsPerGame = remainingPoints / totalGames;
        for (let g = 1; g < totalGames; g++) {
          refinedBoundaries.push(pointIdx + Math.floor(g * pointsPerGame));
        }
      }
    }

    // Use detected boundaries if we have them, otherwise use refined ones
    const finalBoundaries = gameBoundaries.length > 0 ? gameBoundaries : refinedBoundaries;

    const totalWidth = Math.max(LEFT_PADDING + (points.length) * POINT_WIDTH, SCREEN_WIDTH - 40);

    return {
      points,
      gameBoundaries: finalBoundaries,
      totalWidth,
    };
  }, [stats.history, stats.sets, stats.currentSet, yourTeamIds, oppTeamIds]);

  // Filter points based on view mode
  const filteredData = useMemo(() => {
    if (viewMode === 'match') {
      // For match view, convert boundary indices to x-coordinates
      // Boundaries are stored as point indices (the last point of each completed game)
      const matchBoundaries = momentumData.gameBoundaries.map(boundaryIdx => {
        // Find the point with this index (the last point of the completed game)
        const point = momentumData.points.find(p => p.pointIndex === boundaryIdx);
        if (point) {
          // Boundary should be at the x-coordinate of the point where the game was won/lost
          return point.x;
        }
        // Fallback: calculate based on index
        return LEFT_PADDING + (boundaryIdx + 1) * POINT_WIDTH;
      });
      
      return {
        ...momentumData,
        gameBoundaries: matchBoundaries,
      };
    }

    // Set view - show only selected set
    const setStartPoint = selectedSet === 0 ? 0 : 
      stats.sets.slice(0, selectedSet).reduce((sum, set) => {
        const yourTeamGames = yourTeamIds.reduce((s, id) => s + (set.games[id] || 0), 0);
        const oppTeamGames = oppTeamIds.reduce((s, id) => s + (set.games[id] || 0), 0);
        return sum + (yourTeamGames + oppTeamGames) * 6;
      }, 0);
    
    const setEndPoint = selectedSet < stats.sets.length ?
      setStartPoint + (() => {
        const set = stats.sets[selectedSet];
        const yourTeamGames = yourTeamIds.reduce((s, id) => s + (set.games[id] || 0), 0);
        const oppTeamGames = oppTeamIds.reduce((s, id) => s + (set.games[id] || 0), 0);
        return (yourTeamGames + oppTeamGames) * 6;
      })() :
      momentumData.points.length;

    // Always include the initial point (pointIndex === -1)
    const filteredPoints = momentumData.points.filter(
      p => p.pointIndex === -1 || (p.pointIndex >= setStartPoint && p.pointIndex < setEndPoint)
    );
    
    // Adjust x positions for filtered points first
    const adjustedPoints = filteredPoints.map((p, idx) => ({
      ...p,
      x: p.pointIndex === -1 ? LEFT_PADDING : LEFT_PADDING + idx * POINT_WIDTH,
    }));

    // Calculate boundaries: boundaries are at the x-coordinate of the last point of each completed game
    const filteredBoundaries = momentumData.gameBoundaries
      .filter(b => b >= setStartPoint && b < setEndPoint)
      .map(b => {
        // Find the point with index b (the last point of the previous game) in the filtered list
        const pointIdx = adjustedPoints.findIndex(p => p.pointIndex === b);
        if (pointIdx >= 0) {
          // Boundary should be at the x-coordinate of the last point of the completed game
          // This is where the game was won/lost, so the line goes through this point
          return adjustedPoints[pointIdx].x;
        }
        // Fallback: calculate based on relative position
        const relativeIdx = b - setStartPoint + 1;
        return LEFT_PADDING + relativeIdx * POINT_WIDTH;
      });

    return {
      points: adjustedPoints,
      gameBoundaries: filteredBoundaries,
      totalWidth: Math.max(LEFT_PADDING + filteredPoints.length * POINT_WIDTH, SCREEN_WIDTH - 40),
    };
  }, [viewMode, selectedSet, momentumData, stats.sets, yourTeamIds, oppTeamIds]);

  // Auto-scroll to center the most recent point
  useEffect(() => {
    if (scrollViewRef.current && filteredData.points.length > 0) {
      // Find the last point (most recent)
      const lastPoint = filteredData.points[filteredData.points.length - 1];
      if (lastPoint) {
        // Calculate the x position of the last point
        const lastPointX = lastPoint.x;
        // Use the measured scroll view width
        const scrollViewWidth = scrollViewWidthRef.current;
        // Center the last point: scroll to position where last point is in the middle
        const scrollToX = Math.max(0, lastPointX - scrollViewWidth / 2);
        
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ x: scrollToX, animated: true });
        }, 150);
      }
    }
  }, [filteredData.points.length]);

  if (momentumData.points.length === 0) {
    return (
      <View className="p-6 rounded-2xl bg-white/5 border border-white/10 items-center justify-center min-h-[300px]">
        <Text className="text-white text-lg mb-2">Momentum Chart</Text>
        <Text className="text-gray-400 text-sm">No points played yet</Text>
      </View>
    );
  }

  // Calculate chart height based on momentum range
  // Ensure we have enough space above and below center
  const momentumRange = filteredData.points.length > 0 ? (() => {
    const momentums = filteredData.points.map(p => {
      // Calculate momentum from y position: (CENTER_Y - y) / MOMENTUM_SCALE
      return (CENTER_Y - p.y) / MOMENTUM_SCALE;
    });
    const maxAbsMomentum = Math.max(...momentums.map(m => Math.abs(m)));
    // Need space for max momentum above and below center, plus padding
    const requiredHeight = maxAbsMomentum * MOMENTUM_SCALE * 2 + 100;
    return Math.max(requiredHeight, CHART_HEIGHT);
  })() : CHART_HEIGHT;

  const chartHeight = momentumRange;
  const actualCenterY = chartHeight / 2;

  // Adjust points: center them around the actual center line
  // Points should be positioned relative to the center, with equal space above and below
  const adjustedPoints = filteredData.points.map(p => {
    // Calculate momentum from original y position
    const momentum = (CENTER_Y - p.y) / MOMENTUM_SCALE;
    // Position relative to new center, ensuring we stay within bounds
    const newY = actualCenterY - (momentum * MOMENTUM_SCALE);
    // Clamp to ensure visibility with padding
    const clampedY = Math.max(20, Math.min(chartHeight - 20, newY));
    return {
      ...p,
      y: clampedY,
    };
  });

  const polylinePoints = adjustedPoints
    .map(p => `${p.x},${p.y}`)
    .join(' ');

  return (
    <View className="p-6 rounded-2xl bg-white/5 border border-white/10">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-lg font-bold text-white">Momentum Chart</Text>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setViewMode('match');
            }}
            className={`px-3 py-1.5 rounded-lg ${viewMode === 'match' ? 'bg-white/20' : 'bg-white/5'}`}
            activeOpacity={0.7}
          >
            <Text className={`text-sm font-medium ${viewMode === 'match' ? 'text-white' : 'text-gray-400'}`}>
              Match
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setViewMode('set');
            }}
            className={`px-3 py-1.5 rounded-lg ${viewMode === 'set' ? 'bg-white/20' : 'bg-white/5'}`}
            activeOpacity={0.7}
          >
            <Text className={`text-sm font-medium ${viewMode === 'set' ? 'text-white' : 'text-gray-400'}`}>
              Set
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'set' && (
        <View className="flex-row gap-2 mb-4 flex-wrap">
          {stats.sets.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => {
                hapticLight();
                setSelectedSet(idx);
              }}
              className={`px-3 py-1.5 rounded-lg ${selectedSet === idx ? 'bg-white/20' : 'bg-white/5'}`}
              activeOpacity={0.7}
            >
              <Text className={`text-sm font-medium ${selectedSet === idx ? 'text-white' : 'text-gray-400'}`}>
                Set {idx + 1}
              </Text>
            </TouchableOpacity>
          ))}
          {stats.currentSet && (
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setSelectedSet(stats.sets.length);
              }}
              className={`px-3 py-1.5 rounded-lg ${selectedSet === stats.sets.length ? 'bg-white/20' : 'bg-white/5'}`}
              activeOpacity={0.7}
            >
              <Text className={`text-sm font-medium ${selectedSet === stats.sets.length ? 'text-white' : 'text-gray-400'}`}>
                Current
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={{ height: Math.min(chartHeight + 60, 500) }}>
        <View style={{ flexDirection: 'row', flex: 1 }}>
          {/* Fixed player names on left side - outside scrollable area */}
          <View 
            style={{ 
              width: 80, 
              justifyContent: 'space-between', 
              paddingLeft: 10,
              paddingVertical: 20,
              height: '100%',
            }}
          >
            <Text className="text-xs font-semibold" style={{ textAlign: 'left', color: '#60a5fa' }}>
              {yourTeamName}
            </Text>
            <Text className="text-xs font-semibold" style={{ textAlign: 'left', color: '#1e40af' }}>
              {oppTeamName}
            </Text>
          </View>

          {/* Scrollable chart area */}
          <View 
            style={{ flex: 1, overflow: 'hidden' }}
            onLayout={(event) => {
              scrollViewWidthRef.current = event.nativeEvent.layout.width;
            }}
          >
            <ScrollView
              ref={scrollViewRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 0 }}
              style={{ flex: 1 }}
              nestedScrollEnabled={true}
            >
              <ScrollView
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 0, paddingVertical: 0 }}
                style={{ width: filteredData.totalWidth }}
              >
                <View style={{ width: filteredData.totalWidth, minHeight: chartHeight + 40, margin: 0, padding: 0 }}>
                  <Svg 
                    width={filteredData.totalWidth} 
                    height={Math.max(chartHeight + 40, 400)}
                    viewBox={`0 0 ${filteredData.totalWidth} ${Math.max(chartHeight + 40, 400)}`}
                    style={{ margin: 0, padding: 0 }}
                  >
                    {/* Horizontal center line - extends all the way left (x=0) and right */}
                    <Line
                      x1={0}
                      y1={actualCenterY}
                      x2={filteredData.totalWidth}
                      y2={actualCenterY}
                      stroke="rgba(255, 255, 255, 0.3)"
                      strokeWidth={2}
                    />

                    {/* Game boundary lines - vertical lines at end of each game */}
                    {filteredData.gameBoundaries.map((boundary, idx) => (
                      <Line
                        key={`boundary-${idx}`}
                        x1={boundary}
                        y1={0}
                        x2={boundary}
                        y2={Math.max(chartHeight + 40, 400)}
                        stroke="rgba(255, 255, 255, 0.5)"
                        strokeWidth={2}
                      />
                    ))}

                    {/* Momentum line - connecting all points */}
                    {polylinePoints && adjustedPoints.length > 1 && (
                      <Polyline
                        points={polylinePoints}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Point markers */}
                    {adjustedPoints.map((point, idx) => {
                      const isYourTeam = yourTeamIds.includes(point.winnerId);
                      return (
                        <Circle
                          key={`point-${idx}`}
                          cx={point.x}
                          cy={point.y}
                          r={3}
                          fill={isYourTeam ? '#60a5fa' : '#ef4444'}
                        />
                      );
                    })}
                  </Svg>
                </View>
              </ScrollView>
            </ScrollView>
          </View>
        </View>
      </View>

      <View className="mt-2 px-2">
        <Text className="text-xs text-gray-400 text-center">
          Scroll horizontally and vertically to view full chart
        </Text>
      </View>
    </View>
  );
}
