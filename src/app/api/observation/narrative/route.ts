import { NextResponse } from "next/server";
import { ActionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAuditEvent } from "@/lib/audit-logger";
import { saveAudio } from "@/lib/media/storage";
import { transcribeAudio } from "@/lib/media/stt";

export const runtime = "nodejs";

/**
 * POST /api/observation/narrative — upload a narrative audio clip.
 * multipart/form-data: { observationId, promptId, audio (Blob) }
 * Stores the audio (storage seam), transcribes it (STT seam), and upserts the
 * Narrative row, then returns { audioUrl, transcription } for the client.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const form = await req.formData();
    const observationId = String(form.get("observationId") || "");
    const promptId = String(form.get("promptId") || "");
    const audio = form.get("audio");
    if (!observationId || !promptId || !(audio instanceof Blob)) {
      return NextResponse.json({ error: "observationId, promptId and audio are required" }, { status: 400 });
    }

    // Ownership check — the observation must belong to the session user.
    const obs = await prisma.observation.findFirst({ where: { id: observationId, userId } });
    if (!obs) return NextResponse.json({ error: "Observation not found" }, { status: 404 });

    const buffer = Buffer.from(await audio.arrayBuffer());
    const { audioUrl } = await saveAudio(observationId, promptId, buffer, audio.type || "audio/webm");
    const { transcription, language } = await transcribeAudio(buffer, audio.type || "audio/webm");

    await prisma.narrative.upsert({
      where: { observationId_promptId: { observationId, promptId } },
      create: {
        observationId,
        promptId,
        audioUrl,
        transcription: transcription ?? null,
        language,
        status: "completed",
      },
      // Preserve any existing text response; only (re)set audio + transcription.
      update: { audioUrl, transcription: transcription ?? null, language, status: "completed" },
    });

    await logAuditEvent({
      entityId: observationId,
      entityType: "Narrative",
      actionType: ActionType.UPDATE,
      dataAfter: { promptId, audioUrl, hasTranscription: !!transcription, language },
      userId,
    });

    return NextResponse.json({ audioUrl, transcription: transcription ?? null, language });
  } catch (error) {
    console.error("Failed to save narrative audio:", error);
    return NextResponse.json({ error: "Failed to save audio" }, { status: 500 });
  }
}
