/**
 * Narrative Intelligence Engine v1.0
 * Parallel intelligence layer — narrative modifies interpretation; never a primary symptom pattern.
 */

import type { ObservationResponseDraft, NarrativePromptResponse } from "./first-observation-types";
import type { OntologyRoutingContext } from "./pattern-ontology";
import { participantLabelFor } from "./pattern-ontology";
import { v43Text } from "./v43-i18n";

type NarrativeConfidenceLevel = "baseline" | "emerging" | "moderate" | "strong" | "very_strong";

export type NarrativeTheme = {
  themeId: string;
  scientificName: string;
  participantLabel: string;
  sourceTextSnippet: string;
  confidence: NarrativeConfidenceLevel;
  relatedPatterns: string[];
  interpretationModifier: string;
};

export type NarrativeModifier = {
  target: string;
  reason: string;
  weight: number;
};

export type NarrativeWatchModifier = {
  watchLabel: string;
  compareNote: string;
  sourceThemeId: string;
};

export type NarrativeStoryModifier = {
  phrase: string;
  sourceThemeId: string;
};

export type NarrativeIntelligence = {
  narrativeThemes: NarrativeTheme[];
  participantVoice: string[];
  emotionalTone: string[];
  meaningSignals: string[];
  adaptationSignals: string[];
  uncertaintySignals: string[];
  careExperienceNarrative: string[];
  futureConcerns: string[];
  selfAdvocacySignals: string[];
  narrativeConfidence: {
    overall: NarrativeConfidenceLevel;
    themeCount: number;
    responsesPresent: boolean;
  };
  archetypeModifiers: NarrativeModifier[];
  watchModifiers: NarrativeWatchModifier[];
  storyModifiers: NarrativeStoryModifier[];
};

export type ReflectionChamberNarrativeEvidence = {
  themeId: string;
  scientificName: string;
  participantLabel: string;
  sourceSnippet: string;
  relatedPatternLabel: string;
  confidence: NarrativeConfidenceLevel;
  briefingInfluence: string;
};

type ThemeDefinition = {
  themeId: string;
  scientificName: string;
  participantLabel: string;
  keywords: string[];
  relatedPatterns: string[];
  interpretationModifier: string;
  archetypeBoosts: Array<{ archetypeName: string; weight: number }>;
  archetypeThemeKeys: string[];
  watchLabel?: string;
  watchNote?: string;
  buckets: Array<keyof Pick<
    NarrativeIntelligence,
    | "emotionalTone"
    | "meaningSignals"
    | "adaptationSignals"
    | "uncertaintySignals"
    | "careExperienceNarrative"
    | "futureConcerns"
    | "selfAdvocacySignals"
  >>;
};

