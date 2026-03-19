import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { listMatchHistory, MatchHistoryItem } from '../../api/matches';
import { Skeleton } from '../../components/Skeleton';
import { hapticLight } from '../../utils/haptics';

const COMPARE_MATCH_COUNT = 2;

export type HistoryPageProps = {
  showCompareUI?: boolean;
  onEnterCompareMode?: () => void;
  onExitCompareMode?: () => void;
  selectedCompareIds?: string[];
  onSelectedCompareIdsChange?: (ids: string[] | ((prev: string[]) => string[])) => void;
  onOpenCompare?: () => void;
};

export default function HistoryPage({
  showCompareUI = false,
  onEnterCompareMode,
  onExitCompareMode,
  selectedCompareIds = [],
  onSelectedCompareIdsChange,
  onOpenCompare,
}: HistoryPageProps = {}) {
  const insets = useSafeAreaInsets();
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    listMatchHistory()
      .then(setMatches)
      .catch(() => {})
      .finally(() => setLoadingList(false));
  }, []);

  const handleSelectMatch = (matchId: string) => {
    hapticLight();
    router.push({
      pathname: '/match-detail',
      params: { matchId },
    });
  };

  const toggleCompareSelection = (id: string) => {
    if (!onSelectedCompareIdsChange) return;
    hapticLight();
    onSelectedCompareIdsChange(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length >= COMPARE_MATCH_COUNT
          ? prev
          : [...prev, id]
    );
  };

  const isCompareMode = showCompareUI && !!onSelectedCompareIdsChange && !!onOpenCompare;
  const canCompare = isCompareMode && selectedCompareIds.length === COMPARE_MATCH_COUNT;

  return (
    <View className="gap-y-8">
      <View>
        {isCompareMode && (
          <View className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10">
            {onExitCompareMode && (
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  onExitCompareMode();
                }}
                className="flex-row items-center gap-2 mb-1"
                activeOpacity={0.7}
                style={{ alignSelf: 'flex-start' }}
              >
                <Feather name="arrow-left" size={20} color="#ffffff" />
                <Text className="text-lg font-bold text-white">Compare matches</Text>
              </TouchableOpacity>
            )}
            <Text className="text-sm text-gray-400 mb-3">
              Select 2 matches, then tap Compare to view stats in Statistics.
            </Text>
            {canCompare && (
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  onOpenCompare();
                }}
                activeOpacity={0.9}
                style={{ overflow: 'hidden', borderRadius: 9999, alignSelf: 'flex-start' }}
              >
                <LinearGradient
                  colors={['#1e40af', '#1e3a8a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12 }}
                >
                  <Feather name="bar-chart-2" size={18} color="#ffffff" />
                  <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>Compare</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          <View className="gap-y-2">
            {loadingList ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))
            ) : matches.length === 0 ? (
              <Text className="text-gray-400 text-center pt-8">No completed matches found.</Text>
            ) : (
              matches.map(match => {
                const barColor =
                  match.result === 'Won'
                    ? '#22c55e'
                    : match.result === 'Lost'
                    ? '#3b82f6'
                    : match.status === 'completed'
                    ? '#22c55e'
                    : '#22c55e';
                const isCompleted = match.status === 'completed';
                const isSelected = selectedCompareIds.includes(match.id);

                return (
                  <TouchableOpacity
                    key={match.id}
                    onPress={() => {
                      if (isCompareMode && isCompleted) {
                        toggleCompareSelection(match.id);
                      } else {
                        handleSelectMatch(match.id);
                      }
                    }}
                    onLongPress={() => {
                      if (!isCompareMode && onEnterCompareMode) {
                        hapticLight();
                        Alert.alert(
                          'Would you like to compare matches?',
                          undefined,
                          [
                            { text: 'No', style: 'cancel' },
                            { text: 'Yes', onPress: () => onEnterCompareMode() },
                          ]
                        );
                      }
                    }}
                    delayLongPress={400}
                    className="w-full flex-row items-center p-3 rounded-lg bg-white/5"
                    style={isCompareMode && isSelected ? { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.4)' } : {}}
                    activeOpacity={0.7}
                  >
                    {isCompareMode && isCompleted && (
                      <View className="mr-3">
                        <Feather
                          name={isSelected ? 'check-square' : 'square'}
                          size={22}
                          color={isSelected ? '#60a5fa' : '#6b7280'}
                        />
                      </View>
                    )}
                    <View className="w-2 h-10 rounded-full mr-4" style={{ backgroundColor: barColor }} />
                    <View className="flex-1 overflow-hidden">
                      <Text className="font-semibold text-white" numberOfLines={1}>
                        vs {match.opponentNames}
                      </Text>
                      <Text className="text-sm text-gray-300">{match.score}</Text>
                    </View>
                    <Text className="text-xs text-gray-400 ml-2">
                      {new Date(match.date).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      </View>

    </View>
  );
}

