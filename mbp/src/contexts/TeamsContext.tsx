import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { listMyTeams, Team } from '../api/teams';
import { useAuth } from './AuthContext';

interface TeamsContextType {
  teams: Team[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const TeamsContext = createContext<TeamsContextType>({
  teams: [],
  loading: true,
  refresh: async () => {},
});

export function TeamsProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const { loading: authLoading, user } = useAuth();

  const refresh = useCallback(async (): Promise<void> => {
    if (authLoading) {
      return;
    }
    if (!user) {
      setTeams([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const teams = await listMyTeams();
      const sorted = teams.sort((a, b) => {
        const dateA = a.joinedAt ? new Date(a.joinedAt).getTime() : new Date(a.createdAt).getTime();
        const dateB = b.joinedAt ? new Date(b.joinedAt).getTime() : new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      setTeams(sorted);
    } catch (err) {
      if (user) {
        console.error('Failed to load teams:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (!authLoading) {
      refresh();
    }
  }, [authLoading, refresh, user]);

  return (
    <TeamsContext.Provider value={{ teams, loading, refresh }}>
      {children}
    </TeamsContext.Provider>
  );
}

export function useTeams() {
  return useContext(TeamsContext);
}

