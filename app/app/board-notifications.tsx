import React, { useCallback, useEffect, useRef, useState, createElement } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Switch,
  KeyboardAvoidingView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { hapticLight } from '../src/utils/haptics';
import {
  loadBoardNotificationSettings,
  mergeBoardNotificationSettings,
  notificationMinutesToDate,
  dateToNotificationMinutes,
} from '../src/storage/boardNotificationSettings';

const DateTimePickerNative =
  Platform.OS === 'web'
    ? null
    : (require('@react-native-community/datetimepicker').default as typeof import('@react-native-community/datetimepicker').default);

const BELOW_HEADER_GAP = 10;
const BG = '#f5f0e8';

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

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SettingsToggleRow({
  label,
  sublabel,
  value,
  onValueChange,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleTextCol}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {sublabel ? <Text style={styles.toggleSublabel}>{sublabel}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          hapticLight();
          onValueChange(v);
        }}
        trackColor={{ false: '#d4cfc4', true: '#a5d6a5' }}
        thumbColor={Platform.OS === 'ios' ? undefined : value ? '#fff' : '#f4f4f4'}
      />
    </View>
  );
}

export default function BoardNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { boardName: boardNameParam } = useLocalSearchParams<{ boardName?: string | string[] }>();
  const boardName = resolveBoardName(boardNameParam);

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
        const s = await loadBoardNotificationSettings(boardName);
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
        setHydrated(true);
      })();
      return () => {
        cancel = true;
      };
    }, [boardName])
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
          void mergeBoardNotificationSettings(boardName, {
            quietFromMinutes: dateToNotificationMinutes(next),
          });
          return next;
        });
      } else {
        setQuietUntil((prev) => {
          const next = mergeTimeOfDay(prev, date);
          void mergeBoardNotificationSettings(boardName, {
            quietUntilMinutes: dateToNotificationMinutes(next),
          });
          return next;
        });
      }
      setAndroidPicker(null);
    },
    [boardName]
  );

  const scheduleIosQuietPersist = useCallback(() => {
    if (iosQuietDebounceRef.current) {
      clearTimeout(iosQuietDebounceRef.current);
    }
    iosQuietDebounceRef.current = setTimeout(() => {
      iosQuietDebounceRef.current = null;
      void mergeBoardNotificationSettings(boardName, {
        quietFromMinutes: dateToNotificationMinutes(quietFromRef.current),
        quietUntilMinutes: dateToNotificationMinutes(quietUntilRef.current),
      });
    }, 450);
  }, [boardName]);

  const flushIosQuietPersist = useCallback(() => {
    if (iosQuietDebounceRef.current) {
      clearTimeout(iosQuietDebounceRef.current);
      iosQuietDebounceRef.current = null;
    }
    void mergeBoardNotificationSettings(boardName, {
      quietFromMinutes: dateToNotificationMinutes(quietFromRef.current),
      quietUntilMinutes: dateToNotificationMinutes(quietUntilRef.current),
    });
  }, [boardName]);

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
              : { backgroundColor: BG }
          }
        />
        <Stack.Screen.Title style={{ fontWeight: '800', color: '#0a0a0a' }}>
          Notifications
        </Stack.Screen.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" onPress={close} tintColor="#0a0a0a" />
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
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#0a0a0a" />
            </View>
          ) : (
          <View style={[styles.card, cardShadow]}>
            <Text style={styles.helper}>
              Manage how you stay updated on “{boardName}”. Delivery respects system notification permissions
              where they apply.
            </Text>

            <SettingsSection title="Delivery">
              <SettingsToggleRow
                label="Push notifications"
                sublabel="Instant alerts when something important happens"
                value={pushEnabled}
                onValueChange={(v) => {
                  setPushEnabled(v);
                  void mergeBoardNotificationSettings(boardName, { pushEnabled: v });
                }}
              />
              <View style={styles.divider} />
              <SettingsToggleRow
                label="Email digest"
                sublabel="Once-a-day summary of board activity"
                value={emailDigest}
                onValueChange={(v) => {
                  setEmailDigest(v);
                  void mergeBoardNotificationSettings(boardName, { emailDigest: v });
                }}
              />
            </SettingsSection>

            <SettingsSection title="Activity on this board">
              <SettingsToggleRow
                label="@mentions of you"
                value={mentionYou}
                onValueChange={(v) => {
                  setMentionYou(v);
                  void mergeBoardNotificationSettings(boardName, { mentionYou: v });
                }}
              />
              <View style={styles.divider} />
              <SettingsToggleRow
                label="Cards assigned to you"
                value={assignedCard}
                onValueChange={(v) => {
                  setAssignedCard(v);
                  void mergeBoardNotificationSettings(boardName, { assignedCard: v });
                }}
              />
              <View style={styles.divider} />
              <SettingsToggleRow
                label="Due dates approaching"
                sublabel="Cards due in the next 24 hours"
                value={dueSoon}
                onValueChange={(v) => {
                  setDueSoon(v);
                  void mergeBoardNotificationSettings(boardName, { dueSoon: v });
                }}
              />
              <View style={styles.divider} />
              <SettingsToggleRow
                label="Comments on followed cards"
                value={commentsFollowed}
                onValueChange={(v) => {
                  setCommentsFollowed(v);
                  void mergeBoardNotificationSettings(boardName, { commentsFollowed: v });
                }}
              />
            </SettingsSection>

            <SettingsSection title="Quiet hours">
              <SettingsToggleRow
                label="Pause overnight"
                sublabel="Silence push notifications during a daily time window"
                value={quietHours}
                onValueChange={(v) => {
                  setQuietHours(v);
                  void mergeBoardNotificationSettings(boardName, { quietHours: v });
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
                              void mergeBoardNotificationSettings(boardName, {
                                quietFromMinutes: dateToNotificationMinutes(next),
                              });
                              return next;
                            });
                          },
                          style: webTimeInputRowStyle,
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
                              void mergeBoardNotificationSettings(boardName, {
                                quietUntilMinutes: dateToNotificationMinutes(next),
                              });
                              return next;
                            });
                          },
                          style: webTimeInputRowStyle,
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
                        style={({ pressed }) => [
                          styles.toggleRow,
                          pressed && styles.timeRowPressed,
                        ]}
                      >
                        <View style={styles.toggleTextCol}>
                          <Text style={styles.toggleLabel}>From</Text>
                        </View>
                        <View style={styles.timeRowTrailing}>
                          <Text style={styles.timeRowValue} numberOfLines={1}>
                            {formatLocalTime(quietFrom)}
                          </Text>
                          <Feather name="chevron-right" size={18} color="#a3a3a3" />
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
                        style={({ pressed }) => [
                          styles.toggleRow,
                          pressed && styles.timeRowPressed,
                        ]}
                      >
                        <View style={styles.toggleTextCol}>
                          <Text style={styles.toggleLabel}>Until</Text>
                        </View>
                        <View style={styles.timeRowTrailing}>
                          <Text style={styles.timeRowValue} numberOfLines={1}>
                            {formatLocalTime(quietUntil)}
                          </Text>
                          <Feather name="chevron-right" size={18} color="#a3a3a3" />
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
                              themeVariant="light"
                              {...(Platform.OS === 'ios' ? { textColor: '#0a0a0a' as const } : {})}
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

const webTimeInputRowStyle: Record<string, string | number> = {
  flex: 1,
  minWidth: 100,
  maxWidth: 220,
  marginLeft: 16,
  boxSizing: 'border-box',
  padding: '8px 10px',
  fontSize: 16,
  fontWeight: 600,
  color: '#0a0a0a',
  backgroundColor: '#fafafa',
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 8,
  outline: 'none',
  fontVariantNumeric: 'tabular-nums',
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  flex: { flex: 1 },
  sheetFill: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  loadingWrap: {
    minHeight: 200,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000',
    padding: 24,
  },
  helper: {
    fontSize: 15,
    lineHeight: 22,
    color: '#444',
    marginBottom: 20,
    fontWeight: '500',
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0a0a0a',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  quietSummary: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
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
    color: '#525252',
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
    borderColor: 'rgba(0,0,0,0.1)',
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
  },
  iosPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  iosPickerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#444',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  iosPickerDone: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0c66e4',
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
    color: '#0a0a0a',
  },
  toggleSublabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginVertical: 4,
  },
});
