"use client";

import { useMemo } from "react";
import { CircleCheck } from "lucide-react";
import type { DataQualityOverview } from "@/app/(admin)/admin/types";
import { toPercent } from "@/app/(admin)/admin/utils";
import { Badge, Donut, SectionCard, SectionLink } from "@/components/ui";

export function DataQualitySection({
  qualityStats,
}: {
  qualityStats: DataQualityOverview | null;
}) {
  const qualityScore = useMemo(() => {
    if (!qualityStats) return 0;
    return (
      (qualityStats.completeness +
        qualityStats.consistency +
        qualityStats.validity +
        (100 - qualityStats.duplicationRate) +
        (100 - qualityStats.missingData)) /
      5
    );
  }, [qualityStats]);

  const qualityRows: { label: string; value: number; highIsGood: boolean }[] = [
    { label: "Completeness", value: qualityStats?.completeness ?? 0, highIsGood: true },
    { label: "Consistency", value: qualityStats?.consistency ?? 0, highIsGood: true },
    { label: "Validity", value: qualityStats?.validity ?? 0, highIsGood: true },
    { label: "Duplicate Rate", value: qualityStats?.duplicationRate ?? 0, highIsGood: false },
    { label: "Missing Data", value: qualityStats?.missingData ?? 0, highIsGood: false },
  ];

  return (
    <SectionCard
      title="Data Quality Overview"
      titleVariant="display"
      action={<SectionLink href="/admin/status">View details →</SectionLink>}
      className="col-span-12 xl:col-span-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_170px]">
        <ul className="rounded-[var(--radius-panel)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] p-3 text-sm">
          {qualityRows.map(({ label, value, highIsGood }) => {
            const healthy = highIsGood ? value >= 90 : value <= 3;
            const moderate = highIsGood ? value >= 75 : value <= 8;
            // Rating always ships as text beside the colour — never colour alone.
            const status = healthy ? "High" : moderate ? "Moderate" : "Low";
            const statusColor = healthy
              ? "text-brand-gold"
              : moderate
                ? "text-brand-orange"
                : "text-danger";

            return (
              <li
                key={label}
                className="flex items-center justify-between border-b border-[var(--color-border-subtle)] py-1.5 last:border-b-0"
              >
                <span className="flex items-center gap-2 text-secondary">
                  <CircleCheck size={14} className="text-brand-gold" />
                  {label}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-fg">{toPercent(value)}</span>
                  <span className={`text-[11px] ${statusColor}`}>{status}</span>
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-panel)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] p-3">
          <Donut
            percent={qualityScore}
            rounded
            size={130}
            thickness={11}
            color="var(--color-brand-gold)"
            track="var(--color-border-subtle)"
          >
            <p className="text-[10px] leading-tight text-subtle">
              Overall Data
              <br />
              Quality Score
            </p>
            <p className="mt-1 font-serif text-[30px] leading-none text-fg">
              {Math.round(qualityScore)}%
            </p>
          </Donut>
          <Badge variant="gold">
            {qualityScore >= 85 ? "High Quality" : qualityScore >= 70 ? "Moderate Quality" : "Needs Improvement"}
          </Badge>
        </div>
      </div>
    </SectionCard>
  );
}
