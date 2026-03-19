import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { RadioPlaybackState, radioPlaybackService } from '../services/radioPlaybackService';

interface RadioPlaybackContextValue {
  state: RadioPlaybackState;
  start: (matchId: string) => void;
  setMatch: (matchId: string) => void;
  pause: () => void;
  resume: () => void;
  jumpToLive: () => void;
  stop: () => void;
  clearDebug: () => void;
}

const RadioPlaybackContext = createContext<RadioPlaybackContextValue | null>(null);

export function RadioPlaybackProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RadioPlaybackState>(radioPlaybackService.getState());

  useEffect(() => {
    return radioPlaybackService.subscribe(setState);
  }, []);

  const value = useMemo<RadioPlaybackContextValue>(
    () => ({
      state,
      start: (matchId: string) => radioPlaybackService.start(matchId),
      setMatch: (matchId: string) => radioPlaybackService.setMatch(matchId),
      pause: () => radioPlaybackService.pause(),
      resume: () => radioPlaybackService.resume(),
      jumpToLive: () => radioPlaybackService.jumpToLive(),
      stop: () => radioPlaybackService.stop(),
      clearDebug: () => radioPlaybackService.clearDebug(),
    }),
    [state]
  );

  return <RadioPlaybackContext.Provider value={value}>{children}</RadioPlaybackContext.Provider>;
}

export function useRadioPlayback() {
  const ctx = useContext(RadioPlaybackContext);
  if (!ctx) {
    throw new Error('useRadioPlayback must be used inside RadioPlaybackProvider');
  }
  return ctx;
}
