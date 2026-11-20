import { firstObservationScreens } from "./screen-register-first-observation";
import {
  REFLECTION_SUMMARY_SECTIONS,
  type ReflectionSummarySectionId
} from "./observation-contract";
import {
  buildAtlasRecordV43,
  findRelatedPattern,
  type AtlasArchetype,
  type AtlasExperienceLayer,
  type AtlasPatternConnection,
  type AtlasReflectionCompass,
  type AtlasReflectionContent,
  type AtlasSignalLandscape,
  type AtlasStrength
} from "./atlas-intelligence-v43";
import observationsRegistry from "@/content/aikb/observations.json";
import { extractObservationsFromResponses } from "./observation-extractor";
import { createMinimalAikbBundle } from "./observation-debug";
import {
  buildOntologyRoutingContext,
  canonicalScientificName,
  participantLabelFor,
  toAtlasObservedPatterns
} from "./pattern-ontology";
import { v43Text } from "./v43-i18n";
import type {
  NarrativePromptResponse,
  ObservationResponseDraft,
  ObservationResponseValue
} from "./first-observation-types";

export type {
  AtlasArchetype,
  AtlasExperienceLayer,
  AtlasPatternConnection,
  AtlasReflectionCompass,
  AtlasReflectionContent,
  AtlasSignalLandscape,
  AtlasStrength
};
export {
  buildReflectionCompass,
  detectArchetype,
  detectExperienceLayers,
  detectPatternConnections,
  detectSignalLandscape,
  detectStrengths
} from "./atlas-intelligence-v43";

export type AtlasSignal = {
  fieldId: string;
  fieldLabel: string;
  value: string;
  section: AtlasSectionKey;
};

export type AtlasSectionKey =
  | "context"
  | "bleeding"
  | "pain"
  | "hormonal"
  | "daily_life"
  | "care"
  | "narrative"
  | "sensitive";

export type AtlasNarrativeSignal = {
  name: string;
  summary: string;
  supportingTheme: string;
  patternNames: string[];
};

export type AtlasMeaning = {
  name: string;
  explanation: string;
};

export type AtlasBodyLiteracy = {
  title: string;
  note: string;
};

export type AtlasObservedPattern = {
  name: string;
  participantLabel?: string;
  plainLanguageMeaning: string;
  supportingSignals: string[];
  atlasNote: string;
  whatAtlasObserved: string;
  whyAtlasConnected: string;
  watchOverTime: string;
};

export type AtlasReflection = {
  snapshot: string;
  paragraphs: string[];
  bodyLiteracyNote: string;
  closingAgency: string;
};

export type AtlasRecord = {
  generatedAt: string;
  observationPortrait: string;
  dominantPattern: string | null;
  supportingPatterns: string[];
  archetype: AtlasArchetype;
  signalLandscape: AtlasSignalLandscape;
  experienceLayers: AtlasExperienceLayer[];
  patternConnections: AtlasPatternConnection[];
  strengths: AtlasStrength[];
  reflectionCompass: AtlasReflectionCompass;
  reflectionContent: AtlasReflectionContent;
  subduedPatterns: string[];
  subduedPatternMessages: string[];
  observedPatterns: AtlasObservedPattern[];
  constellationPatterns: AtlasObservedPattern[];
  narrativeThemes: string[];
  reflection: AtlasReflection;
  bodyLiteracyNote: string;
  whatAtlasWillWatch: string[];
  disclaimer: string;
  reflectionSummary?: Record<ReflectionSummarySectionId, number>;
};

export type AtlasConstellationNode = {
  id: string;
  name: string;
  whatAtlasObserved: string;
};

export type AtlasPatternPopup = {
  patternName: string;
  whatAtlasObserved: string;
  whyAtlasConnected: string;
  atlasNote: string;
  relatedPattern: string | null;
  watchOverTime: string;
  supportingObservations: string[];
};

export type AtlasObservedPatternCard = {
  name: string;
  whatAtlasObserved: string;
  plainLanguageMeaning: string;
  relatedPattern: string | null;
  supportingObservations: string[];
  atlasNote: string;
  watchOverTime?: string;
};

