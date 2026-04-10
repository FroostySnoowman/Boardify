import React, { useCallback, useEffect, useMemo, useRef, useState, createElement } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Switch,
  KeyboardAvoidingView,
  Pressable,
} from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { hapticLight } from '../src/utils/haptics';
import {
  BOARD_NOTIFICATION_DEFAULTS,
  clampDayMinutes,
  notificationMinutesToDate,
  dateToNotificationMinutes,
  type BoardNotificationSettings,
} from '../src/storage/boardNotificationSettings';
import { getNotificationSettings, patchNotificationSettings } from '../src/api/boards';
import { BoardNotificationsSkeleton } from '../src/components/skeletons';
import { useTheme } from '../src/theme';
import type { ThemeColors } from '../src/theme/colors';

const DateTimePickerNative =
  Platform.OS === 'web'
    ? null
    : (require('@react-native-community/datetimepicker').default as typeof import('@react-native-community/datetimepicker').default);

const BELOW_HEADER_GAP = 10;

function resolveBoardName(raw: string | string[] | undefined): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return s?.trim() ? s.trim() : 'My Board';
}

function timeOnReferenceDate(hours: number, minutes: number): Date {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function mergeTimeOfDay(base: Date, picked: Date): Date {
  const d = new Date(base);
  d.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return d;
}

function formatLocalTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function toWebTimeValue(d: Date): string {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function fromWebTimeValue(s: string, fallback: Date): Date {
  const [hh, mm] = s.split(':').map((x) => parseInt(x, 10));
  return mergeTimeOfDay(fallback, timeOnReferenceDate(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0));
}

function webTimeInputRowStyle(colors: ThemeColors): Record<string, string | number> {
  return {
    flex: 1,
    minWidth: 100,
    maxWidth: 220,
    marginLeft: 16,
    boxSizing: 'border-box',
    padding: '8px 10px',
    fontSize: 16,
    fontWeight: 600,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted,
    border: `1px solid ${colors.divider}`,
    borderRadius: 8,
    outline: 'none',
    fontVariantNumeric: 'tabular-nums',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };
}

function createBoardNotificationStyles(colors: ThemeColors) {
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
    },
    helper: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 20,
      fontWeight: '500',
    },
    section: {
      marginBottom: 22,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textPrimary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 12,
    },
    quietSummary: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.textSecondary,
      marginTop: 8,
      marginBottom: 4,
      lineHeight: 18,
    },
    timeRowTrailing: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      flexShrink: 0,
      maxWidth: '52%',
    },
    timeRowValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    timeRowPressed: {
      opacity: 0.85,
    },
    quietWebRowFlat: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 8,
      width: '100%',
    },
    iosPickerPanel: {
      marginTop: 10,
      marginBottom: 4,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.divider,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
    },
    iosPickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    iosPickerTitle: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    iosPickerDone: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.boardLink,
    },
    iosPickerWheel: {
      width: '100%',
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 6,
    },
    toggleTextCol: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
    },
    toggleLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    toggleSublabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
      lineHeight: 18,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.divider,
      marginVertical: 4,
    },
  });
}

type NotificationSheet = ReturnType<typeof createBoardNotificationStyles>;

