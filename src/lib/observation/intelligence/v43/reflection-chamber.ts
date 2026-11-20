// Reflection Chamber intelligence — ported from participant-app
// (services/atlas-intelligence/reflection-chamber.ts). The mobile app builds this
// client-side from a client AIKB bundle; observatory-system builds it server-side
// from the same AtlasRecord + responses the pipeline already has (no client aikb
// bundle needed — extractObservationsFromResponses only needs the observations
// dictionary, via createMinimalAikbBundle, same as atlas-intelligence-service.ts).
import observationsRegistry from "@/content/aikb/observations.json";
import { UI_STRINGS, type UiStrings } from "@/lib/observation/ui-strings";
import type { AtlasRecord } from "./atlas-intelligence-service";
import { REFLECTION_SUMMARY_SECTIONS, type ReflectionSummarySectionId } from "./observation-contract";
import {
  buildOntologyRoutingContext,
  ONTOLOGY_SIGNAL_RULES,
  participantLabelFor,
  routingsForPattern,
  type OntologyRoutingContext,
  type SignalRoutingResult,
} from "./pattern-ontology";
import { v43Text } from "./v43-i18n";
import { createMinimalAikbBundle, logNarrativeRoutingDebug, logOntologyRoutingDebug } from "./observation-debug";
import { extractObservationsFromResponses } from "./observation-extractor";
import {
  buildNarrativeEvidence,
  buildNarrativeIntelligence,
  composeNarrativeStorySegment,
  type NarrativeIntelligence,
  type ReflectionChamberNarrativeEvidence,
} from "./narrative-intelligence";
import type { AtlasObservationRecord } from "./types";
import type { ObservationResponseDraft } from "./first-observation-types";

export type ConfidenceLevel = "baseline" | "emerging" | "moderate" | "strong" | "very_strong";

export type WatchStatus = "watching" | "stable" | "emerging" | "baseline";

export type ReflectionChamberStory = {
  headline: string;
  narrative: string;
  patternChips: string[];
  participantVoice: string[];
  narrativeThemeLabels: string[];
};

export type ConfidenceKind = "signal" | "pattern" | "connection";

export type ReflectionChamberPattern = {
  scientificName: string;
  participantLabel: string;
  role: "dominant" | "supporting";
  confidence: ConfidenceLevel;
  observedBecause: string[];
  whyThisMatters: string;
  learningChain: string[];
};

export type ReflectionChamberUnderstanding = {
  patternName: string;
  participantLabel: string;
  supportedBy: string[];
  why: string;
  confidence: ConfidenceLevel;
};

export type ReflectionChamberConnection = {
  id: string;
  fromPattern: string;
  fromLabel: string;
  toPattern: string;
  toLabel: string;
  whyConnected: string;
  detailExplanation: string;
  confidence: ConfidenceLevel;
};

export type ReflectionChamberWatchGroup = {
  groupLabel: string;
  items: ReflectionChamberWatchItem[];
};

export type ReflectionChamberLearningTrace = {
  patternName: string;
  participantLabel: string;
  steps: string[];
};

export type ReflectionChamberWatchItem = {
  label: string;
  status: WatchStatus;
  compareNote: string;
};

export type ReflectionChamberSignalContribution = {
  id: string;
  signalId: string;
  signalLabel: string;
  evidenceItems: string[];
  contributionLevel: "high" | "moderate" | "light";
  confidence: ConfidenceLevel;
  patternId: string;
  patternInfluenced: string;
  secondaryPatternInfluenced: string | null;
  sourceField: string;
  sourceValue: string;
};

export type ReflectionChamberAtlasSection = {
  sectionId: ReflectionSummarySectionId | "body";
  label: string;
  observations: string[];
};

export type ReflectionChamberArchetype = {
  name: string;
  confidence: ConfidenceLevel;
  coreTheme: string;
  shapedByPatterns: string[];
  whySelected: string;
};

