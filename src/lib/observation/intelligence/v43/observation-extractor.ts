import { firstObservationScreens } from "./screen-register-first-observation";
import type { NarrativePromptResponse, ObservationResponseDraft } from "./first-observation-types";
import type { AikbBundle } from "@/lib/observation/aikb/types";
import {
  NARRATIVE_ROUTING_RULES,
  REFLECTION_SUMMARY_SECTIONS,
  type ReflectionSummarySectionId,
  resolveFieldBinding
} from "./observation-contract";
import { logObservationPipelineTrace } from "./observation-debug";
import type {
  AtlasObservationRecord,
  ObservationPipelineTrace,
  ObservedExperienceReviewSection,
  ReflectionSummarySectionCounts
} from "./types";

const ignoredValues = new Set(["none", "prefer_not_to_say", "not_applicable"]);

const optionLabelByFieldAndValue = new Map(
  firstObservationScreens.flatMap((screen) =>
    screen.fields.flatMap((field) =>
      (field.options ?? []).map(
        (option) => [`${field.id}:${option.value}`, option.label] as const
      )
    )
  )
);

const screenIdByFieldId = new Map(
  firstObservationScreens.flatMap((screen) =>
    screen.fields.map((field) => [field.id, screen.id] as const)
  )
);

const fieldLabelById = new Map(
  firstObservationScreens.flatMap((screen) =>
    screen.fields.map((field) => [field.id, field.label] as const)
  )
);

// `fieldTranslations` is the same OPTION.*/QUESTION.* map the observation
// wizard itself already renders from (loadTranslationMap("first_observation",
// locale) — DB-backed, already seeded for every locale the wizard supports).
// Reusing it here means the "evidence" bullets speak the same language as the
// question the participant actually answered, with zero new content to author.
function readableValue(fieldId: string, value: string, fieldTranslations?: Record<string, string>) {
  return (
    fieldTranslations?.[`OPTION.${fieldId}.${value}.label`] ??
    optionLabelByFieldAndValue.get(`${fieldId}:${value}`) ??
    value.replaceAll("_", " ")
  );
}

function nextSequentialObservationId(index: number) {
  return `OBS-${String(index + 1).padStart(3, "0")}`;
}

function isNarrativePromptResponse(value: unknown): value is NarrativePromptResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "promptId" in value &&
    "textResponse" in value
  );
}

function countQuestionnaireAnswers(
  responses: ObservationResponseDraft[]
): Record<ReflectionSummarySectionId, number> {
  const counts = Object.fromEntries(
    REFLECTION_SUMMARY_SECTIONS.map((section) => [section.sectionId, 0])
  ) as Record<ReflectionSummarySectionId, number>;

  for (const response of responses) {
    if (response.fieldId === "narrative_responses" && Array.isArray(response.value)) {
      const rule = NARRATIVE_ROUTING_RULES.find((item) => item.screenId === response.screenId);

      if (!rule) {
        continue;
      }

      for (const item of response.value) {
        if (!isNarrativePromptResponse(item)) {
          continue;
        }

        if (!item.textResponse.trim()) {
          continue;
        }

        if (rule.promptIds && !rule.promptIds.includes(item.promptId)) {
          continue;
        }

        counts[rule.sectionId] += 1;
      }

      continue;
    }

    const binding = resolveFieldBinding(response.fieldId, response.screenId);

    if (!binding) {
      continue;
    }

    const values = Array.isArray(response.value)
      ? response.value.filter((item): item is string => typeof item === "string")
      : typeof response.value === "string"
        ? [response.value]
        : [];

    counts[binding.sectionId] += values.filter((value) => !ignoredValues.has(value)).length;
  }

  return counts;
}

function resolveRegistryMeta(
  binding: NonNullable<ReturnType<typeof resolveFieldBinding>>,
  aikb: AikbBundle
) {
  const registryField = aikb.observations.fields.find(
    (field) => field.fieldId === binding.registryFieldId
  );

  if (registryField) {
    return registryField;
  }

  return {
    observationId: undefined,
    fieldId: binding.registryFieldId,
    section: binding.sectionId,
    label: binding.label ?? fieldLabelById.get(binding.appFieldId) ?? binding.appFieldId
  };
}

export type ObservationExtractionResult = {
  observations: AtlasObservationRecord[];
  reviewSections: ObservedExperienceReviewSection[];
  sectionCounts: ReflectionSummarySectionCounts;
  trace: ObservationPipelineTrace;
  unmatchedResponses: ObservationResponseDraft[];
};

