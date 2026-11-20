import { prisma } from "@/lib/prisma";
import { isEvidenceConfidence, type EvidenceConfidence } from "@/lib/observation/evidence";
import { signalTypeDomain } from "@/lib/observation/signal-types";
import { formatDateLong, formatDateMedium, formatDateShort } from "@/lib/observation/locale-date";
import { v43Text } from "@/lib/observation/intelligence/v43/v43-i18n";
import { participantLabelFor } from "@/lib/observation/intelligence/v43/pattern-ontology";
import { domainLabel, DOMAIN_TRANSLATION_ID } from "@/components/participant/signal-domains";

export type { EvidenceConfidence };

// Spec constellation domains (must match the reflection route's domains).
const CONSTELLATION_DOMAINS = [
  "Bleeding",
  "Pain",
  "Hormonal",
  "Cycle",
  "Daily Life",
  "Care Access",
] as const;

// Check-in cadence: one cycle. Drives the "Next Check-In" countdown.
export const CHECKIN_INTERVAL_DAYS = 28;

// Grounded "participants like you" pairings for Observatory Insights — honest
// "often also note" phrasing, never a fabricated statistic.
const DOMAIN_COMPANION: Record<string, string> = {
  Bleeding: "fatigue and low energy",
  Pain: "disruption to daily plans",
  Hormonal: "changes in sleep and mood",
  Cycle: "shifts in cycle predictability",
  "Daily Life": "sleep disruption and low energy",
  "Care Access": "having their concerns dismissed",
};

export type TrendDirection = "baseline" | "stable" | "increasing" | "improving";

export interface SignalSeriesPoint {
  name: string;
  [domain: string]: number | string;
}

export interface SignalTrend {
  domain: string;
  series: number[];
  latest: number;
  direction: TrendDirection;
}

export interface LifeStage {
  stageKey: string;
  label: string;
  description: string;
}

export interface CareJourneyPhase {
  key: string;
  label: string;
  done: boolean;
}

export interface CareJourney {
  phases: CareJourneyPhase[];
  currentLabel: string;
  description: string;
}

export interface PatternSummary {
  /** Participant-facing name, e.g. "Daily life impact". */
  label: string;
  /** Clinical/ontology name, e.g. "Daily Function". Shown as a secondary line. */
  scientificName: string;
  whyThisMatters: string;
  /** What Atlas looked at to reach this — the "key domains contributing" chips. */
  contributingFactors: string[];
  /**
   * null for records finalized through the deterministic path, which carry a
   * pattern name but no confidence. The dots are hidden rather than guessed.
   */
  confidence: EvidenceConfidence | null;
}

/**
 * How a signal moved between the participant's two most recent Atlas Records.
 * `baseline` means there is only one record, so there is nothing to compare to
 * yet — not that the signal is steady.
 */
export type SignalStatus = "new" | "persistent" | "baseline";

export interface SignalHighlight {
  /** AIKB register id, e.g. "SIG-BOD-PAIN-013". */
  signalId: string;
  /** Register label, e.g. "Severe Pain Burden". */
  name: string;
  /** AIKB signal type, e.g. "pain_characteristics". */
  signalType: string;
  /** Display domain for icon + colour — see `lib/observation/signal-types.ts`. */
  domain: string;
  status: SignalStatus;
  /** How many of the participant's records this signal has appeared in. */
  recordCount: number;
  /** How many observations in the latest record support this signal. */
  evidenceCount: number;
  /** Total records available to compare against. */
  recordTotal: number;
  /** Presence per record, oldest → newest, for the presence track. */
  presence: boolean[];
}

export interface ArchetypeSummary {
  name: string;
  /** One-line description of the archetype. */
  coreTheme: string;
  whySelected: string;
  confidence: EvidenceConfidence | null;
  /**
   * Strengths from the Atlas Record — the "strengths in action" chips.
   * `name` is the fixed English registry key (used to pick the chip icon),
   * `label` is the participant-facing, locale-translated text to display.
   */
  strengths: { name: string; label: string }[];
  /** Participant-facing labels of the patterns that produced this archetype. */
  shapedByPatterns: string[];
}

export interface TrajectorySummary {
  observationsTotal: number;
  checkinsCompleted: number;
  domainsTracked: number;
  mostImpacted: string[];
  stillTracking: string[];
  overallTrend: "improving" | "needs_attention" | "stable";
}

export type TimelineEventType =
  | "first_observation"
  | "reflection_generated"
  | "record_created"
  | "checkin_completed"
  | "observation_edited"
  | "next_checkin";

export interface TimelineEvent {
  id: string;
  /** Human date, e.g. "Mar 4, 2026". */
  date: string;
  /** ISO date for sorting / range filtering. */
  iso: string;
  type: TimelineEventType;
  title: string;
  description: string;
  /** True for the pending (future) next-check-in node. */
  pending?: boolean;
}

