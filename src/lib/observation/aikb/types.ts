// AIKB (Atlas Intelligence Knowledge Base) types — mirrored from the source of
// truth (womb-atlas-participant-app/services/aikb-loader/types.ts). The registry
// JSON lives under src/content/aikb/ and is the authoritative content for the
// signal / pattern / reflection / index / knowledge-graph / governance layers.

export type AikbObservationField = {
  observationId?: string;
  fieldId: string;
  section: string;
  label: string;
};

export type AikbSignalMapping = {
  id: string;
  observationFieldId: string;
  signalType: string;
  label: string;
};

export type AikbPatternValueCheck = {
  fieldId: string;
  values: string[];
};

export type AikbPatternRule = {
  id: string;
  name: string;
  domain: string;
  fieldIds: string[];
  narrativeCues: string[];
  valueChecks: AikbPatternValueCheck[];
  meaning: string;
  atlasNote: string;
  watchOverTime: string;
};

export type AikbReflectionArchetype = {
  id: string;
  name: string;
  tone: string;
  selectionSignals: string[];
};

export type AikbKnowledgeEdge = {
  fromId: string;
  toId: string;
  relationship: string;
};

export type AikbIndexDefinition = {
  id: string;
  name: string;
  description: string;
  patternIds: string[];
};

export type AikbGovernanceRule = {
  id: string;
  rule: string;
  severity: "block" | "warn";
};

export type AikbBundle = {
  version: string;
  generatedAt: string;
  observations: { fields: AikbObservationField[] };
  signals: { mappings: AikbSignalMapping[] };
  patterns: { entries: AikbPatternRule[] };
  reflection: { archetypes: AikbReflectionArchetype[]; tones: string[] };
  knowledgeGraph: { edges: AikbKnowledgeEdge[] };
  indices: { definitions: AikbIndexDefinition[] };
  governance: { rules: AikbGovernanceRule[] };
};
