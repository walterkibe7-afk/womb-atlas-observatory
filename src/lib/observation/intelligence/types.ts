// Atlas Intelligence record types — ported from the source of truth
// (participant-app/services/atlas-intelligence/types.ts) and adapted to
// observatory-system (reflection output is a lean native shape, not the
// participant-app AtlasRecord).
import type { ReflectionSectionId } from "./sections";

export type AtlasObservationRecord = {
  id: string; // OBS-###
  fieldId: string; // app field id (UPPERCASE)
  registryFieldId: string; // AIKB registry field id (snake_case)
  section: ReflectionSectionId;
  label: string;
  value: string;
  displayText: string;
  screenId: string;
};

export type AtlasSignalRecord = {
  id: string; // AIKB signal mapping id (SIG-*)
  observationIds: string[];
  signalType: string;
  label: string;
  fieldId: string; // registry field id
};

export type AtlasPatternRecord = {
  id: string; // AIKB pattern id (PAT-###)
  name: string;
  domain: string;
  confidence: "low" | "moderate" | "high";
  observationConfidence: number;
  supportingObservationIds: string[];
  supportingSignalIds: string[];
  role: "dominant" | "supporting" | "protective" | "trajectory";
  meaning: string;
  atlasNote: string;
  watchOverTime: string;
};

export type KnowledgeContext = {
  relatedSignalIds: string[];
  relatedPatternIds: string[];
  educationNotes: string[];
  strengthNotes: string[];
  trajectoryNotes: string[];
  careContextNotes: string[];
};

export type AtlasIndexRecord = {
  id: string;
  name: string;
  description: string;
  value: number;
  patternIds: string[];
};

export type ReflectionPlan = {
  traceId: string;
  archetypeId: string;
  archetypeName: string;
  tone: string;
  dominantPatternIds: string[];
  supportingPatternIds: string[];
  educationIds: string[];
  reflectionQuestions: string[];
  protectiveStrengths: string[];
  futureWatchAreas: string[];
};

// Lean, observatory-system-native reflection payload (captures the SoT ARIF
// content structure without importing the participant-app AtlasRecord).
export type AtlasReflection = {
  archetypeId: string;
  archetypeName: string;
  tone: string;
  openingInsight: string;
  whatExperienceMayMean: string;
  whatAppearsConnected: string[];
  strengthsObserved: string[];
  bodyLiteracyNote: string;
  whatAtlasWillWatch: string[];
  reflectionQuestions: string[];
  paragraphs: string[];
  sectionCounts: Record<ReflectionSectionId, number>;
  source: "openai" | "deterministic";
  disclaimer: string;
};

export type ExplainabilityStep = {
  step: "observation" | "signal" | "pattern" | "reflection_component" | "displayed_text";
  sourceId: string;
  label: string;
  displayedText: string;
};

export type ExplainabilityTrace = {
  traceId: string;
  steps: ExplainabilityStep[];
};

export type PipelineTimings = {
  observationMs: number;
  signalMs: number;
  patternMs: number;
  knowledgeGraphMs: number;
  planningMs: number;
  assemblyMs: number;
  totalMs: number;
};

// A deterministically-detected pattern (produced by the ARIF detector) before
// it is enriched with AIKB metadata / ids by the pattern service.
export type DetectedPattern = {
  name: string;
  supportingSignals: string[];
  meaning: string;
  atlasNote: string;
  watchOverTime: string;
};
