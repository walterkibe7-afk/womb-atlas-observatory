import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { parseWindow, windowFilter } from "@/lib/date-range";

// Map the stored burden level (Low | Moderate | High) onto the queue's
// priority vocabulary (Low | Medium | High) used by the steward UI.
const BURDEN_TO_PRIORITY: Record<string, "High" | "Medium" | "Low"> = {
  High: "High",
  Moderate: "Medium",
  Low: "Low",
};

// The v5 Atlas Intelligence pipeline ranks findings by pattern *confidence*
// (high/moderate/low), which the steward UI renders on its severity scale.
const CONFIDENCE_RANK: Record<string, number> = { high: 3, moderate: 2, low: 1 };

type SignalDTO = { signalId: string; name: string; domain: string; severity: string };

// Terminal statuses a steward can set. Anything else (including the "Active"
// default AtlasRecords are created with) counts as pending "In Review".
const ACTIONED_STATUSES = ["Reviewed", "Flagged", "Rejected"] as const;

// The steward review workflow only covers a participant's FIRST observation.
// Atlas Check-Ins are longitudinal self-updates: they still generate dated Atlas
// Records (kept in the participant's timeline/history) but must never enter the
// steward queue — a steward can't approve/flag/reject a check-in. Scope every
// queue/status query to first-observation records via this relation filter.
const FIRST_OBSERVATION_ONLY = { observation: { flowKey: "first_observation" } };

// Map a ?status= query value onto a Prisma where-filter on AtlasRecord.status.
function statusFilter(param: string | null) {
  switch ((param ?? "").toLowerCase()) {
    case "reviewed":
      return { status: "Reviewed" };
    case "flagged":
      return { status: "Flagged" };
    case "rejected":
      return { status: "Rejected" };
    // "in-review" and the default (no param) are the pending queue.
    default:
      return { status: { notIn: [...ACTIONED_STATUSES] } };
  }
}

/**
 * GET /api/steward/records — the steward Review Queue.
 *
 * `?status=` picks the queue (pending by default); `?range=7d|30d|90d|all|custom`
 * (with `?from=&to=` for custom) is the dashboard's header date filter and
 * scopes the queue to records submitted in that window. Callers that must never
 * hide pending work (the standalone status pages) omit it, which means all time.
 *
 * Sources themes + signals from the v5 Atlas Intelligence run (AtlasPatternRow),
 * which replaced the legacy Signal/SignalRule tables the old reflection engine
 * wrote. Records without a run fall back to the AtlasRecord.observed_patterns
 * snapshot so pre-v5 records still list.
 */
export async function GET(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "steward") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const params = new URL(req.url).searchParams;
    const statusParam = params.get("status");
    const window = parseWindow(params);
    const records = await prisma.atlasRecord.findMany({
      where: { ...statusFilter(statusParam), ...FIRST_OBSERVATION_ONLY, ...windowFilter(window) },
      orderBy: { createdAt: "desc" },
      include: {
        observation: {
          include: {
            user: { select: { name: true } },
            context: true,
            stewardReview: { include: { steward: { select: { name: true } } } },
            // Newest intelligence run carries the detected patterns/signals.
            atlasRuns: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { patterns: true },
            },
          },
        },
      },
    });

    const dtos = records.map((rec) => {
      const obs = rec.observation;
      const ctx = obs?.context;
      const run = obs?.atlasRuns?.[0];

      // Primary source: patterns from the latest intelligence run.
      let signals: SignalDTO[] = (run?.patterns ?? []).map((p) => ({
        signalId: p.businessId,
        name: p.name,
        domain: p.domain,
        severity: p.confidence,
      }));

      // observed_patterns snapshot: [{ domain, signals: string[] }] (pattern names).
      const observedPatterns = (rec.observed_patterns as
        | { domain: string; signals: string[] }[]
        | null) ?? [];

      // Fallback for records with no run (severity unknown -> "moderate").
      if (signals.length === 0) {
        signals = observedPatterns.flatMap((g) =>
          g.signals.map((name) => ({
            signalId: name,
            name,
            domain: g.domain,
            severity: "moderate",
          })),
        );
      }

      // Themes: unique signal names, ranked by confidence (highest first).
      const sortedSignals = [...signals].sort(
        (a, b) => (CONFIDENCE_RANK[b.severity] ?? 0) - (CONFIDENCE_RANK[a.severity] ?? 0),
      );
      const themes = Array.from(new Set(sortedSignals.map((s) => s.name)));

      // Summary paragraphs live under reflection_summary.paragraphs.
      const reflection = rec.reflection_summary as { paragraphs?: string[] } | null;
      const summary = (reflection?.paragraphs ?? []).join("\n\n");

      const topic =
        sortedSignals[0]?.name ?? observedPatterns[0]?.domain ?? "General";

      return {
        id: rec.id,
        displayId: `WA-${rec.createdAt.getFullYear()}-${rec.id.slice(-5).toUpperCase()}`,
        priority: BURDEN_TO_PRIORITY[rec.burdenLevel ?? "Low"] ?? "Low",
        burdenLevel: rec.burdenLevel ?? "Low",
        status: rec.status,
        submittedAt: rec.createdAt.toISOString(),
        contributor: {
          name: obs?.user?.name?.trim() || "Anonymous",
          ageRange: ctx?.age_range ?? null,
          country: ctx?.current_country ?? null,
          lifeStage: ctx?.reproductive_state ?? null,
        },
        source: obs?.flowKey === "atlas_checkin" ? "Atlas Check-In" : "Observatory Session",
        topic,
        themes,
        summary,
        signals,
        observedPatterns,
        stewardNotes: obs?.stewardReview?.clinicalNotes ?? null,
        reviewedBy: obs?.stewardReview?.steward?.name?.trim() || null,
        reviewedAt: obs?.stewardReview?.reviewedAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ records: dtos });
  } catch (error) {
    console.error("Failed to load steward records:", error);
    return NextResponse.json({ error: "Failed to load records" }, { status: 500 });
  }
}
