// Atlas Intelligence runner — replicates the mobile app's pipeline.ts on
// observatory-system: the deterministic v4.3 engine (buildAtlasRecord) detects
// patterns + composes a baseline reflection + archetype; the AIKB layer computes
// signals/patterns/indices + selects the reflection archetype/tone; OpenAI (primary,
// per decision D-4) rewrites the reflection prose, with the deterministic baseline
// as the governed fallback.
import { getAikbBundle } from "@/lib/observation/aikb/loader";
import { narrativeAnswerText } from "@/lib/observation/types";
import type { AnswerMap } from "@/lib/observation/types";

import {
  buildExplainabilityTrace,
  computeIndices,
  detectPatterns,
  expandKnowledgeGraph,
  extractObservations,
  mapObservationsToSignals,
  planReflection,
  validateGovernance,
} from "./index";
import type {
  AtlasIndexRecord,
  AtlasObservationRecord,
  AtlasPatternRecord,
  AtlasReflection,
  AtlasSignalRecord,
  DetectedPattern,
  ExplainabilityTrace,
  KnowledgeContext,
  ReflectionPlan,
} from "./types";

import { buildAtlasRecord, type AtlasRecord } from "./v43/atlas-intelligence-service";
import { buildReflectionChamberIntelligence, type ReflectionChamberIntelligence } from "./v43/reflection-chamber";
import { enhanceReflectionWithLlm } from "./v43/openai-reflection";
import { loadTranslationMap } from "@/lib/observation/translations";
import { resolveUiStrings } from "@/lib/observation/ui-strings";
import type {
  AtlasReflectionContent,
} from "./v43/atlas-intelligence-v43";
import type {
  NarrativePromptResponse,
  ObservationResponseDraft,
  ObservationResponseValue,
} from "./v43/first-observation-types";

const NARRATIVE_PROMPT = /^NP\d+$/i;
const SENSITIVE_NARRATIVE_PROMPT = /^SNP\d+$/i;

/** Adapt an observatory answer map into the engine's ObservationResponseDraft[]. */
function answersToResponses(answers: AnswerMap): ObservationResponseDraft[] {
  const responses: ObservationResponseDraft[] = [];
  const narrativePrompts: NarrativePromptResponse[] = [];
  const sensitivePrompts: NarrativePromptResponse[] = [];

  for (const [fieldId, value] of Object.entries(answers)) {
    if (NARRATIVE_PROMPT.test(fieldId)) {
      const text = narrativeAnswerText(value);
      if (text.trim()) {
        narrativePrompts.push(makeNarrative(fieldId, text));
      }
      continue;
    }
    if (SENSITIVE_NARRATIVE_PROMPT.test(fieldId)) {
      const text = narrativeAnswerText(value);
      if (text.trim()) {
        sensitivePrompts.push(makeNarrative(fieldId, text));
      }
      continue;
    }
    responses.push({ screenId: "", fieldId, value: value as ObservationResponseValue });
  }

  // The engine routes narrative by (screenId, "narrative_responses").
  if (narrativePrompts.length) {
    responses.push({
      screenId: "s64-narrative-chamber",
      fieldId: "narrative_responses",
      value: narrativePrompts,
    });
  }
  if (sensitivePrompts.length) {
    responses.push({
      screenId: "s71-sensitive-narrative",
      fieldId: "narrative_responses",
      value: sensitivePrompts,
    });
  }
  return responses;
}

function makeNarrative(promptId: string, text: string): NarrativePromptResponse {
  return {
    promptId,
    promptText: "",
    textResponse: text,
    skipped: false,
    completed: true,
    updatedAt: new Date().toISOString(),
  };
}

function toDetectedPatterns(record: AtlasRecord): DetectedPattern[] {
  return record.observedPatterns.map((p) => ({
    name: p.name,
    supportingSignals: p.supportingSignals,
    meaning: p.plainLanguageMeaning,
    atlasNote: p.atlasNote,
    watchOverTime: p.watchOverTime,
  }));
}

export interface AtlasIntelligenceResult {
  traceId: string;
  /** v4.3 archetype shown to the participant. */
  archetype: AtlasRecord["archetype"];
  /** AIKB reflection archetype selected for tone (feeds the OpenAI prompt). */
  planArchetype: { id: string; name: string; tone: string };
  reflectionContent: AtlasReflectionContent;
  reflectionSource: "openai" | "deterministic";
  atlasRecord: AtlasRecord;
  reflectionChamber: ReflectionChamberIntelligence;
  observations: AtlasObservationRecord[];
  signals: AtlasSignalRecord[];
  patterns: AtlasPatternRecord[];
  indices: AtlasIndexRecord[];
  knowledgeContext: KnowledgeContext;
  explainability: ExplainabilityTrace;
  governance: { passed: boolean; violations: string[] };
  sectionCounts: Record<string, number>;
}