export type AtlasDownloadRecord = {
  observationPortrait: string;
  dominantPattern: string | null;
  supportingPatterns: string[];
  atlasArchetype: string | null;
  signalLandscape: string | null;
  experienceLayers: string[];
  strengthsObserved: string[];
  reflectionCompass: AtlasReflectionCompass;
  observedPatterns: AtlasObservedPatternCard[];
  narrativeThemes: string[];
  reflection: string[];
  bodyLiteracyNote: string;
  whatAtlasWillWatchOverTime: string[];
  nonDiagnosticDisclaimer: string;
};

export type AtlasSectionReviewCount = {
  label: string;
  screenId: string;
  count: number;
  noun: string;
  statusText: string;
};

type NarrativeSignalDefinition = {
  name: string;
  keywords: string[];
  summary: string;
  patternNames: string[];
};

const noMeaningfulPatternFallback =
  "This first Atlas Record creates a starting point. Some patterns may become clearer as future observations are added.";

const sectionFieldIds: Record<AtlasSectionKey, string[]> = Object.fromEntries(
  REFLECTION_SUMMARY_SECTIONS.map((section) => [
    section.sectionId,
    [...section.questionnaireFieldIds].filter((fieldId) => fieldId !== "narrative_responses")
  ])
) as Record<AtlasSectionKey, string[]>;

const fieldLabelById = new Map(
  firstObservationScreens.flatMap((screen) =>
    screen.fields.map((field) => [field.id, field.label] as const)
  )
);

const optionLabelByFieldAndValue = new Map(
  firstObservationScreens.flatMap((screen) =>
    screen.fields.flatMap((field) =>
      (field.options ?? []).map(
        (option) => [`${field.id}:${option.value}`, option.label] as const
      )
    )
  )
);

const sectionByFieldId = new Map(
  Object.entries(sectionFieldIds).flatMap(([section, fieldIds]) =>
    fieldIds.map((fieldId) => [fieldId, section as AtlasSectionKey] as const)
  )
);

// AI Stack Layer: Narrative Signal Registry
// Source: v4.2 tab 16_Narrative_Signal_Registry
// Deterministic MVP extraction. This function is isolated so it can later call an
// AI model without changing UI components.
const narrativeSignalRegistry: NarrativeSignalDefinition[] = [
  {
    name: "Unpredictability",
    keywords: ["never know", "comes out of nowhere", "can't plan", "surprise", "unpredictable"],
    summary: "Your own words suggest unpredictability may be part of the burden.",
    patternNames: ["Bleeding Burden", "Daily Function", "Body Unpredictability"]
  },
  {
    name: "Vigilance / Preparedness",
    keywords: ["carry extra", "check constantly", "bring clothes", "watch for leaks", "prepared"],
    summary: "Your narrative points to the hidden work of staying prepared.",
    patternNames: ["Bleeding Burden", "Planning Around Symptoms"]
  },
  {
    name: "Avoidance / Withdrawal",
    keywords: ["stay home", "don't go out", "avoid", "cancel plans", "miss work", "miss school"],
    summary: "Your narrative suggests symptoms may be changing what feels possible day to day.",
    patternNames: ["Daily Function", "Pain Distribution", "Pelvic Function"]
  },
  {
    name: "Dismissal / Not Believed",
    keywords: ["dismissed", "not believed", "told it is normal", "ignored", "no one believes"],
    summary: "Your narrative includes care friction or difficulty feeling heard.",
    patternNames: ["Care Experience"]
  },
  {
    name: "Frustration / Exhaustion",
    keywords: ["tired of this", "frustrating", "exhausted", "fed up", "draining"],
    summary: "Your tone suggests this has taken energy to carry.",
    patternNames: ["Daily Function", "Care Experience", "Body Unpredictability"]
  },
  {
    name: "Loss of Control",
    keywords: ["my body decides", "no control", "trapped", "can't trust my body"],
    summary: "Your narrative suggests body uncertainty or loss of predictability.",
    patternNames: ["Body Unpredictability", "Life Reorganization"]
  },
  {
    name: "Identity / Body Change Concern",
    keywords: ["clothes don't fit", "swollen", "not myself", "body changed", "feel different"],
    summary: "Your narrative notices body change as part of the health story.",
    patternNames: ["Pelvic Function", "Hormonal Rhythm", "Life Reorganization"]
  }
];

