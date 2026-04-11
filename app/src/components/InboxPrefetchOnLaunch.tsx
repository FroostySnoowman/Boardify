import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { prefetchInboxMessagesForUser } from '../storage/messagesInboxCache';

/** After sign-in, warm inbox cache so the Messages tab can show data without a blocking skeleton. */
export function InboxPrefetchOnLaunch() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (loading || !user?.id) return;
    void prefetchInboxMessagesForUser(user.id);
  }, [loading, user?.id]);
  return null;
}
