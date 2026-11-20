// Normalizes an observatory-system answer map into AtlasObservationRecord[]
// keyed on the AIKB registry field id. Native to observatory-system (uses our
// field-id map + the AIKB observation dictionary) rather than the participant-app
// observation-contract, but produces the same normalized shape.
import type { AikbBundle } from "@/lib/observation/aikb/types";
import { toRegistryFieldId } from "@/lib/observation/aikb/field-map";
import type { AnswerMap, AnswerValue } from "@/lib/observation/types";
import {
  emptySectionCounts,
  toReflectionSection,
  type ReflectionSectionId,
} from "./sections";
import type { AtlasObservationRecord } from "./types";
import { v43Text } from "./v43/v43-i18n";

const IGNORED_VALUES = new Set(["none", "prefer_not_to_say", "not_applicable", ""]);
const NARRATIVE_PROMPT = /^NP\d+$/i;
const SENSITIVE_NARRATIVE_PROMPT = /^SNP\d+$/i;

/** Optional resolver app option value -> human label (for nicer displayText). */
export type OptionLabelResolver = (fieldId: string, value: string) => string | undefined;

/** Optional resolver app field id -> the wizard's own translated question text. */
export type FieldLabelResolver = (fieldId: string) => string | undefined;

function toStringValues(value: AnswerValue | undefined): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string") return [value];
  if (typeof value === "boolean") return [value ? "true" : "false"];
  if (typeof value === "number") return [String(value)];
  return [];
}

function narrativeText(value: AnswerValue | undefined): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const t = (value as { text?: unknown }).text;
    if (typeof t === "string") return t;
  }
  return "";
}

export interface ExtractionResult {
  observations: AtlasObservationRecord[];
  sectionCounts: Record<ReflectionSectionId, number>;
}

export function extractObservations(
  answers: AnswerMap,
  aikb: AikbBundle,
  optionLabel?: OptionLabelResolver,
  fieldLabel?: FieldLabelResolver,
  locale?: string,
): ExtractionResult {
  const registryByField = new Map(aikb.observations.fields.map((f) => [f.fieldId, f]));
  const observations: AtlasObservationRecord[] = [];
  let counter = 0;
  const nextId = () => `OBS-${String(++counter).padStart(3, "0")}`;

  for (const [appFieldId, raw] of Object.entries(answers)) {
    // Narrative prompt keys (NP01.. / SNP01..) route to Narrative / Sensitive.
    if (NARRATIVE_PROMPT.test(appFieldId) || SENSITIVE_NARRATIVE_PROMPT.test(appFieldId)) {
      const text = narrativeText(raw).trim();
      if (!text) continue;
      const isSensitive = SENSITIVE_NARRATIVE_PROMPT.test(appFieldId);
      const narrativeLabel = isSensitive
        ? v43Text("_template", "sensitiveNarrativeLabel", "Sensitive narrative", locale)
        : v43Text("_template", "narrativeLabel", "Narrative", locale);
      observations.push({
        id: nextId(),
        fieldId: appFieldId,
        registryFieldId: isSensitive ? "sensitive_narrative" : "narrative_prompts",
        section: isSensitive ? "sensitive" : "narrative",
        label: narrativeLabel,
        value: "narrative_entry",
        displayText: text.slice(0, 120),
        screenId: "",
      });
      continue;
    }

    const registryFieldId = toRegistryFieldId(appFieldId);
    const registryField = registryByField.get(registryFieldId);
    if (!registryField) continue; // not an AIKB dictionary field

    const section = toReflectionSection(registryField.section);
    if (!section) continue; // review / reflection / atlas_record — not a reflection section

    // `registryFieldId`/`value` stay the AIKB registry's raw English keys —
    // matching keys read elsewhere via `===`/`.find()`, never translated.
    // Only `label`/`displayText` (participant-facing) resolve through the
    // wizard's own translation map, the same one it renders its questions
    // from, with the registry's English label/value as the fallback.
    const label = fieldLabel?.(appFieldId) ?? registryField.label;

    for (const value of toStringValues(raw)) {
      if (IGNORED_VALUES.has(value)) continue;
      const readable = optionLabel?.(appFieldId, value) ?? value.replaceAll("_", " ");
      observations.push({
        id: nextId(),
        fieldId: appFieldId,
        registryFieldId,
        section,
        label,
        value,
        displayText: `${label}: ${readable}`,
        screenId: "",
      });
    }
  }

  const sectionCounts = emptySectionCounts();
  for (const o of observations) sectionCounts[o.section] += 1;

  return { observations, sectionCounts };
}
