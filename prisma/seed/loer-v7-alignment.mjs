// LOER v7.0.0 alignment overlay — generated from the per-screen engineering
// blueprints in the client workbook.
//
// Earlier revisions of this file hand-authored the screens, copy and option
// lists from the `01_Master_Register` sheet alone. That sheet is a summary: the
// workbook also carries one blueprint sheet per screen (S01_Consent ..
// S80_Save_Atlas_Record) holding the participant-facing question text, the full
// governed Allowed Values, the DB mapping and the adaptive-logic rules. Working
// from the summary alone produced the wrong option lists on 45 screens and the
// wrong wording on 45.
//
// Source of truth is now prisma/seed/loer-v7-blueprints.json, produced by
//   python prisma/seed/extract_loer_blueprints.py "<workbook.xlsx>"
//
// This overlay maps those blueprints onto the flow: it assigns each LOER screen
// an internal slug (CR §9.1 condition 5 — identifiers stay internal), orders the
// flow, emits questions and options verbatim from the blueprint, and layers the
// governed routing rules on top.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FLOW = "first_observation";
const __dirname = dirname(fileURLToPath(import.meta.url));
const BLUEPRINTS = JSON.parse(readFileSync(join(__dirname, "loer-v7-blueprints.json"), "utf-8")).screens;

// ---------------------------------------------------------------------------
// 1. LOER screen -> internal slug, in flow order
// ---------------------------------------------------------------------------
// Existing slugs are preserved so no Observation.currentScreenId is invalidated.
// New screens take a descriptive slug. S40 splits into two screens (S40A/S40B)
// per the S39 adaptive rule, so it carries two entries.
const ORDER = [
  ["s00-landing", null],
  ["s01-consent", "S01"],
  ["s02-how-womb-atlas-works", "S02"],
  ["s03-quick-safety-check", "S03"],
  ["s04-safety-alert", "S04"],
  ["s05-context-intro", "S05"],
  ["s06-age", "S06"],
  ["s07-reproductive-state", "S07"],
  ["s08-hormonal-contraception", "S08"],
  ["s09-context-transition", "S09"],
  ["s10-cultural-background", "S10"],
  ["s11-current-country", "S11"],
  ["s12-birth-country", "S12"],
  ["s13-preferred-language", "S13"],
  ["s14-family-history", "S14"],
  ["reproductive-history-intro", "S15"],
  ["s16-reproductive-transition", "S16"],
  ["s17-ever-pregnant", "S17"],
  ["s18-pregnancy-count", "S18"],
  ["s19-pregnancy-loss", "S19"],
  ["s20-trying-to-conceive", "S20"],
  ["s21-bleeding-patterns", "S21"],
  ["s22-product-change-frequency", "S22"],
  ["s23-bleeding-duration", "S23"],
  ["s24-clot-size", "S24"],
  ["s25-interperiod-bleeding", "S25"],
  ["s26-bleeding-progression", "S26"],
  ["s27-bleeding-impact", "S27"],
  ["s29-pain-and-discomfort", "S28"],
  ["pain-presence", "S29"],
  ["s30-pain-response", "S30"],
  ["s31-pain-timing", "S31"],
  ["s32-pain-location", "S32"],
  ["pain-triggers", "S33"],
  ["pain-management", "S34"],
  ["s35-pain-progression", "S35"],
  ["s36-pelvic-body-function", "S36"],
  ["s37-body-change-signals", "S37"],
  ["s37a-vaginal-discharge", "S37A"],
  ["s37b-discharge-duration", "S37B"],
  ["s39-cycles-and-body-rhythms", "S38"],
  ["cycle-applicability", "S39"],
  ["s40-cycle-predictability", "S40A"],
  ["s40b-rhythm-predictability", "S40B"],
  ["s41-skipped-periods", "S41"],
  ["s42-hormonal-signs", "S42"],
  ["s43-cycle-changes", "S43"],
  ["s44-symptoms-relation", "S44"],
  ["s46-daily-life-and-impact", "S45"],
  ["functional-impact", "S46"],
  ["s47-missed-activities", "S47"],
  ["s48-fatigue", "S48"],
  ["s49-sleep-disruption", "S49"],
  ["s50-dizziness", "S50"],
  ["s51-disruption-frequency", "S51"],
  ["s52-life-areas-affected", "S52"],
  ["s53-normalization", "S53"],
  ["s54-symptom-duration", "S54"],
  ["s55-symptom-progression", "S55"],
  ["s56-symptom-predictability", "S56"],
  ["s57-care-and-support", "S57"],
  ["s58-spoken-to-provider", "S58"],
  ["s59-care-response", "S59"],
  ["s60-care-dismissal", "S60"],
  ["s61-access-to-care", "S61"],
  ["information-needs", "S62"],
  ["priority-question", "S63"],
  // S64-S69 are presented together on one screen — six reflections, each with
  // its own text/audio control — rather than six consecutive screens. The
  // original slug is reused so existing progress pointers still resolve, and the
  // prompt ids (NP01-NP05, MI01) are unchanged so prior answers carry across.
  ["s64-narrative-chamber", ["S64", "S65", "S66", "S67", "S68", "S69"]],
  ["s74-review-archive", null], // app-only review step; the edit path resolves renderKind "review"
  ["s75-prepare-reflection", "S70"],
  ["s76-reflection-processing", "S71"],
  ["reflection-review", "S74"],
  ["s79-atlas-record-processing", "S75"],
  ["s82-atlas-record", "S76"],
  ["s80-constellation-record", "S77"],
  ["s81-observed-patterns", "S78"],
  ["record-privacy", "S79"],
  ["s78-atlas-record-saved", "S80"],
];

