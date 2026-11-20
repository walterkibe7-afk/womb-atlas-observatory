/**
 * AIKB Pattern Ontology v1.0 — canonical value-aware contract (AIRB Sessions 001–004).
 * Single source of truth for Detection, Briefing, Evidence, Constellation, Archetype, Watch.
 *
 * Pipeline: Observation → Signal → Primary Pattern → Secondary Pattern → Emergent Theme → Archetype → Watch
 */

import type { AtlasObservationRecord } from "./types";
import { v43Text } from "./v43-i18n";

export const ONTOLOGY_VERSION = "1.0.0";

export type OntologyClass = "primary" | "secondary" | "emergent";

export type SignalRule = {
  fieldId: string;
  values?: string[];
  primaryPatternId: string;
  secondaryPatternId?: string | null;
  excludePatternIds?: string[];
  confidenceModifier?: number;
  contributionLevel?: "high" | "moderate" | "light";
  evidenceTheme?: string;
  secondaryRequiresAnyField?: Array<{ fieldId: string; values: string[] }>;
};

export type EmergentConvergenceRule = {
  themeId: string;
  minPrimaryCount: number;
  requiredPrimaryIds?: string[];
  anySecondaryIds?: string[];
  anyPrimaryIds?: string[];
};

export type OntologyPatternDefinition = {
  id: string;
  scientificName: string;
  participantLabel: string;
  class: OntologyClass;
  definition: string;
  inclusionCriteria: string;
  exclusionCriteria: string;
  signalRules: SignalRule[];
  relationshipRules: string[];
  confidenceRules: string;
  watchOverTime: string;
  whyConnected: string;
  atlasNote: string;
  plainLanguageMeaning: string;
};

export type SignalRoutingResult = {
  observationId: string;
  fieldId: string;
  value: string;
  rawField: string;
  normalizedSignal: string;
  primaryPatternId: string;
  primaryScientificName: string;
  primaryParticipantLabel: string;
  secondaryPatternId: string | null;
  secondaryScientificName: string | null;
  secondaryParticipantLabel: string | null;
  confidenceModifier: number;
  contributionLevel: "high" | "moderate" | "light";
  exclusionApplied: string[];
  sourceLayer: "ontology";
};

export type DetectedOntologyPattern = {
  id: string;
  scientificName: string;
  participantLabel: string;
  class: OntologyClass;
  signalCount: number;
  supportingSignals: string[];
  plainLanguageMeaning: string;
  atlasNote: string;
  whatAtlasObserved: string;
  whyAtlasConnected: string;
  watchOverTime: string;
};

export type DetectedEmergentTheme = {
  id: string;
  scientificName: string;
  participantLabel: string;
  convergedFrom: string[];
  plainLanguageMeaning: string;
  watchOverTime: string;
};

export type OntologyRoutingContext = {
  routings: SignalRoutingResult[];
  primaryPatterns: DetectedOntologyPattern[];
  secondaryPatterns: DetectedOntologyPattern[];
  emergentThemes: DetectedEmergentTheme[];
};

/** Legacy v4.2 names → canonical scientific names */
export const LEGACY_TO_CANONICAL_SCIENTIFIC: Record<string, string> = {
  "Pain-Spread": "Pain Distribution",
  "Care Friction": "Care Experience",
  "Pelvic Pressure": "Pelvic Function",
  "Body Uncertainty": "Body Unpredictability",
  "Life Reorganization": "Life Reorganization"
};

export const CANONICAL_TO_LEGACY_V43: Record<string, string> = {
  "Pain Distribution": "Pain-Spread",
  "Care Experience": "Care Friction",
  "Pelvic Function": "Pelvic Pressure",
  "Body Unpredictability": "Body Uncertainty"
};

