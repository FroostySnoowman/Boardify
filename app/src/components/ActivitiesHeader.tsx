import React, { useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import { GlassView, isLiquidGlassAvailable, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { ContextMenu } from './ContextMenu';
import { GlassRoundIconButton } from './GlassRoundIconButton';
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
import { useTheme } from '../theme';

export const ACTIVITIES_HEADER_HEIGHT = 64;
export const MOBILE_NAV_HEIGHT = 64;

interface User {
  profilePictureUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
}

type TabsScreenName = 'index' | 'messages' | 'account';

const ACCOUNT_TAB_MODAL_PATHS = new Set(['/profile', '/api-keys', '/default-board']);
const LEGAL_MODAL_PATHS = new Set(['/privacy', '/terms']);

function useSelectedTabsScreen(): TabsScreenName {
  const pathname = usePathname() ?? '';
  const params = useGlobalSearchParams<{ from?: string | string[] }>();
  const path = (pathname.split('?')[0] ?? '').replace(/\/$/, '');
  const fromParam = Array.isArray(params.from) ? params.from[0] : params.from;

  if (path.includes('/messages')) return 'messages';
  if (path.includes('/account')) return 'account';
  if (ACCOUNT_TAB_MODAL_PATHS.has(path)) return 'account';
  if (LEGAL_MODAL_PATHS.has(path) && fromParam === 'account') return 'account';
  return 'index';
}

export function ActivitiesHeader({
  embeddedInLayout = false,
  user = null,
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
  const { colors, resolvedScheme } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
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
          backgroundColor: colors.canvas,
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
          backgroundColor: colors.canvas,
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
        glassFallback: {
          borderWidth: 1,
          borderColor: colors.glassFallbackBorder,
          backgroundColor: colors.glassFallbackBg,
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
        menuLabelGlyphNudge: {
          transform: [{ translateX: -11 }, { translateY: -6 }],
        },
        title: {
          fontSize: 22,
          fontWeight: '700',
          color: colors.textPrimary,
        },
      }),
    [colors]
  );
  const isGlassAvailable = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  const glassScheme = resolvedScheme === 'dark' ? ('dark' as const) : ('light' as const);
  const glassTint =
    resolvedScheme === 'dark' ? 'rgba(40, 38, 36, 0.72)' : 'rgba(255, 255, 255, 0.42)';
  const openCreateBoard = useCallback(() => {
    hapticLight();
    router.push('/create-board');
  }, []);

  const goHome = () => {
    hapticLight();
    router.push('/');
  };

  const iconColor = colors.iconPrimary;

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
          colorScheme={glassScheme}
          tintColor={glassTint}
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
            : [styles.glassFallback, styles.centerIcon],
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
                <Text style={styles.title} numberOfLines={1}>
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
            {user ? (
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
            ) : (
              <View style={[styles.homeOrb, styles.homeOrbTrailing]} pointerEvents="box-none">
                <GlassRoundIconButton
                  icon="user"
                  size={22}
                  accessibilityLabel="Sign in"
                  onPress={() => {
                    hapticLight();
                    router.push('/login');
                  }}
                />
              </View>
            )}
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
              <Text style={styles.title} numberOfLines={1}>
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
