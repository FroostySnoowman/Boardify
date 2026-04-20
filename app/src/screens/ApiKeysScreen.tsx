import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
  Pressable,
  ActivityIndicator,
  Alert,
  Share,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { useTheme } from '../theme';
import type { ThemeColors } from '../theme/colors';
import { listUserApiKeys, createUserApiKey, revokeUserApiKey, type UserApiKeyListItem } from '../api/userApiKeys';
import { listBoards } from '../api/boards';
import type { ApiBoardRow } from '../api/boardMappers';
import { ApiKeysListSkeleton } from '../components/skeletons/ApiKeysListSkeleton';
import { NeuListRowPressable, getNeuListRowCardBase } from '../components/NeuListRowPressable';

type Phase = 'list' | 'create' | 'reveal';

const BELOW_HEADER_GAP = 10;

function createStyles(colors: ThemeColors) {
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
      paddingHorizontal: 20,
      maxWidth: 520,
      width: '100%',
      alignSelf: 'center',
    },
    docNeuWrap: {
      alignSelf: 'stretch',
      width: '100%',
      marginBottom: 16,
    },
    docBookIcon: {
      marginRight: 10,
    },
    docLinkTextCol: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
    },
    docLinkTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    docLinkSub: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.subtitle,
      marginTop: 2,
    },
    primaryBtn: {
      backgroundColor: colors.textPrimary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 12,
    },
    primaryBtnText: {
      color: colors.canvas,
      fontSize: 16,
      fontWeight: '700',
    },
    secondaryBtn: {
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    secondaryBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    keyRow: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    keyName: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    keyMeta: {
      fontSize: 13,
      color: colors.subtitle,
      marginTop: 4,
    },
    revoked: {
      opacity: 0.5,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
      marginBottom: 14,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.sectionLabel,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    chipRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    chip: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: 'center',
    },
    chipText: {
      fontSize: 14,
      fontWeight: '700',
    },
    boardPickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    boardPickName: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    secretBox: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      marginVertical: 12,
    },
    secretText: {
      fontSize: 14,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      color: colors.textPrimary,
      lineHeight: 20,
    },
    warn: {
      fontSize: 13,
      color: colors.subtitle,
      lineHeight: 19,
      marginBottom: 8,
    },
  });
}

