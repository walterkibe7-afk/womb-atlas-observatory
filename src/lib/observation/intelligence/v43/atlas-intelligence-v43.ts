import type {
  AtlasNarrativeSignal,
  AtlasObservedPattern,
  AtlasSignal
} from "./atlas-intelligence-service";
import {
  applyNarrativeArchetypeOverride,
  buildNarrativeIntelligence,
  narrativeThemeToArchetypeScore,
  type NarrativeIntelligence
} from "./narrative-intelligence";
import {
  CANONICAL_TO_LEGACY_V43,
  canonicalScientificName,
  participantLabelFor,
  patternDetectedInSet
} from "./pattern-ontology";
import { v43Text } from "./v43-i18n";
import type { ObservationResponseDraft, NarrativePromptResponse } from "./first-observation-types";

// AI Stack Layer: Archetype Registry
// Source: v4.3 tab 20_Archetype_Registry

export type AtlasArchetype = {
  name: string;
  description: string;
  whatThisMeans: string;
  whyAtlasChose: string;
  archetypeLogic: string[];
  archetypeLogicSummary: string;
  strengthsSummary: string;
  dominantPattern: string;
  supportingPatterns: string[];
  narrativeThemes: string[];
};

export type AtlasReflectionContent = {
  openingInsight: string;
  dominantPattern: string;
  dominantPatternSummary: string;
  supportingPatterns: string[];
  whatAppearsConnected: string[];
  whatExperienceMayMean: string;
  whatExperienceAsks: string[];
  strengthsObserved: string[];
  bodyLiteracyNote: string;
  whatAtlasWillWatch: string[];
  supportingObservations: string[];
};

export type AtlasSignalLandscape = {
  name: string;
  label?: string;
  description: string;
  patterns: string[];
};

export type AtlasExperienceLayer = {
  name: string;
  label?: string;
  description: string;
  reflectionText: string;
};

export type AtlasPatternConnection = {
  patternA: string;
  patternB: string;
  description: string;
};

export type AtlasStrength = {
  name: string;
  label?: string;
  description: string;
  reflectionText: string;
};

export type AtlasReflectionCompass = {
  strongestTheme: string;
  emergingTheme: string;
  strengthObserved: string;
  whatAtlasWillWatch: string;
};

type ArchetypeDefinition = {
  name: string;
  description: string;
  whatThisMeans: string;
  whyTemplate: string;
  logicSummary: string;
  patternWeights: Record<string, number>;
  narrativeThemes: string[];
};

type SignalLandscapeDefinition = {
  name: string;
  description: string;
  patterns: string[];
};

type ExperienceLayerDefinition = {
  name: string;
  description: string;
  reflectionText: string;
  patternNames: string[];
  narrativeThemes: string[];
};

type PatternConnectionDefinition = {
  patternA: string;
  patternB: string;
  description: string;
};

type StrengthDefinition = {
  name: string;
  description: string;
  reflectionText: string;
  patternNames: string[];
  narrativeThemes: string[];
  keywords: string[];
};

const allPatternNames = [
  "Bleeding Burden",
  "Pain-Spread",
  "Pelvic Pressure",
  "Hormonal Rhythm",
  "Life Reorganization",
  "Care Friction",
  "Body Uncertainty"
];

