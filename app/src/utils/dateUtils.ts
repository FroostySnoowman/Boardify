export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function parseLocalDateTime(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = (timeStr || '00:00').split(':').map(Number);
  return new Date(year, month - 1, day, hours || 0, minutes || 0);
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTimeForDisplay(storedTime: string): string {
  if (!storedTime) return '';
  const parts = storedTime.split(' - ');
  const formatted = parts.map(part => {
    const trimmed = part.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (ampmMatch) {
        let h = parseInt(ampmMatch[1], 10);
        const m = parseInt(ampmMatch[2], 10);
        const isPM = ampmMatch[3].toUpperCase() === 'PM';
        if (isPM && h !== 12) h += 12;
        if (!isPM && h === 12) h = 0;
        const d = new Date(2000, 0, 1, h, m);
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }
      return trimmed;
    }
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const d = new Date(2000, 0, 1, h, m);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  });
  return formatted.join(' - ');
}

export function formatMinutesForDisplay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatHourLabel(hour: number): string {
  const d = new Date(2000, 0, 1, hour, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
