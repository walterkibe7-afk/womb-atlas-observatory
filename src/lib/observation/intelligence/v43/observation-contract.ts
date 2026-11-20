/**
 * Single source of truth for Reflection Summary section architecture.
 * Every layer (questionnaire → extractor → preview → reflection → UI) references this contract.
 */

export const REFLECTION_SUMMARY_SECTION_IDS = [
  "context",
  "bleeding",
  "pain",
  "hormonal",
  "daily_life",
  "care",
  "narrative",
  "sensitive"
] as const;

export type ReflectionSummarySectionId = (typeof REFLECTION_SUMMARY_SECTION_IDS)[number];

export type ReflectionSummarySectionContract = {
  sectionId: ReflectionSummarySectionId;
  label: string;
  screenId: string;
  /** Normalized observation count key, e.g. contextObservations */
  observationCountKey: string;
  previewApiKey: string;
  reflectionPayloadKey: ReflectionSummarySectionId;
  reflectionResponseKey: ReflectionSummarySectionId;
  uiRendererKey: ReflectionSummarySectionId;
  questionnaireFieldIds: readonly string[];
  aikbRegistryCategories: readonly string[];
};

export type QuestionnaireFieldBinding = {
  appFieldId: string;
  registryFieldId: string;
  sectionId: ReflectionSummarySectionId;
  screenId?: string;
  label?: string;
};

export type NarrativeRoutingRule = {
  screenId: string;
  sectionId: ReflectionSummarySectionId;
  registryFieldId: string;
  promptIds?: readonly string[];
};

const registryCategoryAliases = new Map<string, ReflectionSummarySectionId>([
  ["context", "context"],
  ["context_chamber", "context"],
  ["onboarding", "context"],
  ["safety", "context"],
  ["demographic_and_cultural_chamber", "context"],
  ["reproductive_history", "context"],
  ["bleeding", "bleeding"],
  ["bleeding_patterns", "bleeding"],
  ["pain", "pain"],
  ["pain_and_discomfort", "pain"],
  ["hormonal", "hormonal"],
  ["cycles_and_body_rhythms", "hormonal"],
  ["daily_life", "daily_life"],
  ["daily_life_and_impact", "daily_life"],
  ["care", "care"],
  ["care_and_support", "care"],
  ["narrative", "narrative"],
  ["sensitive", "sensitive"],
  ["sensitive_topics", "sensitive"]
]);

export function normalizeRegistrySection(section: string): ReflectionSummarySectionId | string {
  const normalized = section
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return registryCategoryAliases.get(normalized) ?? normalized;
}

/** @deprecated Use normalizeRegistrySection — kept for transitional imports */
export const normalizeReviewSectionKey = normalizeRegistrySection;

