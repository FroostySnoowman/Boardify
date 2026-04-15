export type InboxMessageKind = 'mention' | 'assign' | 'comment' | 'invite' | 'board' | 'reminder' | 'digest';

export type AuditRow = {
  id: string;
  board_id: string;
  at_iso: string;
  kind: string;
  summary: string;
  actor_user_id: number | null;
  metadata_json: string | null;
  board_name: string;
  actor_username: string | null;
  actor_email: string | null;
};

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function actorDisplayName(row: AuditRow): string {
  const u = row.actor_username?.trim();
  if (u) return u;
  const e = row.actor_email?.trim();
  if (e) {
    const at = e.indexOf('@');
    return at > 0 ? e.slice(0, at) : e;
  }
  return 'Someone';
}

function firstQuotedTitle(summary: string): string | null {
  const m = summary.match(/[“"]([^"”]+)[“"]/);
  return m ? m[1].trim() : null;
}

function metaCardId(meta: Record<string, unknown>): string | null {
  const id = meta.cardId;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

function metaCardTitle(meta: Record<string, unknown>, summary: string): string | null {
  const t = meta.cardTitle;
  if (typeof t === 'string' && t.trim()) return t.trim();
  return firstQuotedTitle(summary);
}

const ACCENT = {
  assign: '#a5d6a5',
  comment: '#F3D9B1',
  mention: '#b39ddb',
  board: '#c4c4c4',
  invite: '#c4c4c4',
  reminder: '#fca5a5',
  digest: '#93c5fd',
} as const;

export function auditRowToInboxItem(
  row: AuditRow,
  viewerUserId: number
): {
  id: string;
  boardId: string;
  boardName: string;
  cardId: string | null;
  atIso: string;
  actorName: string;
  messageKind: InboxMessageKind;
  headline: string;
  detail: string;
  accentColor: string | null;
} | null {
  const meta = parseJson<Record<string, unknown>>(row.metadata_json, {});
  const boardName = row.board_name.trim() || 'Board';
  const actor = actorDisplayName(row);
  const cardId = metaCardId(meta);
  const quoted = firstQuotedTitle(row.summary);

  switch (row.kind) {
    case 'user_assigned_to_card': {
      const aid = meta.assigneeUserId;
      if (typeof aid !== 'number' || aid !== viewerUserId) return null;
      const cardTitle = metaCardTitle(meta, row.summary) || quoted || 'a card';
      return {
        id: row.id,
        boardId: row.board_id,
        boardName,
        cardId,
        atIso: row.at_iso,
        actorName: actor,
        messageKind: 'assign',
        headline: 'assigned you to a card',
        detail: `“${cardTitle}” on ${boardName}`,
        accentColor: ACCENT.assign,
      };
    }
    case 'card_comment': {
      const snippet =
        typeof meta.snippet === 'string' && meta.snippet.trim()
          ? meta.snippet.trim()
          : row.summary.trim() || 'New note';
      const cardTitle = metaCardTitle(meta, row.summary) || quoted || 'Card';
      const shortSnippet = snippet.length > 72 ? `${snippet.slice(0, 70)}…` : snippet;
      return {
        id: row.id,
        boardId: row.board_id,
        boardName,
        cardId,
        atIso: row.at_iso,
        actorName: actor,
        messageKind: 'comment',
        headline: 'commented on a card you’re on',
        detail: `“${cardTitle}” · ${shortSnippet}`,
        accentColor: ACCENT.comment,
      };
    }
    case 'card_added':
      return {
        id: row.id,
        boardId: row.board_id,
        boardName,
        cardId,
        atIso: row.at_iso,
        actorName: actor,
        messageKind: 'board',
        headline: 'added a card',
        detail: quoted ? `“${quoted}” on ${boardName}` : boardName,
        accentColor: '#a5d6a5',
      };
    case 'card_moved':
      return {
        id: row.id,
        boardId: row.board_id,
        boardName,
        cardId,
        atIso: row.at_iso,
        actorName: actor,
        messageKind: 'board',
        headline: 'moved a card',
        detail: quoted ? `“${quoted}” on ${boardName}` : boardName,
        accentColor: '#F3D9B1',
      };
    case 'card_updated':
      return {
        id: row.id,
        boardId: row.board_id,
        boardName,
        cardId,
        atIso: row.at_iso,
        actorName: actor,
        messageKind: 'board',
        headline: 'updated a card',
        detail: quoted ? `“${quoted}” on ${boardName}` : boardName,
        accentColor: '#b39ddb',
      };
    case 'card_archived':
      return {
        id: row.id,
        boardId: row.board_id,
        boardName,
        cardId,
        atIso: row.at_iso,
        actorName: actor,
        messageKind: 'board',
        headline: row.summary.includes('removed') ? 'removed a card' : 'archived a card',
        detail: quoted ? `“${quoted}” on ${boardName}` : boardName,
        accentColor: ACCENT.board,
      };
    case 'card_restored':
      return {
        id: row.id,
        boardId: row.board_id,
        boardName,
        cardId,
        atIso: row.at_iso,
        actorName: actor,
        messageKind: 'board',
        headline: 'restored a card',
        detail: quoted ? `“${quoted}” on ${boardName}` : boardName,
        accentColor: ACCENT.board,
      };
    case 'list_added':
      return {
        id: row.id,
        boardId: row.board_id,
        boardName,
        cardId: null,
        atIso: row.at_iso,
        actorName: actor,
        messageKind: 'board',
        headline: 'added a list',
        detail: quoted ? `“${quoted}” on ${boardName}` : boardName,
        accentColor: ACCENT.board,
      };
    case 'list_archived': {
      const deleted = /deleted/i.test(row.summary);
      return {
        id: row.id,
        boardId: row.board_id,
        boardName,
        cardId: null,
        atIso: row.at_iso,
        actorName: actor,
        messageKind: 'board',
        headline: deleted ? 'deleted a list' : 'archived a list',
        detail: quoted ? `“${quoted}” on ${boardName}` : boardName,
        accentColor: ACCENT.board,
      };
    }
    case 'list_restored':
      return {
        id: row.id,
        boardId: row.board_id,
        boardName,
        cardId: null,
        atIso: row.at_iso,
        actorName: actor,
        messageKind: 'board',
        headline: 'restored a list',
        detail: quoted ? `“${quoted}” on ${boardName}` : boardName,
        accentColor: ACCENT.board,
      };
    case 'board_updated':
      return {
        id: row.id,
        boardId: row.board_id,
        boardName,
        cardId: null,
        atIso: row.at_iso,
        actorName: actor,
        messageKind: 'board',
        headline: 'updated the board',
        detail: boardName,
        accentColor: ACCENT.board,
      };
    case 'deadline_reminder': {
      const nid = meta.notifyUserId;
      if (typeof nid === 'number' && nid !== viewerUserId) return null;
      const ct = typeof meta.cardTitle === 'string' ? meta.cardTitle : quoted || 'Card';
      const due = typeof meta.dueIso === 'string' ? meta.dueIso.slice(0, 16).replace('T', ' ') : '';
      return {
        id: row.id,
        boardId: row.board_id,
        boardName,
        cardId,
        atIso: row.at_iso,
        actorName: 'Boardify',
        messageKind: 'reminder',
        headline: 'Due soon',
        detail: `“${ct}”${due ? ` · ${due}` : ''} · ${boardName}`,
        accentColor: ACCENT.reminder,
      };
    }
    case 'daily_digest': {
      const did = meta.digestUserId;
      if (typeof did !== 'number' || did !== viewerUserId) return null;
      const full =
        typeof meta.summaryFull === 'string' && meta.summaryFull.trim()
          ? meta.summaryFull.trim()
          : row.summary.trim();
      const short = full.length > 200 ? `${full.slice(0, 198)}…` : full;
      return {
        id: row.id,
        boardId: row.board_id,
        boardName,
        cardId: null,
        atIso: row.at_iso,
        actorName: 'Boardify',
        messageKind: 'digest',
        headline: 'Daily summary',
        detail: short,
        accentColor: ACCENT.digest,
      };
    }
    default:
      return null;
  }
}
