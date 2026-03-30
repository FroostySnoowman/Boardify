import type { BoardCardData, BoardColumnData } from '../types/board';
import type {
  DashboardDimension,
  DashboardLineChartData,
  DashboardLineTimeframe,
  DashboardSeriesRow,
} from '../types/dashboard';
import { hasValidTaskIso } from '../utils/taskDateTime';

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dueDayOffsetFromToday(dueIso: string, now: Date): number {
  const dueStart = startOfLocalDay(new Date(dueIso));
  const todayStart = startOfLocalDay(now);
  return Math.round((dueStart - todayStart) / 86400000);
}

function isDoneColumn(title: string): boolean {
  return /done/i.test(title.trim());
}

function sortRowsDesc(rows: DashboardSeriesRow[]): DashboardSeriesRow[] {
  return [...rows].sort((a, b) => {
    if (a.label === 'Unassigned' && b.label !== 'Unassigned') return 1;
    if (b.label === 'Unassigned' && a.label !== 'Unassigned') return -1;
    return b.value - a.value;
  });
}

const DASHBOARD_BAR_PALETTE = ['#0a0a0a', '#a5d6a5', '#bfdbfe', '#F3D9B1', '#fecaca', '#d1d5db'];

function paletteColorAt(index: number): string {
  return DASHBOARD_BAR_PALETTE[index % DASHBOARD_BAR_PALETTE.length];
}

export function aggregateDashboardSeries(
  columns: BoardColumnData[],
  dimension: DashboardDimension,
  now: Date = new Date()
): DashboardSeriesRow[] {
  switch (dimension) {
    case 'list':
      return sortRowsDesc(
        columns.map((col, idx) => ({
          id: col.id,
          label: col.title,
          value: col.cards.length,
          color: paletteColorAt(idx),
        }))
      );
    case 'label': {
      const tally = new Map<string, number>();
      const meta = new Map<string, { label: string; color?: string }>();
      for (const col of columns) {
        for (const card of col.cards) {
          if (card.labels && card.labels.length > 0) {
            for (const l of card.labels) {
              tally.set(l.id, (tally.get(l.id) ?? 0) + 1);
              meta.set(l.id, { label: l.name, color: l.color });
            }
          } else if (card.labelColor) {
            const id = `__color__${card.labelColor}`;
            tally.set(id, (tally.get(id) ?? 0) + 1);
            meta.set(id, { label: 'Lane color', color: card.labelColor });
          }
        }
      }
      const rows: DashboardSeriesRow[] = [];
      for (const [id, value] of tally) {
        const m = meta.get(id)!;
        rows.push({ id, label: m.label, value, color: m.color });
      }
      return sortRowsDesc(rows);
    }
    case 'member': {
      let unassigned = 0;
      const memberCounts = new Map<string, number>();
      const nameById = new Map<string, string>();
      for (const col of columns) {
        for (const card of col.cards) {
          if (!card.assignees?.length) {
            unassigned += 1;
            continue;
          }
          for (const m of card.assignees) {
            nameById.set(m.id, m.name);
            memberCounts.set(m.id, (memberCounts.get(m.id) ?? 0) + 1);
          }
        }
      }
      const rows: DashboardSeriesRow[] = [];
      for (const [id, value] of memberCounts) {
        rows.push({ id, label: nameById.get(id) ?? id, value, color: paletteColorAt(rows.length) });
      }
      if (unassigned > 0) {
        rows.push({ id: '__unassigned__', label: 'Unassigned', value: unassigned, color: '#9ca3af' });
      }
      return sortRowsDesc(rows);
    }
    case 'due': {
      const order = ['complete', 'due_soon', 'overdue', 'due_later', 'no_due'] as const;
      const labels: Record<(typeof order)[number], string> = {
        complete: 'Complete',
        due_soon: 'Due soon',
        overdue: 'Overdue',
        due_later: 'Due later',
        no_due: 'No due date',
      };
      const colors: Record<(typeof order)[number], string> = {
        complete: '#a5d6a5',
        due_soon: '#F3D9B1',
        overdue: '#fecaca',
        due_later: '#bfdbfe',
        no_due: '#d1d5db',
      };
      const tally: Record<(typeof order)[number], number> = {
        complete: 0,
        due_soon: 0,
        overdue: 0,
        due_later: 0,
        no_due: 0,
      };
      for (const col of columns) {
        const doneCol = isDoneColumn(col.title);
        for (const card of col.cards) {
          if (doneCol) {
            tally.complete += 1;
            continue;
          }
          if (!hasValidTaskIso(card.dueDate)) {
            tally.no_due += 1;
            continue;
          }
          const off = dueDayOffsetFromToday(card.dueDate as string, now);
          if (off < 0) tally.overdue += 1;
          else if (off <= 7) tally.due_soon += 1;
          else tally.due_later += 1;
        }
      }
      return order.map((key) => ({
        id: key,
        label: labels[key],
        value: tally[key],
        color: colors[key],
      }));
    }
    default:
      return [];
  }
}

export function dashboardTileTitle(dimension: DashboardDimension): string {
  switch (dimension) {
    case 'list':
      return 'Cards per list';
    case 'label':
      return 'Cards per label';
    case 'member':
      return 'Cards per member';
    case 'due':
      return 'Cards per due date';
    default:
      return 'Statistics';
  }
}

function dateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayLabel(d: Date, compact: boolean): string {
  if (compact) {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return `${dow} ${d.getMonth() + 1}/${d.getDate()}`;
}

function cardCreatedDayKey(card: BoardCardData, now: Date): string {
  if (card.createdAtIso) {
    return dateKeyLocal(new Date(card.createdAtIso));
  }
  return dateKeyLocal(now);
}

const DUE_BUCKET_LABEL = {
  complete: 'Complete',
  due_soon: 'Due soon',
  overdue: 'Overdue',
  due_later: 'Due later',
  no_due: 'No due date',
} as const;

function classifyDueBucketForLine(
  card: BoardCardData,
  col: BoardColumnData,
  now: Date
): keyof typeof DUE_BUCKET_LABEL {
  if (isDoneColumn(col.title)) return 'complete';
  if (!hasValidTaskIso(card.dueDate)) return 'no_due';
  const off = dueDayOffsetFromToday(card.dueDate as string, now);
  if (off < 0) return 'overdue';
  if (off <= 7) return 'due_soon';
  return 'due_later';
}

export function timeframeDayCount(tf: DashboardLineTimeframe): number {
  switch (tf) {
    case 'week':
      return 7;
    case 'twoWeeks':
      return 14;
    case 'month':
      return 30;
    default:
      return 7;
  }
}

export function dashboardLineTimeframeTitle(tf: DashboardLineTimeframe): string {
  switch (tf) {
    case 'week':
      return 'Past week';
    case 'twoWeeks':
      return 'Past two weeks';
    case 'month':
      return 'Past month';
    default:
      return 'Past week';
  }
}

const MAX_LINE_SERIES = 6;

const LINE_PALETTE = [
  '#0a0a0a',
  '#5a5a5a',
  '#7cb87c',
  '#7c9cb8',
  '#b87c9c',
  '#c4a574',
  '#6b8e9e',
];

export function aggregateDashboardLineChart(
  columns: BoardColumnData[],
  dimension: DashboardDimension,
  timeframe: DashboardLineTimeframe,
  now: Date = new Date()
): DashboardLineChartData {
  const dayCount = timeframeDayCount(timeframe);
  const compactLabels = dayCount >= 14;
  const keys: string[] = [];
  const xLabels: string[] = [];
  const todayStart = startOfLocalDay(now);
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date(todayStart - i * 86400000);
    keys.push(dateKeyLocal(d));
    xLabels.push(formatDayLabel(d, compactLabels));
  }
  const keyToIndex = new Map(keys.map((k, idx) => [k, idx]));

  const seriesMap = new Map<string, { label: string; color?: string; values: number[] }>();

  function ensureSeries(id: string, label: string, color?: string) {
    let s = seriesMap.get(id);
    if (!s) {
      s = { label, color, values: new Array(dayCount).fill(0) };
      seriesMap.set(id, s);
    }
    return s;
  }

  function bump(seriesId: string, label: string, color: string | undefined, dayKey: string) {
    const idx = keyToIndex.get(dayKey);
    if (idx === undefined) return;
    const s = ensureSeries(seriesId, label, color);
    s.values[idx] += 1;
  }

  for (const col of columns) {
    for (const card of col.cards) {
      const dk = cardCreatedDayKey(card, now);
      if (!keyToIndex.has(dk)) continue;

      switch (dimension) {
        case 'list':
          bump(col.id, col.title, undefined, dk);
          break;
        case 'label': {
          if (card.labels && card.labels.length > 0) {
            for (const l of card.labels) {
              bump(l.id, l.name, l.color, dk);
            }
          } else if (card.labelColor) {
            const id = `__color__${card.labelColor}`;
            bump(id, 'Lane color', card.labelColor, dk);
          }
          break;
        }
        case 'member': {
          if (!card.assignees?.length) {
            bump('__unassigned__', 'Unassigned', undefined, dk);
          } else {
            for (const m of card.assignees) {
              bump(m.id, m.name, undefined, dk);
            }
          }
          break;
        }
        case 'due': {
          const bucket = classifyDueBucketForLine(card, col, now);
          bump(bucket, DUE_BUCKET_LABEL[bucket], undefined, dk);
          break;
        }
        default:
          break;
      }
    }
  }

  const entries = [...seriesMap.entries()].map(([id, s]) => ({
    id,
    label: s.label,
    color: s.color,
    values: s.values,
    total: s.values.reduce((a, b) => a + b, 0),
  }));
  entries.sort((a, b) => b.total - a.total);

  let series: Array<{ id: string; label: string; color?: string; values: number[] }>;

  if (entries.length === 0) {
    return { xLabels, series: [] };
  }
  if (entries.length <= MAX_LINE_SERIES) {
    series = entries.map(({ id, label, color, values }) => ({ id, label, color, values }));
  } else {
    const top = entries.slice(0, MAX_LINE_SERIES - 1);
    const rest = entries.slice(MAX_LINE_SERIES - 1);
    const otherValues = new Array(dayCount).fill(0);
    for (const e of rest) {
      for (let i = 0; i < dayCount; i++) {
        otherValues[i] += e.values[i];
      }
    }
    series = [
      ...top.map(({ id, label, color, values }) => ({ id, label, color, values })),
      { id: '__other__', label: 'Other', color: '#888', values: otherValues },
    ];
  }

  return {
    xLabels,
    series: series.map((s, i) => ({
      ...s,
      color: s.color ?? LINE_PALETTE[i % LINE_PALETTE.length],
    })),
  };
}