const PRIMARY_PATTERNS: OntologyPatternDefinition[] = [
  {
    id: "bleeding_burden",
    scientificName: "Bleeding Burden",
    participantLabel: "Heavy or disruptive bleeding",
    class: "primary",
    definition: "Observable bleeding volume, duration, clot burden, and bleeding-related functional impact.",
    inclusionCriteria:
      "Product changes, prolonged bleeding, clots, interperiod bleeding, heavier progression, night waking from bleeding.",
    exclusionCriteria: "Bleeding irregularity alone without burden signals; uncertainty without bleeding heaviness.",
    signalRules: [],
    relationshipRules: ["Links to Daily Function when routines are disrupted."],
    confidenceRules: "Strengthens with 2+ bleeding-domain signals.",
    watchOverTime:
      "Whether bleeding remains stable, becomes heavier or more unpredictable, or continues to affect energy and preparation.",
    whyConnected:
      "Atlas grouped these because bleeding-related answers may connect duration, clot burden, product changes, and daily preparation.",
    atlasNote:
      "Atlas Note: Bleeding burden is observational — it describes lived experience, not a diagnosis.",
    plainLanguageMeaning:
      "Atlas noticed that bleeding may be requiring more preparation, energy, and attention in daily life."
  },
  {
    id: "pain_distribution",
    scientificName: "Pain Distribution",
    participantLabel: "Pain pattern",
    class: "primary",
    definition: "Where, when, and how pain spreads across the body and daily function.",
    inclusionCriteria: "Pain location, timing, duration, progression, and behavioral response to pain.",
    exclusionCriteria: "Pelvic pressure without pain; whole-body pain mapped to pelvic function only.",
    signalRules: [],
    relationshipRules: ["May overlap Pelvic Function when pain is pelvic-specific."],
    confidenceRules: "Strengthens when location and timing signals converge.",
    watchOverTime:
      "Whether pain stays local, spreads across functions, or becomes easier to anticipate.",
    whyConnected:
      "Atlas grouped these because pain timing, location, duration, and response may belong to one lived pattern.",
    atlasNote: "Atlas Note: Pain patterns are observational, not diagnostic labels.",
    plainLanguageMeaning:
      "Atlas noticed that pain may be spreading across timing, movement, and how you respond when it appears."
  },
  {
    id: "hormonal_rhythm",
    scientificName: "Hormonal Rhythm",
    participantLabel: "Cycle rhythm",
    class: "primary",
    definition: "Cycle predictability, hormonal signs, and rhythm changes over time.",
    inclusionCriteria: "Irregular cycles, skipped periods, hormonal signs, cycle length changes.",
    exclusionCriteria: "Bleeding heaviness without rhythm change.",
    signalRules: [],
    relationshipRules: ["May pair with Body Unpredictability when timing is hard to plan around."],
    confidenceRules: "Strengthens with rhythm + sign convergence.",
    watchOverTime:
      "Whether cycle rhythm becomes steadier, more changeable, or more clearly linked to other body signs.",
    whyConnected:
      "Atlas grouped these because cycle predictability, hormonal signs, and symptom timing may travel together.",
    atlasNote: "Atlas Note: Rhythm observations are not a hormonal diagnosis.",
    plainLanguageMeaning:
      "Atlas noticed that cycle rhythm and hormonal signs may be shaping how your body shows up over time."
  },
  {
    id: "pelvic_function",
    scientificName: "Pelvic Function",
    participantLabel: "Pelvic and body signals",
    class: "primary",
    definition: "Pelvic pressure, bladder/bowel function, and localized body-change signals.",
    inclusionCriteria: "Pelvic symptoms, pressure, bloating, bladder/bowel changes — not whole-body pain alone.",
    exclusionCriteria: "Whole-body pain without pelvic localization.",
    signalRules: [],
    relationshipRules: ["Overlaps Pain Distribution for pelvic pain locations."],
    confidenceRules: "Requires pelvic-specific field values.",
    watchOverTime:
      "Whether pressure stays occasional, becomes persistent, or connects with bowel, bladder, or movement.",
    whyConnected:
      "Atlas grouped these because pelvic pressure and body-change signals may point to connected pelvic systems.",
    atlasNote: "Atlas Note: Pelvic signals are observational clusters, not a single condition.",
    plainLanguageMeaning:
      "Atlas noticed pelvic or body-change signals that may be connected rather than isolated."
  },
  {
    id: "daily_function",
    scientificName: "Daily Function",
    participantLabel: "Daily life impact",
    class: "primary",
    definition: "How symptoms affect school, work, sleep, activities, and functional planning.",
    inclusionCriteria: "Missed activities, sleep disruption, life areas affected, disruption frequency.",
    exclusionCriteria: "Not extracted from bleeding heaviness alone.",
    signalRules: [],
    relationshipRules: ["Converges toward emergent Life Reorganization with other primaries."],
    confidenceRules: "Strengthens with multiple daily-life signals.",
    watchOverTime:
      "Whether routines become freer, more restricted, or more predictable as symptoms change.",
    whyConnected:
      "Atlas grouped these because missed activities, disrupted sleep, and functional impact may reorganize daily life.",
    atlasNote: "Atlas Note: Impact is evidence — it belongs in the record when symptoms change daily life.",
    plainLanguageMeaning:
      "Atlas noticed that symptoms may be reshaping school, work, rest, and the activities you can keep."
  },
  {
    id: "care_experience",
    scientificName: "Care Experience",
    participantLabel: "Your care journey",
    class: "primary",
    definition: "Care-seeking, provider response, dismissal, and access experiences.",
    inclusionCriteria: "Spoken to provider, care response, dismissal, access barriers.",
    exclusionCriteria: "Clinical diagnosis claims.",
    signalRules: [],
    relationshipRules: ["May pair with Care Navigation Complexity as secondary."],
    confidenceRules: "Strengthens when multiple care signals align.",
    watchOverTime:
      "Whether care access, clarity, and feeling heard improve, stall, or change over time.",
    whyConnected:
      "Atlas grouped these because they describe how you have navigated care alongside symptoms.",
    atlasNote: "Atlas Note: Care experience shapes what a person tracks, delays, or stops mentioning.",
    plainLanguageMeaning:
      "Atlas noticed that your care journey — access, response, and feeling heard — is part of this record."
  }
];

