import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform, RefreshControl } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../src/utils/haptics';
import { loadBoardAuditLog, type BoardAuditEntry } from '../src/storage/boardArchiveStorage';

const BELOW_HEADER_GAP = 10;
const BG = '#f5f0e8';

function resolveBoardName(raw: string | string[] | undefined): string {
  const s = Array.isArray(raw) ? raw[0] : raw;
  return s?.trim() ? s.trim() : 'My Board';
}

function kindLabel(kind: BoardAuditEntry['kind']): string {
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
    default:
      return kind;
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

export default function BoardAuditScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { boardName: boardNameParam } = useLocalSearchParams<{ boardName?: string | string[] }>();
  const boardName = resolveBoardName(boardNameParam);

  const [entries, setEntries] = useState<BoardAuditEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const log = await loadBoardAuditLog(boardName);
    setEntries(log);
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
        <Stack.Screen.Title style={{ fontWeight: '800', color: '#0a0a0a' }}>Activity</Stack.Screen.Title>
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
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.helper}>
          Timeline of tasks and lists on this board: added, edited, archived, restored, and new columns.
        </Text>

        {entries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="activity" size={36} color="#999" />
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
  entryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.12)',
  },
  entryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0a0a0a',
    marginTop: 5,
  },
  entryBody: { flex: 1, minWidth: 0 },
  entryKind: { fontSize: 12, fontWeight: '800', color: '#0c66e4', textTransform: 'uppercase' },
  entrySummary: { fontSize: 15, fontWeight: '600', color: '#0a0a0a', marginTop: 4, lineHeight: 20 },
  entryTime: { fontSize: 12, color: '#888', marginTop: 6 },
});
