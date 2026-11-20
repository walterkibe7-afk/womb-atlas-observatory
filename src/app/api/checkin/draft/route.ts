import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isDraftEmpty, sanitizeDraftPayload } from "@/lib/checkin/draft";

export const runtime = "nodejs";

async function resolveUserId(): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  return exists ? userId : null;
}

/**
 * PUT /api/checkin/draft — persist the in-progress check-in draft (conversation,
 * inferred deltas, notes, phase) so a check-in started on one device resumes on
 * another. One draft per participant, scoped to the baseline observation it was
 * started against; the client reads it back via /api/participant/checkin-context.
 * Body: { previousObservationId, payload: { messages, deltasByDomain, notes, phase } }
 */
export async function PUT(req: Request) {
  try {
    const userId = await resolveUserId();
    if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      previousObservationId?: unknown;
      payload?: unknown;
    };
    const previousObservationId =
      typeof body.previousObservationId === "string" ? body.previousObservationId : "";
    if (!previousObservationId) {
      return NextResponse.json({ error: "previousObservationId is required" }, { status: 400 });
    }

    // The baseline must be one of THIS participant's observations — a stale or
    // foreign id would produce a draft that never matches a real baseline (and
    // could leak across accounts on shared devices).
    const baseline = await prisma.observation.findFirst({
      where: { id: previousObservationId, userId },
      select: { id: true },
    });
    if (!baseline) {
      return NextResponse.json({ error: "Unknown baseline observation" }, { status: 400 });
    }

    const payload = sanitizeDraftPayload(body.payload);
    if (isDraftEmpty(payload)) {
      // Nothing worth keeping — treat as a clear so an emptied draft doesn't
      // resurrect on the next device.
      await prisma.checkinDraft.deleteMany({ where: { userId } });
      return NextResponse.json({ success: true, cleared: true });
    }

    await prisma.checkinDraft.upsert({
      where: { userId },
      create: {
        userId,
        previousObservationId,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
      update: {
        previousObservationId,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save check-in draft:", error);
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }
}

/** DELETE /api/checkin/draft — discard the participant's in-progress draft. */
export async function DELETE() {
  try {
    const userId = await resolveUserId();
    if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    await prisma.checkinDraft.deleteMany({ where: { userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear check-in draft:", error);
    return NextResponse.json({ error: "Failed to clear draft" }, { status: 500 });
  }
}