// AI Stack Layer: Archetype Registry
// Source: v4.3 tab 20_Archetype_Registry
const archetypeRegistry: ArchetypeDefinition[] = [
  {
    name: "The Adapting Navigator",
    description:
      "Atlas sees someone reorganizing daily life while learning how to move through uncertainty.",
    whatThisMeans:
      "This archetype appears when body experiences begin influencing planning, preparation, and routine. The dominant challenge is often not a single symptom, but the need to adapt around uncertainty.",
    whyTemplate:
      "Atlas chose this archetype because life reorganization, body uncertainty, and planning burden appeared together in this record.",
    logicSummary:
      "Together these suggest an experience centered on adaptation and preparation.",
    patternWeights: {
      "Life Reorganization": 3,
      "Body Uncertainty": 2,
      "Bleeding Burden": 1
    },
    narrativeThemes: ["Unpredictability", "Loss of Control", "Frustration / Exhaustion"]
  },
  {
    name: "The Persistent Seeker",
    description:
      "Atlas sees persistence in trying to understand what is happening and find clearer support.",
    whatThisMeans:
      "This archetype appears when the search for clarity and support becomes part of the lived experience itself.",
    whyTemplate:
      "Atlas chose this archetype because care friction and body uncertainty appeared alongside ongoing questions about what is happening.",
    logicSummary:
      "Together these suggest an experience centered on persistence and the search for clearer answers.",
    patternWeights: {
      "Care Friction": 3,
      "Body Uncertainty": 2,
      "Life Reorganization": 1
    },
    narrativeThemes: ["Dismissal / Not Believed", "Frustration / Exhaustion"]
  },
  {
    name: "The Multi-System Experience",
    description:
      "Atlas sees experiences that may connect across pain, rhythm, pressure, and daily function.",
    whatThisMeans:
      "This archetype appears when symptoms may be traveling across more than one body system or routine at once.",
    whyTemplate:
      "Atlas chose this archetype because pain spread, pelvic pressure, and hormonal rhythm signals appeared connected in this record.",
    logicSummary:
      "Together these suggest an experience that may be felt across multiple body systems and routines.",
    patternWeights: {
      "Pain-Spread": 3,
      "Pelvic Pressure": 2,
      "Hormonal Rhythm": 2,
      "Life Reorganization": 1
    },
    narrativeThemes: ["Avoidance / Withdrawal", "Identity / Body Change Concern"]
  },
  {
    name: "The Uncertain Body Experience",
    description:
      "Atlas sees unpredictability and shifting body signals as a central lived experience.",
    whatThisMeans:
      "This archetype appears when not knowing what the body will do next becomes part of the burden.",
    whyTemplate:
      "Atlas chose this archetype because body uncertainty and rhythm change appeared as the strongest themes in this record.",
    logicSummary:
      "Together these suggest an experience centered on unpredictability and changing body signals.",
    patternWeights: {
      "Body Uncertainty": 3,
      "Hormonal Rhythm": 2,
      "Bleeding Burden": 1
    },
    narrativeThemes: ["Unpredictability", "Loss of Control"]
  },
  {
    name: "The Body Negotiator",
    description:
      "Atlas sees an ongoing negotiation between body demands, energy, and what daily life requires.",
    whatThisMeans:
      "This archetype appears when body burden and daily capacity need to be negotiated again and again.",
    whyTemplate:
      "Atlas chose this archetype because bleeding burden and life reorganization appeared alongside energy and routine strain.",
    logicSummary:
      "Together these suggest an experience centered on negotiating capacity, energy, and daily demands.",
    patternWeights: {
      "Bleeding Burden": 3,
      "Life Reorganization": 2,
      "Pain-Spread": 1
    },
    narrativeThemes: ["Vigilance / Preparedness", "Frustration / Exhaustion"]
  },
  {
    name: "The Quiet Burden",
    description:
      "Atlas sees a steady burden that may be carried with less outward expression but real daily impact.",
    whatThisMeans:
      "This archetype appears when burden is present even when the record does not center on one dramatic theme.",
    whyTemplate:
      "Atlas chose this archetype because body burden signals appeared steadily, even without a single dominant narrative theme.",
    logicSummary:
      "Together these suggest a quieter but meaningful burden worth observing over time.",
    patternWeights: {
      "Bleeding Burden": 2,
      "Pain-Spread": 2,
      "Pelvic Pressure": 1
    },
    narrativeThemes: []
  }
];

// AI Stack Layer: Signal Landscape Registry
// Source: v4.3 tab 21_Signal_Landscape_Registry
const signalLandscapeRegistry: SignalLandscapeDefinition[] = [
  {
    name: "Body Predictability Landscape",
    description:
      "A landscape shaped by how predictable or changeable body timing feels across this record.",
    patterns: ["Body Uncertainty", "Hormonal Rhythm"]
  },
  {
    name: "Bleeding Burden Landscape",
    description:
      "A landscape shaped by how bleeding may affect energy, preparation, and daily capacity.",
    patterns: ["Bleeding Burden"]
  },
  {
    name: "Pain Landscape",
    description:
      "A landscape shaped by how pain may spread across movement, function, and routine.",
    patterns: ["Pain-Spread", "Pelvic Pressure"]
  },
  {
    name: "Care Navigation Landscape",
    description:
      "A landscape shaped by access, clarity, and whether care experiences feel supportive.",
    patterns: ["Care Friction"]
  },
  {
    name: "Life Adaptation Landscape",
    description:
      "A landscape shaped by how symptoms reorganize work, rest, relationships, and movement.",
    patterns: ["Life Reorganization"]
  }
];

