"use client";

import { Sparkles, Heart, FileText, MessageSquare, Clock, Pencil, type LucideIcon } from "lucide-react";
import type { TimelineEvent, TimelineEventType } from "@/lib/observation/summary";
import { cn } from "@/lib/cn";
import { useUiStrings } from "@/lib/observation/ui-strings-context";

export const EVENT_ICON: Record<TimelineEventType, LucideIcon> = {
  first_observation: Sparkles,
  reflection_generated: Heart,
  record_created: FileText,
  checkin_completed: MessageSquare,
  observation_edited: Pencil,
  next_checkin: Clock,
};

/**
 * Vertical journey timeline used by the dashboard's "Atlas Timeline" mini-card.
 * Pass `max` to cap the number of rows (dashboard shows the most recent handful).
 */
export function TimelineEventList({
  events,
  max,
  order = "desc",
}: {
  events: TimelineEvent[];
  max?: number;
  order?: "asc" | "desc";
}) {
  const sorted = [...events].sort((a, b) => {
    const diff = new Date(a.iso).getTime() - new Date(b.iso).getTime();
    return order === "desc" ? -diff : diff;
  });
  const shown = typeof max === "number" ? sorted.slice(0, max) : sorted;
  const strings = useUiStrings();

  if (!shown.length) {
    return (
      <p className="text-sm text-muted py-6 text-center">
        {strings.dashboardJourneyEventsEmpty}
      </p>
    );
  }

  return (
    <ol className="relative">
      <span aria-hidden="true" className="absolute left-23.5 top-5 bottom-5 w-px bg-border-strong" />
      {shown.map((event, index) => {
        const Icon = EVENT_ICON[event.type] ?? Sparkles;
        const isLast = index === shown.length - 1;
        return (
          <li key={event.id} className={cn("relative flex gap-3.5 items-start", !isLast && "mb-5")}>
            <span className="w-18 shrink-0 pt-3 text-right text-[11px] tracking-wide text-subtle">{event.date}</span>
            <span
              className={cn(
                "relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border",
                event.pending
                  ? "border-dashed border-[1.5px] border-border-brand bg-surface-inset text-muted"
                  : "border-border-brand bg-surface-inset text-brand-gold",
              )}
            >
              <Icon size={19} strokeWidth={1.6} className="block" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className={cn("text-[15px] font-semibold", event.pending ? "text-muted" : "text-fg")}>
                {event.title}
              </p>
              <p className="text-[13px] text-subtle">{event.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
