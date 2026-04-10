import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../src/utils/haptics';
import { BoardStyleActionButton } from '../src/components/BoardStyleActionButton';
import type { BoardViewMode } from '../src/types/board';
import {
  BOARD_SETTINGS_DEFAULTS,
  mergeBoardSettingsFromRemoteJson,
  resolveBoardDisplayTitle,
  type BoardSettings,
} from '../src/storage/boardSettings';
import { getBoard, patchBoard } from '../src/api/boards';
import { useTheme } from '../src/theme';
import type { ThemeColors } from '../src/theme/colors';

const BELOW_HEADER_GAP = 10;
const INSET_CARD_SHIFT = 5;

const VIEW_OPTIONS: { label: string; value: BoardViewMode | 'inherit'; swatchColor: string }[] = [
  { label: 'Board', value: 'board', swatchColor: '#bfdbfe' },
  { label: 'Table', value: 'table', swatchColor: '#bbf7d0' },
  { label: 'Calendar', value: 'calendar', swatchColor: '#fde68a' },
  { label: 'Dashboard', value: 'dashboard', swatchColor: '#ddd6fe' },
  { label: 'Timeline', value: 'timeline', swatchColor: '#fbcfe8' },
  { label: 'Last used', value: 'inherit', swatchColor: '#e5e7eb' },
];

const WEEK_START_OPTIONS: { label: string; value: 'monday' | 'sunday'; swatchColor: string }[] = [
  { label: 'Monday', value: 'monday', swatchColor: '#c7d2fe' },
  { label: 'Sunday', value: 'sunday', swatchColor: '#fde047' },
];

function createBoardSettingsStyles(colors: ThemeColors) {
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
    metaLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 6,
    },
    sublabelTiny: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 8,
      marginTop: -2,
    },
    gapTop: {
      marginTop: 16,
    },
    inputSingle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.textPrimary,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      backgroundColor: colors.modalCreamCanvas,
    },
    input: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textPrimary,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      backgroundColor: colors.modalCreamCanvas,
      minHeight: 88,
      textAlignVertical: 'top',
    },
    sublabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
      lineHeight: 18,
    },
    insetListWrap: {
      position: 'relative',
      marginRight: INSET_CARD_SHIFT,
      marginBottom: INSET_CARD_SHIFT,
      alignSelf: 'stretch',
    },
    insetListShadow: {
      position: 'absolute',
      left: INSET_CARD_SHIFT,
      top: INSET_CARD_SHIFT,
      right: -INSET_CARD_SHIFT,
      bottom: -INSET_CARD_SHIFT,
      backgroundColor: colors.shadowFill,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    insetListCard: {
      position: 'relative',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      alignSelf: 'stretch',
    },
    insetListHint: {
      fontSize: 13,
      color: colors.textTertiary,
      marginBottom: 12,
      lineHeight: 18,
    },
    insetListInner: {
      width: '100%',
      alignSelf: 'stretch',
    },
    choiceRowOuter: {
      width: '100%',
      alignSelf: 'stretch',
    },
    choiceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      minHeight: 48,
      paddingVertical: 10,
      paddingRight: 4,
      paddingLeft: 0,
    },
    choiceRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    choiceRowSelected: {
      backgroundColor: colors.surfaceMuted,
    },
    choiceRowPressed: {
      backgroundColor: colors.tableRowAlt,
    },
    choiceSwatch: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.border,
      marginLeft: 10,
      marginRight: 12,
      flexShrink: 0,
    },
    choiceRowName: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
      minWidth: 0,
    },
    choiceRowNameOn: {
      color: colors.textPrimary,
      fontWeight: '800',
    },
    choiceRowToggle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.focusDotInactive,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    choiceRowToggleOn: {
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
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
    navLinkCell: {
      alignSelf: 'stretch',
      width: '100%',
      paddingVertical: 12,
    },
    navLinkRowPressed: {
      opacity: 0.7,
    },
    navLinkTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      flexWrap: 'nowrap',
      gap: 8,
    },
    navLinkChevron: {
      flexShrink: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    navLinkTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    navLinkSub: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
      lineHeight: 18,
    },
    actions: {
      marginTop: 8,
      marginBottom: 4,
      alignItems: 'stretch',
    },
    labelDone: {
      color: colors.textPrimary,
    },
  });
}

type BoardSettingsSheet = ReturnType<typeof createBoardSettingsStyles>;

function SettingsInsetChoiceList({
  sheet,
  hint,
  children,
}: {
  sheet: BoardSettingsSheet;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <View style={sheet.insetListWrap}>
      <View style={sheet.insetListShadow} />
      <View style={sheet.insetListCard}>
        <Text style={sheet.insetListHint}>{hint}</Text>
        <View style={sheet.insetListInner}>{children}</View>
      </View>
    </View>
  );
}

