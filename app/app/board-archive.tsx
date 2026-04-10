import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Pressable,
  RefreshControl,
  DeviceEventEmitter,
} from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../src/utils/haptics';
import { BOARD_PENDING_RESTORE_EVENT } from '../src/board/boardRestoreEvents';
import type { BoardCardData, BoardColumnData } from '../src/types/board';
import { getBoardArchive, restoreBoard } from '../src/api/boards';
import type { ArchivedCardRow, ArchivedListRow } from '../src/api/boards';
import { useTheme } from '../src/theme';
import type { ThemeColors } from '../src/theme/colors';

const BELOW_HEADER_GAP = 10;
const SHIFT = 5;

type ArchivedCardItem = {
  archiveId: string;
  archivedAtIso: string;
  sourceListTitle: string;
  card: BoardCardData;
};

type ArchivedListItem = {
  archiveId: string;
  archivedAtIso: string;
  column: BoardColumnData;
};

function resolveBoardId(raw: string | string[] | undefined): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return s?.trim() ? s.trim() : '';
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function mapCardRow(row: ArchivedCardRow): ArchivedCardItem | null {
  try {
    const card = JSON.parse(row.card_snapshot_json) as BoardCardData;
    return {
      archiveId: row.id,
      archivedAtIso: row.archived_at,
      sourceListTitle: row.source_list_title ?? '',
      card,
    };
  } catch {
    return null;
  }
}

function mapListRow(row: ArchivedListRow): ArchivedListItem | null {
  try {
    const column = JSON.parse(row.column_snapshot_json) as BoardColumnData;
    return {
      archiveId: row.id,
      archivedAtIso: row.archived_at,
      column,
    };
  } catch {
    return null;
  }
}

function createBoardArchiveStyles(colors: ThemeColors) {
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
    section: { marginBottom: 24 },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.textPrimary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 12,
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
    rowWrap: {
      position: 'relative',
      marginBottom: 12,
      marginRight: SHIFT,
      alignSelf: 'stretch',
    },
    rowShadow: {
      position: 'absolute',
      left: SHIFT,
      top: SHIFT,
      right: -SHIFT,
      bottom: -SHIFT,
      backgroundColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowFace: {
      position: 'relative',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      paddingHorizontal: 14,
    },
    rowTextCol: { flex: 1, minWidth: 0 },
    rowTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
    rowSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
    restoreBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.success,
    },
    restoreBtnPressed: { opacity: 0.85 },
    restoreBtnLabel: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  });
}

type ArchiveSheet = ReturnType<typeof createBoardArchiveStyles>;

function ArchiveRow({
  sheet,
  title,
  subtitle,
  onRestore,
}: {
  sheet: ArchiveSheet;
  title: string;
  subtitle: string;
  onRestore: () => void;
}) {
  return (
    <View style={sheet.rowWrap}>
      <View style={sheet.rowShadow} />
      <View style={sheet.rowFace}>
        <View style={sheet.rowTextCol}>
          <Text style={sheet.rowTitle} numberOfLines={2}>
            {title}
          </Text>
          <Text style={sheet.rowSub} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        <Pressable
          onPress={onRestore}
          style={({ pressed }) => [sheet.restoreBtn, pressed && sheet.restoreBtnPressed]}
          hitSlop={6}
        >
          <Text style={sheet.restoreBtnLabel}>Restore</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function BoardArchiveScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createBoardArchiveStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { boardId: boardIdParam } = useLocalSearchParams<{ boardId?: string | string[] }>();
  const boardId = resolveBoardId(boardIdParam);

  const [cards, setCards] = useState<ArchivedCardItem[]>([]);
  const [lists, setLists] = useState<ArchivedListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!boardId) return;
    const { archivedCards, archivedLists } = await getBoardArchive(boardId);
    setCards(
      (archivedCards ?? [])
        .map((r) => mapCardRow(r as ArchivedCardRow))
        .filter((x): x is ArchivedCardItem => x != null)
    );
    setLists(
      (archivedLists ?? [])
        .map((r) => mapListRow(r as ArchivedListRow))
        .filter((x): x is ArchivedListItem => x != null)
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

  const onRestoreCard = async (id: string) => {
    if (!boardId) return;
    hapticLight();
    try {
      await restoreBoard(boardId, { type: 'card', archiveId: id });
      DeviceEventEmitter.emit(BOARD_PENDING_RESTORE_EVENT, { boardId });
      await load();
    } catch {
      // ignore
    }
  };

  const onRestoreList = async (id: string) => {
    if (!boardId) return;
    hapticLight();
    try {
      await restoreBoard(boardId, { type: 'list', archiveId: id });
      DeviceEventEmitter.emit(BOARD_PENDING_RESTORE_EVENT, { boardId });
      await load();
    } catch {
      // ignore
    }
  };

  const empty = lists.length === 0 && cards.length === 0;

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
        <Stack.Screen.Title style={{ fontWeight: '800', color: colors.modalCreamHeaderTint }}>Archive</Stack.Screen.Title>
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.modalCreamHeaderTint}
          />
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.helper}>
          Archived tasks and lists for this board. Restore sends them back to the board.
        </Text>

        {empty ? (
          <View style={styles.emptyCard}>
            <Feather name="archive" size={36} color={colors.iconMuted} />
            <Text style={styles.emptyTitle}>Nothing archived yet</Text>
            <Text style={styles.emptyHint}>Drag a card or list to the top “Drop here to archive” zone.</Text>
          </View>
        ) : null}

        {lists.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lists</Text>
            {lists.map((item) => (
              <ArchiveRow
                key={item.archiveId}
                sheet={styles}
                title={item.column.title}
                subtitle={`${item.column.cards.length} cards · ${formatWhen(item.archivedAtIso)}`}
                onRestore={() => onRestoreList(item.archiveId)}
              />
            ))}
          </View>
        ) : null}

        {cards.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tasks</Text>
            {cards.map((item) => (
              <ArchiveRow
                key={item.archiveId}
                sheet={styles}
                title={item.card.title}
                subtitle={`${item.sourceListTitle || 'List'} · ${formatWhen(item.archivedAtIso)}`}
                onRestore={() => onRestoreCard(item.archiveId)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
