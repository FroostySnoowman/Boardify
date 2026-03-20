import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { NotificationKind } from '../components/NotificationExpandOverlay';

export type MessageInboxFilter =
  | 'all'
  | 'unread'
  | 'mentions'
  | 'assignments'
  | 'comments'
  | 'invites_boards';

export const MESSAGE_FILTER_ORDER: MessageInboxFilter[] = [
  'all',
  'unread',
  'mentions',
  'assignments',
  'comments',
  'invites_boards',
];

export const MESSAGE_FILTER_LABELS: Record<MessageInboxFilter, string> = {
  all: 'All notifications',
  unread: 'Unread only',
  mentions: 'Mentions',
  assignments: 'Assignments',
  comments: 'Comments',
  invites_boards: 'Invites & boards',
};

type MessageFilterContextValue = {
  messageFilter: MessageInboxFilter;
  setMessageFilter: (mode: MessageInboxFilter) => void;
};

const MessageFilterContext = createContext<MessageFilterContextValue | null>(null);

const DEFAULT_FILTER: MessageInboxFilter = 'all';

export function MessageFilterProvider({ children }: { children: React.ReactNode }) {
  const [messageFilter, setMessageFilterState] = useState<MessageInboxFilter>(DEFAULT_FILTER);

  const setMessageFilter = useCallback((mode: MessageInboxFilter) => {
    setMessageFilterState(mode);
  }, []);

  const value = useMemo(
    () => ({ messageFilter, setMessageFilter }),
    [messageFilter, setMessageFilter]
  );

  return (
    <MessageFilterContext.Provider value={value}>{children}</MessageFilterContext.Provider>
  );
}

export function useMessageFilter(): MessageFilterContextValue {
  const ctx = useContext(MessageFilterContext);
  if (!ctx) {
    throw new Error('useMessageFilter must be used within MessageFilterProvider');
  }
  return ctx;
}

/** Safe for optional use outside provider (e.g. future screens). */
export function useMessageFilterOptional(): MessageFilterContextValue | null {
  return useContext(MessageFilterContext);
}

export function notificationMatchesFilter(
  filter: MessageInboxFilter,
  kind: NotificationKind,
  unread?: boolean
): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'unread':
      return !!unread;
    case 'mentions':
      return kind === 'mention';
    case 'assignments':
      return kind === 'assign';
    case 'comments':
      return kind === 'comment';
    case 'invites_boards':
      return kind === 'invite' || kind === 'board';
    default:
      return true;
  }
}
