import type { AtlasRecord } from "./atlas-intelligence-service";
import type { ObservationResponseDraft } from "./first-observation-types";
import type { ReflectionSummarySectionId } from "./observation-contract";

export type AtlasObservationRecord = {
  id: string;
  fieldId: string;
  registryFieldId: string;
  section: ReflectionSummarySectionId;
  label: string;
  value: string;
  displayText: string;
  screenId: string;
};

export type ReflectionSummarySectionCounts = {
  questionnaire: Record<ReflectionSummarySectionId, number>;
  normalized: Record<ReflectionSummarySectionId, number>;
  registryMatches: Record<ReflectionSummarySectionId, number>;
  preview: Record<ReflectionSummarySectionId, number>;
  reflectionPayload: Record<ReflectionSummarySectionId, number>;
  reflectionResponse: Record<ReflectionSummarySectionId, number>;
  uiRendered: Record<ReflectionSummarySectionId, number>;
};

export type ObservationPipelineTrace = {
  sectionCounts: ReflectionSummarySectionCounts;
  unmatchedResponses: Array<{ screenId: string; fieldId: string }>;
  observationCount: number;
  responseCount: number;
};

export type AtlasSignalRecord = {
  id: string;
  observationIds: string[];
  signalType: string;
  label: string;
  fieldId: string;
};

export type AtlasPatternRecord = {
  id: string;
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

export type AtlasIntelligenceResult = {
  traceId: string;
  observations: AtlasObservationRecord[];
  reflectionSummarySections: ReflectionSummarySectionCounts;
  signals: AtlasSignalRecord[];
  patterns: AtlasPatternRecord[];
  knowledgeContext: KnowledgeContext;
  reflectionPlan: ReflectionPlan;
  reflection: AtlasRecord;
  atlasRecord: AtlasRecord;
  indices: AtlasIndexRecord[];
  explainability: ExplainabilityTrace;
  governancePassed: boolean;
  governanceViolations: string[];
  timings: PipelineTimings;
};

export type IntelligenceReflectInput = {
  observationId: string;
  responses: ObservationResponseDraft[];
};

export type ObservedExperienceReviewSection = {
  sectionId: ReflectionSummarySectionId;
  label: string;
  screenId: string;
  count: number;
  statusText: string;
  observations: Array<{ id: string; displayText: string }>;
};

export type ProcessingStepId =
  | "observations"
  | "signals"
  | "patterns"
  | "reflection";

export type ProcessingStepStatus = {
  id: ProcessingStepId;
  label: string;
  completed: boolean;
};
