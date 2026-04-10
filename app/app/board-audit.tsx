import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, RefreshControl } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../src/utils/haptics';
import { getBoardAudit } from '../src/api/boards';
import { useTheme } from '../src/theme';
import type { ThemeColors } from '../src/theme/colors';

const BELOW_HEADER_GAP = 10;

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
    default:
      return kind.replace(/_/g, ' ');
  }
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

type AuditRow = { id: string; atIso: string; kind: string; summary: string };

function createBoardAuditStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.modalCreamCanvas },
    flex: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 20,
      maxWidth: 480,
      width: '100%',
      alignSelf: 'center',
    },
    helper: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 20,
      fontWeight: '500',
    },
    emptyCard: {
      alignItems: 'center',
      paddingVertical: 36,
      paddingHorizontal: 20,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.border,
      gap: 10,
    },
    emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
    emptyHint: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    entryDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.textPrimary,
      marginTop: 5,
    },
    entryBody: { flex: 1, minWidth: 0 },
    entryKind: { fontSize: 12, fontWeight: '800', color: colors.boardLink, textTransform: 'uppercase' },
    entrySummary: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginTop: 4, lineHeight: 20 },
    entryTime: { fontSize: 12, color: colors.textTertiary, marginTop: 6 },
  });
}

export default function BoardAuditScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createBoardAuditStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { boardId: boardIdParam } = useLocalSearchParams<{ boardId?: string | string[] }>();
  const boardId = resolveBoardId(boardIdParam);

  const [entries, setEntries] = useState<AuditRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!boardId) return;
    const { entries: rows } = await getBoardAudit(boardId, { limit: 100 });
    setEntries(
      (rows ?? []).map((e) => ({
        id: e.id,
        atIso: e.at_iso,
        kind: e.kind,
        summary: e.summary,
      }))
    );
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
        <Stack.Screen.Title style={{ fontWeight: '800', color: colors.modalCreamHeaderTint }}>Activity</Stack.Screen.Title>
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
            paddingBottom: insets.bottom + 28,
          },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.modalCreamHeaderTint} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.helper}>
          Timeline of tasks and lists on this board: added, edited, archived, restored, and new columns.
        </Text>

        {entries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="activity" size={36} color={colors.iconMuted} />
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptyHint}>Add or edit tasks, create lists, or archive to see entries here.</Text>
          </View>
        ) : (
          entries.map((e) => (
            <View key={e.id} style={styles.entryRow}>
              <View style={styles.entryDot} />
              <View style={styles.entryBody}>
                <Text style={styles.entryKind}>{kindLabel(e.kind)}</Text>
                <Text style={styles.entrySummary}>{e.summary}</Text>
                <Text style={styles.entryTime}>{formatWhen(e.atIso)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
