import React, { useCallback, useRef, useMemo, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import type { BoardCardData } from '../types/board';
import { hapticMedium } from '../utils/haptics';

export type TableRowDragBeginArgs = {
  card: BoardCardData;
  columnIndex: number;
  cardIndex: number;
  measure: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

type Props = {
  card: BoardCardData;
  columnIndex: number;
  cardIndex: number;
  dragEnabled: boolean;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
  isDraggingThis: boolean;
  onDragBegin: (args: TableRowDragBeginArgs) => void;
  onDragMove: (absoluteX: number, absoluteY: number) => void;
  onDragEnd: () => void;
  children: React.ReactNode;
};

type LatestRef = {
  onDragBegin: Props['onDragBegin'];
  onDragMove: Props['onDragMove'];
  onDragEnd: Props['onDragEnd'];
  card: BoardCardData;
  columnIndex: number;
  cardIndex: number;
};

export function DraggableTableRow({
  card,
  columnIndex,
  cardIndex,
  dragEnabled,
  translateX,
  translateY,
  scale,
  isDraggingThis,
  onDragBegin,
  onDragMove,
  onDragEnd,
  children,
}: Props) {
  const measureRef = useRef<View | null>(null);
  const latestRef = useRef<LatestRef>({
    onDragBegin,
    onDragMove,
    onDragEnd,
    card,
    columnIndex,
    cardIndex,
  });

  useEffect(() => {
    latestRef.current = {
      onDragBegin,
      onDragMove,
      onDragEnd,
      card,
      columnIndex,
      cardIndex,
    };
  });

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
    const pan = Gesture.Pan()
      .enabled(dragEnabled)
      .activateAfterLongPress(400)
      .shouldCancelWhenOutside(false)
      .onStart(() => {
        translateX.value = 0;
        translateY.value = 0;
        scale.value = 1;
        runOnJS(notifyDragBegin)();
        scale.value = 1.03;
      })
      .onUpdate((e) => {
        translateX.value = e.translationX;
        translateY.value = e.translationY;
        runOnJS(notifyMove)(e.absoluteX, e.absoluteY);
      })
      .onEnd(() => {
        runOnJS(notifyEnd)();
      });

    return pan;
  }, [dragEnabled, notifyDragBegin, notifyMove, notifyEnd, translateX, translateY, scale]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        ref={measureRef}
        collapsable={false}
        style={[styles.wrap, isDraggingThis && styles.draggingSourceLayout]}
      >
        {children}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  draggingSourceLayout: {
    height: 0,
    minHeight: 0,
    overflow: 'hidden',
    opacity: 0,
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingVertical: 0,
  },
});