export default function ApiKeysScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [phase, setPhase] = useState<Phase>('list');
  const [keys, setKeys] = useState<UserApiKeyListItem[]>([]);
  const [boards, setBoards] = useState<ApiBoardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createName, setCreateName] = useState('');
  const [scopeBoards, setScopeBoards] = useState(false);
  const [selectedBoardIds, setSelectedBoardIds] = useState<Set<string>>(new Set());
  const [revealSecret, setRevealSecret] = useState<string | null>(null);

  const resetCreateForm = useCallback(() => {
    setCreateName('');
    setScopeBoards(false);
    setSelectedBoardIds(new Set());
    setRevealSecret(null);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [k, b] = await Promise.all([listUserApiKeys(), listBoards()]);
      setKeys(k.keys ?? []);
      setBoards((b.boards ?? []).filter((row) => !row.archived_at));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not load API keys';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setPhase('list');
      resetCreateForm();
      void refresh();
    }, [refresh, resetCreateForm])
  );

  const close = () => {
    hapticLight();
    Keyboard.dismiss();
    router.back();
  };

  const openDocs = () => {
    hapticLight();
    router.push('/api-reference');
  };

  const toggleBoard = (id: string) => {
    hapticLight();
    setSelectedBoardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitCreate = async () => {
    const name = createName.trim();
    if (!name) {
      Alert.alert('Name required', 'Give this key a label so you can find it later.');
      return;
    }
    if (scopeBoards && selectedBoardIds.size === 0) {
      Alert.alert('Pick boards', 'Select at least one board for a scoped key.');
      return;
    }
    hapticLight();
    setSaving(true);
    try {
      const { secret } = await createUserApiKey({
        name,
        scopeKind: scopeBoards ? 'boards' : 'all',
        boardIds: scopeBoards ? [...selectedBoardIds] : undefined,
      });
      setRevealSecret(secret);
      setPhase('reveal');
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not create key';
      Alert.alert('Could not create key', msg);
    } finally {
      setSaving(false);
    }
  };

  const confirmRevoke = (row: UserApiKeyListItem) => {
    if (row.revokedAt) return;
    hapticLight();
    Alert.alert('Revoke key', `“${row.name}” will stop working immediately.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await revokeUserApiKey(row.id);
              await refresh();
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Could not revoke';
              Alert.alert('Error', msg);
            }
          })();
        },
      },
    ]);
  };

  const shareSecret = async () => {
    if (!revealSecret) return;
    hapticLight();
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(revealSecret);
        Alert.alert('Copied', 'The API key was copied to your clipboard.');
      } catch {
        Alert.alert('Copy manually', revealSecret);
      }
      return;
    }
    try {
      await Share.share({ message: revealSecret, title: 'Boardify API key' });
    } catch {
      // user dismissed
    }
  };

  const doneReveal = () => {
    hapticLight();
    setRevealSecret(null);
    setPhase('list');
    resetCreateForm();
  };

  const title =
    phase === 'list' ? 'API keys' : phase === 'create' ? 'New API key' : 'Save your key';

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
        <Stack.Screen.Title style={{ fontWeight: '800', color: colors.modalCreamHeaderTint }}>{title}</Stack.Screen.Title>
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
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          {phase === 'list' ? (
            <>
              <NeuListRowPressable
                wrapStyle={styles.docNeuWrap}
                shadowStyle={{ backgroundColor: colors.shadowFill }}
                topStyle={getNeuListRowCardBase(colors)}
                onPress={openDocs}
              >
                <View style={styles.docBookIcon}>
                  <Feather name="book-open" size={22} color={colors.textPrimary} />
                </View>
                <View style={styles.docLinkTextCol}>
                  <Text style={styles.docLinkTitle}>API documentation</Text>
                  <Text style={styles.docLinkSub}>Searchable reference · boards, cards, auth</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.iconChevron} />
              </NeuListRowPressable>

              {loading ? (
                <ApiKeysListSkeleton />
              ) : keys.length === 0 ? (
                <Text style={styles.warn}>
                  No keys yet. Create one to call the Boardify API from scripts, CI, or integrations. Keys can access
                  all your boards or only the ones you pick.
                </Text>
              ) : (
                keys.map((k) => (
                  <View key={k.id} style={[styles.keyRow, k.revokedAt ? styles.revoked : null]}>
                    <Text style={styles.keyName}>{k.name}</Text>
                    <Text style={styles.keyMeta}>
                      {k.tokenPrefix}… · {k.scopeKind === 'all' ? 'All boards' : `${k.boardIds?.length ?? 0} board(s)`}
                      {k.revokedAt ? ' · Revoked' : ''}
                      {k.lastUsedAt && !k.revokedAt ? ` · Last used ${k.lastUsedAt.slice(0, 10)}` : ''}
                    </Text>
                    {!k.revokedAt ? (
                      <Pressable
                        onPress={() => confirmRevoke(k)}
                        style={{ marginTop: 8, alignSelf: 'flex-start' }}
                        accessibilityRole="button"
                      >
                        <Text style={{ fontSize: 14, fontWeight: '700' as const, color: '#b91c1c' }}>Revoke</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))
              )}
              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  hapticLight();
                  resetCreateForm();
                  setPhase('create');
                }}
              >
                <Text style={styles.primaryBtnText}>Create API key</Text>
              </Pressable>
            </>
          ) : null}

          {phase === 'create' ? (
            <>
              <Text style={styles.label}>Display name</Text>
              <TextInput
                style={styles.input}
                value={createName}
                onChangeText={setCreateName}
                placeholder="e.g. GitHub Actions"
                placeholderTextColor={colors.subtitle}
                maxLength={120}
              />
              <Text style={styles.label}>Access</Text>
              <View style={styles.chipRow}>
                <Pressable
                  onPress={() => {
                    hapticLight();
                    setScopeBoards(false);
                  }}
                  style={[
                    styles.chip,
                    {
                      borderColor: !scopeBoards ? colors.textPrimary : colors.border,
                      backgroundColor: !scopeBoards ? colors.surfaceElevated : colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.textPrimary }]}>All boards</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    hapticLight();
                    setScopeBoards(true);
                  }}
                  style={[
                    styles.chip,
                    {
                      borderColor: scopeBoards ? colors.textPrimary : colors.border,
                      backgroundColor: scopeBoards ? colors.surfaceElevated : colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.textPrimary }]}>Specific boards</Text>
                </Pressable>
              </View>
              {scopeBoards ? (
                <>
                  <Text style={styles.warn}>Choose which boards this key may access.</Text>
                  {boards.map((b) => {
                    const on = selectedBoardIds.has(b.id);
                    return (
                      <Pressable key={b.id} style={styles.boardPickRow} onPress={() => toggleBoard(b.id)}>
                        <Text style={styles.boardPickName}>{b.name}</Text>
                        <Feather
                          name={on ? 'check-circle' : 'circle'}
                          size={22}
                          color={on ? colors.textPrimary : colors.iconChevron}
                        />
                      </Pressable>
                    );
                  })}
                </>
              ) : null}
              <Pressable
                style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
                onPress={() => void submitCreate()}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.canvas} />
                ) : (
                  <Text style={styles.primaryBtnText}>Create key</Text>
                )}
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => setPhase('list')}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </Pressable>
            </>
          ) : null}

          {phase === 'reveal' && revealSecret ? (
            <>
              <Text style={styles.warn}>
                Copy this secret now. For security it will not be shown again. Use Authorization: Bearer &lt;secret&gt;
                on HTTP requests and WebSockets.
              </Text>
              <View style={styles.secretBox}>
                <Text selectable style={styles.secretText}>
                  {revealSecret}
                </Text>
              </View>
              <Pressable style={styles.primaryBtn} onPress={() => void shareSecret()}>
                <Text style={styles.primaryBtnText}>
                  {Platform.OS === 'web' ? 'Copy to clipboard' : 'Copy / Share'}
                </Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={doneReveal}>
                <Text style={styles.secondaryBtnText}>Done</Text>
              </Pressable>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