export interface ParticipantSummary {
  /** True once the participant has finished (record_saved) their first observation. */
  hasCompletedFirstObservation: boolean;
  /** The participant's single first observation (for editing / date display), if any. */
  firstObservation: { id: string; date: string | null; status: string } | null;
  stats: {
    firstObservationDate: string | null;
    latestObservationDate: string | null;
    totalAtlasRecords: number;
    streakLabel: string;
  };
  /** "Continue your journey" progress. null when nothing has been started. */
  progress: { percent: number; label: string; completed: boolean } | null;
  /** Latest reflection summary, for the dashboard reflection card. */
  reflection: { summary: string; burden: string | null; archetype: string | null } | null;
  /** "Your Dominant Pattern" card — the strongest pattern in the latest record. */
  dominantPattern: PatternSummary | null;
  /** "Supporting Patterns" card — everything else the latest record surfaced. */
  supportingPatterns: PatternSummary[];
  /** "Your Current Archetype" card. */
  archetype: ArchetypeSummary | null;
  /** Signal-evolution chart data derived from Atlas Record constellation scores. */
  signalDomains: string[];
  signalSeries: SignalSeriesPoint[];
  /** Per-domain sparkline + trend direction, for the Timeline page's domain chart. */
  signalTrends: SignalTrend[];
  /**
   * "Your Top Signals" — the named AIKB signals the latest record actually fired,
   * strongest first. Distinct from `signalTrends`, which is the six-domain
   * rollup computed from *patterns*, one layer of abstraction further up.
   */
  topSignals: SignalHighlight[];
  /** Journey events for the dashboard mini-timeline and the Timeline page. */
  timelineEvents: TimelineEvent[];
  /** Next check-in countdown. */
  nextCheckIn: { dueDate: string | null; daysRemaining: number | null; ready: boolean };
  /** "Your Contribution" card. */
  contribution: { atlasRecordsContributed: number; countriesRepresented: number };
  /** "Personal Insights" — grounded in the participant's own records. */
  personalInsights: string[];
  /** "Observatory Insights" — grounded "participants like you" observations. */
  observatoryInsights: string[];
  /** Life Stage Journey card, derived from the first observation's context answers. */
  lifeStage: LifeStage | null;
  /** Care Journey card. */
  careJourney: CareJourney | null;
  /** Trajectory Overview card. */
  trajectory: TrajectorySummary;
}

const LIFE_STAGE_BY_REPRODUCTIVE_STATE: Record<string, { stageKey: string; label: string }> = {
  regular_periods: { stageKey: "reproductive", label: "Reproductive Years" },
  irregular_periods: { stageKey: "reproductive", label: "Reproductive Years" },
  not_sure: { stageKey: "reproductive", label: "Reproductive Years" },
  pregnant: { stageKey: "pregnancy", label: "Pregnancy" },
  postpartum_12_months: { stageKey: "postpartum", label: "Postpartum" },
  perimenopause: { stageKey: "perimenopause", label: "Perimenopause" },
  postmenopausal: { stageKey: "menopause", label: "Menopause" },
};

const LIFE_STAGE_DESCRIPTION: Record<string, string> = {
  adolescence: "Atlas helps you understand how your experiences evolve through this stage and beyond.",
  reproductive: "Atlas helps you understand how your experiences evolve through this stage and beyond.",
  pregnancy: "Atlas is tracking your observations with pregnancy in mind.",
  postpartum: "Atlas is tracking your observations during your postpartum recovery.",
  perimenopause: "Atlas helps you track how your body's rhythm is shifting during this transition.",
  menopause: "Atlas helps you track your patterns beyond menstruation.",
};

type ConstellationScore = { domain: string; score: number; evidenceCount?: number };
type ObservedPatternGroup = { domain: string; signals: string[] };

function fmtLong(d: Date | null, locale?: string): string | null {
  if (!d) return null;
  return formatDateLong(d, locale);
}

function fmtMedium(d: Date, locale?: string): string {
  return formatDateMedium(d, locale);
}

