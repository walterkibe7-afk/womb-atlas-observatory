import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// Steward review write path. Records a StewardReview decision, mirrors it onto
// the AtlasRecord status, and writes an audit trail. Read counterparts live in
// ../route.ts (queue) and ../[id]/route.ts (detail).

type ReviewAction = "approve" | "flag" | "reject" | "reopen";

// Steward action -> (StewardReview.status, AtlasRecord.status). Review statuses
// follow the schema vocabulary (Approved | Flagged | Needs Info); the record
// status is what the processed/escalated views will filter on.
//
// `reopen` is the undo path for a decision made by mistake: it clears the
// StewardReview row (review: null) and returns the record to the "Active"
// default, which puts it back in the pending In Review queue.
const ACTION_MAP: Record<ReviewAction, { review: string | null; record: string }> = {
  approve: { review: "Approved", record: "Reviewed" },
  flag: { review: "Flagged", record: "Flagged" },
  reject: { review: "Needs Info", record: "Rejected" },
  reopen: { review: null, record: "Active" },
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (user?.role !== "steward" || !user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = (await req.json().catch(() => null)) as
      | { action?: string; notes?: string; flagReason?: string }
      | null;

    const action = body?.action as ReviewAction | undefined;
    if (!action || !(action in ACTION_MAP)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    const mapped = ACTION_MAP[action];
    // `null` means the caller sent no notes field at all (the dashboard's
    // Reviewer Actions row) — an existing note must survive that. An empty
    // string is a deliberate clear from the record detail's notes box.
    const notes = typeof body?.notes === "string" ? body.notes.trim() : null;
    const flagReason = typeof body?.flagReason === "string" ? body.flagReason.trim() : null;

    const record = await prisma.atlasRecord.findUnique({
      where: { id },
      select: {
        id: true,
        observationId: true,
        status: true,
        observation: {
          select: {
            flowKey: true,
            stewardReview: { select: { status: true, clinicalNotes: true } },
          },
        },
      },
    });
    if (!record) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Only first observations are reviewable. Atlas Check-Ins generate dated
    // records for the participant's timeline but are outside the steward workflow
    // (they never appear in the queue) — reject any attempt to action one.
    if (record.observation?.flowKey !== "first_observation") {
      return NextResponse.json(
        { error: "Atlas Check-In records are not part of the steward review workflow" },
        { status: 403 },
      );
    }

    const previousReview = record.observation?.stewardReview ?? null;

    const review = await prisma.$transaction(async (tx) => {
      // reopen drops the decision entirely so the record reads as never-reviewed
      // in the queue (no reviewer, no notes) instead of carrying a stale one.
      const saved =
        mapped.review === null
          ? null
          : await tx.stewardReview.upsert({
              where: { observationId: record.observationId },
              create: {
                observationId: record.observationId,
                stewardId: user.id!,
                status: mapped.review,
                clinicalNotes: notes,
                flagReason: action === "flag" ? flagReason : null,
              },
              update: {
                stewardId: user.id!,
                status: mapped.review,
                ...(notes === null ? {} : { clinicalNotes: notes }),
                flagReason: action === "flag" ? flagReason : null,
                reviewedAt: new Date(),
              },
            });

      if (mapped.review === null) {
        await tx.stewardReview.deleteMany({ where: { observationId: record.observationId } });
      }

      await tx.atlasRecord.update({
        where: { id: record.id },
        data: { status: mapped.record },
      });

      await tx.auditLog.create({
        data: {
          entityId: record.id,
          entityType: "AtlasRecord",
          actionType: "UPDATE",
          userId: user.id!,
          dataBefore: { status: record.status, reviewStatus: previousReview?.status ?? null },
          dataAfter: { status: mapped.record, reviewStatus: mapped.review },
        },
      });

      return saved;
    });

    return NextResponse.json({
      review: {
        status: review?.status ?? "Pending",
        recordStatus: mapped.record,
        clinicalNotes: review?.clinicalNotes ?? null,
        reviewedAt: (review?.reviewedAt ?? new Date()).toISOString(),
      },
    });
  } catch (error) {
    console.error("Failed to save steward review:", error);
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }
}