// AI Stack Layer: Experience Layer Registry
// Source: v4.3 tab 22_Experience_Layer_Registry
const experienceLayerRegistry: ExperienceLayerDefinition[] = [
  {
    name: "Planning Burden",
    description: "The hidden work of planning around unpredictable body signals.",
    reflectionText: "This experience may ask for more advance planning than feels fair or sustainable.",
    patternNames: ["Bleeding Burden", "Body Uncertainty", "Life Reorganization"],
    narrativeThemes: ["Unpredictability", "Vigilance / Preparedness"]
  },
  {
    name: "Life Constriction",
    description: "When routines, movement, or social life feel narrower than before.",
    reflectionText: "This experience may ask you to notice what has become harder to keep open in daily life.",
    patternNames: ["Life Reorganization", "Pain-Spread"],
    narrativeThemes: ["Avoidance / Withdrawal"]
  },
  {
    name: "Agency",
    description: "The lived sense of whether your choices still feel reachable.",
    reflectionText: "This experience may ask whether you still feel able to steer routines, care, and rest.",
    patternNames: ["Care Friction", "Life Reorganization", "Body Uncertainty"],
    narrativeThemes: ["Loss of Control", "Dismissal / Not Believed"]
  },
  {
    name: "Adaptation Intelligence",
    description: "The ways you have learned to adjust, prepare, or recover.",
    reflectionText: "This experience may ask you to recognize the intelligence already present in how you adapt.",
    patternNames: ["Life Reorganization", "Bleeding Burden"],
    narrativeThemes: ["Vigilance / Preparedness", "Frustration / Exhaustion"]
  },
  {
    name: "Body Predictability",
    description: "How much your body feels knowable from one day to the next.",
    reflectionText: "This experience may ask for patience while Atlas learns what stays steady and what shifts.",
    patternNames: ["Body Uncertainty", "Hormonal Rhythm"],
    narrativeThemes: ["Unpredictability", "Loss of Control"]
  },
  {
    name: "Preparedness Burden",
    description: "The effort of staying ready for symptoms that may arrive without warning.",
    reflectionText: "This experience may ask for recognition of the energy spent staying prepared.",
    patternNames: ["Bleeding Burden", "Body Uncertainty"],
    narrativeThemes: ["Vigilance / Preparedness"]
  },
  {
    name: "Health Labor",
    description: "The ongoing work of tracking, explaining, seeking care, and holding the story.",
    reflectionText: "This experience may ask you to name the labor involved in carrying this health story.",
    patternNames: ["Care Friction", "Life Reorganization"],
    narrativeThemes: ["Dismissal / Not Believed", "Frustration / Exhaustion"]
  }
];

// AI Stack Layer: Pattern Connection Registry
// Source: v4.3 tab 23_Pattern_Connection_Registry
const patternConnectionRegistry: PatternConnectionDefinition[] = [
  {
    patternA: "Bleeding Burden",
    patternB: "Life Reorganization",
    description:
      "Bleeding burden and life reorganization may connect when energy, preparation, and routine limits travel together."
  },
  {
    patternA: "Pain-Spread",
    patternB: "Life Reorganization",
    description:
      "Pain spread and life reorganization may connect when discomfort changes what movement, work, or rest can hold."
  },
  {
    patternA: "Body Uncertainty",
    patternB: "Life Reorganization",
    description:
      "Body uncertainty and life reorganization may connect when not knowing what comes next reshapes planning."
  },
  {
    patternA: "Hormonal Rhythm",
    patternB: "Body Uncertainty",
    description:
      "Hormonal rhythm and body uncertainty may connect when timing changes make the body feel less predictable."
  },
  {
    patternA: "Care Friction",
    patternB: "Body Uncertainty",
    description:
      "Care friction and body uncertainty may connect when unanswered questions prolong the search for clarity."
  },
  {
    patternA: "Bleeding Burden",
    patternB: "Body Uncertainty",
    description:
      "Bleeding burden and body uncertainty may connect when flow, timing, and preparation feel harder to trust."
  },
  {
    patternA: "Pain-Spread",
    patternB: "Pelvic Pressure",
    description:
      "Pain spread and pelvic pressure may connect when discomfort appears across movement, pressure, and function."
  },
  {
    patternA: "Care Friction",
    patternB: "Life Reorganization",
    description:
      "Care friction and life reorganization may connect when access or clarity changes how long symptoms are carried alone."
  }
];

