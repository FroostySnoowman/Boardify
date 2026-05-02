import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBlock } from './SkeletonBlock';
import { useTheme } from '../../theme';
import type { ThemeColors } from '../../theme/colors';

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    keyRow: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    metaLine: {
      marginTop: 8,
    },
    revokeLine: {
      marginTop: 10,
    },
  });
}

export function ApiKeysListSkeleton() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const rowMetaWidths: Array<'78%' | '65%' | '82%'> = ['78%', '65%', '82%'];
  const rowTitleWidths: Array<'48%' | '56%' | '40%'> = ['48%', '56%', '40%'];

  return (
    <View accessibilityLabel="Loading API keys">
      {[0, 1, 2].map((i) => (
        <View key={i} style={s.keyRow}>
          <SkeletonBlock height={17} width={rowTitleWidths[i]} borderRadius={6} variant="warm" />
          <SkeletonBlock
            height={13}
            width={rowMetaWidths[i]}
            borderRadius={5}
            variant="warm"
            style={s.metaLine}
          />
          <SkeletonBlock height={14} width={52} borderRadius={4} variant="warm" style={s.revokeLine} />
        </View>
      ))}
    </View>
  );
}
