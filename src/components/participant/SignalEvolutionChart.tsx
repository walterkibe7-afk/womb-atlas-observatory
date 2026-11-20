"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { SignalSeriesPoint } from "@/lib/observation/summary";
import { domainColor, domainLabel } from "./signal-domains";
import { useLocale } from "@/lib/observation/use-locale";
import { useUiStrings } from "@/lib/observation/ui-strings-context";

/**
 * The multi-series Signal Evolution line chart, shared by the dashboard and the
 * Timeline page. Renders an empty state when there is no series data.
 */
export function SignalEvolutionChart({
  series,
  domains,
  height = 192,
  grid = false,
  legend = false,
}: {
  series: SignalSeriesPoint[];
  domains: string[];
  height?: number;
  grid?: boolean;
  legend?: boolean;
}) {
  const locale = useLocale();
  const strings = useUiStrings();
  if (!series.length) {
    return (
      <div
        className="w-full flex flex-col items-center justify-center text-center border border-dashed border-[var(--color-border)] rounded-xl"
        style={{ height }}
      >
        <p className="text-sm text-subtle">{strings.dashboardSignalTrendsEmpty}</p>
        <p className="text-xs text-faint mt-1">{strings.dashboardOnceFirstRecord}</p>
      </div>
    );
  }

  // Points are dated to month+year only ("Jul 26"), so several records made in
  // the same month share an identical display label. Recharts resolves hover /
  // tooltip lookups by matching the XAxis dataKey's value — with duplicate
  // labels it always snaps to one fixed match instead of the point actually
  // under the cursor. Keying the axis by array index (guaranteed unique) and
  // formatting it back to the friendly label for display fixes this without
  // changing what's shown.
  const indexed = series.map((point, i) => ({ ...point, __x: i }));
  const labelFor = (i: number) => series[i]?.name ?? "";
  const tooltipLabelFor = (i: unknown) => labelFor(typeof i === "number" ? i : Number(i));

  return (
    <div>
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={indexed} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            {grid && <CartesianGrid stroke="rgba(176,127,88,0.25)" strokeDasharray="3 3" />}
            <XAxis
              dataKey="__x"
              type="number"
              domain={[0, Math.max(0, series.length - 1)]}
              ticks={indexed.map((p) => p.__x)}
              tickFormatter={labelFor}
              stroke="rgba(176,127,88,0.4)"
              tick={{ fill: "rgba(216,201,181,0.6)", fontSize: 10 }}
            />
            <Tooltip
              labelFormatter={tooltipLabelFor}
              contentStyle={{ backgroundColor: "#3A1A2C", borderColor: "rgba(176,127,88,0.4)", borderRadius: "8px" }}
              itemStyle={{ color: "#D8C9B5", fontSize: "12px" }}
            />
            {domains.map((domain) => (
              <Line
                key={domain}
                type="monotone"
                dataKey={domain}
                stroke={domainColor(domain)}
                strokeWidth={2}
                dot={{ r: 3, fill: "#3A1A2C", strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {legend && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
          {domains.map((domain) => (
            <div key={domain} className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: domainColor(domain) }} />
              <span className="text-xs text-subtle">{domainLabel(domain, locale)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
