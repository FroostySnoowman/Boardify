import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, RefreshControl, Pressable } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../src/utils/haptics';
import { getBoardAudit, type AuditEntryRow } from '../src/api/boards';
import { useAuth } from '../src/contexts/AuthContext';
import { Avatar } from '../src/components/Avatar';
import { useTheme } from '../src/theme';
import type { ThemeColors } from '../src/theme/colors';

const BELOW_HEADER_GAP = 12;
const SHIFT = 5;
const CARD_RADIUS = 14;

function resolveBoardId(raw: string | string[] | undefined): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return s?.trim() ? s.trim() : '';
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'card_added':
      return 'Task added';
    case 'card_updated':
      return 'Task updated';
    case 'list_added':
      return 'List added';
    case 'card_archived':
      return 'Task archived';
    case 'list_archived':
      return 'List archived';
    case 'card_restored':
      return 'Task restored';
    case 'list_restored':
      return 'List restored';
    case 'board_created':
      return 'Board created';
    case 'board_updated':
      return 'Board updated';
    case 'list_deleted':
      return 'List deleted';
    case 'card_moved':
      return 'Task moved';
    case 'card_comment':
      return 'Comment';
    case 'user_assigned_to_card':
      return 'Assignee';
    default:
      return kind.replace(/_/g, ' ');
  }
}

type AuditFilterKey = 'all' | 'board' | 'tasks' | 'lists' | 'archive';

const FILTER_CHIPS: { key: AuditFilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'board', label: 'Board' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'lists', label: 'Lists' },
  { key: 'archive', label: 'Removals' },
];

function auditKindBucket(kind: string): AuditFilterKey | 'other' {
  if (kind === 'list_deleted' || kind.includes('archived')) return 'archive';
  if (kind.startsWith('board_')) return 'board';
  if (kind.startsWith('card_') || kind === 'user_assigned_to_card') return 'tasks';
  if (kind.startsWith('list_')) return 'lists';
  return 'other';
}

function entryMatchesFilter(kind: string, filter: AuditFilterKey): boolean {
  if (filter === 'all') return true;
  const b = auditKindBucket(kind);
  if (b === 'other') return false;
  return b === filter;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatActorDisplay(row: AuditEntryRow): string {
  const u = row.actor_username?.trim();
  if (u) return u;
  const e = row.actor_email?.trim();
  if (e) {
    const at = e.indexOf('@');
    return at > 0 ? e.slice(0, at) : e;
  }
  return 'System';
}

function accentForKind(kind: string, colors: ThemeColors): string {
  if (kind.includes('archived') || kind.includes('deleted')) return colors.dangerText;
  if (kind.includes('restored')) return colors.successEmphasis;
  if (kind === 'board_created' || kind.includes('_added')) return colors.boardLink;
  if (kind.includes('updated') || kind === 'card_moved') return colors.successTrack;
  if (kind === 'card_comment') return colors.subtitle;
  if (kind === 'user_assigned_to_card') return colors.boardLink;
  return colors.textTertiary;
}

function neuWrapStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      position: 'relative',
      marginRight: SHIFT,
      marginBottom: SHIFT + 10,
    },
    shadow: {
      position: 'absolute',
      left: SHIFT,
      top: SHIFT,
      right: -SHIFT,
      bottom: -SHIFT,
      backgroundColor: colors.shadowFill,
      borderRadius: CARD_RADIUS,
      borderWidth: 1,
      borderColor: colors.border,
    },
    face: {
      position: 'relative',
      backgroundColor: colors.surfaceElevated,
      borderRadius: CARD_RADIUS,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
  });
}

function createBoardAuditStyles(colors: ThemeColors, neu: ReturnType<typeof neuWrapStyles>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.modalCreamCanvas },
    flex: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 16,
      maxWidth: 520,
      width: '100%',
      alignSelf: 'center',
    },
    helper: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 14,
      fontWeight: '500',
    },
    filterLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.sectionLabel,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    filterScroll: {
      marginBottom: 18,
      flexGrow: 0,
    },
    filterScrollInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingRight: 4,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    filterChipSelected: {
      backgroundColor: colors.primaryButtonBg,
      borderColor: colors.border,
    },
    filterChipText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    filterChipTextSelected: {
      color: colors.primaryButtonText,
    },
    emptyFiltered: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      fontWeight: '600',
      marginTop: 8,
      marginBottom: 8,
    },
    emptyWrap: neu.wrap,
    emptyShadow: neu.shadow,
    emptyFace: {
      ...neu.face,
      alignItems: 'center',
      paddingVertical: 36,
      paddingHorizontal: 22,
      gap: 10,
    },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    emptyHint: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 21,
      fontWeight: '500',
    },
    entryWrap: neu.wrap,
    entryShadow: neu.shadow,
    entryFace: {
      ...neu.face,
      flexDirection: 'row',
      alignItems: 'stretch',
      overflow: 'hidden',
    },
    entryAccent: {
      width: 3,
      alignSelf: 'stretch',
    },
    entryInner: {
      flex: 1,
      flexDirection: 'row',
      paddingVertical: 14,
      paddingRight: 14,
      paddingLeft: 12,
      gap: 12,
      alignItems: 'flex-start',
    },
    avatarRing: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 999,
      overflow: 'hidden',
      flexShrink: 0,
    },
    entryMain: { flex: 1, minWidth: 0 },
    kindPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      marginBottom: 8,
    },
    kindPillText: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.textSecondary,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    entrySummary: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textPrimary,
      lineHeight: 21,
    },
    actorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    actorText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    entryTime: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textTertiary,
      marginTop: 6,
    },
  });
}

