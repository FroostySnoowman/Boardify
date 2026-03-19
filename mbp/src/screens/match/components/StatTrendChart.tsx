import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import type { StatTrendPoint } from '../utils/statTrendFromHistory';
import type { StatDefinition } from '../utils/statDefinitions';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = Math.min(SCREEN_WIDTH - 48, 400);
const CHART_HEIGHT = 220;
const PADDING_LEFT = 44;
const PADDING_RIGHT = 16;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 28;
const PLOT_WIDTH = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const PLOT_HEIGHT = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
const LINE_COLOR = 'rgba(96, 165, 250, 0.9)';
const DOT_COLOR = '#60A5FA';
const GRID_COLOR = 'rgba(255,255,255,0.08)';
const AXIS_COLOR = 'rgba(255,255,255,0.25)';

interface StatTrendChartProps {
  stat: StatDefinition;
  data: StatTrendPoint[];
}

function formatYValue(value: number, format: 'number' | 'percent'): string {
  if (format === 'percent') return `${Math.round(value)}%`;
  return String(Math.round(value));
}

/** Linear regression: returns { slope, intercept } for y = slope * x + intercept (x = index 0..n-1). */
function linearRegression(values: number[]): { slope: number; intercept: number } | null {
  const n = values.length;
  if (n < 2) return null;
  let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXX += i * i;
    sumXY += i * values[i];
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export default function StatTrendChart({ stat, data }: StatTrendChartProps) {
  const { points, yMin, yMax, yTicks, xLabels } = useMemo(() => {
    const isPercent = stat.format === 'percent';
    if (data.length === 0) {
      return { points: [], yMin: 0, yMax: 100, yTicks: [0, 25, 50, 75, 100], xLabels: [] };
    }
    const values = data.map(d => d.value);
    // Numeric: Y axis from 0 to n (max value in data)
    const dataMax = Math.max(...values);
    const yMin = isPercent ? 0 : 0;
    const yMax = isPercent ? 100 : Math.max(1, dataMax);
    const range = yMax - yMin;
    const yTicks = isPercent ? [0, 25, 50, 75, 100] : (() => {
      // Integer ticks only so labels never repeat (0, 1, 2 not 0, 0.5, 1, 1.5, 2)
      const ticks: number[] = [0];
      const nMax = Math.round(yMax);
      if (nMax <= 0) return ticks;
      const step = Math.max(1, Math.ceil(nMax / 4));
      for (let v = step; v < nMax; v += step) ticks.push(v);
      if (nMax > 0 && ticks[ticks.length - 1] !== nMax) ticks.push(nMax);
      return ticks;
    })();
    const xLabels = data.map(d => `Set ${d.setNumber}`);
    const points = data.map((d, i) => {
      const t = data.length === 1 ? 0.5 : i / (data.length - 1);
      const x = PADDING_LEFT + t * PLOT_WIDTH;
      const y = PADDING_TOP + PLOT_HEIGHT - ((d.value - yMin) / range) * PLOT_HEIGHT;
      return { x, y, ...d };
    });
    return { points, yMin, yMax, yTicks, xLabels };
  }, [data, stat.format]);

  const trendLine = useMemo(() => {
    if (data.length < 2) return null;
    const reg = linearRegression(data.map(d => d.value));
    if (!reg) return null;
    const n = data.length;
    const startValue = reg.intercept;
    const endValue = reg.slope * (n - 1) + reg.intercept;
    const range = yMax - yMin;
    const y1 = PADDING_TOP + PLOT_HEIGHT - ((startValue - yMin) / range) * PLOT_HEIGHT;
    const y2 = PADDING_TOP + PLOT_HEIGHT - ((endValue - yMin) / range) * PLOT_HEIGHT;
    return { x1: PADDING_LEFT, y1, x2: PADDING_LEFT + PLOT_WIDTH, y2 };
  }, [data, yMin, yMax]);

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const hasData = data.length > 0;
  const range = yMax - yMin;

  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>
        {stat.label} by set
      </Text>
      <View style={styles.chartWrap}>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {yTicks.map((tick, i) => {
            const y = PADDING_TOP + PLOT_HEIGHT - ((tick - yMin) / range) * PLOT_HEIGHT;
            return (
              <Line
                key={i}
                x1={PADDING_LEFT}
                y1={y}
                x2={PADDING_LEFT + PLOT_WIDTH}
                y2={y}
                stroke={GRID_COLOR}
                strokeWidth={1}
              />
            );
          })}
          <Line
            x1={PADDING_LEFT}
            y1={PADDING_TOP + PLOT_HEIGHT}
            x2={PADDING_LEFT + PLOT_WIDTH}
            y2={PADDING_TOP + PLOT_HEIGHT}
            stroke={AXIS_COLOR}
            strokeWidth={1}
          />
          <Line
            x1={PADDING_LEFT}
            y1={PADDING_TOP}
            x2={PADDING_LEFT}
            y2={PADDING_TOP + PLOT_HEIGHT}
            stroke={AXIS_COLOR}
            strokeWidth={1}
          />
          {hasData && (
            <>
              <Polyline
                points={polylinePoints}
                fill="none"
                stroke={LINE_COLOR}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((p, i) => (
                <Circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={5}
                  fill={DOT_COLOR}
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth={1}
                />
              ))}
              {trendLine && (
                <Line
                  x1={trendLine.x1}
                  y1={trendLine.y1}
                  x2={trendLine.x2}
                  y2={trendLine.y2}
                  stroke={LINE_COLOR}
                  strokeWidth={1.5}
                  strokeDasharray="6,4"
                  opacity={0.8}
                />
              )}
            </>
          )}
        </Svg>
        <View style={styles.yLabels}>
          {yTicks.slice().reverse().map((tick, i) => (
            <Text key={i} style={styles.yLabel}>
              {formatYValue(tick, stat.format)}
            </Text>
          ))}
        </View>
        {hasData && (
          <View style={styles.xLabels}>
            {xLabels.map((label, i) => (
              <Text key={i} style={styles.xLabel} numberOfLines={1}>
                {label}
              </Text>
            ))}
          </View>
        )}
      </View>
      {!hasData && (
        <Text style={styles.noData}>No trend data for this stat</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 8 },
  title: { fontSize: 16, fontWeight: '600', color: '#ffffff', marginBottom: 12 },
  chartWrap: { position: 'relative', width: CHART_WIDTH, height: CHART_HEIGHT },
  yLabels: {
    position: 'absolute',
    left: 0,
    top: PADDING_TOP,
    width: PADDING_LEFT - 8,
    height: PLOT_HEIGHT,
    justifyContent: 'space-between',
  },
  yLabel: { fontSize: 10, color: '#9ca3af' },
  xLabels: {
    position: 'absolute',
    left: PADDING_LEFT,
    bottom: 4,
    right: PADDING_RIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xLabel: { fontSize: 10, color: '#9ca3af', flex: 1, textAlign: 'center' },
  noData: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 12 },
});