const SECONDARY_PATTERNS: OntologyPatternDefinition[] = [
  {
    id: "body_unpredictability",
    scientificName: "Body Unpredictability",
    participantLabel: "Body changes that are hard to predict",
    class: "secondary",
    definition: "Not-knowing when symptoms will appear; difficulty planning around the body.",
    inclusionCriteria:
      "Unpredictable pain, rare symptom predictability, not_knowing priority — paired with rhythm uncertainty.",
    exclusionCriteria:
      "Become heavier and other volume-progression bleeding signals; any primary bleeding burden signal alone.",
    signalRules: [],
    relationshipRules: ["Never primary; emerges from unpredictability signals."],
    confidenceRules: "Requires unpredictability context; never from bleeding heaviness alone.",
    watchOverTime:
      "Whether unpredictability eases, shifts across domains, or becomes easier to plan around.",
    whyConnected:
      "Atlas grouped these because unpredictability may shape planning, trust, and daily preparation.",
    atlasNote: "Atlas Note: Understanding patterns can reduce the feeling that symptoms are random.",
    plainLanguageMeaning:
      "Atlas noticed that not knowing what comes next may be shaping how you plan and prepare."
  },
  {
    id: "planning_around_symptoms",
    scientificName: "Planning Around Symptoms",
    participantLabel: "Planning around your body",
    class: "secondary",
    definition: "Routines built around symptom timing, missed obligations, and disruption frequency.",
    inclusionCriteria: "Disruption frequency, missed activities, life areas with planning burden.",
    exclusionCriteria: "Single isolated symptom without functional pattern.",
    signalRules: [],
    relationshipRules: ["Supports emergent Life Reorganization."],
    confidenceRules: "Strengthens with daily_function primary signals.",
    watchOverTime: "Whether planning burden eases or becomes more predictable.",
    whyConnected: "Atlas noticed planning demands appearing across multiple observations.",
    atlasNote: "Atlas Note: Planning burden is lived experience, not a character trait.",
    plainLanguageMeaning:
      "Atlas noticed that you may be organizing life around when symptoms show up."
  },
  {
    id: "symptom_adaptation",
    scientificName: "Symptom Adaptation",
    participantLabel: "Adapting to symptoms",
    class: "secondary",
    definition: "Normalizing, adjusting routines, and adapting to symptom persistence.",
    inclusionCriteria: "Normalization impact, gradual worsening with routine change.",
    exclusionCriteria: "Acute-only signals without adaptation narrative.",
    signalRules: [],
    relationshipRules: ["May support Adaptive Living emergent theme."],
    confidenceRules: "Moderate with normalization + progression.",
    watchOverTime: "Whether adaptation strategies stay steady or shift.",
    whyConnected: "Atlas noticed routine adaptation alongside symptom persistence.",
    atlasNote: "Atlas Note: Adaptation is a strength and a signal of ongoing burden.",
    plainLanguageMeaning: "Atlas noticed you may be adapting routines to live with ongoing symptoms."
  },
  {
    id: "diagnostic_uncertainty",
    scientificName: "Diagnostic Uncertainty",
    participantLabel: "Not knowing what is happening",
    class: "secondary",
    definition: "Priority on not knowing, inconclusive care, waiting for answers.",
    inclusionCriteria: "symptom_priority not_knowing, care_response waiting/no clear answers.",
    exclusionCriteria: "Clear care pathway with answers.",
    signalRules: [],
    relationshipRules: ["Pairs with Care Navigation Complexity."],
    confidenceRules: "Requires not_knowing or inconclusive care signals.",
    watchOverTime: "Whether clarity increases across observations.",
    whyConnected: "Atlas noticed uncertainty about what the body is doing.",
    atlasNote: "Atlas Note: Uncertainty has weight in the lived record.",
    plainLanguageMeaning: "Atlas noticed that not having clear answers may be part of the experience."
  },
  {
    id: "care_navigation_complexity",
    scientificName: "Care Navigation Complexity",
    participantLabel: "Navigating care",
    class: "secondary",
    definition: "Dismissal, referrals, access barriers, and complex care pathways.",
    inclusionCriteria: "Care dismissal, access barriers, referred/waiting responses.",
    exclusionCriteria: "Straightforward positive care experience.",
    signalRules: [],
    relationshipRules: ["Secondary to Care Experience."],
    confidenceRules: "Strengthens with dismissal + access signals.",
    watchOverTime: "Whether navigation becomes clearer or remains complex.",
    whyConnected: "Atlas noticed friction in how care has been accessed and received.",
    atlasNote: "Atlas Note: Care friction can shape what gets tracked or mentioned.",
    plainLanguageMeaning: "Atlas noticed that navigating care may require extra effort and persistence."
  }
];

const EMERGENT_THEMES: OntologyPatternDefinition[] = [
  {
    id: "life_reorganization",
    scientificName: "Life Reorganization",
    participantLabel: "Living around your symptoms",
    class: "emergent",
    definition: "Emergent convergence when multiple primaries and planning/impact secondaries align.",
    inclusionCriteria:
      "Never from a single questionnaire field. Requires convergence of Daily Function + another primary, or 3+ primaries with planning secondary.",
    exclusionCriteria: "Direct field-level extraction forbidden.",
    signalRules: [],
    relationshipRules: ["Emerges only from convergence."],
    confidenceRules: "Requires minPrimaryCount >= 2 with daily_function or planning secondary.",
    watchOverTime:
      "Whether routines become freer, more restricted, or more predictable as symptoms change.",
    whyConnected:
      "Atlas noticed that several observations affected planning, routines, and preparation rather than isolated symptoms.",
    atlasNote: "Atlas Note: Life reorganization describes lived impact, not a label for one symptom.",
    plainLanguageMeaning:
      "Atlas noticed that symptoms may be reorganizing work, rest, movement, and daily life together."
  },
  {
    id: "adaptive_living",
    scientificName: "Adaptive Living",
    participantLabel: "Finding ways to cope",
    class: "emergent",
    definition: "Emerges when symptom adaptation secondary converges with daily function.",
    inclusionCriteria: "symptom_adaptation + daily_function detected.",
    exclusionCriteria: "Single normalization answer alone.",
    signalRules: [],
    relationshipRules: [],
    confidenceRules: "Moderate emergent confidence.",
    watchOverTime: "Whether coping strategies stay steady or shift.",
    whyConnected: "Atlas noticed adaptation and daily impact traveling together.",
    atlasNote: "Atlas Note: Adaptation reflects resilience within ongoing burden.",
    plainLanguageMeaning: "Atlas noticed you finding ways to live with what your body is doing."
  },
  {
    id: "escalating_burden",
    scientificName: "Escalating Burden",
    participantLabel: "Symptoms building over time",
    class: "emergent",
    definition: "Emerges when progression signals align across bleeding, pain, or general symptoms.",
    inclusionCriteria: "2+ progression signals (bleeding_progression, pain_progression, symptom_progression worsening).",
    exclusionCriteria: "Stable or improving trajectories only.",
    signalRules: [],
    relationshipRules: [],
    confidenceRules: "Requires multiple worsening signals.",
    watchOverTime: "Whether burden escalates, plateaus, or eases.",
    whyConnected: "Atlas noticed worsening trajectories across domains.",
    atlasNote: "Atlas Note: Escalation is observational — future observations will clarify.",
    plainLanguageMeaning: "Atlas noticed signals that symptoms may be building rather than staying steady."
  },
  {
    id: "delayed_recognition",
    scientificName: "Delayed Recognition",
    participantLabel: "Recognition took time",
    class: "emergent",
    definition: "Emerges when care navigation complexity meets diagnostic uncertainty.",
    inclusionCriteria: "care_navigation_complexity + diagnostic_uncertainty.",
    exclusionCriteria: "Early clear care pathway.",
    signalRules: [],
    relationshipRules: [],
    confidenceRules: "Moderate when both secondaries present.",
    watchOverTime: "Whether recognition and care clarity improve.",
    whyConnected: "Atlas noticed care friction alongside not-knowing.",
    atlasNote: "Atlas Note: Delayed recognition is common and valid.",
    plainLanguageMeaning: "Atlas noticed that getting clarity may have taken longer than expected."
  }
];

