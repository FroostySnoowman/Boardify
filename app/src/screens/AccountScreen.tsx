import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../utils/haptics';
import { IPAD_TAB_CONTENT_TOP_PADDING } from '../config/layout';
import { TabScreenChrome } from '../components/TabScreenChrome';
import { ContextMenu } from '../components/ContextMenu';
import { requestDeleteAccount } from '../api/auth';
import { listBoards } from '../api/boards';
import { getAiUsageToday } from '../api/user';
import {
  getStoredDefaultBoardId,
  loadAccountUiPrefs,
  saveAccountUiPrefs,
} from '../storage/accountPrefs';
import { syncPushRegistrationFromAccountPrefs } from '../notifications/expoPush';
import { useTheme } from '../theme';

const SHIFT = 5;

type LocalPrefs = {
  notificationsEnabled: boolean;
  defaultBoardId: string | null;
};

type AiUsageState = {
  used: number;
  remaining: number;
  limit: number;
};

const DEFAULT_LOCAL: LocalPrefs = {
  notificationsEnabled: true,
  defaultBoardId: null,
};

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout, invalidateLocalAuth } = useAuth();
  const { colors, preference, setThemePreference, refreshThemeFromStorage } = useTheme();
  const [local, setLocal] = useState<LocalPrefs>(DEFAULT_LOCAL);
  const [defaultBoardLabel, setDefaultBoardLabel] = useState('None');
  const [aiUsage, setAiUsage] = useState<AiUsageState | null>(null);
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const isWeb = Platform.OS === 'web';
  const canUseWindow = isWeb && typeof window !== 'undefined';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        scrollContent: {
          flexGrow: 1,
          width: '100%',
        },
        hero: {
          marginBottom: 28,
          ...(isWeb ? { alignItems: 'center' as const } : {}),
        },
        title: {
          fontSize: 28,
          fontWeight: '800',
          color: colors.textPrimary,
          ...(isWeb ? { textAlign: 'center' as const, alignSelf: 'stretch', width: '100%' as const } : {}),
        },
        subtitle: {
          fontSize: 15,
          color: colors.subtitle,
          marginTop: 6,
          fontWeight: '500',
          ...(isWeb ? { textAlign: 'center' as const, alignSelf: 'stretch', width: '100%' as const } : {}),
        },
        signInBlock: {
          marginBottom: 24,
        },
        section: {
          marginBottom: 24,
        },
        sectionTitle: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.sectionLabel,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 12,
        },
        cardWrap: {
          position: 'relative',
          marginRight: SHIFT,
          marginBottom: SHIFT,
        },
        cardShadow: {
          position: 'absolute',
          left: SHIFT,
          top: SHIFT,
          right: -SHIFT,
          bottom: -SHIFT,
          backgroundColor: colors.shadowFill,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
        },
        card: {
          position: 'relative',
          backgroundColor: colors.surface,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          paddingVertical: 4,
          paddingHorizontal: 16,
        },
        configRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
        },
        configLabelBlock: {
          flex: 1,
        },
        configLabel: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.textPrimary,
        },
        configSublabel: {
          fontSize: 13,
          color: colors.textSecondary,
          marginTop: 2,
        },
        configDivider: {
          height: 1,
          backgroundColor: colors.divider,
          marginLeft: 0,
        },
        themeMenuTriggerWrap: {
          borderRadius: 0,
          width: '100%',
          alignSelf: 'stretch',
        },
      }),
    [colors, isWeb]
  );

  useFocusEffect(
    useCallback(() => {
      let cancel = false;
      void (async () => {
        const [id, ui] = await Promise.all([getStoredDefaultBoardId(), loadAccountUiPrefs()]);
        if (cancel) return;
        setLocal({
          defaultBoardId: id,
          notificationsEnabled: ui.notificationsEnabled,
        });
        void refreshThemeFromStorage();
        if (!id) {
          setDefaultBoardLabel('None');
        } else if (!user) {
          setDefaultBoardLabel(id ?? 'None');
        } else {
          try {
            const { boards: rows } = await listBoards();
            if (cancel) return;
            const row = rows?.find((b) => b.id === id);
            setDefaultBoardLabel(row?.name ?? id);
          } catch (e: unknown) {
            const status =
              typeof e === 'object' && e !== null && 'status' in e ? (e as { status?: number }).status : undefined;
            if (status === 401) {
              await invalidateLocalAuth();
            }
            if (!cancel) setDefaultBoardLabel(id);
          }
        }
        if (user) {
          try {
            const usage = await getAiUsageToday();
            if (!cancel) {
              setAiUsage({
                used: usage.used,
                remaining: usage.remaining,
                limit: usage.limit,
              });
            }
          } catch {
            if (!cancel) setAiUsage(null);
          }
        } else if (!cancel) {
          setAiUsage(null);
        }
      })();
      return () => {
        cancel = true;
      };
    }, [user, invalidateLocalAuth, refreshThemeFromStorage])
  );

  const persistNotifications = useCallback(async (enabled: boolean) => {
    const current = await loadAccountUiPrefs();
    await saveAccountUiPrefs({
      ...current,
      notificationsEnabled: enabled,
    });
    await syncPushRegistrationFromAccountPrefs();
  }, []);

  const updateNotifications = (value: boolean) => {
    hapticLight();
    setLocal((c) => ({ ...c, notificationsEnabled: value }));
    void persistNotifications(value);
  };

  const themeSublabel =
    preference === 'system' ? 'System' : preference === 'light' ? 'Light' : 'Dark';

  const themeMenuOptions = useMemo(
    () =>
      (['system', 'light', 'dark'] as const).map((mode) => {
        const base = mode === 'system' ? 'System' : mode === 'light' ? 'Light' : 'Dark';
        return {
          label: preference === mode ? `✓ ${base}` : base,
          value: mode,
          onPress: () => {
            hapticLight();
            void setThemePreference(mode);
          },
        };
      }),
    [preference, setThemePreference],
  );

  const ipadPad = Platform.OS === 'ios' && Platform.isPad ? IPAD_TAB_CONTENT_TOP_PADDING : 0;
  const contentPaddingTop = (isWeb ? 24 : 12) + ipadPad;

  const scroll = (
    <ScrollView
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: contentPaddingTop,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: isWeb ? 24 : 16,
          maxWidth: isWeb ? 600 : undefined,
          alignSelf: isWeb ? 'center' : undefined,
        },
      ]}
      showsVerticalScrollIndicator={false}
      bounces={Platform.OS === 'ios'}
    >
      <View style={styles.hero}>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.subtitle}>{user?.email ?? 'Not signed in'}</Text>
      </View>

      {!user ? (
        <View style={styles.signInBlock}>
          <View style={styles.cardWrap}>
            <View style={styles.cardShadow} />
            <View style={styles.card}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.configRow}
                onPress={() => {
                  hapticLight();
                  router.push('/login');
                }}
              >
                <View style={styles.configLabelBlock}>
                  <Text style={styles.configLabel}>Sign in</Text>
                  <Text style={styles.configSublabel}>
                    Use your email, Google, or Apple to sync boards.
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.iconChevron} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.cardWrap}>
          <View style={styles.cardShadow} />
          <View style={styles.card}>
            <ConfigRow
              label="Notifications"
              sublabel="Push for board updates"
              rowStyle={styles.configRow}
              labelStyle={styles.configLabel}
              sublabelStyle={styles.configSublabel}
              labelBlockStyle={styles.configLabelBlock}
              right={
                <Switch
                  value={local.notificationsEnabled}
                  onValueChange={updateNotifications}
                  trackColor={{ false: colors.switchTrackOff, true: colors.successTrack }}
                  thumbColor={colors.switchThumb}
                />
              }
            />
            <ConfigRowDivider dividerStyle={styles.configDivider} />
            <ConfigRow
              label="Default board"
              sublabel={defaultBoardLabel}
              rowStyle={styles.configRow}
              labelStyle={styles.configLabel}
              sublabelStyle={styles.configSublabel}
              labelBlockStyle={styles.configLabelBlock}
              chevronColor={colors.iconChevron}
              onPress={() => {
                hapticLight();
                router.push('/default-board');
              }}
              showChevron
            />
            <ConfigRowDivider dividerStyle={styles.configDivider} />
            {Platform.OS === 'ios' ? (
              <ContextMenu
                iosGlassMenuTrigger={false}
                triggerWrapperStyle={styles.themeMenuTriggerWrap}
                options={themeMenuOptions}
                trigger={
                  <ConfigRow
                    label="Theme"
                    sublabel={themeSublabel}
                    rowStyle={styles.configRow}
                    labelStyle={styles.configLabel}
                    sublabelStyle={styles.configSublabel}
                    labelBlockStyle={styles.configLabelBlock}
                    chevronColor={colors.iconChevron}
                    showChevron
                  />
                }
              />
            ) : (
              <ConfigRow
                label="Theme"
                sublabel={themeSublabel}
                rowStyle={styles.configRow}
                labelStyle={styles.configLabel}
                sublabelStyle={styles.configSublabel}
                labelBlockStyle={styles.configLabelBlock}
                chevronColor={colors.iconChevron}
                onPress={() => {
                  const next = {
                    system: 'light' as const,
                    light: 'dark' as const,
                    dark: 'system' as const,
                  };
                  hapticLight();
                  void setThemePreference(next[preference]);
                }}
                showChevron
              />
            )}
            {user ? (
              <>
                <ConfigRowDivider dividerStyle={styles.configDivider} />
                <ConfigRow
                  label="AI daily usage"
                  sublabel={
                    aiUsage
                      ? `${aiUsage.used}/${aiUsage.limit} used · ${aiUsage.remaining} left`
                      : 'Not available right now'
                  }
                  rowStyle={styles.configRow}
                  labelStyle={styles.configLabel}
                  sublabelStyle={styles.configSublabel}
                  labelBlockStyle={styles.configLabelBlock}
                />
              </>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.cardWrap}>
          <View style={styles.cardShadow} />
          <View style={styles.card}>
            {user ? (
              <>
                <ConfigRow
                  label="Profile"
                  sublabel="Name, photo"
                  rowStyle={styles.configRow}
                  labelStyle={styles.configLabel}
                  sublabelStyle={styles.configSublabel}
                  labelBlockStyle={styles.configLabelBlock}
                  chevronColor={colors.iconChevron}
                  onPress={() => {
                    hapticLight();
                    router.push('/profile');
                  }}
                  showChevron
                />
                <ConfigRowDivider dividerStyle={styles.configDivider} />
                <ConfigRow
                  label="Developer API"
                  sublabel="API keys, automation, REST docs"
                  rowStyle={styles.configRow}
                  labelStyle={styles.configLabel}
                  sublabelStyle={styles.configSublabel}
                  labelBlockStyle={styles.configLabelBlock}
                  chevronColor={colors.iconChevron}
                  onPress={() => {
                    hapticLight();
                    router.push('/api-keys');
                  }}
                  showChevron
                />
                <ConfigRowDivider dividerStyle={styles.configDivider} />
                <ConfigRow
                  label="Delete account"
                  sublabel={
                    deleteAccountBusy
                      ? 'Sending confirmation email…'
                      : 'Requires confirmation by email before permanent deletion'
                  }
                  rowStyle={styles.configRow}
                  labelStyle={[styles.configLabel, { color: colors.danger }]}
                  sublabelStyle={styles.configSublabel}
                  labelBlockStyle={styles.configLabelBlock}
                  onPress={() => {
                    if (deleteAccountBusy) return;
                    hapticLight();
                    const sendEmail = () => {
                      setDeleteAccountBusy(true);
                      void requestDeleteAccount()
                        .then((msg) => {
                          const text = msg || 'A confirmation email has been sent.';
                          if (canUseWindow) window.alert(text);
                          else Alert.alert('Check your email', text);
                        })
                        .catch((e: unknown) => {
                          const message = e instanceof Error ? e.message : 'Could not send confirmation email.';
                          if (canUseWindow) window.alert(message);
                          else Alert.alert('Unable to request deletion', message);
                        })
                        .finally(() => setDeleteAccountBusy(false));
                    };

                    if (canUseWindow) {
                      const ok = window.confirm(
                        'Delete account?\n\nWe will email a secure confirmation link to your account email. Your account is only deleted after you confirm from that email.'
                      );
                      if (ok) sendEmail();
                      return;
                    }

                    Alert.alert(
                      'Delete account',
                      'We will email a secure confirmation link to your account email. Your account is only deleted after you confirm from that email.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Send email', style: 'destructive', onPress: sendEmail },
                      ]
                    );
                  }}
                />
                <ConfigRowDivider dividerStyle={styles.configDivider} />
                <ConfigRow
                  label="Sign out"
                  sublabel=""
                  rowStyle={styles.configRow}
                  labelStyle={styles.configLabel}
                  sublabelStyle={styles.configSublabel}
                  labelBlockStyle={styles.configLabelBlock}
                  onPress={() => {
                    hapticLight();
                    if (canUseWindow) {
                      const ok = window.confirm('Sign out?');
                      if (ok) void logout();
                      return;
                    }
                    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Sign out', style: 'destructive', onPress: () => logout() },
                    ]);
                  }}
                />
              </>
            ) : (
              <ConfigRow
                label="Profile"
                sublabel="Sign in to edit your profile"
                rowStyle={styles.configRow}
                labelStyle={styles.configLabel}
                sublabelStyle={styles.configSublabel}
                labelBlockStyle={styles.configLabelBlock}
              />
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.cardWrap}>
          <View style={styles.cardShadow} />
          <View style={styles.card}>
            <ConfigRow
              label="Privacy Policy"
              sublabel="How we handle your data"
              rowStyle={styles.configRow}
              labelStyle={styles.configLabel}
              sublabelStyle={styles.configSublabel}
              labelBlockStyle={styles.configLabelBlock}
              chevronColor={colors.iconChevron}
              onPress={() => {
                hapticLight();
                router.push({ pathname: '/privacy', params: { from: 'account' } });
              }}
              showChevron
            />
            <ConfigRowDivider dividerStyle={styles.configDivider} />
            <ConfigRow
              label="Terms of Service"
              sublabel="Rules for using Boardify"
              rowStyle={styles.configRow}
              labelStyle={styles.configLabel}
              sublabelStyle={styles.configSublabel}
              labelBlockStyle={styles.configLabelBlock}
              chevronColor={colors.iconChevron}
              onPress={() => {
                hapticLight();
                router.push({ pathname: '/terms', params: { from: 'account' } });
              }}
              showChevron
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );

  if (isWeb) {
    return <View style={styles.container}>{scroll}</View>;
  }

  return <TabScreenChrome>{scroll}</TabScreenChrome>;
}

function ConfigRow({
  label,
  sublabel,
  right,
  onPress,
  showChevron,
  rowStyle,
  labelBlockStyle,
  labelStyle,
  sublabelStyle,
  chevronColor,
}: {
  label: string;
  sublabel: string;
  right?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  rowStyle: object;
  labelBlockStyle: object;
  labelStyle: object;
  sublabelStyle: object;
  chevronColor?: string;
}) {
  const { colors } = useTheme();
  const chevron = chevronColor ?? colors.iconChevron;
  const content = (
    <>
      <View style={labelBlockStyle}>
        <Text style={labelStyle}>{label}</Text>
        {sublabel ? <Text style={sublabelStyle}>{sublabel}</Text> : null}
      </View>
      {right ?? (showChevron ? <Feather name="chevron-right" size={18} color={chevron} /> : null)}
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={rowStyle}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={rowStyle}>{content}</View>;
}

function ConfigRowDivider({ dividerStyle }: { dividerStyle: object }) {
  return <View style={dividerStyle} />;
}
