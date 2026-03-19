import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { BoardColumn } from '../components/BoardColumn';
import {
  BoardCardExpandOverlay,
  type ExpandedCardData,
} from '../components/BoardCardExpandOverlay';
import { BoardCard } from '../components/BoardCard';
import type { BoardCardData, BoardColumnData } from '../types/board';
import {
  BOARD_CARD_ROW_HEIGHT,
  computeHoverInsertIndex,
  moveCardToHover,
} from '../board/boardDragUtils';

const SHIFT = 5;

const INITIAL_COLUMNS: BoardColumnData[] = [
  {
    title: 'To Do',
    cards: [
      { id: 'c-0-0', title: 'Review design mockups', subtitle: 'Due Fri', labelColor: '#F3D9B1' },
      { id: 'c-0-1', title: 'Sync with backend API', labelColor: '#a5d6a5' },
      { id: 'c-0-2', title: 'Update onboarding flow' },
    ],
  },
  {
    title: 'In Progress',
    cards: [
      { id: 'c-1-0', title: 'Board view layout', subtitle: 'You', labelColor: '#a5d6a5' },
      { id: 'c-1-1', title: 'Card drag-and-drop', labelColor: '#F3D9B1' },
    ],
  },
  {
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

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface BoardScreenProps {
  boardName?: string;
  onBack?: () => void;
}

export default function BoardScreen({ boardName = 'My Board', onBack }: BoardScreenProps) {
  const insets = useSafeAreaInsets();
  const [columns, setColumns] = useState<BoardColumnData[]>(INITIAL_COLUMNS);
  const [expanded, setExpanded] = useState<ExpandedCardData | null>(null);
  const [dragging, setDragging] = useState<DraggingState | null>(null);
  const [hoverTarget, setHoverTarget] = useState<{ col: number; insertIndex: number } | null>(null);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

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

  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);
  useEffect(() => {
    hoverRef.current = hoverTarget;
  }, [hoverTarget]);

  const isWeb = Platform.OS === 'web';

  const handleCardPress = useCallback(
    (
      columnIndex: number,
      cardIndex: number,
      layout: { x: number; y: number; width: number; height: number }
    ) => {
      const col = columns[columnIndex];
      const card = col?.cards[cardIndex];
      if (!col || !card) return;
      setExpanded({
        title: card.title,
        subtitle: card.subtitle,
        labelColor: card.labelColor,
        columnTitle: col.title,
        layout: {
          x: Math.round(layout.x),
          y: Math.round(layout.y),
          width: Math.round(layout.width),
          height: Math.round(layout.height),
        },
        columnIndex,
        cardIndex,
      });
    },
    [columns]
  );

  const expandedCardKey =
    expanded == null ? null : `${expanded.columnIndex}-${expanded.cardIndex}`;

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
      setHoverTarget((prev) => {
        if (prev == null && next == null) return prev;
        if (prev != null && next != null && prev.col === next.col && prev.insertIndex === next.insertIndex) {
          return prev;
        }
        return next;
      });
    },
    [computeHover]
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
    const d = draggingRef.current;
    const h = hoverRef.current;
    if (d && h) {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
      );
      setColumns((prev) => moveCardToHover(prev, d.cardId, d.fromCol, h.col, h.insertIndex));
    }
    draggingRef.current = null;
    setDragging(null);
    setHoverTarget(null);
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
  }, [translateX, translateY, scale]);

  useEffect(() => {
    if (!dragging) return;
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
  }, [dragging, columns.length, remeasureAllColumns]);

  const overlayStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const draggingCard = dragging
    ? columns[dragging.fromCol]?.cards.find((c) => c.id === dragging.cardId)
    : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              onBack();
            }}
            style={styles.backBtn}
            hitSlop={12}
          >
            <Feather name="arrow-left" size={24} color="#0a0a0a" />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>{boardName}</Text>
        <TouchableOpacity onPress={() => hapticLight()} style={styles.menuBtn}>
          <Feather name="more-horizontal" size={22} color="#0a0a0a" />
        </TouchableOpacity>
      </View>

      <GHScrollView
        ref={horizontalScrollRef}
        horizontal
        scrollEnabled={dragging === null}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.columnsScroll,
          { paddingHorizontal: isWeb ? 24 : 16 },
        ]}
        style={styles.columnsScrollView}
        nestedScrollEnabled
        scrollEventThrottle={16}
        // iOS: UIScrollView delays touches to children by default — breaks long-press drag on cards
        // @ts-expect-error RN ScrollView iOS prop; RNGH typings omit it
        delayContentTouches={false}
        onScroll={(e) => {
          horizontalScrollXRef.current = e.nativeEvent.contentOffset.x;
          requestAnimationFrame(remeasureAllColumns);
        }}
      >
        {columns.map((col, i) => (
          <BoardColumn
            key={col.title + i}
            columnIndex={i}
            title={col.title}
            cards={col.cards}
            onAddCard={() => {}}
            expandedCardKey={expandedCardKey}
            onCardPress={(cardIndex, layout) => handleCardPress(i, cardIndex, layout)}
            draggingCardId={dragging?.cardId ?? null}
            hoverTarget={hoverTarget}
            onListLayout={onListLayout}
            onColumnScroll={onColumnScroll}
            translateX={translateX}
            translateY={translateY}
            scale={scale}
            onDragBegin={onDragBegin}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onScrollViewRef={(ref) => {
              columnScrollRefs.current[i] = ref;
            }}
            registerColumnMeasure={registerColumnMeasure}
            unregisterColumnMeasure={unregisterColumnMeasure}
            listScrollEnabled={dragging === null}
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

      {dragging && draggingCard ? (
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

      {expanded ? (
        <BoardCardExpandOverlay data={expanded} onClose={() => setExpanded(null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f0e8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  menuBtn: {
    padding: 4,
  },
  columnsScrollView: {
    flexGrow: 1,
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
});
