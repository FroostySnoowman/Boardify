import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { DashboardSeriesRow } from '../../types/dashboard';

const SIZE = 140;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 58;

const PALETTE = [
  '#0a0a0a',
  '#5a5a5a',
  '#9a9a9a',
  '#c4a574',
  '#7cb87c',
  '#7c9cb8',
  '#b87c9c',
  '#8b7355',
  '#6b8e9e',
];

function sectorPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const rad = Math.PI / 180;
  const a1 = (startDeg - 90) * rad;
  const a2 = (endDeg - 90) * rad;
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2);
  const y2 = cy + r * Math.sin(a2);
  const sweep = endDeg - startDeg;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

type Props = {
  rows: DashboardSeriesRow[];
};

export function DashboardPieChart({ rows }: Props) {
  const { paths, legend, fullCircle } = useMemo(() => {
    const positive = rows.filter((r) => r.value > 0);
    const total = positive.reduce((s, r) => s + r.value, 0);
    if (total <= 0) {
      return {
        paths: [] as { d: string; color: string; key: string }[],
        legend: positive,
        fullCircle: null as { key: string; color: string } | null,
      };
    }
    if (positive.length === 1) {
      const row = positive[0];
      const color = row.color ?? PALETTE[0];
      return {
        paths: [] as { d: string; color: string; key: string }[],
        legend: positive,
        fullCircle: { key: row.id, color },
      };
    }
    let angle = 0;
    const paths: { d: string; color: string; key: string }[] = [];
    positive.forEach((row, i) => {
      const sweep = (row.value / total) * 360;
      if (sweep <= 0) return;
      const end = angle + sweep;
      const color = row.color ?? PALETTE[i % PALETTE.length];
      paths.push({
        key: row.id,
        d: sectorPath(CX, CY, R, angle, end),
        color,
      });
      angle = end;
    });
    return { paths, legend: positive, fullCircle: null };
  }, [rows]);

  if (paths.length === 0 && !fullCircle) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No data</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {fullCircle ? (
          <Circle
            cx={CX}
            cy={CY}
            r={R}
            fill={fullCircle.color}
            stroke="#000"
            strokeWidth={1}
          />
        ) : (
          paths.map((p) => (
            <Path key={p.key} d={p.d} fill={p.color} stroke="#000" strokeWidth={1} />
          ))
        )}
      </Svg>
      <View style={styles.legend}>
        {legend.map((row, i) => {
          const color = row.color ?? PALETTE[i % PALETTE.length];
          return (
            <View key={row.id} style={styles.legendRow}>
              <View style={[styles.swatch, { backgroundColor: color }]} />
              <Text style={styles.legendLabel} numberOfLines={1}>
                {row.label}
              </Text>
              <Text style={styles.legendVal}>{row.value}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  empty: {
    height: SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
  },
  legend: {
    flex: 1,
    minWidth: 120,
    gap: 6,
    paddingTop: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#000',
  },
  legendLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  legendVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0a0a0a',
    minWidth: 24,
    textAlign: 'right',
  },
});
