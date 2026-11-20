import { NextResponse } from "next/server";
import { ActionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAuditEvent } from "@/lib/audit-logger";
import { projectResponses } from "@/lib/observation/projection";
import { narrativeAnswerText } from "@/lib/observation/types";
import type { AnswerMap } from "@/lib/observation/types";

const NARRATIVE_PROMPT_ID = /^(NP|SNP)\d+$/i;

// Resolve the participant strictly from the session (the route is behind the auth
// proxy). No "first participant" fallback — guessing could return another user's
// draft, which is exactly the cross-device resume bug we must avoid.
async function resolveUserId(): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  // The JWT session can outlive its User row — e.g. after a DB reset the cookie
  // still carries a userId that no longer exists. Writing with it FK-crashes on
  // `userId`, so treat a missing user as unauthenticated: the caller returns 401
  // and the participant is prompted to sign in again (minting a fresh, valid id).
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  return exists ? userId : null;
}

/**
 * GET /api/observation — the participant's latest resumable draft (cross-device).
 * Returns the saved answers + progress pointer so any device/login resumes.
 */
export async function GET() {
  try {
    const userId = await resolveUserId();
    if (!userId) return NextResponse.json({ observation: null });

    // 1. Resume an in-progress draft (any flow) if one exists.
    let obs = await prisma.observation.findFirst({
      where: { userId, status: { not: "record_saved" } },
      orderBy: { updatedAt: "desc" },
    });
    let completed = false;

    // 2. Otherwise surface the already-completed first observation so it can be
    //    EDITED — never a blank new one. A participant records a first observation
    //    exactly once; returning it here (instead of null) prevents duplicates.
    if (!obs) {
      obs = await prisma.observation.findFirst({
        where: { userId, flowKey: "first_observation", status: "record_saved" },
        orderBy: { completedAt: "desc" },
      });
      completed = !!obs;
    }
    if (!obs) return NextResponse.json({ observation: null });

    const responses = await prisma.observationResponse.findMany({
      where: { observationId: obs.id },
    });
    const answers: AnswerMap = {};
    for (const r of responses) answers[r.fieldId] = r.value as AnswerMap[string];

    return NextResponse.json({
      observation: {
        observationId: obs.id,
        answers,
        currentScreenId: obs.currentScreenId,
        status: obs.status,
        flowKey: obs.flowKey,
        completed,
      },
    });
  } catch (error) {
    console.error("Failed to load draft observation:", error);
    return NextResponse.json({ observation: null });
  }
}

/**
 * POST /api/observation — incremental save of responses + progress.
 * Body: { observationId?, answers, flowKey?, currentScreenId?, completed? }
 */