// AI Stack Layer: Strengths Registry
// Source: v4.3 tab 24_Strengths_Registry
const strengthRegistry: StrengthDefinition[] = [
  {
    name: "Adaptation",
    description: "Atlas noticed ways you adjust routines to keep life moving.",
    reflectionText: "You have been adapting, even when the changes are tiring.",
    patternNames: ["Life Reorganization", "Bleeding Burden", "Body Uncertainty"],
    narrativeThemes: ["Frustration / Exhaustion", "Loss of Control"],
    keywords: ["adjust", "adapt", "work around", "manage"]
  },
  {
    name: "Persistence",
    description: "Atlas noticed persistence in staying with a difficult experience.",
    reflectionText: "You have kept showing up to this experience, even when answers were slow to arrive.",
    patternNames: ["Care Friction", "Body Uncertainty"],
    narrativeThemes: ["Dismissal / Not Believed", "Frustration / Exhaustion"],
    keywords: ["keep trying", "still here", "not giving up", "again and again"]
  },
  {
    name: "Awareness",
    description: "Atlas noticed careful attention to what your body and routines are doing.",
    reflectionText: "You are paying attention, and that attention is part of the record.",
    patternNames: ["Body Uncertainty", "Hormonal Rhythm", "Pain-Spread"],
    narrativeThemes: ["Identity / Body Change Concern", "Unpredictability"],
    keywords: ["notice", "aware", "watching", "pay attention"]
  },
  {
    name: "Preparation",
    description: "Atlas noticed the work of staying ready for what the body may do next.",
    reflectionText: "You have been preparing in ways that may be invisible to others but real to you.",
    patternNames: ["Bleeding Burden", "Body Uncertainty"],
    narrativeThemes: ["Vigilance / Preparedness"],
    keywords: ["prepare", "ready", "carry extra", "plan ahead"]
  },
  {
    name: "Resourcefulness",
    description: "Atlas noticed creative ways of holding routines, rest, and care together.",
    reflectionText: "You have been resourceful in finding ways to keep life workable.",
    patternNames: ["Life Reorganization", "Care Friction", "Pain-Spread"],
    narrativeThemes: ["Avoidance / Withdrawal"],
    keywords: ["figure out", "find a way", "make it work", "resourceful"]
  },
  {
    name: "Self-Advocacy",
    description: "Atlas noticed effort to seek clarity, care, or a more believable response.",
    reflectionText: "You have been advocating for your experience to be seen and taken seriously.",
    patternNames: ["Care Friction"],
    narrativeThemes: ["Dismissal / Not Believed"],
    keywords: ["asked", "spoke up", "pushed back", "sought help", "advocate"]
  }
];

function detectedPatternNameSet(patterns: AtlasObservedPattern[]) {
  return new Set(
    patterns.flatMap((pattern) => [pattern.name, canonicalScientificName(pattern.name)])
  );
}

function archetypeWeightForPattern(
  weights: Record<string, number>,
  patternName: string
) {
  const canonical = canonicalScientificName(patternName);
  const legacy = CANONICAL_TO_LEGACY_V43[canonical];

  return weights[patternName] ?? weights[canonical] ?? (legacy ? weights[legacy] : 0) ?? 0;
}

function scoreArchetype(
  definition: ArchetypeDefinition,
  patterns: AtlasObservedPattern[],
  narrativeSignals: AtlasNarrativeSignal[],
  narrativeIntelligence?: NarrativeIntelligence
) {
  let score = 0;

  for (const pattern of patterns) {
    score += archetypeWeightForPattern(definition.patternWeights, pattern.name);
  }

  for (const theme of narrativeSignals) {
    if (definition.narrativeThemes.includes(theme.name)) {
      score += 1;
    }
  }

  if (narrativeIntelligence) {
    score += narrativeThemeToArchetypeScore(
      narrativeIntelligence,
      definition.name,
      definition.narrativeThemes
    );
  }

  return score;
}

function scoreArchetypeFromPatternsOnly(
  definition: ArchetypeDefinition,
  patterns: AtlasObservedPattern[],
  narrativeSignals: AtlasNarrativeSignal[]
) {
  return scoreArchetype(definition, patterns, narrativeSignals);
}

function isNarrativePromptResponse(
  value: unknown
): value is NarrativePromptResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "promptText" in value &&
    "textResponse" in value &&
    "completed" in value
  );
}

