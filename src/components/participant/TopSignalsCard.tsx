"use client";

import { ArrowRight, Circle, Plus, Repeat, Dot } from "lucide-react";
import type { SignalHighlight, SignalStatus } from "@/lib/observation/summary";
import { SectionLink } from "@/components/ui";
import { DOMAIN_ICON, domainColor, domainLabel } from "./signal-domains";
import { InsightCard } from "./InsightCard";
import { useLocale } from "@/lib/observation/use-locale";
import { useUiStrings } from "@/lib/observation/ui-strings-context";
import type { UiStrings } from "@/lib/observation/ui-strings";
import { v43Text } from "@/lib/observation/intelligence/v43/v43-i18n";

// Three states, because two records is all the comparison there is: a signal
// either carried over, or it didn't, or there's nothing to compare to yet.
// "Increasing"/"Improving" are deliberately absent — a signal is present or it
// isn't, so there is no magnitude here to have gone up or down.
function statusMetaFor(
  strings: UiStrings,
): Record<SignalStatus, { label: string; className: string; Icon: typeof Circle }> {
  return {
    persistent: { label: strings.dashboardStatusPersistent, className: "text-brand-orange border-brand-orange/40", Icon: Repeat },
    new: { label: strings.dashboardStatusNew, className: "text-brand-gold border-border-brand", Icon: Plus },
    baseline: { label: strings.confidenceBaseline, className: "text-subtle border-border-subtle", Icon: Circle },
  };
}

/** One filled dot per record the signal appeared in, oldest → newest. */
function PresenceTrack({ presence, color }: { presence: boolean[]; color: string }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {presence.map((on, i) => (
        <span
          key={i}
          className="h-1.75 w-1.75 rounded-full"
          style={on ? { background: color } : { border: `1px solid ${color}`, opacity: 0.45 }}
        />
      ))}
    </span>
  );
}

/**
 * "Your Top Signals" — the named AIKB signals the participant's latest Atlas
 * Record actually fired, ordered by persistence then domain strength.
 *
 * These are register entries ("Severe Pain Burden", "Sleep Adaptation"), not the
 * six constellation domains: those are rolled up from *patterns*, so they can't
 * show which signals fired, and one of them ("Cycle") has no ontology pattern
 * feeding it at all and therefore always scores zero. The domain view still
 * exists as the Signal Evolution chart on the Timeline page, which is where a
 * per-domain trend over time belongs.
 */
export function TopSignalsCard({ signals, max = 6 }: { signals: SignalHighlight[]; max?: number }) {
  const locale = useLocale();
  const strings = useUiStrings();
  const statusMeta = statusMetaFor(strings);
  const rows = signals.slice(0, max);
  const total = signals.length;

  return (
    <InsightCard
      step={3}
      title={strings.dashboardTopSignalsTitle}
      action={
        <SectionLink href="/records" className="inline-flex items-center gap-1.5">
          {strings.dashboardViewAll} {total > 0 && total} <ArrowRight size={13} />
        </SectionLink>
      }
      // @container: the presence track drops out when this card is narrow.
      className="@container"
    >
      {rows.length === 0 ? (
        <div className="flex-1 min-h-40 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border px-4">
          <p className="text-sm text-muted">{strings.dashboardSignalsEmpty}</p>
          <p className="text-xs text-subtle mt-1">{strings.dashboardOnceFirstRecord}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {rows.map((signal) => {
              const Icon = DOMAIN_ICON[signal.domain] ?? Dot;
              const meta = statusMeta[signal.status];
              const StatusIcon = meta.Icon;
              const color = domainColor(signal.domain);
              return (
                // The signal name is the only flexible cell — the track and pill
                // are fixed-width — so min-w-0 lets it truncate rather than push
                // the pill out of a narrow column.
                <div key={signal.signalId} className="flex items-center gap-3">
                  <Icon size={20} strokeWidth={1.6} className="shrink-0" style={{ color }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] text-fg/90 truncate">
                      {v43Text(signal.signalId, "label", signal.name, locale)}
                    </span>
                    <span className="block text-subtle text-[11px] truncate">
                      {domainLabel(signal.domain, locale)}
                      {signal.evidenceCount > 1 && ` · ${signal.evidenceCount} ${strings.dashboardObservationsSuffix}`}
                    </span>
                  </span>
                  {signal.recordTotal > 1 && (
                    <span
                      className="shrink-0 hidden @sm:flex items-center gap-2"
                      title={`${strings.dashboardAppearedInPrefix} ${signal.recordCount} ${strings.dashboardAppearedInMiddle} ${signal.recordTotal} ${strings.dashboardAppearedInSuffix}`}
                    >
                      <PresenceTrack presence={signal.presence} color={color} />
                    </span>
                  )}
                  <span
                    className={`flex items-center gap-1.5 shrink-0 rounded-full border px-2.5 py-1 text-[12px] ${meta.className}`}
                  >
                    <StatusIcon size={12} strokeWidth={1.8} />
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-faint text-[12px] leading-relaxed mt-auto pt-3.5 border-t border-border-subtle">
            {strings.dashboardSignalsDisclaimer}
          </p>
        </>
      )}
    </InsightCard>
  );
}
