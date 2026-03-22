import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigationState } from '@react-navigation/native';
import { router, usePathname } from 'expo-router';
import { GlassView, isLiquidGlassAvailable, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { ContextMenu } from './ContextMenu';
import { hapticLight } from '../utils/haptics';
import {
  BOARD_SORT_LABELS,
  BOARD_SORT_ORDER,
  useBoardSort,
} from '../contexts/BoardSortContext';
import {
  MESSAGE_FILTER_LABELS,
  MESSAGE_FILTER_ORDER,
  useMessageFilter,
} from '../contexts/MessageFilterContext';

export const ACTIVITIES_HEADER_HEIGHT = 64;
export const MOBILE_NAV_HEIGHT = 64;

interface User {
  profilePictureUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
}

type TabsScreenName = 'index' | 'messages' | 'account';

function useSelectedTabsScreen(): TabsScreenName {
  const fromNav = useNavigationState((state) => {
    const routes = state?.routes as { name: string; state?: { routes: { name: string }[]; index: number } }[] | undefined;
    if (!routes) return null;
    const tabs = routes.find((r) => r.name === '(tabs)');
    const inner = tabs?.state;
    if (!inner?.routes || typeof inner.index !== 'number') return null;
    const name = inner.routes[inner.index]?.name;
    if (name === 'index' || name === 'messages' || name === 'account') {
      return name;
    }
    return null;
  });

  const pathname = usePathname() ?? '';
  if (fromNav) return fromNav;
  if (pathname.includes('messages')) return 'messages';
  if (pathname.includes('account')) return 'account';
  return 'index';
}

export function ActivitiesHeader({
  embeddedInLayout = false,
  user: _user = null,
}: {
  embeddedInLayout?: boolean;
  user?: User | null;
}) {
  const insets = useSafeAreaInsets();
  const tabScreen = useSelectedTabsScreen();
  const isHomeTab = tabScreen === 'index';
  const isMessagesTab = tabScreen === 'messages';
  const tabTitle =
    tabScreen === 'messages' ? 'Messages' : tabScreen === 'account' ? 'Account' : 'Home';
  const { sortMode, setSortMode } = useBoardSort();
  const { messageFilter, setMessageFilter } = useMessageFilter();
  const isGlassAvailable = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  const openCreateBoard = useCallback(() => {
    hapticLight();
    router.push('/create-board');
  }, []);

  const goHome = () => {
    hapticLight();
    router.push('/(tabs)');
  };

  const iconColor = '#0a0a0a';

  const renderGlassRound = (
    icon: keyof typeof Feather.glyphMap,
    size = 22,
    swiftMenuTrigger?: boolean
  ) => {
    const feather = <Feather name={icon} size={size} color={iconColor} />;
    const glyph =
      swiftMenuTrigger && Platform.OS === 'ios' ? (
        <View style={styles.menuLabelGlyphNudge} collapsable={false}>
          {feather}
        </View>
      ) : (
        feather
      );
    const useRnGlass = isGlassAvailable && !(swiftMenuTrigger && Platform.OS === 'ios');
    if (useRnGlass) {
      return (
        <GlassView
          isInteractive
          colorScheme="light"
          tintColor="rgba(255, 255, 255, 0.42)"
          style={styles.glassContainer}
        >
          {glyph}
        </GlassView>
      );
    }
    return (
      <View
        style={[
          styles.glassContainer,
          swiftMenuTrigger && Platform.OS === 'ios'
            ? styles.swiftMenuIconWrap
            : [styles.glassFallbackLight, styles.centerIcon],
        ]}
      >
        {glyph}
      </View>
    );
  };

  const boardSortMenuOptions = BOARD_SORT_ORDER.map((mode) => {
    const base = BOARD_SORT_LABELS[mode];
    const label = sortMode === mode ? `✓ ${base}` : base;
    return {
      label,
      value: `sort:${mode}`,
      onPress: () => {
        hapticLight();
        setSortMode(mode);
      },
    };
  });

  const messageFilterMenuOptions = MESSAGE_FILTER_ORDER.map((mode) => {
    const base = MESSAGE_FILTER_LABELS[mode];
    const label = messageFilter === mode ? `✓ ${base}` : base;
    return {
      label,
      value: `filter:${mode}`,
      onPress: () => {
        hapticLight();
        setMessageFilter(mode);
      },
    };
  });

  const titleStyle = styles.title;

  const headerShell = (
    <>
      {isHomeTab ? (
        <View
          style={
            embeddedInLayout
              ? [styles.containerEmbedded, { paddingTop: 0 }]
              : [styles.container, { paddingTop: insets.top }]
          }
        >
          <View style={styles.homeRow}>
            <View style={styles.homeTitleWrap}>
              <Pressable onPress={goHome} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
                <Text style={titleStyle} numberOfLines={1}>
                  Home
                </Text>
              </Pressable>
            </View>
            <View style={[styles.homeOrb, styles.homeOrbLeading]} pointerEvents="box-none">
              <ContextMenu
                options={boardSortMenuOptions}
                hostMatchContents
                triggerWrapperStyle={styles.contextMenuOrbTriggerWrap}
                trigger={
                  <Pressable
                    hitSlop={12}
                    accessibilityLabel="Filter boards"
                    style={styles.glassPressable}
                  >
                    {renderGlassRound('filter', 22, true)}
                  </Pressable>
                }
              />
            </View>
            <View style={[styles.homeOrb, styles.homeOrbTrailing]} pointerEvents="box-none">
              <Pressable
                hitSlop={12}
                accessibilityLabel="Create new board"
                onPress={openCreateBoard}
                style={styles.glassPressable}
              >
                {renderGlassRound('plus', 23)}
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View
          style={
            embeddedInLayout
              ? [styles.containerEmbedded, { paddingTop: 0 }]
              : [styles.container, { paddingTop: insets.top }]
          }
        >
          <View style={styles.homeRow}>
            <View style={styles.homeTitleWrap}>
              <Text style={titleStyle} numberOfLines={1}>
                {tabTitle}
              </Text>
            </View>
            <View style={[styles.homeOrb, styles.homeOrbLeading]} pointerEvents="box-none">
              {isMessagesTab ? (
                <ContextMenu
                  options={messageFilterMenuOptions}
                  hostMatchContents
                  triggerWrapperStyle={styles.contextMenuOrbTriggerWrap}
                  trigger={
                    <Pressable
                      hitSlop={12}
                      accessibilityLabel="Filter notifications"
                      style={styles.glassPressable}
                    >
                      {renderGlassRound('filter', 22, true)}
                    </Pressable>
                  }
                />
              ) : (
                <Pressable
                  onPress={() => {
                    hapticLight();
                    router.push('/profile');
                  }}
                  hitSlop={12}
                  style={styles.glassPressable}
                >
                  {renderGlassRound('more-horizontal', 22)}
                </Pressable>
              )}
            </View>
          </View>
        </View>
      )}

    </>
  );

  return headerShell;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ACTIVITIES_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#f5f0e8',
    zIndex: 5000,
    elevation: 0,
    overflow: 'visible',
  },
  containerEmbedded: {
    flex: 1,
    width: '100%',
    minHeight: ACTIVITIES_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#f5f0e8',
    overflow: 'visible',
    zIndex: 5000,
  },
  homeRow: {
    flex: 1,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: ACTIVITIES_HEADER_HEIGHT,
  },
  homeTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    zIndex: 0,
    paddingHorizontal: 56,
  },
  homeOrb: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 45,
    justifyContent: 'center',
    zIndex: 20,
    overflow: 'visible',
  },
  homeOrbLeading: {
    left: 0,
    alignItems: 'center',
  },
  homeOrbTrailing: {
    right: 0,
    alignItems: 'flex-end',
  },
  glassContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    zIndex: 2,
  },
  glassFallbackLight: {
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  centerIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassPressable: {
    opacity: 1,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextMenuOrbTriggerWrap: {
    width: 45,
    minHeight: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swiftMenuIconWrap: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Offsets MenuLabel + glass; tune against Expo RN bridge vs liquid glass (often right/down bias). */
  menuLabelGlyphNudge: {
    transform: [{ translateX: -8 }, { translateY: -4 }],
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0a0a0a',
  },
});