function narrativeText(responses: ObservationResponseDraft[]) {
  return responses
    .filter((response) => response.fieldId === "narrative_responses")
    .flatMap((response) => {
      if (!Array.isArray(response.value)) {
        return [];
      }

      return response.value.filter(isNarrativePromptResponse);
    })
    .filter((item) => item.completed)
    .map((item) => item.textResponse)
    .join(" ")
    .toLowerCase();
}

export function detectArchetype(
  patterns: AtlasObservedPattern[],
  narrativeSignals: AtlasNarrativeSignal[],
  experienceLayers: AtlasExperienceLayer[] = [],
  strengths: AtlasStrength[] = [],
  narrativeIntelligence?: NarrativeIntelligence,
  locale?: string
): AtlasArchetype {
  // Participant labels, not raw scientific names — patterns[0].name ("Baseline
  // observation" etc.) is a matching key, never what a participant should read.
  const dominantPattern =
    patterns[0] !== undefined
      ? (patterns[0].participantLabel ?? participantLabelFor(patterns[0].name, locale))
      : v43Text("_template", "baselineObservation", "Baseline observation", locale);
  const supportingPatterns = patterns
    .slice(1, 3)
    .map((pattern) => pattern.participantLabel ?? participantLabelFor(pattern.name, locale));
  const narrativeThemes =
    narrativeIntelligence && narrativeIntelligence.narrativeThemes.length > 0
      ? narrativeIntelligence.narrativeThemes.map((theme) => theme.participantLabel)
      : narrativeSignals.length > 0
        ? narrativeSignals.map((signal) => signal.name)
        : [];

  const patternRanked = [...archetypeRegistry]
    .map((definition) => ({
      definition,
      score: scoreArchetypeFromPatternsOnly(definition, patterns, narrativeSignals)
    }))
    .sort((first, second) => second.score - first.score);

  const fullRanked = [...archetypeRegistry]
    .map((definition) => ({
      definition,
      score: scoreArchetype(definition, patterns, narrativeSignals, narrativeIntelligence)
    }))
    .sort((first, second) => second.score - first.score);

  const selected =
    narrativeIntelligence && narrativeIntelligence.narrativeThemes.length > 0
      ? applyNarrativeArchetypeOverride(patternRanked, fullRanked)
      : patternRanked[0]?.score
        ? patternRanked[0].definition
        : archetypeRegistry[0];
  const archetypeLogic = [
    dominantPattern,
    ...supportingPatterns,
    // layer.name is display-only prose (a short experience-layer title), not a
    // matching key used elsewhere — safe to translate keyed by its own English
    // text.
    ...experienceLayers.slice(0, 2).map((layer) => v43Text(layer.name, "name", layer.name, locale))
  ].filter((value, index, array) => array.indexOf(value) === index);
  // strengthNames drives the `.includes()` checks below — a matching key,
  // left untouched. Only the surrounding template sentence is translated.
  const strengthNames = strengths.map((strength) => strength.name);
  const strengthsSummary = (() => {
    if (strengthNames.length === 0) {
      return v43Text(
        "_template",
        "strengthsCareful",
        "Your responses suggest careful attention to what your body and routines are doing.",
        locale
      );
    }
    const lead = v43Text(
      "_template",
      "strengthsLead",
      "Your responses suggest that you have already developed ways of noticing changes",
      locale
    );
    const preparingAhead = strengthNames.includes("Preparation")
      ? v43Text("_template", "strengthsPreparingAhead", ", preparing ahead", locale)
      : "";
    const navigatingUncertainty =
      strengthNames.includes("Adaptation") || strengthNames.includes("Persistence")
        ? v43Text("_template", "strengthsNavigatingUncertainty", ", and navigating uncertainty", locale)
        : "";
    return `${lead}${preparingAhead}${navigatingUncertainty}.`;
  })();

  // `selected.name` stays untouched above (scoring already ran against it via
  // scoreArchetype/narrativeThemeToArchetypeScore) — only the final display
  // object substitutes a translated value, keyed by that same English name.
  return {
    name: v43Text(selected.name, "name", selected.name, locale),
    description: v43Text(selected.name, "description", selected.description, locale),
    whatThisMeans: v43Text(selected.name, "whatThisMeans", selected.whatThisMeans, locale),
    whyAtlasChose: v43Text(selected.name, "whyTemplate", selected.whyTemplate, locale),
    archetypeLogic,
    archetypeLogicSummary: v43Text(selected.name, "logicSummary", selected.logicSummary, locale),
    strengthsSummary,
    dominantPattern,
    supportingPatterns,
    narrativeThemes
  };
}

