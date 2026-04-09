import type { BoardCardData, BoardColumnData } from '../types/board';
import type { BoardListItem } from '../data/boards';
import type {
  DashboardChartKind,
  DashboardDimension,
  DashboardLineTimeframe,
  DashboardTile,
} from '../types/dashboard';

/** Raw board row from Worker `boards` table */
export type ApiBoardRow = {
  id: string;
  owner_user_id: number;
  name: string;
  color: string | null;
  settings_json: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Card object from `GET /boards/:id/full` (cardRowToApi + payload merge) */
export type ApiCard = Record<string, unknown> & {
  id: string;
  title: string;
  listId?: string;
  position?: number;
  createdAtIso?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ApiColumn = {
  id: string;
  title: string;
  position: number;
  cards: ApiCard[];
};

export function apiBoardToListItem(row: ApiBoardRow): BoardListItem {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? '#d4d4d4',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function apiRecordToBoardCard(c: Record<string, unknown>): BoardCardData {
  return apiCardToBoardCard(c as ApiCard);
}

function apiCardToBoardCard(c: ApiCard): BoardCardData {
  const {
    listId: _l,
    position: _p,
    createdAt: _ca,
    updatedAt: _ua,
    ...rest
  } = c;
  const createdAtIso =
    (typeof c.createdAtIso === 'string' && c.createdAtIso) ||
    (typeof c.createdAt === 'string' && c.createdAt) ||
    undefined;
  const card: BoardCardData = {
    ...(rest as BoardCardData),
    id: String(c.id),
    title: typeof c.title === 'string' ? c.title : '',
  };
  if (createdAtIso) card.createdAtIso = createdAtIso;
  return card;
}

export function mapFullColumnsToBoard(columns: ApiColumn[]): BoardColumnData[] {
  return [...columns]
    .sort((a, b) => a.position - b.position)
    .map((col) => ({
      id: col.id,
      title: col.title,
      cards: [...col.cards]
        .sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
        .map((c) => apiCardToBoardCard(c)),
    }));
}

/** Build PATCH body for Worker from client card (omits id / server-only). */
export function boardCardToPatchBody(card: BoardCardData, extra?: Record<string, unknown>): Record<string, unknown> {
  const {
    id: _id,
    ...rest
  } = card;
  return { ...rest, ...extra };
}

export function apiTileToDashboardTile(row: {
  id: string;
  kind: string;
  dimension: string;
  line_timeframe: string | null;
  position: number;
}): DashboardTile {
  const kind = row.kind as DashboardChartKind;
  const dimension = row.dimension as DashboardDimension;
  const lineTimeframe = (row.line_timeframe || undefined) as DashboardLineTimeframe | undefined;
  return {
    id: row.id,
    kind,
    dimension,
    ...(kind === 'line' && lineTimeframe ? { lineTimeframe } : {}),
  };
}

export function dashboardTilesToApiPut(
  tiles: DashboardTile[]
): { kind: string; dimension: string; lineTimeframe?: string }[] {
  return tiles.map((t) => ({
    kind: t.kind,
    dimension: t.dimension,
    ...(t.kind === 'line' && t.lineTimeframe ? { lineTimeframe: t.lineTimeframe } : {}),
  }));
}
