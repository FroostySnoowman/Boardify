import React, { useCallback, useRef, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { hapticMedium } from '../utils/haptics';

type Props = {
  title: string;
  cardCount: number;
  columnIndex: number;
  dragEnabled: boolean;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
  onDragBegin: (args: {
    columnIndex: number;
    measure: (cb: (x: number, y: number, w: number, h: number) => void) => void;
  }) => void;
  onDragMove: (absoluteX: number, absoluteY: number) => void;
  onDragEnd: () => void;
};

type LatestRef = {
  onDragBegin: Props['onDragBegin'];
  onDragMove: Props['onDragMove'];
  onDragEnd: Props['onDragEnd'];
  columnIndex: number;
};

export function DraggableColumnHeader({
  title,
  cardCount,
  columnIndex,
  dragEnabled,
  translateX,
  translateY,
  scale,
  onDragBegin,
  onDragMove,
  onDragEnd,
}: Props) {
  const measureRef = useRef<View | null>(null);
  const latestRef = useRef<LatestRef>({
    onDragBegin,
    onDragMove,
    onDragEnd,
    columnIndex,
  });

  useEffect(() => {
    latestRef.current = {
      onDragBegin,
      onDragMove,
      onDragEnd,
      columnIndex,
    };
  });

  const notifyDragBegin = useCallback(() => {
    hapticMedium();
    const { columnIndex: col, onDragBegin: begin } = latestRef.current;
    const measure = (cb: (x: number, y: number, w: number, h: number) => void) => {
      measureRef.current?.measureInWindow(cb);
    };
    begin({ columnIndex: col, measure });
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
        scale.value = 1.04;
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
        style={styles.header}
        accessibilityLabel={`${title} list. Long press to reorder.`}
        accessibilityRole="button"
      >
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.count}>{cardCount}</Text>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
    paddingVertical: 4,
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
});