export function extractObservationsFromResponses(
  responses: ObservationResponseDraft[],
  aikb: AikbBundle,
  fieldTranslations?: Record<string, string>
): ObservationExtractionResult {
  const observations: AtlasObservationRecord[] = [];
  const unmatchedResponses: ObservationResponseDraft[] = [];
  const registryMatches = new Map<ReflectionSummarySectionId, number>();
  let counter = 0;

  for (const section of REFLECTION_SUMMARY_SECTIONS) {
    registryMatches.set(section.sectionId, 0);
  }

  for (const response of responses) {
    if (response.fieldId === "narrative_responses" && Array.isArray(response.value)) {
      const binding = resolveFieldBinding(response.fieldId, response.screenId);

      if (!binding) {
        unmatchedResponses.push(response);
        continue;
      }

      const meta = resolveRegistryMeta(binding, aikb);
      const label = fieldTranslations?.[`QUESTION.${response.fieldId}.questionText`] ?? meta.label;
      const narrativeRule = NARRATIVE_ROUTING_RULES.find(
        (rule) => rule.screenId === response.screenId
      );

      for (const item of response.value) {
        if (!isNarrativePromptResponse(item) || !item.textResponse.trim()) {
          continue;
        }

        if (narrativeRule?.promptIds && !narrativeRule.promptIds.includes(item.promptId)) {
          continue;
        }

        observations.push({
          id: nextSequentialObservationId(counter++),
          fieldId: response.fieldId,
          registryFieldId: binding.registryFieldId,
          section: binding.sectionId,
          label,
          // The participant's own typed/spoken narrative text — already in
          // whatever language they wrote it in, nothing to translate here.
          value: "narrative_entry",
          displayText: item.textResponse.trim().slice(0, 120),
          screenId: response.screenId
        });
        registryMatches.set(
          binding.sectionId,
          (registryMatches.get(binding.sectionId) ?? 0) + 1
        );
      }

      continue;
    }

    const binding = resolveFieldBinding(response.fieldId, response.screenId);

    if (!binding) {
      unmatchedResponses.push(response);
      continue;
    }

    const meta = resolveRegistryMeta(binding, aikb);
    const label = fieldTranslations?.[`QUESTION.${response.fieldId}.questionText`] ?? meta.label;
    const values = Array.isArray(response.value)
      ? response.value.filter((item): item is string => typeof item === "string")
      : typeof response.value === "string"
        ? [response.value]
        : [];

    for (const value of values) {
      if (ignoredValues.has(value)) {
        continue;
      }

      observations.push({
        id: nextSequentialObservationId(counter++),
        fieldId: response.fieldId,
        registryFieldId: binding.registryFieldId,
        section: binding.sectionId,
        label,
        displayText: `${label}: ${readableValue(response.fieldId, value, fieldTranslations)}`,
        value,
        screenId: response.screenId || screenIdByFieldId.get(response.fieldId) || ""
      });
      registryMatches.set(
        binding.sectionId,
        (registryMatches.get(binding.sectionId) ?? 0) + 1
      );
    }
  }

  const questionnaireCounts = countQuestionnaireAnswers(responses);
  const normalizedCounts = Object.fromEntries(
    REFLECTION_SUMMARY_SECTIONS.map((section) => [
      section.sectionId,
      observations.filter((observation) => observation.section === section.sectionId).length
    ])
  ) as Record<ReflectionSummarySectionId, number>;

  const reviewSections = buildObservedExperienceReview(observations);
  const previewCounts = Object.fromEntries(
    reviewSections.map((section) => {
      const contract = REFLECTION_SUMMARY_SECTIONS.find((item) => item.label === section.label);
      return [contract?.sectionId ?? section.label, section.count];
    })
  ) as Record<ReflectionSummarySectionId, number>;

  const sectionCounts: ReflectionSummarySectionCounts = {
    questionnaire: questionnaireCounts,
    normalized: normalizedCounts,
    registryMatches: Object.fromEntries(registryMatches) as Record<
      ReflectionSummarySectionId,
      number
    >,
    preview: previewCounts,
    reflectionPayload: normalizedCounts,
    reflectionResponse: normalizedCounts,
    uiRendered: previewCounts
  };

  const trace: ObservationPipelineTrace = {
    sectionCounts,
    unmatchedResponses: unmatchedResponses.map((response) => ({
      screenId: response.screenId,
      fieldId: response.fieldId
    })),
    observationCount: observations.length,
    responseCount: responses.length
  };

  logObservationPipelineTrace(trace);

  return {
    observations,
    reviewSections,
    sectionCounts,
    trace,
    unmatchedResponses
  };
}

export function buildObservedExperienceReview(
  observations: AtlasObservationRecord[]
): ObservedExperienceReviewSection[] {
  return REFLECTION_SUMMARY_SECTIONS.map((section) => {
    const sectionObservations = observations.filter(
      (observation) => observation.section === section.sectionId
    );

    return {
      sectionId: section.sectionId,
      label: section.label,
      screenId: section.screenId,
      count: sectionObservations.length,
      statusText:
        sectionObservations.length > 0
          ? `${sectionObservations.length} observation${
              sectionObservations.length === 1 ? "" : "s"
            } identified`
          : "No observations identified yet",
      observations: sectionObservations.map((observation) => ({
        id: observation.id,
        displayText: observation.displayText
      }))
    };
  });
}

/** @deprecated Use extractObservationsFromResponses */
export function mapQuestionnaireToObservations(
  responses: ObservationResponseDraft[],
  aikb: AikbBundle
) {
  return extractObservationsFromResponses(responses, aikb).observations;
}
