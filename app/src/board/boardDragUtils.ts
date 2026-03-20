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
