import {
  Activity,
  Battery,
  Droplet,
  Moon,
  RefreshCw,
  Sparkle,
  Stethoscope,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { PatternSummary } from "@/lib/observation/summary";
import { SectionLink } from "@/components/ui";
import { EvidenceDots } from "./EvidenceDots";
import { InsightCard, InsightChip, InsightRow } from "./InsightCard";
import { InsightGlyph } from "./InsightGlyph";
import { useUiStrings } from "@/lib/observation/ui-strings-context";

// Contributing factors are free-form phrases from the Reflection Chamber
// ("Sleep disruption", "Care dismissal"), not a closed vocabulary, so the icon
// is matched on a keyword with a neutral fallback. It is decoration — the chip's
// text carries the meaning, and an unmatched phrase gets a generic mark rather
// than being forced into a category it may not belong to.
const FACTOR_ICONS: [RegExp, LucideIcon][] = [
  [/bleed|period|clot|flow/i, Droplet],
  [/pain|cramp|ache/i, Zap],
  [/sleep|night|rest/i, Moon],
  [/fatigue|energy|tired/i, Battery],
  [/care|provider|dismiss|access/i, Stethoscope],
  [/cycle|rhythm|timing|irregular|skipped/i, RefreshCw],
  [/work|school|social|relationship|plans|activit|life area/i, Users],
  [/worsen|trajectory|progress|change/i, TrendingUp],
  [/daily|function|routine|impact/i, Activity],
];

function factorIcon(label: string): LucideIcon {
  return FACTOR_ICONS.find(([re]) => re.test(label))?.[1] ?? Sparkle;
}

/**
 * "Your Dominant Pattern" — the strongest pattern in the participant's latest
 * Atlas Record, in its participant-facing wording.
 *
 * Every string comes from the record; nothing is composed here. The clinical
 * name sits under the participant label rather than replacing it, so the card
 * stays readable without hiding what Atlas actually named.
 */
export function DominantPatternCard({ pattern }: { pattern: PatternSummary | null }) {
  const strings = useUiStrings();
  if (!pattern) {
    return (
      <InsightCard step={1} title={strings.dashboardDominantPatternTitle}>
        <div className="flex-1 min-h-40 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border px-4">
          <p className="text-sm text-muted">{strings.dashboardDominantPatternEmpty}</p>
          <p className="text-xs text-subtle mt-1">{strings.dashboardOnceFirstRecord}</p>
        </div>
      </InsightCard>
    );
  }

  return (
    <InsightCard step={1} title={strings.dashboardDominantPatternTitle}>
      <InsightRow
        media={<InsightGlyph icon={Users} id="dominant" className="h-22 w-22 sm:h-26 sm:w-26" />}
        caption={pattern.contributingFactors.length > 0 ? strings.dashboardKeyDomainsContributing : undefined}
      >
        <h2 className="font-serif text-[22px] leading-tight font-semibold text-fg text-pretty">
          {pattern.label}
        </h2>
        {pattern.scientificName && pattern.scientificName !== pattern.label && (
          <p className="text-subtle text-[12px] mt-1">{strings.dashboardAtlasCallsThis} {pattern.scientificName}</p>
        )}
        {pattern.whyThisMatters && (
          <p className="text-muted text-[14px] leading-relaxed mt-2.5 text-pretty">{pattern.whyThisMatters}</p>
        )}
        {pattern.contributingFactors.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-auto pt-4">
            {pattern.contributingFactors.map((factor) => (
              <InsightChip key={factor} icon={factorIcon(factor)}>
                {factor}
              </InsightChip>
            ))}
          </div>
        )}
      </InsightRow>

      <div className="mt-4 pt-3.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <EvidenceDots confidence={pattern.confidence} />
        <SectionLink href="/reflections">{strings.dashboardWhyAtlasObservedThis}</SectionLink>
      </div>
    </InsightCard>
  );
}