// AI Stack Layer: Meaning Registry
// Source: v4.2 tab 17_Meaning_Registry
// Translates detected patterns into participant-facing meaning.
const meaningRegistry: Record<string, AtlasMeaning> = {
  "Bleeding Burden": {
    name: "Bleeding Beyond Volume",
    explanation:
      "Bleeding can matter because of how it affects energy, preparation, sleep, movement, and daily routines, not only because of amount."
  },
  "Pain Distribution": {
    name: "Connected Pelvic Systems",
    explanation:
      "Pain may not be one isolated event. It can be useful to notice timing, movement, bowel, bladder, and pelvic-function connections."
  },
  "Pelvic Function": {
    name: "Connected Pelvic Systems",
    explanation:
      "Pressure or fullness can feel separate from bladder, bowel, movement, or body-change signals until they are viewed together."
  },
  "Hormonal Rhythm": {
    name: "Rhythm Change",
    explanation:
      "Cycle rhythm is more than dates. Timing changes may appear alongside skin, hair, energy, mood, or body-change signals."
  },
  "Daily Function": {
    name: "Daily Life Impact",
    explanation:
      "A body pattern becomes more important when it starts reorganizing daily life, even if each single symptom seems manageable."
  },
  "Life Reorganization": {
    name: "Life Reorganization",
    explanation:
      "When multiple observations converge, symptoms may reorganize work, rest, movement, and daily life together."
  },
  "Care Experience": {
    name: "Care Experience as Data",
    explanation:
      "Feeling unheard or not getting answers can change how long symptoms go untracked, untreated, or normalized."
  },
  "Body Unpredictability": {
    name: "Uncertainty as Burden",
    explanation:
      "Not knowing what your body will do next can become part of the experience. Uncertainty can affect planning, trust in timing, and care-seeking."
  }
};

// AI Stack Layer: Body Literacy Library
// Source: v4.2 tab 18_Body_Literacy_Library
// Short educational notes selected from pattern meaning.
const bodyLiteracyLibrary: Record<string, AtlasBodyLiteracy> = {
  "Bleeding Burden": {
    title: "Bleeding is more than volume",
    note:
      "Atlas Note: Bleeding impact is not only amount. It includes recovery, routines, sleep, travel, and feeling prepared."
  },
  "Pain Distribution": {
    title: "Pelvic symptoms can connect",
    note:
      "Atlas Note: Mapping where pain appears can reveal whether a body pattern is staying local or spreading across routines and functions."
  },
  "Pelvic Function": {
    title: "Pelvic symptoms can connect",
    note:
      "Atlas Note: Pressure symptoms can feel unrelated until they are viewed as a cluster across bladder, bowel, and movement."
  },
  "Hormonal Rhythm": {
    title: "Rhythm is more than dates",
    note:
      "Atlas Note: Rhythm changes can show up as timing, skin, hair, energy, mood, or weight-pattern changes, not just missed periods."
  },
  "Daily Function": {
    title: "Impact is evidence",
    note:
      "Atlas Note: Impact is part of the record when symptoms change sleep, work, school, care, relationships, or movement."
  },
  "Life Reorganization": {
    title: "Living around symptoms",
    note:
      "Atlas Note: When multiple observations converge, daily life may reorganize around what the body is doing."
  },
  "Care Experience": {
    title: "Care experience shapes the record",
    note:
      "Atlas Note: Care experience can shape what a person tracks, delays, normalizes, or stops mentioning."
  },
  "Body Unpredictability": {
    title: "Uncertainty has weight",
    note:
      "Atlas Note: Understanding patterns can reduce the feeling that symptoms are random."
  },
  Baseline: {
    title: "A baseline is powerful",
    note:
      "Atlas Note: A first observation does not need to solve everything. It gives your future self something to compare against."
  }
};

