import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deriveTrackedSignals } from "@/lib/observation/checkin";
import { sanitizeDraftPayload, type CheckinDraftPayload } from "@/lib/checkin/draft";
import { formatDateLong } from "@/lib/observation/locale-date";

/**
 * GET /api/participant/checkin-context — the "Previously Tracked Signals" a
 * participant would update. Sourced from their FULL Atlas Record history (not
 * just the latest) so a domain that's since resolved to 0 stays checkable —
 * it can relapse and worsen again.
 *
 * Also returns the participant's in-progress check-in draft (if any) so a
 * check-in started elsewhere resumes here. A draft scoped to an older baseline
 * (a new record has been generated since) is stale — it's deleted and omitted.
 */
export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ context: null });

    const observations = await prisma.observation.findMany({
      where: { userId, atlasRecord: { isNot: null } },
      include: { atlasRecord: true, safety: true },
      orderBy: { startedAt: "asc" },
    });
    if (observations.length === 0) return NextResponse.json({ context: null });

    const latest = observations[observations.length - 1];
    const priorDate = formatDateLong(latest.completedAt ?? latest.startedAt, session?.user?.locale ?? "en");

    // Urgent symptom markers from the latest record's safety check (safety_flags
    // is a multi_select; "none" and unmapped values contribute no domain marker).
    const rawFlags = latest.safety?.safety_flags;
    const latestSafetyFlags = Array.isArray(rawFlags)
      ? rawFlags.filter((f): f is string => typeof f === "string")
      : [];

    // In-progress draft for THIS baseline (cross-device resume). One scoped to a
    // prior baseline is stale — a new record has been generated since — so drop
    // it server-side rather than letting every device re-discover that.
    let draft: CheckinDraftPayload | null = null;
    try {
      const stored = await prisma.checkinDraft.findUnique({ where: { userId } });
      if (stored && stored.previousObservationId === latest.id) {
        draft = sanitizeDraftPayload(stored.payload);
      } else if (stored) {
        await prisma.checkinDraft.delete({ where: { userId } });
      }
    } catch (draftError) {
      console.error("Check-in draft load failed (context still returned):", draftError);
    }

    return NextResponse.json({
      context: {
        previousObservationId: latest.id,
        previousAtlasRecordId: latest.atlasRecord!.id,
        priorDate,
        trackedSignals: deriveTrackedSignals(
          observations.map((o) => o.atlasRecord!),
          { latestSafetyFlags, locale: session?.user?.locale ?? "en" },
        ),
        draft,
      },
    });
  } catch (error) {
    console.error("Failed to load check-in context:", error);
    return NextResponse.json({ context: null });
  }
}
