import React, { useState, type ReactNode } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
  Platform,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ContextMenu } from '../ContextMenu';
import { hapticLight } from '../../utils/haptics';
import type {
  DashboardChartKind,
  DashboardDimension,
  DashboardLineChartData,
  DashboardLineTimeframe,
  DashboardSeriesRow,
} from '../../types/dashboard';
import {
  dashboardLineTimeframeTitle,
  dashboardTileTitle,
} from '../../board/dashboardAggregations';
import { DashboardBarChart, minWidthForBarChart } from './DashboardBarChart';
import { DashboardPieChart } from './DashboardPieChart';
import { DashboardLineChart, minWidthForLineChart } from './DashboardLineChart';

const CARD_SHIFT = 5;

type Props = {
  titleDimension: DashboardDimension;
  kind: DashboardChartKind;
  rows: DashboardSeriesRow[];
  lineData?: DashboardLineChartData;
  lineTimeframe?: DashboardLineTimeframe;
  onRemove: () => void;
};

export function DashboardStatCard({
  titleDimension,
  kind,
  rows,
  lineData,
  lineTimeframe,
  onRemove,
}: Props) {
  const [chartW, setChartW] = useState(280);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setChartW(Math.floor(w));
  };

  const titleBase = dashboardTileTitle(titleDimension);
  const title =
    kind === 'line' && lineTimeframe
      ? `${titleBase} · ${dashboardLineTimeframeTitle(lineTimeframe)}`
      : titleBase;

  const barPlotW =
    kind === 'bar' && rows.length > 0
      ? Math.max(chartW, minWidthForBarChart(rows.length))
      : chartW;
  const linePlotW =
    kind === 'line' && lineData && lineData.xLabels.length > 0
      ? Math.max(chartW, minWidthForLineChart(lineData.xLabels.length))
      : chartW;

  const barNeedsHScroll = kind === 'bar' && rows.length > 0 && barPlotW > chartW;
  const lineNeedsHScroll =
    kind === 'line' &&
    lineData &&
    lineData.xLabels.length > 0 &&
    linePlotW > chartW;

  let chartBody: ReactNode;
  if (kind === 'line' && lineData) {
    chartBody = <DashboardLineChart data={lineData} width={linePlotW} />;
  } else if (kind === 'bar') {
    chartBody = <DashboardBarChart rows={rows} width={barPlotW} />;
  } else {
    chartBody = <DashboardPieChart rows={rows} />;
  }

  return (
    <View style={styles.wrapOuter}>
      <View style={styles.shadow} pointerEvents="none" />
      <View style={styles.face}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <ContextMenu
            options={[
              {
                label: 'Remove tile',
                value: 'remove',
                onPress: () => {
                  hapticLight();
                  onRemove();
                },
              },
            ]}
            hostMatchContents
            iosGlassMenuTrigger={false}
            trigger={
              <Pressable
                hitSlop={12}
                style={styles.menuBtn}
                accessibilityLabel="Tile options"
              >
                <Feather name="more-horizontal" size={20} color="#333" />
              </Pressable>
            }
          />
        </View>
        <View style={styles.chartPad} onLayout={onLayout}>
          {barNeedsHScroll || lineNeedsHScroll ? (
            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator
              keyboardShouldPersistTaps="handled"
              style={[styles.chartHScroll, { width: chartW }]}
              contentContainerStyle={styles.chartHScrollContent}
            >
              {chartBody}
            </ScrollView>
          ) : (
            chartBody
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapOuter: {
    position: 'relative',
    alignSelf: 'stretch',
    marginBottom: CARD_SHIFT + 8,
    marginRight: CARD_SHIFT,
  },
  shadow: {
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
  face: {
    position: 'relative',
    zIndex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#000',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#000',
    backgroundColor: '#e8e8e8',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#0a0a0a',
    letterSpacing: 0.2,
  },
  menuBtn: {
    padding: 4,
    ...Platform.select({ web: { cursor: 'pointer' as const }, default: {} }),
  },
  chartPad: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  chartHScroll: {
    flexGrow: 0,
  },
  chartHScrollContent: {
    paddingRight: 10,
  },
});