type AuditRow = AuditEntryRow;

function AuditEntryCard({
  row,
  viewerUserId,
  styles,
  colors,
}: {
  row: AuditRow;
  viewerUserId: string | undefined;
  styles: ReturnType<typeof createBoardAuditStyles>;
  colors: ThemeColors;
}) {
  const actorName = formatActorDisplay(row);
  const isSelf =
    row.actor_user_id != null &&
    viewerUserId != null &&
    String(row.actor_user_id) === String(viewerUserId);
  const byLine = isSelf ? 'You' : actorName;
  const accent = accentForKind(row.kind, colors);
  const avatarAlt = isSelf ? 'You' : actorName;

  return (
    <View style={styles.entryWrap}>
      <View style={styles.entryShadow} />
      <View style={styles.entryFace}>
        <View style={[styles.entryAccent, { backgroundColor: accent }]} />
        <View style={styles.entryInner}>
          <View style={styles.avatarRing}>
            <Avatar
              src={row.actor_profile_picture_url ?? null}
              alt={avatarAlt}
              size="sm"
            />
          </View>
          <View style={styles.entryMain}>
          <View style={styles.kindPill}>
            <Text style={styles.kindPillText}>{kindLabel(row.kind)}</Text>
          </View>
          <Text style={styles.entrySummary}>{row.summary}</Text>
          <View style={styles.actorRow}>
            <Feather name="user" size={14} color={colors.iconMuted} />
            <Text style={styles.actorText}>{byLine}</Text>
          </View>
          <Text style={styles.entryTime}>{formatWhen(row.at_iso)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function BoardAuditScreen() {
  const { colors } = useTheme();
  const neu = useMemo(() => neuWrapStyles(colors), [colors]);
  const styles = useMemo(() => createBoardAuditStyles(colors, neu), [colors, neu]);
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { boardId: boardIdParam } = useLocalSearchParams<{ boardId?: string | string[] }>();
  const boardId = resolveBoardId(boardIdParam);

  const [entries, setEntries] = useState<AuditRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<AuditFilterKey>('all');

  const filteredEntries = useMemo(
    () => entries.filter((e) => entryMatchesFilter(e.kind, filter)),
    [entries, filter]
  );

  const load = useCallback(async () => {
    if (!boardId) return;
    const { entries: rows } = await getBoardAudit(boardId, { limit: 100 });
    setEntries(rows ?? []);
  }, [boardId]);

  useFocusEffect(
    useCallback(() => {
      if (boardId) void load();
    }, [load, boardId])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const close = () => {
    hapticLight();
    router.back();
  };

  if (!boardId) {
    return null;
  }

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
          Activity
        </Stack.Screen.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" onPress={close} tintColor={colors.modalCreamHeaderTint} />
        </Stack.Toolbar>
      </Stack.Screen>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + BELOW_HEADER_GAP,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.modalCreamHeaderTint} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.helper}>
          Who changed what on this board — use filters to narrow by board settings, tasks, lists, or removals.
        </Text>

        {entries.length > 0 ? (
          <>
            <Text style={styles.filterLabel}>Filter</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroll}
              contentContainerStyle={styles.filterScrollInner}
            >
              {FILTER_CHIPS.map(({ key, label }) => {
                const selected = filter === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      hapticLight();
                      setFilter(key);
                    }}
                    style={[styles.filterChip, selected && styles.filterChipSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${label} activity filter`}
                  >
                    <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {entries.length === 0 ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyShadow} />
            <View style={styles.emptyFace}>
              <Feather name="activity" size={36} color={colors.iconMuted} />
              <Text style={styles.emptyTitle}>No activity yet</Text>
              <Text style={styles.emptyHint}>
                Add or edit tasks, create lists, or archive to see entries here.
              </Text>
            </View>
          </View>
        ) : filteredEntries.length === 0 ? (
          <Text style={styles.emptyFiltered}>Nothing in this filter. Try another tab.</Text>
        ) : (
          filteredEntries.map((e) => (
            <AuditEntryCard key={e.id} row={e} viewerUserId={user?.id} styles={styles} colors={colors} />
          ))
        )}
      </ScrollView>
    </View>
  );
}
