/**
 * The Reflection Chamber's five-step confidence ladder — see
 * `intelligence/v43/reflection-chamber.ts`, which is the definition of record.
 *
 * This lives apart from `summary.ts` deliberately: `summary.ts` imports the
 * Prisma client, so a component that imports these *values* (rather than just
 * types, which are erased at compile time) would drag the mariadb adapter into
 * the client bundle. The dashboard's evidence dots need the numbers at runtime,
 * so the ladder belongs in a module with no server-only imports.
 */
import { v43Text } from "./intelligence/v43/v43-i18n";

export type EvidenceConfidence = "baseline" | "emerging" | "moderate" | "strong" | "very_strong";

/** Dots filled out of five. The ordering is load-bearing — it is the ladder. */
export const EVIDENCE_STRENGTH: Record<EvidenceConfidence, number> = {
  baseline: 1,
  emerging: 2,
  moderate: 3,
  strong: 4,
  very_strong: 5,
};

export const EVIDENCE_LABEL: Record<EvidenceConfidence, string> = {
  baseline: "Baseline",
  emerging: "Emerging",
  moderate: "Moderate",
  strong: "Strong",
  very_strong: "Very strong",
};

export function isEvidenceConfidence(value: unknown): value is EvidenceConfidence {
  return typeof value === "string" && value in EVIDENCE_STRENGTH;
}

export function evidenceLabel(confidence: EvidenceConfidence, locale?: string): string {
  return v43Text(`evidence_${confidence}`, "label", EVIDENCE_LABEL[confidence], locale);
}
