import { NextResponse } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { readAudio } from "@/lib/media/storage";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  webm: "audio/webm",
  mp4: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
};

/**
 * GET /api/observation/narrative/audio/[file] — authenticated narrative audio.
 * The file name encodes the observation id (`<observationId>__<promptId>.<ext>`);
 * we verify that observation belongs to the session user before serving.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const { file } = await params;
    const safe = path.basename(file); // strip any path traversal
    const observationId = safe.split("__")[0];

    const obs = await prisma.observation.findFirst({ where: { id: observationId, userId } });
    if (!obs) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = await readAudio(safe);
    const ext = safe.split(".").pop() ?? "webm";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
