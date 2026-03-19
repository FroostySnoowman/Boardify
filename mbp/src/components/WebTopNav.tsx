import React, { useState, useEffect } from 'react';
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
import { getImageUrl } from '../utils/imageUrl';
import { hapticLight } from '../utils/haptics';

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
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const [imageError, setImageError] = useState(false);
  const menuOpacity = React.useRef(new Animated.Value(0)).current;
  const menuScale = React.useRef(new Animated.Value(0.95)).current;

  const isMobile = windowWidth < 1024; // lg breakpoint

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
    const route = tabName === 'index' ? '/(tabs)' : `/(tabs)/${tabName}`;
    router.push(route as any);
    setMobileMenuOpen(false);
  };

  const handleProfilePress = () => {
    hapticLight();
    router.push('/profile');
    setMobileMenuOpen(false);
  };

  const handleSettingsPress = () => {
    hapticLight();
    router.push('/settings');
    setMobileMenuOpen(false);
  };

  const handleLogoPress = () => {
    hapticLight();
    router.push('/(tabs)');
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
        <View className="h-10 w-10 rounded-full border border-white/10 bg-white/10" />
      );
    }

    if (user) {
      const avatarVisual = shouldShowImage ? (
        <ExpoImage
          source={{ uri: profileImageUrl }}
          style={styles.avatarImage}
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
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarInitials}>{initials}</Text>
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
          <View style={styles.avatarContainer}>
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

  return (
    <>
      <View
        style={{ height: totalHeight, paddingTop: insets.top }}
        className="sticky top-0 z-50 border-b border-white/10 bg-background/80 backdrop-blur"
      >
        <LinearGradient
          colors={['rgba(96, 165, 250, 0.18)', 'rgba(34, 197, 94, 0.14)', 'rgba(2, 6, 23, 0.9)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View className="absolute inset-0 bg-black/35" />

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
            <Text className="text-base sm:text-lg font-semibold tracking-tight text-white">
              MyBreakPoint
            </Text>
          </Pressable>

          {!isMobile && (
            <View className="flex-row items-center gap-4">
              {tabs.map((tab) => {
                const isActive = tab.name === 'index'
                  ? (pathname === '/(tabs)' || pathname === '/(tabs)/' || pathname === '/')
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
                        backgroundColor: isActive ? 'rgba(96, 165, 250, 0.15)' : 'transparent',
                      }}
                    >
                      <Feather
                        name={tab.webIcon}
                        size={18}
                        color={isActive ? '#60a5fa' : 'rgba(255, 255, 255, 0.6)'}
                      />
                      <Text
                        className="text-xs font-medium uppercase tracking-[0.2em]"
                        style={{
                          color: isActive ? '#60a5fa' : 'rgba(255, 255, 255, 0.6)',
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
                className="flex items-center justify-center w-10 h-10 rounded-lg border border-white/15 text-white hover:bg-white/5 transition-colors"
                style={({ pressed }) => ({
                  opacity: pressed ? 0.8 : 1,
                  backgroundColor: mobileMenuOpen ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                })}
              >
                {mobileMenuOpen ? (
                  <Feather name="x" size={20} color="#ffffff" />
                ) : (
                  <Feather name="menu" size={20} color="#ffffff" />
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
                styles.menuOverlay,
                {
                  opacity: menuOpacity,
                },
              ]}
            />
          </Pressable>
          <Animated.View
            style={[
              styles.mobileMenuContainer,
              {
                opacity: menuOpacity,
                transform: [{ scale: menuScale }],
                top: totalHeight,
              },
            ]}
          >
            <View className="border-t border-white/10 bg-background/95 backdrop-blur">
              <View className="flex flex-col gap-1 py-4">
                {tabs.map((tab) => {
                  const isActive = tab.name === 'index'
                    ? (pathname === '/(tabs)' || pathname === '/(tabs)/' || pathname === '/')
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
                          backgroundColor: isActive ? 'rgba(96, 165, 250, 0.15)' : 'transparent',
                        }}
                      >
                        <Feather
                          name={tab.webIcon}
                          size={20}
                          color={isActive ? '#60a5fa' : 'rgba(255, 255, 255, 0.6)'}
                        />
                        <Text
                          className="text-sm font-medium"
                          style={{
                            color: isActive ? '#60a5fa' : 'rgba(255, 255, 255, 0.8)',
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
                          <Feather name="user" size={20} color="rgba(255, 255, 255, 0.8)" />
                          <Text className="text-sm font-medium text-white/80">Profile</Text>
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={handleSettingsPress}
                        style={({ pressed }) => ({
                          opacity: pressed ? 0.8 : 1,
                        })}
                      >
                        <View className="px-4 py-3 rounded-xl flex-row items-center gap-3">
                          <Feather name="settings" size={20} color="rgba(255, 255, 255, 0.8)" />
                          <Text className="text-sm font-medium text-white/80">Settings</Text>
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
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  avatarInitials: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  mobileMenuContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
});
