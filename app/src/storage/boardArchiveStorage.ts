import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BoardCardData, BoardColumnData } from '../types/board';
import { uid } from '../utils/id';

const ARCHIVE_PREFIX = 'bb_board_archive_v1_';
const PENDING_RESTORE_PREFIX = 'bb_board_pending_restore_v1_';

const MAX_AUDIT = 200;
const MAX_ARCHIVED_CARDS = 300;
const MAX_ARCHIVED_LISTS = 50;

function slug(boardName: string): string {
  return boardName.trim().replace(/\s+/g, '_').slice(0, 80) || 'board';
}

export type ArchivedCardItem = {
  archiveId: string;
  archivedAtIso: string;
  sourceListTitle: string;
  card: BoardCardData;
};

export type ArchivedListItem = {
  archiveId: string;
  archivedAtIso: string;
  column: BoardColumnData;
};

export type BoardAuditKind =
  | 'card_archived'
  | 'list_archived'
  | 'card_restored'
  | 'list_restored'
  | 'card_added'
  | 'list_added'
  | 'card_updated';

export type BoardAuditEntry = {
  id: string;
  atIso: string;
  kind: BoardAuditKind;
  summary: string;
};

type Stored = {
  version: 1;
  archivedCards: ArchivedCardItem[];
  archivedLists: ArchivedListItem[];
  auditLog: BoardAuditEntry[];
};

const empty = (): Stored => ({
  version: 1,
  archivedCards: [],
  archivedLists: [],
  auditLog: [],
});

async function loadStored(boardName: string): Promise<Stored> {
  const key = ARCHIVE_PREFIX + slug(boardName);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return empty();
    const p = JSON.parse(raw) as Partial<Stored>;
    return {
      version: 1,
      archivedCards: Array.isArray(p.archivedCards) ? p.archivedCards : [],
      archivedLists: Array.isArray(p.archivedLists) ? p.archivedLists : [],
      auditLog: Array.isArray(p.auditLog) ? p.auditLog : [],
    };
  } catch {
    return empty();
  }
}

async function saveStored(boardName: string, s: Stored): Promise<void> {
  await AsyncStorage.setItem(ARCHIVE_PREFIX + slug(boardName), JSON.stringify(s));
}

function pushAudit(s: Stored, kind: BoardAuditKind, summary: string) {
  const entry: BoardAuditEntry = {
    id: uid('audit'),
    atIso: new Date().toISOString(),
    kind,
    summary,
  };
  s.auditLog.unshift(entry);
  if (s.auditLog.length > MAX_AUDIT) s.auditLog.length = MAX_AUDIT;
}

export async function loadBoardArchiveState(boardName: string): Promise<Stored> {
  return loadStored(boardName);
}

export async function archiveCard(boardName: string, card: BoardCardData, sourceListTitle: string): Promise<void> {
  const s = await loadStored(boardName);
  const item: ArchivedCardItem = {
    archiveId: uid('arc'),
    archivedAtIso: new Date().toISOString(),
    sourceListTitle,
    card: JSON.parse(JSON.stringify(card)) as BoardCardData,
  };
  s.archivedCards.unshift(item);
  if (s.archivedCards.length > MAX_ARCHIVED_CARDS) s.archivedCards.length = MAX_ARCHIVED_CARDS;
  pushAudit(s, 'card_archived', `Archived card “${card.title}” from ${sourceListTitle || 'a list'}`);
  await saveStored(boardName, s);
}

export async function archiveList(boardName: string, column: BoardColumnData): Promise<void> {
  const s = await loadStored(boardName);
  const item: ArchivedListItem = {
    archiveId: uid('arl'),
    archivedAtIso: new Date().toISOString(),
    column: JSON.parse(JSON.stringify(column)) as BoardColumnData,
  };
  s.archivedLists.unshift(item);
  if (s.archivedLists.length > MAX_ARCHIVED_LISTS) s.archivedLists.length = MAX_ARCHIVED_LISTS;
  pushAudit(s, 'list_archived', `Archived list “${column.title}” (${column.cards.length} cards)`);
  await saveStored(boardName, s);
}

export type PendingRestoreOp =
  | { kind: 'card'; card: BoardCardData; sourceListTitle?: string }
  | { kind: 'list'; column: BoardColumnData };

async function queuePendingRestore(boardName: string, op: PendingRestoreOp): Promise<void> {
  const key = PENDING_RESTORE_PREFIX + slug(boardName);
  const raw = await AsyncStorage.getItem(key);
  let list: PendingRestoreOp[] = [];
  try {
    if (raw) list = JSON.parse(raw) as PendingRestoreOp[];
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }
  list.push(op);
  await AsyncStorage.setItem(key, JSON.stringify(list));
}

export async function consumePendingRestores(boardName: string): Promise<PendingRestoreOp[]> {
  const key = PENDING_RESTORE_PREFIX + slug(boardName);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  await AsyncStorage.removeItem(key);
  try {
    const list = JSON.parse(raw) as PendingRestoreOp[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function applyPendingRestoreOps(
  columns: BoardColumnData[],
  ops: PendingRestoreOp[]
): BoardColumnData[] {
  let next = columns;
  for (const op of ops) {
    next = applyOneRestore(next, op);
  }
  return next;
}

function applyOneRestore(columns: BoardColumnData[], op: PendingRestoreOp): BoardColumnData[] {
  if (op.kind === 'list') {
    const col = {
      ...op.column,
      id: uid('col'),
      cards: op.column.cards.map((c) => ({ ...c, id: uid('c') })),
    };
    return [...columns, col];
  }
  const card = { ...op.card, id: uid('c') };
  const prefer = op.sourceListTitle?.trim();
  let targetIdx = 0;
  if (prefer) {
    const i = columns.findIndex((c) => c.title === prefer);
    if (i >= 0) targetIdx = i;
  }
  if (columns.length === 0) {
    return [{ id: uid('col'), title: prefer || 'To Do', cards: [card] }];
  }
  return columns.map((c, i) => (i === targetIdx ? { ...c, cards: [...c.cards, card] } : c));
}

export async function restoreArchivedCard(boardName: string, archiveId: string): Promise<boolean> {
  const s = await loadStored(boardName);
  const idx = s.archivedCards.findIndex((x) => x.archiveId === archiveId);
  if (idx < 0) return false;
  const [item] = s.archivedCards.splice(idx, 1);
  pushAudit(s, 'card_restored', `Restored card “${item.card.title}”`);
  await saveStored(boardName, s);
  await queuePendingRestore(boardName, {
    kind: 'card',
    card: item.card,
    sourceListTitle: item.sourceListTitle,
  });
  return true;
}

export async function restoreArchivedList(boardName: string, archiveId: string): Promise<boolean> {
  const s = await loadStored(boardName);
  const idx = s.archivedLists.findIndex((x) => x.archiveId === archiveId);
  if (idx < 0) return false;
  const [item] = s.archivedLists.splice(idx, 1);
  pushAudit(s, 'list_restored', `Restored list “${item.column.title}”`);
  await saveStored(boardName, s);
  await queuePendingRestore(boardName, { kind: 'list', column: item.column });
  return true;
}

export async function loadBoardAuditLog(boardName: string): Promise<BoardAuditEntry[]> {
  const s = await loadStored(boardName);
  return s.auditLog;
}

/** Append a row to the board activity log (adds, edits, archives, etc.). */
export async function appendBoardAuditEntry(
  boardName: string,
  kind: BoardAuditKind,
  summary: string
): Promise<void> {
  const s = await loadStored(boardName);
  pushAudit(s, kind, summary);
  await saveStored(boardName, s);
}
