"use client";

import { FileText, Cpu, UserCheck, ScrollText, History } from "lucide-react";
import type { HistoryEvent } from "../types";

const ICONS = {
  created: FileText,
  run: Cpu,
  reviewed: UserCheck,
  audit: ScrollText,
} as const;

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** History tab: the record's provenance — creation, runs, reviews, audit rows. */
export function HistoryTab({ history }: { history: HistoryEvent[] }) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20">
        <History className="w-7 h-7 text-faint mb-2" />
        <p className="text-sm text-secondary">No history yet</p>
        <p className="text-[11px] text-faint mt-1">Provenance events will appear here.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-[9px] top-1 bottom-1 w-px bg-[var(--color-border)]" />
      <div className="space-y-5">
        {history.map((event) => {
          const Icon = ICONS[event.type];
          return (
            <div key={event.id} className="relative">
              <div className="absolute -left-6 top-0.5 w-[19px] h-[19px] rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center">
                <Icon size={11} className="text-[var(--color-brand-gold)]" />
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-fg">{event.label}</p>
                  {event.detail && <p className="text-xs text-muted mt-0.5">{event.detail}</p>}
                </div>
                <span className="text-[10px] text-faint shrink-0 whitespace-nowrap">{formatWhen(event.at)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
