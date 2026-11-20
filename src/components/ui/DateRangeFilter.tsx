"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { RANGE_OPTIONS, rangeLabel, type DateRangeValue, type RangeKey } from "@/lib/date-range";

/**
 * Header date filter: relative presets plus a custom start/end window. The
 * presets and their server-side meaning live in `@/lib/date-range`, so the label
 * on screen and the cutoff the API applies can never drift apart.
 *
 * Picking a preset applies immediately; "Custom range…" opens two day inputs and
 * waits for Apply, so a half-typed date never triggers a fetch.
 */
export function DateRangeFilter({
  value,
  onChange,
  className,
  align = "right",
}: {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  className?: string;
  /** Which edge the preset list hangs from. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(value.key === "custom");
  // Draft bounds, only committed on Apply.
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? "");
  const root = useRef<HTMLDivElement>(null);

  // Dismiss on outside click / Escape. Uses a listener rather than a fixed
  // overlay so it keeps working inside containers that set a transform (which
  // would re-anchor a `fixed` element to the container instead of the viewport).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // An end date before the start date is the one combination worth blocking —
  // everything else (one-sided windows, empty) is a legitimate query.
  const reversed = !!from && !!to && from > to;
  const canApply = (!!from || !!to) && !reversed;

  function pick(key: RangeKey) {
    if (key === "custom") {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    setOpen(false);
    onChange({ key });
  }

  function applyCustom() {
    if (!canApply) return;
    setOpen(false);
    onChange({ key: "custom", from: from || undefined, to: to || undefined });
  }

  const inputClass =
    "w-full rounded-lg bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)] px-2 py-1.5 text-xs text-secondary outline-none focus:border-brand-gold";

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-[10px] bg-[var(--color-surface-inset)] border border-[var(--color-border)] text-[13px] text-secondary hover:border-brand-gold transition-colors"
      >
        <Calendar size={16} className="text-brand-gold" />
        <span>{rangeLabel(value)}</span>
        <ChevronDown
          size={15}
          className={cn("text-subtle transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute mt-2 z-30 min-w-[200px] rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          <ul role="listbox">
            {RANGE_OPTIONS.map((o) => {
              const selected = value.key === o.key;
              return (
                <li key={o.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => pick(o.key)}
                    className={cn(
                      "w-full text-left px-4 py-2 text-xs transition-colors hover:bg-[var(--color-surface-hover)]",
                      selected || (o.key === "custom" && customOpen)
                        ? "text-brand-gold"
                        : "text-secondary",
                    )}
                  >
                    {o.label}
                  </button>
                </li>
              );
            })}
          </ul>

          {customOpen && (
            <div className="border-t border-[var(--color-border-subtle)] mt-1 pt-2.5 px-3 pb-2.5 w-[230px]">
              <label className="block text-[11px] text-faint mb-1">Start date</label>
              <input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className={inputClass}
                style={{ colorScheme: "dark" }}
              />
              <label className="block text-[11px] text-faint mt-2 mb-1">End date</label>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className={inputClass}
                style={{ colorScheme: "dark" }}
              />

              <p className="text-[11px] text-faint mt-2">
                {reversed
                  ? "End date is before the start date."
                  : "Leave one side empty for an open-ended window."}
              </p>

              <div className="flex justify-end gap-2 mt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setFrom("");
                    setTo("");
                  }}
                  className="px-2.5 py-1.5 text-[11px] text-secondary hover:text-fg transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={applyCustom}
                  disabled={!canApply}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[11px] border transition-colors",
                    canApply
                      ? "bg-accent-strong text-on-accent border-transparent hover:opacity-90"
                      : "border-[var(--color-border-subtle)] text-faint cursor-not-allowed",
                  )}
                >
                  Apply
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
