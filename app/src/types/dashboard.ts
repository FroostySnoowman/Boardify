export type DashboardDimension = 'list' | 'label' | 'member' | 'due';

export type DashboardChartKind = 'bar' | 'pie' | 'line';

/** Buckets for line charts (new cards per day in this window). */
export type DashboardLineTimeframe = 'week' | 'twoWeeks' | 'month';

export type DashboardTile = {
  id: string;
  kind: DashboardChartKind;
  dimension: DashboardDimension;
  /** Required when kind is `line`; ignored for bar/pie. */
  lineTimeframe?: DashboardLineTimeframe;
};

export type DashboardSeriesRow = {
  id: string;
  label: string;
  value: number;
  color?: string;
};

/** Multi-series line chart: shared X axis (days), one value array per series. */
export type DashboardLineChartData = {
  xLabels: string[];
  series: Array<{ id: string; label: string; color?: string; values: number[] }>;
};
