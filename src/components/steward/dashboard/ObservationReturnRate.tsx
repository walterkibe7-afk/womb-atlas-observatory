import { Loader2 } from "lucide-react";
import { Card, SectionCard, SectionLink, Donut } from "@/components/ui";
import type { CompletenessMetric, ReturnWindow, StewardAnalytics } from "@/lib/steward/analytics";
import { trendText, trendTone } from "./format";

type ReturnRate = StewardAnalytics["returnRate"];

type Props = {
  data: ReturnRate | null;
  className?: string;
  bodyClassName?: string;
};

const DONUT_COLORS = [
  "var(--color-brand-gold)",
  "var(--color-brand-purple)",
  "var(--color-brand-gold)",
];

const TONE_CLASS: Record<NonNullable<CompletenessMetric["tone"]>, string> = {
  good: "text-brand-green",
  warn: "text-brand-orange",
  bad: "text-danger",
};

export function ObservationReturnRate({ data, className, bodyClassName }: Props) {
  return (
    <SectionCard
      title="Observation Return Rate"
      action={<SectionLink>View cohort analysis →</SectionLink>}
      className={className}
      bodyClassName={bodyClassName}
    >
      {!data ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 text-brand-gold animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[260px] flex flex-wrap gap-3.5 justify-around">
              {data.windows.map((w, i) => (
                <ReturnDonut key={w.days} window={w} color={DONUT_COLORS[i % DONUT_COLORS.length]} />
              ))}
            </div>

            <Card variant="inset" className="flex-1 min-w-[200px]">
              <div className="text-xs text-muted mb-2.5">Completeness</div>
              <div className="flex flex-col gap-2.5">
                {data.completeness.map((c) => (
                  <div key={c.label} className="flex justify-between text-[13px]">
                    <span className="text-secondary">{c.label}</span>
                    <span className="text-fg">
                      {c.display}{" "}
                      {c.tag && c.tone && (
                        <span className={`text-[11px] ${TONE_CLASS[c.tone]}`}>{c.tag}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2.5 mt-3.5">
            <Tile label="Trend">
              <span className={`text-[15px] ${trendTone(data.trendPct)}`}>
                {trendText(data.trendPct)}
              </span>
              <div className="text-[11px] text-faint">vs last month</div>
            </Tile>
            <Tile label="Total Returning Observers">
              <span className="font-serif text-[18px] text-fg">
                {data.totalReturning.toLocaleString()}
              </span>
            </Tile>
            <Tile label="New This Week">
              <span className="font-serif text-[18px] text-fg">
                {data.newThisWeek.toLocaleString()}
              </span>
            </Tile>
          </div>
        </>
      )}
    </SectionCard>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-[120px] p-2.5 px-3 rounded-[10px] bg-[var(--color-surface-inset)] border border-[var(--color-border-subtle)]">
      <div className="text-[11px] text-faint">{label}</div>
      {children}
    </div>
  );
}

/**
 * A cohort with no eligible members has no rate — showing 0% would read as
 * "nobody came back" when the truth is "nobody has been enrolled long enough".
 */
function ReturnDonut({ window: w, color }: { window: ReturnWindow; color: string }) {
  const hasCohort = w.percent != null;

  return (
    <div className="text-center">
      <Donut
        percent={w.percent ?? 0}
        color={hasCohort ? color : "var(--color-border-subtle)"}
      >
        <span className="font-serif text-xl text-fg">{hasCohort ? `${w.percent}%` : "—"}</span>
      </Donut>
      <div className="text-[13px] text-secondary mt-2 font-semibold">{w.label}</div>
      <div className="text-[11px] text-faint max-w-[100px] mx-auto">
        {hasCohort
          ? `${w.returned} of ${w.eligible} returned for another observation`
          : `Needs ${w.days} days of history`}
      </div>
    </div>
  );
}
