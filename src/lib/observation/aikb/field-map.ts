// Maps observatory-system app field ids to AIKB registry field ids (snake_case,
// e.g. age_range). Most resolve by lowercasing.
//
// OVERRIDES holds the exceptions. The LOER v7.0.0 alignment regenerates the flow
// from the client workbook, so app field ids now follow the blueprints' naming
// while the AIKB registry still carries the names it was built against. Without
// an entry here `extractObservations` finds no registry field and drops the
// answer silently — no error, just a thinner reflection.
//
// Each pair below is the same observation under two names, verified against the
// screen it comes from. A renamed field belongs here; a genuinely new capture
// does not — it needs a registry entry instead (see NO_REGISTRY_FIELD).
const OVERRIDES: Record<string, string> = {
  // Renamed by the LOER alignment (blueprint name -> registry name).
  product_change_frequency: "product_change_freq", // S22
  fatigue_frequency: "fatigue_freq", // S48
  dizziness_frequency: "dizziness_freq", // S50
  normalization_context: "normalcy_perception", // S53
  life_areas_affected: "life_areas", // S52
  consent_acknowledged: "consent_ack", // S01

  // S39 routes cycling participants to S40A and everyone else to S40B. Both ask
  // the same observation in life-stage-appropriate wording, and the registry has
  // one field for it, so the B variant resolves to the same entry rather than
  // being dropped for exactly the participants S40B exists to include.
  rhythm_predictability: "cycle_predictability", // S40B
};

/**
 * Captures the LOER alignment introduced that have no AIKB registry entry, so
 * they cannot be mapped and are dropped by `extractObservations`.
 *
 * Listed rather than silently ignored because the fix is a registry addition
 * (the CR §7 AIKB Part 0 bridge), not a rename — adding an override here would
 * point them at an unrelated field. `pain_present` is the most consequential:
 * it is the S29 branch gate, so the reflection currently cannot tell that a
 * participant reported no pain at all.
 */
export const NO_REGISTRY_FIELD = [
  "pain_present",
  "pain_management",
  "pain_functional_impact",
  "cycle_applicability",
  "symptom_burden",
  "symptom_progression",
  "care_access_barriers",
  "information_needs",
] as const;

export function toRegistryFieldId(appFieldId: string): string {
  return OVERRIDES[appFieldId] ?? appFieldId.toLowerCase();
}
