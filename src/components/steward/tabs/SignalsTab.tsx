"use client";

import { Activity, Radar } from "lucide-react";
import type { SignalDetail, SourceSignal } from "../types";

// Confidence → dot + text colour (mirrors the Overview severity scale).
const confidenceStyle = (c: string) => {
  const s = c.toLowerCase();
  if (s === "high") return { dot: "bg-red-500", text: "text-red-500", label: "High" };
  if (s === "moderate") return { dot: "bg-[var(--color-brand-orange)]", text: "text-[var(--color-brand-orange)]", label: "Moderate" };
  return { dot: "bg-[var(--color-brand-green)]", text: "text-[var(--color-brand-green)]", label: "Low" };
};

/** Signals tab: the detected patterns (meaning) + traceable source signals. */
export function SignalsTab({
  signals,
  sourceSignals,
}: {
  signals: SignalDetail[];
  sourceSignals: SourceSignal[];
}) {
  if (signals.length === 0 && sourceSignals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20">
        <Radar className="w-7 h-7 text-faint mb-2" />
        <p className="text-sm text-secondary">No signals detected</p>
        <p className="text-[11px] text-faint mt-1">The intelligence run didn’t surface any patterns.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {signals.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] text-[var(--color-brand-gold)] uppercase tracking-wider">Meaning & Patterns</p>
          {signals.map((sig) => {
            const style = confidenceStyle(sig.confidence);
            return (
              <div key={sig.id} className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${style.dot}`}></div>
                    <span className="text-sm text-fg">{sig.name}</span>
                    {sig.role && (
                      <span className="text-[9px] text-muted border border-[var(--color-border)] px-1.5 py-0.5 rounded uppercase">
                        {sig.role}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-faint">{sig.domain}</span>
                    <span className={`text-xs ${style.text}`}>{style.label}</span>
                  </div>
                </div>
                {sig.meaning && <p className="text-sm text-secondary leading-relaxed">{sig.meaning}</p>}
                {sig.atlasNote && (
                  <p className="text-xs text-muted mt-2 pt-2 border-t border-[var(--color-border)]">{sig.atlasNote}</p>
                )}
                {sig.watchOverTime && (
                  <p className="text-[11px] text-[var(--color-brand-gold)] mt-2">Watch over time: {sig.watchOverTime}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {sourceSignals.length > 0 && (
        <div>
          <p className="text-[10px] text-[var(--color-brand-gold)] uppercase tracking-wider mb-3">
            Source Signals — traceable to fields
          </p>
          <div className="space-y-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4">
            {sourceSignals.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-secondary">
                  <Activity size={12} className="text-[var(--color-brand-gold)]" />
                  {s.label}
                </span>
                <span className="font-mono text-[10px] text-faint">{s.fieldId}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
