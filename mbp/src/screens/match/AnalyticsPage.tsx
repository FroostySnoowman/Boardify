import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, Platform, Dimensions, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Skeleton } from '../../components/Skeleton';
import {
  listMatchHistory,
  getMatch,
  getStats,
  getAnalyticsData,
  AnalyticsData,
  MatchHistoryItem,
  Match,
  Stats,
} from '../../api/matches';
import { statsToMatchKPIs, MatchKPI } from './utils/statsToKPIs';
import AllStatsDisplay from './components/AllStatsDisplay';
import HistoryPage from './HistoryPage';
import { hapticLight, hapticMedium } from '../../utils/haptics';
import StatTrendOverMatchesChart from './components/StatTrendOverMatchesChart';
import type { PerMatchTrendPoint } from '../../api/matches';

export type StatMode = 'single' | 'period' | 'lastN';
export type Period = '7d' | '14d' | '30d' | '90d' | '365d' | 'all';

export const dateFilters: { value: Period; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '14d', label: '14 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: '365d', label: '1 Year' },
  { value: 'all', label: 'All Time' },
];

const COMPARE_MATCH_COUNT = 2;

export const statModeOptions: { id: StatMode; label: string }[] = [
  { id: 'single', label: 'Match History' },
  { id: 'lastN', label: 'All Matches' },
  { id: 'period', label: 'Time Trends' },
];

