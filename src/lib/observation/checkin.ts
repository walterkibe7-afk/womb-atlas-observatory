// Atlas Check-In logic: derive the previously-tracked signals from a participant's
// latest Atlas Record, and apply per-signal deltas to a cloned answer map so a new
// observation can be re-run through the intelligence pipeline (Delta + new Atlas
// Record).
//
// The delta -> field mapping is grounded directly in `ONTOLOGY_SIGNAL_RULES`
// (v43/pattern-ontology.ts): pattern detection there is driven by which specific
// option VALUES match a rule for a field, not by "more/less severe" position on an
// ordinal ladder, and a pattern's confidence is a 3-tier function of how many
// DISTINCT fields register a match (low <2, moderate ==2, high >=3 — see
// pattern-service.ts; 0 matches means the pattern isn't detected at all, so the
// domain score is 0). Each domain below lists EVERY field ONTOLOGY_SIGNAL_RULES
// ties to that domain's pattern(s) (primary or secondary role), each with a
// `matchValues` set copied verbatim from its rule (guaranteed to register as
// evidence) and a `safeValue` confirmed from the seeded option list to match no
// rule at all.
//
// "Worsened"/"Improved" move the domain ONE CONFIDENCE TIER at a time — reading
// the participant's CURRENT answers to count how many driver fields presently
// match, then flipping just enough fields (matching -> safe, or safe -> matching)
// to land at the next tier's boundary. This is a genuine "a bit better/worse"
// step, not a snap to an extreme, and it's why this function needs the prior
// answers rather than just the delta direction. "Resolved" is semantically
// different — it means the issue is gone, not merely improved — so it still
// does a full reset of every field to its safe value in one step.
import { ONTOLOGY_SIGNAL_RULES } from "@/lib/observation/intelligence/v43/pattern-ontology";
import type { AnswerMap, AnswerValue } from "@/lib/observation/types";
import { domainLabel } from "@/components/participant/signal-domains";

export type CheckinChange = "worsened" | "no_change" | "improved" | "resolved";

export interface TrackedSignal {
  domain: string;
  label: string;
  severity: "High" | "Moderate" | "Low" | "Baseline";
  score: number;
  /** True when the participant's latest record carried an urgent safety flag that
   *  ties to this domain — the "Urgent symptom marker" surfaced in the briefing. */
  urgentMarker?: boolean;
  /** Why Atlas believes this baseline: the pattern/signal names most recently
   *  observed for this domain (fed to the companion + the Observatory Briefing). */
  evidence?: string[];
}

export interface CheckinDelta {
  domain: string;
  label: string;
  change: CheckinChange;
}

type ConstellationScore = { domain: string; score: number; evidenceCount?: number };
type ObservedPatternGroup = { domain: string; signals: string[] };

interface DriverField {
  fieldId: string;
  /** True for multi_select fields (stored as string arrays). */
  multi?: boolean;
  /** Value(s) ONTOLOGY_SIGNAL_RULES matches for this field (set when flipping to "matching"). */
  matchValues: string[];
  /** A value ONTOLOGY_SIGNAL_RULES never matches for this field (set when flipping to "safe"). */
  safeValue: string | string[];
}

