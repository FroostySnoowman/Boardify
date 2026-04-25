import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight } from '../../src/utils/haptics';
import { BoardStyleActionButton } from '../../src/components/BoardStyleActionButton';
import { confirmDeleteAccount } from '../../src/api/auth';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/theme';
import type { ThemeColors } from '../../src/theme/colors';

const BELOW_HEADER_GAP = 10;

function createDeleteAccountStyles(colors: ThemeColors) {
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
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    helper: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 24,
      fontWeight: '500',
    },
    err: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.dangerText,
      marginBottom: 16,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      width: '100%',
      flexWrap: 'wrap',
    },
    labelCancel: { color: colors.textPrimary },
    labelPrimary: { color: colors.textPrimary },
    labelDanger: { color: colors.textPrimary },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
  });
}

type Phase = 'prompt' | 'submitting' | 'success' | 'error';

export default function ConfirmDeleteAccountScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createDeleteAccountStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { invalidateLocalAuth } = useAuth();
  const raw = useLocalSearchParams<{ token?: string | string[] }>();
  const token = useMemo(() => {
    const t = raw.token;
    const s = Array.isArray(t) ? t[0] : t;
    try {
      return decodeURIComponent(s?.trim() ?? '');
    } catch {
      return s?.trim() ?? '';
    }
  }, [raw.token]);

  const [phase, setPhase] = useState<Phase>(() =>
    token.length >= 32 ? 'prompt' : 'error'
  );
  const [errorText, setErrorText] = useState(() =>
    token.length >= 32 ? '' : 'This link is missing or invalid.'
  );
  const [successMessage, setSuccessMessage] = useState('');

  const close = useCallback(() => {
    hapticLight();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, []);

  const onConfirmDelete = useCallback(async () => {
    if (!token || phase !== 'prompt') return;
    hapticLight();
    setPhase('submitting');
    setErrorText('');
    try {
      const msg = await confirmDeleteAccount(token);
      await invalidateLocalAuth();
      setSuccessMessage(msg);
      setPhase('success');
    } catch (e: unknown) {
      setPhase('error');
      setErrorText(e instanceof Error ? e.message : 'Could not delete this account.');
    }
  }, [token, phase, invalidateLocalAuth]);

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
          Delete account
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
            {phase === 'prompt' ? (
              <>
                <Text style={styles.title}>Permanently delete your account?</Text>
                <Text style={styles.helper}>
                  This removes your Boardify account and associated data. You cannot undo this. If you did not ask to
                  delete your account, close this screen.
                </Text>
                <View style={styles.actions}>
                  <BoardStyleActionButton
                    shadowColor={colors.shadowFill}
                    onPress={close}
                    label="Cancel"
                    labelStyle={styles.labelCancel}
                  />
                  <BoardStyleActionButton
                    shadowColor={colors.danger}
                    onPress={() => void onConfirmDelete()}
                    label="Delete account"
                    labelStyle={styles.labelDanger}
                  />
                </View>
              </>
            ) : null}

            {phase === 'submitting' ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.iconPrimary} />
                <Text style={styles.helper}>Deleting your account…</Text>
              </View>
            ) : null}

            {phase === 'success' ? (
              <>
                <Text style={styles.title}>Account deleted</Text>
                <Text style={styles.helper}>{successMessage}</Text>
                <View style={styles.actions}>
                  <BoardStyleActionButton
                    shadowColor={colors.success}
                    onPress={() => {
                      hapticLight();
                      router.replace('/login');
                    }}
                    label="Done"
                    labelStyle={styles.labelPrimary}
                  />
                </View>
              </>
            ) : null}

            {phase === 'error' ? (
              <>
                <Text style={styles.title}>Deletion unavailable</Text>
                {errorText ? <Text style={styles.err}>{errorText}</Text> : null}
                <Text style={styles.helper}>
                  Request a new link from the app under Account → Delete account, or contact support if you need help.
                </Text>
                <View style={styles.actions}>
                  <BoardStyleActionButton
                    shadowColor={colors.shadowFill}
                    onPress={close}
                    label="Close"
                    labelStyle={styles.labelCancel}
                  />
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
