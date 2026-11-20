import { prisma } from "@/lib/prisma";
import { inWindow as inDateWindow, type DateWindow } from "@/lib/date-range";

/**
 * Derived analytics for the three lower steward-dashboard sections: the
 * Observatory Growth Dashboard, the Observation Return Rate, and Meaning
 * Signals. Everything here reads the v5 Atlas Intelligence run tables
 * (AtlasSignalRow / AtlasPatternRow) — the legacy Signal/SignalRule tables are
 * no longer written to and are always empty.
 *
 * Several of these cards render metrics the schema does not name directly.
 * Where that happens the definition is stated on the function that computes it,
 * so the number on screen is always traceable to a rule rather than a vibe.
 *
 * The header date filter passes a `window` (a preset look-back or a custom
 * start/end pair; either side may be open). It scopes the growth totals,
 * the growth chart and the meaning signals — the figures that are simply "how
 * much has the Atlas accumulated". It deliberately does NOT scope:
 *   • the growth tiles, which state their own comparison window in the label
 *     ("vs last 7 days") and would be meaningless re-based on a range;
 *   • the return-rate cohorts (30/90/180 days) and the completeness metrics,
 *     which are defined over a participant's whole history — restricting them
 *     to a window would report a return rate for people who never had the
 *     chance to return inside it.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const CHART_POINTS = 7;
const RETURN_WINDOWS = [30, 90, 180] as const;
const MEANING_SIGNAL_COUNT = 3;

/** A participant's language, as they declared it on the observation. */
type Lang = string;

export type Trend = number | null; // percent change; null = no basis for comparison

export type GrowthTile = {
  key: string;
  label: string;
  value: number;
  trendPct: Trend;
  trendWindow: string;
};

export type ChartPoint = {
  label: string;
  signals: number;
  concepts: number;
  languages: number;
};

export type CompletenessMetric = {
  label: string;
  /** Already formatted for display, because units differ (92% vs 2.1%). */
  display: string;
  tag: string | null;
  tone: "good" | "warn" | "bad" | null;
};

export type ReturnWindow = {
  days: number;
  label: string;
  /** Participants whose first observation is old enough to have had the chance to return. */
  eligible: number;
  returned: number;
  /** null when `eligible` is 0 — there is no cohort, so there is no rate. */
  percent: number | null;
};

export type MeaningSignal = {
  label: string;
  signalType: string;
  languages: number;
  occurrences: number;
};

export type StewardAnalytics = {
  growth: {
    tiles: GrowthTile[];
    totals: { label: string; value: number }[];
    chart: { points: ChartPoint[]; yTicks: number[] };
  };
  returnRate: {
    windows: ReturnWindow[];
    completeness: CompletenessMetric[];
    totalReturning: number;
    newThisWeek: number;
    trendPct: Trend;
  };
  meaningSignals: MeaningSignal[];
};

/* ── helpers ──────────────────────────────────────────────────────────────── */

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

/** Percent change, or null when there is no prior basis to compare against. */
function trend(current: number, previous: number): Trend {
  if (previous > 0) return Math.round(((current - previous) / previous) * 100);
  if (current > 0) return 100;
  return null;
}

/** Number of unordered pairs drawn from n items — C(n, 2). */
const pairs = (n: number) => (n * (n - 1)) / 2;

function normalizeLang(raw: string | null | undefined): Lang | null {
  const v = raw?.trim();
  return v ? v : null;
}

/** Round up to a "nice" axis maximum: 1, 2, or 5 times a power of ten. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const pow = 10 ** exp;
  const frac = value / pow;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * pow;
}

/**
 * `true` when the value the participant stored actually carries an answer.
 * Responses are Json: a string, a string[] (multi_select), or a boolean.
 * `false` is a real boolean answer, so only null/""/[] count as unanswered.
 */
