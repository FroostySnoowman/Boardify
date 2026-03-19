import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { GlassView, isLiquidGlassAvailable, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { ContextMenu } from './ContextMenu';
import { CreateBoardNameModal } from './CreateBoardNameModal';
import { hapticLight } from '../utils/haptics';

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

export function ActivitiesHeader({
  embeddedInLayout = false,
  user = null,
}: {
  embeddedInLayout?: boolean;
  user?: User | null;
}) {
  const insets = useSafeAreaInsets();
  const isHomeTab = useIsHomeTab();
  const tabTitle = useTabTitle();
  /** Match mbp MobileTopNav: same availability checks + native GlassView props */
  const isGlassAvailable = isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  const [createBoardVisible, setCreateBoardVisible] = useState(false);

  const openCreateBoardModal = useCallback(() => {
    hapticLight();
    setCreateBoardVisible(true);
  }, []);

  const onCreateBoardNamed = useCallback((name: string) => {
    setCreateBoardVisible(false);
    router.push({ pathname: '/board', params: { boardName: name } });
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

  const filterOptions = [
    {
      label: 'Messages',
      value: 'messages',
      onPress: () => {
        hapticLight();
        router.push('/(tabs)/messages');
      },
    },
    {
      label: 'Account',
      value: 'account',
      onPress: () => {
        hapticLight();
        router.push('/(tabs)/account');
      },
    },
    {
      label: user ? 'Profile' : 'Sign in',
      value: 'profile',
      onPress: () => {
        hapticLight();
        if (user) router.push('/profile');
        else router.push('/login');
      },
    },
    ...(user
      ? [
          {
            label: 'Settings',
            value: 'settings',
            onPress: () => {
              hapticLight();
              router.push('/settings');
            },
          },
        ]
      : []),
  ];

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
                options={filterOptions}
                trigger={
                  <Pressable
                    hitSlop={12}
                    accessibilityLabel="Filter and more"
                    style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
                  >
                    {renderGlassRound('more-horizontal', 22)}
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
                onPress={openCreateBoardModal}
                style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
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
              <Pressable
                onPress={() => {
                  hapticLight();
                  router.push('/profile');
                }}
                hitSlop={12}
                style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
              >
                {renderGlassRound('more-horizontal', 22)}
              </Pressable>
            </View>

            <View style={styles.homeTitleWrap}>
              <Text style={titleStyle} numberOfLines={1}>
                {tabTitle}
              </Text>
            </View>

            <View style={[styles.homeSide, { alignItems: 'flex-end' }]}>
              <Pressable
                onPress={openCreateBoardModal}
                hitSlop={12}
                style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
              >
                {renderGlassRound('plus', 23)}
              </Pressable>
            </View>
          </View>
        </View>
      )}

      <CreateBoardNameModal
        visible={createBoardVisible}
        onClose={() => setCreateBoardVisible(false)}
        onCreate={onCreateBoardNamed}
      />
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
    zIndex: 999,
    elevation: 0,
  },
  /** Same cream as AppTopNav / screen — seamless with scroll area */
  containerEmbedded: {
    flex: 1,
    width: '100%',
    minHeight: ACTIVITIES_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#f5f0e8',
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
  },
  homeTitleWrap: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  /** Same dimensions as mbp MobileTopNav `glassContainer` (no overflow:hidden — that breaks liquid glass) */
  glassContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
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
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0a0a0a',
  },
});
