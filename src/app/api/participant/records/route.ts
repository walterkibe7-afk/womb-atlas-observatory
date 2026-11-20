import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getParticipantRecords } from "@/lib/observation/summary";

/**
 * GET /api/participant/records — the signed-in participant's Atlas Records
 * (newest first) with the rich record_payload the Records/Reflections pages render.
 */
export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ records: [] });

    const records = await getParticipantRecords(userId, session?.user?.locale ?? "en");
    return NextResponse.json({ records });
  } catch (error) {
    console.error("Failed to load participant records:", error);
    return NextResponse.json({ records: [] });
  }
}