function fmtShort(d: Date, locale?: string): string {
  return formatDateShort(d, locale);
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function trendDirection(series: number[]): TrendDirection {
  if (series.length < 2) return "baseline";
  const prev = series[series.length - 2];
  const curr = series[series.length - 1];
  if (curr > prev) return "increasing"; // higher score = more burden
  if (curr < prev) return "improving";
  return "stable";
}

function toScores(value: unknown): ConstellationScore[] {
  return Array.isArray(value) ? (value as ConstellationScore[]) : [];
}

function toObservedPatterns(value: unknown): ObservedPatternGroup[] {
  return Array.isArray(value) ? (value as ObservedPatternGroup[]) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(asString).filter(Boolean) : [];
}

function asConfidence(value: unknown): EvidenceConfidence | null {
  return isEvidenceConfidence(value) ? value : null;
}

/** One `ReflectionChamberPattern` → the card shape, or null if it carries no name. */
function toPatternSummary(value: unknown, locale?: string): PatternSummary | null {
  if (!isRecord(value)) return null;
  // `scientificName` is stored on the record as the raw, permanent registry
  // key (a matching key elsewhere, so the record itself never translates it)
  // — translated here, display-side only, the same way every other raw
  // pattern name is. When that translation lands on the same text as
  // `participantLabel`, the caption that shows it naturally hides itself
  // (see DominantPatternCard's `scientificName !== label` check) rather than
  // showing a redundant or untranslated clinical name.
  const rawScientificName = asString(value.scientificName);
  const scientificName = rawScientificName ? participantLabelFor(rawScientificName, locale) : rawScientificName;
  const label = asString(value.participantLabel) || scientificName;
  if (!label) return null;
  return {
    label,
    scientificName,
    whyThisMatters: asString(value.whyThisMatters),
    contributingFactors: asStrings(value.observedBecause),
    confidence: asConfidence(value.confidence),
  };
}

type SignalRow = { signalId: string; name: string; signalType: string };

/** The AIKB signals one record fired, deduped by register id. */
function readRecordSignals(record: { record_payload: unknown }): SignalRow[] {
  const payload = isRecord(record.record_payload) ? record.record_payload : null;
  if (!payload || !Array.isArray(payload.signals)) return [];
  const seen = new Map<string, SignalRow>();
  for (const raw of payload.signals) {
    if (!isRecord(raw)) continue;
    const signalId = asString(raw.signalId);
    const name = asString(raw.name);
    if (!signalId || !name || seen.has(signalId)) continue;
    seen.set(signalId, { signalId, name, signalType: asString(raw.domain) });
  }
  return [...seen.values()];
}

/**
 * How many observations support each signal, per observation id.
 *
 * `record_payload.signals` drops this — it keeps only id, name and domain — so
 * it comes from the audit rows the same pipeline run wrote. An observation can
 * be re-run (resume, edit, re-finalize), so only the newest run per observation
 * counts; older runs describe a record that is no longer on screen.
 *
 * Persisting the run is deliberately non-fatal in the intelligence route, so a
 * record can exist with no rows here. Callers treat a miss as 0 rather than
 * failing: an unranked signal still shows, it just can't claim strength.
 */
async function readSignalEvidence(observationIds: string[]): Promise<Map<string, Map<string, number>>> {
  if (!observationIds.length) return new Map();

  const runs = await prisma.atlasIntelligenceRun.findMany({
    where: { observationId: { in: observationIds } },
    orderBy: { createdAt: "asc" },
    select: { id: true, observationId: true },
  });
  const latestRunFor = new Map<string, string>();
  for (const run of runs) latestRunFor.set(run.observationId, run.id);
  const observationForRun = new Map([...latestRunFor].map(([obs, run]) => [run, obs]));

  const rows = await prisma.atlasSignalRow.findMany({
    where: { runId: { in: [...observationForRun.keys()] } },
    select: { runId: true, businessId: true, observationBusinessIds: true },
  });

  const byObservation = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const observationId = observationForRun.get(row.runId);
    if (!observationId) continue;
    if (!byObservation.has(observationId)) byObservation.set(observationId, new Map());
    byObservation
      .get(observationId)!
      .set(row.businessId, Array.isArray(row.observationBusinessIds) ? row.observationBusinessIds.length : 0);
  }
  return byObservation;
}

/**
 * Rank the signals the *latest* record fired, and say how each one has moved.
 *
 * "Top" is persistence first — a signal present in every record is the more
 * notable finding — then how many observations support it, then name so the
 * order is stable between renders.
 *
 * Two things are deliberately *not* used to rank. `payload.signals[].severity`
 * is written as the constant "moderate" by `api/observation/intelligence/route.ts`,
 * so ordering by it would look clinical while being arbitrary. The constellation
 * domain score is the other: it is averaged from *patterns*, and "Cycle" has no
 * ontology pattern feeding it, so ranking by domain would push every cycle
 * signal to the bottom no matter how well evidenced — the same blind spot that
 * made the six-domain rollup a poor stand-in for signals in the first place.
 *
 * Only signals present in the latest record are returned. A signal that has
 * stopped firing is real information, but it is not a *current* signal, and this
 * card is the participant's picture of now.
 */
