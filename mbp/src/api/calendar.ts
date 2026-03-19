import { nativeFetch } from './http';

export type EventType = {
  id: number;
  title: string;
  type: 'practice' | 'match' | 'tournament' | 'other';
  date: string;
  time: string;
  location: string;
  color: string;
  createdBy: number;
  editable: boolean;
  courtNumber?: number | null;
  recurrencePattern?: 'never' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';
  recurrenceEndDate?: string | null;
  originalEventId?: number; // For recurring event instances
  isRecurringInstance?: boolean; // Flag to identify expanded recurring events
  teamId?: string | null; // Team ID if this is a team event
  userId?: string | null; // User ID if this is a personal event
  /** Event start time as epoch ms (local time → UTC). Used for reminders and Live Activity. */
  startAt?: number | null;
  /** IANA timezone (e.g. America/Los_Angeles) when event was created. */
  timezone?: string | null;
};

export type RSVPResponse = 'yes' | 'no';

export async function listMyEvents(): Promise<EventType[]> {
  const res = await nativeFetch('/events', { method: 'GET', params: {} });
  return (res.data as any).events;
}

export async function listAllEvents(): Promise<EventType[]> {
  const res = await nativeFetch('/events/all', { method: 'GET', params: {} });
  return (res.data as any).events;
}

export async function createEvent(
  title: string,
  type: EventType['type'],
  date: string,
  time: string,
  location: string,
  color: string,
  courtNumber?: number | null,
  recurrencePattern?: 'never' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly',
  recurrenceEndDate?: string | null,
  startAt?: number | null,
  timezone?: string | null
): Promise<EventType> {
  const res = await nativeFetch('/events', {
    method: 'POST',
    data: { title, type, date, time, location, color, courtNumber, recurrencePattern, recurrenceEndDate, startAt, timezone },
    params: {},
  });
  return (res.data as any).event;
}

export async function getEvent(eventId: number): Promise<EventType> {
  const res = await nativeFetch(`/events/${eventId}`, { method: 'GET', params: {} });
  return (res.data as any).event;
}

export async function updateEvent(event: EventType): Promise<EventType> {
  const { id, title, type, date, time, location, color, courtNumber, recurrencePattern, recurrenceEndDate, startAt, timezone } = event;
  const res = await nativeFetch(`/events/${id}`, {
    method: 'PUT',
    data: { title, type, date, time, location, color, courtNumber, recurrencePattern, recurrenceEndDate, startAt, timezone },
    params: {},
  });
  return (res.data as any).event;
}

export async function deleteEvent(eventId: number): Promise<void> {
  await nativeFetch(`/events/${eventId}`, { method: 'DELETE', params: {} });
}

export async function listTeamEvents(teamId: string): Promise<EventType[]> {
  const res = await nativeFetch(`/teams/${teamId}/events`, { method: 'GET', params: {} });
  return (res.data as any).events;
}

export async function createTeamEvent(
  teamId: string,
  title: string,
  type: EventType['type'],
  date: string,
  time: string,
  location: string,
  color: string,
  courtNumber?: number | null,
  recurrencePattern?: 'never' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly',
  recurrenceEndDate?: string | null,
  startAt?: number | null,
  timezone?: string | null
): Promise<EventType> {
  const res = await nativeFetch(`/teams/${teamId}/events`, {
    method: 'POST',
    data: { title, type, date, time, location, color, courtNumber, recurrencePattern, recurrenceEndDate, startAt, timezone },
    params: {},
  });
  return (res.data as any).event;
}

export async function updateTeamEvent(
  teamId: string,
  event: EventType
): Promise<EventType> {
  const { id, title, type, date, time, location, color, courtNumber, recurrencePattern, recurrenceEndDate, startAt, timezone } = event;
  const res = await nativeFetch(`/teams/${teamId}/events/${id}`, {
    method: 'PUT',
    data: { title, type, date, time, location, color, courtNumber, recurrencePattern, recurrenceEndDate, startAt, timezone },
    params: {},
  });
  return (res.data as any).event;
}

export async function deleteTeamEvent(teamId: string, eventId: number): Promise<void> {
  await nativeFetch(`/teams/${teamId}/events/${eventId}`, { method: 'DELETE', params: {} });
}

export async function rsvpEvent(eventId: number | string, response: RSVPResponse): Promise<void> {
  // Extract original event ID if this is an expanded recurring event instance
  let actualEventId: number;
  if (typeof eventId === 'string' && eventId.includes('_')) {
    const originalId = parseInt(eventId.split('_')[0], 10);
    if (!isNaN(originalId)) {
      actualEventId = originalId;
    } else {
      actualEventId = parseInt(String(eventId), 10);
    }
  } else {
    actualEventId = typeof eventId === 'number' ? eventId : parseInt(String(eventId), 10);
  }
  
  await nativeFetch(`/events/${actualEventId}/rsvp`, {
    method: 'POST',
    data: { response },
    params: {},
  });
}

export async function removeRsvp(eventId: number): Promise<void> {
  await nativeFetch(`/events/${eventId}/rsvp`, { method: 'DELETE', params: {} });
}

export interface RSVPs {
  yes: string[];
  no: string[];
}

export async function listRsvps(eventId: number | string): Promise<RSVPs> {
  // Extract original event ID if this is an expanded recurring event instance
  // Expanded IDs are in format: "52_2026-03-31", we need just "52"
  let actualEventId: number;
  if (typeof eventId === 'string' && eventId.includes('_')) {
    const originalId = parseInt(eventId.split('_')[0], 10);
    if (!isNaN(originalId)) {
      actualEventId = originalId;
    } else {
      actualEventId = parseInt(String(eventId), 10);
    }
  } else {
    actualEventId = typeof eventId === 'number' ? eventId : parseInt(String(eventId), 10);
  }
  
  const res = await nativeFetch(`/events/${actualEventId}/rsvps`, { method: 'GET', params: {} });
  return res.data as RSVPs;
}

export async function listRsvpsBulk(eventIds: number[]): Promise<Record<number, { yes: string[]; no: string[] }>> {
  // Extract original event IDs if any are expanded recurring event IDs
  const actualEventIds = eventIds.map(id => {
    const idStr = String(id);
    if (idStr.includes('_')) {
      return parseInt(idStr.split('_')[0], 10);
    }
    return typeof id === 'number' ? id : parseInt(idStr, 10);
  });
  
  // Remove duplicates
  const uniqueIds = Array.from(new Set(actualEventIds));
  
  const res = await nativeFetch(`/events/rsvps/bulk?eventIds=${encodeURIComponent(JSON.stringify(uniqueIds))}`, { 
    method: 'GET', 
    params: {} 
  });
  return (res.data as any).rsvps;
}