export type ReflectionChamberIntelligence = {
  story: ReflectionChamberStory;
  dominantPattern: ReflectionChamberPattern | null;
  supportingPatterns: ReflectionChamberPattern[];
  understanding: ReflectionChamberUnderstanding[];
  connections: ReflectionChamberConnection[];
  watchGroups: ReflectionChamberWatchGroup[];
  signalContributions: ReflectionChamberSignalContribution[];
  narrativeEvidence: ReflectionChamberNarrativeEvidence[];
  narrativeIntelligence: NarrativeIntelligence;
  learningTraces: ReflectionChamberLearningTrace[];
  atlasRecordSections: ReflectionChamberAtlasSection[];
  archetype: ReflectionChamberArchetype;
};

const WATCH_ITEM_DEFINITIONS: Array<{
  label: string;
  patternNames: string[];
  sectionId: ReflectionSummarySectionId;
}> = [
  { label: "Bleeding Pattern", patternNames: ["Bleeding Burden"], sectionId: "bleeding" },
  { label: "Daily Impact", patternNames: ["Daily Function", "Pain Distribution"], sectionId: "daily_life" },
  { label: "Planning Burden", patternNames: ["Planning Around Symptoms", "Bleeding Burden"], sectionId: "daily_life" },
  { label: "Hormonal Rhythm", patternNames: ["Hormonal Rhythm"], sectionId: "hormonal" },
  { label: "Care Experience", patternNames: ["Care Experience"], sectionId: "care" },
];

const BODY_FIELD_IDS = new Set(["pelvic_body_function", "body_change_signals"]);

const WATCH_GROUP_DEFINITIONS: Array<{ groupLabel: string; itemLabels: string[] }> = [
  { groupLabel: "Body", itemLabels: ["Bleeding Pattern"] },
  { groupLabel: "Cycle", itemLabels: ["Hormonal Rhythm"] },
  { groupLabel: "Daily Life", itemLabels: ["Daily Impact", "Planning Burden"] },
  { groupLabel: "Care", itemLabels: ["Care Experience"] },
];

const WATCH_STATUS_LABEL: Record<WatchStatus, string> = {
  watching: "Watching",
  stable: "Stable",
  emerging: "Emerging",
  baseline: "Baseline",
};

export function confidenceFromSignalCount(signalCount: number, isDominant = false): ConfidenceLevel {
  if (signalCount >= 4) return "very_strong";
  if (signalCount >= 3 || (isDominant && signalCount >= 2)) return "strong";
  if (signalCount >= 2) return "moderate";
  if (signalCount >= 1) return "emerging";
  return "baseline";
}

export function observatoryConfidenceLabel(level: ConfidenceLevel, strings?: UiStrings) {
  const s = strings ?? UI_STRINGS;
  switch (level) {
    case "very_strong":
      return s.confidenceConfirmed;
    case "strong":
      return s.confidenceStrong;
    case "moderate":
      return s.confidenceEmerging;
    case "emerging":
      return s.confidenceEarly;
    default:
      return s.confidenceBaseline;
  }
}

export function observatoryConfidenceStars(level: ConfidenceLevel) {
  const filled = { baseline: 1, emerging: 2, moderate: 3, strong: 4, very_strong: 5 }[level];
  return `${"★".repeat(filled)}${"☆".repeat(5 - filled)}`;
}

export function watchStatusLabel(status: WatchStatus, strings?: UiStrings) {
  if (!strings) return WATCH_STATUS_LABEL[status];
  const byStatus: Record<WatchStatus, string> = {
    watching: strings.watchStatusWatching,
    stable: strings.watchStatusStable,
    emerging: strings.watchStatusEmerging,
    baseline: strings.watchStatusBaseline,
  };
  return byStatus[status];
}

function limitWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function firstSentence(text: string) {
  const match = text.trim().match(/^[^.!?]+[.!?]?/);
  return match?.[0]?.trim() ?? text.trim();
}

function evidenceThemeFor(routing: SignalRoutingResult, locale?: string) {
  const rule = ONTOLOGY_SIGNAL_RULES.find(
    (item) => item.fieldId === routing.fieldId && item.values?.includes(routing.value),
  );
  const theme = rule?.evidenceTheme ?? routing.normalizedSignal.split(": ").pop()?.trim() ?? routing.normalizedSignal;
  return rule?.evidenceTheme ? v43Text(theme, "evidenceTheme", theme, locale) : theme;
}

function routingsForScientificName(context: OntologyRoutingContext, scientificName: string) {
  return context.routings.filter(
    (routing) => routing.primaryScientificName === scientificName || routing.secondaryScientificName === scientificName,
  );
}