const NARRATIVE_THEME_REGISTRY: ThemeDefinition[] = [
  {
    themeId: "adaptation",
    scientificName: "Adaptation",
    participantLabel: "Finding ways to cope",
    keywords: [
      "learned how to manage",
      "learned to manage",
      "figured out how",
      "found ways to cope",
      "adapted",
      "adjusting",
      "work around"
    ],
    relatedPatterns: ["Daily Function", "Planning Around Symptoms"],
    interpretationModifier: "adaptation appears to be part of how you navigate this experience",
    archetypeBoosts: [{ archetypeName: "The Adapting Navigator", weight: 3 }],
    archetypeThemeKeys: ["Vigilance / Preparedness"],
    watchLabel: "Planning Burden",
    watchNote: "Whether planning burden reduces or increases as routines evolve.",
    buckets: ["adaptationSignals", "meaningSignals"]
  },
  {
    themeId: "persistence",
    scientificName: "Persistence",
    participantLabel: "Keeping going despite difficulty",
    keywords: [
      "keep going",
      "still trying",
      "haven't given up",
      "persist",
      "push through",
      "learned how to manage",
      "manage it"
    ],
    relatedPatterns: ["Daily Function", "Care Experience"],
    interpretationModifier: "persistence may be part of how you carry this experience",
    archetypeBoosts: [
      { archetypeName: "The Adapting Navigator", weight: 2 },
      { archetypeName: "The Persistent Seeker", weight: 2 }
    ],
    archetypeThemeKeys: ["Vigilance / Preparedness", "Frustration / Exhaustion"],
    buckets: ["adaptationSignals", "selfAdvocacySignals"]
  },
  {
    themeId: "uncertainty",
    scientificName: "Uncertainty",
    participantLabel: "Not knowing what comes next",
    keywords: [
      "don't know what",
      "not sure what",
      "uncertain",
      "never know",
      "can't predict"
    ],
    relatedPatterns: ["Body Unpredictability", "Hormonal Rhythm"],
    interpretationModifier: "uncertainty may be shaping how predictable daily life feels",
    archetypeBoosts: [
      { archetypeName: "The Uncertain Body Experience", weight: 2 },
      { archetypeName: "The Adapting Navigator", weight: 1 }
    ],
    archetypeThemeKeys: ["Unpredictability", "Loss of Control"],
    watchLabel: "Hormonal Rhythm",
    watchNote: "Whether uncertainty becomes clearer over time.",
    buckets: ["uncertaintySignals", "emotionalTone"]
  },
  {
    themeId: "body_unpredictability",
    scientificName: "Body Unpredictability",
    participantLabel: "Body changes that are hard to predict",
    keywords: [
      "don't know what my body will do",
      "body will do next",
      "can't trust my body",
      "unpredictable body",
      "comes out of nowhere"
    ],
    relatedPatterns: ["Body Unpredictability", "Hormonal Rhythm"],
    interpretationModifier: "body unpredictability may be part of the lived meaning of these observations",
    archetypeBoosts: [{ archetypeName: "The Uncertain Body Experience", weight: 3 }],
    archetypeThemeKeys: ["Unpredictability", "Loss of Control"],
    watchLabel: "Hormonal Rhythm",
    watchNote: "Whether body timing and predictability become easier to anticipate.",
    buckets: ["uncertaintySignals", "meaningSignals"]
  },
  {
    themeId: "planning_burden",
    scientificName: "Planning Burden",
    participantLabel: "Planning around your body",
    keywords: [
      "plan everything",
      "plan around",
      "around my period",
      "always preparing",
      "carry extra",
      "watch for"
    ],
    relatedPatterns: ["Planning Around Symptoms", "Daily Function", "Life Reorganization"],
    interpretationModifier: "planning around symptoms may be reorganizing daily life",
    archetypeBoosts: [{ archetypeName: "The Adapting Navigator", weight: 3 }],
    archetypeThemeKeys: ["Vigilance / Preparedness", "Unpredictability"],
    watchLabel: "Planning Burden",
    watchNote: "Whether planning burden eases or becomes more predictable.",
    buckets: ["meaningSignals", "adaptationSignals"]
  },
  {
    themeId: "feeling_unheard",
    scientificName: "Feeling Unheard",
    participantLabel: "Difficulty feeling believed",
    keywords: [
      "nobody believes",
      "no one believes",
      "not believed",
      "don't believe me",
      "feeling unheard",
      "not taken seriously"
    ],
    relatedPatterns: ["Care Experience", "Care Navigation Complexity", "Diagnostic Uncertainty"],
    interpretationModifier: "feeling unheard may be part of your care experience",
    archetypeBoosts: [{ archetypeName: "The Persistent Seeker", weight: 3 }],
    archetypeThemeKeys: ["Dismissal / Not Believed"],
    watchLabel: "Care Experience",
    watchNote: "Whether care experiences become more validating or remain difficult.",
    buckets: ["careExperienceNarrative", "emotionalTone"]
  },
  {
    themeId: "care_dismissal",
    scientificName: "Care Dismissal",
    participantLabel: "Care that felt dismissive",
    keywords: [
      "dismissed",
      "told it is normal",
      "told it's normal",
      "brushed off",
      "ignored my concerns"
    ],
    relatedPatterns: ["Care Experience", "Care Navigation Complexity"],
    interpretationModifier: "care dismissal may influence how this experience is understood",
    archetypeBoosts: [{ archetypeName: "The Persistent Seeker", weight: 2 }],
    archetypeThemeKeys: ["Dismissal / Not Believed"],
    watchLabel: "Care Experience",
    watchNote: "Whether care experiences become more validating or remain difficult.",
    buckets: ["careExperienceNarrative"]
  },
  {
    themeId: "diagnostic_uncertainty",
    scientificName: "Diagnostic Uncertainty",
    participantLabel: "Searching for answers",
    keywords: [
      "no answers",
      "still don't know why",
      "no diagnosis",
      "waiting for answers",
      "what is wrong"
    ],
    relatedPatterns: ["Care Experience", "Diagnostic Uncertainty"],
    interpretationModifier: "searching for clarity may be part of this experience",
    archetypeBoosts: [{ archetypeName: "The Persistent Seeker", weight: 2 }],
    archetypeThemeKeys: ["Dismissal / Not Believed", "Frustration / Exhaustion"],
    buckets: ["futureConcerns", "uncertaintySignals"]
  },
  {
    themeId: "frustration",
    scientificName: "Frustration",
    participantLabel: "Frustration and exhaustion",
    keywords: ["frustrating", "frustrated", "exhausted", "tired of this", "fed up", "draining"],
    relatedPatterns: ["Daily Function", "Care Experience"],
    interpretationModifier: "frustration and exhaustion may be part of the emotional weight",
    archetypeBoosts: [{ archetypeName: "The Body Negotiator", weight: 1 }],
    archetypeThemeKeys: ["Frustration / Exhaustion"],
    buckets: ["emotionalTone"]
  },
  {
    themeId: "isolation",
    scientificName: "Isolation",
    participantLabel: "Feeling alone with this",
    keywords: ["alone", "isolated", "no one understands", "by myself", "on my own"],
    relatedPatterns: ["Daily Function", "Care Experience"],
    interpretationModifier: "isolation may add to how heavy this experience feels",
    archetypeBoosts: [],
    archetypeThemeKeys: ["Avoidance / Withdrawal"],
    buckets: ["emotionalTone"]
  },
  {
    themeId: "hope",
    scientificName: "Hope",
    participantLabel: "Hope for clarity or relief",
    keywords: ["hope", "hoping", "wish", "looking forward", "better days"],
    relatedPatterns: ["Care Experience"],
    interpretationModifier: "hope may be present alongside difficulty",
    archetypeBoosts: [{ archetypeName: "The Persistent Seeker", weight: 1 }],
    archetypeThemeKeys: [],
    buckets: ["futureConcerns", "meaningSignals"]
  },
  {
    themeId: "fear",
    scientificName: "Fear",
    participantLabel: "Worry about what comes next",
    keywords: ["afraid", "scared", "fear", "worried", "anxious about"],
    relatedPatterns: ["Body Unpredictability", "Care Experience"],
    interpretationModifier: "fear or worry may be part of how this experience is felt",
    archetypeBoosts: [{ archetypeName: "The Uncertain Body Experience", weight: 1 }],
    archetypeThemeKeys: ["Unpredictability"],
    watchLabel: "Hormonal Rhythm",
    watchNote: "Whether uncertainty becomes clearer over time.",
    buckets: ["futureConcerns", "emotionalTone"]
  },
  {
    themeId: "self_doubt",
    scientificName: "Self-doubt",
    participantLabel: "Questioning your own experience",
    keywords: ["maybe it's just me", "am i overreacting", "doubting myself", "not sure if"],
    relatedPatterns: ["Care Experience", "Body Unpredictability"],
    interpretationModifier: "self-doubt may make it harder to trust what your body is showing",
    archetypeBoosts: [],
    archetypeThemeKeys: [],
    buckets: ["emotionalTone", "uncertaintySignals"]
  },
  {
    themeId: "self_advocacy",
    scientificName: "Self-advocacy",
    participantLabel: "Speaking up for your experience",
    keywords: ["spoke up", "advocated", "pushed back", "asked again", "sought help", "fought for"],
    relatedPatterns: ["Care Experience"],
    interpretationModifier: "self-advocacy may be part of how you navigate care",
    archetypeBoosts: [{ archetypeName: "The Persistent Seeker", weight: 2 }],
    archetypeThemeKeys: ["Dismissal / Not Believed"],
    buckets: ["selfAdvocacySignals"]
  },
  {
    themeId: "loss_of_normalcy",
    scientificName: "Loss of Normalcy",
    participantLabel: "Life feeling different than before",
    keywords: [
      "not normal",
      "used to be",
      "before this",
      "life changed",
      "not myself",
      "different person"
    ],
    relatedPatterns: ["Life Reorganization", "Daily Function"],
    interpretationModifier: "loss of normalcy may be part of the lived meaning of these symptoms",
    archetypeBoosts: [{ archetypeName: "The Adapting Navigator", weight: 2 }],
    archetypeThemeKeys: ["Loss of Control", "Identity / Body Change Concern"],
    buckets: ["meaningSignals"]
  }
];