export const ONTOLOGY_SIGNAL_RULES: SignalRule[] = [
  // LOER v7.0.0 remap: the flow is regenerated from the client workbook, so
  // field ids and option values below follow the blueprints. Entries marked
  // NEEDS SIGN-OFF are ones where LOER changed what the screen measures, not
  // just its name — the mapping is a judgment call, not a rename.
  {
    fieldId: "product_change_frequency",
    values: ["every_1_2_hours", "more_than_once_per_hour_or_leaking_through"],
    primaryPatternId: "bleeding_burden",
    contributionLevel: "high",
    evidenceTheme: "Product changes"
  },
  {
    fieldId: "bleeding_duration",
    values: ["6_8_days", "more_than_8_days"],
    primaryPatternId: "bleeding_burden",
    contributionLevel: "high",
    evidenceTheme: "Duration"
  },
  {
    fieldId: "clot_size",
    // S24 replaced the size-by-comparison wording with plain sizes.
    values: ["medium", "large"],
    primaryPatternId: "bleeding_burden",
    contributionLevel: "high",
    evidenceTheme: "Clots"
  },
  {
    fieldId: "interperiod_bleeding",
    values: ["occasionally", "frequently"],
    primaryPatternId: "bleeding_burden",
    contributionLevel: "moderate",
    evidenceTheme: "Interperiod bleeding"
  },
  {
    fieldId: "bleeding_progression",
    values: ["become_heavier"],
    primaryPatternId: "bleeding_burden",
    secondaryPatternId: null,
    excludePatternIds: ["body_unpredictability"],
    contributionLevel: "high",
    evidenceTheme: "Heavier bleeding"
  },
  {
    fieldId: "bleeding_progression",
    values: ["become_lighter"],
    primaryPatternId: "bleeding_burden",
    excludePatternIds: ["body_unpredictability"],
    contributionLevel: "moderate",
    evidenceTheme: "Lighter bleeding"
  },
  {
    fieldId: "bleeding_progression",
    values: ["become_more_irregular"],
    primaryPatternId: "bleeding_burden",
    secondaryPatternId: "body_unpredictability",
    secondaryRequiresAnyField: [
      {
        fieldId: "cycle_predictability",
        values: ["somewhat_predictable_but_variable", "often_irregular_or_unpredictable", "i_am_not_sure"]
      },
      // NEEDS SIGN-OFF: S56 was "can you predict your symptoms" and is now
      // "are they manageable or overwhelming" (ED-044). Day-to-day variation is
      // the only value on the new scale that still expresses unpredictability.
      { fieldId: "symptom_burden", values: ["it_changes_from_day_to_day"] }
    ],
    excludePatternIds: [],
    contributionLevel: "moderate",
    evidenceTheme: "Irregular bleeding"
  },
  {
    fieldId: "bleeding_impact",
    // NEEDS SIGN-OFF: S27's list has no "using more than one product at once".
    // Mapped to the planning burden, which is the nearest burden marker; the
    // flooding-specific meaning is not recoverable from the new list.
    values: ["disturbs_sleep", "limits_leaving_home", "requires_planning_around_bleeding"],
    primaryPatternId: "bleeding_burden",
    contributionLevel: "high",
    evidenceTheme: "Night disruption"
  },
  {
    fieldId: "fatigue_frequency",
    // S48's old top value "constantly" is now two values; both are kept so the
    // rule still covers "frequently and above" (matches ADP-5013).
    values: ["frequently", "most_days", "constantly_or_almost_constantly"],
    primaryPatternId: "bleeding_burden",
    secondaryPatternId: "daily_function",
    contributionLevel: "moderate",
    evidenceTheme: "Energy management"
  },
  {
    fieldId: "dizziness_frequency",
    // S50 added "most days" and the fainting value above "frequently"
    // (ED-034); keeping the rule at "occasionally and above" preserves its
    // original reach and matches ADP-5015.
    values: ["occasionally", "frequently", "most_days", "i_have_fainted_or_nearly_fainted"],
    primaryPatternId: "bleeding_burden",
    contributionLevel: "moderate",
    evidenceTheme: "Dizziness"
  },
  {
    // NEEDS SIGN-OFF: ED-017 replaced S30's coping question with S34's
    // functional impact, so "what you do about pain" became "what pain stops
    // you doing". Cancelling plans and staying in bed map to the nearest
    // impact areas; the coping meaning itself is no longer captured.
    fieldId: "pain_functional_impact",
    // ADP-4014 raises SIG-PAIN-005 on "any functional impact selected", so
    // every explicit impact area counts — everything except no_effect, the
    // self-describe row and the non-answer.
    values: [
      "affects_work_or_school",
      "affects_relationships_or_intimacy",
      "affects_mood_or_mental_wellbeing",
      "affects_sleep",
      "affects_exercise_or_activity",
      "affects_concentration_or_focus",
      "affects_daily_activities",
    ],
    primaryPatternId: "pain_distribution",
    contributionLevel: "high",
    evidenceTheme: "Pain response"
  },
  {
    fieldId: "pain_timing",
    values: ["at_different_times_across_a_cycle", "randomly_or_unpredictably"],
    primaryPatternId: "pain_distribution",
    contributionLevel: "moderate",
    evidenceTheme: "Pain timing"
  },
  {
    fieldId: "pain_location",
    // S32 expresses whole-body pain as spread between areas.
    values: ["pain_spreads_between_areas"],
    primaryPatternId: "pain_distribution",
    excludePatternIds: ["pelvic_function"],
    contributionLevel: "high",
    evidenceTheme: "Whole-body pain"
  },
  {
    fieldId: "pain_location",
    values: [
      "pelvis_or_lower_abdomen",
      "lower_back",
      "legs_or_hips",
      "during_vaginal_penetration_or_sexual_activity",
      "bowel_or_rectal_area",
      "bladder_or_urinary_area",
      "somewhere_else_self_describe"
    ],
    primaryPatternId: "pain_distribution",
    secondaryPatternId: "pelvic_function",
    contributionLevel: "high",
    evidenceTheme: "Pain spread"
  },
  // NEEDS SIGN-OFF: `pain_duration` (S33) and `pain_predictability` (S34) were
  // retired by ED-017 with no replacement capture, so both rules are removed
  // rather than remapped. Pain patterns therefore have two fewer fields that
  // can register evidence, and confidence is a tier function of how many
  // DISTINCT fields match (low <2, moderate ==2, high >=3) — so an identical
  // participant answer set can now land a tier lower than it did before.
  {
    fieldId: "pain_severity_change",
    values: ["gradually_worsened", "increased_suddenly"],
    primaryPatternId: "pain_distribution",
    contributionLevel: "high",
    evidenceTheme: "Increasing severity"
  },
  {
    fieldId: "pelvic_symptoms",
    values: [
      "pain_with_bowel_movements",
      "pain_with_urination",
      "nausea",
      "vomiting",
      "frequent_urination",
      // NEEDS SIGN-OFF: S36 has no "unable to fully empty bladder". Urgency or
      // difficulty holding urine is the nearest urinary-function value, though
      // it describes urgency rather than retention.
      "urgency_or_difficulty_holding_urine",
      "constipation",
      "bloating",
      "abdominal_swelling"
    ],
    primaryPatternId: "pelvic_function",
    secondaryPatternId: "pain_distribution",
    contributionLevel: "moderate",
    evidenceTheme: "Pelvic symptoms"
  },
  {
    fieldId: "body_changes",
    values: [
      "abdominal_enlargement_or_swelling",
      "heaviness_or_fullness_in_the_pelvis",
      "increased_bloating",
      "clothing_fitting_differently_around_the_waist",
      "feeling_full_sooner_than_expected"
    ],
    primaryPatternId: "pelvic_function",
    contributionLevel: "moderate",
    evidenceTheme: "Body changes"
  },
  {
    // NEEDS SIGN-OFF: CR §8 retired the standalone `pain_during_sex` and
    // `bowel_movement_pain` yes/no screens and re-homed both into S33's
    // trigger list. Two separate fields therefore become one, and because
    // confidence counts DISTINCT matching fields, a participant reporting both
    // now contributes one field of evidence to Pain rather than two.
    fieldId: "pain_triggers",
    values: ["sexual_activity_or_penetration", "bowel_movements"],
    primaryPatternId: "pain_distribution",
    contributionLevel: "high",
    evidenceTheme: "Pain triggers"
  },
  {
    fieldId: "cycle_predictability",
    values: ["somewhat_predictable_but_variable", "often_irregular_or_unpredictable", "i_am_not_sure"],
    primaryPatternId: "hormonal_rhythm",
    secondaryPatternId: "body_unpredictability",
    contributionLevel: "high",
    evidenceTheme: "Irregular timing"
  },
  {
    fieldId: "skipped_periods",
    values: ["occasionally", "frequently"],
    primaryPatternId: "hormonal_rhythm",
    contributionLevel: "high",
    evidenceTheme: "Skipped periods"
  },
  {
    fieldId: "hormonal_signs",
    values: [
      "acne_or_skin_changes",
      "increased_facial_or_body_hair",
      "hair_thinning_on_the_scalp",
      "unexplained_weight_change",
      "mood_changes_linked_to_bleeding_or_body_rhythms",
      "hot_flashes",
      "night_sweats"
    ],
    primaryPatternId: "hormonal_rhythm",
    contributionLevel: "moderate",
    evidenceTheme: "Hormonal signs"
  },
  {
    fieldId: "cycle_changes",
    values: [
      "cycles_or_bleeding_have_become_shorter_or_more_frequent",
      "longer_or_less_frequent",
      "more_irregular_or_unpredictable"
    ],
    primaryPatternId: "hormonal_rhythm",
    secondaryPatternId: "body_unpredictability",
    secondaryRequiresAnyField: [
      // NEEDS SIGN-OFF: same S56 construct change as above (ED-044).
      { fieldId: "symptom_burden", values: ["it_changes_from_day_to_day"] },
      { fieldId: "cycle_predictability", values: ["i_am_not_sure", "often_irregular_or_unpredictable"] }
    ],
    contributionLevel: "high",
    evidenceTheme: "Cycle changes"
  },
  {
    fieldId: "symptoms_related_to",
    // S44 replaced the cycle/ovulation/both/neither set with named timings
    // (ED-026), so "both" is now expressed by selecting more than one value.
    values: ["bleeding", "before_bleeding", "around_ovulation_or_mid_cycle", "i_am_not_sure"],
    primaryPatternId: "hormonal_rhythm",
    contributionLevel: "moderate",
    evidenceTheme: "Cycle relation"
  },
  {
    fieldId: "missed_activities",
    // S47 dropped the cycle-only framing (ED-031). "Every cycle" and "multiple
    // days each cycle" become their per-month equivalents; ADP-5012 triggers on
    // the same two upper values.
    values: [
      "occasionally",
      "more_than_once_in_a_typical_month_or_cycle",
      "several_days_in_a_row"
    ],
    primaryPatternId: "daily_function",
    secondaryPatternId: "planning_around_symptoms",
    contributionLevel: "high",
    evidenceTheme: "Missed activities"
  },
  {
    fieldId: "sleep_disruption",
    values: [
      "occasionally",
      "frequently",
      "most_nights_during_symptom_episodes",
      "constantly_or_almost_constantly"
    ],
    primaryPatternId: "daily_function",
    secondaryPatternId: "planning_around_symptoms",
    contributionLevel: "high",
    evidenceTheme: "Sleep disruption"
  },
  {
    // NEEDS SIGN-OFF: S51 changed from a frequency scale ("how often does this
    // level of impact happen") to a severity scale ("overall, how much do your
    // symptoms disrupt your life") — ED-037. Frequency bands are mapped onto
    // the severity bands in order; they are not the same measurement.
    fieldId: "life_disruption",
    values: ["somewhat", "quite_a_lot", "very_much"],
    primaryPatternId: "daily_function",
    secondaryPatternId: "planning_around_symptoms",
    contributionLevel: "high",
    evidenceTheme: "Planning burden"
  },
  {
    fieldId: "life_areas_affected",
    values: [
      // S52 merged school and work into one value, and split the old
      // "mental focus, concentration or mood" into focus and wellbeing.
      "work_or_school",
      "movement_or_physical_activity",
      "social_activities",
      "relationships_or_intimacy",
      "daily_routines",
      "sleep",
      "mental_focus_or_concentration",
      "emotional_wellbeing"
    ],
    primaryPatternId: "daily_function",
    secondaryPatternId: "planning_around_symptoms",
    contributionLevel: "moderate",
    evidenceTheme: "Life areas affected"
  },
  {
    // NEEDS SIGN-OFF: S53 changed from "even if this feels normal, does it stop
    // you doing things" (a functional question) to "how have you come to think
    // about these symptoms" (normalization sources) — ED-039. Only the
    // adaptation value carries the old rule's meaning; the concern values on
    // the same screen belong to a different signal (SIG-BURDEN-004).
    fieldId: "normalization_context",
    values: ["i_have_learned_to_live_around_them"],
    primaryPatternId: "daily_function",
    secondaryPatternId: "symptom_adaptation",
    contributionLevel: "moderate",
    evidenceTheme: "Routine adaptation"
  },
  {
    fieldId: "symptom_progression",
    values: ["gradually_worsening", "worsening_quickly"],
    primaryPatternId: "daily_function",
    secondaryPatternId: "symptom_adaptation",
    contributionLevel: "high",
    evidenceTheme: "Worsening trajectory"
  },
  {
    // NEEDS SIGN-OFF: same S56 construct change (ED-044) — predictability
    // became manageability, so only day-to-day variation still expresses the
    // "unpredictable timing" this rule was written for.
    fieldId: "symptom_burden",
    values: ["it_changes_from_day_to_day"],
    primaryPatternId: "daily_function",
    secondaryPatternId: "body_unpredictability",
    contributionLevel: "moderate",
    evidenceTheme: "Unpredictable timing"
  },
  // NEEDS SIGN-OFF: `symptom_priority` (S70 in the mobile register) was retired
  // with no replacement, so both of its rules are removed. `diagnostic_
  // uncertainty` loses its only secondary contributor here — S62's
  // `information_needs` looks like the natural successor but is not yet in the
  // AIKB registry, so it cannot be wired up until that entry exists.
  {
    fieldId: "spoken_to_provider",
    // ED-045 added "tried but could not access an appointment" as a distinct
    // care-seeking state; ADP-6008 treats it the same way as "no".
    values: ["no", "i_tried_but_could_not_access_an_appointment"],
    primaryPatternId: "care_experience",
    secondaryPatternId: "care_navigation_complexity",
    contributionLevel: "moderate",
    evidenceTheme: "Care-seeking"
  },
  {
    fieldId: "care_response",
    values: [
      "i_was_told_symptoms_were_normal",
      "i_did_not_receive_clear_answers",
      "i_am_still_waiting_for_answers_or_care",
      "i_was_referred_to_another_provider",
      // New on S59 and squarely an unresolved-care marker (ADP-6009).
      "i_stopped_seeking_care_after_the_experience"
    ],
    primaryPatternId: "care_experience",
    secondaryPatternId: "care_navigation_complexity",
    contributionLevel: "high",
    evidenceTheme: "Care response"
  },
  {
    fieldId: "care_dismissal",
    // S60 split the old single "yes" into once / more than once (ED-048).
    values: ["yes_once", "yes_more_than_once", "i_am_not_sure"],
    primaryPatternId: "care_experience",
    secondaryPatternId: "care_navigation_complexity",
    contributionLevel: "high",
    evidenceTheme: "Care dismissal"
  },
  {
    fieldId: "access_to_care",
    // ADP-6011 raises SIG-CARE-004 on "Sometimes" as well as "No".
    values: ["no", "sometimes", "i_am_not_sure"],
    primaryPatternId: "care_experience",
    secondaryPatternId: "care_navigation_complexity",
    contributionLevel: "high",
    evidenceTheme: "Care access"
  }
];