function isAnswered(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Flatten a response value to the scalar option values it claims to hold. */
function valueTokens(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

/* ── the query ────────────────────────────────────────────────────────────── */

const ALL_TIME: DateWindow = { from: null, to: null };

export async function getStewardAnalytics(
  now = new Date(),
  /** Header date-filter window; unbounded = all time. See the note at the top. */
  window: DateWindow = ALL_TIME,
): Promise<StewardAnalytics> {
  const [
    patterns,
    signals,
    runs,
    contexts,
    observations,
    newParticipants,
    questions,
    narrativePrompts,
    responses,
  ] = await Promise.all([
    prisma.atlasPatternRow.findMany({ select: { name: true, createdAt: true } }),
    prisma.atlasSignalRow.findMany({
      select: { label: true, signalType: true, createdAt: true, runId: true },
    }),
    prisma.atlasIntelligenceRun.findMany({
      select: {
        id: true,
        observation: { select: { context: { select: { preferred_language: true } } } },
      },
    }),
    prisma.participantContext.findMany({
      select: {
        preferred_language: true,
        observation: { select: { startedAt: true } },
      },
    }),
    prisma.observation.findMany({
      select: { id: true, userId: true, flowKey: true, startedAt: true },
      orderBy: { startedAt: "asc" },
    }),
    prisma.user.count({
      where: { role: "participant", createdAt: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
    }),
    prisma.formQuestion.findMany({
      select: {
        fieldId: true,
        screen: { select: { flowKey: true } },
        options: { select: { value: true } },
      },
    }),
    prisma.narrativePrompt.findMany({ select: { promptId: true } }),
    // At MVP volume this is a few hundred rows. If observation counts grow into
    // the tens of thousands, roll these three completeness metrics up into a
    // materialized table rather than scanning every response on each request.
    prisma.observationResponse.findMany({
      select: { observationId: true, fieldId: true, value: true },
    }),
  ]);

  const runLang = new Map<string, Lang | null>(
    runs.map((r) => [r.id, normalizeLang(r.observation?.context?.preferred_language)]),
  );

  // Range-scoped view of the signal table. The growth tiles below still read the
  // unscoped array, because each states its own comparison window.
  const rangedSignals = signals.filter((s) => inDateWindow(s.createdAt, window));

  return {
    growth: buildGrowth(patterns, signals, contexts, runLang, now, window),
    returnRate: {
      ...buildReturnRate(observations, now),
      completeness: buildCompleteness(observations, questions, narrativePrompts, responses),
      newThisWeek: newParticipants,
    },
    meaningSignals: buildMeaningSignals(rangedSignals, runLang),
  };
}

/* ── Observatory Growth Dashboard ─────────────────────────────────────────── */

type PatternRow = { name: string; createdAt: Date };
type SignalRow = { label: string; signalType: string; createdAt: Date; runId: string };
type ContextRow = { preferred_language: string | null; observation: { startedAt: Date } | null };

/**
 * "New" is measured by *first appearance*, not by row count: a concept counts as
 * new in a window only if the window contains the first time the Atlas ever saw
 * that pattern name. Raw signal occurrences are counted per-row, since each is a
 * distinct extraction event.
 *
 * A "cross-language link" is a pair of languages that independently produced the
 * same signal label — the unit of evidence that two participants described the
 * same experience in different tongues. Total links = Σ over labels of C(n, 2)
 * where n is the number of distinct languages carrying that label.
 */
function buildGrowth(
  patterns: PatternRow[],
  signals: SignalRow[],
  contexts: ContextRow[],
  runLang: Map<string, Lang | null>,
  now: Date,
  window: DateWindow,
) {
  const t7 = new Date(now.getTime() - 7 * DAY_MS);
  const t14 = new Date(now.getTime() - 14 * DAY_MS);
  const t30 = new Date(now.getTime() - 30 * DAY_MS);
  const t60 = new Date(now.getTime() - 60 * DAY_MS);

  // First appearance of each concept (pattern name) and each language.
  const conceptFirstSeen = new Map<string, Date>();
  for (const p of patterns) {
    const seen = conceptFirstSeen.get(p.name);
    if (!seen || p.createdAt < seen) conceptFirstSeen.set(p.name, p.createdAt);
  }

  const languageFirstSeen = new Map<Lang, Date>();
  for (const c of contexts) {
    const lang = normalizeLang(c.preferred_language);
    const at = c.observation?.startedAt;
    if (!lang || !at) continue;
    const seen = languageFirstSeen.get(lang);
    if (!seen || at < seen) languageFirstSeen.set(lang, at);
  }

  const inWindow = (d: Date, from: Date, to?: Date) => d >= from && (!to || d < to);
  const countFirstSeen = (m: Map<string, Date>, from: Date, to?: Date) =>
    [...m.values()].filter((d) => inWindow(d, from, to)).length;

  const newSignals7 = signals.filter((s) => s.createdAt >= t7).length;
  const newSignalsPrev7 = signals.filter((s) => inWindow(s.createdAt, t14, t7)).length;

  // Cross-language links, evaluated over the signals visible at a point in time.
  const linksAsOf = (cutoff?: Date) => {
    const byLabel = new Map<string, Set<Lang>>();
    for (const s of signals) {
      if (cutoff && s.createdAt >= cutoff) continue;
      const lang = runLang.get(s.runId);
      if (!lang) continue;
      const set = byLabel.get(s.label) ?? new Set<Lang>();
      set.add(lang);
      byLabel.set(s.label, set);
    }
    let total = 0;
    for (const set of byLabel.values()) total += pairs(set.size);
    return total;
  };

  const linksNow = linksAsOf();
  const linksBefore7 = linksAsOf(t7);

  const tiles: GrowthTile[] = [
    {
      key: "newSignals",
      label: "New Signals Identified",
      value: newSignals7,
      trendPct: trend(newSignals7, newSignalsPrev7),
      trendWindow: "vs last 7 days",
    },
    {
      key: "newConcepts",
      label: "New Concepts",
      value: countFirstSeen(conceptFirstSeen, t7),
      trendPct: trend(countFirstSeen(conceptFirstSeen, t7), countFirstSeen(conceptFirstSeen, t14, t7)),
      trendWindow: "vs last 7 days",
    },
    {
      key: "languagesAdded",
      label: "Languages Added",
      value: countFirstSeen(languageFirstSeen, t30),
      trendPct: trend(
        countFirstSeen(languageFirstSeen, t30),
        countFirstSeen(languageFirstSeen, t60, t30),
      ),
      trendWindow: "vs last month",
    },
    {
      key: "crossLanguageLinks",
      label: "Cross-Language Links",
      value: linksNow,
      trendPct: trend(linksNow, linksBefore7),
      trendWindow: "vs last 7 days",
    },
  ];

  // Totals + chart honour the header range: within a window they count what
  // first appeared (concepts, languages) or occurred (signals) inside it.
  const inRange = (d: Date) => inDateWindow(d, window);
  const rangedSignals = signals.filter((s) => inRange(s.createdAt));
  const rangedConcepts = new Map([...conceptFirstSeen].filter(([, d]) => inRange(d)));
  const rangedLanguages = new Map([...languageFirstSeen].filter(([, d]) => inRange(d)));

  const totals = [
    { label: "Total Signals", value: rangedSignals.length },
    { label: "Total Concepts", value: rangedConcepts.size },
    { label: "Total Languages", value: rangedLanguages.size },
  ];

  return {
    tiles,
    totals,
    // The axis ends where the window does, so a custom range that closed in the
    // past doesn't draw a flat tail up to today.
    chart: buildGrowthChart(rangedSignals, rangedConcepts, rangedLanguages, window.to ?? now),
  };
}

/**
 * Cumulative signal/concept/language counts sampled at `CHART_POINTS` moments
 * between the Atlas's first recorded event and now. The bucket span adapts to
 * the data: a young observatory gets day labels, a mature one gets month labels,
 * so the axis never claims more history than exists.
 */
function buildGrowthChart(
  signals: SignalRow[],
  conceptFirstSeen: Map<string, Date>,
  languageFirstSeen: Map<Lang, Date>,
  now: Date,
): { points: ChartPoint[]; yTicks: number[] } {
  const earliestCandidates = [
    ...signals.map((s) => s.createdAt.getTime()),
    ...[...conceptFirstSeen.values()].map((d) => d.getTime()),
    ...[...languageFirstSeen.values()].map((d) => d.getTime()),
  ];

  if (earliestCandidates.length === 0) {
    return { points: [], yTicks: [] };
  }

  const start = Math.min(...earliestCandidates);
  const end = now.getTime();
  const span = Math.max(end - start, DAY_MS); // guard a zero-width span
  const useDayLabels = span <= 60 * DAY_MS;

  const fmt = (d: Date) =>
    useDayLabels
      ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

  const cumulativeBefore = (dates: Date[], at: number) =>
    dates.filter((d) => d.getTime() <= at).length;

  const signalDates = signals.map((s) => s.createdAt);
  const conceptDates = [...conceptFirstSeen.values()];
  const languageDates = [...languageFirstSeen.values()];

  const points: ChartPoint[] = [];
  for (let i = 0; i < CHART_POINTS; i++) {
    const at = start + (span * i) / (CHART_POINTS - 1);
    points.push({
      label: fmt(new Date(at)),
      signals: cumulativeBefore(signalDates, at),
      concepts: cumulativeBefore(conceptDates, at),
      languages: cumulativeBefore(languageDates, at),
    });
  }

  const peak = Math.max(...points.map((p) => Math.max(p.signals, p.concepts, p.languages)), 0);
  const max = niceMax(peak);
  // Deduplicate: a small axis (max of 1 or 2) would otherwise round its
  // intermediate ticks onto the same integer and print "1 1 0 0".
  const yTicks = [...new Set([max, (max * 2) / 3, max / 3, 0].map((v) => Math.round(v)))];

  return { points, yTicks };
}

/* ── Observation Return Rate ──────────────────────────────────────────────── */

type ObservationRow = { id: string; userId: string; flowKey: string; startedAt: Date };

/**
 * A participant "returned" if, within `days` of their first observation, they
 * started another one (an Atlas Check-In counts — it is a longitudinal return).
 *
 * Only participants whose first observation is at least `days` old are eligible:
 * someone who joined yesterday has not *failed* to return within 90 days, they
 * simply have not had the chance. With no eligible cohort the rate is null
 * rather than 0, so the UI can say "no cohort yet" instead of implying nobody
 * came back.
 */
function returnRateFor(observations: ObservationRow[], days: number, asOf: Date) {
  const firstByUser = new Map<string, Date>();
  for (const o of observations) {
    if (o.flowKey !== "first_observation") continue;
    if (o.startedAt > asOf) continue;
    const seen = firstByUser.get(o.userId);
    if (!seen || o.startedAt < seen) firstByUser.set(o.userId, o.startedAt);
  }

  let eligible = 0;
  let returned = 0;
  for (const [userId, first] of firstByUser) {
    const deadline = new Date(first.getTime() + days * DAY_MS);
    if (deadline > asOf) continue; // window has not closed yet
    eligible++;
    const didReturn = observations.some(
      (o) => o.userId === userId && o.startedAt > first && o.startedAt <= deadline,
    );
    if (didReturn) returned++;
  }

  return { eligible, returned, percent: eligible > 0 ? Math.round(pct(returned, eligible)) : null };
}

function buildReturnRate(observations: ObservationRow[], now: Date) {
  const windows: ReturnWindow[] = RETURN_WINDOWS.map((days) => ({
    days,
    label: `${days} Days`,
    ...returnRateFor(observations, days, now),
  }));

  // Trend on the headline (30-day) rate: today's cohort vs the cohort that had
  // closed its window a month ago.
  const current = windows[0].percent;
  const monthAgo = returnRateFor(observations, 30, new Date(now.getTime() - 30 * DAY_MS)).percent;
  const trendPct = current != null && monthAgo != null ? current - monthAgo : null;

  // A returning observer is anyone with more than one observation, ever.
  const perUser = new Map<string, number>();
  for (const o of observations) perUser.set(o.userId, (perUser.get(o.userId) ?? 0) + 1);
  const totalReturning = [...perUser.values()].filter((n) => n > 1).length;

  return { windows, totalReturning, trendPct };
}

/* ── Completeness ─────────────────────────────────────────────────────────── */

type QuestionRow = { fieldId: string; screen: { flowKey: string }; options: { value: string }[] };

/**
 * Four data-quality measures, each defined here because the schema names none
 * of them:
 *
 *  - Missing Data: answered responses vs the number of questions the
 *    participant's flow actually asks. The denominator is per-flow, since an
 *    Atlas Check-In asks 6 questions and a first observation asks 52.
 *  - Validity: for questions backed by a fixed option set, the share of stored
 *    values that are one of the allowed options. Free-text is not checkable and
 *    is excluded from both sides of the ratio.
 *  - Consistency: the share of stored responses whose fieldId is still
 *    recognised by the live form definition. This is a schema-drift detector —
 *    it falls below 100% when a question is renamed or removed while historical
 *    answers keyed to the old id remain. Narrative prompt ids (NP01…) are
 *    legitimate response keys that live in NarrativePrompt rather than
 *    FormQuestion, so they are recognised too.
 *  - Duplicate Rate: observations that repeat an earlier (participant, flow,
 *    calendar day) triple. ObservationResponse is uniquely keyed on
 *    (observationId, fieldId), so duplicate *answers* cannot exist; duplication
 *    can only occur at the observation level.
 */
function buildCompleteness(
  observations: ObservationRow[],
  questions: QuestionRow[],
  narrativePrompts: { promptId: string }[],
  responses: { observationId: string; fieldId: string; value: unknown }[],
): CompletenessMetric[] {
  const questionsByFlow = new Map<string, Set<string>>();
  const allowedByField = new Map<string, Set<string>>();
  for (const q of questions) {
    const set = questionsByFlow.get(q.screen.flowKey) ?? new Set<string>();
    set.add(q.fieldId);
    questionsByFlow.set(q.screen.flowKey, set);
    if (q.options.length > 0) {
      allowedByField.set(q.fieldId, new Set(q.options.map((o) => o.value)));
    }
  }

  const knownFieldIds = new Set<string>([
    ...questions.map((q) => q.fieldId),
    ...narrativePrompts.map((p) => p.promptId),
  ]);

  const flowByObservation = new Map(observations.map((o) => [o.id, o.flowKey]));

  // -- Missing data ---------------------------------------------------------
  let expected = 0;
  for (const o of observations) expected += questionsByFlow.get(o.flowKey)?.size ?? 0;

  let answered = 0;
  for (const r of responses) {
    const flow = flowByObservation.get(r.observationId);
    if (!flow) continue;
    if (!questionsByFlow.get(flow)?.has(r.fieldId)) continue; // narrative prompt, not a question
    if (isAnswered(r.value)) answered++;
  }
  const missingPct = expected > 0 ? 100 - pct(answered, expected) : 0;

  // -- Validity -------------------------------------------------------------
  let checkable = 0;
  let valid = 0;
  for (const r of responses) {
    const allowed = allowedByField.get(r.fieldId);
    if (!allowed || !isAnswered(r.value)) continue;
    checkable++;
    const tokens = valueTokens(r.value);
    if (tokens.length > 0 && tokens.every((t) => allowed.has(t))) valid++;
  }
  const validityPct = pct(valid, checkable);

  // -- Consistency ----------------------------------------------------------
  const recognised = responses.filter((r) => knownFieldIds.has(r.fieldId)).length;
  const consistencyPct = pct(recognised, responses.length);

  // -- Duplicate rate -------------------------------------------------------
  const seenKeys = new Set<string>();
  let duplicates = 0;
  for (const o of [...observations].sort((a, b) => +a.startedAt - +b.startedAt)) {
    const key = `${o.userId}|${o.flowKey}|${o.startedAt.toISOString().slice(0, 10)}`;
    if (seenKeys.has(key)) duplicates++;
    else seenKeys.add(key);
  }
  const duplicatePct = pct(duplicates, observations.length);

  // Higher is better for the first two; lower is better for the last two.
  const highGood = (p: number) =>
    p >= 90 ? tag("High", "good") : p >= 75 ? tag("Moderate", "warn") : tag("Low", "bad");
  const lowGood = (p: number) =>
    p <= 5 ? tag("Low", "good") : p <= 15 ? tag("Moderate", "warn") : tag("High", "bad");

  return [
    { label: "Consistency", display: `${Math.round(consistencyPct)}%`, ...noTag() },
    { label: "Validity", display: `${Math.round(validityPct)}%`, ...highGood(validityPct) },
    { label: "Duplicate Rate", display: `${duplicatePct.toFixed(1)}%`, ...lowGood(duplicatePct) },
    { label: "Missing Data", display: `${missingPct.toFixed(1)}%`, ...lowGood(missingPct) },
  ];
}

const tag = (label: string, tone: CompletenessMetric["tone"]) => ({ tag: label, tone });
const noTag = () => ({ tag: null, tone: null });

/* ── Meaning Signals ──────────────────────────────────────────────────────── */

/**
 * The signals that the most different languages agree on — i.e. the labels where
 * participants writing in different tongues described the same experience. Ties
 * broken by raw occurrence count, so a widely-shared signal outranks a rare one.
 */
function buildMeaningSignals(
  signals: SignalRow[],
  runLang: Map<string, Lang | null>,
): MeaningSignal[] {
  const byLabel = new Map<string, { signalType: string; langs: Set<Lang>; count: number }>();

  for (const s of signals) {
    const entry = byLabel.get(s.label) ?? { signalType: s.signalType, langs: new Set<Lang>(), count: 0 };
    entry.count++;
    const lang = runLang.get(s.runId);
    if (lang) entry.langs.add(lang);
    byLabel.set(s.label, entry);
  }

  return [...byLabel.entries()]
    .map(([label, e]) => ({
      label,
      signalType: e.signalType,
      languages: e.langs.size,
      occurrences: e.count,
    }))
    .sort((a, b) => b.languages - a.languages || b.occurrences - a.occurrences)
    .slice(0, MEANING_SIGNAL_COUNT);
}
