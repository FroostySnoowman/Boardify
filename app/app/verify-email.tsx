import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight } from '../src/utils/haptics';
import { BoardStyleActionButton } from '../src/components/BoardStyleActionButton';
import { useAuth } from '../src/contexts/AuthContext';
import { fetchCurrentUser, resendVerificationEmail, verifyEmailWithToken } from '../src/api/auth';
import { useTheme } from '../src/theme';
import type { ThemeColors } from '../src/theme/colors';

const BELOW_HEADER_GAP = 10;

function createVerifyEmailStyles(colors: ThemeColors) {
  const cardShadow =
    Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 5, height: 5 },
          shadowOpacity: 0.2,
          shadowRadius: 0,
        }
      : { elevation: 5 };

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.modalCreamCanvas,
    },
    flex: { flex: 1 },
    sheetFill: {
      flex: 1,
      backgroundColor: colors.modalCreamCanvas,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'flex-start',
      paddingHorizontal: 20,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    card: {
      alignSelf: 'stretch',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      padding: 24,
      ...cardShadow,
    },
    helper: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 28,
      fontWeight: '500',
    },
    statusLine: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textPrimary,
      marginBottom: 16,
      fontWeight: '600',
    },
    verifyingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 20,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      width: '100%',
      overflow: 'hidden',
      paddingBottom: 11,
      marginBottom: 12,
    },
    labelCancel: { color: colors.textPrimary },
    labelPrimary: { color: colors.textPrimary },
    labelMuted: { color: colors.textTertiary },
  });
}

export default function VerifyEmailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createVerifyEmailStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user, refreshUser } = useAuth();
  const [resending, setResending] = useState(false);
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const tokenFromLink = useMemo(() => {
    const raw = params.token;
    const s = Array.isArray(raw) ? raw[0] : raw;
    return typeof s === 'string' && s.trim() ? s.trim() : undefined;
  }, [params.token]);
  const [linkVerifyPhase, setLinkVerifyPhase] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [linkVerifyMessage, setLinkVerifyMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenFromLink) return;

    let cancelled = false;
    setLinkVerifyPhase('loading');
    setLinkVerifyMessage(null);

    void (async () => {
      try {
        const message = await verifyEmailWithToken(tokenFromLink);
        if (cancelled) return;
        setLinkVerifyPhase('done');
        setLinkVerifyMessage(message);
        router.replace('/verify-email');
        await refreshUser({ silent: true });
        if (cancelled) return;
        try {
          const u = await fetchCurrentUser();
          if (u.emailVerified) {
            router.replace('/');
            return;
          }
          setLinkVerifyMessage(
            `${message} You are signed in with a different account. Sign out and sign in with the address you verified if needed.`
          );
        } catch {
          setLinkVerifyMessage(`${message} Sign in with that address to continue.`);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Verification failed';
        try {
          await refreshUser({ silent: true });
          if (cancelled) return;
          const u = await fetchCurrentUser();
          if (u.emailVerified) {
            router.replace('/');
            return;
          }
        } catch {
          // ignore — treat as real failure below
        }
        setLinkVerifyPhase('error');
        setLinkVerifyMessage(msg);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tokenFromLink, refreshUser]);

  const close = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user?.emailVerified) {
        router.replace('/');
      }
    }, [user?.emailVerified])
  );

  const onResend = async () => {
    hapticLight();
    setResending(true);
    try {
      const msg = await resendVerificationEmail();
      Alert.alert('Email sent', msg);
    } catch (e: unknown) {
      Alert.alert('Could not resend', e instanceof Error ? e.message : 'Try again later.');
    } finally {
      setResending(false);
    }
  };

  const onContinue = async () => {
    hapticLight();
    try {
      await refreshUser();
      const u = await fetchCurrentUser();
      if (u.emailVerified) {
        router.replace('/');
        return;
      }
      Alert.alert('Not verified yet', 'Open the link in your email, then tap Continue again.');
    } catch (e: unknown) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen>
        <Stack.Header
          style={
            Platform.OS === 'ios'
              ? { backgroundColor: 'transparent' }
              : { backgroundColor: colors.modalCreamCanvas }
          }
        />
        <Stack.Screen.Title style={{ fontWeight: '800', color: colors.modalCreamHeaderTint }}>
          Verify email
        </Stack.Screen.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" onPress={close} tintColor={colors.modalCreamHeaderTint} />
        </Stack.Toolbar>
      </Stack.Screen>

      <KeyboardAvoidingView
        style={[styles.flex, styles.sheetFill]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          style={styles.sheetFill}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: headerHeight + BELOW_HEADER_GAP,
              paddingBottom: insets.bottom + 28,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {linkVerifyPhase === 'loading' ? (
              <View style={styles.verifyingRow}>
                <ActivityIndicator color={colors.textPrimary} />
                <Text style={styles.statusLine}>Verifying your email…</Text>
              </View>
            ) : null}
            {linkVerifyPhase === 'done' && linkVerifyMessage ? (
              <Text style={styles.statusLine}>{linkVerifyMessage}</Text>
            ) : null}
            {linkVerifyPhase === 'error' && linkVerifyMessage ? (
              <Text style={[styles.statusLine, { color: colors.textSecondary }]}>{linkVerifyMessage}</Text>
            ) : null}
            {linkVerifyPhase === 'idle' || linkVerifyPhase === 'error' ? (
              <Text style={styles.helper}>
                {tokenFromLink ? (
                  'If verification failed, try a new link from Resend below.'
                ) : (
                  <>
                    Open the verification link sent to{' '}
                    <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{user?.email ?? 'your email'}</Text>
                    {' '}
                    on this device, then tap Continue. If nothing arrived, check spam or tap Resend below.
                  </>
                )}
              </Text>
            ) : linkVerifyPhase === 'done' ? (
              <Text style={styles.helper}>
                You can close this screen or use Continue if you are already signed in on this device.
              </Text>
            ) : null}
            <View style={styles.actions}>
              <BoardStyleActionButton
                shadowColor={colors.shadowFill}
                onPress={close}
                label="Close"
                labelStyle={styles.labelCancel}
              />
              <BoardStyleActionButton
                shadowColor={colors.success}
                onPress={() => void onContinue()}
                label="Continue"
                labelStyle={styles.labelPrimary}
              />
            </View>
            <BoardStyleActionButton
              layout="stack"
              shadowColor={resending ? colors.shadowFill : colors.surfaceMuted}
              onPress={() => void onResend()}
              disabled={resending}
              label={resending ? 'Sending…' : 'Resend verification email'}
              labelStyle={resending ? styles.labelMuted : styles.labelPrimary}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
