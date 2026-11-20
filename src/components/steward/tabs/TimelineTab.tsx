"use client";

import { GitCommitVertical, MapPin } from "lucide-react";
import type { TimelinePoint } from "../types";

const burdenDot = (b: string) =>
  b === "High" ? "bg-red-500" : b === "Moderate" ? "bg-[var(--color-brand-orange)]" : "bg-[var(--color-brand-green)]";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

/** Timeline tab: this contributor's Atlas Records over time (longitudinal view). */
export function TimelineTab({ timeline }: { timeline: TimelinePoint[] }) {
  if (timeline.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20">
        <GitCommitVertical className="w-7 h-7 text-faint mb-2" />
        <p className="text-sm text-secondary">No timeline yet</p>
        <p className="text-[11px] text-faint mt-1">This contributor has a single observation so far.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] text-faint uppercase tracking-wider mb-4">
        {timeline.length} record{timeline.length === 1 ? "" : "s"} from this contributor
      </p>
      <div className="relative pl-6">
        <div className="absolute left-[9px] top-1 bottom-1 w-px bg-[var(--color-border)]" />
        <div className="space-y-4">
          {timeline.map((point, i) => (
            <div key={point.id} className="relative">
              <div className={`absolute -left-6 top-1 w-[19px] h-[19px] rounded-full flex items-center justify-center border ${point.isCurrent ? "border-[var(--color-brand-gold)] bg-[var(--color-surface-hover)]" : "border-[var(--color-border)] bg-[var(--color-surface)]"}`}>
                <div className={`w-2 h-2 rounded-full ${burdenDot(point.burdenLevel)}`}></div>
              </div>
              <div
                className={`rounded-lg border p-3 ${point.isCurrent ? "border-[var(--color-brand-gold)] bg-[var(--color-surface-hover)]" : "border-[var(--color-border)] bg-[var(--color-background)]"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-fg">{point.displayId}</p>
                    {point.isCurrent && (
                      <span className="flex items-center gap-1 text-[9px] text-[var(--color-brand-gold)] border border-[var(--color-brand-gold)] px-1.5 py-0.5 rounded-full">
                        <MapPin size={9} /> Viewing
                      </span>
                    )}
                    <span className="text-[9px] text-faint">Observation {i + 1}</span>
                  </div>
                  <span className="text-[10px] text-faint shrink-0">{formatDate(point.submittedAt)}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted">
                  <span>{point.source}</span>
                  <span>•</span>
                  <span>Burden: {point.burdenLevel}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
