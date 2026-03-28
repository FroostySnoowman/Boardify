import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Svg, { G, Line, Circle, Polyline, Text as SvgText } from 'react-native-svg';
import type { DashboardLineChartData } from '../../types/dashboard';

const CHART_H = 156;
const PAD_L = 34;
const PAD_R = 10;
const PAD_T = 8;
const PAD_B = 4;
const GRID_LINES = 4;
const X_LABEL_ROW_H = 22;
const LEGEND_H = 22;

function buildYTicks(maxVal: number, divisions: number): number[] {
  const seen = new Set<number>();
  const ticks: number[] = [];
  for (let i = 0; i <= divisions; i++) {
    const v = Math.round((maxVal * i) / divisions);
    if (!seen.has(v)) {
      seen.add(v);
      ticks.push(v);
    }
  }
  if (!seen.has(maxVal)) {
    ticks.push(maxVal);
  }
  return ticks.sort((a, b) => a - b);
}

type Props = {
  data: DashboardLineChartData;
  width: number;
};

export function DashboardLineChart({ data, width }: Props) {
  const { xLabels, series } = data;
  const innerW = Math.max(1, width - PAD_L - PAD_R);
  const plotH = CHART_H - PAD_T - PAD_B;
  const n = xLabels.length;

  const maxVal = useMemo(() => {
    let m = 1;
    for (const s of series) {
      for (const v of s.values) {
        if (v > m) m = v;
      }
    }
    return m;
  }, [series]);

  const yTicks = useMemo(() => buildYTicks(maxVal, GRID_LINES), [maxVal]);

  if (n === 0 || series.length === 0 || width < 40) {
    return (
      <View style={[styles.empty, { width: Math.max(width, 120) }]}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  const xAt = (i: number) => PAD_L + (n <= 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const yAt = (v: number) => PAD_T + plotH - (v / maxVal) * plotH;

  const showLegend = series.length > 1;

  return (
    <View style={{ width }}>
      <Svg width={width} height={CHART_H}>
        {yTicks.map((gv, idx) => {
          const y = yAt(gv);
          return (
            <G key={`ytick-${idx}`}>
              <Line
                x1={PAD_L}
                y1={y}
                x2={width - PAD_R}
                y2={y}
                stroke="#e0e0e0"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <SvgText
                x={PAD_L - 4}
                y={y + 3}
                fontSize={9}
                fill="#666"
                fontWeight="600"
                textAnchor="end"
              >
                {String(gv)}
              </SvgText>
            </G>
          );
        })}
        {series.map((s) => {
          const pts = s.values
            .map((v, i) => `${xAt(i)},${yAt(v)}`)
            .join(' ');
          return (
            <G key={s.id}>
              <Polyline
                points={pts}
                fill="none"
                stroke={s.color ?? '#0a0a0a'}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.values.map((v, i) => (
                <Circle
                  key={`${s.id}-pt-${i}`}
                  cx={xAt(i)}
                  cy={yAt(v)}
                  r={3}
                  fill="#fff"
                  stroke={s.color ?? '#0a0a0a'}
                  strokeWidth={1.5}
                />
              ))}
            </G>
          );
        })}
      </Svg>

      <View style={[styles.xLabels, { paddingLeft: PAD_L, paddingRight: PAD_R }]}>
        {xLabels.map((lab, i) => (
          <View key={`x-${i}`} style={styles.xLabCell}>
            <Text style={styles.xLabText} numberOfLines={1}>
              {lab}
            </Text>
          </View>
        ))}
      </View>

      {showLegend ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.legendScroll}
          contentContainerStyle={styles.legendRow}
        >
          {series.map((s) => (
            <View key={`leg-${s.id}`} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: s.color ?? '#0a0a0a' }]} />
              <Text style={styles.legendText} numberOfLines={1}>
                {s.label}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: CHART_H + X_LABEL_ROW_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  xLabels: {
    flexDirection: 'row',
    minHeight: X_LABEL_ROW_H,
    marginTop: 2,
  },
  xLabCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  xLabText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#444',
    textAlign: 'center',
  },
  legendScroll: {
    maxHeight: LEGEND_H + 8,
    marginTop: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 140,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#000',
  },
  legendText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#444',
    flexShrink: 1,
  },
});
