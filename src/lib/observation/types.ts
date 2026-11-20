// Shared, serializable types for the DB-driven observation engine.
// These mirror the form-definition rows but are plain objects so they can be
// passed from server components to the client wizard and used isomorphically.
import type { UiStrings } from "./ui-strings";

// Narrative prompts (NP01..NP05 / SNP01) capture both free text and an optional
// audio recording (transcribed via Speech-to-Text). Stored under the prompt id.
export interface NarrativeAnswer {
  text?: string;
  audioUrl?: string;
  transcription?: string;
  language?: string;
}

export type AnswerValue = string | string[] | boolean | null | NarrativeAnswer;
export type AnswerMap = Record<string, AnswerValue>;

// Effective text of a narrative answer: typed text wins; a voice-only answer
// (recorded but never typed) falls back to its Speech-to-Text transcription.
export function narrativeAnswerText(value: AnswerValue | undefined): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const { text, transcription } = value as NarrativeAnswer;
    if (text?.trim()) return text;
    if (transcription) return transcription;
  }
  return "";
}

export type RenderKind =
  | "landing"
  | "question"
  | "information"
  | "consent"
  | "safety_check"
  | "safety_alert"
  | "narrative"
  | "review"
  | "processing"
  | "reflection"
  | "reflection_expansion"
  | "reflection_review"
  | "record_privacy"
  | "constellation"
  | "observed_patterns"
  | "atlas_record"
  | "confirmation"
  | "comparison";

export interface AnswerOption {
  value: string;
  label: string;
  order: number;
  isExclusive: boolean;
  signalTag?: string | null;
}

export interface Question {
  fieldId: string;
  screenId: string;
  questionText: string;
  fieldType: string; // single_select | multi_select | boolean | text | country | text_audio | ...
  required: string; // Required | Optional | Conditional
  validation?: string | null;
  notes?: string | null;
  targetTable: string;
  targetColumn: string;
  order: number;
  options: AnswerOption[];
}

export interface NarrativePrompt {
  promptId: string;
  screenId: string;
  promptText: string;
  captureType: string;
  order: number;
}

export interface Screen {
  screenId: string;
  flowKey: string;
  name: string;
  section: string;
  purpose: string;
  inputType: string;
  renderKind: RenderKind;
  primaryActionLabel: string;
  order: number;
  atlasDomain?: string | null;
  mvpPhase: string;
  status: string;
  visibilityRule?: VisibilityRule | null;
  questions: Question[];
  narrativePrompts: NarrativePrompt[];
}

export interface Route {
  fromScreenId: string;
  toScreenId: string;
  condition: Condition | null;
  priority: number;
  note?: string | null;
}

export interface SignalRuleDef {
  signalId: string;
  name: string;
  domain: string;
  sourceScreen: string;
  severity: "low" | "moderate" | "high";
  condition: Condition;
}

export interface ReflectionRuleDef {
  ruleId: string;
  condition: Condition;
  reflectionType: string;
  templateCopy: string;
  targetScreen: string; // S77 | S77A | S77B
  priority: number;
}

export interface FormDefinition {
  flowKey: string;
  screens: Screen[];
  routes: Route[];
  signals: SignalRuleDef[];
  reflectionRules: ReflectionRuleDef[];
  /** Localised wizard chrome (nav buttons, safety banner). English fallback. */
  ui: UiStrings;
}

// ---- Condition DSL ------------------------------------------------------
export type FieldOp =
  | "eq"
  | "neq"
  | "in"
  | "nin"
  | "contains_any"
  | "any_except"
  | "count_gte"
  | "present"
  | "isTrue";

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { field: string; op: FieldOp; value?: unknown; exclude?: string[] }
  | { signal: string; op: "present" | "absent" }
  | { burden: string };

export type Burden = "Low" | "Moderate" | "High";

export interface ComputedSignal {
  signalId: string;
  name: string;
  domain: string;
  severity: "low" | "moderate" | "high";
  evidence: Record<string, AnswerValue>;
}

// Visibility rule (life-stage suppression etc.)
export interface VisibilityRule {
  hideForReproductiveState?: string[];
  showIf?: Condition;
  hideIf?: Condition;
}

export interface EvalContext {
  answers: AnswerMap;
  signals: string[]; // signalIds that fired
  burden?: Burden;
}
