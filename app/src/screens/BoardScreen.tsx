import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  UIManager,
} from 'react-native';
import { GlassRoundIconButton } from '../components/GlassRoundIconButton';
import { ContextMenu } from '../components/ContextMenu';
import {
  BoardGlassBottomBar,
  BOARD_GLASS_BOTTOM_BAR_CLEARANCE,
  type BoardGlassBottomBarProps,
} from '../components/BoardGlassBottomBar';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, cancelAnimation } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { BoardColumn } from '../components/BoardColumn';
import { BoardColumnPlaceholder } from '../components/BoardColumnPlaceholder';
import { BoardTableView, type TableRowDragState } from '../components/BoardTableView';
import { PromptModal } from '../components/PromptModal';
import {
  BoardCardExpandOverlay,
  type ExpandedCardLayout,
} from '../components/BoardCardExpandOverlay';
import { BoardCard } from '../components/BoardCard';
import type { BoardCardData, BoardColumnData, TaskLabel } from '../types/board';
import {
  BOARD_CARD_ROW_HEIGHT,
  computeColumnHoverInsertIndex,
  computeHoverInsertIndex,
  moveCardToHover,
  reorderColumns,
} from '../board/boardDragUtils';
import { uid } from '../utils/id';
import { toggleStopwatchOnTask } from '../utils/workTime';

const SHIFT = 5;

const INITIAL_COLUMNS: BoardColumnData[] = [
  {
    id: 'col-todo',
    title: 'To Do',
    cards: [
      {
        id: 'c-0-0',
        title: 'Review design mockups',
        subtitle: 'Due soon',
        labelColor: '#F3D9B1',
        description: 'Walk through Figma — focus on nav and empty states.',
        startDate: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
        dueDate: new Date(Date.now() + 3 * 86400000).toISOString(),
        labels: [{ id: 'lp-1', name: 'Design', color: '#F3D9B1' }],
        assignees: [{ id: 'm-1', name: 'Alex Kim', initials: 'AK' }],
        checklists: [
          {
            id: 'cl-1',
            title: 'Before review',
            items: [
              { id: 'i1', text: 'Export PDFs', done: true },
              { id: 'i2', text: 'List open questions', done: false },
            ],
          },
        ],
        attachments: [{ id: 'a1', name: 'Mockups.pdf', subtitle: '2 MB' }],
        activity: [
          { id: 'act1', text: 'Alex moved this card from In progress', at: '2h ago' },
          { id: 'act2', text: 'You created this card', at: 'Yesterday' },
        ],
      },
      { id: 'c-0-1', title: 'Sync with backend API', labelColor: '#a5d6a5' },
      { id: 'c-0-2', title: 'Update onboarding flow' },
    ],
  },
  {
    id: 'col-in-progress',
    title: 'In Progress',
    cards: [
      { id: 'c-1-0', title: 'Board view layout', subtitle: 'You', labelColor: '#a5d6a5' },
      { id: 'c-1-1', title: 'Card drag-and-drop', labelColor: '#F3D9B1' },
    ],
  },
  {
    id: 'col-done',
    title: 'Done',
    cards: [
      { id: 'c-2-0', title: 'Auth & login screen' },
      { id: 'c-2-1', title: 'Home screen shell' },
      { id: 'c-2-2', title: 'Neubrutalist theme' },
    ],
  },
];

type DraggingState = {
  cardId: string;
  fromCol: number;
  fromIndex: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
};

