import React, { useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { hapticLight } from '../../utils/haptics';
import type { BoardColumnData } from '../../types/board';
import type { DashboardTile } from '../../types/dashboard';
import {
  aggregateDashboardLineChart,
  aggregateDashboardSeries,
} from '../../board/dashboardAggregations';
import { DashboardStatCard } from './DashboardStatCard';

const EDGE_PAD_H = Platform.select({ web: 24, default: 16 }) ?? 16;
const CARD_SHIFT = 5;

type Props = {
  columns: BoardColumnData[];
  tiles: DashboardTile[];
  bottomClearance: number;
  onRemoveTile: (id: string) => void;
};

export function BoardDashboardView({
  columns,
  tiles,
  bottomClearance,
  onRemoveTile,
}: Props) {
  const insets = useSafeAreaInsets();

  const openAddTile = useCallback(() => {
    hapticLight();
    router.push({
      pathname: '/add-dashboard-tile',
      params: {
        tiles: JSON.stringify(
          tiles.map((t) =>
            t.kind === 'line'
              ? {
                  kind: t.kind,
                  dimension: t.dimension,
                  lineTimeframe: t.lineTimeframe ?? 'week',
                }
              : { kind: t.kind, dimension: t.dimension }
          )
        ),
      },
    });
  }, [tiles]);

  const chartByTile = useMemo(() => {
    const m = new Map<
      string,
      | { kind: 'bar' | 'pie'; rows: ReturnType<typeof aggregateDashboardSeries> }
      | {
          kind: 'line';
          lineData: ReturnType<typeof aggregateDashboardLineChart>;
          lineTimeframe: NonNullable<DashboardTile['lineTimeframe']>;
        }
    >();
    for (const t of tiles) {
      if (t.kind === 'line') {
        const tf = t.lineTimeframe ?? 'week';
        m.set(t.id, {
          kind: 'line',
          lineData: aggregateDashboardLineChart(columns, t.dimension, tf),
          lineTimeframe: tf,
        });
      } else {
        m.set(t.id, { kind: t.kind, rows: aggregateDashboardSeries(columns, t.dimension) });
      }
    }
    return m;
  }, [columns, tiles]);

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingLeft: EDGE_PAD_H + insets.left,
            paddingRight: EDGE_PAD_H + insets.right,
            paddingBottom: 16 + bottomClearance + Math.max(insets.bottom, 8),
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <Text style={styles.pageTitle} accessibilityRole="header">
            Dashboard
          </Text>
          <Pressable
            onPress={openAddTile}
            style={styles.addBtn}
            accessibilityRole="button"
            accessibilityLabel="Add statistic tile"
          >
            <Feather name="plus" size={18} color="#0a0a0a" />
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>Board statistics</Text>

        {tiles.length === 0 ? (
          <View style={styles.emptyWrapOuter}>
            <View style={styles.emptyShadow} pointerEvents="none" />
            <View style={styles.emptyFace}>
              <Text style={styles.emptyTitle}>No tiles yet</Text>
              <Text style={styles.emptyHint}>
                Add a chart to see cards per list, label, member, or due date.
              </Text>
              <Pressable onPress={openAddTile} style={styles.emptyCta}>
                <Text style={styles.emptyCtaText}>Add tile</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          tiles.map((t) => {
            const payload = chartByTile.get(t.id);
            const rows =
              payload && payload.kind !== 'line' ? payload.rows : [];
            const lineData = payload?.kind === 'line' ? payload.lineData : undefined;
            const lineTimeframe =
              payload?.kind === 'line' ? payload.lineTimeframe : undefined;
            return (
              <DashboardStatCard
                key={t.id}
                titleDimension={t.dimension}
                kind={t.kind}
                rows={rows}
                lineData={lineData}
                lineTimeframe={lineTimeframe}
                onRemove={() => onRemoveTile(t.id)}
              />
            );
          })
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#fff',
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 16,
  },
  emptyWrapOuter: {
    position: 'relative',
    alignSelf: 'stretch',
    marginBottom: CARD_SHIFT,
    marginRight: CARD_SHIFT,
  },
  emptyShadow: {
    position: 'absolute',
    left: CARD_SHIFT,
    top: CARD_SHIFT,
    right: -CARD_SHIFT,
    bottom: -CARD_SHIFT,
    backgroundColor: '#000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
  },
  emptyFace: {
    position: 'relative',
    zIndex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
    padding: 20,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0a0a0a',
    marginBottom: 6,
  },
  emptyHint: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    lineHeight: 20,
    marginBottom: 14,
  },
  emptyCta: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000',
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
