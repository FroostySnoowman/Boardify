import React, { useCallback, forwardRef, useRef, useMemo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, withSpring } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { BoardCard } from './BoardCard';
import type { BoardCardData } from '../types/board';
import { BOARD_CARD_ROW_HEIGHT } from '../board/boardDragUtils';
import { hapticMedium } from '../utils/haptics';

type DraggableBoardCardProps = {
  card: BoardCardData;
  columnIndex: number;
  cardIndex: number;
  dragEnabled: boolean;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
  isDraggingThis: boolean;
  onPress: () => void;
  onDragBegin: (args: {
    card: BoardCardData;
    columnIndex: number;
    cardIndex: number;
    measure: (cb: (x: number, y: number, w: number, h: number) => void) => void;
  }) => void;
  onDragMove: (absoluteX: number, absoluteY: number) => void;
  onDragEnd: () => void;
  hidden?: boolean;
};

type LatestRef = {
  onPress: () => void;
  onDragBegin: DraggableBoardCardProps['onDragBegin'];
  onDragMove: DraggableBoardCardProps['onDragMove'];
  onDragEnd: DraggableBoardCardProps['onDragEnd'];
  card: BoardCardData;
  columnIndex: number;
  cardIndex: number;
};

export const DraggableBoardCard = forwardRef<View, DraggableBoardCardProps>(function DraggableBoardCard(
  {
    card,
    columnIndex,
    cardIndex,
    dragEnabled,
    translateX,
    translateY,
    scale,
    isDraggingThis,
    onPress,
    onDragBegin,
    onDragMove,
    onDragEnd,
    hidden,
  },
  ref
) {
  const measureRef = useRef<View | null>(null);
  const latestRef = useRef<LatestRef>({
    onPress,
    onDragBegin,
    onDragMove,
    onDragEnd,
    card,
    columnIndex,
    cardIndex,
  });

  useEffect(() => {
    latestRef.current = {
      onPress,
      onDragBegin,
      onDragMove,
      onDragEnd,
      card,
      columnIndex,
      cardIndex,
    };
  });

  const setMeasureRef = useCallback(
    (node: View | null) => {
      measureRef.current = node;
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref != null) {
        (ref as React.MutableRefObject<View | null>).current = node;
      }
    },
    [ref]
  );

  /** Stable for runOnJS + useMemo — read latest handlers from latestRef */
  const notifyPress = useCallback(() => {
    latestRef.current.onPress();
  }, []);

  const notifyDragBegin = useCallback(() => {
    hapticMedium();
    const { card: c, columnIndex: col, cardIndex: idx, onDragBegin: begin } = latestRef.current;
    const measure = (cb: (x: number, y: number, w: number, h: number) => void) => {
      measureRef.current?.measureInWindow(cb);
    };
    begin({ card: c, columnIndex: col, cardIndex: idx, measure });
  }, []);

  const notifyMove = useCallback((absoluteX: number, absoluteY: number) => {
    latestRef.current.onDragMove(absoluteX, absoluteY);
  }, []);

  const notifyEnd = useCallback(() => {
    latestRef.current.onDragEnd();
  }, []);

  const gesture = useMemo(() => {
    const enabled = dragEnabled && !hidden;

    const tap = Gesture.Tap()
      .enabled(enabled)
      .maxDuration(320)
      .onEnd(() => {
        runOnJS(notifyPress)();
      });

    const pan = Gesture.Pan()
      .enabled(enabled)
      .activateAfterLongPress(400)
      /** Critical: default true cancels pan when finger leaves the card — drag would "stick" */
      .shouldCancelWhenOutside(false)
      .onStart(() => {
        runOnJS(notifyDragBegin)();
        scale.value = withSpring(1.04, { damping: 18, stiffness: 340 });
      })
      .onUpdate((e) => {
        translateX.value = e.translationX;
        translateY.value = e.translationY;
        runOnJS(notifyMove)(e.absoluteX, e.absoluteY);
      })
      .onEnd(() => {
        scale.value = withSpring(1, { damping: 20, stiffness: 400 });
        translateX.value = withSpring(0, { damping: 24, stiffness: 420 });
        translateY.value = withSpring(0, { damping: 24, stiffness: 420 });
        runOnJS(notifyEnd)();
      });

    return Gesture.Exclusive(pan, tap);
  }, [dragEnabled, hidden, notifyPress, notifyDragBegin, notifyMove, notifyEnd, translateX, translateY, scale]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        ref={setMeasureRef}
        collapsable={false}
        style={[
          styles.wrap,
          { opacity: isDraggingThis ? 0 : 1 },
          isDraggingThis && styles.draggingSourceLayout,
        ]}
      >
        <BoardCard
          title={card.title}
          subtitle={card.subtitle}
          labelColor={card.labelColor}
          suppressPress
          hidden={hidden}
        />
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  /** Pull source row out of layout so placeholder + hidden row don't double the gap */
  draggingSourceLayout: {
    height: 0,
    overflow: 'visible',
    marginBottom: -BOARD_CARD_ROW_HEIGHT,
  },
});
