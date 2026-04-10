import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOBILE_NAV_HEIGHT } from './AppTopNav';
import { useTheme } from '../theme';

export function TabScreenChrome({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const topInset = MOBILE_NAV_HEIGHT + insets.top;
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        body: {
          flex: 1,
          zIndex: 0,
          elevation: 0,
        },
      }),
    [colors.canvas]
  );

  return (
    <View style={styles.root} collapsable={false}>
      <View style={[styles.body, { paddingTop: topInset }]} collapsable={false}>
        {children}
      </View>
    </View>
  );
}