// Every field ONTOLOGY_SIGNAL_RULES ties (as primary or secondary) to each
// domain's pattern(s), with match/safe values confirmed against the seeded form
// definition's full option lists (prisma/seed/form-definition.json).
const CHECKIN_DOMAIN_DRIVERS: Record<string, DriverField[]> = {
  Bleeding: [
    { fieldId: "product_change_frequency", matchValues: ["every_1_2_hours", "more_than_once_per_hour_or_leaking_through"], safeValue: "every_4_6_hours_or_less_often" },
    { fieldId: "bleeding_duration", matchValues: ["6_8_days", "more_than_8_days"], safeValue: "less_than_3_days" },
    { fieldId: "clot_size", matchValues: ["medium", "large"], safeValue: "no_clots_noticed" },
    { fieldId: "interperiod_bleeding", matchValues: ["occasionally", "frequently"], safeValue: "never" },
    // S26 became single-select in the §3.2 input-type changes.
    { fieldId: "bleeding_progression", matchValues: ["become_heavier"], safeValue: "stayed_about_the_same" },
    { fieldId: "bleeding_impact", multi: true, matchValues: ["disturbs_sleep", "limits_leaving_home", "requires_planning_around_bleeding"], safeValue: ["none_of_these"] },
    { fieldId: "fatigue_frequency", matchValues: ["frequently", "most_days", "constantly_or_almost_constantly"], safeValue: "rarely" },
    { fieldId: "dizziness_frequency", matchValues: ["occasionally", "frequently", "most_days", "i_have_fainted_or_nearly_fainted"], safeValue: "no" },
  ],
  Pain: [
    { fieldId: "pain_functional_impact", multi: true, matchValues: ["affects_daily_activities", "affects_exercise_or_activity"], safeValue: ["no_effect"] },
    { fieldId: "pain_timing", multi: true, matchValues: ["at_different_times_across_a_cycle", "randomly_or_unpredictably"], safeValue: ["during_bleeding"] },
    { fieldId: "pain_location", multi: true, matchValues: ["pain_spreads_between_areas"], safeValue: [] },
    { fieldId: "pain_severity_change", matchValues: ["gradually_worsened", "increased_suddenly"], safeValue: "improved" },
    { fieldId: "pelvic_symptoms", multi: true, matchValues: ["bloating", "abdominal_swelling"], safeValue: ["none_of_these"] },
    { fieldId: "body_changes", multi: true, matchValues: ["abdominal_enlargement_or_swelling", "increased_bloating"], safeValue: ["none_of_these"] },
    // Replaces the retired pain_during_sex / bowel_movement_pain booleans.
    { fieldId: "pain_triggers", multi: true, matchValues: ["sexual_activity_or_penetration", "bowel_movements"], safeValue: ["no_clear_trigger"] },
  ],
  Hormonal: [
    { fieldId: "cycle_predictability", matchValues: ["somewhat_predictable_but_variable", "often_irregular_or_unpredictable", "i_am_not_sure"], safeValue: "very_predictable" },
    { fieldId: "skipped_periods", matchValues: ["occasionally", "frequently"], safeValue: "never" },
    { fieldId: "hormonal_signs", multi: true, matchValues: ["hot_flashes", "night_sweats"], safeValue: ["none_of_these"] },
    { fieldId: "cycle_changes", matchValues: ["cycles_or_bleeding_have_become_shorter_or_more_frequent", "longer_or_less_frequent", "more_irregular_or_unpredictable"], safeValue: "no_noticeable_change" },
    { fieldId: "symptoms_related_to", multi: true, matchValues: ["bleeding", "around_ovulation_or_mid_cycle"], safeValue: ["no_clear_timing_relationship"] },
  ],
  "Daily Life": [
    { fieldId: "missed_activities", matchValues: ["occasionally", "more_than_once_in_a_typical_month_or_cycle", "several_days_in_a_row"], safeValue: "never" },
    { fieldId: "sleep_disruption", matchValues: ["occasionally", "frequently", "most_nights_during_symptom_episodes", "constantly_or_almost_constantly"], safeValue: "never" },
    { fieldId: "life_disruption", matchValues: ["somewhat", "quite_a_lot", "very_much"], safeValue: "barely_or_not_at_all" },
    { fieldId: "life_areas_affected", multi: true, matchValues: ["work_or_school", "sleep"], safeValue: ["none_of_these"] },
    // S53 became a multi-select of normalization sources (ED-039).
    { fieldId: "normalization_context", multi: true, matchValues: ["i_have_learned_to_live_around_them"], safeValue: ["i_thought_they_were_normal"] },
    { fieldId: "symptom_progression", matchValues: ["gradually_worsening", "worsening_quickly"], safeValue: "improving" },
    { fieldId: "symptom_burden", matchValues: ["it_changes_from_day_to_day"], safeValue: "mostly_manageable" },
  ],
  "Care Access": [
    { fieldId: "spoken_to_provider", matchValues: ["no", "i_tried_but_could_not_access_an_appointment"], safeValue: "yes" },
    { fieldId: "care_response", multi: true, matchValues: ["i_was_told_symptoms_were_normal", "i_did_not_receive_clear_answers", "i_am_still_waiting_for_answers_or_care", "i_was_referred_to_another_provider", "i_stopped_seeking_care_after_the_experience"], safeValue: ["i_felt_heard"] },
    { fieldId: "care_dismissal", matchValues: ["yes_once", "yes_more_than_once", "i_am_not_sure"], safeValue: "no" },
    { fieldId: "access_to_care", matchValues: ["no", "sometimes", "i_am_not_sure"], safeValue: "yes" },
  ],
};