function isNarrativeArray(value: unknown): value is NarrativePromptResponse[] {
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

export function extractNarrativeResponses(
  responses: ObservationResponseDraft[]
): NarrativePromptResponse[] {
  return responses
    .filter((response) => response.fieldId === "narrative_responses")
    .flatMap((response) => (isNarrativeArray(response.value) ? response.value : []))
    .filter((item) => item.completed && item.textResponse.trim().length > 0);
}

function confidenceFromMatch(keyword: string, text: string): NarrativeConfidenceLevel {
  const lower = text.toLowerCase();
  if (lower.includes(keyword)) {
    return keyword.length >= 20 ? "strong" : "moderate";
  }
  return "emerging";
}

function extractSnippet(text: string, keyword: string, maxLen = 90): string {
  const lower = text.toLowerCase();
  const index = lower.indexOf(keyword.toLowerCase());
  if (index < 0) {
    return "";
  }

  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + keyword.length + 40);
  let snippet = text.slice(start, end).trim();

  if (start > 0) {
    snippet = `…${snippet}`;
  }
  if (end < text.length) {
    snippet = `${snippet}…`;
  }

  return snippet.length > maxLen ? `${snippet.slice(0, maxLen - 1)}…` : snippet;
}

function uniqueThemes(themes: NarrativeTheme[]) {
  const seen = new Set<string>();
  return themes.filter((theme) => {
    if (seen.has(theme.themeId)) {
      return false;
    }
    seen.add(theme.themeId);
    return true;
  });
}