export function detectSignalLandscape(
  patterns: AtlasObservedPattern[],
  locale?: string
): AtlasSignalLandscape {
  const detectedNames = detectedPatternNameSet(patterns);

  const ranked = signalLandscapeRegistry
    .map((landscape) => ({
      landscape,
      score: landscape.patterns.filter((pattern) =>
        patternDetectedInSet(detectedNames, pattern)
      ).length
    }))
    .sort((first, second) => second.score - first.score);

  const selected = ranked[0]?.score
    ? ranked[0].landscape
    : signalLandscapeRegistry[0];

  return {
    name: selected.name,
    label: v43Text(selected.name, "name", selected.name, locale),
    description: v43Text(selected.name, "description", selected.description, locale),
    patterns: selected.patterns.filter((pattern) =>
      patternDetectedInSet(detectedNames, pattern)
    )
  };
}

export function detectExperienceLayers(
  patterns: AtlasObservedPattern[],
  narrativeSignals: AtlasNarrativeSignal[],
  locale?: string
): AtlasExperienceLayer[] {
  const detectedNames = detectedPatternNameSet(patterns);
  const narrativeThemeNames = new Set(narrativeSignals.map((signal) => signal.name));

  return experienceLayerRegistry
    .map((layer) => {
      const patternScore = layer.patternNames.filter((name) =>
        patternDetectedInSet(detectedNames, name)
      ).length;
      const narrativeScore = layer.narrativeThemes.filter((theme) =>
        narrativeThemeNames.has(theme)
      ).length;

      return {
        layer,
        score: patternScore + narrativeScore
      };
    })
    .filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, 4)
    .map((item) => ({
      name: item.layer.name,
      label: v43Text(item.layer.name, "name", item.layer.name, locale),
      description: v43Text(item.layer.name, "description", item.layer.description, locale),
      reflectionText: v43Text(item.layer.name, "reflectionText", item.layer.reflectionText, locale)
    }));
}

export function detectPatternConnections(
  patterns: AtlasObservedPattern[],
  locale?: string
): AtlasPatternConnection[] {
  const detectedNames = detectedPatternNameSet(patterns);

  return patternConnectionRegistry
    .filter(
      (connection) =>
        patternDetectedInSet(detectedNames, connection.patternA) &&
        patternDetectedInSet(detectedNames, connection.patternB)
    )
    .slice(0, 4)
    .map((connection) => ({
      patternA: connection.patternA,
      patternB: connection.patternB,
      description: v43Text(
        `${connection.patternA}::${connection.patternB}`,
        "description",
        connection.description,
        locale
      )
    }));
}

export function detectStrengths(
  patterns: AtlasObservedPattern[],
  narrativeSignals: AtlasNarrativeSignal[],
  responses: ObservationResponseDraft[],
  locale?: string
): AtlasStrength[] {
  const detectedNames = detectedPatternNameSet(patterns);
  const narrativeThemeNames = new Set(narrativeSignals.map((signal) => signal.name));
  const narrative = narrativeText(responses);

  return strengthRegistry
    .map((strength) => {
      const patternScore = strength.patternNames.filter((name) =>
        patternDetectedInSet(detectedNames, name)
      ).length;
      const narrativeScore = strength.narrativeThemes.filter((theme) =>
        narrativeThemeNames.has(theme)
      ).length;
      const keywordScore = strength.keywords.some((keyword) => narrative.includes(keyword))
        ? 1
        : 0;

      return {
        strength,
        score: patternScore + narrativeScore + keywordScore
      };
    })
    .filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, 3)
    .map((item) => ({
      name: item.strength.name,
      label: v43Text(item.strength.name, "name", item.strength.name, locale),
      description: v43Text(item.strength.name, "description", item.strength.description, locale),
      reflectionText: v43Text(item.strength.name, "reflectionText", item.strength.reflectionText, locale)
    }));
}