// Mobile-register screens LOER v7.0.0 does not define. Participant answers are
// unaffected: ObservationResponse.fieldId has no FK to FormQuestion.
const RETIRED = [
  // LOER separates the reflection into Overview (S72), Expansion (S73) and
  // Review (S74). All three render the same generated reflection, so the
  // participant saw the identical briefing three times in a row. S74 is the one
  // that also carries the review controls, so it is the single reflection
  // screen and the other two are not built.
  "s77-reflection-chamber",
  "reflection-expansion",
  "s63-narrative-intro",
  "s65-narrative-complete",
  "s66-sensitive-topics",
  "s67-pain-during-sex",
  "s68-bowel-movements",
  "s69-unusual-discharge",
  "s70-symptom-priority",
  "s71-sensitive-narrative",
  "s72-sensitive-topics-complete",
  "s73-processing-drift",
  "s33-pain-duration",
  "s34-pain-predictability",
];

// Screens the blueprint does not describe (app-only carry-overs).
const CARRY_OVER = {
  "s00-landing": { renderKind: "landing", section: "Landing" },
  "s74-review-archive": { renderKind: "review", section: "Review Archive" },
};

// ---------------------------------------------------------------------------
// 2. Blueprint -> runtime shape
// ---------------------------------------------------------------------------
const SECTION_BY_PREFIX = [
  [/^S0[1-2]$/, "Onboarding"],
  [/^S0[3-4]$/, "Safety"],
  [/^S0[5-8]$/, "Context Chamber"],
  [/^S(09|1[0-4])$/, "Demographic & Cultural"],
  [/^S(1[5-9]|20)$/, "Reproductive History"],
  [/^S2[1-7]$/, "Bleeding Patterns"],
  [/^S(2[89]|3[0-5])$/, "Pain and Discomfort"],
  [/^S3[6-7][AB]?$/, "Pelvic & Body Experiences"],
  [/^S(3[89]|40A|40B|4[1-4])$/, "Cycles and Body Rhythms"],
  [/^S(4[5-9]|50)$/, "Daily Life and Impact"],
  [/^S5[1-6]$/, "Overall Burden"],
  [/^S(5[7-9]|6[01])$/, "Care and Support"],
  [/^S6[23]$/, "Narrative Preparation"],
  [/^S6[4-9]$/, "Your Narrative"],
  [/^S7[0-4]$/, "Reflection Chamber"],
  [/^S(7[5-9]|80)$/, "Atlas Record"],
];
const sectionOf = (loerId) =>
  (SECTION_BY_PREFIX.find(([re]) => re.test(loerId)) ?? [null, "Observation"])[1];

// Render kind is driven by the blueprint Input Type, with the generated and
// consent/safety screens pinned explicitly.
const PINNED_KIND = {
  S01: "consent",
  S03: "safety_check",
  S04: "safety_alert",
  S71: "processing",
  S72: "reflection",
  S73: "reflection_expansion",
  S74: "reflection_review",
  S75: "processing",
  S76: "atlas_record",
  S77: "constellation",
  S78: "observed_patterns",
  S79: "record_privacy",
  S80: "confirmation",
};
function renderKindOf(loerId, inputType) {
  if (PINNED_KIND[loerId]) return PINNED_KIND[loerId];
  const t = (inputType || "").toLowerCase();
  if (t.includes("information")) return "information";
  if (t.includes("text or audio")) return "narrative";
  if (t.includes("processing")) return "processing";
  return "question";
}

/**
 * Resolve a screen's render kind from its blueprint.
 *
 * Two guards, both learned the hard way:
 *  - A few sheets leave Input Type blank. Defaulting the *display* string to
 *    "Information screen" while resolving the kind from the blank value made S02
 *    a question screen, which then rendered an empty form.
 *  - A "question" screen with nothing to ask is always a bug, so it falls back
 *    to an information screen rather than shipping a blank page.
 */
function resolveKind(loerId, base) {
  const bare = loerId.replace(/[AB]$/, "");
  const kind = renderKindOf(bare, base.inputType || "Information screen");
  if (kind !== "question") return kind;
  const hasCaptures = (SUPPLEMENT[bare] ?? base.captures ?? []).length > 0;
  return hasCaptures ? "question" : "information";
}
function fieldTypeOf(inputType, isArray) {
  const t = (inputType || "").toLowerCase();
  if (t.includes("country")) return "country";
  if (t.includes("language selector")) return "text";
  if (t.includes("text or audio")) return "text_audio";
  if (t.includes("acknowledg")) return "boolean";
  if (isArray || t.includes("multi")) return "multi_select";
  return "single_select";
}

