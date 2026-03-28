import type { BoardCardData, TaskWorkLogEntry } from '../types/board';
import { uid } from './id';

export function formatStopwatchMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatLoggedTotalMs(ms: number): string {
  if (ms <= 0) return '0 min';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatTotalTrackedBanner(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (t === 0) return '0 min';
  if (h > 0) {
    return s > 0 ? `${h}h ${m}m ${s}s` : `${h}h ${m}m`;
  }
  if (m > 0) {
    return s > 0 ? `${m}m ${s}s` : `${m} min`;
  }
  return `${s}s`;
}

export function durationFromIsoRange(startIso: string, endIso: string): number | null {
  const a = new Date(startIso).getTime();
  const b = new Date(endIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return b - a;
}

/** Start stopwatch if idle, or stop and append a ≥1s segment to workLog (same rules as task detail). */
export function toggleStopwatchOnTask(task: BoardCardData): BoardCardData {
  const running = task.workTimerRunStartedAtMs != null;
  if (running) {
    const start = task.workTimerRunStartedAtMs;
    if (start == null) return task;
    const segmentMs = Date.now() - start;
    const nextLog = [...(task.workLog ?? [])];
    if (segmentMs >= 1000) {
      const entry: TaskWorkLogEntry = {
        id: uid('w'),
        durationMs: segmentMs,
        source: 'stopwatch',
        createdAtIso: new Date().toISOString(),
      };
      nextLog.push(entry);
    }
    return {
      ...task,
      workLog: nextLog,
      workTimerAccumMs: 0,
      workTimerRunStartedAtMs: undefined,
    };
  }
  return {
    ...task,
    workTimerAccumMs: 0,
    workTimerRunStartedAtMs: Date.now(),
  };
}
