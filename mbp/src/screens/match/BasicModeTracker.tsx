import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Match } from '../../api/matches';
import { hapticLight as hapticImpactLight } from '../../utils/haptics';
import { getPlayerDisplayName } from './utils/matchUtils';

export interface CustomStatCounters {
  [playerId: string]: {
    [statName: string]: number;
  };
}

interface BasicModeProps {
  match: Match;
  onPointWon: (winner: 'p1' | 'p2', customStatCounters?: CustomStatCounters) => void;
  onUndo: () => void;
  actionLoading: boolean;
  onCustomStatsChange?: (counters: CustomStatCounters) => void;
}

const SCORECARD_BLUE_GRADIENT: [string, string] = ['rgba(30, 64, 175, 0.4)', 'rgba(30, 58, 138, 0.4)'];
const SCORECARD_BLUE_BORDER = 'rgba(30, 64, 175, 0.5)';
const LIVE_SCORING_BLUE_GRADIENT: [string, string] = ['rgba(96, 165, 250, 0.4)', 'rgba(59, 130, 246, 0.4)'];
const LIVE_SCORING_BLUE_BORDER = 'rgba(96, 165, 250, 0.5)';

const getCustomStatsFromSource = (source: any): string[] => {
  if (!source) return [];

  let raw: any =
    source.customStats ??
    source.custom_stats ??
    source.custom_stats_config ??
    null;

  if (!raw) return [];

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      raw = parsed;
    } catch {
      raw = trimmed
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
  }

  if (Array.isArray(raw)) {
    return raw
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          if (typeof item.label === 'string') return item.label;
          if (typeof item.name === 'string') return item.name;
        }
        return null;
      })
      .filter((s: any) => typeof s === 'string' && s.trim().length > 0) as string[];
  }

  if (typeof raw === 'object') {
    return Object.values(raw)
      .map(v => (typeof v === 'string' ? v : null))
      .filter((s: any) => typeof s === 'string' && s.trim().length > 0) as string[];
  }

  return [];
};

