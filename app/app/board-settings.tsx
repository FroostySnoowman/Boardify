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
  ActivityIndicator,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../src/utils/haptics';
import { BoardStyleActionButton } from '../src/components/BoardStyleActionButton';
import type { BoardViewMode, TaskLabel } from '../src/types/board';
import {
  BOARD_SETTINGS_DEFAULTS,
  mergeBoardSettingsFromRemoteJson,
  resolveBoardDisplayTitle,
  type BoardSettings,
} from '../src/storage/boardSettings';
import {
  getBoard,
  patchBoard,
  listBoardMembers,
  listBoardInvitations,
  createBoardInvitation,
  type ApiBoardInvitationRow,
  type ApiBoardMemberRow,
} from '../src/api/boards';
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

const TAG_COLOR_OPTIONS = [
  '#F3D9B1',
  '#a5d6a5',
  '#fca5a5',
  '#b8c5ff',
  '#fbbf24',
  '#c7d2fe',
  '#fde68a',
  '#fdba74',
  '#86efac',
  '#f9a8d4',
] as const;

function makeTagId(prefix: 'lb' | 'pr') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
      color: colors.textPrimary,
      opacity: 0.58,
      minWidth: 0,
    },
    choiceRowNameOn: {
      opacity: 1,
      fontWeight: '800',
    },
    choiceRowToggle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.iconMuted,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    choiceRowToggleOn: {
      borderColor: colors.successEmphasis,
      backgroundColor: colors.successTrack,
    },
    tagEditorRow: {
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
      gap: 10,
    },
    tagEditorTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    tagSwatchButton: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.border,
      flexShrink: 0,
    },
    tagNameInput: {
      flex: 1,
      minWidth: 0,
      fontSize: 15,
      fontWeight: '600',
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.divider,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: colors.modalCreamCanvas,
    },
    tagDeleteBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.divider,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceElevated,
      flexShrink: 0,
    },
    colorPickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      paddingLeft: 38,
      paddingRight: 4,
      paddingBottom: 2,
    },
    colorChoice: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.border,
    },
    colorChoiceOn: {
      borderColor: colors.textPrimary,
    },
    addTagBtn: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    addTagText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
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
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    memberRowLast: {
      borderBottomWidth: 0,
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.avatarBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberTextCol: {
      flex: 1,
      minWidth: 0,
    },
    memberPrimary: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    memberSecondary: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      fontWeight: '500',
    },
    rolePill: {
      alignSelf: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    rolePillText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textSecondary,
      textTransform: 'capitalize',
    },
    membersHint: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
      lineHeight: 18,
    },
    membersDisclosureTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.textPrimary,
      letterSpacing: 0.3,
    },
    membersDisclosureSub: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 4,
      fontWeight: '600',
    },
    memberListWrap: {
      marginTop: 4,
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

function EditableTagList({
  sheet,
  colors,
  title,
  hint,
  addLabel,
  emptyLabel,
  tags,
  idPrefix,
  onChange,
}: {
  sheet: BoardSettingsSheet;
  colors: ThemeColors;
  title: string;
  hint: string;
  addLabel: string;
  emptyLabel: string;
  tags: TaskLabel[];
  idPrefix: 'lb' | 'pr';
  onChange: (next: TaskLabel[]) => void;
}) {
  return (
    <SettingsInsetChoiceList sheet={sheet} hint={hint}>
      {tags.map((tag, index) => (
        <View key={tag.id} style={[sheet.tagEditorRow, index === tags.length - 1 && { borderBottomWidth: 0 }]}>
          <View style={sheet.tagEditorTop}>
            <Pressable
              onPress={() => {
                const current = TAG_COLOR_OPTIONS.indexOf(tag.color as (typeof TAG_COLOR_OPTIONS)[number]);
                const nextColor = TAG_COLOR_OPTIONS[(current + 1 + TAG_COLOR_OPTIONS.length) % TAG_COLOR_OPTIONS.length];
                onChange(tags.map((t) => (t.id === tag.id ? { ...t, color: nextColor } : t)));
              }}
              accessibilityRole="button"
              accessibilityLabel={`Change color for ${tag.name}`}
              style={[sheet.tagSwatchButton, { backgroundColor: tag.color }]}
            />
            <TextInput
              value={tag.name}
              onChangeText={(text) => {
                onChange(tags.map((t) => (t.id === tag.id ? { ...t, name: text } : t)));
              }}
              onBlur={() => {
                const trimmed = tag.name.trim();
                if (!trimmed) {
                  onChange(tags.filter((t) => t.id !== tag.id));
                  return;
                }
                if (trimmed !== tag.name) {
                  onChange(tags.map((t) => (t.id === tag.id ? { ...t, name: trimmed } : t)));
                }
              }}
              placeholder={`${title} name`}
              placeholderTextColor={colors.placeholder}
              style={sheet.tagNameInput}
              maxLength={24}
              autoCorrect={false}
              autoCapitalize="words"
            />
            <Pressable
              onPress={() => onChange(tags.filter((t) => t.id !== tag.id))}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${tag.name}`}
              style={({ pressed }) => [sheet.tagDeleteBtn, pressed && { opacity: 0.75 }]}
            >
              <Feather name="trash-2" size={15} color={colors.danger} />
            </Pressable>
          </View>
          <View style={sheet.colorPickerRow}>
            {TAG_COLOR_OPTIONS.map((c) => {
              const selected = c === tag.color;
              return (
                <Pressable
                  key={`${tag.id}-${c}`}
                  onPress={() => onChange(tags.map((t) => (t.id === tag.id ? { ...t, color: c } : t)))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${tag.name} color`}
                  style={[sheet.colorChoice, selected && sheet.colorChoiceOn, { backgroundColor: c }]}
                />
              );
            })}
          </View>
        </View>
      ))}
      <Pressable
        onPress={() => {
          const nextColor = TAG_COLOR_OPTIONS[tags.length % TAG_COLOR_OPTIONS.length];
          onChange([
            ...tags,
            {
              id: makeTagId(idPrefix),
              name: emptyLabel,
              color: nextColor,
            },
          ]);
        }}
        style={({ pressed }) => [sheet.addTagBtn, pressed && { opacity: 0.75 }]}
      >
        <Feather name="plus" size={16} color={colors.iconPrimary} />
        <Text style={sheet.addTagText}>{addLabel}</Text>
      </Pressable>
    </SettingsInsetChoiceList>
  );
}

