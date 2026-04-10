import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image as RNImage,
  StyleSheet,
  Pressable,
  Platform,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { Avatar } from './Avatar';
import { SkeletonBlock } from './skeletons/SkeletonBlock';
import { getImageUrl } from '../utils/imageUrl';
import { hapticLight } from '../utils/haptics';
import { useTheme } from '../theme';

export const WEB_NAV_HEIGHT = 64;

interface User {
  profilePictureUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
}

interface TabItem {
  name: string;
  label: string;
  webIcon: keyof typeof Feather.glyphMap;
}

interface WebTopNavProps {
  user?: User | null;
  loading?: boolean;
  tabs: readonly TabItem[];
}

export function WebTopNav({
  user,
  loading = false,
  tabs,
}: WebTopNavProps) {
  const { colors, resolvedScheme } = useTheme();
  const isNavDark = resolvedScheme === 'dark';
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const [imageError, setImageError] = useState(false);
  const menuOpacity = React.useRef(new Animated.Value(0)).current;
  const menuScale = React.useRef(new Animated.Value(0.95)).current;

  const isMobile = windowWidth < 1024;

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      Animated.parallel([
        Animated.timing(menuOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(menuScale, {
          toValue: 1,
          tension: 300,
          friction: 30,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(menuOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(menuScale, {
          toValue: 0.95,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [mobileMenuOpen, menuOpacity, menuScale]);

  const totalHeight = WEB_NAV_HEIGHT + insets.top;
  const userName = user?.displayName || user?.username || user?.email || 'User';
  const profileImageUrl = React.useMemo(() => {
    return getImageUrl(user?.profilePictureUrl || undefined);
  }, [user?.profilePictureUrl]);
  const initials = React.useMemo(
    () =>
      userName
        .split(' ')
        .map(part => part?.[0] || '')
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    [userName],
  );

  React.useEffect(() => {
    setImageError(false);
  }, [profileImageUrl]);

  const handleTabPress = (tabName: string) => {
    hapticLight();
    const route = tabName === 'index' ? '/' : `/${tabName}`;
    router.push(route as any);
    setMobileMenuOpen(false);
  };

  const handleProfilePress = () => {
    hapticLight();
    router.push('/profile');
    setMobileMenuOpen(false);
  };

  const handleAccountPress = () => {
    hapticLight();
    router.push('/account');
    setMobileMenuOpen(false);
  };

  const handleLogoPress = () => {
    hapticLight();
    router.push('/');
    setMobileMenuOpen(false);
  };

  const handleSignInPress = () => {
    hapticLight();
    router.push('/login');
    setMobileMenuOpen(false);
  };

  const getCurrentTab = () => {
    const currentPath = pathname.split('/').pop() || 'index';
    return tabs.find(tab => tab.name === currentPath) || tabs[0];
  };

  const currentTab = getCurrentTab();

  const renderAvatar = () => {
    const shouldShowImage = profileImageUrl && !imageError;

    if (loading) {
      return (
        <View style={themed.avatarContainer}>
          <SkeletonBlock width={36} height={36} borderRadius={18} variant="dark" />
        </View>
      );
    }

    if (user) {
      const avatarVisual = shouldShowImage ? (
        <ExpoImage
          source={{ uri: profileImageUrl }}
          style={themed.avatarImage}
          contentFit="cover"
          transition={140}
          cachePolicy="memory-disk"
          priority="high"
          onError={() => {
            setImageError(true);
          }}
          onLoadStart={() => {
            setImageError(false);
          }}
        />
      ) : (
        <View style={themed.avatarFallback}>
          <Text style={themed.avatarInitials}>{initials}</Text>
        </View>
      );

      return (
        <Pressable
          onPress={handleProfilePress}
          hitSlop={10}
          style={({ pressed }) => ({
            transform: [{ scale: pressed ? 0.97 : 1 }],
          })}
        >
          <View style={themed.avatarContainer}>
            {avatarVisual}
          </View>
        </Pressable>
      );
    }

    return (
      <Pressable
        onPress={handleSignInPress}
        hitSlop={8}
        className="flex-row items-center rounded-full border border-emerald-300/30 bg-emerald-500/80 px-4 py-2 shadow-lg shadow-emerald-500/20"
        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
      >
        <Text className="text-sm font-semibold text-white">Sign In</Text>
      </Pressable>
    );
  };

  const themed = useMemo(
    () =>
      StyleSheet.create({
        menuOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.overlayScrim,
        },
        mobileMenuContainer: {
          position: 'absolute',
          left: 0,
          right: 0,
          backgroundColor: colors.surfaceElevated,
          borderBottomWidth: 1,
          borderBottomColor: colors.divider,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 8,
        },
        avatarContainer: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colors.divider,
          backgroundColor: colors.surfaceMuted,
          overflow: 'hidden',
        },
        avatarImage: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: 'transparent',
        },
        avatarFallback: {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surfaceElevated,
          borderWidth: 1,
          borderColor: colors.divider,
        },
        avatarInitials: {
          color: colors.textPrimary,
          fontWeight: '700',
          fontSize: 14,
          letterSpacing: 0.2,
        },
      }),
    [colors]
  );

  const tabActive = isNavDark ? '#60a5fa' : '#2563eb';
  const tabInactive = isNavDark ? 'rgba(255, 255, 255, 0.6)' : colors.textSecondary;
  const barLabelColor = isNavDark ? '#ffffff' : colors.textPrimary;

  return (
    <>
      <View
        style={{
          height: totalHeight,
          paddingTop: insets.top,
          backgroundColor: isNavDark ? undefined : colors.canvas,
          borderBottomWidth: isNavDark ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: isNavDark ? 'transparent' : colors.divider,
        }}
        className={isNavDark ? 'sticky top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur' : 'sticky top-0 z-50'}
      >
        {isNavDark ? (
          <>
            <LinearGradient
              colors={['rgba(96, 165, 250, 0.18)', 'rgba(34, 197, 94, 0.14)', 'rgba(2, 6, 23, 0.9)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="absolute inset-0 bg-black/35" />
          </>
        ) : null}

        <View
          className="flex-1 flex-row items-center justify-between"
          style={{
            width: '100%',
            paddingHorizontal: 16,
            ...(Platform.OS === 'web' ? {
              maxWidth: 1200,
              marginHorizontal: 'auto',
            } : {}),
          }}
        >
          <Pressable
            onPress={handleLogoPress}
            hitSlop={12}
            className="flex-row items-center gap-2 sm:gap-3"
            style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
          >
            <RNImage
              source={require('../../assets/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text
              className="text-base sm:text-lg font-semibold tracking-tight"
              style={{ color: barLabelColor }}
            >
              Boardify
            </Text>
          </Pressable>

          {!isMobile && (
            <View className="flex-row items-center gap-4">
              {tabs.map((tab) => {
                const isActive = tab.name === 'index'
                  ? pathname === '/' || pathname === '/index'
                  : pathname.includes(`/${tab.name}`);
                return (
                  <Pressable
                    key={tab.name}
                    onPress={() => handleTabPress(tab.name)}
                    hitSlop={8}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <View
                      className="flex-row items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                      style={{
                        backgroundColor: isActive
                          ? isNavDark
                            ? 'rgba(96, 165, 250, 0.15)'
                            : 'rgba(37, 99, 235, 0.12)'
                          : 'transparent',
                      }}
                    >
                      <Feather
                        name={tab.webIcon}
                        size={18}
                        color={isActive ? tabActive : tabInactive}
                      />
                      <Text
                        className="text-xs font-medium uppercase tracking-[0.2em]"
                        style={{
                          color: isActive ? tabActive : tabInactive,
                        }}
                      >
                        {tab.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View className="flex-row items-center gap-2 sm:gap-3">
            {!isMobile && renderAvatar()}

            {isMobile && (
              <Pressable
                onPress={() => setMobileMenuOpen(!mobileMenuOpen)}
                hitSlop={8}
                className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
                style={({ pressed }) => ({
                  opacity: pressed ? 0.8 : 1,
                  backgroundColor: mobileMenuOpen
                    ? isNavDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : colors.surfaceMuted
                    : 'transparent',
                  borderWidth: 1,
                  borderColor: isNavDark ? 'rgba(255,255,255,0.15)' : colors.divider,
                })}
              >
                {mobileMenuOpen ? (
                  <Feather name="x" size={20} color={barLabelColor} />
                ) : (
                  <Feather name="menu" size={20} color={barLabelColor} />
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {isMobile && mobileMenuOpen && (
        <Modal
          visible={mobileMenuOpen}
          transparent
          animationType="none"
          onRequestClose={() => setMobileMenuOpen(false)}
          statusBarTranslucent
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setMobileMenuOpen(false)}
          >
            <Animated.View
              style={[
                themed.menuOverlay,
                {
                  opacity: menuOpacity,
                },
              ]}
            />
          </Pressable>
          <Animated.View
            style={[
              themed.mobileMenuContainer,
              {
                opacity: menuOpacity,
                transform: [{ scale: menuScale }],
                top: totalHeight,
              },
            ]}
          >
            <View
              style={{
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.divider,
                backgroundColor: colors.surface,
              }}
            >
              <View className="flex flex-col gap-1 py-4">
                {tabs.map((tab) => {
                  const isActive = tab.name === 'index'
                    ? pathname === '/' || pathname === '/index'
                    : pathname.includes(`/${tab.name}`);
                  return (
                    <Pressable
                      key={tab.name}
                      onPress={() => handleTabPress(tab.name)}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <View
                        className="px-4 py-3 mx-4 rounded-xl flex-row items-center gap-3"
                        style={{
                          backgroundColor: isActive
                            ? isNavDark
                              ? 'rgba(96, 165, 250, 0.15)'
                              : 'rgba(37, 99, 235, 0.12)'
                            : 'transparent',
                        }}
                      >
                        <Feather
                          name={tab.webIcon}
                          size={20}
                          color={isActive ? tabActive : tabInactive}
                        />
                        <Text
                          className="text-sm font-medium"
                          style={{
                            color: isActive ? tabActive : colors.textPrimary,
                          }}
                        >
                          {tab.label}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}

                <View className="mt-4 pt-4 border-t border-white/10 mx-4">
                  {user ? (
                    <>
                      <Pressable
                        onPress={handleProfilePress}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.8 : 1,
                        })}
                      >
                        <View className="px-4 py-3 rounded-xl flex-row items-center gap-3">
                          <Feather name="user" size={20} color={colors.textSecondary} />
                          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary }}>
                            Profile
                          </Text>
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={handleAccountPress}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.8 : 1,
                        })}
                      >
                        <View className="px-4 py-3 rounded-xl flex-row items-center gap-3">
                          <Feather name="settings" size={20} color={colors.textSecondary} />
                          <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary }}>
                            Account
                          </Text>
                        </View>
                      </Pressable>
                    </>
                  ) : (
                    <Pressable
                      onPress={handleSignInPress}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.8 : 1,
                      })}
                    >
                      <View className="px-4 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex-row items-center justify-center gap-2">
                        <Text className="text-sm font-semibold text-emerald-300">Sign In</Text>
                      </View>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>
          </Animated.View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
});
