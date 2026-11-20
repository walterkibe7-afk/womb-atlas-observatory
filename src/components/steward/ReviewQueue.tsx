"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, AlertTriangle, Inbox, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, SeverityTag, Badge } from "@/components/ui";
import type { StewardRecord } from "./types";

// ---------------------------------------------------------------------------
// Queue filters. Purely client-side over the records already loaded for this
// status — the queue is one page of records, so there is nothing to refetch.
// Every filter reads a field straight off the StewardRecord DTO.
// ---------------------------------------------------------------------------

const ALL = "all";

type FilterKey = "priority" | "region" | "topic" | "type";

type FilterDef = {
  key: FilterKey;
  allLabel: string;
  /** The record's value for this filter, or null when it has none. */
  value: (r: StewardRecord) => string | null;
};

const FILTER_DEFS: FilterDef[] = [
  { key: "priority", allLabel: "All Priorities", value: (r) => r.priority },
  { key: "region", allLabel: "All Regions", value: (r) => r.contributor.country },
  { key: "topic", allLabel: "All Topics", value: (r) => r.topic },
  { key: "type", allLabel: "All Record Types", value: (r) => r.source },
];

type FilterState = Record<FilterKey, string>;

const NO_FILTERS: FilterState = { priority: ALL, region: ALL, topic: ALL, type: ALL };

const PRIORITY_ORDER = ["High", "Medium", "Low"];

function matches(record: StewardRecord, filters: FilterState) {
  return FILTER_DEFS.every((def) => {
    const selected = filters[def.key];
    return selected === ALL || def.value(record) === selected;
  });
}

/**
 * Options for one filter, derived from the records that pass the *other*
 * filters — so a combination that would yield an empty list is never offered.
 */
function optionsFor(def: FilterDef, records: StewardRecord[], filters: FilterState) {
  const others = { ...filters, [def.key]: ALL };
  const values = records
    .filter((r) => matches(r, others))
    .map(def.value)
    .filter((v): v is string => !!v && v.trim().length > 0);
  const unique = Array.from(new Set(values));
  return def.key === "priority"
    ? unique.sort((a, b) => PRIORITY_ORDER.indexOf(a) - PRIORITY_ORDER.indexOf(b))
    : unique.sort((a, b) => a.localeCompare(b));
}

