import { Loader2 } from "lucide-react";
import { SectionCard, SectionLink } from "@/components/ui";
import type { ChartPoint, StewardAnalytics } from "@/lib/steward/analytics";
import { compact, trendText, trendTone } from "./format";

type Growth = StewardAnalytics["growth"];

type Props = {
  data: Growth | null;
  className?: string;
  bodyClassName?: string;
};

// Chart geometry, in the SVG's own coordinate space.
const VIEW_W = 460;
const VIEW_H = 150;
const PLOT_TOP = 10;
const PLOT_BOTTOM = 136;
const PLOT_LEFT = 10;
const PLOT_RIGHT = 452;

const SERIES = [
  { key: "signals", label: "Signals", color: "var(--color-chart-1)" },
  { key: "concepts", label: "Concepts", color: "var(--color-chart-2)" },
  { key: "languages", label: "Languages", color: "var(--color-chart-3)" },
] as const;

export function GrowthDashboard({ data, className, bodyClassName }: Props) {
  return (
    <SectionCard
      title="Observatory Growth Dashboard"
      action={<SectionLink>View all metrics →</SectionLink>}
      className={className}
      bodyClassName={bodyClassName}
    >
      {!data ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 text-brand-gold animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2.5 mb-4">
            {data.tiles.map((t) => (
              <div
                key={t.key}
                className="flex-1 min-w-[120px] p-3 rounded-[10px] bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]"
              >
                <div className="text-[11px] text-muted">{t.label}</div>
                <div className="font-serif text-2xl text-fg">{compact(t.value)}</div>
                <div className={`text-[11px] ${trendTone(t.trendPct)}`}>
                  {t.trendPct == null
                    ? "No prior period"
                    : t.trendPct === 0
                      ? `No change ${t.trendWindow}`
                      : `${trendText(t.trendPct)} ${t.trendWindow}`}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[260px]">
              <div className="text-xs text-muted mb-1.5">Knowledge Growth Over Time</div>
              <div className="flex gap-4 mb-2 text-[11px] text-muted">
                {SERIES.map((s) => (
                  <LegendDot key={s.key} color={s.color} label={s.label} />
                ))}
              </div>
              <GrowthChart points={data.chart.points} yTicks={data.chart.yTicks} />
            </div>

            <div className="flex-[0_1_150px] flex flex-col gap-2 justify-center">
              {data.totals.map((t) => (
                <div
                  key={t.label}
                  className="p-2.5 px-3 rounded-[10px] bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]"
                >
                  <div className="text-[11px] text-muted">{t.label}</div>
                  <div className="font-serif text-[19px] text-fg">{t.value.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </SectionCard>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Cumulative growth lines, scaled to the axis maximum the server picked. */
function GrowthChart({ points, yTicks }: { points: ChartPoint[]; yTicks: number[] }) {
  if (points.length === 0) {
    return (
      <div className="h-[150px] flex items-center justify-center text-xs text-faint">
        No activity recorded yet.
      </div>
    );
  }

  const max = yTicks[0] || 1;
  const toY = (v: number) => PLOT_BOTTOM - (v / max) * (PLOT_BOTTOM - PLOT_TOP);
  const toX = (i: number) =>
    points.length === 1
      ? (PLOT_LEFT + PLOT_RIGHT) / 2
      : PLOT_LEFT + (i * (PLOT_RIGHT - PLOT_LEFT)) / (points.length - 1);

  const line = (key: (typeof SERIES)[number]["key"]) =>
    points.map((p, i) => `${toX(i)},${toY(p[key])}`).join(" ");

  return (
    <div className="flex gap-2">
      <div className="flex flex-col justify-between text-[10px] text-faint pt-0.5 pb-[18px]">
        {yTicks.map((t, i) => (
          <span key={i}>{compact(t)}</span>
        ))}
      </div>
      <div className="flex-1">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="w-full h-[150px] block"
        >
          {yTicks.map((t, i) => (
            <line
              key={i}
              x1="0"
              y1={toY(t)}
              x2={VIEW_W}
              y2={toY(t)}
              stroke="var(--color-grid)"
              strokeWidth="1"
            />
          ))}
          {SERIES.map((s) => (
            <polyline
              key={s.key}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              points={line(s.key)}
            />
          ))}
        </svg>
        <div className="flex justify-between text-[10px] text-faint mt-0.5">
          {points.map((p, i) => (
            <span key={i}>{p.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