// Chamber columns that exist in prisma/schema.prisma today. A capture is
// projected only when its column is already there; everything else persists in
// ObservationResponse, which is canonical and is what the intelligence engine
// reads. Promoting the rest needs the additive migration in the change log.
const EXISTING_COLUMNS = new Set([
  "observation_consents.consent_acknowledged",
  "observation_safety.safety_flags",
  "observation_safety.urgent_symptom_flags",
  "participant_context.age_range",
  "participant_context.reproductive_state",
  "participant_context.hormonal_contraception_status",
  "participant_context.cultural_background",
  "participant_context.current_country",
  "participant_context.birth_country",
  "participant_context.preferred_language",
  "participant_context.family_health_history",
  "reproductive_history.ever_pregnant",
  "reproductive_history.pregnancy_count",
  "reproductive_history.pregnancy_loss_history",
  "reproductive_history.trying_to_conceive",
  "bleeding_patterns.product_change_frequency",
  "bleeding_patterns.bleeding_duration",
  "bleeding_patterns.clot_size",
  "bleeding_patterns.interperiod_bleeding",
  "bleeding_patterns.bleeding_progression",
  "bleeding_patterns.bleeding_impact",
  "pain_patterns.pain_pattern",
  "pain_patterns.pain_timing",
  "pain_patterns.pain_location",
  "pain_patterns.pain_triggers",
  "pain_patterns.pain_predictability",
  "pain_patterns.pain_severity_change",
  "pain_patterns.pelvic_symptoms",
  "cycle_patterns.cycle_predictability",
  "cycle_patterns.skipped_periods",
  "cycle_patterns.hormonal_signs",
  "cycle_patterns.cycle_changes",
  "daily_life.function_impact",
  "daily_life.missed_activities",
  "daily_life.fatigue_frequency",
  "daily_life.sleep_disruption",
  "daily_life.dizziness_frequency",
  "daily_life.life_disruption",
  "daily_life.life_areas_affected",
  "daily_life.normalcy_perception",
  "daily_life.symptom_duration",
  "daily_life.symptom_predictability",
  "daily_life.symptom_severity",
  "daily_life.body_changes",
  "care_access.spoken_to_provider",
  "care_access.care_response",
  "care_access.care_dismissal",
  "care_access.access_to_care",
]);

// cycle_patterns.symptoms_related_to is varchar today and S44 is a multi-select,
// so projecting it would fail. Held back until the column becomes Json.
const BLOCKED_COLUMNS = new Set(["cycle_patterns.symptoms_related_to"]);

// "None" options must clear the rest of the group — S34's QA states "none
// options exclusive within each group", and the same holds across the register.
// Phrasing varies ("Nothing helps", "I don't manage it", "I don't feel it
// affects anything"), so the negative forms are matched by pattern.
// Deliberately narrow: "I do not currently have bleeding cycles" (S39) and "I do
// not use products/protection" (S22) are substantive answers, not none-options,
// so only the manage/feel/know forms are treated as exclusive.
const EXCLUSIVE =
  /^(prefer not to say|none of these|none|none right now|not applicable|no clear trigger|nothing helps|no effect|i (do not|don't) (manage|feel)|i (do not|don't) know$)/i;

// Column headings for grouped multi-select screens. The sheet names the value
// lists ("Management Values") but gives no participant-facing heading for each.
const GROUP_HEADINGS = {
  "S34.0": "How do you manage pain?",
  "S34.1": "What does it affect?",
  // S61's first control is the screen's own question; the second is the
  // optional barrier list, which the sheet labels but does not phrase.
  "S61.0": null,
  "S61.1": "What makes it easier or harder to access care or support?",
};

/**
 * Approved design supersedes the workbook.
 *
 * Where the client's screen design and the blueprint sheet disagree, the design
 * wins and the divergence is recorded here rather than edited into the extract —
 * so re-running the extractor never silently reverts it, and the gap stays
 * visible for the next workbook revision.
 *
 * S34: the approved design splits medication into one entry, adds breathing and
 * relaxation, herbal supplements and dietary change, and drops caregiving from
 * the impact list. 11 management options against the sheet's 10; impact wording
 * is first-person throughout.
 */
const DESIGN_OVERRIDES = {
  S34: [
    [
      ["medication_prescription_or_otc", "Medication (prescription or over-the-counter)"],
      ["heat_or_cold_therapy", "Heat or cold therapy"],
      ["rest_or_sleep", "Rest or sleep"],
      ["stretching_exercise_or_movement", "Stretching, exercise, or movement"],
      ["breathing_meditation_or_relaxation", "Breathing, meditation, or relaxation techniques"],
      ["herbal_or_supplements", "Herbal or supplements"],
      ["change_what_i_eat_or_drink", "I change what I eat or drink"],
      ["limit_or_avoid_activities", "I limit or avoid certain activities"],
      ["other_please_describe", "Other (please describe)"],
      ["i_dont_manage_it", "I don't manage it"],
      ["prefer_not_to_say", "Prefer not to say"],
    ],
    [
      ["affects_work_or_school", "It affects my work or school"],
      ["affects_relationships_or_intimacy", "It affects my relationships or intimacy"],
      ["affects_mood_or_mental_wellbeing", "It affects my mood or mental wellbeing"],
      ["affects_sleep", "It affects my sleep"],
      ["affects_exercise_or_activity", "It affects my ability to exercise or be active"],
      ["affects_concentration_or_focus", "It affects my concentration or focus"],
      ["affects_daily_activities", "It affects my daily activities or productivity"],
      ["other_please_describe", "Other (please describe)"],
      ["no_effect", "I don't feel it affects anything"],
      ["prefer_not_to_say", "Prefer not to say"],
    ],
  ],
};

