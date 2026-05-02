import { useCallback, useEffect, useState } from 'react';
import type { BoardColumnData } from '../types/board';
import {
  getBoardFull,
  moveCard,
  patchCard,
  reorderLists,
  archiveBoardCard,
  archiveBoardList,
} from '../api/boards';
import { mapFullColumnsToBoard, type ApiBoardRow } from '../api/boardMappers';

export function useBoardRemoteState(boardId: string | undefined) {
  const [columns, setColumns] = useState<BoardColumnData[]>([]);
  const [boardRow, setBoardRow] = useState<ApiBoardRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async (): Promise<boolean> => {
    if (!boardId) return false;
    try {
      const { board, columns: cols } = await getBoardFull(boardId);
      setBoardRow(board);
      setColumns(mapFullColumnsToBoard(cols));
      setError(null);
      return true;
    } catch (e: unknown) {
      const status =
        typeof e === 'object' && e !== null && 'status' in e ? (e as { status?: number }).status : undefined;
      if (status === 401 || status === 403 || status === 404) {
        setBoardRow(null);
        setColumns([]);
      }
      const message = e instanceof Error ? e.message : 'Failed to load board';
      setError(message || 'Failed to load board');
      return false;
    }
  }, [boardId]);

  useEffect(() => {
    if (!boardId) {
      setBoardRow(null);
      setColumns([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getBoardFull(boardId)
      .then(({ board, columns: cols }) => {
        if (cancelled) return;
        setBoardRow(board);
        setColumns(mapFullColumnsToBoard(cols));
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || 'Failed to load board');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [boardId]);

  const persistListReorder = useCallback(
    async (orderedColumns: BoardColumnData[]) => {
      if (!boardId) return;
      await reorderLists(
        boardId,
        orderedColumns.map((c) => c.id)
      );
    },
    [boardId]
  );

  const persistCardMove = useCallback(
    async (cardId: string, targetListId: string, position: number) => {
      await moveCard(cardId, { listId: targetListId, position });
    },
    []
  );

  const persistCardOrderInList = useCallback(async (listId: string, orderedCardIds: string[]) => {
    await Promise.all(
      orderedCardIds.map((id, position) =>
        patchCard(id, { position }).catch(() => undefined)
      )
    );
  }, []);

  const persistArchiveCard = useCallback(
    async (cardId: string, sourceListTitle: string) => {
      if (!boardId) return;
      await archiveBoardCard(boardId, { cardId, sourceListTitle });
    },
    [boardId]
  );

  const persistArchiveList = useCallback(
    async (listId: string) => {
      if (!boardId) return;
      await archiveBoardList(boardId, { listId });
    },
    [boardId]
  );

  return {
    columns,
    setColumns,
    boardRow,
    loading,
    error,
    refresh,
    persistListReorder,
    persistCardMove,
    persistCardOrderInList,
    persistArchiveCard,
    persistArchiveList,
  };
}
