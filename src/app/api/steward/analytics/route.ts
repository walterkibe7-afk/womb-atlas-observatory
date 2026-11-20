import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStewardAnalytics } from "@/lib/steward/analytics";
import { parseWindow } from "@/lib/date-range";

/**
 * GET /api/steward/analytics — the lower dashboard sections (Observatory Growth,
 * Observation Return Rate, Meaning Signals).
 *
 * Kept separate from /api/steward/stats: those metrics drive the review queue
 * and load with the page, whereas these are below-the-fold aggregates over the
 * whole Atlas. Splitting them keeps the queue responsive.
 *
 * `?range=7d|30d|90d|all|custom` (with `?from=&to=` for custom) is the header
 * date filter; see getStewardAnalytics for exactly which sections it scopes and
 * which stay whole-history.
 */
export async function GET(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "steward") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();
    const window = parseWindow(new URL(req.url).searchParams, now);
    return NextResponse.json(await getStewardAnalytics(now, window));
  } catch (error) {
    console.error("Failed to load steward analytics:", error);
    return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
  }
}