function buildSignalHighlights(
  perRecord: { observationId: string; rows: SignalRow[] }[],
  evidence: Map<string, Map<string, number>>,
): SignalHighlight[] {
  const latest = perRecord.at(-1);
  if (!latest?.rows.length) return [];
  const presentIn = perRecord.map((r) => new Set(r.rows.map((row) => row.signalId)));
  const latestEvidence = evidence.get(latest.observationId);

  return latest.rows
    .map((row) => {
      const presence = presentIn.map((ids) => ids.has(row.signalId));
      const status: SignalStatus =
        perRecord.length < 2 ? "baseline" : presence.at(-2) ? "persistent" : "new";
      return {
        ...row,
        domain: signalTypeDomain(row.signalType),
        status,
        recordCount: presence.filter(Boolean).length,
        recordTotal: perRecord.length,
        evidenceCount: latestEvidence?.get(row.signalId) ?? 0,
        presence,
      };
    })
    .sort(
      (a, b) =>
        b.recordCount - a.recordCount ||
        b.evidenceCount - a.evidenceCount ||
        a.name.localeCompare(b.name),
    );
}

interface AtlasProfile {
  dominantPattern: PatternSummary | null;
  supportingPatterns: PatternSummary[];
  archetype: ArchetypeSummary | null;
}

/**
 * Read the dominant pattern, supporting patterns and archetype out of an Atlas
 * Record for the dashboard's three "core insight" cards.
 *
 * Preferred source is `record_payload.reflectionChamber` — the participant-facing
 * narrative layer, which is where the plain-language labels ("Daily life impact"
 * rather than "Daily Function"), the why-this-matters lines and the confidence
 * ladder live. Records finalized through the older deterministic path have no
 * payload, so we fall back to the curated `observed_patterns` /
 * `reflection_summary` columns: those carry names but no explanations and no
 * confidence, and the cards degrade to just the names rather than inventing the
 * missing prose.
 */
function readAtlasProfile(
  record: {
    record_payload: unknown;
    reflection_summary: unknown;
    observed_patterns: unknown;
  },
  locale?: string,
): AtlasProfile {
  const payload = isRecord(record.record_payload) ? record.record_payload : null;
  const chamber = payload && isRecord(payload.reflectionChamber) ? payload.reflectionChamber : null;

  if (chamber) {
    const chamberArchetype = isRecord(chamber.archetype) ? chamber.archetype : null;
    // Strength names live on the Atlas Record detail, not the chamber.
    const detail = payload && isRecord(payload.atlasRecordDetail) ? payload.atlasRecordDetail : null;
    const strengths = Array.isArray(detail?.strengths)
      ? (detail.strengths as unknown[])
          .filter(isRecord)
          .map((s) => ({ name: asString(s.name), label: asString(s.label) || asString(s.name) }))
          .filter((s) => s.name)
      : [];
    const name = asString(chamberArchetype?.name);
    return {
      dominantPattern: toPatternSummary(chamber.dominantPattern, locale),
      supportingPatterns: (Array.isArray(chamber.supportingPatterns) ? chamber.supportingPatterns : [])
        .map((p) => toPatternSummary(p, locale))
        .filter((p): p is PatternSummary => p !== null),
      archetype: name
        ? {
            name,
            coreTheme: asString(chamberArchetype?.coreTheme),
            whySelected: asString(chamberArchetype?.whySelected),
            confidence: asConfidence(chamberArchetype?.confidence),
            strengths,
            shapedByPatterns: asStrings(chamberArchetype?.shapedByPatterns),
          }
        : null,
    };
  }

  // Deterministic-path fallback: names only.
  const groups = toObservedPatterns(record.observed_patterns);
  const names = groups.flatMap((g) => g.signals ?? []).filter(Boolean);
  const bare = (label: string): PatternSummary => ({
    label,
    scientificName: label,
    whyThisMatters: "",
    contributingFactors: [],
    confidence: null,
  });
  const rs = isRecord(record.reflection_summary) ? record.reflection_summary : null;
  const archetypeName = asString(rs?.archetype);
  return {
    dominantPattern: names[0] ? bare(names[0]) : null,
    supportingPatterns: names.slice(1).map(bare),
    archetype: archetypeName
      ? {
          name: archetypeName,
          coreTheme: "",
          whySelected: "",
          confidence: null,
          strengths: [],
          shapedByPatterns: names.slice(0, 3),
        }
      : null,
  };
}

/**
 * Aggregate everything the participant dashboard needs from the participant's
 * real, recorded observations — replacing the previously hard-coded values.
 * A participant records exactly one "first observation"; check-ins add more
 * observations/records over time.
 */
