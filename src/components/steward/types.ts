// Shared types for the steward Review Queue + Atlas Record detail.
// Mirrors the DTO returned by GET /api/steward/records.

export type SignalDTO = {
  signalId: string;
  name: string;
  domain: string;
  severity: string;
};

export type StewardRecord = {
  id: string;
  displayId: string;
  priority: "High" | "Medium" | "Low";
  burdenLevel: string;
  status: string;
  submittedAt: string;
  contributor: {
    name: string;
    ageRange: string | null;
    country: string | null;
    lifeStage: string | null;
  };
  source: string;
  topic: string;
  themes: string[];
  summary: string;
  signals: SignalDTO[];
  observedPatterns: { domain: string; signals: string[] }[];
  stewardNotes: string | null;
  reviewedBy: string | null; // steward who set the record's status, if any
  reviewedAt: string | null; // ISO timestamp of that review
};

// ---------------------------------------------------------------------------
// Detail payload — GET /api/steward/records/[id]. Fetched lazily when a record
// is selected; powers the Narrative / Observations / Signals / History /
// Timeline tabs. The queue's StewardRecord already covers the Overview tab.
// ---------------------------------------------------------------------------

export type NarrativeItem = {
  promptId: string;
  promptText: string | null;
  text: string | null;
  transcription: string | null;
  hasAudio: boolean;
  audioUrl: string | null; // steward-served playback URL, when audio exists
  language: string | null;
  status: string;
};

export type ObservationItem = {
  fieldId: string;
  label: string; // question text
  value: string; // human-readable answer (codes mapped to labels)
};

export type ObservationGroup = {
  screenId: string;
  screenName: string;
  section: string;
  items: ObservationItem[];
};

export type SignalDetail = {
  id: string; // pattern business id (PAT-###)
  name: string;
  domain: string;
  role: string; // dominant | supporting | ...
  confidence: string; // high | moderate | low
  meaning: string;
  atlasNote: string;
  watchOverTime: string;
};

export type SourceSignal = {
  id: string; // signal business id (SIG-###)
  label: string;
  signalType: string;
  fieldId: string;
};

export type HistoryEvent = {
  id: string;
  type: "created" | "run" | "reviewed" | "audit";
  label: string;
  detail: string | null;
  at: string; // ISO timestamp
};

export type TimelinePoint = {
  id: string;
  displayId: string;
  burdenLevel: string;
  submittedAt: string;
  source: string;
  isCurrent: boolean;
};

export type StewardRecordDetail = {
  id: string;
  narratives: NarrativeItem[];
  observations: ObservationGroup[];
  signals: SignalDetail[];
  sourceSignals: SourceSignal[];
  history: HistoryEvent[];
  timeline: TimelinePoint[];
  meta: {
    traceId: string | null;
    pipelineVersion: string | null;
    governancePassed: boolean | null;
    reflectionSource: string | null;
  };
};
