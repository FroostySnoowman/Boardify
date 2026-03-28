import type { BoardColumnData } from '../types/board';
import type { DashboardDimension, DashboardSeriesRow } from '../types/dashboard';
import { hasValidTaskIso } from '../utils/taskDateTime';

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Days from local today: negative = overdue, 0–7 = due soon, >7 = due later. */
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

export function aggregateDashboardSeries(
  columns: BoardColumnData[],
  dimension: DashboardDimension,
  now: Date = new Date()
): DashboardSeriesRow[] {
  switch (dimension) {
    case 'list':
      return sortRowsDesc(
        columns.map((col) => ({
          id: col.id,
          label: col.title,
          value: col.cards.length,
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
        rows.push({ id, label: nameById.get(id) ?? id, value });
      }
      if (unassigned > 0) {
        rows.push({ id: '__unassigned__', label: 'Unassigned', value: unassigned });
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
