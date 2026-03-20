import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, InteractionManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
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

function useIsHomeTab() {
  const pathname = usePathname();
  return React.useMemo(() => {
    if (!pathname) return false;
    return (
      pathname === '/' ||
      pathname === '/(tabs)' ||
      pathname === '/(tabs)/' ||
      pathname === '/index' ||
      pathname === '/(tabs)/index'
    );
  }, [pathname]);
}

function useTabTitle() {
  const pathname = usePathname() ?? '';
  if (pathname.includes('messages')) return 'Messages';
  if (pathname.includes('account')) return 'Account';
  return 'Home';
}

function useIsMessagesTab() {
  const pathname = usePathname() ?? '';
  return pathname.includes('messages');
}

export function ActivitiesHeader({
  embeddedInLayout = false,
  user: _user = null,
}: {
  embeddedInLayout?: boolean;
  user?: User | null;
}) {
  const insets = useSafeAreaInsets();
  const isHomeTab = useIsHomeTab();
  const isMessagesTab = useIsMessagesTab();
  const tabTitle = useTabTitle();
  const { sortMode, setSortMode } = useBoardSort();
  const { messageFilter, setMessageFilter } = useMessageFilter();
  const [sortGlassRemountKey, setSortGlassRemountKey] = useState(0);
  const [filterGlassRemountKey, setFilterGlassRemountKey] = useState(0);
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

  const renderGlassRound = (icon: keyof typeof Feather.glyphMap, size = 22) => {
    const glyph = <Feather name={icon} size={size} color={iconColor} />;
    if (isGlassAvailable) {
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
      <View style={[styles.glassContainer, styles.glassFallbackLight, styles.centerIcon]}>
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
            <View style={styles.homeSide}>
              <ContextMenu
                options={boardSortMenuOptions}
                onMenuItemCommit={() => {
                  InteractionManager.runAfterInteractions(() => {
                    setTimeout(() => setSortGlassRemountKey((k) => k + 1), 450);
                  });
                }}
                trigger={
                  <Pressable
                    key={sortGlassRemountKey}
                    hitSlop={12}
                    accessibilityLabel="Filter boards"
                    style={styles.glassPressable}
                  >
                    {renderGlassRound('filter', 22)}
                  </Pressable>
                }
              />
            </View>

            <View style={styles.homeTitleWrap}>
              <Pressable onPress={goHome} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
                <Text style={titleStyle} numberOfLines={1}>
                  Home
                </Text>
              </Pressable>
            </View>

            <View style={[styles.homeSide, { alignItems: 'flex-end' }]}>
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
            <View style={styles.homeSide}>
              {isMessagesTab ? (
                <ContextMenu
                  options={messageFilterMenuOptions}
                  onMenuItemCommit={() => {
                    InteractionManager.runAfterInteractions(() => {
                      setTimeout(() => setFilterGlassRemountKey((k) => k + 1), 450);
                    });
                  }}
                  trigger={
                    <Pressable
                      key={filterGlassRemountKey}
                      hitSlop={12}
                      accessibilityLabel="Filter notifications"
                      style={styles.glassPressable}
                    >
                      {renderGlassRound('filter', 22)}
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

            <View style={styles.homeTitleWrap}>
              <Text style={titleStyle} numberOfLines={1}>
                {tabTitle}
              </Text>
            </View>

            <View style={[styles.homeSide, { alignItems: 'flex-end' }]} />
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
    zIndex: 1000,
  },
  homeRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeSide: {
    width: 45,
    alignItems: 'flex-start',
    overflow: 'visible',
    zIndex: 1,
  },
  homeTitleWrap: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
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
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0a0a0a',
  },
});