type ListDraggingState = {
  fromIndex: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type BoardViewMode = 'board' | 'table' | 'calendar' | 'dashboard' | 'timeline';

const BOARD_VIEW_MENU_ITEMS: { label: string; value: BoardViewMode }[] = [
  { label: 'Board', value: 'board' },
  { label: 'Table', value: 'table' },
  { label: 'Calendar', value: 'calendar' },
  { label: 'Dashboard', value: 'dashboard' },
  { label: 'Timeline', value: 'timeline' },
];

interface BoardScreenProps {
  boardName?: string;
  onBack?: () => void;
  onBoardViewSelect?: (mode: BoardViewMode) => void;
  glassBottomBar?: BoardGlassBottomBarProps;
}

export default function BoardScreen({
  boardName = 'My Board',
  onBack,
  onBoardViewSelect,
  glassBottomBar,
}: BoardScreenProps) {
  const insets = useSafeAreaInsets();
  const [columns, setColumns] = useState<BoardColumnData[]>(INITIAL_COLUMNS);
  const [viewMode, setViewMode] = useState<BoardViewMode>('board');
  const [expanded, setExpanded] = useState<ExpandedCardLayout | null>(null);
  const [dragging, setDragging] = useState<DraggingState | null>(null);
  const [hoverTarget, setHoverTarget] = useState<{ col: number; insertIndex: number } | null>(null);
  const [listDragging, setListDragging] = useState<ListDraggingState | null>(null);
  const [listHoverInsert, setListHoverInsert] = useState<number | null>(null);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const translateListX = useSharedValue(0);
  const translateListY = useSharedValue(0);
  const scaleList = useSharedValue(1);
  const translateTableRowX = useSharedValue(0);
  const translateTableRowY = useSharedValue(0);
  const scaleTableRow = useSharedValue(1);

  const columnLayoutsRef = useRef<Array<{ x: number; y: number; width: number; height: number } | null>>([]);
  const columnScrollYRef = useRef<number[]>([]);
  const horizontalScrollXRef = useRef(0);
  const lastAbsRef = useRef({ x: 0, y: 0 });
  type GHScrollViewRef = React.ElementRef<typeof GHScrollView>;
  const horizontalScrollRef = useRef<GHScrollViewRef | null>(null);
  const columnScrollRefs = useRef<(GHScrollViewRef | null)[]>([]);
  const measureFnsRef = useRef<Record<number, () => void>>({});
  const draggingRef = useRef<DraggingState | null>(null);
  const hoverRef = useRef<{ col: number; insertIndex: number } | null>(null);
  const pendingHoverRef = useRef<{ col: number; insertIndex: number } | null>(null);
  const hoverRafRef = useRef<number | null>(null);
  const listDraggingRef = useRef<ListDraggingState | null>(null);
  const listHoverInsertRef = useRef<number | null>(null);
  const columnWrapLayoutsRef = useRef<Array<{ x: number; width: number } | null>>([]);

  const flushHoverRaf = useCallback(() => {
    hoverRafRef.current = null;
    const n = pendingHoverRef.current;
    if (n == null) return;
    setHoverTarget((prev) => {
      if (prev != null && prev.col === n.col && prev.insertIndex === n.insertIndex) {
        return prev;
      }
      return n;
    });
  }, []);

  const scheduleHoverFlush = useCallback(() => {
    if (hoverRafRef.current != null) return;
    hoverRafRef.current = requestAnimationFrame(flushHoverRaf);
  }, [flushHoverRaf]);

  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);
  useEffect(() => {
    hoverRef.current = hoverTarget;
  }, [hoverTarget]);

  useEffect(() => {
    listDraggingRef.current = listDragging;
  }, [listDragging]);

  useEffect(() => {
    listHoverInsertRef.current = listHoverInsert;
  }, [listHoverInsert]);

  useEffect(() => {
    return () => {
      if (hoverRafRef.current != null) {
        cancelAnimationFrame(hoverRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (dragging != null) return;
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    cancelAnimation(scale);
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
  }, [dragging, translateX, translateY, scale]);

  useEffect(() => {
    if (listDragging != null) return;
    cancelAnimation(translateListX);
    cancelAnimation(translateListY);
    cancelAnimation(scaleList);
    translateListX.value = 0;
    translateListY.value = 0;
    scaleList.value = 1;
  }, [listDragging, translateListX, translateListY, scaleList]);

  const [tableRowDragging, setTableRowDragging] = useState<TableRowDragState | null>(null);
  const [promptAddCardCol, setPromptAddCardCol] = useState<number | null>(null);
  const [promptAddList, setPromptAddList] = useState(false);

  useEffect(() => {
    if (tableRowDragging != null) return;
    cancelAnimation(translateTableRowX);
    cancelAnimation(translateTableRowY);
    cancelAnimation(scaleTableRow);
    translateTableRowX.value = 0;
    translateTableRowY.value = 0;
    scaleTableRow.value = 1;
  }, [tableRowDragging, translateTableRowX, translateTableRowY, scaleTableRow]);

  const noopAddCard = useCallback(() => {}, []);

  const handleUpdateExpandedCard = useCallback(
    (next: BoardCardData) => {
      if (!expanded) return;
      const id = expanded.cardId;
      setColumns((prev) =>
        prev.map((col) => ({
          ...col,
          cards: col.cards.map((c) => (c.id === id ? next : c)),
        }))
      );
    },
    [expanded]
  );

  const columnScrollRefSetters = useMemo(
    () =>
      columns.map(
        (_, i) => (ref: GHScrollViewRef | null) => {
          columnScrollRefs.current[i] = ref;
        }
      ),
    [columns.length]
  );

  const isWeb = Platform.OS === 'web';

  const openCardAt = useCallback(
    (
      columnIndex: number,
      cardIndex: number,
      layout: { x: number; y: number; width: number; height: number }
    ) => {
      const col = columns[columnIndex];
      const card = col?.cards[cardIndex];
      if (!col || !card) return;
      setExpanded({
        columnTitle: col.title,
        layout: {
          x: Math.round(layout.x),
          y: Math.round(layout.y),
          width: Math.round(layout.width),
          height: Math.round(layout.height),
        },
        columnIndex,
        cardIndex,
        cardId: card.id,
      });
    },
    [columns]
  );

  const handleCardPress = useCallback(
    (
      columnIndex: number,
      cardIndex: number,
      layout: { x: number; y: number; width: number; height: number }
    ) => {
      openCardAt(columnIndex, cardIndex, layout);
    },
    [openCardAt]
  );

  const expandedCardId = expanded?.cardId ?? null;

  const expandedCardResolved = useMemo(() => {
    if (!expanded) return null;
    for (let i = 0; i < columns.length; i++) {
      const j = columns[i].cards.findIndex((c) => c.id === expanded.cardId);
      if (j >= 0) {
        return { columnIndex: i, cardIndex: j, card: columns[i].cards[j] };
      }
    }
    return null;
  }, [columns, expanded]);

  useEffect(() => {
    if (expanded && expandedCardResolved == null) {
      setExpanded(null);
    }
  }, [expanded, expandedCardResolved]);

  const handleTableMoveCardToColumn = useCallback(
    (cardId: string, fromCol: number, toCol: number) => {
      setColumns((prev) => {
        const len = prev[toCol]?.cards.length ?? 0;
        return moveCardToHover(prev, cardId, fromCol, toCol, len);
      });
    },
    []
  );

  const handleTableRowDrop = useCallback(
    (cardId: string, fromCol: number, toCol: number, insertIndex: number) => {
      setColumns((prev) => moveCardToHover(prev, cardId, fromCol, toCol, insertIndex));
    },
    []
  );

  const onTableRowDragBegin = useCallback((s: TableRowDragState) => {
    setTableRowDragging(s);
  }, []);

  const onTableRowDragEnd = useCallback(() => {
    setTableRowDragging(null);
  }, []);

  const handleTableReorderList = useCallback(
    (columnIndex: number, direction: 'left' | 'right') => {
      setColumns((prev) => {
        if (direction === 'left') {
          if (columnIndex <= 0) return prev;
          return reorderColumns(prev, columnIndex, columnIndex - 1);
        }
        if (columnIndex >= prev.length - 1) return prev;
        return reorderColumns(prev, columnIndex, columnIndex + 2);
      });
    },
    []
  );

  const handleAddCardSubmit = useCallback(
    (title: string) => {
      setColumns((prev) => {
        const idx = promptAddCardCol;
        if (idx == null) return prev;
        return prev.map((c, i) =>
          i === idx ? { ...c, cards: [...c.cards, { id: uid('c'), title }] } : c
        );
      });
    },
    [promptAddCardCol]
  );

  const handleAddListSubmit = useCallback((title: string) => {
    setColumns((prev) => [...prev, { id: uid('col'), title, cards: [] }]);
  }, []);

  const handleTableToggleStopwatch = useCallback((cardId: string) => {
    hapticLight();
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        cards: col.cards.map((c) => (c.id === cardId ? toggleStopwatchOnTask(c) : c)),
      }))
    );
  }, []);

  const handleSetTableCardLabels = useCallback((cardId: string, labels: TaskLabel[]) => {
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        cards: col.cards.map((c) =>
          c.id === cardId ? { ...c, labels: labels.length > 0 ? labels : undefined } : c
        ),
      }))
    );
  }, []);

  const tableRowOverlayStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateTableRowX.value },
      { translateY: translateTableRowY.value },
      { scale: scaleTableRow.value },
    ],
  }));

  const draggingTableRowCard =
    tableRowDragging != null
      ? columns[tableRowDragging.fromCol]?.cards.find((c) => c.id === tableRowDragging.cardId)
      : null;

  const registerColumnMeasure = useCallback((colIndex: number, fn: () => void) => {
    measureFnsRef.current[colIndex] = fn;
  }, []);

  const unregisterColumnMeasure = useCallback((colIndex: number) => {
    delete measureFnsRef.current[colIndex];
  }, []);

  const remeasureAllColumns = useCallback(() => {
    Object.values(measureFnsRef.current).forEach((fn) => fn());
  }, []);

  const onListLayout = useCallback(
    (colIndex: number, rect: { x: number; y: number; width: number; height: number }) => {
      columnLayoutsRef.current[colIndex] = rect;
    },
    []
  );

  const onColumnWrapLayout = useCallback(
    (colIndex: number, rect: { x: number; y: number; width: number; height: number }) => {
      const arr = columnWrapLayoutsRef.current;
      while (arr.length <= colIndex) {
        arr.push(null);
      }
      arr[colIndex] = { x: rect.x, width: rect.width };
    },
    []
  );

  const onColumnScroll = useCallback((colIndex: number, scrollY: number) => {
    columnScrollYRef.current[colIndex] = scrollY;
  }, []);

  const computeHover = useCallback(
    (absX: number, absY: number) => {
      const layouts = columnLayoutsRef.current;
      const scrollYs = columnScrollYRef.current;
      const dragId = draggingRef.current?.cardId;
      for (let i = 0; i < columns.length; i++) {
        const L = layouts[i];
        if (!L) continue;
        if (absX >= L.x && absX <= L.x + L.width && absY >= L.y && absY <= L.y + L.height) {
          const scrollY = scrollYs[i] ?? 0;
          const localY = absY - L.y + scrollY;
          const virtualCount = columns[i].cards.filter((c) => c.id !== dragId).length;
          const insertIndex = computeHoverInsertIndex(localY, virtualCount);
          return { col: i, insertIndex };
        }
      }
      return null;
    },
    [columns]
  );

  const onDragMove = useCallback(
    (absX: number, absY: number) => {
      lastAbsRef.current = { x: absX, y: absY };
      const next = computeHover(absX, absY);
      if (next != null) {
        pendingHoverRef.current = next;
        scheduleHoverFlush();
      }
    },
    [computeHover, scheduleHoverFlush]
  );

  const onDragBegin = useCallback(
    (args: {
      card: BoardCardData;
      columnIndex: number;
      cardIndex: number;
      measure: (cb: (x: number, y: number, w: number, h: number) => void) => void;
    }) => {
      args.measure((x, y, w, h) => {
        const next: DraggingState = {
          cardId: args.card.id,
          fromCol: args.columnIndex,
          fromIndex: args.cardIndex,
          startX: x,
          startY: y,
          width: w > 0 ? w : 260,
          height: h > 0 ? h : BOARD_CARD_ROW_HEIGHT,
        };
        draggingRef.current = next;
        setDragging(next);
        setHoverTarget({ col: args.columnIndex, insertIndex: args.cardIndex });
      });
    },
    []
  );

  const onDragEnd = useCallback(() => {
    if (hoverRafRef.current != null) {
      cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
    pendingHoverRef.current = null;
    const d = draggingRef.current;
    const h = hoverRef.current;
    if (d && h) {
      setColumns((prev) => moveCardToHover(prev, d.cardId, d.fromCol, h.col, h.insertIndex));
    }
    draggingRef.current = null;
    setDragging(null);
    setHoverTarget(null);
  }, []);

  const onColumnListDragBegin = useCallback(
    (args: {
      columnIndex: number;
      measure: (cb: (x: number, y: number, w: number, h: number) => void) => void;
    }) => {
      args.measure((x, y, w, h) => {
        const next: ListDraggingState = {
          fromIndex: args.columnIndex,
          startX: x,
          startY: y,
          width: w > 0 ? w : 260,
          height: h > 0 ? h : 48,
        };
        listDraggingRef.current = next;
        setListDragging(next);
        setListHoverInsert(args.columnIndex);
      });
    },
    []
  );

  const onColumnListDragMove = useCallback((absX: number, absY: number) => {
    lastAbsRef.current = { x: absX, y: absY };
    const from = listDraggingRef.current?.fromIndex ?? null;
    const next = computeColumnHoverInsertIndex(
      absX,
      columnWrapLayoutsRef.current,
      columns.length,
      from
    );
    setListHoverInsert(next);
  }, [columns.length]);

  const onColumnListDragEnd = useCallback(() => {
    const d = listDraggingRef.current;
    const insert = listHoverInsertRef.current;
    if (d != null && insert != null) {
      setColumns((prev) => reorderColumns(prev, d.fromIndex, insert));
    }
    listDraggingRef.current = null;
    setListDragging(null);
    setListHoverInsert(null);
  }, []);

  useEffect(() => {
    if (!dragging && !listDragging) return;
    const EDGE = 56;
    const SPEED = 5;
    const id = setInterval(() => {
      const { x, y } = lastAbsRef.current;
      const { width: sw, height: sh } = Dimensions.get('window');
      if (x < EDGE) {
        horizontalScrollRef.current?.scrollTo({
          x: Math.max(0, horizontalScrollXRef.current - SPEED),
          animated: false,
        });
        requestAnimationFrame(remeasureAllColumns);
      } else if (x > sw - EDGE) {
        horizontalScrollRef.current?.scrollTo({
          x: horizontalScrollXRef.current + SPEED,
          animated: false,
        });
        requestAnimationFrame(remeasureAllColumns);
      }
      for (let ci = 0; ci < columns.length; ci++) {
        const L = columnLayoutsRef.current[ci];
        if (!L) continue;
        if (x >= L.x && x <= L.x + L.width && y >= L.y && y <= L.y + L.height) {
          const sy = columnScrollYRef.current[ci] ?? 0;
          const scrollRef = columnScrollRefs.current[ci];
          if (y < L.y + EDGE) {
            scrollRef?.scrollTo({ y: Math.max(0, sy - SPEED), animated: false });
          } else if (y > L.y + L.height - EDGE) {
            scrollRef?.scrollTo({ y: sy + SPEED, animated: false });
          }
        }
      }
    }, 16);
    return () => clearInterval(id);
  }, [dragging, listDragging, columns.length, remeasureAllColumns]);

  const overlayStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const listOverlayStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateListX.value },
      { translateY: translateListY.value },
      { scale: scaleList.value },
    ],
  }));

  const draggingCard = dragging
    ? columns[dragging.fromCol]?.cards.find((c) => c.id === dragging.cardId)
    : null;

  const draggingListColumn =
    listDragging != null ? columns[listDragging.fromIndex] ?? null : null;

  const columnDragEnabled = expanded == null && dragging == null;

  const boardViewMenuOptions = useMemo(
    () =>
      BOARD_VIEW_MENU_ITEMS.map(({ label, value }) => ({
        label: viewMode === value ? `✓ ${label}` : label,
        value,
        onPress: () => {
          hapticLight();
          setViewMode(value);
          onBoardViewSelect?.(value);
        },
      })),
    [onBoardViewSelect, viewMode]
  );

  const boardGlassBottomBarProps = useMemo((): BoardGlassBottomBarProps => {
    return {
      onLayoutMenuSelect: (mode) => {
        const view: BoardViewMode =
          mode === 'list' ? 'table' : mode === 'board' ? 'board' : 'calendar';
        setViewMode(view);
        onBoardViewSelect?.(view);
      },
      ...glassBottomBar,
    };
  }, [glassBottomBar, onBoardViewSelect]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          {onBack ? (
            <GlassRoundIconButton
              icon="arrow-left"
              size={22}
              accessibilityLabel="Go back"
              onPress={() => {
                hapticLight();
                onBack();
              }}
            />
          ) : (
            <View style={styles.headerSideSpacer} />
          )}
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {boardName}
        </Text>
        <View style={[styles.headerSide, styles.headerSideEnd]}>
          <ContextMenu
            options={boardViewMenuOptions}
            hostMatchContents
            trigger={
              <GlassRoundIconButton
                icon="filter"
                size={23}
                accessibilityLabel="Board view"
                embedInSwiftMenu
                onPress={() => {}}
              />
            }
            triggerWrapperStyle={styles.headerFilterMenuTrigger}
          />
        </View>
      </View>

      {viewMode === 'board' ? (
        <GHScrollView
          ref={horizontalScrollRef}
          horizontal
          scrollEnabled={dragging === null && listDragging === null}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.columnsScroll,
            {
              paddingHorizontal: isWeb ? 24 : 16,
              paddingBottom: 24 + insets.bottom + BOARD_GLASS_BOTTOM_BAR_CLEARANCE,
            },
          ]}
          style={styles.columnsScrollView}
          nestedScrollEnabled
          scrollEventThrottle={16}
          // @ts-expect-error RN ScrollView iOS prop; RNGH typings omit it
          delayContentTouches={false}
          onScroll={(e) => {
            horizontalScrollXRef.current = e.nativeEvent.contentOffset.x;
            requestAnimationFrame(remeasureAllColumns);
          }}
        >
          {listDragging
            ? (() => {
                const nodes: React.ReactNode[] = [];
                /** Global “insert before column i” (0..n); must match `computeColumnHoverInsertIndex` / `reorderColumns`. */
                const insertAt = listHoverInsert ?? 0;
                const n = columns.length;
                for (let i = 0; i <= n; i++) {
                  if (insertAt === i) {
                    nodes.push(<BoardColumnPlaceholder key={`col-gap-${i}`} />);
                  }
                  if (i < n) {
                    const col = columns[i];
                    const isBeingDragged = listDragging.fromIndex === i;
                    nodes.push(
                      <BoardColumn
                        key={col.id}
                        columnIndex={i}
                        title={col.title}
                        cards={col.cards}
                        onAddCard={noopAddCard}
                        expandedCardId={expandedCardId}
                        onCardPress={handleCardPress}
                        draggingCardId={dragging?.cardId ?? null}
                        hoverInsertIndex={hoverTarget?.col === i ? hoverTarget.insertIndex : -1}
                        onListLayout={onListLayout}
                        onColumnScroll={onColumnScroll}
                        translateX={translateX}
                        translateY={translateY}
                        scale={scale}
                        onDragBegin={onDragBegin}
                        onDragMove={onDragMove}
                        onDragEnd={onDragEnd}
                        onScrollViewRef={columnScrollRefSetters[i]}
                        registerColumnMeasure={registerColumnMeasure}
                        unregisterColumnMeasure={unregisterColumnMeasure}
                        listScrollEnabled={dragging === null && listDragging === null}
                        listDraggingActive={listDragging !== null}
                        isDraggingThisColumn={isBeingDragged}
                        columnDragEnabled={columnDragEnabled}
                        translateListX={translateListX}
                        translateListY={translateListY}
                        scaleList={scaleList}
                        onColumnListDragBegin={onColumnListDragBegin}
                        onColumnListDragMove={onColumnListDragMove}
                        onColumnListDragEnd={onColumnListDragEnd}
                        onColumnWrapLayout={onColumnWrapLayout}
                      />
                    );
                  }
                }
                return nodes;
              })()
            : columns.map((col, i) => (
                <BoardColumn
                  key={col.id}
                  columnIndex={i}
                  title={col.title}
                  cards={col.cards}
                  onAddCard={noopAddCard}
                  expandedCardId={expandedCardId}
                  onCardPress={handleCardPress}
                  draggingCardId={dragging?.cardId ?? null}
                  hoverInsertIndex={hoverTarget?.col === i ? hoverTarget.insertIndex : -1}
                  onListLayout={onListLayout}
                  onColumnScroll={onColumnScroll}
                  translateX={translateX}
                  translateY={translateY}
                  scale={scale}
                  onDragBegin={onDragBegin}
                  onDragMove={onDragMove}
                  onDragEnd={onDragEnd}
                  onScrollViewRef={columnScrollRefSetters[i]}
                  registerColumnMeasure={registerColumnMeasure}
                  unregisterColumnMeasure={unregisterColumnMeasure}
                  listScrollEnabled={dragging === null && listDragging === null}
                  listDraggingActive={false}
                  isDraggingThisColumn={false}
                  columnDragEnabled={columnDragEnabled}
                  translateListX={translateListX}
                  translateListY={translateListY}
                  scaleList={scaleList}
                  onColumnListDragBegin={onColumnListDragBegin}
                  onColumnListDragMove={onColumnListDragMove}
                  onColumnListDragEnd={onColumnListDragEnd}
                  onColumnWrapLayout={onColumnWrapLayout}
                />
              ))}
          <TouchableOpacity activeOpacity={0.8} onPress={() => hapticLight()} style={styles.addListWrap}>
            <View style={styles.addListShadow} />
            <View style={styles.addList}>
              <Feather name="plus" size={20} color="#666" />
              <Text style={styles.addListText}>Add list</Text>
            </View>
          </TouchableOpacity>
        </GHScrollView>
      ) : viewMode === 'table' ? (
        <BoardTableView
          columns={columns}
          bottomClearance={BOARD_GLASS_BOTTOM_BAR_CLEARANCE}
          onCardPress={openCardAt}
          onToggleTableStopwatch={handleTableToggleStopwatch}
          onMoveCardToColumn={handleTableMoveCardToColumn}
          onAddCard={(colIdx) => setPromptAddCardCol(colIdx)}
          onAddList={() => setPromptAddList(true)}
          onReorderList={handleTableReorderList}
          onTableRowDrop={handleTableRowDrop}
          tableRowDragging={tableRowDragging}
          onTableRowDragBegin={onTableRowDragBegin}
          onTableRowDragEnd={onTableRowDragEnd}
          translateTableRowX={translateTableRowX}
          translateTableRowY={translateTableRowY}
          scaleTableRow={scaleTableRow}
          rowDragEnabled={expanded == null}
          onSetCardLabels={handleSetTableCardLabels}
        />
      ) : (
        <View style={styles.viewPlaceholder}>
          <Text style={styles.viewPlaceholderTitle}>
            {BOARD_VIEW_MENU_ITEMS.find((x) => x.value === viewMode)?.label ?? 'View'}
          </Text>
          <Text style={styles.viewPlaceholderHint}>This workspace view is coming soon.</Text>
        </View>
      )}

      {viewMode === 'board' && dragging && draggingCard ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: dragging.startX,
                top: dragging.startY,
                width: dragging.width,
                zIndex: 10000,
                elevation: 28,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
              },
              overlayStyle,
            ]}
          >
            <BoardCard
              title={draggingCard.title}
              subtitle={draggingCard.subtitle}
              labelColor={draggingCard.labelColor}
              suppressPress
            />
          </Animated.View>
        </View>
      ) : null}

      {viewMode === 'board' && listDragging && draggingListColumn ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: listDragging.startX,
                top: listDragging.startY,
                width: listDragging.width,
                minHeight: listDragging.height,
                zIndex: 9999,
                elevation: 26,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.22,
                shadowRadius: 14,
              },
              listOverlayStyle,
            ]}
          >
            <View style={styles.listDragOverlayInner}>
              <Text style={styles.listDragOverlayTitle} numberOfLines={1}>
                {draggingListColumn.title}
              </Text>
              <Text style={styles.listDragOverlayCount}>{draggingListColumn.cards.length}</Text>
            </View>
          </Animated.View>
        </View>
      ) : null}

      <BoardGlassBottomBar {...boardGlassBottomBarProps} />

      {viewMode === 'table' && tableRowDragging && draggingTableRowCard ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: tableRowDragging.startX,
                top: tableRowDragging.startY,
                width: tableRowDragging.width,
                zIndex: 9998,
                elevation: 24,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
              },
              tableRowOverlayStyle,
            ]}
          >
            <View style={styles.tableRowDragOverlayInner}>
              <Text style={styles.tableRowDragTitle} numberOfLines={1}>
                {draggingTableRowCard.title}
              </Text>
              <Text style={styles.tableRowDragSub} numberOfLines={1}>
                {columns[tableRowDragging.fromCol]?.title ?? ''}
              </Text>
            </View>
          </Animated.View>
        </View>
      ) : null}

      <PromptModal
        visible={promptAddCardCol != null}
        title="New task"
        placeholder="Task title"
        confirmLabel="Add task"
        onCancel={() => setPromptAddCardCol(null)}
        onSubmit={handleAddCardSubmit}
      />
      <PromptModal
        visible={promptAddList}
        title="New list"
        placeholder="List name"
        confirmLabel="Add list"
        onCancel={() => setPromptAddList(false)}
        onSubmit={handleAddListSubmit}
      />

      {expanded && expandedCardResolved ? (
        <BoardCardExpandOverlay
          layoutInfo={expanded}
          card={expandedCardResolved.card}
          onUpdateCard={handleUpdateExpandedCard}
          onClose={() => setExpanded(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f0e8',
    overflow: 'visible',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 20,
    backgroundColor: '#f5f0e8',
    overflow: 'visible',
  },
  headerSide: {
    width: 45,
    alignItems: 'flex-start',
    overflow: 'visible',
    zIndex: 2,
  },
  headerSideEnd: {
    alignItems: 'flex-end',
  },
  headerFilterMenuTrigger: {
    width: 45,
    alignSelf: 'flex-end',
  },
  headerSideSpacer: {
    width: 45,
    height: 45,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: '#0a0a0a',
    textAlign: 'center',
    minWidth: 0,
    paddingHorizontal: 8,
  },
  columnsScrollView: {
    flexGrow: 1,
    zIndex: 0,
  },
  columnsScroll: {
    paddingBottom: 24,
    alignItems: 'flex-start',
  },
  addListWrap: {
    position: 'relative',
    width: 280,
    flexShrink: 0,
    marginLeft: 0,
  },
  addListShadow: {
    position: 'absolute',
    left: SHIFT,
    top: SHIFT,
    right: -SHIFT,
    bottom: -SHIFT,
    backgroundColor: '#000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
  },
  addList: {
    position: 'relative',
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e8e8e8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 20,
    paddingHorizontal: 24,
    minHeight: 120,
  },
  addListText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  viewPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: BOARD_GLASS_BOTTOM_BAR_CLEARANCE + 24,
  },
  viewPlaceholderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0a0a0a',
    marginBottom: 8,
  },
  viewPlaceholderHint: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  listDragOverlayInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#e8e8e8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  listDragOverlayTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  listDragOverlayCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  tableRowDragOverlayInner: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableRowDragTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  tableRowDragSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginTop: 4,
  },
});