// S01, S03 and S04 use a different blueprint layout with no "Allowed Values" or
// "Field ID" row, so their captures are supplied here. The safety-flag values
// are the ones already live in the database and already referenced by the S03
// routing rule — changing them would orphan existing responses for no gain.
// S01's four mandatory acknowledgements come from the blueprint's "Required
// Acknowledgement 1-4" rows and are each their own gate — the register requires
// no preselected consent choices and blocks Continue while any is unanswered
// (ADP-1001). The last one is the core participation consent and is the field
// that projects to observation_consents.consent_acknowledged.
const CONSENT_FIELD_IDS = [
  "consent_purpose_ack",
  "consent_voluntary_ack",
  "consent_nondiagnostic_ack",
  "consent_acknowledged",
];

const consentAcknowledgements = () =>
  (BLUEPRINTS.S01?.acknowledgements ?? []).map((text, i) => {
    const fieldId = CONSENT_FIELD_IDS[i] ?? `consent_ack_${i + 1}`;
    const core = fieldId === "consent_acknowledged";
    return {
      fieldId,
      fieldType: "boolean",
      required: "Required",
      questionText: text,
      table: core ? "observation_consents" : "",
      column: core ? "consent_acknowledged" : "",
      options: [["acknowledged", text]],
    };
  });

const SUPPLEMENT = {
  S01: [
    ...consentAcknowledgements(),
    {
      fieldId: "research_use_preference",
      fieldType: "boolean",
      questionText: "My anonymised record may be used to support research (optional)",
      options: [["yes", "My anonymised record may be used to support research"]],
    },
    {
      fieldId: "recontact_preference",
      fieldType: "boolean",
      questionText: "I am open to being contacted about future research (optional)",
      options: [["yes", "I am open to being contacted about future research"]],
    },
  ],
  S03: [
    {
      fieldId: "safety_flags",
      fieldType: "multi_select",
      required: "Required",
      table: "observation_safety",
      column: "safety_flags",
      options: [
        ["heavy_hourly_bleeding", "Soaking through protection every hour or more"],
        ["severe_sudden_pain", "Sudden, severe abdominal or pelvic pain"],
        ["faint_or_dizzy", "Fainting, or feeling close to fainting"],
        ["fever_pelvic_pain", "Fever alongside pelvic pain"],
        ["discharge_odour_pain", "Unusual discharge with odour and pain"],
        ["positive_pregnancy_pain_bleeding", "A positive pregnancy test with pain or bleeding"],
        ["none_of_these", "None of these"],
      ],
    },
  ],
  S04: [
    {
      fieldId: "safety_alert_viewed",
      fieldType: "boolean",
      options: [["acknowledged", "I have read this guidance"]],
    },
  ],
  // S74 "Review actions + optional feedback" and S79 "Settings review + optional
  // changes" — both describe participant controls the sheet does not enumerate.
  S74: [
    {
      fieldId: "reflection_review",
      fieldType: "single_select",
      questionText: "Does this reflection match your experience?",
      options: [
        ["accurate", "Yes, this matches"],
        ["partly_accurate", "Partly — some of it does not fit"],
        ["not_accurate", "No, this does not match my experience"],
      ],
    },
    {
      fieldId: "reflection_review_note",
      fieldType: "text",
      questionText: "What would you change or add?",
    },
  ],
  // S79 presents the contribution choice only.
  //
  // The storage control ("Save this Atlas Record to my Observatory") and the
  // sharing control ("Who can see this record?") were removed at the client's
  // request. Note what that changes: the blueprint's Required row is "Storage
  // action required where applicable", and ED-073 keeps saving separate from
  // contributing, so with no storage control the record is now saved without
  // the participant being asked. Contribution remains optional and independent,
  // which is the part ED-074 protects — a record-level setting may narrow S01
  // consent but never broaden it.
  S79: [
    {
      fieldId: "record_contribution_consent",
      fieldType: "boolean",
      questionText: "Allow my anonymised record to support research",
      options: [["contribute", "Allow my anonymised record to support research"]],
    },
  ],
};

// Screens that present several LOER prompts together. The heading and support
// copy belong to the combined screen, not to any one blueprint.
const COMBINED_SCREENS = {
  "s64-narrative-chamber": {
    name: "Your reflections matter",
    purpose: [
      "These reflections help Atlas notice patterns and understand what matters most to you.",
      "Share as much or as little as you feel comfortable. Every prompt is optional.",
    ].join("\n\n"),
    section: "Your Narrative",
    primaryActionLabel: "Continue",
  },
};