export const EMERGENT_CONVERGENCE_RULES: EmergentConvergenceRule[] = [
  {
    themeId: "life_reorganization",
    minPrimaryCount: 2,
    requiredPrimaryIds: ["daily_function"],
    anySecondaryIds: ["planning_around_symptoms", "body_unpredictability", "symptom_adaptation"]
  },
  {
    themeId: "life_reorganization",
    minPrimaryCount: 3,
    anyPrimaryIds: ["bleeding_burden", "pain_distribution", "hormonal_rhythm", "daily_function", "pelvic_function"]
  },
  {
    themeId: "adaptive_living",
    minPrimaryCount: 1,
    requiredPrimaryIds: ["daily_function"],
    anySecondaryIds: ["symptom_adaptation"]
  },
  {
    themeId: "escalating_burden",
    minPrimaryCount: 2,
    anyPrimaryIds: ["bleeding_burden", "pain_distribution", "daily_function"]
  },
  {
    themeId: "delayed_recognition",
    minPrimaryCount: 1,
    requiredPrimaryIds: ["care_experience"],
    anySecondaryIds: ["care_navigation_complexity", "diagnostic_uncertainty"]
  }
];

const ALL_PATTERNS = [...PRIMARY_PATTERNS, ...SECONDARY_PATTERNS, ...EMERGENT_THEMES];
const PATTERN_BY_ID = new Map(ALL_PATTERNS.map((pattern) => [pattern.id, pattern]));
const PATTERN_BY_SCIENTIFIC = new Map(
  ALL_PATTERNS.map((pattern) => [pattern.scientificName, pattern])
);