function buildPatternCard(
  pattern: AtlasRecord["observedPatterns"][number],
  role: "dominant" | "supporting",
  context: OntologyRoutingContext,
  locale?: string,
): ReflectionChamberPattern {
  const routings = routingsForPattern(context, pattern.name, "primary");
  const signalCount = routings.length || pattern.supportingSignals.length;
  const confidence = confidenceFromSignalCount(signalCount, role === "dominant");
  const participantLabel = pattern.participantLabel ?? participantLabelFor(pattern.name, locale);

  return {
    scientificName: pattern.name,
    participantLabel,
    role,
    confidence,
    observedBecause: [...new Set(routings.map((routing) => evidenceThemeFor(routing, locale)))].slice(0, 4),
    whyThisMatters: limitWords(
      pattern.plainLanguageMeaning ||
        pattern.whyAtlasConnected ||
        v43Text("_template", "noticedAcrossObservations", "Atlas noticed this pattern across several observations in your record.", locale),
      35,
    ),
    learningChain: routings.map((routing) => routing.normalizedSignal).slice(0, 6),
  };
}

function buildStory(
  atlasRecord: AtlasRecord,
  observations: AtlasObservationRecord[],
  context: OntologyRoutingContext,
  narrativeIntelligence: NarrativeIntelligence,
  strings: UiStrings,
  locale?: string,
): ReflectionChamberStory {
  const t = (field: string, fallback: string) => v43Text("_template", field, fallback, locale);
  const dominant = atlasRecord.observedPatterns[0];
  const patternChips = atlasRecord.observedPatterns
    .slice(0, 4)
    .map((pattern) => pattern.participantLabel ?? participantLabelFor(pattern.name, locale));

  const narrativeThemeLabels = narrativeIntelligence.narrativeThemes.map((theme) => theme.participantLabel);

  if (!dominant) {
    return {
      headline: strings.headlineNoBaseline,
      narrative: limitWords(
        t(
          "storyNoBaseline",
          "Atlas organized what you chose to share today into a starting intelligence portrait. This is observational, not diagnostic. Future observations will clarify what remains steady and what changes.",
        ),
        120,
      ),
      patternChips: [],
      participantVoice: [],
      narrativeThemeLabels: [],
    };
  }

  const activeSections = new Set(observations.map((observation) => observation.section));
  const domainPhrase = REFLECTION_SUMMARY_SECTIONS.filter((section) => activeSections.has(section.sectionId))
    .map((section) => v43Text(section.sectionId, "sectionLabel", section.label, locale).toLowerCase())
    .slice(0, 4)
    .join(locale && locale !== "en" ? "، " : ", ");

  const dominantLabel = dominant.participantLabel ?? participantLabelFor(dominant.name, locale);
  const patternLabels = atlasRecord.observedPatterns
    .slice(0, 3)
    .map((pattern) => pattern.participantLabel ?? participantLabelFor(pattern.name, locale))
    .join(locale && locale !== "en" ? "، " : ", ");

  const narrativeSegment = composeNarrativeStorySegment(narrativeIntelligence, 2, locale);
  const headline =
    narrativeIntelligence.narrativeThemes.length > 0
      ? strings.headlineNarrativeThemes
      : `${dominantLabel} ${strings.headlineShapesRecord}`;

  return {
    headline,
    narrative: limitWords(
      [
        patternLabels
          ? `${t("storyNoticedThatLead", "Atlas noticed that")} ${patternLabels.toLowerCase()} ${t("storyNotOnlySymptoms", "are not only symptoms in this record.")}`
          : `${t("storyObservedLead", "Atlas observed")} ${dominantLabel} ${t("storyCentralThread", "as a central thread in this first record.")}`,
        domainPhrase
          ? `${t("storyShapesAcrossLead", "They appear to shape planning, sleep, routines, and how predictable daily life feels across")} ${domainPhrase}.`
          : t("storyShapesGeneric", "They appear to shape planning, routines, and how predictable daily life feels."),
        context.emergentThemes.length > 0
          ? `${t("storyTogetherSuggestLead", "Together, structured observations may suggest")} ${context.emergentThemes[0].participantLabel.toLowerCase()}.`
          : "",
        narrativeSegment,
        t("storyObservationalDisclaimer", "This portrait is observational and participant-specific — not diagnostic."),
      ]
        .filter(Boolean)
        .join(" "),
      130,
    ),
    patternChips,
    participantVoice: narrativeIntelligence.participantVoice,
    narrativeThemeLabels,
  };
}

