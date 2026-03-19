import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = Math.min(SCREEN_WIDTH - 48, 400);
const CHART_HEIGHT = 220;
const PADDING_LEFT = 44;
const PADDING_RIGHT = 28;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 28;
const PLOT_WIDTH = CHART_WIDTH - PADDING_LEFT - PADDING_RIGHT;
/** Inset so first/last points don't sit on the plot edges (avoids data running off). */
const PLOT_X_INSET = 0.04;
const PLOT_HEIGHT = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
const GRID_COLOR = 'rgba(255,255,255,0.08)';
const AXIS_COLOR = 'rgba(255,255,255,0.25)';

export interface TrendOverMatchesPoint {
  xLabel: string;
  value: number;
}

interface StatTrendOverMatchesChartProps {
  title: string;
  format: 'number' | 'percent';
  data: TrendOverMatchesPoint[];
  color?: string;
}

function formatYValue(value: number, format: 'number' | 'percent'): string {
  if (format === 'percent') return `${Math.round(value)}%`;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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

export default function StatTrendOverMatchesChart({
  title,
  format,
  data,
  color = '#60A5FA',
}: StatTrendOverMatchesChartProps) {
  const dotColor = color;

  const { points, yMin, yMax, yTicks, xLabels } = useMemo(() => {
    const isPercent = format === 'percent';
    // Numeric: Y axis from 0 to n (max value in data)
    const dataMax = data.length === 0 ? 0 : Math.max(...data.map(d => d.value));
    const yMin = isPercent ? 0 : 0;
    const yMax = isPercent ? 100 : (data.length === 0 ? 100 : Math.max(1, dataMax));
    if (data.length === 0) {
      return {
        points: [] as { x: number; y: number; value: number }[],
        yMin: 0,
        yMax: 100,
        yTicks: [0, 25, 50, 75, 100],
        xLabels: [] as string[],
      };
    }
    const range = yMax - yMin;
    const yTicks = isPercent ? [0, 25, 50, 75, 100] : (() => {
      // Decimal ratios (e.g. dominance ratio 1.25): use 0.5 steps and show decimals
      if (yMax > 1 && yMax <= 10) {
        const ticks: number[] = [0];
        for (let v = 0.5; v < yMax; v += 0.5) ticks.push(v);
        if (yMax > 0 && ticks[ticks.length - 1] !== yMax) ticks.push(yMax);
        return ticks;
      }
      // Integer ticks for counts (0, 1, 2, ...)
      const ticks: number[] = [0];
      const nMax = Math.round(yMax);
      if (nMax <= 0) return ticks;
      const step = Math.max(1, Math.ceil(nMax / 4));
      for (let v = step; v < nMax; v += step) ticks.push(v);
      if (nMax > 0 && ticks[ticks.length - 1] !== nMax) ticks.push(nMax);
      return ticks;
    })();
    const xLabels = data.map(d => d.xLabel);
    const points = data.map((d, i) => {
      const t = data.length === 1 ? 0.5 : PLOT_X_INSET + (1 - 2 * PLOT_X_INSET) * (i / Math.max(1, data.length - 1));
      const x = PADDING_LEFT + t * PLOT_WIDTH;
      const y = PADDING_TOP + PLOT_HEIGHT - ((d.value - yMin) / range) * PLOT_HEIGHT;
      return { x, y, value: d.value };
    });
    return { points, yMin, yMax, yTicks, xLabels };
  }, [data, format]);

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
    const x1 = PADDING_LEFT + PLOT_X_INSET * PLOT_WIDTH;
    const x2 = PADDING_LEFT + (1 - PLOT_X_INSET) * PLOT_WIDTH;
    return { x1, y1, x2, y2 };
  }, [data, yMin, yMax]);

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');
  const hasData = data.length > 0;
  const range = yMax - yMin;

  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>
        {title} over matches
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
                stroke={dotColor}
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
                  fill={dotColor}
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
                  stroke={dotColor}
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
              {formatYValue(tick, format)}
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
  chartWrap: { position: 'relative' as const, width: CHART_WIDTH, height: CHART_HEIGHT },
  yLabels: {
    position: 'absolute' as const,
    left: 0,
    top: PADDING_TOP,
    width: PADDING_LEFT - 8,
    height: PLOT_HEIGHT,
    justifyContent: 'space-between',
  },
  yLabel: { fontSize: 10, color: '#9ca3af' },
  xLabels: {
    position: 'absolute' as const,
    left: PADDING_LEFT,
    bottom: 4,
    right: PADDING_RIGHT,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xLabel: { fontSize: 9, color: '#9ca3af', flex: 1, textAlign: 'center' as const },
  noData: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 12 },
});