export function getPatternDefinition(idOrScientificName: string) {
  return (
    PATTERN_BY_ID.get(idOrScientificName) ??
    PATTERN_BY_SCIENTIFIC.get(idOrScientificName) ??
    PATTERN_BY_SCIENTIFIC.get(LEGACY_TO_CANONICAL_SCIENTIFIC[idOrScientificName] ?? "")
  );
}

export function canonicalScientificName(name: string) {
  return LEGACY_TO_CANONICAL_SCIENTIFIC[name] ?? name;
}

export function participantLabelFor(nameOrId: string, locale?: string) {
  const definition = getPatternDefinition(nameOrId);
  if (!definition) return nameOrId;
  return v43Text(definition.id, "participantLabel", definition.participantLabel, locale);
}

export function scientificNameForParticipantDisplay(nameOrId: string) {
  return getPatternDefinition(nameOrId)?.scientificName ?? canonicalScientificName(nameOrId);
}

export function v43AliasScientificName(scientificName: string) {
  return CANONICAL_TO_LEGACY_V43[scientificName] ?? scientificName;
}

export function patternDetectedInSet(
  detectedScientificNames: Set<string>,
  registryName: string
): boolean {
  const canonical = canonicalScientificName(registryName);
  if (detectedScientificNames.has(canonical) || detectedScientificNames.has(registryName)) {
    return true;
  }

  for (const detected of detectedScientificNames) {
    if (canonicalScientificName(detected) === canonical) {
      return true;
    }
  }

  return false;
}