// Pattern detection: see ./pattern-ontology.ts (AIKB v1.0)

function isNarrativeArray(
  value: ObservationResponseValue
): value is NarrativePromptResponse[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "promptText" in item &&
        "textResponse" in item
    )
  );
}

function narrativeResponses(
  responses: ObservationResponseDraft[]
): NarrativePromptResponse[] {
  return responses
    .filter((response) => response.fieldId === "narrative_responses")
    .flatMap((response) => (isNarrativeArray(response.value) ? response.value : []))
    .filter((item) => item.completed && item.textResponse.trim().length > 0);
}

function rawValuesForField(
  responses: ObservationResponseDraft[],
  fieldId: string
): string[] {
  const value = responses.find((response) => response.fieldId === fieldId)?.value ?? null;

  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.filter((item) => isMeaningfulValue(item));
  }

  return typeof value === "string" && isMeaningfulValue(value) ? [value] : [];
}

function isMeaningfulValue(value: string) {
  return !["none", "prefer_not_to_say", "not_applicable"].includes(value);
}

function readableValue(fieldId: string, value: string) {
  return (
    optionLabelByFieldAndValue.get(`${fieldId}:${value}`) ??
    value.replaceAll("_", " ")
  );
}

function patternId(name: string) {
  return name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/(^-|-$)/g, "");
}

export function extractSupportingObservations(signals: string[]): string[] {
  return signals.filter((signal) => signal.includes(":"));
}

export function detectPatternRelationships(patterns: AtlasObservedPattern[]): string[] {
  if (patterns.length < 2) {
    return patterns[0] ? [patterns[0].whyAtlasConnected] : [];
  }

  return patterns.slice(0, 3).map((pattern, index) => {
    const nextPattern = patterns[index + 1];

    return nextPattern
      ? `${pattern.name} may be connected with ${nextPattern.name} because the same experience can show up across body signals, daily routines, and care needs.`
      : pattern.whyAtlasConnected;
  });
}

export function identifyTrajectoryChange(patterns: AtlasObservedPattern[]): string[] {
  if (patterns.length === 0) {
    return [
      "Future observations will help Atlas understand what remains stable, what changes, and what patterns emerge over time."
    ];
  }

  return patterns.map((pattern) => pattern.watchOverTime);
}

export function extractStructuredSignals(
  responses: ObservationResponseDraft[]
): AtlasSignal[] {
  return responses.flatMap((response) => {
    if (response.fieldId === "narrative_responses") {
      return [];
    }

    const section = sectionByFieldId.get(response.fieldId) ?? "context";

    return rawValuesForField(responses, response.fieldId).map((value) => ({
      fieldId: response.fieldId,
      fieldLabel: fieldLabelById.get(response.fieldId) ?? response.fieldId.replaceAll("_", " "),
      value: readableValue(response.fieldId, value),
      section
    }));
  });
}

export function extractNarrativeSignals(
  responses: ObservationResponseDraft[]
): AtlasNarrativeSignal[] {
  const narrativeText = narrativeResponses(responses)
    .map((response) => response.textResponse)
    .join(" ")
    .toLowerCase();

  if (!narrativeText.trim()) {
    return [];
  }

  return narrativeSignalRegistry
    .filter((definition) =>
      definition.keywords.some((keyword) => narrativeText.includes(keyword))
    )
    .map((definition) => ({
      name: definition.name,
      summary: definition.summary,
      supportingTheme: definition.summary,
      patternNames: definition.patternNames
    }));
}

