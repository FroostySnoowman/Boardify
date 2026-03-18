import React from 'react';
import { Platform, DynamicColorIOS, View, StyleSheet, StatusBar } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivitiesHeader, ACTIVITIES_HEADER_HEIGHT, WebTopNav } from '../../src/components';
import { useAuth } from '../../src/contexts/AuthContext';

const TabIcon = NativeTabs.Trigger.Icon;
const TabLabel = NativeTabs.Trigger.Label;

const TAB_ITEMS = [
  { name: 'index', label: 'Home', iosIcon: 'house', androidIcon: 'home' as const, webIcon: 'home' as const },
  { name: 'about', label: 'About', iosIcon: 'calendar', androidIcon: 'calendar' as const, webIcon: 'calendar' as const },
] as const;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();
  const useNativeTabs = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const pathname = usePathname();

  const tabBarTintColor = Platform.OS === 'ios'
    ? DynamicColorIOS({ dark: '#0a0a0a', light: '#0a0a0a' })
    : '#0a0a0a';
  const tabBarLabelColor = Platform.OS === 'ios'
    ? DynamicColorIOS({ dark: 'rgba(10,10,10,0.6)', light: 'rgba(10,10,10,0.6)' })
    : 'rgba(10,10,10,0.6)';

  if (isWeb) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f0e8" />
        <WebTopNav
          user={user}
          loading={loading}
          tabs={TAB_ITEMS}
        />
        <View style={[styles.contentWrapper, { paddingTop: 0 }]}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: { display: 'none' },
            }}
          >
            {TAB_ITEMS.map((item) => (
              <Tabs.Screen
                key={item.name}
                name={item.name}
                options={{ title: item.label }}
              />
            ))}
          </Tabs>
        </View>
      </View>
    );
  }

  const isActivitiesHome = pathname === '/(tabs)' || pathname === '/' || pathname === '/(tabs)/index';
  const headerHeight = isActivitiesHome ? ACTIVITIES_HEADER_HEIGHT : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f0e8" />
      {isActivitiesHome ? <ActivitiesHeader /> : null}
      <View style={[styles.contentWrapper, { paddingTop: headerHeight + insets.top }]}>
        {useNativeTabs ? (
          <NativeTabs
            labelStyle={{ color: tabBarLabelColor }}
            tintColor={tabBarTintColor}
            blurEffect="none"
            backgroundColor="#f5f0e8"
            shadowColor="transparent"
          >
            {TAB_ITEMS.map((item) => (
              <NativeTabs.Trigger key={item.name} name={item.name}>
                <TabLabel>{item.label}</TabLabel>
                <TabIcon sf={item.iosIcon} selectedColor={tabBarTintColor} />
              </NativeTabs.Trigger>
            ))}
          </NativeTabs>
        ) : (
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: '#0a0a0a',
              tabBarInactiveTintColor: 'rgba(10,10,10,0.5)',
              tabBarStyle: {
                backgroundColor: '#f5f0e8',
                borderTopWidth: 1,
                borderTopColor: '#000',
                height: 60 + insets.bottom,
                paddingBottom: insets.bottom,
                paddingTop: 8,
                elevation: 8,
              },
              tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginTop: 4 },
              tabBarShowLabel: true,
              tabBarHideOnKeyboard: true,
            }}
          >
            {TAB_ITEMS.map((item) => (
              <Tabs.Screen
                key={item.name}
                name={item.name}
                options={{
                  title: item.label,
                  tabBarLabel: item.label,
                  tabBarIcon: ({ color, size }) => <Feather name={item.androidIcon} size={22} color={color} />,
                  tabBarAccessibilityLabel: item.label,
                }}
              />
            ))}
          </Tabs>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f0e8',
  },
  contentWrapper: {
    flex: 1,
  },
});
