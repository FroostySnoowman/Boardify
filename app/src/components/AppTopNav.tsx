import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivitiesHeader, MOBILE_NAV_HEIGHT } from './ActivitiesHeader';

export { MOBILE_NAV_HEIGHT };

/** Cream bar matching the rest of the app (`#f5f0e8`); glass controls stay above scroll content. */
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

const styles = StyleSheet.create({
  bar: {
    zIndex: 999,
    elevation: 10,
    overflow: 'visible',
    backgroundColor: '#f5f0e8',
  },
  barInner: {
    flex: 1,
  },
});
