import React from 'react';
import { Platform, DynamicColorIOS, View, StyleSheet } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MobileTopNav, MOBILE_NAV_HEIGHT, WebTopNav } from '../../src/components';
import { useAuth } from '../../src/contexts/AuthContext';

const TabIcon = NativeTabs.Trigger.Icon;
const TabLabel = NativeTabs.Trigger.Label;
const TabVectorIcon = NativeTabs.Trigger.VectorIcon;

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
    ? DynamicColorIOS({
        dark: '#60a5fa',
        light: '#60a5fa',
      })
    : '#60a5fa';

  const tabBarLabelColor = Platform.OS === 'ios'
    ? DynamicColorIOS({
        dark: 'rgba(255, 255, 255, 0.5)',
        light: 'rgba(0, 0, 0, 0.5)',
      })
    : 'rgba(255, 255, 255, 0.6)';

  if (isWeb) {
    return (
      <View style={styles.container}>
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
                options={{
                  title: item.label,
                }}
              />
            ))}
          </Tabs>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.contentWrapper, { paddingTop: MOBILE_NAV_HEIGHT + insets.top }]}>
        {useNativeTabs ? (
          <NativeTabs
            labelStyle={{
              color: tabBarLabelColor,
            }}
            tintColor={tabBarTintColor}
            blurEffect="none"
            backgroundColor="transparent"
            shadowColor="transparent"
          >
            {TAB_ITEMS.map((item) => (
              <NativeTabs.Trigger key={item.name} name={item.name}>
                <TabLabel>{item.label}</TabLabel>
                <TabIcon
                  sf={item.iosIcon}
                  selectedColor={tabBarTintColor}
                />
              </NativeTabs.Trigger>
            ))}
          </NativeTabs>
        ) : (
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: '#60a5fa',
              tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.6)',
              tabBarStyle: {
                backgroundColor: '#0b1224',
                borderTopWidth: 1,
                borderTopColor: 'rgba(255, 255, 255, 0.08)',
                height: 60 + insets.bottom,
                paddingBottom: insets.bottom,
                paddingTop: 8,
                elevation: 8,
              },
              tabBarLabelStyle: {
                fontSize: 12,
                fontWeight: '500',
                marginTop: 4,
                marginBottom: 0,
              },
              tabBarIconStyle: {
                marginTop: 0,
              },
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
                  tabBarIcon: ({ color, size }) => (
                    <Feather 
                      name={item.androidIcon} 
                      size={22} 
                      color={color} 
                    />
                  ),
                  tabBarAccessibilityLabel: item.label,
                }}
              />
            ))}
          </Tabs>
        )}
      </View>

      <MobileTopNav
        user={user}
        loading={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  contentWrapper: {
    flex: 1,
  },
});