export function detectPatterns(
  responses: ObservationResponseDraft[],
  _structuredSignals = extractStructuredSignals(responses),
  narrativeSignals = extractNarrativeSignals(responses),
  locale?: string,
  fieldTranslations?: Record<string, string>
): AtlasObservedPattern[] {
  const extraction = extractObservationsFromResponses(
    responses,
    createMinimalAikbBundle(observationsRegistry),
    fieldTranslations
  );
  const ontologyContext = buildOntologyRoutingContext(extraction.observations, locale);
  const patterns = toAtlasObservedPatterns(ontologyContext, locale);

  if (narrativeSignals.length === 0) {
    return patterns;
  }

  return patterns.map((pattern) => {
    const narrativeSupport = narrativeSignals
      .filter((signal) =>
        signal.patternNames.some(
          (name) => canonicalScientificName(name) === canonicalScientificName(pattern.name)
        )
      )
      .map((signal) => signal.summary);

    if (narrativeSupport.length === 0) {
      return pattern;
    }

    return {
      ...pattern,
      supportingSignals: [...pattern.supportingSignals, ...narrativeSupport].slice(0, 6)
    };
  });
}

export function selectMeanings(patterns: AtlasObservedPattern[], locale?: string): AtlasMeaning[] {
  return patterns
    .map((pattern) => {
      const key = canonicalScientificName(pattern.name);
      const meaning = meaningRegistry[key];
      if (!meaning) return meaning;
      // `key` (the registry's own English scientific-name key) is the lookup
      // key here, not a value being displayed — never translate it.
      return {
        name: v43Text(key, "meaningName", meaning.name, locale),
        explanation: v43Text(key, "explanation", meaning.explanation, locale)
      };
    })
    .filter((meaning): meaning is AtlasMeaning => Boolean(meaning));
}

export function selectBodyLiteracy(
  patterns: AtlasObservedPattern[],
  locale?: string
): AtlasBodyLiteracy[] {
  const translateLiteracy = (key: string, literacy: AtlasBodyLiteracy): AtlasBodyLiteracy => ({
    title: v43Text(key, "literacyTitle", literacy.title, locale),
    note: v43Text(key, "literacyNote", literacy.note, locale)
  });

  if (patterns.length === 0) {
    return [translateLiteracy("Baseline", bodyLiteracyLibrary.Baseline)];
  }

  return patterns
    .map((pattern) => {
      const key = canonicalScientificName(pattern.name);
      const literacy = bodyLiteracyLibrary[key];
      return literacy ? translateLiteracy(key, literacy) : literacy;
    })
    .filter((literacy): literacy is AtlasBodyLiteracy => Boolean(literacy));
}

// AI Stack Layer: Reflection Composition Engine
// Source: v4.2 tab 19_Reflection_Composition
export function composeReflection(
  patterns: AtlasObservedPattern[],
  narrativeSignals: AtlasNarrativeSignal[],
  meanings: AtlasMeaning[],
  bodyLiteracy: AtlasBodyLiteracy[],
  locale?: string
): AtlasReflection {
  const dominantPattern = patterns[0];
  const supportingPattern = patterns[1];
  const narrativeTheme = narrativeSignals[0]?.summary;
  const primaryMeaning = meanings[0]?.explanation;
  const baselineNote = v43Text("Baseline", "literacyNote", bodyLiteracyLibrary.Baseline.note, locale);
  const primaryLiteracy = bodyLiteracy[0] ?? { ...bodyLiteracyLibrary.Baseline, note: baselineNote };

  const t = (field: string, fallback: string) => v43Text("_template", field, fallback, locale);

  if (!dominantPattern) {
    const fallback = t("noMeaningfulPattern", noMeaningfulPatternFallback);
    return {
      snapshot: fallback,
      paragraphs: [
        t("respectfulBaseline", "Atlas created a respectful baseline from what you chose to share today."),
        fallback,
        baselineNote
      ],
      bodyLiteracyNote: baselineNote,
      closingAgency: t(
        "closingAgency",
        "You can save this record, return to it, or use it to explain your experience in your own words."
      )
    };
  }

  const dominantLabel = patterns[0].participantLabel ?? participantLabelFor(patterns[0].name, locale);
  const supportingLabel = supportingPattern
    ? (supportingPattern.participantLabel ?? participantLabelFor(supportingPattern.name, locale))
    : null;

  const snapshotParts = [
    `${t("organizedAround", "Atlas organized this first reflection around")} ${dominantLabel}.`,
    supportingLabel
      ? `${t("relatedThread", "A related thread,")} ${supportingLabel}, ${t("mayHelpExplain", "may help explain how these experiences connect.")}`
      : null,
    narrativeTheme ?? null
  ].filter(Boolean);

  return {
    snapshot: snapshotParts.join(" "),
    paragraphs: [
      `${dominantPattern.whatAtlasObserved} ${dominantPattern.plainLanguageMeaning}`,
      supportingLabel
        ? `${supportingLabel} ${t("addsAnotherLayer", "adds another layer:")} ${supportingPattern!.plainLanguageMeaning}`
        : t("staysClose", "This reflection stays close to what was observed today and leaves room for future comparison."),
      primaryMeaning ?? dominantPattern.plainLanguageMeaning,
      narrativeTheme ?? t("keepWatching", "Atlas will keep watching how these experiences connect over time.")
    ],
    bodyLiteracyNote: primaryLiteracy.note,
    closingAgency: t(
      "closingAgency",
      "You can save this record, return to it, or use it to explain your experience in your own words."
    )
  };
}

