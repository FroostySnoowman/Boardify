import { useEffect, useRef } from 'react';
import { ENV } from '../config/env';
import { getStoredSessionToken } from '../api/session';

/**
 * Subscribes to board Durable Object broadcasts and debounces a full refetch.
 */
export function useBoardWebSocket(boardId: string | undefined, onRefresh: () => void) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!boardId) return;
    const base = ENV.API_BASE.replace(/\/$/, '');
    if (!base.startsWith('http')) return;

    let ws: WebSocket | null = null;
    let closed = false;

    void (async () => {
      const token = await getStoredSessionToken();
      if (!token || closed) return;
      const wsUrl = base.replace(/^https/, 'wss').replace(/^http/, 'ws');
      const url = `${wsUrl}/ws/boards/${encodeURIComponent(boardId)}?token=${encodeURIComponent(token)}`;
      try {
        ws = new WebSocket(url);
      } catch {
        return;
      }
      ws.onmessage = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null;
          onRefreshRef.current();
        }, 500);
      };
      ws.onerror = () => {
        /* ignore */
      };
    })();

    return () => {
      closed = true;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [boardId]);
}
