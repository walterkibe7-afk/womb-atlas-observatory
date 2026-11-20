import type { ObservationResponseDraft } from "./first-observation-types";
import type { AikbBundle } from "@/lib/observation/aikb/types";
import observationsRegistry from "@/content/aikb/observations.json";
import {
  REFLECTION_SUMMARY_SECTIONS,
  buildReflectionSummaryPayload,
  buildSectionCountRecord,
  normalizeRegistrySection,
  resolveFieldBinding,
  type ReflectionSummarySectionId
} from "./observation-contract";
import type { ObservationPipelineTrace } from "./types";
import type { OntologyRoutingContext } from "./pattern-ontology";
import type { NarrativeIntelligence } from "./narrative-intelligence";
import { getNarrativeThemeIds } from "./narrative-intelligence";

export { normalizeRegistrySection, normalizeRegistrySection as normalizeReviewSectionKey };

export function shouldLogObservationExtractionDebug() {
  if (process.env.ATLAS_OBSERVATION_DEBUG === "false") {
    return false;
  }

  return (
    process.env.ATLAS_OBSERVATION_DEBUG === "true" ||
    process.env.NODE_ENV !== "production"
  );
}

export function logObservationPipelineTrace(trace: ObservationPipelineTrace) {
  if (!shouldLogObservationExtractionDebug()) {
    return;
  }

  const countLines = REFLECTION_SUMMARY_SECTIONS.map((section) => {
    const sectionId = section.sectionId;
    return [
      `${section.observationCountKey}:`,
      `questionnaire=${trace.sectionCounts.questionnaire[sectionId]}`,
      `normalized=${trace.sectionCounts.normalized[sectionId]}`,
      `registry=${trace.sectionCounts.registryMatches[sectionId]}`,
      `preview=${trace.sectionCounts.preview[sectionId]}`,
      `reflectionPayload=${trace.sectionCounts.reflectionPayload[sectionId]}`,
      `reflectionResponse=${trace.sectionCounts.reflectionResponse[sectionId]}`,
      `ui=${trace.sectionCounts.uiRendered[sectionId]}`
    ].join(" ");
  });

  console.info("[AtlasObservationDebug]");
  for (const line of countLines) {
    console.info(line);
  }

  console.info("[AtlasObservationDebug] Pipeline summary", {
    responseCount: trace.responseCount,
    observationCount: trace.observationCount,
    unmatchedResponseCount: trace.unmatchedResponses.length,
    sectionCounts: buildSectionCountRecord(trace.sectionCounts.normalized),
    reflectionSummary: buildReflectionSummaryPayload(trace.sectionCounts.reflectionPayload)
  });

  if (trace.unmatchedResponses.length > 0) {
    console.info(
      "[AtlasObservationDebug] Responses without contract field binding",
      trace.unmatchedResponses
    );
  }
}

/** @deprecated Use logObservationPipelineTrace */
export function logObservationExtractionDebug(input: {
  responses: Array<{ screenId: string; fieldId: string; value: unknown }>;
  observations: Array<{
    id: string;
    fieldId: string;
    section: string;
    reviewSection: string;
    value: string;
    screenId: string;
  }>;
  unmatchedResponses: Array<{ screenId: string; fieldId: string; value: unknown }>;
}) {
  if (!shouldLogObservationExtractionDebug()) {
    return;
  }

  const normalized = Object.fromEntries(
    REFLECTION_SUMMARY_SECTIONS.map((section) => [section.sectionId, 0])
  ) as Record<ReflectionSummarySectionId, number>;

  for (const observation of input.observations) {
    const sectionId = observation.reviewSection as ReflectionSummarySectionId;

    if (sectionId in normalized) {
      normalized[sectionId] += 1;
    }
  }

  logObservationPipelineTrace({
    responseCount: input.responses.length,
    observationCount: input.observations.length,
    unmatchedResponses: input.unmatchedResponses.map((response) => ({
      screenId: response.screenId,
      fieldId: response.fieldId
    })),
    sectionCounts: {
      questionnaire: normalized,
      normalized,
      registryMatches: normalized,
      preview: normalized,
      reflectionPayload: normalized,
      reflectionResponse: normalized,
      uiRendered: normalized
    }
  });
}

