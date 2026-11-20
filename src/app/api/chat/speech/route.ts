import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { synthesizeSpeech } from "@/lib/media/tts";

export const runtime = "nodejs";

const MAX_CHARS = 2000;

/**
 * POST /api/chat/speech — synthesize Aminata's reply as speech.
 * Body: { text: string } -> audio/mpeg
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = (await req.json()) as { text?: string };
  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const { audio, mimeType } = await synthesizeSpeech(text.slice(0, MAX_CHARS));
  if (!audio) {
    return NextResponse.json({ error: "Speech synthesis unavailable" }, { status: 502 });
  }

  return new Response(new Uint8Array(audio), {
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(audio.length),
      "Cache-Control": "no-store",
    },
  });
}
