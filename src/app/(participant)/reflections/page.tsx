"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Loader2, Sparkles, ArrowRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ReflectionChamber } from "@/components/observation/reflection-chamber-ui";
import { burdenBadgeClass, burdenLabel } from "@/components/observation/burden-style";
import type { ReflectionChamberIntelligence } from "@/lib/observation/intelligence/v43/reflection-chamber";
import type { RecordResult } from "@/app/(participant)/observation/screens/ScreenRenderer";
import type { ParticipantRecordListItem } from "@/lib/observation/summary";
import { useUiStrings } from "@/lib/observation/ui-strings-context";
import { useLocale } from "@/lib/observation/use-locale";
import { domainLabel } from "@/components/participant/signal-domains";

type Payload = RecordResult & { reflectionChamber?: ReflectionChamberIntelligence };
type ScoreMap = Record<string, number>;

function scoreMap(scores: { domain: string; score: number }[]): ScoreMap {
  const map: ScoreMap = {};
  for (const s of scores) map[s.domain] = s.score;
  return map;
}

export default function Reflections() {
  const strings = useUiStrings();
  const locale = useLocale();
  const [records, setRecords] = useState<ParticipantRecordListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/participant/records");
        const data = await res.json();
        if (!active) return;
        setRecords((data?.records ?? []) as ParticipantRecordListItem[]);
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

  // records are newest-first; the "previous" reflection is the next index.
  const active = records[activeIndex] ?? null;
  const previous = records[activeIndex + 1] ?? null;
  const payload = (active?.recordPayload ?? null) as Payload | null;

  const comparison = useMemo(() => {
    if (!active || !previous) return null;
    const now = scoreMap(active.constellationScores);
    const then = scoreMap(previous.constellationScores);
    const domains = [...new Set([...Object.keys(now), ...Object.keys(then)])];
    const deltas = domains
      .map((domain) => ({ domain, delta: (now[domain] ?? 0) - (then[domain] ?? 0) }))
      .filter((d) => d.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return { deltas, prevBurden: previous.burden, prevDate: previous.createdAt };
  }, [active, previous]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 space-y-4">
        <Loader2 className="animate-spin text-[var(--color-brand-gold)]" size={32} />
        <p className="text-muted text-sm">{strings.reflectionsLoading}</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-10 text-center space-y-4">
          <Sparkles className="mx-auto text-[var(--color-brand-gold)]" size={32} />
          <h1 className="text-2xl font-serif text-fg">{strings.reflectionsEmptyTitle}</h1>
          <p className="text-sm text-muted max-w-md mx-auto">
            {strings.reflectionsEmptyBody}
          </p>
          <Link
            href="/observation"
            className="inline-flex items-center gap-2 border border-[var(--color-brand-gold)] text-[var(--color-brand-gold)] px-6 py-2.5 rounded-full text-sm hover:bg-[var(--color-brand-gold)] hover:text-on-gold transition-colors"
          >
            {strings.reflectionsBeginFirstObservation} <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 pb-20 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-serif text-fg mb-2 flex items-center">
          {strings.reflectionsTitle} <span className="text-[var(--color-brand-gold)] ml-2">✧</span>
        </h1>
        <p className="text-muted text-sm">{strings.reflectionsSubtitle}</p>
      </header>

      {/* Non-Diagnostic Boundary */}
      <div className="flex items-start gap-3 border border-[var(--color-border)] bg-[var(--color-brand-purple-dark)] rounded-xl p-4">
        <ShieldCheck size={18} className="text-[var(--color-brand-gold)] shrink-0 mt-0.5" />
        <p className="text-xs text-muted leading-relaxed">
          <span className="text-[var(--color-brand-gold)] font-medium">{strings.reflectionsNonDiagnosticBoundary}</span>{" "}
          {payload?.reflectionContent
            ? payload.atlasRecordDetail?.disclaimer ?? strings.reflectionsDisclaimerFallback
            : strings.reflectionsDisclaimerFallback}
        </p>
      </div>

      {/* Reflection selector */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {records.map((record, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={record.observationId}
              onClick={() => setActiveIndex(index)}
              className={`shrink-0 text-left border rounded-xl px-4 py-3 min-w-[160px] transition-colors ${
                isActive
                  ? "border-[var(--color-brand-gold)] bg-[var(--color-surface-hover)]"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-brand-gold)]/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs text-fg">{record.createdAt}</span>
                {record.burden && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${burdenBadgeClass(record.burden)}`}>
                    {burdenLabel(record.burden, strings)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-faint truncate">{record.archetype ?? strings.reflectionsDefaultArchetype}</p>
            </button>
          );
        })}
      </div>

      {/* Compare to previous */}
      {comparison && (
        <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-5">
          <p className="font-mono text-[10px] text-[var(--color-brand-gold)] tracking-widest uppercase mb-3">
            {strings.reflectionsComparedTo} ({comparison.prevDate})
          </p>
          {comparison.deltas.length === 0 ? (
            <p className="text-sm text-muted">{strings.reflectionsScoresSteady}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {comparison.deltas.map(({ domain, delta }) => {
                const improving = delta < 0;
                const Icon = improving ? TrendingDown : delta > 0 ? TrendingUp : Minus;
                return (
                  <span
                    key={domain}
                    className={`inline-flex items-center gap-1.5 text-xs rounded-full border px-3 py-1 ${
                      improving
                        ? "text-brand-green border-brand-green/40 bg-brand-green/15"
                        : "text-brand-orange border-brand-orange/40 bg-brand-orange/15"
                    }`}
                  >
                    <Icon size={13} />
                    {domainLabel(domain, locale)} {improving ? "" : "+"}
                    {delta}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reflection chamber */}
      {payload?.reflectionChamber ? (
        <ReflectionChamber intelligence={payload.reflectionChamber} />
      ) : (
        <div className="border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)] p-6 space-y-5 text-fg leading-relaxed">
          {payload?.reflectionContent?.openingInsight && <p>{payload.reflectionContent.openingInsight}</p>}
          {payload?.reflectionContent?.whatExperienceMayMean && (
            <div>
              <h3 className="text-sm text-[var(--color-brand-gold)] mb-1">{strings.reflectionsWhatThisMayMean}</h3>
              <p>{payload.reflectionContent.whatExperienceMayMean}</p>
            </div>
          )}
          {!payload?.reflectionContent && (
            <p>{active?.summary ?? strings.reflectionsBeingPrepared}</p>
          )}
        </div>
      )}
    </div>
  );
}