export function buildReflectionCompass(input: {
  patterns: AtlasObservedPattern[];
  archetype: AtlasArchetype;
  strengths: AtlasStrength[];
  signalLandscape: AtlasSignalLandscape;
  locale?: string;
}): AtlasReflectionCompass {
  const locale = input.locale;
  const secondPattern = input.patterns[1];
  const bodyUnpredictabilityPattern = input.patterns.find((pattern) =>
    patternDetectedInSet(
      new Set([pattern.name, canonicalScientificName(pattern.name)]),
      "Body Unpredictability"
    )
  );
  const emergingPattern = secondPattern ?? bodyUnpredictabilityPattern;

  const strongestTheme = input.patterns[0]
    ? input.patterns[0].participantLabel ?? participantLabelFor(input.patterns[0].name, locale)
    : v43Text("_template", "baselineObservation", "Baseline observation", locale);
  const emergingTheme = emergingPattern
    ? emergingPattern.participantLabel ?? participantLabelFor(emergingPattern.name, locale)
    : v43Text("_template", "bodyUnpredictability", "Body Unpredictability", locale);
  const strengthObserved =
    input.strengths[0]?.label ??
    input.strengths[0]?.name ??
    v43Text("_template", "awareness", "Awareness", locale);
  const watchOverTime =
    input.patterns[0]?.watchOverTime ??
    v43Text(
      "_template",
      "watchLandscapeSteadier",
      "Whether future observations make this landscape steadier, clearer, or easier to understand.",
      locale
    );

  return {
    strongestTheme,
    emergingTheme,
    strengthObserved,
    whatAtlasWillWatch: v43Text(
      "_template",
      `watchTheme.${summarizeWatchTheme(watchOverTime, input.signalLandscape.name)}`,
      summarizeWatchTheme(watchOverTime, input.signalLandscape.name),
      locale
    )
  };
}

function summarizeWatchTheme(watchOverTime: string, landscapeName: string) {
  if (watchOverTime.toLowerCase().includes("predict")) {
    return "Predictability";
  }

  if (landscapeName.includes("Care")) {
    return "Care clarity";
  }

  if (landscapeName.includes("Pain")) {
    return "Pain spread";
  }

  if (landscapeName.includes("Bleeding")) {
    return "Bleeding burden";
  }

  return "Pattern clarity";
}

export function detectSubduedPatterns(patterns: AtlasObservedPattern[]): string[] {
  const detectedNames = detectedPatternNameSet(patterns);

  return allPatternNames.filter((name) => !patternDetectedInSet(detectedNames, name)).slice(0, 4);
}

export function formatSubduedPatternMessages(patternNames: string[], locale?: string): string[] {
  if (!locale || locale === "en") {
    return patternNames.map((pattern) => `No strong ${pattern} pattern was observed in this record.`);
  }
  return patternNames.map((pattern) => {
    const label = participantLabelFor(pattern, locale);
    // Word order deliberately differs from the English fallback above — Urdu
    // (and most RTL/SOV target languages) reads naturally with the pattern
    // name first, not spliced into a fixed "No strong ... was observed" frame.
    return `${label} ${v43Text(
      "_template",
      "noStrongPatternObserved",
      "— no strong pattern was observed in this record.",
      locale
    )}`;
  });
}

export function findRelatedPattern(
  patternName: string,
  connections: AtlasPatternConnection[],
  patterns: AtlasObservedPattern[]
): string | null {
  const connection = connections.find(
    (item) => item.patternA === patternName || item.patternB === patternName
  );

  if (!connection) {
    return patterns.find((pattern) => pattern.name !== patternName)?.name ?? null;
  }

  const related =
    connection.patternA === patternName ? connection.patternB : connection.patternA;

  return patterns.some((pattern) => pattern.name === related) ? related : null;
}

