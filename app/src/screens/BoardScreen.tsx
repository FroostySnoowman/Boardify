import React, { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  Dimensions,
  UIManager,
  useWindowDimensions,
  Keyboard,
  DeviceEventEmitter,
} from 'react-native';
import { GlassRoundIconButton } from '../components/GlassRoundIconButton';
import { ContextMenu } from '../components/ContextMenu';
import {
  BoardGlassBottomBar,
  BOARD_GLASS_BOTTOM_BAR_CLEARANCE,
  BOARD_GLASS_FOCUS_DOTS_BASE_CLEARANCE,
  type BoardGlassBottomBarProps,
} from '../components/BoardGlassBottomBar';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  cancelAnimation,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
  LinearTransition,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { consumePendingDashboardAddTile } from '../utils/dashboardAddTileNavigation';
import { BoardColumn } from '../components/BoardColumn';
import { BoardColumnPlaceholder } from '../components/BoardColumnPlaceholder';
import { BoardTableView, type TableRowDragState } from '../components/BoardTableView';
import { BoardCalendarView } from '../components/BoardCalendarView';
import { BoardTimelineView } from '../components/BoardTimelineView';
import { BoardDashboardView } from '../components/dashboard/BoardDashboardView';
import { PromptModal } from '../components/PromptModal';
import {
  BoardCardExpandOverlay,
  type ExpandedCardLayout,
} from '../components/BoardCardExpandOverlay';
import { BoardCard } from '../components/BoardCard';
import type { BoardCardData, BoardColumnData, BoardViewMode, TaskLabel, TaskMember } from '../types/board';
import {
  mergeBoardSettingsFromRemoteJson,
  resolveBoardDisplayTitle,
} from '../storage/boardSettings';
import { useBoardRemoteState } from '../hooks/useBoardRemoteState';
import {
  createCard,
  createList,
  patchCard,
  runBoardAiPrioritization,
  runBoardAiNextTask,
  runBoardAiListInsights,
  listBoardMembers,
  getDashboardTiles,
  putDashboardTiles,
} from '../api/boards';
import {
  boardCardToPatchBody,
  apiRecordToBoardCard,
  apiTileToDashboardTile,
  dashboardTilesToApiPut,
} from '../api/boardMappers';
import type {
  DashboardChartKind,
  DashboardDimension,
  DashboardLineTimeframe,
  DashboardTile,
} from '../types/dashboard';
import { BOARD_DROP_ZONE_CARD_RADIUS } from '../board/boardDropZoneStyles';
import { useTheme } from '../theme';
import type { ThemeColors } from '../theme/colors';
import { BOARD_PENDING_RESTORE_EVENT, type BoardPendingRestorePayload } from '../board/boardRestoreEvents';
import {
  BOARD_AI_APPLY_ORDER_EVENT,
  BOARD_AI_OPEN_CARD_EVENT,
  type BoardAiApplyOrderPayload,
  type BoardAiOpenCardPayload,
} from '../board/boardAiEvents';
import { useBoardWebSocket } from '../hooks/useBoardWebSocket';
import {
  BOARD_CARD_ROW_HEIGHT,
  computeColumnHoverInsertIndex,
  computeHoverInsertIndex,
  moveCardToHover,
  removeCardFromBoard,
  removeColumnAtIndex,
  reorderColumns,
} from '../board/boardDragUtils';
import { uid } from '../utils/id';
import { toggleStopwatchOnTask } from '../utils/workTime';
import { BoardScreenSkeleton } from '../components/skeletons';

export type { BoardViewMode } from '../types/board';

const SHIFT = 5;

const ADD_LIST_MORPH_LAYOUT = LinearTransition.duration(280).easing(Easing.out(Easing.cubic));

const BOARD_STRIP_COLUMN_WIDTH = 280;

const FOCUS_LIST_CARD_WIDTH_RATIO = 0.86;
const FOCUS_LIST_CAROUSEL_GAP = 12;
const FOCUS_PAGE_DOT_SLOTS = 10;

function focusPagerDotVisual(
  slotIndex: number,
  visibleDotCount: number,
  isActive: boolean
): { diameter: number; opacity: number } {
  if (isActive) {
    return { diameter: 12, opacity: 1 };
  }
  const tail = visibleDotCount === FOCUS_PAGE_DOT_SLOTS && slotIndex >= 7;
  if (!tail) {
    return { diameter: 7, opacity: 0.48 };
  }
  const tailStep = slotIndex - 7;
  return {
    diameter: Math.max(3, Math.round(7 * (1 - tailStep * 0.3))),
    opacity: Math.max(0.16, 0.4 - tailStep * 0.12),
  };
}

const BOARD_STRIP_COL_STRIDE = BOARD_STRIP_COLUMN_WIDTH + 16;

const FOCUS_ZOOM_EXIT_MS = 680;
const FOCUS_EXIT_EASING = Easing.bezier(0.25, 0.1, 0.25, 1);

const BOARD_HEADER_ROW_HEIGHT = 69;

function boardGlassBarNoopAction() {}

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

type AiRecommendation = {
  cardId: string | null;
  reason: string;
  subtasks: string[];
};

type AiInsights = {
  summary: string;
  wins: string[];
  risks: string[];
  suggestions: string[];
};

function cloneBoardColumns(columns: BoardColumnData[]): BoardColumnData[] {
  return columns.map((col) => ({ ...col, cards: [...col.cards] }));
}

