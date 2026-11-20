// Builds an explainability trace (observation -> signal -> pattern -> reflection
// -> displayed text). Ported/adapted from participant-app explainability-service.ts.
import type {
  AtlasObservationRecord,
  AtlasPatternRecord,
  AtlasReflection,
  AtlasSignalRecord,
  ExplainabilityTrace,
  ReflectionPlan,
} from "./types";

export function buildExplainabilityTrace(input: {
  traceId: string;
  observations: AtlasObservationRecord[];
  signals: AtlasSignalRecord[];
  patterns: AtlasPatternRecord[];
  plan: ReflectionPlan;
  reflection: AtlasReflection;
}): ExplainabilityTrace {
  const steps: ExplainabilityTrace["steps"] = [];

  for (const observation of input.observations) {
    steps.push({
      step: "observation",
      sourceId: observation.id,
      label: observation.label,
      displayedText: observation.displayText,
    });
  }

  for (const signal of input.signals) {
    steps.push({
      step: "signal",
      sourceId: signal.id,
      label: signal.label,
      displayedText: `Signal mapped from ${signal.observationIds.length} observation(s).`,
    });
  }

  for (const pattern of input.patterns) {
    steps.push({
      step: "pattern",
      sourceId: pattern.id,
      label: pattern.name,
      displayedText: pattern.meaning,
    });
  }

  steps.push({
    step: "reflection_component",
    sourceId: input.plan.archetypeId,
    label: "Atlas Archetype",
    displayedText: input.reflection.archetypeName,
  });

  steps.push({
    step: "displayed_text",
    sourceId: input.traceId,
    label: "Reflection Summary",
    displayedText: input.reflection.openingInsight,
  });

  return { traceId: input.traceId, steps };
}