function SettingsSection({
  sheet,
  title,
  children,
}: {
  sheet: NotificationSheet;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={sheet.section}>
      <Text style={sheet.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SettingsToggleRow({
  sheet,
  colors,
  label,
  sublabel,
  value,
  onValueChange,
}: {
  sheet: NotificationSheet;
  colors: ThemeColors;
  label: string;
  sublabel?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={sheet.toggleRow}>
      <View style={sheet.toggleTextCol}>
        <Text style={sheet.toggleLabel}>{label}</Text>
        {sublabel ? <Text style={sheet.toggleSublabel}>{sublabel}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          hapticLight();
          onValueChange(v);
        }}
        trackColor={{ false: colors.switchTrackOff, true: colors.successTrack }}
        thumbColor={Platform.OS === 'ios' ? undefined : value ? colors.switchThumb : colors.surfaceMuted}
      />
    </View>
  );
}

function mergePrefsFromApi(prefs: Record<string, unknown> | null): BoardNotificationSettings {
  if (!prefs) return { ...BOARD_NOTIFICATION_DEFAULTS };
  const p = prefs as Partial<BoardNotificationSettings>;
  return {
    ...BOARD_NOTIFICATION_DEFAULTS,
    ...p,
    version: 1,
    quietFromMinutes: clampDayMinutes(
      typeof p.quietFromMinutes === 'number' ? p.quietFromMinutes : BOARD_NOTIFICATION_DEFAULTS.quietFromMinutes
    ),
    quietUntilMinutes: clampDayMinutes(
      typeof p.quietUntilMinutes === 'number' ? p.quietUntilMinutes : BOARD_NOTIFICATION_DEFAULTS.quietUntilMinutes
    ),
  };
}

export default function BoardNotificationsScreen() {
  const { colors, resolvedScheme } = useTheme();
  const styles = useMemo(() => createBoardNotificationStyles(colors), [colors]);
  const webTimeStyle = useMemo(() => webTimeInputRowStyle(colors), [colors]);
  const pickerTheme = resolvedScheme === 'dark' ? ('dark' as const) : ('light' as const);

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { boardName: boardNameParam, boardId: boardIdParam } = useLocalSearchParams<{
    boardName?: string | string[];
    boardId?: string | string[];
  }>();
  const boardName = resolveBoardName(boardNameParam);
  const boardId = (Array.isArray(boardIdParam) ? boardIdParam[0] : boardIdParam)?.trim() ?? '';

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);
  const [mentionYou, setMentionYou] = useState(true);
  const [assignedCard, setAssignedCard] = useState(true);
  const [dueSoon, setDueSoon] = useState(true);
  const [commentsFollowed, setCommentsFollowed] = useState(false);
  const [quietHours, setQuietHours] = useState(false);
  const [quietFrom, setQuietFrom] = useState(() => timeOnReferenceDate(22, 0));
  const [quietUntil, setQuietUntil] = useState(() => timeOnReferenceDate(8, 0));
  const [iosPicker, setIosPicker] = useState<null | 'from' | 'until'>(null);
  const [androidPicker, setAndroidPicker] = useState<null | 'from' | 'until'>(null);
  const [hydrated, setHydrated] = useState(false);
  const quietFromRef = useRef(quietFrom);
  const quietUntilRef = useRef(quietUntil);
  const iosQuietDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  quietFromRef.current = quietFrom;
  quietUntilRef.current = quietUntil;

  useFocusEffect(
    useCallback(() => {
      let cancel = false;
      setHydrated(false);
      void (async () => {
        if (!boardId) {
          if (!cancel) setHydrated(true);
          return;
        }
        try {
          const { prefs } = await getNotificationSettings(boardId);
          const s = mergePrefsFromApi(prefs);
          if (cancel) return;
          setPushEnabled(s.pushEnabled);
          setEmailDigest(s.emailDigest);
          setMentionYou(s.mentionYou);
          setAssignedCard(s.assignedCard);
          setDueSoon(s.dueSoon);
          setCommentsFollowed(s.commentsFollowed);
          setQuietHours(s.quietHours);
          setQuietFrom(notificationMinutesToDate(s.quietFromMinutes));
          setQuietUntil(notificationMinutesToDate(s.quietUntilMinutes));
        } finally {
          if (!cancel) setHydrated(true);
        }
      })();
      return () => {
        cancel = true;
      };
    }, [boardId])
  );

  useEffect(() => {
    return () => {
      if (iosQuietDebounceRef.current) {
        clearTimeout(iosQuietDebounceRef.current);
        iosQuietDebounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!quietHours) {
      setIosPicker(null);
      setAndroidPicker(null);
    }
  }, [quietHours]);

  const close = () => {
    hapticLight();
    router.back();
  };

  const openIosPicker = useCallback((which: 'from' | 'until') => {
    hapticLight();
    setIosPicker((cur) => (cur === which ? null : which));
  }, []);

  const openAndroidPicker = useCallback((which: 'from' | 'until') => {
    hapticLight();
    setAndroidPicker(which);
  }, []);

  const onAndroidTimeChange = useCallback(
    (which: 'from' | 'until', event: DateTimePickerEvent, date?: Date) => {
      if (event.type === 'dismissed' || !date) {
        setAndroidPicker(null);
        return;
      }
      hapticLight();
      if (which === 'from') {
        setQuietFrom((prev) => {
          const next = mergeTimeOfDay(prev, date);
          if (boardId) {
            void patchNotificationSettings(boardId, {
              quietFromMinutes: dateToNotificationMinutes(next),
            });
          }
          return next;
        });
      } else {
        setQuietUntil((prev) => {
          const next = mergeTimeOfDay(prev, date);
          if (boardId) {
            void patchNotificationSettings(boardId, {
              quietUntilMinutes: dateToNotificationMinutes(next),
            });
          }
          return next;
        });
      }
      setAndroidPicker(null);
    },
    [boardId]
  );

  const scheduleIosQuietPersist = useCallback(() => {
    if (iosQuietDebounceRef.current) {
      clearTimeout(iosQuietDebounceRef.current);
    }
    iosQuietDebounceRef.current = setTimeout(() => {
      iosQuietDebounceRef.current = null;
      if (boardId) {
        void patchNotificationSettings(boardId, {
          quietFromMinutes: dateToNotificationMinutes(quietFromRef.current),
          quietUntilMinutes: dateToNotificationMinutes(quietUntilRef.current),
        });
      }
    }, 450);
  }, [boardId]);

  const flushIosQuietPersist = useCallback(() => {
    if (iosQuietDebounceRef.current) {
      clearTimeout(iosQuietDebounceRef.current);
      iosQuietDebounceRef.current = null;
    }
    if (boardId) {
      void patchNotificationSettings(boardId, {
        quietFromMinutes: dateToNotificationMinutes(quietFromRef.current),
        quietUntilMinutes: dateToNotificationMinutes(quietUntilRef.current),
      });
    }
  }, [boardId]);

  const cardShadow =
    Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 5, height: 5 },
          shadowOpacity: 0.2,
          shadowRadius: 0,
        }
      : { elevation: 5 };

  const quietRangeSummary = `${formatLocalTime(quietFrom)} – ${formatLocalTime(quietUntil)}`;

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
          Notifications
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
          {!hydrated ? (
            <BoardNotificationsSkeleton />
          ) : (
            <View style={[styles.card, cardShadow]}>
              <Text style={styles.helper}>
                Manage how you stay updated on “{boardName}”. Delivery respects system notification permissions
                where they apply.
              </Text>

              <SettingsSection sheet={styles} title="Delivery">
                <SettingsToggleRow
                  sheet={styles}
                  colors={colors}
                  label="Push notifications"
                  sublabel="Instant alerts when something important happens"
                  value={pushEnabled}
                  onValueChange={(v) => {
                    setPushEnabled(v);
                    if (boardId) void patchNotificationSettings(boardId, { pushEnabled: v });
                  }}
                />
                <View style={styles.divider} />
                <SettingsToggleRow
                  sheet={styles}
                  colors={colors}
                  label="Email digest"
                  sublabel="Once-a-day summary of board activity"
                  value={emailDigest}
                  onValueChange={(v) => {
                    setEmailDigest(v);
                    if (boardId) void patchNotificationSettings(boardId, { emailDigest: v });
                  }}
                />
              </SettingsSection>

              <SettingsSection sheet={styles} title="Activity on this board">
                <SettingsToggleRow
                  sheet={styles}
                  colors={colors}
                  label="@mentions of you"
                  value={mentionYou}
                  onValueChange={(v) => {
                    setMentionYou(v);
                    if (boardId) void patchNotificationSettings(boardId, { mentionYou: v });
                  }}
                />
                <View style={styles.divider} />
                <SettingsToggleRow
                  sheet={styles}
                  colors={colors}
                  label="Cards assigned to you"
                  value={assignedCard}
                  onValueChange={(v) => {
                    setAssignedCard(v);
                    if (boardId) void patchNotificationSettings(boardId, { assignedCard: v });
                  }}
                />
                <View style={styles.divider} />
                <SettingsToggleRow
                  sheet={styles}
                  colors={colors}
                  label="Due dates approaching"
                  sublabel="Cards due in the next 24 hours"
                  value={dueSoon}
                  onValueChange={(v) => {
                    setDueSoon(v);
                    if (boardId) void patchNotificationSettings(boardId, { dueSoon: v });
                  }}
                />
                <View style={styles.divider} />
                <SettingsToggleRow
                  sheet={styles}
                  colors={colors}
                  label="Comments on followed cards"
                  value={commentsFollowed}
                  onValueChange={(v) => {
                    setCommentsFollowed(v);
                    if (boardId) void patchNotificationSettings(boardId, { commentsFollowed: v });
                  }}
                />
              </SettingsSection>

              <SettingsSection sheet={styles} title="Quiet hours">
                <SettingsToggleRow
                  sheet={styles}
                  colors={colors}
                  label="Pause overnight"
                  sublabel="Silence push notifications during a daily time window"
                  value={quietHours}
                  onValueChange={(v) => {
                    setQuietHours(v);
                    if (boardId) void patchNotificationSettings(boardId, { quietHours: v });
                  }}
                />
                {quietHours ? (
                  <>
                    <Text style={styles.quietSummary}>{quietRangeSummary}</Text>
                    {Platform.OS === 'web' ? (
                      <>
                        <View style={styles.quietWebRowFlat}>
                          <Text style={styles.toggleLabel}>From</Text>
                          {createElement('input', {
                            type: 'time',
                            value: toWebTimeValue(quietFrom),
                            onChange: (e: { target: HTMLInputElement }) => {
                              setQuietFrom((prev) => {
                                const next = fromWebTimeValue(e.target.value, prev);
                                if (boardId)
                                  void patchNotificationSettings(boardId, {
                                    quietFromMinutes: dateToNotificationMinutes(next),
                                  });
                                return next;
                              });
                            },
                            style: webTimeStyle,
                          })}
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.quietWebRowFlat}>
                          <Text style={styles.toggleLabel}>Until</Text>
                          {createElement('input', {
                            type: 'time',
                            value: toWebTimeValue(quietUntil),
                            onChange: (e: { target: HTMLInputElement }) => {
                              setQuietUntil((prev) => {
                                const next = fromWebTimeValue(e.target.value, prev);
                                if (boardId)
                                  void patchNotificationSettings(boardId, {
                                    quietUntilMinutes: dateToNotificationMinutes(next),
                                  });
                                return next;
                              });
                            },
                            style: webTimeStyle,
                          })}
                        </View>
                      </>
                    ) : (
                      <>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Quiet hours start, ${formatLocalTime(quietFrom)}`}
                          accessibilityHint="Opens time picker"
                          onPress={() =>
                            Platform.OS === 'ios' ? openIosPicker('from') : openAndroidPicker('from')
                          }
                          style={({ pressed }) => [styles.toggleRow, pressed && styles.timeRowPressed]}
                        >
                          <View style={styles.toggleTextCol}>
                            <Text style={styles.toggleLabel}>From</Text>
                          </View>
                          <View style={styles.timeRowTrailing}>
                            <Text style={styles.timeRowValue} numberOfLines={1}>
                              {formatLocalTime(quietFrom)}
                            </Text>
                            <Feather name="chevron-right" size={18} color={colors.iconChevron} />
                          </View>
                        </Pressable>
                        <View style={styles.divider} />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Quiet hours end, ${formatLocalTime(quietUntil)}`}
                          accessibilityHint="Opens time picker"
                          onPress={() =>
                            Platform.OS === 'ios' ? openIosPicker('until') : openAndroidPicker('until')
                          }
                          style={({ pressed }) => [styles.toggleRow, pressed && styles.timeRowPressed]}
                        >
                          <View style={styles.toggleTextCol}>
                            <Text style={styles.toggleLabel}>Until</Text>
                          </View>
                          <View style={styles.timeRowTrailing}>
                            <Text style={styles.timeRowValue} numberOfLines={1}>
                              {formatLocalTime(quietUntil)}
                            </Text>
                            <Feather name="chevron-right" size={18} color={colors.iconChevron} />
                          </View>
                        </Pressable>

                        {Platform.OS === 'ios' && iosPicker != null ? (
                          <View style={styles.iosPickerPanel}>
                            <View style={styles.iosPickerHeader}>
                              <Text style={styles.iosPickerTitle}>
                                {iosPicker === 'from' ? 'Start time' : 'End time'}
                              </Text>
                              <Pressable
                                onPress={() => {
                                  hapticLight();
                                  flushIosQuietPersist();
                                  setIosPicker(null);
                                }}
                                hitSlop={10}
                              >
                                <Text style={styles.iosPickerDone}>Done</Text>
                              </Pressable>
                            </View>
                            {DateTimePickerNative ? (
                              <DateTimePickerNative
                                value={iosPicker === 'from' ? quietFrom : quietUntil}
                                mode="time"
                                display="spinner"
                                onChange={(_, date) => {
                                  if (!date) return;
                                  if (iosPicker === 'from') {
                                    setQuietFrom((prev) => mergeTimeOfDay(prev, date));
                                  } else {
                                    setQuietUntil((prev) => mergeTimeOfDay(prev, date));
                                  }
                                  scheduleIosQuietPersist();
                                }}
                                themeVariant={pickerTheme}
                                {...(Platform.OS === 'ios' ? { textColor: colors.textPrimary } : {})}
                                style={styles.iosPickerWheel}
                              />
                            ) : null}
                          </View>
                        ) : null}

                        {DateTimePickerNative && Platform.OS === 'android' && androidPicker === 'from' ? (
                          <DateTimePickerNative
                            value={quietFrom}
                            mode="time"
                            display="default"
                            onChange={(e, d) => onAndroidTimeChange('from', e, d)}
                          />
                        ) : null}
                        {DateTimePickerNative && Platform.OS === 'android' && androidPicker === 'until' ? (
                          <DateTimePickerNative
                            value={quietUntil}
                            mode="time"
                            display="default"
                            onChange={(e, d) => onAndroidTimeChange('until', e, d)}
                          />
                        ) : null}
                      </>
                    )}
                  </>
                ) : null}
              </SettingsSection>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