function observationValueIndex(observations: AtlasObservationRecord[]) {
  const index = new Map<string, Set<string>>();

  for (const observation of observations) {
    const existing = index.get(observation.fieldId) ?? new Set<string>();
    existing.add(observation.value);
    index.set(observation.fieldId, existing);
  }

  return index;
}

function secondaryContextMet(
  rule: SignalRule,
  valueIndex: Map<string, Set<string>>
) {
  if (!rule.secondaryRequiresAnyField || rule.secondaryRequiresAnyField.length === 0) {
    return true;
  }

  return rule.secondaryRequiresAnyField.some((requirement) => {
    const values = valueIndex.get(requirement.fieldId);
    return values ? requirement.values.some((value) => values.has(value)) : false;
  });
}

export function routeObservation(
  observation: AtlasObservationRecord,
  allObservations: AtlasObservationRecord[],
  locale?: string
): SignalRoutingResult | null {
  const valueIndex = observationValueIndex(allObservations);
  const matchingRules = ONTOLOGY_SIGNAL_RULES.filter((rule) => {
    if (rule.fieldId !== observation.fieldId) {
      return false;
    }

    if (rule.values && !rule.values.includes(observation.value)) {
      return false;
    }

    return true;
  });

  if (matchingRules.length === 0) {
    return null;
  }

  const rule = matchingRules[0];
  const primary = PATTERN_BY_ID.get(rule.primaryPatternId);

  if (!primary) {
    return null;
  }

  let secondaryId: string | null = rule.secondaryPatternId ?? null;

  if (secondaryId && !secondaryContextMet(rule, valueIndex)) {
    secondaryId = null;
  }

  if (rule.excludePatternIds?.includes("body_unpredictability")) {
    secondaryId = secondaryId === "body_unpredictability" ? null : secondaryId;
  }

  const secondary = secondaryId ? PATTERN_BY_ID.get(secondaryId) : undefined;
  const exclusionApplied = rule.excludePatternIds ?? [];

  return {
    observationId: observation.id,
    fieldId: observation.fieldId,
    value: observation.value,
    rawField: observation.fieldId,
    normalizedSignal: observation.displayText,
    primaryPatternId: primary.id,
    primaryScientificName: primary.scientificName,
    primaryParticipantLabel: v43Text(primary.id, "participantLabel", primary.participantLabel, locale),
    secondaryPatternId: secondary?.id ?? null,
    secondaryScientificName: secondary?.scientificName ?? null,
    secondaryParticipantLabel: secondary
      ? v43Text(secondary.id, "participantLabel", secondary.participantLabel, locale)
      : null,
    confidenceModifier: rule.confidenceModifier ?? 0,
    contributionLevel: rule.contributionLevel ?? "moderate",
    exclusionApplied,
    sourceLayer: "ontology"
  };
}

function aggregatePattern(
  patternId: string,
  routings: SignalRoutingResult[],
  role: "primary" | "secondary",
  locale?: string
): DetectedOntologyPattern | null {
  const definition = PATTERN_BY_ID.get(patternId);

  if (!definition) {
    return null;
  }

  const matched = routings.filter((routing) =>
    role === "primary"
      ? routing.primaryPatternId === patternId
      : routing.secondaryPatternId === patternId
  );

  if (matched.length === 0) {
    return null;
  }

  const supportingSignals = matched.map((routing) => routing.normalizedSignal).slice(0, 6);

  // `scientificName`/`id`/`class` are matching keys, read untouched everywhere
  // else in this pipeline — never pass them through v43Text. Every field below
  // is display-only; v43Text returns the English value unchanged whenever
  // locale is unset/"en", so this is a no-op for every existing caller.
  const participantLabel = v43Text(definition.id, "participantLabel", definition.participantLabel, locale);
  const plainLanguageMeaning = v43Text(definition.id, "plainLanguageMeaning", definition.plainLanguageMeaning, locale);
  return {
    id: definition.id,
    scientificName: definition.scientificName,
    participantLabel,
    class: definition.class,
    signalCount: matched.length,
    supportingSignals,
    plainLanguageMeaning,
    atlasNote: v43Text(definition.id, "atlasNote", definition.atlasNote, locale),
    whatAtlasObserved: plainLanguageMeaning,
    whyAtlasConnected: v43Text(definition.id, "whyConnected", definition.whyConnected, locale),
    watchOverTime: v43Text(definition.id, "watchOverTime", definition.watchOverTime, locale)
  };
}

