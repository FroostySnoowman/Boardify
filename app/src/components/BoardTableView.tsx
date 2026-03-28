import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight } from '../utils/haptics';
import type { BoardCardData, BoardColumnData } from '../types/board';

/** Fixed column widths (sum = inner row width). Flex caused header/body drift on device. */
const COL_WIDTHS = {
  check: 52,
  name: 300,
  status: 132,
  labels: 176,
  owner: 64,
  updated: 156,
  time: 132,
} as const;

const TABLE_ROW_PADDING_H = 10;
const TABLE_INNER_WIDTH = Object.values(COL_WIDTHS).reduce((a, b) => a + b, 0);
/** Full table row width including horizontal padding (header + data rows share this). */
const TABLE_MIN_WIDTH = TABLE_INNER_WIDTH + TABLE_ROW_PADDING_H * 2;

/** Offset shadow, matches [BoardColumn.tsx](BoardColumn.tsx) `COLUMN_SHIFT`. */
const TABLE_SHIFT = 5;

const ICON_MUTED = '#666';
const TEXT_PRIMARY = '#0a0a0a';

function formatTrackedTime(card: BoardCardData): string {
  let ms = card.workTimerAccumMs ?? 0;
  if (card.workTimerRunStartedAtMs) {
    ms += Date.now() - card.workTimerRunStartedAtMs;
  }
  for (const e of card.workLog ?? []) {
    ms += e.durationMs;
  }
  if (ms <= 0) return '0m 0s';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/** Light fills + dark text; pill gets black border from `styles.statusPill`. */
function statusPillStyle(columnTitle: string): { bg: string; text: string } {
  const t = columnTitle.toLowerCase();
  if (t.includes('progress')) return { bg: '#fde68a', text: TEXT_PRIMARY };
  if (t.includes('done')) return { bg: '#bbf7d0', text: TEXT_PRIMARY };
  return { bg: '#e5e5e5', text: TEXT_PRIMARY };
}

type Props = {
  columns: BoardColumnData[];
  bottomClearance: number;
  onCardPress: (
    columnIndex: number,
    cardIndex: number,
    layout: { x: number; y: number; width: number; height: number }
  ) => void;
};

export function BoardTableView({ columns, bottomClearance, onCardPress }: Props) {
  const insets = useSafeAreaInsets();
  const rowRefs = useRef<Record<string, View | null>>({});

  const measureOpen = useCallback(
    (key: string, columnIndex: number, cardIndex: number) => {
      hapticLight();
      requestAnimationFrame(() => {
        const el = rowRefs.current[key];
        if (el && 'measureInWindow' in el) {
          (el as View).measureInWindow((x, y, width, height) => {
            onCardPress(columnIndex, cardIndex, {
              x: Math.round(x),
              y: Math.round(y),
              width: Math.round(width || 280),
              height: Math.round(height || 44),
            });
          });
          return;
        }
        onCardPress(columnIndex, cardIndex, {
          x: 24,
          y: 120,
          width: 280,
          height: 48,
        });
      });
    },
    [onCardPress]
  );

  return (
    <ScrollView
      style={[styles.vertScroll, styles.hScrollFill]}
      contentContainerStyle={styles.vertScrollContent}
      showsVerticalScrollIndicator
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={Platform.OS !== 'web'}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.hScrollContent}
      >
        <View style={[styles.tableWrapOuter, { minWidth: TABLE_MIN_WIDTH }]}>
          <View style={styles.tableShadow} pointerEvents="none" />
          <View style={styles.tableFace}>
            <View style={styles.tableHeaderRow}>
              <View style={[styles.thCell, styles.colCheck, styles.colAlignCenter]}>
                <View style={styles.checkboxPlaceholder} />
              </View>
              <View style={[styles.thCell, styles.colName, styles.nameCellHeader]}>
                <Text style={styles.thText} numberOfLines={1}>
                  Name
                </Text>
              </View>
              <View style={[styles.thCell, styles.colStatus, styles.colAlignCenter]}>
                <Text style={styles.thText} numberOfLines={1}>
                  Status
                </Text>
              </View>
              <View style={[styles.thCell, styles.colLabels, styles.colAlignCenter]}>
                <Text style={styles.thText} numberOfLines={1}>
                  Labels
                </Text>
              </View>
              <View style={[styles.thCell, styles.colAssignee, styles.colAlignCenter]}>
                <Text style={styles.thText} numberOfLines={1}>
                  Owner
                </Text>
              </View>
              <View style={[styles.thCell, styles.colUpdated, styles.colAlignCenter]}>
                <Text style={styles.thText} numberOfLines={1}>
                  Last updated
                </Text>
              </View>
              <View style={[styles.thCell, styles.colTime, styles.colAlignCenter]}>
                <Text style={styles.thText} numberOfLines={1}>
                  Time
                </Text>
              </View>
            </View>

            {columns.map((col, colIdx) => (
            <View key={`${col.title}-${colIdx}`} style={styles.group}>
              <View style={styles.groupHeader}>
                <View style={styles.groupAccent} />
                <Text style={styles.groupTitle}>{col.title}</Text>
                <Text style={styles.groupCount}>{col.cards.length}</Text>
              </View>

              {col.cards.map((card, cardIdx) => {
                const key = `${colIdx}-${card.id}`;
                const st = statusPillStyle(col.title);
                const labelsText =
                  card.labels && card.labels.length > 0
                    ? card.labels.map((l) => l.name).join(', ')
                    : '—';
                const owner =
                  card.assignees && card.assignees.length > 0
                    ? card.assignees[0].initials
                    : '—';
                const updated =
                  card.activity && card.activity.length > 0
                    ? card.activity[0].at
                    : card.subtitle ?? '—';

                return (
                  <Pressable
                    key={card.id}
                    onPress={() => measureOpen(key, colIdx, cardIdx)}
                    style={({ pressed }) => [styles.dataRow, pressed && styles.dataRowPressed]}
                  >
                    <View
                      ref={(r) => {
                        rowRefs.current[key] = r;
                      }}
                      collapsable={false}
                      style={styles.dataRowMeasure}
                    >
                      <View style={[styles.td, styles.colCheck, styles.colAlignCenter]}>
                        <View style={styles.checkbox} />
                      </View>
                      <View style={[styles.td, styles.colName, styles.nameCell]}>
                        <View style={styles.nameCellInner}>
                          <Text style={styles.nameText} numberOfLines={2}>
                            {card.title}
                          </Text>
                          <View style={styles.nameIcons}>
                            <Feather name="zap" size={12} color={ICON_MUTED} />
                            <Feather name="message-circle" size={12} color={ICON_MUTED} />
                          </View>
                        </View>
                      </View>
                      <View style={[styles.td, styles.colStatus, styles.colAlignCenter]}>
                        <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                          <Text style={[styles.statusPillText, { color: st.text }]} numberOfLines={1}>
                            {col.title}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.td, styles.colLabels, styles.colAlignCenter]}>
                        <Text style={[styles.dimText, styles.cellTextCentered]} numberOfLines={2}>
                          {labelsText}
                        </Text>
                      </View>
                      <View style={[styles.td, styles.colAssignee, styles.colAlignCenter]}>
                        {owner !== '—' ? (
                          <View style={styles.avatarOrb}>
                            <Text style={styles.avatarOrbText}>{owner}</Text>
                          </View>
                        ) : (
                          <Text style={styles.dimText}>—</Text>
                        )}
                      </View>
                      <View style={[styles.td, styles.colUpdated, styles.colAlignCenter]}>
                        <Text style={[styles.dimText, styles.cellTextCentered]} numberOfLines={1}>
                          {updated}
                        </Text>
                      </View>
                      <View style={[styles.td, styles.colTime, styles.colAlignCenter]}>
                        <View style={styles.timeRow}>
                          <Feather name="play-circle" size={14} color={ICON_MUTED} />
                          <Text style={styles.timeText}>{formatTrackedTime(card)}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            ))}

            <View style={{ height: 24 + bottomClearance + Math.max(insets.bottom, 8) }} />
          </View>
        </View>
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  vertScroll: {
    flex: 1,
  },
  vertScrollContent: {
    flexGrow: 1,
  },
  hScrollFill: {
    flex: 1,
  },
  hScrollContent: {
    paddingHorizontal: Platform.OS === 'web' ? 24 : 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  tableWrapOuter: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginBottom: TABLE_SHIFT,
    marginRight: TABLE_SHIFT,
  },
  tableShadow: {
    position: 'absolute',
    left: TABLE_SHIFT,
    top: TABLE_SHIFT,
    right: -TABLE_SHIFT,
    bottom: -TABLE_SHIFT,
    backgroundColor: '#000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
  },
  tableFace: {
    position: 'relative',
    zIndex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: TABLE_MIN_WIDTH,
    paddingVertical: 12,
    paddingHorizontal: TABLE_ROW_PADDING_H,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#000',
    backgroundColor: '#e8e8e8',
  },
  /** Same box model as `dataRowMeasure` cells — keeps headers on the same grid as rows. */
  thCell: {
    justifyContent: 'center',
    minWidth: 0,
  },
  colAlignCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxPlaceholder: {
    width: 16,
    height: 16,
  },
  thText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    width: '100%',
  },
  colCheck: { width: COL_WIDTHS.check, flexShrink: 0 },
  colName: { width: COL_WIDTHS.name, flexShrink: 0 },
  colStatus: { width: COL_WIDTHS.status, flexShrink: 0 },
  colLabels: { width: COL_WIDTHS.labels, flexShrink: 0 },
  colAssignee: { width: COL_WIDTHS.owner, flexShrink: 0 },
  colUpdated: { width: COL_WIDTHS.updated, flexShrink: 0 },
  colTime: { width: COL_WIDTHS.time, flexShrink: 0 },
  group: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e8e8',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: TABLE_MIN_WIDTH,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f0ebe3',
    gap: 10,
  },
  groupAccent: {
    width: 4,
    alignSelf: 'stretch',
    minHeight: 18,
    borderRadius: 2,
    backgroundColor: '#0a0a0a',
  },
  groupTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  groupCount: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  dataRow: {
    alignSelf: 'stretch',
    width: TABLE_MIN_WIDTH,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e8e8',
    backgroundColor: '#fff',
  },
  dataRowPressed: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  dataRowMeasure: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    width: TABLE_MIN_WIDTH,
    paddingVertical: 10,
    paddingHorizontal: TABLE_ROW_PADDING_H,
  },
  td: {
    justifyContent: 'center',
    minWidth: 0,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#fff',
    flexShrink: 0,
  },
  /** Header “Name” — centered in fixed name column. */
  nameCellHeader: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0,
  },
  nameCell: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0,
  },
  nameCellInner: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    gap: 6,
  },
  nameText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    lineHeight: 18,
    textAlign: 'center',
    width: '100%',
  },
  nameIcons: {
    flexDirection: 'row',
    gap: 6,
    flexShrink: 0,
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: '#000',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dimText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  cellTextCentered: {
    width: '100%',
    textAlign: 'center',
  },
  avatarOrb: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e0e0e0',
    borderWidth: 1,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOrbText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#333',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
    ...Platform.select({
      ios: { fontVariant: ['tabular-nums' as const] },
      default: {},
    }),
  },
});