export function logOntologyRoutingDebug(context: OntologyRoutingContext) {
  if (!shouldLogObservationExtractionDebug()) {
    return;
  }

  console.info("[AtlasOntologyDebug] Routing summary", {
    version: "1.0.0",
    routingCount: context.routings.length,
    primaryPatterns: context.primaryPatterns.map((pattern) => pattern.scientificName),
    secondaryPatterns: context.secondaryPatterns.map((pattern) => pattern.scientificName),
    emergentThemes: context.emergentThemes.map((theme) => theme.scientificName)
  });

  for (const routing of context.routings) {
    console.info("[AtlasOntologyDebug] Signal route", {
      rawField: routing.rawField,
      value: routing.value,
      normalizedSignal: routing.normalizedSignal,
      primaryPattern: routing.primaryScientificName,
      secondaryPattern: routing.secondaryScientificName,
      primaryLabel: routing.primaryParticipantLabel,
      secondaryLabel: routing.secondaryParticipantLabel,
      confidenceModifier: routing.confidenceModifier,
      contributionLevel: routing.contributionLevel,
      exclusionApplied: routing.exclusionApplied,
      sourceLayer: routing.sourceLayer,
      renderedParticipantLabel: routing.primaryParticipantLabel
    });
  }

  for (const theme of context.emergentThemes) {
    console.info("[AtlasOntologyDebug] Emergent theme", {
      scientificName: theme.scientificName,
      participantLabel: theme.participantLabel,
      convergedFrom: theme.convergedFrom
    });
  }
}

export function logNarrativeRoutingDebug(intelligence: NarrativeIntelligence) {
  if (!shouldLogObservationExtractionDebug()) {
    return;
  }

  console.info("[AtlasNarrativeDebug]", {
    narrativeResponsesPresent: intelligence.narrativeConfidence.responsesPresent,
    themesExtracted: intelligence.narrativeConfidence.themeCount,
    themeIds: getNarrativeThemeIds(intelligence),
    participantVoiceSnippets: intelligence.participantVoice.length,
    archetypeModifiers: intelligence.archetypeModifiers.map(
      (modifier) => `${modifier.target}:${modifier.weight}`
    ),
    watchModifiers: intelligence.watchModifiers.map(
      (modifier) => `${modifier.watchLabel}:${modifier.sourceThemeId}`
    ),
    storyModifiers: intelligence.storyModifiers.map((modifier) => modifier.sourceThemeId)
  });

  for (const theme of intelligence.narrativeThemes) {
    console.info("[AtlasNarrativeDebug] Theme", {
      themeId: theme.themeId,
      scientificName: theme.scientificName,
      participantLabel: theme.participantLabel,
      confidence: theme.confidence,
      relatedPatterns: theme.relatedPatterns,
      sourceSnippet: theme.sourceTextSnippet
    });
  }
}

export function createMinimalAikbBundle(
  observations: AikbBundle["observations"]
): AikbBundle {
  return {
    version: observationsRegistry.version ?? "1.0.0",
    generatedAt: observationsRegistry.generatedAt ?? new Date().toISOString(),
    observations,
    signals: { mappings: [] },
    patterns: { entries: [] },
    reflection: { archetypes: [], tones: [] },
    knowledgeGraph: { edges: [] },
    indices: { definitions: [] },
    governance: { rules: [] }
  };
}

export function createClientAikbBundle(): AikbBundle {
  return createMinimalAikbBundle(observationsRegistry);
}

export function countRegistryCoverage(
  responses: ObservationResponseDraft[],
  aikb: AikbBundle
): Record<ReflectionSummarySectionId, number> {
  const registryFieldIds = new Set(aikb.observations.fields.map((field) => field.fieldId));
  const counts = Object.fromEntries(
    REFLECTION_SUMMARY_SECTIONS.map((section) => [section.sectionId, 0])
  ) as Record<ReflectionSummarySectionId, number>;

  for (const response of responses) {
    const binding = resolveFieldBinding(response.fieldId, response.screenId);

    if (!binding || !registryFieldIds.has(binding.registryFieldId)) {
      continue;
    }

    counts[binding.sectionId] += 1;
  }

  return counts;
}
