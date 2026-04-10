import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTheme } from '../theme';
import type { ThemeColors } from '../theme/colors';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight } from '../utils/haptics';
import { hasValidTaskIso, parseTaskDateTime } from '../utils/taskDateTime';
import type { BoardCardData, BoardColumnData, TaskMember } from '../types/board';

const EDGE_PAD = Platform.select({ web: 24, default: 16 }) ?? 16;
const HEADER_H = 44;
const TIMELINE_TRAIL_PAD = 44;
const TOOLBAR_H = 52;
const ROW_MIN_H = 80;
const LANE_H = 44;
const LANE_GAP = 10;
const BAR_H = 36;
const LANE_STEP_X = 9;
const AVATAR = 20;
const ASSIGNEE_MIN_BAR_W = 104;

export type TimelineGranularity = 'week' | 'month' | 'quarter';

type Props = {
  columns: BoardColumnData[];
  bottomClearance: number;
  onOpenTask: (cardId: string) => void;
};

type PlacedBar = {
  card: BoardCardData;
  columnIndex: number;
  cardIndex: number;
  lane: number;
  left: number;
  width: number;
};

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfLocalDay(b).getTime() - startOfLocalDay(a).getTime();
  return Math.max(0, ms / 86400000);
}

function startOfWeekMonday(d: Date): Date {
  const x = startOfLocalDay(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(x, diff);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}

function endOfRangeExclusive(start: Date, g: TimelineGranularity): Date {
  if (g === 'week') return addDays(start, 7);
  if (g === 'month') return addMonths(start, 1);
  return addMonths(start, 3);
}

function normalizePeriodStart(anchor: Date, g: TimelineGranularity): Date {
  if (g === 'week') return startOfWeekMonday(anchor);
  if (g === 'month') return startOfMonth(anchor);
  return startOfQuarter(anchor);
}

function pixelsPerDay(g: TimelineGranularity): number {
  if (g === 'week') return 56;
  if (g === 'month') return 28;
  return 11;
}

function cardVisibleRange(card: BoardCardData): { start: Date; end: Date } | null {
  const hasS = hasValidTaskIso(card.startDate);
  const hasD = hasValidTaskIso(card.dueDate);
  const hasC = hasValidTaskIso(card.createdAtIso);
  if (!hasS && !hasD && !hasC) return null;

  let start: Date;
  let end: Date;

  if (hasS && hasD) {
    start = startOfLocalDay(parseTaskDateTime(card.startDate!));
    end = startOfLocalDay(parseTaskDateTime(card.dueDate!));
    if (end.getTime() < start.getTime()) {
      const t = start;
      start = end;
      end = t;
    }
    end = addDays(end, 1);
  } else if (hasD) {
    start = startOfLocalDay(parseTaskDateTime(card.dueDate!));
    end = addDays(start, 1);
  } else if (hasS) {
    start = startOfLocalDay(parseTaskDateTime(card.startDate!));
    end = addDays(start, 1);
  } else {
    start = startOfLocalDay(parseTaskDateTime(card.createdAtIso!));
    end = addDays(start, 1);
  }
  return { start, end };
}

function monthLabels(rangeStart: Date, rangeEndEx: Date): { label: string; offset: number; width: number }[] {
  const labels: { label: string; offset: number; width: number }[] = [];
  let monthCursor = startOfMonth(rangeStart);
  while (monthCursor < rangeEndEx) {
    const nextMonth = addMonths(monthCursor, 1);
    const segStart = monthCursor < rangeStart ? rangeStart : monthCursor;
    const segEnd = nextMonth > rangeEndEx ? rangeEndEx : nextMonth;
    if (segStart < segEnd) {
      const off = daysBetween(rangeStart, segStart);
      const w = daysBetween(segStart, segEnd);
      if (w > 0) {
        labels.push({
          label: segStart.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
          offset: off,
          width: w,
        });
      }
    }
    monthCursor = nextMonth;
  }
  return labels;
}

function assignLanesVisual(
  items: { key: string; left: number; width: number }[],
  timelineInnerW: number
): Map<string, number> {
  const withBounds = items.map((i) => {
    const dispW = barDisplayWidth(i.left, i.width, timelineInnerW);
    return { key: i.key, left: i.left, right: i.left + dispW };
  });
  withBounds.sort((a, b) => a.left - b.left || a.right - b.right);
  const laneRights: number[] = [];
  const out = new Map<string, number>();
  for (const b of withBounds) {
    let lane = 0;
    while (lane < laneRights.length && laneRights[lane]! > b.left) {
      lane++;
    }
    if (lane === laneRights.length) laneRights.push(b.right);
    else laneRights[lane] = b.right;
    out.set(b.key, lane);
  }
  return out;
}

function barDisplayWidth(left: number, rawWidth: number, timelineInnerW: number): number {
  const minW = 56;
  const maxRight = timelineInnerW - 4;
  const room = maxRight - left;
  if (room <= 0) return 8;
  const desired = Math.max(minW, rawWidth);
  return Math.min(desired, room);
}

function steppedBarLayout(
  lane: number,
  rawLeft: number,
  rawWidth: number,
  timelineInnerW: number
): { left: number; width: number } {
  const maxStep = Math.max(0, rawWidth - 56);
  const step = Math.min(lane * LANE_STEP_X, maxStep);
  const left = rawLeft + step;
  const width = barDisplayWidth(left, rawWidth - step, timelineInnerW);
  return { left, width };
}

function createBoardTimelineStyles(colors: ThemeColors) {
  const screenBg = colors.canvas;
  return StyleSheet.create({
    root: {
      flex: 1,
      minHeight: 0,
      backgroundColor: screenBg,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 10,
      minHeight: TOOLBAR_H,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.timelineLine,
      backgroundColor: screenBg,
    },
    toolbarLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 10,
      flex: 1,
    },
    toolbarYear: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
      marginRight: 4,
    },
    todayBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 4,
      backgroundColor: colors.glassFallbackBg,
      borderWidth: 1,
      borderColor: colors.divider,
    },
    todayBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    navArrows: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    granularity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    granChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      minHeight: 40,
      justifyContent: 'center',
      borderRadius: 4,
      backgroundColor: colors.glassFallbackBg,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    granChipOn: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.boardLink,
    },
    granChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    granChipTextOn: {
      color: colors.boardLink,
    },
    periodTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      paddingVertical: 8,
      backgroundColor: screenBg,
    },
    gridBody: {
      flex: 1,
      minHeight: 0,
      backgroundColor: screenBg,
    },
    gridRow: {
      flex: 1,
      minHeight: 0,
      flexDirection: 'row',
      alignItems: 'stretch',
      backgroundColor: screenBg,
    },
    stickyListColumn: {
      flexShrink: 0,
      alignSelf: 'stretch',
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.calendarGridLine,
      backgroundColor: screenBg,
    },
    listHeaderCell: {
      justifyContent: 'center',
      paddingHorizontal: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.timelineLine,
      backgroundColor: screenBg,
    },
    listHeaderCellText: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    timelineHScroll: {
      flex: 1,
      minWidth: 0,
      backgroundColor: screenBg,
    },
    monthHeader: {
      flexDirection: 'row',
      backgroundColor: screenBg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.timelineLine,
    },
    monthHeaderTrail: {
      width: TIMELINE_TRAIL_PAD,
      backgroundColor: screenBg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.timelineLine,
    },
    trackTrailSpacer: {
      width: TIMELINE_TRAIL_PAD,
      backgroundColor: screenBg,
      alignSelf: 'stretch',
    },
    monthTrack: {
      position: 'relative',
      backgroundColor: screenBg,
    },
    monthLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.5,
      paddingLeft: 6,
    },
    swimlaneTrackOnly: {
      flexDirection: 'row',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.timelineLine,
      backgroundColor: screenBg,
    },
    listLabel: {
      paddingHorizontal: 10,
      paddingVertical: 12,
      justifyContent: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.calendarGridLine,
      backgroundColor: screenBg,
    },
    listLabelText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    listMeta: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 4,
    },
    track: {
      position: 'relative',
      backgroundColor: screenBg,
      overflow: 'hidden',
    },
    gridV: {
      position: 'absolute',
      top: 0,
      width: StyleSheet.hairlineWidth,
      backgroundColor: colors.chartGrid,
    },
    bar: {
      position: 'absolute',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      backgroundColor: colors.cardFace,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.divider,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
      gap: 6,
    },
    barCompact: {
      paddingHorizontal: 6,
      gap: 4,
      borderRadius: 5,
    },
    barTitle: {
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textPrimary,
      minWidth: 0,
    },
    barTitleRoomy: {
      fontSize: 13,
    },
    avatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: screenBg,
    },
    avatarOverlap: {
      marginLeft: -6,
    },
    avatarText: {
      fontSize: 8,
      fontWeight: '700',
      color: colors.textPrimary,
    },
  });
}

