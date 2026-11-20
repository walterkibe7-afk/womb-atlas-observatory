// Selects a reflection archetype + assembles a reflection plan from detected
// patterns. Ported from participant-app reflection-planner.ts, with the archetype
// matching corrected: AIKB archetype selectionSignals use pattern ids in the form
// "pat_001", which correspond to detected pattern ids "PAT-001".
import type { AikbBundle } from "@/lib/observation/aikb/types";
import type { AtlasPatternRecord, KnowledgeContext, ReflectionPlan } from "./types";

// "pat_001" -> "PAT-001"
function selectionToPatternId(selection: string): string {
  return selection.trim().toUpperCase().replace(/_/g, "-");
}

export function planReflection(
  traceId: string,
  patterns: AtlasPatternRecord[],
  knowledgeContext: KnowledgeContext,
  aikb: AikbBundle,
): ReflectionPlan {
  const dominant = patterns.find((pattern) => pattern.role === "dominant") ?? patterns[0];
  const detectedPatternIds = new Set(patterns.map((pattern) => pattern.id));

  const selectedArchetype =
    aikb.reflection.archetypes.find((archetype) =>
      archetype.selectionSignals.some((selection) =>
        detectedPatternIds.has(selectionToPatternId(selection)),
      ),
    ) ?? aikb.reflection.archetypes[0];

  return {
    traceId,
    archetypeId: selectedArchetype?.id ?? "ARC-000",
    archetypeName: selectedArchetype?.name ?? "Baseline Observation",
    tone: selectedArchetype?.tone ?? "supportive",
    dominantPatternIds: dominant ? [dominant.id] : [],
    supportingPatternIds: patterns
      .filter((pattern) => pattern.id !== dominant?.id)
      .slice(0, 3)
      .map((pattern) => pattern.id),
    educationIds: knowledgeContext.educationNotes.map((_, index) => `EDU-${index + 1}`),
    reflectionQuestions: [
      "What feels most important to keep watching in your body right now?",
      "Where do you notice the strongest connection between symptoms and daily life?",
      "What would help you feel more prepared for your next observation?",
    ],
    protectiveStrengths: knowledgeContext.strengthNotes,
    futureWatchAreas: patterns.slice(0, 3).map((pattern) => pattern.watchOverTime),
  };
}
