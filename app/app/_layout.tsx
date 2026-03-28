import 'react-native-reanimated';
import 'react-native-gesture-handler';
import '../global.css';

import { useCallback, useEffect, useState } from 'react';
import { Platform, View, StyleSheet, Text, Pressable } from 'react-native';

if (Platform.OS === 'web' && (StyleSheet as any).setFlag) {
  (StyleSheet as any).setFlag('darkMode', 'class');
}
import { Stack, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { NetworkProvider, useNetwork } from '../src/contexts/NetworkContext';
import { BoardSortProvider } from '../src/contexts/BoardSortContext';
import { MessageFilterProvider } from '../src/contexts/MessageFilterContext';
import { useRouter } from 'expo-router';

const BACKGROUND_COLOR = '#f5f0e8';
const MODAL_BACKGROUND = '#020617';

SplashScreen.preventAutoHideAsync().catch(() => {});

const modalScreenOptions = {
  presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
  headerShown: true,
  headerTransparent: Platform.OS === 'ios',
  headerBlurEffect: Platform.OS === 'ios' ? 'dark' : undefined,
  headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
    ? { backgroundColor: MODAL_BACKGROUND }
    : undefined,
  headerShadowVisible: false,
  headerTintColor: '#ffffff',
  headerBackVisible: Platform.OS === 'web' ? true : undefined,
  contentStyle: { backgroundColor: MODAL_BACKGROUND },
  gestureEnabled: true,
  headerTitle: '',
  animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
} as const;

const createBoardModalOptions = {
  presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
  headerShown: true,
  headerTransparent: Platform.OS === 'ios',
  headerBlurEffect: Platform.OS === 'ios' ? 'systemChromeMaterialLight' : undefined,
  headerStyle:
    Platform.OS === 'android' || Platform.OS === 'web'
      ? { backgroundColor: BACKGROUND_COLOR }
      : undefined,
  headerShadowVisible: false,
  headerTintColor: '#0a0a0a',
  headerBackVisible: Platform.OS === 'web' ? true : undefined,
  contentStyle: { backgroundColor: BACKGROUND_COLOR },
  gestureEnabled: true,
  headerTitle: '',
  animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
} as const;

function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetwork();
  if (isOnline) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: '#475569',
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      pointerEvents="none"
    >
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
        You're offline — some features may be unavailable.
      </Text>
    </View>
  );
}

function AppContent() {
  const { loading } = useAuth();
  const navState = useRootNavigationState();
  const router = useRouter();
  const ready = !loading && !!navState?.key;
  const [appReady, setAppReady] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);

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

  if (!appReady) {
    return null;
  }

  return (
    <View
      style={{ flex: 1, backgroundColor: BACKGROUND_COLOR }}
      onLayout={onLayoutRootView}
    >
      <StatusBar style="dark" backgroundColor="#f5f0e8" />
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: BACKGROUND_COLOR },
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
                  color={tintColor || '#ffffff'}
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
            animation: 'fade',
          }}
        />
        <Stack.Screen name="profile" options={createBoardModalOptions} />
        <Stack.Screen name="login" options={modalScreenOptions} />
        <Stack.Screen name="create-board" options={createBoardModalOptions} />
        <Stack.Screen name="add-dashboard-tile" options={createBoardModalOptions} />
        <Stack.Screen name="default-board" options={createBoardModalOptions} />
        <Stack.Screen name="board" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <BoardSortProvider>
              <MessageFilterProvider>
                <NetworkProvider>
                  <AppContent />
                </NetworkProvider>
              </MessageFilterProvider>
            </BoardSortProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