function buildScreen(slug, loerId, order) {
  const carry = CARRY_OVER[slug];

  if (Array.isArray(loerId)) {
    const combined = COMBINED_SCREENS[slug];
    const first = BLUEPRINTS[loerId[0]];
    return {
      screenId: slug,
      flowKey: FLOW,
      name: combined.name,
      section: combined.section,
      purpose: combined.purpose,
      inputType: "Text or audio",
      renderKind: "narrative",
      primaryActionLabel: combined.primaryActionLabel,
      order,
      atlasDomain: combined.section,
      mvpPhase: "MVP",
      status: "Locked",
      visibilityRule: null,
      loerScreenId: loerId[0],
      spansLoerScreens: loerId,
      scrId: first?.scrId ?? null,
      trustCardId: first?.trustCard ?? null,
      aiDisclosure: first?.aiDisclosure ?? null,
      registerStatus: first?.status ?? null,
    };
  }

  if (!loerId) {
    return {
      screenId: slug,
      flowKey: FLOW,
      name: slug === "s00-landing" ? "Welcome to Womb Atlas" : "Review Your Observation",
      section: carry?.section ?? "Observation",
      // Landing copy: first paragraph is the strapline, the rest is body text.
      // S00 has no blueprint sheet in the workbook — this comes from the design.
      purpose:
        slug === "s00-landing"
          ? [
              "Your story. Your choice. Your control.",
              "Today you will begin creating your first Atlas Record—a private record of the health experiences you choose to share.",
              "Your Atlas Record helps you organize your experiences over time so you can better understand changes, identify recurring patterns, and reflect on your health journey.",
            ].join("\n\n")
          : "Review what you have shared. You can change any answer before your reflection is created.",
      inputType: carry?.renderKind === "review" ? "Review" : "Landing",
      renderKind: carry?.renderKind ?? "information",
      primaryActionLabel: "Continue",
      order,
      atlasDomain: null,
      mvpPhase: "MVP",
      status: "Locked",
      visibilityRule: null,
      loerScreenId: null,
    };
  }

  // S40A / S40B share the S40 blueprint with variant-specific wording.
  const base = BLUEPRINTS[loerId] ?? BLUEPRINTS[loerId.replace(/[AB]$/, "")];
  if (!base) throw new Error(`LOER v7 overlay: no blueprint for ${loerId} (slug ${slug})`);

  const variant = /40A$/.test(loerId) ? "A" : /40B$/.test(loerId) ? "B" : null;
  // Opening Copy, where the blueprint provides it, is the screen's body text —
  // repeating the participant title as both heading and body reads as a bug.
  // What `purpose` holds depends on the screen type.
  //
  // On a question screen the participant title IS the question and is rendered
  // by the field, so `purpose` carries only the blueprint's Support Copy — the
  // explanatory line beneath it. Including the title here would print the
  // question twice; omitting Support Copy (the earlier behaviour) dropped it
  // entirely, since question screens never render `purpose`.
  //
  // Information screens carry their content as several labelled paragraphs
  // (Core Message, Atlas Record Explanation, ...), so those are joined instead.
  const kind = resolveKind(loerId, base);
  const isQuestionLike = ["question", "narrative"].includes(kind);
  // A grouped screen has one heading over several controls, so its title is the
  // screen name and the support line explains the columns.
  const isGrouped = (base.valueGroups?.length ?? 0) > 1;
  const body = isQuestionLike
    ? base.supportCopy || (isGrouped ? "Select all that apply in each column." : "")
    : base.openingCopy ||
      (base.bodyCopy?.length ? base.bodyCopy.join("\n\n") : "") ||
      [base.participantTitle, base.supportCopy].filter(Boolean).join("\n\n") ||
      base.purpose;

  return {
    screenId: slug,
    flowKey: FLOW,
    // Question screens take the canonical name as their heading (the
    // participant title is the question itself, rendered by the field). Consent
    // and information screens have no separate question, so their participant
    // title is the heading.
    name:
      variant === "B"
        ? "Bleeding or Body Rhythm Predictability"
        : (["consent", "information"].includes(resolveKind(loerId, base)) ||
              (base.valueGroups?.length ?? 0) > 1) &&
            base.participantTitle
          ? base.participantTitle
          : base.canonicalName || loerId,
    section: sectionOf(loerId),
    // S40B is a question screen, so its purpose is support copy only — the
    // question itself is on the field (see B_VARIANT_QUESTION).
    // The A/B wording lives on the question itself, so the screen keeps its
    // ordinary support copy.
    purpose: body,
    inputType: base.inputType || "Information screen",
    renderKind: resolveKind(loerId, base),
    primaryActionLabel: base.primaryAction || "Continue",
    order,
    atlasDomain: sectionOf(loerId),
    mvpPhase: "MVP",
    status: "Locked",
    visibilityRule: null,
    // Governance metadata carried from the blueprint (CR §5).
    loerScreenId: loerId,
    scrId: base.scrId || null,
    trustCardId: base.trustCard || null,
    aiDisclosure: base.aiDisclosure || null,
    registerStatus: base.status || null,
    observationId: base.observationId || null,
    knowledgeIds: base.knowledge || null,
    reasoningIds: base.reasoning || null,
    reflectionIds: base.reflection || null,
    technicalComponents: base.technical || null,
    adaptiveRuleId: base.adaptiveRuleId || null,
  };
}

