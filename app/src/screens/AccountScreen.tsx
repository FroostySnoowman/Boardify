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
import { listBoards } from '../api/boards';
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
  const isWeb = Platform.OS === 'web';

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
        },
        title: {
          fontSize: 28,
          fontWeight: '800',
          color: colors.textPrimary,
        },
        subtitle: {
          fontSize: 15,
          color: colors.subtitle,
          marginTop: 6,
          fontWeight: '500',
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
    [colors]
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
          return;
        }
        if (!user) {
          setDefaultBoardLabel(id ?? 'None');
          return;
        }
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
                  label="Sign out"
                  sublabel=""
                  rowStyle={styles.configRow}
                  labelStyle={styles.configLabel}
                  sublabelStyle={styles.configSublabel}
                  labelBlockStyle={styles.configLabelBlock}
                  onPress={() => {
                    hapticLight();
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
