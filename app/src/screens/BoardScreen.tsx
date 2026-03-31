import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  UIManager,
  useWindowDimensions,
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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  cancelAnimation,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { hapticLight } from '../utils/haptics';
import { consumePendingDashboardAddTile } from '../utils/dashboardAddTileNavigation';
import { BoardColumn } from '../components/BoardColumn';
import { BoardColumnPlaceholder } from '../components/BoardColumnPlaceholder';
import { BoardTableView, type TableRowDragState } from '../components/BoardTableView';
import { BoardCalendarView } from '../components/BoardCalendarView';
import { BoardDashboardView } from '../components/dashboard/BoardDashboardView';
import { PromptModal } from '../components/PromptModal';
import {
  BoardCardExpandOverlay,
  type ExpandedCardLayout,
} from '../components/BoardCardExpandOverlay';
import { BoardCard } from '../components/BoardCard';
import type { BoardCardData, BoardColumnData, TaskLabel } from '../types/board';
import type {
  DashboardChartKind,
  DashboardDimension,
  DashboardLineTimeframe,
  DashboardTile,
} from '../types/dashboard';
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

const BOARD_STRIP_COLUMN_WIDTH = 280;

const FOCUS_LIST_CARD_WIDTH_RATIO = 0.86;
const FOCUS_LIST_CAROUSEL_GAP = 12;

const BOARD_STRIP_COL_STRIDE = BOARD_STRIP_COLUMN_WIDTH + 16;

const FOCUS_ZOOM_MS = 520;
/** Exit uses a slightly longer ease-out so the “camera” settles on the board column like normal view. */
const FOCUS_ZOOM_EXIT_MS = 620;
const FOCUS_ZOOM_EASING = Easing.inOut(Easing.quad);
const FOCUS_ZOOM_OUT_EASING = Easing.out(Easing.cubic);
function focusZoomStartScale(cardWidth: number): number {
  const ratio = BOARD_STRIP_COLUMN_WIDTH / cardWidth;
  return Math.max(0.72, Math.min(1.12, ratio));
}

/** Exit zoom target: same physics as enter. If too close to 1, use a visible zoom-out so exit always animates. */
function focusExitZoomTarget(cardWidth: number): number {
  const z = focusZoomStartScale(cardWidth);
  if (Math.abs(z - 1) < 0.06) {
    return 0.88;
  }
  return z;
}

/**
 * Stage-1 scale target for exit.
 * The raw physics target can zoom out too far (hides adjacent lists).
 * Clamp it closer to 1 so adjacent columns remain visible while still feeling like a camera zoom-out.
 */
function focusExitGentleZoomOutTarget(cardWidth: number): number {
  const z = focusExitZoomTarget(cardWidth);
  const blended = z + (1 - z) * 0.5;
  // Keep at least ~0.86 so adjacent columns remain visible, without zooming out too far.
  return Math.max(0.8, Math.min(1, blended));
}

/**
 * Scale at end of exit `withTiming` (before layout returns to default). Raw physics (280/cardWidth)
 * zooms out too far for this shell transform; blend halfway toward 1 and floor so the motion stays
 * gentle while still reading as a zoom-out before the layout swap.
 */
function focusExitAnimationEndScale(cardWidth: number): number {
  const z = focusExitZoomTarget(cardWidth);
  const blended = z + (1 - z) * 0.5;
  // Default (non-focus) layout expects `focusZoom` to be `1`.
  // If we finish exit at < 1, the `boardFocusMode` false effect forces it to 1,
  // producing a visible “pop” at the end.
  // Width/margin shrinking already provides the zoom-out feel.
  return 1;
}

function stripColumnCenterScreenX(scrollX: number, pad: number, idx: number): number {
  return pad + idx * BOARD_STRIP_COL_STRIDE + BOARD_STRIP_COLUMN_WIDTH / 2 - scrollX;
}

function focusColumnCenterScreenX(
  scrollX: number,
  sidePad: number,
  snapInterval: number,
  cardWidth: number,
  idx: number
): number {
  return sidePad + idx * snapInterval + cardWidth / 2 - scrollX;
}