function resolveBoardName(raw: string | string[] | undefined): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return s?.trim() ? s.trim() : 'My Board';
}

function collaboratorRoleLabel(role: string): string {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'Member';
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

  const [canManageInvites, setCanManageInvites] = useState(false);
  const [invitations, setInvitations] = useState<ApiBoardInvitationRow[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteBanner, setInviteBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const [boardMembers, setBoardMembers] = useState<ApiBoardMemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersLoadFailed, setMembersLoadFailed] = useState(false);
  const [membersListExpanded, setMembersListExpanded] = useState(false);

  useEffect(() => {
    setMembersListExpanded(false);
  }, [boardId]);

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

  useEffect(() => {
    let alive = true;
    if (!boardId) {
      setBoardMembers([]);
      setMembersLoadFailed(false);
      setMembersLoading(false);
      return () => {
        alive = false;
      };
    }
    setMembersLoading(true);
    setMembersLoadFailed(false);
    listBoardMembers(boardId)
      .then(({ members }) => {
        if (!alive) return;
        setBoardMembers(members);
      })
      .catch(() => {
        if (alive) {
          setBoardMembers([]);
          setMembersLoadFailed(true);
        }
      })
      .finally(() => {
        if (alive) setMembersLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [boardId]);

  useEffect(() => {
    let alive = true;
    if (!boardId) {
      setCanManageInvites(false);
      setInvitations([]);
      return () => {
        alive = false;
      };
    }
    listBoardInvitations(boardId)
      .then(({ invitations: rows }) => {
        if (!alive) return;
        const pending = rows.filter((r) => !r.accepted_at && !r.declined_at);
        setInvitations(pending);
        setCanManageInvites(true);
      })
      .catch((e: unknown) => {
        const status = typeof e === 'object' && e && 'status' in e ? (e as { status?: number }).status : undefined;
        if (status === 403) {
          if (alive) {
            setCanManageInvites(false);
            setInvitations([]);
          }
          return;
        }
        if (alive) {
          setCanManageInvites(true);
          setInvitations([]);
        }
      });
    return () => {
      alive = false;
    };
  }, [boardId]);

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

            {boardId ? (
              <SettingsSection sheet={styles} title="Collaborators">
                <Text style={styles.membersHint}>Everyone who can open this board.</Text>
                {membersLoading ? (
                  <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                    <ActivityIndicator color={colors.iconPrimary} />
                  </View>
                ) : membersLoadFailed ? (
                  <Text style={[styles.sublabel, { color: colors.dangerText }]}>
                    Could not load people on this board.
                  </Text>
                ) : boardMembers.length === 0 ? (
                  <Text style={styles.sublabel}>No collaborators listed.</Text>
                ) : (
                  <View style={{ marginBottom: canManageInvites ? 8 : 0 }}>
                    <Pressable
                      onPress={() => {
                        hapticLight();
                        setMembersListExpanded((v) => !v);
                      }}
                      style={({ pressed }) => [styles.navLinkCell, pressed && styles.navLinkRowPressed]}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: membersListExpanded }}
                      accessibilityLabel={
                        membersListExpanded
                          ? 'Hide people on this board'
                          : `Show people on this board, ${boardMembers.length} total`
                      }
                    >
                      <View style={styles.navLinkTitleRow}>
                        <View style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                          <Text style={styles.membersDisclosureTitle}>People on this board</Text>
                          <Text style={styles.membersDisclosureSub}>
                            {boardMembers.length} {boardMembers.length === 1 ? 'person' : 'people'}
                          </Text>
                        </View>
                        <View style={styles.navLinkChevron} pointerEvents="none">
                          <Feather
                            name={membersListExpanded ? 'chevron-up' : 'chevron-down'}
                            size={22}
                            color={colors.iconMuted}
                          />
                        </View>
                      </View>
                    </Pressable>
                    {membersListExpanded ? (
                      <View style={styles.memberListWrap}>
                        {boardMembers.map((m, index) => {
                          const primary = m.username?.trim() || m.email;
                          const showEmailSub = Boolean(m.username?.trim());
                          return (
                            <View
                              key={m.userId}
                              style={[styles.memberRow, index === boardMembers.length - 1 && styles.memberRowLast]}
                            >
                              <View style={styles.memberAvatar}>
                                <Feather name="user" size={20} color={colors.iconPrimary} />
                              </View>
                              <View style={styles.memberTextCol}>
                                <Text style={styles.memberPrimary} numberOfLines={1}>
                                  {primary}
                                </Text>
                                {showEmailSub ? (
                                  <Text style={styles.memberSecondary} numberOfLines={1}>
                                    {m.email}
                                  </Text>
                                ) : null}
                              </View>
                              <View style={styles.rolePill}>
                                <Text style={styles.rolePillText}>{collaboratorRoleLabel(m.role)}</Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                )}

                {canManageInvites ? (
                  <>
                    <View style={[styles.divider, { marginVertical: 16 }]} />
                    <Text style={styles.sublabel}>
                      Invite someone by email. They get a link to join; pending invites appear in their Messages
                      tab.
                    </Text>
                    <Text style={[styles.metaLabel, styles.gapTop]}>Email address</Text>
                    <TextInput
                      value={inviteEmail}
                      onChangeText={(t) => {
                        setInviteEmail(t);
                        setInviteBanner(null);
                      }}
                      editable={!inviteBusy}
                      placeholder="colleague@example.com"
                      placeholderTextColor={colors.placeholder}
                      style={styles.inputSingle}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                    />
                    {inviteBanner ? (
                      <Text
                        style={[
                          styles.sublabelTiny,
                          { marginTop: 8, color: inviteBanner.tone === 'ok' ? colors.successEmphasis : colors.dangerText },
                        ]}
                      >
                        {inviteBanner.text}
                      </Text>
                    ) : null}
                    <View style={[styles.actions, { marginTop: 14 }]}>
                      <BoardStyleActionButton
                        shadowColor={inviteBusy ? colors.shadowFill : colors.success}
                        onPress={() => {
                          if (inviteBusy) return;
                          const em = inviteEmail.trim();
                          if (!em.includes('@')) {
                            setInviteBanner({ tone: 'err', text: 'Enter a valid email address.' });
                            return;
                          }
                          hapticLight();
                          setInviteBusy(true);
                          setInviteBanner(null);
                          void createBoardInvitation(boardId, em)
                            .then(async (res) => {
                              setInviteEmail('');
                              const emailLine = res.emailSent
                                ? 'Invitation sent.'
                                : `Saved, but email did not send${res.emailError ? `: ${res.emailError}` : '.'}`;
                              setInviteBanner({ tone: res.emailSent ? 'ok' : 'err', text: emailLine });
                              try {
                                const { invitations: rows } = await listBoardInvitations(boardId);
                                const pending = rows.filter((r) => !r.accepted_at && !r.declined_at);
                                setInvitations(pending);
                              } catch {
                                setInvitations((prev) => [
                                  ...prev.filter((p) => p.id !== res.invitation.id),
                                  {
                                    id: res.invitation.id,
                                    board_id: boardId,
                                    inviter_user_id: 0,
                                    invited_email_normalized: res.invitation.invitedEmailNormalized,
                                    role: 'member',
                                    created_at: res.invitation.createdAt,
                                    expires_at: res.invitation.expiresAt,
                                    accepted_at: null,
                                    declined_at: null,
                                  },
                                ]);
                              }
                            })
                            .catch((e: unknown) => {
                              const msg = e instanceof Error ? e.message : 'Could not send invite.';
                              setInviteBanner({ tone: 'err', text: msg });
                            })
                            .finally(() => setInviteBusy(false));
                        }}
                        disabled={inviteBusy}
                        label={inviteBusy ? 'Sending…' : 'Send invite'}
                        labelStyle={{ color: colors.textPrimary }}
                      />
                    </View>
                    {invitations.length > 0 ? (
                      <View style={{ marginTop: 18 }}>
                        <Text style={styles.metaLabel}>Pending invites</Text>
                        {invitations.map((inv) => (
                          <Text key={inv.id} style={[styles.sublabel, { marginTop: 6 }]} numberOfLines={2}>
                            {inv.invited_email_normalized}
                            <Text style={{ color: colors.textTertiary, fontWeight: '500' }}>
                              {' '}
                              · expires {inv.expires_at.slice(0, 10)}
                            </Text>
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </>
                ) : null}
              </SettingsSection>
            ) : null}

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

            <SettingsSection sheet={styles} title="Card taxonomy">
              <Text style={styles.sublabel}>
                Customize selectable labels and priorities for cards across this board.
              </Text>
              <Text style={styles.metaLabel}>Labels</Text>
              <EditableTagList
                sheet={styles}
                colors={colors}
                title="Labels"
                hint="Rename, recolor, delete, or add labels."
                addLabel="Add label"
                emptyLabel="New label"
                idPrefix="lb"
                tags={settings.boardLabels}
                onChange={(next) => patch({ boardLabels: next })}
              />
              <Text style={[styles.metaLabel, styles.gapTop]}>Priorities</Text>
              <EditableTagList
                sheet={styles}
                colors={colors}
                title="Priorities"
                hint="Rename, recolor, delete, or add priorities."
                addLabel="Add priority"
                emptyLabel="New priority"
                idPrefix="pr"
                tags={settings.boardPriorities}
                onChange={(next) => patch({ boardPriorities: next })}
              />
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