function emptyNarrativeIntelligence(): NarrativeIntelligence {
  return {
    narrativeThemes: [],
    participantVoice: [],
    emotionalTone: [],
    meaningSignals: [],
    adaptationSignals: [],
    uncertaintySignals: [],
    careExperienceNarrative: [],
    futureConcerns: [],
    selfAdvocacySignals: [],
    narrativeConfidence: {
      overall: "baseline",
      themeCount: 0,
      responsesPresent: false
    },
    archetypeModifiers: [],
    watchModifiers: [],
    storyModifiers: []
  };
}

function overallConfidence(themeCount: number): NarrativeConfidenceLevel {
  if (themeCount >= 3) {
    return "strong";
  }
  if (themeCount >= 2) {
    return "moderate";
  }
  if (themeCount >= 1) {
    return "emerging";
  }
  return "baseline";
}

export function buildNarrativeIntelligence(
  responses: ObservationResponseDraft[],
  _ontologyContext?: OntologyRoutingContext,
  locale?: string
): NarrativeIntelligence {
  const narrativeItems = extractNarrativeResponses(responses);

  if (narrativeItems.length === 0) {
    return emptyNarrativeIntelligence();
  }

  const combinedText = narrativeItems.map((item) => item.textResponse).join(" ");
  const lowerText = combinedText.toLowerCase();
  const themes: NarrativeTheme[] = [];

  for (const definition of NARRATIVE_THEME_REGISTRY) {
    const matchedKeyword = definition.keywords.find((keyword) =>
      lowerText.includes(keyword.toLowerCase())
    );

    if (!matchedKeyword) {
      continue;
    }

    themes.push({
      themeId: definition.themeId,
      scientificName: definition.scientificName,
      participantLabel: v43Text(definition.themeId, "participantLabel", definition.participantLabel, locale),
      sourceTextSnippet: extractSnippet(combinedText, matchedKeyword),
      confidence: confidenceFromMatch(matchedKeyword, combinedText),
      relatedPatterns: definition.relatedPatterns,
      interpretationModifier: v43Text(
        definition.themeId,
        "interpretationModifier",
        definition.interpretationModifier,
        locale
      )
    });
  }

  const unique = uniqueThemes(themes);
  const intelligence = emptyNarrativeIntelligence();
  intelligence.narrativeThemes = unique;
  intelligence.narrativeConfidence = {
    overall: overallConfidence(unique.length),
    themeCount: unique.length,
    responsesPresent: true
  };

  for (const theme of unique) {
    const definition = NARRATIVE_THEME_REGISTRY.find((item) => item.themeId === theme.themeId);
    if (!definition) {
      continue;
    }

    for (const bucket of definition.buckets) {
      if (!intelligence[bucket].includes(theme.participantLabel)) {
        intelligence[bucket].push(theme.participantLabel);
      }
    }

    for (const boost of definition.archetypeBoosts) {
      intelligence.archetypeModifiers.push({
        target: boost.archetypeName,
        reason: theme.participantLabel,
        weight: boost.weight
      });
    }

    if (definition.watchLabel && definition.watchNote) {
      intelligence.watchModifiers.push({
        watchLabel: definition.watchLabel,
        compareNote: definition.watchNote,
        sourceThemeId: theme.themeId
      });
    }

    intelligence.storyModifiers.push({
      phrase: theme.interpretationModifier,
      sourceThemeId: theme.themeId
    });
  }

  intelligence.participantVoice = unique
    .map((theme) => theme.sourceTextSnippet)
    .filter((snippet) => snippet.length >= 12)
    .slice(0, 2);

  return intelligence;
}