function supportedPatternsFor(
  pattern: ReflectionChamberPattern,
  atlasRecord: AtlasRecord,
  patterns: ReflectionChamberPattern[],
  locale?: string,
) {
  const fromConnections = atlasRecord.patternConnections
    .filter((connection) => connection.patternA === pattern.scientificName || connection.patternB === pattern.scientificName)
    .map((connection) => (connection.patternA === pattern.scientificName ? connection.patternB : connection.patternA))
    .map((name) => participantLabelFor(name, locale));

  const supporting = patterns
    .filter((item) => item.scientificName !== pattern.scientificName)
    .map((item) => item.participantLabel);

  return [...new Set([...fromConnections, ...supporting])].slice(0, 4);
}

function buildUnderstanding(
  atlasRecord: AtlasRecord,
  patterns: ReflectionChamberPattern[],
  locale?: string,
): ReflectionChamberUnderstanding[] {
  return patterns.map((pattern) => {
    const registryPattern = atlasRecord.observedPatterns.find((item) => item.name === pattern.scientificName);

    return {
      patternName: pattern.scientificName,
      participantLabel: pattern.participantLabel,
      supportedBy: supportedPatternsFor(pattern, atlasRecord, patterns, locale),
      why: limitWords(
        firstSentence(
          registryPattern?.whyAtlasConnected ??
            pattern.whyThisMatters ??
            v43Text("_template", "severalObservationsSameDirection", "Several observations pointed in the same direction.", locale),
        ),
        30,
      ),
      confidence: pattern.confidence,
    };
  });
}

function buildConnections(
  atlasRecord: AtlasRecord,
  context: OntologyRoutingContext,
  locale?: string,
): ReflectionChamberConnection[] {
  const chain = atlasRecord.observedPatterns.slice(0, 5);
  const connections: ReflectionChamberConnection[] = [];

  for (let index = 0; index < chain.length - 1; index += 1) {
    const fromPattern = chain[index];
    const toPattern = chain[index + 1];
    const registry = atlasRecord.patternConnections.find(
      (connection) =>
        (connection.patternA === fromPattern.name && connection.patternB === toPattern.name) ||
        (connection.patternA === toPattern.name && connection.patternB === fromPattern.name),
    );
    const fromLabel = fromPattern.participantLabel ?? participantLabelFor(fromPattern.name, locale);
    const toLabel = toPattern.participantLabel ?? participantLabelFor(toPattern.name, locale);
    const fullExplanation =
      registry?.description ??
      `${fromLabel} ${v43Text("_template", "connectionAnd", "and", locale)} ${toLabel} ${v43Text(
        "_template",
        "connectionMayTravelTogether",
        "may travel together in how symptoms, routines, and care needs show up in daily life.",
        locale,
      )}`;
    const fromCount = routingsForScientificName(context, fromPattern.name).length;
    const toCount = routingsForScientificName(context, toPattern.name).length;

    connections.push({
      id: `${fromPattern.name}-${toPattern.name}`,
      fromPattern: fromPattern.name,
      fromLabel,
      toPattern: toPattern.name,
      toLabel,
      whyConnected: limitWords(firstSentence(fullExplanation), 14),
      detailExplanation: limitWords(fullExplanation, 45),
      confidence: confidenceFromSignalCount(Math.max(fromCount, toCount)),
    });
  }

  return connections;
}

function watchStatusFor(
  patternNames: string[],
  sectionObservations: AtlasObservationRecord[],
  context: OntologyRoutingContext,
  observedPatterns: AtlasRecord["observedPatterns"],
): WatchStatus {
  const matchedPattern = patternNames.map((name) => observedPatterns.find((pattern) => pattern.name === name)).find(Boolean);

  if (matchedPattern) {
    const count = routingsForScientificName(context, matchedPattern.name).length;
    const confidence = confidenceFromSignalCount(count, matchedPattern === observedPatterns[0]);

    if (confidence === "strong" || confidence === "very_strong") return "watching";
    if (confidence === "moderate" || confidence === "emerging") return "emerging";
  }

  if (sectionObservations.length > 0) return "stable";
  return "baseline";
}

