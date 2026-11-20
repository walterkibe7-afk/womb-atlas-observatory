// The 8 reflection-summary sections (source of truth: observation-contract.ts).
// AIKB registry sections (from observations.json field.section) are folded onto
// these 8; review/reflection/atlas_record/atlas_check-in are NOT reflection sections.

export const REFLECTION_SECTION_IDS = [
  "context",
  "bleeding",
  "pain",
  "hormonal",
  "daily_life",
  "care",
  "narrative",
  "sensitive",
] as const;

export type ReflectionSectionId = (typeof REFLECTION_SECTION_IDS)[number];

export const REFLECTION_SECTION_LABELS: Record<ReflectionSectionId, string> = {
  context: "Context",
  bleeding: "Bleeding",
  pain: "Pain",
  hormonal: "Hormonal / Cycle",
  daily_life: "Daily Life",
  care: "Care Experience",
  narrative: "Narrative",
  sensitive: "Sensitive Topics",
};

// AIKB registry section string -> reflection section id.
const REGISTRY_SECTION_TO_REFLECTION: Record<string, ReflectionSectionId> = {
  context: "context",
  demographic_and_cultural_chamber: "context",
  reproductive_history: "context",
  bleeding: "bleeding",
  pain: "pain",
  hormonal: "hormonal",
  daily_life: "daily_life",
  care: "care",
  narrative: "narrative",
  sensitive: "sensitive",
};

export function toReflectionSection(registrySection: string): ReflectionSectionId | null {
  return REGISTRY_SECTION_TO_REFLECTION[registrySection] ?? null;
}

export function emptySectionCounts(): Record<ReflectionSectionId, number> {
  return Object.fromEntries(REFLECTION_SECTION_IDS.map((s) => [s, 0])) as Record<
    ReflectionSectionId,
    number
  >;
}
