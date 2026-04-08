import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Switch,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Pressable,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight } from '../src/utils/haptics';
import { BoardStyleActionButton } from '../src/components/BoardStyleActionButton';
import type { BoardViewMode } from '../src/types/board';
import {
  BOARD_SETTINGS_DEFAULTS,
  loadBoardSettings,
  mergeBoardSettings,
  resolveBoardDisplayTitle,
  type BoardSettings,
} from '../src/storage/boardSettings';

const BELOW_HEADER_GAP = 10;
const BG = '#f5f0e8';

const VIEW_OPTIONS: { label: string; value: BoardViewMode | 'inherit'; hint?: string }[] = [
  { label: 'Board', value: 'board' },
  { label: 'Table', value: 'table' },
  { label: 'Calendar', value: 'calendar' },
  { label: 'Dashboard', value: 'dashboard' },
  { label: 'Timeline', value: 'timeline' },
  { label: 'Last used', value: 'inherit', hint: 'Stay on whatever view you had open' },
];

function resolveBoardName(raw: string | string[] | undefined): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return s?.trim() ? s.trim() : 'My Board';
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

export default function BoardSettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { boardName: boardNameParam } = useLocalSearchParams<{ boardName?: string | string[] }>();
  const boardName = resolveBoardName(boardNameParam);

  const [settings, setSettings] = useState<BoardSettings>(BOARD_SETTINGS_DEFAULTS);
  const [nameDraft, setNameDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadBoardSettings(boardName).then((s) => {
      if (alive) {
        setSettings(s);
        setNameDraft(resolveBoardDisplayTitle(boardName, s));
        setDescDraft(s.boardDescription);
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [boardName]);

  const patch = useCallback(async (partial: Partial<BoardSettings>) => {
    setSettings((s) => ({ ...s, ...partial, version: 1 }));
    await mergeBoardSettings(boardName, partial);
  }, [boardName]);

  const close = () => {
    hapticLight();
    Keyboard.dismiss();
    router.back();
  };

  const currentDefaultToken: BoardViewMode | 'inherit' = settings.defaultView ?? 'inherit';

  const cardShadow =
    Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 5, height: 5 },
          shadowOpacity: 0.2,
          shadowRadius: 0,
        }
      : { elevation: 5 };

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
          Board settings
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
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, cardShadow]}>
            <Text style={styles.helper}>
              Tune how this board behaves. Preferences are stored on this device for now.
            </Text>

            <SettingsSection title="Board">
              <Text style={styles.metaLabel}>Board name</Text>
              <Text style={styles.sublabelTiny}>
                Shown at the top of the board. Home still opens this board by “{boardName}” until that
                list is synced.
              </Text>
              <TextInput
                value={nameDraft}
                editable={ready}
                onChangeText={setNameDraft}
                onBlur={() => {
                  const t = nameDraft.trim();
                  if (!t) {
                    setNameDraft(boardName);
                    void patch({ boardDisplayTitle: undefined });
                    return;
                  }
                  if (t === boardName.trim()) {
                    void patch({ boardDisplayTitle: undefined });
                  } else {
                    void patch({ boardDisplayTitle: t });
                  }
                }}
                placeholder="Board title"
                placeholderTextColor="#888"
                style={styles.inputSingle}
                maxLength={80}
                returnKeyType="done"
                autoCorrect={false}
                autoCapitalize="sentences"
              />

              <Text style={[styles.metaLabel, styles.gapTop]}>Description</Text>
              <Text style={styles.sublabelTiny}>Optional context for you or your team</Text>
              <TextInput
                value={descDraft}
                editable={ready}
                onChangeText={setDescDraft}
                onBlur={() => patch({ boardDescription: descDraft })}
                placeholder="Goals, sprint theme, links…"
                placeholderTextColor="#888"
                style={styles.input}
                multiline
                maxLength={500}
                autoCorrect
              />
            </SettingsSection>

            <SettingsSection title="Default view">
              <Text style={styles.sublabel}>
                When you open this board from the home list, start here.
              </Text>
              <View style={styles.chipWrap}>
                {VIEW_OPTIONS.map(({ label, value, hint }) => {
                  const selected =
                    value === 'inherit'
                      ? currentDefaultToken === 'inherit'
                      : currentDefaultToken === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => {
                        hapticLight();
                        if (value === 'inherit') {
                          patch({ defaultView: undefined });
                        } else {
                          patch({ defaultView: value });
                        }
                      }}
                      style={[styles.chip, selected && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
                      {hint && selected ? <Text style={styles.chipHint}>{hint}</Text> : null}
                    </Pressable>
                  );
                })}
              </View>
            </SettingsSection>

            <SettingsSection title="Productivity">
              <SettingsToggleRow
                label="Haptic feedback"
                sublabel="Light taps when you drag cards and use controls"
                value={settings.hapticsEnabled}
                onValueChange={(v) => patch({ hapticsEnabled: v })}
              />
              <View style={styles.divider} />
              <SettingsToggleRow
                label="Confirm destructive actions"
                sublabel="Extra check before archive-style actions (when supported)"
                value={settings.confirmBeforeDestructive}
                onValueChange={(v) => patch({ confirmBeforeDestructive: v })}
              />
              <View style={styles.divider} />
              <SettingsToggleRow
                label="Compact card density"
                sublabel="Tighter rows in table and list-style views"
                value={settings.compactCardDensity}
                onValueChange={(v) => patch({ compactCardDensity: v })}
              />
              <View style={styles.divider} />
              <SettingsToggleRow
                label="Show assignee avatars"
                sublabel="On cards and timeline bars when space allows"
                value={settings.showAssigneeAvatars}
                onValueChange={(v) => patch({ showAssigneeAvatars: v })}
              />
              <View style={styles.divider} />
              <SettingsToggleRow
                label="Open card details on tap"
                sublabel="Prefer the expanded card sheet over inline edit"
                value={settings.autoOpenCardDetails}
                onValueChange={(v) => patch({ autoOpenCardDetails: v })}
              />
            </SettingsSection>

            <SettingsSection title="Calendar & timeline">
              <Text style={styles.sublabel}>First day of the week</Text>
              <View style={styles.row2}>
                <Pressable
                  onPress={() => {
                    hapticLight();
                    patch({ weekStartsOn: 'monday' });
                  }}
                  style={[
                    styles.halfChip,
                    settings.weekStartsOn === 'monday' && styles.halfChipOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.halfChipText,
                      settings.weekStartsOn === 'monday' && styles.halfChipTextOn,
                    ]}
                  >
                    Monday
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    hapticLight();
                    patch({ weekStartsOn: 'sunday' });
                  }}
                  style={[
                    styles.halfChip,
                    settings.weekStartsOn === 'sunday' && styles.halfChipOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.halfChipText,
                      settings.weekStartsOn === 'sunday' && styles.halfChipTextOn,
                    ]}
                  >
                    Sunday
                  </Text>
                </Pressable>
              </View>
            </SettingsSection>

            <SettingsSection title="Reminders">
              <SettingsToggleRow
                label="Daily digest reminder"
                sublabel="Nudge once a day for due cards (requires notifications later)"
                value={settings.dailyDigestReminder}
                onValueChange={(v) => patch({ dailyDigestReminder: v })}
              />
              <View style={styles.divider} />
              <SettingsToggleRow
                label="Focused list by default"
                sublabel="Start in one-list focus when opening from shortcuts (reserved)"
                value={settings.focusModeByDefault}
                onValueChange={(v) => patch({ focusModeByDefault: v })}
              />
            </SettingsSection>

            <View style={styles.actions}>
              <BoardStyleActionButton
                shadowColor="#e0e0e0"
                onPress={close}
                label="Done"
                labelStyle={styles.labelDone}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

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
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  sublabelTiny: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    marginTop: -2,
  },
  gapTop: {
    marginTop: 16,
  },
  inputSingle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0a0a0a',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: BG,
  },
  input: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0a0a0a',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: BG,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  sublabel: {
    fontSize: 13,
    color: '#555',
    marginBottom: 12,
    lineHeight: 18,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: BG,
    maxWidth: '100%',
  },
  chipOn: {
    backgroundColor: '#e9f2ff',
    borderColor: '#0c66e4',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  chipTextOn: {
    color: '#0c66e4',
  },
  chipHint: {
    fontSize: 11,
    color: '#5e6c84',
    marginTop: 4,
    fontWeight: '500',
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
  row2: {
    flexDirection: 'row',
    gap: 10,
  },
  halfChip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: BG,
    alignItems: 'center',
  },
  halfChipOn: {
    backgroundColor: '#e9f2ff',
    borderColor: '#0c66e4',
  },
  halfChipText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0a0a0a',
  },
  halfChipTextOn: {
    color: '#0c66e4',
  },
  actions: {
    marginTop: 8,
    marginBottom: 4,
    alignItems: 'stretch',
  },
  labelDone: {
    color: '#0a0a0a',
  },
});