function buildWatchItem(
  definition: (typeof WATCH_ITEM_DEFINITIONS)[number],
  atlasRecord: AtlasRecord,
  observations: AtlasObservationRecord[],
  context: OntologyRoutingContext,
  locale?: string,
): ReflectionChamberWatchItem {
  const sectionObservations = observations.filter((observation) => observation.section === definition.sectionId);
  const matchedPattern = definition.patternNames
    .map((name) => atlasRecord.observedPatterns.find((pattern) => pattern.name === name))
    .find(Boolean);
  const status = watchStatusFor(definition.patternNames, sectionObservations, context, atlasRecord.observedPatterns);

  // `label` stays the original English WATCH_ITEM_DEFINITIONS key here — it is
  // matched against narrativeIntelligence.watchModifiers[].watchLabel and
  // WATCH_GROUP_DEFINITIONS[].itemLabels below, both keyed by this same English
  // text. Translated only at the very end, in buildWatchGroups' return.
  return {
    label: definition.label,
    status,
    compareNote: limitWords(
      matchedPattern?.watchOverTime ??
        v43Text(
          definition.label,
          "watchCompareFallback",
          `Atlas will compare whether ${definition.label.toLowerCase()} stays steady, shifts, or becomes clearer over time.`,
          locale,
        ),
      18,
    ),
  };
}

function buildWatchGroups(
  atlasRecord: AtlasRecord,
  observations: AtlasObservationRecord[],
  context: OntologyRoutingContext,
  narrativeIntelligence: NarrativeIntelligence,
  locale?: string,
): ReflectionChamberWatchGroup[] {
  const allItems = WATCH_ITEM_DEFINITIONS.map((definition) => buildWatchItem(definition, atlasRecord, observations, context, locale));

  const narrativeAdjusted = allItems.map((item) => {
    const modifier = narrativeIntelligence.watchModifiers.find((entry) => entry.watchLabel === item.label);
    if (!modifier) return item;
    return { ...item, compareNote: limitWords(modifier.compareNote, 22) };
  });

  return WATCH_GROUP_DEFINITIONS.map((group) => ({
    groupLabel: v43Text(group.groupLabel, "watchGroupLabel", group.groupLabel, locale),
    items: narrativeAdjusted
      .filter((item) => group.itemLabels.includes(item.label))
      .map((item) => ({ ...item, label: v43Text(item.label, "watchItemLabel", item.label, locale) })),
  })).filter((group) => group.items.length > 0);
}

function buildLearningTraces(patterns: ReflectionChamberPattern[]): ReflectionChamberLearningTrace[] {
  return patterns
    .filter((pattern) => pattern.learningChain.length > 0)
    .map((pattern) => ({
      patternName: pattern.scientificName,
      participantLabel: pattern.participantLabel,
      steps: pattern.learningChain,
    }));
}

function buildSignalContributions(
  context: OntologyRoutingContext,
  dominantScientificName: string | undefined,
  locale?: string,
): ReflectionChamberSignalContribution[] {
  return context.routings.slice(0, 12).map((routing, index) => ({
    id: `${routing.observationId}-${routing.fieldId}-${routing.value}-${index}`,
    signalId: routing.observationId,
    signalLabel: evidenceThemeFor(routing, locale),
    evidenceItems: [routing.normalizedSignal],
    contributionLevel: routing.contributionLevel,
    confidence: confidenceFromSignalCount(1, routing.primaryScientificName === dominantScientificName),
    patternId: routing.primaryPatternId,
    patternInfluenced: routing.primaryParticipantLabel,
    secondaryPatternInfluenced: routing.secondaryParticipantLabel,
    sourceField: routing.fieldId,
    sourceValue: routing.value,
  }));
}