export const REFLECTION_SUMMARY_SECTIONS: readonly ReflectionSummarySectionContract[] = [
  {
    sectionId: "context",
    label: "Context",
    screenId: "s05-context-intro",
    observationCountKey: "contextObservations",
    previewApiKey: "contextObservations",
    reflectionPayloadKey: "context",
    reflectionResponseKey: "context",
    uiRendererKey: "context",
    questionnaireFieldIds: [
      "age_range",
      "reproductive_state",
      "hormonal_contraception_status",
      "cultural_background",
      "current_country",
      "birth_country",
      "preferred_language",
      "family_history",
      "ever_pregnant",
      "pregnancy_count",
      "pregnancy_loss",
      "trying_to_conceive_12_months"
    ],
    aikbRegistryCategories: ["context", "demographic_and_cultural_chamber", "reproductive_history"]
  },
  {
    sectionId: "bleeding",
    label: "Bleeding",
    screenId: "s21-bleeding-patterns",
    observationCountKey: "bleedingObservations",
    previewApiKey: "bleedingObservations",
    reflectionPayloadKey: "bleeding",
    reflectionResponseKey: "bleeding",
    uiRendererKey: "bleeding",
    questionnaireFieldIds: [
      "bleeding_product_change_frequency",
      "bleeding_duration",
      "clot_size",
      "interperiod_bleeding",
      "bleeding_progression",
      "bleeding_impact"
    ],
    aikbRegistryCategories: ["bleeding", "bleeding_patterns"]
  },
  {
    sectionId: "pain",
    label: "Pain",
    screenId: "s29-pain-and-discomfort",
    observationCountKey: "painObservations",
    previewApiKey: "painObservations",
    reflectionPayloadKey: "pain",
    reflectionResponseKey: "pain",
    uiRendererKey: "pain",
    questionnaireFieldIds: [
      "pain_response",
      "pain_timing",
      "pain_location",
      "pain_duration",
      "pain_predictability",
      "pain_progression",
      "pelvic_body_function",
      "body_change_signals"
    ],
    aikbRegistryCategories: ["pain", "pain_and_discomfort"]
  },
  {
    sectionId: "hormonal",
    label: "Hormonal / Cycle",
    screenId: "s39-cycles-and-body-rhythms",
    observationCountKey: "hormonalObservations",
    previewApiKey: "hormonalObservations",
    reflectionPayloadKey: "hormonal",
    reflectionResponseKey: "hormonal",
    uiRendererKey: "hormonal",
    questionnaireFieldIds: [
      "cycle_predictability",
      "skipped_periods_frequency",
      "hormonal_signs",
      "cycle_changes",
      "symptoms_relation"
    ],
    aikbRegistryCategories: ["hormonal", "cycles_and_body_rhythms"]
  },
  {
    sectionId: "daily_life",
    label: "Daily Life",
    screenId: "s46-daily-life-and-impact",
    observationCountKey: "dailyLifeObservations",
    previewApiKey: "dailyLifeObservations",
    reflectionPayloadKey: "daily_life",
    reflectionResponseKey: "daily_life",
    uiRendererKey: "daily_life",
    questionnaireFieldIds: [
      "missed_activities",
      "fatigue_frequency",
      "sleep_disruption",
      "period_dizziness",
      "disruption_frequency",
      "life_areas_affected",
      "normalization_impact",
      "symptom_duration",
      "symptom_progression",
      "symptom_predictability"
    ],
    aikbRegistryCategories: ["daily_life", "daily_life_and_impact"]
  },
  {
    sectionId: "care",
    label: "Care Experience",
    screenId: "s57-care-and-support",
    observationCountKey: "careObservations",
    previewApiKey: "careObservations",
    reflectionPayloadKey: "care",
    reflectionResponseKey: "care",
    uiRendererKey: "care",
    questionnaireFieldIds: [
      "spoken_to_provider",
      "care_response",
      "care_dismissal",
      "access_to_care"
    ],
    aikbRegistryCategories: ["care", "care_and_support"]
  },
  {
    sectionId: "narrative",
    label: "Narrative",
    screenId: "s63-narrative-intro",
    observationCountKey: "narrativeObservations",
    previewApiKey: "narrativeObservations",
    reflectionPayloadKey: "narrative",
    reflectionResponseKey: "narrative",
    uiRendererKey: "narrative",
    questionnaireFieldIds: ["narrative_responses"],
    aikbRegistryCategories: ["narrative"]
  },
  {
    sectionId: "sensitive",
    label: "Sensitive Topics",
    screenId: "s66-sensitive-topics",
    observationCountKey: "sensitiveTopicObservations",
    previewApiKey: "sensitiveTopicObservations",
    reflectionPayloadKey: "sensitive",
    reflectionResponseKey: "sensitive",
    uiRendererKey: "sensitive",
    questionnaireFieldIds: [
      "pain_during_sex",
      "bowel_movement_pain",
      "unusual_discharge",
      "symptom_priority",
      "narrative_responses"
    ],
    aikbRegistryCategories: ["sensitive", "sensitive_topics"]
  }
] as const;

