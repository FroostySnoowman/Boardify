export type DashboardDimension = 'list' | 'label' | 'member' | 'due';

export type DashboardChartKind = 'bar' | 'pie';

export type DashboardTile = {
  id: string;
  kind: DashboardChartKind;
  dimension: DashboardDimension;
};

export type DashboardSeriesRow = {
  id: string;
  label: string;
  value: number;
  color?: string;
};
