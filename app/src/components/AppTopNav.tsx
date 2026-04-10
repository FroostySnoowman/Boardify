import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivitiesHeader, MOBILE_NAV_HEIGHT } from './ActivitiesHeader';
import { useTheme } from '../theme';

export { MOBILE_NAV_HEIGHT };

interface User {
  profilePictureUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
}

export function AppTopNav({
  user,
  loading: _loading,
}: {
  user?: User | null;
  loading?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const totalHeight = MOBILE_NAV_HEIGHT + insets.top;
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        bar: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50_000,
          elevation: 48,
          overflow: 'visible',
          backgroundColor: colors.canvas,
        },
        barInner: {
          flex: 1,
          overflow: 'visible',
          zIndex: 50_000,
        },
      }),
    [colors.canvas]
  );

  return (
    <View
      style={[styles.bar, { height: totalHeight, paddingTop: insets.top }]}
      className="absolute left-0 right-0 top-0"
      collapsable={false}
    >
      <View style={styles.barInner}>
        <ActivitiesHeader embeddedInLayout user={user} />
      </View>
    </View>
  );
}