/**
 * Run the full Atlas Intelligence pipeline for one observation's answers.
 * Pure/async (OpenAI). Persistence is handled by the API route.
 */
export async function runAtlasIntelligence(
  answers: AnswerMap,
  locale?: string,
): Promise<AtlasIntelligenceResult> {
  const traceId = crypto.randomUUID();
  const aikb = getAikbBundle();
  const responses = answersToResponses(answers);

  // The wizard's own OPTION.*/QUESTION.*/SCREEN.*/UI.* translation rows
  // (already seeded for every locale the wizard supports) — reused so the v4.3
  // engine's "evidence" bullets, which reconstruct field/value display text
  // independently of the wizard's own rendering, speak the participant's
  // locale too instead of silently staying English.
  const fieldTranslations = locale ? await loadTranslationMap("first_observation", locale) : {};

  // AIKB observation/signal layer. `extractObservations` feeds the
  // Constellation node evidence text (buildAllConstellationNodes), so its
  // label/value reconstruction needs the same translation map the v4.3 path
  // below already uses — this used to fall straight to the AIKB registry's
  // raw English label and `value.replaceAll("_", " ")`.
  const { observations, sectionCounts } = extractObservations(
    answers,
    aikb,
    (fieldId, value) => fieldTranslations[`OPTION.${fieldId}.${value}.label`],
    (fieldId) => fieldTranslations[`QUESTION.${fieldId}.questionText`],
    locale,
  );
  const signals = mapObservationsToSignals(observations, aikb);

  // v4.3 deterministic engine: detection + baseline reflection + archetype.
  const v43record = buildAtlasRecord(responses, locale, fieldTranslations);

  // AIKB pattern enrichment (adds PAT-### ids + metadata) using the v4.3 detections.
  const patterns = detectPatterns(observations, signals, aikb, toDetectedPatterns(v43record));
  const knowledgeContext = expandKnowledgeGraph(patterns, signals, aikb);
  const plan: ReflectionPlan = planReflection(traceId, patterns, knowledgeContext, aikb);

  // Reflection assembly: OpenAI primary, deterministic baseline as governed fallback.
  const baseline = v43record.reflectionContent;
  let reflectionContent: AtlasReflectionContent = baseline;
  let reflectionSource: "openai" | "deterministic" = "deterministic";
  try {
    const enhanced = await enhanceReflectionWithLlm({
      plan,
      knowledgeContext,
      patterns,
      baseline,
      locale,
    });
    if (enhanced) {
      reflectionContent = enhanced;
      reflectionSource = "openai";
    }
  } catch (error) {
    console.error("OpenAI reflection failed; using deterministic v4.3 baseline.", error);
  }

  const atlasRecord: AtlasRecord = { ...v43record, reflectionContent };
  const chamberStrings = resolveUiStrings(fieldTranslations);
  const reflectionChamber = buildReflectionChamberIntelligence(
    atlasRecord,
    responses,
    chamberStrings,
    locale,
    fieldTranslations,
  );
  const indices = computeIndices(patterns, aikb);

  // Lean reflection view for governance + explainability.
  const leanReflection: AtlasReflection = {
    archetypeId: plan.archetypeId,
    archetypeName: v43record.archetype.name,
    tone: plan.tone,
    openingInsight: reflectionContent.openingInsight,
    whatExperienceMayMean: reflectionContent.whatExperienceMayMean,
    whatAppearsConnected: reflectionContent.whatAppearsConnected,
    strengthsObserved: reflectionContent.strengthsObserved,
    bodyLiteracyNote: reflectionContent.bodyLiteracyNote,
    whatAtlasWillWatch: reflectionContent.whatAtlasWillWatch,
    reflectionQuestions: plan.reflectionQuestions,
    paragraphs: [
      reflectionContent.openingInsight,
      reflectionContent.whatExperienceMayMean,
      ...reflectionContent.whatAppearsConnected,
      ...reflectionContent.strengthsObserved,
    ],
    sectionCounts,
    source: reflectionSource,
    disclaimer: v43record.disclaimer,
  };

  const governance = validateGovernance(leanReflection, aikb);
  const explainability = buildExplainabilityTrace({
    traceId,
    observations,
    signals,
    patterns,
    plan,
    reflection: leanReflection,
  });

  return {
    traceId,
    archetype: v43record.archetype,
    planArchetype: { id: plan.archetypeId, name: plan.archetypeName, tone: plan.tone },
    reflectionContent,
    reflectionSource,
    atlasRecord,
    reflectionChamber,
    observations,
    signals,
    patterns,
    indices,
    knowledgeContext,
    explainability,
    governance,
    sectionCounts,
  };
}