// Rules grouped by fieldId once, so checking "does this field's current value
// match" doesn't re-filter the full ontology rule list per field per call.
const RULES_BY_FIELD = new Map<string, typeof ONTOLOGY_SIGNAL_RULES>();
for (const rule of ONTOLOGY_SIGNAL_RULES) {
  const list = RULES_BY_FIELD.get(rule.fieldId) ?? [];
  list.push(rule);
  RULES_BY_FIELD.set(rule.fieldId, list);
}

function fieldCurrentlyMatches(fieldId: string, value: AnswerValue | undefined): boolean {
  const rules = RULES_BY_FIELD.get(fieldId);
  if (!rules || value == null) return false;
  const values = Array.isArray(value) ? value.map(String) : [String(value)];
  return rules.some((rule) => !rule.values || values.some((v) => rule.values!.includes(v)));
}

/** Confidence tier floor (matched-field count) for a given match count — see pattern-service.ts. */
function tierFloor(matchCount: number): 0 | 1 | 2 | 3 {
  if (matchCount >= 3) return 3;
  if (matchCount === 2) return 2;
  if (matchCount === 1) return 1;
  return 0;
}

function severityFromScore(score: number): TrackedSignal["severity"] {
  if (score >= 3) return "High";
  if (score >= 2) return "Moderate";
  if (score >= 1) return "Low";
  return "Baseline";
}

function toScores(value: unknown): ConstellationScore[] {
  return Array.isArray(value) ? (value as ConstellationScore[]) : [];
}

function toObservedPatterns(value: unknown): ObservedPatternGroup[] {
  return Array.isArray(value) ? (value as ObservedPatternGroup[]) : [];
}

type AtlasRecordLike = { constellation_scores?: unknown; observed_patterns?: unknown };

// Which check-in domain each urgent safety_flags option belongs to, so an urgent
// marker lights up on the right tracked signal in the briefing. "none" and any
// unmapped flag carry no domain (handled as a global marker by the caller).
const SAFETY_FLAG_DOMAIN: Record<string, string> = {
  heavy_hourly_bleeding: "Bleeding",
  faint_or_dizzy: "Bleeding",
  positive_pregnancy_pain_bleeding: "Bleeding",
  severe_sudden_pain: "Pain",
  fever_pelvic_pain: "Pain",
  discharge_odour_pain: "Pain",
};

/** Domains flagged urgent by the latest record's safety_flags (excludes "none"). */
export function urgentDomainsFromSafetyFlags(flags: string[] | undefined): Set<string> {
  const domains = new Set<string>();
  for (const flag of flags ?? []) {
    const domain = SAFETY_FLAG_DOMAIN[flag];
    if (domain) domains.add(domain);
  }
  return domains;
}

/**
 * The signals a participant can check in on: any domain EVER observed
 * (nonzero) across their full history, not just their latest Atlas Record. A
 * domain that's since resolved to 0 still belongs here — it can relapse and
 * worsen again, and a participant should be able to report that. Severity/score
 * reflect the CURRENT (latest) state; the label carries forward the most
 * recent pattern name seen for that domain, even if it's since gone quiet.
 *
 * `atlasRecords` must be ordered oldest -> newest (the last entry is "current").
 * `opts.latestSafetyFlags` are the current record's safety_flags values; any that
 * map to a domain flag that domain's tracked signal with an urgent marker.
 */
