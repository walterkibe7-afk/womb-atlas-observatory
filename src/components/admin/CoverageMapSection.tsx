"use client";

import type { ObservatoryCoverageStats } from "@/app/(admin)/admin/types";
import { COVERAGE_BANDS } from "@/lib/admin/country-geo";
import { SectionCard, SectionLink } from "@/components/ui";
import { CoverageWorldMap } from "./CoverageWorldMap";

export function CoverageMapSection({
  coverageStats,
}: {
  coverageStats: ObservatoryCoverageStats | null;
}) {
  const countryList = coverageStats?.countryList ?? [];

  return (
    <SectionCard
      title="Observatory Coverage Map"
      titleVariant="display"
      action={<SectionLink href="/insights">View full map →</SectionLink>}
      className="col-span-12 xl:col-span-4"
    >
      <div id="coverage-map" className="grid grid-cols-[104px_1fr] gap-3">
        {/* Sequential ramp (magnitude): one hue, light → dark. "No Data" sits
            outside the ramp as a neutral, so absence never reads as a low value. */}
        <ul className="space-y-2.5 pt-1 text-xs">
          {COVERAGE_BANDS.map(({ label, color }) => (
            <li key={label} className="flex items-center gap-2 text-muted">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
              {label}
            </li>
          ))}
        </ul>

        <div className="h-52 overflow-hidden rounded-[var(--radius-panel)]">
          <CoverageWorldMap countryList={countryList} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] p-3">
          <p className="text-[11px] font-semibold text-brand-gold">Coverage Insights</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            We are strongest in East Africa and South Asia. Opportunity to grow in Central Asia, Pacific
            Islands, and parts of Latin America.
          </p>
        </div>
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] p-3">
          <p className="text-[11px] font-semibold text-brand-gold">Regions Needing Growth</p>
          <p className="mt-1 font-serif text-[28px] leading-none text-fg">
            {coverageStats?.regionsNeedingGrowth.length ?? 0}
          </p>
          <p className="mt-2 text-[11px] text-subtle">Under-represented languages</p>
          <p className="mt-1 font-serif text-[28px] leading-none text-fg">
            {coverageStats?.underRepresentedLanguages.length ?? 0}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