export function composeReflectionContent(input: {
  patterns: AtlasObservedPattern[];
  narrativeSignals: AtlasNarrativeSignal[];
  archetype: AtlasArchetype;
  connections: AtlasPatternConnection[];
  experienceLayers: AtlasExperienceLayer[];
  strengths: AtlasStrength[];
  bodyLiteracyNote: string;
  locale?: string;
}): AtlasReflectionContent {
  const locale = input.locale;
  const t = (field: string, fallback: string) => v43Text("_template", field, fallback, locale);
  const label = (pattern: AtlasObservedPattern) =>
    pattern.participantLabel ?? participantLabelFor(pattern.name, locale);

  const dominantPattern = input.patterns[0];
  const supportingPatterns = input.patterns.slice(1, 3).map(label);
  const patternNames = input.patterns.slice(0, 3).map(label);
  const connectionPhrase = input.connections.length > 0
    ? t("connectionPhraseWithConnections", "planning, energy, routine, and predictability")
    : t("connectionPhraseDefault", "body signals, daily routines, and care experiences");

  const openingInsight = dominantPattern
    ? `${t(
        "openingInsightLine1",
        "Across this first observation, Atlas noticed that the strongest theme is not only the symptoms themselves, but the amount of preparation and adjustment required around them."
      )}

${patternNames.join(", ")} ${t("openingInsightLine2", "appear connected through")} ${connectionPhrase}.

${t(
  "openingInsightLine3",
  "This can make the experience feel larger than any single symptom because it begins shaping how daily life is organized."
)}`
    : t(
        "respectfulBaselineLeavesRoom",
        "Atlas created a respectful baseline from what you chose to share today, leaving room for future comparison."
      );

  const whatExperienceMayMean = dominantPattern
    ? `${dominantPattern.plainLanguageMeaning}${
        input.patterns[1]
          ? ` ${label(input.patterns[1])} ${t("addsAnotherLayerDayToDay", "may add another layer to how this experience is felt day to day.")}`
          : ""
      }`
    : t("startingPointFuture", "This first record creates a starting point for future observations.");

  return {
    openingInsight,
    dominantPattern: dominantPattern
      ? label(dominantPattern)
      : t("baselineObservation", "Baseline observation"),
    dominantPatternSummary: dominantPattern?.plainLanguageMeaning ?? t("startingPointFuture", "This first record creates a starting point for future observations."),
    supportingPatterns,
    whatAppearsConnected:
      input.connections.length > 0
        ? input.connections.map((connection) => connection.description)
        : [
            t(
              "keepWatchingBodySignals",
              "Atlas will keep watching how body signals, daily routines, and care experiences connect as more observations are added."
            )
          ],
    whatExperienceMayMean,
    whatExperienceAsks: input.experienceLayers.map((layer) => layer.reflectionText),
    strengthsObserved:
      input.strengths.length > 0
        ? input.strengths.map((strength) => strength.reflectionText)
        : [t("noticedAttentionAndCare", "Atlas noticed attention and care in how you shared this experience.")],
    bodyLiteracyNote: input.bodyLiteracyNote,
    whatAtlasWillWatch: input.patterns.slice(0, 3).map((pattern) => pattern.watchOverTime),
    supportingObservations: input.patterns
      .flatMap((pattern) =>
        pattern.supportingSignals.filter((signal) => signal.includes(":"))
      )
      .slice(0, 6)
  };
}

export function buildAtlasRecordV43(input: {
  responses: ObservationResponseDraft[];
  structuredSignals: AtlasSignal[];
  narrativeSignals: AtlasNarrativeSignal[];
  patterns: AtlasObservedPattern[];
  bodyLiteracyNote: string;
  locale?: string;
}) {
  const locale = input.locale;
  const experienceLayers = detectExperienceLayers(input.patterns, input.narrativeSignals, locale);
  const patternConnections = detectPatternConnections(input.patterns, locale);
  const strengths = detectStrengths(input.patterns, input.narrativeSignals, input.responses, locale);
  const narrativeIntelligence = buildNarrativeIntelligence(input.responses, undefined, locale);
  const archetype = detectArchetype(
    input.patterns,
    input.narrativeSignals,
    experienceLayers,
    strengths,
    narrativeIntelligence,
    locale
  );
  const signalLandscape = detectSignalLandscape(input.patterns, locale);
  const reflectionCompass = buildReflectionCompass({
    patterns: input.patterns,
    archetype,
    strengths,
    signalLandscape,
    locale
  });
  const reflectionContent = composeReflectionContent({
    patterns: input.patterns,
    narrativeSignals: input.narrativeSignals,
    archetype,
    connections: patternConnections,
    experienceLayers,
    strengths,
    bodyLiteracyNote: input.bodyLiteracyNote,
    locale
  });
  const subduedPatterns = detectSubduedPatterns(input.patterns);
  const subduedPatternMessages = formatSubduedPatternMessages(subduedPatterns, locale);

  return {
    archetype,
    signalLandscape,
    experienceLayers,
    patternConnections,
    strengths,
    reflectionCompass,
    reflectionContent,
    subduedPatterns,
    subduedPatternMessages,
    dominantPattern: input.patterns[0]
      ? input.patterns[0].participantLabel ?? participantLabelFor(input.patterns[0].name, locale)
      : null,
    supportingPatterns: input.patterns
      .slice(1, 3)
      .map((pattern) => pattern.participantLabel ?? participantLabelFor(pattern.name, locale)),
    narrativeIntelligence
  };
}
