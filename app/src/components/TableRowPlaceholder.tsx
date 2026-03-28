import React from 'react';
import { View, StyleSheet } from 'react-native';

/** Dashed gap for table row DnD; width matches table row band. */
export function TableRowPlaceholder({ tableWidth }: { tableWidth: number }) {
  return (
    <View style={[styles.row, { width: tableWidth }]}>
      <View style={styles.inner} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e8e8',
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  inner: {
    marginVertical: 4,
    marginHorizontal: 8,
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(10,10,10,0.22)',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