function reorderColumnsByAiOrder(columns: BoardColumnData[], order: string[]): BoardColumnData[] {
  if (order.length === 0) return columns;
  const rank = new Map<string, number>();
  order.forEach((id, idx) => rank.set(id, idx));
  return columns.map((col) => {
    const cards = [...col.cards];
    cards.sort((a, b) => {
      const ra = rank.get(a.id);
      const rb = rank.get(b.id);
      if (ra == null && rb == null) return 0;
      if (ra == null) return 1;
      if (rb == null) return -1;
      return ra - rb;
    });
    return { ...col, cards };
  });
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BOARD_VIEW_MENU_ITEMS: { label: string; value: BoardViewMode }[] = [
  { label: 'Board', value: 'board' },
  { label: 'Table', value: 'table' },
  { label: 'Calendar', value: 'calendar' },
  { label: 'Dashboard', value: 'dashboard' },
  { label: 'Timeline', value: 'timeline' },
];

interface BoardScreenProps {
  boardId: string;
  boardName?: string;
  onBack?: () => void;
  onBoardViewSelect?: (mode: BoardViewMode) => void;
  onOpenBoardSettings?: () => void;
  onOpenBoardNotifications?: () => void;
  glassBottomBar?: Partial<BoardGlassBottomBarProps>;
}

export default function BoardScreen({
  boardId,
  boardName = 'My Board',
  onBack,
  onBoardViewSelect,
  onOpenBoardSettings,
  onOpenBoardNotifications,
  glassBottomBar,
}: BoardScreenProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createBoardScreenStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const screenWRef = useRef(screenW);
  screenWRef.current = screenW;

  const {
    columns,
    setColumns,
    boardRow,
    loading: boardLoading,
    error: boardError,
    refresh,
    persistListReorder,
    persistCardMove,
    persistCardOrderInList,
    persistArchiveCard,
    persistArchiveList,
  } = useBoardRemoteState(boardId);

  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  useBoardWebSocket(boardId, refresh);
  const expandedBaselineJsonRef = useRef<string | null>(null);
  const prevExpandedCardIdRef = useRef<string | null>(null);
  const [viewMode, setViewMode] = useState<BoardViewMode>('board');
  const [boardFocusMode, setBoardFocusMode] = useState(false);
  const [displayBoardTitle, setDisplayBoardTitle] = useState(boardName);
  const [availableMembers, setAvailableMembers] = useState<TaskMember[]>([]);
  const cardTaxonomy = useMemo(
    () => mergeBoardSettingsFromRemoteJson(boardRow?.settings_json),
    [boardRow?.settings_json]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { members } = await listBoardMembers(boardId);
        if (cancelled) return;
        const mapped = (members ?? []).map((m) => {
          const fallbackName = m.email.split('@')[0] || 'Member';
          const name = (m.username?.trim() || fallbackName).trim();
          const initialsSource = name.replace(/[^A-Za-z0-9 ]/g, ' ').trim();
          const parts = initialsSource.split(/\s+/).filter(Boolean);
          const initials = (
            (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')
          )
            .toUpperCase()
            .slice(0, 2) || 'U';
          return { id: String(m.userId), name, initials };
        });
        setAvailableMembers(mapped);
      } catch {
        if (!cancelled) setAvailableMembers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  useEffect(() => {
    if (!boardRow) {
      setDisplayBoardTitle(boardName);
      return;
    }
    const s = mergeBoardSettingsFromRemoteJson(boardRow.settings_json);
    setDisplayBoardTitle(resolveBoardDisplayTitle(boardName, s));
    if (s.defaultView) setViewMode(s.defaultView);
  }, [boardRow, boardName]);

  useFocusEffect(
    useCallback(() => {
      if (!boardRow) return;
      const s = mergeBoardSettingsFromRemoteJson(boardRow.settings_json);
      setDisplayBoardTitle(resolveBoardDisplayTitle(boardName, s));
    }, [boardRow, boardName])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(BOARD_PENDING_RESTORE_EVENT, (payload: unknown) => {
      const bid =
        typeof payload === 'object' &&
        payload &&
        'boardId' in payload &&
        typeof (payload as BoardPendingRestorePayload).boardId === 'string'
          ? (payload as BoardPendingRestorePayload).boardId
          : null;
      if (bid === boardId) void refresh();
    });
    return () => sub.remove();
  }, [boardId, refresh]);
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
  const pendingTableAddListRef = useRef(false);
  const inlineAddListInputRef = useRef<TextInput | null>(null);
  const focusZoom = useSharedValue(1);
  const focusZoomAnchorX = useSharedValue(0);
  const focusZoomAnchorY = useSharedValue(0);
  const focusExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusExitAnimatingRef = useRef(false);
  const [focusExitAnimationBusy, setFocusExitAnimationBusy] = useState(false);
  const focusEnterColumnIdxRef = useRef<number | null>(null);
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
      setFocusExitAnimationBusy(false);
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
  const columnWrapLayoutsRef = useRef<
    Array<{ x: number; y: number; width: number; height: number } | null>
  >([]);
  const dragOverArchiveRef = useRef(false);
  const dragOverArchivePrevRef = useRef(false);
  const [dragOverArchive, setDragOverArchive] = useState(false);

  const flushHoverRaf = useCallback(() => {
    hoverRafRef.current = null;
    const n = pendingHoverRef.current;
    if (n == null) {
      setHoverTarget((prev) => (prev != null ? null : prev));
      return;
    }
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
  const [inlineAddListOpen, setInlineAddListOpen] = useState(false);
  const [inlineAddListDraft, setInlineAddListDraft] = useState('');
  const [dashboardTiles, setDashboardTiles] = useState<DashboardTile[]>([]);
  const [dashboardTilesSynced, setDashboardTilesSynced] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiBusyAction, setAiBusyAction] = useState<null | 'prioritize' | 'next' | 'insights'>(null);
  const [aiMenuListId, setAiMenuListId] = useState<string | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState<AiRecommendation | null>(null);
  const [aiInsights, setAiInsights] = useState<AiInsights | null>(null);
  const [aiSnapshot, setAiSnapshot] = useState<BoardColumnData[] | null>(null);
  const [aiChangeLabel, setAiChangeLabel] = useState('');
  const [aiReorderNotes, setAiReorderNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!boardId) return;
    let cancelled = false;
    setDashboardTilesSynced(false);
    getDashboardTiles(boardId)
      .then(({ tiles }) => {
        if (cancelled) return;
        const mapped = (tiles ?? []).map((t) => apiTileToDashboardTile(t));
        setDashboardTiles(mapped);
        setDashboardTilesSynced(true);
      })
      .catch(() => {
        if (!cancelled) setDashboardTilesSynced(false);
      });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const dashDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!boardId || !dashboardTilesSynced) return;
    if (dashDebounceRef.current) clearTimeout(dashDebounceRef.current);
    dashDebounceRef.current = setTimeout(() => {
      dashDebounceRef.current = null;
      void putDashboardTiles(boardId, dashboardTilesToApiPut(dashboardTiles));
    }, 500);
    return () => {
      if (dashDebounceRef.current) clearTimeout(dashDebounceRef.current);
    };
  }, [boardId, dashboardTiles, dashboardTilesSynced]);

  useEffect(() => {
    if (tableRowDragging != null) return;
    cancelAnimation(translateTableRowX);
    cancelAnimation(translateTableRowY);
    cancelAnimation(scaleTableRow);
    translateTableRowX.value = 0;
    translateTableRowY.value = 0;
    scaleTableRow.value = 1;
  }, [tableRowDragging, translateTableRowX, translateTableRowY, scaleTableRow]);

  const [addCardComposerCol, setAddCardComposerCol] = useState<number | null>(null);
  const [addCardComposerDraft, setAddCardComposerDraft] = useState('');

  const closeAddCardComposer = useCallback(() => {
    setAddCardComposerCol(null);
    setAddCardComposerDraft('');
  }, []);

  const openAddCardComposer = useCallback((colIndex: number) => {
    hapticLight();
    setAddCardComposerCol(colIndex);
    setAddCardComposerDraft('');
  }, []);

  const submitAddCardComposer = useCallback(() => {
    const title = addCardComposerDraft.trim();
    const col = addCardComposerCol;
    if (!title || col == null) return;
    hapticLight();
    const listId = columnsRef.current[col]?.id;
    if (!listId) return;
    void (async () => {
      try {
        const { card } = await createCard(listId, {
          title,
          createdAtIso: new Date().toISOString(),
        });
        if (card) {
          const bc = apiRecordToBoardCard(card);
          setColumns((prev) =>
            prev.map((c, i) => (i === col ? { ...c, cards: [...c.cards, bc] } : c))
          );
        } else {
          await refresh();
        }
      } catch {
        await refresh();
      }
    })();
    closeAddCardComposer();
  }, [addCardComposerDraft, addCardComposerCol, closeAddCardComposer, refresh, setColumns]);

  const openInlineAddList = useCallback(() => {
    setInlineAddListOpen(true);
    setInlineAddListDraft('');
    setTimeout(() => inlineAddListInputRef.current?.focus(), 100);
  }, []);

  const cancelInlineAddList = useCallback(() => {
    hapticLight();
    Keyboard.dismiss();
    setInlineAddListOpen(false);
    setInlineAddListDraft('');
  }, []);

  const commitInlineAddList = useCallback(() => {
    const title = inlineAddListDraft.trim();
    if (!title) return;
    hapticLight();
    Keyboard.dismiss();
    void (async () => {
      try {
        const { list } = await createList(boardId, { title });
        const id = String((list as { id?: string }).id ?? '');
        if (!id) {
          await refresh();
          return;
        }
        setColumns((prev) => [...prev, { id, title, cards: [] }]);
      } catch {
        await refresh();
      }
    })();
    setInlineAddListOpen(false);
    setInlineAddListDraft('');
    setTimeout(() => {
      horizontalScrollRef.current?.scrollToEnd({ animated: true });
    }, 300);
  }, [boardId, inlineAddListDraft, refresh, setColumns]);

  useEffect(() => {
    if (viewMode !== 'board' || !pendingTableAddListRef.current) return;
    pendingTableAddListRef.current = false;
    const id = setTimeout(() => openInlineAddList(), 80);
    return () => clearTimeout(id);
  }, [viewMode, openInlineAddList]);

  useEffect(() => {
    if (viewMode !== 'board' && inlineAddListOpen) {
      setInlineAddListOpen(false);
      setInlineAddListDraft('');
      Keyboard.dismiss();
    }
  }, [viewMode, inlineAddListOpen]);

  useEffect(() => {
    if (expanded != null) closeAddCardComposer();
  }, [expanded, closeAddCardComposer]);

  useEffect(() => {
    if (dragging != null) closeAddCardComposer();
  }, [dragging, closeAddCardComposer]);

  useEffect(() => {
    if (listDragging != null) closeAddCardComposer();
  }, [listDragging, closeAddCardComposer]);

  useEffect(() => {
    if (expanded != null && inlineAddListOpen) {
      setInlineAddListOpen(false);
      setInlineAddListDraft('');
      Keyboard.dismiss();
    }
  }, [expanded, inlineAddListOpen]);

  useEffect(() => {
    if ((dragging != null || listDragging != null) && inlineAddListOpen) {
      setInlineAddListOpen(false);
      setInlineAddListDraft('');
      Keyboard.dismiss();
    }
  }, [dragging, listDragging, inlineAddListOpen]);

  const [cardSearchOpen, setCardSearchOpen] = useState(false);
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  const cardSearchInputRef = useRef<TextInput | null>(null);

  const closeCardSearch = useCallback(() => {
    setCardSearchOpen(false);
    setCardSearchQuery('');
    Keyboard.dismiss();
  }, []);

  const openCardSearch = useCallback(() => {
    setCardSearchOpen(true);
  }, []);

  useEffect(() => {
    if (expanded != null) closeCardSearch();
  }, [expanded, closeCardSearch]);

  useEffect(() => {
    if (dragging != null) closeCardSearch();
  }, [dragging, closeCardSearch]);

  useEffect(() => {
    if (listDragging != null) closeCardSearch();
  }, [listDragging, closeCardSearch]);

  useEffect(() => {
    if (viewMode !== 'board') closeCardSearch();
  }, [viewMode, closeCardSearch]);

  useEffect(() => {
    if (!cardSearchOpen) return;
    const t = setTimeout(() => cardSearchInputRef.current?.focus(), 280);
    return () => clearTimeout(t);
  }, [cardSearchOpen]);

  const boardViewColumns = useMemo((): BoardColumnData[] => {
    if (!cardSearchOpen) return columns;
    const q = cardSearchQuery.trim().toLowerCase();
    if (!q) return columns;
    return columns.map((col) => ({
      ...col,
      cards: col.cards.filter((c) => c.title.toLowerCase().includes(q)),
    }));
  }, [columns, cardSearchOpen, cardSearchQuery]);

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
          const colLayout = columnLayoutsRef.current[i];
          const colScrollY = columnScrollYRef.current[i] ?? 0;
          const estimatedFromColumn =
            !layout && colLayout
              ? {
                  x: Math.round(colLayout.x + 8),
                  y: Math.round(colLayout.y + Math.max(0, j * BOARD_CARD_ROW_HEIGHT - colScrollY)),
                  width: Math.round(Math.max(180, Math.min(colLayout.width - 16, fallbackW))),
                  height: BOARD_CARD_ROW_HEIGHT,
                }
              : null;
          const nextLayout = layout ??
            estimatedFromColumn ?? {
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

  const aiRecommendedCardMeta = useMemo(() => {
    const cardId = aiRecommendation?.cardId;
    if (!cardId) return null;
    for (const col of columns) {
      const card = col.cards.find((c) => c.id === cardId);
      if (card) {
        return {
          cardId,
          cardTitle: card.title,
          listTitle: col.title,
        };
      }
    }
    return null;
  }, [aiRecommendation?.cardId, columns]);

  const aiPinnedNote = useMemo(() => {
    const first = columns[0]?.cards[0];
    if (!first) return '';
    return aiReorderNotes[first.id] ?? '';
  }, [aiReorderNotes, columns]);

  const aiMenuListTitle = useMemo(() => {
    if (!aiMenuListId) return null;
    return columns.find((c) => c.id === aiMenuListId)?.title ?? null;
  }, [aiMenuListId, columns]);

  useEffect(() => {
    if (!expanded) {
      prevExpandedCardIdRef.current = null;
      expandedBaselineJsonRef.current = null;
      return;
    }
    if (prevExpandedCardIdRef.current !== expanded.cardId) {
      prevExpandedCardIdRef.current = expanded.cardId;
      const card = columns
        .flatMap((col) => col.cards)
        .find((c) => c.id === expanded.cardId);
      expandedBaselineJsonRef.current = card ? JSON.stringify(card) : null;
    }
  }, [expanded, columns]);

  const handleCloseExpandedCard = useCallback(() => {
    const ex = expanded;
    if (ex) {
      const cur = columnsRef.current.flatMap((col) => col.cards).find((c) => c.id === ex.cardId);
      const baseline = expandedBaselineJsonRef.current;
      if (cur && baseline != null && JSON.stringify(cur) !== baseline) {
        void patchCard(ex.cardId, boardCardToPatchBody(cur)).catch(() => refresh());
      }
    }
    prevExpandedCardIdRef.current = null;
    expandedBaselineJsonRef.current = null;
    setExpanded(null);
  }, [expanded, refresh]);

  useEffect(() => {
    if (expanded && expandedCardResolved == null) {
      setExpanded(null);
    }
  }, [expanded, expandedCardResolved]);

  const handleTableMoveCardToColumn = useCallback(
    (cardId: string, fromCol: number, toCol: number) => {
      setColumns((prev) => {
        const len = prev[toCol]?.cards.length ?? 0;
        const next = moveCardToHover(prev, cardId, fromCol, toCol, len);
        void (async () => {
          try {
            if (fromCol === toCol) {
              const col = next[toCol];
              if (col) await persistCardOrderInList(col.id, col.cards.map((c) => c.id));
            } else {
              const to = next[toCol];
              const from = next[fromCol];
              if (to && from) {
                const pos = to.cards.findIndex((c) => c.id === cardId);
                await persistCardMove(cardId, to.id, pos >= 0 ? pos : len);
                await persistCardOrderInList(from.id, from.cards.map((c) => c.id));
                await persistCardOrderInList(to.id, to.cards.map((c) => c.id));
              }
            }
          } catch {
            await refresh();
          }
        })();
        return next;
      });
    },
    [persistCardMove, persistCardOrderInList, refresh]
  );

  const handleTableRowDrop = useCallback(
    (cardId: string, fromCol: number, toCol: number, insertIndex: number) => {
      setColumns((prev) => {
        const next = moveCardToHover(prev, cardId, fromCol, toCol, insertIndex);
        void (async () => {
          try {
            if (fromCol === toCol) {
              const col = next[toCol];
              if (col) await persistCardOrderInList(col.id, col.cards.map((c) => c.id));
            } else {
              const to = next[toCol];
              const from = next[fromCol];
              if (to && from) {
                await persistCardMove(cardId, to.id, insertIndex);
                await persistCardOrderInList(from.id, from.cards.map((c) => c.id));
                await persistCardOrderInList(to.id, to.cards.map((c) => c.id));
              }
            }
          } catch {
            await refresh();
          }
        })();
        return next;
      });
    },
    [persistCardMove, persistCardOrderInList, refresh]
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
        let next = prev;
        if (direction === 'left') {
          if (columnIndex <= 0) return prev;
          next = reorderColumns(prev, columnIndex, columnIndex - 1);
        } else {
          if (columnIndex >= prev.length - 1) return prev;
          next = reorderColumns(prev, columnIndex, columnIndex + 2);
        }
        void persistListReorder(next).catch(() => refresh());
        return next;
      });
    },
    [persistListReorder, refresh]
  );

  const handleAddCardSubmit = useCallback(
    (title: string) => {
      const idx = promptAddCardCol;
      if (idx == null) return;
      const listId = columnsRef.current[idx]?.id;
      if (!listId) return;
      void (async () => {
        try {
          const { card } = await createCard(listId, {
            title,
            createdAtIso: new Date().toISOString(),
          });
          if (card) {
            const bc = apiRecordToBoardCard(card);
            setColumns((prev) =>
              prev.map((c, i) => (i === idx ? { ...c, cards: [...c.cards, bc] } : c))
            );
          } else {
            await refresh();
          }
        } catch {
          await refresh();
        }
      })();
    },
    [promptAddCardCol, refresh, setColumns]
  );

  const handleTableToggleStopwatch = useCallback(
    (cardId: string) => {
      hapticLight();
      setColumns((prev) => {
        const next = prev.map((col) => ({
          ...col,
          cards: col.cards.map((c) => (c.id === cardId ? toggleStopwatchOnTask(c) : c)),
        }));
        const card = next.flatMap((c) => c.cards).find((c) => c.id === cardId);
        if (card) {
          void patchCard(cardId, boardCardToPatchBody(card)).catch(() => refresh());
        }
        return next;
      });
    },
    [refresh]
  );

  const handleSetTableCardLabels = useCallback(
    (cardId: string, labels: TaskLabel[]) => {
      setColumns((prev) => {
        const next = prev.map((col) => ({
          ...col,
          cards: col.cards.map((c) =>
            c.id === cardId ? { ...c, labels: labels.length > 0 ? labels : undefined } : c
          ),
        }));
        const card = next.flatMap((c) => c.cards).find((c) => c.id === cardId);
        if (card) {
          void patchCard(cardId, boardCardToPatchBody(card)).catch(() => refresh());
        }
        return next;
      });
    },
    [refresh]
  );

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

  const handleAiError = useCallback((e: unknown) => {
    const status = typeof e === 'object' && e && 'status' in e ? Number((e as { status?: unknown }).status) : 0;
    if (status === 429) {
      Alert.alert('AI request limit reached', 'You are out of AI requests for today. Try again tomorrow.');
      return;
    }
    const message =
      e instanceof Error ? e.message : 'AI could not complete that request. Please try again.';
    Alert.alert('AI request failed', message);
  }, []);

  const persistVisibleOrder = useCallback(
    async (nextColumns: BoardColumnData[]) => {
      await Promise.all(
        nextColumns.map((col) => persistCardOrderInList(col.id, col.cards.map((c) => c.id)))
      );
    },
    [persistCardOrderInList]
  );

  const applyAiOrderFromPayload = useCallback(
    async (payload: BoardAiApplyOrderPayload) => {
      if (payload.boardId !== boardId || !Array.isArray(payload.order) || payload.order.length === 0) {
        return;
      }
      const before = cloneBoardColumns(columnsRef.current);
      const proposed = reorderColumnsByAiOrder(before, payload.order);
      const changed = proposed.some((col, idx) =>
        col.cards.some((card, cardIdx) => before[idx]?.cards[cardIdx]?.id !== card.id)
      );
      if (!changed) return;
      setAiSnapshot(before);
      setAiChangeLabel(
        payload.listId ? 'AI task prioritization for this list' : 'AI task prioritization'
      );
      setAiReorderNotes(payload.notes ?? {});
      setColumns(proposed);
      try {
        await persistVisibleOrder(proposed);
      } catch {
        await refresh();
      }
    },
    [boardId, persistVisibleOrder, refresh, setColumns]
  );

  useEffect(() => {
    const applySub = DeviceEventEmitter.addListener(BOARD_AI_APPLY_ORDER_EVENT, (raw: unknown) => {
      const payload = raw as BoardAiApplyOrderPayload;
      void applyAiOrderFromPayload(payload);
    });
    const openSub = DeviceEventEmitter.addListener(BOARD_AI_OPEN_CARD_EVENT, (raw: unknown) => {
      const payload = raw as BoardAiOpenCardPayload;
      if (!payload?.cardId || payload.boardId !== boardId) return;
      handleCalendarOpenTask(payload.cardId);
    });
    return () => {
      applySub.remove();
      openSub.remove();
    };
  }, [applyAiOrderFromPayload, boardId, handleCalendarOpenTask]);

  const runAiPrioritization = useCallback(async () => {
    if (aiBusyAction) return;
    setAiMenuOpen(false);
    const targetListId = aiMenuListId;
    const before = cloneBoardColumns(columnsRef.current);
    setAiBusyAction('prioritize');
    try {
      const { order, notes } = await runBoardAiPrioritization(boardId, {
        maxCards: 45,
        listIds: targetListId ? [targetListId] : undefined,
      });
      if (!order || order.length === 0) {
        Alert.alert('Nothing to prioritize', 'AI did not find enough tasks to reorder right now.');
        return;
      }
      const proposed = reorderColumnsByAiOrder(before, order);
      const changed = proposed.some((col, idx) =>
        col.cards.some((card, cardIdx) => before[idx]?.cards[cardIdx]?.id !== card.id)
      );
      if (!changed) {
        Alert.alert('Already prioritized', 'Your list order already looks optimal based on current data.');
        return;
      }
      setAiSnapshot(before);
      setAiChangeLabel(targetListId ? 'AI task prioritization for this list' : 'AI task prioritization');
      setAiReorderNotes(notes ?? {});
      setColumns(proposed);
      await persistVisibleOrder(proposed);
    } catch (e) {
      handleAiError(e);
    } finally {
      setAiBusyAction(null);
    }
  }, [aiBusyAction, aiMenuListId, boardId, handleAiError, persistVisibleOrder, setColumns]);

  const runAiNextTask = useCallback(async () => {
    if (aiBusyAction) return;
    setAiMenuOpen(false);
    const targetListId = aiMenuListId;
    setAiBusyAction('next');
    try {
      const rec = await runBoardAiNextTask(boardId, {
        maxCards: 45,
        listIds: targetListId ? [targetListId] : undefined,
      });
      setAiRecommendation({
        cardId: rec.cardId ?? null,
        reason: rec.reason ?? '',
        subtasks: Array.isArray(rec.subtasks) ? rec.subtasks : [],
      });
    } catch (e) {
      handleAiError(e);
    } finally {
      setAiBusyAction(null);
    }
  }, [aiBusyAction, aiMenuListId, boardId, handleAiError]);

  const runAiInsights = useCallback(async () => {
    if (aiBusyAction) return;
    setAiMenuOpen(false);
    const targetListId = aiMenuListId;
    setAiBusyAction('insights');
    try {
      const insights = await runBoardAiListInsights(boardId, {
        maxCards: 45,
        listIds: targetListId ? [targetListId] : undefined,
      });
      setAiInsights(insights);
    } catch (e) {
      handleAiError(e);
    } finally {
      setAiBusyAction(null);
    }
  }, [aiBusyAction, aiMenuListId, boardId, handleAiError]);

  const keepAiChanges = useCallback(() => {
    setAiSnapshot(null);
    setAiChangeLabel('');
    setAiReorderNotes({});
  }, []);

  const revertAiChanges = useCallback(async () => {
    if (!aiSnapshot) return;
    const restore = cloneBoardColumns(aiSnapshot);
    setColumns(restore);
    setAiSnapshot(null);
    setAiChangeLabel('');
    setAiReorderNotes({});
    try {
      await persistVisibleOrder(restore);
    } catch {
      await refresh();
    }
  }, [aiSnapshot, persistVisibleOrder, refresh, setColumns]);

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
      arr[colIndex] = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    },
    []
  );

  const onColumnScroll = useCallback((colIndex: number, scrollY: number) => {
    columnScrollYRef.current[colIndex] = scrollY;
  }, []);

  const computeHover = useCallback(
    (absX: number, absY: number) => {
      const layouts = columnLayoutsRef.current;
      const wraps = columnWrapLayoutsRef.current;
      const scrollYs = columnScrollYRef.current;
      const dragId = draggingRef.current?.cardId;
      for (let i = 0; i < columns.length; i++) {
        const L = layouts[i];
        const wrap = wraps[i];
        const virtualCount = columns[i].cards.filter((c) => c.id !== dragId).length;

        const inColumn =
          wrap &&
          wrap.width > 0 &&
          wrap.height > 0 &&
          absX >= wrap.x &&
          absX <= wrap.x + wrap.width &&
          absY >= wrap.y &&
          absY <= wrap.y + wrap.height
            ? true
            : L &&
                absX >= L.x &&
                absX <= L.x + L.width &&
                absY >= L.y &&
                absY <= L.y + L.height;

        if (!inColumn) continue;

        if (L && absY >= L.y && absY <= L.y + L.height) {
          const scrollY = scrollYs[i] ?? 0;
          const localY = absY - L.y + scrollY;
          const insertIndex = computeHoverInsertIndex(localY, virtualCount);
          return { col: i, insertIndex };
        }
        if (!L || absY < L.y) {
          return { col: i, insertIndex: 0 };
        }
        return { col: i, insertIndex: virtualCount };
      }
      return null;
    },
    [columns]
  );

  const onDragMove = useCallback(
    (absX: number, absY: number) => {
      lastAbsRef.current = { x: absX, y: absY };
      const overArchive = absY <= insets.top + BOARD_HEADER_ROW_HEIGHT;
      dragOverArchiveRef.current = overArchive;
      if (overArchive !== dragOverArchivePrevRef.current) {
        dragOverArchivePrevRef.current = overArchive;
        setDragOverArchive(overArchive);
      }
      if (overArchive) {
        pendingHoverRef.current = null;
        scheduleHoverFlush();
        return;
      }
      const next = computeHover(absX, absY);
      if (next != null) {
        pendingHoverRef.current = next;
        scheduleHoverFlush();
      }
    },
    [insets.top, computeHover, scheduleHoverFlush]
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
        dragOverArchiveRef.current = false;
        dragOverArchivePrevRef.current = false;
        setDragOverArchive(false);
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
    const overArchive = dragOverArchiveRef.current;
    dragOverArchiveRef.current = false;
    dragOverArchivePrevRef.current = false;
    setDragOverArchive(false);
    if (d && overArchive) {
      const snap = columnsRef.current;
      const listTitle = snap[d.fromCol]?.title ?? '';
      const card = snap[d.fromCol]?.cards.find((c) => c.id === d.cardId);
      if (card) {
        void persistArchiveCard(d.cardId, listTitle).catch(() => refresh());
      }
      void hapticMedium();
      setColumns((prev) => removeCardFromBoard(prev, d.cardId));
    } else if (d && h) {
      setColumns((prev) => {
        const next = moveCardToHover(prev, d.cardId, d.fromCol, h.col, h.insertIndex);
        void (async () => {
          try {
            if (d.fromCol === h.col) {
              const col = next[h.col];
              if (col) await persistCardOrderInList(col.id, col.cards.map((c) => c.id));
            } else {
              const to = next[h.col];
              const from = next[d.fromCol];
              if (to && from) {
                await persistCardMove(d.cardId, to.id, h.insertIndex);
                await persistCardOrderInList(from.id, from.cards.map((c) => c.id));
                await persistCardOrderInList(to.id, to.cards.map((c) => c.id));
              }
            }
          } catch {
            await refresh();
          }
        })();
        return next;
      });
    }
    draggingRef.current = null;
    setDragging(null);
    setHoverTarget(null);
  }, [persistArchiveCard, persistCardMove, persistCardOrderInList, refresh]);

  const onColumnListDragBegin = useCallback(
    (args: {
      columnIndex: number;
      measure: (cb: (x: number, y: number, w: number, h: number) => void) => void;
    }) => {
      args.measure((x, y, w, h) => {
        dragOverArchiveRef.current = false;
        dragOverArchivePrevRef.current = false;
        setDragOverArchive(false);
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
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            remeasureAllColumns();
          });
        });
      });
    },
    [remeasureAllColumns]
  );

  const onColumnListDragMove = useCallback(
    (absX: number, absY: number) => {
      lastAbsRef.current = { x: absX, y: absY };
      const overArchive = absY <= insets.top + BOARD_HEADER_ROW_HEIGHT;
      dragOverArchiveRef.current = overArchive;
      if (overArchive !== dragOverArchivePrevRef.current) {
        dragOverArchivePrevRef.current = overArchive;
        setDragOverArchive(overArchive);
      }
      if (overArchive) return;
      const from = listDraggingRef.current?.fromIndex ?? null;
      const next = computeColumnHoverInsertIndex(
        absX,
        columnWrapLayoutsRef.current,
        columns.length,
        from
      );
      setListHoverInsert(next);
    },
    [columns.length, insets.top]
  );

  const onColumnListDragEnd = useCallback(() => {
    const d = listDraggingRef.current;
    const insert = listHoverInsertRef.current;
    const overArchive = dragOverArchiveRef.current;
    dragOverArchiveRef.current = false;
    dragOverArchivePrevRef.current = false;
    setDragOverArchive(false);
    if (d != null && overArchive) {
      const col = columnsRef.current[d.fromIndex];
      if (col) {
        void persistArchiveList(col.id).catch(() => refresh());
      }
      void hapticMedium();
      setColumns((prev) => removeColumnAtIndex(prev, d.fromIndex));
    } else if (d != null && insert != null) {
      setColumns((prev) => {
        const next = reorderColumns(prev, d.fromIndex, insert);
        void persistListReorder(next).catch(() => refresh());
        return next;
      });
    }
    listDraggingRef.current = null;
    setListDragging(null);
    setListHoverInsert(null);
  }, [persistArchiveList, persistListReorder, refresh]);

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

  const syncFocusPageIndexFromScrollX = useCallback(
    (x: number) => {
      if (!boardFocusMode) return;
      const snap = focusCarousel.snapInterval;
      const idx = Math.min(columns.length, Math.max(0, Math.round(x / snap)));
      setFocusPageIndex((p) => (p !== idx ? idx : p));
    },
    [boardFocusMode, columns.length, focusCarousel.snapInterval]
  );

  const focusPagerDotLayout = useMemo(() => {
    const totalPages = columns.length + 1;
    const visibleDotCount = Math.min(FOCUS_PAGE_DOT_SLOTS, totalPages);
    if (totalPages <= FOCUS_PAGE_DOT_SLOTS) {
      return { windowStart: 0, totalPages, visibleDotCount };
    }
    const windowStart = Math.min(
      Math.max(0, focusPageIndex - 4),
      totalPages - FOCUS_PAGE_DOT_SLOTS
    );
    return { windowStart, totalPages, visibleDotCount };
  }, [columns.length, focusPageIndex]);

  const scrollToFocusPageIndex = useCallback(
    (pageIndex: number) => {
      if (!boardFocusMode) return;
      const totalPages = columns.length + 1;
      const clamped = Math.min(totalPages - 1, Math.max(0, pageIndex));
      const sx = clamped * focusCarousel.snapInterval;
      horizontalScrollRef.current?.scrollTo({ x: sx, animated: true });
      horizontalScrollXRef.current = sx;
      setFocusPageIndex(clamped);
      hapticLight();
    },
    [boardFocusMode, columns.length, focusCarousel.snapInterval]
  );

  const focusColumnMaxH = Math.min(580, Math.round(screenH * 0.58));
  const focusCardScrollMax = Math.max(300, focusColumnMaxH - 130);

  useLayoutEffect(() => {
    if (!boardFocusMode) return;
    const idx = focusEnterColumnIdxRef.current;
    if (idx == null) return;
    focusEnterColumnIdxRef.current = null;
    const sxFocus = idx * focusCarousel.snapInterval;
    horizontalScrollRef.current?.scrollTo({ x: sxFocus, animated: false });
    horizontalScrollXRef.current = sxFocus;
    focusZoomAnchorX.value = focusColumnCenterScreenX(
      sxFocus,
      focusCarousel.sidePad,
      focusCarousel.snapInterval,
      focusCarousel.cardWidth,
      idx
    );
    focusZoomAnchorY.value = screenH * 0.42;
  }, [
    boardFocusMode,
    focusCarousel.snapInterval,
    focusCarousel.sidePad,
    focusCarousel.cardWidth,
    screenH,
  ]);

  const finalizeFocusExit = useCallback(() => {
    if (focusExitRafRef.current != null) {
      cancelAnimationFrame(focusExitRafRef.current);
      focusExitRafRef.current = null;
    }
    if (focusExitTimerRef.current != null) {
      clearTimeout(focusExitTimerRef.current);
      focusExitTimerRef.current = null;
    }
    focusExitAnimatingRef.current = false;
    setFocusExitAnimationBusy(false);
    cancelAnimation(focusZoom);
    cancelAnimation(focusZoomAnchorX);
    cancelAnimation(focusZoomAnchorY);
    focusZoom.value = 1;
    setBoardFocusMode(false);
  }, [focusZoom, focusZoomAnchorX, focusZoomAnchorY]);

  const completeFocusExitAfterAnimation = useCallback(() => {
    focusExitAnimatingRef.current = false;
    setFocusExitAnimationBusy(false);
    setBoardFocusMode(false);
  }, []);

  const onFocusExitTimingFinished = useCallback(
    (finished?: boolean) => {
      const ok = finished === true;
      if (ok) {
        completeFocusExitAfterAnimation();
      } else {
        finalizeFocusExit();
      }
    },
    [completeFocusExitAfterAnimation, finalizeFocusExit]
  );

  const handleBoardFocusExpandPress = useCallback(() => {
    if (viewMode !== 'board') return;

    if (!boardFocusMode) {
      if (focusExitTimerRef.current != null) {
        clearTimeout(focusExitTimerRef.current);
        focusExitTimerRef.current = null;
      }
      focusExitAnimatingRef.current = false;
      setFocusExitAnimationBusy(false);
      const sx = horizontalScrollXRef.current;
      const maxIdx = Math.max(0, columns.length - 1);
      const idx = Math.min(maxIdx, Math.max(0, Math.round(sx / BOARD_STRIP_COL_STRIDE)));
      focusEnterColumnIdxRef.current = idx;
      setFocusPageIndex(idx);
      setBoardFocusMode(true);
      return;
    }

    if (focusExitAnimatingRef.current) {
      return;
    }

    const sx = horizontalScrollXRef.current;
    const snap = focusCarousel.snapInterval;
    const idx = Math.min(columns.length, Math.max(0, Math.round(sx / snap)));
    if (focusExitRafRef.current != null) {
      cancelAnimationFrame(focusExitRafRef.current);
      focusExitRafRef.current = null;
    }
    const padBoard = isWeb ? 24 : 16;
    const sxBoard = idx * BOARD_STRIP_COL_STRIDE;
    const sxFocus = idx * focusCarousel.snapInterval;
    cancelAnimation(focusZoom);
    cancelAnimation(focusZoomAnchorX);
    cancelAnimation(focusZoomAnchorY);
    const anchorEndX = stripColumnCenterScreenX(sxBoard, padBoard, idx);
    const anchorEndY = screenH * 0.44;

    horizontalScrollRef.current?.scrollTo({ x: sxFocus, animated: false });
    horizontalScrollXRef.current = sxFocus;

    focusExitAnimatingRef.current = true;
    setFocusExitAnimationBusy(true);
    setBoardFocusMode(false);
    focusExitRafRef.current = requestAnimationFrame(() => {
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
        easing: FOCUS_EXIT_EASING,
      };
      focusZoomAnchorX.value = withTiming(anchorEndX, exitTiming);
      focusZoomAnchorY.value = withTiming(anchorEndY, exitTiming);
      focusZoom.value = withDelay(
        FOCUS_ZOOM_EXIT_MS,
        withTiming(1, { duration: 0 }, (finished) => {
          runOnJS(onFocusExitTimingFinished)(finished);
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
    onFocusExitTimingFinished,
  ]);

  useEffect(() => {
    if (!boardFocusMode) {
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
          setFocusExitAnimationBusy(false);
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
    cancelAnimation(focusZoom);
    focusZoom.value = 1;
    return () => {
      cancelAnimation(focusZoom);
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
      onSearchCardsPress: glassBottomBar?.onSearchCardsPress ?? openCardSearch,
      onBellPress: onOpenBoardNotifications ?? glassBottomBar?.onBellPress ?? boardGlassBarNoopAction,
      onSettingsPress:
        onOpenBoardSettings ?? glassBottomBar?.onSettingsPress ?? boardGlassBarNoopAction,
      showExpandButton: viewMode === 'board',
      expandActive: boardFocusMode || focusExitAnimationBusy,
      expandDisabled: focusExitAnimationBusy,
      onExpandPress: handleBoardFocusExpandPress,
    };
  }, [
    boardFocusMode,
    focusExitAnimationBusy,
    glassBottomBar,
    handleBoardFocusExpandPress,
    onBoardViewSelect,
    onOpenBoardNotifications,
    onOpenBoardSettings,
    viewMode,
    openCardSearch,
  ]);

  if (boardLoading && columns.length === 0) {
    return (
      <BoardScreenSkeleton
        paddingTop={insets.top}
        bottomInset={insets.bottom}
        horizontalPadding={Platform.OS === 'web' ? 24 : 16}
        titleBarWidth={Math.min(200, screenW * 0.42)}
      />
    );
  }

  if (boardError && columns.length === 0) {
    return (
      <View style={[styles.container, styles.boardGate, { paddingTop: insets.top }]}>
        <Text style={styles.boardGateError}>{boardError}</Text>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.boardGateBack}>
            <Text style={styles.boardGateBackLabel}>Go back</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {viewMode === 'board' && (dragging || listDragging) ? (
        <View
          pointerEvents="none"
          style={[
            styles.archiveHeaderReplacement,
            dragOverArchive && styles.archiveHeaderReplacementActive,
          ]}
        >
          <Feather name="archive" size={24} color="#fff" style={{ opacity: 0.95 }} />
          <Text style={styles.archiveHeaderReplacementText}>Drop here to archive</Text>
          <View
            style={[
              styles.archiveHeaderBottomLine,
              dragOverArchive && styles.archiveHeaderBottomLineActive,
            ]}
          />
        </View>
      ) : viewMode === 'board' && cardSearchOpen ? (
        <View style={[styles.header, styles.headerSearchBar, { height: BOARD_HEADER_ROW_HEIGHT }]}>
          <TextInput
            ref={cardSearchInputRef}
            style={styles.cardSearchInput}
            placeholder="Filter cards…"
            placeholderTextColor={colors.placeholder}
            value={cardSearchQuery}
            onChangeText={setCardSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Filter cards"
          />
          <View style={[styles.headerSide, styles.headerSideEnd]}>
            <GlassRoundIconButton
              icon="x"
              size={22}
              accessibilityLabel="Close search"
              onPress={() => {
                hapticLight();
                closeCardSearch();
              }}
            />
          </View>
        </View>
      ) : (
        <View style={[styles.header, { height: BOARD_HEADER_ROW_HEIGHT }]}>
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
            {displayBoardTitle}
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
      )}

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
            scrollEventThrottle={boardFocusMode ? 1 : 16}
            // @ts-expect-error RN ScrollView iOS prop; RNGH typings omit it
            delayContentTouches={false}
            onScroll={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              horizontalScrollXRef.current = x;
              syncFocusPageIndexFromScrollX(x);
              requestAnimationFrame(remeasureAllColumns);
            }}
            onScrollEndDrag={(e) => {
              if (!boardFocusMode) return;
              syncFocusPageIndexFromScrollX(e.nativeEvent.contentOffset.x);
            }}
            onMomentumScrollEnd={(e) => {
              if (!boardFocusMode) return;
              syncFocusPageIndexFromScrollX(e.nativeEvent.contentOffset.x);
            }}
          >
          {listDragging
            ? (() => {
                const nodes: React.ReactNode[] = [];
                const insertAt = listHoverInsert ?? 0;
                const n = columns.length;
                for (let i = 0; i <= n; i++) {
                  if (insertAt === i) {
                    nodes.push(
                      <View key={`col-gap-${i}`} style={styles.listPageShell}>
                        <BoardColumnPlaceholder />
                      </View>
                    );
                  }
                  if (i < n) {
                    const col = boardViewColumns[i];
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
                          onAddCard={() => openAddCardComposer(i)}
                          onAiPress={() => {
                            router.push({
                              pathname: '/board-ai',
                              params: {
                                boardId,
                                listId: col.id,
                                listTitle: col.title,
                              },
                            });
                          }}
                          addCardComposerOpen={addCardComposerCol === i}
                          addCardComposerValue={addCardComposerCol === i ? addCardComposerDraft : ''}
                          onAddCardComposerChangeText={setAddCardComposerDraft}
                          onAddCardComposerSubmit={submitAddCardComposer}
                          onAddCardComposerCancel={closeAddCardComposer}
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
            : boardViewColumns.map((col, i) => (
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
                    onAddCard={() => openAddCardComposer(i)}
                    onAiPress={() => {
                      router.push({
                        pathname: '/board-ai',
                        params: {
                          boardId,
                          listId: col.id,
                          listTitle: col.title,
                        },
                      });
                    }}
                    addCardComposerOpen={addCardComposerCol === i}
                    addCardComposerValue={addCardComposerCol === i ? addCardComposerDraft : ''}
                    onAddCardComposerChangeText={setAddCardComposerDraft}
                    onAddCardComposerSubmit={submitAddCardComposer}
                    onAddCardComposerCancel={closeAddCardComposer}
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
            <Animated.View
              layout={ADD_LIST_MORPH_LAYOUT}
              style={[
                styles.addListWrap,
                boardFocusMode && { width: focusCarousel.cardWidth },
                boardFocusMode && styles.addListWrapCentered,
              ]}
            >
              {!inlineAddListOpen ? (
                <Animated.View exiting={FadeOut.duration(140)}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      hapticLight();
                      openInlineAddList();
                    }}
                    style={styles.addListTouchableFill}
                  >
                    <View style={styles.addListShadow} />
                    <View style={styles.addList}>
                      <Feather name="plus" size={20} color={colors.iconChevron} />
                      <Text style={styles.addListText}>Add list</Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ) : (
                <Animated.View entering={FadeIn.duration(200)}>
                  <View style={styles.addListShadow} />
                  <View
                    style={[
                      styles.inlineNewListColumn,
                      boardFocusMode && { maxHeight: focusColumnMaxH },
                    ]}
                  >
                    <View style={styles.inlineNewListHeader}>
                      <TextInput
                        ref={inlineAddListInputRef}
                        value={inlineAddListDraft}
                        onChangeText={setInlineAddListDraft}
                        placeholder="List name"
                        placeholderTextColor={colors.placeholder}
                        style={styles.inlineNewListTitleInput}
                        autoCorrect
                        autoCapitalize="sentences"
                        returnKeyType="done"
                        blurOnSubmit={false}
                        onSubmitEditing={() => {
                          if (inlineAddListDraft.trim()) commitInlineAddList();
                        }}
                        maxLength={120}
                      />
                      <Text style={styles.inlineNewListCount}>0</Text>
                    </View>
                    <View
                      style={[
                        styles.inlineNewListBody,
                        boardFocusMode && { maxHeight: focusCardScrollMax },
                      ]}
                    >
                      <Text style={styles.inlineNewListHint}>Cards will show up here</Text>
                    </View>
                    <View style={styles.inlineNewListActions}>
                      <Pressable
                        onPress={cancelInlineAddList}
                        hitSlop={8}
                        style={styles.inlineNewListActionHit}
                      >
                        <Text style={styles.inlineNewListActionCancel}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={commitInlineAddList}
                        hitSlop={8}
                        style={styles.inlineNewListActionHit}
                        disabled={!inlineAddListDraft.trim()}
                      >
                        <Text
                          style={[
                            styles.inlineNewListActionAdd,
                            !inlineAddListDraft.trim() && styles.inlineNewListActionAddDisabled,
                          ]}
                        >
                          Add list
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          </View>
        </GHScrollView>
          </Animated.View>
        </View>
      ) : viewMode === 'table' ? (
        <BoardTableView
          columns={columns}
          bottomClearance={BOARD_GLASS_BOTTOM_BAR_CLEARANCE}
          onCardPress={openCardAt}
          onToggleTableStopwatch={handleTableToggleStopwatch}
          onMoveCardToColumn={handleTableMoveCardToColumn}
          onAddCard={(colIdx) => setPromptAddCardCol(colIdx)}
          onAddList={() => {
            hapticLight();
            pendingTableAddListRef.current = true;
            setViewMode('board');
            onBoardViewSelect?.('board');
          }}
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
        <View style={styles.boardArea}>
          <BoardTimelineView
            columns={columns}
            bottomClearance={BOARD_GLASS_BOTTOM_BAR_CLEARANCE}
            onOpenTask={handleCalendarOpenTask}
          />
        </View>
      )}

      {viewMode === 'board' && dragging && draggingCard ? (
        <View pointerEvents="none" style={styles.cardDragOverlayRoot}>
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: dragging.startX,
                top: dragging.startY,
                width: dragging.width,
                zIndex: 1,
                elevation: 24,
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
              description={draggingCard.description}
              labelColor={draggingCard.labelColor}
              priorities={draggingCard.priorities}
              assignees={draggingCard.assignees}
              suppressPress
            />
          </Animated.View>
        </View>
      ) : null}

      {viewMode === 'board' && listDragging && draggingListColumn ? (
        <View pointerEvents="none" style={styles.listDragOverlayRoot}>
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

      {viewMode === 'board' && boardFocusMode ? (
        <View
          style={[
            styles.focusDotsOverlay,
            { paddingBottom: insets.bottom + BOARD_GLASS_FOCUS_DOTS_BASE_CLEARANCE },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.focusDotsRowWrap}>
            <View style={styles.focusDotsRow} accessibilityRole="tablist">
              {Array.from({ length: focusPagerDotLayout.visibleDotCount }, (_, slot) => {
                const { windowStart, totalPages, visibleDotCount } = focusPagerDotLayout;
                const pageIndex = windowStart + slot;
                const isActive = pageIndex === focusPageIndex;
                const { diameter, opacity } = focusPagerDotVisual(
                  slot,
                  visibleDotCount,
                  isActive
                );
                const dotColor = isActive ? colors.textPrimary : colors.textTertiary;
                return (
                  <Pressable
                    key={`focus-dot-${pageIndex}`}
                    onPress={() => scrollToFocusPageIndex(pageIndex)}
                    hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={`List ${pageIndex + 1} of ${totalPages}${isActive ? ', current' : ''}`}
                    style={styles.focusDotHit}
                  >
                    <View
                      style={[
                        styles.focusDotCore,
                        {
                          width: diameter,
                          height: diameter,
                          borderRadius: diameter / 2,
                          opacity,
                          backgroundColor: dotColor,
                        },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      ) : null}

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

      {aiMenuOpen ? (
        <View style={styles.aiModalOverlay} pointerEvents="box-none">
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setAiMenuOpen(false);
              setAiMenuListId(null);
            }}
          />
          <View style={styles.aiMenuCard}>
            <Text style={styles.aiMenuTitle}>
              AI for {aiMenuListTitle ? `"${aiMenuListTitle}"` : 'this list'}
            </Text>
            <Text style={styles.aiMenuHint}>Each option uses 1 daily AI request.</Text>
            <Pressable
              style={({ pressed }) => [styles.aiMenuAction, pressed && styles.aiMenuActionPressed]}
              onPress={() => void runAiPrioritization()}
              disabled={aiBusyAction != null}
            >
              <Text style={styles.aiMenuActionTitle}>Prioritize tasks</Text>
              <Text style={styles.aiMenuActionBody}>
                Reorder based on due dates + complexity cues.
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.aiMenuAction, pressed && styles.aiMenuActionPressed]}
              onPress={() => void runAiNextTask()}
              disabled={aiBusyAction != null}
            >
              <Text style={styles.aiMenuActionTitle}>Recommend next task</Text>
              <Text style={styles.aiMenuActionBody}>
                Pick the best next card with a suggested breakdown.
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.aiMenuAction, pressed && styles.aiMenuActionPressed]}
              onPress={() => void runAiInsights()}
              disabled={aiBusyAction != null}
            >
              <Text style={styles.aiMenuActionTitle}>List health insights</Text>
              <Text style={styles.aiMenuActionBody}>
                Highlights wins, risks, and focused improvements.
              </Text>
            </Pressable>
            {aiBusyAction ? (
              <View style={styles.aiMenuBusyRow}>
                <ActivityIndicator size="small" color={colors.iconPrimary} />
                <Text style={styles.aiMenuBusyText}>Working...</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {aiSnapshot ? (
        <View style={[styles.aiChangeBar, { bottom: insets.bottom + 10 }]}>
          <Text style={styles.aiChangeBarTitle}>{aiChangeLabel} applied</Text>
          <Text style={styles.aiChangeBarBody}>Review and keep, or revert instantly.</Text>
          {aiPinnedNote ? <Text style={styles.aiChangeBarNote}>Top task reason: {aiPinnedNote}</Text> : null}
          <View style={styles.aiChangeBarActions}>
            <Pressable onPress={keepAiChanges} style={styles.aiChangeAction}>
              <Text style={styles.aiChangeActionKeep}>Keep</Text>
            </Pressable>
            <Pressable onPress={() => void revertAiChanges()} style={styles.aiChangeAction}>
              <Text style={styles.aiChangeActionRevert}>Revert</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {aiRecommendation ? (
        <View style={styles.aiModalOverlay} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAiRecommendation(null)} />
          <View style={styles.aiModalCard}>
            <Text style={styles.aiModalTitle}>Next task recommendation</Text>
            {aiRecommendedCardMeta ? (
              <>
                <Text style={styles.aiModalTaskTitle}>{aiRecommendedCardMeta.cardTitle}</Text>
                <Text style={styles.aiModalTaskMeta}>From {aiRecommendedCardMeta.listTitle}</Text>
              </>
            ) : (
              <Text style={styles.aiModalTaskMeta}>No specific card selected.</Text>
            )}
            {aiRecommendation.reason ? (
              <Text style={styles.aiModalBody}>{aiRecommendation.reason}</Text>
            ) : null}
            {aiRecommendation.subtasks.length > 0 ? (
              <View style={styles.aiModalList}>
                {aiRecommendation.subtasks.map((step, idx) => (
                  <Text key={`${step}-${idx}`} style={styles.aiModalListItem}>
                    • {step}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.aiModalBodyMuted}>
                Not enough context for a detailed breakdown yet.
              </Text>
            )}
            {aiRecommendation.cardId && aiRecommendedCardMeta ? (
              <Pressable
                style={styles.aiModalPrimaryBtn}
                onPress={() => {
                  const targetCardId = aiRecommendation.cardId;
                  setAiRecommendation(null);
                  setAiMenuOpen(false);
                  if (targetCardId) handleCalendarOpenTask(targetCardId);
                }}
              >
                <Text style={styles.aiModalPrimaryBtnText}>Open task</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {aiInsights ? (
        <View style={styles.aiModalOverlay} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAiInsights(null)} />
          <View style={styles.aiModalCard}>
            <Text style={styles.aiModalTitle}>AI list insights</Text>
            <Text style={styles.aiModalBody}>{aiInsights.summary}</Text>
            {aiInsights.wins.length > 0 ? (
              <View style={styles.aiModalList}>
                <Text style={styles.aiModalListTitle}>Wins</Text>
                {aiInsights.wins.map((x, idx) => (
                  <Text key={`w-${idx}-${x}`} style={styles.aiModalListItem}>
                    • {x}
                  </Text>
                ))}
              </View>
            ) : null}
            {aiInsights.risks.length > 0 ? (
              <View style={styles.aiModalList}>
                <Text style={styles.aiModalListTitle}>Risks</Text>
                {aiInsights.risks.map((x, idx) => (
                  <Text key={`r-${idx}-${x}`} style={styles.aiModalListItem}>
                    • {x}
                  </Text>
                ))}
              </View>
            ) : null}
            {aiInsights.suggestions.length > 0 ? (
              <View style={styles.aiModalList}>
                <Text style={styles.aiModalListTitle}>Suggestions</Text>
                {aiInsights.suggestions.map((x, idx) => (
                  <Text key={`s-${idx}-${x}`} style={styles.aiModalListItem}>
                    • {x}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
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
      {expanded && expandedCardResolved ? (
        <BoardCardExpandOverlay
          layoutInfo={expanded}
          card={expandedCardResolved.card}
          availableMembers={availableMembers}
          labelPresets={cardTaxonomy.boardLabels}
          priorityPresets={cardTaxonomy.boardPriorities}
          onUpdateCard={handleUpdateExpandedCard}
          onClose={handleCloseExpandedCard}
        />
      ) : null}
    </View>
  );
}

function createBoardScreenStyles(colors: ThemeColors) {
  const boardDropZone = {
    borderWidth: 2,
    borderStyle: 'dashed' as const,
    borderColor: colors.dropZoneBorder,
    backgroundColor: colors.dropZoneBg,
  };

  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
    overflow: 'visible',
  },
  boardGate: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  boardGateError: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  boardGateBack: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  boardGateBackLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  archiveHeaderReplacement: {
    position: 'relative',
    height: BOARD_HEADER_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    overflow: 'hidden',
  },
  archiveHeaderReplacementActive: {
    backgroundColor: 'rgba(180, 40, 40, 0.42)',
  },
  archiveHeaderBottomLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  archiveHeaderBottomLineActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',  },
  archiveHeaderReplacementText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  cardDragOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 22000,
    elevation: 22,
  },
  listDragOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 22000,
    elevation: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 20,
    backgroundColor: colors.boardHeaderBg,
    overflow: 'visible',
  },
  headerSearchBar: {
    paddingVertical: 0,
    gap: 10,
  },
  cardSearchInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
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
    color: colors.textPrimary,
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
  focusDotsOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20050,
    elevation: 20050,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
    width: '100%',
    pointerEvents: 'box-none',
  },
  focusDotsRowWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusDotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 2,
    flexShrink: 0,
  },
  focusDotHit: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
  },
  focusDotCore: {
    alignSelf: 'center',
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
  addListTouchableFill: {
    alignSelf: 'stretch',
  },
  addListShadow: {
    position: 'absolute',
    left: SHIFT,
    top: SHIFT,
    right: -SHIFT,
    bottom: -SHIFT,
    backgroundColor: colors.shadowFillColumn,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addList: {
    position: 'relative',
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.columnSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 20,
    paddingHorizontal: 24,
    minHeight: 120,
  },
  addListText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  inlineNewListColumn: {
    position: 'relative',
    zIndex: 1,
    backgroundColor: colors.columnSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 360,
    maxHeight: 520,
  },
  inlineNewListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  inlineNewListTitleInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingVertical: 4,
    paddingRight: 8,
  },
  inlineNewListCount: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  inlineNewListBody: {
    minHeight: 220,
    maxHeight: 400,
    borderRadius: BOARD_DROP_ZONE_CARD_RADIUS,
    ...boardDropZone,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  inlineNewListHint: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textTertiary,
    textAlign: 'center',
  },
  inlineNewListActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 12,
  },
  inlineNewListActionHit: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  inlineNewListActionCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.boardLink,
  },
  inlineNewListActionAdd: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  inlineNewListActionAddDisabled: {
    color: colors.placeholder,
  },
  listDragOverlayInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BOARD_DROP_ZONE_CARD_RADIUS,
    ...boardDropZone,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  listDragOverlayTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  listDragOverlayCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tableRowDragOverlayInner: {
    backgroundColor: colors.cardFace,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tableRowDragTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tableRowDragSub: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 4,
  },
  aiMenuCard: {
    width: 286,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 14,
  },
  aiMenuBusyRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiMenuBusyText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  aiMenuTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  aiMenuHint: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
    marginBottom: 4,
  },
  aiMenuAction: {
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.canvas,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  aiMenuActionPressed: {
    opacity: 0.9,
  },
  aiMenuActionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  aiMenuActionBody: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 17,
  },
  aiChangeBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: 12,
    zIndex: 20070,
  },
  aiChangeBarTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  aiChangeBarBody: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  aiChangeBarNote: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  aiChangeBarActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 18,
    marginTop: 8,
  },
  aiChangeAction: {
    paddingVertical: 4,
  },
  aiChangeActionKeep: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.successEmphasis,
  },
  aiChangeActionRevert: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.danger,
  },
  aiModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20100,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  aiModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    padding: 14,
    maxHeight: '80%',
  },
  aiModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  aiModalTaskTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  aiModalTaskMeta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  aiModalBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  aiModalBodyMuted: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  aiModalList: {
    marginTop: 12,
    gap: 4,
  },
  aiModalListTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  aiModalListItem: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  aiModalPrimaryBtn: {
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primaryButtonBg,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiModalPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.primaryButtonText,
  },
});
}
