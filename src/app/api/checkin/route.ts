import { NextResponse } from "next/server";
import { ActionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAuditEvent } from "@/lib/audit-logger";
import { applyCheckinDeltas, type CheckinDelta } from "@/lib/observation/checkin";
import { projectResponses } from "@/lib/observation/projection";
import type { AnswerMap } from "@/lib/observation/types";
import { v43Text } from "@/lib/observation/intelligence/v43/v43-i18n";

export const runtime = "nodejs";

async function resolveUser(): Promise<{ userId: string; locale: string | undefined } | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) return null;
  return { userId, locale: session?.user?.locale ?? undefined };
}

/**
 * POST /api/checkin — record an Atlas Check-In as a new observation.
 * Clones the participant's most recent observation's responses, applies the
 * per-signal deltas (bounded nudges), stores the raw check-in, and returns the
 * new observationId. The client then runs /api/observation/intelligence on it to
 * produce a fresh dated Atlas Record (Delta + new Atlas Record).
 * Body: { deltas: CheckinDelta[], notes?: string }
 */
export async function POST(req: Request) {
  let locale: string | undefined;
  try {
    const { deltas, notes } = (await req.json()) as { deltas?: CheckinDelta[]; notes?: string };

    const resolved = await resolveUser();
    if (!resolved) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    const { userId } = resolved;
    locale = resolved.locale;

    // The most recent observation that produced a record — clone + compound from it.
    const prior = await prisma.observation.findFirst({
      where: { userId, atlasRecord: { isNot: null } },
      include: { atlasRecord: true, responses: true },
      orderBy: { startedAt: "desc" },
    });
    if (!prior) {
      return NextResponse.json(
        { error: v43Text("_template", "noPriorAtlasRecord", "No prior Atlas Record to check in against", locale) },
        { status: 400 },
      );
    }

    const priorAnswers: AnswerMap = {};
    for (const r of prior.responses) priorAnswers[r.fieldId] = r.value as AnswerMap[string];
    const nextAnswers = applyCheckinDeltas(priorAnswers, Array.isArray(deltas) ? deltas : []);

    const observation = await prisma.observation.create({
      data: {
        userId,
        flowKey: "atlas_checkin",
        status: "record_saved",
        completedAt: new Date(),
      },
    });

    await Promise.all(
      Object.entries(nextAnswers).map(([fieldId, value]) =>
        prisma.observationResponse.create({
          data: {
            observationId: observation.id,
            fieldId,
            value: (value ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          },
        }),
      ),
    );

    await prisma.atlasCheckin.create({
      data: {
        userId,
        previousAtlasRecordId: prior.atlasRecord?.id ?? null,
        checkin_payload: {
          observationId: observation.id,
          previousObservationId: prior.id,
          deltas: Array.isArray(deltas) ? deltas : [],
          notes: notes?.trim() ?? "",
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await logAuditEvent({
      entityId: observation.id,
      entityType: "AtlasCheckin",
      actionType: ActionType.CREATE,
      dataAfter: {
        flowKey: "atlas_checkin",
        previousObservationId: prior.id,
        previousAtlasRecordId: prior.atlasRecord?.id ?? null,
        deltas: (Array.isArray(deltas) ? deltas : []) as unknown as Prisma.InputJsonValue,
      },
      userId,
    });

    // Keep the participant's free-text note with the new observation (record display).
    if (notes?.trim()) {
      try {
        await prisma.narrative.create({
          data: {
            observationId: observation.id,
            promptId: "checkin_note",
            textResponse: notes.trim(),
            status: "completed",
          },
        });
      } catch (noteError) {
        console.error("Check-in note save failed (non-fatal):", noteError);
      }
    }

    // Project into the spec domain tables (non-fatal).
    try {
      const questions = await prisma.formQuestion.findMany({
        select: { fieldId: true, fieldType: true, targetTable: true, targetColumn: true },
      });
      await projectResponses(observation.id, nextAnswers, questions);
    } catch (projectionError) {
      console.error("Check-in projection failed (responses still saved):", projectionError);
    }

    // The check-in is submitted — clear the DB draft so no device resumes a
    // conversation that has already produced a record (non-fatal).
    try {
      await prisma.checkinDraft.deleteMany({ where: { userId } });
    } catch (draftError) {
      console.error("Check-in draft cleanup failed (check-in still saved):", draftError);
    }

    return NextResponse.json({ success: true, observationId: observation.id });
  } catch (error) {
    console.error("Check-in failed:", error);
    return NextResponse.json(
      { error: v43Text("_template", "checkinFailed", "Check-in failed", locale) },
      { status: 500 },
    );
  }
}
