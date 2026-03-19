import React, { createContext, useCallback, useContext } from 'react';
import { useRouter } from 'expo-router';

export type ChatBlockReason = 'birthdate' | 'parental';

type ChatBlockedModalContextValue = {
  showChatBlocked: (reason: ChatBlockReason) => void;
};

const Context = createContext<ChatBlockedModalContextValue | null>(null);

export function useChatBlockedModal(): ChatBlockedModalContextValue {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error('useChatBlockedModal must be used within ChatBlockedModalProvider');
  }
  return ctx;
}

export function ChatBlockedModalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const showChatBlocked = useCallback((reason: ChatBlockReason) => {
    router.push({ pathname: '/chat-required', params: { reason } });
  }, [router]);

  return (
    <Context.Provider value={{ showChatBlocked }}>
      {children}
    </Context.Provider>
  );
}
