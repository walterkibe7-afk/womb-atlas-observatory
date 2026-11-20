import { EVIDENCE_STRENGTH, evidenceLabel, type EvidenceConfidence } from "@/lib/observation/evidence";
import { useUiStrings } from "@/lib/observation/ui-strings-context";
import { useLocale } from "@/lib/observation/use-locale";

const TOTAL = Object.keys(EVIDENCE_STRENGTH).length;

/**
 * The Reflection Chamber's confidence ladder as filled dots — "how much of your
 * record points at this", not "how bad it is". Renders nothing when confidence
 * is null (records finalized through the deterministic path carry a pattern name
 * but no confidence, and a guessed strength would read as evidence).
 */
export function EvidenceDots({
  confidence,
  caption,
}: {
  confidence: EvidenceConfidence | null;
  caption?: string;
}) {
  const strings = useUiStrings();
  const locale = useLocale();
  if (!confidence) return null;
  const filled = EVIDENCE_STRENGTH[confidence];
  const resolvedCaption = caption ?? strings.evidenceStrengthCaption;
  const label = evidenceLabel(confidence, locale);
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="text-subtle text-[12px]">{resolvedCaption}</span>
      <span className="flex items-center gap-1" role="img" aria-label={`${resolvedCaption}: ${label}`}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <span
            key={i}
            className={`h-1.75 w-1.75 rounded-full ${
              i < filled ? "bg-brand-gold" : "border border-border-brand"
            }`}
          />
        ))}
      </span>
      <span className="text-brand-gold text-[12px] font-semibold">{label}</span>
    </span>
  );
}
