import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTopNav, MOBILE_NAV_HEIGHT } from './AppTopNav';
import { useAuth } from '../contexts/AuthContext';

/**
 * Renders the liquid-glass top bar *inside* the tab screen subtree.
 * Siblings of NativeTabs (react-native-screens Tabs.Host) paint under native
 * tab content — this wrapper fixes that by compositing the bar with the screen.
 */
export function TabScreenChrome({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();
  const topInset = MOBILE_NAV_HEIGHT + insets.top;

  return (
    <View style={styles.root} collapsable={false}>
      <AppTopNav user={user} loading={loading} />
      <View style={[styles.body, { paddingTop: topInset }]} collapsable={false}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5f0e8',
  },
  body: {
    flex: 1,
    zIndex: 0,
  },
});
