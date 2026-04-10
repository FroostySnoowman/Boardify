import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { hapticLight } from '../../utils/haptics';
import { BoardStyleActionButton } from '../BoardStyleActionButton';
import type {
  DashboardChartKind,
  DashboardDimension,
  DashboardLineTimeframe,
} from '../../types/dashboard';
import { dashboardTileTitle, dashboardLineTimeframeTitle } from '../../board/dashboardAggregations';
import {
  dashboardTileSignature,
  type ParsedDashboardTileRef,
} from '../../utils/dashboardAddTileNavigation';
import { useTheme } from '../../theme';
import type { ThemeColors } from '../../theme/colors';

const DIMENSIONS: DashboardDimension[] = ['list', 'label', 'member', 'due'];
const TIMEFRAMES: DashboardLineTimeframe[] = ['week', 'twoWeeks', 'month'];

function createAddDashboardTileFormStyles(colors: ThemeColors) {
  const cardShadow =
    Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 5, height: 5 },
          shadowOpacity: 0.2,
          shadowRadius: 0,
        }
      : { elevation: 5 };

  return {
    cardShadow,
    styles: StyleSheet.create({
      card: {
        alignSelf: 'stretch',
        backgroundColor: colors.surfaceElevated,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: colors.border,
        padding: 24,
        overflow: 'hidden',
      },
      bodyRow: {
        flexDirection: 'row',
        minHeight: 240,
        maxHeight: 400,
      },
      kindCol: {
        paddingVertical: 4,
        paddingRight: 14,
        gap: 10,
        borderRightWidth: 2,
        borderRightColor: colors.border,
        marginRight: 14,
      },
      kindBtn: {
        width: 48,
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
        alignItems: 'center',
        justifyContent: 'center',
      },
      kindBtnSelected: {
        borderWidth: 2,
        borderColor: colors.border,
        backgroundColor: colors.modalCreamCanvas,
      },
      rightScroll: {
        flex: 1,
        minWidth: 0,
      },
      rightScrollContent: {
        paddingBottom: 4,
      },
      typeHeading: {
        fontSize: 12,
        fontWeight: '800',
        color: colors.textPrimary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 12,
      },
      typeHeadingSecond: {
        marginTop: 16,
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
        borderColor: colors.textTertiary,
        alignItems: 'center',
        justifyContent: 'center',
      },
      radioOuterSelected: {
        borderColor: colors.textPrimary,
      },
      radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.textPrimary,
      },
      radioLabel: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: colors.textPrimary,
      },
      dupHint: {
        marginTop: 8,
        fontSize: 13,
        fontWeight: '600',
        color: colors.dangerText,
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
        color: colors.textPrimary,
      },
      labelAdd: {
        color: colors.textPrimary,
      },
      labelAddDisabled: {
        color: colors.textTertiary,
      },
    }),
  };
}

export type AddDashboardTileFormProps = {
  existingCombos: ParsedDashboardTileRef[];
  kind: DashboardChartKind;
  dimension: DashboardDimension;
  lineTimeframe: DashboardLineTimeframe;
  onKindChange: (k: DashboardChartKind) => void;
  onDimensionChange: (d: DashboardDimension) => void;
  onLineTimeframeChange: (t: DashboardLineTimeframe) => void;
  onCancel: () => void;
  onAdd: () => void;
};

export function AddDashboardTileForm({
  existingCombos,
  kind,
  dimension,
  lineTimeframe,
  onKindChange,
  onDimensionChange,
  onLineTimeframeChange,
  onCancel,
  onAdd,
}: AddDashboardTileFormProps) {
  const { colors } = useTheme();
  const { styles, cardShadow } = useMemo(() => createAddDashboardTileFormStyles(colors), [colors]);

  const existing = new Set(existingCombos.map((t) => dashboardTileSignature(t)));
  const currentSig = dashboardTileSignature({
    kind,
    dimension,
    lineTimeframe: kind === 'line' ? lineTimeframe : undefined,
  });
  const isDuplicate = existing.has(currentSig);
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
            <Feather name="bar-chart-2" size={22} color={colors.iconPrimary} />
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
            <Feather name="pie-chart" size={22} color={colors.iconPrimary} />
          </Pressable>
          <Pressable
            onPress={() => {
              hapticLight();
              onKindChange('line');
            }}
            style={[styles.kindBtn, kind === 'line' && styles.kindBtnSelected]}
            accessibilityRole="button"
            accessibilityLabel="Line chart"
          >
            <Feather name="activity" size={22} color={colors.iconPrimary} />
          </Pressable>
        </View>
        <ScrollView
          style={styles.rightScroll}
          contentContainerStyle={styles.rightScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {kind === 'line' ? (
            <>
              <Text style={styles.typeHeading}>Timeframe</Text>
              {TIMEFRAMES.map((tf) => {
                const selected = lineTimeframe === tf;
                return (
                  <Pressable
                    key={tf}
                    onPress={() => {
                      hapticLight();
                      onLineTimeframeChange(tf);
                    }}
                    style={styles.radioRow}
                  >
                    <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <Text style={styles.radioLabel}>{dashboardLineTimeframeTitle(tf)}</Text>
                  </Pressable>
                );
              })}
            </>
          ) : null}
          <Text style={[styles.typeHeading, kind === 'line' && styles.typeHeadingSecond]}>
            Type
          </Text>
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
        </ScrollView>
      </View>

      <View style={styles.actions}>
        <BoardStyleActionButton
          shadowColor={colors.shadowFill}
          onPress={onCancel}
          label="Cancel"
          labelStyle={styles.labelCancel}
        />
        <BoardStyleActionButton
          shadowColor={canAdd ? colors.success : colors.shadowFill}
          onPress={add}
          disabled={!canAdd}
          label="Add tile"
          labelStyle={canAdd ? styles.labelAdd : styles.labelAddDisabled}
        />
      </View>
    </View>
  );
}
