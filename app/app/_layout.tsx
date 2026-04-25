import 'react-native-reanimated';
import 'react-native-gesture-handler';
import '../global.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, View, StyleSheet, Text, Pressable, Image } from 'react-native';

if (Platform.OS === 'web' && (StyleSheet as any).setFlag) {
  (StyleSheet as any).setFlag('darkMode', 'class');
}
import { Stack, useRootNavigationState } from 'expo-router';
import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/core';
import { DarkTheme, DefaultTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { InboxPrefetchOnLaunch } from '../src/components/InboxPrefetchOnLaunch';
import { NetworkProvider, useNetwork } from '../src/contexts/NetworkContext';
import { BoardSortProvider } from '../src/contexts/BoardSortContext';
import { MessageFilterProvider } from '../src/contexts/MessageFilterContext';
import { useRouter } from 'expo-router';
import { registerPushNotificationDeepLinks } from '../src/notifications/notificationDeepLink';
import { registerInviteDeepLinks } from '../src/notifications/inviteDeepLink';
import { ThemeProvider, useTheme } from '../src/theme';
import { preloadFeatherFontForWeb } from '../src/utils/webVectorFonts';
import { SubscriptionProvider } from '../src/contexts/SubscriptionContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetwork();
  const { colors } = useTheme();
  if (isOnline) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: colors.offlineBanner,
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      pointerEvents="none"
    >
      <Text
        style={{
          color: colors.offlineBannerText,
          fontSize: 13,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        You're offline — some features may be unavailable.
      </Text>
    </View>
  );
}

function AppContent() {
  const { loading } = useAuth();
  const { colors, resolvedScheme } = useTheme();
  const navState = useRootNavigationState();
  const router = useRouter();
  const [webIconFontsReady, setWebIconFontsReady] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cancelled = false;
    void (async () => {
      try {
        await preloadFeatherFontForWeb();
      } catch {
        // ignore
      }
      if (!cancelled) setWebIconFontsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ready = !loading && !!navState?.key && webIconFontsReady;
  const [appReady, setAppReady] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);

  const modalScreenOptions = useMemo(
    () => ({
      presentation: Platform.OS === 'ios' ? ('pageSheet' as const) : ('modal' as const),
      headerShown: true,
      headerTransparent: Platform.OS === 'ios',
      headerBlurEffect: Platform.OS === 'ios' ? ('dark' as const) : undefined,
      headerStyle:
        Platform.OS === 'android' || Platform.OS === 'web'
          ? { backgroundColor: colors.modalNavyCanvas }
          : undefined,
      headerShadowVisible: false,
      headerTintColor: colors.modalNavyHeaderTint,
      headerBackVisible: Platform.OS === 'web' ? true : undefined,
      contentStyle: { backgroundColor: colors.modalNavyCanvas },
      gestureEnabled: true,
      headerTitle: '',
      animation: Platform.OS === 'android' ? ('slide_from_bottom' as const) : ('default' as const),
    }),
    [colors]
  );

  const createBoardModalOptions = useMemo(
    () => ({
      presentation: Platform.OS === 'ios' ? ('pageSheet' as const) : ('modal' as const),
      headerShown: true,
      headerTransparent: Platform.OS === 'ios',
      headerBlurEffect:
        Platform.OS === 'ios' ? (colors.headerBlurMaterial as 'systemChromeMaterialLight') : undefined,
      headerStyle:
        Platform.OS === 'android' || Platform.OS === 'web'
          ? { backgroundColor: colors.modalCreamCanvas }
          : undefined,
      headerShadowVisible: false,
      headerTintColor: colors.modalCreamHeaderTint,
      headerBackVisible: Platform.OS === 'web' ? true : undefined,
      contentStyle: { backgroundColor: colors.modalCreamCanvas },
      gestureEnabled: true,
      headerTitle: '',
      animation: Platform.OS === 'android' ? ('slide_from_bottom' as const) : ('default' as const),
    }),
    [colors]
  );

  useEffect(() => {
    if (ready && !appReady) {
      setAppReady(true);
    }
  }, [ready, appReady]);

  const onLayoutRootView = useCallback(async () => {
    if (appReady && !splashHidden) {
      try {
        await SplashScreen.hideAsync();
      } catch {}
      setSplashHidden(true);
    }
  }, [appReady, splashHidden]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    return registerPushNotificationDeepLinks(router);
  }, [router]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    return registerInviteDeepLinks(router);
  }, [router]);

  const navigationTheme = useMemo(() => {
    const base = resolvedScheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.canvas,
        card: colors.surfaceElevated,
      },
    };
  }, [resolvedScheme, colors.canvas, colors.surfaceElevated]);

  const statusBarStyle = resolvedScheme === 'dark' ? 'light' : 'dark';

  if (!appReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.canvas,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={require('../assets/splash.png')}
          style={{ width: 220, height: 220 }}
          resizeMode="contain"
        />
        <StatusBar style={statusBarStyle} />
      </View>
    );
  }

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <View
        style={{ flex: 1, backgroundColor: colors.canvas }}
        onLayout={onLayoutRootView}
      >
        <StatusBar style={statusBarStyle} />
        <OfflineBanner />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.canvas },
            headerLeft: ({ canGoBack, tintColor }) => {
              if (Platform.OS !== 'web') return undefined;
              return (
                <Pressable
                  onPress={() => {
                    if (canGoBack) {
                      router.back();
                    } else {
                      router.replace('/');
                    }
                  }}
                  style={{
                    marginLeft: 10,
                    width: 36,
                    height: 36,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={canGoBack ? 'Go back' : 'Go home'}
                >
                  <Feather
                    name={canGoBack ? 'arrow-left' : 'home'}
                    size={24}
                    color={tintColor || colors.iconPrimary}
                  />
                </Pressable>
              );
            },
          }}
        >
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
            }}
          />
          <Stack.Screen name="profile" options={createBoardModalOptions} />
          <Stack.Screen name="login" options={createBoardModalOptions} />
          <Stack.Screen name="privacy" options={createBoardModalOptions} />
          <Stack.Screen name="terms" options={createBoardModalOptions} />
          <Stack.Screen name="verify-email" options={createBoardModalOptions} />
          <Stack.Screen name="delete-account/[token]" options={createBoardModalOptions} />
          <Stack.Screen name="create-board" options={createBoardModalOptions} />
          <Stack.Screen name="api-keys" options={createBoardModalOptions} />
          <Stack.Screen name="invite/[token]" options={createBoardModalOptions} />
          <Stack.Screen name="board-settings" options={createBoardModalOptions} />
          <Stack.Screen name="board-notifications" options={createBoardModalOptions} />
          <Stack.Screen name="board-archive" options={createBoardModalOptions} />
          <Stack.Screen name="board-audit" options={createBoardModalOptions} />
          <Stack.Screen name="add-dashboard-tile" options={createBoardModalOptions} />
          <Stack.Screen name="board-ai" options={createBoardModalOptions} />
          <Stack.Screen name="default-board" options={createBoardModalOptions} />
          <Stack.Screen
            name="api-reference"
            options={{
              ...createBoardModalOptions,
              // Nested `app/api-reference/_layout.tsx` Stack owns the header; a second parent header
              // caused a white strip and wrong `useHeaderHeight()` on iOS page sheets.
              headerShown: false,
            }}
          />
          <Stack.Screen name="board" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" options={{ headerShown: false }} />
        </Stack>
      </View>
    </NavigationThemeProvider>
  );
}

function AppRoot() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <InboxPrefetchOnLaunch />
          <BoardSortProvider>
            <MessageFilterProvider>
              <NetworkProvider>
                <AppContent />
              </NetworkProvider>
            </MessageFilterProvider>
          </BoardSortProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <AppRoot />
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
