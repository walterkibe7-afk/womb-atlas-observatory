"use client";

import { useMemo } from "react";
import type { Metric, ObservatoryGrowthStats } from "@/app/(admin)/admin/types";
import { numberFormatter, formatChange } from "@/app/(admin)/admin/utils";
import { SectionCard, SectionLink } from "@/components/ui";

const CHART = { width: 660, height: 170, padLeft: 34, padRight: 8, padTop: 10, padBottom: 20 };

// Fixed hue order — Signals, Concepts, Languages. Never cycled, never reassigned
// by rank: a series keeps its colour however the data moves.
const SERIES = [
  { key: "signals", label: "Signals", color: "var(--color-chart-1)" },
  { key: "concepts", label: "Concepts", color: "var(--color-chart-2)" },
  { key: "languages", label: "Languages", color: "var(--color-chart-3)" },
] as const;

const monthLabel = (month: string) => {
  const date = new Date(`${month}-01T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? month
    : date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
};

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export function GrowthDashboardSection({
  growthStats,
}: {
  growthStats: ObservatoryGrowthStats | null;
}) {
  const series = useMemo(() => growthStats?.growthOverTime ?? [], [growthStats]);

  // One shared y-scale across all three series — never a second axis.
  const max = Math.max(1, ...series.flatMap((d) => [d.signals, d.concepts, d.languages]));
  const plotW = CHART.width - CHART.padLeft - CHART.padRight;
  const plotH = CHART.height - CHART.padTop - CHART.padBottom;

  const x = (i: number) => CHART.padLeft + (i / Math.max(series.length - 1, 1)) * plotW;
  const y = (value: number) => CHART.padTop + plotH - (value / max) * plotH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((step) => step * max);

  const metricCards: { label: string; metric?: Metric }[] = [
    { label: "New Signals Identified", metric: growthStats?.newSignals },
    { label: "New Concepts", metric: growthStats?.newConcepts },
    { label: "Languages Added", metric: growthStats?.languagesAdded },
    { label: "Cross-Language Links", metric: growthStats?.crossLanguageLinks },
  ];

  const totals = [
    { label: "Total Signals", value: growthStats?.totalSignals ?? 0 },
    { label: "Total Concepts", value: growthStats?.totalConcepts ?? 0 },
    { label: "Total Languages", value: growthStats?.totalLanguages ?? 0 },
  ];

  return (
    <SectionCard
      title="Observatory Growth Dashboard"
      titleVariant="display"
      action={<SectionLink href="/insights">View all metrics →</SectionLink>}
      className="col-span-12 xl:col-span-5"
    >
      <div id="growth-dashboard" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metricCards.map(({ label, metric }) => {
          const positive = (metric?.change ?? 0) >= 0;
          return (
            <div
              key={label}
              className="rounded-[var(--radius-panel)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] p-2"
            >
              <p className="text-[11px] leading-tight text-subtle">{label}</p>
              <p className="mt-1 font-serif text-[28px] leading-none text-fg">{metric?.value ?? 0}</p>
              <p className={`mt-1 text-[11px] ${positive ? "text-brand-gold" : "text-danger"}`}>
                {positive ? "↑" : "↓"} {formatChange(metric?.change ?? 0)}{" "}
                <span className="text-faint">vs last 7 days</span>
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-brand-gold">Knowledge Growth Over Time</p>
            {/* Legend is mandatory at 3 series — identity is never colour-alone. */}
            <ul className="flex items-center gap-3">
              {SERIES.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </li>
              ))}
            </ul>
          </div>

          <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="h-40 w-full" role="img">
            <title>Knowledge growth over time — signals, concepts and languages</title>

            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={CHART.padLeft}
                  y1={y(tick)}
                  x2={CHART.width - CHART.padRight}
                  y2={y(tick)}
                  stroke="var(--color-grid)"
                  strokeWidth="1"
                />
                <text x="0" y={y(tick) + 3} fill="var(--color-faint)" fontSize="10">
                  {compact.format(Math.round(tick))}
                </text>
              </g>
            ))}

            {series.map((point, i) => (
              <text
                key={point.month}
                x={x(i)}
                y={CHART.height - 4}
                fill="var(--color-faint)"
                fontSize="10"
                textAnchor="middle"
              >
                {monthLabel(point.month)}
              </text>
            ))}

            {SERIES.map((s) => (
              <g key={s.key}>
                <path
                  d={series
                    .map((point, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(point[s.key]).toFixed(1)}`)
                    .join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {series.map((point, i) => (
                  // 2px surface ring so overlapping markers stay separable.
                  <circle
                    key={point.month}
                    cx={x(i)}
                    cy={y(point[s.key])}
                    r="3.5"
                    fill={s.color}
                    stroke="var(--color-surface-inset)"
                    strokeWidth="2"
                  />
                ))}
              </g>
            ))}
          </svg>
        </div>

        <div className="space-y-3 rounded-[var(--radius-panel)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] p-3">
          {totals.map(({ label, value }) => (
            <div key={label}>
              <p className="text-[11px] text-subtle">{label}</p>
              <p className="mt-1 font-serif text-[28px] leading-none text-fg">
                {numberFormatter.format(value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