export function buildConstellationNodes(
  patterns: AtlasObservedPattern[]
): AtlasConstellationNode[] {
  return patterns.slice(0, 6).map((pattern) => ({
    id: patternId(pattern.name),
    name: pattern.name,
    whatAtlasObserved: pattern.whatAtlasObserved
  }));
}

export function buildPatternPopup(
  pattern: AtlasObservedPattern,
  connections: AtlasPatternConnection[] = [],
  patterns: AtlasObservedPattern[] = []
): AtlasPatternPopup {
  return {
    patternName: pattern.name,
    whatAtlasObserved: pattern.whatAtlasObserved,
    whyAtlasConnected: pattern.whyAtlasConnected,
    atlasNote: pattern.atlasNote,
    relatedPattern: findRelatedPattern(pattern.name, connections, patterns),
    watchOverTime: pattern.watchOverTime,
    supportingObservations: extractSupportingObservations(pattern.supportingSignals)
  };
}

export function buildObservedPatternCards(
  patterns: AtlasObservedPattern[],
  connections: AtlasPatternConnection[] = [],
  locale?: string
): AtlasObservedPatternCard[] {
  return patterns.map((pattern) => {
    const relatedPatternName = findRelatedPattern(pattern.name, connections, patterns);
    const relatedPattern = relatedPatternName
      ? (patterns.find((candidate) => candidate.name === relatedPatternName)?.participantLabel ??
        participantLabelFor(relatedPatternName, locale))
      : null;

    return {
      name: pattern.participantLabel ?? participantLabelFor(pattern.name, locale),
      whatAtlasObserved: pattern.whatAtlasObserved,
      plainLanguageMeaning: pattern.plainLanguageMeaning,
      relatedPattern,
      supportingObservations: extractSupportingObservations(pattern.supportingSignals),
      atlasNote: pattern.atlasNote,
      watchOverTime: pattern.watchOverTime
    };
  });
}

export function buildDownloadRecord(record: AtlasRecord, locale?: string): AtlasDownloadRecord {
  return {
    observationPortrait: record.observationPortrait,
    dominantPattern: record.dominantPattern,
    supportingPatterns: record.supportingPatterns,
    atlasArchetype: record.archetype.name,
    signalLandscape: record.signalLandscape.label ?? record.signalLandscape.name,
    experienceLayers: record.experienceLayers.map((layer) => layer.label ?? layer.name),
    strengthsObserved: record.strengths.map((strength) => strength.label ?? strength.name),
    reflectionCompass: record.reflectionCompass,
    observedPatterns: buildObservedPatternCards(
      record.observedPatterns,
      record.patternConnections,
      locale
    ),
    narrativeThemes: record.narrativeThemes,
    reflection: [
      record.reflectionContent.openingInsight,
      record.reflectionContent.whatExperienceMayMean,
      ...record.reflectionContent.whatAppearsConnected,
      ...record.reflectionContent.strengthsObserved
    ],
    bodyLiteracyNote: record.bodyLiteracyNote,
    whatAtlasWillWatchOverTime: record.whatAtlasWillWatch,
    nonDiagnosticDisclaimer: record.disclaimer
  };
}

