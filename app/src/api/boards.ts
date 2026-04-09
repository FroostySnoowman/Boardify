import { nativeFetch } from './http';
import type { ApiBoardRow, ApiColumn } from './boardMappers';

export async function listBoards(): Promise<{ boards: ApiBoardRow[] }> {
  const res = await nativeFetch('/api/boards', { method: 'GET' });
  return res.data as { boards: ApiBoardRow[] };
}

export async function createBoard(body: {
  name: string;
  color?: string | null;
  settings_json?: string | Record<string, unknown>;
}): Promise<{ board: ApiBoardRow }> {
  const res = await nativeFetch('/api/boards', { method: 'POST', data: body });
  return res.data as { board: ApiBoardRow };
}

export async function getBoard(boardId: string): Promise<{ board: ApiBoardRow }> {
  const res = await nativeFetch(`/api/boards/${encodeURIComponent(boardId)}`, { method: 'GET' });
  return res.data as { board: ApiBoardRow };
}

export async function patchBoard(
  boardId: string,
  body: Partial<{
    name: string;
    color: string | null;
    settings_json: string | Record<string, unknown>;
    sort_order: number;
    archived_at: string | null;
  }>
): Promise<{ board: ApiBoardRow }> {
  const res = await nativeFetch(`/api/boards/${encodeURIComponent(boardId)}`, {
    method: 'PATCH',
    data: body,
  });
  return res.data as { board: ApiBoardRow };
}

export async function deleteBoard(boardId: string): Promise<void> {
  await nativeFetch(`/api/boards/${encodeURIComponent(boardId)}`, { method: 'DELETE' });
}

export async function getBoardFull(boardId: string): Promise<{
  board: ApiBoardRow;
  columns: ApiColumn[];
}> {
  const res = await nativeFetch(`/api/boards/${encodeURIComponent(boardId)}/full`, {
    method: 'GET',
  });
  return res.data as { board: ApiBoardRow; columns: ApiColumn[] };
}

export async function createList(
  boardId: string,
  body: { title: string; position?: number }
): Promise<{ list: Record<string, unknown> }> {
  const res = await nativeFetch(`/api/boards/${encodeURIComponent(boardId)}/lists`, {
    method: 'POST',
    data: body,
  });
  return res.data as { list: Record<string, unknown> };
}

export async function reorderLists(boardId: string, orderedIds: string[]): Promise<void> {
  await nativeFetch(`/api/boards/${encodeURIComponent(boardId)}/lists/reorder`, {
    method: 'POST',
    data: { orderedIds },
  });
}

export async function patchList(
  listId: string,
  body: { title?: string; position?: number }
): Promise<{ list: Record<string, unknown> }> {
  const res = await nativeFetch(`/api/lists/${encodeURIComponent(listId)}`, {
    method: 'PATCH',
    data: body,
  });
  return res.data as { list: Record<string, unknown> };
}

export async function deleteList(listId: string): Promise<void> {
  await nativeFetch(`/api/lists/${encodeURIComponent(listId)}`, { method: 'DELETE' });
}

export async function createCard(
  listId: string,
  body: Record<string, unknown>
): Promise<{ card: Record<string, unknown> | null }> {
  const res = await nativeFetch(`/api/lists/${encodeURIComponent(listId)}/cards`, {
    method: 'POST',
    data: body,
  });
  return res.data as { card: Record<string, unknown> | null };
}

export async function patchCard(
  cardId: string,
  body: Record<string, unknown>
): Promise<{ card: Record<string, unknown> | null }> {
  const res = await nativeFetch(`/api/cards/${encodeURIComponent(cardId)}`, {
    method: 'PATCH',
    data: body,
  });
  return res.data as { card: Record<string, unknown> | null };
}

export async function deleteCard(cardId: string): Promise<void> {
  await nativeFetch(`/api/cards/${encodeURIComponent(cardId)}`, { method: 'DELETE' });
}

export async function moveCard(
  cardId: string,
  body: { listId: string; position?: number }
): Promise<{ card: Record<string, unknown> | null }> {
  const res = await nativeFetch(`/api/cards/${encodeURIComponent(cardId)}/move`, {
    method: 'POST',
    data: body,
  });
  return res.data as { card: Record<string, unknown> | null };
}