export async function getParticipantSummary(userId: string, locale?: string): Promise<ParticipantSummary> {
  const observations = await prisma.observation.findMany({
    where: { userId },
    orderBy: { startedAt: "asc" },
    include: { atlasRecord: true },
  });

  const firstObs = observations.find((o) => o.flowKey === "first_observation") ?? null;
  const hasCompleted = observations.some(
    (o) => o.flowKey === "first_observation" && o.status === "record_saved",
  );

  // --- Dates ---
  const firstDate = firstObs ? firstObs.completedAt ?? firstObs.startedAt : null;
  const activityDates = observations
    .map((o) => o.completedAt ?? o.startedAt)
    .filter((d): d is Date => !!d);
  const latestDate = activityDates.length
    ? new Date(Math.max(...activityDates.map((d) => d.getTime())))
    : null;

  const recordObs = observations.filter((o) => o.atlasRecord);
  const totalAtlasRecords = recordObs.length;

  // --- Streak (months since first observation, a stable single-number proxy) ---
  let streakLabel = "—";
  if (firstDate) {
    const months = Math.max(
      1,
      Math.round((Date.now() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30)),
    );
    const monthWord = v43Text(
      "_template",
      months === 1 ? "streakMonthSingular" : "streakMonthPlural",
      months === 1 ? "Month" : "Months",
      locale,
    );
    streakLabel = `${months} ${monthWord}`;
  }

  // --- Progress (Continue Your Journey) ---
  let progress: ParticipantSummary["progress"] = null;
  if (firstObs) {
    if (hasCompleted) {
      progress = {
        percent: 100,
        label: v43Text("_template", "progressFirstObservationComplete", "First observation complete", locale),
        completed: true,
      };
    } else {
      const [answered, totalQuestions] = await Promise.all([
        prisma.observationResponse.count({ where: { observationId: firstObs.id } }),
        prisma.formQuestion.count({ where: { screen: { flowKey: "first_observation" } } }),
      ]);
      const percent = totalQuestions
        ? Math.min(95, Math.max(5, Math.round((answered / totalQuestions) * 100)))
        : 0;
      progress = {
        percent,
        label: v43Text("_template", "progressContinueFirstObservation", "Continue your first observation", locale),
        completed: false,
      };
    }
  }

  // --- Reflection (latest record that carries a reflection summary) ---
  const recordsWithReflection = observations.filter((o) => o.atlasRecord?.reflection_summary);
  const latestReflectionObs = recordsWithReflection.at(-1) ?? null;
  let reflection: ParticipantSummary["reflection"] = null;
  if (latestReflectionObs?.atlasRecord) {
    const rs = latestReflectionObs.atlasRecord.reflection_summary as {
      paragraphs?: string[];
      burden?: string;
      archetype?: string;
    } | null;
    const paragraphs = Array.isArray(rs?.paragraphs) ? rs!.paragraphs : [];
    reflection = {
      summary:
        paragraphs[0] ??
        v43Text(
          "_template",
          "reflectionSummaryFallback",
          "Your reflection is a summary of what you shared and what matters most to you.",
          locale,
        ),
      burden: latestReflectionObs.atlasRecord.burdenLevel ?? rs?.burden ?? null,
      archetype: rs?.archetype ?? null,
    };
  }

  // --- Dominant pattern / supporting patterns / archetype ---
  // From the most recent record that carries them. Check-ins re-run the whole
  // pipeline into a fresh record, so "most recent" is the current picture, not
  // the baseline one.
  const profile = recordObs
    .map((o) => readAtlasProfile(o.atlasRecord!, locale))
    .reverse()
    .find((p) => p.dominantPattern || p.archetype) ?? {
    dominantPattern: null,
    supportingPatterns: [],
    archetype: null,
  };

  // --- Signal evolution series from constellation scores over time ---
  const scoredObs = observations.filter((o) => o.atlasRecord?.constellation_scores);
  const signalSeries: SignalSeriesPoint[] = scoredObs.map((o) => {
    const scores = toScores(o.atlasRecord!.constellation_scores);
    const point: SignalSeriesPoint = { name: fmtShort(o.completedAt ?? o.startedAt, locale) };
    for (const domain of CONSTELLATION_DOMAINS) {
      point[domain] = scores.find((s) => s.domain === domain)?.score ?? 0;
    }
    return point;
  });
  const activeDomains = CONSTELLATION_DOMAINS.filter((d) =>
    signalSeries.some((p) => (p[d] as number) > 0),
  );
  const trendDomains = activeDomains.length ? activeDomains : [...CONSTELLATION_DOMAINS];
  const signalTrends: SignalTrend[] = trendDomains.map((domain) => {
    const series = signalSeries.map((p) => (p[domain] as number) ?? 0);
    return {
      domain,
      series,
      latest: series.at(-1) ?? 0,
      direction: trendDirection(series),
    };
  });

  // --- Top signals (the named AIKB register, not the six-domain rollup) ---
  // Records with no signal list are dropped rather than treated as empty: an
  // older record that predates the payload would otherwise make every current
  // signal look brand new.
  const signalsPerRecord = recordObs
    .map((o) => ({ observationId: o.id, rows: readRecordSignals(o.atlasRecord!) }))
    .filter((r) => r.rows.length > 0);
  const topSignals = buildSignalHighlights(
    signalsPerRecord,
    await readSignalEvidence(signalsPerRecord.map((r) => r.observationId)),
  );

  // --- Timeline events ---
  const timelineEvents: TimelineEvent[] = [];
  if (firstObs && firstDate) {
    timelineEvents.push({
      id: `${firstObs.id}-first`,
      date: fmtMedium(firstDate, locale),
      iso: firstDate.toISOString(),
      type: "first_observation",
      title: v43Text("_template", "timelineFirstObservationTitle", "First Observation", locale),
      description: v43Text("_template", "timelineFirstObservationDesc", "Your baseline observation", locale),
    });
  }
  // Every genuine re-completion of the first observation (editing it after it
  // was already saved) is logged to AuditLog (see api/observation/route.ts) and
  // becomes its own timeline event, positioned at the real edit time — one row
  // per edit, so a second edit doesn't overwrite/move the first one's entry the
  // way a single mutable timestamp would. The "First Observation" entry above
  // never moves, since completedAt is frozen at first completion.
  if (firstObs) {
    const edits = await prisma.auditLog.findMany({
      where: { entityType: "Observation", entityId: firstObs.id, actionType: "UPDATE" },
      orderBy: { timestamp: "asc" },
    });
    for (const edit of edits) {
      timelineEvents.push({
        id: `${edit.id}-edited`,
        date: fmtMedium(edit.timestamp, locale),
        iso: edit.timestamp.toISOString(),
        type: "observation_edited",
        title: v43Text("_template", "timelineObservationEditedTitle", "Observation Edited", locale),
        description: v43Text(
          "_template",
          "timelineObservationEditedDesc",
          "Your first observation was updated",
          locale,
        ),
      });
    }
  }
  let firstRecordSeen = false;
  for (const o of recordObs) {
    const created = o.atlasRecord!.createdAt;
    const patternCount = toObservedPatterns(o.atlasRecord!.observed_patterns).length;
    if (o.flowKey === "atlas_checkin") {
      timelineEvents.push({
        id: `${o.id}-checkin`,
        date: fmtMedium(created, locale),
        iso: created.toISOString(),
        type: "checkin_completed",
        title: v43Text("_template", "timelineCheckinCompletedTitle", "Check-In Completed", locale),
        description: v43Text(
          "_template",
          "timelineCheckinCompletedDesc",
          "Updates added to your timeline",
          locale,
        ),
      });
    } else {
      if (!firstRecordSeen) {
        timelineEvents.push({
          id: `${o.id}-reflection`,
          date: fmtMedium(created, locale),
          iso: created.toISOString(),
          type: "reflection_generated",
          title: v43Text("_template", "timelineReflectionGeneratedTitle", "Reflection Generated", locale),
          description: patternCount
            ? `${patternCount} ${v43Text("_template", "timelineKeyThemesIdentified", "key themes identified", locale)}`
            : v43Text("_template", "timelineReflectionReady", "Your reflection is ready", locale),
        });
        firstRecordSeen = true;
      }
      timelineEvents.push({
        id: `${o.id}-record`,
        date: fmtMedium(created, locale),
        iso: created.toISOString(),
        type: "record_created",
        title: v43Text("_template", "timelineRecordCreatedTitle", "Atlas Record Created", locale),
        description: v43Text("_template", "timelineRecordCreatedDesc", "Record is ready for review", locale),
      });
    }
  }
  timelineEvents.sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime());

  // --- Next check-in ---
  let nextCheckIn: ParticipantSummary["nextCheckIn"] = { dueDate: null, daysRemaining: null, ready: true };
  if (latestDate && totalAtlasRecords > 0) {
    const due = new Date(latestDate.getTime() + CHECKIN_INTERVAL_DAYS * 24 * 60 * 60 * 1000);
    const remaining = Math.max(0, daysBetween(due, new Date()));
    nextCheckIn = { dueDate: fmtLong(due, locale), daysRemaining: remaining, ready: remaining <= 0 };
    timelineEvents.push({
      id: "next-checkin",
      date: fmtMedium(due, locale),
      iso: due.toISOString(),
      type: "next_checkin",
      title: v43Text("_template", "timelineNextCheckinTitle", "Next Check-In", locale),
      description: nextCheckIn.ready
        ? v43Text("_template", "timelineReadyWheneverYouAre", "You're ready whenever you are", locale)
        : v43Text("_template", "timelineYouWillBeReminded", "You will be reminded", locale),
      pending: true,
    });
  }

  // --- Contribution (records = this participant; countries = whole movement) ---
  const countryRows = await prisma.participantContext.findMany({
    where: { current_country: { not: null } },
    select: { current_country: true },
    distinct: ["current_country"],
  });
  const countriesRepresented = countryRows.filter((r) => (r.current_country ?? "").trim()).length;

  // --- Personal insights (consecutive-appearance of a domain over records) ---
  const personalInsights: string[] = [];
  if (signalSeries.length >= 2) {
    for (const domain of trendDomains) {
      let streak = 0;
      for (let i = signalSeries.length - 1; i >= 0; i -= 1) {
        if ((signalSeries[i][domain] as number) > 0) streak += 1;
        else break;
      }
      if (streak >= 2) {
        personalInsights.push(
          `${v43Text("_template", "personalInsightStreakLead", "Your", locale)} ${domainLabel(domain, locale)} ${v43Text(
            "_template",
            "personalInsightStreakMid",
            "signal has appeared in",
            locale,
          )} ${streak} ${v43Text("_template", "personalInsightStreakSuffix", "consecutive observations.", locale)}`,
        );
      }
    }
  }
  if (reflection?.summary && personalInsights.length < 2) {
    personalInsights.push(reflection.summary);
  }
  if (personalInsights.length === 0) {
    personalInsights.push(
      v43Text(
        "_template",
        "personalInsightEmptyFallback",
        "Your first Atlas Record is ready — insights deepen with each check-in you add.",
        locale,
      ),
    );
  }

  // --- Observatory insights (grounded to the dominant domain) ---
  const observatoryInsights: string[] = [];
  const dominantDomain = signalTrends.slice().sort((a, b) => b.latest - a.latest)[0]?.domain;
  if (dominantDomain && signalSeries.length > 0) {
    const domainId = DOMAIN_TRANSLATION_ID[dominantDomain];
    const companion = domainId
      ? v43Text(domainId, "companionPhrase", DOMAIN_COMPANION[dominantDomain] ?? "related changes over time", locale)
      : v43Text("_template", "observatoryInsightGenericCompanion", "related changes over time", locale);
    observatoryInsights.push(
      `${v43Text("_template", "observatoryInsightLead", "Participants tracking similar", locale)} ${domainLabel(dominantDomain, locale)} ${v43Text(
        "_template",
        "observatoryInsightMid",
        "patterns often also note",
        locale,
      )} ${companion}.`,
    );
    observatoryInsights.push(
      v43Text(
        "_template",
        "observatoryInsightComparingHelps",
        "Comparing your record with the wider observatory helps surface what to keep watching.",
        locale,
      ),
    );
  } else {
    observatoryInsights.push(
      v43Text(
        "_template",
        "observatoryInsightEmptyFallback",
        "Once your first Atlas Record is generated, you'll see how your patterns relate to the wider observatory.",
        locale,
      ),
    );
  }

  // --- Life Stage Journey (from the first observation's context answers) ---
  const [context, care] = firstObs
    ? await Promise.all([
        prisma.participantContext.findUnique({
          where: { observationId: firstObs.id },
          select: { age_range: true, reproductive_state: true },
        }),
        prisma.careAccess.findUnique({
          where: { observationId: firstObs.id },
          select: { spoken_to_provider: true },
        }),
      ])
    : [null, null];

  const lifeStageText = (stageKey: string, label: string): { label: string; description: string } => ({
    label: v43Text(`life_stage_${stageKey}`, "label", label, locale),
    description: v43Text(`life_stage_${stageKey}`, "description", LIFE_STAGE_DESCRIPTION[stageKey], locale),
  });

  let lifeStage: LifeStage | null = null;
  if (context?.age_range === "under_18") {
    lifeStage = { stageKey: "adolescence", ...lifeStageText("adolescence", "Adolescence") };
  } else if (context?.reproductive_state) {
    const mapped = LIFE_STAGE_BY_REPRODUCTIVE_STATE[context.reproductive_state];
    if (mapped) {
      lifeStage = { stageKey: mapped.stageKey, ...lifeStageText(mapped.stageKey, mapped.label) };
    }
  }

  // --- Care Journey (phases derived from real state; avoids diagnostic framing) ---
  const checkinsCompleted = timelineEvents.filter((e) => e.type === "checkin_completed").length;
  const CARE_PHASE_DESCRIPTION: Record<string, string> = {
    observation: "Begin your first observation to start your Atlas journey.",
    care_outreach: "Your care outreach is part of your record.",
    atlas_record: "Your baseline Atlas Record is ready. Check in over time to track how things evolve.",
    check_ins: "Your check-ins are adding to your longitudinal picture.",
    monitoring: "You're in ongoing monitoring — Atlas keeps building your picture with each check-in.",
  };
  const carePhaseLabel = (key: string, label: string): string =>
    v43Text(`care_phase_${key}`, "label", label, locale);
  const carePhaseDescription = (key: string): string =>
    v43Text(`care_phase_${key}`, "description", CARE_PHASE_DESCRIPTION[key], locale);
  let careJourney: CareJourney | null = null;
  if (firstObs) {
    const phases: CareJourneyPhase[] = [
      { key: "observation", label: carePhaseLabel("observation", "First Observation"), done: true },
      { key: "care_outreach", label: carePhaseLabel("care_outreach", "Care Outreach"), done: !!care?.spoken_to_provider },
      { key: "atlas_record", label: carePhaseLabel("atlas_record", "Atlas Record"), done: totalAtlasRecords > 0 },
      { key: "check_ins", label: carePhaseLabel("check_ins", "Ongoing Check-Ins"), done: checkinsCompleted > 0 },
      { key: "monitoring", label: carePhaseLabel("monitoring", "Continued Monitoring"), done: totalAtlasRecords > 0 },
    ];
    const currentPhase = phases.filter((p) => p.done).at(-1) ?? phases[0];
    careJourney = {
      phases,
      currentLabel: currentPhase.label,
      description: carePhaseDescription(currentPhase.key),
    };
  }

  // --- Trajectory Overview (aggregated from the data already computed above) ---
  const activeTrends = signalTrends.filter((t) => t.latest > 0);
  const sortedByLatest = [...activeTrends].sort((a, b) => b.latest - a.latest);
  const improvingCount = signalTrends.filter((t) => t.direction === "improving").length;
  const increasingCount = signalTrends.filter((t) => t.direction === "increasing").length;
  const trajectory: TrajectorySummary = {
    observationsTotal: (firstObs ? 1 : 0) + checkinsCompleted,
    checkinsCompleted,
    domainsTracked: activeTrends.length,
    mostImpacted: sortedByLatest.slice(0, 2).map((t) => t.domain),
    stillTracking: sortedByLatest.slice(2).map((t) => t.domain),
    overallTrend: improvingCount > increasingCount ? "improving" : increasingCount > improvingCount ? "needs_attention" : "stable",
  };

  return {
    hasCompletedFirstObservation: hasCompleted,
    firstObservation: firstObs
      ? { id: firstObs.id, date: fmtLong(firstDate, locale), status: firstObs.status }
      : null,
    stats: {
      firstObservationDate: fmtLong(firstDate, locale),
      latestObservationDate: fmtLong(latestDate, locale),
      totalAtlasRecords,
      streakLabel,
    },
    progress,
    reflection,
    dominantPattern: profile.dominantPattern,
    supportingPatterns: profile.supportingPatterns,
    archetype: profile.archetype,
    signalDomains: trendDomains,
    signalSeries,
    signalTrends,
    topSignals,
    timelineEvents,
    nextCheckIn,
    contribution: { atlasRecordsContributed: totalAtlasRecords, countriesRepresented },
    personalInsights: personalInsights.slice(0, 3),
    observatoryInsights: observatoryInsights.slice(0, 2),
    lifeStage,
    careJourney,
    trajectory,
  };
}

