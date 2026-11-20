import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { transcribeAudio } from "@/lib/media/stt";

export const runtime = "nodejs";

/**
 * POST /api/voice — transcribe a voice clip (used by the Aminata chatbot's
 * mic input). multipart/form-data: { audio: Blob }
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "audio is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await audio.arrayBuffer());
  const { transcription, language, provider } = await transcribeAudio(buffer, audio.type || "audio/webm");

  return NextResponse.json({
    success: transcription !== null,
    transcription,
    language,
    provider,
    processedAt: new Date().toISOString(),
  });
}
