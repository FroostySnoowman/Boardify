import React from 'react';
import { View, StyleSheet } from 'react-native';

/** Horizontal gap while reordering lists (matches [BoardColumn.tsx](BoardColumn.tsx) wrap width + margin). */
const PLACEHOLDER_MIN_HEIGHT = 200;

export function BoardColumnPlaceholder() {
  return (
    <View style={styles.wrap}>
      <View style={styles.inner} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 280,
    marginRight: 16,
    flexShrink: 0,
    minHeight: PLACEHOLDER_MIN_HEIGHT,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(10,10,10,0.28)',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  inner: {
    flex: 1,
    minHeight: PLACEHOLDER_MIN_HEIGHT - 8,
  },
});