function detectEmergentThemes(
  primaryPatterns: DetectedOntologyPattern[],
  secondaryPatterns: DetectedOntologyPattern[],
  locale?: string
): DetectedEmergentTheme[] {
  const primaryIds = new Set(primaryPatterns.map((pattern) => pattern.id));
  const secondaryIds = new Set(secondaryPatterns.map((pattern) => pattern.id));
  const themes: DetectedEmergentTheme[] = [];

  for (const rule of EMERGENT_CONVERGENCE_RULES) {
    const theme = PATTERN_BY_ID.get(rule.themeId);

    if (!theme || theme.class !== "emergent") {
      continue;
    }

    if (themes.some((item) => item.id === theme.id)) {
      continue;
    }

    const primaryMatchCount = rule.anyPrimaryIds
      ? rule.anyPrimaryIds.filter((id) => primaryIds.has(id)).length
      : primaryIds.size;

    if (primaryMatchCount < rule.minPrimaryCount) {
      continue;
    }

    if (rule.requiredPrimaryIds && !rule.requiredPrimaryIds.every((id) => primaryIds.has(id))) {
      continue;
    }

    if (
      rule.anySecondaryIds &&
      !rule.anySecondaryIds.some((id) => secondaryIds.has(id)) &&
      rule.requiredPrimaryIds?.includes("daily_function")
    ) {
      continue;
    }

    themes.push({
      id: theme.id,
      scientificName: theme.scientificName,
      participantLabel: v43Text(theme.id, "participantLabel", theme.participantLabel, locale),
      convergedFrom: [
        ...primaryPatterns.map((pattern) => pattern.participantLabel),
        ...secondaryPatterns.map((pattern) => pattern.participantLabel)
      ].slice(0, 5),
      plainLanguageMeaning: v43Text(theme.id, "plainLanguageMeaning", theme.plainLanguageMeaning, locale),
      watchOverTime: v43Text(theme.id, "watchOverTime", theme.watchOverTime, locale)
    });
  }

  return themes;
}

export function buildOntologyRoutingContext(
  observations: AtlasObservationRecord[],
  locale?: string
): OntologyRoutingContext {
  const routings = observations
    .map((observation) => routeObservation(observation, observations, locale))
    .filter((routing): routing is SignalRoutingResult => Boolean(routing));

  const primaryIds = [...new Set(routings.map((routing) => routing.primaryPatternId))];
  const secondaryIds = [
    ...new Set(
      routings
        .map((routing) => routing.secondaryPatternId)
        .filter((id): id is string => Boolean(id))
    )
  ];

  const primaryPatterns = primaryIds
    .map((id) => aggregatePattern(id, routings, "primary", locale))
    .filter((pattern): pattern is DetectedOntologyPattern => Boolean(pattern))
    .sort((first, second) => second.signalCount - first.signalCount);

  const secondaryPatterns = secondaryIds
    .map((id) => aggregatePattern(id, routings, "secondary", locale))
    .filter((pattern): pattern is DetectedOntologyPattern => Boolean(pattern))
    .sort((first, second) => second.signalCount - first.signalCount);

  const emergentThemes = detectEmergentThemes(primaryPatterns, secondaryPatterns, locale);

  return {
    routings,
    primaryPatterns,
    secondaryPatterns,
    emergentThemes
  };
}

export function toAtlasObservedPatterns(context: OntologyRoutingContext, locale?: string) {
  const emergentAtlasNote = v43Text(
    "_template",
    "emergentAtlasNote",
    "This theme emerged from how multiple observations converged — not from a single answer.",
    locale
  );
  const combined = [
    ...context.primaryPatterns,
    ...context.secondaryPatterns,
    ...context.emergentThemes.map((theme) => ({
      id: theme.id,
      scientificName: theme.scientificName,
      participantLabel: theme.participantLabel,
      class: "emergent" as OntologyClass,
      signalCount: theme.convergedFrom.length,
      supportingSignals: theme.convergedFrom,
      plainLanguageMeaning: theme.plainLanguageMeaning,
      atlasNote: emergentAtlasNote,
      whatAtlasObserved: theme.plainLanguageMeaning,
      whyAtlasConnected: theme.plainLanguageMeaning,
      watchOverTime: theme.watchOverTime
    }))
  ];

  const lightlyObservedSuffix = v43Text(
    "_template",
    "lightlyObserved",
    "was lightly observed in this first record.",
    locale
  );

  return combined.slice(0, 6).map((pattern) => ({
    name: pattern.scientificName,
    participantLabel: pattern.participantLabel,
    plainLanguageMeaning: pattern.plainLanguageMeaning,
    supportingSignals:
      pattern.supportingSignals.length > 0
        ? pattern.supportingSignals
        : [`${pattern.participantLabel} ${lightlyObservedSuffix}`],
    // `pattern.atlasNote` is already locale-resolved by aggregatePattern() above
    // for primary/secondary patterns — read it directly rather than re-fetching
    // the raw English value from the registry a second time.
    atlasNote:
      "class" in pattern && pattern.class === "emergent" ? emergentAtlasNote : pattern.atlasNote,
    whatAtlasObserved: pattern.whatAtlasObserved,
    whyAtlasConnected: pattern.whyAtlasConnected,
    watchOverTime: pattern.watchOverTime
  }));
}

export function routingsForPattern(
  context: OntologyRoutingContext,
  scientificName: string,
  role: "primary" | "secondary" = "primary"
) {
  return context.routings.filter((routing) =>
    role === "primary"
      ? routing.primaryScientificName === scientificName
      : routing.secondaryScientificName === scientificName
  );
}

export function hasBodyUnpredictabilityRouting(context: OntologyRoutingContext) {
  return context.routings.some(
    (routing) =>
      routing.secondaryPatternId === "body_unpredictability" ||
      routing.primaryPatternId === "body_unpredictability"
  );
}

export function getOntologyPatternsByClass(className: OntologyClass) {
  return ALL_PATTERNS.filter((pattern) => pattern.class === className);
}

export function getHotspotPreferredPatternIds(hotspotId: string): string[] {
  const map: Record<string, string[]> = {
    bleeding: ["bleeding_burden"],
    pain: ["pain_distribution", "pelvic_function"],
    hormonal: ["hormonal_rhythm"],
    cycle_disruption: ["hormonal_rhythm", "body_unpredictability"],
    daily_life: ["daily_function", "planning_around_symptoms"],
    care_access: ["care_experience"]
  };

  return map[hotspotId] ?? [];
}