export async function POST(req: Request) {
  try {
    const { observationId, answers, flowKey, currentScreenId, completed } = (await req.json()) as {
      observationId?: string;
      answers: AnswerMap;
      flowKey?: string;
      currentScreenId?: string;
      completed?: boolean;
    };

    const userId = await resolveUserId();
    if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const effectiveFlow = flowKey || "first_observation";
    let obsId = observationId;

    // Validate a client-supplied id: it must exist AND belong to this user. The
    // browser can hold a stale observationId (e.g. after a DB reset) or one from
    // another account — using it verbatim would raise an FK violation on upsert
    // (or write into someone else's observation). If it doesn't resolve, fall
    // through to the reuse/create path below.
    if (obsId) {
      const owned = await prisma.observation.findFirst({
        where: { id: obsId, userId },
        select: { id: true },
      });
      if (!owned) obsId = undefined;
    }

    // A participant has at most ONE first observation. When the client doesn't
    // send an id, reuse the existing first observation (draft or completed) rather
    // than creating a duplicate — this is what makes the first observation
    // record-once / edit-only.
    if (!obsId && effectiveFlow === "first_observation") {
      const existing = await prisma.observation.findFirst({
        where: { userId, flowKey: "first_observation" },
        orderBy: { startedAt: "asc" },
      });
      if (existing) obsId = existing.id;
    }

    if (!obsId) {
      const obs = await prisma.observation.create({
        data: {
          userId,
          flowKey: effectiveFlow,
          status: "in_progress",
          currentScreenId: currentScreenId ?? null,
        },
      });
      obsId = obs.id;
      // Audit the observation's creation once. Incremental response saves are NOT
      // logged (they'd flood the trail); the completion edit below is.
      await logAuditEvent({
        entityId: obsId,
        entityType: "Observation",
        actionType: ActionType.CREATE,
        dataAfter: { flowKey: effectiveFlow, status: "in_progress" },
        userId,
      });
    }

    const entries = Object.entries(answers || {});
    await Promise.all(
      entries.map(([fieldId, value]) => {
        const jsonValue = (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
        return prisma.observationResponse.upsert({
          where: { observationId_fieldId: { observationId: obsId!, fieldId } },
          create: { observationId: obsId!, fieldId, value: jsonValue },
          update: { value: jsonValue },
        });
      }),
    );

    // Mirror narrative text (typed, or transcribed if voice-only) into the
    // Narrative table — read by the participant AI chat's context builder.
    // Non-fatal, and never touches audioUrl/transcription/language, which the
    // narrative audio-upload route owns.
    try {
      const narrativeTexts = entries
        .filter(([fieldId]) => NARRATIVE_PROMPT_ID.test(fieldId))
        .map(([promptId, value]) => [promptId, narrativeAnswerText(value).trim()] as const)
        .filter(([, text]) => text.length > 0);
      await Promise.all(
        narrativeTexts.map(([promptId, text]) =>
          prisma.narrative.upsert({
            where: { observationId_promptId: { observationId: obsId!, promptId } },
            create: { observationId: obsId!, promptId, textResponse: text, status: "completed" },
            update: { textResponse: text },
          }),
        ),
      );
    } catch (narrativeError) {
      console.error("Narrative mirror failed (responses still saved):", narrativeError);
    }

    // Persist the progress pointer (and completion) for cross-device resume FIRST,
    // so resume never freezes even if the projection below hits a snag. When the
    // participant is editing an already-completed observation, keep it
    // `record_saved` (a mid-edit save must not silently un-complete it).
    const current = await prisma.observation.findUnique({
      where: { id: obsId! },
      select: { status: true },
    });
    const wasAlreadyCompleted = current?.status === "record_saved";
    const nextStatus = completed ? "record_saved" : wasAlreadyCompleted ? undefined : "in_progress";

    await prisma.observation.update({
      where: { id: obsId! },
      data: {
        ...(currentScreenId !== undefined ? { currentScreenId } : {}),
        ...(nextStatus ? { status: nextStatus } : {}),
        // completedAt is frozen at FIRST completion — the "First Observation" timeline
        // entry must never move just because the participant re-opens and re-saves an
        // edit. A genuine re-completion (editing an already-saved observation) is
        // logged to AuditLog instead (one row per edit — see summary.ts), so a
        // second edit doesn't clobber the first the way a single mutable
        // timestamp column would.
        ...(completed && !wasAlreadyCompleted ? { completedAt: new Date() } : {}),
      },
    });

    // Audit every completion: the first (in_progress -> record_saved) and each
    // subsequent edit (a re-completion of an already-saved observation).
    if (completed) {
      await logAuditEvent({
        entityId: obsId!,
        entityType: "Observation",
        actionType: ActionType.UPDATE,
        dataBefore: { status: wasAlreadyCompleted ? "record_saved" : "in_progress" },
        dataAfter: { flowKey: effectiveFlow, status: "record_saved", edit: wasAlreadyCompleted },
        userId,
      });
    }

    // Project into spec-aligned domain tables (config-driven via question mapping).
    // Non-fatal: a projection failure must not lose the canonical responses or the
    // progress pointer (the response rows remain the source of truth).
    try {
      const questions = await prisma.formQuestion.findMany({
        select: { fieldId: true, fieldType: true, targetTable: true, targetColumn: true },
      });
      await projectResponses(obsId!, answers || {}, questions);
    } catch (projectionError) {
      console.error("Projection failed (responses still saved):", projectionError);
    }

    return NextResponse.json({ success: true, observationId: obsId });
  } catch (error) {
    console.error("Failed to save observation responses:", error);
    return NextResponse.json({ error: "Failed to save responses" }, { status: 500 });
  }
}
