"use client";

import type { LucideIcon } from "lucide-react";
import type { Metric } from "@/app/(admin)/admin/types";
import { numberFormatter, formatChange } from "@/app/(admin)/admin/utils";
import { Sparkline } from "@/components/ui";

export function HeaderStat({
  label,
  metric,
  icon: Icon,
  sparkline,
  seriesColor,
}: {
  label: string;
  metric: Metric;
  icon: LucideIcon;
  sparkline: number[];
  /** Series hue for the trend line. Fixed per stat — it identifies the tile, so it
   *  must not follow the delta's sign (that's what the ↑/↓ and its colour are for). */
  seriesColor: string;
}) {
  const positive = metric.change >= 0;

  return (
    <div className="bg-surface-card flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--color-border)] px-4 py-3.5">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)]">
        <Icon size={22} strokeWidth={1.5} className="text-brand-gold" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-gold">
          {label}
        </p>
        <p className="mt-0.5 font-serif text-[34px] leading-none text-fg">
          {numberFormatter.format(metric.value)}
        </p>
        <p className="mt-1.5 text-[11px]">
          <span className={positive ? "font-semibold text-brand-gold" : "font-semibold text-danger"}>
            {positive ? "↑" : "↓"} {formatChange(metric.change)}
          </span>{" "}
          <span className="text-faint">vs last 7 days</span>
        </p>
      </div>

      <Sparkline data={sparkline} width={80} height={34} strokeWidth={2} color={seriesColor} />
    </div>
  );
}
