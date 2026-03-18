import React from 'react';
import {
  View,
  Text,
  Image as RNImage,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image as ExpoImage } from 'expo-image';
import { getImageUrl } from '../utils/imageUrl';
import { hapticLight } from '../utils/haptics';

export const MOBILE_NAV_HEIGHT = 64;

interface User {
  profilePictureUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
}

interface MobileTopNavProps {
  user?: User | null;
  loading?: boolean;
  onSignInPress?: () => void;
  onProfilePress?: () => void;
  onSettingsPress?: () => void;
  onLogoPress?: () => void;
}

export function MobileTopNav({
  user,
  loading = false,
  onSignInPress,
  onProfilePress,
  onLogoPress,
}: MobileTopNavProps) {
  const insets = useSafeAreaInsets();
  const isGlassAvailable = isLiquidGlassAvailable();
  const [imageError, setImageError] = React.useState(false);

  const totalHeight = MOBILE_NAV_HEIGHT + insets.top;
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

  const handleProfileNavigate = React.useCallback(() => {
    if (onProfilePress) {
      onProfilePress();
      return;
    }
    router.push('/profile');
  }, [onProfilePress]);

  const handleLogoNavigate = React.useCallback(() => {
    if (onLogoPress) {
      onLogoPress();
      return;
    }
    router.push('/(tabs)');
  }, [onLogoPress]);

  const handleHomeLogoPress = React.useCallback(() => {
    hapticLight();
    handleLogoNavigate();
  }, [handleLogoNavigate]);

  const handleSignInNavigate = React.useCallback(() => {
    if (onSignInPress) {
      onSignInPress();
      return;
    }
    router.push('/login');
  }, [onSignInPress]);

  const renderGlassAvatar = () => {
    const shouldShowImage = profileImageUrl && !imageError;
    
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

    if (isGlassAvailable) {
      return (
        <GlassView
          isInteractive
          tintColor="rgba(255, 255, 255, 0.08)"
          style={styles.glassContainer}
        >
          {avatarVisual}
        </GlassView>
      );
    }

    return (
      <View style={[styles.glassAvatar, styles.glassAvatarFallbackContainer]}>
        {avatarVisual}
      </View>
    );
  };

  const renderGlassLogo = () => {
    const logoVisual = (
      <RNImage
        source={require('../../assets/icon_circle.png')}
        style={styles.logoImage}
        resizeMode="contain"
      />
    );

    if (isGlassAvailable) {
      return (
        <GlassView
          isInteractive
          tintColor="rgba(255, 255, 255, 0.08)"
          style={styles.glassContainer}
        >
          {logoVisual}
        </GlassView>
      );
    }

    return (
      <View style={[styles.glassLogo, styles.glassLogoFallbackContainer]}>
        {logoVisual}
      </View>
    );
  };

  return (
    <>
      <View
        style={{ height: totalHeight, paddingTop: insets.top, zIndex: 999, elevation: 10, overflow: 'visible' }}
        className="absolute left-0 right-0 top-0"
      >
        <LinearGradient
          colors={['rgba(96, 165, 250, 0.18)', 'rgba(34, 197, 94, 0.14)', 'rgba(2, 6, 23, 0.9)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={80}
            tint="systemChromeMaterialDark"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        )}

        <View className="absolute inset-0 bg-black/35" />

        <View className="flex-1 flex-row items-center justify-between px-4">
          <View className="flex-row items-center">
            <Pressable
              hitSlop={12}
              onPress={handleHomeLogoPress}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              {renderGlassLogo()}
            </Pressable>
            <Pressable
              onPress={handleLogoNavigate}
              hitSlop={12}
              className="ml-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
            >
              <Text className="text-xl font-extrabold text-white tracking-tight">MyBreakPoint</Text>
            </Pressable>
          </View>

          <View className="flex-row items-center">
            {loading ? (
              isGlassAvailable ? (
                <GlassView style={styles.glassAvatar} isInteractive={false}>
                  <View style={[styles.avatarFallback, { opacity: 0.35 }]} />
                </GlassView>
              ) : (
                <View className="h-11 w-11 rounded-full border border-white/10 bg-white/10" />
              )
            ) : user ? (
              <Pressable
                onPress={handleProfileNavigate}
                hitSlop={10}
                style={({ pressed }) => ({
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                {renderGlassAvatar()}
              </Pressable>
            ) : (
              <Pressable
                onPress={handleSignInNavigate}
                hitSlop={8}
                className="flex-row items-center rounded-full border border-emerald-300/30 bg-emerald-500/80 px-4 py-2 shadow-lg shadow-emerald-500/20"
                style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
              >
                <Text className="text-base font-semibold text-white">Sign In</Text>
              </Pressable>
            )}
          </View>
        </View>

      <View className="absolute bottom-0 left-4 right-4 h-px bg-white/10" />
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  glassContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  glassAvatarFallbackContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
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
  glassLogo: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  glassLogoFallbackContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
});