function SettingsChoiceRow({
  sheet,
  colors,
  label,
  selected,
  onPress,
  showBorderBottom,
  swatchColor,
  accessibilityRole,
}: {
  sheet: BoardSettingsSheet;
  colors: ThemeColors;
  label: string;
  selected: boolean;
  onPress: () => void;
  showBorderBottom: boolean;
  swatchColor: string;
  accessibilityRole?: 'radio' | 'checkbox';
}) {
  const role = accessibilityRole ?? 'radio';
  return (
    <Pressable
      onPress={() => {
        hapticLight();
        onPress();
      }}
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        sheet.choiceRowOuter,
        showBorderBottom && sheet.choiceRowBorder,
        selected && sheet.choiceRowSelected,
        pressed && sheet.choiceRowPressed,
      ]}
    >
      <View style={sheet.choiceRow}>
        <View style={[sheet.choiceSwatch, { backgroundColor: swatchColor }]} />
        <Text style={[sheet.choiceRowName, selected && sheet.choiceRowNameOn]} numberOfLines={1}>
          {label}
        </Text>
        <View style={[sheet.choiceRowToggle, selected && sheet.choiceRowToggleOn]}>
          {selected ? <Feather name="check" size={18} color={colors.iconPrimary} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function resolveBoardName(raw: string | string[] | undefined): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return s?.trim() ? s.trim() : 'My Board';
}

