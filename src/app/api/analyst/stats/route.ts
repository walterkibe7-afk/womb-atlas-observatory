import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// =====================================================================
// Analyst "Atlas Intelligence" dashboard stats.
//
// The top-line counters were already live. This route now also derives
// the four dashboard sections that the v5 Atlas Intelligence run tables
// make computable:
//   1. Pattern Intelligence   <- AtlasPatternRow  (grouped by pattern name)
//   2. Trajectory Intelligence<- AtlasSignalRow   (daily buckets, 7 days)
//   3. Signal Relationships   <- AtlasSignalRow   (per-run co-occurrence)
//   7. Emerging Expressions   <- AtlasObservationRow (7d vs prior-7d growth)
//
//   5. Atlas Trajectories    <- care/daily-life fields (prevalence funnel)
//   6. Atlas Questions       <- rising trajectory signals (templated)
//
// Sections 5 and 6 are deterministic, not mined: the journey funnel counts
// distinct participants per care-pathway stage from real collected fields,
// and the questions are templated from the strongest-moving signals with
// real co-occurrence/women counts. Every section returns `[]`/`null` when
// there's no data, so the client falls back to its illustrative placeholders.
// =====================================================================

const DAY = 24 * 60 * 60 * 1000;

type Trend = "up" | "down" | "neutral";

/** Percent change (one decimal). Treats "0 -> something" as +100%. */
function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function trendOf(delta: number): Trend {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "neutral";
}

/** "▲ 14%" / "▼ 7%" / "No change" from a signed percent. */
function arrowPct(pct: number): string {
  if (pct > 0) return `▲ ${Math.abs(pct)}%`;
  if (pct < 0) return `▼ ${Math.abs(pct)}%`;
  return "No change";
}

const languageDisplay = new Intl.DisplayNames(["en"], { type: "language" });
const regionDisplay = new Intl.DisplayNames(["en"], { type: "region" });

/** "en-US"/"sw" -> "English"/"Swahili"; falls back to the title-cased raw value. */
function languageName(raw: string): string {
  const v = raw.trim();
  const base = v.split(/[-_]/)[0].toLowerCase();
  try {
    const name = languageDisplay.of(base);
    if (name && name.toLowerCase() !== base) return name;
  } catch {
    /* not a recognized language subtag */
  }
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : v;
}

/** ISO alpha-2 country code -> display name (e.g. "KE" -> "Kenya"). */
function countryName(code: string): string {
  const c = code.trim().toUpperCase();
  try {
    const name = regionDisplay.of(c);
    if (name && name !== c) return name;
  } catch {
    /* not a recognized region code */
  }
  return code;
}

// Display labels for the Atlas Trajectories journey bullets.
const AGE_LABELS: Record<string, string> = {
  under_18: "under 18",
  "18_24": "18–24",
  "25_34": "25–34",
  "35_44": "35–44",
  "45_54": "45–54",
  "55_or_older": "55+",
};
const DURATION_LABELS: Record<string, string> = {
  less_than_3_months: "less than 3 months",
  "3_12_months": "3–12 months",
  "1_3_years": "1–3 years",
  more_than_3_years: "more than 3 years",
};

/** Most frequent key in a count map, or undefined when empty. */
function modalKey(counts: Map<string, number>): string | undefined {
  let best: string | undefined;
  let bestN = -1;
  for (const [k, n] of counts) {
    if (n > bestN) {
      best = k;
      bestN = n;
    }
  }
  return best;
}

/** Trim narrative text to a short, quoted snippet for display. */
function snippetFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const capped = clean.length > 90 ? `${clean.slice(0, 87)}…` : clean;
  return `“${capped}”`;
}

/** Split timestamps into the current window vs the equal-length window before it. */
function windowCounts(dates: Date[], currStartMs: number, prevStartMs: number) {
  let curr = 0;
  let prev = 0;
  for (const d of dates) {
    const t = d.getTime();
    if (t >= currStartMs) curr++;
    else if (t >= prevStartMs) prev++;
  }
  return { curr, prev };
}

type TrajectoryItem = {
  name: string;
  trend: number[];
  total: number;
  change: string;
  direction: "Increasing" | "Decreasing";
};

