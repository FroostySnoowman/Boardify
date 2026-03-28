import type {
  DashboardChartKind,
  DashboardDimension,
  DashboardLineTimeframe,
} from '../types/dashboard';

export type DashboardAddTileResult = {
  status: 'added';
  kind: DashboardChartKind;
  dimension: DashboardDimension;
  lineTimeframe?: DashboardLineTimeframe;
};

export function dashboardTileSignature(t: {
  kind: DashboardChartKind;
  dimension: DashboardDimension;
  lineTimeframe?: DashboardLineTimeframe;
}): string {
  if (t.kind === 'line') {
    return `line:${t.dimension}:${t.lineTimeframe ?? 'week'}`;
  }
  return `${t.kind}:${t.dimension}`;
}

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

const TIMEFRAMES: DashboardLineTimeframe[] = ['week', 'twoWeeks', 'month'];

function isLineTimeframe(x: unknown): x is DashboardLineTimeframe {
  return typeof x === 'string' && TIMEFRAMES.includes(x as DashboardLineTimeframe);
}

function isKind(k: unknown): k is DashboardChartKind {
  return k === 'bar' || k === 'pie' || k === 'line';
}

export type ParsedDashboardTileRef = {
  kind: DashboardChartKind;
  dimension: DashboardDimension;
  lineTimeframe?: DashboardLineTimeframe;
};

/** URL param payload: existing tiles (ids omitted). */
export function parseDashboardTilesParam(
  raw: string | string[] | undefined
): ParsedDashboardTileRef[] {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s || typeof s !== 'string') return [];
  try {
    const parsed = JSON.parse(s) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ParsedDashboardTileRef[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const kind = rec.kind;
      const dimension = rec.dimension;
      if (!isKind(kind) || !isDimension(dimension)) continue;
      const lineRaw = rec.lineTimeframe;
      if (kind === 'line') {
        const lineTimeframe = isLineTimeframe(lineRaw) ? lineRaw : 'week';
        out.push({ kind, dimension, lineTimeframe });
      } else {
        out.push({ kind, dimension });
      }
    }
    return out;
  } catch {
    return [];
  }
}
