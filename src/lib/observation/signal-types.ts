/**
 * AIKB signal type → the domain a signal is shown under in the participant UI.
 *
 * `src/content/aikb/signals.json` carries 491 signals across 28 signal types;
 * the participant UI speaks in six body domains plus narrative. This is the only
 * place the two vocabularies meet. `scripts/verify-loer-v7.mjs` asserts every
 * type in the registry appears here, so a signal type added to the AIKB fails a
 * check rather than silently falling through to a domain it doesn't belong to.
 *
 * Grouping follows `PATTERN_DOMAIN` in `api/observation/intelligence/route.ts`,
 * which makes the same call one layer up: pelvic symptoms sit with Pain, body
 * changes with Hormonal.
 *
 * No server-only imports — the dashboard cards import these values at runtime.
 */

/** Narrative signals describe how someone spoke, not a body domain. */
export const NARRATIVE_DOMAIN = "Your Words";

export const SIGNAL_TYPE_DOMAIN: Record<string, string> = {
  bleeding_characteristics: "Bleeding",

  pain_characteristics: "Pain",
  pelvic_organ_symptoms: "Pain",

  hormonal_manifestations: "Hormonal",
  body_changes_physical_manifestations: "Hormonal",

  cycle_characteristics: "Cycle",

  daily_function: "Daily Life",
  fatigue_energy: "Daily Life",
  sleep_recovery: "Daily Life",
  social_participation: "Daily Life",
  physical_activity_mobility: "Daily Life",
  work_school_impact: "Daily Life",
  emotional_function: "Daily Life",
  self_management: "Daily Life",
  caregiving_household: "Daily Life",

  care_access: "Care Access",
  care_emotion: "Care Access",
  care_narrative: "Care Access",
  care_navigation: "Care Access",
  care_outcomes: "Care Access",
  validation: "Care Access",

  agency_support: NARRATIVE_DOMAIN,
  expression_language: NARRATIVE_DOMAIN,
  meaning_making: NARRATIVE_DOMAIN,
  symptom_story: NARRATIVE_DOMAIN,
  trajectory_narrative: NARRATIVE_DOMAIN,
  emotional_narrative: NARRATIVE_DOMAIN,
  sensitive_narrative: NARRATIVE_DOMAIN,
};

export function signalTypeDomain(signalType: string): string {
  return SIGNAL_TYPE_DOMAIN[signalType] ?? NARRATIVE_DOMAIN;
}