export function ModeSelector({
  mode,
  setMode,
  compact,
}: {
  mode: StatMode;
  setMode: (m: StatMode) => void;
  compact?: boolean;
}) {
  return (
    <View className={`flex-row p-1 rounded-xl bg-white/5 border border-white/10 ${compact ? 'mb-2' : 'mb-6'}`}>
      {statModeOptions.map(opt => (
        <TouchableOpacity
          key={opt.id}
          onPress={() => {
            hapticLight();
            setMode(opt.id);
          }}
          className="flex-1 py-2.5 rounded-lg"
          style={{
            backgroundColor: mode === opt.id ? 'rgba(255,255,255,0.12)' : 'transparent',
          }}
          activeOpacity={0.7}
        >
          <Text
            className="text-sm font-semibold text-center"
            style={{ color: mode === opt.id ? '#ffffff' : '#9ca3af' }}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function FilterChips<T extends string | number>({
  options,
  value,
  onChange,
  compact,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingRight: 16 }}
      className={compact ? 'mb-2' : 'mb-6'}
    >
      {options.map(opt => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={String(opt.value)}
            onPress={() => {
              hapticLight();
              onChange(opt.value);
            }}
            className="px-4 py-2.5 rounded-full flex-shrink-0"
            style={{
              backgroundColor: selected ? 'rgba(255,255,255,0.18)' : 'transparent',
              borderWidth: 1,
              borderColor: selected ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
            }}
            activeOpacity={0.7}
          >
            <Text
              className="text-sm font-semibold"
              style={{ color: selected ? '#ffffff' : '#9ca3af' }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export type StatTrendMeta = {
  statKey: keyof PerMatchTrendPoint;
  format: 'number' | 'percent';
};

const KeyStat = ({
  icon,
  label,
  value,
  subtitle,
  description,
  color,
  trendMeta,
  onTrendPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string | number;
  subtitle?: string;
  description?: string;
  color?: string;
  trendMeta?: StatTrendMeta;
  onTrendPress?: (meta: StatTrendMeta & { label: string; color: string }) => void;
}) => {
  const handlePress = trendMeta && onTrendPress ? () => { hapticLight(); onTrendPress({ ...trendMeta, label, color: color || '#A78BFA' }); } : undefined;
  const content = (
    <>
      <View className="flex-row items-center gap-2" style={{ minWidth: 0 }}>
        <Feather name={icon} size={18} color={color || '#A78BFA'} style={{ flexShrink: 0 }} />
        <Text className="text-xs text-gray-400 flex-1" numberOfLines={2} ellipsizeMode="tail" style={{ minWidth: 0 }}>
          {label}
        </Text>
      </View>
      <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
        <Text
          className="text-xl font-bold text-white"
          numberOfLines={1}
          style={{ minWidth: 0 }}
        >
          {value}
        </Text>
        {subtitle != null && subtitle !== '' && (
          <Text className="text-sm text-gray-400" numberOfLines={1} style={{ marginLeft: 4 }}>
            ({subtitle})
          </Text>
        )}
      </View>
      {description != null && description !== '' && (
        <Text className="text-xs text-gray-500" numberOfLines={2} style={{ minWidth: 0, marginTop: 6 }}>
          {description}
        </Text>
      )}
    </>
  );
  const containerStyle = { minWidth: 0, flex: 1, overflow: 'hidden' as const };
  if (handlePress) {
    return (
      <Pressable
        onPress={handlePress}
        className="p-4 rounded-xl bg-white/5 border border-white/10"
        style={containerStyle}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View className="p-4 rounded-xl bg-white/5 border border-white/10" style={containerStyle}>
      {content}
    </View>
  );
};

const STAT_SECTION_COLORS = {
  overview: '#22C55E',
  service: '#60A5FA',
  return: '#FBBF24',
  rally: '#A78BFA',
  overall: '#14b8a6',
  other: '#64748b',
} as const;

function StatSection({
  title,
  color,
  children,
  moreChildren,
  expanded,
  onToggle,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
  moreChildren?: React.ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const hasMore = moreChildren != null;
  const contentWidth = getStatGridContentWidth();
  const gridStyle = {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: STAT_GRID_GAP,
    width: contentWidth,
    marginHorizontal: -2,
  };
  return (
    <View className="mb-10 pb-8 border-b border-white/5 last:border-b-0 last:pb-0 last:mb-0" style={{ width: '100%' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 12, flexWrap: 'nowrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
          <View style={{ width: 4, borderRadius: 2, backgroundColor: color, alignSelf: 'stretch', minHeight: 20, marginRight: 8 }} />
          <Text className="text-xs font-semibold uppercase tracking-wider" style={{ color }} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {hasMore && (
          <>
            <View style={{ flex: 1, minWidth: 8 }} />
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                onToggle?.();
              }}
              style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0, paddingVertical: 4, paddingLeft: 8 }}
              activeOpacity={0.7}
            >
              <Text className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
                {expanded ? 'Show less' : 'View more'}
              </Text>
              <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={color} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </>
        )}
      </View>
      <View style={gridStyle}>
        {children}
      </View>
      {hasMore && expanded && (
        <View style={[gridStyle, { marginTop: 12, paddingBottom: 28 }]}>
          {moreChildren}
        </View>
      )}
    </View>
  );
}

type AnalyticsKPIs = import('../../api/matches').AnalyticsKPIs;

function formatCount(num?: number, den?: number): string {
  if (num != null && den != null && den > 0) return `${num}/${den}`;
  if (num != null) return String(num);
  return '-';
}

const STAT_GRID_PADDING = 48; // horizontal padding of Key Statistics block (p-6 both sides)
const STAT_GRID_GAP = 16;
const STAT_GRID_RIGHT_BUFFER = 20; // extra space on the right so cards aren't flush to the edge

/** Content width for the stat grid (leaves buffer on the right). */
function getStatGridContentWidth(): number {
  return Dimensions.get('window').width - STAT_GRID_PADDING - STAT_GRID_RIGHT_BUFFER;
}

/** Card width so exactly two fit per row with gap. Uses pixel width so layout is reliable in RN. */
function getStatCardWidth(): number {
  const contentWidth = getStatGridContentWidth();
  return Math.floor((contentWidth - STAT_GRID_GAP) / 2);
}

/** Wraps a stat card so it stays in a fixed column and never overlaps neighbors. Two per row. */
function StatCard({ children }: { children: React.ReactNode }) {
  const cardWidth = getStatCardWidth();
  return (
    <View
      style={{
        width: cardWidth,
        minWidth: 0,
        overflow: 'hidden',
        marginBottom: 2,
      }}
    >
      {children}
    </View>
  );
}

type SectionId = 'overview' | 'service' | 'return' | 'rally' | 'overall' | 'other';

function KeyStatisticsBlock({ kpis, perMatchTrends }: { kpis: AnalyticsKPIs; perMatchTrends?: PerMatchTrendPoint[] }) {
  const c = STAT_SECTION_COLORS;
  const [expanded, setExpanded] = useState<Record<SectionId, boolean>>({
    overview: false,
    service: false,
    return: false,
    rally: false,
    overall: false,
    other: false,
  });
  const [trendModal, setTrendModal] = useState<(StatTrendMeta & { label: string; color: string }) | null>(null);
  const [showWinBreakdown, setShowWinBreakdown] = useState(false);
  const [showSideBreakdown, setShowSideBreakdown] = useState(false);
  const [showClutchBreakdown, setShowClutchBreakdown] = useState(false);
  const [showReturnClutchBreakdown, setShowReturnClutchBreakdown] = useState(false);
  const [showReturnSideBreakdown, setShowReturnSideBreakdown] = useState(false);
  const [showShotTypeBreakdown, setShowShotTypeBreakdown] = useState(false);
  const [showRatioBreakdown, setShowRatioBreakdown] = useState(false);
  const [showOverallClutch, setShowOverallClutch] = useState(false);
  const [showOverallRatios, setShowOverallRatios] = useState(false);
  const [showChokesAndComebacks, setShowChokesAndComebacks] = useState(false);
  const toggle = (id: SectionId) => () => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  const canShowTrend = perMatchTrends != null && perMatchTrends.length > 0;
  const trendData = trendModal && canShowTrend
    ? perMatchTrends!.map((p, i) => ({
        xLabel: String(i + 1),
        value: (p[trendModal.statKey] as number) ?? 0,
      }))
    : [];

  return (
    <View className="p-6 rounded-2xl border border-white/10" style={{ width: '100%', alignSelf: 'stretch' }}>
      <Text className="text-2xl font-bold text-white mb-5">Key Statistics</Text>

      {trendModal && (
        <Modal visible transparent animationType="fade">
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setTrendModal(null)}>
            <Pressable style={{ backgroundColor: 'rgba(30,30,40,0.98)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }} onPress={e => e.stopPropagation()}>
              <View className="flex-row items-center mb-3">
                <TouchableOpacity onPress={() => setTrendModal(null)} hitSlop={12} style={{ marginRight: 10 }}>
                  <Feather name="arrow-left" size={22} color="#9ca3af" />
                </TouchableOpacity>
                <Text className="text-lg font-bold text-white">{trendModal.label}</Text>
              </View>
              <StatTrendOverMatchesChart
                title={trendModal.label}
                format={trendModal.format}
                data={trendData}
                color={trendModal.color}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <StatSection
        title="Overview"
        color={c.overview}
        expanded={expanded.overview}
        onToggle={toggle('overview')}
        moreChildren={
          <>
            <StatCard>
              <KeyStat icon="trending-up" label="Longest Match Win Streak" value={kpis.longestMatchStreak ?? '-'} color={c.overview} />
            </StatCard>
            <StatCard>
              <KeyStat icon="award" label="Love Games Won" value={kpis.loveGamesWon ?? '-'} color={c.overview} trendMeta={canShowTrend ? { statKey: 'loveGamesWon', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="shield-off" label="Love Games Lost" value={kpis.loveGamesLost ?? '-'} color={c.overview} trendMeta={canShowTrend ? { statKey: 'loveGamesLost', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="sliders" label="Dominance Ratio" value={kpis.dominanceRatio != null ? kpis.dominanceRatio.toFixed(2) : '-'} subtitle={(() => { const r = kpis.returnPointsWon ?? 0; const lost = (kpis.servicePointsPlayed ?? 0) - (kpis.servicePointsWon ?? 0); return lost > 0 ? `${r} / ${lost}` : undefined; })()} color={c.overview} trendMeta={canShowTrend ? { statKey: 'dominanceRatio', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <View style={{ width: '100%', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => { hapticLight(); setShowChokesAndComebacks(true); }}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', backgroundColor: 'rgba(34,197,94,0.05)' }}
              >
                <Feather name="repeat" size={14} color={c.overview} style={{ marginRight: 6 }} />
                <Text style={{ color: c.overview, fontSize: 12, fontWeight: '600' }}>View Chokes and Comebacks</Text>
                <Feather name="chevron-right" size={14} color={c.overview} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
            <View style={{ width: '100%', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => { hapticLight(); setShowWinBreakdown(true); }}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', backgroundColor: 'rgba(34,197,94,0.05)' }}
              >
                <Feather name="bar-chart" size={14} color={c.overview} style={{ marginRight: 6 }} />
                <Text style={{ color: c.overview, fontSize: 12, fontWeight: '600' }}>View Wins by Hand & Court Surface</Text>
                <Feather name="chevron-right" size={14} color={c.overview} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          </>
        }
      >
        <StatCard>
          <KeyStat icon="award" label="Win Rate" value={kpis.winRate} subtitle={formatCount(kpis.wins, kpis.totalMatches)} color={c.overview} trendMeta={canShowTrend ? { statKey: 'winRate', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
        <StatCard>
          <KeyStat icon="hash" label="Matches Played" value={kpis.totalMatches ?? '-'} color={c.overview} trendMeta={canShowTrend ? { statKey: 'totalMatches', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
        <StatCard>
          <KeyStat icon="activity" label="Longest Game Win Streak" value={kpis.longestGameStreak ?? '-'} color={c.overview} trendMeta={canShowTrend ? { statKey: 'longestGameStreak', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
        <StatCard>
          <KeyStat icon="layers" label="Longest Set Win Streak" value={kpis.longestSetStreak ?? '-'} color={c.overview} trendMeta={canShowTrend ? { statKey: 'longestSetStreak', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
        <StatCard>
          <KeyStat icon="zap" label="Longest Point Win Streak" value={kpis.longestPointStreak ?? '-'} color={c.overview} trendMeta={canShowTrend ? { statKey: 'longestPointStreak', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
      </StatSection>

      {showWinBreakdown && (
        <Modal visible transparent animationType="fade">
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setShowWinBreakdown(false)}>
            <Pressable style={{ backgroundColor: 'rgba(30,30,40,0.98)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }} onPress={e => e.stopPropagation()}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={() => setShowWinBreakdown(false)} hitSlop={12} style={{ marginRight: 10 }}>
                  <Feather name="arrow-left" size={22} color="#9ca3af" />
                </TouchableOpacity>
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Wins by Hand & Surface</Text>
              </View>

              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Dominant Hand</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                <View style={{ flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>vs Lefty</Text>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{(kpis.winsVsLefty ?? 0) + (kpis.lossesVsLefty ?? 0) > 0 ? `${Math.round(((kpis.winsVsLefty ?? 0) / ((kpis.winsVsLefty ?? 0) + (kpis.lossesVsLefty ?? 0))) * 100)}%` : '-'}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{kpis.winsVsLefty ?? 0}W - {kpis.lossesVsLefty ?? 0}L</Text>
                </View>
                <View style={{ flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>vs Righty</Text>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{(kpis.winsVsRighty ?? 0) + (kpis.lossesVsRighty ?? 0) > 0 ? `${Math.round(((kpis.winsVsRighty ?? 0) / ((kpis.winsVsRighty ?? 0) + (kpis.lossesVsRighty ?? 0))) * 100)}%` : '-'}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>{kpis.winsVsRighty ?? 0}W - {kpis.lossesVsRighty ?? 0}L</Text>
                </View>
              </View>

              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Court Surface</Text>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6', marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Hard Court</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.winsHard ?? 0}W - {kpis.lossesHard ?? 0}L</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.hardCourtWinPercent ?? '-'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(234,88,12,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(234,88,12,0.2)' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EA580C', marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Clay Court</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.winsClay ?? 0}W - {kpis.lossesClay ?? 0}L</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.clayCourtWinPercent ?? '-'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Grass Court</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.winsGrass ?? 0}W - {kpis.lossesGrass ?? 0}L</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.grassCourtWinPercent ?? '-'}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(168,85,247,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(168,85,247,0.2)' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#A855F7', marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Carpet Court</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.winsCarpet ?? 0}W - {kpis.lossesCarpet ?? 0}L</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.carpetCourtWinPercent ?? '-'}</Text>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {showChokesAndComebacks && (
        <Modal visible transparent animationType="fade">
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setShowChokesAndComebacks(false)}>
            <Pressable style={{ backgroundColor: 'rgba(30,30,40,0.98)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }} onPress={e => e.stopPropagation()}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={() => setShowChokesAndComebacks(false)} hitSlop={12} style={{ marginRight: 10 }}>
                  <Feather name="arrow-left" size={22} color="#9ca3af" />
                </TouchableOpacity>
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Chokes and Comebacks</Text>
              </View>

              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Comebacks</Text>
              <View style={{ gap: 8, marginBottom: 20 }}>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowChokesAndComebacks(false); setTrendModal({ statKey: 'comebacksDown1Set', format: 'number', label: 'Comebacks (down 1 set)', color: '#22C55E' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Comebacks (down 1 set)</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.comebacksDown1Set ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowChokesAndComebacks(false); setTrendModal({ statKey: 'comebacksDown2Sets', format: 'number', label: 'Comebacks (down 2 sets)', color: '#22C55E' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Comebacks (down 2 sets)</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.comebacksDown2Sets ?? '-'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Chokes</Text>
              <View style={{ gap: 8 }}>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowChokesAndComebacks(false); setTrendModal({ statKey: 'lossesUp1Set', format: 'number', label: 'Chokes (up 1 set)', color: '#22C55E' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Chokes (up 1 set)</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.lossesUp1Set ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowChokesAndComebacks(false); setTrendModal({ statKey: 'lossesUp2Sets', format: 'number', label: 'Chokes (up 2 sets)', color: '#22C55E' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Chokes (up 2 sets)</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.lossesUp2Sets ?? '-'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {showSideBreakdown && (
        <Modal visible transparent animationType="fade">
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setShowSideBreakdown(false)}>
            <Pressable style={{ backgroundColor: 'rgba(30,30,40,0.98)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }} onPress={e => e.stopPropagation()}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={() => setShowSideBreakdown(false)} hitSlop={12} style={{ marginRight: 10 }}>
                  <Feather name="arrow-left" size={22} color="#9ca3af" />
                </TouchableOpacity>
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Deuce / Ad Side</Text>
              </View>

              <View style={{ gap: 8 }}>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowSideBreakdown(false); setTrendModal({ statKey: 'deuceSidePointsWonPercent', format: 'percent', label: 'Deuce Side Won', color: '#60A5FA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6', marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Deuce Side Won</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.deuceSidePointsPlayed != null && kpis.deuceSidePointsPlayed > 0 ? `${kpis.deuceSidePointsWon ?? 0} / ${kpis.deuceSidePointsPlayed} pts` : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.deuceSidePointsWonPercent ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowSideBreakdown(false); setTrendModal({ statKey: 'adSidePointsWonPercent', format: 'percent', label: 'Ad Side Won', color: '#60A5FA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(139,92,246,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#8B5CF6', marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Ad Side Won</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.adSidePointsPlayed != null && kpis.adSidePointsPlayed > 0 ? `${kpis.adSidePointsWon ?? 0} / ${kpis.adSidePointsPlayed} pts` : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.adSidePointsWonPercent ?? '-'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {showClutchBreakdown && (
        <Modal visible transparent animationType="fade">
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setShowClutchBreakdown(false)}>
            <Pressable style={{ backgroundColor: 'rgba(30,30,40,0.98)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }} onPress={e => e.stopPropagation()}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={() => setShowClutchBreakdown(false)} hitSlop={12} style={{ marginRight: 10 }}>
                  <Feather name="arrow-left" size={22} color="#9ca3af" />
                </TouchableOpacity>
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Clutch Point Breakdown</Text>
              </View>

              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Conversion %</Text>
              <View style={{ gap: 8, marginBottom: 20 }}>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowClutchBreakdown(false); setTrendModal({ statKey: 'gamePointsOnServePercent', format: 'percent', label: 'Game Point % (Serve)', color: '#60A5FA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Game Point % (Serve)</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{formatCount(kpis.gamePointsOnServeWon, kpis.gamePointsOnServeOpportunity)}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.gamePointsOnServePercent ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowClutchBreakdown(false); setTrendModal({ statKey: 'setPointPercentServe', format: 'percent', label: 'Set Point % (Serve)', color: '#60A5FA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Set Point % (Serve)</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.setPointOppServe != null && kpis.setPointOppServe > 0 ? formatCount(kpis.setPointsWonServe ?? 0, kpis.setPointOppServe) : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.setPointPercentServe ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowClutchBreakdown(false); setTrendModal({ statKey: 'matchPointPercentServe', format: 'percent', label: 'Match Point % (Serve)', color: '#60A5FA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Match Point % (Serve)</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.matchPointOppServe != null && kpis.matchPointOppServe > 0 ? formatCount(kpis.matchPointsWonServe ?? 0, kpis.matchPointOppServe) : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.matchPointPercentServe ?? '-'}</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Points Saved %</Text>
              <View style={{ gap: 8 }}>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowClutchBreakdown(false); setTrendModal({ statKey: 'gamePointsSavedPercent', format: 'percent', label: 'Game Points Saved', color: '#60A5FA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(234,179,8,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(234,179,8,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Game Points Saved</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{formatCount(kpis.breakPointsSaved, kpis.breakPointsFaced)}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.gamePointsSavedPercent ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowClutchBreakdown(false); setTrendModal({ statKey: 'setPointsSavedPercent', format: 'percent', label: 'Set Points Saved', color: '#60A5FA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(234,179,8,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(234,179,8,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Set Points Saved</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.setPointsFaced != null && kpis.setPointsFaced > 0 ? formatCount(kpis.setPointsSaved ?? 0, kpis.setPointsFaced) : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.setPointsSavedPercent ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowClutchBreakdown(false); setTrendModal({ statKey: 'matchPointsSavedPercent', format: 'percent', label: 'Match Points Saved', color: '#60A5FA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(234,179,8,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(234,179,8,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Match Points Saved</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.matchPointsFaced != null && kpis.matchPointsFaced > 0 ? formatCount(kpis.matchPointsSaved ?? 0, kpis.matchPointsFaced) : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.matchPointsSavedPercent ?? '-'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <StatSection
        title="Service"
        color={c.service}
        expanded={expanded.service}
        onToggle={toggle('service')}
        moreChildren={
          <>
            <StatCard>
              <KeyStat icon="arrow-right" label="2nd Serve %" value={kpis.secondServeInPercent ?? '-'} subtitle={formatCount(kpis.secondServeIn, kpis.secondServeAttempted)} color={c.service} trendMeta={canShowTrend ? { statKey: 'secondServeInPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="shield" label="2nd Serve Points Won %" value={kpis.secondServeWonPercent} subtitle={formatCount(kpis.secondServePointsWon, kpis.secondServePointsPlayed)} color={c.service} trendMeta={canShowTrend ? { statKey: 'secondServeWonPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="shield" label="Service Games Won %" value={kpis.serviceGamesWonPercent ?? '-'} subtitle={formatCount(kpis.serviceGamesWon, kpis.serviceGamesPlayed)} color={c.service} trendMeta={canShowTrend ? { statKey: 'serviceGamesWonPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="shield" label="Service Points Won %" value={kpis.servicePointsWonPercent ?? '-'} subtitle={formatCount(kpis.servicePointsWon, kpis.servicePointsPlayed)} color={c.service} trendMeta={canShowTrend ? { statKey: 'servicePointsWonPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="send" label="Serves Unreturned %" value={kpis.servesUnreturnedPercent ?? '-'} subtitle={formatCount(kpis.servesUnreturned, kpis.servicePointsPlayed)} color={c.service} trendMeta={canShowTrend ? { statKey: 'servesUnreturnedPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="shield" label="Break Points Saved %" value={kpis.breakPointsSavedPercent ?? '-'} subtitle={formatCount(kpis.breakPointsSaved, kpis.breakPointsFaced)} color={c.service} trendMeta={canShowTrend ? { statKey: 'breakPointsSavedPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="bar-chart-2" label="Ace / Double Fault Ratio" value={kpis.serveWinnersToUfeRatio != null ? kpis.serveWinnersToUfeRatio.toFixed(2) : '-'} subtitle={kpis.doubleFaults != null && kpis.doubleFaults > 0 ? `${kpis.aces}/${kpis.doubleFaults}` : undefined} color={c.service} trendMeta={canShowTrend ? { statKey: 'serveWinnersToUfeRatio', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="send" label="Tiebreak Serve Points Won %" value={kpis.tiebreakServePointsWonPercent ?? '-'} subtitle={kpis.tiebreakServePointsPlayed != null && kpis.tiebreakServePointsPlayed > 0 ? formatCount(kpis.tiebreakServePointsWon ?? 0, kpis.tiebreakServePointsPlayed) : undefined} color={c.service} trendMeta={canShowTrend ? { statKey: 'tiebreakServePointsWonPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <View style={{ width: '100%', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => { hapticLight(); setShowClutchBreakdown(true); }}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', backgroundColor: 'rgba(59,130,246,0.05)' }}
              >
                <Feather name="zap" size={14} color={c.service} style={{ marginRight: 6 }} />
                <Text style={{ color: c.service, fontSize: 12, fontWeight: '600' }}>View Clutch Point Breakdown</Text>
                <Feather name="chevron-right" size={14} color={c.service} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
            <View style={{ width: '100%', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => { hapticLight(); setShowSideBreakdown(true); }}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', backgroundColor: 'rgba(59,130,246,0.05)' }}
              >
                <Feather name="columns" size={14} color={c.service} style={{ marginRight: 6 }} />
                <Text style={{ color: c.service, fontSize: 12, fontWeight: '600' }}>View Deuce / Ad Side Breakdown</Text>
                <Feather name="chevron-right" size={14} color={c.service} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          </>
        }
      >
        <StatCard>
          <KeyStat icon="server" label="Aces" value={kpis.aces ?? '-'} color={c.service} trendMeta={canShowTrend ? { statKey: 'aces', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
        <StatCard>
          <KeyStat icon="shield-off" label="Double Faults" value={kpis.doubleFaults ?? '-'} color={c.service} trendMeta={canShowTrend ? { statKey: 'doubleFaults', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
        <StatCard>
          <KeyStat icon="arrow-right" label="1st Serve %" value={kpis.firstServePercent} subtitle={formatCount(kpis.firstServeIn, kpis.firstServeAttempted)} color={c.service} trendMeta={canShowTrend ? { statKey: 'firstServePercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
        <StatCard>
          <KeyStat icon="shield" label="1st Serve Points Won %" value={kpis.firstServeWonPercent} subtitle={formatCount(kpis.firstServePointsWon, kpis.firstServePointsPlayed)} color={c.service} trendMeta={canShowTrend ? { statKey: 'firstServeWonPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
      </StatSection>

      <StatSection
        title="Return"
        color={c.return}
        expanded={expanded.return}
        onToggle={toggle('return')}
        moreChildren={
          <>
            <StatCard>
              <KeyStat icon="bar-chart-2" label="Return Winner/Unforced Error" value={kpis.returnWinnersToUfeRatio != null ? kpis.returnWinnersToUfeRatio.toFixed(2) : '-'} subtitle={kpis.returnUnforcedErrors != null && kpis.returnUnforcedErrors > 0 ? `${kpis.returnWinners ?? 0}/${kpis.returnUnforcedErrors}` : undefined} color={c.return} trendMeta={canShowTrend ? { statKey: 'returnWinnersToUfeRatio', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="shield" label="Return Games Won %" value={kpis.returnGamesWonPercent ?? '-'} subtitle={formatCount(kpis.returnGamesWon, kpis.returnGamesPlayed)} color={c.return} trendMeta={canShowTrend ? { statKey: 'returnGamesWonPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="corner-down-left" label="1st Serve Return %" value={kpis.firstServeReturnPercent ?? '-'} subtitle={formatCount(kpis.firstServeReturnMade, kpis.firstServeReturnAttempted)} color={c.return} trendMeta={canShowTrend ? { statKey: 'firstServeReturnPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="corner-down-left" label="2nd Serve Return %" value={kpis.secondServeReturnPercent ?? '-'} subtitle={formatCount(kpis.secondServeReturnMade, kpis.secondServeReturnAttempted)} color={c.return} trendMeta={canShowTrend ? { statKey: 'secondServeReturnPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="shield" label="1st Serve Return Points Won %" value={kpis.firstServeReturnPtsWonPercent ?? '-'} subtitle={formatCount(kpis.firstServeReturnPtsWon, kpis.firstServeReturnPtsPlayed)} color={c.return} trendMeta={canShowTrend ? { statKey: 'firstServeReturnPtsWonPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="shield" label="2nd Serve Return Points Won %" value={kpis.secondServeReturnPtsWonPercent ?? '-'} subtitle={formatCount(kpis.secondServeReturnPtsWon, kpis.secondServeReturnPtsPlayed)} color={c.return} trendMeta={canShowTrend ? { statKey: 'secondServeReturnPtsWonPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="shield" label="Return Forced Errors" value={kpis.returnForcedErrors ?? '-'} color={c.return} trendMeta={canShowTrend ? { statKey: 'returnForcedErrors', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="zap" label="Return Winners" value={kpis.returnWinners ?? '-'} color={c.return} trendMeta={canShowTrend ? { statKey: 'returnWinners', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <View style={{ width: '100%', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => { hapticLight(); setShowReturnClutchBreakdown(true); }}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)', backgroundColor: 'rgba(251,191,36,0.05)' }}
              >
                <Feather name="zap" size={14} color={c.return} style={{ marginRight: 6 }} />
                <Text style={{ color: c.return, fontSize: 12, fontWeight: '600' }}>View Clutch Point Breakdown</Text>
                <Feather name="chevron-right" size={14} color={c.return} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
            <View style={{ width: '100%', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => { hapticLight(); setShowReturnSideBreakdown(true); }}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)', backgroundColor: 'rgba(251,191,36,0.05)' }}
              >
                <Feather name="columns" size={14} color={c.return} style={{ marginRight: 6 }} />
                <Text style={{ color: c.return, fontSize: 12, fontWeight: '600' }}>View Deuce / Ad Side Breakdown</Text>
                <Feather name="chevron-right" size={14} color={c.return} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          </>
        }
      >
        <StatCard>
          <KeyStat icon="inbox" label="Return In %" value={kpis.returnInPercent ?? '-'} subtitle={formatCount(kpis.returnMade, kpis.returnAttempted)} color={c.return} trendMeta={canShowTrend ? { statKey: 'returnInPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
        <StatCard>
          <KeyStat icon="corner-down-left" label="Return Points Won %" value={kpis.returnPointsWonPercent ?? '-'} subtitle={formatCount(kpis.returnPointsWon, kpis.returnPointsPlayed)} color={c.return} trendMeta={canShowTrend ? { statKey: 'returnPointsWonPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
        <StatCard>
          <KeyStat icon="target" label="Break Points Won %" value={kpis.breakPointsConvertedPercent ?? '-'} subtitle={formatCount(kpis.breakPointsConverted, kpis.breakPointOpportunities)} color={c.return} trendMeta={canShowTrend ? { statKey: 'breakPointsConvertedPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
        <StatCard>
          <KeyStat icon="shield-off" label="Return Unforced Errors" value={kpis.returnUnforcedErrors ?? '-'} color={c.return} trendMeta={canShowTrend ? { statKey: 'returnUnforcedErrors', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
      </StatSection>

      {showReturnClutchBreakdown && (
        <Modal visible transparent animationType="fade">
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setShowReturnClutchBreakdown(false)}>
            <Pressable style={{ backgroundColor: 'rgba(30,30,40,0.98)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }} onPress={e => e.stopPropagation()}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={() => setShowReturnClutchBreakdown(false)} hitSlop={12} style={{ marginRight: 10 }}>
                  <Feather name="arrow-left" size={22} color="#9ca3af" />
                </TouchableOpacity>
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Clutch Point Breakdown</Text>
              </View>

              <View style={{ gap: 8 }}>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowReturnClutchBreakdown(false); setTrendModal({ statKey: 'gamePointsOnReturnPercent', format: 'percent', label: 'Game Point % (Return)', color: '#FBBF24' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Game Point % (Return)</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{formatCount(kpis.gamePointsOnReturnWon, kpis.gamePointsOnReturnOpportunity)}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.gamePointsOnReturnPercent ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowReturnClutchBreakdown(false); setTrendModal({ statKey: 'setPointPercentReturn', format: 'percent', label: 'Set Point % (Return)', color: '#FBBF24' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Set Point % (Return)</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.setPointOppReturn != null && kpis.setPointOppReturn > 0 ? formatCount(kpis.setPointsWonReturn ?? 0, kpis.setPointOppReturn) : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.setPointPercentReturn ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowReturnClutchBreakdown(false); setTrendModal({ statKey: 'matchPointPercentReturn', format: 'percent', label: 'Match Point % (Return)', color: '#FBBF24' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Match Point % (Return)</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.matchPointOppReturn != null && kpis.matchPointOppReturn > 0 ? formatCount(kpis.matchPointsWonReturn ?? 0, kpis.matchPointOppReturn) : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.matchPointPercentReturn ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowReturnClutchBreakdown(false); setTrendModal({ statKey: 'tiebreakReturnPointsWonPercent', format: 'percent', label: 'Tiebreak Return Points Won %', color: '#FBBF24' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Tiebreak Return Points Won %</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.tiebreakReturnPointsPlayed != null && kpis.tiebreakReturnPointsPlayed > 0 ? formatCount(kpis.tiebreakReturnPointsWon ?? 0, kpis.tiebreakReturnPointsPlayed) : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.tiebreakReturnPointsWonPercent ?? '-'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {showReturnSideBreakdown && (
        <Modal visible transparent animationType="fade">
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setShowReturnSideBreakdown(false)}>
            <Pressable style={{ backgroundColor: 'rgba(30,30,40,0.98)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }} onPress={e => e.stopPropagation()}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={() => setShowReturnSideBreakdown(false)} hitSlop={12} style={{ marginRight: 10 }}>
                  <Feather name="arrow-left" size={22} color="#9ca3af" />
                </TouchableOpacity>
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Deuce / Ad Side (Return)</Text>
              </View>

              <View style={{ gap: 8 }}>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowReturnSideBreakdown(false); setTrendModal({ statKey: 'returnDeuceSidePointsWonPercent', format: 'percent', label: 'Deuce Side Won', color: '#FBBF24' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FBBF24', marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Deuce Side Won</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.returnDeuceSidePointsPlayed != null && kpis.returnDeuceSidePointsPlayed > 0 ? `${kpis.returnDeuceSidePointsWon ?? 0} / ${kpis.returnDeuceSidePointsPlayed} pts` : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.returnDeuceSidePointsWonPercent ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowReturnSideBreakdown(false); setTrendModal({ statKey: 'returnAdSidePointsWonPercent', format: 'percent', label: 'Ad Side Won', color: '#FBBF24' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B', marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Ad Side Won</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.returnAdSidePointsPlayed != null && kpis.returnAdSidePointsPlayed > 0 ? `${kpis.returnAdSidePointsWon ?? 0} / ${kpis.returnAdSidePointsPlayed} pts` : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.returnAdSidePointsWonPercent ?? '-'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <StatSection
        title="Rally"
        color={c.rally}
        expanded={expanded.rally}
        onToggle={toggle('rally')}
        moreChildren={
          <>
            <StatCard>
              <KeyStat icon="bar-chart-2" label="Winner / Unforced Error Ratio" value={kpis.rallyWinnersToUfeRatio != null ? kpis.rallyWinnersToUfeRatio.toFixed(2) : '-'} subtitle={kpis.rallyUnforcedErrors != null && kpis.rallyUnforcedErrors > 0 ? `${kpis.winners}/${kpis.rallyUnforcedErrors}` : undefined} color={c.rally} trendMeta={canShowTrend ? { statKey: 'rallyWinnersToUfeRatio', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="shield" label="Forced Errors" value={kpis.forcedErrors ?? '-'} color={c.rally} trendMeta={canShowTrend ? { statKey: 'forcedErrors', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="activity" label="Longest Rally" value={kpis.longestRallyLength ?? '-'} color={c.rally} trendMeta={canShowTrend ? { statKey: 'longestRallyLength', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="zap" label="0-4 Shot Rally Win %" value={kpis.rallyShortWonPercent ?? '-'} subtitle={formatCount(kpis.rallyShortWon, kpis.rallyShortPlayed)} color={c.rally} trendMeta={canShowTrend ? { statKey: 'rallyShortWonPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="repeat" label="5-8 Shot Rally Win %" value={kpis.rallyMediumWonPercent ?? '-'} subtitle={formatCount(kpis.rallyMediumWon, kpis.rallyMediumPlayed)} color={c.rally} trendMeta={canShowTrend ? { statKey: 'rallyMediumWonPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="trending-up" label="9+ Shot Rally Win %" value={kpis.rallyLongWonPercent ?? '-'} subtitle={formatCount(kpis.rallyLongWon, kpis.rallyLongPlayed)} color={c.rally} trendMeta={canShowTrend ? { statKey: 'rallyLongWonPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <View style={{ width: '100%', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => { hapticLight(); setShowShotTypeBreakdown(true); }}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', backgroundColor: 'rgba(167,139,250,0.05)' }}
              >
                <Feather name="target" size={14} color={c.rally} style={{ marginRight: 6 }} />
                <Text style={{ color: c.rally, fontSize: 12, fontWeight: '600' }}>Show Winners and Errors by Shot Type</Text>
                <Feather name="chevron-right" size={14} color={c.rally} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
            <View style={{ width: '100%', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => { hapticLight(); setShowRatioBreakdown(true); }}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)', backgroundColor: 'rgba(167,139,250,0.05)' }}
              >
                <Feather name="bar-chart-2" size={14} color={c.rally} style={{ marginRight: 6 }} />
                <Text style={{ color: c.rally, fontSize: 12, fontWeight: '600' }}>Winner / Unforced Error Ratios</Text>
                <Feather name="chevron-right" size={14} color={c.rally} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          </>
        }
      >
        <StatCard>
          <KeyStat icon="zap" label="Rally Winners" value={kpis.winners ?? '-'} color={c.rally} trendMeta={canShowTrend ? { statKey: 'winners', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
        <StatCard>
          <KeyStat icon="shield-off" label="Rally Unforced Errors" value={kpis.rallyUnforcedErrors ?? '-'} color={c.rally} trendMeta={canShowTrend ? { statKey: 'rallyUnforcedErrors', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
        <StatCard>
          <KeyStat icon="trending-up" label="Net Points Won %" value={kpis.netPointsWonPercent ?? '-'} subtitle={formatCount(kpis.netPointsWon, kpis.netPointsAttempted)} color={c.rally} trendMeta={canShowTrend ? { statKey: 'netPointsWonPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
        <StatCard>
          <KeyStat icon="crosshair" label="Net Attempted %" value={kpis.netAttemptedPercent ?? '-'} subtitle={formatCount(kpis.netPointsAttempted, kpis.pointsPlayed)} color={c.rally} trendMeta={canShowTrend ? { statKey: 'netAttemptedPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
      </StatSection>

      {showShotTypeBreakdown && (
        <Modal visible transparent animationType="fade">
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setShowShotTypeBreakdown(false)}>
            <Pressable style={{ backgroundColor: 'rgba(30,30,40,0.98)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }} onPress={e => e.stopPropagation()}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={() => setShowShotTypeBreakdown(false)} hitSlop={12} style={{ marginRight: 10 }}>
                  <Feather name="arrow-left" size={22} color="#9ca3af" />
                </TouchableOpacity>
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Winners & Errors by Shot Type</Text>
              </View>

              <View style={{ gap: 8 }}>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowShotTypeBreakdown(false); setTrendModal({ statKey: 'forehandWinners', format: 'number', label: 'Forehand Winners', color: '#A78BFA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Forehand Winners</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.forehandWinners ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowShotTypeBreakdown(false); setTrendModal({ statKey: 'forehandErrors', format: 'number', label: 'Forehand Errors', color: '#A78BFA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Forehand Errors</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.forehandErrors ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowShotTypeBreakdown(false); setTrendModal({ statKey: 'backhandWinners', format: 'number', label: 'Backhand Winners', color: '#A78BFA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Backhand Winners</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.backhandWinners ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowShotTypeBreakdown(false); setTrendModal({ statKey: 'backhandErrors', format: 'number', label: 'Backhand Errors', color: '#A78BFA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Backhand Errors</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.backhandErrors ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowShotTypeBreakdown(false); setTrendModal({ statKey: 'volleyWinners', format: 'number', label: 'Volley Winners', color: '#A78BFA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Volley Winners</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.volleyWinners ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowShotTypeBreakdown(false); setTrendModal({ statKey: 'volleyErrors', format: 'number', label: 'Volley Errors', color: '#A78BFA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Volley Errors</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.volleyErrors ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowShotTypeBreakdown(false); setTrendModal({ statKey: 'overheadWinners', format: 'number', label: 'Overhead Winners', color: '#A78BFA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Overhead Winners</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.overheadWinners ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowShotTypeBreakdown(false); setTrendModal({ statKey: 'overheadErrors', format: 'number', label: 'Overhead Errors', color: '#A78BFA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Overhead Errors</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.overheadErrors ?? '-'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {showRatioBreakdown && (
        <Modal visible transparent animationType="fade">
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setShowRatioBreakdown(false)}>
            <Pressable style={{ backgroundColor: 'rgba(30,30,40,0.98)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }} onPress={e => e.stopPropagation()}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={() => setShowRatioBreakdown(false)} hitSlop={12} style={{ marginRight: 10 }}>
                  <Feather name="arrow-left" size={22} color="#9ca3af" />
                </TouchableOpacity>
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Winner / Unforced Error Ratios</Text>
              </View>

              <View style={{ gap: 8 }}>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowRatioBreakdown(false); setTrendModal({ statKey: 'forehandRatio', format: 'number', label: 'Forehand W/E Ratio', color: '#A78BFA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Forehand W/E Ratio</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.forehandErrors != null && kpis.forehandErrors > 0 ? `${kpis.forehandWinners}/${kpis.forehandErrors}` : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.forehandRatio != null ? kpis.forehandRatio.toFixed(2) : '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowRatioBreakdown(false); setTrendModal({ statKey: 'backhandRatio', format: 'number', label: 'Backhand W/E Ratio', color: '#A78BFA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Backhand W/E Ratio</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.backhandErrors != null && kpis.backhandErrors > 0 ? `${kpis.backhandWinners}/${kpis.backhandErrors}` : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.backhandRatio != null ? kpis.backhandRatio.toFixed(2) : '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowRatioBreakdown(false); setTrendModal({ statKey: 'volleyRatio', format: 'number', label: 'Volley W/E Ratio', color: '#A78BFA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Volley W/E Ratio</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.volleyErrors != null && kpis.volleyErrors > 0 ? `${kpis.volleyWinners}/${kpis.volleyErrors}` : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.volleyRatio != null ? kpis.volleyRatio.toFixed(2) : '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowRatioBreakdown(false); setTrendModal({ statKey: 'overheadRatio', format: 'number', label: 'Overhead W/E Ratio', color: '#A78BFA' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(167,139,250,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Overhead W/E Ratio</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.overheadErrors != null && kpis.overheadErrors > 0 ? `${kpis.overheadWinners}/${kpis.overheadErrors}` : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.overheadRatio != null ? kpis.overheadRatio.toFixed(2) : '-'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <StatSection
        title="Overall"
        color={c.overall}
        expanded={expanded.overall}
        onToggle={toggle('overall')}
        moreChildren={
          <>
            <StatCard>
              <KeyStat icon="zap" label="Winners" value={kpis.overallWinners ?? kpis.winners} color={c.overall} trendMeta={canShowTrend ? { statKey: 'overallWinners', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="shield-off" label="Unforced Errors" value={kpis.unforcedErrors} color={c.overall} trendMeta={canShowTrend ? { statKey: 'unforcedErrors', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <StatCard>
              <KeyStat icon="bar-chart-2" label="Winner / Unforced Error Ratio" value={kpis.winnersToUfeRatio != null ? kpis.winnersToUfeRatio.toFixed(2) : '-'} subtitle={kpis.unforcedErrors != null && kpis.unforcedErrors > 0 ? `${kpis.overallWinners ?? kpis.winners} / ${kpis.unforcedErrors}` : undefined} color={c.overall} trendMeta={canShowTrend ? { statKey: 'winnersToUfeRatio', format: 'number' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
            </StatCard>
            <View style={{ width: '100%', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => { hapticLight(); setShowOverallClutch(true); }}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)', backgroundColor: 'rgba(20,184,166,0.05)' }}
              >
                <Feather name="zap" size={14} color={c.overall} style={{ marginRight: 6 }} />
                <Text style={{ color: c.overall, fontSize: 12, fontWeight: '600' }}>View Clutch Points</Text>
                <Feather name="chevron-right" size={14} color={c.overall} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
            <View style={{ width: '100%', marginTop: 8 }}>
              <TouchableOpacity
                onPress={() => { hapticLight(); setShowOverallRatios(true); }}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)', backgroundColor: 'rgba(20,184,166,0.05)' }}
              >
                <Feather name="bar-chart-2" size={14} color={c.overall} style={{ marginRight: 6 }} />
                <Text style={{ color: c.overall, fontSize: 12, fontWeight: '600' }}>View Ratios</Text>
                <Feather name="chevron-right" size={14} color={c.overall} style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            </View>
          </>
        }
      >
        <StatCard>
          <KeyStat icon="target" label="Break Points Converted %" value={kpis.breakPointsConvertedPercent ?? '-'} subtitle={formatCount(kpis.breakPointsConverted, kpis.breakPointOpportunities)} color={c.overall} trendMeta={canShowTrend ? { statKey: 'breakPointsConvertedPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
        <StatCard>
          <KeyStat icon="target" label="Points Won %" value={kpis.pointsWonPercent ?? '-'} subtitle={formatCount(kpis.pointsWon, kpis.pointsPlayed)} color={c.overall} trendMeta={canShowTrend ? { statKey: 'pointsWonPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
        <StatCard>
          <KeyStat icon="grid" label="Games Won %" value={kpis.gamesWonPercent ?? '-'} subtitle={formatCount(kpis.gamesWon, kpis.gamesPlayed)} color={c.overall} trendMeta={canShowTrend ? { statKey: 'gamesWonPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
        <StatCard>
          <KeyStat icon="layers" label="Sets Won %" value={kpis.setsWonPercent ?? '-'} subtitle={formatCount(kpis.setsWon, kpis.setsPlayed)} color={c.overall} trendMeta={canShowTrend ? { statKey: 'setsWonPercent', format: 'percent' } : undefined} onTrendPress={canShowTrend ? setTrendModal : undefined} />
        </StatCard>
      </StatSection>

      {showOverallClutch && (
        <Modal visible transparent animationType="fade">
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setShowOverallClutch(false)}>
            <Pressable style={{ backgroundColor: 'rgba(30,30,40,0.98)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }} onPress={e => e.stopPropagation()}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={() => setShowOverallClutch(false)} hitSlop={12} style={{ marginRight: 10 }}>
                  <Feather name="arrow-left" size={22} color="#9ca3af" />
                </TouchableOpacity>
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Clutch Points</Text>
              </View>

              <View style={{ gap: 8 }}>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowOverallClutch(false); setTrendModal({ statKey: 'gamePointConversionPercent', format: 'percent', label: 'Game Point Conversion %', color: '#14b8a6' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(20,184,166,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Game Point Conversion %</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{(() => { const w = (kpis.gamePointsOnServeWon ?? 0) + (kpis.gamePointsOnReturnWon ?? 0); const opp = (kpis.gamePointsOnServeOpportunity ?? 0) + (kpis.gamePointsOnReturnOpportunity ?? 0); return opp > 0 ? `${w} / ${opp}` : 'No data'; })()}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{(() => { const w = (kpis.gamePointsOnServeWon ?? 0) + (kpis.gamePointsOnReturnWon ?? 0); const opp = (kpis.gamePointsOnServeOpportunity ?? 0) + (kpis.gamePointsOnReturnOpportunity ?? 0); return opp > 0 ? `${Math.round((w / opp) * 100)}%` : '-'; })()}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowOverallClutch(false); setTrendModal({ statKey: 'setPointPercent', format: 'percent', label: 'Set Point %', color: '#14b8a6' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(20,184,166,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Set Point %</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.setPointOppServe != null && kpis.setPointOppReturn != null && (kpis.setPointOppServe + kpis.setPointOppReturn) > 0 ? formatCount((kpis.setPointsWonServe ?? 0) + (kpis.setPointsWonReturn ?? 0), (kpis.setPointOppServe ?? 0) + (kpis.setPointOppReturn ?? 0)) : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.setPointPercent ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowOverallClutch(false); setTrendModal({ statKey: 'matchPointPercent', format: 'percent', label: 'Match Point %', color: '#14b8a6' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(20,184,166,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Match Point %</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.matchPointOppServe != null && kpis.matchPointOppReturn != null && (kpis.matchPointOppServe + kpis.matchPointOppReturn) > 0 ? formatCount((kpis.matchPointsWonServe ?? 0) + (kpis.matchPointsWonReturn ?? 0), (kpis.matchPointOppServe ?? 0) + (kpis.matchPointOppReturn ?? 0)) : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.matchPointPercent ?? '-'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowOverallClutch(false); setTrendModal({ statKey: 'tiebreakPointsWonPercent', format: 'percent', label: 'Tiebreak Points Won %', color: '#14b8a6' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(20,184,166,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Tiebreak Points Won %</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{kpis.tiebreakPointsPlayed != null && kpis.tiebreakPointsPlayed > 0 ? formatCount(kpis.tiebreakPointsWon ?? 0, kpis.tiebreakPointsPlayed) : 'No data'}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{kpis.tiebreakPointsWonPercent ?? '-'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {showOverallRatios && (
        <Modal visible transparent animationType="fade">
          <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => setShowOverallRatios(false)}>
            <Pressable style={{ backgroundColor: 'rgba(30,30,40,0.98)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }} onPress={e => e.stopPropagation()}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={() => setShowOverallRatios(false)} hitSlop={12} style={{ marginRight: 10 }}>
                  <Feather name="arrow-left" size={22} color="#9ca3af" />
                </TouchableOpacity>
                <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>Ratios</Text>
              </View>

              <View style={{ gap: 8 }}>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowOverallRatios(false); setTrendModal({ statKey: 'pointsWonPercent', format: 'percent', label: 'Point Won Ratio', color: '#14b8a6' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(20,184,166,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Point Won Ratio</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{(() => { const won = kpis.pointsWon ?? 0; const lost = (kpis.pointsPlayed ?? 0) - won; return lost > 0 ? `${won} / ${lost}` : 'No data'; })()}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{(() => { const won = kpis.pointsWon ?? 0; const lost = (kpis.pointsPlayed ?? 0) - won; return lost > 0 ? (won / lost).toFixed(2) : '-'; })()}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowOverallRatios(false); setTrendModal({ statKey: 'gamesWonPercent', format: 'percent', label: 'Game Won Ratio', color: '#14b8a6' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(20,184,166,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Game Won Ratio</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{(() => { const won = kpis.gamesWon ?? 0; const lost = (kpis.gamesPlayed ?? 0) - won; return lost > 0 ? `${won} / ${lost}` : 'No data'; })()}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{(() => { const won = kpis.gamesWon ?? 0; const lost = (kpis.gamesPlayed ?? 0) - won; return lost > 0 ? (won / lost).toFixed(2) : '-'; })()}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowOverallRatios(false); setTrendModal({ statKey: 'setsWonPercent', format: 'percent', label: 'Sets Won Ratio', color: '#14b8a6' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(20,184,166,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Sets Won Ratio</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{(() => { const won = kpis.setsWon ?? 0; const lost = (kpis.setsPlayed ?? 0) - won; return lost > 0 ? `${won} / ${lost}` : 'No data'; })()}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{(() => { const won = kpis.setsWon ?? 0; const lost = (kpis.setsPlayed ?? 0) - won; return lost > 0 ? (won / lost).toFixed(2) : '-'; })()}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { if (canShowTrend) { hapticLight(); setShowOverallRatios(false); setTrendModal({ statKey: 'winRate', format: 'percent', label: 'Matches Won Ratio', color: '#14b8a6' }); } }} activeOpacity={canShowTrend ? 0.7 : 1} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(20,184,166,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(20,184,166,0.2)' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', marginBottom: 2 }}>Matches Won Ratio</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{(() => { const won = kpis.wins ?? 0; const lost = (kpis.totalMatches ?? 0) - won; return lost > 0 ? `${won} / ${lost}` : 'No data'; })()}</Text>
                  </View>
                  <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>{(() => { const won = kpis.wins ?? 0; const lost = (kpis.totalMatches ?? 0) - won; return lost > 0 ? (won / lost).toFixed(2) : '-'; })()}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <StatSection
        title="Other"
        color={c.other}
        expanded={expanded.other}
        onToggle={toggle('other')}
        moreChildren={
          <>
            <StatCard>
              <KeyStat icon="minus" label="Net Touches" value={kpis.touchingNet ?? 0} color={c.other} />
            </StatCard>
            <StatCard>
              <KeyStat icon="alert-triangle" label="Penalties" value={kpis.penalties ?? 0} color={c.other} />
            </StatCard>
          </>
        }
      >
        <StatCard>
          <KeyStat icon="circle" label="Lets" value={kpis.lets ?? 0} color={c.other} />
        </StatCard>
        <StatCard>
          <KeyStat icon="alert-circle" label="Foot Faults" value={kpis.footFaults ?? 0} color={c.other} />
        </StatCard>
      </StatSection>
    </View>
  );
}

function AnalyticsContentSkeleton() {
  return (
    <>
      <View className="p-6 rounded-2xl bg-white/5 border border-white/10">
        <Skeleton className="h-8 w-48 rounded mb-4" />
        <Skeleton className="h-4 w-20 rounded mb-4" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <StatCard>
            <Skeleton className="h-20 w-full rounded-xl" />
          </StatCard>
          <StatCard>
            <Skeleton className="h-20 w-full rounded-xl" />
          </StatCard>
        </View>
        <Skeleton className="h-4 w-16 rounded mb-4" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <StatCard>
            <Skeleton className="h-20 w-full rounded-xl" />
          </StatCard>
          <StatCard>
            <Skeleton className="h-20 w-full rounded-xl" />
          </StatCard>
        </View>
        <Skeleton className="h-4 w-12 rounded mb-4" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <StatCard key={i}>
              <Skeleton className="h-20 w-full rounded-xl" />
            </StatCard>
          ))}
        </View>
      </View>
      <View className="p-6 rounded-2xl bg-white/5 border border-white/10">
        <Skeleton className="h-8 w-40 rounded mb-1" />
        <Skeleton className="h-4 w-48 rounded mb-3" />
        <View className="flex-row items-center gap-4 mb-3">
          <Skeleton className="h-3 w-8 rounded" />
          <Skeleton className="h-3 w-8 rounded" />
        </View>
        <Skeleton className="h-32 w-full rounded-lg" />
      </View>
      <View className="p-6 rounded-2xl bg-white/5 border border-white/10">
        <Skeleton className="h-8 w-44 rounded mb-1" />
        <Skeleton className="h-4 w-64 rounded mb-4" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </View>
    </>
  );
}

function CompareTableSkeleton() {
  return (
    <View className="p-6 rounded-2xl bg-white/5 border border-white/10">
      <Skeleton className="h-8 w-32 rounded mb-4" />
      <View className="flex-row border-b border-white/10 pb-2 mb-2">
        <View style={{ width: 120 }} />
        <Skeleton className="h-4 w-20 rounded mx-1" />
        <Skeleton className="h-4 w-20 rounded mx-1" />
      </View>
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <View key={i} className="flex-row items-center border-b border-white/5 py-2">
          <Skeleton className="h-4 w-24 rounded" style={{ width: 120 }} />
          <Skeleton className="h-4 w-12 rounded mx-1" />
          <Skeleton className="h-4 w-12 rounded mx-1" />
        </View>
      ))}
    </View>
  );
}

function SetBreakdown({ match, stats }: { match: Match; stats: Stats }) {
  const yourIds = [match.yourPlayer1, match.yourPlayer2].filter((p): p is string => !!p);
  const oppIds = [match.oppPlayer1, match.oppPlayer2].filter((p): p is string => !!p);
  const getTeamGames = (games: Record<string, number>, ids: string[]) =>
    ids.reduce((acc, id) => acc + (games[id] || 0), 0);
  if (!stats.sets || stats.sets.length === 0) return null;
  return (
    <View className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
      <Text className="text-sm font-bold text-white mb-2">Set breakdown</Text>
      <View className="flex-row flex-wrap gap-3">
        {stats.sets.map((set, i) => {
          const your = getTeamGames(set.games, yourIds);
          const opp = getTeamGames(set.games, oppIds);
          const tb = set.tiebreak
            ? ` (${getTeamGames(set.tiebreak, yourIds)}-${getTeamGames(set.tiebreak, oppIds)})`
            : '';
          return (
            <Text key={i} className="text-gray-300 text-sm">
              Set {i + 1}: {your}-{opp}
              {tb}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const COMPARE_STAT_ROWS: { key: keyof MatchKPI; label: string }[] = [
  { key: 'aces', label: 'Aces' },
  { key: 'doubleFaults', label: 'Double faults' },
  { key: 'firstServePercent', label: '1st Serve %' },
  { key: 'firstServeWonPercent', label: '1st Serve points won %' },
  { key: 'secondServeWonPercent', label: '2nd Serve points won %' },
  { key: 'winners', label: 'Winners' },
  { key: 'unforcedErrors', label: 'Unforced errors' },
  { key: 'returnPointsWonPercent', label: 'Return points won %' },
  { key: 'breakPointsConvertedPercent', label: 'Break points won %' },
  { key: 'breakPointsSavedPercent', label: 'Break points saved %' },
];

export type AnalyticsPageProps = {
  mode?: StatMode;
  onModeChange?: (mode: StatMode) => void;
  period?: string;
  onPeriodChange?: (period: string) => void;
  matchCount?: number;
  onMatchCountChange?: (n: number) => void;
  selectedCompareIds?: string[];
  onSelectedCompareIdsChange?: (ids: string[] | ((prev: string[]) => string[])) => void;
  onSwitchToHistory?: () => void;
  showCompareUI?: boolean;
  onEnterCompareMode?: () => void;
  onExitCompareMode?: () => void;
  onOpenCompare?: () => void;
  /** Rendered at the top of the scroll (e.g. mode selector + filters); scrolls with content. */
  renderScrollHeader?: () => React.ReactNode;
};

export default function AnalyticsPage({
  mode: modeProp,
  onModeChange,
  period: periodProp,
  onPeriodChange,
  matchCount: matchCountProp,
  onMatchCountChange,
  selectedCompareIds: selectedCompareIdsProp,
  onSelectedCompareIdsChange,
  onSwitchToHistory,
  showCompareUI = false,
  onEnterCompareMode,
  onExitCompareMode,
  onOpenCompare,
  renderScrollHeader,
}: AnalyticsPageProps = {}) {
  const insets = useSafeAreaInsets();
  const [modeInternal, setModeInternal] = useState<StatMode>('single');
  const [periodInternal, setPeriodInternal] = useState<string>('365d');
  const [matchCountInternal, setMatchCountInternal] = useState(10);

  const mode = modeProp ?? modeInternal;
  const setMode = onModeChange ?? setModeInternal;
  const period = periodProp ?? periodInternal;
  const setPeriod = onPeriodChange ?? setPeriodInternal;
  const matchCount = matchCountProp ?? matchCountInternal;
  const setMatchCount = onMatchCountChange ?? setMatchCountInternal;

  const [history, setHistory] = useState<MatchHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [selectedCompareIdsInternal, setSelectedCompareIdsInternal] = useState<string[]>([]);
  const selectedCompareIds = selectedCompareIdsProp ?? selectedCompareIdsInternal;
  const setSelectedCompareIds = onSelectedCompareIdsChange ?? setSelectedCompareIdsInternal;
  const [compareData, setCompareData] = useState<{ match: Match; stats: Stats; kpis: MatchKPI; label: string }[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);

  const [periodData, setPeriodData] = useState<AnalyticsData | null>(null);
  const [periodLoading, setPeriodLoading] = useState(false);

  const [lastNData, setLastNData] = useState<AnalyticsData | null>(null);
  const [lastNLoading, setLastNLoading] = useState(false);

  const lastNMatchList = useMemo(() => {
    const sorted = [...history].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return sorted.slice(0, matchCount);
  }, [history, matchCount]);

  useEffect(() => {
    listMatchHistory()
      .then(list => setHistory(list.filter(m => m.status === 'completed')))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    if (mode !== 'period') return;
    setPeriodLoading(true);
    getAnalyticsData(period)
      .then(setPeriodData)
      .catch(() => setPeriodData(null))
      .finally(() => setPeriodLoading(false));
  }, [mode, period]);

  useEffect(() => {
    if (mode !== 'lastN') return;
    setLastNLoading(true);
    getAnalyticsData('all', matchCount)
      .then(setLastNData)
      .catch(() => setLastNData(null))
      .finally(() => setLastNLoading(false));
  }, [mode, matchCount]);

  useEffect(() => {
    if (selectedCompareIds.length < 2) {
      setCompareData([]);
      return;
    }
    setCompareLoading(true);
    Promise.all(
      selectedCompareIds.map(id =>
        Promise.all([getMatch(id), getStats(id)]).then(([match, stats]) => ({
          match,
          stats,
          kpis: statsToMatchKPIs(match, stats),
          label: `${new Date(match.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} vs ${[match.oppPlayer1, match.oppPlayer2].filter(Boolean).join(' / ')}`,
        }))
      )
    )
      .then(setCompareData)
      .catch(() => setCompareData([]))
      .finally(() => setCompareLoading(false));
  }, [selectedCompareIds.join(',')]);

  const toggleCompareSelection = (id: string) => {
    hapticLight();
    setSelectedCompareIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length >= COMPARE_MATCH_COUNT
        ? prev
        : [...prev, id]
    );
  };

  const clearCompareAndGoToHistory = () => {
    hapticLight();
    setSelectedCompareIds([]);
    onSwitchToHistory?.();
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 72, gap: 32 }}
    >
      {renderScrollHeader?.()}
      {mode === 'single' && (
        <HistoryPage
          showCompareUI={showCompareUI}
          onEnterCompareMode={onEnterCompareMode}
          onExitCompareMode={onExitCompareMode}
          selectedCompareIds={selectedCompareIds}
          onSelectedCompareIdsChange={onSelectedCompareIdsChange}
          onOpenCompare={onOpenCompare}
        />
      )}

      {mode === 'period' && (
        <>
          {periodLoading ? (
            <AnalyticsContentSkeleton />
          ) : !periodData ? (
            <Text className="text-gray-400 text-center py-8">Could not load analytics data.</Text>
          ) : (
            <>
              <KeyStatisticsBlock kpis={periodData.kpis} perMatchTrends={periodData.perMatchTrends} />
            </>
          )}
        </>
      )}

      {mode === 'lastN' && (
        <>
          {selectedCompareIds.length === COMPARE_MATCH_COUNT ? (
            <>
              {onSwitchToHistory && (
                <TouchableOpacity
                  onPress={clearCompareAndGoToHistory}
                  className="self-start flex-row items-center gap-2 px-4 py-2 rounded-lg bg-white/10 mb-4"
                  activeOpacity={0.7}
                >
                  <Feather name="arrow-left" size={16} color="#ffffff" />
                  <Text className="text-sm font-medium text-white">Change selection</Text>
                </TouchableOpacity>
              )}
              {compareLoading && (
                <CompareTableSkeleton />
              )}
              {!compareLoading && compareData.length > 0 && (
                <View className="p-6 rounded-2xl bg-white/5 border border-white/10">
                  <Text className="text-2xl font-bold text-white mb-4">Comparison</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
                    <View>
                      <View className="flex-row border-b border-white/10 pb-2 mb-2">
                        <View style={{ width: 120 }} />
                        {compareData.map((d, i) => (
                          <View key={i} style={{ width: 100 }} className="px-1">
                            <Text className="text-xs text-gray-400 text-center" numberOfLines={2}>
                              {d.label}
                            </Text>
                          </View>
                        ))}
                      </View>
                      {COMPARE_STAT_ROWS.map(({ key, label }) => (
                        <View key={key} className="flex-row items-center border-b border-white/5 py-2">
                          <Text className="text-sm text-gray-300" style={{ width: 120 }} numberOfLines={1}>
                            {label}
                          </Text>
                          {compareData.map((d, i) => (
                            <View key={i} style={{ width: 100 }} className="px-1">
                              <Text className="text-sm text-white text-center">
                                {typeof d.kpis[key] === 'number' ? d.kpis[key] : (d.kpis[key] as string) || '-'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
            </>
          ) : (
            <>
              {lastNLoading ? (
                <AnalyticsContentSkeleton />
              ) : !lastNData ? (
                <Text className="text-gray-400 text-center py-8">Could not load analytics data.</Text>
              ) : (
                <>
                  <KeyStatisticsBlock kpis={lastNData.kpis} perMatchTrends={lastNData.perMatchTrends} />
                </>
              )}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}
