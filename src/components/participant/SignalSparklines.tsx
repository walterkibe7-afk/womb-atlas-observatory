"use client";

import { TrendingUp, TrendingDown, Sun, Circle } from "lucide-react";
import type { SignalTrend, TrendDirection } from "@/lib/observation/summary";
import { DOMAIN_ICON, domainColor, domainLabel } from "./signal-domains";
import { useLocale } from "@/lib/observation/use-locale";
import { useUiStrings } from "@/lib/observation/ui-strings-context";
import type { UiStrings } from "@/lib/observation/ui-strings";

// Four directions, not the five in the design mock ("Persistent", "Changing"):
// `trendDirection` compares the last two records, so those two aren't states it
// can distinguish. Adding them would mean labelling a trend the data can't tell
// apart from "increasing"/"stable".
function trendMetaFor(
  strings: UiStrings,
): Record<TrendDirection, { label: string; className: string; Icon: typeof TrendingUp }> {
  return {
    increasing: { label: strings.trendIncreasing, className: "text-brand-orange border-brand-orange/40", Icon: TrendingUp },
    improving: { label: strings.timelineTrendImproving, className: "text-brand-green border-brand-green/40", Icon: TrendingDown },
    stable: { label: strings.timelineTrendStable, className: "text-muted border-border", Icon: Sun },
    baseline: { label: strings.confidenceBaseline, className: "text-subtle border-border-subtle", Icon: Circle },
  };
}

const SPARK_W = 112;
const SPARK_H = 32;
const MAX_SCORE = 4;

function Sparkline({ series, color }: { series: number[]; color: string }) {
  const clampY = (y: number) => Math.max(3, Math.min(SPARK_H - 3, y));
  const yFor = (v: number) => clampY(SPARK_H - (v / MAX_SCORE) * SPARK_H);

  if (series.length <= 1) {
    const y = series.length ? yFor(series[0]) : SPARK_H / 2;
    return (
      <svg width={SPARK_W} height={SPARK_H} aria-hidden="true">
        <line x1={0} y1={y} x2={SPARK_W} y2={y} stroke={color} strokeWidth={2} strokeOpacity={0.5} strokeDasharray="3 3" />
        <circle cx={SPARK_W / 2} cy={y} r={2.4} fill={color} />
      </svg>
    );
  }

  const points = series.map((v, i) => {
    const x = (i / (series.length - 1)) * (SPARK_W - 4) + 2;
    return { x, y: yFor(v) };
  });

  return (
    <svg width={SPARK_W} height={SPARK_H} aria-hidden="true">
      <polyline
        points={points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.4} fill={color} />
      ))}
    </svg>
  );
}

/**
 * The dashboard "Your Top Signals" card body: one row per domain with an inline
 * sparkline and a computed Stable / Increasing / Improving trend pill.
 *
 * `max` caps the list; rows are already ordered by the caller (strongest first),
 * so truncating drops the weakest signals rather than an arbitrary tail.
 */
export function SignalSparklines({ trends, max }: { trends: SignalTrend[]; max?: number }) {
  const locale = useLocale();
  const strings = useUiStrings();
  const trendMeta = trendMetaFor(strings);
  const rows = max ? trends.slice(0, max) : trends;
  if (!rows.length) {
    return (
      <div className="h-48 w-full flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl">
        <p className="text-sm text-muted">{strings.dashboardSignalTrendsEmpty}</p>
        <p className="text-xs text-subtle mt-1">{strings.dashboardOnceFirstRecord}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((trend) => {
        const Icon = DOMAIN_ICON[trend.domain] ?? Circle;
        const meta = trendMeta[trend.direction];
        const TrendIcon = meta.Icon;
        const color = domainColor(trend.domain);
        return (
          // The sparkline is fixed-width and the pill sizes to its label, so the
          // domain name is the only flexible cell — min-w-0 lets it truncate
          // instead of pushing the pill off the card in a narrow column.
          <div key={trend.domain} className="flex items-center gap-3">
            <Icon size={20} strokeWidth={1.6} className="shrink-0" style={{ color }} />
            <span className="flex-1 min-w-0 text-[14px] text-fg/90 truncate">{domainLabel(trend.domain, locale)}</span>
            <span className="shrink-0 hidden @sm:block">
              <Sparkline series={trend.series} color={color} />
            </span>
            <span
              className={`flex items-center gap-1.5 shrink-0 rounded-full border px-2.5 py-1 text-[12px] ${meta.className}`}
            >
              <TrendIcon size={12} strokeWidth={1.8} />
              {meta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
