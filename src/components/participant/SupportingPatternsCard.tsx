import { ArrowRight } from "lucide-react";
import type { PatternSummary } from "@/lib/observation/summary";
import { Card, SectionCard, SectionLink } from "@/components/ui";
import { EvidenceDots } from "./EvidenceDots";
import { useUiStrings } from "@/lib/observation/ui-strings-context";

/**
 * "Supporting Patterns" — everything the latest Atlas Record surfaced alongside
 * the dominant pattern, in the order the Reflection Chamber ranked them.
 *
 * This takes the middle row's third slot from the old "Signal Evolution" card,
 * which the new "Your Top Signals" card above now renders — the two were the
 * same list with the same sparklines, and showing both read as a duplicate.
 */
export function SupportingPatternsCard({ patterns }: { patterns: PatternSummary[] }) {
  const strings = useUiStrings();
  return (
    <SectionCard
      title={strings.dashboardSupportingPatternsTitle}
      action={
        <SectionLink href="/records" className="inline-flex items-center gap-1.5">
          {strings.dashboardViewAll} <ArrowRight size={13} />
        </SectionLink>
      }
      className="2xl:h-150 flex flex-col"
      bodyClassName="2xl:flex-1 min-h-0 flex flex-col"
    >
      <p className="text-muted text-[15px] mb-5 shrink-0">{strings.dashboardSupportingPatternsIntro}</p>
      {patterns.length === 0 ? (
        <div className="flex-1 min-h-32 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border px-4">
          <p className="text-sm text-muted">{strings.dashboardSupportingPatternsEmpty}</p>
          <p className="text-xs text-subtle mt-1">{strings.dashboardOnceFirstRecord}</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
          {patterns.map((pattern) => (
            <Card key={pattern.scientificName || pattern.label} variant="inset">
              <p className="text-[15px] text-fg/90 font-medium text-pretty">{pattern.label}</p>
              {pattern.whyThisMatters && (
                <p className="text-subtle text-[13px] leading-snug mt-1.5 text-pretty">{pattern.whyThisMatters}</p>
              )}
              <div className="mt-2.5">
                <EvidenceDots confidence={pattern.confidence} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
