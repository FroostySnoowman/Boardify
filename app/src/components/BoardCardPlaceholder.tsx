import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BOARD_CARD_ROW_HEIGHT } from '../board/boardDragUtils';

export function BoardCardPlaceholder({ height = BOARD_CARD_ROW_HEIGHT }: { height?: number }) {
  return (
    <View style={[styles.wrap, { minHeight: height }]}>
      <View style={styles.inner} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 4,
    marginRight: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(10,10,10,0.25)',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  inner: {
    minHeight: 56,
  },
});
