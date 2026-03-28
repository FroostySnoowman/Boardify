import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight } from '../utils/haptics';
import { ContextMenu } from './ContextMenu';
import { DraggableTableRow } from './DraggableTableRow';
import { TableRowPlaceholder } from './TableRowPlaceholder';
import type { BoardCardData, BoardColumnData, TaskLabel } from '../types/board';
import {
  computeHoverInsertIndex,
  TABLE_ROW_SLOT_HEIGHT,
} from '../board/boardDragUtils';

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
export const TABLE_MIN_WIDTH = TABLE_INNER_WIDTH + TABLE_ROW_PADDING_H * 2;

/** Offset shadow, matches [BoardColumn.tsx](BoardColumn.tsx) `COLUMN_SHIFT`. */
const TABLE_SHIFT = 5;

/** Horizontal inset so the table + shadow clear the display’s rounded corners. */
const TABLE_EDGE_PADDING_H = Platform.select({ web: 24, default: 26 }) ?? 26;

const ICON_MUTED = '#666';
const TEXT_PRIMARY = '#0a0a0a';

export type TableRowDragState = {
  cardId: string;
  fromCol: number;
  fromIndex: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
};

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

/** Preset labels always available in the table labels menu; merged with labels used on any card. */
const TABLE_LABEL_PRESETS: TaskLabel[] = [
  { id: 'lbl-design', name: 'Design', color: '#F3D9B1' },
  { id: 'lbl-bug', name: 'Bug', color: '#fecaca' },
  { id: 'lbl-feature', name: 'Feature', color: '#a5d6a5' },
  { id: 'lbl-docs', name: 'Docs', color: '#bfdbfe' },
];

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
  /** Start/stop stopwatch for the row’s card (same semantics as task detail). */
  onToggleTableStopwatch?: (cardId: string) => void;
  onMoveCardToColumn?: (cardId: string, fromCol: number, toCol: number) => void;
  onAddCard?: (columnIndex: number) => void;
  onAddList?: () => void;
  onReorderList?: (columnIndex: number, direction: 'left' | 'right') => void;
  onTableRowDrop?: (cardId: string, fromCol: number, toCol: number, insertIndex: number) => void;
  tableRowDragging: TableRowDragState | null;
  onTableRowDragBegin: (state: TableRowDragState) => void;
  onTableRowDragEnd: () => void;
  translateTableRowX: SharedValue<number>;
  translateTableRowY: SharedValue<number>;
  scaleTableRow: SharedValue<number>;
  /** Disable row drag (e.g. card expanded). */
  rowDragEnabled?: boolean;
  /** Toggle task labels from the Labels column context menu. */
  onSetCardLabels?: (cardId: string, labels: TaskLabel[]) => void;
};