type BoardTimelineSheet = ReturnType<typeof createBoardTimelineStyles>;

function AssigneeStack({
  members,
  sheet,
}: {
  members?: TaskMember[];
  sheet: BoardTimelineSheet;
}) {
  if (!members?.length) return null;
  const show = members.slice(0, 3);
  return (
    <View style={sheet.avatarRow}>
      {show.map((m, i) => (
        <View
          key={m.id}
          style={[sheet.avatar, i > 0 && sheet.avatarOverlap]}
          accessibilityLabel={m.name}
        >
          <Text style={sheet.avatarText}>{m.initials}</Text>
        </View>
      ))}
    </View>
  );
}

export function BoardTimelineView({ columns, bottomClearance, onOpenTask }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createBoardTimelineStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width: windowW, height: windowH } = useWindowDimensions();
  const leftVScrollRef = useRef<ScrollView>(null);
  const [gridBodyH, setGridBodyH] = useState(() => Math.max(280, Math.floor(windowH * 0.45)));

  const [granularity, setGranularity] = useState<TimelineGranularity>('month');
  const [periodStart, setPeriodStart] = useState(() =>
    normalizePeriodStart(startOfLocalDay(new Date()), 'month')
  );
  const granularityRef = useRef(granularity);
  granularityRef.current = granularity;

  const leftColW = useMemo(
    () => Math.max(96, Math.min(136, Math.round(windowW * 0.27))),
    [windowW]
  );

  const rangeStart = useMemo(
    () => normalizePeriodStart(periodStart, granularity),
    [periodStart, granularity]
  );
  const rangeEndEx = useMemo(() => endOfRangeExclusive(rangeStart, granularity), [rangeStart, granularity]);

  const { px, totalDays, timelineW } = useMemo(() => {
    const totalD = daysBetween(rangeStart, rangeEndEx);
    let p = pixelsPerDay(granularity);
    const horizReserved = EDGE_PAD * 2 + insets.left + insets.right + leftColW + 8;
    const budget = windowW - horizReserved;
    if (granularity === 'week' && budget > 0 && totalD > 0) {
      const fit = Math.floor((budget - TIMELINE_TRAIL_PAD) / totalD);
      p = Math.min(p, Math.max(30, fit));
    }
    if (granularity === 'month' && budget > 0 && totalD > 0) {
      const minMonthPx = 24;
      p = Math.max(p, minMonthPx);
    }
    if (granularity === 'quarter' && budget > 0 && totalD > 0) {
      const minQ = 9;
      p = Math.max(p, minQ);
    }
    const tw = Math.max(totalD * p, 320);
    return { px: p, totalDays: totalD, timelineW: tw };
  }, [granularity, rangeStart, rangeEndEx, windowW, insets.left, insets.right, leftColW]);

  const timelineContentW = timelineW + TIMELINE_TRAIL_PAD;

  const monthStrip = useMemo(
    () => monthLabels(rangeStart, rangeEndEx),
    [rangeStart, rangeEndEx]
  );

  const rows = useMemo(() => {
    return columns.map((col, columnIndex) => {
      const items: {
        card: BoardCardData;
        cardIndex: number;
        start: Date;
        end: Date;
        left: number;
        width: number;
        key: string;
      }[] = [];

      col.cards.forEach((card, cardIndex) => {
        const span = cardVisibleRange(card);
        if (!span) return;
        const visStart = span.start > rangeStart ? span.start : rangeStart;
        const visEnd = span.end < rangeEndEx ? span.end : rangeEndEx;
        if (visEnd <= rangeStart || visStart >= rangeEndEx) return;

        const leftDays = daysBetween(rangeStart, visStart);
        const widthDays = Math.max(1, daysBetween(visStart, visEnd));
        items.push({
          card,
          cardIndex,
          start: visStart,
          end: visEnd,
          left: leftDays * px,
          width: widthDays * px,
          key: card.id,
        });
      });

      const laneMap = assignLanesVisual(
        items.map((i) => ({ key: i.key, left: i.left, width: i.width })),
        timelineW
      );

      let maxLane = 0;
      laneMap.forEach((l) => {
        if (l > maxLane) maxLane = l;
      });

      const placed: PlacedBar[] = items.map((i) => ({
        card: i.card,
        columnIndex,
        cardIndex: i.cardIndex,
        lane: laneMap.get(i.key) ?? 0,
        left: i.left,
        width: i.width,
      }));

      const rowH = ROW_MIN_H + maxLane * (LANE_H + LANE_GAP);

      return { col, columnIndex, placed, rowH };
    });
  }, [columns, rangeStart, rangeEndEx, px, timelineW]);

  const onGridBodyLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) setGridBodyH(h);
  }, []);

  const onMainVerticalScroll = useCallback((ev: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = ev.nativeEvent.contentOffset.y;
    leftVScrollRef.current?.scrollTo({ y, animated: false });
  }, []);

  const goToday = useCallback(() => {
    hapticLight();
    const t = new Date();
    setPeriodStart(normalizePeriodStart(t, granularity));
  }, [granularity]);

  const goPrev = useCallback(() => {
    hapticLight();
    if (granularity === 'week') setPeriodStart((p) => addDays(normalizePeriodStart(p, 'week'), -7));
    else if (granularity === 'month') setPeriodStart((p) => addMonths(normalizePeriodStart(p, 'month'), -1));
    else setPeriodStart((p) => addMonths(normalizePeriodStart(p, 'quarter'), -3));
  }, [granularity]);

  const goNext = useCallback(() => {
    hapticLight();
    if (granularity === 'week') setPeriodStart((p) => addDays(normalizePeriodStart(p, 'week'), 7));
    else if (granularity === 'month') setPeriodStart((p) => addMonths(normalizePeriodStart(p, 'month'), 1));
    else setPeriodStart((p) => addMonths(normalizePeriodStart(p, 'quarter'), 3));
  }, [granularity]);

  const setGranularityAndNormalize = useCallback((g: TimelineGranularity) => {
    hapticLight();
    const from = granularityRef.current;
    setGranularity(g);
    setPeriodStart((p) => {
      if (g === 'week' && from !== 'week') {
        return normalizePeriodStart(startOfLocalDay(new Date()), 'week');
      }
      return normalizePeriodStart(p, g);
    });
  }, []);

  const title =
    granularity === 'week'
      ? `Week of ${rangeStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
      : granularity === 'month'
        ? rangeStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        : `Q${Math.floor(rangeStart.getMonth() / 3) + 1} ${rangeStart.getFullYear()}`;

  const scrollAreaH = Math.max(160, gridBodyH - HEADER_H);

  return (
    <View style={styles.root}>
      <View style={[styles.toolbar, { paddingHorizontal: EDGE_PAD + insets.left }]}>
        <View style={styles.toolbarLeft}>
          <Text style={styles.toolbarYear}>{rangeStart.getFullYear()}</Text>
          <Pressable onPress={goToday} style={styles.todayBtn} hitSlop={8}>
            <Text style={styles.todayBtnText}>Today</Text>
          </Pressable>
          <View style={styles.navArrows}>
            <Pressable onPress={goPrev} hitSlop={10} accessibilityLabel="Previous period">
              <Feather name="chevron-left" size={22} color={colors.textPrimary} />
            </Pressable>
            <Pressable onPress={goNext} hitSlop={10} accessibilityLabel="Next period">
              <Feather name="chevron-right" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>
        <View style={styles.granularity}>
          {(['week', 'month', 'quarter'] as const).map((g) => (
            <Pressable
              key={g}
              onPress={() => setGranularityAndNormalize(g)}
              style={[styles.granChip, granularity === g && styles.granChipOn]}
            >
              <Text style={[styles.granChipText, granularity === g && styles.granChipTextOn]}>
                {g === 'week' ? 'Week' : g === 'month' ? 'Month' : 'Quarter'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={[styles.periodTitle, { paddingHorizontal: EDGE_PAD + insets.left }]} numberOfLines={1}>
        {title}
      </Text>

      <View
        style={[styles.gridBody, { paddingLeft: EDGE_PAD + insets.left, paddingRight: EDGE_PAD }]}
        onLayout={onGridBodyLayout}
      >
        <View style={styles.gridRow}>
          <View style={[styles.stickyListColumn, { width: leftColW }]}>
            <View style={[styles.listHeaderCell, { height: HEADER_H }]}>
              <Text style={styles.listHeaderCellText}>List</Text>
            </View>
            <ScrollView
              ref={leftVScrollRef}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              style={{ height: scrollAreaH, backgroundColor: colors.canvas }}
              contentContainerStyle={{
                flexGrow: 1,
                minHeight: scrollAreaH,
                backgroundColor: colors.canvas,
                paddingBottom: bottomClearance + 16,
              }}
            >
              {rows.map(({ col, rowH }) => (
                <View key={`lbl-${col.id}`} style={[styles.listLabel, { width: leftColW, minHeight: rowH }]}>
                  <Text style={styles.listLabelText} numberOfLines={2}>
                    {col.title}
                  </Text>
                  <Text style={styles.listMeta}>{col.cards.length} cards</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator
            style={styles.timelineHScroll}
            contentContainerStyle={{
              paddingRight: insets.right + 12,
              flexGrow: 1,
              minHeight: gridBodyH,
            }}
          >
            <View
              style={{
                width: timelineContentW,
                minHeight: gridBodyH,
                backgroundColor: colors.canvas,
              }}
            >
              <View style={[styles.monthHeader, { width: timelineContentW, height: HEADER_H }]}>
                <View style={[styles.monthTrack, { width: timelineW }]}>
                  {monthStrip.map((m, i) => (
                    <View
                      key={`m-${i}-${m.label}`}
                      style={{
                        position: 'absolute',
                        left: m.offset * px,
                        width: m.width * px,
                        height: HEADER_H,
                        justifyContent: 'center',
                        borderLeftWidth: StyleSheet.hairlineWidth,
                        borderLeftColor: 'rgba(0,0,0,0.08)',
                      }}
                    >
                      <Text style={styles.monthLabel}>{m.label}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.monthHeaderTrail} />
              </View>

              <ScrollView
                style={{ height: scrollAreaH, backgroundColor: colors.canvas }}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                scrollEventThrottle={16}
                onScroll={onMainVerticalScroll}
                contentContainerStyle={{
                  flexGrow: 1,
                  minHeight: scrollAreaH,
                  backgroundColor: colors.canvas,
                  paddingBottom: bottomClearance + 16,
                }}
              >
                {rows.map(({ col, placed, rowH }) => (
                  <View key={col.id} style={[styles.swimlaneTrackOnly, { minHeight: rowH, width: timelineContentW }]}>
                    <View style={[styles.track, { width: timelineW, minHeight: rowH }]}>
                      <View style={StyleSheet.absoluteFill} pointerEvents="none">
                        {Array.from({ length: totalDays + 1 }, (_, i) => (
                          <View
                            key={`g-${col.id}-${i}`}
                            style={[
                              styles.gridV,
                              {
                                left: i * px,
                                height: '100%',
                              },
                            ]}
                          />
                        ))}
                      </View>
                      {placed.map((p) => {
                        const { left: barLeft, width: barW } = steppedBarLayout(
                          p.lane,
                          p.left,
                          p.width,
                          timelineW
                        );
                        const showAssignees = barW >= ASSIGNEE_MIN_BAR_W;
                        const compact = barW < 112;
                        return (
                          <Pressable
                            key={p.card.id}
                            onPress={() => {
                              hapticLight();
                              onOpenTask(p.card.id);
                            }}
                            style={[
                              styles.bar,
                              compact && styles.barCompact,
                              {
                                left: barLeft,
                                width: barW,
                                top: 12 + p.lane * (LANE_H + LANE_GAP),
                                height: BAR_H,
                              },
                            ]}
                          >
                            <Text
                              style={[styles.barTitle, barW >= 140 && styles.barTitleRoomy]}
                              numberOfLines={1}
                            >
                              {p.card.title}
                            </Text>
                            {showAssignees ? <AssigneeStack members={p.card.assignees} sheet={styles} /> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                    <View style={styles.trackTrailSpacer} />
                  </View>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
