"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ParticipantSummary } from "@/lib/observation/summary";

interface ParticipantDataContextValue {
  summary: ParticipantSummary | null;
  loading: boolean;
  /** Re-fetch the summary (e.g. right after completing the first observation). */
  refresh: () => Promise<void>;
}

const ParticipantDataContext = createContext<ParticipantDataContextValue | null>(null);

/**
 * Fetches the participant summary once for the whole (participant) route group and
 * shares it with the layout guard, the sidebar, and the dashboard so completion
 * state and dashboard data come from a single source of truth.
 */
export function ParticipantDataProvider({ children }: { children: React.ReactNode }) {
  const [summary, setSummary] = useState<ParticipantSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/participant/summary");
      const data = await res.json();
      setSummary((data?.summary as ParticipantSummary | null) ?? null);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ParticipantDataContext.Provider value={{ summary, loading, refresh: load }}>
      {children}
    </ParticipantDataContext.Provider>
  );
}

export function useParticipantData(): ParticipantDataContextValue {
  const ctx = useContext(ParticipantDataContext);
  if (!ctx) {
    throw new Error("useParticipantData must be used within a ParticipantDataProvider");
  }
  return ctx;
}