export function BoardTableView({
  columns,
  bottomClearance,
  onCardPress,
  onToggleTableStopwatch,
  onMoveCardToColumn,
  onAddCard,
  onAddList,
  onReorderList,
  onTableRowDrop,
  tableRowDragging,
  onTableRowDragBegin,
  onTableRowDragEnd,
  translateTableRowX,
  translateTableRowY,
  scaleTableRow,
  rowDragEnabled = true,
  onSetCardLabels,
}: Props) {
  const insets = useSafeAreaInsets();

  const labelCatalog = useMemo(() => {
    const m = new Map<string, TaskLabel>();
    TABLE_LABEL_PRESETS.forEach((l) => m.set(l.id, l));
    for (const col of columns) {
      for (const c of col.cards) {
        for (const l of c.labels ?? []) {
          m.set(l.id, { ...l });
        }
      }
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [columns]);

  const anyStopwatchRunning = useMemo(
    () => columns.some((col) => col.cards.some((c) => c.workTimerRunStartedAtMs != null)),
    [columns]
  );
  const [, setStopwatchTick] = useState(0);
  useEffect(() => {
    if (!anyStopwatchRunning) return;
    const id = setInterval(() => setStopwatchTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [anyStopwatchRunning]);
  const rowRefs = useRef<Record<string, View | null>>({});
  const vertScrollRef = useRef<ScrollView>(null);
  const groupBodyRefs = useRef<Array<View | null>>([]);
  const groupLayoutCache = useRef<Array<{ x: number; y: number; width: number; height: number } | null>>(
    []
  );

  const [rowDragHover, setRowDragHover] = useState<{ toCol: number; insertIndex: number } | null>(
    null
  );
  const rowDragHoverRef = useRef(rowDragHover);
  rowDragHoverRef.current = rowDragHover;

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

  const measureGroupBodies = useCallback(() => {
    columns.forEach((_, i) => {
      const node = groupBodyRefs.current[i];
      node?.measureInWindow((x, y, w, h) => {
        const arr = groupLayoutCache.current;
        while (arr.length <= i) arr.push(null);
        arr[i] = { x, y, width: w, height: h };
      });
    });
  }, [columns.length]);

  useEffect(() => {
    if (!tableRowDragging) {
      setRowDragHover(null);
      return;
    }
    const t = requestAnimationFrame(() => measureGroupBodies());
    return () => cancelAnimationFrame(t);
  }, [tableRowDragging, measureGroupBodies]);

  const computeRowHover = useCallback(
    (absX: number, absY: number, dragId: string) => {
      let toCol = tableRowDragging?.fromCol ?? 0;
      let insertIndex = tableRowDragging?.fromIndex ?? 0;
      let hit = false;
      for (let i = 0; i < columns.length; i++) {
        const L = groupLayoutCache.current[i];
        if (!L || L.width <= 0 || L.height <= 0) continue;
        if (absX >= L.x && absX <= L.x + L.width && absY >= L.y && absY <= L.y + L.height) {
          toCol = i;
          const localY = absY - L.y;
          const virtualCount = columns[i].cards.filter((c) => c.id !== dragId).length;
          insertIndex = computeHoverInsertIndex(localY, virtualCount, TABLE_ROW_SLOT_HEIGHT);
          hit = true;
          break;
        }
      }
      if (!hit && tableRowDragging) {
        toCol = tableRowDragging.fromCol;
        insertIndex = tableRowDragging.fromIndex;
      }
      setRowDragHover({ toCol, insertIndex });
    },
    [columns, tableRowDragging]
  );

  const handleRowDragBegin = useCallback(
    (args: {
      card: BoardCardData;
      columnIndex: number;
      cardIndex: number;
      measure: (cb: (x: number, y: number, w: number, h: number) => void) => void;
    }) => {
      args.measure((x, y, w, h) => {
        measureGroupBodies();
        const state: TableRowDragState = {
          cardId: args.card.id,
          fromCol: args.columnIndex,
          fromIndex: args.cardIndex,
          startX: x,
          startY: y,
          width: w > 0 ? w : TABLE_MIN_WIDTH,
          height: h > 0 ? h : TABLE_ROW_SLOT_HEIGHT,
        };
        onTableRowDragBegin(state);
        setRowDragHover({ toCol: args.columnIndex, insertIndex: args.cardIndex });
      });
    },
    [measureGroupBodies, onTableRowDragBegin]
  );

  const handleRowDragMove = useCallback(
    (absX: number, absY: number) => {
      if (!tableRowDragging) return;
      computeRowHover(absX, absY, tableRowDragging.cardId);
      requestAnimationFrame(measureGroupBodies);
    },
    [tableRowDragging, computeRowHover, measureGroupBodies]
  );

  const handleRowDragEnd = useCallback(() => {
    const drag = tableRowDragging;
    const hover = rowDragHoverRef.current;
    if (drag && hover && onTableRowDrop) {
      onTableRowDrop(drag.cardId, drag.fromCol, hover.toCol, hover.insertIndex);
    }
    setRowDragHover(null);
    onTableRowDragEnd();
  }, [tableRowDragging, onTableRowDrop, onTableRowDragEnd]);

  const scrollLocked = tableRowDragging != null;

  const buildLabelMenuOptions = useCallback(
    (card: BoardCardData) => {
      if (!onSetCardLabels || labelCatalog.length === 0) return [];
      const current = card.labels ?? [];
      const currentIds = new Set(current.map((l) => l.id));
      const opts = labelCatalog.map((lab) => ({
        label: `${currentIds.has(lab.id) ? '✓ ' : ''}${lab.name}`,
        value: `label-${lab.id}`,
        onPress: () => {
          hapticLight();
          const next = currentIds.has(lab.id)
            ? current.filter((x) => x.id !== lab.id)
            : [...current, lab];
          onSetCardLabels(card.id, next);
        },
      }));
      if (current.length > 0) {
        opts.push({
          label: 'Clear labels',
          value: 'clear-labels',
          onPress: () => {
            hapticLight();
            onSetCardLabels(card.id, []);
          },
        });
      }
      return opts;
    },
    [labelCatalog, onSetCardLabels]
  );

  const renderCells = (
    card: BoardCardData,
    col: BoardColumnData,
    colIdx: number,
    cardIdx: number,
    key: string,
    st: { bg: string; text: string }
  ) => {
    const labelsText =
      card.labels && card.labels.length > 0 ? card.labels.map((l) => l.name).join(', ') : '—';
    const labelMenuOptions = onSetCardLabels ? buildLabelMenuOptions(card) : [];
    const owner =
      card.assignees && card.assignees.length > 0 ? card.assignees[0].initials : '—';
    const updated =
      card.activity && card.activity.length > 0
        ? card.activity[0].at
        : card.subtitle ?? '—';

    const statusOptions = columns
      .map((c, i) => ({ col: c, i }))
      .filter(({ i }) => i !== colIdx)
      .map(({ col: target, i }) => ({
        label: target.title,
        value: `col-${i}`,
        onPress: () => {
          hapticLight();
          onMoveCardToColumn?.(card.id, colIdx, i);
        },
      }));

    return (
      <>
        <Pressable
          style={[styles.td, styles.colCheck, styles.colAlignCenter]}
          onPress={() => measureOpen(key, colIdx, cardIdx)}
        >
          <View style={styles.checkbox} />
        </Pressable>
        <Pressable
          style={[styles.td, styles.colName, styles.nameCell]}
          onPress={() => measureOpen(key, colIdx, cardIdx)}
        >
          <View style={styles.nameCellInner}>
            <Text style={styles.nameText} numberOfLines={2}>
              {card.title}
            </Text>
            <View style={styles.nameIcons}>
              <Feather name="zap" size={12} color={ICON_MUTED} />
              <Feather name="message-circle" size={12} color={ICON_MUTED} />
            </View>
          </View>
        </Pressable>
        <View style={[styles.td, styles.colStatus, styles.colAlignCenter]}>
          <View style={styles.statusCellFrame}>
            {statusOptions.length > 0 ? (
              <ContextMenu
                options={statusOptions}
                hostMatchContents
                iosGlassMenuTrigger={false}
                trigger={
                  <Pressable
                    style={({ pressed }) => [
                      styles.statusPill,
                      { backgroundColor: st.bg },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={[styles.statusPillText, { color: st.text }]} numberOfLines={1}>
                      {col.title}
                    </Text>
                  </Pressable>
                }
              />
            ) : (
              <View style={[styles.statusPill, { backgroundColor: st.bg }]}>
                <Text style={[styles.statusPillText, { color: st.text }]} numberOfLines={1}>
                  {col.title}
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={[styles.td, styles.colLabels, styles.colAlignCenter]}>
          {labelMenuOptions.length > 0 ? (
            <ContextMenu
              options={labelMenuOptions}
              hostMatchContents
              iosGlassMenuTrigger={false}
              trigger={
                <Pressable
                  style={({ pressed }) => [
                    styles.labelsMenuTrigger,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[styles.dimText, styles.cellTextCentered]} numberOfLines={2}>
                    {labelsText}
                  </Text>
                </Pressable>
              }
            />
          ) : (
            <Pressable
              style={styles.labelsMenuTrigger}
              onPress={() => measureOpen(key, colIdx, cardIdx)}
            >
              <Text style={[styles.dimText, styles.cellTextCentered]} numberOfLines={2}>
                {labelsText}
              </Text>
            </Pressable>
          )}
        </View>
        <Pressable
          style={[styles.td, styles.colAssignee, styles.colAlignCenter]}
          onPress={() => measureOpen(key, colIdx, cardIdx)}
        >
          {owner !== '—' ? (
            <View style={styles.avatarOrb}>
              <Text style={styles.avatarOrbText}>{owner}</Text>
            </View>
          ) : (
            <Text style={styles.dimText}>—</Text>
          )}
        </Pressable>
        <Pressable
          style={[styles.td, styles.colUpdated, styles.colAlignCenter]}
          onPress={() => measureOpen(key, colIdx, cardIdx)}
        >
          <Text style={[styles.dimText, styles.cellTextCentered]} numberOfLines={1}>
            {updated}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.td, styles.colTime, styles.colAlignCenter]}
          onPress={() => onToggleTableStopwatch?.(card.id)}
        >
          <View style={styles.timeRow}>
            <Feather
              name={card.workTimerRunStartedAtMs != null ? 'pause-circle' : 'play-circle'}
              size={14}
              color={ICON_MUTED}
            />
            <Text style={styles.timeText}>{formatTrackedTime(card)}</Text>
          </View>
        </Pressable>
      </>
    );
  };

  const listReorderOptions = (colIdx: number) => {
    const opts: { label: string; value: string; onPress: () => void }[] = [];
    if (colIdx > 0) {
      opts.push({
        label: 'Move list left',
        value: 'left',
        onPress: () => {
          hapticLight();
          onReorderList?.(colIdx, 'left');
        },
      });
    }
    if (colIdx < columns.length - 1) {
      opts.push({
        label: 'Move list right',
        value: 'right',
        onPress: () => {
          hapticLight();
          onReorderList?.(colIdx, 'right');
        },
      });
    }
    return opts;
  };

  return (
    <ScrollView
      ref={vertScrollRef}
      style={[styles.vertScroll, styles.hScrollFill]}
      contentContainerStyle={styles.vertScrollContent}
      showsVerticalScrollIndicator
      nestedScrollEnabled
      scrollEnabled={!scrollLocked}
      keyboardShouldPersistTaps="handled"
      onScroll={() => {
        requestAnimationFrame(measureGroupBodies);
      }}
      scrollEventThrottle={32}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        scrollEnabled={!scrollLocked}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.hScrollContent,
          {
            paddingLeft: TABLE_EDGE_PADDING_H + insets.left,
            paddingRight: TABLE_EDGE_PADDING_H + insets.right,
          },
        ]}
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

            {columns.map((col, colIdx) => {
              const reorderOpts = listReorderOptions(colIdx);
              const insertAt =
                tableRowDragging && rowDragHover && rowDragHover.toCol === colIdx
                  ? rowDragHover.insertIndex
                  : -1;
              const dragId = tableRowDragging?.cardId ?? null;

              return (
                <View key={col.id} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <View style={styles.groupAccent} />
                    {reorderOpts.length > 0 ? (
                      <ContextMenu
                        options={reorderOpts}
                        hostMatchContents
                        iosGlassMenuTrigger={false}
                        trigger={
                          <Pressable style={styles.groupTitlePressable} hitSlop={8}>
                            <Text style={styles.groupTitle} numberOfLines={1}>
                              {col.title}
                            </Text>
                          </Pressable>
                        }
                      />
                    ) : (
                      <View style={styles.groupTitlePressable}>
                        <Text style={styles.groupTitle} numberOfLines={1}>
                          {col.title}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.groupCount}>{col.cards.length}</Text>
                    {onAddCard ? (
                      <TouchableOpacity
                        onPress={() => {
                          hapticLight();
                          onAddCard(colIdx);
                        }}
                        hitSlop={10}
                        style={styles.groupAddBtn}
                      >
                        <Feather name="plus" size={20} color="#333" />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View
                    ref={(r) => {
                      groupBodyRefs.current[colIdx] = r;
                    }}
                    collapsable={false}
                    onLayout={() => {
                      requestAnimationFrame(measureGroupBodies);
                    }}
                  >
                    {(() => {
                      const nodes: React.ReactNode[] = [];
                      let virtualIndex = 0;
                      for (let cardIdx = 0; cardIdx < col.cards.length; cardIdx++) {
                        const card = col.cards[cardIdx];
                        const isDragged = dragId === card.id;
                        if (
                          tableRowDragging &&
                          insertAt === virtualIndex &&
                          !isDragged
                        ) {
                          nodes.push(
                            <TableRowPlaceholder
                              key={`ph-${col.id}-${virtualIndex}`}
                              tableWidth={TABLE_MIN_WIDTH}
                            />
                          );
                        }
                        const key = `${colIdx}-${card.id}`;
                        const st = statusPillStyle(col.title);
                        const rowInner = (
                          <View
                            ref={(r) => {
                              rowRefs.current[key] = r;
                            }}
                            collapsable={false}
                            style={styles.dataRowMeasure}
                          >
                            {renderCells(card, col, colIdx, cardIdx, key, st)}
                          </View>
                        );

                        const dragEnabled =
                          !!onTableRowDrop &&
                          rowDragEnabled &&
                          (tableRowDragging === null || tableRowDragging.cardId === card.id);

                        nodes.push(
                          <DraggableTableRow
                            key={card.id}
                            card={card}
                            columnIndex={colIdx}
                            cardIndex={cardIdx}
                            dragEnabled={dragEnabled}
                            translateX={translateTableRowX}
                            translateY={translateTableRowY}
                            scale={scaleTableRow}
                            isDraggingThis={isDragged}
                            onDragBegin={handleRowDragBegin}
                            onDragMove={handleRowDragMove}
                            onDragEnd={handleRowDragEnd}
                          >
                            <View style={styles.dataRow}>{rowInner}</View>
                          </DraggableTableRow>
                        );

                        if (!isDragged) {
                          virtualIndex += 1;
                        }
                      }
                      if (tableRowDragging && insertAt === virtualIndex) {
                        nodes.push(
                          <TableRowPlaceholder
                            key={`ph-tail-${col.id}`}
                            tableWidth={TABLE_MIN_WIDTH}
                          />
                        );
                      }
                      return nodes;
                    })()}
                  </View>
                </View>
              );
            })}

            {onAddList ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  hapticLight();
                  onAddList();
                }}
                style={styles.addListRow}
              >
                <Feather name="plus" size={18} color="#666" />
                <Text style={styles.addListRowText}>Add list</Text>
              </TouchableOpacity>
            ) : null}

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
  thCell: {
    justifyContent: 'center',
    minWidth: 0,
  },
  colAlignCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCellFrame: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelsMenuTrigger: {
    width: '100%',
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
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
  groupTitlePressable: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  groupCount: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  groupAddBtn: {
    padding: 4,
  },
  dataRow: {
    alignSelf: 'stretch',
    width: TABLE_MIN_WIDTH,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e8e8',
    backgroundColor: '#fff',
  },
  dataRowDraggingGhost: {
    opacity: 0.35,
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
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#000',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
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
  addListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: TABLE_MIN_WIDTH,
    alignSelf: 'stretch',
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e8e8e8',
  },
  addListRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
});