export function deriveTrackedSignals(
  atlasRecords: AtlasRecordLike[],
  opts?: { latestSafetyFlags?: string[]; locale?: string },
): TrackedSignal[] {
  if (atlasRecords.length === 0) return [];
  const latest = atlasRecords[atlasRecords.length - 1];
  const latestScores = toScores(latest.constellation_scores);
  const urgentDomains = urgentDomainsFromSafetyFlags(opts?.latestSafetyFlags);

  const everObserved = new Set<string>();
  for (const record of atlasRecords) {
    for (const s of toScores(record.constellation_scores)) {
      if (s.score > 0) everObserved.add(s.domain);
    }
    for (const p of toObservedPatterns(record.observed_patterns)) {
      everObserved.add(p.domain);
    }
  }

  // The most recent record that observed patterns for this domain — its signal
  // names are the "why Atlas believes it" evidence carried into the check-in.
  function mostRecentSignals(domain: string): string[] {
    for (let i = atlasRecords.length - 1; i >= 0; i -= 1) {
      const match = toObservedPatterns(atlasRecords[i].observed_patterns).find((p) => p.domain === domain);
      if (match?.signals?.length) return match.signals;
    }
    return [];
  }

  return [...everObserved]
    .filter((domain) => domain in CHECKIN_DOMAIN_DRIVERS)
    .map((domain) => {
      const score = latestScores.find((s) => s.domain === domain)?.score ?? 0;
      const evidence = mostRecentSignals(domain);
      // Urgent when the latest safety check maps here, OR the domain's own
      // observed signals already carry an urgent marker (how the pipeline
      // surfaces urgency today — resilient to how safety_flags were stored).
      const urgentMarker =
        urgentDomains.has(domain) || evidence.some((s) => /urgent/i.test(s));
      return {
        domain,
        label: evidence[0] ?? domainLabel(domain, opts?.locale),
        severity: severityFromScore(score),
        score,
        urgentMarker,
        evidence,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Grounded question context for the Check-In Companion.
//
// The companion shouldn't ask abstract "how has your bleeding been?" questions —
// it should revisit the ACTUAL observation questions whose prior answers flagged
// the signal ("negatively marked"), reference the participant's own last answer,
// and understand the rule (which answers mean heavier vs. lighter). That context
// is assembled here from the same CHECKIN_DOMAIN_DRIVERS rules the delta pipeline
// uses, so what the companion asks about and what applyCheckinDeltas nudges stay
// in lock-step.
// ---------------------------------------------------------------------------

/** Question text + option code→label list for a driver field, loaded from the
 *  seeded form definition (FormQuestion/FormAnswerOption) by the caller. */
export interface DriverQuestionMeta {
  questionText: string;
  options: { value: string; label: string }[];
}

/** One negatively-marked observation question: the participant's prior answer
 *  registered as evidence for the signal, so it's worth asking how it changed. */
export interface SignalQuestion {
  fieldId: string;
  questionText: string;
  /** The participant's last answer, as human label(s). */
  priorAnswer: string;
  /** All available answer labels for this question — the companion offers a few
   *  as quick choices so the participant can reply without composing prose. */
  answerOptions: string[];
  /** Answers that indicate the signal is present / heavier (the rule). */
  heavierAnswers: string[];
  /** Answers that indicate it is lighter / eased / gone (the rule). */
  lighterAnswers: string[];
}

export interface SignalQuestionContext {
  domain: string;
  /** Only the driver questions currently flagged for this domain; empty when the
   *  domain is tracked but no answer currently registers (e.g. since resolved). */
  questions: SignalQuestion[];
}

/** Every driver fieldId tied to the given domains — the questions/answers the
 *  route must load from the form definition to build the grounded context. */
export function checkinDriverFieldIds(domains: string[]): string[] {
  const ids = new Set<string>();
  for (const domain of domains) {
    for (const d of CHECKIN_DOMAIN_DRIVERS[domain] ?? []) ids.add(d.fieldId);
  }
  return [...ids];
}

function codesToLabels(
  value: AnswerValue | undefined,
  options: { value: string; label: string }[],
): string[] {
  if (value == null) return [];
  const codes = Array.isArray(value) ? value.map(String) : [String(value)];
  const byCode = new Map(options.map((o) => [o.value, o.label] as const));
  return codes.map((c) => byCode.get(c) ?? c);
}

/**
 * Build the grounded question context: for each domain, ONLY the driver
 * questions whose prior answer currently registers as evidence for the signal
 * (the "negatively marked" ones), enriched with the participant's own last
 * answer and the rule direction (heavier vs. lighter answers). Domains with no
 * currently-flagged question get an empty list — the companion then just checks
 * whether the signal has recurred rather than re-asking settled questions.
 *
 * `meta` maps each driver fieldId → its question text + option labels (loaded
 * from the seeded FormQuestion/FormAnswerOption rows by the caller).
 */
export function buildSignalQuestionContext(
  domains: string[],
  priorAnswers: AnswerMap,
  meta: Map<string, DriverQuestionMeta>,
): SignalQuestionContext[] {
  return domains.map((domain) => {
    const drivers = CHECKIN_DOMAIN_DRIVERS[domain] ?? [];
    const questions: SignalQuestion[] = [];
    for (const d of drivers) {
      // Only revisit questions the participant's prior answer negatively marked.
      if (!fieldCurrentlyMatches(d.fieldId, priorAnswers[d.fieldId])) continue;
      const m = meta.get(d.fieldId);
      if (!m) continue;
      const safeValues = Array.isArray(d.safeValue) ? d.safeValue : [d.safeValue];
      questions.push({
        fieldId: d.fieldId,
        questionText: m.questionText,
        priorAnswer:
          codesToLabels(priorAnswers[d.fieldId], m.options).join(", ") || "(no answer recorded)",
        answerOptions: m.options.map((o) => o.label),
        heavierAnswers: codesToLabels(d.matchValues, m.options),
        lighterAnswers: codesToLabels(safeValues, m.options),
      });
    }
    return { domain, questions };
  });
}

function applySafe(next: AnswerMap, driver: DriverField) {
  next[driver.fieldId] = driver.multi ? [...(driver.safeValue as string[])] : (driver.safeValue as string);
}

function applyMatch(next: AnswerMap, driver: DriverField) {
  next[driver.fieldId] = driver.multi ? [...driver.matchValues] : driver.matchValues[0];
}

/**
 * Clone the prior answer map and apply the check-in deltas so the pipeline
 * detects a genuinely (and gradually) different set of patterns for that domain.
 */
export function applyCheckinDeltas(priorAnswers: AnswerMap, deltas: CheckinDelta[]): AnswerMap {
  const next: AnswerMap = { ...priorAnswers };

  for (const delta of deltas) {
    if (delta.change === "no_change") continue;
    const drivers = CHECKIN_DOMAIN_DRIVERS[delta.domain];
    if (!drivers) continue;

    if (delta.change === "resolved") {
      // Semantically distinct from "improved": the issue is gone, not merely
      // better — clear every field's evidence in one step.
      for (const driver of drivers) applySafe(next, driver);
      continue;
    }

    const matching = drivers.filter((d) => fieldCurrentlyMatches(d.fieldId, priorAnswers[d.fieldId]));
    const safe = drivers.filter((d) => !matching.includes(d));
    const currentCount = matching.length;
    const currentFloor = tierFloor(currentCount);

    if (delta.change === "improved") {
      // Step down exactly one tier (e.g. high -> moderate -> low -> none).
      const targetCount = Math.max(0, currentFloor - 1);
      const toClear = currentCount - targetCount;
      for (const driver of matching.slice(0, Math.max(0, toClear))) applySafe(next, driver);
    } else {
      // "worsened": step up exactly one tier (none -> low -> moderate -> high),
      // capped once already at the "high" ceiling (matchCount >= 3).
      if (currentFloor >= 3) continue; // already at the highest tier — no-op
      const targetCount = currentFloor + 1;
      const toAdd = targetCount - currentCount;
      for (const driver of safe.slice(0, Math.max(0, toAdd))) applyMatch(next, driver);
    }
  }

  return next;
}