export const QUESTIONNAIRE_FIELD_BINDINGS: readonly QuestionnaireFieldBinding[] = [
  { appFieldId: "age_range", registryFieldId: "age_range", sectionId: "context" },
  {
    appFieldId: "reproductive_state",
    registryFieldId: "reproductive_state",
    sectionId: "context"
  },
  {
    appFieldId: "hormonal_contraception_status",
    registryFieldId: "hormonal_contraception",
    sectionId: "context"
  },
  {
    appFieldId: "cultural_background",
    registryFieldId: "cultural_background",
    sectionId: "context"
  },
  { appFieldId: "current_country", registryFieldId: "current_country", sectionId: "context" },
  { appFieldId: "birth_country", registryFieldId: "birth_country", sectionId: "context" },
  {
    appFieldId: "preferred_language",
    registryFieldId: "preferred_language",
    sectionId: "context"
  },
  { appFieldId: "family_history", registryFieldId: "family_history", sectionId: "context" },
  { appFieldId: "ever_pregnant", registryFieldId: "ever_pregnant", sectionId: "context" },
  { appFieldId: "pregnancy_count", registryFieldId: "pregnancy_count", sectionId: "context" },
  { appFieldId: "pregnancy_loss", registryFieldId: "pregnancy_loss", sectionId: "context" },
  {
    appFieldId: "trying_to_conceive_12_months",
    registryFieldId: "trying_to_conceive",
    sectionId: "context"
  },
  {
    appFieldId: "bleeding_product_change_frequency",
    registryFieldId: "product_change_freq",
    sectionId: "bleeding"
  },
  {
    appFieldId: "bleeding_duration",
    registryFieldId: "bleeding_duration",
    sectionId: "bleeding"
  },
  { appFieldId: "clot_size", registryFieldId: "clot_size", sectionId: "bleeding" },
  {
    appFieldId: "interperiod_bleeding",
    registryFieldId: "interperiod_bleeding",
    sectionId: "bleeding"
  },
  {
    appFieldId: "bleeding_progression",
    registryFieldId: "bleeding_progression",
    sectionId: "bleeding"
  },
  { appFieldId: "bleeding_impact", registryFieldId: "bleeding_impact", sectionId: "bleeding" },
  { appFieldId: "pain_response", registryFieldId: "pain_pattern", sectionId: "pain" },
  { appFieldId: "pain_timing", registryFieldId: "pain_timing", sectionId: "pain" },
  { appFieldId: "pain_location", registryFieldId: "pain_location", sectionId: "pain" },
  {
    appFieldId: "pain_duration",
    registryFieldId: "pain_duration",
    sectionId: "pain",
    label: "Pain Duration"
  },
  {
    appFieldId: "pain_predictability",
    registryFieldId: "pain_predictability",
    sectionId: "pain"
  },
  {
    appFieldId: "pain_progression",
    registryFieldId: "pain_severity_change",
    sectionId: "pain"
  },
  {
    appFieldId: "pelvic_body_function",
    registryFieldId: "pelvic_symptoms",
    sectionId: "pain"
  },
  {
    appFieldId: "body_change_signals",
    registryFieldId: "body_changes",
    sectionId: "pain"
  },
  {
    appFieldId: "cycle_predictability",
    registryFieldId: "cycle_predictability",
    sectionId: "hormonal"
  },
  {
    appFieldId: "skipped_periods_frequency",
    registryFieldId: "skipped_periods",
    sectionId: "hormonal"
  },
  { appFieldId: "hormonal_signs", registryFieldId: "hormonal_signs", sectionId: "hormonal" },
  { appFieldId: "cycle_changes", registryFieldId: "cycle_changes", sectionId: "hormonal" },
  {
    appFieldId: "symptoms_relation",
    registryFieldId: "symptoms_related_to",
    sectionId: "hormonal"
  },
  {
    appFieldId: "missed_activities",
    registryFieldId: "missed_activities",
    sectionId: "daily_life"
  },
  {
    appFieldId: "fatigue_frequency",
    registryFieldId: "fatigue_freq",
    sectionId: "daily_life"
  },
  {
    appFieldId: "sleep_disruption",
    registryFieldId: "sleep_disruption",
    sectionId: "daily_life"
  },
  {
    appFieldId: "period_dizziness",
    registryFieldId: "dizziness_freq",
    sectionId: "daily_life"
  },
  {
    appFieldId: "disruption_frequency",
    registryFieldId: "function_impact",
    sectionId: "daily_life"
  },
  {
    appFieldId: "life_areas_affected",
    registryFieldId: "life_areas",
    sectionId: "daily_life"
  },
  {
    appFieldId: "normalization_impact",
    registryFieldId: "normalcy_perception",
    sectionId: "daily_life"
  },
  {
    appFieldId: "symptom_duration",
    registryFieldId: "symptom_duration",
    sectionId: "daily_life"
  },
  {
    appFieldId: "symptom_progression",
    registryFieldId: "symptom_severity",
    sectionId: "daily_life"
  },
  {
    appFieldId: "symptom_predictability",
    registryFieldId: "symptom_predictability",
    sectionId: "daily_life"
  },
  {
    appFieldId: "spoken_to_provider",
    registryFieldId: "spoken_to_provider",
    sectionId: "care"
  },
  { appFieldId: "care_response", registryFieldId: "care_response", sectionId: "care" },
  { appFieldId: "care_dismissal", registryFieldId: "care_dismissal", sectionId: "care" },
  { appFieldId: "access_to_care", registryFieldId: "access_to_care", sectionId: "care" },
  {
    appFieldId: "pain_during_sex",
    registryFieldId: "pain_during_sex",
    sectionId: "sensitive"
  },
  {
    appFieldId: "bowel_movement_pain",
    registryFieldId: "bowel_symptoms",
    sectionId: "sensitive"
  },
  {
    appFieldId: "unusual_discharge",
    registryFieldId: "bladder_symptoms",
    sectionId: "sensitive"
  },
  {
    appFieldId: "symptom_priority",
    registryFieldId: "symptom_severity",
    sectionId: "sensitive"
  }
];

