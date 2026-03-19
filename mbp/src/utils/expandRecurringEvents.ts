import { EventType } from '../api/calendar';
import { parseLocalDate } from './dateUtils';

const MAX_INSTANCES_PER_RECURRING = 300;

export function expandRecurringEventsForDateRange(
  events: EventType[],
  startDate: Date,
  endDate: Date
): EventType[] {
  const expanded: EventType[] = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const rangeStart = new Date(startDate);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(23, 59, 59, 999);

  for (const event of events) {
    const baseDate = parseLocalDate(event.date);
    const recurrencePattern = event.recurrencePattern || 'never';
    const recurrenceEndDate = event.recurrenceEndDate 
      ? parseLocalDate(event.recurrenceEndDate)
      : null;

    if (recurrencePattern === 'never' || !recurrencePattern) {
      if (baseDate >= rangeStart && baseDate <= rangeEnd) {
        expanded.push(event);
      }
      continue;
    }

    let currentDate = new Date(baseDate);
    const effectiveEndDate = recurrenceEndDate && recurrenceEndDate < rangeEnd
      ? recurrenceEndDate
      : rangeEnd;

    if (currentDate < rangeStart) {
      while (currentDate < rangeStart) {
        switch (recurrencePattern) {
          case 'daily':
            currentDate.setDate(currentDate.getDate() + 1);
            break;
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + 7);
            break;
          case 'biweekly':
            currentDate.setDate(currentDate.getDate() + 14);
            break;
          case 'monthly':
            currentDate.setMonth(currentDate.getMonth() + 1);
            break;
          case 'yearly':
            currentDate.setFullYear(currentDate.getFullYear() + 1);
            break;
        }
        if (currentDate > effectiveEndDate) break;
      }
    }

    let instanceCount = 0;
    while (
      currentDate <= effectiveEndDate &&
      currentDate <= rangeEnd &&
      instanceCount < MAX_INSTANCES_PER_RECURRING
    ) {
      if (currentDate >= rangeStart) {
        const y = currentDate.getFullYear();
        const m = String(currentDate.getMonth() + 1).padStart(2, '0');
        const d = String(currentDate.getDate()).padStart(2, '0');
        const localDateStr = `${y}-${m}-${d}`;
        expanded.push({
          ...event,
          id: `${event.id}_${localDateStr}` as any,
          date: localDateStr,
          originalEventId: event.id,
          isRecurringInstance: true,
          startAt: undefined,
        });
        instanceCount++;
      }

      switch (recurrencePattern) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'biweekly':
          currentDate.setDate(currentDate.getDate() + 14);
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
      }
    }
  }

  return expanded.sort((a, b) => {
    const [aH, aM] = (a.time.split(' - ')[0] || '00:00').split(':').map(Number);
    const [bH, bM] = (b.time.split(' - ')[0] || '00:00').split(':').map(Number);
    const dateA = parseLocalDate(a.date);
    dateA.setHours(aH || 0, aM || 0);
    const dateB = parseLocalDate(b.date);
    dateB.setHours(bH || 0, bM || 0);
    return dateA.getTime() - dateB.getTime();
  });
}
