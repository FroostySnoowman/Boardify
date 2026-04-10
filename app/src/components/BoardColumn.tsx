import React, { useRef, useCallback, useEffect, memo, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  TextInput,
  Keyboard,
} from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import Animated, { Easing, LinearTransition } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { DraggableBoardCard } from './DraggableBoardCard';
import { DraggableColumnHeader } from './DraggableColumnHeader';
import { BoardCardPlaceholder } from './BoardCardPlaceholder';
import type { SharedValue } from 'react-native-reanimated';
import type { BoardCardData } from '../types/board';
import { useTheme } from '../theme';
import type { ThemeColors } from '../theme/colors';

const COLUMN_SHIFT = 5;

const ROW_LAYOUT = LinearTransition.duration(200).easing(Easing.out(Easing.cubic));

export interface BoardColumnProps {
  title: string;
  cards: BoardCardData[];
  onAddCard?: () => void;
  addCardComposerOpen?: boolean;
  addCardComposerValue?: string;
  onAddCardComposerChangeText?: (text: string) => void;
  onAddCardComposerSubmit?: () => void;
  onAddCardComposerCancel?: () => void;
  onCardPress?: (
    columnIndex: number,
    cardIndex: number,
    layout: { x: number; y: number; width: number; height: number }
  ) => void;
  expandedCardId?: string | null;
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
  listDraggingActive?: boolean;
  isDraggingThisColumn?: boolean;
  columnDragEnabled?: boolean;
  translateListX: SharedValue<number>;
  translateListY: SharedValue<number>;
  scaleList: SharedValue<number>;
  onColumnListDragBegin: (args: {
    columnIndex: number;
    measure: (cb: (x: number, y: number, w: number, h: number) => void) => void;
  }) => void;
  onColumnListDragMove: (absoluteX: number, absoluteY: number) => void;
  onColumnListDragEnd: () => void;
  onColumnWrapLayout: (colIndex: number, rect: { x: number; y: number; width: number; height: number }) => void;
  columnWidth?: number;
  columnMaxHeight?: number;
  cardScrollMaxHeight?: number;
}

