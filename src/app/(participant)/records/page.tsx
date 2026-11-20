"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Loader2, Network, Sparkles, ArrowRight, FileText } from "lucide-react";
import { AtlasConstellationMap } from "@/components/observation/atlas-constellation-map";
import { AtlasRecordDetail } from "@/components/observation/atlas-record-detail";
import { burdenBadgeClass, burdenLabel } from "@/components/observation/burden-style";
import type { RecordResult } from "@/app/(participant)/observation/screens/ScreenRenderer";
import type { ParticipantRecordListItem } from "@/lib/observation/summary";
import { useUiStrings } from "@/lib/observation/ui-strings-context";
import { useLocale } from "@/lib/observation/use-locale";
import { domainLabel } from "@/components/participant/signal-domains";

export default function MyRecords() {
  const strings = useUiStrings();
  const locale = useLocale();
  const [records, setRecords] = useState<ParticipantRecordListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/participant/records");
        const data = await res.json();
        if (!active) return;
        const list = (data?.records ?? []) as ParticipantRecordListItem[];
        setRecords(list);
        setActiveId(list[0]?.observationId ?? null);
      } catch {
        if (active) setRecords([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.recordId.toLowerCase().includes(q) ||
        r.createdAt.toLowerCase().includes(q) ||
        (r.archetype ?? "").toLowerCase().includes(q),
    );
  }, [records, query]);

  const active = records.find((r) => r.observationId === activeId) ?? null;
  const payload = (active?.recordPayload ?? null) as RecordResult | null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 space-y-4">
        <Loader2 className="animate-spin text-[var(--color-brand-gold)]" size={32} />
        <p className="text-muted text-sm">{strings.recordsLoading}</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-10 text-center space-y-4">
          <Sparkles className="mx-auto text-[var(--color-brand-gold)]" size={32} />
          <h1 className="text-2xl font-serif text-fg">{strings.recordsEmptyTitle}</h1>
          <p className="text-sm text-muted max-w-md mx-auto">
            {strings.recordsEmptyBody}
          </p>
          <Link
            href="/observation"
            className="inline-flex items-center gap-2 border border-[var(--color-brand-gold)] text-[var(--color-brand-gold)] px-6 py-2.5 rounded-full text-sm hover:bg-[var(--color-brand-gold)] hover:text-on-gold transition-colors"
          >
            {strings.recordsBeginFirstObservation} <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 pb-20 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-serif text-fg mb-2 flex items-center">
          {strings.recordsTitle} <span className="text-[var(--color-brand-gold)] ml-2">✧</span>
        </h1>
        <p className="text-muted text-sm">{strings.recordsSubtitle}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Record list */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={strings.recordsSearchPlaceholder}
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl pl-9 pr-4 py-2.5 text-sm text-fg focus:outline-none focus:border-[var(--color-brand-gold)]"
            />
          </div>

          <div className="space-y-3">
            {filtered.map((record) => {
              const isActive = record.observationId === activeId;
              return (
                <button
                  key={record.observationId}
                  onClick={() => setActiveId(record.observationId)}
                  className={`w-full text-left border rounded-2xl p-4 transition-colors ${
                    isActive
                      ? "border-[var(--color-brand-gold)] bg-[var(--color-surface-hover)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand-gold)]/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-fg">{record.createdAt}</span>
                    {record.burden && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${burdenBadgeClass(record.burden)}`}>
                        {burdenLabel(record.burden, strings)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-brand-gold)] font-mono mb-2">{record.recordId}</p>
                  <div className="flex items-center gap-2 text-[11px] text-faint">
                    <FileText size={12} />
                    <span>{record.signalCount} {strings.recordsSignalsValidated}</span>
                    {record.flowKey === "atlas_checkin" && (
                      <span className="ml-auto rounded bg-[var(--color-brand-purple-light)]/30 px-1.5 py-0.5 text-[9px] text-[var(--color-brand-gold)]">
                        {strings.recordsCheckInBadge}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-faint text-center py-6">{strings.recordsNoMatch}</p>
            )}
          </div>
        </div>

        {/* Record detail */}
        <div className="lg:col-span-2 space-y-6">
          {active && (
            <div className="flex items-center justify-between border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] px-6 py-4">
              <div>
                <p className="text-sm text-fg font-mono">{active.recordId}</p>
                <p className="text-xs text-faint">{active.createdAt}</p>
              </div>
              <div className="inline-flex items-center gap-2 bg-brand-green/15 text-brand-green px-3 py-1 rounded-full text-xs border border-brand-green/40">
                <Network size={12} />
                <span>{strings.recordsAtlasObserved}</span>
              </div>
            </div>
          )}

          {payload?.constellationNodes?.length ? (
            <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6">
              <p className="font-mono text-[10px] text-[var(--color-brand-gold)] tracking-widest uppercase mb-4">{strings.recordsConstellationTitle}</p>
              <AtlasConstellationMap nodes={payload.constellationNodes} />
            </div>
          ) : (
            <div className="border border-dashed border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6">
              <p className="text-sm text-muted">
                {strings.recordsConstellationUnavailable}
              </p>
              {active?.summary && <p className="mt-3 text-sm text-muted leading-relaxed">{active.summary}</p>}
            </div>
          )}

          {payload ? (
            <AtlasRecordDetail record={payload} />
          ) : (
            active && (
              <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6 space-y-3">
                <p className="font-mono text-[10px] text-[var(--color-brand-gold)] tracking-widest uppercase">{strings.recordsObservedDomains}</p>
                {active.observedPatterns.length > 0 ? (
                  active.observedPatterns.map((group) => (
                    <div key={group.domain}>
                      <p className="text-sm text-fg">{domainLabel(group.domain, locale)}</p>
                      <p className="text-xs text-faint">{group.signals.join(", ")}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted">{strings.recordsNoStrongPatterns}</p>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
