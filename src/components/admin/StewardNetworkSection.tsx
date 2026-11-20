"use client";

import { useMemo } from "react";
import { Users } from "lucide-react";
import type { StewardNetworkStats } from "@/app/(admin)/admin/types";
import { numberFormatter } from "@/app/(admin)/admin/utils";
import { Donut, SectionCard, SectionLink, type DonutSegment } from "@/components/ui";

export function StewardNetworkSection({
  networkStats,
}: {
  networkStats: StewardNetworkStats | null;
}) {
  const networkSegments = useMemo(() => {
    const total = Math.max(networkStats?.activeStewards.value ?? 0, 1);
    const clinical = Math.round(total * 0.5);
    const language = Math.round(total * 0.3);
    const community = Math.round(total * 0.13);
    const regional = Math.max(total - clinical - language - community, 0);
    return { total, clinical, language, community, regional };
  }, [networkStats]);

  // Identity, not magnitude — fixed categorical hues, assigned in order.
  const segments: DonutSegment[] = [
    { label: "Clinical Reviewers", value: networkSegments.clinical, color: "var(--color-chart-1)" },
    { label: "Language Stewards", value: networkSegments.language, color: "var(--color-chart-2)" },
    { label: "Community Ambassadors", value: networkSegments.community, color: "var(--color-chart-3)" },
    { label: "Regional Leads", value: networkSegments.regional, color: "var(--color-chart-4)" },
  ];

  const totals = [
    { label: "Languages Covered", value: networkStats?.languagesCovered.value ?? 0 },
    { label: "Countries Covered", value: networkStats?.countriesCovered.value ?? 0 },
    { label: "Signals Curated", value: networkStats?.signalsCurated.value ?? 0 },
    { label: "Concepts Approved", value: networkStats?.conceptsApproved.value ?? 0 },
  ];

  return (
    <SectionCard
      title="Steward Network"
      titleVariant="display"
      action={<SectionLink href="/admin/access">View all stewards →</SectionLink>}
      className="col-span-12 xl:col-span-4"
    >
      <div id="steward-network" className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
        <Donut segments={segments} size={150} thickness={20} centerBg="var(--color-surface)">
          <Users size={20} className="text-brand-gold" />
          <p className="font-serif text-[38px] leading-none text-fg">
            {networkStats?.activeStewards.value ?? 0}
          </p>
          <p className="text-[11px] text-muted">Active Stewards</p>
        </Donut>

        {/* The legend is the donut's identity encoding — never colour alone. */}
        <ul className="space-y-2.5">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 text-secondary">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: segment.color }}
                />
                {segment.label}
              </span>
              <span className="font-medium text-fg">{segment.value}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[var(--color-border-subtle)] pt-4 sm:grid-cols-4">
        {totals.map(({ label, value }) => (
          <div
            key={label}
            className="rounded-[var(--radius-panel)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] p-2 text-center"
          >
            <p className="text-[11px] leading-tight text-subtle">{label}</p>
            <p className="mt-1 font-serif text-[28px] leading-none text-fg">
              {numberFormatter.format(value)}
            </p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