function BoardColumnInner({
  title,
  cards,
  onAddCard,
  addCardComposerOpen = false,
  addCardComposerValue = '',
  onAddCardComposerChangeText,
  onAddCardComposerSubmit,
  onAddCardComposerCancel,
  onCardPress,
  expandedCardId,
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
  listDraggingActive = false,
  isDraggingThisColumn = false,
  columnDragEnabled = true,
  translateListX,
  translateListY,
  scaleList,
  onColumnListDragBegin,
  onColumnListDragMove,
  onColumnListDragEnd,
  onColumnWrapLayout,
  columnWidth,
  columnMaxHeight,
  cardScrollMaxHeight,
}: BoardColumnProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createBoardColumnStyles(colors), [colors]);
  const cardRefs = useRef<Record<string, React.ElementRef<typeof DraggableBoardCard> | null>>({});
  const listRef = useRef<React.ElementRef<typeof GHScrollView> | null>(null);
  const wrapRef = useRef<View | null>(null);
  const composerInputRef = useRef<TextInput>(null);

  const handleAddCard = () => {
    hapticLight();
    onAddCard?.();
  };

  useEffect(() => {
    if (!addCardComposerOpen) return;
    const t = setTimeout(() => {
      composerInputRef.current?.focus();
      listRef.current?.scrollToEnd({ animated: true });
    }, 120);
    return () => clearTimeout(t);
  }, [addCardComposerOpen]);

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

  const measureWrap = useCallback(() => {
    wrapRef.current?.measureInWindow((x, y, w, h) => {
      onColumnWrapLayout(columnIndex, { x, y, width: w, height: h });
    });
  }, [columnIndex, onColumnWrapLayout]);

  const remeasureColumn = useCallback(() => {
    requestAnimationFrame(() => {
      measureList();
      measureWrap();
    });
  }, [measureList, measureWrap]);

  useEffect(() => {
    registerColumnMeasure?.(columnIndex, remeasureColumn);
    return () => unregisterColumnMeasure?.(columnIndex);
  }, [columnIndex, remeasureColumn, registerColumnMeasure, unregisterColumnMeasure]);

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
          dragEnabled={
            !listDraggingActive && (draggingCardId === null || draggingCardId === c.id)
          }
          translateX={translateX}
          translateY={translateY}
          scale={scale}
          isDraggingThis={draggingCardId === c.id}
          hidden={expandedCardId != null && expandedCardId === c.id}
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
    <Animated.View
      ref={wrapRef}
      collapsable={false}
      layout={ROW_LAYOUT}
      style={[
        styles.wrap,
        columnWidth != null && { width: columnWidth, marginRight: 0 },
        isDraggingThisColumn && styles.wrapDraggingSource,
      ]}
      onLayout={remeasureColumn}
    >
      <View style={styles.shadow} />
      <View style={[styles.column, columnMaxHeight != null && { maxHeight: columnMaxHeight }]}>
        <DraggableColumnHeader
          title={title}
          cardCount={cards.length}
          columnIndex={columnIndex}
          dragEnabled={columnDragEnabled}
          translateX={translateListX}
          translateY={translateListY}
          scale={scaleList}
          onDragBegin={onColumnListDragBegin}
          onDragMove={onColumnListDragMove}
          onDragEnd={onColumnListDragEnd}
        />
        <GHScrollView
          ref={(r: React.ElementRef<typeof GHScrollView> | null) => {
            listRef.current = r;
            onScrollViewRef?.(r);
          }}
          scrollEnabled={listScrollEnabled}
          style={[styles.cardScroll, cardScrollMaxHeight != null && { maxHeight: cardScrollMaxHeight }]}
          contentContainerStyle={styles.cardList}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          // @ts-expect-error RN ScrollView iOS prop; RNGH typings omit it
          delayContentTouches={false}
          onScroll={(e) => onColumnScroll(columnIndex, e.nativeEvent.contentOffset.y)}
          onLayout={remeasureColumn}
        >
          {nodes}
        </GHScrollView>
        {addCardComposerOpen ? (
          <View style={styles.composer}>
            <View style={styles.composerCard}>
              <TextInput
                ref={composerInputRef}
                value={addCardComposerValue}
                onChangeText={onAddCardComposerChangeText}
                placeholder="Enter a title for this card…"
                placeholderTextColor={colors.placeholder}
                style={styles.composerInput}
                multiline
                scrollEnabled
                maxLength={500}
                returnKeyType="default"
                blurOnSubmit={false}
                autoCorrect
                autoCapitalize="sentences"
              />
              <View style={styles.composerExpandHint} pointerEvents="none">
                <Feather name="maximize-2" size={14} color={colors.placeholder} />
              </View>
            </View>
            <View style={styles.composerActions}>
              <Pressable
                onPress={() => {
                  hapticLight();
                  Keyboard.dismiss();
                  onAddCardComposerCancel?.();
                }}
                hitSlop={8}
                style={styles.composerActionHit}
              >
                <Text style={styles.composerActionCancel}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!addCardComposerValue.trim()) return;
                  hapticLight();
                  Keyboard.dismiss();
                  onAddCardComposerSubmit?.();
                }}
                hitSlop={8}
                style={styles.composerActionHit}
                disabled={!addCardComposerValue.trim()}
              >
                <Text
                  style={[
                    styles.composerActionAdd,
                    !addCardComposerValue.trim() && styles.composerActionAddDisabled,
                  ]}
                >
                  Add
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <TouchableOpacity activeOpacity={0.8} onPress={handleAddCard} style={styles.addCard}>
            <Feather name="plus" size={18} color={colors.iconChevron} />
            <Text style={styles.addCardText}>Add card</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

export const BoardColumn = memo(BoardColumnInner);

function createBoardColumnStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      position: 'relative',
      width: 280,
      marginRight: 16,
      flexShrink: 0,
    },
    wrapDraggingSource: {
      width: 0,
      minWidth: 0,
      marginRight: 0,
      opacity: 0,
      overflow: 'hidden',
    },
    shadow: {
      position: 'absolute',
      left: COLUMN_SHIFT,
      top: COLUMN_SHIFT,
      right: -COLUMN_SHIFT,
      bottom: -COLUMN_SHIFT,
      backgroundColor: colors.shadowFillColumn,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    column: {
      position: 'relative',
      zIndex: 1,
      backgroundColor: colors.columnSurface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 12,
      paddingHorizontal: 12,
      maxHeight: 520,
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
      color: colors.textSecondary,
      fontWeight: '500',
    },
    composer: {
      marginTop: 4,
      gap: 10,
    },
    composerCard: {
      position: 'relative',
      backgroundColor: colors.cardFaceOnColumn,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 88,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 28,
      paddingRight: 28,
    },
    composerInput: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textPrimary,
      lineHeight: 18,
      minHeight: 48,
      textAlignVertical: 'top',
    },
    composerExpandHint: {
      position: 'absolute',
      right: 8,
      bottom: 8,
      opacity: 0.85,
    },
    composerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    composerActionHit: {
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    composerActionCancel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.boardLink,
    },
    composerActionAdd: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.boardLink,
    },
    composerActionAddDisabled: {
      color: colors.boardLink,
      opacity: 0.35,
    },
  });
}