function buildQuestions(slug, loerId) {
  // Combined screens capture through prompts, not questions.
  if (!loerId || Array.isArray(loerId)) return [];
  const base = BLUEPRINTS[loerId] ?? BLUEPRINTS[loerId.replace(/[AB]$/, "")];
  if (!base) return [];

  if (SUPPLEMENT[loerId]) {
    return SUPPLEMENT[loerId].map((s, i) => ({
      fieldId: s.fieldId,
      registryFieldId: s.fieldId,
      screenId: slug,
      questionText: s.questionText || base.participantTitle || base.canonicalName,
      fieldType: s.fieldType,
      required: s.required || "Optional",
      validation: base.validation || null,
      notes: [base.observationId, base.adaptiveRuleId].filter(Boolean).join(" · ") || null,
      targetTable: s.table ?? "",
      targetColumn: s.column ?? "",
      order: i,
      options: (s.options || []).map(([value, label], o) => ({
        value,
        label,
        order: o,
        isExclusive: EXCLUSIVE.test(label.trim()),
        signalTag: null,
      })),
    }));
  }

  if (!base.captures.length) return [];
  const kind = resolveKind(loerId, base);
  // Generated / processing screens describe an output, not a participant input.
  if (["processing", "reflection", "constellation", "observed_patterns", "atlas_record"].includes(kind)) {
    return [];
  }

  const options = base.options.map((o, i) => ({
    value: o.value,
    label: o.label,
    order: i,
    isExclusive: EXCLUSIVE.test(o.label.trim()),
    signalTag: null,
  }));

  // A screen may map to more than one observation field (S32 pain_location +
  // pain_spread, S34, S52, S61, S62), but the workbook gives ONE Allowed Values
  // list per sheet and that list already spans them — S32's includes both the
  // body areas and "Pain spreads between areas".
  //
  // So a multi-capture screen is one control feeding several fields, not several
  // questions. Emitting one question per capture printed the same participant
  // title twice, the second time with no options under it.
  //
  // The extra fields are recorded on the question's notes so the mapping is not
  // lost. Where the blueprint's Input Type describes a genuine second control
  // ("optional priority selection", "optional barrier details", "two grouped
  // multi-selects"), its value list is not in the workbook and has to come from
  // the client before it can be built.
  // Screens whose sheet supplies one value list PER captured field ("Management
  // Values" / "Impact Values" on S34) render one control per group. The heading
  // for each comes from the group label, since the sheet gives no per-group
  // question text.
  if (base.valueGroups?.length && base.valueGroups.length === base.captures.length) {
    const override = DESIGN_OVERRIDES[loerId];
    return base.captures.map((c, i) => {
      const group = override
        ? { label: base.valueGroups[i].label,
            options: override[i].map(([value, label]) => ({ value, label })) }
        : base.valueGroups[i];
      const fid = c.fieldId.replace(/\[\]$/, "");
      const col = c.dbColumn.replace(/\[\]$/, "");
      const tgt = `${c.dbTable}.${col}`;
      const canProject = EXISTING_COLUMNS.has(tgt) && !BLOCKED_COLUMNS.has(tgt);
      return {
        fieldId: fid,
        registryFieldId: fid,
        screenId: slug,
        questionText:
          GROUP_HEADINGS[`${loerId}.${i}`] ??
          (i === 0 ? base.participantTitle : null) ??
          `${group.label} — select all that apply`,
        // The `[]` suffix on the capture marks a multi-select; S61 pairs a
        // single-select access question with a multi-select barrier list.
        fieldType:
          c.fieldId.endsWith("[]") || c.dbColumn.endsWith("[]") ? "multi_select" : "single_select",
        required: /required/i.test(base.required || "") ? "Required" : "Optional",
        validation: base.validation || null,
        notes: [base.observationId, base.adaptiveRuleId].filter(Boolean).join(" · ") || null,
        targetTable: canProject ? c.dbTable : "",
        targetColumn: canProject ? col : "",
        order: i,
        options: group.options.map((o, n) => ({
          value: o.value,
          label: o.label,
          order: n,
          isExclusive: EXCLUSIVE.test(o.label.trim()),
          signalTag: null,
        })),
      };
    });
  }

  const [primary, ...secondary] = base.captures;
  const isArray = primary.fieldId.endsWith("[]") || primary.dbColumn.endsWith("[]");
  const isB = /40B$/.test(loerId);
  const fieldId = isB ? "rhythm_predictability" : primary.fieldId.replace(/\[\]$/, "");
  const column = primary.dbColumn.replace(/\[\]$/, "");
  const target = `${primary.dbTable}.${column}`;
  const projectable = EXISTING_COLUMNS.has(target) && !BLOCKED_COLUMNS.has(target) && !isB;

  const notes = [
    base.observationId,
    base.adaptiveRuleId,
    secondary.length
      ? `Also maps: ${secondary.map((c) => c.fieldId.replace(/\[\]$/, "")).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Generated and confirmation screens list a capture (reflection_expansion,
  // final_record, ...) that names their OUTPUT, not a participant input. With no
  // governed value list they would render as an empty select, so they are left
  // to their own components and the field is recorded by the record pipeline.
  const fieldType = fieldTypeOf(base.inputType, isArray);
  if (["single_select", "multi_select"].includes(fieldType) && options.length === 0) {
    return [];
  }

  return [
    {
      fieldId,
      registryFieldId: fieldId,
      screenId: slug,
      // Adaptive A/B screens state per-variant wording ("S40A Question",
      // "S40B Question"); the shared Participant Title assumes a current cycle,
      // which is what the B variant exists to avoid.
      questionText:
        base.variantQuestions?.[loerId] || base.participantTitle || base.canonicalName,
      fieldType,
      required: /required/i.test(base.required || "") ? "Required" : "Optional",
      validation: base.validation || null,
      notes: notes || null,
      targetTable: projectable ? primary.dbTable : "",
      targetColumn: projectable ? column : "",
      order: 0,
      options,
    },
  ];
}

const PROMPT_IDS = { S63: "PQ01", S64: "NP01", S65: "NP02", S66: "NP03", S67: "NP04", S68: "NP05", S69: "MI01" };

function buildPrompts(slug, loerId) {
  if (!loerId) return [];

  // One prompt per LOER screen on a combined screen, in register order.
  if (Array.isArray(loerId)) {
    return loerId.map((id, i) => {
      const bp = BLUEPRINTS[id];
      if (!bp) throw new Error(`LOER v7 overlay: no blueprint for ${id} on ${slug}`);
      return {
        promptId: PROMPT_IDS[id] ?? `NP${String(i + 1).padStart(2, "0")}`,
        screenId: slug,
        promptText: bp.participantTitle || bp.canonicalName,
        captureType: "Text/audio",
        order: i,
      };
    });
  }

  const base = BLUEPRINTS[loerId];
  if (!base || resolveKind(loerId, base) !== "narrative") return [];
  const n = { S64: "NP01", S65: "NP02", S66: "NP03", S67: "NP04", S68: "NP05", S63: "PQ01", S69: "MI01" }[loerId];
  if (!n) return [];
  return [
    {
      promptId: n,
      screenId: slug,
      promptText: base.participantTitle || base.canonicalName,
      captureType: "Text/audio",
      order: 0,
    },
  ];
}

// ---------------------------------------------------------------------------
// 3. Routing (the governed branches, keyed on blueprint option values)
// ---------------------------------------------------------------------------
const v = (loerId, ...labels) => {
  const bp = BLUEPRINTS[loerId];
  const want = labels.map((l) => l.toLowerCase());
  return (bp?.options ?? [])
    .filter((o) => want.some((w) => o.label.toLowerCase().startsWith(w)))
    .map((o) => o.value);
};

const CONDITIONAL_ROUTES = [
  // S03 — any urgent flag routes to the alert; "None of these" does not.
  {
    from: "s03-quick-safety-check",
    to: "s04-safety-alert",
    priority: 0,
    // Positive match on the urgent flags. A negated "none of these" test would
    // route everyone to the alert when no answer has been given yet.
    condition: {
      field: "safety_flags",
      op: "contains_any",
      value: SUPPLEMENT.S03[0].options.map(([value]) => value).filter((x) => x !== "none_of_these"),
    },
    note: "LOER S03 / ADP-1003 — urgent flag selected",
  },
  // S17 — S18 when yes; S19 otherwise.
  {
    from: "s17-ever-pregnant",
    to: "s18-pregnancy-count",
    priority: 0,
    condition: { field: "ever_pregnant", op: "in", value: v("S17", "yes") },
    note: "LOER S17 / ADP-3005 — Yes",
  },
  // S29 — only "No" skips the pain detail. Not sure / prefer not to say take the
  // neutral route to S30 (ADP-4009).
  {
    from: "pain-presence",
    to: "s35-pain-progression",
    priority: 0,
    condition: { field: "pain_present", op: "in", value: v("S29", "no") },
    note: "LOER S29 / ADP-4009 — No, skip S30–S34",
  },
  // S39 — regular/irregular cycles get S40A; everything else gets S40B.
  {
    from: "cycle-applicability",
    to: "s40b-rhythm-predictability",
    priority: 0,
    condition: {
      field: "cycle_applicability",
      op: "in",
      value: v("S39", "i do not currently", "i am pregnant", "i use treatment"),
    },
    note: "LOER S39 / ADP-5004 — non-cycling, pregnant/postpartum or treatment-affected",
  },
  // S37 / ADP-5002 — "Changes in vaginal discharge" opens the two-screen
  // discharge sub-flow (S37A then S37B). Any other selection goes to S38.
  {
    from: "s37-body-change-signals",
    to: "s37a-vaginal-discharge",
    priority: 0,
    condition: {
      field: "body_changes",
      op: "contains_any",
      value: v("S37", "changes in vaginal discharge"),
    },
    note: "LOER S37 / ADP-5002 — discharge change selected",
  },

  // S58 — only "Yes" sees Care Response. No branch may skip S60 or S61.
  {
    from: "s58-spoken-to-provider",
    to: "s59-care-response",
    priority: 0,
    condition: { field: "spoken_to_provider", op: "in", value: v("S58", "yes") },
    note: "LOER S58 / ADP-6008 — Yes",
  },
  // S76 — constellation is the default; patterns and privacy are alternates.
  {
    from: "s82-atlas-record",
    to: "s81-observed-patterns",
    priority: 0,
    condition: { field: "record_explore_choice", op: "eq", value: "patterns" },
    note: "LOER S76 — Observed Patterns",
  },
  {
    from: "s82-atlas-record",
    to: "record-privacy",
    priority: 1,
    condition: { field: "record_explore_choice", op: "eq", value: "privacy" },
    note: "LOER S76 — straight to privacy controls",
  },
];

// Where a branch target is also the next screen in ORDER, the "otherwise" arm
// needs an explicit fallback or every participant follows the conditional path.
const DEFAULT_OVERRIDES = {
  "s03-quick-safety-check": "s05-context-intro",
  "s17-ever-pregnant": "s19-pregnancy-loss",
  "cycle-applicability": "s40-cycle-predictability",
  "s40-cycle-predictability": "s41-skipped-periods",
  "s40b-rhythm-predictability": "s41-skipped-periods",
  "s37-body-change-signals": "s39-cycles-and-body-rhythms",
  "s58-spoken-to-provider": "s60-care-dismissal",
  "pain-presence": "s30-pain-response",
};

// ---------------------------------------------------------------------------
// 4. Apply
// ---------------------------------------------------------------------------
export function applyLoerV7Alignment(data) {
  const retired = new Set(RETIRED);
  const summary = { screens: 0, questions: 0, options: 0, prompts: 0, routes: 0, retired: 0, unprojected: 0 };

  const before = data.screens.length;
  data.screens = data.screens.filter((s) => s.flowKey !== FLOW);
  summary.retired = before - data.screens.length;

  const screens = [];
  const questions = [];
  const prompts = [];
  ORDER.forEach(([slug, loerId], i) => {
    screens.push(buildScreen(slug, loerId, i));
    questions.push(...buildQuestions(slug, loerId));
    prompts.push(...buildPrompts(slug, loerId));
  });

  // Field ids are globally unique in FormQuestion.
  const seen = new Set();
  for (const q of questions) {
    if (seen.has(q.fieldId)) {
      throw new Error(`LOER v7 overlay: duplicate fieldId "${q.fieldId}" (screen ${q.screenId})`);
    }
    seen.add(q.fieldId);
    if (!q.targetTable) summary.unprojected += 1;
  }

  // Screens belonging to other flows (atlas_checkin) survive untouched, along
  // with their questions and prompts.
  const otherFlowScreens = new Set(data.screens.map((s) => s.screenId));
  data.screens.push(...screens);
  data.questions = [
    ...data.questions.filter((q) => otherFlowScreens.has(q.screenId)),
    ...questions,
  ];
  data.narrativePrompts = [
    ...data.narrativePrompts.filter((p) => otherFlowScreens.has(p.screenId)),
    ...prompts,
  ];

  // Routes: sequential defaults from ORDER, conditionals layered on top.
  const live = new Set(ORDER.map(([slug]) => slug));
  const routes = data.routes.filter((r) => !live.has(r.fromScreenId) && !retired.has(r.fromScreenId));
  for (const r of CONDITIONAL_ROUTES) {
    if (!live.has(r.from) || !live.has(r.to)) continue;
    routes.push({ fromScreenId: r.from, toScreenId: r.to, priority: r.priority, condition: r.condition, note: r.note });
  }
  const seq = ORDER.map(([slug]) => slug);
  for (let i = 0; i < seq.length - 1; i++) {
    const from = seq[i];
    const to = DEFAULT_OVERRIDES[from] ?? seq[i + 1];
    if (!live.has(to)) throw new Error(`LOER v7 overlay: default from "${from}" targets missing "${to}"`);
    routes.push({
      fromScreenId: from,
      toScreenId: to,
      priority: 99,
      condition: null,
      note: DEFAULT_OVERRIDES[from] ? "LOER v7 branch fallback" : "LOER v7 sequential default",
    });
  }
  data.routes = routes;

  summary.screens = screens.length;
  summary.questions = questions.length;
  summary.options = questions.reduce((n, q) => n + q.options.length, 0);
  summary.prompts = prompts.length;
  summary.routes = routes.length;
  return summary;
}

export const LOER_V7_ORDER = ORDER;
export const LOER_V7_RETIRED = RETIRED;

// LOER screens deliberately not built, and why. Kept explicit so the verifier
// can tell an intentional omission from an accidental one.
export const LOER_V7_NOT_IMPLEMENTED = {
  S72: "Reflection Overview — merged into S74, which shows the same reflection plus the review controls.",
  S73: "Reflection Expansion — merged into S74; rendered an identical reflection block.",
};
export const LOER_V7_BLUEPRINTS = BLUEPRINTS;

// Screens whose controls are hand-supplied because the workbook sheet gives no
// Allowed Values for them. Their wording is provisional and must not be checked
// against the blueprint's participant title.
export const LOER_V7_SUPPLEMENTED = Object.keys(SUPPLEMENT);

// Screens whose option lists come from the approved design rather than the
// workbook — see DESIGN_OVERRIDES. Excluded from blueprint option comparison.
export const LOER_V7_DESIGN_OVERRIDDEN = Object.keys(DESIGN_OVERRIDES);
