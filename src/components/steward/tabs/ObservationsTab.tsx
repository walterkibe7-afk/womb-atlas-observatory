"use client";

import { ClipboardList } from "lucide-react";
import type { ObservationGroup } from "../types";

/** Observations tab: the structured responses, grouped by screen/section. */
export function ObservationsTab({ observations }: { observations: ObservationGroup[] }) {
  if (observations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20">
        <ClipboardList className="w-7 h-7 text-faint mb-2" />
        <p className="text-sm text-secondary">No structured responses</p>
        <p className="text-[11px] text-faint mt-1">This observation has no recorded answers yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {observations.map((group) => (
        <div key={group.screenId} className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm text-fg font-medium">{group.screenName}</h3>
            {group.section && (
              <span className="text-[10px] text-faint uppercase tracking-wider">{group.section}</span>
            )}
          </div>
          <dl className="space-y-2.5">
            {group.items.map((item) => (
              <div key={item.fieldId} className="grid grid-cols-2 gap-4">
                <dt className="text-xs text-muted">{item.label}</dt>
                <dd className="text-sm text-secondary">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
