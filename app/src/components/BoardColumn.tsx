import React, { useRef, useCallback, useEffect, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, { Easing, LinearTransition, type SharedValue } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { DraggableBoardCard } from './DraggableBoardCard';
import { BoardCardPlaceholder } from './BoardCardPlaceholder';
import type { BoardCardData } from '../types/board';

const COLUMN_SHIFT = 5;

const ROW_LAYOUT = LinearTransition.duration(200).easing(Easing.out(Easing.cubic));

export interface BoardColumnProps {
  title: string;
  cards: BoardCardData[];
  onAddCard?: () => void;
  onCardPress?: (
    columnIndex: number,
    cardIndex: number,
    layout: { x: number; y: number; width: number; height: number }
  ) => void;
  expandedCardKey?: string | null;
  columnIndex: number;
  draggingCardId: string | null;
  hoverInsertIndex: number;
  onListLayout: (colIndex: number, rect: { x: number; y: number; width: number; height: number }) => void;
  onColumnScroll: (colIndex: number, scrollY: number) => void;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
  onDragBegin: (args: {
    card: BoardCardData;
    columnIndex: number;
    cardIndex: number;
    measure: (cb: (x: number, y: number, w: number, h: number) => void) => void;
  }) => void;
  onDragMove: (absoluteX: number, absoluteY: number) => void;
  onDragEnd: () => void;
  onScrollViewRef?: (ref: React.ElementRef<typeof GHScrollView> | null) => void;
  registerColumnMeasure?: (colIndex: number, fn: () => void) => void;
  unregisterColumnMeasure?: (colIndex: number) => void;
  listScrollEnabled?: boolean;
}

function BoardColumnInner({
  title,
  cards,
  onAddCard,
  onCardPress,
  expandedCardKey,
  columnIndex,
  draggingCardId,
  hoverInsertIndex,
  onListLayout,
  onColumnScroll,
  translateX,
  translateY,
  scale,
  onDragBegin,
  onDragMove,
  onDragEnd,
  onScrollViewRef,
  registerColumnMeasure,
  unregisterColumnMeasure,
  listScrollEnabled = true,
}: BoardColumnProps) {
  const cardRefs = useRef<Record<string, React.ElementRef<typeof DraggableBoardCard> | null>>({});
  const listRef = useRef<React.ElementRef<typeof GHScrollView> | null>(null);

  const handleAddCard = () => {
    hapticLight();
    onAddCard?.();
  };

  const measureList = useCallback(() => {
    const node = listRef.current as
      | (React.ElementRef<typeof GHScrollView> & {
          measureInWindow(cb: (x: number, y: number, width: number, height: number) => void): void;
        })
      | null;
    node?.measureInWindow?.((x: number, y: number, width: number, height: number) => {
      onListLayout(columnIndex, { x, y, width, height });
    });
  }, [columnIndex, onListLayout]);

  useEffect(() => {
    registerColumnMeasure?.(columnIndex, measureList);
    return () => unregisterColumnMeasure?.(columnIndex);
  }, [columnIndex, measureList, registerColumnMeasure, unregisterColumnMeasure]);

  const insertAt = hoverInsertIndex;

  const nodes: React.ReactNode[] = [];
  let virtualIndex = 0;

  for (const c of cards) {
    const originalIndex = cards.findIndex((x) => x.id === c.id);
    const isBeingDragged = draggingCardId === c.id;

    if (!isBeingDragged && insertAt === virtualIndex) {
      nodes.push(
        <Animated.View key={`gap-${columnIndex}-${virtualIndex}`} layout={ROW_LAYOUT}>
          <BoardCardPlaceholder />
        </Animated.View>
      );
    }

    nodes.push(
      <Animated.View key={c.id} layout={ROW_LAYOUT}>
        <DraggableBoardCard
          ref={(el) => {
            cardRefs.current[c.id] = el;
          }}
          card={c}
          columnIndex={columnIndex}
          cardIndex={originalIndex}
          dragEnabled={draggingCardId === null || draggingCardId === c.id}
          translateX={translateX}
          translateY={translateY}
          scale={scale}
          isDraggingThis={draggingCardId === c.id}
          hidden={expandedCardKey === `${columnIndex}-${originalIndex}`}
          onPress={() => {
            const node = cardRefs.current[c.id];
            if (!node || !onCardPress) return;
            node.measureInWindow((x, y, width, height) => {
              onCardPress(columnIndex, originalIndex, { x, y, width, height });
            });
          }}
          onDragBegin={onDragBegin}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      </Animated.View>
    );

    if (!isBeingDragged) {
      virtualIndex += 1;
    }
  }

  if (insertAt === virtualIndex) {
    nodes.push(
      <Animated.View key={`gap-${columnIndex}-tail-${virtualIndex}`} layout={ROW_LAYOUT}>
        <BoardCardPlaceholder />
      </Animated.View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.shadow} />
      <View style={styles.column}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.count}>{cards.length}</Text>
        </View>
        <GHScrollView
          ref={(r: React.ElementRef<typeof GHScrollView> | null) => {
            listRef.current = r;
            onScrollViewRef?.(r);
          }}
          scrollEnabled={listScrollEnabled}
          style={styles.cardScroll}
          contentContainerStyle={styles.cardList}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          // @ts-expect-error RN ScrollView iOS prop; RNGH typings omit it
          delayContentTouches={false}
          onScroll={(e) => onColumnScroll(columnIndex, e.nativeEvent.contentOffset.y)}
          onLayout={() => {
            requestAnimationFrame(measureList);
          }}
        >
          {nodes}
        </GHScrollView>
        <TouchableOpacity activeOpacity={0.8} onPress={handleAddCard} style={styles.addCard}>
          <Feather name="plus" size={18} color="#666" />
          <Text style={styles.addCardText}>Add card</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const BoardColumn = memo(BoardColumnInner);

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    width: 280,
    marginRight: 16,
    flexShrink: 0,
  },
  shadow: {
    position: 'absolute',
    left: COLUMN_SHIFT,
    top: COLUMN_SHIFT,
    right: -COLUMN_SHIFT,
    bottom: -COLUMN_SHIFT,
    backgroundColor: '#000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
  },
  column: {
    position: 'relative',
    zIndex: 1,
    backgroundColor: '#e8e8e8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 12,
    paddingHorizontal: 12,
    maxHeight: 520,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0a0a0a',
    flex: 1,
  },
  count: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  cardScroll: {
    maxHeight: 420,
  },
  cardList: {
    flexGrow: 1,
    paddingBottom: 4,
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 4,
  },
  addCardText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
});
