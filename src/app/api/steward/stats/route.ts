import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { parseWindow, windowFilter } from "@/lib/date-range";

// Dashboard metrics + insight cards for the steward portal. Everything here is
// derived live from AtlasRecord / StewardReview / AtlasPatternRow — no mocks.
//
// The header date filter (`?range=7d|30d|90d|all|custom`, plus `?from=&to=` for
// a custom window) scopes the record counts to records submitted in the window,
// the review-latency average to reviews made in it, and the pattern cards to
// patterns extracted in it. Two things stay absolute by design: the "Reviewed
// Today" / "+n this week" figures name their own window in the label, and the
// Signal Snapshot sparkline is a fixed six-week trend line.

const ACTIONED_STATUSES = ["Reviewed", "Flagged", "Rejected"];
const DAY_MS = 24 * 60 * 60 * 1000;

// The review workflow only covers first observations — Atlas Check-Ins never
// enter the steward queue (see /api/steward/records). Scope the review-workflow
// counts to first-observation records so the dashboard metrics agree with the
// queue. The pattern-analytics cards below (Signal Snapshot / Emerging Concepts /
// Signals Identified) intentionally span ALL runs, including check-ins, since
// they measure collective intelligence rather than reviewable items.
const FIRST_OBS_RECORD = { observation: { flowKey: "first_observation" } };
const FIRST_OBS_REVIEW = { observation: { flowKey: "first_observation" } };
const SNAPSHOT_COUNT = 4; // top signals shown in the Signal Snapshot card
const WEEK_BUCKETS = 6; // sparkline points (one per week, oldest -> newest)

export async function GET(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "steward") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();
    const window = parseWindow(new URL(req.url).searchParams, now);
    const inRange = windowFilter(window); // {} when unbounded ("all time")
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
    const sixWeeksAgo = new Date(now.getTime() - WEEK_BUCKETS * 7 * DAY_MS);
    // Emerging Concepts is a "what's rising lately" card: it looks back 30 days
    // unless the header filter narrows or moves the window.
    const conceptsWindow = {
      from: window.from ?? new Date(now.getTime() - 30 * DAY_MS),
      to: window.to,
    };

    const [
      pending,
      pendingHighPriority,
      flagged,
      approved,
      rejected,
      reviewedToday,
      approvedThisWeek,
      flaggedThisWeek,
      signalGroups,
      reviewsForAvg,
      recentPatterns,
      countryPatterns,
    ] = await Promise.all([
      prisma.atlasRecord.count({
        where: { status: { notIn: ACTIONED_STATUSES }, ...FIRST_OBS_RECORD, ...inRange },
      }),
      prisma.atlasRecord.count({
        where: {
          status: { notIn: ACTIONED_STATUSES },
          burdenLevel: "High",
          ...FIRST_OBS_RECORD,
          ...inRange,
        },
      }),
      prisma.atlasRecord.count({ where: { status: "Flagged", ...FIRST_OBS_RECORD, ...inRange } }),
      prisma.atlasRecord.count({ where: { status: "Reviewed", ...FIRST_OBS_RECORD, ...inRange } }),
      prisma.atlasRecord.count({ where: { status: "Rejected", ...FIRST_OBS_RECORD, ...inRange } }),
      prisma.stewardReview.count({
        where: { reviewedAt: { gte: startOfToday }, ...FIRST_OBS_REVIEW },
      }),
      prisma.stewardReview.count({
        where: { status: "Approved", reviewedAt: { gte: weekAgo }, ...FIRST_OBS_REVIEW },
      }),
      prisma.stewardReview.count({
        where: { status: "Flagged", reviewedAt: { gte: weekAgo }, ...FIRST_OBS_REVIEW },
      }),
      prisma.atlasPatternRow.groupBy({
        by: ["name"],
        where: inRange,
        _count: { name: true },
        orderBy: { _count: { name: "desc" } },
      }),
      prisma.stewardReview.findMany({
        where: { ...FIRST_OBS_REVIEW, ...windowFilter(window, "reviewedAt") },
        select: {
          reviewedAt: true,
          observation: { select: { atlasRecord: { select: { createdAt: true } } } },
        },
      }),
      prisma.atlasPatternRow.findMany({
        where: { createdAt: { gte: sixWeeksAgo } },
        select: { name: true, createdAt: true },
      }),
      prisma.atlasPatternRow.findMany({
        where: windowFilter(conceptsWindow),
        select: {
          name: true,
          run: {
            select: { observation: { select: { context: { select: { current_country: true } } } } },
          },
        },
      }),
    ]);

    // -- Avg. review time (decision latency: reviewedAt - record.createdAt) ---
    const latencies = reviewsForAvg
      .map((r) => {
        const created = r.observation?.atlasRecord?.createdAt;
        return created ? r.reviewedAt.getTime() - created.getTime() : null;
      })
      .filter((ms): ms is number => ms != null && ms >= 0);
    const avgReviewMinutes =
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length / 60000)
        : null;

    // -- Signal Snapshot: top patterns by frequency, with weekly sparkline ----
    const topNames = signalGroups.slice(0, SNAPSHOT_COUNT).map((g) => g.name);
    const countByName = new Map(signalGroups.map((g) => [g.name, g._count.name]));

    // Bucket recent occurrences into WEEK_BUCKETS weekly counts per name.
    const series = new Map<string, number[]>(
      topNames.map((n) => [n, new Array(WEEK_BUCKETS).fill(0)]),
    );
    for (const p of recentPatterns) {
      const arr = series.get(p.name);
      if (!arr) continue;
      const weeksAgo = Math.floor((now.getTime() - p.createdAt.getTime()) / (7 * DAY_MS));
      const idx = WEEK_BUCKETS - 1 - Math.min(weeksAgo, WEEK_BUCKETS - 1); // oldest -> newest
      arr[idx] += 1;
    }
    const signalSnapshot = topNames.map((name) => {
      const buckets = series.get(name) ?? [];
      const last = buckets[buckets.length - 1] ?? 0;
      const prev = buckets[buckets.length - 2] ?? 0;
      const trendPct =
        prev > 0 ? Math.round(((last - prev) / prev) * 100) : last > 0 ? 100 : 0;
      return { name, count: countByName.get(name) ?? 0, trendPct, series: buckets };
    });

    // -- Emerging Concepts: rising patterns (selected range, else last 30d) ----
    const conceptAgg = new Map<string, { count: number; countries: Map<string, number> }>();
    for (const p of countryPatterns) {
      if (topNames.includes(p.name)) continue;
      const entry = conceptAgg.get(p.name) ?? { count: 0, countries: new Map() };
      entry.count += 1;
      const country = p.run?.observation?.context?.current_country;
      if (country) entry.countries.set(country, (entry.countries.get(country) ?? 0) + 1);
      conceptAgg.set(p.name, entry);
    }
    const emergingConcepts = [...conceptAgg.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([term, e]) => {
        const topCountry = [...e.countries.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        return { term, country: topCountry, count: e.count };
      });

    return NextResponse.json({
      metrics: {
        pending,
        pendingHighPriority,
        flagged,
        approved,
        rejected,
        reviewedToday,
        approvedThisWeek,
        flaggedThisWeek,
        signalsIdentified: signalGroups.length,
        avgReviewMinutes,
      },
      signalSnapshot,
      emergingConcepts,
    });
  } catch (error) {
    console.error("Failed to load steward stats:", error);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