export function buildAtlasRecord(
  responses: ObservationResponseDraft[],
  locale?: string,
  fieldTranslations?: Record<string, string>
): AtlasRecord {
  const structuredSignals = extractStructuredSignals(responses);
  const narrativeSignals = extractNarrativeSignals(responses);
  const patterns = detectPatterns(responses, structuredSignals, narrativeSignals, locale, fieldTranslations);
  const meanings = selectMeanings(patterns, locale);
  const bodyLiteracy = selectBodyLiteracy(patterns, locale);
  const reflection = composeReflection(patterns, narrativeSignals, meanings, bodyLiteracy, locale);
  const v43 = buildAtlasRecordV43({
    responses,
    structuredSignals,
    narrativeSignals,
    patterns,
    bodyLiteracyNote: reflection.bodyLiteracyNote,
    locale
  });
  const narrativeIntelligence = v43.narrativeIntelligence;
  // Participant labels, not raw scientific names — this was already a latent
  // bug (English registry names leaking into observationPortrait regardless
  // of locale) independent of translation; fixed as part of the same pass.
  const dominantNames = patterns
    .slice(0, 3)
    .map((pattern) => pattern.participantLabel ?? participantLabelFor(pattern.name, locale));

  return {
    generatedAt: new Date().toISOString(),
    observationPortrait:
      dominantNames.length > 0
        ? `${v43Text("_template", "portraitLead", "This first Atlas Record creates a baseline portrait of observed experiences around", locale)} ${dominantNames.join(
            ", "
          )}, ${v43Text("_template", "portraitOrganizedThrough", "organized through", locale)} ${v43.archetype.name}.`
        : v43Text("_template", "noMeaningfulPattern", noMeaningfulPatternFallback, locale),
    dominantPattern: v43.dominantPattern,
    supportingPatterns: v43.supportingPatterns,
    archetype: v43.archetype,
    signalLandscape: v43.signalLandscape,
    experienceLayers: v43.experienceLayers,
    patternConnections: v43.patternConnections,
    strengths: v43.strengths,
    reflectionCompass: v43.reflectionCompass,
    reflectionContent: v43.reflectionContent,
    subduedPatterns: v43.subduedPatterns,
    subduedPatternMessages: v43.subduedPatternMessages,
    observedPatterns: patterns,
    constellationPatterns: patterns.slice(0, 6),
    narrativeThemes:
      narrativeIntelligence.narrativeThemes.length > 0
        ? narrativeIntelligence.narrativeThemes.map((theme) => theme.participantLabel)
        : [],
    reflection,
    bodyLiteracyNote: reflection.bodyLiteracyNote,
    whatAtlasWillWatch: identifyTrajectoryChange(patterns),
    disclaimer: v43Text(
      "_template",
      "nonDiagnosticDisclaimer",
      "This record is not a diagnosis. It is a reflection of your lived experience as observed.",
      locale
    )
  };
}

export function buildReviewSectionCounts(
  responses: ObservationResponseDraft[]
): AtlasSectionReviewCount[] {
  const extraction = extractObservationsFromResponses(
    responses,
    createMinimalAikbBundle(observationsRegistry)
  );

  return extraction.reviewSections.map((section) => ({
    label: section.label,
    screenId: section.screenId,
    count: section.count,
    noun: section.sectionId === "context" || section.sectionId === "care" ? "responses" : "observations",
    statusText: section.statusText
  }));
}

export function getFallbackReflectionText() {
  return noMeaningfulPatternFallback;
}