function formatSubmitted(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

type ReviewQueueProps = {
  records: StewardRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  error: string | null;
  className?: string;
  listClassName?: string;
};

/** Left-hand Review Queue: the list of Atlas Records awaiting steward review. */
export function ReviewQueue({
  records,
  selectedId,
  onSelect,
  loading,
  error,
  className,
  listClassName = "max-h-[460px]",
}: ReviewQueueProps) {
  const [filters, setFilters] = useState<FilterState>(NO_FILTERS);
  const [openFilter, setOpenFilter] = useState<FilterKey | null>(null);

  const visible = useMemo(() => records.filter((r) => matches(r, filters)), [records, filters]);
  const filtered = visible.length !== records.length;

  // Stable identity so QueueFilter's dismiss listener isn't re-bound each render.
  const closeFilters = useCallback(() => setOpenFilter(null), []);

  // Applying a filter can hide the selected record, which would leave the
  // detail panel showing something that is no longer in the list — move the
  // selection to the first remaining record when that happens.
  function applyFilters(next: FilterState) {
    setFilters(next);
    setOpenFilter(null);
    const nextVisible = records.filter((r) => matches(r, next));
    if (nextVisible.length > 0 && !nextVisible.some((r) => r.id === selectedId)) {
      onSelect(nextVisible[0].id);
    }
  }

  return (
    <Card className={cn("flex flex-col", className)}>
      <h2 className="font-serif text-[14px] font-semibold uppercase tracking-[0.08em] text-brand-gold mb-3">
        Review Queue ({visible.length})
      </h2>

      <div className="flex flex-wrap gap-2 mb-3.5">
        {FILTER_DEFS.map((def) => (
          <QueueFilter
            key={def.key}
            def={def}
            selected={filters[def.key]}
            options={optionsFor(def, records, filters)}
            open={openFilter === def.key}
            onToggle={() => setOpenFilter((cur) => (cur === def.key ? null : def.key))}
            onClose={closeFilters}
            onSelect={(value) => applyFilters({ ...filters, [def.key]: value })}
          />
        ))}
      </div>

      <div className={cn("flex flex-col gap-1 overflow-y-auto flex-1 [&::-webkit-scrollbar]:hidden", listClassName)}>
        {loading && (
          <div className="h-full min-h-[160px] flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-brand-gold animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center px-4">
            <AlertTriangle className="w-6 h-6 text-danger mb-2" />
            <p className="text-xs text-muted">{error}</p>
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center px-4">
            <Inbox className="w-7 h-7 text-faint mb-2" />
            {records.length === 0 ? (
              <>
                <p className="text-sm text-secondary">No records to review</p>
                <p className="text-[11px] text-faint mt-1">Completed observations will appear here.</p>
              </>
            ) : (
              <>
                <p className="text-sm text-secondary">No records match these filters</p>
                <button
                  onClick={() => applyFilters(NO_FILTERS)}
                  className="text-[11px] text-brand-gold mt-1.5 hover:underline"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        )}

        {!loading && !error && visible.map((item) => {
          const active = item.id === selectedId;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={cn(
                "w-full text-left p-3 rounded-[10px] transition-colors",
                active
                  ? "bg-nav-active border border-[var(--color-border-active)] border-l-[3px] border-l-brand-purple"
                  : "border border-transparent hover:bg-[var(--color-surface-hover)]",
              )}
            >
              <div className="flex justify-between gap-2">
                <div>
                  <div className={cn("text-[13px] font-semibold", active ? "text-fg" : "text-secondary")}>
                    {item.displayId}
                  </div>
                  <div className="text-[11px] text-faint">Atlas Record</div>
                </div>
                <div className="text-right">
                  <div className={cn("text-[13px] font-semibold", active ? "text-fg" : "text-secondary")}>
                    {item.contributor.name}
                  </div>
                  <div className="text-[11px] text-muted">
                    {item.contributor.ageRange ? `${item.contributor.ageRange} · ` : ""}
                    {item.contributor.country ?? "—"}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 mt-2">
                <Badge variant={active ? "accent" : "neutral"} className="text-[11px] px-2 py-0.5">
                  {item.topic}
                </Badge>
                <SeverityTag level={item.priority} />
              </div>
              <div className="text-[11px] text-faint mt-2">Submitted: {formatSubmitted(item.submittedAt)}</div>
            </button>
          );
        })}
      </div>

      {!loading && !error && records.length > 0 && (
        <div className="mt-3.5 pt-3.5 border-t border-[var(--color-border-subtle)] flex items-center justify-between gap-2 text-xs text-faint">
          {filtered ? (
            <button onClick={() => applyFilters(NO_FILTERS)} className="text-brand-gold hover:underline">
              Clear filters
            </button>
          ) : (
            <span />
          )}
          <span>
            Showing {visible.length} of {records.length}
          </span>
        </div>
      )}
    </Card>
  );
}

/** One queue filter: a chip that opens a single-select list of its values. */
function QueueFilter({
  def,
  selected,
  options,
  open,
  onToggle,
  onClose,
  onSelect,
}: {
  def: FilterDef;
  selected: string;
  options: string[];
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const active = selected !== ALL;
  const disabled = options.length === 0 && !active;

  // Dismiss on an outside click or Escape. A `fixed inset-0` overlay can't be
  // used here: the enclosing Card animates with a transform on hover, which
  // makes fixed children resolve against the card instead of the viewport.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "flex items-center gap-1.5 max-w-[180px] text-xs px-2.5 py-1.5 rounded-lg border transition-colors",
          active
            ? "text-brand-gold bg-nav-active border-[var(--color-border-active)]"
            : "text-secondary bg-[var(--color-surface-inset)] border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-hover)]",
          disabled && "opacity-50 cursor-not-allowed hover:bg-[var(--color-surface-inset)]",
        )}
      >
        {/* Topic values can be long pattern names — keep the chip compact. */}
        <span className="truncate">{active ? selected : def.allLabel}</span>
        <ChevronDown size={13} className={cn("shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 mt-1.5 z-20 min-w-[150px] max-h-56 overflow-auto rounded-[var(--radius-panel)] border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg"
        >
          {[ALL, ...options].map((value) => (
            <li key={value}>
              <button
                type="button"
                role="option"
                aria-selected={selected === value}
                onClick={() => onSelect(value)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-xs transition-colors hover:bg-[var(--color-surface-hover)]",
                  selected === value ? "text-brand-gold" : "text-secondary",
                )}
              >
                {value === ALL ? def.allLabel : value}
                {selected === value && <Check size={12} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
