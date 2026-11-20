import { NextResponse } from "next/server";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { readChatAudio } from "@/lib/media/storage";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  webm: "audio/webm",
  mp4: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
  mp3: "audio/mpeg",
};

/**
 * GET /api/chat/audio/[file] — authenticated playback for a chat voice clip
 * (recorded message or synthesized reply). The file name is `<messageId>.<ext>`;
 * we verify the message's conversation belongs to the session user before serving.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const { file } = await params;
    const safe = path.basename(file); // strip any path traversal
    const dot = safe.lastIndexOf(".");
    const messageId = dot === -1 ? safe : safe.slice(0, dot);
    const ext = dot === -1 ? "webm" : safe.slice(dot + 1);

    const message = await prisma.chatMessage.findUnique({
      where: { id: messageId },
      select: { conversation: { select: { userId: true } } },
    });
    if (!message || message.conversation.userId !== userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data = await readChatAudio(safe);
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