function SettingsSection({
  sheet,
  title,
  children,
}: {
  sheet: BoardSettingsSheet;
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
  sheet: BoardSettingsSheet;
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

export default function BoardSettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createBoardSettingsStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { boardName: boardNameParam, boardId: boardIdParam } = useLocalSearchParams<{
    boardName?: string | string[];
    boardId?: string | string[];
  }>();
  const boardName = resolveBoardName(boardNameParam);
  const boardId = (Array.isArray(boardIdParam) ? boardIdParam[0] : boardIdParam)?.trim() ?? '';

  const [settings, setSettings] = useState<BoardSettings>(BOARD_SETTINGS_DEFAULTS);
  const [nameDraft, setNameDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!boardId) {
      setReady(true);
      return () => {
        alive = false;
      };
    }
    getBoard(boardId)
      .then(({ board }) => {
        if (!alive) return;
        const s = mergeBoardSettingsFromRemoteJson(board.settings_json);
        setSettings(s);
        setNameDraft(resolveBoardDisplayTitle(boardName, s));
        setDescDraft(s.boardDescription);
        setReady(true);
      })
      .catch(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [boardId, boardName]);

  const patch = useCallback(
    async (partial: Partial<BoardSettings>) => {
      setSettings((s) => {
        const next: BoardSettings = { ...s, ...partial, version: 1 };
        if (boardId) {
          void patchBoard(boardId, { settings_json: next });
        }
        return next;
      });
    },
    [boardId]
  );

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
              : { backgroundColor: colors.modalCreamCanvas }
          }
        />
        <Stack.Screen.Title style={{ fontWeight: '800', color: colors.modalCreamHeaderTint }}>
          Board settings
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
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, cardShadow]}>
            <Text style={styles.helper}>Tune how this board behaves.</Text>

            <SettingsSection sheet={styles} title="Board">
              <Text style={styles.metaLabel}>Board name</Text>
              <Text style={styles.sublabelTiny}>
                Shown at the top of the board. The home list still identifies this board as “{boardName}”.
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
                placeholderTextColor={colors.placeholder}
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
                placeholderTextColor={colors.placeholder}
                style={styles.input}
                multiline
                maxLength={500}
                autoCorrect
              />
            </SettingsSection>

            <SettingsSection sheet={styles} title="Default view">
              <Text style={styles.sublabel}>When you open this board from the home list, start here.</Text>
              <SettingsInsetChoiceList sheet={styles} hint="Tap a row to choose the starting view.">
                {VIEW_OPTIONS.map(({ label, value, swatchColor }, index) => {
                  const selected =
                    value === 'inherit'
                      ? currentDefaultToken === 'inherit'
                      : currentDefaultToken === value;
                  return (
                    <SettingsChoiceRow
                      key={value}
                      sheet={styles}
                      colors={colors}
                      label={label}
                      swatchColor={swatchColor}
                      selected={selected}
                      showBorderBottom={index < VIEW_OPTIONS.length - 1}
                      accessibilityRole="radio"
                      onPress={() => {
                        if (value === 'inherit') {
                          patch({ defaultView: undefined });
                        } else {
                          patch({ defaultView: value });
                        }
                      }}
                    />
                  );
                })}
              </SettingsInsetChoiceList>
            </SettingsSection>

            <SettingsSection sheet={styles} title="Productivity">
              <SettingsToggleRow
                sheet={styles}
                colors={colors}
                label="Haptic feedback"
                sublabel="Light taps when you drag cards and use controls"
                value={settings.hapticsEnabled}
                onValueChange={(v) => patch({ hapticsEnabled: v })}
              />
              <View style={styles.divider} />
              <SettingsToggleRow
                sheet={styles}
                colors={colors}
                label="Confirm destructive actions"
                sublabel="Extra check before archive-style actions"
                value={settings.confirmBeforeDestructive}
                onValueChange={(v) => patch({ confirmBeforeDestructive: v })}
              />
              <View style={styles.divider} />
              <SettingsToggleRow
                sheet={styles}
                colors={colors}
                label="Compact card density"
                sublabel="Tighter rows in table and list-style views"
                value={settings.compactCardDensity}
                onValueChange={(v) => patch({ compactCardDensity: v })}
              />
              <View style={styles.divider} />
              <SettingsToggleRow
                sheet={styles}
                colors={colors}
                label="Show assignee avatars"
                sublabel="On cards and timeline bars when space allows"
                value={settings.showAssigneeAvatars}
                onValueChange={(v) => patch({ showAssigneeAvatars: v })}
              />
              <View style={styles.divider} />
              <SettingsToggleRow
                sheet={styles}
                colors={colors}
                label="Open card details on tap"
                sublabel="Prefer the expanded card sheet over inline edit"
                value={settings.autoOpenCardDetails}
                onValueChange={(v) => patch({ autoOpenCardDetails: v })}
              />
            </SettingsSection>

            <SettingsSection sheet={styles} title="Calendar & timeline">
              <Text style={styles.sublabel}>
                First day of the week for calendar and timeline layouts.
              </Text>
              <SettingsInsetChoiceList sheet={styles} hint="Tap a row to set the week start.">
                {WEEK_START_OPTIONS.map(({ label, value, swatchColor }, index) => {
                  const selected = settings.weekStartsOn === value;
                  return (
                    <SettingsChoiceRow
                      key={value}
                      sheet={styles}
                      colors={colors}
                      label={label}
                      swatchColor={swatchColor}
                      selected={selected}
                      showBorderBottom={index < WEEK_START_OPTIONS.length - 1}
                      accessibilityRole="radio"
                      onPress={() => patch({ weekStartsOn: value })}
                    />
                  );
                })}
              </SettingsInsetChoiceList>
            </SettingsSection>

            <SettingsSection sheet={styles} title="Archive & activity">
              <Pressable
                onPress={() => {
                  hapticLight();
                  router.push({
                    pathname: '/board-archive',
                    params: { boardId, boardName },
                  });
                }}
                style={({ pressed }) => [styles.navLinkCell, pressed && styles.navLinkRowPressed]}
              >
                <View style={styles.navLinkTitleRow}>
                  <Text style={styles.navLinkTitle} numberOfLines={1}>
                    Archived items
                  </Text>
                  <View style={styles.navLinkChevron} pointerEvents="none">
                    <Feather name="chevron-right" size={20} color={colors.iconMuted} />
                  </View>
                </View>
                <Text style={styles.navLinkSub}>Tasks and lists removed from the board</Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable
                onPress={() => {
                  hapticLight();
                  router.push({
                    pathname: '/board-audit',
                    params: { boardId, boardName },
                  });
                }}
                style={({ pressed }) => [styles.navLinkCell, pressed && styles.navLinkRowPressed]}
              >
                <View style={styles.navLinkTitleRow}>
                  <Text style={styles.navLinkTitle} numberOfLines={1}>
                    Activity log
                  </Text>
                  <View style={styles.navLinkChevron} pointerEvents="none">
                    <Feather name="chevron-right" size={20} color={colors.iconMuted} />
                  </View>
                </View>
                <Text style={styles.navLinkSub}>
                  Adds, edits, archives, restores, and new lists
                </Text>
              </Pressable>
            </SettingsSection>

            <SettingsSection sheet={styles} title="Reminders">
              <SettingsToggleRow
                sheet={styles}
                colors={colors}
                label="Daily digest reminder"
                sublabel="Nudge once a day for due cards"
                value={settings.dailyDigestReminder}
                onValueChange={(v) => patch({ dailyDigestReminder: v })}
              />
              <View style={styles.divider} />
              <SettingsToggleRow
                sheet={styles}
                colors={colors}
                label="Focused list by default"
                sublabel="Start in one-list focus when opening from shortcuts"
                value={settings.focusModeByDefault}
                onValueChange={(v) => patch({ focusModeByDefault: v })}
              />
            </SettingsSection>

            <View style={styles.actions}>
              <BoardStyleActionButton
                shadowColor={colors.shadowFill}
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
