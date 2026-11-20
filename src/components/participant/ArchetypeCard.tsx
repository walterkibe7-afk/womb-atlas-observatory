import {
  Eye,
  Flame,
  Lightbulb,
  Megaphone,
  Shuffle,
  Sparkle,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { ArchetypeSummary } from "@/lib/observation/summary";
import { SectionLink } from "@/components/ui";
import { EvidenceDots } from "./EvidenceDots";
import { InsightCard, InsightChip, InsightRow } from "./InsightCard";
import { InsightGlyph } from "./InsightGlyph";
import { useUiStrings } from "@/lib/observation/ui-strings-context";

// Strengths come from a closed registry of six in
// `intelligence/v43/atlas-intelligence-v43.ts`, so these can be mapped by name
// rather than guessed. The fallback covers the registry growing.
const STRENGTH_ICONS: Record<string, LucideIcon> = {
  Adaptation: Shuffle,
  Persistence: Flame,
  Awareness: Eye,
  Preparation: ShieldCheck,
  Resourcefulness: Lightbulb,
  "Self-Advocacy": Megaphone,
};

/**
 * "Your Current Archetype" — the archetype the Reflection Chamber selected for
 * the latest Atlas Record, with the strengths it observed.
 *
 * "Current" is meant literally: a check-in re-runs the pipeline and can change
 * it. The shaped-by count is the number of patterns that fed the selection —
 * what the record actually records, rather than a count of answers, which the
 * archetype was never derived from.
 */
export function ArchetypeCard({ archetype }: { archetype: ArchetypeSummary | null }) {
  const strings = useUiStrings();
  if (!archetype) {
    return (
      <InsightCard step={2} title={strings.dashboardArchetypeTitle}>
        <div className="flex-1 min-h-40 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border px-4">
          <p className="text-sm text-muted">{strings.dashboardArchetypeEmpty}</p>
          <p className="text-xs text-subtle mt-1">{strings.dashboardOnceFirstRecord}</p>
        </div>
      </InsightCard>
    );
  }

  const shapedBy = archetype.shapedByPatterns.length;

  return (
    <InsightCard step={2} title={strings.dashboardArchetypeTitle}>
      <InsightRow
        media={<InsightGlyph icon={UserRound} id="archetype" className="h-22 w-22 sm:h-26 sm:w-26" />}
        caption={archetype.strengths.length > 0 ? strings.dashboardStrengthsInAction : undefined}
      >
        <h2 className="font-serif text-[22px] leading-tight font-semibold text-fg text-pretty">
          {archetype.name}
        </h2>
        {shapedBy > 0 && (
          <p className="text-subtle text-[12px] mt-1">
            {strings.dashboardShapedByPrefix} {shapedBy} {shapedBy === 1 ? strings.dashboardObservedPatternSingular : strings.dashboardObservedPatternPlural}
          </p>
        )}
        {archetype.coreTheme && (
          <p className="text-muted text-[14px] leading-relaxed mt-2.5 text-pretty">{archetype.coreTheme}</p>
        )}
        {archetype.strengths.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-auto pt-4">
            {archetype.strengths.map((strength) => (
              <InsightChip key={strength.name} icon={STRENGTH_ICONS[strength.name] ?? Sparkle}>
                {strength.label}
              </InsightChip>
            ))}
          </div>
        )}
      </InsightRow>

      <div className="mt-4 pt-3.5 border-t border-border-subtle flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <EvidenceDots confidence={archetype.confidence} caption={strings.dashboardConfidenceCaption} />
        <SectionLink href="/reflections">{strings.dashboardViewWhatShaped}</SectionLink>
      </div>
    </InsightCard>
  );
}
