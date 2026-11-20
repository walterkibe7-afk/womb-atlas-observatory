import { LANGUAGES } from "@/lib/observation/languages";

/**
 * The language to write model output in, resolved from a locale code.
 * Names come from LANGUAGES so a new locale needs adding in only one place.
 */
export function targetLanguage(locale: string | undefined) {
  if (!locale || locale === "en") return null;
  return LANGUAGES.find((l) => l.code === locale) ?? null;
}

/**
 * A language directive meant to be placed FIRST in a system prompt — position
 * matters, since a directive appended after other instructions competes with
 * whatever came before it for the model's attention.
 *
 * Deliberately generic: this is shared between the reflection pipeline
 * (JSON output, guarding against copying an English exemplar verbatim) and
 * the Aminata chat companion (plain-text output, no exemplar in play).
 * Callers with extra format-specific requirements (e.g. "keep JSON keys in
 * English") append those themselves rather than this function assuming one
 * output shape.
 */
export function languageInstruction(locale: string | undefined): string {
  const lang = targetLanguage(locale);
  if (!lang) return "";
  return `LANGUAGE REQUIREMENT — this overrides everything else about wording.
Every response you write must be in ${lang.name} (${lang.nativeName}).
Returning English is a failure.
Translate meaning, not words — this is read by someone describing her own body, so use everyday, respectful ${lang.name} a non-clinician would use.
Keep the same non-diagnostic boundaries in ${lang.name}. Do not mention the translation.

`;
}
