import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../../utils/haptics';
import { BoardStyleActionButton } from '../BoardStyleActionButton';
import type { DashboardChartKind, DashboardDimension } from '../../types/dashboard';
import { dashboardTileTitle } from '../../board/dashboardAggregations';

const BG = '#f5f0e8';

const DIMENSIONS: DashboardDimension[] = ['list', 'label', 'member', 'due'];

const cardShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#000',
        shadowOffset: { width: 5, height: 5 },
        shadowOpacity: 0.2,
        shadowRadius: 0,
      }
    : { elevation: 5 };

function tileKey(kind: DashboardChartKind, dimension: DashboardDimension): string {
  return `${kind}:${dimension}`;
}

export type AddDashboardTileFormProps = {
  existingCombos: Array<{ kind: DashboardChartKind; dimension: DashboardDimension }>;
  kind: DashboardChartKind;
  dimension: DashboardDimension;
  onKindChange: (k: DashboardChartKind) => void;
  onDimensionChange: (d: DashboardDimension) => void;
  onCancel: () => void;
  onAdd: () => void;
};

export function AddDashboardTileForm({
  existingCombos,
  kind,
  dimension,
  onKindChange,
  onDimensionChange,
  onCancel,
  onAdd,
}: AddDashboardTileFormProps) {
  const existing = new Set(existingCombos.map((t) => tileKey(t.kind, t.dimension)));
  const isDuplicate = existing.has(tileKey(kind, dimension));
  const canAdd = !isDuplicate;

  const add = () => {
    if (isDuplicate) {
      hapticLight();
      return;
    }
    hapticLight();
    onAdd();
  };

  return (
    <View style={[styles.card, cardShadow]}>
      <View style={styles.bodyRow}>
        <View style={styles.kindCol}>
          <Pressable
            onPress={() => {
              hapticLight();
              onKindChange('bar');
            }}
            style={[styles.kindBtn, kind === 'bar' && styles.kindBtnSelected]}
            accessibilityRole="button"
            accessibilityLabel="Bar chart"
          >
            <Feather name="bar-chart-2" size={22} color="#0a0a0a" />
          </Pressable>
          <Pressable
            onPress={() => {
              hapticLight();
              onKindChange('pie');
            }}
            style={[styles.kindBtn, kind === 'pie' && styles.kindBtnSelected]}
            accessibilityRole="button"
            accessibilityLabel="Pie chart"
          >
            <Feather name="pie-chart" size={22} color="#0a0a0a" />
          </Pressable>
        </View>
        <View style={styles.typeCol}>
          <Text style={styles.typeHeading}>Type</Text>
          {DIMENSIONS.map((d) => {
            const selected = dimension === d;
            return (
              <Pressable
                key={d}
                onPress={() => {
                  hapticLight();
                  onDimensionChange(d);
                }}
                style={styles.radioRow}
              >
                <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                  {selected ? <View style={styles.radioInner} /> : null}
                </View>
                <Text style={styles.radioLabel}>{dashboardTileTitle(d)}</Text>
              </Pressable>
            );
          })}
          {isDuplicate ? (
            <Text style={styles.dupHint}>This tile is already on the dashboard.</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <BoardStyleActionButton
          shadowColor="#e0e0e0"
          onPress={onCancel}
          label="Cancel"
          labelStyle={styles.labelCancel}
        />
        <BoardStyleActionButton
          shadowColor={canAdd ? '#a5d6a5' : '#d0d0d0'}
          onPress={add}
          disabled={!canAdd}
          label="Add tile"
          labelStyle={canAdd ? styles.labelAdd : styles.labelAddDisabled}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000',
    padding: 24,
    overflow: 'hidden',
  },
  bodyRow: {
    flexDirection: 'row',
    minHeight: 200,
    maxHeight: 340,
  },
  kindCol: {
    paddingVertical: 4,
    paddingRight: 14,
    gap: 10,
    borderRightWidth: 2,
    borderRightColor: '#000',
    marginRight: 14,
  },
  kindBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kindBtnSelected: {
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: BG,
  },
  typeCol: {
    flex: 1,
    minWidth: 0,
  },
  typeHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0a0a0a',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#888',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#0a0a0a',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0a0a0a',
  },
  radioLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0a0a0a',
  },
  dupHint: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#b45309',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 24,
    gap: 12,
    width: '100%',
    overflow: 'hidden',
    paddingBottom: 11,
  },
  labelCancel: {
    color: '#0a0a0a',
  },
  labelAdd: {
    color: '#0a0a0a',
  },
  labelAddDisabled: {
    color: '#888',
  },
});
