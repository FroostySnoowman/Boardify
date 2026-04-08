import React, { useCallback, useState } from 'react';
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
import {
  loadBoardArchiveState,
  restoreArchivedCard,
  restoreArchivedList,
  type ArchivedCardItem,
  type ArchivedListItem,
} from '../src/storage/boardArchiveStorage';

const BELOW_HEADER_GAP = 10;
const BG = '#f5f0e8';
const SHIFT = 5;

function resolveBoardName(raw: string | string[] | undefined): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return s?.trim() ? s.trim() : 'My Board';
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

export default function BoardArchiveScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { boardName: boardNameParam } = useLocalSearchParams<{ boardName?: string | string[] }>();
  const boardName = resolveBoardName(boardNameParam);

  const [cards, setCards] = useState<ArchivedCardItem[]>([]);
  const [lists, setLists] = useState<ArchivedListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const s = await loadBoardArchiveState(boardName);
    setCards(s.archivedCards);
    setLists(s.archivedLists);
  }, [boardName]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
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
    hapticLight();
    const ok = await restoreArchivedCard(boardName, id);
    if (ok) {
      DeviceEventEmitter.emit(BOARD_PENDING_RESTORE_EVENT, boardName);
      await load();
    }
  };

  const onRestoreList = async (id: string) => {
    hapticLight();
    const ok = await restoreArchivedList(boardName, id);
    if (ok) {
      DeviceEventEmitter.emit(BOARD_PENDING_RESTORE_EVENT, boardName);
      await load();
    }
  };

  const empty = lists.length === 0 && cards.length === 0;

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
        <Stack.Screen.Title style={{ fontWeight: '800', color: '#0a0a0a' }}>Archive</Stack.Screen.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="xmark" onPress={close} tintColor="#0a0a0a" />
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0a0a0a" />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.helper}>
          Archived tasks and lists for this board on this device. Restore sends them back to the board.
        </Text>

        {empty ? (
          <View style={styles.emptyCard}>
            <Feather name="archive" size={36} color="#999" />
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

function ArchiveRow({
  title,
  subtitle,
  onRestore,
}: {
  title: string;
  subtitle: string;
  onRestore: () => void;
}) {
  return (
    <View style={styles.rowWrap}>
      <View style={styles.rowShadow} />
      <View style={styles.rowFace}>
        <View style={styles.rowTextCol}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.rowSub} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        <Pressable
          onPress={onRestore}
          style={({ pressed }) => [styles.restoreBtn, pressed && styles.restoreBtnPressed]}
          hitSlop={6}
        >
          <Text style={styles.restoreBtnLabel}>Restore</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
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
    color: '#444',
    marginBottom: 20,
    fontWeight: '500',
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0a0a0a',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000',
    gap: 10,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0a0a0a' },
  emptyHint: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
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
    backgroundColor: '#000',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#000',
  },
  rowFace: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  rowTextCol: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: '#0a0a0a' },
  rowSub: { fontSize: 13, color: '#666', marginTop: 4 },
  restoreBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#a5d6a5',
  },
  restoreBtnPressed: { opacity: 0.85 },
  restoreBtnLabel: { fontSize: 14, fontWeight: '800', color: '#0a0a0a' },
});
