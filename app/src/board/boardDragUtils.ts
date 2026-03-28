import type { BoardColumnData } from '../types/board';

export const BOARD_CARD_ROW_HEIGHT = 88;

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
  virtualCardCount: number
): number {
  const row = BOARD_CARD_ROW_HEIGHT;
  const idx = Math.floor(Math.max(0, localYInList) / row);
  return Math.max(0, Math.min(virtualCardCount, idx));
}

/** Insert-before index in 0..columns.length using column band midpoints (window coords). */
export function computeColumnHoverInsertIndex(
  absX: number,
  layouts: Array<{ x: number; width: number } | null | undefined>,
  columnCount: number,
  /** Column being dragged is collapsed — omit it from hit bands. */
  skipColumnIndex: number | null = null
): number {
  for (let i = 0; i < columnCount; i++) {
    if (skipColumnIndex === i) continue;
    const L = layouts[i];
    if (!L || L.width <= 0) continue;
    const mid = L.x + L.width / 2;
    if (absX < mid) return i;
  }
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
