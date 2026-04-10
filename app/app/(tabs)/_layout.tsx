import React, { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { AppTopNav, WebTopNav } from '../../src/components';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/theme';

const ACCOUNT_TAB_ICON = require('../../assets/icons/account-tab.png');
const BOARDS_TAB_ICON = require('../../assets/icons/board-tab.png');
const MESSAGES_TAB_ICON = require('../../assets/icons/messages-tab.png');

const TabIcon = NativeTabs.Trigger.Icon;
const TabLabel = NativeTabs.Trigger.Label;

const TAB_ITEMS = [
  { name: 'index', label: 'Home', webIcon: 'home' as const, iconSrc: BOARDS_TAB_ICON },
  { name: 'messages', label: 'Messages', webIcon: 'message-circle' as const, iconSrc: MESSAGES_TAB_ICON },
  { name: 'account', label: 'Account', webIcon: 'user' as const, iconSrc: ACCOUNT_TAB_ICON },
] as const;

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  const isWeb = Platform.OS === 'web';

  const tabBarTintColor = colors.bottomBarIcon;
  const tabBarLabelColor = colors.bottomBarIconMuted;
  const tabBarBlurEffect = colors.headerBlurMaterial;
  const tabBarBackgroundColor = colors.glassFallbackBg;
  const tabScreenBg = useMemo(() => ({ backgroundColor: colors.canvas }), [colors.canvas]);

  const layoutStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        contentWrapper: {
          flex: 1,
          overflow: 'visible',
        },
      }),
    [colors.canvas]
  );

  if (isWeb) {
    return (
      <View style={layoutStyles.container}>
        <WebTopNav
          user={user}
          loading={loading}
          tabs={TAB_ITEMS}
        />
        <View style={[layoutStyles.contentWrapper, { paddingTop: 0 }]}>
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
    <View style={layoutStyles.container}>
      <View style={layoutStyles.contentWrapper} collapsable={false}>
        <NativeTabs
          labelStyle={{
            color: tabBarLabelColor,
          }}
          tintColor={tabBarTintColor}
          disableTransparentOnScrollEdge
          blurEffect={tabBarBlurEffect}
          backgroundColor={tabBarBackgroundColor}
          shadowColor="transparent"
        >
          {TAB_ITEMS.map((item) => (
            <NativeTabs.Trigger
              key={item.name}
              name={item.name}
              contentStyle={tabScreenBg}
            >
              <TabLabel>{item.label}</TabLabel>
              <TabIcon src={item.iconSrc} selectedColor={tabBarTintColor} />
            </NativeTabs.Trigger>
          ))}
        </NativeTabs>
      </View>
      <AppTopNav user={user} loading={loading} />
    </View>
  );
}