export function narrativeThemeToArchetypeScore(
  intelligence: NarrativeIntelligence,
  archetypeName: string,
  archetypeNarrativeThemeKeys: string[]
): number {
  let score = 0;

  for (const theme of intelligence.narrativeThemes) {
    const definition = NARRATIVE_THEME_REGISTRY.find((item) => item.themeId === theme.themeId);
    if (!definition) {
      continue;
    }

    for (const boost of definition.archetypeBoosts) {
      if (boost.archetypeName === archetypeName) {
        score += boost.weight;
      }
    }

    for (const key of definition.archetypeThemeKeys) {
      if (archetypeNarrativeThemeKeys.includes(key)) {
        score += theme.confidence === "strong" ? 2 : 1;
      }
    }
  }

  return score;
}

export function applyNarrativeArchetypeOverride<T extends { name: string }>(
  patternRanked: Array<{ definition: T; score: number }>,
  narrativeRanked: Array<{ definition: T; score: number }>
): T {
  const patternTop = patternRanked[0];
  const narrativeTop = narrativeRanked[0];

  if (
    narrativeTop &&
    patternTop &&
    narrativeTop.definition.name !== patternTop.definition.name &&
    narrativeTop.score >= patternTop.score + 2
  ) {
    return narrativeTop.definition;
  }

  return patternTop?.definition ?? narrativeRanked[0]?.definition ?? patternRanked[0].definition;
}

export function buildNarrativeEvidence(
  intelligence: NarrativeIntelligence,
  locale?: string
): ReflectionChamberNarrativeEvidence[] {
  return intelligence.narrativeThemes.map((theme) => ({
    themeId: theme.themeId,
    scientificName: theme.scientificName,
    participantLabel: theme.participantLabel,
    sourceSnippet: theme.sourceTextSnippet,
    relatedPatternLabel: theme.relatedPatterns
      .map((pattern) => participantLabelFor(pattern, locale))
      .slice(0, 2)
      .join(" · "),
    confidence: theme.confidence,
    briefingInfluence: theme.interpretationModifier
  }));
}

export function composeNarrativeStorySegment(
  intelligence: NarrativeIntelligence,
  maxThemes = 2,
  locale?: string
): string {
  if (intelligence.narrativeThemes.length === 0) {
    return "";
  }

  const modifiers = intelligence.storyModifiers
    .slice(0, maxThemes)
    .map((item) => item.phrase);

  const lead = v43Text("_template", "narrativeAlsoSuggestsLead", "Your narrative also suggests", locale);
  const joiner = locale && locale !== "en" ? "، اور " : ", and ";

  return `${lead} ${modifiers.join(joiner)}.`;
}

export function getNarrativeThemeIds(intelligence: NarrativeIntelligence): string[] {
  return intelligence.narrativeThemes.map((theme) => theme.themeId);
}