export interface ParticipantRecordListItem {
  observationId: string;
  recordId: string;
  flowKey: string;
  createdAt: string;
  createdAtIso: string;
  burden: string | null;
  archetype: string | null;
  signalCount: number;
  summary: string | null;
  /** Rich UI payload (RecordResult-shaped) when the intelligence pipeline persisted it. */
  recordPayload: unknown | null;
  /** Fallbacks when record_payload is absent (deterministic finalize path). */
  constellationScores: ConstellationScore[];
  observedPatterns: ObservedPatternGroup[];
}

/** Short human record id derived from the observation, e.g. "AR-2026-06-A1B2". */
function deriveRecordId(createdAt: Date, observationId: string): string {
  const y = createdAt.getFullYear();
  const m = String(createdAt.getMonth() + 1).padStart(2, "0");
  return `AR-${y}-${m}-${observationId.slice(-4).toUpperCase()}`;
}

/**
 * The participant's Atlas Records, newest first, with the rich read-model
 * (record_payload) the Records + Reflections pages render. Falls back to the
 * curated summary fields for records finalized via the deterministic path.
 */
export async function getParticipantRecords(userId: string, locale?: string): Promise<ParticipantRecordListItem[]> {
  const observations = await prisma.observation.findMany({
    where: { userId, atlasRecord: { isNot: null } },
    include: { atlasRecord: true },
    orderBy: { startedAt: "asc" },
  });

  const items = observations
    .filter((o) => o.atlasRecord)
    .map((o) => {
      const ar = o.atlasRecord!;
      const rs = ar.reflection_summary as { paragraphs?: string[]; archetype?: string } | null;
      const observedPatterns = toObservedPatterns(ar.observed_patterns);
      const scores = toScores(ar.constellation_scores);
      const signalCount =
        observedPatterns.reduce((n, g) => n + (g.signals?.length ?? 0), 0) ||
        scores.filter((s) => s.score > 0).length;
      return {
        observationId: o.id,
        recordId: deriveRecordId(ar.createdAt, o.id),
        flowKey: o.flowKey,
        createdAt: fmtLong(ar.createdAt, locale) ?? "",
        createdAtIso: ar.createdAt.toISOString(),
        burden: ar.burdenLevel ?? null,
        archetype: rs?.archetype ?? null,
        signalCount,
        summary: Array.isArray(rs?.paragraphs) ? rs!.paragraphs[0] ?? null : null,
        recordPayload: ar.record_payload ?? null,
        constellationScores: scores,
        observedPatterns,
      };
    });

  // Newest first.
  return items.sort(
    (a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime(),
  );
}
