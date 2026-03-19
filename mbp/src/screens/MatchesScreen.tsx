import React, { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform, Animated, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import MatchPage from './match/MatchPage';
import AnalyticsPage, {
  type StatMode,
  statModeOptions,
  ModeSelector,
} from './match/AnalyticsPage';
import NotesPage from './match/NotesPage';
import { hapticLight } from '../utils/haptics';
import MatchesContextBar, { MatchesSection, matchesSections } from './match/components/MatchesContextBar';
import { IPAD_TAB_CONTENT_TOP_PADDING, TAB_HEADER_HEIGHT } from '../config/layout';
import { Match, getMatchCount, getMatchHistoryRange } from '../api/matches';
import { Skeleton } from '../components/Skeleton';

const BACKGROUND_COLOR = '#020617';
const SIDEBAR_WIDTH = 240;

export default function MatchesScreen({ tabParam, statsModeParam }: { tabParam?: string; statsModeParam?: string }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<MatchesSection>('match');

  useEffect(() => {
    if (tabParam === 'match') setActiveTab('match');
    else if (tabParam === 'analytics') {
      setActiveTab('analytics');
      if (statsModeParam === 'single' || statsModeParam === 'lastN' || statsModeParam === 'period') {
        setAnalyticsMode(statsModeParam);
      }
    }
  }, [tabParam, statsModeParam]);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [endMatchRequestKey, setEndMatchRequestKey] = useState(0);
  const [navOpen, setNavOpen] = useState(false);
  const [analyticsMode, setAnalyticsMode] = useState<StatMode>('single');
  const [analyticsPeriodDays, setAnalyticsPeriodDays] = useState<number | null>(365);
  const [selectedPeriodPreset, setSelectedPeriodPreset] = useState<string | null>(null);
  const [analyticsMatchCount, setAnalyticsMatchCount] = useState(10);
  const [selectedMatchCountPreset, setSelectedMatchCountPreset] = useState<number | 'all' | null>(null);
  const [totalMatchCount, setTotalMatchCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [periodMaxDays, setPeriodMaxDays] = useState<number | null>(null);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [showCompareMode, setShowCompareMode] = useState(false);
  const [compareConfirmedOnHistory, setCompareConfirmedOnHistory] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;
  const navPressInProgress = useRef(false);

  useEffect(() => {
    if (activeTab !== 'analytics' || analyticsMode !== 'lastN') return;
    setCountLoading(true);
    getMatchCount()
      .then((n) => {
        setTotalMatchCount(n);
        setAnalyticsMatchCount((prev) => (n === 0 ? 1 : Math.min(prev, Math.max(1, n))));
      })
      .catch(() => setTotalMatchCount(0))
      .finally(() => setCountLoading(false));
  }, [activeTab, analyticsMode]);

  useEffect(() => {
    if (activeTab !== 'analytics' || analyticsMode !== 'period') return;
    getMatchHistoryRange()
      .then(({ oldestDate }) => {
        if (!oldestDate) {
          setPeriodMaxDays(365);
          return;
        }
        const daysSinceFirst = Math.floor(
          (Date.now() - new Date(oldestDate).getTime()) / (24 * 60 * 60 * 1000)
        );
        const max = Math.min(730, Math.max(1, daysSinceFirst));
        setPeriodMaxDays(max);
        setAnalyticsPeriodDays((prev) => (prev !== null && prev > max ? max : prev));
      })
      .catch(() => setPeriodMaxDays(365));
  }, [activeTab, analyticsMode]);
  const [matchRefreshKey, setMatchRefreshKey] = useState(0);

  const openSidebar = () => {
    setNavOpen(true);
    Animated.spring(sidebarAnim, {
      toValue: 0,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeSidebar = () => {
    setNavOpen(false);
    Animated.spring(sidebarAnim, {
      toValue: -SIDEBAR_WIDTH,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  };

  const scrollToTop = () => {
  };

  useFocusEffect(
    React.useCallback(() => {
      setMatchRefreshKey((k) => k + 1);
    }, [])
  );

  const handleMatchChange = React.useCallback((match: Match | null) => {
    setCurrentMatch(match);
  }, []);

  const renderContent = () => (
    <>
      {/* Keep Live Match mounted so switching from Notes/Statistics doesn't trigger a full refetch */}
      <View
        style={{
          flex: 1,
          display: activeTab === 'match' ? 'flex' : 'none',
          pointerEvents: activeTab === 'match' ? 'auto' : 'none',
        }}
      >
        <MatchPage
          refreshKey={matchRefreshKey}
          onMatchEnd={scrollToTop}
          onMatchChange={handleMatchChange}
          triggerEndMatchRequest={endMatchRequestKey}
        />
      </View>
      {activeTab === 'analytics' && (
          <AnalyticsPage
            mode={analyticsMode}
            onModeChange={setAnalyticsMode}
            period={analyticsPeriodDays === null ? 'all' : `${analyticsPeriodDays}d`}
            onPeriodChange={(p) => {
              if (p === 'all') setAnalyticsPeriodDays(null);
              else {
                const n = parseInt(String(p).replace(/d$/, ''), 10);
                const max = periodMaxDays ?? 730;
                if (!isNaN(n)) setAnalyticsPeriodDays(Math.min(max, Math.max(1, n)));
              }
            }}
            matchCount={analyticsMatchCount}
            onMatchCountChange={setAnalyticsMatchCount}
            selectedCompareIds={selectedCompareIds}
            onSelectedCompareIdsChange={setSelectedCompareIds}
            showCompareUI={compareConfirmedOnHistory}
            onEnterCompareMode={() => {
              setShowCompareMode(true);
              setCompareConfirmedOnHistory(true);
            }}
            onExitCompareMode={() => {
              setCompareConfirmedOnHistory(false);
              setShowCompareMode(false);
              setSelectedCompareIds([]);
            }}
            onOpenCompare={
              compareConfirmedOnHistory
                ? () => {
                    setActiveTab('analytics');
                    setAnalyticsMode('lastN');
                  }
                : undefined
            }
            onSwitchToHistory={() => {
              setCompareConfirmedOnHistory(false);
              setActiveTab('analytics');
              setAnalyticsMode('single');
            }}
            renderScrollHeader={() => (
              <View className="px-5 pt-2 pb-1 border-b border-white/5">
                <ModeSelector mode={analyticsMode} setMode={setAnalyticsMode} compact />
                {analyticsMode === 'period' && (() => {
                  const maxDays = periodMaxDays ?? 365;
                  const ytdDays = Math.floor(
                    (Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (24 * 60 * 60 * 1000)
                  );
                  const formatDuration = (days: number) => {
                    if (days <= 31) return `${days} days`;
                    const years = Math.floor(days / 365);
                    const remainder = days % 365;
                    const months = Math.floor(remainder / 30);
                    const d = remainder % 30;
                    const parts: string[] = [];
                    if (years > 0) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
                    if (months > 0) parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
                    if (d > 0) parts.push(`${d} ${d === 1 ? 'day' : 'days'}`);
                    return parts.join(' ') || `${days} days`;
                  };
                  const markers: { label: string; canonicalValue: number | null }[] = [
                    { label: '1W', canonicalValue: 7 },
                    { label: '1M', canonicalValue: 30 },
                    { label: '3M', canonicalValue: 90 },
                    { label: 'YTD', canonicalValue: Math.max(1, ytdDays) },
                    { label: '1Y', canonicalValue: 365 },
                    { label: 'All Time', canonicalValue: null },
                  ];
                  const isSelected = (label: string, canonical: number | null) =>
                    selectedPeriodPreset !== null
                      ? selectedPeriodPreset === label
                      : canonical === null
                        ? analyticsPeriodDays === null
                        : analyticsPeriodDays !== null && analyticsPeriodDays === canonical;
                  return (
                    <View className="mb-2">
                      <View className="flex-row items-center justify-between gap-x-2 mb-1.5">
                        <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1 flex-1">
                          {markers.map(({ label, canonicalValue }) => {
                            const selected = isSelected(label, canonicalValue);
                            return (
                              <TouchableOpacity
                                key={label}
                                onPress={() => {
                                  hapticLight();
                                  setSelectedPeriodPreset(label);
                                  setAnalyticsPeriodDays(
                                    canonicalValue === null ? null : Math.min(canonicalValue, maxDays)
                                  );
                                }}
                                className="py-1"
                              >
                                <Text
                                  className="text-sm font-semibold"
                                  style={{
                                    color: selected ? '#3b82f6' : '#9ca3af',
                                  }}
                                >
                                  {label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <Text className="text-sm font-semibold text-white flex-shrink-0">
                          {analyticsPeriodDays !== null
                            ? `${formatDuration(analyticsPeriodDays)} of ${formatDuration(maxDays)}`
                            : 'All time'}
                        </Text>
                      </View>
                      {analyticsPeriodDays !== null ? (
                        <Slider
                          minimumValue={1}
                          maximumValue={maxDays}
                          value={Math.min(analyticsPeriodDays, maxDays)}
                          onValueChange={(v) => {
                            const rounded = Math.round(v);
                            setAnalyticsPeriodDays(rounded);
                            setSelectedPeriodPreset(null);
                          }}
                          minimumTrackTintColor="rgba(255,255,255,0.4)"
                          maximumTrackTintColor="rgba(255,255,255,0.1)"
                          thumbTintColor="#ffffff"
                          step={1}
                        />
                      ) : null}
                    </View>
                  );
                })()}
                {analyticsMode === 'lastN' && (
                  <View className="mb-2">
                    {countLoading ? (
                      <View className="mb-1.5">
                        <View className="flex-row items-center justify-between gap-x-2 mb-1.5">
                          <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1 flex-1">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                              <Skeleton key={i} className="h-6 rounded" style={{ width: i === 6 ? 72 : 20 }} />
                            ))}
                          </View>
                          <Skeleton className="h-4 w-20 rounded flex-shrink-0" />
                        </View>
                        <Skeleton className="h-2 w-full rounded" />
                      </View>
                    ) : totalMatchCount === 0 ? (
                      <Text className="text-sm text-white/60 py-2">No completed matches yet</Text>
                    ) : totalMatchCount != null && totalMatchCount > 0 ? (
                      (() => {
                        const maxCount = Math.max(1, totalMatchCount);
                        const matchCountPresets: { label: string; value: number | 'all' }[] = [
                          { label: '1', value: 1 },
                          { label: '3', value: 3 },
                          { label: '5', value: 5 },
                          { label: '10', value: 10 },
                          { label: '15', value: 15 },
                          { label: 'All Matches', value: 'all' },
                        ];
                        const isMatchCountSelected = (value: number | 'all') =>
                          selectedMatchCountPreset !== null
                            ? selectedMatchCountPreset === value
                            : value === 'all'
                              ? analyticsMatchCount === maxCount
                              : analyticsMatchCount === value;
                        return (
                          <>
                            <View className="flex-row items-center justify-between gap-x-2 mb-1.5">
                              <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1 flex-1">
                                {matchCountPresets.map(({ label, value }) => {
                                  const selected = isMatchCountSelected(value);
                                  return (
                                    <TouchableOpacity
                                      key={label}
                                      onPress={() => {
                                        hapticLight();
                                        setSelectedMatchCountPreset(value);
                                        setAnalyticsMatchCount(value === 'all' ? maxCount : Math.min(value, maxCount));
                                      }}
                                      className="py-1"
                                    >
                                      <Text
                                        className="text-sm font-semibold"
                                        style={{ color: selected ? '#3b82f6' : '#9ca3af' }}
                                      >
                                        {label}
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                              <Text className="text-sm font-semibold text-white flex-shrink-0">
                                {analyticsMatchCount === maxCount
                                  ? 'All matches'
                                  : `${analyticsMatchCount} of ${totalMatchCount}`}
                              </Text>
                            </View>
                            <Slider
                              minimumValue={1}
                              maximumValue={maxCount}
                              value={analyticsMatchCount}
                              onValueChange={(v) => {
                                setAnalyticsMatchCount(Math.round(v));
                                setSelectedMatchCountPreset(null);
                              }}
                              minimumTrackTintColor="rgba(255,255,255,0.4)"
                              maximumTrackTintColor="rgba(255,255,255,0.1)"
                              thumbTintColor="#ffffff"
                              step={1}
                            />
                          </>
                        );
                      })()
                    ) : null}
                  </View>
                )}
              </View>
            )}
          />
      )}
      {activeTab === 'notes' && <NotesPage />}
    </>
  );

  const renderHeaderLeft = () => {
    switch (activeTab) {
      case 'match':
        if (currentMatch) {
          return (
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                router.push(`/match-info/${currentMatch.id}`);
              }}
              className="flex-1 px-5 py-2.5 rounded-lg bg-white/10 min-h-[44px] flex-row items-center justify-center gap-2"
            >
              <Feather name="info" size={16} color="#ffffff" />
              <Text className="text-sm font-semibold text-white">Match Info</Text>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              if (navPressInProgress.current) return;
              navPressInProgress.current = true;
              router.push('/search-all');
              setTimeout(() => { navPressInProgress.current = false; }, 500);
            }}
            className="flex-1 px-5 py-2.5 rounded-lg bg-white/10 min-h-[44px] flex-row items-center justify-center gap-2"
          >
            <Feather name="search" size={16} color="#ffffff" />
            <Text className="text-sm font-semibold text-white">Search Matches</Text>
          </TouchableOpacity>
        );
      case 'notes':
        return (
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              if (navPressInProgress.current) return;
              navPressInProgress.current = true;
              router.push('/search-notes');
              setTimeout(() => { navPressInProgress.current = false; }, 500);
            }}
            className="flex-1 px-5 py-2.5 rounded-lg bg-white/10 min-h-[44px] flex-row items-center justify-center gap-2"
          >
            <Feather name="search" size={16} color="#ffffff" />
            <Text className="text-sm font-semibold text-white">Search Notes</Text>
          </TouchableOpacity>
        );
      case 'analytics':
        return (
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              if (navPressInProgress.current) return;
              navPressInProgress.current = true;
              if (analyticsMode === 'single') {
                router.push('/search-history');
              } else {
                router.push('/search-statistics');
              }
              setTimeout(() => { navPressInProgress.current = false; }, 500);
            }}
            className="flex-1 px-5 py-2.5 rounded-lg bg-white/10 min-h-[44px] flex-row items-center justify-center gap-2"
          >
            <Feather name="search" size={16} color="#ffffff" />
            <Text className="text-sm font-semibold text-white">
              {analyticsMode === 'single' ? 'Search History' : 'Search Statistics'}
            </Text>
          </TouchableOpacity>
        );
      default:
        return <View className="flex-1" />;
    }
  };

  return (
    <View
      className="relative flex-1"
      style={{
        backgroundColor: BACKGROUND_COLOR,
        paddingTop: Platform.OS === 'ios' && Platform.isPad ? IPAD_TAB_CONTENT_TOP_PADDING : 0,
      }}
    >
      <LinearGradient
        colors={['rgba(0, 6, 42, 0.5)', 'rgba(0, 0, 0, 0.3)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View className="border-b border-white/5 bg-[#020617] flex-row items-center gap-3 px-6 flex-shrink-0" style={{ height: TAB_HEADER_HEIGHT, paddingTop: 2, paddingBottom: 2 }}>
        {!navOpen ? (
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              openSidebar();
            }}
            className="p-2 rounded-lg"
          >
            <Feather name="menu" size={24} color="#ffffff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 44, height: 44 }} />
        )}
        {renderHeaderLeft()}
        {currentMatch ? (
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              setEndMatchRequestKey((k) => k + 1);
            }}
            activeOpacity={0.9}
            style={{ overflow: 'hidden', borderRadius: 9999, flexShrink: 0 }}
          >
            <LinearGradient
              colors={['#ef4444', '#dc2626']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 16,
                paddingVertical: 8,
                minHeight: 44,
                borderRadius: 12,
              }}
            >
              <Feather name="flag" size={16} color="#ffffff" />
              <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '500' }}>End Match</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
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
        )}
      </View>

      <MatchesContextBar
        activeSection={activeTab}
        onSectionChange={(next) => {
          hapticLight();
          setActiveTab(next);
        }}
      />

      <View
        className="flex-1 px-5"
        style={{
          paddingTop: activeTab === 'analytics' ? 8 : 16,
          backgroundColor: 'transparent',
        }}
      >
        {renderContent()}
      </View>

      {navOpen && (
        <Pressable
          className="absolute inset-0"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 20,
            elevation: 20,
          }}
          onPress={closeSidebar}
        >
          <BlurView intensity={20} className="absolute inset-0" />
        </Pressable>
      )}

      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: SIDEBAR_WIDTH,
          transform: [{ translateX: sidebarAnim }],
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          borderRightWidth: 1,
          borderRightColor: 'rgba(255, 255, 255, 0.05)',
          zIndex: 30,
          elevation: 30,
        }}
        pointerEvents={navOpen ? 'auto' : 'none'}
      >
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              closeSidebar();
            }}
            style={{
              position: 'absolute',
              right: 16,
              top: 8,
              padding: 8,
              zIndex: 50,
              elevation: 50,
            }}
            activeOpacity={0.7}
          >
            <Feather name="x" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingTop: 8,
              paddingHorizontal: 16,
              paddingBottom: insets.bottom + 16,
              marginRight: 40,
            }}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
          {matchesSections.map((section) => {
            const isActive = activeTab === section.key;
            return (
              <TouchableOpacity
                key={section.key}
                onPress={() => {
                  hapticLight();
                  setActiveTab(section.key);
                  closeSidebar();
                }}
                style={{
                  width: '100%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 8,
                  paddingHorizontal: 8,
                  borderRadius: 8,
                  marginBottom: 4,
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                }}
                activeOpacity={0.7}
              >
                <Feather
                  name={section.icon}
                  size={14}
                  color={isActive ? '#ffffff' : '#9ca3af'}
                />
                <Text
                  style={{
                    flex: 1,
                    fontWeight: '500',
                    fontSize: 14,
                    color: isActive ? '#ffffff' : '#9ca3af',
                  }}
                >
                  {section.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          {activeTab === 'analytics' && (
            <View style={{ marginTop: 8, marginBottom: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', marginBottom: 8, paddingHorizontal: 8 }}>
                STATISTICS VIEW
              </Text>
              {statModeOptions.map((opt) => {
                const isActive = analyticsMode === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => {
                      hapticLight();
                      setAnalyticsMode(opt.id);
                      closeSidebar();
                    }}
                    style={{
                      width: '100%',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 6,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      marginBottom: 2,
                      backgroundColor: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        flex: 1,
                        fontWeight: '500',
                        fontSize: 13,
                        color: isActive ? '#ffffff' : '#9ca3af',
                      }}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {activeTab === 'analytics' && (
            <View style={{ marginTop: 8, marginBottom: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '600', color: '#6b7280', marginBottom: 8, paddingHorizontal: 8 }}>
                Compare
              </Text>
              <TouchableOpacity
                onPress={() => {
                  hapticLight();
                  setShowCompareMode(true);
                  setActiveTab('analytics');
                  setAnalyticsMode('single');
                  closeSidebar();
                }}
                style={{
                  width: '100%',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  borderRadius: 8,
                  marginBottom: 2,
                  backgroundColor: 'transparent',
                }}
                activeOpacity={0.7}
              >
                <Text style={{ flex: 1, fontWeight: '500', fontSize: 13, color: '#9ca3af' }}>
                  Compare matches
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)', marginVertical: 12 }} />

          <TouchableOpacity
            onPress={() => {
              hapticLight();
              closeSidebar();
              router.push('/help-matches');
            }}
            style={{
              width: '100%',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 8,
              paddingHorizontal: 8,
              borderRadius: 8,
              marginBottom: 4,
            }}
            activeOpacity={0.7}
          >
            <Feather name="help-circle" size={14} color="#9ca3af" />
            <Text style={{ flex: 1, fontWeight: '500', fontSize: 14, color: '#9ca3af' }}>Help</Text>
          </TouchableOpacity>
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  );
}