import 'react-native-reanimated';
import 'react-native-gesture-handler';
import '../global.css';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, View, AppState, AppStateStatus, StyleSheet, Text, Pressable } from 'react-native';

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

import { AuthProvider } from '../src/contexts/AuthContext';
import { TeamsProvider } from '../src/contexts/TeamsContext';
import { NetworkProvider, useNetwork } from '../src/contexts/NetworkContext';
import { ChatBlockedModalProvider } from '../src/contexts/ChatBlockedModalContext';
import { SubscriptionProvider } from '../src/contexts/SubscriptionContext';
import { RadioPlaybackProvider } from '../src/contexts/RadioPlaybackContext';
import { useAuth } from '../src/contexts/AuthContext';
import { hasCompletedOnboarding } from '../src/api/user';
import ParentConsentGate, { needsParentalConsent } from '../src/components/ParentConsentGate';
import { useRouter, usePathname } from 'expo-router';
import { clearGuestMatch, initTabVisibilityListener } from '../src/utils/guestMatchStorage';
import * as Notifications from 'expo-notifications';
import { requestNotificationPermissions, refetchAndRescheduleEventReminders, registerPushTokenWithBackend } from '../src/services/notifications';
import { refreshEventLiveActivity, ensurePushToStartTokenRegistered, subscribePushToStartToken } from '../src/services/liveActivity';

const BACKGROUND_COLOR = '#020617';

SplashScreen.preventAutoHideAsync().catch(() => {});

