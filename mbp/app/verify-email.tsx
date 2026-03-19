import React, { useEffect } from 'react';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { VerifyEmailScreen } from '../src/screens';
import { useAuth } from '../src/contexts/AuthContext';
import { verifyEmailWithToken } from '../src/api/auth';

const BACKGROUND_COLOR = '#020617';

export default function VerifyEmailPage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = params.token;

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        await verifyEmailWithToken(token);
        await refreshUser();
        router.replace('/onboarding');
      } catch {
        // stay on verify-email screen; user can resend or delete
      }
    })();
  }, [token]);

  if (token) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#60a5fa" />
        </View>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          headerTintColor: '#ffffff',
          headerTitle: 'Verify email',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <VerifyEmailScreen />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_COLOR },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
