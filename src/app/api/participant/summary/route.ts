import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getParticipantSummary } from "@/lib/observation/summary";

/**
 * GET /api/participant/summary — the authenticated participant's dashboard data
 * (real recorded observations) plus the first-observation completion flag used to
 * gate the sidebar and the onboarding redirect.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ summary: null }, { status: 401 });

  try {
    const summary = await getParticipantSummary(userId, session?.user?.locale ?? "en");
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Failed to build participant summary:", error);
    return NextResponse.json({ summary: null }, { status: 500 });
  }
}