const loadInitialCounters = async (match: Match): Promise<CustomStatCounters> => {
  try {
    const key = `bp_basic_custom_stats_${match.id}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const normalized: CustomStatCounters = {};
    Object.entries(parsed as Record<string, any>).forEach(([playerId, value]) => {
      if (!value || typeof value !== 'object') return;
      const statMap: { [statName: string]: number } = {};
      Object.entries(value as Record<string, any>).forEach(([statName, statVal]) => {
        const num =
          typeof statVal === 'number'
            ? statVal
            : typeof statVal === 'string'
            ? parseFloat(statVal)
            : NaN;
        if (!Number.isNaN(num)) {
          statMap[statName] = num;
        }
      });
      normalized[playerId] = statMap;
    });
    return normalized;
  } catch {
    return {};
  }
};

export default function BasicModeTracker({
  match,
  onPointWon,
  onUndo,
  actionLoading,
  onCustomStatsChange,
}: BasicModeProps) {
  const [customCounters, setCustomCounters] = useState<CustomStatCounters>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCounters = async () => {
      const initial = await loadInitialCounters(match);
      setCustomCounters(initial);
      if (onCustomStatsChange) {
        onCustomStatsChange(initial);
      }
      setLoading(false);
    };
    loadCounters();
  }, [match.id, onCustomStatsChange]);

  const yourTeamIds = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
  const oppTeamIds = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p);

  const customStats = getCustomStatsFromSource(match);
  const customStatsTeams = match.customStatsTeams || 'both';
  const customStatsIndividual = match.customStatsIndividual !== false;
  const isDoubles = yourTeamIds.length > 1;

  const showYourTeamStats = customStatsTeams === 'both' || customStatsTeams === 'your-team';
  const showOppTeamStats = customStatsTeams === 'both' || customStatsTeams === 'opponent-team';

  const yourTeamName = yourTeamIds.map(n => getPlayerDisplayName(n, isDoubles)).join('/');
  const oppTeamName = oppTeamIds.map(n => getPlayerDisplayName(n, isDoubles)).join('/');

  const updateCounters = (updater: (prev: CustomStatCounters) => CustomStatCounters) => {
    setCustomCounters(prev => {
      const next = updater(prev);
      if (onCustomStatsChange) {
        onCustomStatsChange(next);
      }
      return next;
    });
  };

  const incrementCounter = (playerId: string, statName: string) => {
    hapticImpactLight();
    updateCounters(prev => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || {}),
        [statName]: (prev[playerId]?.[statName] || 0) + 1,
      },
    }));
  };

  const decrementCounter = (playerId: string, statName: string) => {
    hapticImpactLight();
    updateCounters(prev => {
      const currentValue = prev[playerId]?.[statName] || 0;
      if (currentValue <= 0) return prev;
      return {
        ...prev,
        [playerId]: {
          ...(prev[playerId] || {}),
          [statName]: currentValue - 1,
        },
      };
    });
  };

  const getCounter = (playerId: string, statName: string): number => {
    return customCounters[playerId]?.[statName] || 0;
  };

  const StatButton = ({ playerId, statName, isYourTeam }: { playerId: string; statName: string; color: string; isYourTeam: boolean }) => {
    const value = getCounter(playerId, statName);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 260,
          friction: 18,
          useNativeDriver: true,
        }),
      ]).start();
    }, [value, scaleAnim]);

    return (
      <View
        key={`${playerId}-${statName}`}
        className="rounded-2xl overflow-hidden border border-white/20"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <View className="px-3 pt-3 pb-2 items-center justify-center gap-1">
          <Text className="text-[11px] font-semibold tracking-wide text-white/80 text-center" numberOfLines={1}>
            {statName}
          </Text>
          <Animated.Text
            style={[
              {
                transform: [{ scale: scaleAnim }],
              },
              styles.statValue,
            ]}
          >
            {value}
          </Animated.Text>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={() => decrementCounter(playerId, statName)}
            className="h-12 flex-1 items-center justify-center rounded-xl overflow-hidden"
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['rgba(239, 68, 68, 0.2)', 'rgba(220, 38, 38, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                ...StyleSheet.absoluteFillObject,
                borderWidth: 1,
                borderColor: 'rgba(239, 68, 68, 0.3)',
                borderRadius: 12,
              }}
            />
            <View className="flex-row items-center">
              <Feather name="minus" size={16} color="#ffffff" style={{ marginRight: 4 }} />
              <Text className="text-white text-sm font-semibold">LESS</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => incrementCounter(playerId, statName)}
            className="h-12 flex-1 items-center justify-center rounded-xl overflow-hidden"
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={isYourTeam ? LIVE_SCORING_BLUE_GRADIENT : SCORECARD_BLUE_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                ...StyleSheet.absoluteFillObject,
                borderWidth: 1,
                borderColor: isYourTeam ? LIVE_SCORING_BLUE_BORDER : SCORECARD_BLUE_BORDER,
                borderRadius: 12,
              }}
            />
            <View className="flex-row items-center">
              <Text className="text-white text-sm font-semibold">MORE</Text>
              <Feather name="plus" size={16} color="#ffffff" style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPlayerStatButton = (playerId: string, statName: string, color: string, isYourTeam: boolean) => (
    <StatButton key={`${playerId}-${statName}`} playerId={playerId} statName={statName} color={color} isYourTeam={isYourTeam} />
  );

  if (loading) {
    return (
      <View className="p-6 rounded-2xl bg-white/5 border border-white/10 items-center justify-center min-h-[200px]">
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <View className="gap-y-4">
      <View
        className="p-6 rounded-2xl border border-white/20"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 16,
          elevation: 12,
        }}
      >
        <View className="flex-row items-center justify-between mb-6">
          <View className="h-1 flex-1 bg-white/20 rounded-full" style={{ opacity: 0.2 }} />
          <Text className="text-xl font-bold text-white px-4">Point Winner</Text>
          <View className="h-1 flex-1 bg-white/20 rounded-full" style={{ opacity: 0.2 }} />
        </View>

        <View className="flex-row gap-4">
          <TouchableOpacity
            onPress={() => {
              hapticImpactLight();
              onPointWon('p1', customCounters);
            }}
            disabled={actionLoading}
            className={`relative flex-1 h-40 items-center justify-center rounded-xl px-6 overflow-hidden ${
              actionLoading ? 'opacity-50' : ''
            }`}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={LIVE_SCORING_BLUE_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                ...StyleSheet.absoluteFillObject,
                borderWidth: 1,
                borderColor: LIVE_SCORING_BLUE_BORDER,
                borderRadius: 12,
              }}
            />
            {actionLoading ? (
              <ActivityIndicator size="large" color="#ffffff" />
            ) : (
              <View className="items-center gap-2">
                <Text className="text-3xl font-black tracking-tight text-center text-white">
                  {yourTeamName}
                </Text>
                <Text className="text-xs uppercase tracking-wider opacity-75 text-white">Tap to score</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              hapticImpactLight();
              onPointWon('p2', customCounters);
            }}
            disabled={actionLoading}
            className={`relative flex-1 h-40 items-center justify-center rounded-xl px-6 overflow-hidden ${
              actionLoading ? 'opacity-50' : ''
            }`}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={SCORECARD_BLUE_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                ...StyleSheet.absoluteFillObject,
                borderWidth: 1,
                borderColor: SCORECARD_BLUE_BORDER,
                borderRadius: 12,
              }}
            />
            {actionLoading ? (
              <ActivityIndicator size="large" color="#ffffff" />
            ) : (
              <View className="items-center gap-2">
                <Text className="text-3xl font-black tracking-tight text-center text-white">
                  {oppTeamName}
                </Text>
                <Text className="text-xs uppercase tracking-wider opacity-75 text-white">Tap to score</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {customStats.length > 0 && (
          <View className="mt-6 pt-4 border-t border-white/10">
            <View className="flex-row items-center justify-between mb-4">
              <View className="h-px flex-1 bg-blue-500/30 rounded-full" />
              <Text className="text-lg font-bold text-white px-3">Custom Stats</Text>
              <View className="h-px flex-1 bg-blue-500/30 rounded-full" />
            </View>

            <View className={`gap-4 ${showYourTeamStats && showOppTeamStats ? 'flex-row' : ''}`}>
              {showYourTeamStats && (
                <View className={`flex-1 gap-y-3 ${showYourTeamStats && showOppTeamStats ? '' : ''}`}>
                  {isDoubles && customStatsIndividual ? (
                    yourTeamIds.map(playerId => (
                      <View key={playerId} className="gap-y-3">
                        <Text className="text-[11px] font-semibold text-white/60">
                          {getPlayerDisplayName(playerId, isDoubles)}
                        </Text>
                        <View className="gap-y-3">
                          {customStats.map(statName => renderPlayerStatButton(playerId, statName, '#5BDB3C', true))}
                        </View>
                      </View>
                    ))
                  ) : (
                    <View className="gap-y-3">
                      {customStats.map(statName => renderPlayerStatButton(yourTeamIds[0], statName, '#5BDB3C', true))}
                    </View>
                  )}
                </View>
              )}

              {showOppTeamStats && (
                <View className={`flex-1 gap-y-3 ${showYourTeamStats && showOppTeamStats ? '' : ''}`}>
                  {isDoubles && customStatsIndividual ? (
                    oppTeamIds.map(playerId => (
                      <View key={playerId} className="gap-y-3">
                        <Text className="text-[11px] font-semibold text-white/60">
                          {getPlayerDisplayName(playerId, isDoubles)}
                        </Text>
                        <View className="gap-y-3">
                          {customStats.map(statName => renderPlayerStatButton(playerId, statName, '#008CD7', false))}
                        </View>
                      </View>
                    ))
                  ) : (
                    <View className="gap-y-3">
                      {customStats.map(statName => renderPlayerStatButton(oppTeamIds[0], statName, '#008CD7', false))}
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={() => {
            hapticImpactLight();
            onUndo();
          }}
          disabled={actionLoading}
          className={`w-full mt-4 h-14 flex-row items-center justify-center gap-2 rounded-xl overflow-hidden ${
            actionLoading ? 'opacity-50' : ''
          }`}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['rgba(239, 68, 68, 0.2)', 'rgba(220, 38, 38, 0.2)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              ...StyleSheet.absoluteFillObject,
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.3)',
              borderRadius: 12,
            }}
          />
          <Feather name="arrow-left" size={20} color="#ffffff" />
          <Text className="text-white font-semibold text-base">UNDO LAST POINT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 24,
  },
});