export const NARRATIVE_ROUTING_RULES: readonly NarrativeRoutingRule[] = [
  {
    screenId: "s64-narrative-chamber",
    sectionId: "narrative",
    registryFieldId: "narrative_prompts",
    promptIds: [
      "body_happening",
      "felt_experience",
      "daily_life_impact",
      "changed_over_time",
      "worries_frustrations"
    ]
  },
  {
    screenId: "s71-sensitive-narrative",
    sectionId: "sensitive",
    registryFieldId: "sensitive_narrative",
    promptIds: ["sensitive_something_else"]
  }
];

const sectionById = new Map(
  REFLECTION_SUMMARY_SECTIONS.map((section) => [section.sectionId, section] as const)
);

const bindingByAppField = new Map<string, QuestionnaireFieldBinding[]>();

for (const binding of QUESTIONNAIRE_FIELD_BINDINGS) {
  const existing = bindingByAppField.get(binding.appFieldId) ?? [];
  existing.push(binding);
  bindingByAppField.set(binding.appFieldId, existing);
}

export function getReflectionSummarySection(sectionId: ReflectionSummarySectionId) {
  const section = sectionById.get(sectionId);

  if (!section) {
    throw new Error(`Unknown reflection summary section: ${sectionId}`);
  }

  return section;
}

export function resolveFieldBinding(
  appFieldId: string,
  screenId?: string
): QuestionnaireFieldBinding | undefined {
  if (appFieldId === "narrative_responses" && screenId) {
    const narrativeRule = NARRATIVE_ROUTING_RULES.find((rule) => rule.screenId === screenId);

    if (narrativeRule) {
      return {
        appFieldId,
        registryFieldId: narrativeRule.registryFieldId,
        sectionId: narrativeRule.sectionId,
        screenId
      };
    }
  }

  const bindings = bindingByAppField.get(appFieldId);
  return bindings?.[0];
}

export function buildSectionCountRecord(
  counts: Partial<Record<ReflectionSummarySectionId, number>>
): Record<string, number> {
  const record: Record<string, number> = {};

  for (const section of REFLECTION_SUMMARY_SECTIONS) {
    record[section.observationCountKey] = counts[section.sectionId] ?? 0;
  }

  return record;
}

export function buildReflectionSummaryPayload(
  counts: Partial<Record<ReflectionSummarySectionId, number>>
): Record<ReflectionSummarySectionId, number> {
  const payload = {} as Record<ReflectionSummarySectionId, number>;

  for (const sectionId of REFLECTION_SUMMARY_SECTION_IDS) {
    payload[sectionId] = counts[sectionId] ?? 0;
  }

  return payload;
}

export const REFLECTION_SUMMARY_QUESTIONNAIRE_FIELD_IDS = [
  ...new Set(
    REFLECTION_SUMMARY_SECTIONS.flatMap((section) => [...section.questionnaireFieldIds])
  )
];
