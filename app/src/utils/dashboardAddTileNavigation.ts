import type { DashboardChartKind, DashboardDimension } from '../types/dashboard';

export type DashboardAddTileResult = {
  status: 'added';
  kind: DashboardChartKind;
  dimension: DashboardDimension;
};

let pending: DashboardAddTileResult | null = null;

export function setPendingDashboardAddTile(result: DashboardAddTileResult): void {
  pending = result;
}

export function consumePendingDashboardAddTile(): DashboardAddTileResult | null {
  const next = pending;
  pending = null;
  return next;
}

const DIMENSIONS: DashboardDimension[] = ['list', 'label', 'member', 'due'];

function isDimension(d: unknown): d is DashboardDimension {
  return typeof d === 'string' && DIMENSIONS.includes(d as DashboardDimension);
}

function isKind(k: unknown): k is DashboardChartKind {
  return k === 'bar' || k === 'pie';
}

/** URL param payload: existing tile kind+dimension pairs (ids omitted). */
export function parseDashboardTilesParam(
  raw: string | string[] | undefined
): Array<{ kind: DashboardChartKind; dimension: DashboardDimension }> {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s || typeof s !== 'string') return [];
  try {
    const parsed = JSON.parse(s) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: Array<{ kind: DashboardChartKind; dimension: DashboardDimension }> = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const kind = rec.kind;
      const dimension = rec.dimension;
      if (isKind(kind) && isDimension(dimension)) {
        out.push({ kind, dimension });
      }
    }
    return out;
  } catch {
    return [];
  }
}
