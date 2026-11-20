export type QuestionFieldType =
  | "information"
  | "single_select"
  | "multi_select"
  | "country_search"
  | "text"
  | "textarea";

export type ObservationScreenKind =
  | "landing"
  | "information"
  | "narrative"
  | "processing"
  | "review"
  | "reflection"
  | "atlas_visualization"
  | "observed_patterns"
  | "atlas_summary"
  | "completion"
  | "transition"
  | "question";

export type QuestionField = {
  id: string;
  type: QuestionFieldType;
  label: string;
  helperText?: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{
    value: string;
    label: string;
  }>;
};

export type RoutingRule = {
  fieldId: string;
  equals?: string | boolean | number;
  includes?: string;
  nextScreenId: string;
};

export type ObservationScreenDefinition = {
  id: string;
  screenCode: string;
  kind: ObservationScreenKind;
  chamber: string;
  title: string;
  description: string;
  body?: string[];
  primaryActionLabel?: string;
  secondaryActionLabel?: string;
  footerText?: string;
  sectionLabel?: string;
  progressStep?: number;
  progressTotal?: number;
  requiredFieldId?: string;
  figmaLayout?: "landing_chamber" | "intro_centered" | "context_question" | "default";
  buttonLayout?: "landing_cta" | "stacked_long" | "split";
  helperText?: string;
  postFieldText?: string;
  fields: QuestionField[];
  defaultNextScreenId?: string;
  routingRules?: RoutingRule[];
};

export type ObservationResponseValue =
  | string
  | number
  | boolean
  | string[]
  | NarrativePromptResponse[]
  | null;

export type NarrativePromptResponse = {
  promptId: string;
  promptText: string;
  textResponse: string;
  audioRecordingUrl?: string | null;
  audioBlobId?: string | null;
  skipped: boolean;
  completed: boolean;
  updatedAt: string;
};

export type ObservationResponseDraft = {
  screenId: string;
  fieldId: string;
  value: ObservationResponseValue;
};