/**
 * Bucket signal occurrences into 7 evenly-sized time slices and rank the top
 * movers. `items` are {label, at(ms)} pairs; the shared `bucketBase`/`bucketSize`
 * keep every region on the same time axis. Direction compares the recent third
 * (buckets 4–6) against the older third (buckets 0–2). Returns the top 6.
 */
function buildTrajectory(
  items: { label: string; at: number }[],
  bucketBase: number,
  bucketSize: number,
): TrajectoryItem[] {
  const agg = new Map<string, number[]>();
  for (const s of items) {
    const idx = Math.min(6, Math.floor((s.at - bucketBase) / bucketSize));
    if (idx < 0) continue;
    let b = agg.get(s.label);
    if (!b) {
      b = [0, 0, 0, 0, 0, 0, 0];
      agg.set(s.label, b);
    }
    b[idx]++;
  }
  return [...agg.entries()]
    .map(([name, trend]) => {
      const older = trend[0] + trend[1] + trend[2];
      const recent = trend[4] + trend[5] + trend[6];
      const pct = pctChange(recent, older);
      return {
        name,
        trend,
        total: trend.reduce((a, b) => a + b, 0),
        change: arrowPct(pct),
        direction: (pct >= 0 ? "Increasing" : "Decreasing") as "Increasing" | "Decreasing",
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
}

// Supported values for the header date-range filter.
const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

export async function GET(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session || (role !== "analyst" && role !== "admin")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ─── Time range filter (header chip): 7d | 30d | 90d | all ─────────
  // Every windowed section is scoped to this period; growth/deltas compare it
  // against the equal-length window immediately before it. "all" drops the
  // window (everything in scope) and reports growth as neutral.
  const rangeParam = new URL(req.url).searchParams.get("range") ?? "90d";
  const range = rangeParam === "all" || rangeParam in RANGE_DAYS ? rangeParam : "90d";
  const isAll = range === "all";
  const periodDays = isAll ? 0 : RANGE_DAYS[range];
  const periodLabel = isAll ? "all time" : `${periodDays} days`;

  const now = Date.now();
  const periodMs = periodDays * DAY;
  const currStartMs = isAll ? 0 : now - periodMs;
  const prevStartMs = isAll ? 0 : now - 2 * periodMs;
  const periodStart = new Date(currStartMs); // "within this period"
  const prevPeriodStart = new Date(prevStartMs); // includes the comparison window

  // Growth arrow for the selected period; neutral when there's no prior window.
  const growthArrow = (curr: number, prev: number) =>
    isAll ? "No change" : arrowPct(pctChange(curr, prev));

  const [
    totalContributors,
    atlasRecords,
    observations,
    signals,
    regionsRaw,
    usersWithMultipleObs,
    totalUsersWithObs,
    // ---- delta sources (timestamps only) --------------------------
    contributorDates,
    recordDates,
    observationDates,
    signalRowDates,
    // ---- section sources -----------------------------------------
    patternRows,
    signalRows,
    observationRows,
    runRegions,
    narrativeRows,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "participant" } }),
    prisma.atlasRecord.count(),
    prisma.observation.count(),
    prisma.signal.count(),
    prisma.participantContext.findMany({
      where: { current_country: { not: null } },
      select: { current_country: true },
      distinct: ["current_country"],
    }),
    prisma.observation.groupBy({
      by: ["userId"],
      _count: { id: true },
      having: { id: { _count: { gt: 1 } } },
    }),
    prisma.observation.groupBy({
      by: ["userId"],
      _count: { id: true },
    }),
    // delta sources (current window + the comparison window before it)
    prisma.user.findMany({
      where: { role: "participant", createdAt: { gte: prevPeriodStart } },
      select: { createdAt: true },
    }),
    prisma.atlasRecord.findMany({
      where: { createdAt: { gte: prevPeriodStart } },
      select: { createdAt: true },
    }),
    prisma.observation.findMany({
      where: { startedAt: { gte: prevPeriodStart } },
      select: { startedAt: true },
    }),
    prisma.atlasSignalRow.findMany({
      where: { createdAt: { gte: prevPeriodStart } },
      select: { createdAt: true },
    }),
    // section sources — patterns scoped to the selected period
    prisma.atlasPatternRow.findMany({
      where: { createdAt: { gte: periodStart } },
      select: {
        name: true,
        domain: true,
        meaning: true,
        observationConfidence: true,
        createdAt: true,
        run: { select: { userId: true } },
      },
    }),
    // In-period signals — drive trajectories, relationships, and the distinct
    // women / co-occurrence counts behind Atlas Questions.
    prisma.atlasSignalRow.findMany({
      where: { createdAt: { gte: periodStart } },
      select: {
        runId: true,
        label: true,
        createdAt: true,
        run: {
          select: {
            userId: true,
            observation: { select: { context: { select: { current_country: true } } } },
          },
        },
      },
    }),
    prisma.atlasObservationRow.findMany({
      where: { createdAt: { gte: prevPeriodStart } },
      select: { runId: true, label: true, createdAt: true },
    }),
    // country per run for regional spread of emerging expressions
    prisma.atlasIntelligenceRun.findMany({
      where: { createdAt: { gte: prevPeriodStart } },
      select: {
        id: true,
        observation: { select: { context: { select: { current_country: true } } } },
      },
    }),
    // narratives + their language/region for the Language Observatory
    prisma.narrative.findMany({
      select: {
        language: true,
        textResponse: true,
        transcription: true,
        observation: {
          select: {
            startedAt: true,
            context: { select: { preferred_language: true, current_country: true } },
          },
        },
      },
    }),
  ]);

  const regionsActive = regionsRaw.length;
  const repeatRate =
    totalUsersWithObs.length > 0
      ? Math.round((usersWithMultipleObs.length / totalUsersWithObs.length) * 100)
      : 0;

  // ─── Top-stat deltas (period vs the equal window before it) ───────
  const contribW = windowCounts(contributorDates.map((r) => r.createdAt), currStartMs, prevStartMs);
  const recordW = windowCounts(recordDates.map((r) => r.createdAt), currStartMs, prevStartMs);
  const obsW = windowCounts(observationDates.map((r) => r.startedAt), currStartMs, prevStartMs);
  const sigW = windowCounts(signalRowDates.map((r) => r.createdAt), currStartMs, prevStartMs);

  const mkDelta = (w: { curr: number; prev: number }) => {
    if (isAll) return { pct: 0, trend: "neutral" as Trend, label: "over all time" };
    const pct = pctChange(w.curr, w.prev);
    return { pct, trend: trendOf(pct), label: `${arrowPct(pct)} vs previous ${periodLabel}` };
  };

  const deltas = {
    totalContributors: mkDelta(contribW),
    atlasRecords: mkDelta(recordW),
    observations: mkDelta(obsW),
    signals: mkDelta(sigW),
    regionsActive: { pct: 0, trend: "neutral" as Trend, label: "No change" },
    repeatRate: { pct: 0, trend: "neutral" as Trend, label: "Rolling 90-day rate" },
  };

  // ─── 1. Pattern Intelligence ──────────────────────────────────────
  // Group persisted patterns by name; count distinct women; growth =
  // distinct women in last 7d vs prior 7d.
  const patternAgg = new Map<
    string,
    {
      domain: string;
      meaning: string;
      women: Set<string>;
      currWomen: Set<string>;
      prevWomen: Set<string>;
    }
  >();
  for (const p of patternRows) {
    const uid = p.run?.userId ?? "";
    let a = patternAgg.get(p.name);
    if (!a) {
      a = { domain: p.domain, meaning: p.meaning, women: new Set(), currWomen: new Set(), prevWomen: new Set() };
      patternAgg.set(p.name, a);
    }
    if (uid) {
      a.women.add(uid);
      const t = p.createdAt.getTime();
      if (t >= currStartMs) a.currWomen.add(uid);
      else if (t >= prevStartMs) a.prevWomen.add(uid);
    }
  }
  const patterns = [...patternAgg.entries()]
    .map(([name, a]) => {
      return {
        name,
        domain: a.domain,
        description: a.meaning,
        count: a.women.size.toLocaleString(),
        countRaw: a.women.size,
        change: growthArrow(a.currWomen.size, a.prevWomen.size),
      };
    })
    .sort((x, y) => y.countRaw - x.countRaw)
    .slice(0, 6);

  // ─── 2. Trajectory Intelligence ───────────────────────────────────
  // 7 evenly-sized buckets spanning the selected period; direction from
  // recent vs older thirds of the window. For "all time" the span runs from
  // the earliest in-scope signal to now.
  const bucketBase = isAll
    ? signalRows.reduce((min, s) => Math.min(min, s.createdAt.getTime()), now)
    : currStartMs;
  const bucketSize = Math.max((now - bucketBase) / 7, 1);
  const trajectory = buildTrajectory(
    signalRows.map((s) => ({ label: s.label, at: s.createdAt.getTime() })),
    bucketBase,
    bucketSize,
  );

  // Signals grouped by the contributor's country — drives the Trajectory card's
  // Region filter. "Region" here is a country (same definition as Regions
  // Active / Emerging regions). The legacy branch below re-points this at the
  // legacy signals when the v5 run tables are empty.
  let trajCountryItems = new Map<string, { label: string; at: number }[]>();
  for (const s of signalRows) {
    const country = s.run?.observation?.context?.current_country;
    if (!country) continue;
    let arr = trajCountryItems.get(country);
    if (!arr) {
      arr = [];
      trajCountryItems.set(country, arr);
    }
    arr.push({ label: s.label, at: s.createdAt.getTime() });
  }

  // ─── 3. Meaning & Signal Relationships ────────────────────────────
  // Per-run co-occurrence: pick the most frequent signal as the hub,
  // then rank co-occurring signals by strength = co-occurrence / hubFreq.
  const runLabels = new Map<string, Set<string>>();
  const freq = new Map<string, number>();
  for (const s of signalRows) {
    let set = runLabels.get(s.runId);
    if (!set) {
      set = new Set();
      runLabels.set(s.runId, set);
    }
    if (!set.has(s.label)) {
      set.add(s.label);
      freq.set(s.label, (freq.get(s.label) ?? 0) + 1);
    }
  }
  // Distinct participants per signal label, and the set of labels each label
  // co-occurs with (both feed the Atlas Questions section below). Scoped to the
  // selected period, reusing the in-period signals and co-occurrence sets.
  const womenBySignal = new Map<string, Set<string>>();
  for (const s of signalRows) {
    const uid = s.run?.userId;
    if (!uid) continue;
    let set = womenBySignal.get(s.label);
    if (!set) {
      set = new Set();
      womenBySignal.set(s.label, set);
    }
    set.add(uid);
  }
  const relatedBySignal = new Map<string, Set<string>>();
  for (const set of runLabels.values()) {
    const labels = [...set];
    for (const l of labels) {
      let r = relatedBySignal.get(l);
      if (!r) {
        r = new Set();
        relatedBySignal.set(l, r);
      }
      for (const o of labels) if (o !== l) r.add(o);
    }
  }

  let relationships: {
    central: string;
    nodes: { name: string; strength: number; size: number }[];
  } | null = null;
  if (freq.size > 1) {
    const central = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const hubFreq = freq.get(central) ?? 1;
    const cooc = new Map<string, number>();
    for (const set of runLabels.values()) {
      if (!set.has(central)) continue;
      for (const label of set) {
        if (label === central) continue;
        cooc.set(label, (cooc.get(label) ?? 0) + 1);
      }
    }
    const maxFreq = Math.max(...[...freq.values()]);
    const nodes = [...cooc.entries()]
      .map(([name, c]) => ({
        name,
        strength: Math.round((c / hubFreq) * 100) / 100,
        size: Math.round(20 + ((freq.get(name) ?? 0) / maxFreq) * 20),
      }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 7);
    if (nodes.length > 0) relationships = { central, nodes };
  }

  // ─── 7. Emerging Expressions & Signals ────────────────────────────
  // Observation labels rising fastest (this period vs the one before it),
  // with the number of distinct regions (countries) they appear in.
  const runCountry = new Map<string, string>();
  for (const r of runRegions) {
    const c = r.observation?.context?.current_country;
    if (c) runCountry.set(r.id, c);
  }
  const emergeAgg = new Map<
    string,
    { curr: number; prev: number; regions: Set<string> }
  >();
  for (const o of observationRows) {
    let a = emergeAgg.get(o.label);
    if (!a) {
      a = { curr: 0, prev: 0, regions: new Set() };
      emergeAgg.set(o.label, a);
    }
    const t = o.createdAt.getTime();
    if (t >= currStartMs) {
      a.curr++;
      const c = runCountry.get(o.runId);
      if (c) a.regions.add(c);
    } else if (t >= prevStartMs) {
      a.prev++;
    }
  }
  const emerging = [...emergeAgg.entries()]
    .map(([expression, a]) => ({
      expression,
      regions: a.regions.size,
      mentions: a.curr.toLocaleString(),
      mentionsRaw: a.curr,
      changePct: pctChange(a.curr, a.prev),
      change: growthArrow(a.curr, a.prev),
    }))
    .filter((e) => e.mentionsRaw > 0)
    .sort((a, b) => b.changePct - a.changePct || b.mentionsRaw - a.mentionsRaw)
    .slice(0, 5);

  // ─── 4. Language Observatory ──────────────────────────────────────
  // How participants describe experiences across languages. Language from
  // Narrative.language (STT/typed), falling back to the declared
  // preferred_language; region = the most common country for that language;
  // "phrases" = a real short narrative snippet; trend = 7d vs prior 7d.
  type LangAgg = {
    usage: number;
    curr: number;
    prev: number;
    countries: Map<string, number>;
    snippet: string;
    snippetLen: number;
  };
  const langAgg = new Map<string, LangAgg>();
  for (const n of narrativeRows) {
    const rawLang = (n.language && n.language !== "und" ? n.language : "") ||
      n.observation?.context?.preferred_language ||
      "";
    if (!rawLang) continue;
    const text = (n.transcription || n.textResponse || "").trim();
    if (!text) continue;

    // Current period drives usage/snippet/region; the window before it is kept
    // only for the trend. Anything older is out of scope (except "all time").
    const t = n.observation?.startedAt?.getTime() ?? 0;
    const inCurr = isAll || t >= currStartMs;
    const inPrev = !isAll && t >= prevStartMs && t < currStartMs;
    if (!inCurr && !inPrev) continue;

    const key = languageName(rawLang);
    let a = langAgg.get(key);
    if (!a) {
      a = { usage: 0, curr: 0, prev: 0, countries: new Map(), snippet: "", snippetLen: Infinity };
      langAgg.set(key, a);
    }
    if (!inCurr) {
      a.prev++;
      continue;
    }
    a.usage++;
    a.curr++;

    const country = n.observation?.context?.current_country;
    if (country) a.countries.set(country, (a.countries.get(country) ?? 0) + 1);

    // Prefer a short, substantive snippet (>= 12 chars) as the representative phrase.
    if (text.length >= 12 && text.length < a.snippetLen) {
      a.snippet = text;
      a.snippetLen = text.length;
    } else if (!a.snippet) {
      a.snippet = text;
    }
  }
  const languages = [...langAgg.entries()]
    .map(([language, a]) => {
      const topCountry = [...a.countries.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
      return {
        language,
        region: topCountry ? countryName(topCountry) : "—",
        phrases: a.snippet ? snippetFrom(a.snippet) : "",
        usage: a.usage.toLocaleString(),
        usageRaw: a.usage,
        trend: growthArrow(a.curr, a.prev),
      };
    })
    .filter((l) => l.usageRaw > 0)
    .sort((a, b) => b.usageRaw - a.usageRaw)
    .slice(0, 5);

  // ─── Legacy fallback (pre-v5 pipeline) ────────────────────────────
  // The v5 run tables above are the preferred source, but older records
  // were written by the pre-v5 pipeline into `Signal` + `AtlasRecord`.
  // For any section the run tables can't fill, derive it from those
  // populated tables so the dashboard reflects whatever the DB holds.
  let patternsOut = patterns;
  let trajectoryOut = trajectory;
  let relationshipsOut = relationships;
  let emergingOut = emerging;

  if (patterns.length === 0 || trajectory.length === 0 || !relationships || emerging.length === 0) {
    const [legacyRecords, legacySignals] = await Promise.all([
      prisma.atlasRecord.findMany({
        select: {
          createdAt: true,
          observed_patterns: true,
          observation: { select: { userId: true } },
        },
      }),
      prisma.signal.findMany({
        select: {
          signalId: true,
          domain: true,
          observationId: true,
          observation: {
            select: {
              userId: true,
              startedAt: true,
              context: { select: { current_country: true } },
            },
          },
        },
      }),
    ]);

    // When the v5 run tables are empty, mirror the women/related maps from the
    // legacy Signal table (keyed by domain, matching legacy trajectory labels)
    // so Atlas Questions can still render real counts.
    if (womenBySignal.size === 0) {
      const legacyRunLabels = new Map<string, Set<string>>();
      for (const s of legacySignals) {
        const uid = s.observation?.userId;
        if (uid) {
          let set = womenBySignal.get(s.domain);
          if (!set) {
            set = new Set();
            womenBySignal.set(s.domain, set);
          }
          set.add(uid);
        }
        let obsSet = legacyRunLabels.get(s.observationId);
        if (!obsSet) {
          obsSet = new Set();
          legacyRunLabels.set(s.observationId, obsSet);
        }
        obsSet.add(s.domain);
      }
      for (const set of legacyRunLabels.values()) {
        const labels = [...set];
        for (const l of labels) {
          let r = relatedBySignal.get(l);
          if (!r) {
            r = new Set();
            relatedBySignal.set(l, r);
          }
          for (const o of labels) if (o !== l) r.add(o);
        }
      }
    }

    // Legacy Pattern Intelligence — from AtlasRecord.observed_patterns
    // (shape: [{ domain, signals[] }]). Grouped by domain; distinct
    // participants = "women", growth = 7d vs prior-7d distinct women.
    if (patterns.length === 0) {
      type LP = { domain: string; signals: Set<string>; women: Set<string>; curr: Set<string>; prev: Set<string> };
      const agg = new Map<string, LP>();
      for (const r of legacyRecords) {
        const uid = r.observation?.userId ?? "";
        const ops = Array.isArray(r.observed_patterns)
          ? (r.observed_patterns as Array<{ domain?: string; signals?: string[] }>)
          : [];
        for (const op of ops) {
          const domain = op.domain ?? "Signal";
          let a = agg.get(domain);
          if (!a) {
            a = { domain, signals: new Set(), women: new Set(), curr: new Set(), prev: new Set() };
            agg.set(domain, a);
          }
          (op.signals ?? []).forEach((s) => a!.signals.add(s));
          if (uid) {
            a.women.add(uid);
            const t = r.createdAt.getTime();
            if (t >= currStartMs) a.curr.add(uid);
            else if (t >= prevStartMs) a.prev.add(uid);
          }
        }
      }
      patternsOut = [...agg.values()]
        .map((a) => ({
          name: `${a.domain} Pattern`,
          domain: a.domain,
          description: [...a.signals].join(", ") || "Observed signals",
          count: a.women.size.toLocaleString(),
          countRaw: a.women.size,
          change: growthArrow(a.curr.size, a.prev.size),
        }))
        .sort((x, y) => y.countRaw - x.countRaw)
        .slice(0, 6);
    }

    // Legacy Trajectory — Signal domain volume over the last 7 days,
    // timestamped by the parent observation's startedAt.
    if (trajectory.length === 0) {
      const items = legacySignals
        .filter((s) => s.observation?.startedAt)
        .map((s) => ({ label: s.domain, at: s.observation!.startedAt!.getTime() }));
      trajectoryOut = buildTrajectory(items, bucketBase, bucketSize);

      // Re-point the per-region map at legacy signals (label = domain, region =
      // the observation's country) so the Region filter follows the same source.
      const legacyByCountry = new Map<string, { label: string; at: number }[]>();
      for (const s of legacySignals) {
        const st = s.observation?.startedAt;
        const country = s.observation?.context?.current_country;
        if (!st || !country) continue;
        let arr = legacyByCountry.get(country);
        if (!arr) {
          arr = [];
          legacyByCountry.set(country, arr);
        }
        arr.push({ label: s.domain, at: st.getTime() });
      }
      trajCountryItems = legacyByCountry;
    }

    // Legacy Signal Relationships — Signal domain co-occurrence within
    // the same observation. Needs ≥2 domains co-occurring, else empty.
    if (!relationships) {
      const obsDomains = new Map<string, Set<string>>();
      const lFreq = new Map<string, number>();
      for (const s of legacySignals) {
        let set = obsDomains.get(s.observationId);
        if (!set) {
          set = new Set();
          obsDomains.set(s.observationId, set);
        }
        if (!set.has(s.domain)) {
          set.add(s.domain);
          lFreq.set(s.domain, (lFreq.get(s.domain) ?? 0) + 1);
        }
      }
      if (lFreq.size > 1) {
        const central = [...lFreq.entries()].sort((a, b) => b[1] - a[1])[0][0];
        const hubFreq = lFreq.get(central) ?? 1;
        const cooc = new Map<string, number>();
        for (const set of obsDomains.values()) {
          if (!set.has(central)) continue;
          for (const dm of set) if (dm !== central) cooc.set(dm, (cooc.get(dm) ?? 0) + 1);
        }
        const maxFreq = Math.max(...[...lFreq.values()]);
        const nodes = [...cooc.entries()]
          .map(([name, c]) => ({
            name,
            strength: Math.round((c / hubFreq) * 100) / 100,
            size: Math.round(20 + ((lFreq.get(name) ?? 0) / maxFreq) * 20),
          }))
          .sort((a, b) => b.strength - a.strength)
          .slice(0, 7);
        if (nodes.length > 0) relationshipsOut = { central, nodes };
      }
    }

    // Legacy Emerging — Signal-domain growth (7d vs prior 7d) with the
    // number of distinct regions the signal appears in.
    if (emerging.length === 0) {
      const agg = new Map<string, { curr: number; prev: number; regions: Set<string> }>();
      for (const s of legacySignals) {
        const st = s.observation?.startedAt;
        if (!st) continue;
        let a = agg.get(s.domain);
        if (!a) {
          a = { curr: 0, prev: 0, regions: new Set() };
          agg.set(s.domain, a);
        }
        const t = st.getTime();
        if (t >= currStartMs) {
          a.curr++;
          const c = s.observation?.context?.current_country;
          if (c) a.regions.add(c);
        } else if (t >= prevStartMs) {
          a.prev++;
        }
      }
      emergingOut = [...agg.entries()]
        .map(([expression, a]) => ({
          expression,
          regions: a.regions.size,
          mentions: a.curr.toLocaleString(),
          mentionsRaw: a.curr,
          changePct: pctChange(a.curr, a.prev),
          change: growthArrow(a.curr, a.prev),
        }))
        .filter((e) => e.mentionsRaw > 0)
        .sort((a, b) => b.changePct - a.changePct || b.mentionsRaw - a.mentionsRaw)
        .slice(0, 5);
    }
  }

  // ─── Trajectory Region breakdown ──────────────────────────────────
  // Rank countries by signal volume; compute a top-6 trajectory for each on the
  // same time axis as the "All Regions" view. Only countries with movers are
  // listed, so the client dropdown always has real data behind every option.
  const trajectoryByRegion: Record<string, TrajectoryItem[]> = {};
  const trajectoryRegions: { code: string; name: string }[] = [];
  for (const [code, items] of [...trajCountryItems.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    const t = buildTrajectory(items, bucketBase, bucketSize);
    if (t.length === 0) continue;
    trajectoryByRegion[code] = t;
    trajectoryRegions.push({ code, name: countryName(code) });
  }

  // ─── 6. Atlas Questions ───────────────────────────────────────────
  // Deterministically generated from the strongest-moving trajectory
  // signals: each rising/declining signal becomes an open question, with
  // its distinct-women count and the number of signals it co-occurs with.
  let questions = [...trajectoryOut]
    .sort((a, b) => {
      // Rising signals first (they're the "open questions"), then by breadth.
      if (a.direction !== b.direction) return a.direction === "Increasing" ? -1 : 1;
      return (
        (relatedBySignal.get(b.name)?.size ?? 0) - (relatedBySignal.get(a.name)?.size ?? 0)
      );
    })
    .map((t) => {
      const verb = t.direction === "Increasing" ? "increasing" : "declining";
      const women = womenBySignal.get(t.name)?.size ?? 0;
      return {
        question: `Why is ${t.name} ${verb} across contributors?`,
        signals: relatedBySignal.get(t.name)?.size ?? 0,
        women,
        womenLabel: women.toLocaleString(),
      };
    })
    .filter((q) => q.women > 0 || q.signals > 0)
    .slice(0, 3);

  // Fallback: when there's no recent movement, surface the most prevalent
  // signals across the whole Atlas as standing questions.
  if (questions.length === 0) {
    questions = [...womenBySignal.entries()]
      .map(([label, set]) => ({ label, women: set.size }))
      .sort(
        (a, b) =>
          b.women - a.women ||
          (relatedBySignal.get(b.label)?.size ?? 0) - (relatedBySignal.get(a.label)?.size ?? 0),
      )
      .slice(0, 3)
      .map(({ label, women }) => ({
        question: `What is driving ${label} across contributors?`,
        signals: relatedBySignal.get(label)?.size ?? 0,
        women,
        womenLabel: women.toLocaleString(),
      }));
  }

  // ─── 5. Atlas Trajectories (journey funnel) ───────────────────────
  // A prevalence funnel over five care-pathway stages, each derived from a
  // real collected field. Distinct participants per stage; the donut is the
  // share reaching the High Burden stage; bullets use the modal age cohort
  // and the modal symptom-duration reported before seeking care.
  const journeyObs = await prisma.observation.findMany({
    where: { startedAt: { gte: periodStart } },
    select: {
      userId: true,
      context: { select: { age_range: true } },
      dailyLife: { select: { symptom_duration: true, fatigue_frequency: true } },
      care: {
        select: {
          spoken_to_provider: true,
          care_response: true,
          care_dismissal: true,
          access_to_care: true,
        },
      },
      atlasRecord: { select: { burdenLevel: true } },
    },
  });

  const stageSets = {
    normalize: new Set<string>(),
    delay: new Set<string>(),
    burden: new Set<string>(),
    seek: new Set<string>(),
    manage: new Set<string>(),
  };
  const contributors = new Set<string>();
  const ageCounts = new Map<string, number>();
  const durationCounts = new Map<string, number>();
  let burdenFatigue = 0;
  for (const o of journeyObs) {
    const uid = o.userId;
    if (!uid) continue;
    contributors.add(uid);
    const care = o.care;
    const dl = o.dailyLife;
    const age = o.context?.age_range;
    const dur = dl?.symptom_duration;
    const highBurden = o.atlasRecord?.burdenLevel === "High";

    if (age && age !== "prefer_not_to_say") ageCounts.set(age, (ageCounts.get(age) ?? 0) + 1);

    if (care?.care_dismissal === "yes" || care?.care_response === "told_symptoms_normal")
      stageSets.normalize.add(uid);
    if (dur === "1_3_years" || dur === "more_than_3_years" || care?.access_to_care === "no")
      stageSets.delay.add(uid);
    if (highBurden) stageSets.burden.add(uid);
    if (care?.spoken_to_provider === "yes") {
      stageSets.seek.add(uid);
      if (dur) durationCounts.set(dur, (durationCounts.get(dur) ?? 0) + 1);
    }
    if (
      care?.care_response === "receiving_treatment_or_support" ||
      care?.care_response === "referred_to_another_provider"
    )
      stageSets.manage.add(uid);
    if (
      highBurden &&
      (dl?.fatigue_frequency === "frequently" || dl?.fatigue_frequency === "always")
    )
      burdenFatigue++;
  }

  const totalContrib = contributors.size;
  let journey: {
    stages: { label: string; count: number }[];
    donutPercent: number;
    insights: string[];
  } | null = null;
  if (totalContrib > 0) {
    const stages = [
      { label: "Normalization of Symptoms", count: stageSets.normalize.size },
      { label: "Delayed Care", count: stageSets.delay.size },
      { label: "High Burden", count: stageSets.burden.size },
      { label: "Seeking Care", count: stageSets.seek.size },
      { label: "Diagnosis & Management", count: stageSets.manage.size },
    ];
    const donutPercent = Math.round((stageSets.burden.size / totalContrib) * 100);

    const insights: string[] = [];
    const topAge = modalKey(ageCounts);
    if (topAge) insights.push(`Most common in age ${AGE_LABELS[topAge] ?? topAge}.`);
    const topDur = modalKey(durationCounts);
    if (topDur)
      insights.push(
        `Most report symptoms for ${DURATION_LABELS[topDur] ?? topDur} before seeking care.`,
      );
    if (stageSets.burden.size > 0) {
      const pct = Math.round((burdenFatigue / stageSets.burden.size) * 100);
      if (pct > 0)
        insights.push(`${pct}% at the High Burden stage report frequent fatigue.`);
    }

    journey = { stages, donutPercent, insights };
  }

  return Response.json({
    totalContributors,
    atlasRecords,
    observations,
    signals,
    regionsActive,
    repeatRate,
    deltas,
    patterns: patternsOut,
    trajectory: trajectoryOut,
    trajectoryRegions,
    trajectoryByRegion,
    relationships: relationshipsOut,
    emerging: emergingOut,
    languages,
    questions,
    journey,
    range,
    periodLabel,
  });
}
