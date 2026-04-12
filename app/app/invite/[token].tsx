import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { acceptInvitationByToken } from '../../src/api/invitations';
import { useTheme } from '../../src/theme';
import type { ThemeColors } from '../../src/theme/colors';

const BELOW_HEADER_GAP = 10;

function createInviteAcceptStyles(colors: ThemeColors) {
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
      marginBottom: 16,
      fontWeight: '500',
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    err: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.dangerText,
      marginBottom: 12,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 24,
      gap: 12,
      width: '100%',
      flexWrap: 'wrap',
    },
    labelCancel: {
      color: colors.textPrimary,
    },
    labelPrimary: {
      color: colors.textPrimary,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
    },
  });
}

type Phase = 'loading' | 'needsAuth' | 'error';

export default function AcceptBoardInviteScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createInviteAcceptStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const raw = useLocalSearchParams<{ token?: string | string[] }>();
  const token = useMemo(() => {
    const t = raw.token;
    const s = Array.isArray(t) ? t[0] : t;
    return s?.trim() ?? '';
  }, [raw.token]);

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorText, setErrorText] = useState('');
  const [boardPreviewName, setBoardPreviewName] = useState<string | undefined>();

  const close = useCallback(() => {
    hapticLight();
    router.back();
  }, []);

  useEffect(() => {
    if (!token || token.length < 32) {
      setPhase('error');
      setErrorText('This invite link is missing or invalid.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await acceptInvitationByToken(token);
        if (cancelled) return;
        if ('needsAuth' in r && r.needsAuth) {
          setBoardPreviewName(r.boardName);
          setPhase('needsAuth');
          return;
        }
        if ('ok' in r && r.ok) {
          router.replace({
            pathname: '/board',
            params: { boardId: r.boardId, boardName: r.boardName ?? 'Board' },
          });
          return;
        }
        setPhase('error');
        setErrorText('Could not open this invitation.');
      } catch (e) {
        if (cancelled) return;
        setPhase('error');
        setErrorText(e instanceof Error ? e.message : 'This invitation is no longer valid.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSignIn = useCallback(() => {
    hapticLight();
    router.replace({ pathname: '/login', params: { inviteToken: token } });
  }, [token]);

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
          Board invite
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
            {phase === 'loading' ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.iconPrimary} />
                <Text style={styles.helper}>Checking your invitation…</Text>
              </View>
            ) : null}

            {phase === 'needsAuth' ? (
              <>
                <Text style={styles.title}>You’re invited</Text>
                <Text style={styles.helper}>
                  {boardPreviewName
                    ? `Sign in with the email this invite was sent to, then you’ll join “${boardPreviewName}”.`
                    : 'Sign in with the email this invite was sent to, then you’ll join this board.'}
                </Text>
                <View style={styles.actions}>
                  <BoardStyleActionButton
                    shadowColor={colors.shadowFill}
                    onPress={() => {
                      hapticLight();
                      router.replace('/');
                    }}
                    label="Maybe later"
                    labelStyle={styles.labelCancel}
                  />
                  <BoardStyleActionButton
                    shadowColor={colors.success}
                    onPress={onSignIn}
                    label="Sign in"
                    labelStyle={styles.labelPrimary}
                  />
                </View>
              </>
            ) : null}

            {phase === 'error' ? (
              <>
                <Text style={styles.title}>Invite unavailable</Text>
                <Text style={styles.err}>{errorText}</Text>
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