function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const { isOnline, isSyncing } = useNetwork();
  if (isOnline && !isSyncing) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: insets.top,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: isSyncing ? '#2563eb' : '#475569',
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      pointerEvents="none"
    >
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
        {isSyncing
          ? 'Syncing your matches…'
          : "You're offline — logged in locally. Log matches and take stats as usual; they'll sync when you're back online."}
      </Text>
    </View>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const { isOnline } = useNetwork();
  const navState = useRootNavigationState();
  const router = useRouter();
  const pathname = usePathname();
  const ready = !loading && !!navState?.key;
  const [appReady, setAppReady] = useState(false);
  const [splashHidden, setSplashHidden] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const lastForegroundRefreshRef = useRef(0);
  const pushTokenRegisteredRef = useRef(false);

  useEffect(() => {
    if (loading || !user) return;
    if (user.emailVerified === false && pathname !== '/verify-email' && pathname !== '/login') {
      router.replace('/verify-email');
    }
  }, [user, loading, pathname, router]);

  useEffect(() => {
    if (!loading && user && user.emailVerified !== false && !onboardingChecked && pathname !== '/onboarding' && pathname !== '/choose-username') {
      if (!isOnline) {
        setOnboardingChecked(true);
        return;
      }
      (async () => {
        const completed = await hasCompletedOnboarding();
        if (!completed) {
          router.replace('/onboarding');
        }
        setOnboardingChecked(true);
      })();
    } else if (!user) {
      setOnboardingChecked(false);
    }
  }, [user, loading, onboardingChecked, isOnline, router, pathname]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
        console.debug('[AppState][_layout]', {
          nextAppState,
          pathname,
          hasUser: !!user,
        });
        if (nextAppState === 'background' || nextAppState === 'inactive') {
          clearGuestMatch().catch(console.error);
        }
        if (nextAppState === 'active' && user) {
          const now = Date.now();
          if (now - lastForegroundRefreshRef.current >= 300_000) {
            lastForegroundRefreshRef.current = now;
            refetchAndRescheduleEventReminders()
              .then(() => refreshEventLiveActivity())
              .catch(() => {});
          }
          if (!pushTokenRegisteredRef.current) {
            pushTokenRegisteredRef.current = true;
            registerPushTokenWithBackend().catch(() => {});
          }
        }
      });

      return () => {
        subscription.remove();
      };
    }
  }, [user, pathname]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const cleanup = initTabVisibilityListener();
      return cleanup;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' && user) {
      pushTokenRegisteredRef.current = true;
      registerPushTokenWithBackend().catch(() => {});
      requestNotificationPermissions()
        .then((granted) => {
          if (granted) {
            refetchAndRescheduleEventReminders().catch(() => {});
          }
        })
        .catch(() => {});
      if (Platform.OS === 'ios') {
        const unsub = subscribePushToStartToken();
        const t = setTimeout(() => ensurePushToStartTokenRegistered().catch(() => {}), 100);
        return () => {
          clearTimeout(t);
          unsub?.();
        };
      }
    }
  }, [user]);

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    const navigateFromNotification = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (!data?.type) return;

      if (data.type === 'chat' && typeof data.convId === 'string' && typeof data.teamId === 'string') {
        router.push({ pathname: '/(tabs)/team', params: { teamId: data.teamId, convId: data.convId } });
      } else if (data.type === 'event' && data.eventId != null) {
        const eventParams: Record<string, string> = { eventId: String(data.eventId) };
        if (data.teamId && typeof data.teamId === 'string') eventParams.teamId = data.teamId;
        router.push({ pathname: '/event-detail', params: eventParams });
      } else if (data.type === 'radio' && typeof data.matchId === 'string') {
        router.push({ pathname: '/spectate-radio-detail', params: { matchId: data.matchId } });
      }
    };

    const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
      setTimeout(() => navigateFromNotification(response), 100);
    };

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (appReady && user) {
      const lastResponse = Notifications.getLastNotificationResponse();
      if (lastResponse?.notification) {
        timeoutId = setTimeout(() => {
          navigateFromNotification(lastResponse);
          Notifications.clearLastNotificationResponseAsync().catch(() => {});
        }, 700);
      }
    }

    const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      sub.remove();
    };
  }, [router, appReady, user]);

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

  const showParentConsentGate =
    user &&
    user.emailVerified !== false &&
    needsParentalConsent(user) &&
    pathname !== '/verify-email' &&
    pathname !== '/login' &&
    pathname !== '/onboarding' &&
    pathname !== '/choose-username';

  if (showParentConsentGate) {
    return (
      <View style={{ flex: 1, backgroundColor: BACKGROUND_COLOR }} onLayout={onLayoutRootView}>
        <StatusBar style="light" backgroundColor="black" />
        <OfflineBanner />
        <ParentConsentGate />
      </View>
    );
  }

  return (
    <ChatBlockedModalProvider>
      <View
        style={{ flex: 1, backgroundColor: BACKGROUND_COLOR }}
        onLayout={onLayoutRootView}
      >
        <StatusBar style="light" backgroundColor="black" />
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
        <Stack.Screen 
          name="profile" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
          }} 
        />
        <Stack.Screen 
          name="settings" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
          }} 
        />
        <Stack.Screen 
          name="support" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="legal" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="chat-required" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { 
              backgroundColor: BACKGROUND_COLOR,
              height: '100%',
              width: '100%',
            },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="log-match" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { 
              backgroundColor: BACKGROUND_COLOR,
              height: '100%',
              width: '100%',
            },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="help-team" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { 
              backgroundColor: BACKGROUND_COLOR,
              height: '100%',
              width: '100%',
            },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="help-matches" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { 
              backgroundColor: BACKGROUND_COLOR,
              height: '100%',
              width: '100%',
            },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="search-all" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { 
              backgroundColor: BACKGROUND_COLOR,
              height: '100%',
              width: '100%',
            },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="help-spectate" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { 
              backgroundColor: BACKGROUND_COLOR,
              height: '100%',
              width: '100%',
            },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="help-calendar" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { 
              backgroundColor: BACKGROUND_COLOR,
              height: '100%',
              width: '100%',
            },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="edit-chat" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { 
              backgroundColor: BACKGROUND_COLOR,
              height: '100%',
              width: '100%',
            },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="create-season" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { 
              backgroundColor: BACKGROUND_COLOR,
              height: '100%',
              width: '100%',
            },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="create-lineup" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { 
              backgroundColor: BACKGROUND_COLOR,
              height: '100%',
              width: '100%',
            },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="add-ladder-player" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { 
              backgroundColor: BACKGROUND_COLOR,
              height: '100%',
              width: '100%',
            },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="add-lineup-player" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { 
              backgroundColor: BACKGROUND_COLOR,
              height: '100%',
              width: '100%',
            },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="edit-member" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { 
              backgroundColor: BACKGROUND_COLOR,
              height: '100%',
              width: '100%',
            },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="access-code" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { 
              backgroundColor: BACKGROUND_COLOR,
              height: '100%',
              width: '100%',
            },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="invite-members" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="team-settings" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="search-events" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="search-chats" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="search-matches" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="all-teams" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="create-team" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
          }} 
        />
        <Stack.Screen 
          name="match-info/[matchId]" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
          }} 
        />
        <Stack.Screen 
          name="create-group-chat" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
          }} 
        />
        <Stack.Screen 
          name="new-event" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
          }} 
        />
        <Stack.Screen 
          name="event-detail" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="day-events" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
            sheetGrabberVisible: Platform.OS === 'ios',
          }} 
        />
        <Stack.Screen 
          name="match-detail" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
          }} 
        />
        <Stack.Screen 
          name="spectate-scorecard-detail" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
          }} 
        />
        <Stack.Screen 
          name="spectate-radio-detail" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
          }} 
        />
        <Stack.Screen 
          name="create-note" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
          }} 
        />
        <Stack.Screen 
          name="edit-note" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
          }} 
        />
        <Stack.Screen 
          name="login" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
          }} 
        />
        <Stack.Screen 
          name="onboarding" 
          options={{ 
            headerShown: false,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: false,
            animation: 'fade',
          }} 
        />
        <Stack.Screen 
          name="verify-email" 
          options={{ 
            headerShown: false,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: false,
            animation: 'fade',
          }} 
        />
        <Stack.Screen 
          name="choose-username" 
          options={{ 
            headerShown: false,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: false,
            animation: 'fade',
          }} 
        />
        <Stack.Screen 
          name="edit-event" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
          }} 
        />
        <Stack.Screen 
          name="browse-teams" 
          options={{ 
            presentation: Platform.OS === 'ios' ? 'pageSheet' : 'modal',
            headerShown: true,
            headerTransparent: Platform.OS === 'ios',
            headerBlurEffect: Platform.OS === 'ios' ? 'systemMaterial' : undefined,
            headerStyle: (Platform.OS === 'android' || Platform.OS === 'web')
              ? { backgroundColor: BACKGROUND_COLOR }
              : undefined,
            headerTintColor: (Platform.OS === 'android' || Platform.OS === 'web') ? '#ffffff' : undefined,
            headerBackVisible: Platform.OS === 'web' ? true : undefined,
            contentStyle: { backgroundColor: BACKGROUND_COLOR },
            gestureEnabled: true,
            headerTitle: '',
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
          }} 
        />
        <Stack.Screen 
          name="attachment-picker" 
          options={{ 
            presentation: 'formSheet',
            sheetAllowedDetents: [0.4, 0.6, 0.9],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
            headerShown: false,
            contentStyle: { backgroundColor: '#18181b' },
            gestureEnabled: true,
            animation: Platform.OS === 'android' ? 'slide_from_bottom' : 'default',
          }} 
        />
        <Stack.Screen name="+not-found" options={{ headerShown: false }} />
      </Stack>
      </View>
    </ChatBlockedModalProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <RadioPlaybackProvider>
              <SubscriptionProvider>
                <TeamsProvider>
                  <NetworkProvider>
                    <AppContent />
                  </NetworkProvider>
                </TeamsProvider>
              </SubscriptionProvider>
            </RadioPlaybackProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