function daysAgoIso(daysAgo: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

const INITIAL_COLUMNS: BoardColumnData[] = [
  {
    id: 'col-todo',
    title: 'To Do',
    cards: [
      {
        id: 'c-0-0',
        title: 'Review design mockups',
        createdAtIso: daysAgoIso(2),
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
      {
        id: 'c-0-1',
        title: 'Sync with backend API',
        createdAtIso: daysAgoIso(6),
        labelColor: '#a5d6a5',
        dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
      },
      {
        id: 'c-0-2',
        title: 'Update onboarding flow',
        createdAtIso: daysAgoIso(11),
        dueDate: new Date(Date.now() + 12 * 86400000).toISOString(),
      },
    ],
  },
  {
    id: 'col-in-progress',
    title: 'In Progress',
    cards: [
      {
        id: 'c-1-0',
        title: 'Board view layout',
        createdAtIso: daysAgoIso(1),
        subtitle: 'You',
        labelColor: '#a5d6a5',
        dueDate: new Date(Date.now() + 10 * 86400000).toISOString(),
      },
      {
        id: 'c-1-1',
        title: 'Card drag-and-drop',
        createdAtIso: daysAgoIso(4),
        labelColor: '#F3D9B1',
        dueDate: new Date(Date.now() + 1 * 86400000).toISOString(),
      },
    ],
  },
  {
    id: 'col-done',
    title: 'Done',
    cards: [
      {
        id: 'c-2-0',
        title: 'Auth & login screen',
        createdAtIso: daysAgoIso(18),
        dueDate: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      { id: 'c-2-1', title: 'Home screen shell', createdAtIso: daysAgoIso(3) },
      { id: 'c-2-2', title: 'Neubrutalist theme', createdAtIso: daysAgoIso(0) },
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
  const { width: screenW, height: screenH } = useWindowDimensions();
  const screenWRef = useRef(screenW);
  screenWRef.current = screenW;
  const [columns, setColumns] = useState<BoardColumnData[]>(INITIAL_COLUMNS);
  const [viewMode, setViewMode] = useState<BoardViewMode>('board');
  const [boardFocusMode, setBoardFocusMode] = useState(false);
  const [focusPageIndex, setFocusPageIndex] = useState(0);
  const prevBoardFocusRef = useRef(false);
  const boardFocusModeRef = useRef(false);
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
  const focusZoom = useSharedValue(1);
  const focusZoomAnchorX = useSharedValue(0);
  const focusZoomAnchorY = useSharedValue(0);
  const focusExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusExitAnimatingRef = useRef(false);
  /** Pending RAF from enter-focus effect; must be cancelled on exit or it can fire withTiming(1) and cancel the exit zoom. */
  const focusEnterRafRef = useRef<number | null>(null);
  /** Exit zoom is scheduled on the next frame so it does not race same-frame cancellations. */
  const focusExitRafRef = useRef<number | null>(null);

  useEffect(() => {
    boardFocusModeRef.current = boardFocusMode;
  }, [boardFocusMode]);

  useEffect(() => {
    setFocusPageIndex((p) => Math.min(p, columns.length));
  }, [columns.length]);

  useEffect(() => {
    if (viewMode !== 'board') {
      if (focusExitTimerRef.current != null) {
        clearTimeout(focusExitTimerRef.current);
        focusExitTimerRef.current = null;
      }
      focusExitAnimatingRef.current = false;
      cancelAnimation(focusZoom);
      focusZoom.value = 1;
      setBoardFocusMode(false);
    }
  }, [viewMode, focusZoom]);

  useEffect(() => {
    return () => {
      if (focusExitTimerRef.current != null) {
        clearTimeout(focusExitTimerRef.current);
        focusExitTimerRef.current = null;
      }
    };
  }, []);

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
    if (boardFocusMode && listDragging != null) {
      setListDragging(null);
      setListHoverInsert(null);
    }
  }, [boardFocusMode, listDragging]);

  useEffect(() => {
    if (viewMode !== 'board') {
      prevBoardFocusRef.current = boardFocusMode;
      return;
    }
    const prev = prevBoardFocusRef.current;
    if (prev !== boardFocusMode) {
      requestAnimationFrame(() => {
        if (boardFocusMode) {
          const colStride = BOARD_STRIP_COL_STRIDE;
          const snap =
            Math.round(screenW * FOCUS_LIST_CARD_WIDTH_RATIO) + FOCUS_LIST_CAROUSEL_GAP;
          const idx = Math.min(
            columns.length,
            Math.max(0, Math.round(horizontalScrollXRef.current / colStride))
          );
          const x = idx * snap;
          horizontalScrollRef.current?.scrollTo({ x, animated: true });
          setFocusPageIndex(idx);
        } else {
          const snap =
            Math.round(screenW * FOCUS_LIST_CARD_WIDTH_RATIO) + FOCUS_LIST_CAROUSEL_GAP;
          const page = Math.min(
            columns.length,
            Math.max(0, Math.round(horizontalScrollXRef.current / snap))
          );
          const x = page * BOARD_STRIP_COL_STRIDE;
          // Snap scroll without a second animation — exit zoom already panned the camera to this column.
          horizontalScrollRef.current?.scrollTo({ x, animated: false });
        }
      });
    }
    prevBoardFocusRef.current = boardFocusMode;
  }, [boardFocusMode, viewMode, columns.length, screenW]);

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
  const [dashboardTiles, setDashboardTiles] = useState<DashboardTile[]>(() => [
    { id: uid('dash'), kind: 'bar', dimension: 'list' },
    { id: uid('dash'), kind: 'bar', dimension: 'due' },
  ]);

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

  const handleCalendarOpenTask = useCallback(
    (
      cardId: string,
      layout?: { x: number; y: number; width: number; height: number }
    ) => {
      for (let i = 0; i < columns.length; i++) {
        const j = columns[i].cards.findIndex((c) => c.id === cardId);
        if (j >= 0) {
          const fallbackW = Math.round(Math.min(screenW * 0.92, 400));
          const fallbackH = 100;
          const nextLayout = layout ?? {
            x: Math.round((screenW - fallbackW) / 2),
            y: Math.round(screenH * 0.52),
            width: fallbackW,
            height: fallbackH,
          };
          setExpanded({
            columnTitle: columns[i].title,
            layout: {
              x: Math.round(nextLayout.x),
              y: Math.round(nextLayout.y),
              width: Math.round(nextLayout.width),
              height: Math.round(nextLayout.height),
            },
            columnIndex: i,
            cardIndex: j,
            cardId,
          });
          return;
        }
      }
    },
    [columns, screenW, screenH]
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
          i === idx
            ? {
                ...c,
                cards: [
                  ...c.cards,
                  { id: uid('c'), title, createdAtIso: new Date().toISOString() },
                ],
              }
            : c
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

  const handleDashboardAddTile = useCallback(
    (
      kind: DashboardChartKind,
      dimension: DashboardDimension,
      lineTimeframe?: DashboardLineTimeframe
    ) => {
      setDashboardTiles((prev) => [
        ...prev,
        {
          id: uid('dash'),
          kind,
          dimension,
          ...(kind === 'line' ? { lineTimeframe: lineTimeframe ?? 'week' } : {}),
        },
      ]);
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      const r = consumePendingDashboardAddTile();
      if (r?.status === 'added') {
        handleDashboardAddTile(r.kind, r.dimension, r.lineTimeframe);
      }
    }, [handleDashboardAddTile])
  );

  const handleDashboardRemoveTile = useCallback((id: string) => {
    setDashboardTiles((prev) => prev.filter((t) => t.id !== id));
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
      if (!boardFocusModeRef.current) {
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

  const boardFocusZoomStyle = useAnimatedStyle(() => {
    const s = focusZoom.value;
    const px = focusZoomAnchorX.value;
    const py = focusZoomAnchorY.value;
    return {
      flex: 1,
      minHeight: 0,
      transform: [
        { translateX: -px },
        { translateY: -py },
        { scale: s },
        { translateX: px },
        { translateY: py },
      ],
    };
  });

  const draggingCard = dragging
    ? columns[dragging.fromCol]?.cards.find((c) => c.id === dragging.cardId)
    : null;

  const draggingListColumn =
    listDragging != null ? columns[listDragging.fromIndex] ?? null : null;

  const columnDragEnabled = expanded == null && dragging == null && !boardFocusMode;

  const focusCarousel = useMemo(() => {
    const cardWidth = Math.round(screenW * FOCUS_LIST_CARD_WIDTH_RATIO);
    const gap = FOCUS_LIST_CAROUSEL_GAP;
    return {
      cardWidth,
      gap,
      snapInterval: cardWidth + gap,
      sidePad: Math.max(0, Math.round((screenW - cardWidth) / 2)),
    };
  }, [screenW]);

  const focusColumnMaxH = Math.min(580, Math.round(screenH * 0.58));
  const focusCardScrollMax = Math.max(300, focusColumnMaxH - 130);

  const finalizeFocusExit = useCallback(() => {
    // #region agent log
    fetch('http://127.0.0.1:7413/ingest/2357af54-9a65-4b9f-ac42-f4147b075378',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'89cad4'},body:JSON.stringify({sessionId:'89cad4',hypothesisId:'H3',location:'BoardScreen.tsx:finalizeFocusExit',message:'instant exit (skip timing)',data:{},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (focusExitRafRef.current != null) {
      cancelAnimationFrame(focusExitRafRef.current);
      focusExitRafRef.current = null;
    }
    if (focusExitTimerRef.current != null) {
      clearTimeout(focusExitTimerRef.current);
      focusExitTimerRef.current = null;
    }
    focusExitAnimatingRef.current = false;
    cancelAnimation(focusZoom);
    cancelAnimation(focusZoomAnchorX);
    cancelAnimation(focusZoomAnchorY);
    focusZoom.value = 1;
    setBoardFocusMode(false);
  }, [focusZoom, focusZoomAnchorX, focusZoomAnchorY]);

  const completeFocusExitAfterAnimation = useCallback(() => {
    // #region agent log
    fetch('http://127.0.0.1:7413/ingest/2357af54-9a65-4b9f-ac42-f4147b075378',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'89cad4'},body:JSON.stringify({sessionId:'89cad4',hypothesisId:'H5',location:'BoardScreen.tsx:completeFocusExitAfterAnimation',message:'state exit after withTiming',data:{},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    focusExitAnimatingRef.current = false;
    setBoardFocusMode(false);
  }, []);

  const logExitTimingFinished = useCallback(
    (finished?: boolean) => {
      const ok = finished === true;
      // #region agent log
      fetch('http://127.0.0.1:7413/ingest/2357af54-9a65-4b9f-ac42-f4147b075378',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'89cad4'},body:JSON.stringify({sessionId:'89cad4',hypothesisId:'H4',location:'BoardScreen.tsx:withTiming exit cb',message:'exit withTiming callback',data:{finished,ok},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      // #region agent log
      fetch('http://127.0.0.1:7413/ingest/2357af54-9a65-4b9f-ac42-f4147b075378',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'89cad4'},body:JSON.stringify({sessionId:'89cad4',hypothesisId:'H4',location:'BoardScreen.tsx:withTiming exit cb snapshot',message:'shared values at exit cb',data:{finished,ok,focusZoom:focusZoom.value,focusZoomAnchorX:focusZoomAnchorX.value,focusZoomAnchorY:focusZoomAnchorY.value},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (ok) {
        completeFocusExitAfterAnimation();
      } else {
        // Animation was cancelled; still leave focus mode so one tap works (ref was stuck true → second tap used finalizeFocusExit).
        finalizeFocusExit();
      }
    },
    [completeFocusExitAfterAnimation, finalizeFocusExit, focusZoom, focusZoomAnchorX, focusZoomAnchorY]
  );

  const handleBoardFocusExpandPress = useCallback(() => {
    if (viewMode !== 'board') return;

    if (!boardFocusMode) {
      if (focusExitTimerRef.current != null) {
        clearTimeout(focusExitTimerRef.current);
        focusExitTimerRef.current = null;
      }
      focusExitAnimatingRef.current = false;
      const pad = isWeb ? 24 : 16;
      const sx = horizontalScrollXRef.current;
      const maxIdx = Math.max(0, columns.length - 1);
      const idx = Math.min(maxIdx, Math.max(0, Math.round(sx / BOARD_STRIP_COL_STRIDE)));
      focusZoomAnchorX.value = stripColumnCenterScreenX(sx, pad, idx);
      focusZoomAnchorY.value = screenH * 0.42;
      setBoardFocusMode(true);
      return;
    }

    if (focusExitAnimatingRef.current) {
      finalizeFocusExit();
      return;
    }

    const sx = horizontalScrollXRef.current;
    const snap = focusCarousel.snapInterval;
    const idx = Math.min(columns.length, Math.max(0, Math.round(sx / snap)));
    const zOut = focusExitGentleZoomOutTarget(focusCarousel.cardWidth);
    const zExitEnd = focusExitAnimationEndScale(focusCarousel.cardWidth);
    if (focusEnterRafRef.current != null) {
      cancelAnimationFrame(focusEnterRafRef.current);
      focusEnterRafRef.current = null;
    }
    if (focusExitRafRef.current != null) {
      cancelAnimationFrame(focusExitRafRef.current);
      focusExitRafRef.current = null;
    }
    const padBoard = isWeb ? 24 : 16;
    const sxBoard = idx * BOARD_STRIP_COL_STRIDE;
    const sxFocus = idx * focusCarousel.snapInterval;
    // #region agent log
    fetch('http://127.0.0.1:7413/ingest/2357af54-9a65-4b9f-ac42-f4147b075378',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'89cad4'},body:JSON.stringify({sessionId:'89cad4',hypothesisId:'H1',location:'BoardScreen.tsx:handleBoardFocusExpandPress exit',message:'scheduled exit RAF',data:{zOut,zExitEnd,cardWidth:focusCarousel.cardWidth,sxBoard,sxFocus:idx*focusCarousel.snapInterval},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    cancelAnimation(focusZoom);
    cancelAnimation(focusZoomAnchorX);
    cancelAnimation(focusZoomAnchorY);
    const anchorEndX = stripColumnCenterScreenX(sxBoard, padBoard, idx);
    const anchorEndY = screenH * 0.44;

    // While exiting, move the horizontal scroll target immediately so adjacent
    // columns are already on-screen during the zoom/shrink. We use animated: false
    // to avoid fighting the camera pan/zoom interpolation.
    // Important: while boardFocusMode is still true, the ScrollView uses focus-mode
    // spacing (`focusCarousel.snapInterval`), not the default stride.
    horizontalScrollRef.current?.scrollTo({ x: sxFocus, animated: false });
    horizontalScrollXRef.current = sxFocus;

    focusExitAnimatingRef.current = true;
    // Switch to default column width immediately.
    // Since `BoardColumn` uses a layout transition, it should shrink smoothly.
    setBoardFocusMode(false);
    focusExitRafRef.current = requestAnimationFrame(() => {
      // #region agent log
      fetch('http://127.0.0.1:7413/ingest/2357af54-9a65-4b9f-ac42-f4147b075378',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'89cad4'},body:JSON.stringify({sessionId:'89cad4',hypothesisId:'H2',location:'BoardScreen.tsx:focusExitRaf',message:'exit RAF callback ran',data:{},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      focusExitRafRef.current = null;
      const sx0 = horizontalScrollXRef.current;
      focusZoomAnchorX.value = focusColumnCenterScreenX(
        sx0,
        focusCarousel.sidePad,
        focusCarousel.snapInterval,
        focusCarousel.cardWidth,
        idx
      );
      focusZoomAnchorY.value = screenH * 0.42;
      focusZoom.value = 1;
      const exitTiming = {
        duration: FOCUS_ZOOM_EXIT_MS,
        easing: FOCUS_ZOOM_OUT_EASING,
      };
      focusZoomAnchorX.value = withTiming(anchorEndX, exitTiming);
      focusZoomAnchorY.value = withTiming(anchorEndY, exitTiming);
      // Smooth “camera” zoom-out + settle to the non-focus scale.
      const zoomOutMs = Math.round(FOCUS_ZOOM_EXIT_MS * 0.65);
      const settleMs = Math.max(1, FOCUS_ZOOM_EXIT_MS - zoomOutMs);
      focusZoom.value = withSequence(
        withTiming(zOut, { duration: zoomOutMs, easing: FOCUS_ZOOM_OUT_EASING }),
        withTiming(zExitEnd, { duration: settleMs, easing: FOCUS_ZOOM_EASING }, (finished) => {
          runOnJS(logExitTimingFinished)(finished);
        })
      );
    });
  }, [
    viewMode,
    boardFocusMode,
    isWeb,
    columns.length,
    focusCarousel.snapInterval,
    focusCarousel.sidePad,
    focusCarousel.cardWidth,
    screenH,
    focusZoom,
    focusZoomAnchorX,
    focusZoomAnchorY,
    finalizeFocusExit,
    completeFocusExitAfterAnimation,
    logExitTimingFinished,
  ]);

  useEffect(() => {
    if (!boardFocusMode) {
      // #region agent log
      fetch('http://127.0.0.1:7413/ingest/2357af54-9a65-4b9f-ac42-f4147b075378',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'89cad4'},body:JSON.stringify({sessionId:'89cad4',hypothesisId:'H1',location:'BoardScreen.tsx:useEffect boardFocusMode false',message:'before cancel exit RAF',data:{focusExitAnimating:focusExitAnimatingRef.current,exitRafScheduled:focusExitRafRef.current!=null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (focusEnterRafRef.current != null) {
        cancelAnimationFrame(focusEnterRafRef.current);
        focusEnterRafRef.current = null;
      }
      // Exit full-screen sets `focusExitAnimatingRef` then schedules `focusExitRafRef` + zoom `withSequence`.
      // Skip resetting zoom / cancelling that RAF here; the `boardFocusMode === true` effect cleanup would otherwise cancel the exit RAF before it runs.
      if (focusExitAnimatingRef.current) {
        return () => {
          if (focusExitRafRef.current != null) {
            cancelAnimationFrame(focusExitRafRef.current);
            focusExitRafRef.current = null;
          }
          cancelAnimation(focusZoom);
          cancelAnimation(focusZoomAnchorX);
          cancelAnimation(focusZoomAnchorY);
          focusZoom.value = 1;
          focusExitAnimatingRef.current = false;
        };
      }
      if (focusExitRafRef.current != null) {
        cancelAnimationFrame(focusExitRafRef.current);
        focusExitRafRef.current = null;
      }
      cancelAnimation(focusZoom);
      cancelAnimation(focusZoomAnchorX);
      cancelAnimation(focusZoomAnchorY);
      focusZoom.value = 1;
      return () => {
        cancelAnimation(focusZoom);
        cancelAnimation(focusZoomAnchorX);
        cancelAnimation(focusZoomAnchorY);
      };
    }
    const cardWidth = Math.round(screenWRef.current * FOCUS_LIST_CARD_WIDTH_RATIO);
    const start = focusZoomStartScale(cardWidth);
    cancelAnimation(focusZoom);
    focusZoom.value = start;
    focusEnterRafRef.current = requestAnimationFrame(() => {
      focusEnterRafRef.current = null;
      focusZoom.value = withTiming(1, {
        duration: FOCUS_ZOOM_MS,
        easing: FOCUS_ZOOM_EASING,
      });
    });
    return () => {
      cancelAnimation(focusZoom);
      if (focusEnterRafRef.current != null) {
        cancelAnimationFrame(focusEnterRafRef.current);
        focusEnterRafRef.current = null;
      }
      if (!focusExitAnimatingRef.current && focusExitRafRef.current != null) {
        cancelAnimationFrame(focusExitRafRef.current);
        focusExitRafRef.current = null;
      }
    };
  }, [boardFocusMode]);

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
      ...glassBottomBar,
      onLayoutMenuSelect: (mode) => {
        const view: BoardViewMode =
          mode === 'list' ? 'table' : mode === 'board' ? 'board' : 'calendar';
        setViewMode(view);
        onBoardViewSelect?.(view);
      },
      showExpandButton: viewMode === 'board',
      expandActive: boardFocusMode,
      onExpandPress: handleBoardFocusExpandPress,
    };
  }, [boardFocusMode, glassBottomBar, handleBoardFocusExpandPress, onBoardViewSelect, viewMode]);

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
        <View style={styles.boardArea}>
          <Animated.View style={[styles.boardColumnsShell, boardFocusZoomStyle]}>
          <GHScrollView
            ref={horizontalScrollRef}
            horizontal
            pagingEnabled={false}
            scrollEnabled={dragging === null && listDragging === null}
            showsHorizontalScrollIndicator={!boardFocusMode}
            snapToInterval={boardFocusMode ? focusCarousel.snapInterval : undefined}
            snapToAlignment={boardFocusMode ? 'start' : undefined}
            decelerationRate={boardFocusMode ? 'fast' : 'normal'}
            disableIntervalMomentum={boardFocusMode ? true : undefined}
            contentContainerStyle={[
              styles.columnsScroll,
              {
                paddingHorizontal: boardFocusMode ? focusCarousel.sidePad : isWeb ? 24 : 16,
                paddingBottom: 24 + insets.bottom + BOARD_GLASS_BOTTOM_BAR_CLEARANCE,
                alignItems: 'flex-start',
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
            onMomentumScrollEnd={(e) => {
              if (!boardFocusMode) return;
              const x = e.nativeEvent.contentOffset.x;
              const snap = focusCarousel.snapInterval;
              setFocusPageIndex(
                Math.min(columns.length, Math.max(0, Math.round(x / snap)))
              );
            }}
          >
          {listDragging
            ? (() => {
                const nodes: React.ReactNode[] = [];
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
                      <View
                        key={col.id}
                        style={[
                          styles.listPageShell,
                          boardFocusMode && styles.focusPageLayout,
                          boardFocusMode && {
                            width: focusCarousel.cardWidth,
                            marginRight: focusCarousel.gap,
                          },
                        ]}
                      >
                        <BoardColumn
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
                          columnWidth={boardFocusMode ? focusCarousel.cardWidth : undefined}
                          columnMaxHeight={boardFocusMode ? focusColumnMaxH : undefined}
                          cardScrollMaxHeight={boardFocusMode ? focusCardScrollMax : undefined}
                        />
                      </View>
                    );
                  }
                }
                return nodes;
              })()
            : columns.map((col, i) => (
                <View
                  key={col.id}
                  style={[
                    styles.listPageShell,
                    boardFocusMode && styles.focusPageLayout,
                    boardFocusMode && {
                      width: focusCarousel.cardWidth,
                      marginRight: focusCarousel.gap,
                    },
                  ]}
                >
                  <BoardColumn
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
                    columnWidth={boardFocusMode ? focusCarousel.cardWidth : undefined}
                    columnMaxHeight={boardFocusMode ? focusColumnMaxH : undefined}
                    cardScrollMaxHeight={boardFocusMode ? focusCardScrollMax : undefined}
                  />
                </View>
              ))}
          <View
            style={[
              styles.listPageShell,
              boardFocusMode && styles.focusPageLayout,
              boardFocusMode && { width: focusCarousel.cardWidth, marginRight: 0 },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => hapticLight()}
              style={[
                styles.addListWrap,
                boardFocusMode && { width: focusCarousel.cardWidth },
                boardFocusMode && styles.addListWrapCentered,
              ]}
            >
              <View style={styles.addListShadow} />
              <View style={styles.addList}>
                <Feather name="plus" size={20} color="#666" />
                <Text style={styles.addListText}>Add list</Text>
              </View>
            </TouchableOpacity>
          </View>
        </GHScrollView>
          </Animated.View>
          {boardFocusMode ? (
            <View style={styles.focusDotsRow} pointerEvents="none">
              {Array.from({ length: columns.length + 1 }, (_, i) => (
                <View
                  key={`dot-${i}`}
                  style={[styles.focusDot, i === focusPageIndex && styles.focusDotActive]}
                />
              ))}
            </View>
          ) : null}
        </View>
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
      ) : viewMode === 'calendar' ? (
        <BoardCalendarView
          columns={columns}
          bottomClearance={BOARD_GLASS_BOTTOM_BAR_CLEARANCE}
          onOpenTask={handleCalendarOpenTask}
        />
      ) : viewMode === 'dashboard' ? (
        <BoardDashboardView
          columns={columns}
          tiles={dashboardTiles}
          bottomClearance={BOARD_GLASS_BOTTOM_BAR_CLEARANCE}
          onRemoveTile={handleDashboardRemoveTile}
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
  boardArea: {
    flex: 1,
    minHeight: 0,
    overflow: 'visible',
  },
  boardColumnsShell: {
    flex: 1,
    minHeight: 0,
    overflow: 'visible',
  },
  listPageShell: {
    flexShrink: 0,
  },
  focusPageLayout: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  columnsScrollView: {
    flexGrow: 1,
    zIndex: 0,
  },
  columnsScroll: {
    paddingBottom: 24,
    alignItems: 'flex-start',
  },
  focusDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    paddingBottom: 6,
    paddingTop: 2,
  },
  focusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#c4c4c4',
  },
  focusDotActive: {
    backgroundColor: '#0a0a0a',
    width: 9,
    height: 9,
    borderRadius: 4,
  },
  addListWrapCentered: {
    alignSelf: 'center',
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
