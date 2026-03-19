import React from 'react';
import { Platform, DynamicColorIOS, View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { WebTopNav } from '../../src/components';
import { useAuth } from '../../src/contexts/AuthContext';

const BOARDS_TAB_ICON = require('../../assets/icons/board-tab.png');
const MESSAGES_TAB_ICON = require('../../assets/icons/messages-tab.png');
const ACCOUNT_TAB_ICON = require('../../assets/icons/account-tab.png');

const TabIcon = NativeTabs.Trigger.Icon;
const TabLabel = NativeTabs.Trigger.Label;

const TAB_ITEMS = [
  { name: 'index', label: 'Home', webIcon: 'home' as const, iconSrc: BOARDS_TAB_ICON },
  { name: 'messages', label: 'Messages', webIcon: 'message-circle' as const, iconSrc: MESSAGES_TAB_ICON },
  { name: 'account', label: 'Account', webIcon: 'user' as const, iconSrc: ACCOUNT_TAB_ICON },
] as const;

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const isWeb = Platform.OS === 'web';

  const tabBarTintColor = Platform.OS === 'ios'
    ? DynamicColorIOS({ dark: '#0a0a0a', light: '#0a0a0a' })
    : '#0a0a0a';
  const tabBarLabelColor = Platform.OS === 'ios'
    ? DynamicColorIOS({ dark: 'rgba(10,10,10,0.6)', light: 'rgba(10,10,10,0.6)' })
    : 'rgba(10,10,10,0.6)';

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
      <View style={styles.contentWrapper}>
        <NativeTabs
          labelStyle={{
            color: tabBarLabelColor,
          }}
          tintColor={tabBarTintColor}
          disableTransparentOnScrollEdge
          blurEffect="none"
          backgroundColor="transparent"
          shadowColor="transparent"
        >
          {TAB_ITEMS.map((item) => (
            <NativeTabs.Trigger key={item.name} name={item.name}>
              <TabLabel>{item.label}</TabLabel>
              <TabIcon
                src={item.iconSrc}
                selectedColor={tabBarTintColor}
              />
            </NativeTabs.Trigger>
          ))}
        </NativeTabs>
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
