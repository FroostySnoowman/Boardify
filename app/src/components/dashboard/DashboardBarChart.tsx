import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import type { DashboardSeriesRow } from '../../types/dashboard';

const CHART_H = 156;
const PAD_L = 34;
const PAD_R = 10;
const PAD_T = 6;
const PAD_B = 2;
const GRID_LINES = 4;
const X_LABEL_MIN_H = 36;

/** Minimum width per category so labels and bars stay readable; enables horizontal scroll when card is narrower. */
const MIN_INNER_SLOT_PX = 52;

export function minWidthForBarChart(rowCount: number): number {
  if (rowCount <= 0) return PAD_L + PAD_R + 120;
  return PAD_L + PAD_R + rowCount * MIN_INNER_SLOT_PX;
}

/** Monotonic unique tick values (rounded labels can collide without this). */
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
  rows: DashboardSeriesRow[];
  width: number;
};

export function DashboardBarChart({ rows, width }: Props) {
  const innerW = Math.max(1, width - PAD_L - PAD_R);
  const plotH = CHART_H - PAD_T - PAD_B;
  const maxVal = useMemo(
    () => Math.max(1, ...rows.map((r) => r.value), 0),
    [rows]
  );

  const yTicks = useMemo(() => buildYTicks(maxVal, GRID_LINES), [maxVal]);

  if (rows.length === 0 || width < 40) {
    return (
      <View style={[styles.empty, { width: Math.max(width, 120) }]}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  const n = rows.length;
  const slotW = innerW / n;
  const barW = Math.max(4, Math.min(28, slotW * 0.55));

  return (
    <View style={{ width }}>
      <Svg width={width} height={CHART_H}>
        {yTicks.map((gv, idx) => {
          const y = PAD_T + plotH - (gv / maxVal) * plotH;
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
        {rows.map((row, i) => {
          const h = row.value <= 0 ? 0 : (row.value / maxVal) * plotH;
          const xCenter = PAD_L + slotW * i + slotW / 2;
          const x = xCenter - barW / 2;
          const y = PAD_T + plotH - h;
          const fill = row.color ?? '#0a0a0a';
          return (
            <Rect
              key={row.id}
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 0)}
              fill={fill}
              stroke="#000"
              strokeWidth={1}
              rx={2}
            />
          );
        })}
      </Svg>
      <View style={[styles.xLabels, { paddingLeft: PAD_L, paddingRight: PAD_R }]}>
        {rows.map((row) => (
          <View key={row.id} style={styles.xLabCell}>
            <Text style={styles.xLabText} numberOfLines={2}>
              {row.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    height: CHART_H + X_LABEL_MIN_H,
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
    minHeight: X_LABEL_MIN_H,
    marginTop: 4,
  },
  xLabCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  xLabText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#444',
    textAlign: 'center',
    lineHeight: 11,
  },
});
