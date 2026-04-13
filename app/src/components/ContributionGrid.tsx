import React from 'react';
import { View, StyleSheet } from 'react-native';

const COLS = 7;
const ROWS = 5;

export type ContributionGridTheme = 'reading' | 'running';

const readingColors: Record<number, string> = {
  0: '#e5e5e5',
  1: '#e8dcc8',
  2: '#d4c4a8',
  3: '#c9a86c',
  4: '#a88b4a',
};

const runningColors: Record<number, string> = {
  0: '#e5e5e5',
  1: '#c8e6c8',
  2: '#a5d6a5',
  3: '#81c784',
  4: '#2e7d32',
};

interface ContributionGridProps {
  theme: ContributionGridTheme;
  data?: number[];
  cellSize?: number;
  gap?: number;
}

export function ContributionGrid({
  theme,
  data,
  cellSize = 10,
  gap = 3,
}: ContributionGridProps) {
  const colors = theme === 'reading' ? readingColors : runningColors;
  const values = data ?? [];

  return (
    <View style={styles.container}>
      {Array.from({ length: ROWS }, (_, row) => (
        <View key={row} style={[styles.row, { gap }]}>
          {Array.from({ length: COLS }, (_, col) => {
            const value = values[row * COLS + col] ?? 0;
            const bg = colors[Math.min(value, 4)] ?? colors[0];
            return (
              <View
                key={col}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: bg,
                    borderRadius: Math.max(2, cellSize / 5),
                    borderWidth: 1,
                    borderColor: '#000',
                  },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 3,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {},
});