export async function getBoardArchive(boardId: string): Promise<{
  archivedCards: ArchivedCardRow[];
  archivedLists: ArchivedListRow[];
}> {
  const res = await nativeFetch(`/api/boards/${encodeURIComponent(boardId)}/archive`, {
    method: 'GET',
  });
  return res.data as { archivedCards: ArchivedCardRow[]; archivedLists: ArchivedListRow[] };
}

export type ArchivedCardRow = {
  id: string;
  board_id: string;
  archived_at: string;
  archived_by_user_id: number | null;
  source_list_title: string | null;
  card_snapshot_json: string;
};

export type ArchivedListRow = {
  id: string;
  board_id: string;
  archived_at: string;
  archived_by_user_id: number | null;
  column_snapshot_json: string;
};

export async function archiveBoardCard(
  boardId: string,
  body: { cardId: string; sourceListTitle?: string }
): Promise<{ archiveId: string }> {
  const res = await nativeFetch(`/api/boards/${encodeURIComponent(boardId)}/archive/cards`, {
    method: 'POST',
    data: body,
  });
  return res.data as { archiveId: string };
}

export async function archiveBoardList(boardId: string, body: { listId: string }): Promise<{ archiveId: string }> {
  const res = await nativeFetch(`/api/boards/${encodeURIComponent(boardId)}/archive/lists`, {
    method: 'POST',
    data: body,
  });
  return res.data as { archiveId: string };
}

export async function restoreBoard(
  boardId: string,
  body: { type: 'card' | 'list'; archiveId: string; targetListId?: string }
): Promise<Record<string, unknown>> {
  const res = await nativeFetch(`/api/boards/${encodeURIComponent(boardId)}/restore`, {
    method: 'POST',
    data: body,
  });
  return res.data as Record<string, unknown>;
}

export async function getBoardAudit(boardId: string, params?: { limit?: number; offset?: number }): Promise<{
  entries: AuditEntryRow[];
}> {
  const res = await nativeFetch(`/api/boards/${encodeURIComponent(boardId)}/audit`, {
    method: 'GET',
    params,
  });
  return res.data as { entries: AuditEntryRow[] };
}

export type AuditEntryRow = {
  id: string;
  board_id: string;
  at_iso: string;
  kind: string;
  summary: string;
  actor_user_id: number | null;
  metadata_json: string | null;
};

export async function getDashboardTiles(boardId: string): Promise<{
  tiles: Array<{
    id: string;
    board_id: string;
    kind: string;
    dimension: string;
    line_timeframe: string | null;
    position: number;
  }>;
}> {
  const res = await nativeFetch(`/api/boards/${encodeURIComponent(boardId)}/dashboard/tiles`, {
    method: 'GET',
  });
  return res.data as {
    tiles: Array<{
      id: string;
      board_id: string;
      kind: string;
      dimension: string;
      line_timeframe: string | null;
      position: number;
    }>;
  };
}

export async function putDashboardTiles(
  boardId: string,
  tiles: { kind: string; dimension: string; lineTimeframe?: string }[]
): Promise<void> {
  await nativeFetch(`/api/boards/${encodeURIComponent(boardId)}/dashboard/tiles`, {
    method: 'PUT',
    data: { tiles },
  });
}

export async function getNotificationSettings(boardId: string): Promise<{ prefs: Record<string, unknown> | null }> {
  const res = await nativeFetch(`/api/boards/${encodeURIComponent(boardId)}/notification-settings`, {
    method: 'GET',
  });
  return res.data as { prefs: Record<string, unknown> | null };
}

export async function patchNotificationSettings(
  boardId: string,
  patch: Record<string, unknown>
): Promise<{ prefs: Record<string, unknown> }> {
  const res = await nativeFetch(`/api/boards/${encodeURIComponent(boardId)}/notification-settings`, {
    method: 'PATCH',
    data: patch,
  });
  return res.data as { prefs: Record<string, unknown> };
}
