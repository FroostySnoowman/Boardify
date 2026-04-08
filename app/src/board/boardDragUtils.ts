import type { BoardColumnData } from '../types/board';

export const BOARD_CARD_ROW_HEIGHT = 88;

export function removeCardFromBoard(
  columns: BoardColumnData[],
  cardId: string
): BoardColumnData[] {
  return columns.map((col) => ({
    ...col,
    cards: col.cards.filter((c) => c.id !== cardId),
  }));
}

export function moveCardToHover(
  columns: BoardColumnData[],
  cardId: string,
  fromCol: number,
  toCol: number,
  insertIndex: number
): BoardColumnData[] {
  const next = columns.map((c) => ({
    ...c,
    cards: [...c.cards],
  }));
  const fromList = next[fromCol].cards;
  const fromIdx = fromList.findIndex((c) => c.id === cardId);
  if (fromIdx < 0) return columns;
  const [card] = fromList.splice(fromIdx, 1);
  const dest = next[toCol].cards;
  const at = Math.max(0, Math.min(insertIndex, dest.length));
  dest.splice(at, 0, card);
  return next;
}

export function computeHoverInsertIndex(
  localYInList: number,
  virtualCardCount: number,
  rowHeight: number = BOARD_CARD_ROW_HEIGHT
): number {
  const idx = Math.floor(Math.max(0, localYInList) / rowHeight);
  return Math.max(0, Math.min(virtualCardCount, idx));
}

export const TABLE_ROW_SLOT_HEIGHT = 68;

export function computeColumnHoverInsertIndex(
  absX: number,
  layouts: Array<{ x: number; width: number } | null | undefined>,
  columnCount: number,
  skipColumnIndex: number | null = null
): number {
  let sawAny = false;
  for (let i = 0; i < columnCount; i++) {
    if (skipColumnIndex === i) continue;
    const L = layouts[i];
    if (!L || L.width <= 0) continue;
    sawAny = true;
    const mid = L.x + L.width / 2;
    if (absX < mid) return i;
  }
  // No usable layouts yet (e.g. right after switching to the list-drag row). Returning `columnCount`
  // would park the slot past the last column — often off-screen while horizontal scroll is locked.
  if (!sawAny) return skipColumnIndex ?? 0;
  return columnCount;
}

export function reorderColumns(
  columns: BoardColumnData[],
  fromIndex: number,
  insertBefore: number
): BoardColumnData[] {
  const n = columns.length;
  if (fromIndex < 0 || fromIndex >= n) return columns;
  const next = columns.slice();
  const [col] = next.splice(fromIndex, 1);
  let pos = insertBefore;
  if (pos > fromIndex) pos -= 1;
  pos = Math.max(0, Math.min(pos, next.length));
  next.splice(pos, 0, col);
  return next;
}

export function removeColumnAtIndex(columns: BoardColumnData[], index: number): BoardColumnData[] {
  const n = columns.length;
  if (index < 0 || index >= n) return columns;
  return [...columns.slice(0, index), ...columns.slice(index + 1)];
}
