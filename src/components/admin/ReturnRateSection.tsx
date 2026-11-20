"use client";

import type { ObservationReturnRateStats } from "@/app/(admin)/admin/types";
import { numberFormatter, formatChange } from "@/app/(admin)/admin/utils";
import { Donut, SectionCard, SectionLink } from "@/components/ui";

export function ReturnRateSection({
  returnRateStats,
}: {
  returnRateStats: ObservationReturnRateStats | null;
}) {
  const rings = [
    { window: "30 Days", value: returnRateStats?.returnRate30Days ?? 0 },
    { window: "90 Days", value: returnRateStats?.returnRate90Days ?? 0 },
    { window: "180 Days", value: returnRateStats?.returnRate180Days ?? 0 },
  ];

  const trend = returnRateStats?.trend30Days ?? 0;

  return (
    <SectionCard
      title="Observation Return Rate"
      titleVariant="display"
      action={<SectionLink href="/insights">View cohort analysis →</SectionLink>}
      className="col-span-12 xl:col-span-3"
    >
      <div className="grid grid-cols-3 gap-2">
        {rings.map(({ window, value }) => (
          <div key={window} className="flex flex-col items-center gap-2">
            <Donut
              percent={value}
              rounded
              size={82}
              thickness={7}
              color="var(--color-chart-1)"
              track="var(--color-border-subtle)"
            >
              <span className="font-serif text-[22px] text-fg">{Math.round(value)}%</span>
            </Donut>
            <div className="text-center">
              <p className="text-[12px] font-medium text-fg">{window}</p>
              <p className="text-[10px] leading-tight text-subtle">Returned for another observation</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--color-border-subtle)] pt-3">
        <div>
          <p className="text-[11px] text-subtle">Trend</p>
          <p className={`mt-1 font-serif text-[26px] leading-none ${trend >= 0 ? "text-brand-gold" : "text-danger"}`}>
            {trend >= 0 ? "↑" : "↓"} {formatChange(trend)}
          </p>
          <p className="mt-1 text-[11px] text-faint">vs last month</p>
        </div>
        <div>
          <p className="text-[11px] text-subtle">Total Returning Observers</p>
          <p className="mt-1 font-serif text-[26px] leading-none text-fg">
            {numberFormatter.format(returnRateStats?.totalReturningObservers ?? 0)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-subtle">New This Week</p>
          <p className="mt-1 font-serif text-[26px] leading-none text-fg">
            {numberFormatter.format(returnRateStats?.newObserversThisWeek ?? 0)}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