function buildAtlasRecordSections(
  observations: AtlasObservationRecord[],
  locale?: string,
): ReflectionChamberAtlasSection[] {
  const sections: ReflectionChamberAtlasSection[] = [];

  for (const section of REFLECTION_SUMMARY_SECTIONS) {
    const sectionObservations = observations.filter((observation) => {
      if (observation.section !== section.sectionId) return false;
      if (section.sectionId === "pain" && BODY_FIELD_IDS.has(observation.fieldId)) return false;
      return true;
    });

    sections.push({
      sectionId: section.sectionId,
      label: v43Text(section.sectionId, "sectionLabel", section.label, locale),
      observations: sectionObservations.map((observation) => observation.displayText),
    });
  }

  const bodyObservations = observations.filter(
    (observation) => observation.section === "pain" && BODY_FIELD_IDS.has(observation.fieldId),
  );

  sections.push({
    sectionId: "body",
    label: v43Text("body", "sectionLabel", "Body", locale),
    observations: bodyObservations.map((observation) => observation.displayText),
  });

  return sections.filter((section) => section.observations.length > 0);
}

function buildArchetype(
  atlasRecord: AtlasRecord,
  observedPatterns: AtlasRecord["observedPatterns"],
  narrativeIntelligence: NarrativeIntelligence,
  locale?: string,
): ReflectionChamberArchetype {
  const shapedByPatterns = observedPatterns.slice(0, 3).map((pattern) => pattern.participantLabel ?? participantLabelFor(pattern.name, locale));
  const narrativeLabels = narrativeIntelligence.narrativeThemes.map((theme) => theme.participantLabel).slice(0, 2);
  const shapedBy = [...new Set([...shapedByPatterns, ...narrativeLabels])].slice(0, 4);
  const signalCount = shapedBy.length;

  const whySelected =
    narrativeIntelligence.narrativeThemes.length > 0
      ? `${firstSentence(atlasRecord.archetype.whyAtlasChose)} ${v43Text("_template", "narrativeAlsoShaped", "Your narrative also shaped this portrait.", locale)}`
      : firstSentence(atlasRecord.archetype.whyAtlasChose);

  return {
    name: atlasRecord.archetype.name,
    confidence: confidenceFromSignalCount(signalCount, true),
    coreTheme: firstSentence(atlasRecord.archetype.whatThisMeans),
    shapedByPatterns: shapedBy,
    whySelected,
  };
}

export function buildReflectionChamberIntelligence(
  atlasRecord: AtlasRecord,
  responses: ObservationResponseDraft[],
  strings: UiStrings = UI_STRINGS,
  locale?: string,
  fieldTranslations?: Record<string, string>,
): ReflectionChamberIntelligence {
  const aikb = createMinimalAikbBundle(observationsRegistry);
  const extraction = extractObservationsFromResponses(responses, aikb, fieldTranslations);
  const observations = extraction.observations;
  const ontologyContext = buildOntologyRoutingContext(observations, locale);
  const narrativeIntelligence = buildNarrativeIntelligence(responses, ontologyContext, locale);
  logOntologyRoutingDebug(ontologyContext);
  logNarrativeRoutingDebug(narrativeIntelligence);
  const observedPatterns = atlasRecord.observedPatterns;
  const dominant = observedPatterns[0];
  const supporting = observedPatterns.slice(1, 4);

  const dominantPattern = dominant ? buildPatternCard(dominant, "dominant", ontologyContext, locale) : null;
  const supportingPatterns = supporting.map((pattern) => buildPatternCard(pattern, "supporting", ontologyContext, locale));
  const allPatterns = [...(dominantPattern ? [dominantPattern] : []), ...supportingPatterns];

  return {
    story: buildStory(atlasRecord, observations, ontologyContext, narrativeIntelligence, strings, locale),
    dominantPattern,
    supportingPatterns,
    understanding: buildUnderstanding(atlasRecord, allPatterns, locale),
    connections: buildConnections(atlasRecord, ontologyContext, locale),
    watchGroups: buildWatchGroups(atlasRecord, observations, ontologyContext, narrativeIntelligence, locale),
    signalContributions: buildSignalContributions(ontologyContext, dominant?.name, locale),
    narrativeEvidence: buildNarrativeEvidence(narrativeIntelligence, locale),
    narrativeIntelligence,
    learningTraces: buildLearningTraces(allPatterns),
    atlasRecordSections: buildAtlasRecordSections(observations, locale),
    archetype: buildArchetype(atlasRecord, observedPatterns, narrativeIntelligence, locale),
  };
}
