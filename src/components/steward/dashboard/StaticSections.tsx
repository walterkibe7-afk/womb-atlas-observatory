// Static design sections for the steward dashboard. These match the Atlas
// Steward Portal design but are NOT yet wired to real data — they render fixed
// sample values for this iteration and will be made dynamic in a later pass.
//
// The data-backed sections live elsewhere: metrics, queue, record detail,
// signal snapshot and emerging concepts in the page itself; growth, return rate,
// meaning signals and the reviewer actions row in their own files alongside
// this one.
// Exception: DataQualityCard below is already wired to live review counts.

import { TriangleAlert, Info, ShieldCheck, UserRoundCog, Stethoscope, Flower } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, SectionCard, SectionLink, Donut, Badge } from "@/components/ui";

/* ── Recent Alerts ────────────────────────────────────────────────────────── */

const ALERTS = [
  { icon: TriangleAlert, color: "text-danger", title: "High transcription failure rate", meta: "East Africa region", time: "1h ago" },
  { icon: Info, color: "text-brand-gold", title: "Comparison prompt update", meta: "New version deployed", time: "3h ago" },
];

export function RecentAlerts() {
  return (
    <SectionCard title="Recent Alerts" action={<SectionLink>View all →</SectionLink>}>
      <div className="flex flex-col gap-2.5">
        {ALERTS.map((a) => (
          <div key={a.title} className="flex gap-2.5 items-start">
            <a.icon size={16} className={`${a.color} mt-0.5 shrink-0`} />
            <div className="flex-1">
              <div className="text-[13px] text-secondary">{a.title}</div>
              <div className="text-[11px] text-faint">{a.meta}</div>
            </div>
            <div className="text-[11px] text-faint">{a.time}</div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/* ── Data Quality Donut ───────────────────────────────────────────────────── */

/**
 * Share of decided records that were approved: approved / (approved + rejected).
 * Flagged records are still open questions, so they are deliberately excluded —
 * only terminal accept/reject decisions feed the ratio.
 */
export function DataQualityCard({
  approved,
  rejected,
  className,
}: {
  approved?: number;
  rejected?: number;
  className?: string;
}) {
  const decided = (approved ?? 0) + (rejected ?? 0);
  const hasData = approved != null && rejected != null && decided > 0;
  const percent = hasData ? Math.round((approved / decided) * 100) : 0;

  const tier = !hasData
    ? { label: "No decisions yet", color: "var(--color-border-subtle)" }
    : percent >= 90
      ? { label: "High Quality", color: "var(--color-brand-gold)" }
      : percent >= 70
        ? { label: "Moderate Quality", color: "var(--color-brand-orange)" }
        : { label: "Low Quality", color: "var(--color-danger)" };

  // The card is the last panel in the dashboard's right column; callers pass
  // `flex-1` so it absorbs the column's leftover height instead of leaving a
  // gap. The donut row grows with it and stays vertically centred.
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="text-right mb-1.5"><SectionLink>View details →</SectionLink></div>
      <div className="flex-1 flex items-center gap-4 flex-wrap justify-center content-center">
        <Donut percent={percent} size={140} thickness={14} color={tier.color}>
          <div className="text-[9px] text-faint max-w-[70px] leading-tight">Record Approval Rate</div>
          <div className="font-serif text-[26px] text-fg">{hasData ? `${percent}%` : "—"}</div>
        </Donut>
        <div className="text-center">
          <Badge variant={hasData ? "gold" : "neutral"}>{tier.label}</Badge>
          {hasData && (
            <div className="text-[11px] text-faint mt-2">
              {approved} approved · {rejected} rejected
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ── Footer ───────────────────────────────────────────────────────────────── */

const FOOTER_ITEMS = [
  { icon: ShieldCheck, title: "Secure. Private. Trusted.", sub: "All data is encrypted and governed by consent." },
  { icon: UserRoundCog, title: "You are in control.", sub: "We do not provide medical advice." },
  { icon: Stethoscope, title: "Observations are not diagnoses.", sub: "Context matters." },
  { icon: Flower, title: "Building the world's first observatory", sub: "for women's health." },
];

export function PortalFooter() {
  return (
    <footer className="flex flex-wrap gap-5 items-center mt-6 pt-5 border-t border-[var(--color-border-subtle)]">
      {FOOTER_ITEMS.map((f) => (
        <div key={f.title} className="flex items-center gap-2.5 flex-1 min-w-[200px]">
          <span className="rounded-full border border-[var(--color-border-brand)] text-brand-gold flex items-center justify-center shrink-0" style={{ width: 34, height: 34 }}>
            <f.icon size={16} />
          </span>
          <div>
            <div className="text-[13px] text-secondary">{f.title}</div>
            <div className="text-[11px] text-faint">{f.sub}</div>
          </div>
        </div>
      ))}
      <SectionLink className="text-[13px] shrink-0">Learn more about our data &amp; methods →</SectionLink>
    </footer>
  );
}
